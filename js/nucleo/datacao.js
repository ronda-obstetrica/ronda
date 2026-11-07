// Datação da gestação: DUM x 1ª USG, com limites de discrepância (ACOG CO 700).
import { diffDias } from './datas.js';

export const igPorDUM = (dum, data) => diffDias(dum, data);
export const igPorUSG = (dataUsg, igNaUsg, data) => igNaUsg + diffDias(dataUsg, data);

export function limiteDiscrepancia(igNaUsg) {
  if (igNaUsg < 63) return 5;
  if (igNaUsg < 112) return 7;
  if (igNaUsg < 154) return 10;
  if (igNaUsg < 196) return 14;
  return 21;
}

export function sugerirDatacao({ dum, usg } = {}, hoje) {
  if (!dum && !usg) return null;
  const igDumHoje = dum ? igPorDUM(dum, hoje) : null;
  const igUsgHoje = usg ? igPorUSG(usg.data, usg.igDias, hoje) : null;
  if (!dum || !usg) {
    return { fonte: dum ? 'dum' : 'usg', igDumHoje, igUsgHoje, diferenca: null, limite: null };
  }
  const diferenca = Math.abs(igPorDUM(dum, usg.data) - usg.igDias);
  const limite = limiteDiscrepancia(usg.igDias);
  return { fonte: diferenca > limite ? 'usg' : 'dum', igDumHoje, igUsgHoje, diferenca, limite };
}

export function aplicarDatacao(pac, datacao, hoje) {
  const igDays = datacao.escolhida === 'usg'
    ? igPorUSG(datacao.usg.data, datacao.usg.igDias, hoje)
    : igPorDUM(datacao.dum, hoje);
  return { ...pac, datacao, igDays, igRef: hoje };
}
