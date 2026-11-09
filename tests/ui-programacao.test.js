// Aba Programação gerada no Node (sem DOM): ordem de leito, texto inteiro, omissão e contagem.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { novoEstado, novaPaciente } from '../js/nucleo/estado.js';
import { contexto } from '../js/nucleo/contexto.js';
import { htmlProgramacao, render, acoes } from '../js/ui/programacao.js';

const HOJE = '2026-11-08';
const mk = (leito, extra = {}) => novaPaciente({ leito, dxs: [{ dx: 'outro', mods: {} }], ...extra });
const dados = (pac) => { const estado = { ...novoEstado(), pac }; return { estado, ctx: contexto(estado), hoje: HOJE }; };

test('lista em ordem de leito (04, 07, 09) com iniciais e texto inteiro; abre a página da paciente', () => {
  const longo = `Cesárea eletiva amanhã 8h; jejum a partir das 22h; ${'x'.repeat(150)}`;
  const h = htmlProgramacao(dados([mk('09', { prog: 'C', iniciais: 'JJ' }), mk('04', { prog: longo, iniciais: 'MAS' }), mk('07', { prog: 'B' })]));
  assert.deepEqual([...h.matchAll(/<b class="pend-leito">Leito (\d+)/g)].map((m) => m[1]), ['04', '07', '09']);
  assert.ok(h.includes('Leito 04 · MAS</b> — <span class="prog-txt">Cesárea eletiva'));
  assert.ok(h.includes(longo), 'texto inteiro, sem corte');
  assert.ok(h.includes('<b class="pend-leito">Leito 07</b> — '), 'sem iniciais, sem separador');
  assert.equal((h.match(/data-act="abrir-paciente" data-id="[^"]+"/g) || []).length, 3);
  assert.doesNotMatch(h, /sem programação|undefined|NaN/);
});

test('paciente sem programação é omitida e contada no fim', () => {
  const h = htmlProgramacao(dados([mk('04', { prog: 'A' }), mk('07'), mk('09', { prog: '   ' })]));
  assert.ok(!h.includes('Leito 07') && !h.includes('Leito 09'));
  assert.ok(h.includes('2 leitos sem programação'));
  assert.ok(htmlProgramacao(dados([mk('04', { prog: 'A' }), mk('07')])).includes('1 leito sem programação'));
  assert.ok(!htmlProgramacao(dados([mk('04', { prog: 'A' })])).includes('sem programação'));
});

test('escape de texto e iniciais; estados vazios; render e acoes', () => {
  const h = htmlProgramacao(dados([mk('<1>', { prog: '<img src=x onerror=alert(1)>', iniciais: '"><b>' })]));
  assert.ok(!h.includes('<img') && !h.includes('"><b>'));
  assert.ok(h.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.match(htmlProgramacao(dados([])), /Nenhuma paciente cadastrada/);
  assert.match(htmlProgramacao(dados([mk('04')])), /Nenhuma programação escrita/);
  const raiz = { innerHTML: '' };
  render(raiz, dados([mk('04', { prog: 'A' })]));
  assert.match(raiz.innerHTML, /Programação/);
  assert.equal(typeof acoes, 'object');
});
