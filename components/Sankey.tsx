"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatMoney, formatShare, type Flow, type Income } from "@/lib/plan";

type SankeyProps = {
  incomes: Income[];
  flows: Flow[];
  centerLabel: string;
  centerTotal?: number;
  unallocated?: number;
  /** Base used for the percentages on right-side nodes. */
  base: number;
};

const MARGIN = 10;
const MIN_WIDTH_PX = 720;
const MIN_NODE_PX = 22;
const LINE_PX = 16;
const GAP_PX = 6;
const COLUMN_X = [0.001, 0.42, 0.999];
const WRAP_CHARS = 26;
const GROUP_PALETTE = ["#1f4e79", "#2a7f62", "#d97706", "#7c3aed", "#be185d", "#0f766e", "#475569"];
const UNALLOCATED_COLOR = "#888888";

function withAlpha(hex: string, alpha: number): string {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h.slice(0, 6), 16);
  if (Number.isNaN(n)) return `rgba(100,116,139,${alpha})`;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/** Breaks long labels onto several lines so each column stays clear of its neighbors. */
function wrap(text: string): string {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    if (line && `${line} ${word}`.length > WRAP_CHARS) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines.join("<br>");
}

export function incomeColors(incomes: Income[]): string[] {
  const groups = Array.from(new Set(incomes.map((income) => income.group ?? "")));
  return incomes.map((income) => income.color ?? GROUP_PALETTE[groups.indexOf(income.group ?? "") % GROUP_PALETTE.length]);
}

/**
 * Three pinned columns: each income source, one center total, then where the money goes.
 * Tiny nodes get enough room for a readable label.
 */
function buildSankey({ incomes, flows, centerLabel, centerTotal, unallocated, base }: SankeyProps) {
  const labels: string[] = [];
  const colors: string[] = [];
  const source: number[] = [];
  const target: number[] = [];
  const value: number[] = [];
  const linkColors: string[] = [];
  const columns: { index: number; value: number; minPx: number }[][] = [[], [], []];
  const addNode = (label: string, color: string, column: number, nodeValue: number) => {
    labels.push(label);
    colors.push(color);
    const lines = label.split("<br>").length;
    columns[column].push({ index: labels.length - 1, value: nodeValue, minPx: Math.max(MIN_NODE_PX, lines * LINE_PX + 6) });
    return labels.length - 1;
  };
  const link = (from: number, to: number, amount: number, color: string) => {
    source.push(from);
    target.push(to);
    value.push(amount);
    linkColors.push(color);
  };

  const sourceColors = incomeColors(incomes);
  const left = incomes.map((income, i) => ({ income, color: sourceColors[i] })).filter(({ income }) => income.amount > 0);
  const right: Flow[] = flows.filter((flow) => flow.amount > 0);
  if (unallocated && unallocated > 0) right.push({ name: "Not yet allocated", amount: unallocated, color: UNALLOCATED_COLOR });
  const inSum = left.reduce((sum, { income }) => sum + income.amount, 0);
  const outSum = right.reduce((sum, flow) => sum + flow.amount, 0);
  const center = centerTotal ?? Math.max(inSum, outSum);

  const centerIndex = addNode(`${wrap(centerLabel || "All income")}<br>${formatMoney(center)}/mo`, "#333333", 1, Math.max(center, inSum, outSum));
  for (const { income, color } of left) {
    const i = addNode(`${wrap(income.label)}<br>${formatMoney(income.amount)}/mo`, color, 0, income.amount);
    link(i, centerIndex, income.amount, withAlpha(color, 0.35));
  }
  for (const flow of right) {
    const color = flow.color ?? "#64748b";
    const share = base > 0 ? `, ${formatShare(flow.amount / base)}` : "";
    const r = addNode(`${wrap(flow.name)}<br>${formatMoney(flow.amount)}/mo${share}`, color, 2, flow.amount);
    link(centerIndex, r, flow.amount, withAlpha(color, 0.3));
  }

  const used = columns.filter((column) => column.length > 0);
  const maxSum = Math.max(1, ...used.map((column) => column.reduce((sum, node) => sum + node.value, 0)));
  const maxCount = Math.max(1, ...used.map((column) => column.length));
  const maxMin = Math.max(...used.map((column) => column.reduce((sum, node) => sum + node.minPx + GAP_PX, 0)));
  const inner = Math.max(480, Math.round(maxMin * 1.5));
  const fits = (k: number) =>
    used.every(
      (column) =>
        column.reduce((sum, node) => sum + Math.max(node.value * k, node.minPx), 0) + GAP_PX * (column.length - 1) <=
        inner,
    );
  // Largest px-per-dollar scale where every column fits with readable labels.
  let lo = 0;
  let hi = inner / maxSum;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) lo = mid;
    else hi = mid;
  }
  const k = lo;
  // Plotly derives its scale from node.pad, so pick the pad that reproduces k.
  const pad = maxCount > 1 ? Math.max(0, (inner - k * maxSum) / (maxCount - 1)) : 0;

  const x: number[] = new Array(labels.length).fill(0.5);
  const y: number[] = new Array(labels.length).fill(0.5);
  columns.forEach((column, c) => {
    if (!column.length) return;
    const heights = column.map((node) => Math.max(node.value * k, node.minPx));
    const needed = heights.reduce((sum, h) => sum + h, 0) + GAP_PX * (column.length - 1);
    let cursor = (inner - needed) / 2;
    column.forEach((node, i) => {
      x[node.index] = COLUMN_X[c];
      y[node.index] = Math.min(0.999, Math.max(0.001, (cursor + heights[i] / 2) / inner));
      cursor += heights[i] + GAP_PX;
    });
  });

  return { labels, colors, source, target, value, linkColors, x, y, pad, height: inner + MARGIN * 4, empty: !left.length && !right.length };
}

