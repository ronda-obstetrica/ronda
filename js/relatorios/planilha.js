// Planilha .xlsx do censo (sem identificação de pacientes).
import { ordenarPacientes } from '../nucleo/estado.js';
import { DIAGNOSTICOS, partesExtenso } from '../nucleo/diagnosticos.js';
import { resumoPaciente } from './comum.js';

export const COLUNAS = ['Leito', 'Idade', 'G/P/C/A', 'IG hoje', 'Dia de internação', 'Diagnósticos', 'Modificadores', 'Alergias', 'Alertas ativos', 'Alertas feitos', 'Pendências abertas', 'Pendências atrasadas', 'Aguardando resultado', 'Fora da faixa hoje', 'Observação'];

const juntar = (v) => v.join('; ');
const txt = (v) => (v === null || v === undefined ? '' : String(v));

function linha(pac, hoje, ctx) {
  const r = resumoPaciente(pac, hoje, ctx);
  const abertas = pac.pend.filter(p => !p.done && !(p.cat === 'Exame' && p.estadoExame === 'aguardando') && p.due >= hoje);
  return [
    r.leito,
    r.idade,
    r.gpca,
    r.ig,
    r.dia === null ? '' : 'D' + r.dia,
    juntar(pac.dxs.map(d => DIAGNOSTICOS[d.dx]?.nome ?? d.dx)),
    juntar(pac.dxs.flatMap(partesExtenso)),
    r.alerg,
    juntar(r.alertas.filter(a => a.nivel === 'vermelho' || a.nivel === 'amarelo').map(a => a.msg)),
    juntar(r.alertas.filter(a => a.nivel === 'cinza' && a.estado === 'feito').map(a => a.msg)),
    juntar(abertas.map(p => p.texto)),
    juntar(r.atrasadas.map(p => `${p.texto} (${p.diasAtraso}d)`)),
    juntar(r.aguardando.map(p => p.texto)),
    juntar(r.foraFaixa),
    r.obs,
  ].map(txt);
}

export function linhasPlanilha(estado, hoje, ctx) {
  return [[...COLUNAS], ...ordenarPacientes(estado.pac).map(p => linha(p, hoje, ctx))];
}

export function gerarXlsx(linhas, XLSX = globalThis.XLSX) {
  const ws = XLSX.utils.aoa_to_sheet(linhas);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Censo');
  const dados = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new Blob([dados], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
