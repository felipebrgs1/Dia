import {
  Box,
  Button,
  type Child,
  Column,
  Dialog,
  Icon,
  Match,
  Row,
  Show,
  Switch,
  Text,
  TextField,
  Window,
  WindowControls,
  colorScheme,
  createEffect,
  createMemo,
  createSignal,
  isScreenshot,
  theme,
} from "@nodebuilderjs/core";
import appIcon from "./assets/dia.svg" with { type: "text" };
import { CALENDAR_COLORS, type Fetcher, createCalendars } from "./calendars/store.js";
import { AppProvider } from "./context.js";
import { BoardView } from "./components/BoardView.js";
import { CalendarsDialog, ExternalEventDialog } from "./components/Calendars.js";
import { CalendarView } from "./components/Calendar.js";
import { FileExplorer } from "./components/FileExplorer.js";
import { GraphView } from "./components/GraphView.js";
import { Home } from "./components/Home.js";
import { IconButton } from "./components/Item.js";
import { QuickSwitcher } from "./components/QuickSwitcher.js";
import { RightPanel } from "./components/RightPanel.js";
import { SearchPanel, TagsPanel } from "./components/SearchPanel.js";
import { Caption, Small } from "./components/Text.js";
import { today } from "./dates.js";
import { Editor } from "./editor/Editor.js";
import {
  arrowLeft,
  arrowRight,
  calendarDays,
  filePlus,
  files as filesIcon,
  folderPlus,
  gitFork as graphIcon,
  hash as hashIcon,
  house,
  moon,
  notebookPen,
  panelRight,
  search as searchIcon,
  squareKanban,
  sun,
} from "./icons.js";
import { applyTheme, colors } from "./theme.js";
import { type LeftTab, type View, createUi } from "./ui.js";
import { countWords, folderOf, noteName } from "./vault/markdown.js";
import { type Vault, defaultVaultPath, memoryVault, openVault } from "./vault/vault.js";
import { sampleIcs, welcomeNotes } from "./vault/welcome.js";
import { createDiaTray } from "./tray.js";
import { createWorkspace } from "./workspace.js";

const SIDEBAR_WIDTH = 248;

function Line(props: { vertical?: boolean }) {
  return props.vertical ? <Box width={1} background={() => colors.border} /> : <Box height={1} background={() => colors.border} />;
}

