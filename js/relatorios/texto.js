// Texto de passagem de plantão (sem identificação de pacientes), pronto para colar.
import { ordenarPacientes } from '../nucleo/estado.js';
import { instantaneo, mudancasDesde } from '../nucleo/mudancas.js';
import { resumoPaciente } from './comum.js';

const ddmm = iso => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const dmy = iso => `${ddmm(iso)}/${iso.slice(0, 4)}`;
const MARCA = { vermelho: '⚠ ', amarelo: '• ', cinza: '✓ ' };

function bloco(pac, hoje, ctx, mudou) {
  const r = resumoPaciente(pac, hoje, ctx);
  const cab = [`LEITO ${r.leito}`, r.ig === 'IG não informada' ? r.ig : `IG ${r.ig}`];
  if (r.dia !== null) cab.push(`D${r.dia}`);
  if (r.idade !== null && r.idade !== '') cab.push(`${r.idade}a`);
  if (r.gpca) cab.push(r.gpca);
  const L = [cab.join(' · ')];
  if (r.dxExtenso.length) L.push('Dx: ' + r.dxExtenso.join('; '));
  if (r.alerg) L.push('Alergias: ' + r.alerg);
  for (const a of r.alertas) L.push(MARCA[a.nivel] + a.msg);
  if (mudou?.length) L.push('Mudou: ' + mudou.join(' · '));
  const hojeItens = [
    ...r.atrasadas.map(p => `[ ] ${p.texto} (atrasado ${p.diasAtraso}d)`),
    ...r.hoje.map(p => `[ ] ${p.texto}`),
  ];
  if (hojeItens.length) L.push('Hoje: ' + hojeItens.join(' · '));
  if (r.aguardando.length) {
    L.push('Aguardando resultado: ' + r.aguardando
      .map(p => p.aguardandoDesde ? `${p.texto} (desde ${ddmm(p.aguardandoDesde)})` : p.texto).join(' · '));
  }
  if (r.tratamentos.length) L.push('Tratamentos: ' + r.tratamentos.join(' · '));
  if (r.foraFaixa.length) L.push('Fora da faixa: ' + r.foraFaixa.join(' · '));
  const feitos = r.linhaTempo.filter(e => e.texto !== 'Internação');
  if (feitos.length) {
    const itens = feitos.slice(-5).map(e => `${ddmm(e.data)} ${e.texto}`);
    const mais = feitos.length - itens.length;
    L.push('Feito: ' + itens.join(' · ') + (mais > 0 ? ` · +${mais} anteriores` : ''));
  }
  if (r.obs) L.push('Obs: ' + r.obs);
  return L.join('\n');
}

export function textoPlantao(estado, hoje, ctx) {
  const mud = estado.ultimoPlantao
    ? mudancasDesde(estado.ultimoPlantao.snap, instantaneo(estado, hoje, ctx), estado, hoje, ctx)
    : {};
  const blocos = ordenarPacientes(estado.pac).map(p => bloco(p, hoje, ctx, mud[p.id]));
  return [
    `PASSAGEM DE PLANTÃO — Enfermaria de alto risco — ${dmy(hoje)}`,
    '(sem identificação de pacientes)',
    '',
    blocos.join('\n\n'),
  ].join('\n');
}
