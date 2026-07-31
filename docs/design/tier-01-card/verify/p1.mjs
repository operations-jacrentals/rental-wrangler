// P1 — the two-level architecture, built by injection (ledger #168-#171).
//   GROUP = housing,   opens by MOVING    (steel · mechanical · NO light)
//   ROW   = cartridge, opens by LIGHTING  (glass · terminal · emission)
// Layers on the R2->R7 stack from design-log section 5. Harness per section 4.
//
// DOM facts established by probe (they differ from the log's section 2.7 shorthand):
//   * the group container is  gate.closest('.scp1').parentElement
//   * a row's issue list is the .pin's data-hint, newline-separated "Source, State, Date"
//   * a row's content div is the DIV child (children[0] is the accent caret SPAN)
//   * that div carries INLINE background/height -> stylesheet rules need !important
import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = '/tmp/claude-0/-home-user-rental-wrangler/0ae968fe-28c8-53d0-84a6-9fc8848ba315/scratchpad/p1';
fs.mkdirSync(OUT, { recursive: true });
const EXEC = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';

/* ---------- section 5 preamble + R2..R7, verbatim from the design log ---------- */
const CSS_R7 = `
.ref{background:none!important;background-color:transparent!important;background-image:none!important;
     box-shadow:none!important;border:0!important;clip-path:none!important;width:auto!important;
     flex:1 1 auto!important;min-width:0!important;padding-left:0!important;}
.ref__icon{width:12px!important;height:12px!important;background:transparent!important;opacity:.45!important;}
.rmq{font-family:'Archivo',sans-serif!important;font-weight:700!important;font-size:15px!important;
     letter-spacing:-.005em!important;color:#eef2f7!important;}

/* R3 — deep milled pocket */
.scp1{padding-right:2px!important;}
.scp1 .pin{display:none!important;}
.gate{height:26px!important;padding:0 11px!important;margin-right:0!important;
  background:linear-gradient(#080d14 0%, #0b111a 62%, #0d141d 100%)!important;
  background-color:#0a0f16!important;
  clip-path:polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)!important;
  box-shadow:
    inset 0 6px 7px -1px rgba(0,0,6,.96), inset 0 2px 0 rgba(0,0,8,.9),
    inset -3px 0 0 rgba(0,0,8,.72), inset -8px 0 9px -4px rgba(0,0,6,.85),
    inset 0 -8px 9px -5px rgba(0,0,6,.5), inset 0 -2px 0 rgba(198,218,248,.22),
    inset -3px -2px 0 rgba(198,218,248,.10)!important;
  border:0!important;display:inline-flex!important;align-items:center!important;overflow:hidden!important;}
.gate__chev{display:none!important;}
.gate .sc-interp{font-family:ui-monospace,'Cascadia Code',Menlo,Consolas,monospace!important;
  font-size:12.5px!important;font-weight:800!important;letter-spacing:.04em!important;
  text-transform:uppercase!important;overflow:hidden!important;
  text-overflow:ellipsis!important;white-space:nowrap!important;}

/* R4 — hue faces + floor tint (the settled head) */
.gate--red    .sc-interp{color:#ff8080!important;text-shadow:0 -1px 0 rgba(255,196,196,.30), 0 1px 2px rgba(0,0,4,.95)!important;}
.gate--yellow .sc-interp{color:#f2dc6a!important;text-shadow:0 -1px 0 rgba(255,244,190,.30), 0 1px 2px rgba(0,0,4,.95)!important;}
.gate--blue   .sc-interp{color:#9dbfe4!important;text-shadow:0 -1px 0 rgba(206,228,250,.30), 0 1px 2px rgba(0,0,4,.95)!important;}
.gate--green  .sc-interp{color:#5ee0ab!important;text-shadow:0 -1px 0 rgba(186,246,220,.30), 0 1px 2px rgba(0,0,4,.95)!important;}
.gate--gray   .sc-interp{color:#c2ccd8!important;text-shadow:0 -1px 0 rgba(226,236,248,.28), 0 1px 2px rgba(0,0,4,.95)!important;}
.gate--red[data-open="0"]    .sc-interp{color:#c26161!important;}
.gate--yellow[data-open="0"] .sc-interp{color:#b8a751!important;}
.gate--blue[data-open="0"]   .sc-interp{color:#7791ad!important;}
.gate--green[data-open="0"]  .sc-interp{color:#47aa82!important;}
.gate--gray[data-open="0"]   .sc-interp{color:#939ba4!important;}
.gate--red[data-open="1"]   {background:linear-gradient(rgba(255,66,66,.26),rgba(255,66,66,.09))!important;}
.gate--yellow[data-open="1"]{background:linear-gradient(rgba(238,212,75,.24),rgba(238,212,75,.08))!important;}
.gate--blue[data-open="1"]  {background:linear-gradient(rgba(99,148,204,.28),rgba(99,148,204,.10))!important;}
.gate--green[data-open="1"] {background:linear-gradient(rgba(52,211,153,.24),rgba(52,211,153,.09))!important;}
.gate--gray[data-open="1"]  {background:linear-gradient(rgba(170,180,193,.20),rgba(170,180,193,.07))!important;}

/* R5 — slots */
.seg,.seg__opt,[data-row],[data-row]>div{overflow:visible!important;}
.rw-tick{flex:0 0 auto;width:6px;height:12px;transform:skewX(19deg);border-radius:1.5px;cursor:pointer;
  background-image:linear-gradient(rgba(255,255,255,.20), rgba(255,255,255,.04) 42%, rgba(0,0,0,.28));
  box-shadow:inset 0 1px 0 rgba(255,255,255,.24), inset 0 -1.5px 2px rgba(0,0,0,.45),
             0 1px 2px rgba(0,0,0,.6);}
.rw-rack{flex:0 0 auto;display:flex;align-items:center;gap:2.5px;margin-left:2px;}
.rw-more{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:9px;color:#838e9c;margin-left:1px;}

/* R6 — row message board (needs steel under it, section 2.3) */
[data-row] > div{background:linear-gradient(rgba(185,205,235,.085),rgba(185,205,235,.02) 45%,rgba(0,0,12,.16)),
           #171F2A !important;
  box-shadow:inset 0 1px 0 rgba(185,205,235,.13)!important;}
.rw-board{background:#050A10;display:flex;align-items:center;padding:0 7px;
  clip-path:polygon(5px 0,100% 0,100% calc(100% - 5px),calc(100% - 5px) 100%,0 100%,0 5px);
  box-shadow:inset 0 1px 2px rgba(0,0,6,.8), inset 0 -1px 0 rgba(190,210,240,.10);}
.rw-board span{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:8.5px;font-weight:700;
  letter-spacing:.03em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.rw-tick.hot{filter:brightness(1.5);}

/* R7 — row order: message board · button · slots · facts · name */
[data-row]>div{height:34px!important;display:flex!important;align-items:center!important;
  gap:6px!important;position:relative!important;padding-left:8px!important;padding-right:8px!important;}
[data-row] .pin{display:none!important;}
.rw-board          {order:1!important;flex:0 0 auto!important;width:76px!important;height:19px!important;}
[data-row] .pin-wrap{order:2!important;flex:0 0 auto!important;width:auto!important;margin-left:0!important;}
[data-row] .rw-rack{order:3!important;flex:0 0 auto!important;margin-left:0!important;}
[data-row] > div > span.rw-facts{order:4!important;flex:0 0 auto!important;width:52px!important;
  text-align:right!important;font-size:9.5px!important;display:none!important;}
[data-row] .ref    {order:5!important;flex:1 1 0!important;min-width:0!important;width:auto!important;
  display:flex!important;align-items:center!important;gap:5px!important;
  justify-content:flex-end!important;height:auto!important;
  background:none!important;box-shadow:none!important;border:0!important;clip-path:none!important;}
[data-row] .rmq    {overflow:hidden!important;text-overflow:ellipsis!important;
  white-space:nowrap!important;min-width:0!important;}
`;

