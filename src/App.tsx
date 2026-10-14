import {
  Box,
  Button,
  Column,
  Dialog,
  Match,
  Row,
  Show,
  Switch,
  Text,
  TextField,
  colorScheme,
  createEffect,
  createMemo,
  createSignal,
  theme,
  Window,
  windowControls,
} from "@nodebuilderjs/core";
import { FileExplorer } from "./components/FileExplorer.js";
import { GraphView } from "./components/GraphView.js";
import { IconButton } from "./components/Item.js";
import { QuickSwitcher } from "./components/QuickSwitcher.js";
import { RightPanel } from "./components/RightPanel.js";
import { SearchPanel, TagsPanel } from "./components/SearchPanel.js";
import { Editor } from "./editor/Editor.js";
import { arrowLeft, arrowRight, files as filesIcon, gitFork as graphIcon, hash as hashIcon, moon, panelRight, search as searchIcon, sun } from "./icons.js";
import { applyTheme, colors } from "./theme.js";
import { createUi } from "./ui.js";
import { countWords, folderOf, noteName } from "./vault/markdown.js";
import { type Vault, defaultVaultPath, memoryVault, openVault } from "./vault/vault.js";
import { WELCOME } from "./vault/welcome.js";
import { createWorkspace } from "./workspace.js";

const SIDEBAR_WIDTH = 260;

function VLine() {
  return <Box width={1} background={() => colors.border} />;
}

