import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  lerNumero, dumDeDiaMes, calcDUM, calcUS, compararDUMUSG, calcBishop, calcApgar,
  classeIMC, ganhoRecomendado, lerAltura, calcIMC, BISHOP, APGAR,
} from '../js/nucleo/calculadoras.js';
import { addDias } from '../js/nucleo/datas.js';
import { htmlCalculadoras, acoes } from '../js/ui/calculadoras.js';

const HOJE = '2026-11-16';

test('lerNumero aceita vírgula e rejeita texto', () => {
  assert.equal(lerNumero('72,5'), 72.5);
  assert.equal(lerNumero(' 165 '), 165);
  assert.equal(lerNumero('abc'), null);
  assert.equal(lerNumero(''), null);
  assert.equal(lerNumero('-3'), null);
});

test('dumDeDiaMes: ano mais recente que não está no futuro; data inexistente = null', () => {
  assert.equal(dumDeDiaMes(3, 4, HOJE), '2026-04-03');
  assert.equal(dumDeDiaMes(20, 11, HOJE), '2025-11-20');
  assert.equal(dumDeDiaMes(16, 11, HOJE), '2026-11-16');
  assert.equal(dumDeDiaMes(30, 2, HOJE), null);
  assert.equal(dumDeDiaMes(31, 4, HOJE), null);
  assert.equal(dumDeDiaMes(29, 2, HOJE), '2024-02-29');
  assert.equal(dumDeDiaMes(0, 4, HOJE), null);
  assert.equal(dumDeDiaMes(3, 13, HOJE), null);
});

test('calcDUM: IG, DPP (DUM + 280 dias) e erros', () => {
  const r = calcDUM('2026-04-03', HOJE);
  assert.equal(r.dias, 227);
  assert.equal(r.ig, '32+3');
  assert.equal(r.rotulo, '32 sem 3 d');
  assert.equal(r.dpp, '2027-01-08');
  assert.match(calcDUM('2026-12-01', HOJE).erro, /futuro/);
  assert.match(calcDUM('2025-01-01', HOJE).erro, /44 semanas/);
  assert.equal(calcDUM(null, HOJE), null);
});

test('calcUS: IG hoje e DPP a partir do exame', () => {
  assert.equal(calcUS({ sem: '', dd: '', data: '' }, HOJE), null);
  const r = calcUS({ sem: '12', dd: '3', data: '' }, HOJE);
  assert.equal(r.dias, 87);
  assert.equal(r.ig, '12+3');
  assert.equal(r.dpp, addDias(HOJE, 280 - 87));
  const antigo = calcUS({ sem: '12', dd: '0', data: '2026-10-05' }, HOJE);
  assert.equal(antigo.dias, 84 + 42);
  assert.equal(antigo.dpp, addDias('2026-10-05', 280 - 84));
  assert.match(calcUS({ sem: '12', dd: '7', data: '' }, HOJE).erro, /Dias/);
  assert.match(calcUS({ sem: '3', dd: '0', data: '' }, HOJE).erro, /Semanas/);
  assert.match(calcUS({ sem: '12', dd: '0', data: '2026-12-01' }, HOJE).erro, /futuro/);
});

test('compararDUMUSG usa os limites de discrepância do app', () => {
  const us = calcUS({ sem: '10', dd: '0', data: '2026-11-01' }, HOJE);
  const dumIgual = addDias('2026-11-01', -70);
  assert.deepEqual(compararDUMUSG(dumIgual, us), { diferenca: 0, limite: 7, usarUSG: false });
  const dumDiferente = addDias('2026-11-01', -85);
  assert.equal(compararDUMUSG(dumDiferente, us).usarUSG, true);
  assert.equal(compararDUMUSG(null, us), null);
});

test('Bishop: soma, incompleto e leitura', () => {
  const vazio = calcBishop({});
  assert.equal(vazio.marcados, 0);
  assert.equal(vazio.completo, false);
  const todos = (v) => Object.fromEntries(BISHOP.map((c) => [c.id, c.opcoes[v][0]]));
  assert.equal(calcBishop(todos(0)).total, 0);
  assert.match(calcBishop(todos(0)).leitura, /desfavorável/);
  const maximo = Object.fromEntries(BISHOP.map((c) => [c.id, c.opcoes[c.opcoes.length - 1][0]]));
  assert.equal(calcBishop(maximo).total, 13);
  assert.match(calcBishop(maximo).leitura, /favorável/);
  assert.equal(calcBishop({ dil: 2, apag: 2, alt: 1, cons: 1, pos: 2 }).total, 8);
  assert.equal(calcBishop({ dil: 2, apag: 2, alt: 1, cons: 1, pos: 1 }).total, 7);
  assert.match(calcBishop({ dil: 2, apag: 2, alt: 1, cons: 1, pos: 1 }).leitura, /intermediário/);
  assert.equal(calcBishop({ dil: 9 }).marcados, 0);
});

