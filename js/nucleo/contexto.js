// Contexto de avaliação: regras e faixas globais mescladas com as do serviço.
import { parseRegras, REGRAS_GLOBAIS } from './regras.js';
import { parseFaixas, FAIXAS_GLOBAIS } from './faixas.js';
import { mesclarPorId } from './textoregras.js';
import { definirDxCustom } from './diagnosticos.js';

export function contexto(estado) {
  definirDxCustom(estado.dxCustom ?? [], estado.dxOcultos ?? []);
  const { itens, desligar, erros } = parseRegras(estado.regrasServico ?? '');
  const fx = parseFaixas(estado.faixasServico ?? '');
  return {
    regras: mesclarPorId(REGRAS_GLOBAIS, { itens, desligar }),
    faixas: mesclarPorId(FAIXAS_GLOBAIS, { itens: fx.itens, desligar: fx.desligar }, []),
    errosRegras: erros,
    errosFaixas: fx.erros,
  };
}
