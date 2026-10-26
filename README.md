# Rumo ao Revalida

Aplicativo web para organizar os estudos do **Revalida (INEP)**. Funciona direto no navegador, sem instalação e sem servidor: abra o `index.html`.

## O que ele faz

- **Temas por nível**: 48 temas das 5 grandes áreas da prova (Clínica Médica, Cirurgia, Pediatria, Ginecologia e Obstetrícia, Medicina de Família e Preventiva), divididos em Nível 1 (alta incidência), Nível 2 (incidência média) e Nível 3 (complementar).
- **Explicação breve** de cada tema, com os pontos que mais caem.
- **Onde estudar**: protocolos do Ministério da Saúde, diretrizes das sociedades médicas, livros de referência e provas anteriores do INEP.
- **Vídeos**: links de busca no YouTube para aula completa, questões comentadas e resumo de revisão de cada tema.
- **Porcentagem estudada** por tema, por área, por nível e geral:
  - aula: 20% · leitura/resumo: 20% · questões: 20% · revisões R1, R2 e R3: 40%.
- **Quando revisar** (revisão espaçada): R1 em 24 h, R2 em 7 dias, R3 em 30 dias e depois manutenção a cada 60 dias. Se o acerto na revisão for menor que 60%, o próximo intervalo cai pela metade; acima de 85%, aumenta 50%.
- **Sequência diária** (racha): conta os dias seguidos em que você estudou, mostra o recorde e um mapa das últimas 18 semanas.
- **Nível e XP**: cada etapa, revisão e bloco de questões dá XP (de Calouro a "Pronto para o Revalida").
- **Datas das provas**: calendário com as datas oficiais e as **datas prováveis** das próximas edições, contagem regressiva e ritmo sugerido (temas novos por semana). Você pode editar, adicionar e escolher sua prova-meta.
- **Backup**: gere um código com todo o seu progresso e cole-o em outro aparelho para restaurar.

## Datas cadastradas

| Edição | Etapa | Data | Situação |
|---|---|---|---|
| 2026.1 | 1ª etapa | 07/06/2026 | oficial |
| 2026.2 | 1ª etapa | 13/09/2026 | oficial (resultado definitivo previsto para 04/12/2026) |
| 2026.1 | 2ª etapa | 05/12/2026 | provável |
| 2026.2 | 2ª etapa | 15/05/2027 | provável |
| 2027.1 | 1ª etapa | 06/06/2027 | provável |
| 2027.2 | 1ª etapa | 12/09/2027 | provável |

As datas prováveis são estimativas feitas a partir das edições anteriores. Confirme sempre no [site do INEP](https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/revalida) e ajuste no app.

## Arquivos

- `index.html`: estrutura da página.
- `styles.css`: visual (tema claro e escuro automáticos).
- `data.js`: áreas, temas, resumos, fontes e calendário de provas. Edite aqui para acrescentar temas.
- `app.js`: progresso, revisões, sequência, nível e backup. Os dados ficam no `localStorage` do navegador.

## Como publicar

Qualquer hospedagem estática serve (GitHub Pages, Netlify, Vercel). No GitHub Pages: *Settings → Pages → Deploy from a branch* e escolha a branch com estes arquivos.
