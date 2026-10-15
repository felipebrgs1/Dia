// Text styles used across the app (like `.muted` / `<small>` on the web). Any prop of `Text`
// still applies and wins: `<Caption maxLines={1}>`, `<Small color={() => colors.faint}>`.

import { Text, theme } from "@nodebuilderjs/core";

type TextProps = Parameters<typeof Text>[0];

/** Secondary text at the surrounding size. */
export function Muted(props: TextProps) {
  return <Text color={() => theme.text.secondary} {...props} />;
}

/** Secondary text, 12 px: counts, paths, help lines. */
export function Caption(props: TextProps) {
  return <Text fontSize={12} color={() => theme.text.secondary} {...props} />;
}

/** Secondary text, 11 px: hints, labels inside chips. */
export function Small(props: TextProps) {
  return <Text fontSize={11} color={() => theme.text.secondary} {...props} />;
}
