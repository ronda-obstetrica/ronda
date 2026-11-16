// Protocolos e pendências: recorrência, resultado, exames, tratamentos e pendências por IG.
import { addDias, diffDias, hojeISO, igHoje } from './datas.js';
import { cortar, LIMITE_RES } from './estado.js';
import { casaAlvo, dividirLinhas } from './textoregras.js';

export const CATEGORIAS = ['Exame', 'Medicação', 'Avaliação', 'Interconsulta', 'Conduta', 'Outro'];

const CAB = '# Modelo genérico — substitua pelo protocolo da sua instituição';
const prot = (...linhas) => [CAB, ...linhas].join('\n');

export const PROT_PADRAO = {
  dheg: prot(
    'Vitalidade fetal (CTG ou PBF) | Exame | 0 | 2',
    'Exames laboratoriais de PE (hemograma, creatinina, TGO, DHL) | Exame | 0 | 3',
    'Reavaliar pressão arterial e sinais de gravidade | Avaliação | 0 | 1',
    'Ultrassonografia com Doppler e crescimento fetal | Exame | 2 | 14',
    'Revisar plano de resolução | Conduta | 1 | 0',
  ),
  dmg: prot(
    'Revisar perfil glicêmico | Avaliação | 0 | 3',
    'Vitalidade fetal (CTG) | Exame | 0 | 7',
    'Ultrassonografia com crescimento fetal | Exame | 3 | 14',
    'Revisar plano de resolução | Conduta | 1 | 0',
  ),
  tpp: prot(
    'Avaliar dinâmica uterina e colo | Avaliação | 0 | 1',
    'Revisar necessidade de corticoide e neuroproteção | Conduta | 0 | 0',
    'Vitalidade fetal (CTG) | Exame | 0 | 1',
    'Interconsulta com neonatologia | Interconsulta | 0 | 0',
  ),
  rpmo: prot(
    'Avaliar sinais de infecção | Avaliação | 0 | 1',
    'Exames laboratoriais de infecção | Exame | 0 | 2',
    'Vitalidade fetal (CTG ou PBF) | Exame | 0 | 1',
    'Ultrassonografia com líquido amniótico | Exame | 2 | 7',
    'Revisar plano de resolução | Conduta | 1 | 0',
  ),
  placenta: prot(
    'Avaliar sangramento | Avaliação | 0 | 1',
    'Ultrassonografia com topografia e acretismo | Exame | 1 | 0',
    'Hemograma | Exame | 0 | 7',
    'Revisar plano e data de resolução | Conduta | 1 | 0',
  ),
  rcf: prot(
    'Vitalidade fetal (CTG ou PBF) | Exame | 0 | 2',
    'Ultrassonografia com Doppler | Exame | 0 | 7',
    'Ultrassonografia com crescimento fetal | Exame | 7 | 14',
    'Revisar plano de resolução | Conduta | 1 | 0',
  ),
  colestase: prot(
    'Ácidos biliares e transaminases | Exame | 0 | 7',
    'Vitalidade fetal (CTG) | Exame | 0 | 3',
    'Avaliar prurido | Avaliação | 0 | 1',
    'Revisar plano e data de resolução | Conduta | 1 | 0',
  ),
  outro: prot(
    'Reavaliação clínica | Avaliação | 0 | 1',
  ),
};

const RE_INT = /^\d+$/;

function parseDuracao(txt) {
  let m = /^(\d+)d$/i.exec(txt);
  if (m) return { total: Number(m[1]), unidade: 'dias' };
  m = /^(\d+)h$/i.exec(txt);
  if (m) return { total: Number(m[1]), unidade: 'horas' };
  m = /^(\d+)doses(?:@(\d+))?$/i.exec(txt);
  if (m) return { total: Number(m[1]), unidade: 'doses', intervaloDias: m[2] === undefined ? 1 : Number(m[2]) };
  return null;
}

// Mesma validação de duração do protocolo (usada também pela pendência manual).
export function lerDuracao(txt) {
  return parseDuracao(String(txt ?? '').trim());
}

