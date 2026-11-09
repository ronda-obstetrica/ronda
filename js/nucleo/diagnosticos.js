// Catálogo de diagnósticos e modificadores. Dados puros + helpers de rótulo/token.

const liga = (id, curto, extenso, visivelSe) => {
  const m = { id, tipo: 'liga', curto, extenso };
  if (visivelSe) m.visivelSe = visivelSe;
  return m;
};
const escolha = (id, opcoes) => ({ id, tipo: 'escolha', curto: '', extenso: '', opcoes });
const op = (id, curto, extenso) => ({ id, curto, extenso });

export const DIAGNOSTICOS = {
  dheg: {
    nome: 'DHEG', extenso: 'Doença hipertensiva',
    mods: [
      escolha('tipo', [
        op('pe', 'PE', 'pré-eclâmpsia'),
        op('hg', 'HG', 'hipertensão gestacional'),
        op('hac', 'HAC', 'hipertensão crônica'),
        op('hac-pe', 'HAC+PE', 'hipertensão crônica com pré-eclâmpsia sobreposta'),
      ]),
      liga('gravidade', 'com gravidade', 'com sinais de gravidade'),
      liga('dificil', 'difícil controle', 'de difícil controle', { tipo: 'hac' }),
    ],
  },
  dmg: {
    nome: 'DMG', extenso: 'Diabetes',
    mods: [
      liga('medicacao', 'insulina', 'em uso de medicação'),
      liga('controle-ruim', 'controle ruim', 'controle glicêmico ruim'),
      liga('dm-previo', 'DM prévio', 'diabetes pré-gestacional'),
    ],
  },
  rcf: {
    nome: 'RCF', extenso: 'Restrição de crescimento fetal',
    mods: [
      escolha('grau', [
        op('p3p10', 'P3–P10', 'PFE entre P3 e P10'),
        op('p3', '<P3', 'PFE abaixo do P3'),
        op('ipau', 'IP AU>P95', 'IP da artéria umbilical acima do P95, diástole presente'),
        op('dz', 'DZ', 'diástole zero'),
        op('dr', 'DR', 'diástole reversa'),
      ]),
      liga('concomitante', '+ comorbidade', 'com condição concomitante'),
    ],
  },
  colestase: { nome: 'Colestase', extenso: 'Colestase', mods: [liga('ab100', 'AB ≥100', 'ácidos biliares ≥ 100 µmol/L')] },
  placenta: { nome: 'Placenta prévia', extenso: 'Placenta prévia', mods: [liga('acretismo', 'acretismo?', 'com suspeita de acretismo')] },
  tpp: { nome: 'TPP', extenso: 'Trabalho de parto prematuro', mods: [] },
  rpmo: { nome: 'RPMO', extenso: 'Rotura prematura de membranas ovulares', mods: [] },
  outro: { nome: 'Outro', extenso: 'Outro', mods: [] },
};

// ---------- Diagnósticos criados pela usuária ----------

const ROTULO_REMOVIDO = 'Diagnóstico removido';
let custom = {};
let bruto = [];

export const obterDxCustom = () => bruto;

export function definirDxCustom(lista) {
  bruto = Array.isArray(lista) ? lista : [];
  custom = {};
  for (const it of Array.isArray(lista) ? lista : []) {
    if (!it || typeof it.id !== 'string' || Object.hasOwn(DIAGNOSTICOS, it.id)) continue;
    custom[it.id] = { nome: String(it.sigla ?? ''), extenso: String(it.nome ?? ''), mods: [], custom: true };
  }
}

export function dxDef(id) {
  if (typeof id !== 'string') return null;
  if (Object.hasOwn(DIAGNOSTICOS, id)) return DIAGNOSTICOS[id];
  return Object.hasOwn(custom, id) ? custom[id] : null;
}

export const listaDx = () => [...Object.entries(DIAGNOSTICOS), ...Object.entries(custom)];

const chaveSigla = (s) => String(s ?? '').trim().toLowerCase();

