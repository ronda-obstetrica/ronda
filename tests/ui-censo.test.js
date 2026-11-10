// HTML do Censo e do cadastro gerado no Node (sem DOM): conteúdo, ordem e escape.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { novoEstado, seedExemplos, novaPaciente } from '../js/nucleo/estado.js';
import { contexto } from '../js/nucleo/contexto.js';
import { htmlCenso, htmlFaixaLeito } from '../js/ui/censo.js';
import { textoDatacao, htmlCadastro } from '../js/ui/formularios.js';
import { esc } from '../js/ui/util.js';

const HOJE = '2026-11-08';
const AGORA = new Date(`${HOJE}T12:00`);
const comSeed = () => ({ ...novoEstado(), pac: seedExemplos(HOJE) });

test('esc escapa os caracteres de HTML', () => {
  assert.equal(esc(`<b>"a" & 'b'</b>`), '&lt;b&gt;&quot;a&quot; &amp; &#39;b&#39;&lt;/b&gt;');
  assert.equal(esc(null), '');
});

test('censo do seed: 3 faixas em ordem natural, com IG, alertas vermelhos e pendências', () => {
  const estado = comSeed();
  const html = htmlCenso({ estado, ctx: contexto(estado), hoje: HOJE }, AGORA);
  const leitos = [...html.matchAll(/class="fx-leito">Leito (\d+)</g)].map((m) => m[1]);
  assert.deepEqual(leitos, ['04', '07', '09']);
  assert.equal((html.match(/data-act="abrir-paciente" data-id="[^"]+"/g) || []).length, 3);
  assert.match(html, /31\+2 sem/);
  assert.match(html, /\d+ alertas? vermelhos?/);
  assert.doesNotMatch(html, /0 (alertas?|pendências?)/); // zero não aparece
  assert.doesNotMatch(html, /Alergia|Controles de hoje|data-act="mod"|undefined|NaN/); // detalhes ficam na página da paciente
});

test('faixa de leito: iniciais, IG, siglas e escape', () => {
  const pac = novaPaciente({ leito: '<1>', iniciais: 'M<A', igDays: 31 * 7 + 2, igRef: HOJE, dxs: [{ dx: 'dheg', mods: {} }] });
  const h = htmlFaixaLeito(pac, { hoje: HOJE, ctx: contexto({ ...novoEstado(), pac: [pac] }) });
  assert.match(h, /^<button type="button" class="faixa-leito" data-act="abrir-paciente" data-id="[^"]+">/);
  assert.ok(h.includes('Leito &lt;1&gt;'));
  assert.ok(h.includes('M&lt;A'));
  assert.ok(!h.includes('M<A'));
  assert.match(h, /31\+2 sem/);
  assert.match(h, /DHEG/);
  const sem = htmlFaixaLeito({ ...pac, iniciais: '' }, { hoje: HOJE, ctx: contexto({ ...novoEstado(), pac: [pac] }) });
  assert.doesNotMatch(sem, /fx-ini/);
});

test('censo vazio mostra a orientação e o botão + Paciente', () => {
  const estado = novoEstado();
  const html = htmlCenso({ estado, ctx: contexto(estado), hoje: HOJE }, AGORA);
  assert.match(html, /Nenhuma paciente/);
  assert.match(html, /data-act="novo"/);
});

test('faixa de erro das regras do serviço', () => {
  const estado = { ...comSeed(), regrasServico: 'linha ruim\noutra | ruim' };
  const html = htmlCenso({ estado, ctx: contexto(estado), hoje: HOJE }, AGORA);
  assert.match(html, /2 linhas das regras do serviço com erro — ver Protocolos/);
});

test('datação: DUM 2026-04-01 e USG 2026-06-01/10+0 sugere USG', () => {
  const r = textoDatacao({ dum: '2026-04-01', usgData: '2026-06-01', usgIG: '10+0' }, HOJE);
  assert.equal(r.erro, null);
  assert.equal(r.sug.fonte, 'usg');
  assert.equal(r.texto, 'pela DUM: 31+4 · pela USG: 32+6 · sugerido: USG (diferença 9 dias > 7)');
});

test('datação: IG inválida e USG incompleta viram erro', () => {
  assert.match(textoDatacao({ usgData: '2026-06-01', usgIG: '10,0' }, HOJE).erro, /inválida/);
  assert.match(textoDatacao({ usgData: '2026-06-01' }, HOJE).erro, /preencha a data e a IG/);
  assert.equal(textoDatacao({}, HOJE).texto, '');
});

test('cadastro: limites dos campos livres e internação padrão hoje', () => {
  const html = htmlCadastro(null, HOJE);
  assert.match(html, /name="obs" maxlength="240"/);
  assert.match(html, /0\/240/);
  assert.match(html, /Não escreva nomes ou dados que identifiquem a paciente\./);
  assert.match(html, new RegExp(`name="int" max="${HOJE}" value="${HOJE}"`));
});
