// Calculadoras (DUM, US, Bishop, Apgar, IMC): folha aberta pelo botão do topo.
// Estilo "toque e veja": botões grandes e o resultado fixo embaixo. Nada é gravado no estado do app.
import { esc } from './util.js';
import {
  MESES, dumDeDiaMes, calcDUM, calcUS, compararDUMUSG, BISHOP, calcBishop, APGAR, calcApgar, calcIMC, dmy,
} from '../nucleo/calculadoras.js';

const ABAS = [['dum', 'DUM'], ['us', 'US'], ['bishop', 'Bishop'], ['apgar', 'Apgar'], ['imc', 'IMC']];

const novoEstadoCalc = () => ({
  aba: 'dum', dia: null, mes: null,
  us: { sem: '', dd: '', data: '' },
  bishop: {}, apgar: { min: 1, 1: {}, 5: {} },
  imc: { peso: '', altura: '', pre: '' },
});
let S = novoEstadoCalc();

const fmt1 = (n) => n.toFixed(1).replace('.', ',');
const dica = (t) => `<p class="calc-dica">${esc(t)}</p>`;
const erro = (t) => `<p class="calc-erro" role="alert">${esc(t)}</p>`;
const linha = (rot, val) => `<div class="calc-linha"><span>${esc(rot)}</span><b>${esc(val)}</b></div>`;

// ---------- corpo de cada aba ----------
function corpoDUM() {
  const dias = Array.from({ length: 31 }, (_, i) => i + 1).map((n) =>
    `<button type="button" class="calc-bt" data-act="calc-dia" data-n="${n}" aria-pressed="${S.dia === n}">${n}</button>`).join('');
  const meses = MESES.map((m, i) =>
    `<button type="button" class="calc-bt" data-act="calc-mes" data-n="${i + 1}" aria-pressed="${S.mes === i + 1}">${esc(m)}</button>`).join('');
  return `<h3 class="calc-sub">Dia da última menstruação</h3><div class="calc-grade">${dias}</div>
    <h3 class="calc-sub">Mês</h3><div class="calc-grade calc-grade-mes">${meses}</div>`;
}

function corpoUS() {
  return `<p class="nota">Idade gestacional que o exame informou, e a data em que foi feito.</p>
    <div class="linha2">
      <label class="campo">Semanas<input name="sem" inputmode="numeric" autocomplete="off" value="${esc(S.us.sem)}" data-input="calc-us" placeholder="ex.: 12"></label>
      <label class="campo">Dias (0–6)<input name="dd" inputmode="numeric" autocomplete="off" value="${esc(S.us.dd)}" data-input="calc-us" placeholder="0"></label>
    </div>
    <label class="campo">Data do exame (vazio = hoje)<input name="data" type="date" value="${esc(S.us.data)}" data-input="calc-us"></label>`;
}

function opcoes(criterios, sel, acao) {
  return criterios.map((c) => `<fieldset class="calc-crit"><legend>${esc(c.nome)}</legend><div class="calc-ops">${
    c.opcoes.map(([p, txt]) =>
      `<button type="button" class="calc-op" data-act="${acao}" data-c="${c.id}" data-v="${p}" aria-pressed="${sel[c.id] === p}"><b>${p}</b> ${esc(txt)}</button>`).join('')
  }</div></fieldset>`).join('');
}

function corpoBishop() { return opcoes(BISHOP, S.bishop, 'calc-bishop'); }

function corpoApgar() {
  const min = S.apgar.min;
  const sw = [1, 5].map((m) => `<button type="button" class="calc-bt calc-min" data-act="calc-min" data-n="${m}" aria-pressed="${min === m}">${m}º minuto</button>`).join('');
  return `<div class="calc-minutos">${sw}</div>${opcoes(APGAR, S.apgar[min], 'calc-apgar')}`;
}

