// The app's settings in the vault, `.dia/config.json` (hidden from the notes). Each part of the
// app reads and updates its own keys; the others are kept.

import type { Vault } from "./vault/vault.js";

export function readConfig(vault: Vault): Record<string, unknown> {
  try {
    return JSON.parse(vault.readMeta("config.json") ?? "{}");
  } catch {
    return {};
  }
}

export function updateConfig(vault: Vault, patch: Record<string, unknown>) {
  vault.writeMeta("config.json", `${JSON.stringify({ ...readConfig(vault), ...patch }, null, 2)}\n`);
}
