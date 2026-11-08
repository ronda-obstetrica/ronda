import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PROT_PADRAO, CATEGORIAS, parseProtocolo, novaPendencia, chavePend, aplicarProtocolo,
  concluir, desfazer, marcarAguardando, remover, progressoTratamento, registrarDose,
  gerarPendenciasPorIG, pendenciaDeAlerta, classificarHoje,
} from '../js/nucleo/pendencias.js';
import { REGRAS_GLOBAIS } from '../js/nucleo/regras.js';
import { novoEstado } from '../js/nucleo/estado.js';

const HOJE = '2026-11-07';
const pac0 = (extra = {}) => ({ pend: [], dispensadas: [], dxs: [], igDays: null, igRef: HOJE, ...extra });
const itens = (txt) => parseProtocolo(txt).itens;

test('novaPendencia: defaults', () => {
  const p = novaPendencia({ texto: 'x', cat: 'Conduta', due: HOJE });
  assert.deepEqual({ ...p, id: null }, {
    id: null, texto: 'x', cat: 'Conduta', due: HOJE, rep: 0, done: false, doneAt: null,
    spawn: null, res: '', origem: 'manual', estadoExame: null, aguardandoDesde: null, dur: null,
  });
  assert.ok(p.id);
  assert.equal(novaPendencia({ texto: 'x', cat: 'Exame', due: HOJE }).estadoExame, 'solicitado');
});

test('chavePend normaliza', () => {
  assert.equal(chavePend({ texto: ' CTG ', cat: 'Exame' }), chavePend({ texto: 'ctg', cat: 'Exame' }));
  assert.equal(chavePend({ texto: 'Avaliação  Ótima', cat: 'Outro' }), 'avaliacao otima|Outro');
});

test('aplicarProtocolo não duplica; CTG e ctg iguais', () => {
  const it = itens('CTG | Exame | 0 | 2\nOutro item | Conduta | 1 | 0');
  let p = aplicarProtocolo(pac0(), it, HOJE);
  assert.equal(p.pend.length, 2);
  assert.equal(p.pend[1].due, '2026-11-08');
  assert.equal(p.pend[0].origem, 'protocolo');
  p = aplicarProtocolo(p, it, HOJE);
  assert.equal(p.pend.length, 2);
  p = aplicarProtocolo(p, itens('ctg | Exame | 0 | 0'), HOJE);
  assert.equal(p.pend.length, 2);
});

test('aplicarProtocolo com duração define dur.inicio', () => {
  const p = aplicarProtocolo(pac0(), itens('A | Medicação | 1 | 0 | 7d\nB | Medicação | 0 | 0 | 24h\nC | Medicação | 0 | 0 | 2doses@1'), HOJE);
  assert.deepEqual(p.pend[0].dur, { total: 7, unidade: 'dias', inicio: '2026-11-08' });
  assert.deepEqual(p.pend[1].dur, { total: 24, unidade: 'horas', inicio: '2026-11-07T08:00' });
  assert.deepEqual(p.pend[2].dur, { total: 2, unidade: 'doses', inicio: HOJE, intervaloDias: 1, doses: [] });
});

test('concluir com rep cria próxima e desfazer remove', () => {
  let p = aplicarProtocolo(pac0(), itens('Rev | Avaliação | 0 | 2'), HOJE);
  const id = p.pend[0].id;
  const orig = p;
  p = concluir(p, id, HOJE, 'ok');
  assert.equal(orig.pend[0].done, false);
  assert.equal(p.pend.length, 2);
  assert.equal(p.pend[0].done, true);
  assert.equal(p.pend[0].doneAt, HOJE);
  assert.equal(p.pend[1].due, '2026-11-09');
  assert.equal(p.pend[0].spawn, p.pend[1].id);
  p = desfazer(p, id);
  assert.equal(p.pend.length, 1);
  assert.equal(p.pend[0].done, false);
  assert.equal(p.pend[0].res, '');
  assert.equal(p.pend[0].doneAt, null);
});

test('res cortado em 80', () => {
  let p = aplicarProtocolo(pac0(), itens('Rev | Avaliação | 0 | 0'), HOJE);
  p = concluir(p, p.pend[0].id, HOJE, 'a'.repeat(100));
  assert.equal(p.pend[0].res.length, 80);
});

