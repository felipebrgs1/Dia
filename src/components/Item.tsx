// A clickable row of a side panel list (file, search hit, backlink, heading).

import { type Child, Icon, Row, Tooltip, createSignal, theme } from "@nodebuilderjs/core";
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
  const [hover, setHover] = createSignal(false);
  return (
    <Row
      ref={props.ref}
      gap={6}
      align="center"
      radius={4}
      padding={[4, 8, 4, 8 + (props.indent ?? 0)]}
      cursor="pointer"
      background={() => (props.active?.() ? colors.active : hover() ? colors.hover : "#00000000")}
      color={() => (props.active?.() ? theme.text.primary : theme.text.secondary)}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      onPointerDown={(e) => {
        if (e.button === 2 && props.onContextMenu) {
          props.onContextMenu(e);
          e.stop();
        }
      }}
      onClick={props.onClick}
    >
      {props.children}
    </Row>
  );
}

/** Small icon-only button for headers and the ribbon, with a hint. */
export function IconButton(props: { icon: string | (() => string); tip: string; onClick: () => void; active?: () => boolean; size?: number }) {
  const [hover, setHover] = createSignal(false);
  return (
    <Tooltip text={props.tip} placement="bottom">
      <Row
        padding={6}
        radius={6}
        cursor="pointer"
        background={() => (hover() ? colors.hover : "#00000000")}
        color={() => (props.active?.() ? theme.accent.base : hover() ? theme.text.primary : theme.text.secondary)}
        onPointerEnter={() => setHover(true)}
        onPointerLeave={() => setHover(false)}
        onClick={props.onClick}
      >
        <Icon svg={props.icon} size={props.size ?? 18} strokeWidth={1.75} />
      </Row>
    </Tooltip>
  );
}