// Repetição em dias a partir de um texto: "2", "48h", "a cada 3 dias", "semanal"... Devolve null se não entender.
export function lerRepeticao(txt) {
  const s = String(txt ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (!s) return null;
  const pre = '(?:a\\s+cada\\s+|cada\\s+)?';
  let n = null;
  let m;
  if (/^\d+$/.test(s)) n = Number(s);
  else if ((m = new RegExp(`^${pre}(\\d+)\\s*(?:h|hr|hrs|horas?)$`).exec(s))) n = Math.max(1, Math.round(Number(m[1]) / 24));
  else if ((m = new RegExp(`^${pre}(\\d+)\\s*(?:d|dias?)$`).exec(s))) n = Number(m[1]);
  else if ((m = new RegExp(`^${pre}(\\d+)\\s*(?:sem|semanas?)$`).exec(s))) n = Number(m[1]) * 7;
  else if (/^(diari[oa]s?|diariamente|todo dia|todos os dias)$/.test(s)) n = 1;
  else if (/^(semanal|semanalmente|toda semana)$/.test(s)) n = 7;
  else if (/^(quinzenal|quinzenalmente)$/.test(s)) n = 14;
  else if (/^mensal$/.test(s)) n = 30;
  return n !== null && n <= 365 ? n : null;
}

const ACRONIMOS = { usg: 'USG', ctg: 'CTG', pbf: 'PBF', ila: 'ILA', pa: 'PA', pcr: 'PCR', ldh: 'LDH', dhl: 'DHL', gbs: 'GBS', eas: 'EAS', tgo: 'TGO', tgp: 'TGP', bcf: 'BCF', rm: 'RM' };
const RE_FRASE_REP = /(?:de\s+)?\d+\s*(?:em|\/)\s*\d+\s*(?:h|horas?|d|dias?)(?![a-zà-ÿ])|(?:a\s+cada|cada)\s+\d+\s*(?:h|hr|hrs|horas?|d|dias?|sem|semanas?)(?![a-zà-ÿ])|(?:semanal(?:mente)?|quinzenal(?:mente)?|mensal|di[aá]ri(?:amente|os|as|o|a)|todos\s+os\s+dias|todo\s+dia|toda\s+semana)(?![a-zà-ÿ])/i;

function categoriaDoTexto(t) {
  const s = t.toLowerCase();
  if (/interconsulta|parecer/.test(s)) return 'Interconsulta';
  if (/dose|medica|antibi[oó]tic|insulina|sulfato|corticoide|betametasona|dexametasona|nifedipin|metildopa/.test(s)) return 'Medicação';
  if (/usg|ultrassom|doppler|ctg|cardiotoco|pbf|perfil|hemograma|exame|cultura|urina|eas|rotina|sorologia|glicemi|glic[eê]mic|[aá]cidos? biliares|transaminases|pcr|ldh|dhl|creatinina|plaquetas|laborat/.test(s)) return 'Exame';
  if (/avaliar|aferir|sinais|checar|examinar|press[aã]o|\bpa\b/.test(s)) return 'Avaliação';
  if (/definir|conduta|parto|resolu|planejar|decidir/.test(s)) return 'Conduta';
  return 'Outro';
}

function diasDaFrase(frase) {
  const m = /\d+\s*(?:em|\/)\s*(\d+)\s*(h|horas?|d|dias?)/i.exec(frase);
  if (m) return /^h/i.test(m[2]) ? Math.max(1, Math.round(Number(m[1]) / 24)) : Number(m[1]);
  return lerRepeticao(frase) ?? 0;
}

// Texto livre -> pendências com repetição. Ex.: "rotina infecciosa a cada 48h, USG semanal".
// Separe várias por vírgula, ponto e vírgula, "+" ou nova linha. Entende "amanhã" e "depois de amanhã" no 1º prazo.
export function interpretarPendencias(texto) {
  return String(texto ?? '').split(/[\n;,+]+/).map((t) => t.trim()).filter(Boolean).map((bruto) => {
    let t = bruto;
    let rep = 0;
    let dias = 0;
    const m = RE_FRASE_REP.exec(t);
    if (m) { rep = diasDaFrase(m[0]); t = t.replace(m[0], ' '); }
    const rxDepois = /depois\s+de\s+amanh[ãa](?![a-zà-ÿ])/i;
    const rxAmanha = /(^|\s)amanh[ãa](?![a-zà-ÿ])/i;
    const rxHoje = /(^|\s)hoje(?![a-zà-ÿ])/i;
    if (rxDepois.test(t)) { dias = 2; t = t.replace(rxDepois, ' '); }
    else if (rxAmanha.test(t)) { dias = 1; t = t.replace(rxAmanha, ' '); }
    else if (rxHoje.test(t)) t = t.replace(rxHoje, ' ');
    t = t.replace(/\s+/g, ' ').replace(/^[\s\-–:.]+|[\s\-–:.]+$/g, '');
    if (!t) t = 'Pendência';
    t = t.replace(/[A-Za-zÀ-ÿ]+/g, (w) => ACRONIMOS[w.toLowerCase()] ?? w);
    t = t.charAt(0).toUpperCase() + t.slice(1);
    return { texto: t, cat: categoriaDoTexto(t), rep, dias };
  });
}

export function parseProtocolo(texto) {
  const itens = [], erros = [];
  for (const { n, campos } of dividirLinhas(texto)) {
    const erro = (msg) => erros.push({ n, msg });
    if (campos.length < 4) { erro('linha incompleta: esperados pelo menos 4 campos'); continue; }
    if (campos.length > 5) { erro('campos demais — há um "|" sobrando?'); continue; }
    const [txt, catTxt, diasTxt, repTxt, durTxt = ''] = campos;
    if (!txt) { erro('texto vazio'); continue; }
    const cat = CATEGORIAS.find((c) => c.toLowerCase() === catTxt.toLowerCase());
    if (!cat) { erro(`categoria inexistente: "${catTxt}" (use ${CATEGORIAS.join(', ')})`); continue; }
    if (!RE_INT.test(diasTxt)) { erro(`dias inválido: "${diasTxt}" (use um número inteiro ≥ 0)`); continue; }
    const rep = lerRepeticao(repTxt);
    if (rep === null) { erro(`repetição inválida: "${repTxt}" (use um número de dias, ex.: 2, ou 48h, semanal)`); continue; }
    let dur = null;
    if (durTxt !== '') {
      dur = parseDuracao(durTxt);
      if (!dur) { erro(`duração inválida: "${durTxt}" (use 7d, 24h ou 2doses@1)`); continue; }
    }
    itens.push({ texto: txt, cat, dias: Number(diasTxt), rep, dur });
  }
  return { itens, erros };
}

function novoId() {
  return globalThis.crypto.randomUUID().slice(0, 8);
}

export function novaPendencia(dados = {}) {
  const p = {
    id: novoId(), texto: '', cat: 'Outro', due: null, rep: 0, done: false, doneAt: null,
    spawn: null, res: '', origem: 'manual', estadoExame: null, aguardandoDesde: null, dur: null,
    ...dados,
  };
  if (dados.estadoExame === undefined) p.estadoExame = p.cat === 'Exame' ? 'solicitado' : null;
  return p;
}

export function chavePend(p) {
  const t = String(p.texto ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ').trim();
  return `${t}|${p.cat}`;
}

const abertaComChave = (lista, p) => {
  const k = chavePend(p);
  return lista.some((x) => !x.done && chavePend(x) === k);
};

const mapPend = (pac, id, fn) => ({ ...pac, pend: pac.pend.map((p) => (p.id === id ? fn(p) : p)) });

export function inicioDur(dur, due) {
  const base = { ...dur, inicio: dur.unidade === 'horas' ? `${due}T08:00` : due };
  if (dur.unidade === 'doses') base.doses = [];
  return base;
}

export function aplicarProtocolo(pac, itens, hoje) {
  const pend = [...pac.pend];
  for (const it of itens) {
    const due = addDias(hoje, it.dias);
    const p = novaPendencia({
      texto: it.texto, cat: it.cat, due, rep: it.rep, origem: 'protocolo',
      dur: it.dur ? inicioDur(it.dur, due) : null,
    });
    if (!abertaComChave(pend, p)) pend.push(p);
  }
  return { ...pac, pend };
}

export function concluir(pac, pendId, hoje, res = '') {
  const alvo = pac.pend.find((p) => p.id === pendId);
  if (!alvo || alvo.done) return pac;
  let proxima = null;
  if (alvo.rep > 0) {
    const due = addDias(hoje, alvo.rep);
    const cand = novaPendencia({
      texto: alvo.texto, cat: alvo.cat, due, rep: alvo.rep, origem: alvo.origem,
      ...(alvo.sug ? { sug: alvo.sug } : {}),
      dur: alvo.dur ? inicioDur({ total: alvo.dur.total, unidade: alvo.dur.unidade, ...(alvo.dur.intervaloDias ? { intervaloDias: alvo.dur.intervaloDias } : {}) }, due) : null,
    });
    const resto = pac.pend.map((p) => (p.id === pendId ? { ...p, done: true } : p));
    if (!abertaComChave(resto, cand)) proxima = cand;
  }
  const pend = pac.pend.map((p) => (p.id !== pendId ? p : {
    ...p, done: true, doneAt: hoje, res: cortar(res, LIMITE_RES),
    estadoExame: p.cat === 'Exame' ? 'visto' : p.estadoExame,
    spawn: proxima ? proxima.id : p.spawn,
  }));
  return { ...pac, pend: proxima ? [...pend, proxima] : pend };
}

export function desfazer(pac, pendId) {
  const alvo = pac.pend.find((p) => p.id === pendId);
  if (!alvo) return pac;
  const spawnAberta = alvo.spawn && pac.pend.some((p) => p.id === alvo.spawn && !p.done);
  const pend = pac.pend
    .filter((p) => !(spawnAberta && p.id === alvo.spawn))
    .map((p) => (p.id !== pendId ? p : {
      ...p, done: false, doneAt: null, res: '', spawn: null,
      estadoExame: p.cat === 'Exame' ? (p.aguardandoDesde ? 'aguardando' : 'solicitado') : p.estadoExame,
    }));
  return { ...pac, pend };
}

export function marcarAguardando(pac, pendId, hoje) {
  return mapPend(pac, pendId, (p) => ({ ...p, estadoExame: 'aguardando', aguardandoDesde: hoje }));
}

export function remover(pac, pendId) {
  const alvo = pac.pend.find((p) => p.id === pendId);
  if (!alvo) return pac;
  // Não vai para `dispensadas`: a sugestão de origem volta a aparecer (dispensadas é só de alertas).
  return { ...pac, pend: pac.pend.filter((p) => p.id !== pendId) };
}

function parseLocal(iso) {
  const [d, h = '0:0'] = iso.split('T');
  const [y, mo, dia] = d.split('-').map(Number);
  const [hh, mm] = h.split(':').map(Number);
  return new Date(y, mo - 1, dia, hh, mm);
}

export function progressoTratamento(p, agora) {
  const dur = p.dur;
  if (!dur) return null;
  const hoje = hojeISO(agora);
  if (dur.unidade === 'dias') {
    const d = diffDias(dur.inicio, hoje) + 1;
    return { texto: `D${d}/${dur.total}`, terminado: d > dur.total };
  }
  if (dur.unidade === 'horas') {
    const h = Math.floor((agora - parseLocal(dur.inicio)) / 3600000);
    return { texto: `${h}h/${dur.total}h`, terminado: h >= dur.total };
  }
  const doses = dur.doses ?? [];
  const n = doses.length;
  if (n >= dur.total) return { texto: `${dur.total}/${dur.total} doses`, terminado: true };
  let texto = `Dose ${n + 1}/${dur.total}`;
  if (n > 0) {
    const prox = addDias(doses[n - 1], dur.intervaloDias ?? 1);
    if (prox === addDias(hoje, 1)) texto += ' amanhã';
    else if (diffDias(hoje, prox) <= 0) texto += ' hoje';
  } else {
    texto += ' hoje';
  }
  return { texto, terminado: false };
}

export function registrarDose(pac, pendId, hoje) {
  return mapPend(pac, pendId, (p) => {
    if (!p.dur || p.dur.unidade !== 'doses') return p;
    const doses = p.dur.doses ?? [];
    if (doses.length >= p.dur.total) return p;
    return { ...p, dur: { ...p.dur, doses: [...doses, hoje] } };
  });
}

// Heurística de categoria e janela de IG das regras de pendência (compartilhada com sugestoes.js).
export const catDaRegra = (r) => (/CTG|Hemograma/.test(r.msg) ? 'Exame' : 'Avaliação');

export function regraNaJanela(r, pac, ig) {
  if (r.tipo !== 'pendencia' || ig === null) return false;
  if (!casaAlvo(r.alvo, pac.dxs)) return false;
  return !(ig < r.ini || (r.fim !== null && r.fim !== undefined && ig > r.fim));
}

export function gerarPendenciasPorIG(pac, hoje, regras) {
  const ig = igHoje(pac, hoje);
  if (ig === null) return pac;
  const pend = [...pac.pend];
  const disp = pac.dispensadas ?? [];
  const ehRegra = new Set(regras.map((r) => r.id));
  for (const r of regras) {
    if (!regraNaJanela(r, pac, ig)) continue;
    if (disp.includes(r.id) || pend.some((p) => p.origem === r.id)) continue;
    const cat = catDaRegra(r);
    const nova = novaPendencia({ texto: r.msg, cat, due: hoje, rep: r.repetir ?? 0, origem: r.id });
    // Séries de outras regras não bloqueiam (troca de série); manuais/protocolo sim.
    const k = chavePend(nova);
    if (pend.some((p) => !p.done && chavePend(p) === k && !(ehRegra.has(p.origem) && p.origem !== r.id))) continue;
    pend.push(nova);
  }
  return { ...pac, pend };
}

export function pendenciaDeAlerta(pac, alerta, hoje) {
  const nova = novaPendencia({ texto: alerta.msg, cat: 'Conduta', due: hoje });
  if (abertaComChave(pac.pend, nova)) return pac;
  return { ...pac, pend: [...pac.pend, nova] };
}

export function classificarHoje(pac, hoje) {
  const r = { atrasadas: [], hoje: [], amanha: [], aguardando: [], concluidasHoje: [] };
  const amanha = addDias(hoje, 1);
  for (const p of pac.pend) {
    if (p.done) { if (p.doneAt === hoje) r.concluidasHoje.push(p); continue; }
    if (p.cat === 'Exame' && p.estadoExame === 'aguardando') r.aguardando.push(p);
    else if (p.due < hoje) r.atrasadas.push({ ...p, diasAtraso: diffDias(p.due, hoje) });
    else if (p.due === hoje) r.hoje.push(p);
    else if (p.due === amanha) r.amanha.push(p);
  }
  return r;
}
