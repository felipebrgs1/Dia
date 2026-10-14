# Relatos de uso do nodebuilder

Problemas encontrados ao construir o **Dia** (começou como clone do Obsidian) (editor markdown, explorador de arquivos,
backlinks, busca, quick switcher, grafo de forças) com o nodebuilder.

- Começou em `@nodebuilderjs/core` 0.2.5; **revisado na 0.4.0** (os itens abaixo continuam
  valendo nela).
- Bun 1.4.3, Linux (CachyOS, Wayland, NVIDIA), TypeScript 7.0.2.
- Cada item traz: o que aconteceu, o contorno usado no app (com arquivo) e uma sugestão.
- Gravidade: **alta** = bloqueou o caminho óbvio e exigiu reimplementar algo grande;
  **média** = exigiu um hack ou ler o código-fonte do framework; **baixa** = incômodo.

---

## Alta

### 1. Não existe campo de texto multilinha

`TextField` é só de uma linha: colar converte quebras de linha em espaços e não há
`multiline`/`TextArea`. Para um editor de notas, esse é o componente principal.

**Contorno:** escrevi um editor inteiro do zero (cerca de 900 linhas). Ele tem:
- modelo de texto com seleção e undo (`src/editor/model.ts`);
- layout com quebra de linha e mapeamento caret ↔ posição (`src/editor/layout.ts`);
- widget sobre `Canvas` com teclado e mouse (`src/editor/Editor.tsx`).

**Sugestão:** um `TextArea` (ou `TextField multiline`) com quebra de linha, seleção,
Shift+setas, Ctrl+C/X/V, undo e rolagem até o caret.

### 2. `TextField` não expõe o caret nem a seleção

A primeira ideia foi editar por blocos (uma linha = um `TextField`), mas não é possível:
- ler a posição do caret (para dividir a linha no Enter);
- definir a posição do caret (ao juntar linhas no Backspace, ele sempre vai para o fim);
- saber se há seleção.

**Sugestão:** `caret`/`selection` controláveis (accessor + `onSelectionChange`) ou, pelo menos,
métodos no `ref` (`el.setSelection(a, b)`, `el.selection`).

### 3. Não há texto rico (vários estilos num mesmo parágrafo)

`Text` tem um só estilo. Não dá para fazer um parágrafo com **negrito**, `código` e um link
clicável no meio, que é o necessário para renderizar markdown (o modo leitura do Obsidian).

**Contorno:** todo o texto da nota é desenhado peça por peça no `Canvas`, com quebra de linha
própria.

**Sugestão:** um `RichText` com spans (`{ text, color, bold, italic, fontFamily, background,
onClick }`) que quebre linha entre spans.

---

## Média

### 4. `measureText` não é público

`measureText` existe em `render/node.ts`, mas não é exportado. A única forma de medir texto é
`g.measureText` **dentro** do `draw` do `Canvas`. Só que eu precisava medir antes de desenhar,
para calcular a altura do conteúdo (e, com ela, a rolagem).

**Contorno** (`src/editor/Editor.tsx`, função `draw`):
1. o primeiro layout usa uma estimativa (`0.55 × tamanho` por caractere);
2. no primeiro `draw`, guardo `g.measureText`;
3. refaço o layout num `queueMicrotask`, porque o `draw` não pode alterar signals.

**Sugestão:** exportar `measureText(text, size, options)` com as mesmas opções de fonte do
`Canvas`.

### 5. `PointerEvent` não tem teclas modificadoras, e não há `onKeyUp`

O evento de ponteiro só tem `button` e `clicks`, sem `ctrl`, `shift` ou `alt`. Como também não
existe `onKeyUp`, nem dá para acompanhar o estado das teclas por conta própria. Ficaram
impossíveis:
- **Ctrl+clique** para abrir um link (o padrão do Obsidian no modo fonte);
- **Shift+clique** para estender a seleção.

**Contorno:** o clique simples abre o link e, para editá-lo, é preciso clicar nos colchetes.
Também adicionei Ctrl+Enter para abrir o link sob o caret.

**Sugestão:** `ctrl`, `shift`, `alt` e `meta` em `PointerEvent` (e em `ScrollEvent`, para
Ctrl+roda = zoom), além de `onKeyUp`.

