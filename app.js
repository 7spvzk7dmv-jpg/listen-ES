document.addEventListener('DOMContentLoaded', () => {

  /* =======================
     AUTENTICAÇÃO (GATE ÚNICO)
  ======================= */

  const waitAuth = setInterval(() => {
    const user = getUser();
    if (user === undefined) return;

    clearInterval(waitAuth);

    if (!user) {
      window.location.href = 'login.html';
      return;
    }

    initApp(); // 🚀 só inicia o app logado
  }, 50);

  async function initApp() {

    /* =======================
       CONFIGURAÇÃO
    ======================= */

    const DATASETS = {
      frases: 'data/frases.json',
      palavras: 'data/palavras.json'
    };

    const levels = ['A1', 'A2', 'B1', 'B2', 'C1'];

    let datasetKey = (await loadUserData('dataset')) || 'frases';
    let examMode = (await loadUserData('examMode')) || false;

    let stats = (await loadUserData('stats')) || {
      level: 'A1',
      hits: 0,
      errors: 0,
      weights: {}
    };

    let data = [];
    let current = null;
    let spanishVoice = null;

    /* =======================
       DOM
    ======================= */

    const englishText = document.getElementById('englishText');
    const translationText = document.getElementById('translationText');
    const feedback = document.getElementById('feedback');
    const hitsEl = document.getElementById('hits');
    const errorsEl = document.getElementById('errors');
    const levelText = document.getElementById('levelText');
    const toggleDatasetBtn = document.getElementById('toggleDataset');
    const examModeBtn = document.getElementById('examModeBtn');

    /* =======================
       VOZ ESPANHOLA
    ======================= */

    function loadSpanishVoice() {
      const voices = speechSynthesis.getVoices();
      spanishVoice =
        voices.find(v => v.lang === 'es-ES') ||
        voices.find(v => v.lang.startsWith('es')) ||
        null;
    }

    speechSynthesis.onvoiceschanged = loadSpanishVoice;
    loadSpanishVoice();

    /* =======================
       DATASET
    ======================= */

    async function loadDataset() {
      const res = await fetch(DATASETS[datasetKey]);
      data = await res.json();
      nextSentence();
    }

    function weightedPick(list) {
      const pool = [];
      list.forEach(i => {
        const w = stats.weights[i.ESP] || 1;
        for (let k = 0; k < w; k++) pool.push(i);
      });
      return pool[Math.floor(Math.random() * pool.length)];
    }

    function nextSentence() {
      const pool = data.filter(d => d.CEFR === stats.level);
      current = weightedPick(pool.length ? pool : data);

      englishText.textContent = examMode ? '••••••••••' : current.ESP;
      translationText.textContent = current.PTBR;
      translationText.classList.add('hidden');
    }

    /* =======================
       TTS
    ======================= */

    function speak() {
      if (!current) return;
      speechSynthesis.cancel();

      const u = new SpeechSynthesisUtterance(current.ESP);
      u.lang = 'es-ES';
      if (spanishVoice) u.voice = spanishVoice;
      u.rate = 0.9;
      speechSynthesis.speak(u);
    }

    /* =======================
       STT
    ======================= */

    function listen() {
      const SR = window.webkitSpeechRecognition;
      if (!SR) return;

      const rec = new SR();
      rec.lang = 'es-ES';
      rec.onresult = e => {
        const spoken = e.results[0][0].transcript.toLowerCase();
        if (spoken === current.ESP.toLowerCase()) {
          stats.hits++;
        } else {
          stats.errors++;
        }
        save();
      };
      rec.start();
    }

    function updateUI() {
      hitsEl.textContent = stats.hits;
      errorsEl.textContent = stats.errors;
      levelText.textContent = `Nível: ${stats.level}`;
      toggleDatasetBtn.textContent = `Dataset: ${datasetKey}`;
      examModeBtn.textContent = `Modo exame: ${examMode ? 'ON' : 'OFF'}`;
    }

    async function save() {
      updateUI();
      await saveUserData('stats', stats);
      await saveUserData('dataset', datasetKey);
      await saveUserData('examMode', examMode);
    }

    /* =======================
       EVENTOS
    ======================= */

    document.getElementById('playBtn').onclick = speak;
    document.getElementById('micBtn').onclick = listen;
    document.getElementById('nextBtn').onclick = nextSentence;
    document.getElementById('translateBtn').onclick =
      () => translationText.classList.toggle('hidden');

    toggleDatasetBtn.onclick = async () => {
      datasetKey = datasetKey === 'frases' ? 'palavras' : 'frases';
      await save();
      await loadDataset();
    };

    examModeBtn.onclick = async () => {
      examMode = !examMode;
      await save();
      nextSentence();
    };

    document.getElementById('resetBtn').onclick = async () => {
      stats = { level: 'A1', hits: 0, errors: 0, weights: {} };
      await save();
      nextSentence();
    };

    document.getElementById('logoutBtn').onclick = async () => {
      await logout();
      window.location.href = 'login.html';
    };

    updateUI();
    await loadDataset();
  }
});
