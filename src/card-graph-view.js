/**
 * card-graph-view.js — Rental Wrangler graph time-window helpers (moved from
 * app.js APP-23 · §13.3 CARD GRAPH VIEW, 2026-07-24 module split).
 * ----------------------------------------------------------------------------
 * RETIRED (2026-07-03). The per-card tile dashboard (pieSVG/gvBars tiles +
 * unit roster) was replaced by the §13.6 Round-Up reporting board, but the
 * time-window + bucket helpers below survive — the §13.4 Graph Carousel
 * (src still in app.js) calls into these. Pure relocation: same functions,
 * same behavior, just callable via import.
 */
import { TODAY } from './format.js';

/* §13.4 — TIMELINE SELECTOR (Jac 2026-06-23). Per-source (per card / shop segment) the
   graph carousel's TIME-BASED views can be scoped to a recent window: 7/10/30/90/180/360
   days, or All (default = today's all-time/6-month behavior). Snapshot views ignore it and
   read "Current". The active window is stamped ON the chart head, never hover-only. */
export const GV_WIN_OPTS = [7, 10, 30, 90, 180, 360];
const GV_WIN_KEY = (src) => `jactec.gvWin.${src}`;
const GV_WIN = Object.create(null);
export function loadGvWin(src) {
  if (src in GV_WIN) return GV_WIN[src];
  let v = 0; try { v = Number(localStorage.getItem(GV_WIN_KEY(src))) || 0; } catch (e) { v = 0; }
  GV_WIN[src] = GV_WIN_OPTS.includes(v) ? v : 0;   // 0 = All time
  return GV_WIN[src];
}
export function saveGvWin(src, days) {
  const d = GV_WIN_OPTS.includes(days) ? days : 0;
  GV_WIN[src] = d;
  try { if (d) localStorage.setItem(GV_WIN_KEY(src), String(d)); else localStorage.removeItem(GV_WIN_KEY(src)); } catch (e) { /* private mode */ }
}
export const gvWinLabel = (d) => d ? `${d}D` : 'All';
// ISO (yyyy-mm-dd) cutoff: the oldest day still IN a `days`-long window ending today (inclusive). null = all.
export function gvWinCutoff(days) { if (!days) return null; const d = new Date(TODAY); d.setDate(d.getDate() - days + 1); return d.toISOString().slice(0, 10); }
// Time buckets spanning the window for the "/period" bar charts. Each = {key:"a|b", label, a, b}
// with a<=date<b (ISO). Granularity adapts: ≤14d daily · ≤90d weekly · else monthly (All = 6 months).
export function gvBuckets(days) {
  const out = [], iso = (d) => d.toISOString().slice(0, 10), base = new Date(TODAY);
  if (!days || days > 90) {
    const n = !days ? 6 : Math.min(12, Math.max(1, Math.round(days / 30)));
    for (let i = n - 1; i >= 0; i--) { const a = new Date(base.getFullYear(), base.getMonth() - i, 1), b = new Date(base.getFullYear(), base.getMonth() - i + 1, 1); out.push({ key: iso(a) + '|' + iso(b), label: a.toLocaleString('en-US', { month: 'short' }), a: iso(a), b: iso(b) }); }
  } else if (days > 14) {
    const weeks = Math.ceil(days / 7);
    for (let i = weeks - 1; i >= 0; i--) { const b = new Date(base); b.setDate(b.getDate() - i * 7 + 1); const a = new Date(b); a.setDate(a.getDate() - 7); out.push({ key: iso(a) + '|' + iso(b), label: `${a.getMonth() + 1}/${a.getDate()}`, a: iso(a), b: iso(b) }); }
  } else {
    for (let i = days - 1; i >= 0; i--) { const a = new Date(base); a.setDate(a.getDate() - i); const b = new Date(a); b.setDate(b.getDate() + 1); out.push({ key: iso(a) + '|' + iso(b), label: `${a.getMonth() + 1}/${a.getDate()}`, a: iso(a), b: iso(b) }); }
  }
  return out;
}