test('Apgar: faixas 0–3, 4–6 e 7–10', () => {
  const todos = (v) => Object.fromEntries(APGAR.map((c) => [c.id, v]));
  assert.match(calcApgar(todos(2)).leitura, /Normal/);
  assert.equal(calcApgar(todos(2)).total, 10);
  assert.match(calcApgar({ fc: 1, resp: 1, tonus: 1, irrit: 1, cor: 1 }).leitura, /moderada/);
  assert.match(calcApgar(todos(0)).leitura, /grave/);
  assert.equal(calcApgar({ fc: 2 }).completo, false);
});

test('IMC: classes, altura em cm ou m, ganho de peso', () => {
  assert.equal(classeIMC(18.4), 'Baixo peso');
  assert.equal(classeIMC(24.9), 'Eutrófico');
  assert.equal(classeIMC(25), 'Sobrepeso');
  assert.equal(classeIMC(30), 'Obesidade grau I');
  assert.equal(classeIMC(35), 'Obesidade grau II');
  assert.equal(classeIMC(40), 'Obesidade grau III');
  assert.equal(lerAltura('165'), 165);
  assert.equal(lerAltura('1,65'), 165);
  assert.equal(lerAltura('50'), null);
  assert.deepEqual(ganhoRecomendado(17), { min: 12.5, max: 18 });
  assert.deepEqual(ganhoRecomendado(22), { min: 11.5, max: 16 });
  assert.deepEqual(ganhoRecomendado(27), { min: 7, max: 11.5 });
  assert.deepEqual(ganhoRecomendado(33), { min: 5, max: 9 });
  assert.equal(calcIMC({ peso: '', altura: '165' }), null);
  const r = calcIMC({ peso: '72,5', altura: '165', pesoPre: '63' });
  assert.equal(r.imc, 26.6);
  assert.equal(r.classe, 'Sobrepeso');
  assert.equal(r.pre.imc, 23.1);
  assert.equal(r.pre.classe, 'Eutrófico');
  assert.equal(r.pre.ganho, 9.5);
  assert.deepEqual(r.pre.recomendado, { min: 11.5, max: 16 });
  assert.equal(calcIMC({ peso: '72,5', altura: '1,65' }).imc, 26.6);
  assert.equal(calcIMC({ peso: '72,5', altura: '165' }).pre, undefined);
  assert.match(calcIMC({ peso: '5', altura: '165' }).erro, /Peso/);
});

// ---------- interface (sem DOM: elementos de mentira) ----------
function raizFalsa(valores = {}) {
  const res = { innerHTML: '' };
  const raiz = {
    dataset: { hoje: HOJE },
    innerHTML: '',
    querySelector: (sel) => {
      if (sel === '.calc-res') return res;
      const m = /name="(\w+)"/.exec(sel);
      return m ? { value: valores[m[1]] ?? '' } : null;
    },
  };
  return { raiz, res, el: (dataset = {}) => ({ dataset, closest: () => raiz }) };
}

test('abrir: monta a folha com abas, grade de dias e meses', () => {
  let html = '';
  acoes['calc-abrir'](null, null, { hoje: HOJE, abrirFolha: (h) => { html = h; } });
  assert.match(html, /class="calc"/);
  for (const aba of ['DUM', 'US', 'Bishop', 'Apgar', 'IMC']) assert.ok(html.includes(`>${aba}</button>`), aba);
  assert.equal((html.match(/data-act="calc-dia"/g) ?? []).length, 31);
  assert.equal((html.match(/data-act="calc-mes"/g) ?? []).length, 12);
  assert.match(html, /Toque no dia e no mês da DUM/);
  assert.match(html, /Nada que você digita aqui é guardado/);
});

