document.addEventListener('DOMContentLoaded', () => {

  /* =======================
     AUTENTICAÇÃO + LOAD (DO FIREBASE)
  ======================= */

  firebase.auth().onAuthStateChanged(async user => {
    if (!user) {
      window.location.href = 'login.html'; // Redireciona para login se não houver usuário
      return;
    }

    const userRef = firebase.firestore().doc('users/' + user.uid);

    try {
      const snap = await userRef.get();
      if (snap.exists) {
        const saved = snap.data();
        stats = saved.stats || stats;
        datasetKey = saved.datasetKey || datasetKey;
        examMode = saved.examMode || false;
      }
    } catch (e) {
      console.warn('⚠️ Firestore indisponível, usando memória local');
    }

    initApp();
  });

  /* =======================
     CONFIGURAÇÃO GERAL
  ======================= */

  const DATASETS = {
    frases: 'data/frases.json',
    palavras: 'data/palavras.json'
  };

  const levels = ['A1', 'A2', 'B1', 'B2', 'C1'];

  let datasetKey = 'frases';
  let data = [];
  let current = null;

  let examMode = false;

  let stats = {
    level: 'A1',
    hits: 0,
    errors: 0,
    weights: {}
  };

  let selectedVoice = null;

  /* =======================
     ELEMENTOS DO DOM
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
     INIT (APLICAÇÃO)
  ======================= */

  function initApp() {
    initVoices();
    bindEvents();
    loadDataset();
    updateUI();
  }

  function bindEvents() {
    document.getElementById('playBtn').addEventListener('click', speakSentence);
    document.getElementById('micBtn').addEventListener('click', listen);
    document.getElementById('translateBtn').addEventListener('click', toggleTranslation);
    document.getElementById('nextBtn').addEventListener('click', nextSentence);
    document.getElementById('resetBtn').addEventListener('click', resetProgress);
    toggleDatasetBtn.addEventListener('click', toggleDataset);
    examModeBtn.addEventListener('click', toggleExamMode);
  }

  /* =======================
     VOZ (TTS) — ANDROID / IOS
  ======================= */

  function initVoices() {
    const preferred = ['Samantha', 'Daniel', 'Aaron'];

    function pickVoice() {
      const voices = speechSynthesis.getVoices();
      if (!voices.length) return;

      selectedVoice =
        voices.find(v => preferred.includes(v.name) && v.lang.startsWith('en')) ||
        voices.find(v => v.lang === 'en-US') ||
        voices[0];
    }

    pickVoice();
    speechSynthesis.onvoiceschanged = pickVoice;
  }

  function speakText(text) {
    if (!text) return;
    speechSynthesis.cancel();
    speechSynthesis.resume();

    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    if (selectedVoice) u.voice = selectedVoice;
    u.rate = 0.95;
    u.pitch = 1.0;

    speechSynthesis.speak(u);
  }

  function speakSentence() {
    if (!current) return;
    speakText(current.ENG);
  }

  function speakWord(word) {
    speakText(word);
  }

  /* =======================
     DATASET
  ======================= */

  async function loadDataset() {
    const res = await fetch(DATASETS[datasetKey]);
    data = await res.json();
    nextSentence();
    updateUI();
  }

  function weightedRandom(items) {
    const pool = [];
    items.forEach(item => {
      const w = stats.weights[item.ENG] || 1;
      for (let i = 0; i < w; i++) pool.push(item);
    });
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function nextSentence() {
    const filtered = data.filter(d => d.CEFR === stats.level);
    current = weightedRandom(filtered.length ? filtered : data);

    englishText.textContent = examMode
      ? '🎧 Ouça e repita'
      : current.ENG;

    translationText.textContent = current.PTBR;
    translationText.classList.add('hidden');
    feedback.textContent = '';
  }

  /* ====================*