function corpoIMC() {
  return `<div class="linha2">
      <label class="campo">Peso atual (kg)<input name="peso" inputmode="decimal" autocomplete="off" value="${esc(S.imc.peso)}" data-input="calc-imc" placeholder="ex.: 72,5"></label>
      <label class="campo">Altura (cm)<input name="altura" inputmode="decimal" autocomplete="off" value="${esc(S.imc.altura)}" data-input="calc-imc" placeholder="ex.: 165"></label>
    </div>
    <label class="campo">Peso antes da gestação (kg) — opcional<input name="pre" inputmode="decimal" autocomplete="off" value="${esc(S.imc.pre)}" data-input="calc-imc" placeholder="para ver o ganho de peso"></label>`;
}

// ---------- resultado fixo ----------
function resultadoDUM(hoje) {
  if (S.dia === null && S.mes === null) return dica('Toque no dia e no mês da DUM.');
  if (S.dia === null) return dica('Agora toque no dia.');
  if (S.mes === null) return dica('Agora toque no mês.');
  const dum = dumDeDiaMes(S.dia, S.mes, hoje);
  if (!dum) return erro('Essa data não existe nesse mês.');
  const r = calcDUM(dum, hoje);
  if (r.erro) return erro(r.erro);
  return `${linha('IG pela DUM', r.rotulo)}${linha('DPP', dmy(r.dpp))}<p class="nota">DUM considerada: ${esc(dmy(r.dum))}</p>`;
}

function resultadoUS(hoje) {
  const r = calcUS(S.us, hoje);
  if (!r) return dica('Digite as semanas (e os dias) do exame.');
  if (r.erro) return erro(r.erro);
  let extra = '';
  const dum = S.dia !== null && S.mes !== null ? dumDeDiaMes(S.dia, S.mes, hoje) : null;
  const c = compararDUMUSG(dum, r);
  if (c) {
    extra = `<p class="nota">Diferença DUM × USG: ${c.diferenca} dia(s); limite ${c.limite}. ${c.usarUSG ? 'Acima do limite: datar pela USG.' : 'Dentro do limite: manter a DUM.'}</p>`;
  }
  return `${linha('IG pela USG, hoje', r.rotulo)}${linha('DPP', dmy(r.dpp))}${extra}`;
}

function resultadoSoma(r, quando) {
  if (r.marcados === 0) return dica('Toque em uma opção de cada critério.');
  const nota = r.completo ? esc(r.leitura) : `${r.marcados} de ${quando} critérios marcados`;
  return `${linha('Total', String(r.total))}<p class="nota">${nota}</p>`;
}

function resultadoApgar() {
  const a1 = calcApgar(S.apgar[1]);
  const a5 = calcApgar(S.apgar[5]);
  const atual = S.apgar.min === 1 ? a1 : a5;
  const resumo = `${a1.marcados ? a1.total : '—'} no 1º · ${a5.marcados ? a5.total : '—'} no 5º`;
  if (atual.marcados === 0 && !a1.marcados && !a5.marcados) return dica('Toque em uma opção de cada critério.');
  const nota = atual.completo ? `${S.apgar.min}º minuto: ${esc(atual.leitura)}` : `${S.apgar.min}º minuto: ${atual.marcados} de 5 critérios marcados`;
  return `${linha('Apgar', resumo)}<p class="nota">${nota}</p>`;
}

function resultadoIMC() {
  const r = calcIMC({ peso: S.imc.peso, altura: S.imc.altura, pesoPre: S.imc.pre });
  if (!r) return dica('Digite o peso e a altura.');
  if (r.erro) return erro(r.erro);
  let extra = '';
  if (r.pre) {
    const g = r.pre.ganho;
    extra = `${linha('IMC antes da gestação', `${fmt1(r.pre.imc)} · ${r.pre.classe}`)}
      ${linha('Ganho até agora', `${g > 0 ? '+' : ''}${fmt1(g)} kg`)}
      <p class="nota">Ganho total recomendado (IOM 2009, gestação única): ${fmt1(r.pre.recomendado.min)} a ${fmt1(r.pre.recomendado.max)} kg. Não avalia o ganho por semana de gestação.</p>`;
  }
  return `${linha('IMC', `${fmt1(r.imc)} · ${r.classe}`)}${extra}`;
}

