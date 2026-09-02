# Lightweight Local Static HTTP File & API Server for Interview Preparation Assistant
$port = 8080
$prefix = "http://localhost:$port/"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)

try {
    $listener.Start()
    Write-Host "🚀 Interview Prep Assistant Server running at $prefix"
} catch {
    Write-Error "Failed to start listener: $_"
    exit 1
}

$rootFolder = $PSScriptRoot

# Helper function to call Gemini API
function Call-GeminiAPI {
    param (
        [string]$Prompt,
        [string]$ApiKey,
        [bool]$ExpectJson = $true
    )

    if ([string]::IsNullOrWhiteSpace($ApiKey)) {
        $ApiKey = $env:GEMINI_API_KEY
    }

    if ([string]::IsNullOrWhiteSpace($ApiKey)) {
        return $null
    }

    $url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=$ApiKey"
    
    $payload = @{
        contents = @(
            @{
                parts = @(
                    @{ text = $Prompt }
                )
            }
        )
    }

    if ($ExpectJson) {
        $payload.generationConfig = @{
            responseMimeType = "application/json"
        }
    }

    $jsonPayload = $payload | ConvertTo-Json -Depth 10

    try {
        $apiResponse = Invoke-RestMethod -Uri $url -Method Post -Body $jsonPayload -ContentType "application/json" -TimeoutSec 15
        $text = $apiResponse.candidates[0].content.parts[0].text
        return $text
    } catch {
        Write-Host "Gemini API call failed: $_"
        return $null
    }
}

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        # CORS Headers
        $response.Headers.Add("Access-Control-Allow-Origin", "*")
        $response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        $response.Headers.Add("Access-Control-Allow-Headers", "Content-Type, X-Gemini-Key")

        if ($request.HttpMethod -eq "OPTIONS") {
            $response.StatusCode = 200
            $response.Close()
            continue
        }

        $localPath = $request.Url.LocalPath.ToLower()

        # Handle API Endpoints
        if ($request.HttpMethod -eq "POST" -and $localPath -eq "/api/ai-teacher/lesson") {
            $reader = New-Object System.IO.StreamReader($request.InputStream, $request.ContentEncoding)
            $bodyText = $reader.ReadToEnd()
            $reader.Close()

            $reqObj = $bodyText | ConvertFrom-Json -ErrorAction SilentlyContinue

            $subject  = if ($reqObj.subject) { $reqObj.subject } else { "Data Structures" }
            $topic    = if ($reqObj.topic) { $reqObj.topic } else { "Stack" }
            $level    = if ($reqObj.level) { $reqObj.level } else { "Beginner" }
            $style    = if ($reqObj.style) { $reqObj.style } else { "Interactive" }
            $language = if ($reqObj.language) { $reqObj.language } else { "English" }
            $voice    = if ($reqObj.voice) { $reqObj.voice } else { "female_sweet" }

            $clientApiKey = $request.Headers["X-Gemini-Key"]

            $prompt = @"
You are a friendly, sweet, encouraging AI engineering teacher.
Teach this topic specifically for an engineering student.

Subject: $subject
Topic: $topic
Student Level: $level
Teaching Style: $style
Language: $language

Generate a fresh lesson specifically for this topic.
Do not use a previous topic.
Do not repeat a previous lesson.
Do not assume the topic is Fast Transpose.
Do not use hard-coded answers.

Explain the topic in the selected language ($language).
If Language is 'Hindi', write ALL introductions, section titles, section explanations, analogies, checkpoint questions, options, and quiz questions in Devanagari Hindi script (हिंदी).
If Language is 'Marathi', write in Devanagari Marathi script.
If Language is 'Hinglish', write in conversational Hinglish (Hindi + English).
Keep important technical terminology (e.g. Stack, Queue, Pointer, Class, Normalization) in English when useful.

Make the explanation engaging, conversational, friendly and easy to understand.

Return ONLY a valid JSON object matching this exact schema:
{
  "title": "$topic",
  "subject": "$subject",
  "level": "$level",
  "style": "$style",
  "language": "$language",
  "introduction": "Friendly introduction in $language introducing $topic...",
  "sections": [
    {
      "id": "sec-1",
      "title": "Section Title",
      "content": "Explanation in $language...",
      "keyConcept": "Key takeaway...",
      "visualType": "stack",
      "visualData": {
        "description": "Visual diagram description",
        "codeSnippet": "// code snippet if relevant"
      },
      "checkpointQuestion": {
        "question": "Question in $language?",
        "options": ["Opt A", "Opt B", "Opt C", "Opt D"],
        "correctIndex": 0,
        "explanation": "Explanation in $language"
      }
    }
  ],
  "examples": ["Real-world example 1 in $language", "Example 2"],
  "importantPoints": ["Key point 1", "Key point 2"],
  "quiz": [
    {
      "question": "Quiz question in $language?",
      "options": ["Opt A", "Opt B", "Opt C", "Opt D"],
      "correctIndex": 0,
      "explanation": "Why correct in $language"
    }
  ],
  "summary": "Summary of the lesson in $language."
}
"@

            $aiResult = Call-GeminiAPI -Prompt $prompt -ApiKey $clientApiKey -ExpectJson $true

            $response.ContentType = "application/json; charset=utf-8"
            if (-not [string]::IsNullOrWhiteSpace($aiResult)) {
                $buffer = [System.Text.Encoding]::UTF8.GetBytes($aiResult)
            } else {
                # Signal frontend to use offline engine or fallback message
                $errObj = @{ error = "API_KEY_MISSING_OR_OFFLINE"; message = "Gemini API key not configured on server or request failed. Using AI visual fallback engine." }
                $buffer = [System.Text.Encoding]::UTF8.GetBytes(($errObj | ConvertTo-Json -Depth 5))
            }
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.Close()
            continue
        }

        if ($request.HttpMethod -eq "POST" -and $localPath -eq "/api/ai-teacher/ask") {
            $reader = New-Object System.IO.StreamReader($request.InputStream, $request.ContentEncoding)
            $bodyText = $reader.ReadToEnd()
            $reader.Close()

            $reqObj = $bodyText | ConvertFrom-Json -ErrorAction SilentlyContinue
            $subject  = if ($reqObj.subject) { $reqObj.subject } else { "Engineering" }
            $topic    = if ($reqObj.topic) { $reqObj.topic } else { "Engineering Topic" }
            $language = if ($reqObj.language) { $reqObj.language } else { "English" }
            $question = if ($reqObj.question) { $reqObj.question } else { "Can you explain this?" }

            $clientApiKey = $request.Headers["X-Gemini-Key"]

            $prompt = @"
You are a friendly AI Engineering Teacher. A student studying '$topic' ($subject) in language '$language' asks you:
'$question'

Give a simple, clear, friendly 2-3 sentence answer specifically about '$topic' in the selected language ($language).
Keep important technical terms in English when helpful.
"@

            $aiResult = Call-GeminiAPI -Prompt $prompt -ApiKey $clientApiKey -ExpectJson $false

            $response.ContentType = "application/json; charset=utf-8"
            if (-not [string]::IsNullOrWhiteSpace($aiResult)) {
                $resObj = @{ answer = $aiResult.Trim() }
            } else {
                $qLower = $question.ToLower()
                $ans = "Great question about $topic! "
                if ($qLower -like "*why*" -or $qLower -like "*reason*") {
                    $ans += "In $topic, this design choice guarantees system efficiency, correctness, and resource safety under constraints."
                } elseif ($qLower -like "*difference*" -or $qLower -like "*vs*" -or $qLower -like "*compare*") {
                    $ans += "The primary trade-off comes down to speed vs memory overhead: one prioritizes raw throughput, while the other saves memory or handles complex edge cases."
                } elseif ($qLower -like "*time*" -or $qLower -like "*fast*" -or $qLower -like "*complexity*") {
                    $ans += "Performance in $topic depends on how steps scale with input size. Eliminating redundant scans or nested loops gives significant speed gains."
                } elseif ($qLower -like "*memory*" -or $qLower -like "*space*" -or $qLower -like "*pointer*") {
                    $ans += "Memory management in $topic focuses on contiguous block allocation, avoiding fragmentation, and tracking active references safely."
                } else {
                    $ans += "When studying $topic, break down the process into input setup, transformation steps, and target output states."
                }
                $resObj = @{ answer = $ans }
            }
            $buffer = [System.Text.Encoding]::UTF8.GetBytes(($resObj | ConvertTo-Json))
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.Close()
            continue
        }

        # Static File Serving
        $relPath = $request.Url.LocalPath.TrimStart('/')
        if ([string]::IsNullOrWhiteSpace($relPath)) {
            $relPath = "index.html"
        }

        $filePath = [System.IO.Path]::Combine($rootFolder, $relPath)

        if (Test-Path $filePath -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            switch ($ext) {
                ".html" { $response.ContentType = "text/html; charset=utf-8" }
                ".css"  { $response.ContentType = "text/css; charset=utf-8" }
                ".js"   { $response.ContentType = "application/javascript; charset=utf-8" }
                ".json" { $response.ContentType = "application/json; charset=utf-8" }
                ".png"  { $response.ContentType = "image/png" }
                ".jpg"  { $response.ContentType = "image/jpeg" }
                ".svg"  { $response.ContentType = "image/svg+xml" }
                default { $response.ContentType = "application/octet-stream" }
            }

            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $buffer = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
        }
        $response.Close()
    } catch {
        # Catch connection resets
    }
}