test('exame: solicitado, aguardando, visto; classificarHoje', () => {
  let p = aplicarProtocolo(pac0(), itens('Hemo | Exame | 0 | 0'), HOJE);
  const id = p.pend[0].id;
  assert.equal(p.pend[0].estadoExame, 'solicitado');
  assert.equal(classificarHoje(p, HOJE).hoje.length, 1);
  p = marcarAguardando(p, id, HOJE);
  assert.equal(p.pend[0].estadoExame, 'aguardando');
  assert.equal(p.pend[0].aguardandoDesde, HOJE);
  const c = classificarHoje(p, HOJE);
  assert.equal(c.aguardando.length, 1);
  assert.equal(c.hoje.length, 0);
  assert.equal(c.atrasadas.length, 0);
  p = concluir(p, id, HOJE);
  assert.equal(p.pend[0].estadoExame, 'visto');
  assert.equal(classificarHoje(p, HOJE).concluidasHoje.length, 1);
});

test('classificarHoje: atrasada, hoje, amanhã', () => {
  const mk = (due) => novaPendencia({ texto: 't' + due, cat: 'Conduta', due });
  const p = pac0({ pend: [mk('2026-11-05'), mk(HOJE), mk('2026-11-08'), mk('2026-11-20')] });
  const c = classificarHoje(p, HOJE);
  assert.equal(c.atrasadas.length, 1);
  assert.equal(c.atrasadas[0].diasAtraso, 2);
  assert.equal(c.hoje.length, 1);
  assert.equal(c.amanha.length, 1);
});

test('progressoTratamento', () => {
  const agora = new Date(2026, 10, 7, 14, 30);
  assert.deepEqual(progressoTratamento({ dur: { total: 7, unidade: 'dias', inicio: '2026-11-05' } }, agora), { texto: 'D3/7', terminado: false });
  assert.equal(progressoTratamento({ dur: { total: 2, unidade: 'dias', inicio: '2026-11-05' } }, agora).terminado, true);
  assert.deepEqual(progressoTratamento({ dur: { total: 24, unidade: 'horas', inicio: '2026-11-06T20:00' } }, agora), { texto: '18h/24h', terminado: false });
  const d = (doses) => ({ dur: { total: 2, unidade: 'doses', inicio: '2026-11-06', intervaloDias: 1, doses } });
  assert.deepEqual(progressoTratamento(d(['2026-11-07']), agora), { texto: 'Dose 2/2 amanhã', terminado: false });
  assert.equal(progressoTratamento(d(['2026-11-06']), agora).texto, 'Dose 2/2 hoje');
  assert.equal(progressoTratamento(d(['2026-11-04']), agora).texto, 'Dose 2/2 hoje');
  assert.deepEqual(progressoTratamento(d(['2026-11-06', '2026-11-07']), agora), { texto: '2/2 doses', terminado: true });
  assert.equal(progressoTratamento({ dur: null }, agora), null);
});

test('registrarDose', () => {
  let p = aplicarProtocolo(pac0(), itens('C | Medicação | 0 | 0 | 2doses'), HOJE);
  const id = p.pend[0].id;
  assert.equal(p.pend[0].dur.intervaloDias, 1);
  p = registrarDose(p, id, HOJE);
  p = registrarDose(p, id, HOJE);
  p = registrarDose(p, id, HOJE);
  assert.deepEqual(p.pend[0].dur.doses, [HOJE, HOJE]);
});

test('remover: manual some e não vai a dispensadas', () => {
  let p = aplicarProtocolo(pac0(), itens('A | Conduta | 0 | 0'), HOJE);
  p = remover(p, p.pend[0].id);
  assert.equal(p.pend.length, 0);
  assert.deepEqual(p.dispensadas, []);
});