/* ---------------------------- P1 ---------------------------- */
const CSS_P1 = `
/* ============================================================================
   P1 · TWO LEVELS, TWO PHYSICS   (ledger #168)
     GROUP = housing   — opens by MOVING    steel · mechanical · NO light
     ROW   = cartridge — opens by LIGHTING  glass · terminal · emission
   Invariant held at BOTH levels: the NAME is right-aligned.
   ============================================================================ */

/* #169 — the laser drop/frame comes OFF the group. A housing never emits. */
.rw-noframe{display:none!important;}

/* ---------------------------------------------------------------------------
   LEVEL 1 · THE HOUSING (group head), right-condensed at the .scp1 level:
   [ slots ....residual.... ][ board ][ NAME ]
   #170 — board and name are edge-anchored, so the rack takes what is LEFT.
   The head's ORIGINAL board / stamp / spacers are retired (.rw-off), not
   added alongside — that is what kept the 380px budget honest.
   --------------------------------------------------------------------------- */
.rw-off{display:none!important;}
.scp1 .rw-rack {order:1!important;flex:1 1 auto!important;min-width:0!important;
  margin-left:0!important;overflow:hidden!important;justify-content:flex-start!important;}
.scp1 .rw-board{order:2!important;flex:0 0 auto!important;width:auto!important;max-width:118px!important;
  height:17px!important;}
.scp1 .pin-wrap{order:3!important;flex:0 1 auto!important;min-width:0!important;
  margin-left:auto!important;overflow:hidden!important;}
.gate{max-width:100%!important;
  transition:transform .26s cubic-bezier(.32,.72,0,1), box-shadow .26s cubic-bezier(.32,.72,0,1)!important;}

/* the housing's OPEN state is MOTION. Nothing here emits light: the only
   changes are WHERE the steel sits and WHICH WAY its shadow falls.          */
.gate[data-open="1"]{
  transform:translateY(-1.5px)!important;
  box-shadow:
    inset 0 3px 5px -1px rgba(0,0,6,.80),
    inset 0 1px 0 rgba(0,0,8,.7),
    inset -3px 0 0 rgba(0,0,8,.72),
    inset -8px 0 9px -4px rgba(0,0,6,.62),
    inset 0 -1px 0 rgba(198,218,248,.30),
    inset -3px -1px 0 rgba(198,218,248,.14),
    0 3px 0 -1px rgba(0,0,5,.92),      /* the bay mouth it lifted out of */
    0 5px 7px -3px rgba(0,0,4,.75)!important;
}
.gate[data-open="0"]{transform:translateY(0)!important;}

/* ---------------------------------------------------------------------------
   LEVEL 2 · THE CARTRIDGE (row)
   Seated shut = steel, matte, exactly as R7 left it.
   Opened = the face POWERS ON (#161, #139/#140 relocated here by #168/#169).
   The inner div carries an INLINE background, so these need !important.
   --------------------------------------------------------------------------- */
[data-row][data-lit="1"] > div{
  background:
    radial-gradient(120% 180% at 50% 0%, rgba(120,190,255,.11), transparent 62%),
    linear-gradient(#04080e 0%, #061019 62%, #040a11 100%)!important;
  box-shadow:inset 0 1px 2px rgba(0,0,6,.9), inset 0 -1px 0 rgba(190,215,245,.13)!important;}

/* the laser frame — now a ROW event, and drawn on the ROW so it wraps the WHOLE
   cartridge (face + drawer) as one object. Drawing it on `> div` framed each
   child separately, which read as two stacked panels.                        */
[data-row][data-lit="1"]::before{
  content:'';position:absolute;inset:0;pointer-events:none;z-index:3;
  transform-origin:top;animation:rwLaserDrop .24s cubic-bezier(.32,.72,0,1) both;}
[data-row][data-lit="1"][data-tone="red"]::before   {box-shadow:inset 2px 0 0 #ff4242, inset -2px 0 0 #ff4242, inset 0 -2px 0 #ff4242, 0 0 9px rgba(255,66,66,.30);}
[data-row][data-lit="1"][data-tone="yellow"]::before{box-shadow:inset 2px 0 0 #eed44b, inset -2px 0 0 #eed44b, inset 0 -2px 0 #eed44b, 0 0 9px rgba(238,212,75,.30);}
[data-row][data-lit="1"][data-tone="blue"]::before  {box-shadow:inset 2px 0 0 #6394cc, inset -2px 0 0 #6394cc, inset 0 -2px 0 #6394cc, 0 0 9px rgba(99,148,204,.30);}
[data-row][data-lit="1"][data-tone="green"]::before {box-shadow:inset 2px 0 0 #34d399, inset -2px 0 0 #34d399, inset 0 -2px 0 #34d399, 0 0 9px rgba(52,211,153,.30);}
[data-row][data-lit="1"][data-tone="gray"]::before  {box-shadow:inset 2px 0 0 #8b94a3, inset -2px 0 0 #8b94a3, inset 0 -2px 0 #8b94a3, 0 0 9px rgba(139,148,163,.26);}

/* THE DRAWER IS THE CARD'S OWN PANEL, not a new element. The card already
   renders a "Tier 1 · detail view (parked)" panel as the row's third child —
   that is the cartridge's drawer slot, and it carries the #63 anchor icon, so
   it is decorated rather than replaced. Its label stays: Tier 1 IS still parked;
   the terminal lines are what P1 puts in the slot now.                        */
[data-row][data-lit="1"] .rw-drawer{height:auto!important;display:block!important;
  padding:0 0 5px 0!important;}
.rw-cartlines{padding-top:2px;}

/* the lit face emits; the name stays right-aligned (the invariant) */
[data-row][data-lit="1"] .rmq{color:#dcecff!important;text-shadow:0 0 7px rgba(150,205,255,.42)!important;}
[data-row][data-lit="1"] .rw-board{background:#02060b!important;
  box-shadow:inset 0 1px 3px rgba(0,0,6,.92), inset 0 -1px 0 rgba(190,215,245,.16)!important;}
[data-row][data-lit="1"] .rw-board span{color:#8fd8ff!important;text-shadow:0 0 6px rgba(80,190,255,.45)!important;}

/* CRT flicker on power-on (#161, relocated to row-open) */
@keyframes rwCrtOn{
  0%{opacity:.16;filter:brightness(2.6) saturate(.4)} 12%{opacity:1;filter:brightness(1.5)}
  22%{opacity:.55;filter:brightness(.8)} 34%{opacity:1;filter:brightness(1.28)}
  52%{opacity:.86;filter:brightness(.97)} 100%{opacity:1;filter:brightness(1)}}
[data-row][data-lit="1"] > div > *{animation:rwCrtOn .34s steps(16,end) both;}

/* ---------------------------------------------------------------------------
   ROW ORDER, RULED (ledger #176) — supersedes R7's order for the P1 era.
   Jac: "From right to left: Name, Message board, slots. Then aligned to the
   left is the button."  That is the HEAD's own grammar (name, board, slots
   right-to-left) plus a left-anchored button — the row-only element, which is
   exactly what P1 means by "middles may differ (heads have no button)".
   Slots take the residual at BOTH levels now, so #170's law is universal.
   R7's block in the design log is left untouched: it is a revert point.
   --------------------------------------------------------------------------- */
[data-row] .pin-wrap{order:1!important;flex:0 0 auto!important;
  margin-left:0!important;margin-right:0!important;}
[data-row] .rw-rack {order:2!important;flex:1 1 auto!important;min-width:0!important;
  overflow:hidden!important;justify-content:flex-start!important;margin-left:0!important;}
[data-row] .rw-board{order:3!important;flex:0 0 auto!important;}
[data-row] .ref     {order:4!important;flex:0 1 auto!important;min-width:0!important;
  justify-content:flex-end!important;margin-left:0!important;}

/* the drawer the cartridge drops — the terminal body */
.rw-cart{overflow:hidden;background:linear-gradient(#04080e,#03070c);
  box-shadow:inset 0 1px 0 rgba(150,200,255,.14), inset 0 -1px 0 rgba(0,0,6,.9);
  animation:rwCartDrop .26s cubic-bezier(.32,.72,0,1) both;}
@keyframes rwCartDrop{from{height:0}to{height:var(--cart-h,58px)}}
.rw-cart .l,.rw-cartlines .l{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:9px;
  letter-spacing:.05em;color:#7fd0ff;text-shadow:0 0 6px rgba(80,190,255,.40);padding:3px 10px;
  white-space:nowrap;overflow:hidden;}
.rw-cart .l b,.rw-cartlines .l b{color:#cfe9ff;font-weight:800;}
.rw-cart .l.dim,.rw-cartlines .l.dim{color:#4d6d86;text-shadow:none;}
`;