export function App(props: { vault?: Vault; vaultPath?: string; note?: string } = {}) {
  // `bun run screenshot` imports the app with no arguments: show the example notes from memory
  // instead of creating a vault on disk.
  const vault =
    props.vault ??
    (process.env.NB_SCREENSHOT && !props.vaultPath ? memoryVault(WELCOME) : openVault(props.vaultPath || defaultVaultPath()));
  const ws = createWorkspace(vault);
  const ui = createUi();
  if (colorScheme() !== "dark") applyTheme("dark");

  // Start with the welcome note, or the first one.
  const first = ws.files().find((p) => p === (props.note ?? "Bem-vindo.md")) ?? ws.files()[0];
  if (first) ws.open(first);

  createEffect(() => {
    const path = ws.active();
    windowControls.setTitle(path ? `${noteName(path)} - ${vault.root}` : "Obsidian");
  });
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

  const toggleLeft = (tab: "files" | "search" | "tags") => {
    if (ui.leftOpen() && ui.leftTab() === tab) ui.setLeftOpen(false);
    else {
      ui.setLeftTab(tab);
      ui.setLeftOpen(true);
    }
  };

  const shortcuts = (e: { key: string; ctrl: boolean; shift: boolean; alt: boolean; stop(): void }) => {
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (e.ctrl && (key === "o" || key === "p")) ui.setSwitcher(true);
    else if (e.ctrl && key === "n") (ui.setView("editor"), ws.create());
    else if (e.ctrl && e.shift && key === "f") (ui.setLeftTab("search"), ui.setLeftOpen(true));
    else if (e.ctrl && key === "g") ui.setView((v) => (v === "graph" ? "editor" : "graph"));
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

  return (
    <Window title="Obsidian" appId="dev.nodebuilder.obsidian" width={1280} height={800} onClose={() => void ws.flush()} onKeyDown={shortcuts}>
      <Row grow={1}>
        {/* Ribbon */}
        <Column width={44} padding={[8, 0]} gap={4} align="center" background={() => colors.ribbon}>
          <IconButton icon={filesIcon} tip="Arquivos" active={() => ui.leftOpen() && ui.leftTab() === "files"} onClick={() => toggleLeft("files")} />
          <IconButton icon={searchIcon} tip="Buscar (Ctrl+Shift+F)" active={() => ui.leftOpen() && ui.leftTab() === "search"} onClick={() => toggleLeft("search")} />
          <IconButton icon={hashIcon} tip="Tags" active={() => ui.leftOpen() && ui.leftTab() === "tags"} onClick={() => toggleLeft("tags")} />
          <IconButton icon={graphIcon} tip="Grafo (Ctrl+G)" active={() => ui.view() === "graph"} onClick={() => ui.setView((v) => (v === "graph" ? "editor" : "graph"))} />
          <Box grow={1} />
          <IconButton
            icon={() => (colorScheme() === "dark" ? sun : moon)}
            tip="Tema claro/escuro"
            onClick={() => applyTheme(colorScheme() === "dark" ? "light" : "dark")}
          />
        </Column>
        <VLine />

        {/* Left sidebar */}
        <Show when={ui.leftOpen}>
          <Column width={SIDEBAR_WIDTH} background={() => colors.sidebar}>
            <Switch>
              <Match when={() => ui.leftTab() === "files"}>
                <FileExplorer ws={ws} ui={ui} />
              </Match>
              <Match when={() => ui.leftTab() === "search"}>
                <SearchPanel ws={ws} ui={ui} />
              </Match>
              <Match when={() => ui.leftTab() === "tags"}>
                <TagsPanel ws={ws} ui={ui} />
              </Match>
            </Switch>
          </Column>
          <VLine />
        </Show>

        {/* Main area */}
        <Column grow={1} minWidth={0} background={() => colors.editor}>
          <Row padding={[4, 8]} gap={4} align="center">
            <IconButton icon={arrowLeft} tip="Voltar (Alt+←)" onClick={ws.goBack} />
            <IconButton icon={arrowRight} tip="Avançar (Alt+→)" onClick={ws.goForward} />
            <Row grow={1} justify="center" gap={4}>
              <Text maxLines={1} color={() => theme.text.secondary}>
                {() => {
                  const path = ws.active();
                  if (!path) return "";
                  const folder = folderOf(path);
                  return folder ? `${folder.replace(/\//g, " / ")} / ` : "";
                }}
              </Text>
              <Text maxLines={1}>{() => (ws.active() ? noteName(ws.active()!) : "")}</Text>
            </Row>
            <IconButton icon={panelRight} tip="Painel direito" active={ui.rightOpen} onClick={() => ui.setRightOpen((o) => !o)} />
          </Row>
          <Switch>
            <Match when={() => ui.view() === "graph"}>
              <GraphView ws={ws} ui={ui} />
            </Match>
            <Match when={() => ui.view() === "editor" && ws.active()}>
              <Editor
                path={ws.active}
                load={ws.read}
                onChange={ws.write}
                onOpenLink={(target) => ws.openLink(target)}
                onOpenUrl={openUrl}
                jump={ws.jump}
                api={ui.setEditor}
                header={
                  <Text
                    fontSize={30}
                    bold
                    padding={[8, 0, 16, 0]}
                    cursor="text"
                    onClick={() => ws.active() && ui.setRenaming(ws.active())}
                  >
                    {() => (ws.active() ? noteName(ws.active()!) : "")}
                  </Text>
                }
              />
            </Match>
            <Match when={() => true}>
              <Column grow={1} align="center" justify="center" gap={12}>
                <Text fontSize={20} bold>Nenhuma nota aberta</Text>
                <Row gap={8}>
                  <Button label="Criar nota (Ctrl+N)" variant="primary" onClick={() => ws.create()} />
                  <Button label="Abrir nota (Ctrl+O)" onClick={() => ui.setSwitcher(true)} />
                </Row>
              </Column>
            </Match>
          </Switch>
          <Row padding={[4, 12]} gap={16} justify="end" color={() => theme.text.secondary}>
            <Text fontSize={12}>{() => `${ws.backlinks(ws.active() ?? "").length} backlinks`}</Text>
            <Text fontSize={12}>{() => `${countWords(text())} palavras`}</Text>
            <Text fontSize={12}>{() => `${text().length} caracteres`}</Text>
          </Row>
        </Column>

        {/* Right sidebar */}
        <Show when={ui.rightOpen}>
          <VLine />
          <Column width={SIDEBAR_WIDTH} background={() => colors.sidebar}>
            <RightPanel ws={ws} ui={ui} />
          </Column>
        </Show>
      </Row>

      <Show when={ui.switcher}>
        <QuickSwitcher ws={ws} ui={ui} />
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
        <Text fontSize={12} color={() => (error() ? theme.danger.base : theme.text.secondary)}>
          {() => error() || "Os links para esta nota serão atualizados."}
        </Text>
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
    </Window>
  );
}


