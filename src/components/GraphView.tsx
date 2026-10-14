// Graph view: every note is a dot, every link a line, moved by the force simulation in
// graph/physics.ts. Drag a dot to pull it (its neighbors follow on their springs), drag the
// background to pan, wheel to zoom at the pointer, click a dot to open the note.

import { Canvas, Column, Row, Text, createEffect, createMemo, createSignal, onCleanup, requestAnimationFrame, theme, untrack } from "@nodebuilderjs/core";
import { type SimNode, type Simulation, createSimulation, physics, running, tick } from "../graph/physics.js";
import { colors } from "../theme.js";
import type { Ui } from "../ui.js";
import { noteName } from "../vault/markdown.js";
import type { Workspace } from "../workspace.js";

type GNode = SimNode & { path: string };

const TICK_MS = 1000 / 60; // the simulation steps at 60 Hz whatever the screen rate

export function GraphView(props: { ws: Workspace; ui: Ui }) {
  const { ws, ui } = props;
  const [frame, setFrame] = createSignal(0);
  const [hover, setHover] = createSignal<string | null>(null);
  const [view, setView] = createSignal({ x: 0, y: 0, zoom: 1 });
  let size = { width: 0, height: 0 };
  let last = new Map<string, GNode>();

  // Nodes keep their place (and speed) when the vault changes; new ones start on a spiral.
  const sim = createMemo<Simulation & { nodes: GNode[] }>(() => {
    const files = ws.files();
    const index = new Map(files.map((p, i) => [p, i]));
    const nodes: GNode[] = files.map((path, i) => {
      const old = last.get(path);
      if (old) return old;
      const angle = i * 2.399963; // golden angle
      const r = 30 * Math.sqrt(i + 1);
      return { path, x: Math.cos(angle) * r, y: Math.sin(angle) * r, vx: 0, vy: 0, fx: null, fy: null, degree: 0 };
    });
    const edges: [number, number][] = [];
    const seen = new Set<string>();
    for (const [from, to] of ws.edges()) {
      const a = index.get(from)!;
      const b = index.get(to)!;
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push([a, b]);
    }
    last = new Map(nodes.map((n) => [n.path, n]));
    const s = createSimulation(nodes, edges) as Simulation & { nodes: GNode[] };
    // A graph that only gained a note settles gently instead of exploding again.
    if (untrack(frame) > 0) s.alpha = 0.3;
    return s;
  });

  // One loop: runs while the simulation is warm, sleeps when it cools down.
  let looping = false;
  let lastTime = 0;
  let disposed = false;
  const loop = (time: number) => {
    if (disposed) return;
    const s = untrack(sim);
    const steps = Math.min(4, Math.max(1, Math.round((time - lastTime) / TICK_MS)));
    lastTime = time;
    for (let k = 0; k < steps && running(s); k++) tick(s);
    setFrame((f) => f + 1);
    if (running(s)) requestAnimationFrame(loop);
    else looping = false;
  };
  const wake = () => {
    if (looping) return;
    looping = true;
    lastTime = performance.now();
    requestAnimationFrame(loop);
  };
  createEffect(() => {
    sim();
    wake();
  });
  onCleanup(() => (disposed = true));

  const radius = (n: GNode) => 4 + Math.sqrt(n.degree) * 2.2;
  const toScreen = (x: number, y: number) => {
    const v = view();
    return { x: size.width / 2 + (x + v.x) * v.zoom, y: size.height / 2 + (y + v.y) * v.zoom };
  };
  const toWorld = (sx: number, sy: number) => {
    const v = view();
    return { x: (sx - size.width / 2) / v.zoom - v.x, y: (sy - size.height / 2) / v.zoom - v.y };
  };
  const nodeAt = (sx: number, sy: number) => {
    let best: GNode | null = null;
    let bestD = Infinity;
    for (const n of sim().nodes) {
      const p = toScreen(n.x, n.y);
      const d = Math.hypot(p.x - sx, p.y - sy);
      if (d < Math.max(10, radius(n) * Math.sqrt(view().zoom) + 4) && d < bestD) {
        best = n;
        bestD = d;
      }
    }
    return best;
  };

  // A press on a dot drags that dot; on the background it pans.
  let press: { x: number; y: number; node: GNode | null; moved: boolean } | null = null;
  let pointer = { x: 0, y: 0 };

  const release = () => {
    if (press?.node) {
      press.node.fx = press.node.fy = null;
      untrack(sim).alphaTarget = 0; // cools down: the neighbors wobble back and settle
      wake();
    }
  };

  return (
    <Column grow={1} background={() => colors.page}>
      <Row padding={[10, 16]} gap={12} align="center">
        <Text bold>Visão de grafo</Text>
        <Text fontSize={12} color={() => theme.text.secondary}>
          {() => `${sim().nodes.length} notas · ${sim().edges.length} links — arraste as notas, arraste o fundo para mover, roda para zoom`}
        </Text>
      </Row>
      <Canvas
        grow={1}
        cursor={() => (hover() ? "pointer" : "default")}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          const node = nodeAt(e.localX, e.localY);
          press = { x: e.localX, y: e.localY, node, moved: false };
          if (node) {
            node.fx = node.x;
            node.fy = node.y;
            const s = sim();
            s.alphaTarget = physics.dragAlpha;
            s.alpha = Math.max(s.alpha, physics.dragAlpha);
            wake();
          }
        }}
        onPointerMove={(e) => {
          pointer = { x: e.localX, y: e.localY };
          // Released outside the canvas: the up never came here.
          if (press && e.button !== 0) {
            release();
            press = null;
          }
          if (press) {
            const dx = e.localX - press.x;
            const dy = e.localY - press.y;
            if (!press.moved && Math.abs(dx) + Math.abs(dy) > 3) press.moved = true;
            if (!press.moved) return;
            if (press.node) {
              const w = toWorld(e.localX, e.localY);
              press.node.fx = w.x;
              press.node.fy = w.y;
            } else {
              setView((v) => ({ ...v, x: v.x + dx / v.zoom, y: v.y + dy / v.zoom }));
              press.x = e.localX;
              press.y = e.localY;
            }
            return;
          }
          setHover(nodeAt(e.localX, e.localY)?.path ?? null);
        }}
        onPointerUp={() => {
          const p = press;
          release();
          press = null;
          if (p?.node && !p.moved) {
            ws.open(p.node.path);
            ui.setView("editor");
          }
        }}
        onPointerLeave={() => setHover(null)}
        onScroll={(e) => {
          // Zooms around the pointer: the point under it stays put.
          const before = toWorld(pointer.x, pointer.y);
          setView((v) => ({ ...v, zoom: Math.max(0.2, Math.min(4, v.zoom * (e.dy > 0 ? 0.9 : 1.1))) }));
          const after = toWorld(pointer.x, pointer.y);
          setView((v) => ({ ...v, x: v.x + after.x - before.x, y: v.y + after.y - before.y }));
          e.stop();
        }}
        draw={(g) => {
          frame();
          size = { width: g.width, height: g.height };
          const { nodes, edges } = sim();
          const active = ws.active();
          const focus = press?.node?.path ?? hover();
          const near = new Set<string>();
          if (focus) for (const [a, b] of edges) if (nodes[a]!.path === focus || nodes[b]!.path === focus) (near.add(nodes[a]!.path), near.add(nodes[b]!.path));

          for (const [a, b] of edges) {
            const p = toScreen(nodes[a]!.x, nodes[a]!.y);
            const q = toScreen(nodes[b]!.x, nodes[b]!.y);
            const lit = focus && (nodes[a]!.path === focus || nodes[b]!.path === focus);
            g.line(p.x, p.y, q.x, q.y, lit ? theme.accent.base : colors.graphEdge, lit ? 1.5 : 1);
          }
          const zoom = view().zoom;
          for (const n of nodes) {
            const p = toScreen(n.x, n.y);
            const r = radius(n) * Math.sqrt(zoom);
            const dim = focus && !near.has(n.path) && n.path !== focus;
            const color = n.path === active || n.path === focus ? theme.accent.base : dim ? colors.border : colors.graphNode;
            g.circle(p.x, p.y, r, color);
            if (zoom > 0.6 || n.path === focus) {
              const label = noteName(n.path);
              const m = g.measureText(label, 12);
              g.text(label, p.x - m.width / 2, p.y + r + 4, dim ? colors.faint : theme.text.secondary, 12);
            }
          }
        }}
      />
    </Column>
  );
}
