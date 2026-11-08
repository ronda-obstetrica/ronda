// Aba Visita: uma tela por leito, deslizando para o próximo (scroll-snap), só o que importa à beira do leito.
// As ações (modificador, alerta, pendência, registrar valor) são as mesmas do Censo, pelos mesmos data-act.
// HTML puro no topo; o DOM só é tocado dentro de render() e das ações (importável no Node).
import { esc } from './util.js';
import { htmlDiagnosticos, htmlAlertas, htmlPendencias, htmlRegistrosHoje, medidasDoPac } from './cartao.js';
import { acoes as acoesCenso } from './censo.js';
import { resumoPaciente } from '../relatorios/comum.js';
import { ordenarPacientes } from '../nucleo/estado.js';
import { progressoTratamento } from '../nucleo/pendencias.js';
import { mudancasDesde, baseComparacao, instantaneo } from '../nucleo/mudancas.js';

// Leito em vista: sobrevive aos redesenhos depois de cada ação. Guardado pelo id da paciente.
let atualId = null;
let atualIndice = 0;

// Abrir a visita a partir de um cartão do Censo começa naquele leito.
export function focar(id) { atualId = id ?? null; }

// Índice do leito em vista; se a paciente sumiu (alta), fica na mesma posição.
export function indiceAtual(pacs, id = atualId, anterior = atualIndice) {
  const i = pacs.findIndex((p) => p.id === id);
  if (i >= 0) return i;
  return Math.max(0, Math.min(anterior, pacs.length - 1));
}

function htmlCabecalho(pac, r) {
  const ig = r.ig === 'IG não informada' ? '<span class="v-ig ig-nada">IG não informada</span>' : `<span class="v-ig">${esc(r.ig)} sem</span>`;
  return `<header class="v-cab">
    <h2 class="v-leito">Leito ${esc(pac.leito)}</h2>
    ${ig}
    ${r.dia != null ? `<span class="v-dia">D${esc(r.dia)}</span>` : ''}
    ${pac.ex ? '<span class="etq-ex">exemplo</span>' : ''}
  </header>
  ${r.alerg ? `<p class="alergia"><strong>⚠ Alergia:</strong> ${esc(r.alerg)}</p>` : ''}`;
}

function htmlMudou(frases) {
  if (!frases?.length) return '';
  return `<section class="bloco mudou"><h3>Mudou desde o último plantão</h3>
    <ul class="mudou-lista">${frases.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></section>`;
}

// Um campo grande por medida: glicemias com teclado numérico; PA num campo só, no formato 150x95.
function htmlControlesVisita(pac, hoje, ctx) {
  const medidas = medidasDoPac(pac);
  if (!medidas.length) return '';
  const linhas = medidas.map((m) => {
    const pa = m.id === 'pa';
    const idCampo = `v-${esc(pac.id)}-${esc(m.id)}`;
    return `<form class="v-controle" data-submit="registrar-valor" data-id="${esc(pac.id)}">
      <input type="hidden" name="medida" value="${esc(m.id)}">
      <label for="${idCampo}">${esc(m.nome)}</label>
      <input id="${idCampo}" name="valor" autocomplete="off" enterkeyhint="done"
        inputmode="${pa ? 'text' : 'numeric'}" placeholder="${pa ? '150x95' : '95'}"${pa ? ` aria-describedby="v-dica-pa-${esc(pac.id)}"` : ''}>
      <button type="submit" class="sec">Registrar</button>
    </form>`;
  }).join('');
  const dicaPa = medidas.some((m) => m.id === 'pa') ? `<p class="nota" id="v-dica-pa-${esc(pac.id)}">PA no formato 150x95.</p>` : '';
  return `<section class="bloco"><h3>Controles de hoje</h3>
    ${htmlRegistrosHoje(pac, hoje, ctx)}
    <div class="v-controles">${linhas}</div>${dicaPa}
  </section>`;
}

function htmlTratamentos(pac, agora) {
  const itens = pac.pend.filter((p) => !p.done && p.dur).map((p) => {
    const prog = progressoTratamento(p, agora);
    return `<li>${esc(p.texto)}${prog ? ` <span class="prog">${esc(prog.texto)}</span>` : ''}</li>`;
  }).join('');
  return itens ? `<section class="bloco"><h3>Tratamentos</h3><ul class="v-trat">${itens}</ul></section>` : '';
}

