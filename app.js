/* =======================
   ESTADO GLOBAL
======================= */

let frases = [];

const ESTADO_PADRAO = {
  dataset: 'frases',
  acertos: 0,
  erros: 0,
  stats: {} // chave: ID da frase
};

let estado = JSON.parse(localStorage.getItem('estadoTreinoES')) || structuredClone(ESTADO_PADRAO);

/* =======================
   ELEMENTOS DO DOM
======================= */

const fraseES = document.getElementById('fraseES');
const resposta = document.getElementById('resposta');
const resultado = document.getElementById('resultado');
const linha = document.getElementById('linha');
const nivel = document.getElementById('nivel');

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

    // garante ID estável
    frases.forEach((f, i) => {
      if (!f.ID) f.ID = `${estado.dataset}_${i}`;
    });

    salvar();
    mostrarFrase(escolherProxima());
    atualizarGrafico();
  } catch (e) {
    fraseES.textContent = 'Erro ao carregar dataset.';
    console.error(e);
  }
}

carregarDataset();

/* =======================
   UTILITÁRIOS
======================= */

function normalizar(txt) {
  return txt
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
  wa.forEach(w => {
    if (wb.includes(w)) hits++;
  });

  return hits / Math.max(wa.length, wb.length);
}

/* =======================
   FRASE ATUAL
======================= */

let atual = null;

function mostrarFrase(frase) {
  atual = frase;
  fraseES.textContent = frase.ES;
  linha.textContent = frases.indexOf(frase) + 1;
  nivel.textContent = frase.CEFR || '-';
  resposta.value = '';
  resultado.textContent = '';
}

/* =======================
   ÁUDIO
======================= */

document.getElementById('ouvir').onclick = () => {
  if (!atual) return;
  const u = new SpeechSynthesisUtterance(atual.ES);
  u.lang = 'es-ES';
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
};

/* =======================
   CONFERÊNCIA
======================= */

document.getElementById('conferir').onclick = () => {
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
    resultado.textContent = `❌ Correto seria: ${atual.PTBR}`;
    estado.erros++;
    estado.stats[atual.ID].erros++;
  }

  salvar();
  atualizarGrafico();
};

/* =======================
   SELEÇÃO PONDERADA
======================= */

function escolherProxima() {
  const pesos = frases.map(f => {
    const e = estado.stats[f.ID]?.erros || 0;
    return e + 1;
  });

  const total = pesos.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;

  for (let i = 0; i < frases.length; i++) {
    if ((r -= pesos[i]) <= 0) return frases[i];
  }

  return frases[0];
}

document.getElementById('proxima').onclick = () => {
  mostrarFrase(escolherProxima());
};

/* =======================
   PERSISTÊNCIA
======================= */

function salvar() {
  localStorage.setItem('estadoTreinoES', JSON.stringify(estado));
}

/* =======================
   RESET / DATASET
======================= */

document.getElementById('resetProgress').onclick = () => {
  if (!confirm('Resetar todo o progresso?')) return;
  localStorage.removeItem('estadoTreinoES');
  location.reload();
};

document.getElementById('toggleDataset').onclick = () => {
  estado = structuredClone(ESTADO_PADRAO);
  estado.dataset = estado.dataset === 'frases' ? 'palavras' : 'frases';
  salvar();
  carregarDataset();
};

/* =======================
   GRÁFICO
======================= */

let chart;

function atualizarGrafico() {
  const ctx = document.getElementById('grafico');
  if (!ctx) return;

  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Acertos', 'Erros'],
      datasets: [
        {
          data: [estado.acertos, estado.erros]
        }
      ]
    }
  });
}
