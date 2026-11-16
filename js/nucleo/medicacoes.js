// Medicações em curso com contador de dias (D3/7) — dados de apoio, sem prescrição.
import { diffDias } from './datas.js';
import { LIMITE_MED, cortar, normalizarPrevistos } from './estado.js';

const novoId = () => globalThis.crypto.randomUUID().slice(0, 8);

function isoValido(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function novaMed({ texto = '', inicio = '', previstos = null, contar = true, fim = null } = {}) {
  return {
    id: novoId(), texto: cortar(texto, LIMITE_MED), inicio, previstos: normalizarPrevistos(previstos), contar: contar !== false,
    ...(isoValido(fim) ? { fim } : {}),
  };
}

export function diaMed(med, hoje) {
  if (!med || typeof med !== 'object' || med.fim || med.contar === false || !isoValido(med.inicio) || med.inicio > hoje) return null;
  const d = diffDias(med.inicio, hoje) + 1;
  const total = normalizarPrevistos(med.previstos);
  const situacao = d === total ? 'ultimo' : total && d > total ? 'terminou' : 'curso';
  return { d, total, situacao };
}

export function rotuloMed(med, hoje) {
  const r = diaMed(med, hoje);
  if (!r) return String(med?.texto ?? '');
  let s = `${med.texto} · D${r.d}${r.total ? '/' + r.total : ''}`;
  if (r.situacao === 'ultimo') s += ' · último dia';
  else if (r.situacao === 'terminou') s += ' · terminou — suspender?';
  return s;
}

// Medicação já utilizada: tem data de suspensão (fim). Ex.: "Cefalexina · 06/11 a 12/11 · 7 dias".
export function rotuloUsada(med) {
  const texto = String(med?.texto ?? '');
  const ddmm = (s) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
  if (!isoValido(med?.fim)) return texto;
  if (!isoValido(med.inicio)) return `${texto} · suspensa em ${ddmm(med.fim)}`;
  const dias = diffDias(med.inicio, med.fim) + 1;
  return `${texto} · ${ddmm(med.inicio)} a ${ddmm(med.fim)} · ${dias} ${dias === 1 ? 'dia' : 'dias'}`;
}

export function adicionarMed(pac, med) { pac.meds.push(med); return pac; }

export function editarMed(pac, medId, campos) {
  const m = pac.meds.find(x => x.id === medId);
  if (m) {
    const { id: _id, ...resto } = campos;
    Object.assign(m, resto);
    if (resto.previstos !== undefined) m.previstos = normalizarPrevistos(resto.previstos);
    if (campos.texto !== undefined) m.texto = cortar(campos.texto, LIMITE_MED);
    if ('fim' in resto && !isoValido(resto.fim)) delete m.fim;
  }
  return pac;
}

export function removerMed(pac, medId) { pac.meds = pac.meds.filter(x => x.id !== medId); return pac; }

// Suspender move a medicação para as já utilizadas (guarda a data); retomar a devolve às em curso.
export function suspenderMed(pac, medId, hoje) {
  const m = pac.meds.find(x => x.id === medId);
  if (m && !m.fim) m.fim = isoValido(m.inicio) && hoje < m.inicio ? m.inicio : hoje;
  return pac;
}

export function retomarMed(pac, medId) {
  const m = pac.meds.find(x => x.id === medId);
  if (m) delete m.fim;
  return pac;
}
