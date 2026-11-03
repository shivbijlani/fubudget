"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatMoney, formatShare, type BucketSummary, type Income } from "@/lib/plan";

type SankeyProps = {
  incomes: Income[];
  buckets: BucketSummary[];
  total: number;
};

const MARGIN = 10;
const MIN_NODE_PX = 18;
const GAP_PX = 4;
const COLUMN_X = [0.001, 0.3, 0.56, 0.999];
const WRAP_CHARS = 22;

/** Breaks long labels onto several lines so left and middle columns stay clear of their neighbors. */
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

function withAlpha(hex: string, alpha: number): string {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h.slice(0, 6), 16);
  if (Number.isNaN(n)) return `rgba(100,116,139,${alpha})`;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/**
 * Builds the Sankey with every node pinned: income sources, total, buckets, envelopes.
 * Envelopes stay grouped under their bucket, and tiny envelopes get enough room for a label.
 */
function buildSankey({ incomes, buckets, total }: SankeyProps) {
  const labels: string[] = [];
  const colors: string[] = [];
  const source: number[] = [];
  const target: number[] = [];
  const value: number[] = [];
  const linkColors: string[] = [];
  const columns: { index: number; value: number }[][] = [[], [], [], []];
  const addNode = (label: string, color: string, column: number, nodeValue: number) => {
    labels.push(label);
    colors.push(color);
    columns[column].push({ index: labels.length - 1, value: nodeValue });
    return labels.length - 1;
  };
  const link = (from: number, to: number, amount: number, color: string) => {
    source.push(from);
    target.push(to);
    value.push(amount);
    linkColors.push(color);
  };

  const positiveIncomes = incomes.filter((income) => income.amount > 0);
  const positiveBuckets = buckets.filter((bucket) => bucket.value > 0);
  const incomeSum = positiveIncomes.reduce((sum, income) => sum + income.amount, 0);
  const totalIndex = addNode(`Total base<br>${formatMoney(total)}/mo`, "#1f2937", 1, Math.max(total, incomeSum));
  for (const income of positiveIncomes) {
    const i = addNode(`${wrap(income.label)}<br>${formatMoney(income.amount)}/mo`, "#1f4e79", 0, income.amount);
    link(i, totalIndex, income.amount, "rgba(31,78,121,0.25)");
  }
  for (const bucket of positiveBuckets) {
    const envelopes = bucket.envelopes.filter((envelope) => envelope.amount > 0);
    const envelopeSum = envelopes.reduce((sum, envelope) => sum + envelope.amount, 0);
    const b = addNode(
      `${wrap(bucket.label)}<br>${formatMoney(bucket.value)}/mo<br>${formatShare(bucket.share)} of base`,
      bucket.color,
      2,
      Math.max(bucket.value, envelopeSum),
    );
    link(totalIndex, b, bucket.value, withAlpha(bucket.color, 0.3));
    for (const envelope of envelopes) {
      const e = addNode(`${envelope.name}, ${formatMoney(envelope.amount)}`, withAlpha(bucket.color, 0.6), 3, envelope.amount);
      link(b, e, envelope.amount, withAlpha(bucket.color, 0.2));
    }
  }

  const used = columns.filter((column) => column.length > 0);
  const maxSum = Math.max(1, ...used.map((column) => column.reduce((sum, node) => sum + node.value, 0)));
  const maxCount = Math.max(1, ...used.map((column) => column.length));
  const inner = Math.max(520, Math.round(maxCount * (MIN_NODE_PX + GAP_PX) * 1.6));
  const fits = (k: number) =>
    used.every(
      (column) =>
        column.reduce((sum, node) => sum + Math.max(node.value * k, MIN_NODE_PX), 0) + GAP_PX * (column.length - 1) <=
        inner,
    );
  // Largest px-per-dollar scale where every column fits with labels readable.
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
    const heights = column.map((node) => Math.max(node.value * k, MIN_NODE_PX));
    const needed = heights.reduce((sum, h) => sum + h, 0) + GAP_PX * (column.length - 1);
    let cursor = (inner - needed) / 2;
    column.forEach((node, i) => {
      x[node.index] = COLUMN_X[c];
      y[node.index] = Math.min(0.999, Math.max(0.001, (cursor + heights[i] / 2) / inner));
      cursor += heights[i] + GAP_PX;
    });
  });

  return { labels, colors, source, target, value, linkColors, x, y, pad, height: inner + MARGIN * 2 };
}

export function Sankey({ incomes, buckets, total }: SankeyProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const sankey = useMemo(() => buildSankey({ incomes, buckets, total }), [incomes, buckets, total]);

  useEffect(() => {
    let cancelled = false;
    const el = ref.current;
    if (!el) return;
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
            margin: { l: MARGIN, r: MARGIN, t: MARGIN, b: MARGIN },
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

  if (failed) {
    return (
      <p className="text-sm text-muted-foreground">
        The Sankey chart could not load. The tables on this page carry every flow value in full.
      </p>
    );
  }
  return <div id="sankey" ref={ref} className="w-full" style={{ minHeight: sankey.height }} />;
}
