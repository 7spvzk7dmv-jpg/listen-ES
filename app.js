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
     NORMALIZAÇÃO DO ITEM
  ======================= */

  function normalizeItem(item) {
    return {
      es: item.ES || item.ESP || item.SPANISH || '',
      pt: item.PTBR || item.PT || item.PORTUGUESE || '',
      level: item.CEFR || item.LEVEL || 'A1'
    };
  }

  /* =======================
     DATASET
  ======================= */

  async function loadDataset() {
    try {
      const res = await fetch(DATASETS[datasetKey], { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const raw = await res.json();

      data = raw
        .map(normalizeItem)
        .filter(i => i.es && i.pt);

      if (!data.length) {
        foreignText.textContent = 'Dataset carregado, mas sem itens válidos.';
        console.error('Itens originais:', raw);
        return;
      }

      nextSentence();
      updateUI();
    } catch (e) {
      foreignText.textContent = 'Erro ao carregar dataset.';
      console.error(e);
    }
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
     ÁUDIO (TTS)
  ======================= */

  function speak() {
    if (!current) return;
    const u = new SpeechSynthesisUtterance(current.es);
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

  function listen() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    const rec = new SR();
    rec.lang = 'es-ES';

    rec.onresult = e => {
      const spoken = normalize(e.results[0][0].transcript);
      const target = normalize(current.es);

      const score = similarity(spoken, target);
      foreignText.innerHTML = highlightDifferences(target, spoken);

      if (score >= 0.75) {
        feedback.textContent = '✅ Boa pronúncia';
        stats.hits++;
      } else {
        feedback.textContent = '❌ Ajuste a pronúncia';
        stats.errors++;
      }

      saveStats();
      updateUI();
    };

    rec.start();
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