const DMG = (mods) => [{ dx: 'dmg', mods }];
test('gerarPendenciasPorIG: CTG semanal, idempotente, remover, troca de série', () => {
  const base = pac0({ igDays: 32 * 7, dxs: DMG({ medicacao: true }) });
  const p = gerarPendenciasPorIG(base, HOJE, REGRAS_GLOBAIS);
  assert.equal(p.pend.length, 1);
  assert.equal(p.pend[0].texto, 'CTG semanal');
  assert.equal(p.pend[0].rep, 7);
  assert.equal(p.pend[0].cat, 'Exame');
  assert.equal(p.pend[0].origem, 'ctg-dmg-a2');
  assert.equal(p.pend[0].due, HOJE);
  assert.equal(gerarPendenciasPorIG(p, HOJE, REGRAS_GLOBAIS).pend.length, 1);
  const r = remover(p, p.pend[0].id);
  assert.deepEqual(r.dispensadas, ['ctg-dmg-a2']);
  assert.equal(gerarPendenciasPorIG(r, HOJE, REGRAS_GLOBAIS).pend.length, 0);
  const t = gerarPendenciasPorIG({ ...p, dxs: DMG({ medicacao: true, 'dm-previo': true }) }, HOJE, REGRAS_GLOBAIS);
  assert.equal(t.pend.length, 2);
  assert.deepEqual(t.pend.map((x) => x.origem).sort(), ['ctg-dmg-a2', 'ctg-dmprevio']);
});

test('gerarPendenciasPorIG: manual aberta bloqueia; sem IG ou antes do início não gera', () => {
  const regras = REGRAS_GLOBAIS;
  const manual = novaPendencia({ texto: 'ctg SEMANAL', cat: 'Exame', due: HOJE });
  const p = pac0({ igDays: 32 * 7, dxs: DMG({ medicacao: true }), pend: [manual] });
  assert.equal(gerarPendenciasPorIG(p, HOJE, regras).pend.length, 1);
  assert.equal(gerarPendenciasPorIG(pac0({ dxs: DMG({ medicacao: true }) }), HOJE, regras).pend.length, 0);
  assert.equal(gerarPendenciasPorIG(pac0({ igDays: 30 * 7, dxs: DMG({ medicacao: true }) }), HOJE, regras).pend.length, 0);
});

test('gerarPendenciasPorIG: cat Avaliação para outras msgs', () => {
  const regras = [{ id: 'x', alvo: { dx: null, exige: [], proibe: [] }, ini: 0, fim: null, tipo: 'pendencia', msg: 'Avaliar fundo de olho', repetir: 3 }];
  const p = gerarPendenciasPorIG(pac0({ igDays: 100 }), HOJE, regras);
  assert.equal(p.pend[0].cat, 'Avaliação');
});

test('pendenciaDeAlerta dedupa', () => {
  let p = pendenciaDeAlerta(pac0(), { msg: 'Corticoide' }, HOJE);
  assert.equal(p.pend[0].cat, 'Conduta');
  p = pendenciaDeAlerta(p, { msg: 'corticoide' }, HOJE);
  assert.equal(p.pend.length, 1);
});

test('parseProtocolo: duração 7d e categoria inexistente', () => {
  const r = parseProtocolo('A | exame | 0 | 0 | 7d\nB | Inventada | 0 | 0\nC | Exame | x | 0\nD | Exame | 0');
  assert.equal(r.itens.length, 1);
  assert.equal(r.itens[0].cat, 'Exame');
  assert.deepEqual(r.itens[0].dur, { total: 7, unidade: 'dias' });
  assert.equal(r.erros.length, 3);
  assert.equal(r.erros[0].n, 2);
  assert.ok(CATEGORIAS.includes('Outro'));
});

test('PROT_PADRAO: 8 dx, sem erros, 3 a 6 itens, novoEstado usa', () => {
  const dxs = ['dheg', 'dmg', 'tpp', 'rpmo', 'placenta', 'rcf', 'colestase', 'outro'];
  assert.deepEqual(Object.keys(PROT_PADRAO).sort(), [...dxs].sort());
  for (const dx of dxs) {
    const t = PROT_PADRAO[dx];
    assert.ok(t.startsWith('# Modelo genérico — substitua pelo protocolo da sua instituição'), dx);
    const r = parseProtocolo(t);
    assert.deepEqual(r.erros, [], dx);
    if (dx !== 'outro') assert.ok(r.itens.length >= 3 && r.itens.length <= 6, dx);
    else assert.ok(r.itens.length >= 1);
  }
  assert.deepEqual(novoEstado().prot, PROT_PADRAO);
});
