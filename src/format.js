/**
 * format.js — Rental Wrangler shared utilities & formatting (moved from app.js
 * APP-02 · §1 UTILITIES & FORMATTING, 2026-07-24 module split).
 * ----------------------------------------------------------------------------
 * $, el, esc, money, num, dates — the atoms every other module reaches for.
 * Pure relocation: same functions, same behavior, just callable via import.
 */
import { parseISO, TODAY_ISO, refreshTodayISO } from '../config.js';

export const $  = (sel, root = document) => root.querySelector(sel);
export const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const money = (n) => { if (n == null) return '—'; const v = Math.round(Number(n) * 100) / 100; return '$' + v.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 }); };   // cents shown only when present, so exact tax ($53.75) reads true while whole-dollar figures stay clean
// money2 — always-two-decimal money for the invoice ledger + payment flow (#109): a
// printed/paid figure reads what's actually owed, to the cent, even on whole dollars.
export const money2 = (n) => (n == null ? '—' : '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
export const num = (n) => (n == null ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: 1 }));
export let TODAY = parseISO(TODAY_ISO);   // live: refreshToday() rolls it over so an all-day-open tab never stamps yesterday
export const dayDiff = (a, b) => Math.round((b - a) / 86400000);
// Keep "today" current on a long-lived tab. TODAY_ISO is an ESM live binding, so
// every call-time reader picks up the new day for free; TODAY (a Date) is re-derived here.
export function refreshToday() { if (refreshTodayISO()) { TODAY = parseISO(TODAY_ISO); } }
/* Trailing debounce: returns a scheduler you call with a thunk each time — it cancels
   any pending thunk and reschedules, so only the LAST call in a burst actually runs.
   Used to keep typing snappy on inputs whose reaction is expensive (a full render()). */
export function debounce(ms) { let t; return (fn) => { clearTimeout(t); t = setTimeout(fn, ms); }; }

export const SINGULAR = { customers: 'customer', rentals: 'rental', units: 'unit', invoices: 'invoice', categories: 'category', workOrders: 'workOrder', inspections: 'inspection', serviceOrders: 'unit', models: 'model' };
