document.addEventListener('DOMContentLoaded', () => {

  /* =======================
     AUTH GATE (ÚNICO)
  ======================= */

  firebase.auth().onAuthStateChanged(user => {
    if (!user) {
      location.href = 'login.html';
      return;
    }
    initApp(user.uid);
  });

  async function initApp(uid) {

    /* =======================
       CONFIGURAÇÃO
    ======================= */

    const DATASETS = {
      frases: 'data/frases.json',
      palavras: 'data/palavras.json'
    };

    const levels = ['A1', 'A2', 'B1', 'B2', 'C1'];

    /* =======================
       ESTADO (COM FALLBACK)
    ======================= */

    async function safeLoad(key, fallback) {
      try {
        return await loadUserData(uid, key) ?? fallback;
      } catch {
        const v = localStorage.getItem(`${uid}_${key}`);
        return v ? JSON.parse(v) : fallback;
      }
    }

    async function safeSave(key, value) {
      try {
        await saveUserData(uid, key, value);
      } catch {
        localStorage.setItem(`${uid}_${key}`, JSON.stringify(value));
      }
    }

    let datasetKey = await safeLoad('dataset', 'frases');
    let examMode = await safeLoad('examMode', false);

    let stats = await safeLoad('stats', {
      level: 'A1',
      hits: 0,
      errors: 0,
      weights: {}
    });

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
       TTS (ESPANHOL NATURAL)
    ======================= */

    function loadSpanishVoice() {
      const voices = speechSynthesis.getVoices();
      spanishVoice =
        voices.find(v => v.lang === 'es-ES' && v.localService) ||
        voices.find(v => v.lang.startsWith('es')) ||
        null;
    }

    speechSynthesis.onvoiceschanged = loadSpanishVoice;
    loadSpanishVoice();

    function speak(text) {
      if (!text) return;
      speechSynthesis.cancel();
      speechSynthesis.resume();

      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'es-ES';
      if (spanishVoice) u.voice = spanishVoice;
      u.rate = 0.9;
      u.pitch = 1.0;

      speechSynthesis.speak(u);
    }

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
      list.forEach(item => {
        const w = stats.weights[item.ESP] || 1;
        for (let i = 0; i < w; i++) pool.push(item);
      });
      return pool[Math.floor(Math.random() * pool.length)];
    }

    function nextSentence() {
      const pool = data.filter(d => d.CEFR === stats.level);
      current = weightedPick(pool.length ? pool : data);

      englishText.innerHTML = examMode ? '🎧 Ouça e repita' : current.ESP;
      translationText.textContent = current.PTBR;
      translationText.classList.add('hidden');
      feedback.textContent = '';

      if (examMode) speak(current.ESP);
    }

    /* =======================
       STT + ANÁLISE
    ======================= */

    function normalize(text) {
      return text.toLowerCase()
        .replace(/[^a-záéíóúüñ ]/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
    }

    function similarity(a, b) {
      let same = 0;
      for (let i = 0; i < Math.min(a.length, b.length); i++) {
        if (a[i] === b[i]) same++;
      }
      return same / Math.max(a.length, b.length);
    }

    function highlight(target, spoken) {
      const t = target.split(' ');
      const s = spoken.split(' ');

      return t.map((w, i) => {
        const score = similarity(w, s[i] || '');
        if (score >= 0.8) return `<span>${w}</span>`;
        return `<span class="text-red-400 underline cursor-pointer" data-word="${w}">${w}</span>`;
      }).join(' ');
    }

    function attachWordListeners() {
      document.querySelectorAll('[data-word]').forEach(el => {
        el.onclick = () => speak(el.dataset.word);
      });
    }

    function listen() {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) {
        feedback.textContent = 'STT não suportado.';
        return;
      }

      const rec = new SR();
      rec.lang = 'es-ES';
      rec.maxAlternatives = 1;

      feedback.textContent = '🎙️ Ouvindo...';

      rec.onresult = e => {
        const spoken = normalize(e.results[0][0].transcript);
        const target = normalize(current.ESP);
        const score = similarity(spoken, target);

        englishText.innerHTML = highlight(target, spoken);
        attachWordListeners();

        if (score >= 0.75) {
          feedback.textContent = '✅ Boa pronúncia';
          stats.hits++;
          stats.weights[current.ESP] =
            Math.max(1, (stats.weights[current.ESP] || 1) - 1);
          adjustLevel(true);
        } else {
          feedback.textContent = '❌ Precisa melhorar';
          stats.errors++;
          stats.weights[current.ESP] =
            (stats.weights[current.ESP] || 1) + 2;
          adjustLevel(false);
        }

        persist();
      };

      rec.start();
    }

    /* =======================
       CEFR DINÂMICO
    ======================= */

    function adjustLevel(ok) {
      let i = levels.indexOf(stats.level);
      if (ok && i < levels.length - 1) i++;
      if (!ok && i > 0) i--;
      stats.level = levels[i];
    }

    /* =======================
       UI + PERSISTÊNCIA
    ======================= */

    function updateUI() {
      hitsEl.textContent = stats.hits;
      errorsEl.textContent = stats.errors;
      levelText.textContent = `Nível: ${stats.level}`;
      toggleDatasetBtn.textContent = `Dataset: ${datasetKey}`;
      examModeBtn.textContent = `Modo exame: ${examMode ? 'ON' : 'OFF'}`;
    }

    async function persist() {
      updateUI();
      await safeSave('stats', stats);
      await safeSave('dataset', datasetKey);
      await safeSave('examMode', examMode);
    }

    /* =======================
       EVENTOS
    ======================= */

    document.getElementById('playBtn').onclick = () => speak(current.ESP);
    document.getElementById('micBtn').onclick = listen;
    document.getElementById('nextBtn').onclick = nextSentence;
    document.getElementById('translateBtn').onclick =
      () => translationText.classList.toggle('hidden');

    toggleDatasetBtn.onclick = async () => {
      datasetKey = datasetKey === 'frases' ? 'palavras' : 'frases';
      await persist();
      await loadDataset();
    };

    examModeBtn.onclick = async () => {
      examMode = !examMode;
      await persist();
      nextSentence();
    };

    document.getElementById('resetBtn').onclick = async () => {
      if (!confirm('Resetar progresso?')) return;
      stats = { level: 'A1', hits: 0, errors: 0, weights: {} };
      await persist();
      nextSentence();
    };

    document.getElementById('logoutBtn').onclick = async () => {
      await firebase.auth().signOut();
      location.href = 'login.html';
    };

    updateUI();
    await loadDataset();
  }
});