export function Sankey({ incomes, flows, centerLabel, centerTotal, unallocated, base }: SankeyProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const sankey = useMemo(
    () => buildSankey({ incomes, flows, centerLabel, centerTotal, unallocated, base }),
    [incomes, flows, centerLabel, centerTotal, unallocated, base],
  );

  useEffect(() => {
    let cancelled = false;
    const el = ref.current;
    if (!el || sankey.empty) return;
    import("plotly.js-dist-min")
      .then(({ default: Plotly }) => {
        if (cancelled) return;
        return Plotly.react(
          el,
          [
            {
              type: "sankey",
              orientation: "h",
              arrangement: "fixed",
              node: {
                pad: sankey.pad,
                thickness: 18,
                line: { color: "white", width: 0.5 },
                label: sankey.labels,
                color: sankey.colors,
                x: sankey.x,
                y: sankey.y,
              },
              link: {
                source: sankey.source,
                target: sankey.target,
                value: sankey.value,
                color: sankey.linkColors,
                hovertemplate: "%{source.label} to %{target.label}<br>$%{value:,.0f} / mo<extra></extra>",
              },
            },
          ],
          {
            margin: { l: MARGIN, r: MARGIN, t: MARGIN * 2, b: MARGIN * 2 },
            font: { size: 13, color: "#111" },
            height: sankey.height,
            paper_bgcolor: "rgba(0,0,0,0)",
          },
          { responsive: true, displaylogo: false },
        );
      })
      .catch((error) => {
        console.error("Sankey failed to render", error);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [sankey]);

  if (sankey.empty) {
    return <p className="text-sm text-muted-foreground">Add income sources or buckets to draw the money flow.</p>;
  }
  if (failed) {
    return (
      <p className="text-sm text-muted-foreground">
        The Sankey chart could not load. The tables on this page carry every flow value in full.
      </p>
    );
  }
  // On a narrow phone screen the chart would squeeze into a tall, skinny
  // strip, so keep its intended width and let the user scroll sideways
  // (or turn the phone to landscape) instead.
  return (
    <div>
      <p className="mb-1 text-xs text-muted-foreground sm:hidden">
        Scroll sideways, or turn your phone to landscape, to see the full flow.
      </p>
      <div className="overflow-x-auto">
        <div id="sankey" ref={ref} className="w-full" style={{ minWidth: MIN_WIDTH_PX, minHeight: sankey.height }} />
      </div>
    </div>
  );
}
