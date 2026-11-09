// Casca do app: estado em módulo, roteamento das abas, folha inferior, avisos e delegação de eventos.
import { hojeISO } from './nucleo/datas.js';
import { carregar, salvar, lerBruto, mudouFora, CHAVE } from './nucleo/estado.js';
import { contexto } from './nucleo/contexto.js';
import { definirDxCustom } from './nucleo/diagnosticos.js';
import { esc, atualizarContador, AVISO_FALHA_SALVAR } from './ui/util.js';
import * as censo from './ui/censo.js';
import * as telaHoje from './ui/hoje.js';
import * as plantao from './ui/plantao.js';
import * as protocolos from './ui/protocolos.js';
import * as dados from './ui/dados.js';
import * as programacao from './ui/programacao.js';
import * as paciente from './ui/paciente.js';
import * as formularios from './ui/formularios.js';

// Registro das telas. A página da paciente existe em TELAS mas fica fora da barra de abas.
const TELAS = { censo, hoje: telaHoje, programacao, paciente, plantao, protocolos, dados };

const ABAS = [
  ['censo', 'Censo'], ['hoje', 'Hoje'], ['programacao', 'Programação'],
  ['plantao', 'Plantão'], ['protocolos', 'Protocolos'], ['dados', 'Dados'],
];
const TEMAS = { auto: 'automático', light: 'claro', dark: 'escuro' };
const CHAVE_TEMA = 'ronda-tema';

let estado;
let ctx;
let hoje = hojeISO();
let aba = 'censo';
// Último texto que esta janela leu ou gravou; serve para detectar gravações de outra janela.
let ultimoJson = null;
// Leitura do armazenamento falhou: o app só mostra dados vazios e não grava (não apaga o que existe).
let somenteLeitura = false;

const $ = (sel) => document.querySelector(sel);
const raiz = $('#tela');
const folha = $('#folha');
const folhaCorpo = $('#folha-corpo');
const caixaAviso = $('#aviso');
let timerAviso = null;

function avisar(msg, fixo = false) {
  caixaAviso.textContent = msg;
  caixaAviso.hidden = false;
  clearTimeout(timerAviso);
  if (!fixo) timerAviso = setTimeout(() => { caixaAviso.hidden = true; }, 5000);
}

// Todo HTML recebido aqui foi montado pelos módulos de UI com textos escapados por esc().
function abrirFolha(html) {
  folhaCorpo.innerHTML = html;
  folha.hidden = false;
  document.body.classList.add('folha-aberta');
  const alvo = folhaCorpo.querySelector('[data-foco]')
    || folhaCorpo.querySelector('input:not([type=hidden]), select, textarea') || folhaCorpo.querySelector('button');
  alvo?.focus();
}

function fecharFolha() {
  folha.hidden = true;
  folhaCorpo.innerHTML = '';
  document.body.classList.remove('folha-aberta');
}

// Devolve true se gravou (ou não precisava gravar). Em falha, o aviso de erro fica na tela:
// quem chama só mostra aviso de sucesso quando recebe true.
// O novo estado só é adotado (e gravado) depois de calculado e desenhado sem erro;
// numa exceção, a tela volta ao estado anterior e nada é gravado.
function atualizar(mutacao, { gravar = true } = {}) {
  let novoEstado;
  let novoCtx;
  try {
    const novo = mutacao(estado);
    if (!novo) return false;
    novoCtx = contexto(novo);
    novoEstado = novo;
    render(novoEstado, novoCtx);
  } catch (e) {
    console.error(e);
    if (estado) { try { render(); } catch { /* mantém a tela como estava */ } }
    avisar('Não foi possível aplicar a alteração; nada foi gravado.');
    return false;
  }
  estado = novoEstado;
  ctx = novoCtx;
  if (gravar && somenteLeitura) {
    avisar('Não foi possível ler os dados deste aparelho; nada é gravado. Recarregue a página.', true);
    return false;
  }
  const ok = !gravar || salvar(estado);
  if (!ok) avisar(AVISO_FALHA_SALVAR);
  else if (gravar) ultimoJson = JSON.stringify(estado);
  return ok;
}

const api = {
  atualizar, abrirFolha, fecharFolha, avisar,
  get estado() { return estado; },
  get ctx() { return ctx; },
  get hoje() { return hoje; },
};

