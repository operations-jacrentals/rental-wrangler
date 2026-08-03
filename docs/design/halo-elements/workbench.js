/* ==========================================================================
   HALO WORKBENCH — binds a knob rail to a specimen's CSS custom properties.

   Usage on an element page:

     HaloWorkbench({
       rail: '#rail',                       // where the knob rail is built
       specimens: '.wb-spec',               // each specimen block
       groups: [
         { title: 'plate', knobs: [
             { var: '--pw',   label: 'width',   min: 100, max: 900, step: .1, unit: 'px' },
             { var: '--pcut', label: 'chamfer', min: 0,   max: 60,  step: .1, unit: 'px' },
         ]},
         { title: 'ring',  knobs: [
             { var: '--fill', label: 'cavity',  type: 'color' },
             { var: '--gs',   label: 'side glow', min: 0, max: .4, step: .002 },
         ]},
       ],
     })

   A knob's starting value is READ OFF THE SELECTED SPECIMEN — never hardcoded
   here — so the rail always opens showing what the part actually is, and
   "reset" restores exactly that. Every specimen keeps its own edits: select a
   different variant and the rail reloads that variant's values.

   `copy CSS` emits ONLY the knobs you actually moved, as a paste-ready rule.
   That is the handoff: turn knobs, copy, send the values back.
   ========================================================================== */

function HaloWorkbench(cfg) {
  const rail = document.querySelector(cfg.rail);
  const specimens = Array.from(document.querySelectorAll(cfg.specimens));
  if (!rail || !specimens.length) return;

  const groups = cfg.groups || [];
  const allKnobs = groups.flatMap(g => g.knobs);

  // Per-specimen record of the values it was born with, so reset is exact and
  // "dirty" means "differs from the source mockup", not "differs from default".
  const born = new WeakMap();
  const target = (spec) => spec.querySelector('[data-knobbed]') || spec.querySelector('.stage > *') || spec;

  const readVar = (el, name) => {
    const inline = el.style.getPropertyValue(name).trim();
    if (inline) return inline;
    return getComputedStyle(el).getPropertyValue(name).trim();
  };

  specimens.forEach(spec => {
    const el = target(spec);
    const snap = {};
    allKnobs.forEach(k => { snap[k.var] = readVar(el, k.var); });
    born.set(spec, snap);
  });

  let selected = specimens[0];

  // -- build the rail once; values are re-bound on selection ---------------
  const controls = new Map();

  const railHead = document.createElement('div');
  railHead.className = 'wb-rail-head';
  railHead.innerHTML = '<span>knobs</span><b data-wb-which></b>';
  rail.appendChild(railHead);
  const which = railHead.querySelector('[data-wb-which]');

  const knobBox = document.createElement('div');
  knobBox.className = 'wb-knobs';
  rail.appendChild(knobBox);

  groups.forEach(g => {
    const sec = document.createElement('section');
    sec.className = 'wb-group';
    const h = document.createElement('h3');
    h.textContent = g.title;
    sec.appendChild(h);

    g.knobs.forEach(k => {
      const row = document.createElement('div');
      row.className = 'wb-knob';

      const id = 'k' + Math.abs(hash(k.var + g.title));
      const lab = document.createElement('label');
      lab.setAttribute('for', id);
      lab.textContent = k.label || k.var;

      const out = document.createElement('output');
      out.setAttribute('for', id);

      const input = document.createElement('input');
      input.id = id;
      if (k.type === 'color') {
        input.type = 'color';
      } else {
        input.type = 'range';
        input.min = k.min; input.max = k.max; input.step = k.step != null ? k.step : 1;
      }
      input.addEventListener('input', () => apply(k, input.value));

      row.append(lab, out, input);
      sec.appendChild(row);
      controls.set(k.var, { input, out, row, knob: k });
    });

    knobBox.appendChild(sec);
  });

  const acts = document.createElement('div');
  acts.className = 'wb-acts';
  const copyBtn = mkBtn('copy CSS');
  const resetBtn = mkBtn('reset');
  acts.append(copyBtn, resetBtn);
  rail.appendChild(acts);

  const out = document.createElement('pre');
  out.className = 'wb-out';
  rail.appendChild(out);

  // -- behaviour -----------------------------------------------------------

  function apply(knob, raw) {
    const el = target(selected);
    const value = knob.type === 'color' ? raw : raw + (knob.unit || '');
    el.style.setProperty(knob.var, value);
    sync(knob.var);
  }

  function sync(varName) {
    const c = controls.get(varName);
    if (!c) return;
    const el = target(selected);
    const now = readVar(el, varName);
    const was = born.get(selected)[varName];
    c.out.textContent = now || '—';
    c.row.classList.toggle('is-dirty', norm(now) !== norm(was));
  }

  function load(spec) {
    selected = spec;
    specimens.forEach(s => s.classList.toggle('is-selected', s === spec));
    which.textContent = spec.dataset.variant || '';
    const el = target(spec);
    controls.forEach(({ input, knob }, varName) => {
      const v = readVar(el, varName);
      if (knob.type === 'color') {
        input.value = toHex(v) || '#000000';
      } else {
        const n = parseFloat(v);
        input.value = Number.isFinite(n) ? n : (knob.min || 0);
      }
      sync(varName);
    });
    out.textContent = '';
    copyBtn.classList.remove('is-done');
    copyBtn.textContent = 'copy CSS';
  }

  specimens.forEach(spec => {
    const pick = spec.querySelector('.wb-pick');
    if (pick) pick.addEventListener('click', () => load(spec));
    spec.addEventListener('click', e => {
      if (e.target.closest('input, button, a')) return;
      load(spec);
    });
  });

  copyBtn.addEventListener('click', () => {
    const el = target(selected);
    const snap = born.get(selected);
    const lines = [];
    controls.forEach((c, varName) => {
      const now = readVar(el, varName);
      if (norm(now) !== norm(snap[varName])) lines.push(`  ${varName}: ${now};`);
    });
    const css = lines.length
      ? `/* ${selected.dataset.variant || 'specimen'} — changed knobs */\n.halo-part {\n${lines.join('\n')}\n}`
      : '/* nothing changed yet — turn a knob first */';
    out.textContent = css;
    if (navigator.clipboard && lines.length) {
      navigator.clipboard.writeText(css).then(() => {
        copyBtn.textContent = 'copied';
        copyBtn.classList.add('is-done');
      }, () => {});
    }
  });

  resetBtn.addEventListener('click', () => {
    const el = target(selected);
    const snap = born.get(selected);
    Object.keys(snap).forEach(varName => {
      el.style.removeProperty(varName);
      if (snap[varName]) el.style.setProperty(varName, snap[varName]);
    });
    load(selected);
  });

  load(specimens[0]);

  // -- helpers -------------------------------------------------------------

  function mkBtn(text) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'wb-btn'; b.textContent = text;
    return b;
  }
  function norm(v) { return String(v || '').trim().replace(/\s+/g, ' ').toLowerCase(); }
  function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }
  function toHex(v) {
    v = String(v || '').trim();
    if (/^#[0-9a-f]{6}$/i.test(v)) return v;
    if (/^#[0-9a-f]{3}$/i.test(v)) return '#' + v.slice(1).split('').map(c => c + c).join('');
    const m = v.match(/^rgba?\(([^)]+)\)$/i);
    if (m) {
      const p = m[1].split(/[ ,/]+/).filter(Boolean).slice(0, 3).map(n => Math.max(0, Math.min(255, Math.round(parseFloat(n)))));
      if (p.length === 3) return '#' + p.map(n => n.toString(16).padStart(2, '0')).join('');
    }
    return null;
  }
}
