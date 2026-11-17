// Calculadoras obstétricas (DUM, USG, Bishop, Apgar, IMC). Lógica pura, sem DOM e sem guardar nada:
// os valores digitados nunca vão para o estado do app (LGPD).
import { addDias, diffDias, fmtIG } from './datas.js';
import { limiteDiscrepancia } from './datacao.js';

export const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const pad = (n) => String(n).padStart(2, '0');
const MAX_IG = 44 * 7 + 6;

// '65,5' e '65.5' valem o mesmo; vazio ou texto inválido = null.
export function lerNumero(txt) {
  const t = String(txt ?? '').trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}

// "IG 31+2" -> '31 sem 2 d'
export const rotuloIG = (dias) => `${Math.floor(dias / 7)} sem ${dias % 7} d`;
export const dmy = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

// ---------- DUM ----------
// Dia e mês tocados nos botões; o ano é o mais recente em que a data existe e não está no futuro.
export function dumDeDiaMes(dia, mes, hoje) {
  if (!Number.isInteger(dia) || !Number.isInteger(mes) || dia < 1 || dia > 31 || mes < 1 || mes > 12) return null;
  const anoHoje = Number(hoje.slice(0, 4));
  for (let a = anoHoje; a >= anoHoje - 2; a--) {
    const d = new Date(Date.UTC(a, mes - 1, dia));
    if (d.getUTCFullYear() !== a || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) continue;
    const iso = `${a}-${pad(mes)}-${pad(dia)}`;
    if (iso <= hoje) return iso;
  }
  return null;
}

export function calcDUM(dum, hoje) {
  if (!dum) return null;
  const dias = diffDias(dum, hoje);
  if (dias < 0) return { erro: 'A DUM está no futuro.' };
  if (dias > MAX_IG) return { erro: 'IG acima de 44 semanas: confira a DUM.' };
  return { dum, dias, ig: fmtIG(dias), rotulo: rotuloIG(dias), dpp: addDias(dum, 280) };
}

// ---------- USG ----------
// Semanas e dias da IG no exame + data do exame (padrão: hoje).
export function calcUS({ sem, dd, data }, hoje) {
  const s = lerNumero(sem);
  const d = lerNumero(dd === '' || dd == null ? '0' : dd);
  if (s === null || !Number.isInteger(s)) return null;
  if (d === null || !Number.isInteger(d) || d > 6) return { erro: 'Dias: use de 0 a 6.' };
  if (s < 4 || s > 42) return { erro: 'Semanas: use de 4 a 42.' };
  const dataUS = data || hoje;
  if (diffDias(dataUS, hoje) < 0) return { erro: 'A data do exame está no futuro.' };
  const igUS = s * 7 + d;
  const dias = igUS + diffDias(dataUS, hoje);
  if (dias < 0) return { erro: 'A data do exame está no futuro.' };
  if (dias > MAX_IG) return { erro: 'IG acima de 44 semanas: confira os dados.' };
  return {
    dataUS, igUS, dias, ig: fmtIG(dias), rotulo: rotuloIG(dias),
    dpp: addDias(dataUS, 280 - igUS), dumEquivalente: addDias(dataUS, -igUS),
  };
}

// Compara a DUM com a USG (limites do ACOG usados no resto do app).
export function compararDUMUSG(dum, us) {
  if (!dum || !us || us.erro) return null;
  const igDumNoExame = diffDias(dum, us.dataUS);
  if (igDumNoExame < 0) return null;
  const diferenca = Math.abs(igDumNoExame - us.igUS);
  const limite = limiteDiscrepancia(us.igUS);
  return { diferenca, limite, usarUSG: diferenca > limite };
}

// ---------- Bishop ----------
export const BISHOP = [
  { id: 'dil', nome: 'Dilatação', opcoes: [[0, 'fechado'], [1, '1–2 cm'], [2, '3–4 cm'], [3, '≥ 5 cm']] },
  { id: 'apag', nome: 'Apagamento', opcoes: [[0, '0–30%'], [1, '40–50%'], [2, '60–70%'], [3, '≥ 80%']] },
  { id: 'alt', nome: 'Altura (De Lee)', opcoes: [[0, '−3'], [1, '−2'], [2, '−1 / 0'], [3, '+1 / +2']] },
  { id: 'cons', nome: 'Consistência', opcoes: [[0, 'firme'], [1, 'média'], [2, 'macia']] },
  { id: 'pos', nome: 'Posição', opcoes: [[0, 'posterior'], [1, 'intermediária'], [2, 'central']] },
];

