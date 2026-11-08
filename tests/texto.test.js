import { test } from 'node:test'; import assert from 'node:assert/strict';
import { textoPlantao } from '../js/relatorios/texto.js';
import { resumoPaciente, linhaDoTempo } from '../js/relatorios/comum.js';
import { novoEstado, novaPaciente, seedExemplos } from '../js/nucleo/estado.js';
import { novaPendencia } from '../js/nucleo/pendencias.js';
import { marcarPlantao } from '../js/nucleo/mudancas.js';
import { contexto } from '../js/nucleo/contexto.js';

const HOJE = '2026-11-04';
const mkEst = (pac) => ({ ...novoEstado(), pac });
const AGORA = new Date(HOJE + 'T12:00');
const gerar = (e, agora = AGORA) => textoPlantao(e, HOJE, contexto(e), agora);
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
  const r = resumoPaciente(p4, HOJE, contexto(e), AGORA);
  assert.equal(r.ig, '31+2'); assert.equal(r.dia, 7); assert.equal(r.gpca, 'G2P1C1A0');
  assert.equal(linhaDoTempo(p4)[0].texto, 'Internação');
});

const base = (o = {}) => novaPaciente({ id: 'x', leito: '01', int: '2026-11-01', igDays: 200, igRef: HOJE, dxs: [{ dx: 'dheg', mods: {} }], ...o });
const linhaDe = (t, pref) => t.split('\n').find(l => l.startsWith(pref));

test('Hoje, atrasadas, Aguardando, Tratamentos e Fora da faixa', () => {
  const pend = [
    novaPendencia({ id: 'a', texto: 'Labs', cat: 'Exame', due: '2026-11-03', estadoExame: 'solicitado' }),
    novaPendencia({ id: 'b', texto: 'CTG', cat: 'Avaliação', due: HOJE }),
    novaPendencia({ id: 'c', texto: 'Hemograma', cat: 'Exame', due: HOJE, estadoExame: 'aguardando', aguardandoDesde: '2026-11-03' }),
    novaPendencia({ id: 'd', texto: 'MgSO₄', cat: 'Medicação', due: HOJE, dur: { total: 24, unidade: 'horas', inicio: '2026-11-03T18:00' } }),
  ];
  const registros = [{ id: 'r1', data: HOJE, medida: 'pa', valor: { s: 165, d: 100 } }];
  const t = gerar(mkEst([base({ pend, registros })]));
  assert.equal(linhaDe(t, 'Hoje: '), 'Hoje: [ ] Labs (atrasado 1d) · [ ] CTG · [ ] MgSO₄');
  assert.equal(linhaDe(t, 'Aguardando resultado: '), 'Aguardando resultado: Hemograma (desde 03/11)');
  assert.equal(linhaDe(t, 'Tratamentos: '), 'Tratamentos: MgSO₄ 18h/24h');
  assert.equal(linhaDe(t, 'Fora da faixa: '), 'Fora da faixa: PA 165x100');
});

test('Mudou aparece após marcarPlantao e alteração', () => {
  const p = base({ dxs: [{ dx: 'dmg', mods: {} }] });
  const e0 = mkEst([p]);
  const marcado = marcarPlantao(e0, '2026-11-03', contexto(e0));
  const e1 = { ...marcado, pac: [{ ...p, dxs: [{ dx: 'dmg', mods: { medicacao: true } }] }] };
  const t = gerar(e1);
  assert.equal(linhaDe(t, 'Mudou: '), 'Mudou: Diagnóstico/modificador: DMG em uso de medicação');
  assert.ok(!gerar(mkEst([p])).includes('Mudou:'));
});

test('linhaDoTempo marca tipo e tratamento concluído', () => {
  const pend = [novaPendencia({ id: 'd', texto: 'MgSO₄', dur: { total: 24, unidade: 'horas', inicio: '2026-11-02T18:00' } })];
  const lt = linhaDoTempo(base({ pend }), new Date(HOJE + 'T12:00'));
  assert.deepEqual(lt.map(x => x.tipo), ['internacao', 'tratamento']);
  assert.equal(lt[1].texto, 'MgSO₄ concluído');
});

test('copiar duas vezes no mesmo dia mantém o Mudou; no dia seguinte compara com o último snap', () => {
  const p = base({ dxs: [{ dx: 'dmg', mods: {} }] });
  const e0 = mkEst([p]);
  const ontem = marcarPlantao(e0, '2026-11-03', contexto(e0));
  const e1 = { ...ontem, pac: [{ ...p, dxs: [{ dx: 'dmg', mods: { medicacao: true } }] }] };
  const MUDOU = 'Mudou: Diagnóstico/modificador: DMG em uso de medicação';
  assert.equal(linhaDe(gerar(e1), 'Mudou: '), MUDOU);
  const copia1 = marcarPlantao(e1, HOJE, contexto(e1));
  assert.equal(linhaDe(gerar(copia1), 'Mudou: '), MUDOU);
  const copia2 = marcarPlantao(copia1, HOJE, contexto(copia1));
  assert.equal(linhaDe(gerar(copia2), 'Mudou: '), MUDOU);
  const amanha = textoPlantao(copia2, '2026-11-05', contexto(copia2), new Date('2026-11-05T12:00'));
  assert.ok(!amanha.includes('Mudou:'), 'no dia seguinte a base é o snap de hoje (sem mudança)');
});

test('MgSO₄ 24h iniciado 08:00 não está concluído às 10:00 e mostra as horas reais', () => {
  const pend = [novaPendencia({ id: 'm', texto: 'MgSO₄ 24h', dur: { total: 24, unidade: 'horas', inicio: HOJE + 'T08:00' } })];
  const e = mkEst([base({ pend })]);
  const cedo = gerar(e, new Date(HOJE + 'T10:00'));
  assert.ok(cedo.includes('Tratamentos: MgSO₄ 24h 2h/24h'));
  assert.ok(!cedo.includes('concluído'));
  const depois = gerar(e, new Date('2026-11-05T09:00'));
  assert.ok(depois.includes('MgSO₄ 24h 25h/24h'));
  assert.ok(depois.includes('MgSO₄ 24h concluído'));
});
