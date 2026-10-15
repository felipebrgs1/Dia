// A clickable row of a side panel list (file, search hit, backlink, heading).

import { type Child, Icon, Row, Tooltip, theme } from "@nodebuilderjs/core";
import type { ElementRef, PointerEvent } from "@nodebuilderjs/core";
import { colors } from "../theme.js";

export function Item(props: {
  onClick: () => void;
  onContextMenu?: (e: PointerEvent) => void;
  active?: () => boolean;
  indent?: number;
  ref?: (el: ElementRef) => void;
  children?: Child;
}) {
  return (
    <Row
      ref={props.ref}
      gap={6}
      align="center"
      radius={4}
      padding={[4, 8, 4, 8 + (props.indent ?? 0)]}
      cursor="pointer"
      background={() => (props.active?.() ? colors.active : "transparent")}
      hoverStyle={{ background: () => (props.active?.() ? colors.active : colors.hover) }}
      color={() => (props.active?.() ? theme.text.primary : theme.text.secondary)}
      onContextMenu={props.onContextMenu}
      onClick={props.onClick}
    >
      {props.children}
    </Row>
  );
}

/** Small icon-only button for headers and the ribbon, with a hint. */
export function IconButton(props: { icon: string | (() => string); tip: string; onClick: () => void; active?: () => boolean; size?: number }) {
  return (
    <Tooltip text={props.tip} placement="bottom">
      <Row
        padding={6}
        radius={6}
        cursor="pointer"
        color={() => (props.active?.() ? theme.accent.base : theme.text.secondary)}
        hoverStyle={{ background: () => colors.hover, color: () => (props.active?.() ? theme.accent.base : theme.text.primary) }}
        onClick={props.onClick}
      >
        <Icon svg={props.icon} size={props.size ?? 18} strokeWidth={1.75} />
      </Row>
    </Tooltip>
  );
}
