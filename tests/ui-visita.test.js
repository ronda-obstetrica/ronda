// HTML do modo visita gerado no Node (sem DOM): ordem das seções, "N de M", "Mudou" e escape.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { novoEstado, seedExemplos, novaPaciente } from '../js/nucleo/estado.js';
import { contexto } from '../js/nucleo/contexto.js';
import { marcarPlantao } from '../js/nucleo/mudancas.js';
import { registrar } from '../js/nucleo/faixas.js';
import { htmlVisita, indiceAtual } from '../js/ui/visita.js';
import { htmlCenso } from '../js/ui/censo.js';

const HOJE = '2026-11-08';
const AGORA = new Date(`${HOJE}T12:00`);
const comSeed = () => ({ ...novoEstado(), pac: seedExemplos(HOJE) });
const html = (estado, id) => htmlVisita({ estado, ctx: contexto(estado), hoje: HOJE }, { id, agora: AGORA });
const pacDo = (estado, leito) => estado.pac.find((p) => p.leito === leito);
// Recorta a tela de um leito.
const tela = (h, pacId) => {
  const ini = h.indexOf(`id="visita-${pacId}"`);
  const fim = h.indexOf('class="v-leito-tela"', ini + 1);
  return h.slice(ini, fim < 0 ? undefined : fim);
};

test('uma tela por leito em ordem natural e indicador "N de M" no leito pedido', () => {
  const estado = comSeed();
  const h = html(estado, pacDo(estado, '07').id);
  assert.deepEqual([...h.matchAll(/class="v-leito">Leito (\d+)</g)].map((m) => m[1]), ['04', '07', '09']);
  assert.match(h, /class="v-indicador"[^>]*>2 de 3</);
  assert.match(html(estado, 'nao-existe'), /class="v-indicador"[^>]*>1 de 3</);
  assert.match(h, /data-act="visita-ir" data-dir="-1"/);
  assert.match(h, /data-act="visita-ir" data-dir="1"/);
  assert.doesNotMatch(h, /undefined|NaN|Linha do tempo/);
});

test('indiceAtual: paciente que saiu mantém a posição, sem passar do fim', () => {
  const pacs = [{ id: 'a' }, { id: 'b' }];
  assert.equal(indiceAtual(pacs, 'b', 0), 1);
  assert.equal(indiceAtual(pacs, 'x', 1), 1);
  assert.equal(indiceAtual(pacs, 'x', 5), 1);
  assert.equal(indiceAtual(pacs, null, 0), 0);
});

test('ordem: cabeçalho → mudou → alertas → controles → pendências → tratamentos → diagnósticos', () => {
  let estado = comSeed();
  const p04 = pacDo(estado, '04');
  estado = marcarPlantao(estado, '2026-11-07', contexto(estado));
  // Depois do plantão de ontem: registra PA alta e cria um tratamento em curso.
  const trat = { id: 't1', texto: 'Sulfato de magnésio', cat: 'Medicação', due: HOJE, done: false,
    dur: { unidade: 'horas', total: 24, inicio: `${HOJE}T08:00` } };
  estado = { ...estado, pac: estado.pac.map((p) => (p.id === p04.id
    ? { ...registrar(p, { data: HOJE, medida: 'pa', valor: { s: 165, d: 100 } }), pend: [...p.pend, trat] } : p)) };
  const t = tela(html(estado, p04.id), p04.id);
  const marcos = ['class="v-leito"', 'Mudou desde o último plantão', '<h3>Alertas</h3>', 'Controles de hoje',
    '<h3>Pendências</h3>', '<h3>Tratamentos</h3>', '<h3>Diagnósticos</h3>'];
  const pos = marcos.map((m) => t.indexOf(m));
  assert.ok(pos.every((p) => p >= 0), `seções ausentes: ${marcos.filter((m, i) => pos[i] < 0)}`);
  assert.deepEqual([...pos].sort((a, b) => a - b), pos, 'seções fora de ordem');
  assert.match(t, /Fora da faixa: PA 165x100/);
  assert.match(t, /registro vermelho/);
  assert.match(t, /Crise hipertensiva/);
  assert.match(t, /class="v-dia">D7</);
  assert.match(t, /Sulfato de magnésio <span class="prog">/);
});

test('controles: campo grande por medida, numérico na glicemia e texto 150x95 na PA', () => {
  const estado = comSeed();
  const h = html(estado);
  const t07 = tela(h, pacDo(estado, '07').id);
  assert.equal((t07.match(/class="v-controle" data-submit="registrar-valor"/g) || []).length, 6);
  assert.match(t07, /name="medida" value="jejum">[\s\S]*?inputmode="numeric" placeholder="95"/);
  const t04 = tela(h, pacDo(estado, '04').id);
  assert.match(t04, /name="medida" value="pa">[\s\S]*?inputmode="text" placeholder="150x95"/);
  assert.match(t04, /PA no formato 150x95/);
  // Mesmos data-act do Censo: modificador, feito de alerta, + pendência.
  assert.match(t04, /data-act="mod"[^>]*data-mod="gravidade"[^>]*aria-pressed="true"/);
  assert.match(t04, /data-act="alerta-feito"/);
  assert.match(t04, /data-act="pend-nova"/);
});

test('"Mudou" some sem plantão de comparação e quando o leito não mudou', () => {
  let estado = comSeed();
  assert.doesNotMatch(html(estado), /Mudou desde o último plantão/);
  estado = marcarPlantao(estado, '2026-11-07', contexto(estado));
  assert.doesNotMatch(html(estado), /Mudou desde o último plantão/);
  // Desliga um modificador no 07: só ele mostra "Mudou".
  const p07 = pacDo(estado, '07');
  estado = { ...estado, pac: estado.pac.map((p) => (p.id === p07.id ? { ...p, dxs: [{ dx: 'dmg', mods: { medicacao: true } }] } : p)) };
  const h = html(estado);
  assert.equal((h.match(/Mudou desde o último plantão/g) || []).length, 1);
  assert.match(tela(h, p07.id), /Mudou desde o último plantão[\s\S]*Diagnóstico\/modificador:/);
});

test('textos da usuária escapados (atributos e conteúdo)', () => {
  const xss = '<img src=x onerror=alert(1)>';
  const pac = novaPaciente({ leito: '"><img src=x onerror=alert(1)>', alerg: xss, dxs: [{ dx: 'dheg', mods: {} }],
    pend: [{ id: '"x', texto: xss, cat: 'Exame', due: HOJE, done: false }] });
  let estado = { ...novoEstado(), pac: [pac] };
  estado = marcarPlantao(estado, '2026-11-07', contexto(estado));
  estado = { ...estado, pac: [{ ...registrar(estado.pac[0], { data: HOJE, medida: 'pa', valor: { s: 165, d: 100 } }) }] };
  const h = html(estado);
  assert.ok(!h.includes('<img'), 'tag injetada');
  assert.ok(!/"><img/.test(h));
  assert.ok(h.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.match(h, /Mudou desde o último plantão/);
});

test('sem pacientes: estado vazio com "+ Paciente"', () => {
  const h = html(novoEstado());
  assert.match(h, /Nenhuma paciente/);
  assert.match(h, /data-act="novo"/);
  assert.doesNotMatch(h, /v-trilho/);
});

test('cartão do Censo tem o botão "Visita" com o id do leito', () => {
  const estado = comSeed();
  const h = htmlCenso({ estado, ctx: contexto(estado), hoje: HOJE }, AGORA);
  assert.equal((h.match(/data-act="abrir-visita" data-id="[^"]+"/g) || []).length, 3);
});