export function App(
  props: { vault?: Vault; vaultPath?: string; note?: string; view?: View; theme?: "light" | "dark"; fetcher?: Fetcher; calendarsOpen?: boolean } = {},
) {
  // `bun run screenshot` imports the app with no arguments: show the example notes from memory
  // instead of creating a vault on disk.
  const vault =
    props.vault ??
    (isScreenshot() && !props.vaultPath ? memoryVault(welcomeNotes()) : openVault(props.vaultPath || defaultVaultPath()));
  const demo = isScreenshot() && !props.vault && !props.vaultPath;
  if (demo) {
    // Screenshots show an example external calendar, from the cache (no network).
    vault.writeMeta("config.json", JSON.stringify({ calendars: [{ id: "demo", name: "Trabalho (Google)", url: "https://exemplo", color: CALENDAR_COLORS[0], enabled: true }] }));
    vault.writeMeta("cache/demo.ics", sampleIcs());
  }
  const ws = createWorkspace(vault);
  const cals = createCalendars(vault, { fetcher: props.fetcher, autoRefresh: !demo });
  const ui = createUi();
  applyTheme(props.theme ?? "light");

  if (props.note && ws.files().includes(props.note)) {
    ws.open(props.note);
    ui.setView("editor");
  }
  if (props.view) ui.setView(props.view);
  if (props.calendarsOpen) ui.setCalendarsOpen(true);

  process.on("exit", () => ws.flush());

  const text = createMemo(() => {
    ws.version();
    const path = ws.active();
    return path ? ws.read(path) : "";
  });

  const openUrl = (url: string) => {
    try {
      Bun.spawn(["xdg-open", url], { stdout: "ignore", stderr: "ignore" });
    } catch {}
  };
  const showTab = (tab: LeftTab) => {
    ui.setLeftTab(tab);
    ui.setLeftOpen(true);
  };
  const newNote = () => {
    ui.setView("editor");
    ws.create();
  };
  const openToday = () => {
    ui.setView("editor");
    ws.openDaily(today());
  };

  const tray = createDiaTray({ vault, ws, ui, cals, newNote, openToday });

  const shortcuts = (e: { key: string; ctrl: boolean; shift: boolean; alt: boolean; stop(): void }) => {
    const key = e.key; // with Ctrl or Alt, letters arrive lowercase
    if (e.ctrl && (key === "o" || key === "p" || key === "k")) ui.setSwitcher(true);
    else if (e.ctrl && key === "n") newNote();
    else if (e.ctrl && key === "d") openToday();
    else if (e.ctrl && e.shift && key === "f") showTab("search");
    else if (e.ctrl && key === "g") ui.setView((v) => (v === "graph" ? "editor" : "graph"));
    else if (e.ctrl && key === "\\") ui.setLeftOpen((o) => !o);
    else if (e.ctrl && key === "s") ws.flush();
    else if (e.alt && key === "Left") ws.goBack();
    else if (e.alt && key === "Right") ws.goForward();
    else return;
    e.stop();
  };

  // Rename and new folder dialogs share one text field value.
  const [name, setName] = createSignal("");
  const [error, setError] = createSignal("");
  createEffect(() => {
    const path = ui.renaming();
    if (path) (setName(noteName(path)), setError(""));
  });
  createEffect(() => ui.newFolder() && (setName(""), setError("")));
  const confirmRename = () => {
    const path = ui.renaming();
    if (!path) return;
    if (ws.rename(path, name()) === null) return setError("Já existe uma nota com esse nome.");
    ui.setRenaming(null);
  };
  const confirmFolder = () => {
    if (!name().trim()) return;
    ws.createFolder(name().trim());
    ui.setNewFolder(false);
  };

  const NavItem = (p: { icon: string; label: string; view: View; hint?: string }) => (
    <Row
      gap={10}
      align="center"
      padding={[7, 10]}
      radius={6}
      cursor="pointer"
      background={() => (ui.view() === p.view ? colors.active : "transparent")}
      hoverStyle={{ background: () => (ui.view() === p.view ? colors.active : colors.hover) }}
      color={() => (ui.view() === p.view ? theme.text.primary : theme.text.secondary)}
      onClick={() => ui.setView(p.view)}
    >
      <Icon svg={p.icon} size={17} strokeWidth={1.75} />
      <Text grow={1} bold={() => ui.view() === p.view}>{p.label}</Text>
      <Show when={() => p.hint}>
        <Small color={() => colors.faint}>{p.hint!}</Small>
      </Show>
    </Row>
  );

  const TabButton = (p: { icon: string; tab: LeftTab; tip: string }) => (
    <IconButton icon={p.icon} tip={p.tip} active={() => ui.leftTab() === p.tab} onClick={() => ui.setLeftTab(p.tab)} size={16} />
  );

  const TitleBar = () => (
    <Row dragRegion height={44} align="center" gap={6} padding={[0, 8, 0, 12]} background={() => colors.titlebar}>
      <Box width={24} height={24} radius={7} align="center" justify="center" background={() => colors.today}>
        <Icon svg={sun} size={15} strokeWidth={2.25} color={() => colors.todayText} />
      </Box>
      <Text bold fontSize={15} padding={[0, 6, 0, 2]}>Dia</Text>
      <IconButton icon={arrowLeft} tip="Voltar (Alt+←)" onClick={ws.goBack} size={16} />
      <IconButton icon={arrowRight} tip="Avançar (Alt+→)" onClick={ws.goForward} size={16} />
      <Box grow={1} />
      <Row
        width={440}
        height={30}
        gap={8}
        align="center"
        padding={[0, 10]}
        radius={8}
        cursor="pointer"
        background={() => colors.page}
        borderWidth={1}
        borderColor={() => colors.border}
        hoverStyle={{ borderColor: () => theme.accent.base }}
        color={() => theme.text.secondary}
        onClick={() => ui.setSwitcher(true)}
      >
        <Icon svg={searchIcon} size={15} />
        <Text grow={1} fontSize={13}>Buscar ou abrir uma nota</Text>
        <Small color={() => colors.faint}>Ctrl K</Small>
      </Row>
      <Box grow={1} />
      <Show when={() => ui.view() === "editor"}>
        <IconButton icon={panelRight} tip="Painel de links" active={ui.rightOpen} onClick={() => ui.setRightOpen((o) => !o)} size={16} />
      </Show>
      <IconButton
        icon={() => (colorScheme() === "dark" ? sun : moon)}
        tip="Tema claro/escuro"
        onClick={() => applyTheme(colorScheme() === "dark" ? "light" : "dark")}
        size={16}
      />
      <WindowControls gap={6} padding={[0, 0, 0, 6]} />
    </Row>
  );

  const Sidebar = () => (
    <Column width={SIDEBAR_WIDTH} background={() => colors.sidebar}>
      <Column padding={[10, 8, 6, 8]} gap={1}>
        <NavItem icon={house} label="Hoje" view="home" />
        <NavItem icon={calendarDays} label="Calendário" view="calendar" />
        <NavItem icon={squareKanban} label="Quadro" view="board" />
        <NavItem icon={graphIcon} label="Grafo" view="graph" hint="Ctrl G" />
        <Row
          gap={10}
          align="center"
          padding={[7, 10]}
          radius={6}
          cursor="pointer"
          hoverStyle={{ background: () => colors.hover }}
          color={() => theme.text.secondary}
          onClick={openToday}
        >
          <Icon svg={notebookPen} size={17} strokeWidth={1.75} />
          <Text grow={1}>Nota de hoje</Text>
          <Small color={() => colors.faint}>Ctrl D</Small>
        </Row>
      </Column>
      <Line />
      <Row padding={[6, 8, 0, 14]} align="center" gap={2}>
        <Small grow={1} bold letterSpacing={1}>
          {() => ({ files: "NOTAS", search: "BUSCAR", tags: "TAGS" })[ui.leftTab()]}
        </Small>
        <Show when={() => ui.leftTab() === "files"}>
          <IconButton icon={filePlus} tip="Nova nota (Ctrl+N)" onClick={newNote} size={15} />
          <IconButton icon={folderPlus} tip="Nova pasta" onClick={() => ui.setNewFolder(true)} size={15} />
          <Box width={1} height={16} margin={[0, 4]} background={() => colors.border} />
        </Show>
        <TabButton icon={filesIcon} tab="files" tip="Notas" />
        <TabButton icon={searchIcon} tab="search" tip="Buscar (Ctrl+Shift+F)" />
        <TabButton icon={hashIcon} tab="tags" tip="Tags" />
      </Row>
      <Switch>
        <Match when={() => ui.leftTab() === "files"}>
          <FileExplorer />
        </Match>
        <Match when={() => ui.leftTab() === "search"}>
          <SearchPanel />
        </Match>
        <Match when={() => ui.leftTab() === "tags"}>
          <TagsPanel />
        </Match>
      </Switch>
    </Column>
  );

  const EditorPane = (): Child => (
    <Row grow={1}>
      <Column grow={1} width={0} background={() => colors.page}>
        <Show
          when={ws.active}
          fallback={
            <Column grow={1} align="center" justify="center" gap={12}>
              <Text fontSize={20} bold>Nenhuma nota aberta</Text>
              <Row gap={8}>
                <Button label="Nova nota (Ctrl+N)" variant="primary" onClick={newNote} />
                <Button label="Abrir nota (Ctrl+K)" onClick={() => ui.setSwitcher(true)} />
              </Row>
            </Column>
          }
        >
          <Editor
            path={ws.active}
            load={ws.read}
            text={text}
            onChange={ws.write}
            onOpenLink={(target) => ws.openLink(target)}
            onOpenUrl={openUrl}
            jump={ws.jump}
            api={ui.setEditor}
            header={
              <Column gap={4} padding={[4, 0, 16, 0]}>
                <Caption>
                  {() => (ws.active() && folderOf(ws.active()!) ? folderOf(ws.active()!).replace(/\//g, " / ") : " ")}
                </Caption>
                <Text fontSize={32} fontWeight={800} cursor="text" onClick={() => ws.active() && ui.setRenaming(ws.active())}>
                  {() => (ws.active() ? noteName(ws.active()!) : "")}
                </Text>
              </Column>
            }
          />
          <Row padding={[4, 14]} gap={16} justify="end" fontSize={12} color={() => theme.text.secondary}>
            <Text>{() => `${ws.backlinks(ws.active() ?? "").length} backlinks`}</Text>
            <Text>{() => `${countWords(text())} palavras`}</Text>
            <Text>{() => `${text().length} caracteres`}</Text>
          </Row>
        </Show>
      </Column>
      <Show when={ui.rightOpen}>
        <Line vertical />
        <Column width={SIDEBAR_WIDTH + 12} background={() => colors.sidebar}>
          <RightPanel />
        </Column>
      </Show>
    </Row>
  );

  return (
    <Window
      title={() => (ui.view() === "editor" && ws.active() ? `${noteName(ws.active()!)} — Dia` : "Dia")}
      icon={appIcon}
      appId="dev.nodebuilder.dia" width={1320} height={840} decorations={false} onClose={() => (ws.flush(), tray.onClose())} onKeyDown={shortcuts}>
      <AppProvider value={{ ws, ui, cals }}>
        <TitleBar />
        <Line />
        <Row grow={1}>
          <Show when={ui.leftOpen}>
            <Sidebar />
            <Line vertical />
          </Show>
          <Switch>
            <Match when={() => ui.view() === "home"}>
              <Home />
            </Match>
            <Match when={() => ui.view() === "calendar"}>
              <CalendarView />
            </Match>
            <Match when={() => ui.view() === "board"}>
              <BoardView />
            </Match>
            <Match when={() => ui.view() === "graph"}>
              <GraphView />
            </Match>
            <Match when={() => ui.view() === "editor"}>
              <EditorPane />
            </Match>
          </Switch>
        </Row>

        <CalendarsDialog />
        <ExternalEventDialog />

        <Show when={ui.switcher}>
          <QuickSwitcher />
        </Show>

        <Dialog
          open={() => ui.renaming() !== null}
          onClose={() => ui.setRenaming(null)}
          title="Renomear nota"
          actions={
            <>
              <Button label="Cancelar" variant="flat" onClick={() => ui.setRenaming(null)} />
              <Button label="Renomear" variant="primary" onClick={confirmRename} />
            </>
          }
        >
          <TextField value={name} onInput={(v) => (setName(v), setError(""))} onSubmit={confirmRename} />
          <Caption color={() => (error() ? theme.danger.base : theme.text.secondary)}>
            {() => error() || "Os links para esta nota serão atualizados."}
          </Caption>
        </Dialog>

        <Dialog
          open={() => ui.deleting() !== null}
          onClose={() => ui.setDeleting(null)}
          title="Excluir nota?"
          actions={
            <>
              <Button label="Cancelar" variant="flat" onClick={() => ui.setDeleting(null)} />
              <Button
                label="Excluir"
                variant="danger"
                onClick={() => {
                  const path = ui.deleting();
                  ui.setDeleting(null);
                  if (path) ws.remove(path);
                }}
              />
            </>
          }
        >
          <Text>{() => `"${noteName(ui.deleting() ?? "")}" vai para a lixeira do cofre (.trash).`}</Text>
        </Dialog>

        <Dialog
          open={ui.newFolder}
          onClose={() => ui.setNewFolder(false)}
          title="Nova pasta"
          actions={
            <>
              <Button label="Cancelar" variant="flat" onClick={() => ui.setNewFolder(false)} />
              <Button label="Criar" variant="primary" onClick={confirmFolder} />
            </>
          }
        >
          <TextField value={name} onInput={setName} onSubmit={confirmFolder} placeholder="Nome da pasta" />
        </Dialog>
      </AppProvider>
    </Window>
  );
}
