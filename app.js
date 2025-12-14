document.addEventListener('DOMContentLoaded', () => {

  /* =======================
     CONFIGURAÇÃO GERAL
  ======================= */

  const DATASETS = {
    frases: 'data/frases.json',
    palavras: 'data/palavras.json'
  };

  const levels = ['A1', 'A2', 'B1', 'B2', 'C1'];

  let datasetKey = localStorage.getItem('dataset') || 'frases';
  let data = [];
  let current = null;
  let spanishVoice = null;

  let stats = JSON.parse(localStorage.getItem('stats')) || {
    level: 'A1',
    hits: 0,
    errors: 0,
    weights: {}
  };

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

  /* =======================
     VOZ ESPANHOLA (iOS FIX)
  ======================= */

  function loadSpanishVoice() {
    const voices = speechSynthesis.getVoices();

    // Preferência: espanhol da Espanha (mais neutro)
    spanishVoice =
      voices.find(v => v.lang === 'es-ES') ||
      voices.find(v => v.lang.startsWith('es')) ||
      null;
  }

  // Safari carrega vozes de forma assíncrona
  speechSynthesis.onvoiceschanged = loadSpanishVoice;
  loadSpanishVoice();

  /* =======================
     EVENTOS
  ======================= */

  document.getElementById('playBtn').onclick = speak;
  document.getElementById('micBtn').onclick = listen;
  document.getElementById('translateBtn').onclick = toggleTranslation;
  document.getElementById('nextBtn').onclick = nextSentence;
  document.getElementById('resetBtn').onclick = resetProgress;
  toggleDatasetBtn.onclick = toggleDataset;

  loadDataset();

  /* =======================
     DATASET
  ======================= */

  async function loadDataset() {
    try {
      const res = await fetch(DATASETS[datasetKey]);
      data = await res.json();
      nextSentence();
      updateUI();
    } catch (e) {
      englishText.textContent = 'Erro ao carregar dataset.';
      console.error(e);
    }
  }

  function weightedRandom(items) {
    const pool = [];
    items.forEach(item => {
      const w = stats.weights[item.ESP] || 1;
      for (let i = 0; i < w; i++) pool.push(item);
    });
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function nextSentence() {
    if (!data.length) return;

    const filtered = data.filter(d => d.CEFR === stats.level);
    current = weightedRandom(filtered.length ? filtered : data);

    englishText.textContent = current.ESP;
    translationText.textContent = current.PTBR;
    translationText.classList.add('hidden');
    feedback.textContent = '';
  }

  /* =======================
     ÁUDIO (TTS) — NATURAL
  ======================= */

  function speak() {
    if (!current || !current.ESP) return;

    speechSynthesis.cancel();

    const u = new SpeechSynthesisUtterance(current.ESP);
    u.lang = 'es-ES';

    if (spanishVoice) {
      u.voice = spanishVoice;
    }

    // Ajustes específicos para espanhol
    u.rate = 0.9;   // espanhol fica melhor levemente mais lento
    u.pitch = 1.0;
    u.volume = 1;

    speechSynthesis.speak(u);
  }

  /* =======================
     PRONÚNCIA (STT)
  ======================= */

  function normalize(text) {
    return text
      .toLowerCase()
      .replace(/[^a-záéíóúüñ']/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function similarity(a, b) {
    if (!a || !b) return 0;
    if (a === b) return 1;

    let same = 0;
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      if (a[i] === b[i]) same++;
    }
    return same / Math.max(a.length, b.length);
  }

  function highlightDifferences(target, spoken) {
    const t = target.split(' ');
    const s = spoken.split(' ');

    return t.map((w, i) => {
      const score = similarity(w, s[i] || '');
      if (score >= 0.85) return `<span>${w}</span>`;
      if (score >= 0.5)
        return `<span class="text-yellow-400 underline">${w}</span>`;
      return `<span class="text-red-400 underline">${w}</span>`;
    }).join(' ');
  }

  /* =======================
     LISTEN — SAFARI iOS
  ======================= */

  function listen() {
    const SpeechRecognition = window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      feedback.textContent = 'Reconhecimento de voz não suportado.';
      return;
    }

    if (!current || !current.ESP) {
      feedback.textContent = 'Frase inválida.';
      return;
    }

    // 🔓 desbloqueia sessão de áudio no iOS
    speechSynthesis.cancel();
    const unlock = new SpeechSynthesisUtterance(' ');
    unlock.lang = 'es-ES';
    unlock.volume = 0;
    speechSynthesis.speak(unlock);

    const rec = new SpeechRecognition();
    rec.lang = 'es-ES';
    rec.continuous = false;
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    feedback.textContent = '🎙️ Ouvindo... fale agora';

    rec.onresult = e => {
      const spoken = normalize(e.results[0][0].transcript);
      const target = normalize(current.ESP);
      const score = similarity(spoken, target);

      englishText.innerHTML = highlightDifferences(target, spoken);

      if (score >= 0.75) {
        feedback.textContent = '✅ Boa pronúncia geral';
        stats.hits++;
        stats.weights[current.ESP] =
          Math.max(1, (stats.weights[current.ESP] || 1) - 1);
        adjustLevel(true);
      } else {
        feedback.textContent = '❌ Atenção às palavras destacadas';
        stats.errors++;
        stats.weights[current.ESP] =
          (stats.weights[current.ESP] || 1) + 2;
        adjustLevel(false);
      }

      saveStats();
      updateUI();
    };

    rec.onerror = e => {
      feedback.textContent = '⚠️ Microfone: ' + e.error;
    };

    rec.start();
  }

  /* =======================
     PROGRESSÃO CEFR
  ======================= */

  function adjustLevel(success) {
    let i = levels.indexOf(stats.level);
    if (success && i < levels.length - 1) i++;
    if (!success && i > 0) i--;
    stats.level = levels[i];
  }

  /* =======================
     UI / ESTADO
  ======================= */

  function toggleTranslation() {
    translationText.classList.toggle('hidden');
  }

  function toggleDataset() {
    datasetKey = datasetKey === 'frases' ? 'palavras' : 'frases';
    localStorage.setItem('dataset', datasetKey);
    loadDataset();
  }

  function resetProgress() {
    if (!confirm('Deseja apagar todo o progresso?')) return;
    localStorage.clear();
    location.reload();
  }

  function updateUI() {
    hitsEl.textContent = stats.hits;
    errorsEl.textContent = stats.errors;
    levelText.textContent = `Nível atual: ${stats.level}`;
    toggleDatasetBtn.textContent = `Dataset: ${datasetKey}`;
  }

  function saveStats() {
    localStorage.setItem('stats', JSON.stringify(stats));
  }

});
