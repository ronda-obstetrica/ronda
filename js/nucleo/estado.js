// Estado v2: modelo, persistência, seed, backup e ordenação de leitos.
import { hojeISO, addDias, diffDias } from './datas.js';
import { PROT_PADRAO } from './pendencias.js';

export const CHAVE = 'ronda-obstetrica-v2';
export const CHAVE_CORROMPIDO = 'ronda-obstetrica-v2-corrompido';
export const LIMITE_OBS = 240;
export const LIMITE_RES = 80;

export function novoEstado() {
  return {
    v: 2,
    prot: { ...PROT_PADRAO },
    regrasServico: '',
    faixasServico: '',
    pac: [],
    ultimoPlantao: null,
    ultimoBackup: null,
  };
}

export function cortar(txt, max) {
  return String(txt ?? '').trim().slice(0, max);
}

function novoId() {
  return globalThis.crypto.randomUUID().slice(0, 8);
}

export function novaPaciente(dados = {}) {
  const base = {
    id: novoId(), leito: '', idade: null, g: 0, p: 0, c: 0, a: 0,
    igDays: null, igRef: null,
    datacao: { dum: null, usg: null, escolhida: null },
    dxs: [], int: '', alerg: '', obs: '', ex: false,
    pend: [], alertasFeitos: [], dispensadas: [], registros: [],
  };
  const p = { ...base, ...dados };
  p.obs = cortar(p.obs, LIMITE_OBS);
  return p;
}

export function seedExemplos(hoje) {
  const datacao = () => ({ dum: null, usg: null, escolhida: null });
  const mk = (o) => novaPaciente({ igRef: hoje, datacao: datacao(), ex: true, ...o });
  return [
    mk({ leito: '04', idade: 27, g: 2, p: 1, c: 1, a: 0, igDays: 31 * 7 + 2,
      int: addDias(hoje, -6), alerg: 'Dipirona',
      dxs: [{ dx: 'dheg', mods: { tipo: 'pe', gravidade: true } }] }),
    mk({ leito: '07', idade: 34, g: 3, p: 2, c: 0, a: 0, igDays: 37 * 7 + 1,
      int: addDias(hoje, -2),
      dxs: [{ dx: 'dmg', mods: { medicacao: true, 'controle-ruim': true } }] }),
    mk({ leito: '09', idade: 19, g: 1, p: 0, c: 0, a: 0, igDays: 29 * 7 + 5,
      int: addDias(hoje, -11), alerg: 'Penicilina',
      dxs: [{ dx: 'rpmo', mods: {} }],
      alertasFeitos: [{ id: 'corticoide', data: addDias(hoje, -12), res: '' }] }),
  ];
}

function formatoValido(e) {
  return !!e && typeof e === 'object' && e.v === 2 && Array.isArray(e.pac);
}

export function carregar(storage = globalThis.localStorage) {
  let bruto = null;
  try { bruto = storage.getItem(CHAVE); } catch { bruto = null; }
  if (bruto == null) {
    const estado = novoEstado();
    estado.pac = seedExemplos(hojeISO());
    return { estado, aviso: null };
  }
  let obj = null;
  try { obj = JSON.parse(bruto); } catch { obj = null; }
  if (formatoValido(obj)) return { estado: { ...novoEstado(), ...obj }, aviso: null };
  let guardado = true;
  try { storage.setItem(CHAVE_CORROMPIDO, bruto); } catch { guardado = false; }
  const estado = novoEstado();
  estado.pac = seedExemplos(hojeISO());
  return {
    estado,
    aviso: guardado
      ? 'Dados salvos estavam corrompidos. Uma cópia do texto original foi guardada.'
      : 'Dados salvos estavam corrompidos e não foi possível guardar uma cópia.',
  };
}

export function salvar(estado, storage = globalThis.localStorage) {
  try { storage.setItem(CHAVE, JSON.stringify(estado)); return true; } catch { return false; }
}

export function apagarExemplos(estado) {
  return { ...estado, pac: estado.pac.filter((p) => !p.ex) };
}

export function exportarJSON(estado) {
  return JSON.stringify(estado, null, 2);
}

const LISTAS_PAC = ['dxs', 'pend', 'alertasFeitos', 'registros', 'dispensadas'];
const ehObjeto = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

// Paciente do backup: objeto com leito texto/número; listas ausentes viram []; lista de outro tipo = inválido.
function pacienteDoBackup(p) {
  if (!ehObjeto(p)) return null;
  if (typeof p.leito !== 'string' && typeof p.leito !== 'number') return null;
  const out = { ...p };
  for (const k of LISTAS_PAC) {
    if (out[k] === undefined || out[k] === null) out[k] = [];
    else if (!Array.isArray(out[k])) return null;
  }
  if (!out.dxs.every(ehObjeto) || !out.pend.every(ehObjeto)) return null;
  return out;
}

export function importarJSON(texto) {
  let obj;
  try { obj = JSON.parse(texto); } catch { throw new Error('Backup inválido'); }
  if (!formatoValido(obj)) throw new Error('Backup inválido');
  const pac = obj.pac.map(pacienteDoBackup);
  if (pac.some((p) => p === null)) throw new Error('Backup inválido');
  return { ...novoEstado(), ...obj, pac };
}

function partes(leito) {
  const m = /^(\d+)(.*)$/.exec(String(leito).trim());
  return m ? [Number(m[1]), m[2]] : [Infinity, String(leito)];
}

export function compararLeitos(a, b) {
  const [na, sa] = partes(a);
  const [nb, sb] = partes(b);
  if (na !== nb) return na < nb ? -1 : 1;
  const c = sa.localeCompare(sb, 'pt-BR');
  if (c) return c;
  if (a.length !== b.length) return a.length - b.length;
  return a.localeCompare(b, 'pt-BR');
}

export function ordenarPacientes(pac) {
  return [...pac].sort((x, y) => compararLeitos(x.leito, y.leito));
}

export function precisaLembrarBackup(estado, hoje) {
  if (!estado.pac.some((p) => !p.ex)) return false;
  return estado.ultimoBackup == null || diffDias(estado.ultimoBackup, hoje) > 7;
}