### 6. `Canvas`: sem região visível e sem tamanho próprio

- **Sem região visível:** o `draw` não sabe que parte está visível (posição da rolagem). Uma
  nota longa grava todas as linhas a cada mudança, mesmo as que estão fora da tela.
- **Sem tamanho próprio:** o `Canvas` não tem tamanho intrínseco. Calculo a altura do conteúdo
  e a coloco num `Box` em volta. Funciona, mas depende do item 4.

**Sugestão:** `g.visibleRect` (redesenhando quando a rolagem muda) e uma prop
`measure={(width) => height}` no `Canvas`.

### 7. Não há como rolar até um retângulo

`scrollIntoView()` mostra o elemento inteiro, mas eu precisava mostrar só o caret, que é uma
região dentro do `Canvas`.

**Contorno** (`src/editor/Editor.tsx`, `reveal`): calcular à mão com `box.y - scroller.y +
scroller.scrollY` e chamar `scrollTo`. Depois de abrir uma nota, ainda tive de chamar de novo
num `setTimeout(16)`, porque a posição só existe após o layout. O `onMount` (0.4) resolve o
primeiro layout, mas não a troca de nota.

**Sugestão:** `el.scrollIntoView({ x, y, width, height })` para uma região relativa ao
elemento.

### 8. Não dá para estender o tema

Precisei de cores que não existem no `theme` (barra lateral, ribbon, fundo de código, links,
tags, grafo). Não há como adicionar tokens próprios que acompanhem `setTheme`.

**Contorno** (`src/theme.ts`): um objeto paralelo com getters que leem `colorScheme()`.

**Sugestão:** `setTheme` aceitar chaves extras (tipadas via genérico) ou um
`createThemeTokens({ light, dark })` reativo.

### 9. `nodebuilder screenshot` de um app que lê `process.argv`

O screenshot importa o arquivo do app sem os argumentos da linha de comando. Este app usa
`process.argv[2]` como pasta do cofre; sem ela, abriria o cofre padrão do usuário (e criaria a
pasta, se não existisse). Além disso, `NB_SCREENSHOT_ENTRY` só existe no modo `--export`, o que
me fez errar a detecção na primeira tentativa.

**Contorno** (`src/App.tsx`): com `NB_SCREENSHOT` definido e sem `vaultPath`, o app usa um
cofre em memória com as notas de exemplo.

**Sugestão:** documentar a variável que indica "rodando sob screenshot" (ou expor
`isScreenshot()`), e permitir passar argumentos ao app (`nodebuilder screenshot app.tsx out.png
-- --vault x`).

---

### 10. Filhos de `<Show>` são avaliados mesmo com a condição falsa

No SolidJS, `<Show when={x}>{f(x)}</Show>` só chama `f` quando `x` é verdadeiro, porque o
compilador transforma os filhos em getters. Aqui a expressão é avaliada ao montar o JSX:

```tsx
<Show when={() => t.due}>
  <Text>{shortDate(t.due!)}</Text>   {/* roda com t.due === undefined e quebra */}
</Show>
```

Quem vem do Solid (o `AGENTS.md` diz "como SolidJS") espera o contrário.

**Contorno** (`src/components/Tasks.tsx`): `{() => shortDate(t.due!)}`.

**Sugestão:** documentar com destaque na skill, ou avisar em desenvolvimento.

### 11. Erros durante a montagem não apontam para o código do app

Os dois erros acima (`null is not an object (evaluating 'd.getDate')` e `Cannot access 'goto'
before initialization`) vieram no `bun test` com uma pilha só de frames do framework
(`handleError`, `execute`, `createEffect`, `insertNow`, `holdMounts`), sem o arquivo do app.
Tive de deduzir a origem.

**Sugestão:** preservar a pilha original do erro (`cause`) ao relançar em `handleError`, ou
incluir o nome do componente em que o efeito foi criado.

## Baixa

### 12. Filhos `position="absolute"` ficam dentro do padding do pai

No CSS, `left: 0` de um filho absoluto é a borda do pai (padding box). Aqui é o início do
conteúdo, depois do padding. Uma faixa colorida em `left={0}` de um card com
`padding={[3, 6, 3, 9]}` apareceu por cima do texto, e não na borda.

