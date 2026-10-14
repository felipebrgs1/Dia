// Notes written into a brand-new vault.

export const WELCOME: Record<string, string> = {
  "Bem-vindo.md": `Este é o seu **cofre**: uma pasta comum de arquivos \`.md\` no disco. Tudo o que você escreve é salvo sozinho.

## Comece por aqui
- Crie uma nota com **Ctrl+N** ou com o botão na barra lateral.
- Abra qualquer nota rápido com **Ctrl+O**.
- Busque em todas as notas com **Ctrl+Shift+F**.
- Ligue notas escrevendo [[Links internos]] entre colchetes duplos.
- Veja como tudo se conecta na [[Visão de grafo]].

## Tarefas
- [x] Abrir o app
- [ ] Escrever a primeira nota
- [ ] Criar um link para outra nota

> Dica: clique em um link para abrir a nota (ou Ctrl+Enter com o cursor nele). Se ela não existir, ela é criada.

#inicio
`,
  "Links internos.md": `Escreva \`[[Nome da nota]]\` para ligar notas. Também funciona:
- \`[[Nome da nota|texto mostrado]]\`
- \`[[Nome da nota#Seção]]\`

O painel à direita mostra os **backlinks**: as notas que apontam para a nota aberta.

Voltar para [[Bem-vindo]].
`,
  "Visão de grafo.md": `O botão de grafo na barra da esquerda (ou Ctrl+G) mostra cada nota como um ponto e cada link como uma linha. Clique em um ponto para abrir a nota.

Veja também [[Links internos]] e [[Ideias/Projetos]].
`,
  "Ideias/Projetos.md": `Notas podem ficar em pastas. Esta está em \`Ideias/\`.

\`\`\`ts
// blocos de código ficam destacados
const ideia = "clone do Obsidian";
\`\`\`

---

Ideias soltas: ==destaque==, *ênfase*, ~~riscado~~ e #ideias.
`,
};