export function validarNovoDx(estado, { nome, sigla }, ignorarId = null) {
  const n = String(nome ?? '').trim();
  const s = String(sigla ?? '').trim();
  if (!n || n.length > 40) return 'Informe o nome (até 40 caracteres).';
  if (!s || s.length > 6) return 'Informe a sigla (até 6 caracteres).';
  const k = chaveSigla(s);
  const usada = Object.values(DIAGNOSTICOS).some((d) => chaveSigla(d.nome) === k)
    || (estado?.dxCustom ?? []).some((d) => d.id !== ignorarId && chaveSigla(d.sigla) === k);
  return usada ? 'Já existe um diagnóstico com essa sigla.' : null;
}

const slug = (s) => String(s).trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'dx';

export function criarDx(estado, { nome, sigla }) {
  const base = `u-${slug(sigla)}`;
  const ocupados = new Set([...Object.keys(DIAGNOSTICOS), ...(estado.dxCustom ?? []).map((d) => d.id)]);
  let id = base;
  for (let i = 2; ocupados.has(id); i++) id = `${base}-${i}`;
  return {
    ...estado,
    dxCustom: [...(estado.dxCustom ?? []), { id, nome: String(nome).trim(), sigla: String(sigla).trim() }],
    prot: { ...estado.prot, [id]: '' },
  };
}

export function renomearDx(estado, id, { nome, sigla }) {
  return {
    ...estado,
    dxCustom: (estado.dxCustom ?? []).map((d) => (d.id === id ? { ...d, nome: String(nome).trim(), sigla: String(sigla).trim() } : d)),
  };
}

export function excluirDx(estado, id) {
  if ((estado.pac ?? []).some((p) => (p.dxs ?? []).some((d) => d.dx === id))) return null;
  const { [id]: _, ...prot } = estado.prot ?? {};
  return { ...estado, dxCustom: (estado.dxCustom ?? []).filter((d) => d.id !== id), prot };
}

function visivel(mod, mods) {
  if (!mod.visivelSe) return true;
  return Object.entries(mod.visivelSe).every(([k, v]) => mods[k] === v);
}

// Partes ativas, em ordem de catálogo: [{ mod, opcao? }]
function partesAtivas(item) {
  const def = dxDef(item?.dx);
  if (!def) return [];
  const mods = item.mods || {};
  const out = [];
  for (const mod of def.mods) {
    if (!visivel(mod, mods)) continue;
    const v = mods[mod.id];
    if (mod.tipo === 'escolha') {
      const opcao = mod.opcoes.find((o) => o.id === v);
      if (opcao) out.push({ mod, opcao });
    } else if (v === true) {
      out.push({ mod });
    }
  }
  return out;
}

export function tokens(item) {
  return [item.dx, ...partesAtivas(item).map((p) => (p.opcao ? p.opcao.id : p.mod.id))];
}

export function rotuloCurto(item) {
  const def = dxDef(item.dx);
  if (!def) return ROTULO_REMOVIDO;
  return [def.nome, ...partesAtivas(item).map((p) => (p.opcao ? p.opcao.curto : p.mod.curto))].join(' · ');
}

export function rotuloExtenso(item) {
  const def = dxDef(item.dx);
  if (!def) return ROTULO_REMOVIDO;
  let partes = partesAtivas(item);
  let base = def.custom ? def.extenso : def.nome;
  if (item.dx === 'dheg') {
    const i = partes.findIndex((p) => p.mod.id === 'tipo');
    if (i >= 0) {
      const t = partes[i].opcao.extenso;
      base = t.charAt(0).toUpperCase() + t.slice(1);
      partes = partes.filter((_, j) => j !== i);
    }
  }
  const textos = partes.map((p) => (p.opcao ? p.opcao.extenso : p.mod.extenso));
  return textos.reduce((acc, t, i) => acc + (i === 0 ? ' ' : ', ') + t, base);
}

export function alternarMod(item, modId, valor) {
  const mods = { ...(item.mods || {}) };
  const mod = dxDef(item.dx)?.mods.find((m) => m.id === modId);
  if (mod?.tipo === 'escolha') {
    if (valor === undefined || valor === null || valor === '') delete mods[modId];
    else mods[modId] = valor;
  } else if (mods[modId]) {
    delete mods[modId];
  } else {
    mods[modId] = true;
  }
  return { ...item, mods };
}

// Textos por extenso de cada parte ativa (inclui o tipo da DHEG), em ordem de catálogo.
export function partesExtenso(item) {
  return partesAtivas(item).map((p) => (p.opcao ? p.opcao.extenso : p.mod.extenso));
}