**Contorno** (`src/components/WeekView.tsx`): `left={-9} top={-3}`, o padding em negativo.

**Sugestão:** documentar na skill (seção de layout e na `nodebuilder-from-react`), ou seguir o
CSS.

### 13. Título do `Window` não é reativo

`title` é uma `string`, não aceita accessor. Usei `windowControls.setTitle` num efeito
(`src/App.tsx`). Desde a 0.3 dá para fazer a barra de título própria (`decorations={false}`),
o que resolve o resto.

**Sugestão:** `title` como `MaybeAccessor<string>`.

### 14. Menu de contexto na posição do mouse

O clique direito está documentado (`onPointerDown` com `button === 2`), mas não há `Overlay`
ancorado num ponto.

**Contorno** (`src/components/FileExplorer.tsx`): `Overlay` sem âncora e
`Card position="absolute" left={x} top={y}`. O menu não muda de lado quando não cabe na janela.

**Sugestão:** `<Overlay at={{ x, y }}>`, com o mesmo reposicionamento do `anchor`.

### 15. Ctrl+letra pode chegar maiúscula ou minúscula

Com Ctrl, `text` vem vazio e a letra em `key` pode vir maiúscula (com Shift ou Caps Lock): o
próprio `TextField` testa `"v"` e `"V"`, e o app precisa fazer o mesmo.

**Contorno:** normalizar no app (`e.key.length === 1 ? e.key.toLowerCase() : e.key`).

**Sugestão:** normalizar `key` (letra minúscula + `shift`) e trocar `"ISO_Left_Tab"` por
`"Tab"` + `shift`.

---

## Já corrigidos na 0.3.0 / 0.4.0

Relatados na 0.2.5. Confirmei que estão resolvidos e tirei os contornos do app:

| Problema na 0.2.5 | Solução | Efeito no app |
|---|---|---|
| A janela redesenhava sem parar mesmo parada (~115 fps). Causa: `setActiveBar` em `runtime/input.ts` comparava `undefined === null`. | 0.3.0, "Idle redraw" | CPU parado: **19% → 0–1%** (medido; RAM ~147 MB) |
| Sem itálico e sem escolha de fonte | `italic` (0.3); `fontFamily`, `registerFont` e opções de fonte no `Canvas` (0.4) | `*ênfase*` em itálico de verdade; código em fonte monoespaçada |
| Widgets próprios não recebiam foco sem converter o `ref` para `UINode` | prop `focusable` / `tabStop` (0.4) | o editor usa `focusable tabStop` |
| Atalhos globais paravam quando nada estava focado | teclas chegam ao `onKeyDown` do `Window` (0.4) | atalhos no `<Window onKeyDown>`, sem a raiz focável |
| Barra de título fechada | `decorations={false}`, `dragRegion`, `<WindowControls />` (0.3) | ainda não usado |
| Nomes de tecla não documentados | listados na skill `nodebuilder-ui` (0.3) | — |
| Difícil achar widgets nos testes | `ariaLabel` + `findByLabel`, `findByValue`, `screenshot()` (0.3/0.4) | — |
| Ver a interface exigia abrir janela | `nodebuilder screenshot` com `--props` (0.3/0.4) | prop `note` no `App` para fotografar qualquer nota |

O changelog da 0.3 também avisa que `export { default as x } from "x.svg" with { type: "text" }`
perde o atributo no Bun. Meu `src/icons.ts` usava esse padrão e foi regenerado com
`nodebuilder icons add`.

---

## O que funcionou bem

- O modelo reativo (signals, memos, `For`, `Show`, `Switch`) é previsível e rápido. O app
  inteiro roda com layout + paint abaixo de 1 ms por frame e, na 0.4, 0% de CPU parado.
- `Canvas` com `onPointerMove`, `onScroll` e `requestAnimationFrame` deu conta do grafo com
  simulação de forças sem nenhum problema.
- `Dialog`, `Tooltip`, `Overlay modal` e o cuidado com o foco ao fechar funcionaram sem ajustes.
- Os testes sem janela (`mount` + `interact`) são ótimos: deu para testar digitação, atalhos e
  o quick switcher de ponta a ponta.
- `nodebuilder doctor` e `nodebuilder screenshot` (0.4) aceleram muito a verificação visual.
