// HTML do Censo e do cadastro gerado no Node (sem DOM): conteúdo, ordem e escape.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { novoEstado, seedExemplos, novaPaciente } from '../js/nucleo/estado.js';
import { contexto } from '../js/nucleo/contexto.js';
import { htmlCenso } from '../js/ui/censo.js';
import { textoDatacao, htmlCadastro } from '../js/ui/formularios.js';
import { esc } from '../js/ui/util.js';

const HOJE = '2026-11-08';
const AGORA = new Date(`${HOJE}T12:00`);
const comSeed = () => ({ ...novoEstado(), pac: seedExemplos(HOJE) });

test('esc escapa os caracteres de HTML', () => {
  assert.equal(esc(`<b>"a" & 'b'</b>`), '&lt;b&gt;&quot;a&quot; &amp; &#39;b&#39;&lt;/b&gt;');
  assert.equal(esc(null), '');
});

test('censo do seed: 3 cartões em ordem natural, alergia e alertas com prefixo', () => {
  const estado = comSeed();
  const html = htmlCenso({ estado, ctx: contexto(estado), hoje: HOJE }, AGORA);
  const leitos = [...html.matchAll(/Leito (\d+)<\/h2>/g)].map((m) => m[1]);
  assert.deepEqual(leitos, ['04', '07', '09']);
  assert.match(html, /<strong>⚠ Alergia:<\/strong> Dipirona/);
  assert.match(html, /▲ AGIR:/);
  assert.match(html, /data-act="mod"[^>]*data-mod="gravidade"[^>]*aria-pressed="true"/);
  assert.match(html, /31\+2 sem/);
  assert.match(html, /Controles de hoje/); // 04 (DHEG) e 07 (DMG)
  assert.doesNotMatch(html, /Erro|undefined|NaN/);
});

test('controles só aparecem com medidas para o diagnóstico', () => {
  const estado = { ...novoEstado(), pac: [novaPaciente({ leito: '12', dxs: [{ dx: 'rpmo', mods: {} }] })] };
  const html = htmlCenso({ estado, ctx: contexto(estado), hoje: HOJE }, AGORA);
  assert.doesNotMatch(html, /Controles de hoje/);
  assert.match(html, /IG não informada/);
});

test('textos da usuária são escapados no cartão', () => {
  const estado = { ...novoEstado(), pac: [novaPaciente({ leito: '<1>', alerg: 'a & <b>', obs: '<script>x</script>', dxs: [{ dx: 'outro', mods: {} }] })] };
  const html = htmlCenso({ estado, ctx: contexto(estado), hoje: HOJE }, AGORA);
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;x&lt;/script&gt;'));
  assert.ok(html.includes('Leito &lt;1&gt;'));
  assert.ok(html.includes('a &amp; &lt;b&gt;'));
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
