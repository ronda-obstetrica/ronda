// Utilitários de data (ISO local 'YYYY-MM-DD') e idade gestacional (IG) em dias.
const MS_DIA = 86400000;
const pad = (n) => String(n).padStart(2, '0');
const utc = (iso) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); };

export function hojeISO(agora = new Date()) {
  return `${agora.getFullYear()}-${pad(agora.getMonth() + 1)}-${pad(agora.getDate())}`;
}

export function addDias(iso, n) {
  const d = new Date(utc(iso) + n * MS_DIA);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function diffDias(de, ate) {
  return Math.round((utc(ate) - utc(de)) / MS_DIA);
}

export function parseIG(txt) {
  const m = /^\s*(\d{1,2})\s*(?:\+\s*([0-6]))?\s*$/.exec(String(txt ?? ''));
  if (!m) return null;
  return Number(m[1]) * 7 + Number(m[2] ?? 0);
}

export function fmtIG(dias) {
  return `${Math.floor(dias / 7)}+${dias % 7}`;
}

export function igHoje(pac, hoje) {
  if (pac.igDays == null || !pac.igRef) return null;
  return pac.igDays + diffDias(pac.igRef, hoje);
}
