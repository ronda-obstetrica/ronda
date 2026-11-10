// HTML da página da paciente gerado no Node (sem DOM): ordem das seções, "N de M", "Mudou", medicações, sugestões e escape.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { novoEstado, seedExemplos, novaPaciente } from '../js/nucleo/estado.js';
import { contexto } from '../js/nucleo/contexto.js';
import { marcarPlantao } from '../js/nucleo/mudancas.js';
import { registrar } from '../js/nucleo/faixas.js';
import { sugestoes } from '../js/nucleo/sugestoes.js';
import { novaMed } from '../js/nucleo/medicacoes.js';
import { htmlPaciente, indiceAtual, acoes, htmlMedForm, htmlProgForm, lerMedForm } from '../js/ui/paciente.js';
import { esc } from '../js/ui/util.js';

const HOJE = '2026-11-08';
const AGORA = new Date(`${HOJE}T12:00`);
const comSeed = () => ({ ...novoEstado(), pac: seedExemplos(HOJE) });
const html = (estado, id) => htmlPaciente({ estado, ctx: contexto(estado), hoje: HOJE }, { id, agora: AGORA });
const pacDo = (estado, leito) => estado.pac.find((p) => p.leito === leito);
// Recorta a tela de um leito.
const tela = (h, pacId) => {
  const ini = h.indexOf(`id="paciente-${pacId}"`);
  const fim = h.indexOf('class="v-leito-tela"', ini + 1);
  return h.slice(ini, fim < 0 ? undefined : fim);
};
const mudarUma = (estado, id, campos) => ({ ...estado, pac: estado.pac.map((x) => (x.id === id ? { ...x, ...campos } : x)) });

test('uma tela por leito em ordem natural e indicador "N de M" no leito pedido', () => {
  const estado = comSeed();
  const h = html(estado, pacDo(estado, '07').id);
  assert.deepEqual([...h.matchAll(/class="v-leito">Leito (\d+)</g)].map((m) => m[1]), ['04', '07', '09']);
  assert.match(h, /class="v-indicador"[^>]*>2 de 3</);
  assert.match(html(estado, 'nao-existe'), /class="v-indicador"[^>]*>1 de 3</);
  assert.match(h, /data-act="paciente-ir" data-dir="-1"/);
  assert.match(h, /data-act="paciente-ir" data-dir="1"/);
  assert.match(h, /data-act="aba" data-aba="censo">‹ Lista</);
  assert.doesNotMatch(h, /undefined|NaN|Linha do tempo/);
});

test('indiceAtual: paciente que saiu mantém a posição, sem passar do fim', () => {
  const pacs = [{ id: 'a' }, { id: 'b' }];
  assert.equal(indiceAtual(pacs, 'b', 0), 1);
  assert.equal(indiceAtual(pacs, 'x', 1), 1);
  assert.equal(indiceAtual(pacs, 'x', 5), 1);
  assert.equal(indiceAtual(pacs, null, 0), 0);
});

test('ordem: cabeçalho → mudou → diagnósticos → alertas → medicações → programação → pendências → tratamentos → controles', () => {
  let estado = comSeed();
  const p04 = pacDo(estado, '04');
  estado = marcarPlantao(estado, '2026-11-07', contexto(estado));
  // Depois do plantão de ontem: registra PA alta e cria um tratamento em curso.
  const trat = { id: 't1', texto: 'Sulfato de magnésio', cat: 'Medicação', due: HOJE, done: false,
    dur: { unidade: 'horas', total: 24, inicio: `${HOJE}T08:00` } };
  estado = { ...estado, pac: estado.pac.map((p) => (p.id === p04.id
    ? { ...registrar(p, { data: HOJE, medida: 'pa', valor: { s: 165, d: 100 } }), pend: [...p.pend, trat] } : p)) };
  const t = tela(html(estado, p04.id), p04.id);
  const marcos = ['class="v-leito"', 'Mudou desde o último plantão', '<h3>Diagnósticos</h3>', '<h3>Alertas</h3>', '<h3>Medicações</h3>',
    '<h3>Programação</h3>', '<h3>Pendências</h3>', '<h3>Tratamentos</h3>', 'Controles de hoje'];
  const pos = marcos.map((m) => t.indexOf(m));
  assert.ok(pos.every((p) => p >= 0), `seções ausentes: ${marcos.filter((m, i) => pos[i] < 0)}`);
  assert.deepEqual([...pos].sort((a, b) => a - b), pos, 'seções fora de ordem');
  assert.match(t, /Fora da faixa: PA 165x100/);
  assert.match(t, /registro vermelho/);
  assert.match(t, /Crise hipertensiva/);
  assert.match(t, /class="v-dia">D7</);
  assert.match(t, /Sulfato de magnésio <span class="prog">/);
});

