// Cenários por IG: fixa o estado do alerta de cada regra global res-* e corticoide nos limites
// ini-8, ini-7, ini-1, ini, fim, fim+1, fim+7 e fim+8 dias (semântica de alertas.js e spec §6.5/§6.7).
import { test } from 'node:test'; import assert from 'node:assert/strict';
import { REGRAS_GLOBAIS, REGRAS_GLOBAIS_TEXTO } from '../js/nucleo/regras.js';
import { avaliarAlertas } from '../js/nucleo/alertas.js';
import { novaPaciente } from '../js/nucleo/estado.js';
import { DIAGNOSTICOS } from '../js/nucleo/diagnosticos.js';
import { fmtIG } from '../js/nucleo/datas.js';

const HOJE = '2026-11-08';

// Monta um diagnóstico que satisfaz exatamente o alvo da regra (dx + modificadores exigidos).
function dxDoAlvo(alvo) {
  const mods = {};
  for (const t of alvo.exige) {
    for (const m of DIAGNOSTICOS[alvo.dx].mods) {
      if (m.tipo === 'liga' && m.id === t) mods[m.id] = true;
      const o = m.opcoes?.find((x) => x.id === t);
      if (o) mods[m.id] = o.id;
    }
  }
  return { dx: alvo.dx, mods };
}

const pacComIG = (dxs, ig) => novaPaciente({ id: 'p', leito: '01', dxs, igDays: ig, igRef: HOJE });
const alertaDe = (r, ig) => avaliarAlertas(pacComIG(r.alvo.dx ? [dxDoAlvo(r.alvo)] : [], ig), HOJE, REGRAS_GLOBAIS)
  .find((a) => a.regraId === r.id);

// Estado esperado segundo a semântica documentada.
function esperado(r, ig) {
  const fim = r.fim ?? Infinity;
  if (r.tipo === 'resolucao') {
    const ant = r.antecedencia ?? 0;
    if (ig < r.ini - ant) return null;
    if (ig < r.ini) return { estado: 'proximo', nivel: 'amarelo' };
    if (ig <= fim) return { estado: 'ativo', nivel: r.nivel };
    return { estado: 'ultrapassado', nivel: 'vermelho', dias: ig - fim };
  }
  if (ig < r.ini) return null;
  if (ig <= fim) return { estado: 'ativo', nivel: r.nivel };
  if (r.nivel === 'vermelho' && ig - fim <= 7) return { estado: 'encerrado', nivel: 'cinza' };
  return null;
}

const regras = REGRAS_GLOBAIS.filter((r) => (r.id.startsWith('res-') || r.id.startsWith('corticoide')) && r.tipo !== 'pendencia');

test('há regras res-* e corticoide para cobrir', () => {
  assert.equal(regras.length, 5 + 24);
  assert.equal(regras.filter((r) => r.tipo === 'janela').length, 5);
});

for (const r of regras) {
  test(`cenários de IG: ${r.id} (${fmtIG(r.ini)}–${r.fim === null ? '…' : fmtIG(r.fim)})`, () => {
    const offs = [['ini-8', r.ini - 8], ['ini-7', r.ini - 7], ['ini-1', r.ini - 1], ['ini', r.ini]];
    if (r.fim !== null) offs.push(['fim', r.fim], ['fim+1', r.fim + 1], ['fim+7', r.fim + 7], ['fim+8', r.fim + 8]);
    else offs.push(['ini+30', r.ini + 30]);
    for (const [rot, ig] of offs) {
      if (ig < 0) continue;
      const a = alertaDe(r, ig);
      const e = esperado(r, ig);
      const nome = `${r.id} @ ${rot} (${fmtIG(ig)})`;
      if (!e) { assert.equal(a, undefined, nome); continue; }
      assert.ok(a, nome);
      assert.equal(a.estado, e.estado, nome);
      assert.equal(a.nivel, e.nivel, nome);
      if (e.dias) assert.equal(a.diasUltrapassado, e.dias, nome);
    }
  });
}

// Tabela da spec §6.5 (ini, fim): trava o texto das regras contra edição acidental.
const SPEC = {
  corticoide: ['24+0', '33+6'], 'res-pe-sem': ['37+0', null], 'res-hg': ['37+0', null],
  'res-hg-limite': ['39+6', '39+6'], 'res-hac': ['37+0', '39+6'],
  'res-dmg-a1': ['39+0', '40+6'], 'res-dmg-a2': ['39+0', '39+6'], 'res-dmg-ruim': ['37+0', '38+6'],
  'res-dmprevio': ['38+0', '39+6'], 'res-dmprevio-ruim': ['37+0', '37+0'],
  'res-rcf-p3p10': ['38+0', '39+0'], 'res-rcf-p3': ['37+0', '37+0'], 'res-rcf-dz': ['33+0', '34+0'],
  'res-rcf-dr': ['30+0', '32+0'], 'res-rcf-conc': ['34+0', '37+6'], 'res-colestase': ['36+0', '39+0'],
  'res-colestase-100': ['36+0', '36+0'], 'res-rpmo': ['34+0', '36+6'],
  'res-placenta-previa': ['36+0', '37+6'], 'res-placenta-acretismo': ['34+0', '35+6'],
};
test('janelas globais batem com a tabela da spec §6.5', () => {
  for (const [id, [ini, fim]] of Object.entries(SPEC)) {
    const r = REGRAS_GLOBAIS.find((x) => x.id === id);
    assert.ok(r, id);
    assert.equal(fmtIG(r.ini), ini, id);
    assert.equal(r.fim === null ? null : fmtIG(r.fim), fim, id);
  }
  assert.ok(REGRAS_GLOBAIS_TEXTO.includes('res-pe-grave'));
});
