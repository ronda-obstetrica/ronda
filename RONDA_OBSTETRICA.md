# Ronda Obstétrica

App de bolso para o plantonista da enfermaria de gestação de alto risco. Substitui o censo manual diário e evita esquecer programações (exames, condutas, interconsultas) que não cabem na evolução.

## Objetivo

- Mostrar, em uma tela, todas as pacientes internadas e o que falta fazer em cada uma.
- Gerar as pendências automaticamente a partir do protocolo do diagnóstico.
- Gerar o texto da passagem de plantão sem digitar censo.

## Regra de privacidade (LGPD)

- Paciente identificada somente pelo leito.
- Sem campo de nome, iniciais, prontuário, data de nascimento, telefone ou nome do hospital.
- Dados guardados apenas no navegador do aparelho (localStorage). Nenhum servidor.
- Observação livre limitada a 240 caracteres, com aviso para não usar nomes.

## Estado atual (protótipo v1)

Arquivo único `ronda.html`, HTML + CSS + JavaScript puro, sem dependências além de duas fontes do Google Fonts (Public Sans e IBM Plex Mono). Funciona no celular e em modo claro/escuro.

Abas:

- **Censo**: um cartão por leito com idade, G/P/cesáreas/A, IG (avança sozinha a cada dia), diagnóstico, dia de internação, alergias, observação e lista de pendências com check.
- **Hoje**: pendências de todos os leitos, agrupadas em atrasadas, hoje, amanhã e concluídas hoje.
- **Plantão**: texto da passagem pronto para copiar (WhatsApp, e-mail).
- **Protocolos**: edição em texto dos protocolos por diagnóstico.
- **Dados**: aviso de LGPD, backup em JSON (colar/restaurar) e apagar tudo.

Comportamentos:

- Ao cadastrar a paciente, cria as pendências do protocolo do diagnóstico.
- Item recorrente: ao marcar como feito, cria a próxima ocorrência (hoje + rep dias). Desmarcar remove a ocorrência criada.
- "Aplicar protocolo" adiciona só o que ainda não existe em aberto (não duplica).
- Abre com 3 leitos de exemplo fictícios (04, 07, 09), com botão para apagá-los.

## Modelo de dados

Chave do localStorage: `ronda-obstetrica-v1`.

```json
{
  "v": 1,
  "prot": { "dheg": "texto do protocolo", "dmg": "...", "...": "..." },
  "pac": [
    {
      "id": "abc1234",
      "leito": "04",
      "idade": 27,
      "igDays": 219,
      "igRef": "2026-11-02",
      "g": 2, "p": 1, "c": 1, "a": 0,
      "dx": "dheg",
      "int": "2026-10-29",
      "alerg": "",
      "obs": "",
      "ex": true,
      "pend": [
        {
          "id": "x9y8z7",
          "texto": "Vitalidade fetal (CTG ou PBF)",
          "cat": "Exame",
          "due": "2026-11-04",
          "rep": 2,
          "done": false,
          "doneAt": "2026-11-04",
          "spawn": "id da próxima ocorrência"
        }
      ]
    }
  ]
}
```

- `igDays` é a IG em dias na data `igRef`. A IG de hoje = `igDays + (hoje - igRef)`.
- `ex: true` marca paciente de exemplo.
- Diagnósticos (`dx`): dheg, dmg, tpp, rpmo, placenta, rcf, colestase, outro.
- Categorias: Exame, Medicação, Avaliação, Interconsulta, Conduta, Outro.

## Formato dos protocolos

Uma linha por item:

```
texto | categoria | dias até o 1º prazo | repetir a cada N dias (0 = não repete)
```

Exemplo: `Vitalidade fetal (CTG ou PBF) | Exame | 0 | 2`

**Atenção**: os protocolos que acompanham o protótipo são modelos genéricos, sem doses e sem fonte. Precisam ser substituídos pelos protocolos institucionais e diretrizes que o usuário segue antes de qualquer uso real.

## Estrutura do código (dentro do ronda.html)

- Tokens de cor e fonte em `:root`, com tema claro, escuro automático e `data-theme`.
- `PROT_PADRAO`: protocolos iniciais.
- Funções de data: `hoje`, `addDias`, `diff`, `igAtual`.
- Estado: `load`, `save`, `seed`.
- Visões: `vCenso`, `vHoje`, `vPlantao`, `vProt`, `vDados`; `render()` redesenha a aba ativa.
- Formulários em folha inferior: `pacForm`, `pendForm`.
- Eventos por delegação em `document` usando `data-act`.

## Limitações conhecidas

- Dados presos a um aparelho; troca de aparelho só por backup manual.
- Sem login, sem sincronização, sem trabalho em equipe.
- Sem notificações.
- Sem alertas por IG (janela de corticoide, IG-alvo do parto).
- Sem histórico de evolução por paciente.
- Testado apenas com checagem de sintaxe e simulação de lógica; precisa de teste real no celular.

## Próximos passos sugeridos

- Testar no celular e anotar atritos do uso real na visita.
- Substituir os protocolos genéricos pelos institucionais, citando a fonte de cada item.
- Alertas por IG por diagnóstico.
- Cadastro rápido por leito (menos campos obrigatórios).
- PWA instalável (manifest + service worker) para uso offline.
- Sincronização entre plantonistas, com backend e criptografia, somente após revisão de LGPD com a instituição (comitê de ética/DPO).
- Integração com a escala da residência.

Design da v2: `docs/superpowers/specs/2026-11-05-ronda-v2-alertas-ig-design.md`.
