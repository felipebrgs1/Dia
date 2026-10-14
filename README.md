# Dia

Central de produtividade para Linux: notas em markdown no estilo do Obsidian, tarefas e
calendário com notas diárias, num visual claro e quente (com tema escuro). Feito com
[nodebuilder](https://www.npmjs.com/package/@nodebuilderjs/core) 0.4: TSX com reatividade estilo
SolidJS, desenhado por um core nativo (Wayland/X11 + GLES), sem DOM nem Electron.

```sh
bun run dev [pasta-do-cofre]   # abre a janela e reinicia ao salvar
bun start [pasta-do-cofre]     # roda uma vez
bun test                       # testes sem janela (test/)
bun run typecheck              # TypeScript 7
bun run screenshot             # screenshot.png sem abrir janela (com as notas de exemplo)
bun run doctor                 # verifica core nativo, display, fontes e GL
bun run icons:add <nomes...>   # adiciona ícones Lucide em src/icons.ts
bun run package                # AppImage, .deb, .rpm e .tar.gz em dist/
```

Screenshot de uma tela específica:
`bunx nodebuilder screenshot src/App.tsx shot.png --export App --props '{"view":"calendar","theme":"dark"}'`
(`view`: `home`, `calendar`, `editor`, `graph`; ou `"note": "Projetos/Dia.md"`).

O cofre é uma pasta de arquivos `.md`: o primeiro argumento, ou `$DIA_VAULT`, ou `~/Dia`.
Notas de exemplo só são criadas quando a pasta ainda não existe.

## O que já funciona

- **Hoje**: saudação, nota do dia, tarefas abertas de todas as notas (marcar aqui grava na
  nota), mini calendário e notas recentes.
- **Calendário**: mês inteiro; cada dia tem sua nota diária (`Diário/AAAA-MM-DD.md`) e mostra
  as tarefas do dia e as com prazo `📅 AAAA-MM-DD` (ou `@AAAA-MM-DD`).
- **Editor markdown** próprio (sobre `Canvas`): títulos, negrito, *itálico*, código em fonte
  mono, citações, listas, tarefas clicáveis, `[[links]]`; seleção, copiar/colar, desfazer.
- **Links**: backlinks, links de saída e sumário no painel da direita; renomear atualiza links.
- **Busca** (Ctrl+Shift+F), **tags**, **abrir rápido** (Ctrl+K), **grafo** com física (Ctrl+G).
- Barra de título própria, tema claro (padrão) e escuro, salvamento automático.

Atalhos: Ctrl+K abrir/criar nota, Ctrl+N nova nota, Ctrl+D nota de hoje, Ctrl+G grafo,
Ctrl+\\ barra lateral, Alt+←/→ voltar/avançar, Ctrl+B/I negrito/itálico.

## Estrutura

```
src/
  main.tsx                 abre a janela
  App.tsx                  barra de título, barra lateral, telas, atalhos e diálogos
  workspace.ts             estado do cofre: notas, tarefas, notas diárias, links, busca, histórico
  ui.ts                    estado da tela: tela atual, mês/dia do calendário, painéis
  theme.ts                 paleta do Dia (claro e escuro)
  dates.ts                 datas locais "AAAA-MM-DD" e nomes em português
  vault/                   arquivos no disco, markdown (links, tarefas, tags), notas de exemplo
  editor/                  modelo de texto, layout do markdown e o widget do editor
  graph/physics.ts         simulação de forças do grafo
  components/              Hoje, Calendário, tarefas, explorador, busca, painel direito, grafo
test/
  core.test.ts             markdown, tarefas, datas, editor, layout, workspace, física
  App.test.tsx             o app montado sem janela: Hoje, tarefas, editor, Ctrl+K, calendário, grafo
```

Requisitos: Linux com Wayland ou X11, [Bun](https://bun.sh) 1.4+.