export function htmlLeitoVisita(pac, { hoje, ctx, agora, frases, n, total }) {
  const r = resumoPaciente(pac, hoje, ctx, agora);
  return `<section class="v-leito-tela" id="visita-${esc(pac.id)}" data-id="${esc(pac.id)}" aria-label="Leito ${esc(pac.leito)}, ${n} de ${total}">
    <div class="cartao v-cartao">
      ${htmlCabecalho(pac, r)}
      ${htmlMudou(frases)}
      ${htmlAlertas(pac, r.alertas)}
      ${htmlControlesVisita(pac, hoje, ctx)}
      ${htmlPendencias(pac, hoje, agora)}
      ${htmlTratamentos(pac, agora)}
      <section class="bloco"><h3>Diagnósticos</h3>${htmlDiagnosticos(pac)}</section>
    </div>
  </section>`;
}

// Frases do "o que mudou" por paciente; vazio quando ainda não há plantão de comparação.
export function mudancasDaVisita(estado, hoje, ctx) {
  const base = baseComparacao(estado, hoje);
  if (!base) return {};
  return mudancasDesde(base, instantaneo(estado, hoje, ctx), estado, hoje, ctx);
}

export function htmlVisita({ estado, ctx, hoje }, { id = atualId, agora = new Date() } = {}) {
  const pacs = ordenarPacientes(estado.pac);
  if (!pacs.length) {
    return `<h1 class="titulo-aba">Visita</h1>
      <p class="vazio">Nenhuma paciente. Cadastre os leitos para começar a visita.</p>
      <button type="button" class="primario" data-act="novo">+ Paciente</button>`;
  }
  const i = indiceAtual(pacs, id);
  const mud = mudancasDaVisita(estado, hoje, ctx);
  const total = pacs.length;
  const telas = pacs.map((p, k) => htmlLeitoVisita(p, { hoje, ctx, agora, frases: mud[p.id], n: k + 1, total })).join('');
  return `<div class="visita">
    <div class="v-barra">
      <button type="button" class="sec" data-act="visita-ir" data-dir="-1" aria-label="Leito anterior">‹</button>
      <span class="v-indicador" aria-live="polite">${i + 1} de ${total}</span>
      <button type="button" class="sec" data-act="visita-ir" data-dir="1" aria-label="Próximo leito">›</button>
    </div>
    <div class="v-trilho" tabindex="-1">${telas}</div>
  </div>`;
}

// ---------- Navegador ----------

function indiceDoTrilho(trilho) {
  return trilho.clientWidth ? Math.round(trilho.scrollLeft / trilho.clientWidth) : 0;
}

function marcarAtual(trilho, i) {
  const telas = trilho.querySelectorAll('.v-leito-tela');
  const tela = telas[i];
  if (!tela) return;
  atualIndice = i;
  atualId = tela.dataset.id;
  const ind = trilho.closest('.visita')?.querySelector('.v-indicador');
  const txt = `${i + 1} de ${telas.length}`;
  if (ind && ind.textContent !== txt) ind.textContent = txt;
}

export function render(raiz, dados) {
  const pacs = ordenarPacientes(dados.estado.pac);
  const i = pacs.length ? indiceAtual(pacs) : 0;
  if (pacs.length) { atualIndice = i; atualId = pacs[i].id; }
  raiz.innerHTML = htmlVisita(dados, { id: atualId });
  const trilho = raiz.querySelector('.v-trilho');
  if (!trilho) return;
  // Volta ao leito em vista sem animação (depois de uma ação o HTML é trocado inteiro).
  const alvo = trilho.children[i];
  if (alvo) trilho.scrollLeft = alvo.offsetLeft;
  let pendente = false;
  trilho.addEventListener('scroll', () => {
    if (pendente) return;
    pendente = true;
    requestAnimationFrame(() => { pendente = false; marcarAtual(trilho, indiceDoTrilho(trilho)); });
  }, { passive: true });
}

const reduzMovimento = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export const acoes = {
  ...acoesCenso,
  'visita-ir': (ev, el) => {
    const trilho = el.closest('.visita')?.querySelector('.v-trilho');
    if (!trilho) return;
    const total = trilho.children.length;
    const i = Math.max(0, Math.min(total - 1, indiceDoTrilho(trilho) + Number(el.dataset.dir)));
    trilho.scrollTo({ left: trilho.children[i].offsetLeft, behavior: reduzMovimento() ? 'auto' : 'smooth' });
    marcarAtual(trilho, i);
  },
};
