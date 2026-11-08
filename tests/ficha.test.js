import { test } from 'node:test';
import assert from 'node:assert/strict';
import { htmlFichas, FONTES_RODAPE } from '../js/relatorios/ficha.js';
import { novoEstado, novaPaciente, seedExemplos } from '../js/nucleo/estado.js';
import { novaPendencia } from '../js/nucleo/pendencias.js';
import { contexto } from '../js/nucleo/contexto.js';

const HOJE = '2026-11-04';
const AGORA = new Date(2026, 10, 4, 7, 5);
const mk = (pac, extra = {}) => ({ ...novoEstado(), pac, ...extra });
const gerar = (e, o = {}) => htmlFichas(e, HOJE, contexto(e), { agora: AGORA, ...o });
const nFichas = (h) => (h.match(/class="ficha"/g) ?? []).length;

test('seed: 3 fichas na ordem 04, 07, 09', () => {
  const h = gerar(mk(seedExemplos(HOJE)));
  assert.equal(nFichas(h), 3);
  const ls = [...h.matchAll(/LEITO (\d+)/g)].map((m) => m[1]);
  assert.deepEqual(ls, ['04', '07', '09']);
});
test('prefixos, alergia em negrito, rodapé e hora', () => {
  const h = gerar(mk(seedExemplos(HOJE)));
  assert.ok(h.includes('AGIR:') && h.includes('FEITO:'));
  assert.match(h, /<b>Alergia:/);
  assert.ok(h.includes('Sem identificação de paciente (LGPD).'));
  for (const f of FONTES_RODAPE) assert.ok(h.includes(f));
  assert.ok(h.includes('gerado 07:05') && h.includes('04/11/2026'));
  assert.ok(!h.includes('Regras do serviço'));
});
test('pacIds limita a uma ficha', () => {
  const pac = seedExemplos(HOJE);
  const h = gerar(mk(pac), { pacIds: [pac.find((p) => p.leito === '07').id] });
  assert.equal(nFichas(h), 1);
  assert.ok(h.includes('LEITO 07') && !h.includes('LEITO 04'));
});
test('escapa textos da usuária', () => {
  const p = novaPaciente({ id: 'x', leito: '01', int: '2026-11-01', igDays: 200, igRef: HOJE, alerg: '<i>&dipirona', dxs: [{ dx: 'dmg', mods: {} }],
    pend: [novaPendencia({ id: 'a', texto: '<b>x</b> & y', due: HOJE })] });
  const h = gerar(mk([p]));
  assert.ok(h.includes('&lt;i&gt;&amp;dipirona') && h.includes('&lt;b&gt;x&lt;/b&gt; &amp; y'));
  assert.ok(!h.includes('<i>'));
});
test('atrasadas, ☐, +N anteriores e Regras do serviço', () => {
  const pend = [
    novaPendencia({ id: 'at', texto: 'Atrasada', due: '2026-11-01' }),
    ...Array.from({ length: 7 }, (_, i) => novaPendencia({ id: 'f' + i, texto: 'Item' + i, done: true, doneAt: `2026-11-0${i + 1}`, res: 'ok' })),
  ];
  const p = novaPaciente({ id: 'x', leito: '01', int: '2026-10-30', igDays: 200, igRef: HOJE, pend });
  const h = gerar(mk([p], { regrasServico: '' }));
  assert.ok(h.includes('+2 anteriores') && h.includes('☐'));
  assert.ok(h.indexOf('Item6') < h.indexOf('Item2') && !h.includes('Item1'));
});
test('atrasada leva ATRASADO Nd; regra do serviço aparece no rodapé', () => {
  const p = novaPaciente({ id: 'x', leito: '01', int: '2026-10-30', igDays: 200, igRef: HOJE, pend: [novaPendencia({ id: 'at', texto: 'Atr', due: '2026-11-01' })] });
  assert.ok(gerar(mk([p])).includes('ATRASADO 3d'));
  const e = mk([p], { regrasServico: 'res-colestase | colestase!ab100 | 37+0 | 37+6 | vermelho | HU-X | HU-X 2025' });
  assert.ok(gerar(e).includes('Regras do serviço'));
});
test('datas de backup malicioso são escapadas', () => {
  const xss = '2026-<&-<&';
  const p = novaPaciente({ id: 'x', leito: '01', int: '2026-10-30', igDays: 200, igRef: HOJE, alertasFeitos: [{ id: 'corticoide', data: xss, res: '' }],
    pend: [novaPendencia({ id: 'a', texto: 'Ex', cat: 'Exame', due: HOJE, estadoExame: 'aguardando', aguardandoDesde: xss })] });
  const h = gerar(mk([p]));
  assert.ok(!h.includes('<&'));
  assert.ok(h.includes('&lt;&amp;'));
});
