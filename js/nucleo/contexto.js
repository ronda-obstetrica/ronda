// Contexto de avaliação: regras globais mescladas com as do serviço.
import { parseRegras, REGRAS_GLOBAIS } from './regras.js';
import { mesclarPorId } from './textoregras.js';

export function contexto(estado) {
  const { itens, desligar, erros } = parseRegras(estado.regrasServico ?? '');
  return {
    regras: mesclarPorId(REGRAS_GLOBAIS, { itens, desligar }),
    faixas: [],
    errosRegras: erros,
    errosFaixas: [],
  };
}
