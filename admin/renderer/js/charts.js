// Hand-drawn SVG charts. Monochrome: series differ by line style and grey level, not colour.
import { h } from './lib.js';

const NS = 'http://www.w3.org/2000/svg';
const s = (tag, attrs = {}, text) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text != null) e.textContent = text;
  return e;
};

export const STYLES = [
  { stroke: '#ffffff', dash: '', w: 1.8 },
  { stroke: '#b4b4ba', dash: '6 3', w: 1.5 },
  { stroke: '#8a8a92', dash: '1.5 3', w: 1.8 },
  { stroke: '#d4d4d8', dash: '10 3 2 3', w: 1.4 },
];

function niceMax(v) {
  if (v <= 40) return Math.max(4, Math.ceil(v / 4) * 4);
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  const m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return m * p;
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function labelFor(iso, unit, long) {
  const d = new Date(iso);
  if (unit === 'hour') {
    const hh = `${String(d.getHours()).padStart(2, '0')}:00`;
    return long ? `${MON[d.getMonth()]} ${d.getDate()}, ${hh}` : (d.getHours() === 0 ? `${MON[d.getMonth()]} ${d.getDate()}` : hh);
  }
  return `${MON[d.getMonth()]} ${d.getDate()}`;
}

/**
 * opts: { labels: ISO[], unit: 'hour'|'day', series: [{name, data, hidden?}], height, kind: 'line'|'bar' }
 * Returns { el, update(opts) }.
 */
export function chart(initial) {
  const host = h('div', { class: 'chart' });
  const tip = h('div', { class: 'tip', style: 'display:none' });
  let opts = initial;
  let width = 0;

  function draw() {
    if (!width) return;
    const { labels, series, unit, kind = 'line', height = 240, xLabel } = opts;
    const visible = series.filter((x) => !x.hidden);
    const pad = { l: 38, r: 10, t: 10, b: 22 };
    const W = width, H = height;
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    const max = niceMax(Math.max(1, ...visible.flatMap((x) => x.data)));
    const n = labels.length;
    const x = (i) => pad.l + (kind === 'bar' ? (iw / n) * (i + .5) : (n <= 1 ? iw / 2 : (iw / (n - 1)) * i));
    const y = (v) => pad.t + ih - (v / max) * ih;

    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, height: H });
    const grid = s('g', { class: 'grid' });
    const axis = s('g', { class: 'axis' });
    for (let i = 0; i <= 4; i++) {
      const v = (max / 4) * i;
      grid.append(s('line', { x1: pad.l, x2: W - pad.r, y1: y(v), y2: y(v) }));
      axis.append(s('text', { x: pad.l - 6, y: y(v) + 3, 'text-anchor': 'end' }, v >= 1000 ? `${+(v / 1000).toFixed(1)}k` : String(+v.toFixed(1))));
    }
    const ticks = Math.min(n, Math.max(2, Math.floor(iw / 70)));
    const shown = new Set();
    for (let t = 0; t < ticks; t++) {
      const i = Math.round((t * (n - 1)) / Math.max(1, ticks - 1));
      if (shown.has(i)) continue;
      shown.add(i);
      axis.append(s('text', { x: x(i), y: H - 6, 'text-anchor': t === 0 ? 'start' : t === ticks - 1 ? 'end' : 'middle' }, xLabel ? xLabel(labels[i], i) : labelFor(labels[i], unit)));
    }
    svg.append(grid, axis);

    if (kind === 'bar') {
      const bw = Math.max(1, Math.min(28, (iw / n) * .66));
      visible.forEach((ser, si) => {
        const w = bw / visible.length;
        ser.data.forEach((v, i) => {
          if (!v) return;
          svg.append(s('rect', { x: x(i) - bw / 2 + si * w, y: y(v), width: Math.max(1, w - 1), height: Math.max(1, pad.t + ih - y(v)), fill: STYLES[si % 4].stroke, opacity: si ? .55 : .92 }));
        });
      });
    } else {
      visible.forEach((ser, si) => {
        const st = STYLES[series.indexOf(ser) % 4];
        const pts = ser.data.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
        if (si === 0 && ser.area !== false) {
          svg.append(s('polygon', { points: `${x(0)},${pad.t + ih} ${pts.join(' ')} ${x(n - 1)},${pad.t + ih}`, fill: '#ffffff', opacity: .06 }));
        }
        svg.append(s('polyline', { points: pts.join(' '), fill: 'none', stroke: st.stroke, 'stroke-width': st.w, 'stroke-dasharray': st.dash, 'stroke-linejoin': 'round' }));
      });
    }

    const cross = s('line', { y1: pad.t, y2: pad.t + ih, stroke: '#6a6a72', 'stroke-width': 1, 'stroke-dasharray': '2 3', style: 'display:none' });
    const dots = visible.map((ser) => s('circle', { r: 3.2, fill: '#000', stroke: '#fff', 'stroke-width': 1.5, style: 'display:none' }));
    svg.append(cross, ...dots);
    const hit = s('rect', { x: pad.l, y: pad.t, width: iw, height: ih, fill: 'transparent' });
    hit.addEventListener('mousemove', (ev) => {
      const r = svg.getBoundingClientRect();
      const px = ((ev.clientX - r.left) / r.width) * W;
      let i = kind === 'bar' ? Math.floor(((px - pad.l) / iw) * n) : Math.round(((px - pad.l) / iw) * (n - 1));
      i = Math.max(0, Math.min(n - 1, i));
      cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.style.display = kind === 'bar' ? 'none' : '';
      dots.forEach((d, k) => { d.setAttribute('cx', x(i)); d.setAttribute('cy', y(visible[k].data[i])); d.style.display = kind === 'bar' ? 'none' : ''; });
      tip.replaceChildren(
        h('div', { class: 'h' }, opts.tipLabel ? opts.tipLabel(labels[i], i) : labelFor(labels[i], unit, true)),
        ...visible.map((ser) => h('div', { class: 'r' }, h('span', ser.name), h('b', String(ser.data[i])))),
      );
      tip.style.display = '';
      const tx = (x(i) / W) * r.width;
      tip.style.left = `${tx > r.width - 170 ? tx - 150 : tx + 12}px`;
      tip.style.top = '8px';
    });
    hit.addEventListener('mouseleave', () => { tip.style.display = 'none'; cross.style.display = 'none'; dots.forEach((d) => (d.style.display = 'none')); });
    svg.append(hit);
    host.replaceChildren(svg, tip);
  }

  const ro = new ResizeObserver((e) => {
    const w = Math.floor(e[0].contentRect.width);
    if (w && w !== width) { width = w; draw(); }
  });
  ro.observe(host);
  return { el: host, update(next) { opts = next; draw(); }, destroy() { ro.disconnect(); } };
}

/** Tiny sparkline for KPI cards. */
export function spark(data, w = 120, hgt = 22) {
  const max = Math.max(1, ...data);
  const step = w / Math.max(1, data.length - 1);
  const pts = data.map((v, i) => `${(i * step).toFixed(1)},${(hgt - 2 - (v / max) * (hgt - 4)).toFixed(1)}`).join(' ');
  const svg = s('svg', { class: 'spark', viewBox: `0 0 ${w} ${hgt}`, preserveAspectRatio: 'none' });
  svg.append(s('polyline', { points: pts, fill: 'none', stroke: '#8a8a92', 'stroke-width': 1.2, 'vector-effect': 'non-scaling-stroke' }));
  return svg;
}
