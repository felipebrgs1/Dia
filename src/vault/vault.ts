// The vault on disk: a folder of .md files. Paths are relative to the root and use "/".

import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { WELCOME } from "./welcome.js";

export interface Vault {
  readonly root: string;
  /** Every note and folder, sorted. Hidden folders (.obsidian, .trash, .git) are skipped. */
  list(): { files: string[]; folders: string[] };
  read(path: string): string;
  write(path: string, text: string): void;
  exists(path: string): boolean;
  mkdir(path: string): void;
  rename(from: string, to: string): void;
  /** Moves to `.trash/` inside the vault, like Obsidian's default. */
  trash(path: string): void;
}

export function defaultVaultPath() {
  return process.env.OBSIDIAN_VAULT || join(homedir(), "ObsidianClone");
}

export function openVault(root: string): Vault {
  // Example notes only in a folder that did not exist: never write into an existing vault.
  if (!existsSync(root)) {
    mkdirSync(root, { recursive: true });
    for (const [path, text] of Object.entries(WELCOME)) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), text);
    }
  }
  const abs = (p: string) => join(root, p);
  return {
    root,
    list() {
      const files: string[] = [];
      const folders: string[] = [];
      const walk = (dir: string) => {
        for (const e of readdirSync(abs(dir), { withFileTypes: true })) {
          if (e.name.startsWith(".")) continue;
          const rel = dir ? `${dir}/${e.name}` : e.name;
          if (e.isDirectory()) {
            folders.push(rel);
            walk(rel);
          } else if (e.name.endsWith(".md")) files.push(rel);
        }
      };
      walk("");
      const cmp = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });
      return { files: files.sort(cmp), folders: folders.sort(cmp) };
    },
    read: (p) => readFileSync(abs(p), "utf8"),
    write(p, text) {
      mkdirSync(dirname(abs(p)), { recursive: true });
      writeFileSync(abs(p), text);
    },
    exists: (p) => existsSync(abs(p)),
    mkdir: (p) => void mkdirSync(abs(p), { recursive: true }),
    rename(from, to) {
      mkdirSync(dirname(abs(to)), { recursive: true });
      renameSync(abs(from), abs(to));
    },
    trash(p) {
      let target = `.trash/${p.slice(p.lastIndexOf("/") + 1)}`;
      for (let i = 1; existsSync(abs(target)); i++) target = `.trash/${i} ${p.slice(p.lastIndexOf("/") + 1)}`;
      mkdirSync(abs(".trash"), { recursive: true });
      renameSync(abs(p), abs(target));
    },
  };
}

/** A vault kept in memory, for tests. */
export function memoryVault(initial: Record<string, string> = {}): Vault {
  const files = new Map(Object.entries(initial));
  const folders = new Set<string>();
  const parents = (p: string) => {
    const out: string[] = [];
    for (let i = p.indexOf("/"); i >= 0; i = p.indexOf("/", i + 1)) out.push(p.slice(0, i));
    return out;
  };
  return {
    root: "/memory",
    list() {
      const all = new Set(folders);
      for (const p of files.keys()) for (const f of parents(p)) all.add(f);
      return { files: [...files.keys()].sort((a, b) => a.localeCompare(b)), folders: [...all].sort((a, b) => a.localeCompare(b)) };
    },
    read: (p) => files.get(p) ?? "",
    write: (p, t) => void files.set(p, t),
    exists: (p) => files.has(p) || folders.has(p),
    mkdir: (p) => void folders.add(p),
    rename(from, to) {
      files.set(to, files.get(from) ?? "");
      files.delete(from);
    },
    trash: (p) => void files.delete(p),
  };
}
