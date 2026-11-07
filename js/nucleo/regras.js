// Parser e formatador das regras de ronda (uma regra por linha, campos separados por "|").
import { parseIG, fmtIG } from './datas.js';
import { dividirLinhas, parseAlvo } from './textoregras.js';

const RE_ID = /^[a-z0-9][a-z0-9-]*$/;
const RE_INT = /^\d+$/;

function parseLinha(campos) {
  if (campos.length < 7) return new Error('linha incompleta: esperados pelo menos 7 campos');
  if (campos.length > 9) return new Error('campos demais — há um "|" sobrando?');
  const [id, alvoTxt, iniTxt, fimTxt, nivel, msg, fonte, antTxt = '', repTxt = ''] = campos;
  if (!RE_ID.test(id)) return new Error(`id inválido: "${id}" (use letras minúsculas, números e hífen)`);
  const alvo = parseAlvo(alvoTxt);
  if (alvo instanceof Error) return alvo;
  const ini = parseIG(iniTxt);
  if (ini === null || ini === undefined) return new Error(`IG início inválida: "${iniTxt}" (use 37+0)`);
  let fim = null;
  if (fimTxt !== '') {
    fim = parseIG(fimTxt);
    if (fim === null || fim === undefined) return new Error(`IG fim inválida: "${fimTxt}" (use 37+0)`);
    if (fim < ini) return new Error(`IG fim anterior ao início: "${fimTxt}" < "${iniTxt}"`);
  }
  if (nivel !== 'vermelho' && nivel !== 'amarelo') return new Error(`nível inválido: "${nivel}" (use vermelho ou amarelo)`);
  if (!msg) return new Error('mensagem vazia');
  const inteiro = (txt, nome) => txt === '' ? null : RE_INT.test(txt) ? Number(txt) : new Error(`${nome} inválida: "${txt}" (use um número inteiro ≥ 0)`);
  const antecedencia = inteiro(antTxt, 'antecedência');
  if (antecedencia instanceof Error) return antecedencia;
  const repetir = inteiro(repTxt, 'repetir');
  if (repetir instanceof Error) return repetir;
  const tipo = repetir !== null ? 'pendencia' : id.startsWith('res-') ? 'resolucao' : 'janela';
  return { id, alvo, ini, fim, nivel, msg, fonte, antecedencia, repetir, tipo };
}

export function parseRegras(texto) {
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

function fmtAlvo(a) {
  return (a.dx ?? '') + a.exige.map(m => '+' + m).join('') + a.proibe.map(m => '!' + m).join('');
}

export function formatarRegra(r) {
  const num = v => v === null || v === undefined ? '' : String(v);
  return [r.id, fmtAlvo(r.alvo), fmtIG(r.ini), r.fim === null ? '' : fmtIG(r.fim), r.nivel, r.msg, r.fonte,
    num(r.antecedencia), num(r.repetir)].join(' | ');
}
