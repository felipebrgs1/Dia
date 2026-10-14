// Notes written into a brand-new vault: a welcome page, a daily note for today and a project
// with dated tasks, so the home screen and the calendar have something to show.

import { addDays, longDate, today } from "../dates.js";

export const DAILY_FOLDER = "Diário";

/** A new daily note. */
export function dailyTemplate(iso: string) {
  return `# ${longDate(iso)}\n\n## Agenda\n\n## Tarefas\n- [ ] \n\n## Notas\n`;
}

/** A small iCal feed around `day`, shown as an external calendar in screenshots. */
export function sampleIcs(day = today()) {
  const stamp = (iso: string, time: string) => `${iso.replace(/-/g, "")}T${time.replace(":", "")}00`;
  const ev = (uid: string, title: string, start: string, end: string, extra = "") =>
    `BEGIN:VEVENT\nUID:${uid}@exemplo\nSUMMARY:${title}\nDTSTART:${start}\nDTEND:${end}\n${extra}END:VEVENT`;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Dia//Exemplo//PT",
    ev("daily", "Daily do time", stamp(addDays(day, -14), "09:30"), stamp(addDays(day, -14), "09:45"), "RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR\n"),
    ev("dentista", "Dentista", stamp(day, "17:30"), stamp(day, "18:30"), "LOCATION:Rua das Flores\\, 120\n"),
    ev("one", "1:1 com a gestora", stamp(addDays(day, 1), "14:00"), stamp(addDays(day, 1), "14:45")),
    `BEGIN:VEVENT\nUID:aniversario@exemplo\nSUMMARY:Aniversário da Ana\nDTSTART;VALUE=DATE:${addDays(day, 2).replace(/-/g, "")}\nDTEND;VALUE=DATE:${addDays(day, 3).replace(/-/g, "")}\nEND:VEVENT`,
    "END:VCALENDAR",
  ].join("\n");
}

export function welcomeNotes(day = today()): Record<string, string> {
  return {
    "Bem-vindo ao Dia.md": `O **Dia** junta suas notas, tarefas e calendário num lugar só. Tudo fica numa pasta comum de arquivos \`.md\` no seu disco, salvo sozinho.

## Comece por aqui
- A tela **Hoje** mostra a nota do dia, as tarefas abertas e o mês.
- O **Quadro** junta as tarefas de todas as notas em A fazer, Fazendo (\`- [/]\`) e Feito. Arraste os cartões entre as colunas.
- No **Calendário**, cada dia tem a sua nota diária. Na **Semana**, arraste num horário vazio para criar um evento; arraste um evento para mudar dia e hora, ou a borda de baixo para mudar a duração.
- Para ver sua agenda do Google (ou Outlook, iCloud), use o botão de ajustes no Calendário e cole o link iCal secreto.
- Crie uma nota com **Ctrl+N** e abra qualquer uma com **Ctrl+O**.
- Ligue notas com [[Links e tarefas|colchetes duplos]] e veja tudo no grafo (**Ctrl+G**).

## Tarefas
- [x] Abrir o Dia
- [ ] Escrever na nota de hoje
- [ ] Marcar uma tarefa com prazo 📅 ${addDays(day, 1)}

> Dica: clique num link para abrir a nota. Se ela não existir, ela é criada.

#inicio
`,
    "Links e tarefas.md": `Escreva \`[[Nome da nota]]\` para ligar notas; o painel da direita mostra quem aponta para cada uma.

Eventos ficam na seção "Agenda" das notas diárias, como \`- 14:00 - 15:30 Reunião\` (o mesmo formato do plugin Day Planner do Obsidian).

Tarefas são linhas \`- [ ] \`. Para dar um prazo, termine com \`📅 AAAA-MM-DD\` (ou \`@AAAA-MM-DD\`): ela aparece no dia certo do calendário.

Voltar para [[Bem-vindo ao Dia]].
`,
    "Projetos/Dia.md": `Um app de produtividade feito com nodebuilder.

## Próximos passos
- [/] Montar o quadro de tarefas
- [ ] Revisar as ideias 📅 ${addDays(day, 2)}
- [ ] Planejar a semana 📅 ${addDays(day, 5)}
- [x] Escolher as cores

\`\`\`ts
const app = "Dia";
\`\`\`

Ideias soltas: ==destaque==, *ênfase*, ~~riscado~~ e #ideias.
`,
    [`${DAILY_FOLDER}/${day}.md`]: `# ${longDate(day)}

## Agenda
- 09:00 - 10:00 Planejar o dia
- 12:30 - 13:30 Almoço
- [ ] 15:00 - 16:30 Revisar o [[Projetos/Dia|projeto]]

## Tarefas
- [ ] Conhecer o [[Bem-vindo ao Dia|Dia]]
- [ ] Criar a primeira nota

## Notas
`,
    [`${DAILY_FOLDER}/${addDays(day, 1)}.md`]: `# ${longDate(addDays(day, 1))}

## Agenda
- 10:00 - 11:00 Reunião de equipe
- 16:00 - 17:00 Academia

## Tarefas
- [ ] 

## Notas
`,
  };
}
