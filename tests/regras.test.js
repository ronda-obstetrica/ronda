import { test } from 'node:test'; import assert from 'node:assert/strict';
import { parseRegras, formatarRegra } from '../js/nucleo/regras.js';
import { parseAlvo, casaAlvo, mesclarPorId, dividirLinhas, grupo, especificidade } from '../js/nucleo/textoregras.js';
test('linha válida', () => {
  const { itens, erros } = parseRegras('res-colestase | colestase | 37+0 | 37+6 | vermelho | Resolução | HU-X');
  assert.deepEqual(erros, []);
  assert.equal(itens[0].ini, 259); assert.equal(itens[0].fim, 265); assert.equal(itens[0].tipo, 'resolucao');
});
test('alvo com exige e proibe', () =>
  assert.deepEqual(parseAlvo('dmg+medicacao!controle-ruim'), { dx: 'dmg', exige: ['medicacao'], proibe: ['controle-ruim'] }));
test('desligar', () => assert.deepEqual(parseRegras('-corticoide').desligar, ['corticoide']));
test('linhas ruins viram erro e não derrubam as boas', () => {
  const r = parseRegras(['a | dmg | 37,0 | | vermelho | x | y', 'b | xyz | 30+0 | | vermelho | x | y',
    'c | dmg | 30+0 | | roxo | x | y', 'd | dmg', 'ok | dmg | 30+0 | | amarelo | m | f'].join('\n'));
  assert.deepEqual(r.erros.map(e => e.n), [1, 2, 3, 4]); assert.equal(r.itens.length, 1);
  assert.equal(r.erros[0].msg, 'IG início inválida: "37,0" (use 37+0)');
  assert.equal(r.erros[1].msg, 'diagnóstico desconhecido: "xyz"');
  assert.equal(r.erros[2].msg, 'nível inválido: "roxo" (use vermelho ou amarelo)');
  assert.equal(r.erros[3].msg, 'linha incompleta: esperados pelo menos 7 campos');
});
test('ida e volta', () => { const t = 'x | dheg+pe!gravidade | 37+0 |  | vermelho | M | F | 7 | ';
  assert.deepEqual(parseRegras(formatarRegra(parseRegras(t).itens[0])).itens, parseRegras(t).itens); });
test('ida e volta com alvo vazio e repetir', () => { const t = 'x |  | 30+0 | 32+0 | amarelo | M | F |  | 3';
  const r = parseRegras(t); assert.deepEqual(r.erros, []); assert.equal(r.itens[0].tipo, 'pendencia');
  assert.deepEqual(parseRegras(formatarRegra(r.itens[0])).itens, r.itens); });
test('numeração conta linhas em branco e comentários; campos demais; fim < ini', () => {
  const r = parseRegras(['# c', '', 'a | dmg | 30+0 | | amarelo | m | f | 1 | 2 | 3', 'b | dmg | 30+0 | 29+0 | amarelo | m | f',
    'c | dmg | 30+0 | | amarelo | | f', 'C! | dmg | 30+0 | | amarelo | m | f', 'd | dmg | 30+0 | | amarelo | m | f | -1'].join('\n'));
  assert.deepEqual(r.erros.map(e => e.n), [3, 4, 5, 6, 7]); assert.equal(r.itens.length, 0);
});
test('dividirLinhas, grupo, especificidade', () => {
  assert.deepEqual(dividirLinhas('# x\n\n a | b '), [{ n: 3, campos: ['a', 'b'] }]);
  assert.equal(grupo('res-dmg-a2'), 'res-dmg'); assert.equal(grupo('corticoide'), 'corticoide');
  assert.equal(especificidade(parseAlvo('dmg+a!b')), 2);
  assert.ok(parseAlvo('xyz') instanceof Error);
});
test('mesclar substitui, desliga, acrescenta e herda', () => {
  const g = [{ id: 'a', antecedencia: 7, msg: 'g' }, { id: 'b', antecedencia: null, msg: 'g' }];
  const m = mesclarPorId(g, { itens: [{ id: 'a', antecedencia: null, msg: 's' }, { id: 'c', msg: 'n' }], desligar: ['b'] });
  assert.deepEqual(m.map(x => [x.id, x.msg, x.antecedencia ?? null]), [['a','s',7], ['c','n',null]]);
});
test('casaAlvo', () => {
  const dxs = [{ dx: 'dmg', mods: { medicacao: true, 'controle-ruim': true } }];
  assert.equal(casaAlvo(parseAlvo('dmg+medicacao!controle-ruim'), dxs), false);
  assert.equal(casaAlvo(parseAlvo('dmg+controle-ruim'), dxs), true);
  assert.equal(casaAlvo(parseAlvo(''), dxs), true);
  assert.equal(casaAlvo(parseAlvo(''), []), true);
  assert.equal(casaAlvo(parseAlvo('+medicacao'), []), false);
  assert.equal(casaAlvo(parseAlvo('+medicacao'), dxs), true);
});
