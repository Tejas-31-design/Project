/**
 * AI Engineering Teacher Engine (AITeacherEngine)
 * Handles interactive AI teaching sessions, Gemini API backend calls,
 * Web Speech API TTS narration with voice & language selection,
 * dynamic HTML/CSS/JS visual animations (Stack, Matrix, Trees, etc.),
 * doubt resolution, and quiz evaluation.
 */

window.AITeacherEngine = (() => {

  // --- Preset Subjects and Topics Database ---
  const SUBJECT_TOPICS = {
    "Data Structures": [
      "Stack",
      "Fast Transpose of Sparse Matrix",
      "Binary Search Tree Insertion & Search",
      "Queue & Circular Queue",
      "Graph Traversal: BFS vs DFS",
      "Linked List Reversal (Iterative & Recursive)",
      "HeapSort & Priority Queues",
      "AVL Tree Rotations"
    ],
    "C Programming": [
      "Pointers & Memory Address Arithmetic",
      "Dynamic Memory Allocation (malloc, calloc, free)",
      "Structure Padding & Bit Fields",
      "File I/O Streams and Buffering",
      "Function Pointers & Callbacks"
    ],
    "C++": [
      "Classes & Objects",
      "Virtual Functions & Runtime Polymorphism",
      "Templates & Standard Template Library (STL)",
      "Copy Constructors vs Move Semantics",
      "RAII & Smart Pointers (std::unique_ptr)",
      "Multiple Inheritance & Diamond Problem"
    ],
    "DBMS": [
      "Normalization (1NF, 2NF, 3NF, BCNF)",
      "B-Tree & B+ Tree Indexing Structures",
      "ACID Properties & Transaction Isolation",
      "SQL Joins & Relational Algebra",
      "Deadlock Prevention in Database Transactions"
    ],
    "Operating Systems": [
      "Process Management & CPU Scheduling",
      "Deadlock Detection & Banker's Algorithm",
      "Page Replacement Algorithms (LRU, FIFO, Optimal)",
      "Virtual Memory & Demand Paging",
      "Semaphores & Mutex Synchronization"
    ],
    "Computer Networks": [
      "TCP 3-Way Handshake & Connection State",
      "OSI 7-Layer vs TCP/IP Protocol Stack",
      "Subnetting & CIDR Address Calculations",
      "DNS Resolution & Caching Hierarchy",
      "Distance Vector vs Link State Routing"
    ],
    "Computer Organization": [
      "Cache Memory Mapping: Direct, Associative, Set-Associative",
      "Pipelining Hazards: Data, Control, Structural",
      "Instruction Execution Cycle & Micro-operations",
      "Bus Arbitration Protocols",
      "Floating Point Representation (IEEE 754)"
    ],
    "Engineering Mathematics": [
      "Matrix Eigenvalues & Eigenvectors",
      "Laplace Transforms for Differential Equations",
      "Fourier Series Expansion of Periodic Signals",
      "Vector Calculus: Gradient, Divergence, Curl",
      "Probability Distributions & Bayes Theorem"
    ],
    "Engineering Physics": [
      "Semiconductor Band Theory & PN Junction Diode",
      "Laser Stimulated Emission & Population Inversion",
      "Wave Interference & Double-Slit Diffraction",
      "Quantum Tunneling & Wave Function",
      "Fiber Optics Total Internal Reflection"
    ],
    "Engineering Mechanics": [
      "Free Body Diagrams & Static Equilibrium",
      "Truss Force Analysis: Method of Joints",
      "Moment of Inertia & Parallel Axis Theorem",
      "Kinematics of Rigid Bodies",
      "Friction & Impending Motion Analysis"
    ]
  };

  // --- Internal Session State ---
  let activeLesson = null;
  let currentSectionIndex = 0;
  let synth = window.speechSynthesis;
  let currentUtterance = null;
  let isSpeaking = false;
  let isMuted = false;
  let speechRate = 1.0;
  let doubtsHistory = [];
  let userQuizAnswers = {};

  // Interactive Stack Data State
  let stackElements = [30, 20, 10];

  /**
   * Initializes topic options and voice listeners
   */
  function init() {
    setupSubjectTopicSelects();
    setupEventListeners();
    loadVoices();
    if (synth) {
      synth.onvoiceschanged = loadVoices;
    }
  }

  function setupSubjectTopicSelects() {
    const subjectSelect = document.getElementById('ai-select-subject');
    const topicSelect = document.getElementById('ai-select-topic');
    const customTopicInput = document.getElementById('ai-custom-topic-input');

    if (!subjectSelect || !topicSelect) return;

    // Populate initial default subject (Data Structures) topics
    populateTopicsForSubject(subjectSelect.value, topicSelect, customTopicInput);

    subjectSelect.addEventListener('change', () => {
      resetCurrentSessionState();
      populateTopicsForSubject(subjectSelect.value, topicSelect, customTopicInput);
    });

    topicSelect.addEventListener('change', () => {
      resetCurrentSessionState();
      if (topicSelect.value === 'Custom Topic') {
        if (customTopicInput) customTopicInput.style.display = 'block';
      } else {
        if (customTopicInput) customTopicInput.style.display = 'none';
      }
    });

    ['ai-select-level', 'ai-select-style', 'ai-select-language', 'ai-select-voice'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', () => {
        resetCurrentSessionState();
      });
    });
  }

  function populateTopicsForSubject(selectedSubject, topicSelect, customTopicInput) {
    topicSelect.innerHTML = '';
    if (selectedSubject === 'Custom') {
      const option = document.createElement('option');
      option.value = 'Custom Topic';
      option.textContent = 'Custom Topic (Enter below)';
      topicSelect.appendChild(option);
      if (customTopicInput) customTopicInput.style.display = 'block';
    } else {
      if (customTopicInput) customTopicInput.style.display = 'none';
      const topics = SUBJECT_TOPICS[selectedSubject] || ["General Overview"];
      topics.forEach(topic => {
        const option = document.createElement('option');
        option.value = topic;
        option.textContent = topic;
        topicSelect.appendChild(option);
      });
    }
  }

  function setupEventListeners() {
    const questionInput = document.getElementById('input-ai-question');
    if (questionInput) {
      questionInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          askQuestion();
        }
      });
    }
  }

  /**
   * Resets active session state when parameters change
   */
  function resetCurrentSessionState() {
    stopVoice();
    currentSectionIndex = 0;
    userQuizAnswers = {};
    doubtsHistory = [];

    const progressPercent = 0;
    const progressBar = document.getElementById('ai-progress-bar');
    const progressText = document.getElementById('ai-progress-text');
    if (progressBar) progressBar.style.width = '0%';
    if (progressText) progressText.textContent = '0% (Ready to start)';

    const doubtsContainer = document.getElementById('ai-doubts-history');
    if (doubtsContainer) doubtsContainer.innerHTML = '';

    const quizBadge = document.getElementById('ai-quiz-score-badge');
    const quizFeedback = document.getElementById('ai-quiz-feedback-banner');
    if (quizBadge) quizBadge.style.display = 'none';
    if (quizFeedback) quizFeedback.style.display = 'none';
  }

  /**
   * Starts AI Session by fetching from backend API (or using dynamic fallback)
   */
  async function startSession() {
    resetCurrentSessionState();

    const subjectSelect = document.getElementById('ai-select-subject');
    const topicSelect = document.getElementById('ai-select-topic');
    const customTopicInput = document.getElementById('ai-custom-topic-input');
    const levelSelect = document.getElementById('ai-select-level');
    const styleSelect = document.getElementById('ai-select-style');
    const languageSelect = document.getElementById('ai-select-language');
    const voiceSelect = document.getElementById('ai-select-voice');
    const startBtn = document.getElementById('btn-start-ai-session');

    const subject = subjectSelect ? subjectSelect.value : 'Data Structures';
    let topic = topicSelect ? topicSelect.value : 'Stack';
    if ((subject === 'Custom' || topic === 'Custom Topic') && customTopicInput && customTopicInput.value.trim() !== '') {
      topic = customTopicInput.value.trim();
    }
    const level = levelSelect ? levelSelect.value : 'Beginner';
    const style = styleSelect ? styleSelect.value : 'Interactive';
    const language = languageSelect ? languageSelect.value : 'English';
    const voice = voiceSelect ? voiceSelect.value : 'female_sweet';

    if (startBtn) {
      startBtn.disabled = true;
      startBtn.innerHTML = '<span>⏳ Generating AI Teaching Session...</span>';
    }

    let lessonData = null;
    const userApiKey = localStorage.getItem('prep_ai_gemini_key') || '';

    try {
      const response = await fetch('/api/ai-teacher/lesson', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Gemini-Key': userApiKey
        },
        body: JSON.stringify({ subject, topic, level, style, language, voice })
      });

      if (response.ok) {
        const resJson = await response.json();
        if (resJson && resJson.sections && resJson.sections.length > 0) {
          lessonData = resJson;
        }
      }
    } catch (err) {
      console.warn("Backend API request failed or offline. Engaging dynamic teacher engine.");
    }

    if (!lessonData) {
      lessonData = generateFallbackLesson(subject, topic, level, style, language, voice);
    }

    activeLesson = lessonData;
    currentSectionIndex = 0;

    if (startBtn) {
      startBtn.disabled = false;
      startBtn.innerHTML = '<span>🎬 START AI SESSION</span>';
    }

    renderActiveSessionUI();
  }

  /**
   * Renders the Active Session UI elements
   */
  function renderActiveSessionUI() {
    const sessionCard = document.getElementById('ai-teacher-session-card');
    if (sessionCard) sessionCard.style.display = 'flex';

    // Populate header badges
    document.getElementById('ai-session-subject-badge').textContent = activeLesson.subject || 'Engineering';
    document.getElementById('ai-session-level-badge').textContent = activeLesson.level || 'Beginner';
    document.getElementById('ai-session-style-badge').textContent = activeLesson.style || 'Interactive';
    document.getElementById('ai-session-language-badge').textContent = activeLesson.language || 'English';
    
    const voiceLabels = {
      female_sweet: '👩 Female — Sweet',
      female_calm: '👩 Female — Calm',
      male_friendly: '👨 Male — Friendly',
      default: '🔊 System Default'
    };
    document.getElementById('ai-session-voice-badge').textContent = voiceLabels[activeLesson.voice || 'female_sweet'] || '👩 Female Voice';

    document.getElementById('ai-session-topic-title').textContent = `Topic: ${activeLesson.title}`;
    document.getElementById('ai-session-intro-text').textContent = activeLesson.introduction || '';

    // Render Doubts history reset
    const doubtsContainer = document.getElementById('ai-doubts-history');
    if (doubtsContainer) doubtsContainer.innerHTML = '';

    // Render Quiz
    renderQuizUI();

    // Render current section
    renderSection(0);
  }

  /**
   * Renders a specific lesson section by index
   */
  function renderSection(index) {
    if (!activeLesson || !activeLesson.sections || index < 0 || index >= activeLesson.sections.length) return;

    currentSectionIndex = index;
    const section = activeLesson.sections[index];
    const totalSections = activeLesson.sections.length;

    // Progress calculations
    const progressPercent = Math.round(((index + 1) / totalSections) * 100);
    const progressBar = document.getElementById('ai-progress-bar');
    const progressText = document.getElementById('ai-progress-text');

    if (progressBar) progressBar.style.width = `${progressPercent}%`;
    if (progressText) progressText.textContent = `${progressPercent}% (Section ${index + 1} of ${totalSections})`;

    // Section title & content
    document.getElementById('ai-section-title').textContent = section.title;
    document.getElementById('ai-section-badge').textContent = `Section ${index + 1} of ${totalSections}`;
    document.getElementById('ai-section-explanation').innerHTML = section.content.replace(/\n/g, '<br>');

    // Real-world analogy box
    const analogyText = document.getElementById('ai-analogy-text');
    const analogyBox = document.getElementById('ai-analogy-box');
    if (section.keyConcept || (activeLesson.examples && activeLesson.examples[index])) {
      if (analogyBox) analogyBox.style.display = 'block';
      if (analogyText) analogyText.textContent = section.keyConcept || activeLesson.examples[index] || '';
    } else if (analogyBox) {
      analogyBox.style.display = 'none';
    }

    // Navigation buttons state
    const prevBtn = document.getElementById('btn-ai-prev-sec');
    const nextBtn = document.getElementById('btn-ai-next-sec');
    const counterText = document.getElementById('ai-sec-counter-text');

    if (prevBtn) prevBtn.disabled = (index === 0);
    if (nextBtn) nextBtn.disabled = (index === totalSections - 1);
    if (counterText) counterText.textContent = `Section ${index + 1} of ${totalSections}`;

    // Section Checkpoint Question
    renderCheckpoint(section.checkpointQuestion);

    // Render Visual Graphic Animation
    renderVisualGraphic(section.visualType || 'stack', section.visualData, index);

    // Trigger Speech Narration if active
    speakText(`${section.title}. ${section.content.replace(/<[^>]*>?/gm, '')}`);

    // Trigger MathJax re-render if loaded
    if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise();
    }
  }

  function prevSection() {
    if (currentSectionIndex > 0) renderSection(currentSectionIndex - 1);
  }

  function nextSection() {
    if (activeLesson && currentSectionIndex < activeLesson.sections.length - 1) {
      renderSection(currentSectionIndex + 1);
    }
  }

  /**
   * Dynamic HTML/CSS/JS Visual Animation Renderer
   */
  function renderVisualGraphic(visualType, visualData, sectionIndex) {
    const canvas = document.getElementById('ai-visual-canvas');
    const label = document.getElementById('ai-visual-type-label');
    if (!canvas) return;

    const topicTitle = (activeLesson ? activeLesson.title : '').toLowerCase();

    // 1. STACK VISUALIZER (Interactive Push/Pop)
    if (topicTitle.includes('stack') || visualType === 'stack') {
      if (label) label.textContent = 'INTERACTIVE STACK VISUALIZATION';
      renderStackCanvas(canvas);
      return;
    }

    // 2. FAST TRANSPOSE / MATRIX VISUALIZER
    if (topicTitle.includes('transpose') || topicTitle.includes('matrix') || visualType === 'matrix') {
      if (label) label.textContent = 'SPARSE MATRIX VISUALIZATION';
      canvas.innerHTML = `
        <div style="width: 100%; display: flex; flex-direction: column; align-items: center; gap: 1rem;">
          <div style="font-weight: 700; color: var(--primary-cyan); font-size: 0.95rem;">
            📊 3-Tuple Representation & Fast Transpose Mapping
          </div>
          
          <div style="display: flex; gap: 2rem; flex-wrap: wrap; justify-content: center; align-items: center;">
            <div style="display: flex; flex-direction: column; align-items: center;">
              <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.4rem; font-weight: 600;">Original Sparse Matrix</div>
              <div style="display: grid; grid-template-columns: repeat(4, 38px); gap: 4px; background: rgba(255,255,255,0.05); padding: 6px; border-radius: 8px; border: 1px solid var(--border-light);">
                <div class="matrix-cell highlight-cell">15</div><div class="matrix-cell">0</div><div class="matrix-cell">0</div><div class="matrix-cell">22</div>
                <div class="matrix-cell">0</div><div class="matrix-cell">0</div><div class="matrix-cell">3</div><div class="matrix-cell">0</div>
                <div class="matrix-cell">0</div><div class="matrix-cell">0</div><div class="matrix-cell">0</div><div class="matrix-cell">0</div>
                <div class="matrix-cell">91</div><div class="matrix-cell">0</div><div class="matrix-cell">0</div><div class="matrix-cell">0</div>
              </div>
            </div>
            <div style="font-size: 1.5rem; color: var(--primary-indigo); font-weight: 800;">➔</div>
            <div style="display: flex; flex-direction: column; align-items: center;">
              <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.4rem; font-weight: 600;">3-Tuple Array [Row, Col, Val]</div>
              <table style="border-collapse: collapse; font-family: var(--font-code); font-size: 0.82rem; color: var(--text-main); text-align: center;">
                <tr style="background: rgba(99,102,241,0.2); color: var(--primary-cyan);"><th>Index</th><th>Row</th><th>Col</th><th>Value</th></tr>
                <tr><td>[0]</td><td>4</td><td>4</td><td>4</td></tr>
                <tr class="trans-row"><td>[1]</td><td>0</td><td>0</td><td>15</td></tr>
                <tr class="trans-row"><td>[2]</td><td>0</td><td>3</td><td>22</td></tr>
                <tr class="trans-row"><td>[3]</td><td>1</td><td>2</td><td>3</td></tr>
                <tr class="trans-row"><td>[4]</td><td>3</td><td>0</td><td>91</td></tr>
              </table>
            </div>
          </div>
        </div>
      `;
      return;
    }

    // 3. CODE BLOCK VISUALIZER
    if (visualType === 'code' || (visualData && visualData.codeSnippet)) {
      if (label) label.textContent = 'SOURCE CODE VISUALIZATION';
      const codeText = visualData && visualData.codeSnippet ? visualData.codeSnippet : `// Code Implementation for ${activeLesson ? activeLesson.title : 'Topic'}\nvoid execute() {\n    // Core operational steps\n}`;
      canvas.innerHTML = `
        <div style="width: 100%;">
          <div style="font-weight: 700; color: var(--primary-cyan); font-size: 0.88rem; margin-bottom: 0.5rem; display: flex; align-items: center; justify-content: space-between;">
            <span>💻 C / C++ Source Code</span>
            <span class="badge badge-indigo">Source Code</span>
          </div>
          <pre style="background: rgba(15, 23, 42, 0.9); border: 1px solid var(--border-light); padding: 1rem; border-radius: var(--radius-sm); font-family: var(--font-code); font-size: 0.85rem; color: #a5f3fc; overflow-x: auto; line-height: 1.5;"><code>${escapeHtml(codeText)}</code></pre>
        </div>
      `;
      return;
    }

    // 4. GENERAL VISUALIZER
    if (label) label.textContent = (visualType || 'DIAGRAM').toUpperCase() + ' ANIMATION';
    canvas.innerHTML = `
      <div style="width: 100%; display: flex; flex-direction: column; align-items: center; gap: 0.75rem; text-align: center;">
        <div style="font-weight: 700; color: var(--primary-cyan); font-size: 0.95rem;">
          📐 Interactive Concept Architecture & Governing Logic
        </div>
        <div style="font-size: 1.1rem; color: var(--text-main); padding: 0.75rem 1.5rem; background: rgba(99,102,241,0.1); border-radius: var(--radius-sm); border: 1px solid var(--border-glow);">
          $$\\text{Operational Principle} = \\text{Efficiency} + \\text{Correctness}$$
        </div>
        <div style="font-size: 0.88rem; color: var(--text-secondary); max-width: 500px;">
          ${activeLesson ? activeLesson.title : 'Engineering Concept'} organizes processing steps to achieve optimal speed and memory performance.
        </div>
      </div>
    `;
  }

  /**
   * Helper to render dynamic interactive Stack Canvas
   */
  function renderStackCanvas(canvas) {
    let stackItemsHtml = '';
    stackElements.forEach((val, idx) => {
      const isTop = (idx === 0);
      stackItemsHtml += `
        <div style="padding: 0.6rem 1.5rem; background: ${isTop ? 'linear-gradient(90deg, var(--primary-indigo), var(--primary-cyan))' : 'rgba(30, 41, 59, 0.9)'}; border: 1px solid ${isTop ? 'var(--primary-cyan)' : 'var(--border-light)'}; border-radius: var(--radius-sm); color: #ffffff; font-family: var(--font-code); font-weight: 700; font-size: 0.95rem; text-align: center; display: flex; align-items: center; justify-content: space-between; gap: 1rem; width: 180px; box-shadow: ${isTop ? '0 0 12px rgba(6, 182, 212, 0.4)' : 'none'}; transition: all 0.3s ease;">
          <span>│  ${val}  │</span>
          ${isTop ? '<span class="badge badge-amber" style="font-size: 0.68rem;">← TOP</span>' : ''}
        </div>
      `;
    });

    canvas.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; gap: 1rem; width: 100%;">
        <div style="font-weight: 700; color: var(--primary-cyan); font-size: 0.95rem;">
          🥞 Stack Memory Layout (LIFO: Last-In, First-Out)
        </div>

        <div style="display: flex; gap: 2rem; align-items: center; flex-wrap: wrap; justify-content: center;">
          <div style="display: flex; flex-direction: column; gap: 0.35rem; padding: 0.75rem; background: rgba(15, 23, 42, 0.8); border: 2px solid var(--border-glow); border-top: none; border-radius: 0 0 12px 12px;">
            ${stackItemsHtml}
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.6rem;">
            <div style="display: flex; gap: 0.5rem;">
              <button class="btn btn-primary btn-sm" onclick="window.AITeacherEngine.pushStackItem()">➕ Push Item</button>
              <button class="btn btn-secondary btn-sm" onclick="window.AITeacherEngine.popStackItem()">➖ Pop Item</button>
            </div>
            <div style="font-size: 0.78rem; color: var(--text-muted); max-width: 220px; line-height: 1.4;">
              Elements are pushed and popped strictly from the <strong>TOP</strong> of the stack.
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function pushStackItem() {
    const newVal = (stackElements.length > 0 ? stackElements[0] + 10 : 10);
    stackElements.unshift(newVal);
    const canvas = document.getElementById('ai-visual-canvas');
    if (canvas) renderStackCanvas(canvas);
  }

  function popStackItem() {
    if (stackElements.length > 0) {
      stackElements.shift();
      const canvas = document.getElementById('ai-visual-canvas');
      if (canvas) renderStackCanvas(canvas);
    }
  }

  /**
   * Renders Section Checkpoint Question
   */
  function renderCheckpoint(checkpoint) {
    const box = document.getElementById('ai-checkpoint-box');
    const qEl = document.getElementById('ai-checkpoint-question');
    const optsEl = document.getElementById('ai-checkpoint-options');
    const fbEl = document.getElementById('ai-checkpoint-feedback');

    if (!checkpoint || !box) {
      if (box) box.style.display = 'none';
      return;
    }

    box.style.display = 'block';
    if (fbEl) fbEl.style.display = 'none';
    if (qEl) qEl.textContent = checkpoint.question;

    if (optsEl) {
      optsEl.innerHTML = '';
      checkpoint.options.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-secondary btn-sm';
        btn.style.textAlign = 'left';
        btn.textContent = `${String.fromCharCode(65 + idx)}. ${opt}`;
        btn.onclick = () => {
          if (idx === checkpoint.correctIndex) {
            fbEl.style.display = 'block';
            fbEl.style.color = 'var(--accent-emerald)';
            fbEl.textContent = `✅ Correct! ${checkpoint.explanation || ''}`;
          } else {
            fbEl.style.display = 'block';
            fbEl.style.color = 'var(--accent-rose)';
            fbEl.textContent = `❌ Not quite. Try again!`;
          }
        };
        optsEl.appendChild(btn);
      });
    }
  }

  /**
   * Renders the 5-Question Quick Quiz
   */
  function renderQuizUI() {
    const container = document.getElementById('ai-quiz-container');
    const badge = document.getElementById('ai-quiz-score-badge');
    const feedbackBanner = document.getElementById('ai-quiz-feedback-banner');

    if (!container || !activeLesson || !activeLesson.quiz) return;

    if (badge) badge.style.display = 'none';
    if (feedbackBanner) feedbackBanner.style.display = 'none';

    container.innerHTML = '';

    activeLesson.quiz.forEach((q, qIdx) => {
      const qCard = document.createElement('div');
      qCard.className = 'quiz-question-card';
      qCard.style.padding = '1rem';
      qCard.style.background = 'rgba(255,255,255,0.02)';
      qCard.style.border = '1px solid var(--border-light)';
      qCard.style.borderRadius = 'var(--radius-md)';

      let optionsHtml = '';
      q.options.forEach((opt, oIdx) => {
        optionsHtml += `
          <label style="display: flex; align-items: center; gap: 0.6rem; padding: 0.5rem 0.75rem; background: rgba(255,255,255,0.03); border-radius: var(--radius-sm); cursor: pointer; transition: var(--transition-fast);">
            <input type="radio" name="quiz-q-${qIdx}" value="${oIdx}" onchange="window.AITeacherEngine.selectQuizOption(${qIdx}, ${oIdx})">
            <span style="font-size: 0.9rem; color: var(--text-secondary);">${opt}</span>
          </label>
        `;
      });

      qCard.innerHTML = `
        <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-main); margin-bottom: 0.75rem;">
          Question ${qIdx + 1}: ${q.question}
        </div>
        <div style="display: flex; flex-direction: column; gap: 0.4rem;">
          ${optionsHtml}
        </div>
        <div id="quiz-explain-${qIdx}" style="margin-top: 0.6rem; font-size: 0.85rem; font-weight: 600; display: none;"></div>
      `;

      container.appendChild(qCard);
    });
  }

  function selectQuizOption(qIdx, oIdx) {
    userQuizAnswers[qIdx] = oIdx;
  }

  function submitQuiz() {
    if (!activeLesson || !activeLesson.quiz) return;

    let score = 0;
    const total = activeLesson.quiz.length;

    activeLesson.quiz.forEach((q, qIdx) => {
      const selected = userQuizAnswers[qIdx];
      const explainEl = document.getElementById(`quiz-explain-${qIdx}`);
      
      if (selected !== undefined && selected === q.correctIndex) {
        score++;
        if (explainEl) {
          explainEl.style.display = 'block';
          explainEl.style.color = 'var(--accent-emerald)';
          explainEl.textContent = `✅ Correct! ${q.explanation || ''}`;
        }
      } else if (explainEl) {
        explainEl.style.display = 'block';
        explainEl.style.color = 'var(--accent-rose)';
        explainEl.textContent = `❌ Incorrect. Correct Answer: ${q.options[q.correctIndex]}. ${q.explanation || ''}`;
      }
    });

    const badge = document.getElementById('ai-quiz-score-badge');
    const feedbackBanner = document.getElementById('ai-quiz-feedback-banner');
    const titleEl = document.getElementById('ai-quiz-result-title');
    const feedbackEl = document.getElementById('ai-quiz-result-feedback');

    if (badge) {
      badge.style.display = 'inline-block';
      badge.textContent = `Score: ${score}/${total}`;
    }

    if (feedbackBanner && titleEl && feedbackEl) {
      feedbackBanner.style.display = 'block';
      titleEl.textContent = `Score: ${score}/${total}`;
      
      if (score === total) {
        feedbackEl.textContent = `🌟 Outstanding work! You have mastered ${activeLesson.title} completely!`;
      } else if (score >= total * 0.6) {
        feedbackEl.textContent = `Great work! You understand ${activeLesson.title} well. Review the core concepts once more to achieve 100%!`;
      } else {
        feedbackEl.textContent = `Good try! Review the section diagrams and key takeaways above, then give it another shot!`;
      }
    }
  }

  /**
   * Asks AI Teacher a doubt via backend API sending subject, topic, language & question
   */
  async function askQuestion() {
    const input = document.getElementById('input-ai-question');
    const btn = document.getElementById('btn-ask-ai-teacher');
    const historyContainer = document.getElementById('ai-doubts-history');

    if (!input || input.value.trim() === '') return;

    const questionText = input.value.trim();
    input.value = '';

    if (btn) btn.disabled = true;

    const timeNow = new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});

    // Render student question immediately
    const userQCard = document.createElement('div');
    userQCard.className = 'ai-doubt-entry student';
    userQCard.innerHTML = `
      <div class="ai-doubt-header">
        <span class="ai-doubt-label" style="color: var(--primary-cyan);">🙋‍♂️ Student Question</span>
        <span class="ai-doubt-time">${timeNow}</span>
      </div>
      <div class="ai-doubt-body">${escapeHtml(questionText)}</div>
    `;
    if (historyContainer) historyContainer.prepend(userQCard);

    let answerText = "";
    const userApiKey = localStorage.getItem('prep_ai_gemini_key') || '';
    const subjectName = activeLesson ? activeLesson.subject : 'Engineering';
    const topicName = activeLesson ? activeLesson.title : 'Engineering Topic';
    const languageName = activeLesson ? activeLesson.language : 'English';

    try {
      const response = await fetch('/api/ai-teacher/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Gemini-Key': userApiKey
        },
        body: JSON.stringify({
          subject: subjectName,
          topic: topicName,
          language: languageName,
          question: questionText
        })
      });

      if (response.ok) {
        const resJson = await response.json();
        if (resJson && resJson.answer) {
          answerText = resJson.answer;
        }
      }
    } catch (err) {
      console.warn("Ask AI Teacher endpoint offline. Using dynamic response engine.");
    }

    if (!answerText) {
      answerText = generateTopicQuestionAnswer(topicName, languageName, questionText);
    }

    const ansTimeNow = new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
    const answerId = 'ai-answer-' + Date.now();

    // Render AI Teacher response with formatted HTML
    const aiAnswerCard = document.createElement('div');
    aiAnswerCard.className = 'ai-doubt-entry teacher';
    aiAnswerCard.innerHTML = `
      <div class="ai-doubt-header">
        <span class="ai-doubt-label" style="color: var(--accent-emerald);">🤖 AI Teacher Answer (${escapeHtml(languageName)})</span>
        <span class="ai-doubt-time">${ansTimeNow}</span>
      </div>
      <div class="ai-doubt-body" id="${answerId}">${formatAnswerHtml(answerText)}</div>
      <div class="ai-doubt-actions">
        <button class="ai-copy-btn" onclick="navigator.clipboard.writeText(document.getElementById('${answerId}').innerText).then(()=>{this.textContent='✅ Copied!'});setTimeout(()=>{this.textContent='📋 Copy'},1500);">📋 Copy</button>
      </div>
    `;
    if (historyContainer) historyContainer.prepend(aiAnswerCard);

    // Re-render MathJax if present
    if (window.MathJax && window.MathJax.typesetPromise) {
      try { window.MathJax.typesetPromise([aiAnswerCard]); } catch(e) {}
    }

    if (btn) btn.disabled = false;

    // Speak response
    speakText(answerText);
  }

  /**
   * Generates a dynamic, highly detailed, step-by-step answer for student doubts in the requested language
   */
  function generateTopicQuestionAnswer(topicName, languageName, questionText) {
    const qLower = questionText.toLowerCase();

    if (languageName === 'Hindi') {
      let ans = `बहुत अच्छा सवाल! आइए **${topicName}** के संबंध में आपके प्रश्न ("${questionText}") को गहराई से और चरण-दर-चरण (Step-by-Step) समझते हैं:\n\n`;
      ans += `📌 **1. बुनियादी अवधारणा एवं मुख्य शब्द (Core Terms):**\n`;
      ans += `${topicName} इंजीनियरिंग में एक महत्वपूर्ण विषय है। इससे पहले कि हम आगे बढ़ें, मूल शब्दों को समझना आवश्यक है: कोई भी सिस्टम डेटा प्रोसेसिंग, सुरक्षा और प्रदर्शन (Performance) के संतुलन पर काम करता है।\n\n`;
      ans += `⚙️ **2. यह कैसे और क्यों काम करता है? (Step-by-Step Mechanism):**\n`;
      if (qLower.includes('why') || qLower.includes('क्यों') || qLower.includes('reason')) {
        ans += `• **कारण (Why):** ${topicName} में यह डिज़ाइन निर्णय इसलिए लिया गया है ताकि सिस्टम पर अवांछित लोड न पड़े, मेमोरी का सही उपयोग हो, और डेटा में विसंगतियां (Anomalies) न आएँ।\n• **चरण 1:** इनपुट मापदंडों का सत्यापन करना।\n• **चरण 2:** मुख्य एल्गोरिदम/लॉजिक का निष्पादन।\n• **चरण 3:** अंतिम परिणाम को सुरक्षित रूप से स्टोर या रिटर्न करना।\n\n`;
      } else if (qLower.includes('difference') || qLower.includes('अंतर') || qLower.includes('vs') || qLower.includes('compare')) {
        ans += `• **मुख्य तुलना:** दोनों दृष्टिकोणों में मुख्य अंतर संसाधन (Resource) के उपयोग का है:\n  - पहला दृष्टिकोण: निष्पादन गति (Speed/Throughput) को प्राथमिकता देता है।\n  - दूसरा दृष्टिकोण: मेमोरी खपत (Memory Overhead) को कम करता है और जटिल स्थितियों (Edge Cases) को संभालता है।\n\n`;
      } else if (qLower.includes('time') || qLower.includes('complexity') || qLower.includes('तेज़') || qLower.includes('समय')) {
        ans += `• **समय जटिलता (Time Complexity):** ${topicName} का प्रदर्शन इस बात पर निर्भर करता है कि इनपुट का आकार (n) बढ़ने पर ऑपरेशन्स कैसे बढ़ते हैं।\n  - सूत्र: T(n) = O(f(n)), जहाँ n इनपुट तत्वों की संख्या है।\n  - अनावश्यक लूप्स को हटाकर निष्पादन समय को न्यूनतम किया जाता है।\n\n`;
      } else {
        ans += `• **चरण-दर-चरण प्रक्रिया:**\n  1. **प्रारंभिक स्थिति (Initialization):** वेरिएबल या मेमोरी पॉइंटर्स को प्रारंभिक मान देना।\n  2. **रूपांतरण (Transformation):** डेटा पर आवश्यक इंजीनियरिंग लॉजिक लागू करना।\n  3. **अंतिम आउटपुट (Final State):** परिणाम तैयार करना और संसाधनों को मुक्त करना।\n\n`;
      }
      ans += `💡 **3. व्यावहारिक उदाहरण (Real-world Analogy):**\n`;
      ans += `जैसे किसी ट्रैफिक सिग्नल पर गाड़ियों को सुचारू रूप से चलाने के लिए नियमों का पालन करना पड़ता है, ठीक वैसे ही ${topicName} सिस्टम में डेटा प्रवाह को नियंत्रित करता है।\n\n`;
      ans += `🎯 **मुख्य निष्कर्ष (Key Takeaway):** ${topicName} का मूल उद्देश्य सुरक्षा, गति और मेमोरी दक्षता के बीच सही संतुलन बनाना है।`;
      return ans;
    }

    if (languageName === 'Marathi') {
      let ans = `अतिशय उत्तम प्रश्न! चला **${topicName}** संदर्भातील तुमच्या प्रश्नाचे ("${questionText}") अत्यंत सखोल आणि पायरी-बाय-पायरी (Step-by-Step) स्पष्टीकरण पाहूया:\n\n`;
      ans += `📌 **1. मूलभूत संकल्पना आणि महत्त्वाच्या संज्ञा (Core Terms):**\n`;
      ans += `${topicName} ही अभियांत्रिकी मधील अत्यंत महत्त्वाची संकल्पना आहे. ही संकल्पना समजून घेण्यापूर्वी संज्ञा स्पष्ट असणे गरजेचे आहे: सिस्टीमची अचूकता, मेमरी व्यवस्थापन आणि गती यांचा मेळ घालणे हे याचे ध्येय आहे.\n\n`;
      ans += `⚙️ **2. हे कसे आणि का कार्य करते? (Step-by-Step Working & Why):**\n`;
      if (qLower.includes('why') || qLower.includes('का') || qLower.includes('reason')) {
        ans += `• **कारण (Why):** ${topicName} मध्ये हा निर्णय यासाठी घेतला जातो जेणेकरून सिस्टीमवर अनावश्यक ताण येऊ नये आणि डेटा सुरक्षित राहावा.\n• **पायरी 1:** इनपुट मूल्यांची तपासणी करणे.\n• **पायरी 2:** मुख्य अल्गोरिदम/लॉजिकची अंमलबजावणी करणे.\n• **पायरी 3:** आउटपुट सुरक्षितपणे साठवणे किंवा रिटर्न करणे.\n\n`;
      } else if (qLower.includes('difference') || qLower.includes('फरक') || qLower.includes('vs') || qLower.includes('compare')) {
        ans += `• **मुख्य फरक:** दोन पद्धतींमधील मुख्य फरक संसाधनांच्या वापरावर आधारित असतो:\n  - पहिली पद्धत: गती (Speed) आणि थ्रूपुटला प्राधान्य देते.\n  - दुसरी पद्धत: मेमरी बचत (Memory Footprint) आणि त्रुटी निवारणावर भर देते.\n\n`;
      } else if (qLower.includes('time') || qLower.includes('complexity') || qLower.includes('वेळ') || qLower.includes('गती')) {
        ans += `• **वेळ गुंतागुंत (Time Complexity):** कार्यक्षमता T(n) = O(f(n)) या सूत्रावर आधारित असते, जिथे n म्हणजे इनपुट घटकांची संख्या.\n\n`;
      } else {
        ans += `• **पायरी-बाय-पायरी प्रक्रिया:**\n  1. इनपुट डेटा सेट करणे.\n  2. लॉजिकनुसार डेटाची प्रक्रिया करणे.\n  3. अंतिम परिणाम मिळवणे.\n\n`;
      }
      ans += `💡 **3. वास्तववादी उदाहरण (Real-world Example):**\n`;
      ans += `जसे बँकिंग सिस्टीममध्ये प्रत्येक व्यवहाराची नोंद सुरक्षित ठेवण्यासाठी विशिष्ट नियमावली असते, तसेच ${topicName} सिस्टीमची रचना स्थिर ठेवते.\n\n`;
      ans += `🎯 **महत्त्वाचा मुद्दा (Key Takeaway):** ${topicName} चा मुख्य उद्देश मेमरी कार्यक्षमता आणि अचूकता राखणे हा आहे.`;
      return ans;
    }

    if (languageName === 'Hinglish') {
      let ans = `Bohot achha question! Aao **${topicName}** ke baare mein aapke question ("${questionText}") ko bilkul step-by-step aur detail mein samajhte hain:\n\n`;
      ans += `📌 **1. Core Concept & Terms Definition:**\n`;
      ans += `${topicName} engineering ka ek important concept hai. Age badhne se pehle basic terms samajhna zaroori hai: Har computer system speed, accuracy aur memory usage ke beech balance banakar kaam karta hai.\n\n`;
      ans += `⚙️ **2. Step-by-Step Breakdown (Why & How it Works):**\n`;
      if (qLower.includes('why') || qLower.includes('kyun') || qLower.includes('reason')) {
        ans += `• **Why it works this way:** ${topicName} mein yeh design choice isliye li gayi hai taaki system crush na ho, memory leak na ho, aur processing fast rahe.\n• **Step 1:** Input validation aur initialization.\n• **Step 2:** Main logic execution.\n• **Step 3:** Final state output generation.\n\n`;
      } else if (qLower.includes('difference') || qLower.includes('diff') || qLower.includes('vs') || qLower.includes('compare')) {
        ans += `• **Main Difference:** Comparison hamesha trade-off par depend karta hai:\n  - Method A: Speed aur processing throughput badhata hai.\n  - Method B: Memory overhead kam karta hai aur edge cases handle karta hai.\n\n`;
      } else if (qLower.includes('time') || qLower.includes('complexity') || qLower.includes('fast') || qLower.includes('speed')) {
        ans += `• **Time Complexity Analysis:** Time formula T(n) = O(f(n)) se decide hota hai, jahan n input elements ki count hai. Loop optimization se time complexity reduce hoti hai.\n\n`;
      } else {
        ans += `• **Detailed Execution Steps:**\n  1. **Start:** Input setup.\n  2. **Process:** Core logic execution.\n  3. **End:** Result output generation.\n\n`;
      }
      ans += `💡 **3. Real-World Analogy:**\n`;
      ans += `Jaise ek structured queue ya assembly line mein har item step-by-step process hota hai, waise hi ${topicName} system operations ko manage karta hai.\n\n`;
      ans += `🎯 **Key Takeaway:** ${topicName} ka primary goal high performance, zero data loss aur clean code maintain karna hai.`;
      return ans;
    }

    // Default English - Detailed step-by-step follow-up answer
    let ans = `Great follow-up question! Let's break down **${topicName}** regarding your specific query ("${questionText}") in complete step-by-step detail:\n\n`;
    ans += `📌 **1. Fundamental Concept & Key Term Definitions:**\n`;
    ans += `Before diving into the mechanics of ${topicName}, let's clearly define the core terms:\n`;
    ans += `• **State Management:** Tracking variables and system status throughout execution.\n`;
    ans += `• **Computational Trade-off:** The balance between execution speed (Time Complexity) and RAM consumption (Space Complexity).\n\n`;
    ans += `⚙️ **2. Step-by-Step Mechanics (Why & How It Works):**\n`;
    if (qLower.includes('why') || qLower.includes('reason')) {
      ans += `• **Why this design is chosen:** In ${topicName}, this architecture is selected to ensure deterministic execution, prevent memory leaks, and maintain high system throughput.\n`;
      ans += `• **Step 1 (Input Handling):** Input parameters are validated and loaded into memory.\n`;
      ans += `• **Step 2 (Core Processing):** The operational logic executes state transformations.\n`;
      ans += `• **Step 3 (Output & Cleanup):** Results are returned and transient memory is deallocated.\n\n`;
    } else if (qLower.includes('difference') || qLower.includes('vs') || qLower.includes('compare')) {
      ans += `• **Comparative Trade-off Analysis:**\n`;
      ans += `  - **Approach A:** Prioritizes raw execution throughput, using extra memory buffers.\n`;
      ans += `  - **Approach B:** Prioritizes minimal memory footprint, running in O(1) space complexity at the cost of additional logic checks.\n\n`;
    } else if (qLower.includes('time') || qLower.includes('fast') || qLower.includes('complexity')) {
      ans += `• **Algorithmic Time Complexity Analysis:**\n`;
      ans += `  - Formula: $T(n) = O(f(n))$ where $n$ represents input size and $T(n)$ denotes maximum operation count.\n`;
      ans += `  - Eliminating nested iterations reduces complexity from quadratic $O(n^2)$ down to linear $O(n)$ or constant $O(1)$.\n\n`;
    } else {
      ans += `• **Execution Breakdown:**\n`;
      ans += `  1. **Initialization:** Setting up pointer locations and base conditions.\n`;
      ans += `  2. **Transformation:** Executing the primary algorithm sequentially.\n`;
      ans += `  3. **Verification:** Validating edge cases and post-conditions.\n\n`;
    }
    ans += `💡 **3. Real-World Analogy & Practical Context:**\n`;
    ans += `Think of ${topicName} like an automated traffic control system: clear rules prevent collisions (data corruption) while optimizing traffic flow (system throughput).\n\n`;
    ans += `🎯 **Key Takeaways & Summary:**\n`;
    ans += `Understanding ${topicName} requires looking at how inputs are transformed step-by-step and recognizing the underlying trade-offs between execution speed and memory efficiency.`;

    return ans;
  }

  /**
   * Web Speech API TTS Audio Narration Engine with Voice & Language Matching
   */
  let cachedVoices = [];
  function loadVoices() {
    if (synth) {
      cachedVoices = synth.getVoices() || [];
    }
  }

  /**
   * Web Speech API TTS Audio Narration Engine with Voice & Language Matching
   */
  function speakText(text) {
    if (!synth || isMuted) return;

    synth.cancel(); // Stop ongoing speech

    if (!text || text.trim() === '') return;

    currentUtterance = new SpeechSynthesisUtterance(text);
    currentUtterance.rate = speechRate;
    currentUtterance.pitch = 1.0;

    const voices = (synth.getVoices() && synth.getVoices().length > 0) ? synth.getVoices() : cachedVoices;
    const activeVoiceSetting = activeLesson ? activeLesson.voice : 'female_sweet';
    const activeLangSetting = activeLesson ? activeLesson.language : (document.getElementById('ai-select-language')?.value || 'English');

    const noticeEl = document.getElementById('ai-voice-status-notice');
    if (noticeEl) noticeEl.style.display = 'none';

    let selectedVoice = null;

    if (activeLangSetting === 'Hindi' || activeLangSetting === 'Hinglish') {
      currentUtterance.lang = 'hi-IN';
      if (voices && voices.length > 0) {
        selectedVoice = voices.find(v => v.lang.toLowerCase().startsWith('hi') || v.lang.toLowerCase().includes('hi-in') || v.name.toLowerCase().includes('hindi') || v.name.toLowerCase().includes('swara') || v.name.toLowerCase().includes('hemant') || v.name.toLowerCase().includes('kalpana'));
      }
    } else if (activeLangSetting === 'Marathi') {
      currentUtterance.lang = 'mr-IN';
      if (voices && voices.length > 0) {
        // First priority: dedicated Marathi voice
        selectedVoice = voices.find(v => v.lang.toLowerCase().startsWith('mr') || v.lang.toLowerCase().includes('mr-in') || v.name.toLowerCase().includes('marathi'));
        // Second priority: Hindi Devanagari voice (shares Indic phoneme rules for Devanagari text)
        if (!selectedVoice) {
          selectedVoice = voices.find(v => v.lang.toLowerCase().startsWith('hi') || v.name.toLowerCase().includes('hindi') || v.name.toLowerCase().includes('swara'));
        }
      }
    } else {
      // English
      currentUtterance.lang = 'en-US';
      if (voices && voices.length > 0) {
        if (activeVoiceSetting === 'female_sweet' || activeVoiceSetting === 'female_calm') {
          selectedVoice = voices.find(v => v.lang.toLowerCase().startsWith('en') && (v.name.includes('Zira') || v.name.includes('Samantha') || v.name.includes('Victoria') || v.name.includes('Natural') || v.name.includes('Google US English')));
        } else if (activeVoiceSetting === 'male_friendly') {
          selectedVoice = voices.find(v => v.lang.toLowerCase().startsWith('en') && (v.name.includes('David') || v.name.includes('Male') || v.name.includes('Mark')));
        }
        if (!selectedVoice) {
          selectedVoice = voices.find(v => v.lang.toLowerCase().startsWith('en'));
        }
      }
    }

    if (selectedVoice) {
      currentUtterance.voice = selectedVoice;
    } else if (activeLangSetting !== 'English') {
      // DO NOT force an English voice on Hindi/Marathi text!
      // Setting currentUtterance.lang = 'hi-IN' or 'mr-IN' allows browser TTS engine to pronounce Indic Devanagari text naturally.
      if (noticeEl) {
        noticeEl.style.display = 'block';
        noticeEl.textContent = `ℹ️ Speaking using ${activeLangSetting} (${currentUtterance.lang}) locale pronunciation.`;
      }
    }

    currentUtterance.onstart = () => {
      isSpeaking = true;
      const avatarPulse = document.querySelector('.ai-avatar-pulse');
      if (avatarPulse) avatarPulse.classList.add('active');
    };

    currentUtterance.onend = currentUtterance.onerror = () => {
      isSpeaking = false;
      const avatarPulse = document.querySelector('.ai-avatar-pulse');
      if (avatarPulse) avatarPulse.classList.remove('active');
    };

    synth.speak(currentUtterance);
  }

  function playVoice() {
    if (!activeLesson || !activeLesson.sections) return;
    const sec = activeLesson.sections[currentSectionIndex];
    if (sec) {
      speakText(`${sec.title}. ${sec.content.replace(/<[^>]*>?/gm, '')}`);
    }
  }

  function pauseVoice() {
    if (synth) synth.pause();
  }

  function stopVoice() {
    if (synth) synth.cancel();
    isSpeaking = false;
    const avatarPulse = document.querySelector('.ai-avatar-pulse');
    if (avatarPulse) avatarPulse.classList.remove('active');
  }

  function toggleMute() {
    isMuted = !isMuted;
    const btn = document.getElementById('btn-ai-toggle-voice');
    if (isMuted) {
      stopVoice();
      if (btn) btn.textContent = '🔇 Muted';
    } else {
      if (btn) btn.textContent = '🔊 Voice';
      playVoice();
    }
  }

  function setSpeed(rateVal) {
    speechRate = parseFloat(rateVal) || 1.0;
    if (isSpeaking) playVoice();
  }

  function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  /**
   * Converts markdown-like answer text to formatted HTML for display
   */
  function formatAnswerHtml(text) {
    let html = escapeHtml(text);
    // Bold: **text**
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Inline code: `code`
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Bullet points: lines starting with • or -
    html = html.replace(/^[•\-]\s+(.+)$/gm, '<li>$1</li>');
    // Wrap consecutive <li> in <ul>
    html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');
    // Numbered items: 1. text
    html = html.replace(/^(\d+)\.\s+(.+)$/gm, '<li><strong>$1.</strong> $2</li>');
    // MathJax inline: $formula$
    html = html.replace(/\$\$(.+?)\$\$/g, '\\[$1\\]');
    html = html.replace(/\$(.+?)\$/g, '\\($1\\)');
    // Newlines to <br>
    html = html.replace(/\n/g, '<br>');
    return html;
  }

  /**
   * Dynamic Topic & Language Offline Lesson Generator
   */
  function generateFallbackLesson(subject, topic, level, style, language, voice) {
    const tLower = topic.toLowerCase();

    // 1. Stack Data Structure
    if (tLower.includes('stack')) {
      if (language === 'Hindi') {
        return buildHindiStackLesson(subject, topic, level, style, voice);
      } else if (language === 'Marathi') {
        return buildMarathiStackLesson(subject, topic, level, style, voice);
      } else if (language === 'Hinglish') {
        return buildHinglishStackLesson(subject, topic, level, style, voice);
      }
      return buildEnglishStackLesson(subject, topic, level, style, voice);
    }

    // 2. Normalization (DBMS)
    if (tLower.includes('normaliz') || tLower.includes('2nf') || tLower.includes('3nf')) {
      return buildNormalizationLesson(subject, topic, level, style, language, voice);
    }

    // 3. Fast Transpose (Data Structures)
    if (tLower.includes('transpose')) {
      return buildTransposeLesson(subject, topic, level, style, language, voice);
    }

    // 4. Default Dynamic Generator for any topic & language
    return buildGenericMultiLingualLesson(subject, topic, level, style, language, voice);
  }

  // --- Multi-Lingual Lesson Builders ---

  function buildEnglishStackLesson(subject, topic, level, style, voice) {
    return {
      title: "Stack Data Structure",
      subject: subject,
      level: level,
      style: style,
      language: "English",
      voice: voice,
      introduction: "Welcome to the AI Teacher lesson on Stack Data Structures! Today, we will explore Stacks step-by-step, starting from absolute fundamental memory concepts up to real-world system applications. Let's break down every concept clearly!",
      sections: [
        {
          id: "sec-1",
          title: "1. What is a Stack? (Basics & Term Definitions)",
          content: "Before we examine how a Stack functions in code, let's define our key technical terms first:\n\n• **Data Structure**: A specialized container used to store, organize, and manage data efficiently in RAM.\n• **Linear Data Structure**: A structure where elements are arranged sequentially, one after another.\n• **LIFO (Last-In, First-Out)**: An ordering principle where the item inserted *last* is the very *first* item to be removed.\n• **TOP Pointer**: An index tracking the topmost element currently stored in memory.\n\n**Real-World Analogy**:\nImagine a stack of cafeteria plates at a buffet. When a worker washes a new plate, they place it on top of the stack. When a customer arrives to take a plate, they pick the top plate off first! You cannot pull a plate from the middle without disrupting the stack.\n\n**Why Does This Work?**\nBy restricting access strictly to a single point (the TOP pointer), a Stack eliminates the overhead of shifting other elements in memory when inserting or deleting items.",
          keyConcept: "LIFO Principle: Last-In, First-Out. Access is strictly restricted to the TOP pointer.",
          visualType: "stack",
          visualData: {},
          checkpointQuestion: {
            question: "Which principle governs how a Stack operates?",
            options: ["FIFO (First-In, First-Out)", "LIFO (Last-In, First-Out)", "LILO (Last-In, Last-Out)", "Random Access"],
            correctIndex: 1,
            explanation: "Stack operates strictly on the LIFO (Last-In, First-Out) principle, where the last element inserted is the first to be removed."
          }
        },
        {
          id: "sec-2",
          title: "2. Primary Stack Operations & Code Logic (Push, Pop, Peek)",
          content: "Now let's break down the fundamental operations of a Stack step-by-step:\n\n**1. Push(x) Operation**:\nAdds element `x` to the TOP of the stack.\n• Step 1: Check if top equals MAX - 1 (Prevent Overflow).\n• Step 2: Increment top pointer (`top++`).\n• Step 3: Store element `x` at `stack[top]`.\n\n**2. Pop() Operation**:\nRemoves and returns the element at the TOP.\n• Step 1: Check if top equals -1 (Prevent Underflow).\n• Step 2: Fetch element at `stack[top]`.\n• Step 3: Decrement top pointer (`top--`).\n\n**3. Peek / Top Operation**:\nReturns `stack[top]` without removing it or changing `top`.\n\n**Why are Push and Pop $O(1)$ Time Complexity?**\nIn array implementations, element address is calculated directly via formula:\n$$\\text{Address} = \\text{BaseAddress} + (\\text{top} \\times \\text{ElementSize})$$\nBecause we compute memory offset directly without looping through $n$ elements, Push and Pop complete in constant time $O(1)$.",
          keyConcept: "Time Complexity: Push, Pop, and Peek run in O(1) constant time because address calculation uses direct TOP pointer indexing.",
          visualType: "code",
          visualData: { codeSnippet: `// 1. Push Operation - Step-by-Step\nvoid push(int stack[], int *top, int max_size, int value) {\n    if (*top == max_size - 1) {\n        printf("Stack Overflow Error: Cannot push %d\\n", value);\n        return;\n    }\n    *top = *top + 1; // Increment TOP pointer first\n    stack[*top] = value; // Store value at new TOP\n}\n\n// 2. Pop Operation - Step-by-Step\nint pop(int stack[], int *top) {\n    if (*top == -1) {\n        printf("Stack Underflow Error: Stack is empty\\n");\n        return -1;\n    }\n    int poppedValue = stack[*top]; // Copy top element\n    *top = *top - 1; // Decrement TOP pointer\n    return poppedValue;\n}` },
          checkpointQuestion: {
            question: "Why do Push and Pop operations execute in O(1) constant time complexity?",
            options: ["Because they index directly via the TOP pointer without looping", "Because they sort all elements", "Because they search through the entire array", "Because memory is dynamically allocated on each call"],
            correctIndex: 0,
            explanation: "Push and Pop modify only the TOP index directly, avoiding loops, making time complexity constant O(1)."
          }
        },
        {
          id: "sec-3",
          title: "3. Stack Boundary Conditions: Overflow & Underflow",
          content: "When engineering robust systems, handling edge cases prevents fatal program crashes. Let's analyze boundary conditions step-by-step:\n\n**1. Stack Overflow**:\n• **Definition**: Occurs when attempting to PUSH onto a stack that has reached maximum capacity (`top == MAX - 1`).\n• **Consequence**: Writing beyond memory boundaries causes segmentation faults or buffer overflow security vulnerabilities.\n• **Prevention**: Always verify condition `if (top == MAX - 1)` before incrementing `top`.\n\n**2. Stack Underflow**:\n• **Definition**: Occurs when attempting to POP from an empty stack (`top == -1`).\n• **Consequence**: Accessing invalid negative array indices (`stack[-1]`) returns garbage memory data.\n• **Prevention**: Always verify condition `if (top == -1)` before reading `stack[top]`.\n\n**Step-by-Step Numerical Tracing**:\nSuppose `MAX = 3` (Indices 0, 1, 2).\n1. Initial state: `top = -1` (Empty).\n2. Push(10): `top = 0`, `stack[0] = 10`.\n3. Push(20): `top = 1`, `stack[1] = 20`.\n4. Push(30): `top = 2`, `stack[2] = 30` (Full!).\n5. Push(40): Trigger **Stack Overflow** alert (`top == 2`).",
          keyConcept: "Boundary Checks: Verify top == MAX - 1 (Overflow check) before Push, and top == -1 (Underflow check) before Pop.",
          visualType: "formula",
          visualData: {},
          checkpointQuestion: {
            question: "What state condition triggers Stack Underflow?",
            options: ["When attempting to Pop from a stack where top == -1", "When attempting to Push to a full stack", "When top == MAX - 1", "When memory is reallocated"],
            correctIndex: 0,
            explanation: "Stack Underflow happens when popping from an empty stack where top == -1."
          }
        },
        {
          id: "sec-4",
          title: "4. Real-World Applications & Summary",
          content: "Why are Stacks foundational in computer systems? Here are three major real-world engineering applications explained step-by-step:\n\n1. **Function Call Stack in Operating Systems & Compilers**:\nWhen function `main()` calls function `calculate()`, the OS pushes `main`'s local variables and return address onto the call stack. When `calculate()` finishes, its stack frame is popped, safely returning control to `main()`.\n\n2. **Browser Navigation & Undo History (Ctrl + Z)**:\nEvery webpage you visit is pushed onto a navigation stack. Clicking the 'Back' button pops the current URL and opens the previous webpage.\n\n3. **Expression Evaluation & Syntax Parsing**:\nCompilers use Stacks to convert mathematical expressions (e.g. Infix `A + B` to Postfix `AB+`) and check matching parentheses `(())` in code.\n\n**Key Takeaways Summary**:\n• Stack = LIFO linear structure.\n• All access happens at the `TOP` pointer.\n• Time Complexity = $O(1)$ for Push/Pop/Peek.\n• Space Complexity = $O(N)$ for array allocation.",
          keyConcept: "Applications: Compiler Call Stack, Browser Back button history, Undo/Redo mechanisms, Expression Parsing.",
          visualType: "stack",
          visualData: {},
          checkpointQuestion: {
            question: "Which computer system feature relies directly on a LIFO Stack?",
            options: ["Browser Back Button & Function Call Stack", "Network Packet Router Queue", "Database B-Tree Index", "Disk Scheduling Algorithm"],
            correctIndex: 0,
            explanation: "Browser Back navigation history and Function Call Stacks directly utilize LIFO Stack structures."
          }
        }
      ],
      examples: [
        "Browser History: Visiting Page A -> Page B -> Page C. Clicking 'Back' pops Page C and shows Page B.",
        "Function Call Stack: main() calls sum(), sum() calls square(). square() returns first, then sum(), then main()."
      ],
      importantPoints: [
        "LIFO Principle: Last-In, First-Out access rule.",
        "O(1) Efficiency: Push, Pop, and Peek take constant O(1) time.",
        "Pointer Control: All insertions and deletions occur at the TOP index.",
        "Safety Checks: Overflow occurs when top == MAX - 1; Underflow occurs when top == -1."
      ],
      quiz: [
        { question: "What does LIFO stand for in data structures?", options: ["Last-In, First-Out", "Longest-In, Fast-Out", "Linear-In, Full-Out", "Logarithmic-Input"], correctIndex: 0, explanation: "LIFO stands for Last-In, First-Out." },
        { question: "Where are new elements inserted in a Stack?", options: ["At the bottom", "In the middle", "At the TOP index", "At a random index"], correctIndex: 2, explanation: "Elements are strictly pushed at the TOP index." },
        { question: "What condition causes Stack Overflow in array implementation?", options: ["Pushing when top == -1", "Pushing when top == MAX - 1", "Popping from an empty stack", "Reading top element"], correctIndex: 1, explanation: "Pushing when top == MAX - 1 causes Stack Overflow." },
        { question: "What is the time complexity of Pop()?", options: ["O(1)", "O(N)", "O(log N)", "O(N²)"], correctIndex: 0, explanation: "Pop runs in constant O(1) time complexity." },
        { question: "Which feature uses a Stack?", options: ["Undo (Ctrl + Z)", "Printer Print Spooler Queue", "Round Robin CPU Scheduler", "Binary Search"], correctIndex: 0, explanation: "Undo mechanisms use LIFO Stacks to reverse recent actions." }
      ],
      summary: "A Stack is a fundamental LIFO linear data structure where all operations (Push, Pop, Peek) take place at the TOP index in O(1) constant time."
    };
  }

  function buildHindiStackLesson(subject, topic, level, style, voice) {
    return {
      title: "Stack Data Structure (हिंदी)",
      subject: subject,
      level: level,
      style: style,
      language: "Hindi",
      voice: voice,
      introduction: "AI टीचर क्लास में आपका स्वागत है! आज हम Stack को शुरुआत से, बुनियादी नियमों के साथ स्टेप-बाय-स्टेप (Step-by-Step) समझेंगे। चिंता न करें, हर अवधारणा को आसान उदाहरणों के साथ कवर किया गया है!",
      sections: [
        {
          id: "sec-1",
          title: "1. Stack क्या है? (बुनियादी नियम एवं LIFO सिद्धांत)",
          content: "कोड शुरू करने से पहले मुख्य तकनीकी शब्दों को समझते हैं:\n\n• **डेटा स्ट्रक्चर (Data Structure)**: कंप्यूटर मेमोरी में डेटा को व्यवस्थित रूप से स्टोर और प्रबंधित करने का तरीका।\n• **लिनियर डेटा स्ट्रक्चर (Linear Data Structure)**: जहाँ सभी तत्व एक के बाद एक लाइन में व्यवस्थित होते हैं।\n• **LIFO (Last-In, First-Out)**: वह नियम जिसके तहत सबसे अंत में जोड़ा गया तत्व सबसे पहले निकाला जाता है।\n• **TOP पॉइंटर**: वह इंडेक्स जो मेमोरी में सबसे ऊपरी तत्व का ट्रैक रखता है।\n\n**वास्तविक जीवन का उदाहरण**:\nशादी या होटल में रखी प्लेटों की थप्पी (Stack)! नई प्लेट हमेशा सबसे ऊपर रखी जाती है, और खाना खाने वाला सबसे ऊपर वाली प्लेट ही पहले उठाता है। आप बीच से प्लेट नहीं खींच सकते!\n\n**यह क्यों और कैसे काम करता है?**\nकेवल एक बिंदु (TOP पॉइंटर) से डेटा एक्सेस करने के कारण, Stack में डेटा जोड़ने या हटाने पर बाकी तत्वों को शिफ्ट नहीं करना पड़ता, जिससे सिस्टम तेज़ रहता है।",
          keyConcept: "LIFO नियम: Last-In, First-Out। सभी ऑपरेशन्स केवल TOP पॉइंटर पर होते हैं।",
          visualType: "stack",
          visualData: {},
          checkpointQuestion: {
            question: "Stack किस मुख्य सिद्धांत (Principle) पर कार्य करता है?",
            options: ["FIFO (First-In, First-Out)", "LIFO (Last-In, First-Out)", "LILO (Last-In, Last-Out)", "रैंडम एक्सेस"],
            correctIndex: 1,
            explanation: "Stack strictly LIFO (Last-In, First-Out) नियम पर कार्य करता है। सबसे अंत में जोड़ा गया तत्व सबसे पहले निकाला जाता है।"
          }
        },
        {
          id: "sec-2",
          title: "2. मुख्य ऑपरेशन्स: Push, Pop और Peek",
          content: "अब Stack के मुख्य ऑपरेशन्स Step-by-Step देखते हैं:\n\n**1. Push(x) ऑपरेशन (तत्व जोड़ना)**:\n• चरण 1: जाँचें कि Stack भरा हुआ तो नहीं (`top == MAX - 1`).\n• चरण 2: TOP पॉइंटर 1 से बढ़ाएँ (`top++`).\n• चरण 3: `stack[top] = x` पर मान स्टोर करें.\n\n**2. Pop() ऑपरेशन (तत्व निकालना)**:\n• चरण 1: जाँचें कि Stack खाली तो नहीं (`top == -1`).\n• चरण 2: `stack[top]` से मान प्राप्त करें.\n• चरण 3: TOP पॉइंटर 1 से घटाएँ (`top--`).\n\n**Push और Pop $O(1)$ टाइम कॉम्प्लेक्सिटी में क्यों चलते हैं?**\nक्योंकि मेमोरी एड्रेस सीधे सूत्र से निकाला जाता है:\n$$\\text{Address} = \\text{BaseAddress} + (\\text{top} \\times \\text{ElementSize})$$\nकोई लूप नहीं चलाना पड़ता, इसलिए समय हमेशा $O(1)$ रहता है।",
          keyConcept: "टाइम कॉम्प्लेक्सिटी: Push और Pop O(1) Constant Time में पूर्ण होते हैं।",
          visualType: "code",
          visualData: { codeSnippet: `// Push operation step-by-step\nvoid push(int x) {\n    if (top == MAX - 1) return; // Overflow check\n    top++;\n    stack[top] = x;\n}\n// Pop operation step-by-step\nint pop() {\n    if (top == -1) return -1; // Underflow check\n    int val = stack[top];\n    top--;\n    return val;\n}` },
          checkpointQuestion: {
            question: "Push और Pop ऑपरेशन्स की Time Complexity कितनी होती है?",
            options: ["O(1)", "O(N)", "O(log N)", "O(N²)"],
            correctIndex: 0,
            explanation: "Push और Pop सीधे TOP इंडेक्स पर काम करते हैं, इसलिए समय O(1) होता है।"
          }
        },
        {
          id: "sec-3",
          title: "3. सीमांत स्थितियाँ: Stack Overflow और Underflow",
          content: "इंजीनियरिंग में त्रुटियाँ रोकने के लिए सीमांत स्थितियों (Boundary Conditions) को समझना ज़रूरी है:\n\n**1. Stack Overflow**:\n• **परिभाषा**: जब Stack पूरी तरह भर जाता है (`top == MAX - 1`) और नया तत्व Push करने का प्रयास किया जाता है।\n\n**2. Stack Underflow**:\n• **परिभाषा**: जब Stack खाली होता है (`top == -1`) और Pop करने का प्रयास किया जाता है।\n\n**संख्यात्मक उदाहरण (Step-by-Step)**:\nमान लें `MAX = 3` (इंडेक्स 0, 1, 2):\n1. प्रारंभ: `top = -1` (खाली).\n2. Push(10): `top = 0`\n3. Push(20): `top = 1`\n4. Push(30): `top = 2` (फुल!)\n5. Push(40): **Stack Overflow** एरर!",
          keyConcept: "सीमा जाँच: Push से पहले Overflow और Pop से पहले Underflow जाँचना अनिवार्य है।",
          visualType: "formula",
          visualData: {},
          checkpointQuestion: {
            question: "खाली Stack से तत्व निकालने पर क्या होता है?",
            options: ["Stack Underflow", "Stack Overflow", "सफलता", "Memory Leak"],
            correctIndex: 0,
            explanation: "खाली Stack (top == -1) से Pop करने पर Stack Underflow होता है।"
          }
        },
        {
          id: "sec-4",
          title: "4. वास्तविक उपयोग और सारांश",
          content: "कंप्यूटर सिस्टम में Stack कहाँ-कहाँ उपयोग होता है?\n1. **फंक्शन कॉल स्टैक**: प्रोग्राम में फंक्शन कॉल्स ट्रैक करने के लिए।\n2. **ब्राउज़र बैक बटन और Undo (Ctrl + Z)**: हाल की क्रियाएँ वापस लेने के लिए।\n3. **कंपाइलर**: गणितीय सूत्रों और कोष्ठकों की जाँच के लिए।\n\n**महत्वपूर्ण बिंदु**:\n• Stack = LIFO नियम.\n• सभी ऑपरेशन्स TOP पर होते हैं.\n• O(1) टाइम कॉम्प्लेक्सिटी।",
          keyConcept: "उपयोग: कॉल स्टैक, ब्राउज़र बैक बटन, Undo इतिहास।",
          visualType: "stack",
          visualData: {},
          checkpointQuestion: {
            question: "Undo क्रिया कौन सा डेटा स्ट्रक्चर उपयोग करती है?",
            options: ["Stack", "Queue", "Array", "Graph"],
            correctIndex: 0,
            explanation: "Undo क्रिया LIFO Stack का उपयोग करती है।"
          }
        }
      ],
      examples: [
        "ब्राउज़र बैक बटन: सबसे अंत में देखा गया पेज पहले खुलता है।",
        "कॉल स्टैक: फंक्शन का काम पूरा होने पर सही जगह वापस आता है।"
      ],
      importantPoints: [
        "LIFO नियम: Last-In, First-Out।",
        "O(1) समय: Push/Pop अत्यंत तेज़ चलते हैं।",
        "TOP पॉइंटर: सभी ऑपरेशन्स केवल TOP पर होते हैं।"
      ],
      quiz: [
        { question: "LIFO का अर्थ क्या है?", options: ["Last-In, First-Out", "Linear In Fast Out", "Long Input", "Logical Out"], correctIndex: 0, explanation: "LIFO का अर्थ है Last-In, First-Out।" },
        { question: "Stack में तत्व कहाँ जोड़े जाते हैं?", options: ["Bottom", "Middle", "TOP", "कहीं भी"], correctIndex: 2, explanation: "तत्व केवल TOP पर जोड़े जाते हैं।" },
        { question: "भरे Stack पर Push करने पर क्या होता है?", options: ["Underflow", "Stack Overflow", "Success", "Clear"], correctIndex: 1, explanation: "भरे Stack पर Push करने से Stack Overflow होता है।" },
        { question: "Pop() ऑपरेशन का समय कितना होता है?", options: ["O(1)", "O(N)", "O(log N)", "O(N²)"], correctIndex: 0, explanation: "Pop O(1) समय में चलता है।" },
        { question: "निम्न में से कौन Stack का उपयोग करता है?", options: ["Undo ऑप्शन", "प्रिंटर कतार", "नेटवर्क", "सॉर्टिंग"], correctIndex: 0, explanation: "Undo ऑप्शन LIFO Stack का उपयोग करता है।" }
      ],
      summary: "Stack एक लिनियर LIFO डेटा स्ट्रक्चर है जहाँ Push, Pop और Peek केवल TOP पॉइंटर पर O(1) समय में निष्पादित होते हैं।"
    };
  }

  function buildMarathiStackLesson(subject, topic, level, style, voice) {
    return {
      title: "Stack Data Structure (मराठी)",
      subject: subject,
      level: level,
      style: style,
      language: "Marathi",
      voice: voice,
      introduction: "AI टीचर क्लासमध्ये तुमचे स्वागत आहे! आज आपण Stack ही संकल्पना अगदी सुरुवातीपासून, मूलभूत नियमांसह स्टेप-बाय-स्टेप (Step-by-Step) समजून घेणार आहोत. प्रत्येक संकल्पना सोप्या मराठीत आणि उदाहरणांसह स्पष्ट केली आहे!",
      sections: [
        {
          id: "sec-1",
          title: "1. Stack म्हणजे काय? (मूलभूत व्याख्या आणि LIFO नियम)",
          content: "कोड सुरू करण्यापूर्वी महत्त्वाच्या संज्ञा समजून घेऊया:\n\n• **डेटा स्ट्रक्चर (Data Structure)**: मेमरीमध्ये डेटा व्यवस्थित साठवणूक आणि व्यवस्थापन करण्याची पद्धत.\n• **लिनियर डेटा स्ट्रक्चर (Linear Data Structure)**: जिथे सर्व घटक एकामागून एक रेषीय क्रमाने मांडले जातात.\n• **LIFO (Last-In, First-Out)**: ज्या नियमानुसार सर्वात शेवटी टाकलेला घटक सर्वात आधी बाहेर काढला जातो.\n• **TOP point (पॉइंटर)**: मेमरीमधील सर्वात वरच्या घटकाचा मागोवा ठेवणारा इंडेक्स.\n\n**वास्तविक जगातील उदाहरण**:\nजेवणाच्या ताटांची रचलेली चळ! नवीन ताट नेहमी सर्वात वर ठेवले जाते, आणि ताट घेणारा सर्वात वरचे ताट आधी उचलतो. मधून ताट काढता येत नाही!\n\n**हे कसे आणि का कार्य करते?**\nकेवळ एकाच बिंदूवरून (TOP पॉइंटर) प्रवेश दिल्याने, डेटा जोडताना किंवा काढताना इतर घटकांना हलवावे लागत नाही, ज्यामुळे वेळ वाचतो.",
          keyConcept: "LIFO नियम: Last-In, First-Out. सर्व ऑपरेशन्स केवळ TOP पॉइंटरवर होतात.",
          visualType: "stack",
          visualData: {},
          checkpointQuestion: {
            question: "Stack कोणत्या मूलभूत नियमावर कार्य करतो?",
            options: ["FIFO (First-In, First-Out)", "LIFO (Last-In, First-Out)", "LILO (Last-In, Last-Out)", "Random Access"],
            correctIndex: 1,
            explanation: "Stack हा LIFO (Last-In, First-Out) नियमावर कार्य करतो."
          }
        },
        {
          id: "sec-2",
          title: "2. मुख्य क्रिया आणि लॉजिक: Push, Pop आणि Peek",
          content: "आता आपण Stack च्या मुख्य क्रिया स्टेप-बाय-स्टेप पाहूया:\n\n**1. Push(x) क्रिया (घटक जोडणे)**:\n• पायरी 1: Stack भरला आहे का तपासा (`top == MAX - 1`).\n• पायरी 2: TOP पॉइंटर 1 ने वाढवा (`top++`).\n• पायरी 3: `stack[top]` वर मूल्य साठवा.\n\n**2. Pop() क्रिया (घटक काढणे)**:\n• पायरी 1: Stack रिकामा आहे का तपासा (`top == -1`).\n• पायरी 2: `stack[top]` मधील मूल्य घ्या.\n• पायरी 3: TOP पॉइंटर 1 ने कमी करा (`top--`).\n\n**Push आणि Pop O(1) वेळेत का होतात?**\nकारण मेमरी पत्ता थेट सूत्राने काढला जातो:\n$$\\text{Address} = \\text{BaseAddress} + (\\text{top} \\times \\text{ElementSize})$$\nकोणताही लूप फिरवावा लागत नसल्याने वेळ नेहमी $O(1)$ राहतो.",
          keyConcept: "वेळ जटिलता: Push आणि Pop O(1) Constant Time मध्ये पूर्ण होतात.",
          visualType: "code",
          visualData: { codeSnippet: `// Push operation step-by-step\nvoid push(int x) {\n    if (top == MAX - 1) return;\n    top++;\n    stack[top] = x;\n}\n// Pop operation step-by-step\nint pop() {\n    if (top == -1) return -1;\n    int val = stack[top];\n    top--;\n    return val;\n}` },
          checkpointQuestion: {
            question: "Push आणि Pop क्रियांचा वेळ (Time Complexity) किती असतो?",
            options: ["O(1)", "O(N)", "O(log N)", "O(N²)"],
            correctIndex: 0,
            explanation: "Push आणि Pop थेट TOP इंडेक्सवर काम करत असल्याने वेळ O(1) असतो."
          }
        },
        {
          id: "sec-3",
          title: "3. सीमांत परिस्थिती: Stack Overflow आणि Underflow",
          content: "इंजिनिअरिंगमध्ये त्रुटी टाळण्यासाठी सीमांत परिस्थिती (Boundary Conditions) समजणे आवश्यक आहे:\n\n**1. Stack Overflow**:\n• **व्याख्या**: जेव्हा Stack पूर्ण भरलेला असतो (`top == MAX - 1`) आणि तुम्ही नवीन घटक Push करण्याचा प्रयत्न करता.\n\n**2. Stack Underflow**:\n• **व्याख्या**: जेव्हा Stack रिकामा असतो (`top == -1`) आणि तुम्ही Pop करण्याचा प्रयत्न करता.\n\n**संख्यात्मक उदाहरण (Numerical Step-by-Step)**:\nजर `MAX = 3` (इंडेक्स 0, 1, 2):\n1. सुरुवात: `top = -1` (रिकामा).\n2. Push(10): `top = 0`\n3. Push(20): `top = 1`\n4. Push(30): `top = 2` (फुल!)\n5. Push(40): **Stack Overflow** एरर!",
          keyConcept: "सीमा तपासणी: Push पूर्वी Overflow आणि Pop पूर्वी Underflow तपासणे अनिवार्य आहे.",
          visualType: "formula",
          visualData: {},
          checkpointQuestion: {
            question: "रिकाम्या Stack मधून घटक काढल्यास काय होते?",
            options: ["Stack Underflow", "Stack Overflow", "यशस्वी", "मेमरी लीक"],
            correctIndex: 0,
            explanation: "रिकाम्या Stack मधून (top == -1) घटक काढल्यास Stack Underflow होतो."
          }
        },
        {
          id: "sec-4",
          title: "4. वास्तववादी उपयोग आणि सारांश",
          content: "संगणकात Stack कोठे वापरला जातो?\n1. **फंक्शन कॉल स्टॅक**: प्रोग्राम मधील फंक्शन कॉल्स ट्रॅक करणे.\n2. **ब्राऊझर बॅक बटण आणि Undo (Ctrl + Z)**: अलीकडील क्रिया रद्द करणे.\n3. **कंपायलर गणिती सूत्रे हल करणे**.\n\n**महत्त्वाचे मुद्दे**:\n• Stack = LIFO नियम.\n• सर्व क्रिया TOP वर होतात.\n• O(1) वेळ जटिलता.",
          keyConcept: "उपयोग: कॉल स्टॅक, ब्राऊझर बॅक बटण, Undo इतिहास.",
          visualType: "stack",
          visualData: {},
          checkpointQuestion: {
            question: "Undo क्रिया कोणता डेटा स्ट्रक्चर वापरते?",
            options: ["Stack", "Queue", "Array", "Graph"],
            correctIndex: 0,
            explanation: "Undo क्रिया LIFO Stack चा वापर करते."
          }
        }
      ],
      examples: [
        "ब्राऊझर बॅक बटण: सर्वात शेवटी भेट दिलेले पेज आधी उघडते.",
        "कॉल स्टॅक: फंक्शनचे काम संपल्यावर योग्य ठिकाणी परत येते."
      ],
      importantPoints: [
        "LIFO नियम: Last-In, First-Out.",
        "O(1) वेळ: Push/Pop अत्यंत वेगात चालतात.",
        "TOP पॉइंटर: सर्व क्रिया केवळ TOP वर होतात."
      ],
      quiz: [
        { question: "LIFO चा अर्थ काय आहे?", options: ["Last-In, First-Out", "Linear In Fast Out", "Long Input", "Logical Out"], correctIndex: 0, explanation: "LIFO म्हणजे Last-In, First-Out." },
        { question: "Stack मध्ये घटक कोठे जोडले जातात?", options: ["Bottom", "Middle", "TOP", "कुठेही"], correctIndex: 2, explanation: "घटक केवळ TOP वर जोडले जातात." },
        { question: "भरलेल्या Stack वर Push केल्यास काय होते?", options: ["Underflow", "Stack Overflow", "Success", "Clear"], correctIndex: 1, explanation: "भरलेल्या Stack वर Push केल्यास Stack Overflow होतो." },
        { question: "Pop() क्रियेचा वेळ किती असतो?", options: ["O(1)", "O(N)", "O(log N)", "O(N²)"], correctIndex: 0, explanation: "Pop O(1) वेळेत चालतो." },
        { question: "खालीलपैकी काय Stack चा वापर करते?", options: ["Undo पर्याय", "प्रिंटर रांग", "नेटवर्क", "सॉर्टिंग"], correctIndex: 0, explanation: "Undo पर्याय Stack वापरतो." }
      ],
      summary: "Stack हा LIFO डेटा स्ट्रक्चर आहे जिथे Push आणि Pop केवळ TOP वर O(1) वेळेत होतात."
    };
  }

  function buildHinglishStackLesson(subject, topic, level, style, voice) {
    return {
      title: "Stack Data Structure (Hinglish)",
      subject: subject,
      level: level,
      style: style,
      language: "Hinglish",
      voice: voice,
      introduction: "AI Teacher session mein welcome! Aaj hum Stack Data Structure ko bilkul starting se step-by-step aur easy conversational style mein samjhenge. Tension mat lo, saare concepts real-world examples ke saath clear honge!",
      sections: [
        {
          id: "sec-1",
          title: "1. What is a Stack? (Basics & LIFO Principle)",
          content: "Code par jane se pehle key technical terms ko define karte hain:\n\n• **Data Structure**: Memory mein data ko store aur organize karne ka tareeka.\n• **Linear Data Structure**: Jahan elements ek ke baad ek sequence mein arranged hote hain.\n• **LIFO (Last-In, First-Out)**: Jo element sabse *last* mein push hua, wohi sabse *first* pop hoga.\n• **TOP Pointer**: Pointer index jo top element ka path track karta hai.\n\n**Real-World Example**:\nWedding buffet mein plates ki stack! New plate top par rakhi jati hai, aur koi plate uthata hai toh top wali pehle milti hai. Aap middle se plate nahi nikal sakte!\n\n**Why it works?**\nSirf TOP pointer se access allow karne se memory mein baaki elements ko shift nahi karna padta, jisse operations fast rahte hain.",
          keyConcept: "LIFO Rule: Last-In, First-Out. Saare operations strictly TOP pointer par hote hain.",
          visualType: "stack",
          visualData: {},
          checkpointQuestion: {
            question: "Stack kis core principle par kaam karta hai?",
            options: ["FIFO (First-In, First-Out)", "LIFO (Last-In, First-Out)", "LILO (Last-In, Last-Out)", "Random Access"],
            correctIndex: 1,
            explanation: "Stack strictly LIFO (Last-In, First-Out) principle par kaam karta hai."
          }
        },
        {
          id: "sec-2",
          title: "2. Main Operations & Logic: Push, Pop & Peek",
          content: "Aao ab Stack ke primary operations step-by-step dekhte hain:\n\n**1. Push(x) Operation (Add element)**:\n• Step 1: Check karo kahi stack full toh nahi (`top == MAX - 1`).\n• Step 2: Top pointer increment karo (`top++`).\n• Step 3: `stack[top] = x` store karo.\n\n**2. Pop() Operation (Remove element)**:\n• Step 1: Check karo stack empty toh nahi (`top == -1`).\n• Step 2: `stack[top]` se value retrieve karo.\n• Step 3: Top pointer decrement karo (`top--`).\n\n**Push & Pop $O(1)$ Time Complexity kyun hote hain?**\nDirect address calculation formula:\n$$\\text{Address} = \\text{BaseAddress} + (\\text{top} \\times \\text{ElementSize})$$\nLoop chalaye bina direct memory access hone se time complexity constant $O(1)$ rehti hai.",
          keyConcept: "Time Complexity: Push & Pop execute in O(1) constant time because of direct TOP pointer indexing.",
          visualType: "code",
          visualData: { codeSnippet: `// Step-by-step Push logic\nvoid push(int val) {\n    if (top == MAX - 1) {\n        printf("Stack Overflow!\\n");\n        return;\n    }\n    top = top + 1;\n    stack[top] = val;\n}\n\n// Step-by-step Pop logic\nint pop() {\n    if (top == -1) {\n        printf("Stack Underflow!\\n");\n        return -1;\n    }\n    int val = stack[top];\n    top = top - 1;\n    return val;\n}` },
          checkpointQuestion: {
            question: "Push aur Pop operations ki Time Complexity kya hai?",
            options: ["O(1)", "O(N)", "O(log N)", "O(N²)"],
            correctIndex: 0,
            explanation: "Push aur Pop directly TOP pointer index use karte hain, isliye time O(1) hota hai."
          }
        },
        {
          id: "sec-3",
          title: "3. Boundary Scenarios: Overflow & Underflow",
          content: "System crash se bachne ke liye edge cases handle karna zaroori hai:\n\n**1. Stack Overflow**:\n• **Definition**: Jab full stack par (`top == MAX - 1`) naya item Push karne ki try karein.\n\n**2. Stack Underflow**:\n• **Definition**: Jab empty stack se (`top == -1`) item Pop karne ki try karein.\n\n**Numerical Tracing Example**:\nLet `MAX = 3` (Indices 0, 1, 2):\n1. Initial: `top = -1` (Empty)\n2. Push(10): `top = 0`\n3. Push(20): `top = 1`\n4. Push(30): `top = 2` (Full!)\n5. Push(40): **Stack Overflow** Error!",
          keyConcept: "Safety Checks: Verify top == MAX - 1 before Push (Overflow) and top == -1 before Pop (Underflow).",
          visualType: "formula",
          visualData: {},
          checkpointQuestion: {
            question: "Empty stack se item pop karne par konsi situation hoti hai?",
            options: ["Stack Underflow", "Stack Overflow", "Success", "Memory Leak"],
            correctIndex: 0,
            explanation: "Empty stack (top == -1) se pop karne par Stack Underflow condition hoti hai."
          }
        },
        {
          id: "sec-4",
          title: "4. Real-World Applications & Summary",
          content: "Stacks real-world systems mein kahan use hote hain?\n1. **Function Call Stack**: Compilers function frames track karte hain.\n2. **Browser Back Button & Undo (Ctrl + Z)**: Recent actions reverse karte hain.\n3. **Expression Parsing**: Parentheses check aur math evaluation.\n\n**Summary Points**:\n• Stack = LIFO Rule.\n• All access at TOP pointer.\n• O(1) Time Complexity.",
          keyConcept: "Applications: Browser Back history, Undo Ctrl+Z, Call Stack, Expression Parsing.",
          visualType: "stack",
          visualData: {},
          checkpointQuestion: {
            question: "Ctrl+Z Undo feature kaunsa data structure use karta hai?",
            options: ["Stack", "Queue", "Array", "Graph"],
            correctIndex: 0,
            explanation: "Undo feature LIFO Stack use karta hai."
          }
        }
      ],
      examples: [
        "Browser Back Button: Sabse recently visit kiya gaya page pehle back hota hai.",
        "Call Stack: Function calls memory mein stack frame push karte hain."
      ],
      importantPoints: [
        "LIFO Principle: Last-In, First-Out.",
        "O(1) Efficiency: Constant time operations.",
        "TOP Pointer: All operations at TOP index."
      ],
      quiz: [
        { question: "LIFO ka full form kya hai?", options: ["Last-In, First-Out", "Linear In Fast Out", "Long Input", "Logical Out"], correctIndex: 0, explanation: "LIFO stands for Last-In, First-Out." },
        { question: "Stack mein new elements kahan add hote hain?", options: ["Bottom", "Middle", "TOP", "Kahi bhi"], correctIndex: 2, explanation: "New elements hamesha TOP par push hote hain." },
        { question: "Full stack mein element push karne par kya hota hai?", options: ["Underflow", "Stack Overflow", "Success", "Null"], correctIndex: 1, explanation: "Full stack par Push karne se Stack Overflow hota hai." },
        { question: "Pop() operation ka time complexity kya hai?", options: ["O(1)", "O(N)", "O(log N)", "O(N²)"], correctIndex: 0, explanation: "Pop() constant O(1) time mein chalta hai." },
        { question: "Inme se konsa feature Stack use karta hai?", options: ["Undo Ctrl+Z", "Printer Queue", "Router Table", "Sort"], correctIndex: 0, explanation: "Undo Ctrl+Z LIFO Stack use karta hai." }
      ],
      summary: "Stack ek LIFO data structure hai jisme Push aur Pop TOP pointer par O(1) time mein execute hote hain."
    };
  }

  function buildNormalizationLesson(subject, topic, level, style, language, voice) {
    if (language === 'Marathi') {
      return {
        title: "DBMS डेटाबेस नॉर्मलायझेशन (मराठी)",
        subject: subject,
        level: level,
        style: style,
        language: "Marathi",
        voice: voice,
        introduction: "DBMS डेटाबेस नॉर्मलायझेशनच्या या AI क्लासमध्ये तुमचे स्वागत आहे! आज आपण डेटाबेसचे 1NF ते BCNF पर्यंतचे नियम पायरी-बाय-पायरी समजून घेणार आहोत.",
        sections: [
          {
            id: "sec-1",
            title: "1. नॉर्मलायझेशन का आवश्यक आहे? (मूलभूत संज्ञा)",
            content: "प्रथम महत्त्वाच्या डेटाबेस संज्ञा स्पष्ट करूया:\n\n• **Redundancy (पुनरावर्तन)**: डेटाबेसमध्ये डेटाची अनावश्यक डुप्लिकेशन.\n• **Insertion Anomaly**: नवीन डेटा जोडताना इतर माहिती नसल्यामुळे डेटा जोडता न येणे.\n• **Update Anomaly**: एका ठिकाणी अपडेट केल्यावर इतर ठिकाणी माहिती जुनीच राहणे.\n• **Deletion Anomaly**: एक ओळ डिलीट केल्यावर महत्त्वाची दुसरी माहिती नष्ट होणे.\n\n**उदाहरणासह समजून घ्या**:\nजर ग्राहकाचा पत्ता 50 ठिकाणी साठवला असेल आणि त्यांनी पत्ता बदलला, तर 50 ठिकाणी अपडेट करावे लागेल! डेटाबेस नॉर्मलायझेशन मोठ्या तक्त्यांना लहान रिलेशनल तक्त्यांमध्ये विभाजित करते.",
            keyConcept: "उद्दिष्ट: डेटाचे पुनरावर्तन (Redundancy) दूर करणे आणि विसंगती (Anomalies) रोखणे.",
            visualType: "code",
            visualData: { codeSnippet: `// Normalization Pipeline Overview\n1NF: सेलमधील एटॉमिक मूल्य\n2NF: 1NF + आंशिक अवलंबित्व (Partial Dependency) नाही\n3NF: 2NF + सकर्मक अवलंबित्व (Transitive Dependency) नाही\nBCNF: डावी बाजू सुपर की असावी` },
            checkpointQuestion: {
              question: "डेटाबेस नॉर्मलायझेशनचे मुख्य उद्दिष्ट काय आहे?",
              options: ["डेटाचे पुनरावर्तन दूर करणे आणि विसंगती रोखणे", "स्टोरेज वाढवणे", "क्वेरी धीमी करणे", "किज काढून टाकणे"],
              correctIndex: 0,
              explanation: "नॉर्मलायझेशन डुप्लिकेट डेटा काढून टाकते आणि विसंगतींपासून वाचवते."
            }
          },
          {
            id: "sec-2",
            title: "2. प्रथम आणि द्वितीय सामान्य रूप (1NF & 2NF)",
            content: "- **1NF (प्रथम सामान्य रूप)**: प्रत्येक सेलमध्ये फक्त एकच (Atomic) मूल्य असावे. एका कॉलममध्ये अनेक मूल्ये असू शकत नाहीत!\n- **2NF (द्वितीय सामान्य रूप)**: तक्ता 1NF मध्ये असावा आणि प्रत्येक नॉन-की कॉलम संपूर्ण प्रायमरी की वर अवलंबून असावा (कोणतीही आंशिक अवलंबित्व / Partial Dependency नाही).",
            keyConcept: "1NF = सेलमधील एटॉमिक मूल्य; 2NF = आंशिक अवलंबित्व (Partial Dependency) समाप्त.",
            visualType: "formula",
            visualData: {},
            checkpointQuestion: {
              question: "2NF कोणत्या अवलंबित्वाला (Dependency) काढून टाकतो?",
              options: ["आंशिक अवलंबित्व (Partial Dependency)", "सकर्मक अवलंबित्व", "सायक्लिक अवलंबित्व", "Null"],
              correctIndex: 0,
              explanation: "2NF आंशिक अवलंबित्व समाप्त करतो."
            }
          },
          {
            id: "sec-3",
            title: "3. तृतीय सामान्य रूप (3NF) आणि सकर्मक अवलंबित्व",
            content: "3NF तक्त्याला 2NF मध्ये असणे आवश्यक बनवतो आणि सर्व सकर्मक (Transitive) अवलंबित्व (Non-key -> Non-key) काढून टाकतो.",
            keyConcept: "3NF सकर्मक (Transitive) अवलंबित्व समाप्त करतो.",
            visualType: "formula",
            visualData: {},
            checkpointQuestion: {
              question: "3NF कोणते अवलंबित्व काढून टाकतो?",
              options: ["सकर्मक अवलंबित्व (Transitive Dependency)", "आंशिक अवलंबित्व", "एटॉमिक अवलंबित्व", "प्रायमरी की"],
              correctIndex: 0,
              explanation: "3NF सकर्मक कार्यात्मक अवलंबित्व काढून टाकतो."
            }
          },
          {
            id: "sec-4",
            title: "4. BCNF आणि सारांश",
            content: "बॉइस-कोड्ड नॉर्मल फॉर्म (BCNF) 3NF ची एक सख्त आवृत्ती आहे जिथे प्रत्येक कार्यात्मक अवलंबित्व $X \\rightarrow Y$ मध्ये, $X$ चे सुपर की (Super Key) असणे अनिवार्य आहे.",
            keyConcept: "BCNF: प्रत्येक X -> Y अवलंबित्वासाठी X सुपर की असणे आवश्यक आहे.",
            visualType: "formula",
            visualData: {},
            checkpointQuestion: {
              question: "BCNF मध्ये, X -> Y साठी X चे काय असणे अनिवार्य आहे?",
              options: ["सुपर की (Super Key)", "फॉरेन की", "Null कॉलम", "कंपोझिट की"],
              correctIndex: 0,
              explanation: "BCNF मध्ये X चे सुपर की असणे आवश्यक आहे."
            }
          }
        ],
        examples: [
          "ई-कॉमर्स डेटाबेस: ऑर्डर, ग्राहक आणि उत्पादन तक्ते वेगळे करणे जेणेकरून डुप्लिकेट पत्ते होणार नाहीत.",
          "बँकिंग सिस्टीम: खाते आणि व्यवहार इतिहास नॉर्मलाइझ करणे."
        ],
        importantPoints: [
          "1NF: फक्त एटॉमिक मूल्ये.",
          "2NF: आंशिक अवलंबित्व नाही.",
          "3NF: सकर्मक अवलंबित्व नाही.",
          "BCNF: डावी बाजू सुपर की असली पाहिजे."
        ],
        quiz: [
          { question: "डेटाबेस नॉर्मलायझेशन काय आहे?", options: ["डेटाचे डुप्लिकेशन कमी करण्याची प्रक्रिया", "टेबल डिलीट करणे", "पासवर्ड एन्क्रिप्ट करणे", "फॉर्मेटिंग"], correctIndex: 0, explanation: "नॉर्मलायझेशन पुनरावर्तन कमी करते." },
          { question: "कोणत्या नॉर्मल फॉर्ममध्ये एटॉमिक व्हॅल्यूची गरज असते?", options: ["1NF", "2NF", "3NF", "BCNF"], correctIndex: 0, explanation: "1NF मध्ये एटॉमिक व्हॅल्यू आवश्यक आहे." },
          { question: "2NF मध्ये कोणते अवलंबित्व काढून टाकले जाते?", options: ["आंशिक अवलंबित्व (Partial Dependency)", "सकर्मक अवलंबित्व", "सायक्लिक अवलंबित्व", "Null"], correctIndex: 0, explanation: "2NF आंशिक अवलंबित्व समाप्त करतो." },
          { question: "3NF मध्ये कोणते अवलंबित्व काढून टाकले जाते?", options: ["सकर्मक अवलंबित्व (Transitive Dependency)", "आंशिक अवलंबित्व", "एटॉमिक अवलंबित्व", "Super Key"], correctIndex: 0, explanation: "3NF सकर्मक अवलंबित्व काढून टाकतो." },
          { question: "BCNF मध्ये X -> Y साठी X काय असावे?", options: ["Super Key", "Null Attribute", "Secondary Key", "Foreign Index"], correctIndex: 0, explanation: "BCNF मध्ये X एक सुपर की असावा." }
        ],
        summary: "डेटाबेस नॉर्मलायझेशन 1NF ते BCNF पर्यंत तक्त्यांची मांडणी करून पुनरावर्तन समाप्त करते."
      };
    }
    if (language === 'Hindi') {
      return {
        title: "DBMS डेटाबेस नॉर्मलाइजेशन (हिंदी)",
        subject: subject,
        level: level,
        style: style,
        language: "Hindi",
        voice: voice,
        introduction: "DBMS डेटाबेस नॉर्मलाइजेशन की इस AI क्लास में आपका स्वागत है! आज हम डेटाबेस के 1NF से BCNF तक के नियमों को चरण-दर-चरण (Step-by-Step) समझेंगे।",
        sections: [
          {
            id: "sec-1",
            title: "1. नॉर्मलाइजेशन क्यों आवश्यक है? (मूलभूत शब्द)",
            content: "पहले मुख्य डेटाबेस शब्दों को स्पष्ट करते हैं:\n\n• **रेडंडेंसी (Redundancy)**: डेटाबेस में डेटा का अनावश्यक डुप्लिकेशन।\n• **इंसर्शन विसंगति (Insertion Anomaly)**: अन्य डेटा न होने के कारण नया डेटा न जोड़ पाना।\n• **अपडेट विसंगति (Update Anomaly)**: एक जगह अपडेट करने पर अन्य जगहों पर डेटा पुराना रहना।\n• **डिलीशन विसंगति (Deletion Anomaly)**: एक रो डिलीट करने पर मुख्य डेटा का नष्ट होना।\n\n**उदाहरण**:\nयदि ग्राहक का पता 50 जगह स्टोर है, तो पता बदलने पर 50 बार अपडेट करना होगा! नॉर्मलाइजेशन बड़ी तालिकाओं को छोटी रिलेशनल तालिकाओं में विभाजित करता है।",
            keyConcept: "लक्ष्य: डेटा रेडंडेंसी को समाप्त करना और विसंगतियों को रोकना।",
            visualType: "code",
            visualData: { codeSnippet: `// 1NF rule: Atomic Values\n// 2NF rule: No Partial Dependency\n// 3NF rule: No Transitive Dependency\n// BCNF rule: Determinant must be Super Key` },
            checkpointQuestion: {
              question: "डेटाबेस नॉर्मलाइजेशन का मुख्य उद्देश्य क्या है?",
              options: ["डेटा रेडंडेंसी (डुप्लिकेशन) को समाप्त करना", "स्टोरेज बढ़ाना", "क्वेरी धीमी करना", "कुंजियाँ हटाना"],
              correctIndex: 0,
              explanation: "नॉर्मलाइजेशन डुप्लिकेट डेटा को हटाता है और विसंगतियों से बचाता है।"
            }
          },
          {
            id: "sec-2",
            title: "2. प्रथम और द्वितीय सामान्य रूप (1NF & 2NF)",
            content: "- **1NF (प्रथम सामान्य रूप)**: प्रत्येक सेल में केवल एकल (Atomic) मान होने चाहिए। एक कॉलम में कई मान नहीं हो सकते!\n- **2NF (द्वितीय सामान्य रूप)**: 1NF में होना चाहिए और प्रत्येक नॉन-की कॉलम पूरी प्राइमरी की पर निर्भर होना चाहिए (कोई आंशिक निर्भरता / Partial Dependency नहीं)।",
            keyConcept: "1NF = सेल में एटॉमिक मान; 2NF = आंशिक निर्भरता (Partial Dependency) समाप्त।",
            visualType: "formula",
            visualData: {},
            checkpointQuestion: {
              question: "1NF क्या लागू करता है?",
              options: ["सेल्स में एटॉमिक (सिंगल) मान", "केवल फॉरेन की", "3 टेबल होना", "कोई प्राइमरी की न होना"],
              correctIndex: 0,
              explanation: "1NF प्रत्येक कॉलम सेल में अभाज्य सिंगल मानों की आवश्यकता पर बल देता है।"
            }
          },
          {
            id: "sec-3",
            title: "3. तृतीयांश सामान्य रूप (3NF) और सकर्मक निर्भरता",
            content: "3NF तालिका को 2NF में होना आवश्यक बनाता है और सभी ट्रांसिटिव डिपेंडेंसी ($A \\rightarrow B \\rightarrow C$) को हटा देता है।",
            keyConcept: "3NF ट्रांसिटिव निर्भरता (Non-key -> Non-key) को समाप्त करता है।",
            visualType: "formula",
            visualData: {},
            checkpointQuestion: {
              question: "3NF किस निर्भरता को समाप्त करता है?",
              options: ["सकर्मक निर्भरता (Transitive Dependency)", "आंशिक निर्भरता (Partial Dependency)", "एटॉमिक निर्भरता", "प्राइमरी की"],
              correctIndex: 0,
              explanation: "3NF ट्रांसिटिव कार्यात्मक निर्भरता को हटाता है।"
            }
          },
          {
            id: "sec-4",
            title: "4. BCNF और सारांश",
            content: "बॉइस-कोड्ड नॉर्मल फॉर्म (BCNF) 3NF का एक सख्त रूप है जहाँ प्रत्येक कार्यात्मक निर्भरता $X \\rightarrow Y$ में, $X$ का सुपर कुंजी (Super Key) होना अनिवार्य है।",
            keyConcept: "BCNF: प्रत्येक X -> Y निर्भरता के लिए X सुपर की होना चाहिए।",
            visualType: "formula",
            visualData: {},
            checkpointQuestion: {
              question: "BCNF में, कार्यात्मक निर्भरता X -> Y के लिए X का क्या होना अनिवार्य है?",
              options: ["सुपर की (Super Key)", "फॉरेन की", "Null कॉलम", "कंपोजिट की"],
              correctIndex: 0,
              explanation: "BCNF में X का सुपर की होना आवश्यक है।"
            }
          }
        ],
        examples: [
          "ई-कॉमर्स डेटाबेस: ऑर्डर, ग्राहक और उत्पाद तालिकाओं को अलग करना ताकि डुप्लिकेट एड्रेस न हों।",
          "बैंकिंग सिस्टम: खाता और लेनदेन इतिहास को नॉर्मलाइज़ करना।"
        ],
        importantPoints: [
          "1NF: केवल एटॉमिक मान।",
          "2NF: कोई आंशिक निर्भरता नहीं।",
          "3NF: कोई सकर्मक निर्भरता नहीं।",
          "BCNF: लेफ्ट-हैंड साइड सुपर की होनी चाहिए।"
        ],
        quiz: [
          { question: "डेटाबेस नॉर्मलाइजेशन क्या है?", options: ["डेटा डुप्लिकेशन कम करने की प्रक्रिया", "टेबल डिलीट करना", "पासवर्ड एन्क्रिप्ट करना", "फॉर्मेटिंग"], correctIndex: 0, explanation: "नॉर्मलाइजेशन रेडंडेंसी को कम करता है।" },
          { question: "किस नॉर्मल फॉर्म में एटॉमिक वैल्यू की आवश्यकता होती है?", options: ["1NF", "2NF", "3NF", "BCNF"], correctIndex: 0, explanation: "1NF में एटॉमिक वैल्यू जरूरी है।" },
          { question: "2NF में किस निर्भरता को हटाया जाता है?", options: ["आंशिक निर्भरता (Partial Dependency)", "सकर्मक निर्भरता", "साइक्लिक निर्भरता", "Null"], correctIndex: 0, explanation: "2NF आंशिक निर्भरता को समाप्त करता है।" },
          { question: "3NF में किस निर्भरता को हटाया जाता है?", options: ["सकर्मक निर्भरता (Transitive Dependency)", "आंशिक निर्भरता", "एटॉमिक निर्भरता", "Super Key"], correctIndex: 0, explanation: "3NF सकर्मक निर्भरता को हटाता है।" },
          { question: "BCNF में X -> Y के लिए X क्या होना चाहिए?", options: ["Super Key", "Null Attribute", "Secondary Key", "Foreign Index"], correctIndex: 0, explanation: "BCNF में X एक सुपर की होना अनिवार्य है।" }
        ],
        summary: "डेटाबेस नॉर्मलाइजेशन 1NF से BCNF तक तालिकाओं को व्यवस्थित करके रेडंडेंसी समाप्त करता है।"
      };
    }

    return {
      title: "DBMS Database Normalization",
      subject: subject,
      level: level,
      style: style,
      language: language,
      voice: voice,
      introduction: `Welcome to Database Normalization! Today we will learn step-by-step how database schemas are structured from 1NF to BCNF to eliminate data redundancy and prevent insertion, update, and deletion anomalies.`,
      sections: [
        {
          id: "sec-1",
          title: "1. Why Normalization is Essential (Basics & Anomalies)",
          content: "Let's define fundamental database terms first:\n\n• **Redundancy**: Unnecessary duplication of data across database rows.\n• **Insertion Anomaly**: Inability to insert data without inserting dummy values for unrelated attributes.\n• **Update Anomaly**: Inconsistencies caused when updating data in one row leaves duplicates out-of-date in other rows.\n• **Deletion Anomaly**: Unintended loss of data when deleting a row containing unrelated attributes.\n\n**Real-World Scenario**:\nImagine storing a customer's address 50 times in every single order record. If the customer moves, you must execute 50 updates! If you miss even one row, your database becomes corrupted with conflicting addresses.\n\n**Why Normalization Works**:\nNormalization decomposes unorganized tables into smaller, well-structured relational schemas linked via Foreign Keys.",
          keyConcept: "Goal: Eliminate redundant duplicate data and eliminate Insertion, Update, and Deletion Anomalies.",
          visualType: "code",
          visualData: { codeSnippet: `// Normalization Pipeline Overview\nUnnormalized Table (UNF)\n  ├──> 1NF: Atomic attributes (No repeating groups)\n  ├──> 2NF: 1NF + Full Functional Dependency (No Partial Dependencies)\n  └──> 3NF: 2NF + No Transitive Dependencies (Non-key -> Non-key)` },
          checkpointQuestion: {
            question: "What is the primary objective of Database Normalization?",
            options: ["Eliminate Data Redundancy and Anomalies", "Increase Storage Overhead", "Slow down database queries", "Remove Foreign Keys"],
            correctIndex: 0,
            explanation: "Normalization decomposes tables to eliminate data redundancy and anomaly risks."
          }
        },
        {
          id: "sec-2",
          title: "2. First & Second Normal Forms (1NF & 2NF)",
          content: "Let's analyze 1NF and 2NF step-by-step:\n\n**1. First Normal Form (1NF)**:\n• **Rule**: Every column cell must contain **atomic (indivisible)** values. Multi-valued arrays or repeating groups within a single cell are strictly prohibited.\n• **Example**: A `Phone` column storing `'98765, 87654'` breaks 1NF. It must be split into separate single-value rows.\n\n**2. Second Normal Form (2NF)**:\n• **Rule**: Table must be in 1NF, and EVERY non-key attribute must depend on the **FULL Primary Key**.\n• **Eliminates Partial Dependency**: Occurs when a non-key column depends on only *part* of a composite primary key.\n\n**Formula & Variable Breakdown**:\nGiven composite Primary Key $(A, B)$ and non-key attribute $C$:\n$$\\text{If } A \\rightarrow C \\text{ exists, then } C \\text{ has a Partial Dependency on } (A, B)$$\nwhere $A, B$ are composite key components and $C$ is a non-prime attribute.",
          keyConcept: "1NF = Atomic single-cell values; 2NF = Eliminates Partial Dependencies where non-key columns depend on part of a composite key.",
          visualType: "formula",
          visualData: {},
          checkpointQuestion: {
            question: "What type of dependency does 2NF eliminate?",
            options: ["Partial Dependency", "Transitive Dependency", "Cyclic Dependency", "Atomic Dependency"],
            correctIndex: 0,
            explanation: "2NF eliminates partial dependencies where non-key attributes depend on part of a composite primary key."
          }
        },
        {
          id: "sec-3",
          title: "3. Third Normal Form (3NF) & Transitive Dependency",
          content: "Now let's examine 3NF step-by-step:\n\n**Rule of 3NF**:\nTable must be in 2NF, and have **NO Transitive Dependencies**.\n\n**What is a Transitive Dependency?**\nOccurs when a non-key attribute determines another non-key attribute:\n$$A \\rightarrow B \\quad \\text{and} \\quad B \\rightarrow C \\implies A \\rightarrow C$$\nwhere $A$ is the Primary Key, but $B$ and $C$ are non-key attributes.\n\n**Example Breakdown**:\nIn `Employee(EmpID, DeptID, DeptName)`:\n• `EmpID -> DeptID` (EmpID is Primary Key).\n• `DeptID -> DeptName` (DeptID and DeptName are non-keys!).\nSince `EmpID -> DeptName` is transitive through `DeptID`, `DeptName` must be moved to a separate `Department(DeptID, DeptName)` table!",
          keyConcept: "3NF Rule: Non-key attributes must depend ON NOTHING BUT THE PRIMARY KEY (eliminates Non-key -> Non-key dependencies).",
          visualType: "formula",
          visualData: {},
          checkpointQuestion: {
            question: "Which dependency is removed in 3NF?",
            options: ["Transitive Dependency (Non-key -> Non-key)", "Partial Dependency", "Atomic Dependency", "Foreign Key Dependency"],
            correctIndex: 0,
            explanation: "3NF removes transitive functional dependencies where a non-key attribute determines another non-key attribute."
          }
        },
        {
          id: "sec-4",
          title: "4. Boyce-Codd Normal Form (BCNF) & Summary",
          content: "Boyce-Codd Normal Form (BCNF) is a stricter variant of 3NF.\n\n**BCNF Rule**:\nFor EVERY functional dependency $X \\rightarrow Y$, $X$ MUST be a **Super Key**.\n\n**Why BCNF is Needed**:\n3NF permits $X \\rightarrow Y$ if $Y$ is a prime attribute even if $X$ is not a super key. BCNF tightens this rule, ensuring that the left-hand determinant $X$ is always a candidate key.\n\n**Summary Matrix**:\n• **1NF**: Atomic values (no arrays in cells).\n• **2NF**: No Partial Dependencies ($X \\rightarrow Y$ where $X \\subset \\text{PrimaryKey}$).\n• **3NF**: No Transitive Dependencies ($A \\rightarrow B \\rightarrow C$).\n• **BCNF**: Every determinant $X$ in $X \\rightarrow Y$ must be a Super Key.",
          keyConcept: "BCNF Rule: For every X -> Y, X must be a Super Key.",
          visualType: "formula",
          visualData: {},
          checkpointQuestion: {
            question: "In BCNF, what requirement must the left-hand side X satisfy for every X -> Y?",
            options: ["X must be a Super Key", "X must be NULL", "X must be a Foreign Key", "X must be an integer"],
            correctIndex: 0,
            explanation: "In BCNF, every functional dependency X -> Y requires X to be a Super Key."
          }
        }
      ],
      examples: [
        "E-Commerce: Splitting Orders, Customers, and Products into separate relational tables connected by Foreign Keys.",
        "University Database: Separating Student(StudentID, Name, MajorID) and Major(MajorID, MajorName, DeptHead)."
      ],
      importantPoints: [
        "1NF: Atomic values only.",
        "2NF: No partial dependency on composite keys.",
        "3NF: No transitive dependency between non-key attributes.",
        "BCNF: Determinant X in X -> Y must be a Super Key."
      ],
      quiz: [
        { question: "What is Database Normalization?", options: ["Decomposing tables to reduce data redundancy", "Deleting database records", "Formatting SQL queries", "Encrypting database passwords"], correctIndex: 0, explanation: "Normalization decomposes tables to eliminate data redundancy and anomalies." },
        { question: "Which normal form requires atomic values in cells?", options: ["1NF", "2NF", "3NF", "BCNF"], correctIndex: 0, explanation: "1NF enforces indivisible atomic values in cells." },
        { question: "What dependency is eliminated in 2NF?", options: ["Partial Dependency", "Transitive Dependency", "Cyclic Dependency", "Null Dependency"], correctIndex: 0, explanation: "2NF eliminates partial dependencies." },
        { question: "What dependency is eliminated in 3NF?", options: ["Transitive Dependency", "Partial Dependency", "Atomic Dependency", "Super Key"], correctIndex: 0, explanation: "3NF eliminates transitive dependencies." },
        { question: "In BCNF, for any dependency X -> Y, X must be a:", options: ["Super Key", "Null Attribute", "Secondary Index", "Foreign Key"], correctIndex: 0, explanation: "In BCNF, X must be a Super Key." }
      ],
      summary: "Database Normalization systematically structures schemas from 1NF to BCNF to eliminate redundancy and anomaly risks."
    };
  }

  function buildTransposeLesson(subject, topic, level, style, language, voice) {
    if (language === 'Marathi') {
      return {
        title: "Fast Transpose of Sparse Matrix (मराठी)",
        subject: subject,
        level: level,
        style: style,
        language: "Marathi",
        voice: voice,
        introduction: "Fast Transpose च्या या AI क्लासमध्ये तुमचे स्वागत आहे! आज आपण शिकूया की 3-Tuple अ‍ॅरे आणि सहाय्यक अ‍ॅरे वापरून स्पार्स मॅट्रिक्स फक्त O(cols + terms) वेळेत कसा ट्रान्सपोज केला जातो.",
        sections: [
          {
            id: "sec-1",
            title: "1. Sparse Matrix आणि 3-Tuple सादरीकरण (Basics)",
            content: "मूलभूत संज्ञा समजून घेऊया:\n\n• **Sparse Matrix**: असा मॅट्रिक्स ज्यामधील बहुतांश घटकांचे मूल्य 0 असते.\n• **3-Tuple सादरीकरण**: [Row, Col, Value] या स्वरूपात फक्त गैर-शून्य (non-zero) घटक साठवण्याची पद्धत.\n\n**का वापरले जाते?**\nजर $1000 \\times 1000$ मॅट्रिक्समध्ये फक्त 10 गैर-शून्य घटक असतील, तर 2D अ‍ॅरे $1,000,000$ सेल्स घेईल. 3-Tuple फक्त 11 ओळी वापरून 99.9% मेमरी वाचवतो!",
            keyConcept: "3-Tuple: [Row, Col, Value] मेमरी वापर O(rows x cols) वरून O(terms) पर्यंत कमी करते.",
            visualType: "matrix",
            visualData: {},
            checkpointQuestion: {
              question: "Sparse Matrix चे 3-Tuple सादरीकरण काय साठवते?",
              options: ["[Row, Col, Value] गैर-शून्य घटकांसाठी", "फक्त 0 मूल्ये", "संपूर्ण 2D अ‍ॅरे", "डिटरमिनंट"],
              correctIndex: 0,
              explanation: "3-Tuple सादरीकरण फक्त non-zero घटकांसाठी [Row, Col, Value] साठवते."
            }
          },
          {
            id: "sec-2",
            title: "2. सिंपल ट्रान्सपोज आणि त्याची मर्यादा $O(\\text{cols} \\times \\text{terms})$",
            content: "मॅट्रिक्स ट्रान्सपोजमध्ये Rows चे Cols आणि Cols चे Rows होतात. नाविन्यपूर्ण सोप्या पद्धतीत (Simple Transpose):\n• 0 पासून `cols-1` पर्यंत प्रत्येक कॉलमसाठी 3-tuple अ‍ॅरे पुन्हा-पुन्हा स्कॅन केला जातो.\n• वेळ जटिलता सूत्र: $T(n) = O(\\text{cols} \\times \\text{terms})$.\n\nज्या अर्थी `cols` आणि `terms` मोठे असतात, तेथे ही पद्धत अत्यंत धीमी पडते.",
            keyConcept: "सिंपल ट्रान्सपोज $O(cols \\times terms)$ वेळेत चालतो कारण प्रत्येक कॉलमसाठी पुन्हा स्कॅनिंग करावे लागते.",
            visualType: "formula",
            visualData: {},
            checkpointQuestion: {
              question: "Simple Transpose ची वेळ जटिलता किती असते?",
              options: ["O(cols × terms)", "O(1)", "O(cols + terms)", "O(N log N)"],
              correctIndex: 0,
              explanation: "Simple Transpose O(cols × terms) वेळेत चालतो."
            }
          },
          {
            id: "sec-3",
            title: "3. फास्ट ट्रान्सपोज अल्गोरिदम: $O(\\text{cols} + \\text{terms})$",
            content: "Fast Transpose दोन सहाय्यक (Auxiliary) अ‍ॅरे वापरून ही समस्या सोडवतो:\n1. `row_terms[col]`: मूळ मॅट्रिक्समधील प्रत्येक कॉलममध्ये किती non-zero घटकांची संख्या आहे हे साठवतो.\n2. `starting_pos[col]`: ट्रान्सपोज्ड अ‍ॅरेमध्ये त्या कॉलमचे घटक कोठून सुरू होतात याचा इंडेक्स ठरवतो.\n\n**सूत्र (Frequency to Offset Conversion)**:\n$$\\text{starting\_pos}[0] = 1$$\n$$\\text{starting\_pos}[i] = \\text{starting\_pos}[i-1] + \\text{row\_terms}[i-1]$$\n\nयामुळे मूळ अ‍ॅरेवरून फक्त एकाच पास (Single Pass) मध्ये योग्य इंडेक्स समजतो!",
            keyConcept: "सहाय्यक अ‍ॅरे row_terms आणि starting_pos एकाच पासमध्ये O(cols + terms) गती देतात.",
            visualType: "code",
            visualData: { codeSnippet: `// Step 1: Count terms per column\nfor (i = 1; i <= terms; i++) row_terms[a[i].col]++;\n\n// Step 2: Compute starting positions\nstarting_pos[0] = 1;\nfor (i = 1; i < cols; i++)\n    starting_pos[i] = starting_pos[i-1] + row_terms[i-1];\n\n// Step 3: Single Pass Transpose\nfor (i = 1; i <= terms; i++) {\n    j = starting_pos[a[i].col]++;\n    b[j].row = a[i].col;\n    b[j].col = a[i].row;\n    b[j].val = a[i].val;\n}` },
            checkpointQuestion: {
              question: "Fast Transpose मध्ये starting_pos[i] कसे काढले जाते?",
              options: ["starting_pos[i-1] + row_terms[i-1]", "starting_pos[i-1] * 2", "row_terms[i] + 1", "शून्य"],
              correctIndex: 0,
              explanation: "starting_pos[i] हे आधीच्या कॉलमच्या starting position मध्ये त्या कॉलमचे frequency term मिळवून काढले जाते."
            }
          },
          {
            id: "sec-4",
            title: "4. जटिलता विश्लेषण आणि सारांश",
            content: "Fast Transpose ची कार्यक्षमता पाहूया:\n• **वेळ जटिलता (Time Complexity)**: $O(\\text{cols} + \\text{terms})$\n  - चरण 1 (row_terms भरणी): $O(\\text{terms})$\n  - चरण 2 (starting_pos भरणी): $O(\\text{cols})$\n  - चरण 3 (सिंगल पास ट्रान्सपोज): $O(\\text{terms})$\n  - एकूण: $O(\\text{cols} + \\text{terms})$ लीनियर वेळ!\n• **स्पेस जटिलता (Space Complexity)**: $O(\\text{cols})$ सहाय्यक अ‍ॅरेसाठी.",
            keyConcept: "वेळ जटिलता: O(cols + terms), स्पेस जटिलता: O(cols).",
            visualType: "formula",
            visualData: {},
            checkpointQuestion: {
              question: "Fast Transpose ची वेळ जटिलता किती असते?",
              options: ["O(cols + terms)", "O(cols × terms)", "O(1)", "O(N²)"],
              correctIndex: 0,
              explanation: "Fast Transpose O(cols + terms) लीनियर वेळेत निष्पादित होतो."
            }
          }
        ],
        examples: [
          "3D ग्राफिक्स इंजिन: मॅट्रिक्स ट्रान्सफॉर्मेशन्स जलद रीतीने पार पाडण्यासाठी.",
          "मोठे डेटाबेस इंडेक्स: स्पार्स इंडेक्स टेबल वेगाने उलटण्यासाठी."
        ],
        importantPoints: [
          "Sparse Matrix: बहुतांश घटक शून्य असतात.",
          "3-Tuple: [Row, Col, Value] मेमरी वाचवतो.",
          "Simple Transpose: O(cols × terms) वेळ.",
          "Fast Transpose: O(cols + terms) लीनियर वेळ."
        ],
        quiz: [
          { question: "कोणत्या मॅट्रिक्समध्ये बहुतांश घटक शून्य असतात?", options: ["Sparse Matrix", "Dense Matrix", "Identity Matrix", "Square Matrix"], correctIndex: 0, explanation: "स्पार्स मॅट्रिक्समध्ये बहुतांश घटक शून्य असतात." },
          { question: "Fast Transpose ची वेळ जटिलता काय आहे?", options: ["O(cols + terms)", "O(cols × terms)", "O(1)", "O(N²)"], correctIndex: 0, explanation: "Fast Transpose O(cols + terms) मध्ये चालतो." },
          { question: "कोणता अ‍ॅरे कॉलमची सुरुवातीची स्थिती साठवतो?", options: ["starting_pos[]", "row_terms[]", "matrix[]", "tuple[]"], correctIndex: 0, explanation: "starting_pos[] कॉलम स्टार्ट पोझिशन साठवतो." },
          { question: "3-tuple अ‍ॅरेमध्ये इंडेक्स [0] वर काय असते?", options: ["मॅट्रिक्स मेटाडेटा (Rows, Cols, Terms)", "पहिले मूल्य", "शून्य संख्या", "Null"], correctIndex: 0, explanation: "इंडेक्स [0] वर मेटाडेटा असतो." },
          { question: "सहाय्यक अ‍ॅरेला किती मेमरी लागते?", options: ["O(cols)", "O(1)", "O(terms²)", "O(rows × cols)"], correctIndex: 0, explanation: "सहाय्यक अ‍ॅरेला O(cols) मेमरी लागते." }
        ],
        summary: "Fast Transpose स्पार्स मॅट्रिक्सला O(cols + terms) वेळेत ट्रान्सपोज करतो."
      };
    }

    if (language === 'Hindi') {
      return {
        title: "Fast Transpose of Sparse Matrix (हिंदी)",
        subject: subject,
        level: level,
        style: style,
        language: "Hindi",
        voice: voice,
        introduction: "Fast Transpose (स्पार्स मैट्रिक्स का फास्ट ट्रांसपोज) की इस AI क्लास में आपका स्वागत है! आज हम सीखेंगे कि कैसे सहायक एरे का उपयोग करके स्पार्स मैट्रिक्स को $O(\\text{cols} + \\text{terms})$ लीनियर समय में ट्रांसपोज किया जाता है।",
        sections: [
          {
            id: "sec-1",
            title: "1. Sparse Matrix एवं 3-Tuple रिप्रेजेंटेशन (Basics)",
            content: "बुनियादी शब्दों को समझते हैं:\n\n• **Sparse Matrix**: ऐसा मैट्रिक्स जिसमें अधिकांश एलिमेंट्स का मान 0 होता है।\n• **3-Tuple रिप्रेजेंटेशन**: [Row, Col, Value] के रूप में केवल non-zero मानों को स्टोर करने की विधि।\n\n**मेमोरी की बचत**:\nयदि $1000 \\times 1000$ मैट्रिक्स में केवल 10 non-zero मान हैं, तो पूरा 2D एरे $1,000,000$ सेल्स लेगा। 3-Tuple केवल 11 पंक्तियों में 99.9% मेमोरी बचाता है!",
            keyConcept: "3-Tuple: [Row, Col, Value] मेमोरी उपयोग को O(rows x cols) से घटाकर O(terms) कर देता है।",
            visualType: "matrix",
            visualData: {},
            checkpointQuestion: {
              question: "Sparse Matrix का 3-Tuple रिप्रेजेंटेशन क्या स्टोर करता है?",
              options: ["[Row, Col, Value] गैर-शून्य एलिमेंट्स के लिए", "केवल 0 मान", "पूरा 2D एरे", "डिटरमिनेंट"],
              correctIndex: 0,
              explanation: "यह केवल non-zero एलिमेंट्स के लिए [Row, Col, Value] स्टोर करता है।"
            }
          },
          {
            id: "sec-2",
            title: "2. सिंपल ट्रांसपोज की सीमा $O(\\text{cols} \\times \\text{terms})$",
            content: "सिंपल ट्रांसपोज में हर कॉलम (0 से `cols-1`) के लिए 3-tuple एरे को बार-बार स्कैन किया जाता है।\n• समय जटिलता सूत्र: $T(n) = O(\\text{cols} \\times \\text{terms})$\nजब cols और terms बड़े होते हैं, तो यह बहुत धीमा हो जाता है।",
            keyConcept: "सिंपल ट्रांसपोज O(cols x terms) समय लेता है क्योंकि बार-बार लूप चलाना पड़ता है।",
            visualType: "formula",
            visualData: {},
            checkpointQuestion: {
              question: "Simple Transpose का समय जटिलता क्या है?",
              options: ["O(cols × terms)", "O(1)", "O(cols + terms)", "O(N log N)"],
              correctIndex: 0,
              explanation: "Simple Transpose O(cols × terms) समय में निष्पादित होता है।"
            }
          },
          {
            id: "sec-3",
            title: "3. फास्ट ट्रांसपोज एल्गोरिदम: $O(\\text{cols} + \\text{terms})$",
            content: "Fast Transpose दो सहायक एरे का उपयोग करता है:\n1. `row_terms[col]`: प्रत्येक कॉलम में गैर-शून्य तत्वों की संख्या गिनता है।\n2. `starting_pos[col]`: ट्रांसपोज्ड एरे में प्रत्येक कॉलम की शुरुआती स्थिति तय करता है।\n\n**गणना सूत्र**:\n$$\\text{starting\_pos}[0] = 1$$\n$$\\text{starting\_pos}[i] = \\text{starting\_pos}[i-1] + \\text{row\_terms}[i-1]$$\n\nइससे केवल **Single Pass** में सही इंडेक्स पर वैल्यू प्लेस हो जाती है!",
            keyConcept: "सहायक एरे row_terms और starting_pos सिंगल पास में O(cols + terms) गति देते हैं।",
            visualType: "code",
            visualData: { codeSnippet: `// Step 1: Count terms per column\nfor (i = 1; i <= terms; i++) row_terms[a[i].col]++;\n\n// Step 2: Compute starting positions\nstarting_pos[0] = 1;\nfor (i = 1; i < cols; i++)\n    starting_pos[i] = starting_pos[i-1] + row_terms[i-1];\n\n// Step 3: Single Pass Transpose\nfor (i = 1; i <= terms; i++) {\n    j = starting_pos[a[i].col]++;\n    b[j].row = a[i].col;\n    b[j].col = a[i].row;\n    b[j].val = a[i].val;\n}` },
            checkpointQuestion: {
              question: "Fast Transpose में non-zero टर्म्स पर कितने पास चलाए जाते हैं?",
              options: ["केवल एक पास (Single Pass)", "दो पास", "C पास", "N² पास"],
              correctIndex: 0,
              explanation: "Fast Transpose में गैर-शून्य टर्म्स पर केवल एक पास चलाया जाता है।"
            }
          },
          {
            id: "sec-4",
            title: "4. जटिलता विश्लेषण एवं सारांश",
            content: "Fast Transpose की दक्षता:\n• **समय जटिलता (Time Complexity)**: $O(\\text{cols} + \\text{terms})$ (लीनियर समय!)\n• **स्थान जटिलता (Space Complexity)**: $O(\\text{cols})$ सहायक एरे के लिए।",
            keyConcept: "टाइम कॉम्प्लेक्सिटी: O(cols + terms)। स्पेस कॉम्प्लेक्सिटी: O(cols)।",
            visualType: "formula",
            visualData: {},
            checkpointQuestion: {
              question: "फास्ट ट्रांसपोज का समय जटिलता क्या है?",
              options: ["O(cols + terms)", "O(1)", "O(cols × terms)", "O(N²)"],
              correctIndex: 0,
              explanation: "फास्ट ट्रांसपोज O(cols + terms) समय में निष्पादित होता है।"
            }
          }
        ],
        examples: [
          "ग्राफिक्स इंजन: 3D ट्रांसफॉर्मेशन के लिए त्वरित मैट्रिक्स ट्रांसपोज।",
          "डेटाबेस इंडेक्स: मेमोरी-कुशल स्पार्स इंडेक्स हेरफेर।"
        ],
        importantPoints: [
          "स्पार्स मैट्रिक्स: अधिकांश तत्व शून्य होते हैं।",
          "फास्ट ट्रांसपोज समय: O(cols + terms)।",
          "सहायक एरे: row_terms[] और starting_pos[]।"
        ],
        quiz: [
          { question: "किस मैट्रिक्स में अधिकतर तत्व शून्य होते हैं?", options: ["Sparse Matrix", "Dense Matrix", "Identity Matrix", "Square Matrix"], correctIndex: 0, explanation: "स्पार्स मैट्रिक्स में अधिकतर तत्व शून्य होते हैं।" },
          { question: "फास्ट ट्रांसपोज का समय जटिलता क्या है?", options: ["O(cols + terms)", "O(cols × terms)", "O(1)", "O(N²)"], correctIndex: 0, explanation: "फास्ट ट्रांसपोज O(cols + terms) में चलता है।" },
          { question: "कौन सा एरे कॉलम की शुरुआती स्थिति स्टोर करता है?", options: ["starting_pos[]", "row_terms[]", "matrix[]", "tuple[]"], correctIndex: 0, explanation: "starting_pos[] कॉलम स्टार्ट पोजीशन स्टोर करता है।" },
          { question: "3-tuple एरे में इंडेक्स [0] पर क्या होता है?", options: ["मैट्रिक्स मेटाडेटा (Rows, Cols, Terms)", "पहला मान", "शून्य गिनती", "Null"], correctIndex: 0, explanation: "इंडेक्स [0] मैट्रिक्स का मेटाडेटा स्टोर करता है।" },
          { question: "सहायक एरे को कितनी मेमोरी चाहिए?", options: ["O(cols)", "O(1)", "O(terms²)", "O(rows × cols)"], correctIndex: 0, explanation: "सहायक एरे के लिए O(cols) मेमोरी चाहिए।" }
        ],
        summary: "फास्ट ट्रांसपोज स्पार्स मैट्रिक्स को O(cols + terms) समय में ट्रांसपोज करता है।"
      };
    }

    return {
      title: "Fast Transpose of Sparse Matrix",
      subject: subject,
      level: level,
      style: style,
      language: language,
      voice: voice,
      introduction: `Welcome to ${topic}! Today we will analyze step-by-step how Fast Transpose transposes sparse matrices in linear $O(\\text{cols} + \\text{terms})$ time using auxiliary frequency and offset arrays.`,
      sections: [
        {
          id: "sec-1",
          title: "1. Sparse Matrix & 3-Tuple Representation (Basics)",
          content: "Let's define our key technical terms first:\n\n• **Sparse Matrix**: A matrix where the vast majority of elements have a value of zero.\n• **3-Tuple Representation**: A memory format storing non-zero elements as `[Row, Col, Value]` tuples.\n\n**Why Use 3-Tuple?**\nIn a $1000 \\times 1000$ matrix with only 10 non-zero elements, storing a standard 2D array consumes $1,000,000$ memory slots. The 3-tuple array consumes only 11 rows (including index [0] metadata), saving 99.9% RAM!",
          keyConcept: "3-Tuple Representation: [Row, Col, Value] reduces memory usage from O(rows x cols) down to O(terms).",
          visualType: "matrix",
          visualData: {},
          checkpointQuestion: {
            question: "What does a 3-tuple representation of a sparse matrix store?",
            options: ["[Row, Col, Value] for non-zero elements", "Only zero values", "Full 2D array", "Determinant value"],
            correctIndex: 0,
            explanation: "3-tuple representation stores [Row, Col, Value] for non-zero elements only."
          }
        },
        {
          id: "sec-2",
          title: "2. Simple Transpose Limitations $O(\\text{cols} \\times \\text{terms})$",
          content: "Transposing a matrix swaps Rows with Columns ($Row \\leftrightarrow Col$).\n\nIn **Simple Transpose**:\n• For every column index $c$ from $0$ to $\\text{cols}-1$, the algorithm scans the entire 3-tuple array.\n• **Time Complexity Formula**:\n$$T(n) = O(\\text{cols} \\times \\text{terms})$$\nWhen the number of columns and non-zero terms is large, quadratic behavior makes Simple Transpose extremely inefficient.",
          keyConcept: "Simple Transpose runs in O(cols x terms) because it rescans the tuple array for every column.",
          visualType: "formula",
          visualData: {},
          checkpointQuestion: {
            question: "What is the time complexity of Simple Transpose?",
            options: ["O(cols × terms)", "O(1)", "O(cols + terms)", "O(N log N)"],
            correctIndex: 0,
            explanation: "Simple Transpose runs in O(cols × terms) time."
          }
        },
        {
          id: "sec-3",
          title: "3. Fast Transpose Algorithm: $O(\\text{cols} + \\text{terms})$",
          content: "Fast Transpose achieves linear execution by using two auxiliary arrays:\n1. `row_terms[col]`: Stores the count of non-zero elements in column `col` of original matrix.\n2. `starting_pos[col]`: Pre-computes the target index in transposed array where column `col` elements begin.\n\n**Starting Position Recurrence Formula**:\n$$\\text{starting\_pos}[0] = 1$$\n$$\\text{starting\_pos}[i] = \\text{starting\_pos}[i-1] + \\text{row\_terms}[i-1]$$\n\nThis enables a **Single Pass** over non-zero terms to directly place each element at its exact transposed target index!",
          keyConcept: "Auxiliary Arrays: row_terms and starting_pos enable single-pass direct placement in O(cols + terms) time.",
          visualType: "code",
          visualData: { codeSnippet: `// Step 1: Count non-zero terms per column\nfor (i = 1; i <= terms; i++) row_terms[a[i].col]++;\n\n// Step 2: Compute starting positions for target array\nstarting_pos[0] = 1;\nfor (i = 1; i < cols; i++)\n    starting_pos[i] = starting_pos[i-1] + row_terms[i-1];\n\n// Step 3: Single Pass Transposition\nfor (i = 1; i <= terms; i++) {\n    j = starting_pos[a[i].col]++;\n    b[j].row = a[i].col;\n    b[j].col = a[i].row;\n    b[j].val = a[i].val;\n}` },
          checkpointQuestion: {
            question: "How many passes over non-zero terms does Fast Transpose perform?",
            options: ["Single Pass (1 pass)", "Two passes", "Cols passes", "N² passes"],
            correctIndex: 0,
            explanation: "Fast Transpose processes non-zero terms in a single pass using pre-computed starting positions."
          }
        },
        {
          id: "sec-4",
          title: "4. Complexity Analysis & Summary",
          content: "Let's break down the overall computational efficiency:\n\n• **Time Complexity**:\n  - Step 1 (Count `row_terms`): $O(\\text{terms})$\n  - Step 2 (Compute `starting_pos`): $O(\\text{cols})$\n  - Step 3 (Single Pass placement): $O(\\text{terms})$\n  - **Total Time**: $O(\\text{cols} + \\text{terms})$ — Linear execution!\n\n• **Space Complexity**: $O(\\text{cols})$ memory for helper arrays.",
          keyConcept: "Total Time Complexity: O(cols + terms). Space Complexity: O(cols) for helper arrays.",
          visualType: "formula",
          visualData: {},
          checkpointQuestion: {
            question: "What is the time complexity of Fast Transpose?",
            options: ["O(cols + terms)", "O(1)", "O(cols × terms)", "O(N²)"],
            correctIndex: 0,
            explanation: "Fast Transpose executes in linear O(cols + terms) time complexity."
          }
        }
      ],
      examples: [
        "3D Graphics Engines: Fast matrix transposition for real-time camera view transformations.",
        "Database Indexing: Inverting sparse index tables for high-speed queries."
      ],
      importantPoints: [
        "Sparse Matrix: Contains predominantly zero elements.",
        "3-Tuple: Stores [Row, Col, Value] saving memory.",
        "Simple Transpose: Runs in O(cols × terms) time.",
        "Fast Transpose: Achieves linear O(cols + terms) time via helper arrays."
      ],
      quiz: [
        { question: "Which matrix contains mostly zeros?", options: ["Sparse Matrix", "Dense Matrix", "Identity Matrix", "Square Matrix"], correctIndex: 0, explanation: "Sparse matrices contain mostly zero elements." },
        { question: "What is the time complexity of Fast Transpose?", options: ["O(cols + terms)", "O(cols × terms)", "O(1)", "O(N²)"], correctIndex: 0, explanation: "Fast Transpose runs in O(cols + terms) time." },
        { question: "Which auxiliary array stores target starting positions?", options: ["starting_pos[]", "row_terms[]", "matrix[]", "tuple[]"], correctIndex: 0, explanation: "starting_pos[] pre-computes target starting indices." },
        { question: "What is stored at index [0] in a 3-tuple array?", options: ["Total rows, cols, terms metadata", "First element value", "Zeros count", "Null"], correctIndex: 0, explanation: "Index [0] stores matrix metadata (rows, cols, non-zero terms count)." },
        { question: "What space complexity do helper arrays require?", options: ["O(cols)", "O(1)", "O(terms²)", "O(rows × cols)"], correctIndex: 0, explanation: "Requires O(cols) space for auxiliary arrays." }
      ],
      summary: "Fast Transpose transposes sparse matrices in linear O(cols + terms) time using count and offset arrays."
    };
  }

  function buildGenericMultiLingualLesson(subject, topic, level, style, language, voice) {
    const topicTitle = topic || "Engineering Topic";

    if (language === 'Hindi') {
      return {
        title: `${topicTitle} (हिंदी)`,
        subject: subject,
        level: level,
        style: style,
        language: "Hindi",
        voice: voice,
        introduction: `नमस्ते! ${subject} के अंतर्गत **${topicTitle}** की इस AI क्लास में आपका स्वागत है। चिंता न करें, हम इसे बुनियादी नियमों के साथ स्टेप-बाय-स्टेप (Step-by-Step) गहराई से सीखेंगे!`,
        sections: [
          {
            id: "sec-1",
            title: `1. ${topicTitle} का परिचय एवं मूलभूत नियम (Basics)`,
            content: `इंजीनियरिंग में **${topicTitle}** एक मूलभूत अवधारणा है।\n\n**मुख्य परिभाषाएँ**:\n• **सिस्टम स्टेट (System State)**: निष्पादन के दौरान वेरिएबल और मेमोरी की वर्तमान स्थिति।\n• **ऑप्टिमाइजेशन (Optimization)**: संसाधन (CPU/मेमोरी) उपयोग को कम करते हुए प्रदर्शन बढ़ाना।\n\n**यह कैसे और क्यों काम करता है?**\nमैन्युअल प्रक्रियाओं के स्थान पर, ${topicTitle} स्पष्ट नियम और एल्गोरिदम लागू करता है ताकि त्रुटियों और विसंगतियों को रोका जा सके।`,
            keyConcept: `मुख्य उद्देश्य: ${topicTitle} ${subject} में सिस्टम दक्षता और सुरक्षा सुनिश्चित करता है।`,
            visualType: "array",
            visualData: { description: `${topicTitle} आर्किटेक्चर डायग्राम` },
            checkpointQuestion: {
              question: `${topicTitle} की मुख्य भूमिका क्या है?`,
              options: [
                `${subject} में प्रदर्शन और स्टेट मैनेजमेंट को अनुकूलित करना`,
                "अनावश्यक संसाधनों का अपव्यय करना",
                "सुरक्षा जांच को दरकिनार करना",
                "प्रोसेसिंग को धीमा करना"
              ],
              correctIndex: 0,
              explanation: `${topicTitle} स्टेट मैनेजमेंट और संसाधन उपयोग को ऑप्टिमाइज़ करता है।`
            }
          },
          {
            id: "sec-2",
            title: `2. कार्य सिद्धांत एवं लॉजिक (Working Principle)`,
            content: "मुख्य कार्यप्रणाली तीन मुख्य चरणों का पालन करती है:\n\n1. **इनपुट सेटअप (Input Setup)**: प्रारंभिक मापदंडों और वेरिएबल्स का सत्यापन।\n2. **स्टेट प्रोसेसिंग (State Processing)**: मुख्य एल्गोरिदम और लॉजिक का निष्पादन।\n3. **आउटपुट जेनरेशन (Output Generation)**: परिणाम तैयार करना और संसाधनों को मुक्त करना।",
            keyConcept: "3-चरणीय तंत्र: इनपुट सेटअप -> स्टेट प्रोसेसिंग -> आउटपुट जेनरेशन",
            visualType: "code",
            visualData: { codeSnippet: `// Processing Logic for ${topicTitle}\nvoid process_${topicTitle.toLowerCase().replace(/[^a-z0-9]/g, '_')}() {\n    setupInput(); // Step 1: Setup\n    executeLogic(); // Step 2: Core Execution\n    generateOutput(); // Step 3: Result Output\n}` },
            checkpointQuestion: {
              question: `स्टेट प्रोसेसिंग के दौरान क्या होता है?`,
              options: [
                "मुख्य लॉजिक निष्पादन और स्टेट परिवर्तन",
                "सिस्टम बंद होना",
                "डेटा डिलीट होना",
                "अनंत लूप"
              ],
              correctIndex: 0,
              explanation: "स्टेट प्रोसेसिंग में मुख्य एल्गोरिदम और कार्य निष्पादित होते हैं।"
            }
          },
          {
            id: "sec-3",
            title: `3. चरण-दर-चरण निष्पादन एवं सुरक्षा नियम`,
            content: "निष्पादन के दौरान, चरण-दर-चरण सत्यापन यह सुनिश्चित करता है कि कोई अवांछित त्रुटि या रेस कंडीशन सिस्टम को प्रभावित न करे।",
            keyConcept: "हर चरण पर सत्यापन स्थिरता और सटीकता की गारंटी देता है।",
            visualType: "formula",
            visualData: {},
            checkpointQuestion: {
              question: `${topicTitle} में चरण-दर-चरण सत्यापन क्यों आवश्यक है?`,
              options: [
                "स्थिरता सुनिश्चित करने और त्रुटियों को रोकने के लिए",
                "सिस्टम क्रैश बढ़ाने के लिए",
                "मेमोरी की खपत दोगुनी करने के लिए",
                "कोई प्रभाव नहीं"
              ],
              correctIndex: 0,
              explanation: "सत्यापन से त्रुटियों और अस्थिरता को रोका जाता है।"
            }
          },
          {
            id: "sec-4",
            title: `4. सारांश और इंजीनियरिंग ट्रेड-ऑफ (Summary)`,
            content: "प्रत्येक इंजीनियरिंग डिज़ाइन में ट्रेड-ऑफ (Trade-offs) शामिल होते हैं। ${topicTitle} को लागू करने में स्पीड, मेमोरी और कोड की सरलता के बीच संतुलन बनाना होता है।",
            keyConcept: "इंजीनियरिंग ट्रेड-ऑफ: स्पीड, मेमोरी क्षमता और कोड जटिलता में संतुलन।",
            visualType: "formula",
            visualData: {},
            checkpointQuestion: {
              question: `${topicTitle} में कौन सा ट्रेड-ऑफ शामिल है?`,
              options: [
                "स्पीड, मेमोरी उपयोग और जटिलता में संतुलन",
                "प्रदर्शन मेट्रिक्स को अनदेखा करना",
                "अधिकतम मेमोरी का व्यर्थ उपयोग",
                "हार्डवेयर को हटाना"
              ],
              correctIndex: 0,
              explanation: "इंजीनियरिंग में स्पीड और मेमोरी में संतुलन आवश्यक है।"
            }
          }
        ],
        examples: [
          `उत्पादन प्रणालियाँ: ${topicTitle} का उपयोग विश्वसनीयता के लिए किया जाता है।`,
          `एम्बेडेड सिस्टम: ${topicTitle} CPU लोड और मेमोरी उपयोग को कम करता है।`
        ],
        importantPoints: [
          `${topicTitle}: ${subject} की मुख्य अवधारणा।`,
          "कार्यप्रवाह: इनपुट -> प्रोसेसिंग -> आउटपुट।",
          "संतुलन: प्रदर्शन और मेमोरी सीमाओं में तालमेल।"
        ],
        quiz: [
          { question: `${topicTitle} का मुख्य कार्य क्या है?`, options: [`${subject} में संचालन को ऑप्टिमाइज़ करना`, "धीमा करना", "त्रुटि उत्पन्न करना", "फाइल डिलीट करना"], correctIndex: 0, explanation: `${topicTitle} संचालन को सुव्यवस्थित करता है।` },
          { question: `प्रारंभिक स्थिति को कौन सा चरण सेट करता है?`, options: ["इनपुट सेटअप", "क्लीनअप", "टर्मिनेशन", "हॉल्ट"], correctIndex: 0, explanation: "इनपुट सेटअप प्रारंभिक मापदंडों को सेट करता है।" },
          { question: `समय और स्थान जटिलता का विश्लेषण क्यों करते हैं?`, options: ["इष्टतम संसाधन संतुलन बनाने के लिए", "कोई बदलाव न करने के लिए", "लागत बढ़ाने के लिए", "अनिवार्य नियम"], correctIndex: 0, explanation: "जटिलता विश्लेषण से बेहतर संसाधन उपयोग होता है।" },
          { question: `एज केस (Edge Cases) को संभालने से क्या लाभ होता है?`, options: ["सिस्टम स्थिरता और विश्वसनीयता मिलती है", "क्रैश होता है", "डेटा नष्ट होता है", "कोई लाभ नहीं"], correctIndex: 0, explanation: "एज केस हैंडलिंग से सिस्टम स्थिर रहता है।" },
          { question: `${topicTitle} सीखते समय मुख्य सिद्धांत क्या है?`, options: ["अंतर्निहित सिद्धांतों और ट्रेड-ऑफ को समझना", "केवल कोड रटना", "टेस्टिंग न करना", "डायग्राम न देखना"], correctIndex: 0, explanation: "सिद्धांतों और ट्रेड-ऑफ को समझना ही वास्तविक इंजीनियरिंग है।" }
        ],
        summary: `${topicTitle} ${subject} में जटिल कार्यों को प्रबंधित करने के लिए एक संरचित दृष्टिकोण प्रदान करता है।`
      };
    }

    if (language === 'Marathi') {
      return {
        title: `${topicTitle} (मराठी)`,
        subject: subject,
        level: level,
        style: style,
        language: "Marathi",
        voice: voice,
        introduction: `नमस्कार! ${subject} मधील **${topicTitle}** च्या या AI क्लासमध्ये तुमचे स्वागत आहे. आपण ही संकल्पना सोप्या उदाहरणांसह स्टेप-बाय-स्टेप शिकूया!`,
        sections: [
          {
            id: "sec-1",
            title: `1. ${topicTitle} ची ओळख (Overview & Basics)`,
            content: `${subject} मध्ये **${topicTitle}** ही एक महत्त्वाची संकल्पना आहे.\n\nमॅन्युअल पद्धतींऐवजी, ${topicTitle} सिस्टीमची स्थिरता आणि अचूकता सुनिश्चित करण्यासाठी सुस्पष्ट नियम परिभाषित करते.`,
            keyConcept: `मुख्य उद्दिष्ट: ${topicTitle} ${subject} मध्ये सिस्टीम कार्यक्षमता सुधारते.`,
            visualType: "array",
            visualData: { description: `${topicTitle} आर्किटेक्चर डायग्राम` },
            checkpointQuestion: {
              question: `${topicTitle} ची मुख्य भूमिका काय आहे?`,
              options: [
                `${subject} मध्ये कार्यक्षमता आणि स्टेट व्यवस्थापन सुलभ करणे`,
                "अनावश्‍यक संसाधने वाया घालवणे",
                "सुरक्षा नियम टाळणे",
                "प्रक्रिया धीमी करणे"
              ],
              correctIndex: 0,
              explanation: `${topicTitle} सिस्टीमचे स्टेट व्यवस्थापन आणि संसाधन वापर ऑप्टिमाइझ करते.`
            }
          },
          {
            id: "sec-2",
            title: `2. ${topicTitle} चे कार्य तत्त्व (Working Principle)`,
            content: "कार्यपद्धती तीन मुख्य टप्प्यांचे पालन करते:\n1. इनपुट सेटअप: सुरुवातीच्या पॅरामीटर्सची रचना करणे.\n2. स्टेट प्रोसेसिंग: मुख्य अल्गोरिदम आणि लॉजिक चालवणे.\n3. आउटपुट जनरेशन: अंतिम निकाल तयार करणे.",
            keyConcept: "3-टप्प्यांची पद्धत: इनपुट सेटअप -> स्टेट प्रोसेसिंग -> आउटपुट जनरेशन",
            visualType: "code",
            visualData: { codeSnippet: `// Processing Logic for ${topicTitle}\nvoid process_${topicTitle.toLowerCase().replace(/[^a-z0-9]/g, '_')}() {\n    setupInput();\n    executeLogic();\n    generateOutput();\n}` },
            checkpointQuestion: {
              question: `स्टेट प्रोसेसिंग दरम्यान काय होते?`,
              options: [
                "मुख्य लॉजिक चालवणे आणि स्टेट बदलणे",
                "सिस्टीम बंद होणे",
                "डेटा डिलीट होणे",
                "अनंत लूप"
              ],
              correctIndex: 0,
              explanation: "स्टेट प्रोसेसिंगमध्ये मुख्य अल्गोरिदम आणि कार्ये पार पडतात."
            }
          },
          {
            id: "sec-3",
            title: `3. टप्प्याटप्प्याने अंमलबजावणी (Step-by-Step Execution)`,
            content: "टप्प्याटप्प्याने पडताळणी केल्याने कोणत्याही त्रुटी किंवा शर्यतीची स्थिती (Race Condition) सिस्टीमला प्रभावित करू शकत नाही.",
            keyConcept: "प्रत्येक टप्प्यावर पडताळणी केल्याने स्थिरता आणि अचूकतेची हमी मिळते.",
            visualType: "formula",
            visualData: {},
            checkpointQuestion: {
              question: `${topicTitle} मध्ये टप्प्याटप्प्याने पडताळणी का आवश्यक आहे?`,
              options: [
                "स्थिरता सुनिश्चित करण्यासाठी आणि त्रुटी रोखण्यासाठी",
                "सिस्टीम क्रॅश वाढवण्यासाठी",
                "मेमरी वापर दुप्पट करण्यासाठी",
                "काहीही फरक पडत नाही"
              ],
              correctIndex: 0,
              explanation: "पडताळणीमुळे त्रुटी आणि अस्थिरता टाळता येते."
            }
          },
          {
            id: "sec-4",
            title: `4. सारांश आणि इंजिनिअरिंग ट्रेड-ऑफ (Summary)`,
            content: "प्रत्येक इंजिनिअरिंग डिझाइनमध्ये ट्रेड-ऑफ असतात. ${topicTitle} ची अंमलबजावणी करताना वेग, मेमरी आणि कोडची सुलभता यामध्ये समतोल साधावा लागतो.",
            keyConcept: "इंजिनिअरिंग ट्रेड-ऑफ: वेग, मेमरी क्षमता आणि कोड सुलभतेत समतोल.",
            visualType: "formula",
            visualData: {},
            checkpointQuestion: {
              question: `${topicTitle} मध्ये कोणता ट्रेड-ऑफ असतो?`,
              options: [
                "वेग, मेमरी वापर आणि सुलभतेत समतोल",
                "परफॉर्मन्स मेट्रिक्सकडे दुर्लक्ष करणे",
                "अवाजवी मेमरी वापरणे",
                "हार्डवेअर काढून टाकणे"
              ],
              correctIndex: 0,
              explanation: "इंजिनिअरिंगमध्ये वेग आणि मेमरीमध्ये समतोल साधणे आवश्यक असते."
            }
          }
        ],
        examples: [
          `उत्पादन प्रणाली: ${topicTitle} चा वापर विश्वासार्हतेसाठी केला जातो.`,
          `एमबेडेड सिस्टीम: ${topicTitle} CPU लोड आणि मेमरी वापर कमी करते.`
        ],
        importantPoints: [
          `${topicTitle}: ${subject} मधील महत्त्वाची संकल्पना.`,
          "कार्यप्रवाह: इनपुट -> प्रोसेसिंग -> आउटपुट.",
          "समतोल: कार्यक्षमता आणि मेमरी सीमांमध्ये सुसंवाद."
        ],
        quiz: [
          { question: `${topicTitle} चे मुख्य कार्य काय आहे?`, options: [`${subject} मधील ऑपरेशन्स ऑप्टिमाइझ करणे`, "धीमी करणे", "त्रुटी निर्माण करणे", "फायली डिलीट करणे"], correctIndex: 0, explanation: `${topicTitle} ऑपरेशन्स सुलभ करते.` },
          { question: `सुरुवातीची स्थिती कोणता टप्पा सेट करतो?`, options: ["इनपुट सेटअप", "क्लीनअप", "टर्मिनेशन", "हॉल्ट"], correctIndex: 0, explanation: "इनपुट सेटअप सुरुवातीचे पॅरामीटर्स सेट करतो." },
          { question: `वेळ आणि मेमरी जटिलतेचे विश्लेषण का करतो?`, options: ["योग्य संसाधन समतोल साधण्यासाठी", "काहीही न बदलण्यासाठी", "खर्च वाढवण्यासाठी", "अनिवार्य नियम म्हणून"], correctIndex: 0, explanation: "जटिलता विश्लेषणामुळे संसाधनांचा योग्य वापर होतो." },
          { question: `एज केसेस (Edge Cases) हाताळल्याने काय फायदा होतो?`, options: ["सिस्टीमला स्थिरता आणि विश्वासार्हता मिळते", "क्रॅश होतो", "डेटा नष्ट होतो", "काहीही फायदा नाही"], correctIndex: 0, explanation: "एज केसेस हाताळल्याने सिस्टीम स्थिर राहते." },
          { question: `${topicTitle} शिकताना मुख्य तत्त्व कोणते?`, options: ["मूलभूत संकल्पना आणि ट्रेड-ऑफ समजून घेणे", "फक्त कोड घोखणे", "चाचणी न करणे", "आकृत्या न पाहणे"], correctIndex: 0, explanation: "संकल्पना आणि ट्रेड-ऑफ समजून घेणे म्हणजेच खरे इंजिनिअरिंग होय." }
        ],
        summary: `${topicTitle} ${subject} मधील गुंतागुंतीचे काम व्यवस्थापित करण्यासाठी एक संरचित मार्ग प्रदान करते.`
      };
    }

    let intro = `Welcome to this dedicated AI teaching session on ${topicTitle} (${subject}) in ${language}! Let's understand this step-by-step starting from absolute basics.`;
    if (language === 'Hinglish') {
      intro = `Welcome! Aaj hum ${subject} ke ${topicTitle} ko bilkul step-by-step aur detailed conversational style mein samjhenge!`;
    }

    return {
      title: topicTitle,
      subject: subject,
      level: level,
      style: style,
      language: language,
      voice: voice,
      introduction: intro,
      sections: [
        {
          id: "sec-1",
          title: `1. Introduction & Core Concept of ${topicTitle}`,
          content: `In ${subject}, **${topicTitle}** plays a critical role in system architecture.\n\n**Fundamental Definitions**:\n• **System State**: The current configuration of variables and allocated memory.\n• **Optimization**: Maximizing execution speed while minimizing computational resource overhead.\n\n**Why is ${topicTitle} Necessary?**\nInstead of manual tracking, ${topicTitle} enforces explicit rules and algorithmic steps to guarantee correctness and prevent runtime failures.`,
          keyConcept: `Core Goal: ${topicTitle} optimizes system operations and performance in ${subject}.`,
          visualType: "array",
          visualData: { description: `Architecture diagram for ${topicTitle}` },
          checkpointQuestion: {
            question: `What is the primary role of ${topicTitle}?`,
            options: [
              `Optimize performance and state management in ${subject}`,
              "Increase unnecessary resource overhead",
              "Bypass safety checks",
              "Slow down processing"
            ],
            correctIndex: 0,
            explanation: `${topicTitle} optimizes system state management and resource utilization.`
          }
        },
        {
          id: "sec-2",
          title: `2. Working Principle of ${topicTitle}`,
          content: "Now let's examine the operational mechanism step-by-step across three primary phases:\n\n1. **Input Setup**: Validating and initializing starting parameters.\n2. **State Processing**: Executing core algorithms and state transformations.\n3. **Output Generation**: Producing final verified output while releasing transient memory.",
          keyConcept: "3-Step Mechanism: Input Setup -> State Processing -> Output Generation",
          visualType: "code",
          visualData: { codeSnippet: `// Processing Logic for ${topicTitle}\nvoid process_${topicTitle.toLowerCase().replace(/[^a-z0-9]/g, '_')}() {\n    setupInput(); // Step 1: Setup\n    executeLogic(); // Step 2: Core Execution\n    generateOutput(); // Step 3: Result Output\n}` },
          checkpointQuestion: {
            question: `What happens during state processing in ${topicTitle}?`,
            options: [
              "Core logic execution and state transformation",
              "System shutdown",
              "Data deletion",
              "Infinite loop"
            ],
            correctIndex: 0,
            explanation: "State processing executes core algorithms and state transformations."
          }
        },
        {
          id: "sec-3",
          title: `3. Step-by-Step Execution & Constraint Validation`,
          content: "During execution, step-by-step state validation ensures no race conditions, memory leaks, or unhandled edge cases disrupt system execution.",
          keyConcept: "Validation at every step guarantees stability and system correctness.",
          visualType: "formula",
          visualData: {},
          checkpointQuestion: {
            question: `Why is step-by-step validation essential in ${topicTitle}?`,
            options: [
              "Ensures stability and prevents unhandled errors",
              "Increases crash probability",
              "Doubles memory consumption",
              "Has no effect"
            ],
            correctIndex: 0,
            explanation: "Step-by-step validation prevents unhandled errors and instability."
          }
        },
        {
          id: "sec-4",
          title: `4. Summary & Engineering Trade-Offs`,
          content: "Every engineering design decision involves trade-offs. Implementing ${topicTitle} requires balancing execution speed, memory footprint, and code complexity.",
          keyConcept: "Engineering Trade-off: Balancing speed, memory efficiency, and structural complexity.",
          visualType: "formula",
          visualData: {},
          checkpointQuestion: {
            question: `What trade-off is involved in ${topicTitle}?`,
            options: [
              "Balancing execution speed, memory usage, and operational complexity",
              "Ignoring performance metrics",
              "Using maximum memory regardless of cost",
              "Replacing hardware with software"
            ],
            correctIndex: 0,
            explanation: "Engineering requires balancing speed, memory, and operational complexity."
          }
        }
      ],
      examples: [
        `Production Systems: ${topicTitle} is applied in enterprise engineering for reliability.`,
        `Embedded Control: Optimized ${topicTitle} implementations minimize CPU load and memory usage.`
      ],
      importantPoints: [
        `${topicTitle}: Fundamental concept in ${subject}.`,
        "Workflow: Input Setup -> State Processing -> Verified Output.",
        "Trade-off: Balancing computational complexity with resource boundaries."
      ],
      quiz: [
        { question: `What is the core function of ${topicTitle}?`, options: [`Optimize operations in ${subject}`, "Slow down processing", "Generate random errors", "Delete files"], correctIndex: 0, explanation: `${topicTitle} optimizes state processing and operational efficiency.` },
        { question: `Which phase sets up initial state in ${topicTitle}?`, options: ["Input Setup", "Cleanup", "Deallocation", "Termination"], correctIndex: 0, explanation: "Input setup configures initial starting conditions." },
        { question: `Why analyze time and space complexity for ${topicTitle}?`, options: ["To make informed trade-offs for target workloads", "Complexity never changes", "To inflate costs", "Required by compilers"], correctIndex: 0, explanation: "Complexity analysis guides optimal resource trade-offs." },
        { question: `What does handling edge cases in ${topicTitle} achieve?`, options: ["Ensures system stability and reliability", "Causes program crashes", "Corrupts data", "Increases CPU usage"], correctIndex: 0, explanation: "Handling edge cases guarantees system stability." },
        { question: `What is a key principle when learning ${topicTitle}?`, options: ["Understand underlying mechanisms, logic, and trade-offs", "Memorize code blindly", "Avoid testing code", "Never use diagrams"], correctIndex: 0, explanation: "Focusing on mechanisms and trade-offs builds engineering mastery." }
      ],
      summary: `${topicTitle} provides a structured, efficient approach to managing complex operations in ${subject}.`
    };
  }

  // Export public API methods
  return {
    init,
    startSession,
    renderSection,
    prevSection,
    nextSection,
    playVoice,
    pauseVoice,
    stopVoice,
    toggleMute,
    setSpeed,
    askQuestion,
    selectQuizOption,
    submitQuiz,
    pushStackItem,
    popStackItem
  };

})();