const BUILD = `
(() => {
  const HUE = l => { const s=(l||'').toLowerCase();
    if(/overdue|failed|fail|damage|breakdown/.test(s)) return ['#ff4242','red'];
    if(/service due|needs wash|open|promised|due/.test(s)) return ['#eed44b','yellow'];
    if(/transport|truck|pickup|reserved/.test(s)) return ['#6394cc','blue'];
    if(/available|complete|passed|paid/.test(s)) return ['#34d399','green'];
    return ['#8a94a2','gray']; };
  const RANK = {red:0,yellow:1,blue:2,green:3,gray:4};   // style section 6 rollup precedence

  // section 4 — derive open/shut from the chevron BEFORE hiding it
  document.querySelectorAll('.gate').forEach(g => {
    const c = g.querySelector('.gate__chev');
    const t = c ? getComputedStyle(c).transform : 'none';
    g.setAttribute('data-open', (t !== 'none' && !/^matrix\\(1,\\s*0,\\s*0,\\s*1/.test(t)) ? '0' : '1');
  });

  // a row's issues live in the .pin's data-hint: "Source, State, Date" per line (section 2.7)
  const rowIssues = row => {
    const pin = row.querySelector('.pin[data-hint]');
    if (!pin) {
      const sg = row.querySelector('.signal');
      return sg ? [(sg.textContent||'').trim()] : [];
    }
    return (pin.getAttribute('data-hint')||'').split(/\\n+/).map(l => {
      const p = l.split(',').map(s=>s.trim());
      return p.length >= 2 ? p[1] : p[0];
    }).filter(Boolean);
  };
  const rowInner = row => [...row.children].find(c => c.tagName === 'DIV');

  const rack = list => {
    const r = document.createElement('div'); r.className='rw-rack';
    list.forEach(t => { const k=document.createElement('i'); k.className='rw-tick';
      k.style.background=HUE(t)[0]; k.dataset.label=t; r.appendChild(k); });
    return r;
  };
  const board = txt => {
    const b=document.createElement('div'); b.className='rw-board';
    const s=document.createElement('span'); s.textContent=txt; s.style.color='#6a7684';
    b.appendChild(s); return b;
  };
  const wire = (ticks, b, rest) => {
    ticks.forEach(k => {
      k.addEventListener('mouseenter', () => {
        const s=b.querySelector('span'); s.textContent=k.dataset.label.toUpperCase();
        s.style.color=HUE(k.dataset.label)[0]; k.classList.add('hot'); });
      k.addEventListener('mouseleave', () => {
        const s=b.querySelector('span'); s.textContent=rest; s.style.color='#6a7684';
        k.classList.remove('hot'); });
    });
  };

  /* ---------- LEVEL 2 · cartridges (rows) ----------
     REPLACE, don't add: the row's 380px budget is already spent (section 2.4).
     The bare unclassed spans are the date/facts column + a spacer — facts drop
     first, which is exactly what R7/#162 already specify.                     */
  document.querySelectorAll('[data-row]').forEach(row => {
    const inner = rowInner(row); if (!inner || inner.querySelector('.rw-rack')) return;
    [...inner.children].forEach(c => {
      if (!c.classList.contains('pin-wrap') && !c.classList.contains('ref')) c.classList.add('rw-off');
    });
    const list = rowIssues(row);
    const worst = list.slice().sort((a,b)=>RANK[HUE(a)[1]]-RANK[HUE(b)[1]])[0] || '';
    row.setAttribute('data-tone', HUE(worst)[1]);
    const rest = list[0] ? list[0].toUpperCase() : '\\u2014';
    const b = board(rest);
    inner.insertBefore(b, inner.firstChild);
    const rk = rack(list.length ? list : ['available']);
    inner.insertBefore(rk, b.nextSibling);
    wire([...rk.querySelectorAll('.rw-tick')], b, rest);
  });

  /* ---------- LEVEL 1 · housings (group heads) ----------
     Right-condensed at .scp1: [ slots ...residual... ][ board ][ NAME ].
     The head's own board/stamp/spacers are RETIRED so the rack inherits the
     width they were holding — that is #170 made visible: no cap, the rack
     simply runs until the real width is gone.                                */
  document.querySelectorAll('.gate').forEach(g => {
    const scp = g.closest('.scp1'); if (!scp || scp.querySelector('.rw-rack')) return;
    const grp = scp.parentElement;

    // retire every head child except the gate's wrapper and absolute overlays
    [...scp.children].forEach(c => {
      if (c.classList.contains('pin-wrap')) return;
      if (getComputedStyle(c).position === 'absolute') return;
      c.classList.add('rw-off');
    });
    // #169/#168 — the group's laser frame is an absolute overlay; it moves to rows
    if (grp) [...grp.children].forEach(c => {
      const s = getComputedStyle(c);
      if (s.position === 'absolute' && s.transformOrigin.startsWith('0px') === false
          && c.tagName === 'DIV' && !c.classList.contains('rw-cart')) c.classList.add('rw-noframe');
    });

    const rows = grp ? [...grp.querySelectorAll('[data-row]')] : [];
    let list = []; rows.forEach(r => { list = list.concat(rowIssues(r)); });
    list.sort((a,b)=>RANK[HUE(a)[1]]-RANK[HUE(b)[1]]);           // hottest first
    const rest = list.length ? (list.length + ' OPEN') : 'NOMINAL';
    const b = board(rest);
    const rk = rack(list.length ? list : ['available']);
    scp.insertBefore(b, scp.firstChild);
    scp.insertBefore(rk, b);
    wire([...rk.querySelectorAll('.rw-tick')], b, rest);
  });

  /* power a cartridge on — the row's open IS the light */
  window.__lit = null;
  window.rwLight = row => {
    if (window.__lit) {
      const prev = window.__lit; prev.removeAttribute('data-lit');
      const d = prev.nextElementSibling;
      if (d && d.classList.contains('rw-cart')) d.remove();
      window.__lit = null;
      if (prev === row) return;
    }
    row.setAttribute('data-lit','1');
    const name = ((row.querySelector('.rmq')||{}).textContent || 'UNIT').trim();
    const list = rowIssues(row);
    const cart = document.createElement('div'); cart.className='rw-cart';
    cart.innerHTML = '<div class="l">&gt; <b>' + name + '</b> ONLINE</div>' +
      (list.length ? list.map(t=>'<div class="l">&nbsp;&nbsp;\\u00b7 '+t.toUpperCase()+'</div>').join('')
                   : '<div class="l dim">&nbsp;&nbsp;\\u00b7 NO OPEN ISSUES</div>') +
      '<div class="l dim">&nbsp;&nbsp;READY</div>';
    row.parentNode.insertBefore(cart, row.nextSibling);
    cart.style.setProperty('--cart-h', (cart.scrollHeight+6)+'px');
    window.__lit = row;
  };
  document.querySelectorAll('[data-row]').forEach(r => {
    r.addEventListener('click', e => {
      if (e.target.closest('.rw-tick') || e.target.closest('.signal')) return;
      window.rwLight(r);
    });
  });

  const ticksPerHead = [...document.querySelectorAll('.gate')].map(g=>g.querySelectorAll('.rw-tick').length);
  return { gates:document.querySelectorAll('.gate').length,
           rows:document.querySelectorAll('[data-row]').length,
           headRacks:document.querySelectorAll('.gate .rw-rack').length,
           rowRacks:document.querySelectorAll('[data-row] .rw-rack').length,
           ticksPerHead };
})()
`;

