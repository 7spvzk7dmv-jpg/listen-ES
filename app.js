document.addEventListener('DOMContentLoaded', () => {

  /* =======================
     RESOLUÇÃO CORRETA DO PATH (GITHUB PAGES)
  ======================= */

  const BASE_PATH = window.location.pathname.replace(/\/[^/]*$/, '');

  console.log('BASE_PATH detectado:', BASE_PATH);

  const DATASETS = {
    frases: `${BASE_PATH}/data/frases.json`,
    palavras: `${BASE_PATH}/data/palavras.json`
  };

  /* =======================
     CONFIGURAÇÃO GERAL
  ======================= */

  const levels = ['A1', 'A2', 'B1', 'B2', 'C1'];

  let datasetKey = localStorage.getItem('dataset') || 'frases';
  let data = [];
  let current = null;

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
      const url = DATASETS[datasetKey];
      console.log('Carregando dataset:', url);

      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      data = await res.json();
      console.log('Dataset carregado com sucesso:', data.length, 'itens');

      if (!Array.isArray(data) || data.length === 0) {
        foreignText.textContent = 'Dataset vazio ou inválido.';
        return;
      }

      nextSentence();
      updateUI();
    } catch (e) {
      foreignText.textContent = 'Erro ao carregar dataset.';
      console.error('Falha ao carregar dataset:', e);
    }
  }

  function weightedRandom(items) {
    const pool = [];
    items.forEach(item => {
      const key = item.ES;
      const w = stats.weights[key] || 1;
      for (let i = 0; i < w; i++) pool.push(item);
    });
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function nextSentence() {
    if (!data.length) return;

    const filtered = data.filter(d => d.CEFR === stats.level);
    current = weightedRandom(filtered.length ? filtered : data);

    if (!current || !current.ES || !current.PTBR) {
      foreignText.textContent = 'Item inválido no dataset.';
      console.warn('Registro inválido:', current);
      return;
    }

    foreignText.textContent = current.ES;
    translationText.textContent = current.PTBR;
    translationText.classList.add('hidden');
    feedback.textContent = '';
  }

  /* =======================
     ÁUDIO (TTS)
  ======================= */

  function speak() {
    if (!current) return;

    const u = new SpeechSynthesisUtterance(current.ES);
    u.lang = 'es-ES';

    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }

  /* =======================
     PRONÚNCIA (STT)
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
     LISTEN — SAFARI / iOS OK
  ======================= */

  function listen() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      feedback.textContent = 'Reconhecimento de voz não suportado.';
      return;
    }

    const rec = new SpeechRecognition();
    rec.lang = 'es-ES';
    rec.continuous = false;
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      feedback.textContent = '🎙️ Ouvindo...';
    };

    rec.onerror = e => {
      feedback.textContent = '⚠️ Erro no microfone: ' + e.error;
    };

    rec.onresult = e => {
      const spokenRaw = e.results[0][0].transcript;
      const spoken = normalize(spokenRaw);
      const target = normalize(current.ES);

      const score = similarity(spoken, target);
      foreignText.innerHTML = highlightDifferences(target, spoken);

      if (score >= 0.75) {
        feedback.textContent = '✅ Boa pronúncia geral';
        stats.hits++;
        stats.weights[current.ES] =
          Math.max(1, (stats.weights[current.ES] || 1) - 1);
        adjustLevel(true);
      } else {
        feedback.textContent = '❌ Atenção às palavras destacadas';
        stats.errors++;
        stats.weights[current.ES] =
          (stats.weights[current.ES] || 1) + 2;
        adjustLevel(false);
      }

      saveStats();
      updateUI();
    };

    rec.onend = () => {
      if (feedback.textContent.includes('Ouvindo')) {
        feedback.textContent = '⚠️ Nenhuma fala detectada.';
      }
    };

    rec.start(); // chamada direta — obrigatória no Safari
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