const RESULTADO = {
  dum: (h) => resultadoDUM(h),
  us: (h) => resultadoUS(h),
  bishop: () => resultadoSoma(calcBishop(S.bishop), 5),
  apgar: () => resultadoApgar(),
  imc: () => resultadoIMC(),
};
const CORPO = { dum: corpoDUM, us: corpoUS, bishop: corpoBishop, apgar: corpoApgar, imc: corpoIMC };

function interior(hoje) {
  const abas = ABAS.map(([id, rot]) =>
    `<button type="button" class="calc-aba" data-act="calc-aba" data-aba="${id}" aria-pressed="${S.aba === id}">${esc(rot)}</button>`).join('');
  return `<div class="calc-cab"><h2>Calculadoras</h2><button type="button" class="sec mini" data-act="fechar-folha">Fechar</button></div>
    <div class="calc-abas" role="group" aria-label="Calculadoras">${abas}</div>
    <div class="calc-corpo">${CORPO[S.aba]()}</div>
    <div class="calc-res" aria-live="polite">${RESULTADO[S.aba](hoje)}</div>
    <p class="nota calc-rodape">Nada que você digita aqui é guardado. Apoio ao raciocínio: confirme com o protocolo do serviço.</p>`;
}

export function htmlCalculadoras(hoje, novo = true) {
  if (novo) S = novoEstadoCalc();
  return `<div class="calc" data-hoje="${esc(hoje)}">${interior(hoje)}</div>`;
}

// ---------- ações ----------
const raizDe = (el) => el.closest('.calc');
function redesenhar(el) {
  const raiz = raizDe(el);
  raiz.innerHTML = interior(raiz.dataset.hoje);
}
function so_resultado(el) {
  const raiz = raizDe(el);
  raiz.querySelector('.calc-res').innerHTML = RESULTADO[S.aba](raiz.dataset.hoje);
}
const campo = (raiz, nome) => raiz.querySelector(`[name="${nome}"]`)?.value ?? '';
const alterna = (atual, n) => (atual === n ? null : n);

export const acoes = {
  'calc-abrir': (ev, el, api) => api.abrirFolha(htmlCalculadoras(api.hoje)),
  'calc-aba': (ev, el) => { S.aba = el.dataset.aba; redesenhar(el); },
  'calc-dia': (ev, el) => { S.dia = alterna(S.dia, Number(el.dataset.n)); redesenhar(el); },
  'calc-mes': (ev, el) => { S.mes = alterna(S.mes, Number(el.dataset.n)); redesenhar(el); },
  'calc-min': (ev, el) => { S.apgar.min = Number(el.dataset.n) === 5 ? 5 : 1; redesenhar(el); },
  'calc-bishop': (ev, el) => {
    const v = Number(el.dataset.v);
    S.bishop[el.dataset.c] = S.bishop[el.dataset.c] === v ? undefined : v;
    redesenhar(el);
  },
  'calc-apgar': (ev, el) => {
    const alvo = S.apgar[S.apgar.min];
    const v = Number(el.dataset.v);
    alvo[el.dataset.c] = alvo[el.dataset.c] === v ? undefined : v;
    redesenhar(el);
  },
  'calc-us': (ev, el) => {
    const raiz = raizDe(el);
    S.us = { sem: campo(raiz, 'sem'), dd: campo(raiz, 'dd'), data: campo(raiz, 'data') };
    so_resultado(el);
  },
  'calc-imc': (ev, el) => {
    const raiz = raizDe(el);
    S.imc = { peso: campo(raiz, 'peso'), altura: campo(raiz, 'altura'), pre: campo(raiz, 'pre') };
    so_resultado(el);
  },
};