function render(est = estado, c = ctx) {
  definirDxCustom(est?.dxCustom ?? []);
  for (const b of document.querySelectorAll('.abas [data-aba]')) {
    if (b.dataset.aba === (aba === 'paciente' ? 'censo' : aba)) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  }
  $('#data-hoje').textContent = new Date(`${hoje}T12:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
  const tela = TELAS[aba];
  if (tela) tela.render(raiz, { estado: est, ctx: c, hoje });
  else {
    const rotulo = ABAS.find(([id]) => id === aba)?.[1] ?? aba;
    raiz.innerHTML = `<section class="em-construcao"><h1 class="titulo-aba">${esc(rotulo)}</h1><p>Em construção.</p></section>`;
  }
}

function irPara(nova) {
  if (nova !== 'paciente' && !ABAS.some(([id]) => id === nova)) return;
  aba = nova;
  history.replaceState(null, '', `#${aba}`);
  fecharFolha();
  render();
  window.scrollTo(0, 0);
}

function aplicarTema(t) {
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
  $('#botao-tema').textContent = `Tema: ${TEMAS[t] ?? TEMAS.auto}`;
}

function lerTema() {
  try { return localStorage.getItem(CHAVE_TEMA) || 'auto'; } catch { return 'auto'; }
}

const acoesGlobais = {
  aba: (ev, el) => irPara(el.dataset.aba),
  'fechar-folha': () => fecharFolha(),
  // Faixa do Censo, leito do Hoje ou da Programação: abre a página da paciente naquele leito.
  'abrir-paciente': (ev, el) => { paciente.focar(el.dataset.id); irPara('paciente'); },
  tema: () => {
    const ordem = ['auto', 'light', 'dark'];
    const prox = ordem[(ordem.indexOf(lerTema()) + 1) % ordem.length];
    try { localStorage.setItem(CHAVE_TEMA, prox); } catch { /* sem armazenamento: vale só nesta sessão */ }
    aplicarTema(prox);
  },
};

const acoesAtivas = () => ({ ...acoesGlobais, ...formularios.acoes, ...(TELAS[aba]?.acoes ?? {}) });

function despachar(nome, ev, el) {
  const fn = acoesAtivas()[nome];
  if (!fn) return;
  try { fn(ev, el, api); } catch (e) {
    console.error(e);
    avisar('Algo deu errado. Recarregue a página; os dados já salvos continuam no aparelho.');
  }
}

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]');
  if (el) despachar(el.dataset.act, ev, el);
});
document.addEventListener('input', (ev) => {
  if (ev.target.matches?.('[data-contador]')) atualizarContador(ev.target);
  const el = ev.target.closest('[data-input]');
  if (el) despachar(el.dataset.input, ev, el);
});
document.addEventListener('submit', (ev) => {
  const form = ev.target;
  if (!form.dataset.submit) return;
  ev.preventDefault();
  despachar(form.dataset.submit, ev, form);
});
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && !folha.hidden) fecharFolha();
});
// Outra janela/aba (ex.: app instalado + navegador) gravou: adota o que está guardado antes de
// qualquer gravação desta janela, para não sobrescrever dados mais novos com um estado velho.
function sincronizarComArmazenamento() {
  if (somenteLeitura) return;
  const guardado = lerBruto();
  if (!mudouFora(guardado, ultimoJson)) return;
  const c = carregar();
  if (c.leituraFalhou || c.aviso) return;
  if (atualizar(() => c.estado, { gravar: false })) {
    ultimoJson = guardado;
    avisar('Dados atualizados em outra janela do app.');
  }
}

window.addEventListener('storage', (ev) => {
  if (ev.key === null || ev.key === CHAVE) sincronizarComArmazenamento();
});

// App aberto de um dia para o outro: recalcula "hoje" (IG, pendências por IG, atrasos).
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  sincronizarComArmazenamento();
  const agora = hojeISO();
  if (agora !== hoje) { hoje = agora; atualizar((e) => e); }
});

// Partida
$('#abas').innerHTML = ABAS.map(([id, rot]) => `<button type="button" data-act="aba" data-aba="${id}">${esc(rot)}</button>`).join('');
aplicarTema(lerTema());
const inicial = location.hash.slice(1);
if (ABAS.some(([id]) => id === inicial)) aba = inicial;
const carregado = carregar();
estado = carregado.estado;
// Com dados corrompidos, não grava na partida: o texto original só é sobrescrito numa alteração da usuária.
somenteLeitura = !!carregado.leituraFalhou;
atualizar((e) => e, { gravar: !carregado.aviso });
ultimoJson = lerBruto();
if (carregado.aviso) avisar(carregado.aviso, somenteLeitura);
