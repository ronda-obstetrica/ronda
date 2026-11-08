// Motor de alertas por idade gestacional (IG). Lógica pura.
import { igHoje } from './datas.js';
import { cortar, LIMITE_RES } from './estado.js';
import { casaAlvo, especificidade, grupo } from './textoregras.js';

const JANELA_ENCERRADA_DIAS = 7;
const ORDEM_NIVEL = { vermelho: 0, amarelo: 1, cinza: 2 };

export const chaveFeito = (id) => ((t) => (t === 'corticoide' || t.startsWith('corticoide-') ? 'corticoide' : id))(String(id ?? ''));

const ddmm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

function candidatas(pac, regras) {
  const casadas = regras.filter(r => r.tipo !== 'pendencia' && casaAlvo(r.alvo, pac.dxs));
  const maxPorGrupo = new Map();
  for (const r of casadas) {
    const g = grupo(r.id), e = especificidade(r.alvo);
    if (!maxPorGrupo.has(g) || e > maxPorGrupo.get(g)) maxPorGrupo.set(g, e);
  }
  return casadas.filter(r => especificidade(r.alvo) === maxPorGrupo.get(grupo(r.id)));
}

function avaliarRegra(r, ig, feito) {
  const base = { regraId: r.id, fonte: r.fonte, principal: false };
  if (feito) {
    const res = feito.res ? ` · ${feito.res}` : '';
    return { ...base, nivel: 'cinza', estado: 'feito', msg: `${r.msg} — feito em ${ddmm(feito.data)}${res}`, feito: { data: feito.data, res: feito.res ?? '' } };
  }
  const fim = r.fim ?? Infinity;
  if (r.tipo === 'resolucao') {
    const ant = r.antecedencia ?? 0;
    if (ig < r.ini - ant) return null;
    if (ig < r.ini) return { ...base, nivel: 'amarelo', estado: 'proximo', msg: r.msg };
    if (ig <= fim) return { ...base, nivel: r.nivel, estado: 'ativo', msg: r.msg };
    const n = ig - fim;
    return { ...base, nivel: 'vermelho', estado: 'ultrapassado', msg: `${r.msg} — IG-alvo ultrapassada em ${n} dias`, diasUltrapassado: n };
  }
  // janela
  if (ig < r.ini) return null;
  if (ig <= fim) return { ...base, nivel: r.nivel, estado: 'ativo', msg: r.msg };
  if (r.nivel === 'vermelho' && ig - fim <= JANELA_ENCERRADA_DIAS) {
    return { ...base, nivel: 'cinza', estado: 'encerrado', msg: `${r.msg} — janela encerrada sem registro` };
  }
  return null;
}

export function avaliarAlertas(pac, hoje, regras) {
  const ig = igHoje(pac, hoje);
  if (ig === null) return [];
  const feitos = pac.alertasFeitos || [];
  const vistos = new Set();
  let temCorticoide = false;
  const saida = [];
  const iniPorId = new Map();
  for (const r of candidatas(pac, regras)) {
    if (vistos.has(r.id)) continue;
    vistos.add(r.id);
    const chave = chaveFeito(r.id);
    if (chave === 'corticoide' && temCorticoide) continue;
    const a = avaliarRegra(r, ig, feitos.find(f => f.id === chave));
    if (!a) continue;
    if (chave === 'corticoide') temCorticoide = true;
    saida.push(a);
    if (r.tipo === 'resolucao' && a.estado !== 'feito' && a.estado !== 'encerrado') iniPorId.set(a, r.ini);
  }
  let principal = null;
  for (const [a, ini] of iniPorId) if (principal === null || ini < iniPorId.get(principal)) principal = a;
  if (principal) principal.principal = true;
  return saida;
}

export function registrarAlertaFeito(pac, regraId, data, res = '') {
  const chave = chaveFeito(regraId);
  const outros = (pac.alertasFeitos || []).filter(f => f.id !== chave);
  return { ...pac, alertasFeitos: [...outros, { id: chave, data, res: cortar(res, LIMITE_RES) }] };
}

export function desfazerAlertaFeito(pac, regraId) {
  return { ...pac, alertasFeitos: (pac.alertasFeitos || []).filter(f => f.id !== chaveFeito(regraId)) };
}

export function ordenarAlertas(alertas) {
  return alertas
    .map((a, i) => ({ a, i }))
    .sort((x, y) => (ORDEM_NIVEL[x.a.nivel] - ORDEM_NIVEL[y.a.nivel])
      || (Number(y.a.principal) - Number(x.a.principal)) || (x.i - y.i))
    .map(o => o.a);
}