export function calcBishop(sel = {}) {
  let total = 0;
  let marcados = 0;
  for (const c of BISHOP) {
    const v = sel[c.id];
    if (Number.isInteger(v) && c.opcoes.some(([p]) => p === v)) { total += v; marcados++; }
  }
  const completo = marcados === BISHOP.length;
  let leitura = '';
  if (completo) {
    if (total >= 8) leitura = 'Colo favorável (≥ 8).';
    else if (total >= 7) leitura = 'Colo intermediário (7).';
    else leitura = 'Colo desfavorável (≤ 6): pesar preparo do colo conforme o protocolo do serviço.';
  }
  return { total, marcados, completo, leitura };
}

// ---------- Apgar ----------
export const APGAR = [
  { id: 'fc', nome: 'Frequência cardíaca', opcoes: [[0, 'ausente'], [1, '< 100'], [2, '≥ 100']] },
  { id: 'resp', nome: 'Respiração', opcoes: [[0, 'ausente'], [1, 'fraca / irregular'], [2, 'choro forte']] },
  { id: 'tonus', nome: 'Tônus', opcoes: [[0, 'flácido'], [1, 'alguma flexão'], [2, 'movimento ativo']] },
  { id: 'irrit', nome: 'Irritabilidade reflexa', opcoes: [[0, 'sem resposta'], [1, 'careta'], [2, 'choro / tosse']] },
  { id: 'cor', nome: 'Cor', opcoes: [[0, 'cianose / palidez'], [1, 'extremidades cianóticas'], [2, 'rosado']] },
];

export function calcApgar(sel = {}) {
  let total = 0;
  let marcados = 0;
  for (const c of APGAR) {
    const v = sel[c.id];
    if (Number.isInteger(v) && c.opcoes.some(([p]) => p === v)) { total += v; marcados++; }
  }
  const completo = marcados === APGAR.length;
  let leitura = '';
  if (completo) leitura = total >= 7 ? 'Normal (7–10)' : total >= 4 ? 'Depressão moderada (4–6)' : 'Depressão grave (0–3)';
  return { total, marcados, completo, leitura };
}

// ---------- IMC ----------
export function classeIMC(imc) {
  if (imc < 18.5) return 'Baixo peso';
  if (imc < 25) return 'Eutrófico';
  if (imc < 30) return 'Sobrepeso';
  if (imc < 35) return 'Obesidade grau I';
  if (imc < 40) return 'Obesidade grau II';
  return 'Obesidade grau III';
}

// Ganho de peso total recomendado na gestação única, pelo IMC pré-gestacional (IOM 2009), em kg.
export function ganhoRecomendado(imcPre) {
  if (imcPre < 18.5) return { min: 12.5, max: 18 };
  if (imcPre < 25) return { min: 11.5, max: 16 };
  if (imcPre < 30) return { min: 7, max: 11.5 };
  return { min: 5, max: 9 };
}

// Altura aceita em cm (165) ou em metros (1,65).
export function lerAltura(txt) {
  const n = lerNumero(txt);
  if (n === null) return null;
  const cm = n <= 3 ? n * 100 : n;
  return cm >= 100 && cm <= 230 ? cm : null;
}

export function calcIMC({ peso, altura, pesoPre } = {}) {
  const p = lerNumero(peso);
  const h = lerAltura(altura);
  if (p === null || h === null) return null;
  if (p < 20 || p > 300) return { erro: 'Peso: use de 20 a 300 kg.' };
  const imc = p / ((h / 100) ** 2);
  const r = { imc: Math.round(imc * 10) / 10, classe: classeIMC(imc), altura: h, peso: p };
  const pre = lerNumero(pesoPre);
  if (pre !== null) {
    if (pre < 20 || pre > 300) return { erro: 'Peso pré-gestacional: use de 20 a 300 kg.' };
    const imcPre = pre / ((h / 100) ** 2);
    r.pre = {
      imc: Math.round(imcPre * 10) / 10,
      classe: classeIMC(imcPre),
      ganho: Math.round((p - pre) * 10) / 10,
      recomendado: ganhoRecomendado(imcPre),
    };
  }
  return r;
}
