/**
 * Node.js HTTP Backend & Static File Server for PrepAI Master
 * Handles /api/ai-teacher/lesson and /api/ai-teacher/ask using Gemini API
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');

const PORT = process.env.PORT || 8080;
const PUBLIC_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

function callGeminiAPI(prompt, apiKey, expectJson = true) {
  const key = apiKey || process.env.GEMINI_API_KEY;
  if (!key) return Promise.resolve(null);

  return new Promise((resolve) => {
    const postData = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      ...(expectJson ? { generationConfig: { responseMimeType: "application/json" } } : {})
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      port: 443,
      path: `/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const text = parsed.candidates[0].content.parts[0].text;
          resolve(text);
        } catch (e) {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.write(postData);
    req.end();
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Gemini-Key');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const urlPath = req.url.split('?')[0];

  if (req.method === 'POST' && urlPath === '/api/ai-teacher/lesson') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      let reqObj = {};
      try { reqObj = JSON.parse(body); } catch(e) {}

      const subject = reqObj.subject || 'Data Structures';
      const topic = reqObj.topic || 'Stack';
      const level = reqObj.level || 'Beginner';
      const style = reqObj.style || 'Interactive';
      const language = reqObj.language || 'English';
      const voice = reqObj.voice || 'female_sweet';
      const clientKey = req.headers['x-gemini-key'];

      const prompt = `
You are an expert, patient, engaging AI Engineering Teacher.
Teach this topic specifically for an engineering student.

Subject: ${subject}
Topic: ${topic}
Student Level: ${level}
Teaching Style: ${style}
Language: ${language}

CRITICAL TEACHING INSTRUCTIONS:
1. Explain the topic MUCH MORE CLEARLY and IN GREATER DETAIL than a standard summary.
2. Explain step-by-step, starting from absolute basics.
3. Use simple, student-friendly language.
4. Define important technical terms BEFORE using them.
5. Give relevant real-world examples and analogies wherever useful.
6. Break difficult concepts into smaller, easily digestible parts.
7. Explain WHY something works, not just WHAT it is.
8. Highlight key takeaways and important points.
9. When appropriate, use formulas and explain EVERY single variable in the formula.
10. For numerical/algorithmic problems, show the solution step-by-step with clear calculations.
11. For programming topics, explain the underlying logic step-by-step and provide clean, simple code examples with comments.
12. End with a thorough summary or key points.

Language rules:
- Explain in the requested language: ${language}.
- If Language is 'Hindi', write introductions, section titles, section explanations, analogies, questions, options, and quiz questions in Devanagari Hindi script (हिंदी).
- If Language is 'Marathi', write in Devanagari Marathi script (मराठी).
- If Language is 'Hinglish', write in conversational Hinglish (Hindi + English).
- Keep core technical terms (e.g. Stack, Queue, Pointer, Normalization, B-Tree, Time Complexity) in English when helpful for engineering students.

Return ONLY a valid JSON object matching this exact schema:
{
  "title": "${topic}",
  "subject": "${subject}",
  "level": "${level}",
  "style": "${style}",
  "language": "${language}",
  "introduction": "Detailed, encouraging introduction in ${language} introducing ${topic} starting from absolute basics...",
  "sections": [
    {
      "id": "sec-1",
      "title": "1. Section Title (Basics & Term Definitions)",
      "content": "Deep, step-by-step explanation in ${language} defining terms first, explaining why it works...",
      "keyConcept": "Clear key takeaway...",
      "visualType": "stack",
      "visualData": {
        "description": "Visual diagram description",
        "codeSnippet": "// clean code snippet if relevant"
      },
      "checkpointQuestion": {
        "question": "Checkpoint question in ${language}?",
        "options": ["Option A", "Option B", "Option C", "Option D"],
        "correctIndex": 0,
        "explanation": "Detailed explanation of why this answer is correct in ${language}"
      }
    }
  ],
  "examples": ["Real-world example 1 in ${language}", "Real-world example 2"],
  "importantPoints": ["Key point 1", "Key point 2"],
  "quiz": [
    {
      "question": "Quiz question in ${language}?",
      "options": ["A", "B", "C", "D"],
      "correctIndex": 0,
      "explanation": "Detailed explanation of the correct answer in ${language}"
    }
  ],
  "summary": "Comprehensive summary of key concepts in ${language}."
}
`;
      const aiResult = await callGeminiAPI(prompt, clientKey, true);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      if (aiResult) {
        res.end(aiResult);
      } else {
        res.end(JSON.stringify({ error: "API_KEY_MISSING_OR_OFFLINE", message: "Gemini API key not configured on server or request failed. Using fallback engine." }));
      }
    });
    return;
  }

  if (req.method === 'POST' && urlPath === '/api/ai-teacher/ask') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      let reqObj = {};
      try { reqObj = JSON.parse(body); } catch(e) {}

      const subject = reqObj.subject || 'Engineering';
      const topic = reqObj.topic || 'Engineering Topic';
      const language = reqObj.language || 'English';
      const question = reqObj.question || 'Can you explain this again?';
      const clientKey = req.headers['x-gemini-key'];

      const prompt = `
You are an expert AI Engineering Teacher answering a student's follow-up question.
Topic: ${topic}
Subject: ${subject}
Language: ${language}
Student Question: "${question}"

INSTRUCTIONS FOR THE ANSWER:
1. Explain the requested concept in GREAT DETAIL and crystal clear clarity.
2. Start from the absolute basics of this specific concept.
3. Define key terms first before using them.
4. Explain step-by-step WHY it works that way.
5. Provide relevant real-world examples, code snippets, or formulas with variable explanations if applicable.
6. Break down complex steps so a student can easily follow.
7. End with a short summary of key takeaways.
8. Write the response in ${language}. Keep technical terms in English when helpful.
`;
      const aiResult = await callGeminiAPI(prompt, clientKey, false);

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      if (aiResult) {
        res.end(JSON.stringify({ answer: aiResult.trim() }));
      } else {
        const qLower = question.toLowerCase();
        let ans = `Great question about ${topic}! `;
        if (qLower.includes('why') || qLower.includes('reason')) {
          ans += `In ${topic}, this design decision ensures operational stability, structural safety, or performance under constrained resources.`;
        } else if (qLower.includes('difference') || qLower.includes('vs') || qLower.includes('compare')) {
          ans += `The main trade-off comes down to speed vs memory overhead: one prioritizes raw throughput, while the other saves memory space or handles complex edge cases.`;
        } else if (qLower.includes('time') || qLower.includes('fast') || qLower.includes('complexity')) {
          ans += `Performance in ${topic} depends on how steps scale with input size. Avoiding redundant iterations or nested loops yields significant time gains.`;
        } else if (qLower.includes('memory') || qLower.includes('space') || qLower.includes('pointer')) {
          ans += `Memory management in ${topic} focuses on allocating contiguous blocks, avoiding memory leaks, and tracking active references safely.`;
        } else {
          ans += `When studying ${topic}, break down the process into input initialization, transformation steps, and target output states.`;
        }
        res.end(JSON.stringify({ answer: ans }));
      }
    });
    return;
  }

  let filePath = path.join(PUBLIC_DIR, urlPath === '/' ? 'index.html' : urlPath);
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 PrepAI Master Node Server running at http://localhost:${PORT}`);
});
