// Estado v3: modelo, persistência, seed, backup e ordenação de leitos.
import { hojeISO, addDias, diffDias } from './datas.js';
import { PROT_PADRAO } from './pendencias.js';

export const CHAVE = 'ronda-obstetrica-v2';
export const CHAVE_CORROMPIDO = 'ronda-obstetrica-v2-corrompido';
export const LIMITE_OBS = 240;
export const LIMITE_RES = 80;
export const LIMITE_INICIAIS = 10;
export const LIMITE_PAR = 20;
export const LIMITE_PROG = 240;
export const LIMITE_MED = 60;

export function novoEstado() {
  return {
    v: 3,
    dxCustom: [],
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

export function normalizarPrevistos(v) {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return Number.isInteger(n) && n > 0 && n <= 365 ? n : null;
}

// Normaliza uma medicação vinda de fora (backup); devolve null se inutilizável.
export function normalizarMed(m) {
  if (!m || typeof m !== 'object' || Array.isArray(m)) return null;
  const texto = cortar(m.texto, LIMITE_MED);
  if (!texto) return null;
  return {
    id: typeof m.id === 'string' && m.id ? m.id : novoId(),
    texto,
    inicio: typeof m.inicio === 'string' ? m.inicio : null,
    previstos: normalizarPrevistos(m.previstos),
    contar: m.contar !== false,
  };
}

function novoId() {
  return globalThis.crypto.randomUUID().slice(0, 8);
}

export function novaPaciente(dados = {}) {
  const base = {
    id: novoId(), leito: '', idade: null, par: '', iniciais: '', meds: [], prog: '', sugDispensadas: [],
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
    mk({ leito: '04', idade: 27, par: 'G2P1C1A0', igDays: 31 * 7 + 2,
      int: addDias(hoje, -6), alerg: 'Dipirona',
      dxs: [{ dx: 'dheg', mods: { tipo: 'pe', gravidade: true } }] }),
    mk({ leito: '07', idade: 34, par: 'G3P2C0A0', igDays: 37 * 7 + 1,
      int: addDias(hoje, -2),
      dxs: [{ dx: 'dmg', mods: { medicacao: true, 'controle-ruim': true } }] }),
    mk({ leito: '09', idade: 19, par: 'G1P0C0A0', igDays: 29 * 7 + 5,
      int: addDias(hoje, -11), alerg: 'Penicilina',
      dxs: [{ dx: 'rpmo', mods: {} }],
      alertasFeitos: [{ id: 'corticoide', data: addDias(hoje, -12), res: '' }] }),
  ];
}

function migrarPaciente(p) {
  const { g, p: pp, c, a, ...resto } = p;
  let par = resto.par;
  if (par === undefined || par === null) {
    const vals = [g, pp, c, a];
    par = vals.every((v) => v == null) ? '' : `G${g ?? 0}P${pp ?? 0}C${c ?? 0}A${a ?? 0}`;
  }
  return {
    ...resto,
    par: cortar(typeof par === 'string' ? par : '', LIMITE_PAR),
    iniciais: cortar(typeof resto.iniciais === 'string' ? resto.iniciais : '', LIMITE_INICIAIS),
    meds: Array.isArray(resto.meds) ? resto.meds.map(normalizarMed).filter(Boolean) : [],
    prog: typeof resto.prog === 'string' ? resto.prog : '',
    // Séries de regra já dispensadas/removidas antes não voltam como sugestão.
    sugDispensadas: [...new Set([
      ...(Array.isArray(resto.sugDispensadas) ? resto.sugDispensadas : []),
      ...(Array.isArray(resto.dispensadas) ? resto.dispensadas : []).filter((d) => typeof d === 'string').map((d) => `regra:${d}`),
    ])],
  };
}

// Pura e idempotente: aceita v2 ou v3 e devolve v3.
export function migrar(obj) {
  return {
    ...obj,
    v: 3,
    dxCustom: Array.isArray(obj.dxCustom) ? obj.dxCustom : [],
    pac: (obj.pac ?? []).map(migrarPaciente),
  };
}

function formatoValido(e) {
  return !!e && typeof e === 'object' && (e.v === 2 || e.v === 3) && Array.isArray(e.pac);
}

// O próprio acesso a localStorage pode lançar (ex.: bloqueio de cookies); nesse caso devolve null.
function armazenamento() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

export function lerBruto(storage = armazenamento()) {
  try { return storage ? storage.getItem(CHAVE) : null; } catch { return null; }
}

// Outra janela gravou algo diferente do que esta janela leu/gravou por último?
export function mudouFora(armazenado, ultimo) {
  return armazenado != null && armazenado !== ultimo;
}

export function carregar(storage = armazenamento()) {
  let bruto = null;
  try {
    if (!storage) throw new Error('sem armazenamento');
    bruto = storage.getItem(CHAVE);
  } catch {
    // Não dá para saber o que há guardado: estado vazio, e o app não grava por cima.
    return {
      estado: novoEstado(),
      aviso: 'Não foi possível ler os dados salvos neste aparelho. Nada será gravado até recarregar a página.',
      leituraFalhou: true,
    };
  }
  if (bruto == null) {
    const estado = novoEstado();
    estado.pac = seedExemplos(hojeISO());
    return { estado, aviso: null };
  }
  let obj = null;
  try { obj = JSON.parse(bruto); } catch { obj = null; }
  if (formatoValido(obj)) return { estado: migrar({ ...novoEstado(), ...obj }), aviso: null };
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

export function salvar(estado, storage = armazenamento()) {
  try { storage.setItem(CHAVE, JSON.stringify(estado)); return true; } catch { return false; }
}

export function apagarExemplos(estado) {
  return { ...estado, pac: estado.pac.filter((p) => !p.ex) };
}

export function exportarJSON(estado) {
  const sem = { ...estado, pac: estado.pac.map(({ iniciais, ...resto }) => resto) };
  return JSON.stringify(sem, null, 2);
}

const LISTAS_PAC = ['dxs', 'pend', 'alertasFeitos', 'registros', 'dispensadas', 'meds', 'sugDispensadas'];
const ehObjeto = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

// Paciente do backup: objeto com leito texto/número; listas ausentes viram []; lista de outro tipo = inválido.
function pacienteDoBackup(p) {
  if (!ehObjeto(p)) return null;
  if (typeof p.leito !== 'string' && typeof p.leito !== 'number') return null;
  const out = { ...p, iniciais: '' };
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
  return migrar({ ...novoEstado(), ...obj, pac });
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
