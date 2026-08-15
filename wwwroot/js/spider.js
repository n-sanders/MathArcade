/* Pentagon spider / radar charts for the arcade lobby */
(function (global) {
  const NS = "http://www.w3.org/2000/svg";
  const LABEL_LINE_HEIGHT = 9;

  function createEl(name, attrs) {
    const node = document.createElementNS(NS, name);
    Object.entries(attrs || {}).forEach(([key, value]) => {
      if (value != null) node.setAttribute(key, String(value));
    });
    return node;
  }

  function vertex(cx, cy, radius, index, count) {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count;
    return {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
      angle,
      cos: Math.cos(angle),
      sin: Math.sin(angle)
    };
  }

  function polygonPoints(cx, cy, radius, count) {
    return Array.from({ length: count }, (_, i) => {
      const p = vertex(cx, cy, radius, i, count);
      return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
    }).join(" ");
  }

  function wrapSpiderLabel(label) {
    const text = String(label || "");
    if (text.length <= 10) return [text];
    const idx = text.lastIndexOf(" ");
    if (idx <= 0) return [text];
    return [text.slice(0, idx), text.slice(idx + 1)];
  }

  /**
   * Draw a pentagon radar chart into an SVG element.
   * @param {SVGElement} svg
   * @param {{ labels?: string[], scores: number[], placeholders?: boolean[], rings?: number }} options
   *        scores are 0–1. Selection styling is CSS (.spider-card.is-selected).
   */
  function drawSpiderChart(svg, options) {
    if (!svg) return;
    const scores = options.scores || [];
    const labels = options.labels && options.labels.length
      ? options.labels
      : Array.from({ length: scores.length || 5 }, () => "");
    const placeholders = options.placeholders || [];
    const count = labels.length;
    const rings = options.rings || 4;
    const width = 220;
    const height = 236;
    const cx = width / 2;
    const cy = 118;
    const radius = 68;

    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("role", "img");
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    const grid = createEl("g", { class: "spider-grid" });
    for (let ring = 1; ring <= rings; ring++) {
      grid.appendChild(createEl("polygon", {
        class: "spider-ring",
        points: polygonPoints(cx, cy, (radius * ring) / rings, count)
      }));
    }
    for (let i = 0; i < count; i++) {
      const p = vertex(cx, cy, radius, i, count);
      grid.appendChild(createEl("line", {
        class: "spider-axis",
        x1: cx.toFixed(2),
        y1: cy.toFixed(2),
        x2: p.x.toFixed(2),
        y2: p.y.toFixed(2)
      }));
    }
    svg.appendChild(grid);

    const scorePoints = Array.from({ length: count }, (_, i) => {
      const value = Math.max(0, Math.min(1, Number(scores[i]) || 0));
      return vertex(cx, cy, radius * value, i, count);
    });
    svg.appendChild(createEl("polygon", {
      class: "spider-score",
      points: scorePoints.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ")
    }));
    scorePoints.forEach((p) => {
      svg.appendChild(createEl("circle", {
        class: "spider-dot",
        cx: p.x.toFixed(2),
        cy: p.y.toFixed(2),
        r: 3.2
      }));
    });

    labels.forEach((label, i) => {
      const p = vertex(cx, cy, radius + 18, i, count);
      let anchor = "middle";
      if (p.cos > 0.35) anchor = "start";
      else if (p.cos < -0.35) anchor = "end";
      let baseline = "middle";
      if (p.sin < -0.55) baseline = "auto";
      else if (p.sin > 0.55) baseline = "hanging";
      const className = placeholders[i]
        ? "spider-label spider-label--soon"
        : "spider-label";
      const text = createEl("text", {
        class: className,
        x: p.x.toFixed(2),
        y: p.y.toFixed(2),
        "text-anchor": anchor,
        "dominant-baseline": baseline
      });
      const lines = wrapSpiderLabel(label);
      if (lines.length === 1) {
        text.textContent = lines[0];
      } else {
        const startDy = baseline === "middle"
          ? -((lines.length - 1) * LABEL_LINE_HEIGHT) / 2
          : 0;
        lines.forEach((line, lineIndex) => {
          const tspan = createEl("tspan", {
            x: p.x.toFixed(2),
            dy: lineIndex === 0 ? String(startDy) : String(LABEL_LINE_HEIGHT)
          });
          tspan.textContent = line;
          text.appendChild(tspan);
        });
      }
      svg.appendChild(text);
    });
  }

  const arcade = global.MathArcade || (global.MathArcade = {});
  arcade.drawSpiderChart = drawSpiderChart;
})(window);
