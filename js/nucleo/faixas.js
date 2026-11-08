// Controles (glicemia, PA) e faixas de alerta. Uma faixa por linha, campos separados por "|".
import { dividirLinhas, parseAlvo, casaAlvo } from './textoregras.js';

export const MEDIDAS = [
  { id: 'jejum', nome: 'Jejum' }, { id: 'pos-cafe', nome: 'Pós-café' },
  { id: 'pre-almoco', nome: 'Pré-almoço' }, { id: 'pos-almoco', nome: 'Pós-almoço' },
  { id: 'pre-jantar', nome: 'Pré-jantar' }, { id: 'pos-jantar', nome: 'Pós-jantar' },
  { id: 'pa', nome: 'PA' },
];
export const MEDIDAS_POR_DX = {
  dmg: ['jejum', 'pos-cafe', 'pre-almoco', 'pos-almoco', 'pre-jantar', 'pos-jantar'],
  dheg: ['pa'],
};

const RE_ID = /^[a-z0-9][a-z0-9-]*$/;
const RE_COND = /^([vsd])?\s*(>=|<=|>|<)\s*(.*)$/i;
const RE_NUM = /^\d+(\.\d+)?$/;
const ehMedida = id => MEDIDAS.some(m => m.id === id);

function parseCond(txt) {
  const t = txt.trim();
  const m = RE_COND.exec(t);
  if (!m) return new Error(`limite inválido: "${t}"`);
  const num = m[3].trim();
  if (num.includes(',')) return new Error(`limite inválido: "${t}" (use ponto)`);
  if (!RE_NUM.test(num)) return new Error(`limite inválido: "${t}"`);
  return { campo: (m[1] || 'v').toLowerCase(), op: m[2], n: Number(num) };
}

function parseLimite(txt) {
  const cond = [];
  for (const parte of txt.split(/\s+ou\s+/i)) {
    const c = parseCond(parte);
    if (c instanceof Error) return c;
    cond.push(c);
  }
  return cond;
}

function medidaValida(medida) {
  if (medida === '*' || ehMedida(medida)) return true;
  return medida.endsWith('-*') && medida.length > 2 && MEDIDAS.some(m => m.id.startsWith(medida.slice(0, -1)));
}

function parseLinha(campos) {
  if (campos.length < 7) return new Error('linha incompleta: esperados 7 campos');
  if (campos.length > 7) return new Error('campos demais — há um "|" sobrando?');
  const [id, alvoTxt, medida, limite, nivel, msg, fonte] = campos;
  if (!RE_ID.test(id)) return new Error(`id inválido: "${id}" (use letras minúsculas, números e hífen)`);
  const alvo = parseAlvo(alvoTxt);
  if (alvo instanceof Error) return alvo;
  if (!medidaValida(medida)) return new Error(`medida desconhecida: "${medida}"`);
  const cond = parseLimite(limite);
  if (cond instanceof Error) return cond;
  if (nivel !== 'vermelho' && nivel !== 'amarelo') return new Error(`nível inválido: "${nivel}" (use vermelho ou amarelo)`);
  if (!msg) return new Error('mensagem vazia');
  return { id, alvo, medida, cond, nivel, msg, fonte };
}

export function parseFaixas(texto) {
  const itens = [], desligar = [], erros = [];
  for (const { n, campos } of dividirLinhas(texto)) {
    try {
      if (campos.length === 1 && campos[0].startsWith('-')) {
        const id = campos[0].slice(1).trim();
        if (RE_ID.test(id)) desligar.push(id);
        else erros.push({ n, msg: `id inválido: "${id}" (use letras minúsculas, números e hífen)` });
        continue;
      }
      const r = parseLinha(campos);
      if (r instanceof Error) erros.push({ n, msg: r.message }); else itens.push(r);
    } catch (e) {
      erros.push({ n, msg: `linha inválida: ${e.message}` });
    }
  }
  return { itens, desligar, erros };
}

export const FAIXAS_GLOBAIS_TEXTO = `
glic-hipo | dmg | * | <70 | vermelho | Hipoglicemia (<70) | DMG-BR 2021 p.46
glic-jejum | dmg | jejum | >=95 | amarelo | Jejum acima da meta (≥95) | DMG-BR 2021 p.46
glic-pos | dmg | pos-* | >=140 | amarelo | Pós-prandial 1h acima da meta (≥140) | DMG-BR 2021 p.46
pa-crise | dheg | pa | s>=160 ou d>=110 | vermelho | Crise hipertensiva (≥160/110) | RBEHG 2023 p.10, 27
pa-alta | dheg | pa | s>=140 ou d>=90 | amarelo | PA ≥140/90 | RBEHG 2023 p.8
`;

export const FAIXAS_GLOBAIS = parseFaixas(FAIXAS_GLOBAIS_TEXTO).itens;

function novoId() { return globalThis.crypto.randomUUID().slice(0, 8); }

// Medida desconhecida: devolve o mesmo pac (a UI valida antes; não lançamos exceção).
export function registrar(pac, { data, medida, valor }) {
  if (!ehMedida(medida)) return pac;
  return { ...pac, registros: [...(pac.registros || []), { id: novoId(), data, medida, valor }] };
}

export function parseValor(medida, txt) {
  const t = String(txt ?? '').trim();
  if (medida === 'pa') {
    const m = /^(\d+)\s*[x/]\s*(\d+)$/i.exec(t);
    if (!m) return new Error('PA inválida: use 150x95');
    return { s: Number(m[1]), d: Number(m[2]) };
  }
  if (!RE_NUM.test(t)) return new Error('valor inválido: use um número (ponto como decimal)');
  return Number(t);
}

function medidaCasa(faixa, medida) {
  if (faixa.medida === '*' || faixa.medida === medida) return true;
  return faixa.medida.endsWith('-*') && medida.startsWith(faixa.medida.slice(0, -1));
}

function condVale(c, valor) {
  let x;
  if (c.campo === 'v') x = typeof valor === 'number' ? valor : undefined;
  else x = valor && typeof valor === 'object' ? valor[c.campo] : undefined;
  if (typeof x !== 'number') return false;
  switch (c.op) {
    case '>=': return x >= c.n;
    case '>': return x > c.n;
    case '<=': return x <= c.n;
    default: return x < c.n;
  }
}

export function avaliarRegistro(pac, registro, faixas) {
  const dxs = pac?.dxs || [];
  const achadas = (faixas || []).filter(f =>
    casaAlvo(f.alvo, dxs) && medidaCasa(f, registro.medida) && f.cond.some(c => condVale(c, registro.valor)));
  const lista = achadas.some(f => f.nivel === 'vermelho') ? achadas.filter(f => f.nivel === 'vermelho') : achadas;
  return lista.map(f => ({ faixaId: f.id, nivel: f.nivel, msg: f.msg, fonte: f.fonte }));
}

export function foraDaFaixaHoje(pac, hoje, faixas) {
  const saida = [];
  for (const registro of pac?.registros || []) {
    if (registro.data !== hoje) continue;
    const alertas = avaliarRegistro(pac, registro, faixas);
    if (alertas.length) saida.push({ registro, alertas });
  }
  return saida;
}