test('DUM por toques: dia + mês mostram IG e DPP; tocar de novo desmarca', () => {
  htmlCalculadoras(HOJE);
  const { raiz, el } = raizFalsa();
  acoes['calc-dia'](null, el({ n: '3' }));
  assert.match(raiz.innerHTML, /Agora toque no mês/);
  acoes['calc-mes'](null, el({ n: '4' }));
  assert.match(raiz.innerHTML, /32 sem 3 d/);
  assert.match(raiz.innerHTML, /08\/01\/2027/);
  assert.match(raiz.innerHTML, /03\/04\/2026/);
  acoes['calc-dia'](null, el({ n: '31' }));
  assert.match(raiz.innerHTML, /não existe nesse mês/);
  acoes['calc-dia'](null, el({ n: '31' }));
  assert.match(raiz.innerHTML, /Agora toque no dia/);
});

test('troca de aba mostra o corpo certo e o resultado vazio', () => {
  htmlCalculadoras(HOJE);
  const { raiz, el } = raizFalsa();
  acoes['calc-aba'](null, el({ aba: 'imc' }));
  assert.match(raiz.innerHTML, /name="peso"/);
  assert.match(raiz.innerHTML, /Digite o peso e a altura/);
  acoes['calc-aba'](null, el({ aba: 'bishop' }));
  assert.equal((raiz.innerHTML.match(/data-act="calc-bishop"/g) ?? []).length, 4 + 4 + 4 + 3 + 3);
  acoes['calc-aba'](null, el({ aba: 'apgar' }));
  assert.equal((raiz.innerHTML.match(/data-act="calc-apgar"/g) ?? []).length, 15);
});

test('IMC digitado atualiza só o resultado, com ganho de peso', () => {
  htmlCalculadoras(HOJE);
  const { raiz, res, el } = raizFalsa({ peso: '72,5', altura: '165', pre: '63' });
  acoes['calc-aba'](null, el({ aba: 'imc' }));
  acoes['calc-imc'](null, el());
  assert.match(res.innerHTML, /26,6 · Sobrepeso/);
  assert.match(res.innerHTML, /23,1 · Eutrófico/);
  assert.match(res.innerHTML, /\+9,5 kg/);
  assert.match(res.innerHTML, /11,5 a 16,0 kg/);
  assert.match(raiz.innerHTML, /name="peso"/);
});

test('US digitado: IG pela USG e comparação com a DUM escolhida', () => {
  htmlCalculadoras(HOJE);
  const { res, el } = raizFalsa({ sem: '12', dd: '3', data: '' });
  acoes['calc-dia'](null, el({ n: '3' }));
  acoes['calc-mes'](null, el({ n: '4' }));
  acoes['calc-aba'](null, el({ aba: 'us' }));
  acoes['calc-us'](null, el());
  assert.match(res.innerHTML, /12 sem 3 d/);
  assert.match(res.innerHTML, /Diferença DUM × USG/);
});

test('Bishop e Apgar por toque somam e permitem desmarcar', () => {
  htmlCalculadoras(HOJE);
  const { raiz, el } = raizFalsa();
  acoes['calc-aba'](null, el({ aba: 'bishop' }));
  for (const [c, v] of [['dil', '2'], ['apag', '2'], ['alt', '1'], ['cons', '1'], ['pos', '2']]) acoes['calc-bishop'](null, el({ c, v }));
  assert.match(raiz.innerHTML, /<b>8<\/b>/);
  assert.match(raiz.innerHTML, /Colo favorável/);
  acoes['calc-bishop'](null, el({ c: 'pos', v: '2' }));
  assert.match(raiz.innerHTML, /4 de 5 critérios/);

  acoes['calc-aba'](null, el({ aba: 'apgar' }));
  for (const c of ['fc', 'resp', 'tonus', 'irrit', 'cor']) acoes['calc-apgar'](null, el({ c, v: '2' }));
  assert.match(raiz.innerHTML, /10 no 1º · — no 5º/);
  acoes['calc-min'](null, el({ n: '5' }));
  for (const c of ['fc', 'resp', 'tonus', 'irrit', 'cor']) acoes['calc-apgar'](null, el({ c, v: '1' }));
  assert.match(raiz.innerHTML, /10 no 1º · 5 no 5º/);
  assert.match(raiz.innerHTML, /Depressão moderada/);
});

test('abrir de novo zera o que foi digitado antes', () => {
  htmlCalculadoras(HOJE);
  const { el } = raizFalsa();
  acoes['calc-dia'](null, el({ n: '3' }));
  let html = '';
  acoes['calc-abrir'](null, null, { hoje: HOJE, abrirFolha: (h) => { html = h; } });
  assert.match(html, /Toque no dia e no mês da DUM/);
  assert.ok(!html.includes('aria-pressed="true" data-act="calc-dia"'));
});
