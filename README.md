# Obsidian (clone)

Clone do [Obsidian](https://obsidian.md) para Linux, feito com
[nodebuilder](https://www.npmjs.com/package/@nodebuilderjs/core) 0.4: TSX com reatividade estilo
SolidJS, desenhado por um core nativo (Wayland/X11 + GLES), sem DOM nem Electron.

```sh
bun run dev [pasta-do-cofre]   # abre a janela e reinicia ao salvar
bun start [pasta-do-cofre]     # roda uma vez
bun test                       # testes sem janela (test/)
bun run typecheck              # TypeScript 7
bun run package                # AppImage, .deb, .rpm e .tar.gz em dist/
bun run screenshot             # screenshot.png sem abrir janela (com as notas de exemplo)
bun run doctor                 # verifica core nativo, display, fontes e GL
bun run icons:add <nomes...>   # adiciona ícones Lucide em src/icons.ts
```

O cofre é uma pasta de arquivos `.md`: o primeiro argumento, ou `$OBSIDIAN_VAULT`, ou
`~/ObsidianClone`. Notas de exemplo só são criadas quando a pasta ainda não existe.

## O que já funciona

- Explorador de arquivos com pastas, nova nota/pasta, renomear e excluir (vai para `.trash/`).
- Editor markdown próprio (multilinha, sobre `Canvas`): títulos, negrito, itálico, código,
  citações, listas e tarefas com estilo; seleção com mouse e Shift, Ctrl+A/C/X/V, Ctrl+Z/Y,
  Ctrl+B/I, listas que continuam no Enter, Tab/Shift+Tab, clique em `- [ ]` marca a tarefa.
- `[[Links internos]]`: clique abre (ou cria) a nota; renomear atualiza os links.
- Painel direito: backlinks, links de saída e sumário (títulos).
- Busca em todo o cofre (Ctrl+Shift+F), tags, quick switcher (Ctrl+O), visão de grafo (Ctrl+G).
- Histórico (Alt+← / Alt+→), salvamento automático, tema escuro/claro.

## Estrutura

```
src/
  main.tsx                 abre a janela
  App.tsx                  layout (ribbon, barras laterais, editor), atalhos e diálogos
  workspace.ts             estado do cofre: notas, nota aberta, histórico, links, busca
  ui.ts                    estado da tela: painéis, abas, diálogos
  theme.ts                 cores no estilo do Obsidian (claro e escuro)
  vault/vault.ts           arquivos no disco (e um cofre em memória para os testes)
  vault/markdown.ts        wikilinks, títulos, tags, resolução e renomeação de links
  editor/model.ts          texto, seleção, undo e edições (sem desenho)
  editor/layout.ts         markdown -> linhas posicionadas e estilizadas (quebra de linha, caret)
  editor/Editor.tsx        o widget: desenha o layout, teclado e mouse
  components/              explorador, busca/tags, painel direito, quick switcher, grafo
test/
  core.test.ts             markdown, modelo do editor, layout e workspace
  App.test.tsx             o app montado sem janela: digitar, Ctrl+O, Ctrl+G
```

Requisitos: Linux com Wayland ou X11, [Bun](https://bun.sh) 1.4+.