test('seções da página: Medicações, Programação, Sugestões, Pendências e "+ Pendência" no topo da seção', () => {
  const estado = comSeed();
  const t = tela(html(estado, pacDo(estado, '04').id), pacDo(estado, '04').id);
  for (const h of ['<h3>Medicações</h3>', '<h3>Programação</h3>', '<h3>Pendências</h3>']) assert.ok(t.includes(h), h);
  assert.match(t, /<details class="bloco" data-k="sugestoes"><summary>Sugestões \(\d+\)<\/summary>/);
  assert.match(t, /<h3>Pendências<\/h3><button type="button" data-act="pend-nova" data-id="[^"]+" class="primario pend-nova">\+ Pendência<\/button>/);
  assert.match(t, /data-act="med-nova"[^>]*>\+ Medicação/);
  assert.match(t, /data-act="alta"/);
  assert.match(t, /data-act="editar"/);
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

test('cabeçalho: iniciais, paridade, idade, D e alergia em destaque', () => {
  const estado = comSeed();
  const p = pacDo(estado, '04');
  const t = tela(html(mudarUma(estado, p.id, { iniciais: 'MAS' }), p.id), p.id);
  assert.match(t, /class="v-info">MAS · G2P1C1A0 · 27a</);
  assert.match(t, /<strong>⚠ Alergia:<\/strong> Dipirona/);
});

test('"Mudou" some sem plantão de comparação e quando o leito não mudou', () => {
  let estado = comSeed();
  assert.doesNotMatch(html(estado), /Mudou desde o último plantão/);
  estado = marcarPlantao(estado, '2026-11-07', contexto(estado));
  assert.doesNotMatch(html(estado), /Mudou desde o último plantão/);
  // Desliga um modificador no 07: só ele mostra "Mudou".
  const p07 = pacDo(estado, '07');
  estado = mudarUma(estado, p07.id, { dxs: [{ dx: 'dmg', mods: { medicacao: true } }] });
  const h = html(estado);
  assert.equal((h.match(/Mudou desde o último plantão/g) || []).length, 1);
  assert.match(tela(h, p07.id), /Mudou desde o último plantão[\s\S]*Diagnóstico\/modificador:/);
});

test('textos da usuária escapados (atributos e conteúdo)', () => {
  const xss = '<img src=x onerror=alert(1)>';
  const pac = novaPaciente({ leito: '"><img src=x onerror=alert(1)>', alerg: xss, iniciais: xss, prog: xss, meds: [novaMed({ texto: xss, inicio: HOJE })],
    dxs: [{ dx: 'dheg', mods: {} }], pend: [{ id: '"x', texto: xss, cat: 'Exame', due: HOJE, done: false }] });
  let estado = { ...novoEstado(), pac: [pac] };
  estado = marcarPlantao(estado, '2026-11-07', contexto(estado));
  estado = { ...estado, pac: [{ ...registrar(estado.pac[0], { data: HOJE, medida: 'pa', valor: { s: 165, d: 100 } }) }] };
  const h = html(estado);
  assert.ok(!h.includes('<img'), 'tag injetada');
  assert.ok(!/"><img/.test(h));
  assert.ok(h.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.match(h, /Mudou desde o último plantão/);
});

test('sem pacientes: estado vazio com "+ Paciente" e "‹ Lista"', () => {
  const h = html(novoEstado());
  assert.match(h, /Nenhuma paciente/);
  assert.match(h, /data-act="novo"/);
  assert.match(h, /data-act="aba" data-aba="censo"/);
  assert.doesNotMatch(h, /v-trilho/);
});

test('medicações: rótulo com dia, destaque no último dia e ao terminar, e escape', () => {
  const meds = [
    novaMed({ texto: 'Ampicilina', inicio: '2026-11-06', previstos: 3 }), // D3/3: último dia
    novaMed({ texto: 'Cefalexina', inicio: '2026-11-01', previstos: 3 }), // D8/3: terminou
    novaMed({ texto: 'Nifedipina', inicio: '2026-11-07', previstos: 7 }), // em curso
    novaMed({ texto: '<img src=x onerror=alert(1)>', inicio: HOJE, contar: false }),
  ];
  const estado = comSeed();
  const p = pacDo(estado, '04');
  const t = tela(html(mudarUma(estado, p.id, { meds }), p.id), p.id);
  assert.match(t, /class="med med-ultimo"><span class="med-txt">Ampicilina · D3\/3 · último dia</);
  assert.match(t, /class="med med-terminou"><span class="med-txt">Cefalexina · D8\/3 · terminou/);
  assert.match(t, /class="med"><span class="med-txt">Nifedipina · D2\/7</);
  assert.ok(!t.includes('<img'));
  assert.ok(t.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.match(t, /data-act="med-editar"/);
  assert.match(t, /data-act="med-remover"/);
});

test('programação: texto na página e formulário com limite', () => {
  const estado = comSeed();
  const p = pacDo(estado, '04');
  const e2 = mudarUma(estado, p.id, { prog: 'Cesárea amanhã <b>' });
  assert.ok(tela(html(e2, p.id), p.id).includes('Cesárea amanhã &lt;b&gt;'));
  assert.match(htmlProgForm(pacDo(e2, '04')), /name="prog" maxlength="240"/);
});

test('formulário de medicação: início hoje, dias opcionais, contar dias ligado; leitura valida', () => {
  const p = pacDo(comSeed(), '04');
  const f = htmlMedForm(p, null, HOJE);
  assert.match(f, /name="texto" maxlength="60"/);
  assert.match(f, new RegExp(`type="date" name="inicio" value="${HOJE}"`));
  assert.match(f, /type="number" name="previstos"[^>]*value=""/);
  assert.match(f, /name="contar" checked/);
  const m = novaMed({ texto: 'X', inicio: '2026-11-01', previstos: 5, contar: false });
  const g = htmlMedForm(p, m, HOJE);
  assert.match(g, /value="2026-11-01"/);
  assert.doesNotMatch(g, /name="contar" checked/);
  const el = (texto, inicio, previstos, contar) => ({ texto: { value: texto }, inicio: { value: inicio }, previstos: { value: previstos }, contar: { checked: contar } });
  assert.equal(lerMedForm(el(' ', '', '', true), HOJE).erro, 'Escreva a medicação.');
  assert.match(lerMedForm(el('A', '', '0', true), HOJE).erro, /Dias previstos/);
  assert.deepEqual(lerMedForm(el(' A ', '', '', false), HOJE).campos, { texto: 'A', inicio: HOJE, previstos: null, contar: false });
});

// ---------- Sugestões e ações ----------

function apiFalsa(estadoInicial, { salvarOk = true } = {}) {
  let estado = estadoInicial;
  const avisos = [];
  let folha = null;
  let fechou = 0;
  return {
    avisos, get folha() { return folha; }, get fechou() { return fechou; },
    atualizar(m) { const n = m(estado); if (!n) return false; if (salvarOk) estado = n; return salvarOk; },
    abrirFolha(h) { folha = h; }, fecharFolha() { fechou++; }, avisar(msg) { avisos.push(msg); },
    get estado() { return estado; }, get ctx() { return contexto(estado); }, get hoje() { return HOJE; },
  };
}

const comSugestao = () => {
  const estado = comSeed();
  const p = pacDo(estado, '04');
  const sug = sugestoes(p, estado, HOJE, contexto(estado));
  assert.ok(sug.length > 1, 'o seed deveria ter sugestões');
  return { estado, p, sug };
};

test('sugestões: aceitar/dispensar com data-chave escapado, "adicionar todas", nada serializado', () => {
  const { estado, p, sug } = comSugestao();
  const t = tela(html(estado, p.id), p.id);
  assert.match(t, /data-act="sug-aceitar" data-id="[^"]+" data-chave="[^"]+"/);
  assert.match(t, /data-act="sug-dispensar" data-id="[^"]+" data-chave="[^"]+"/);
  assert.ok(t.includes(`data-chave="${esc(sug[0].chave)}"`));
  assert.match(t, /data-act="sug-todas"/);
  assert.doesNotMatch(t, /data-sug=|data-texto=/);
  // chave com aspas não quebra o atributo
  const th = tela(html(mudarUma(estado, p.id, { sugDispensadas: ['x"><img src=x>'] }), p.id), p.id);
  assert.ok(!th.includes('<img src=x>'));
  assert.match(th, /ver dispensadas \(1\)/);
});

test('aceitar sugestão cria a pendência; dispensar esconde e restaurar traz de volta', () => {
  const { estado, p, sug } = comSugestao();
  const api = apiFalsa(estado);
  const achar = () => api.estado.pac.find((x) => x.id === p.id);
  acoes['sug-aceitar'](null, { dataset: { id: p.id, chave: sug[0].chave } }, api);
  assert.equal(achar().pend.length, p.pend.length + 1);
  assert.equal(achar().pend.at(-1).sug, sug[0].chave);
  assert.ok(!sugestoes(achar(), api.estado, HOJE, api.ctx).some((s) => s.chave === sug[0].chave));
  assert.deepEqual(api.avisos, ['Virou pendência.']);

  const outra = sugestoes(achar(), api.estado, HOJE, api.ctx)[0];
  acoes['sug-dispensar'](null, { dataset: { id: p.id, chave: outra.chave } }, api);
  assert.ok(achar().sugDispensadas.includes(outra.chave));
  assert.ok(!sugestoes(achar(), api.estado, HOJE, api.ctx).some((s) => s.chave === outra.chave));
  assert.ok(!tela(html(api.estado, p.id), p.id).includes(`data-act="sug-aceitar" data-id="${p.id}" data-chave="${esc(outra.chave)}"`));

  acoes['sug-dispensadas'](null, { dataset: { id: p.id } }, api);
  assert.match(api.folha, /Sugestões dispensadas/);
  assert.match(api.folha, /data-act="sug-restaurar"/);
  acoes['sug-restaurar'](null, { dataset: { id: p.id, chave: outra.chave } }, api);
  assert.ok(sugestoes(achar(), api.estado, HOJE, api.ctx).some((s) => s.chave === outra.chave));
});

test('aceitar todas cria uma pendência por sugestão; chave inexistente não faz nada', () => {
  const { estado, p, sug } = comSugestao();
  const api = apiFalsa(estado);
  const achar = () => api.estado.pac.find((x) => x.id === p.id);
  acoes['sug-aceitar'](null, { dataset: { id: p.id, chave: 'nao:existe' } }, api);
  assert.equal(achar().pend.length, p.pend.length);
  acoes['sug-todas'](null, { dataset: { id: p.id } }, api);
  assert.equal(achar().pend.length, p.pend.length + sug.length);
  assert.equal(sugestoes(achar(), api.estado, HOJE, api.ctx).length, 0);
});

test('falha ao salvar: sem aviso de sucesso e a folha continua aberta', () => {
  const { estado, p, sug } = comSugestao();
  const api = apiFalsa(estado, { salvarOk: false });
  acoes['sug-aceitar'](null, { dataset: { id: p.id, chave: sug[0].chave } }, api);
  acoes['sug-todas'](null, { dataset: { id: p.id } }, api);
  acoes['med-salvar'](null, { dataset: { id: p.id, med: '' }, elements: { texto: { value: 'Ampicilina' }, inicio: { value: HOJE }, previstos: { value: '7' }, contar: { checked: true } } }, api);
  acoes['prog-salvar'](null, { dataset: { id: p.id }, elements: { prog: { value: 'Alta amanhã' } } }, api);
  assert.deepEqual(api.avisos, []);
  assert.equal(api.fechou, 0);
});

test('medicação: adicionar, editar e remover sem mutar o estado anterior; programação salva', () => {
  const estado = comSeed();
  const p = pacDo(estado, '04');
  const api = apiFalsa(estado);
  const achar = () => api.estado.pac.find((x) => x.id === p.id);
  const form = (med, v) => ({ dataset: { id: p.id, med }, elements: {
    texto: { value: v.texto }, inicio: { value: v.inicio }, previstos: { value: v.previstos }, contar: { checked: v.contar } } });
  acoes['med-salvar'](null, form('', { texto: 'Ampicilina', inicio: '2026-11-06', previstos: '7', contar: true }), api);
  assert.equal(p.meds.length, 0, 'estado antigo intacto');
  assert.equal(achar().meds.length, 1);
  assert.deepEqual({ ...achar().meds[0], id: 'x' }, { id: 'x', texto: 'Ampicilina', inicio: '2026-11-06', previstos: 7, contar: true });
  assert.equal(api.fechou, 1);
  assert.match(api.avisos.at(-1), /Medicação adicionada ao leito 04/);

  const velho = achar().meds[0];
  acoes['med-salvar'](null, form(velho.id, { texto: 'Ampicilina 2g', inicio: '2026-11-06', previstos: '', contar: false }), api);
  assert.equal(velho.texto, 'Ampicilina', 'objeto antigo intacto');
  assert.equal(achar().meds[0].texto, 'Ampicilina 2g');
  assert.equal(achar().meds[0].previstos, null);
  assert.equal(achar().meds[0].contar, false);

  const confirmOrig = globalThis.confirm;
  globalThis.confirm = () => true;
  try { acoes['med-remover'](null, { dataset: { id: p.id, med: velho.id } }, api); } finally { globalThis.confirm = confirmOrig; }
  assert.equal(achar().meds.length, 0);

  acoes['prog-salvar'](null, { dataset: { id: p.id }, elements: { prog: { value: '  Cesárea 10/11  ' } } }, api);
  assert.equal(achar().prog, 'Cesárea 10/11');
});

test('iniciais aparecem na página; nunca no texto do plantão', async () => {
  const { textoPlantao } = await import('../js/relatorios/texto.js');
  const estado = comSeed();
  const p = pacDo(estado, '04');
  const e2 = mudarUma(estado, p.id, { iniciais: 'QZK' });
  assert.ok(html(e2, p.id).includes('QZK'));
  assert.ok(!textoPlantao(e2, HOJE, contexto(e2)).includes('QZK'));
});
