document.addEventListener('DOMContentLoaded', () => {

  /* =======================
     ESTADO
  ======================= */

  const ESTADO_PADRAO = {
    dataset: 'frases',
    acertos: 0,
    erros: 0,
    stats: {}
  };

  let estado = JSON.parse(localStorage.getItem('estadoTreinoES'))
    || JSON.parse(JSON.stringify(ESTADO_PADRAO));

  let frases = [];
  let atual = null;

  /* =======================
     DOM (DEFENSIVO)
  ======================= */

  const $ = id => document.getElementById(id);

  const fraseES = $('fraseES');
  const resposta = $('resposta');
  const resultado = $('resultado');
  const linha = $('linha');
  const nivel = $('nivel');

  const btnOuvir = $('ouvir');
  const btnConferir = $('conferir');
  const btnProxima = $('proxima');
  const btnReset = $('resetProgress');
  const btnToggle = $('toggleDataset');

  if (!fraseES || !resposta || !resultado) {
    console.error('❌ IDs do HTML não conferem com o JS');
    return;
  }

  /* =======================
     DATASET
  ======================= */

  async function carregarDataset() {
    const arquivo =
      estado.dataset === 'frases'
        ? 'data/frases.json'
        : 'data/palavras.json';

    try {
      const r = await fetch(arquivo);
      frases = await r.json();

      frases.forEach((f, i) => {
        if (!f.ID) f.ID = `${estado.dataset}_${i}`;
      });

      salvar();
      mostrarFrase(escolherProxima());

    } catch (e) {
      fraseES.textContent = 'Erro ao carregar dataset';
      console.error(e);
    }
  }

  /* =======================
     UTIL
  ======================= */

  function normalizar(t) {
    return t
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\sñ]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function similar(a, b) {
    if (!a || !b) return 0;
    const wa = a.split(' ');
    const wb = b.split(' ');
    let hits = 0;
    wa.forEach(w => wb.includes(w) && hits++);
    return hits / Math.max(wa.length, wb.length);
  }

  /* =======================
     FRASE
  ======================= */

  function mostrarFrase(f) {
    atual = f;
    fraseES.textContent = f.ES;
    resposta.value = '';
    resultado.textContent = '';
    if (linha) linha.textContent = frases.indexOf(f) + 1;
    if (nivel) nivel.textContent = f.CEFR || '-';
  }

  function escolherProxima() {
    const pesos = frases.map(f => (estado.stats[f.ID]?.erros || 0) + 1);
    const total = pesos.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;

    for (let i = 0; i < frases.length; i++) {
      if ((r -= pesos[i]) <= 0) return frases[i];
    }
    return frases[0];
  }

  /* =======================
     EVENTOS
  ======================= */

  btnOuvir?.addEventListener('click', () => {
    if (!atual) return;
    const u = new SpeechSynthesisUtterance(atual.ES);
    u.lang = 'es-ES';
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  });

  btnConferir?.addEventListener('click', () => {
    if (!atual) return;

    const rUser = normalizar(resposta.value);
    const rOk = normalizar(atual.PTBR);
    const score = similar(rUser, rOk);

    estado.stats[atual.ID] ??= { tentativas: 0, erros: 0 };
    estado.stats[atual.ID].tentativas++;

    if (score >= 0.6) {
      resultado.textContent = '✅ Correto!';
      estado.acertos++;
    } else {
      resultado.textContent = `❌ Correto: ${atual.PTBR}`;
      estado.erros++;
      estado.stats[atual.ID].erros++;
    }

    salvar();
  });

  btnProxima?.addEventListener('click', () => {
    mostrarFrase(escolherProxima());
  });

  btnReset?.addEventListener('click', () => {
    if (!confirm('Resetar progresso?')) return;
    localStorage.removeItem('estadoTreinoES');
    location.reload();
  });

  btnToggle?.addEventListener('click', () => {
    estado = JSON.parse(JSON.stringify(ESTADO_PADRAO));
    estado.dataset = estado.dataset === 'frases' ? 'palavras' : 'frases';
    salvar();
    carregarDataset();
  });

  /* =======================
     PERSISTÊNCIA
  ======================= */

  function salvar() {
    localStorage.setItem('estadoTreinoES', JSON.stringify(estado));
  }

  /* =======================
     START
  ======================= */

  carregarDataset();

});