const b = await chromium.launch({ executablePath: EXEC });
const errs = [];

async function boot(dsf) {
  const pg = await b.newPage({ viewport: { width: 440, height: 1700 }, deviceScaleFactor: dsf });
  pg.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await pg.goto('http://127.0.0.1:9147/index.html', { waitUntil: 'networkidle' });
  await pg.waitForTimeout(2600);
  return pg;
}

const pg = await boot(1.5);
await pg.screenshot({ path: `${OUT}/00-R0-baseline.png`, fullPage: true });
await pg.addStyleTag({ content: CSS_R7 });
await pg.waitForTimeout(400);
await pg.screenshot({ path: `${OUT}/01-R7.png`, fullPage: true });
await pg.addStyleTag({ content: CSS_P1 });
const built = await pg.evaluate(BUILD);
await pg.waitForTimeout(700);
await pg.screenshot({ path: `${OUT}/02-P1-housings.png`, fullPage: true });

const lit = await pg.evaluate(`(() => {
  const rows=[...document.querySelectorAll('[data-row]')];
  const r=rows.find(x=>x.querySelector('.pin[data-hint]')) || rows[0];
  if(!r) return 'no rows'; window.rwLight(r);
  return ((r.querySelector('.rmq')||{}).textContent||'row').trim();
})()`);
await pg.waitForTimeout(650);
await pg.screenshot({ path: `${OUT}/03-P1-cartridge-lit.png`, fullPage: true });

