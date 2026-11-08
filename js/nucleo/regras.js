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

export const REGRAS_GLOBAIS_TEXTO = `
corticoide | tpp | 24+0 | 33+6 | vermelho | Janela de corticoide — já recebeu ciclo? | RBEHG 2023 p.41; OMS 2022
corticoide-rpmo | rpmo | 24+0 | 33+6 | vermelho | Janela de corticoide — já recebeu ciclo? | RBEHG 2023 p.41; OMS 2022
corticoide-placenta | placenta | 24+0 | 33+6 | vermelho | Janela de corticoide — já recebeu ciclo? | RBEHG 2023 p.41; OMS 2022
corticoide-pe | dheg+gravidade | 24+0 | 33+6 | vermelho | Janela de corticoide — já recebeu ciclo? | RBEHG 2023 p.41, 44
corticoide-rcf | rcf | 24+0 | 33+6 | vermelho | Janela de corticoide — já recebeu ciclo? | RBEHG 2023 p.41; OMS 2022
mgso4-neuro |  | 24+0 | 31+6 | amarelo | <32 sem: se indicar parto, MgSO₄ para neuroproteção | RBEHG 2023 p.34, 41
res-pe-sem | dheg+pe!gravidade | 37+0 |  | vermelho | PE sem gravidade: indicar resolução a partir de 37+0 | RBEHG 2023 p.39 | 7
res-pe-sobreposta | dheg+hac-pe!gravidade | 37+0 |  | vermelho | PE sobreposta sem gravidade: resolução a partir de 37+0 | RBEHG 2023 p.39; ACOG CO 831 | 7
res-pe-grave | dheg+gravidade | 34+0 |  | amarelo | PE com gravidade estável: postergar se estável, reavaliar diariamente | RBEHG 2023 p.41 | 0
res-pe-grave-termo | dheg+gravidade | 37+0 |  | vermelho | PE com gravidade: resolução no termo | RBEHG 2023 p.41, 44 | 7
res-hg | dheg+hg | 37+0 |  | amarelo | Hipertensão gestacional: a partir de 37+0 individualizar | RBEHG 2023 p.42 | 7
res-hg-limite | dheg+hg | 39+6 | 39+6 | vermelho | Hipertensão gestacional: não ultrapassar 39+6 | RBEHG 2023 p.42 | 0
res-hac | dheg+hac!dificil | 37+0 | 39+6 | vermelho | HAC controlada: resolução entre 37+0 e 39+6 | ACOG CO 831 Tab.1 | 7
res-hac-dificil | dheg+hac+dificil | 36+0 | 37+6 | vermelho | HAC de difícil controle: resolução entre 36+0 e 37+6 | ACOG CO 831 Tab.1 | 7
res-dmg-a1 | dmg!medicacao!controle-ruim!dm-previo | 39+0 | 40+6 | vermelho | DMG sem medicação, bom controle: parto entre 39+0 e 40+6 | DMG-BR 2021 fig.6.2 p.84 | 7
res-dmg-a2 | dmg+medicacao!controle-ruim!dm-previo | 39+0 | 39+6 | vermelho | DMG com medicação, bom controle: parto entre 39+0 e 39+6 | DMG-BR 2021 fig.6.2 p.84 | 7
res-dmg-ruim | dmg+controle-ruim!dm-previo | 37+0 | 38+6 | vermelho | DMG com controle ruim: parto entre 37+0 e 38+6 | DMG-BR 2021 fig.6.2 p.84 | 7
res-dmprevio | dmg+dm-previo!controle-ruim | 38+0 | 39+6 | vermelho | DM prévio, bom controle: parto entre 38+0 e 39+6 | DMG-BR 2021 fig.6.2 p.84 | 7
res-dmprevio-ruim | dmg+dm-previo+controle-ruim | 37+0 | 37+0 | vermelho | DM prévio com controle ruim: considerar parto até 37+0 | DMG-BR 2021 fig.6.2 p.84 | 7
res-rcf-p3p10 | rcf+p3p10!concomitante | 38+0 | 39+0 | vermelho | RCF (PFE P3–P10): parto entre 38+0 e 39+0 | ACOG CO 831 Tab.1 | 7
res-rcf-p3 | rcf+p3!concomitante | 37+0 | 37+0 | vermelho | RCF (PFE <P3): parto com 37+0 | ACOG CO 831 Tab.1 | 7
res-rcf-ipau | rcf+ipau!concomitante | 37+0 | 37+0 | vermelho | RCF (IP AU >P95, diástole presente): parto com 37+0 | ACOG CO 831 Tab.1 | 7
res-rcf-dz | rcf+dz | 33+0 | 34+0 | vermelho | RCF com diástole zero: parto entre 33+0 e 34+0 | ACOG CO 831 Tab.1 | 7
res-rcf-dr | rcf+dr | 30+0 | 32+0 | vermelho | RCF com diástole reversa: parto entre 30+0 e 32+0 | ACOG CO 831 Tab.1 | 7
res-rcf-conc | rcf+concomitante!dz!dr | 34+0 | 37+6 | vermelho | RCF com condição concomitante: parto entre 34+0 e 37+6 | ACOG CO 831 Tab.1 | 7
res-colestase | colestase!ab100 | 36+0 | 39+0 | vermelho | Colestase (AB <100): parto entre 36+0 e 39+0 | ACOG CO 831 Tab.1 | 7
res-colestase-100 | colestase+ab100 | 36+0 | 36+0 | vermelho | Colestase (AB ≥100): parto com 36+0 | ACOG CO 831 Tab.1 | 7
res-rpmo | rpmo | 34+0 | 36+6 | vermelho | RPMO: parto entre 34+0 e 36+6, não ultrapassar 37+0 | ACOG CO 831 (interim update) | 7
res-placenta-previa | placenta!acretismo | 36+0 | 37+6 | vermelho | Placenta prévia: parto entre 36+0 e 37+6 | ACOG CO 831 Tab.1 | 7
res-placenta-acretismo | placenta+acretismo | 34+0 | 35+6 | vermelho | Suspeita de acretismo: parto entre 34+0 e 35+6 | ACOG CO 831 Tab.1 | 7
ctg-dmg-a1 | dmg!medicacao!dm-previo | 34+0 |  | amarelo | CTG semanal | DMG-BR 2021 p.73 |  | 7
ctg-dmg-a2 | dmg+medicacao!dm-previo | 32+0 |  | amarelo | CTG semanal | DMG-BR 2021 p.73 |  | 7
ctg-dmprevio | dmg+dm-previo | 28+0 |  | amarelo | CTG semanal | DMG-BR 2021 p.75 |  | 7
lab-pe | dheg+pe | 0+0 |  | amarelo | Hemograma/plaquetas, creatinina, TGO, DHL | RBEHG 2023 p.25–26, 39 |  | 7
lab-pe-sobreposta | dheg+hac-pe | 0+0 |  | amarelo | Hemograma/plaquetas, creatinina, TGO, DHL | RBEHG 2023 p.25–26, 39 |  | 7
`;

export const REGRAS_GLOBAIS = parseRegras(REGRAS_GLOBAIS_TEXTO).itens;
