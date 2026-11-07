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

function visivel(mod, mods) {
  if (!mod.visivelSe) return true;
  return Object.entries(mod.visivelSe).every(([k, v]) => mods[k] === v);
}

// Partes ativas, em ordem de catálogo: [{ mod, opcao? }]
function partesAtivas(item) {
  const def = DIAGNOSTICOS[item?.dx];
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
  const def = DIAGNOSTICOS[item.dx];
  if (!def) return item.dx;
  return [def.nome, ...partesAtivas(item).map((p) => (p.opcao ? p.opcao.curto : p.mod.curto))].join(' · ');
}

export function rotuloExtenso(item) {
  const def = DIAGNOSTICOS[item.dx];
  if (!def) return item.dx;
  let partes = partesAtivas(item);
  let base = def.nome;
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
  const mod = DIAGNOSTICOS[item.dx]?.mods.find((m) => m.id === modId);
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