/* ---- proof: light lives only on glass; the housing only moved ---- */
const proof = await pg.evaluate(`(() => {
  const out={}; const cs=el=>getComputedStyle(el);
  const g=document.querySelector('.gate[data-open="1"]')||document.querySelector('.gate');
  if(g){ const s=cs(g);
    out.housing={ outerGlow:/(^|,)\\s*0 0 \\d/.test(s.boxShadow)?'HAS GLOW (VIOLATION)':'none',
      transform:s.transform,
      nameTextShadow:cs(g.querySelector('.sc-interp')).textShadow,
      nameRightAligned: (()=>{ const n=g.querySelector('.sc-interp').getBoundingClientRect();
        const gb=g.getBoundingClientRect(); return Math.round(gb.right-n.right); })() }; }
  const lit=document.querySelector('[data-row][data-lit="1"]');
  if(lit){ const inner=[...lit.children].find(c=>c.tagName==='DIV'); const s=cs(inner);
    out.cartridge={ background:s.backgroundImage.slice(0,72),
      nameGlow:cs(lit.querySelector('.rmq')).textShadow,
      nameRightAligned: (()=>{ const n=lit.querySelector('.rmq').getBoundingClientRect();
        const rb=inner.getBoundingClientRect(); return Math.round(rb.right-n.right); })() };
    out.drawerPresent=!!(lit.nextElementSibling&&lit.nextElementSibling.classList.contains('rw-cart')); }
  // an UNLIT row must stay matte steel — no emission anywhere
  const dark=[...document.querySelectorAll('[data-row]')].find(r=>!r.hasAttribute('data-lit'));
  if(dark){ const inner=[...dark.children].find(c=>c.tagName==='DIV');
    out.unlitRow={ background:cs(inner).backgroundImage.slice(0,60),
      nameTextShadow:cs(dark.querySelector('.rmq')||inner).textShadow }; }

  /* --- the 380px budget (section 2.4): nothing may exceed its container --- */
  const over=[];
  document.querySelectorAll('.scp1').forEach(s=>{
    const b=s.getBoundingClientRect();
    [...s.children].forEach(c=>{ if(cs(c).position==='absolute')return;
      const r=c.getBoundingClientRect(); if(r.right>b.right+1)
        over.push({lvl:'head',cls:String(c.className).slice(0,26),by:Math.round(r.right-b.right)}); }); });
  document.querySelectorAll('[data-row]').forEach(rw=>{
    const inner=[...rw.children].find(c=>c.tagName==='DIV'); if(!inner)return;
    const b=inner.getBoundingClientRect();
    [...inner.children].forEach(c=>{ if(cs(c).position==='absolute')return;
      const r=c.getBoundingClientRect(); if(r.right>b.right+1)
        over.push({lvl:'row',cls:String(c.className).slice(0,26),by:Math.round(r.right-b.right)}); }); });
  out.overflow = over.length ? over.slice(0,8) : 'NONE — everything inside the 380px card';
  out.docScrollW = document.documentElement.scrollWidth;
  // widest head rack actually rendered, and its tick count (proves #170's no-cap)
  const racks=[...document.querySelectorAll('.scp1 .rw-rack')].map(r=>({
    ticks:r.querySelectorAll('.rw-tick').length, w:Math.round(r.getBoundingClientRect().width)}));
  out.headRacks=racks;
  return out;
})()`);

