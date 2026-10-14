// Force simulation for the graph view, in the style of d3-force (what Obsidian uses):
// links are springs, nodes repel each other, a weak pull keeps everything centered, and
// velocities decay slowly, so a dragged node pulls its neighbors and they wobble into place.
//
// `alpha` is the "temperature": every force is scaled by it and it cools toward
// `alphaTarget`. Dragging sets a warm target, so the graph stays alive while you pull.

export interface SimNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Pinned position (while dragged); null = free. */
  fx: number | null;
  fy: number | null;
  degree: number;
}

export interface Simulation {
  nodes: SimNode[];
  edges: [number, number][];
  alpha: number;
  alphaTarget: number;
}

export const physics = {
  /** Rest length of a link. */
  linkDistance: 70,
  /** Repulsion between every pair (negative pushes apart). */
  charge: -260,
  /** Pull toward the center, per tick. */
  gravity: 0.03,
  /** Fraction of the velocity lost per tick: lower = more elastic. */
  velocityDecay: 0.32,
  alphaDecay: 0.0228,
  alphaMin: 0.001,
  /** Temperature kept while a node is dragged. */
  dragAlpha: 0.3,
};

export function createSimulation(nodes: SimNode[], edges: [number, number][]): Simulation {
  for (const n of nodes) n.degree = 0;
  for (const [a, b] of edges) {
    nodes[a]!.degree++;
    nodes[b]!.degree++;
  }
  return { nodes, edges, alpha: 1, alphaTarget: 0 };
}

/** True while there is motion left to show. */
export function running(sim: Simulation) {
  return sim.alpha >= physics.alphaMin || sim.alphaTarget > 0;
}

export function tick(sim: Simulation) {
  const { nodes, edges } = sim;
  sim.alpha += (sim.alphaTarget - sim.alpha) * physics.alphaDecay;
  const alpha = sim.alpha;

  // Links: springs toward the rest length. The end with fewer links moves more, and links
  // of busy nodes are weaker (d3's defaults), so hubs do not collapse.
  for (const [i, j] of edges) {
    const a = nodes[i]!;
    const b = nodes[j]!;
    let dx = b.x + b.vx - a.x - a.vx;
    let dy = b.y + b.vy - a.y - a.vy;
    if (!dx && !dy) dx = 1e-3;
    const l = Math.sqrt(dx * dx + dy * dy);
    const strength = 1 / Math.min(a.degree, b.degree);
    const k = ((l - physics.linkDistance) / l) * alpha * strength;
    dx *= k;
    dy *= k;
    const bias = a.degree / (a.degree + b.degree);
    b.vx -= dx * bias;
    b.vy -= dy * bias;
    a.vx += dx * (1 - bias);
    a.vy += dy * (1 - bias);
  }

  // Repulsion between every pair (fine up to a few hundred notes).
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i]!;
    for (let j = i + 1; j < nodes.length; j++) {
      const b = nodes[j]!;
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let d2 = dx * dx + dy * dy;
      if (d2 < 1) {
        dx = (i - j) * 0.01 || 0.01;
        dy = 0.01;
        d2 = 1;
      }
      const f = (physics.charge * alpha) / d2;
      a.vx += dx * f;
      a.vy += dy * f;
      b.vx -= dx * f;
      b.vy -= dy * f;
    }
  }

  for (const n of nodes) {
    n.vx -= n.x * physics.gravity * alpha;
    n.vy -= n.y * physics.gravity * alpha;
    if (n.fx !== null && n.fy !== null) {
      n.x = n.fx;
      n.y = n.fy;
      n.vx = 0;
      n.vy = 0;
    } else {
      n.vx *= 1 - physics.velocityDecay;
      n.vy *= 1 - physics.velocityDecay;
      n.x += n.vx;
      n.y += n.vy;
    }
  }
}
