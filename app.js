document.addEventListener('DOMContentLoaded', () => {

  /* =======================
     PATH SEGURO (GITHUB PAGES)
  ======================= */

  const BASE_PATH = window.location.pathname.replace(/\/[^/]*$/, '');

  const DATASETS = {
    frases: `${BASE_PATH}/data/frases.json`,
    palavras: `${BASE_PATH}/data/palavras.json`
  };

  const levels = ['A1', 'A2', 'B1', 'B2', 'C1'];

  let datasetKey = localStorage.getItem('dataset') || 'frases';
  let data = [];
  let current = null;

  // 🔴 REFERÊNCIA GLOBAL — CRÍTICO NO SAFARI
  let recognition = null;

  let stats = JSON.parse(localStorage.getItem('stats')) || {
    level: 'A1',
    hits: 0,
    errors: 0,
    weights: {}
  };

  /* =======================
     ELEMENTOS DO DOM
  ======================= */

  const foreignText = document.getElementById('foreignText');
  const translationText = document.getElementById('translationText');
  const feedback = document.getElementById('feedback');
  const hitsEl = document.getElementById('hits');
  const errorsEl = document.getElementById('errors');
  const levelText = document.getElementById('levelText');
  const toggleDatasetBtn = document.getElementById('toggleDataset');

  document.getElementById('playBtn').onclick = speak;
  document.getElementById('micBtn').onclick = listen;
  document.getElementById('translateBtn').onclick = toggleTranslation;
  document.getElementById('nextBtn').onclick = nextSentence;
  document.getElementById('resetBtn').onclick = resetProgress;
  toggleDatasetBtn.onclick = toggleDataset;

  loadDataset();

  /* =======================
     NORMALIZAÇÃO DO DATASET
  ======================= */

  function normalizeItem(item) {
    return {
      es: item.ES || item.ESP || item.SPANISH || item.text || '',
      pt: item.PTBR || item.PT || item.PORTUGUESE || item.translation || '',
      level: item.CEFR || item.LEVEL || 'A1'
    };
  }

  async function loadDataset() {
    const res = await fetch(DATASETS[datasetKey], { cache: 'no-store' });
    const raw = await res.json();

    data = raw.map(normalizeItem).filter(i => i.es && i.pt);
    nextSentence();
    updateUI();
  }

  function weightedRandom(items) {
    const pool = [];
    items.forEach(item => {
      const w = stats.weights[item.es] || 1;
      for (let i = 0; i < w; i++) pool.push(item);
    });
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function nextSentence() {
    const filtered = data.filter(d => d.level === stats.level);
    current = weightedRandom(filtered.length ? filtered : data);

    foreignText.textContent = current.es;
    translationText.textContent = current.pt;
    translationText.classList.add('hidden');
    feedback.textContent = '';
  }

  /* =======================
     TTS
  ======================= */

  function speak() {
    const u = new SpeechSynthesisUtterance(current.es);
    u.lang = 'es-ES';
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }

  /* =======================
     STT — SAFARI iOS REALMENTE FUNCIONAL
  ======================= */

  function listen() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SR) {
      feedback.textContent = 'Reconhecimento de voz não suportado.';
      return;
    }

    // 🔴 encerra instância anterior
    if (recognition) {
      recognition.stop();
      recognition = null;
    }

    // 🔴 mantém referência viva
    recognition = new SR();
    recognition.lang = 'es-ES';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      feedback.textContent = '🎙️ Ouvindo… fale agora';
    };

    recognition.onerror = e => {
      feedback.textContent = '⚠️ Erro no microfone: ' + e.error;
    };

    recognition.onresult = e => {
      const spoken = normalize(e.results[0][0].transcript);
      const target = normalize(current.es);

      const score = similarity(spoken, target);
      foreignText.innerHTML = highlightDifferences(target, spoken);

      if (score >= 0.75) {
        feedback.textContent = '✅ Boa pronúncia geral';
        stats.hits++;
      } else {
        feedback.textContent = '❌ Atenção às palavras destacadas';
        stats.errors++;
      }

      saveStats();
      updateUI();
    };

    recognition.onend = () => {
      recognition = null;
    };

    // ⚠️ chamada direta (gesto do usuário)
    recognition.start();
  }

  /* =======================
     UTILITÁRIOS
  ======================= */

  function normalize(text) {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zñ']/g, ' ')
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

  function toggleTranslation() {
    translationText.classList.toggle('hidden');
  }

  function toggleDataset() {
    datasetKey = datasetKey === 'frases' ? 'palavras' : 'frases';
    localStorage.setItem('dataset', datasetKey);
    loadDataset();
  }

  function resetProgress() {
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
