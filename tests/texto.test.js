import { test } from 'node:test'; import assert from 'node:assert/strict';
import { textoPlantao } from '../js/relatorios/texto.js';
import { resumoPaciente, linhaDoTempo } from '../js/relatorios/comum.js';
import { novoEstado, novaPaciente, seedExemplos } from '../js/nucleo/estado.js';
import { novaPendencia } from '../js/nucleo/pendencias.js';
import { contexto } from '../js/nucleo/contexto.js';

const HOJE = '2026-11-04';
const mkEst = (pac) => ({ ...novoEstado(), pac });
const gerar = (e) => textoPlantao(e, HOJE, contexto(e));
const blocos = (t) => t.split('\n\n').slice(1);

test('cabeçalho exato e ordem dos blocos', () => {
  const t = gerar(mkEst(seedExemplos(HOJE)));
  assert.ok(t.startsWith('PASSAGEM DE PLANTÃO — Enfermaria de alto risco — 04/11/2026\n(sem identificação de pacientes)\n\nLEITO 04'));
  assert.deepEqual(blocos(t).map(b => b.split('\n')[0].slice(0, 8)), ['LEITO 04', 'LEITO 07', 'LEITO 09']);
});
test('conteúdo dos leitos 07 e 09, sem Obs vazio', () => {
  const t = gerar(mkEst(seedExemplos(HOJE)));
  const [, b7, b9] = blocos(t);
  assert.ok(b7.includes('Dx: DMG em uso de medicação, controle glicêmico ruim'));
  assert.ok(b9.includes('✓ Janela de corticoide — já recebeu ciclo? — feito em'));
  assert.ok(!t.includes('Obs:'));
});
test('IG não informada', () => {
  const p = novaPaciente({ id: 'x', leito: '01', int: '2026-11-01', dxs: [{ dx: 'dmg', mods: {} }] });
  const t = gerar(mkEst([p]));
  assert.ok(t.includes('LEITO 01 · IG não informada · D4 · G0P0C0A0'));
});
test('+2 anteriores com 7 feitos', () => {
  const pend = Array.from({ length: 7 }, (_, i) => novaPendencia({ id: 'f' + i, texto: 'Item' + i, done: true, doneAt: `2026-11-0${i + 1}`, res: 'ok' }));
  const p = novaPaciente({ id: 'x', leito: '01', int: '2026-10-30', igDays: 200, igRef: HOJE, pend });
  const t = gerar(mkEst([p]));
  const linha = t.split('\n').find(l => l.startsWith('Feito: '));
  assert.ok(linha.endsWith('+2 anteriores'));
  assert.equal(linha, 'Feito: 03/11 Item2 — ok · 04/11 Item3 — ok · 05/11 Item4 — ok · 06/11 Item5 — ok · 07/11 Item6 — ok · +2 anteriores');
  assert.ok(!linha.includes('Internação'));
});
test('bloco completo do leito 04', () => {
  const [b4] = blocos(gerar(mkEst(seedExemplos(HOJE))));
  assert.equal(b4, [
    'LEITO 04 · IG 31+2 · D7 · 27a · G2P1C1A0',
    'Dx: Pré-eclâmpsia com sinais de gravidade',
    'Alergias: Dipirona',
    '⚠ Janela de corticoide — já recebeu ciclo?',
    '• <32 sem: se indicar parto, MgSO₄ para neuroproteção',
  ].join('\n'));
});
test('resumoPaciente e linhaDoTempo', () => {
  const [p4] = seedExemplos(HOJE);
  const e = mkEst([p4]);
  const r = resumoPaciente(p4, HOJE, contexto(e));
  assert.equal(r.ig, '31+2'); assert.equal(r.dia, 7); assert.equal(r.gpca, 'G2P1C1A0');
  assert.equal(linhaDoTempo(p4)[0].texto, 'Internação');
});