/* detail crops at 3.4 */
const pg2 = await boot(3.4);
await pg2.addStyleTag({ content: CSS_R7 });
await pg2.addStyleTag({ content: CSS_P1 });
await pg2.evaluate(BUILD);
await pg2.waitForTimeout(500);
const g0 = await pg2.$('.gate');
if (g0) {
  const bb = await g0.boundingBox();
  if (bb) await pg2.screenshot({ path: `${OUT}/04-housing-detail@3.4x.png`,
    clip:{ x:Math.max(0,bb.x-8), y:Math.max(0,bb.y-10), width:Math.min(440,bb.width+16), height:bb.height+22 } });
}
await pg2.evaluate(`(() => { const rows=[...document.querySelectorAll('[data-row]')];
  const r=rows.find(x=>x.querySelector('.pin[data-hint]'))||rows[0]; if(r) window.rwLight(r); })()`);
await pg2.waitForTimeout(700);
const litRow = await pg2.$('[data-row][data-lit="1"]');
if (litRow) { const bb = await litRow.boundingBox();
  if (bb) await pg2.screenshot({ path: `${OUT}/05-cartridge-detail@3.4x.png`,
    clip:{ x:Math.max(0,bb.x-6), y:Math.max(0,bb.y-8), width:Math.min(440,bb.width+12), height:bb.height+104 } }); }

fs.writeFileSync(`${OUT}/proof.json`, JSON.stringify({ built, lit, proof, errs }, null, 2));
console.log(JSON.stringify({ built, lit, proof, errs: errs.slice(0,4) }, null, 2));
await b.close();
