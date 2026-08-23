// Land R2->P1 into the prototype, taking the CSS verbatim from the verified p1.mjs
// so what ships is byte-identical to what was measured.
import fs from 'node:fs';
const SCR = '/tmp/claude-0/-home-user-rental-wrangler/0ae968fe-28c8-53d0-84a6-9fc8848ba315/scratchpad/p1/p1.mjs';
const TGT = '/home/user/rental-wrangler/docs/design/tier-01-card/index.html';

const src = fs.readFileSync(SCR, 'utf8');
const CSS_R7 = src.split('const CSS_R7 = `')[1].split('`;')[0];
const CSS_P1 = src.split('const CSS_P1 = `')[1].split('`;')[0];
const CSS = (CSS_R7 + '\n' + CSS_P1).trim();

const BLOCK = `
<!-- ============================================================================
     Tier-0.1 head/row build — revert points R2-R7 plus P1, landed 2026-07-31.
     Trail: docs/superpowers/specs/2026-07-31-tier-01-head-row-design-log.md
     Rulings: decisions ledger #165-#173.

       R2-R4  the group head: a 26px deep milled pocket, raised letter faces in
              an etched-away field, hue on the faces, open/shut on the floor.
       R5-R7  pins retired for slots (skewed ticks); the row's message board;
              row order = message board . button . slots . facts . name.
       P1     TWO LEVELS, TWO PHYSICS (#168):
                GROUP = housing,   opens by MOVING    steel . mechanical . no light
                ROW   = cartridge, opens by LIGHTING  glass . terminal . emission
              Invariant at both levels: the name is right-aligned.

     WHY THIS IS A RUNTIME BLOCK AND NOT A STATIC <style>: the card ships its own
     runtime-INJECTED stylesheet, which lands after anything static, so an
     equal-specificity rule loses on source order (design log section 3.3). The
     style element is appended from JS so it is guaranteed to come last, and the
     DOM work has to wait for the component to mount anyway.

     WHY IT HOOKS THE CARD'S OWN OPEN STATE: ledger #173 keeps the existing 220ms
     single/double click discriminator (#67/#164) exactly as it is. The card marks
     an open row by writing an inline color-mix wash (#156's group-hue-at-16%);
     this block detects that and re-skins it as a lit cartridge, per #172. It does
     NOT add a competing click handler.
     ============================================================================ -->
<script>
(function () {
  var CSS = ${JSON.stringify(CSS)};

  var HUE = function (l) { var s = (l || '').toLowerCase();
    if (/overdue|failed|fail|damage|breakdown/.test(s)) return ['#ff4242', 'red'];
    if (/service due|needs wash|open|promised|due/.test(s)) return ['#eed44b', 'yellow'];
    if (/transport|truck|pickup|reserved/.test(s)) return ['#6394cc', 'blue'];
    if (/available|complete|passed|paid/.test(s)) return ['#34d399', 'green'];
    return ['#8a94a2', 'gray']; };
  var RANK = { red: 0, yellow: 1, blue: 2, green: 3, gray: 4 };   // style section 6 rollup

  // A row's issues live in the .pin's data-hint: one per line, "Source, State, Date".
  // (data-tip does not exist in this build — see design log section 5.7.)
  // Slots are ISSUES, so this is pin-derived ONLY: a row with nothing open gets no
  // ticks, rather than a filler tick made from its own state text.
  function rowIssues(row) {
    var pin = row.querySelector('.pin[data-hint]');
    if (!pin) return [];
    return (pin.getAttribute('data-hint') || '').split(/\\n+/).map(function (l) {
      var p = l.split(',').map(function (s) { return s.trim(); });
      return p.length >= 2 ? p[1] : p[0];
    }).filter(Boolean);
  }
  function rowState(row) {
    var sg = row.querySelector('.signal'); return sg ? (sg.textContent || '').trim() : '';
  }
  // THE STALENESS GUARD. dc-runtime RECYCLES row/head nodes positionally instead of
  // replacing them, so "a rack already exists here" does NOT mean "this node is still
  // about the same record". Without this, filtering or searching leaves a rack, board
  // and data-tone describing a DIFFERENT unit — and a wrong data-tone mis-colours the
  // laser frame, which #172 makes the sole carrier of the state hue.
  function rowSig(row) {
    var pin = row.querySelector('.pin[data-hint]');
    return (pin ? pin.getAttribute('data-hint') : '') + '\\u0001' +
           (((row.querySelector('.rmq') || {}).textContent) || '') + '\\u0001' + rowState(row);
  }
  function headSig(gate, grp) {
    var s = ((gate.querySelector('.sc-interp') || {}).textContent) || '';
    if (grp) { var rs = grp.querySelectorAll('[data-row]');
      for (var i = 0; i < rs.length; i++) s += '\\u0002' + rowSig(rs[i]); }
    return s;
  }
  // #170 — "+N appears only when real width runs out". The rack clips at overflow:hidden,
  // so without this the excess ticks vanish silently instead of being counted.
  function fitRack(rk) {
    if (!rk) return;
    var old = rk.querySelector('.rw-more'); if (old) old.parentNode.removeChild(old);
    var ticks = [].slice.call(rk.querySelectorAll('.rw-tick'));
    ticks.forEach(function (t) { t.style.display = ''; });
    if (!ticks.length || rk.clientWidth <= 0) return;
    var n = ticks.length, more = null;
    while (n > 0 && rk.scrollWidth > rk.clientWidth + 1) {
      n--; ticks[n].style.display = 'none';
      if (!more) { more = document.createElement('span'); more.className = 'rw-more'; rk.appendChild(more); }
      more.textContent = '+' + (ticks.length - n);
    }
  }
  // children[0] is the absolutely-positioned accent caret span, NOT the content div.
  function rowInner(row) {
    for (var i = 0; i < row.children.length; i++) if (row.children[i].tagName === 'DIV') return row.children[i];
    return null;
  }
  function rack(list) {
    var r = document.createElement('div'); r.className = 'rw-rack';
    list.forEach(function (t) {
      var k = document.createElement('i'); k.className = 'rw-tick';
      k.style.background = HUE(t)[0]; k.dataset.label = t; r.appendChild(k);
    });
    return r;
  }
  function board(txt) {
    var b = document.createElement('div'); b.className = 'rw-board';
    var s = document.createElement('span'); s.textContent = txt; s.style.color = '#6a7684';
    b.appendChild(s); return b;
  }
  function wire(ticks, b, rest) {
    ticks.forEach(function (k) {
      k.addEventListener('mouseenter', function () {
        var s = b.querySelector('span'); s.textContent = k.dataset.label.toUpperCase();
        s.style.color = HUE(k.dataset.label)[0]; k.classList.add('hot');
      });
      k.addEventListener('mouseleave', function () {
        var s = b.querySelector('span'); s.textContent = rest; s.style.color = '#6a7684';
        k.classList.remove('hot');
      });
    });
  }

  function build() {
    // #169 takes the LASER off the housing — and ONLY the laser. The frame is the one
    // element carrying an inline transform-origin (the browser normalises the authored
    // "top" to "center top", so match the PROPERTY, not a value); there are exactly ten,
    // one per group. It is NOT a direct child of the group, which is why a grp.children
    // scan missed it entirely. The earlier blanket "hide every absolute div in the group"
    // did find it, but took the side rails, U-groove, uBeam and both tongues with it —
    // and those are chassis steel, which #168 defines the housing as keeping.
    [].forEach.call(document.querySelectorAll('div[style*="transform-origin"]'), function (c) {
      c.classList.add('rw-noframe');
    });

    // --- open/shut, read off the chevron's INLINE transform ---
    // NOT getComputedStyle: this block's own CSS sets .gate__chev{display:none},
    // and a display:none element computes transform as "none" no matter what the
    // inline value says — which pinned every gate to data-open="1" and left the
    // whole housing open/shut mechanic dead. The inline value survives hiding.
    [].forEach.call(document.querySelectorAll('.gate'), function (g) {
      var c = g.querySelector('.gate__chev');
      var t = c ? (c.style.transform || 'none') : 'none';
      g.setAttribute('data-open', (t && t !== 'none') ? '0' : '1');
    });

    // --- LEVEL 2 · cartridges (rows). REPLACE, don't ADD: the 380px budget is
    //     already spent, and the bare spans are the date/facts column, which
    //     R7/#162 drop first anyway. ---
    [].forEach.call(document.querySelectorAll('[data-row]'), function (row) {
      var inner = rowInner(row); if (!inner) return;
      var sig = rowSig(row);
      if (row.getAttribute('data-rwsig') !== sig) {
        // the node was recycled onto a different record — tear the old layer out
        var ob = inner.querySelector('.rw-board'); if (ob) ob.parentNode.removeChild(ob);
        var ork = inner.querySelector('.rw-rack'); if (ork) ork.parentNode.removeChild(ork);

        [].forEach.call(inner.children, function (c) {
          // NEVER sweep the jump band: it only exists while the row is open, and
          // hiding it once is permanent because the sweep does not re-run for it.
          if (c.hasAttribute('data-jump-band')) return;
          if (!c.classList.contains('pin-wrap') && !c.classList.contains('ref')) c.classList.add('rw-off');
        });
        var list = rowIssues(row);
        var worst = list.slice().sort(function (a, b) { return RANK[HUE(a)[1]] - RANK[HUE(b)[1]]; })[0];
        // no open issues -> the row's own state still gives the lit frame its hue
        row.setAttribute('data-tone', HUE(worst || rowState(row))[1]);
        var rest = list[0] ? list[0].toUpperCase() : '\\u2014';
        var bd = board(rest);
        inner.insertBefore(bd, inner.firstChild);
        var rk = rack(list);                     // empty list -> no ticks, not a filler tick
        inner.insertBefore(rk, bd.nextSibling);
        wire([].slice.call(rk.querySelectorAll('.rw-tick')), bd, rest);
        fitRack(rk);
        row.setAttribute('data-rwsig', sig);
      }

      // The card signals "this row is open" by writing an inline color-mix wash
      // (#156). #172 re-skins that as a lit cartridge; #173 leaves the click alone.
      var open = /color-mix/.test((inner.getAttribute('style') || ''));

      // The card renders its own detail panel as a LATER div child — that panel
      // is the cartridge's drawer slot and it carries the #63 anchor icon, so
      // the terminal lines go INSIDE it rather than becoming a second drawer.
      var drawer = null;
      for (var j = row.children.length - 1; j >= 0; j--) {
        var ch = row.children[j];
        if (ch.tagName === 'DIV' && ch !== inner) { drawer = ch; break; }
      }

      if (open) {
        row.setAttribute('data-lit', '1');
        if (drawer && !drawer.querySelector('.rw-cartlines')) {
          drawer.classList.add('rw-drawer');
          var nm = ((row.querySelector('.rmq') || {}).textContent || 'UNIT').trim();
          var li = rowIssues(row);
          var lines = document.createElement('div'); lines.className = 'rw-cartlines';
          lines.innerHTML = '<div class="l">&gt; <b>' + nm + '</b> ONLINE</div>' +
            (li.length ? li.map(function (t) { return '<div class="l">&nbsp;&nbsp;\\u00b7 ' + t.toUpperCase() + '</div>'; }).join('')
                       : '<div class="l dim">&nbsp;&nbsp;\\u00b7 NO OPEN ISSUES</div>') +
            '<div class="l dim">&nbsp;&nbsp;READY</div>';
          drawer.appendChild(lines);
        }
      } else if (row.getAttribute('data-lit') === '1') {
        row.removeAttribute('data-lit');
        if (drawer) {
          drawer.classList.remove('rw-drawer');
          var old = drawer.querySelector('.rw-cartlines');
          if (old) old.parentNode.removeChild(old);
        }
      }
    });

    // --- LEVEL 1 · housings (group heads), right-condensed at .scp1:
    //     [ slots ...residual... ][ board ][ NAME ]. The head's own board/stamp/
    //     spacers are retired so the rack inherits the width they held (#170). ---
    [].forEach.call(document.querySelectorAll('.gate'), function (g) {
      var scp = g.closest('.scp1'); if (!scp) return;
      var grp = scp.parentElement;
      var sig = headSig(g, grp);
      if (scp.getAttribute('data-rwsig') === sig) return;   // same record, still valid

      var ob = scp.querySelector('.rw-board'); if (ob) ob.parentNode.removeChild(ob);
      var ork = scp.querySelector('.rw-rack'); if (ork) ork.parentNode.removeChild(ork);

      [].forEach.call(scp.children, function (c) {
        if (c.classList.contains('pin-wrap')) return;
        if (getComputedStyle(c).position === 'absolute') return;
        c.classList.add('rw-off');
      });
      var rows = grp ? [].slice.call(grp.querySelectorAll('[data-row]')) : [];
      var list = [];
      rows.forEach(function (r) { list = list.concat(rowIssues(r)); });   // pin-derived only
      list.sort(function (a, b) { return RANK[HUE(a)[1]] - RANK[HUE(b)[1]]; });   // hottest first
      // a lifecycle group with nothing open reads NOMINAL and shows no ticks, instead
      // of counting its own members' states as if they were open issues
      var rest = list.length ? (list.length + ' OPEN') : 'NOMINAL';
      var bd = board(rest);
      var rk = rack(list);
      scp.insertBefore(bd, scp.firstChild);
      scp.insertBefore(rk, bd);
      wire([].slice.call(rk.querySelectorAll('.rw-tick')), bd, rest);
      fitRack(rk);
      scp.setAttribute('data-rwsig', sig);
    });
  }

  var obs = null, queued = false;
  function rebuild() {
    if (obs) obs.disconnect();
    try { build(); } catch (e) { if (window.console) console.warn('[rw-p1]', e); }
    if (obs) obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
    queued = false;
  }
  function schedule() { if (!queued) { queued = true; requestAnimationFrame(rebuild); } }

  function start() {
    var st = document.createElement('style');
    st.id = 'rw-p1'; st.textContent = CSS;
    document.head.appendChild(st);          // appended last, so it wins source order
    rebuild();
    obs = new MutationObserver(schedule);
    obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
  }

  // the component mounts asynchronously — wait for it, then bail out politely
  var tries = 0;
  var t = setInterval(function () {
    if (document.querySelector('.gate')) { clearInterval(t); start(); }
    else if (++tries > 150) { clearInterval(t); }   // ~12s, then give up silently
  }, 80);
})();
</script>
`;

let html = fs.readFileSync(TGT, 'utf8');
const marker = '</body></html>';
if (html.indexOf(marker) === -1) { console.error('marker not found'); process.exit(1); }
// idempotent: strip any previously-landed block, then re-insert the current one
const START = '<!-- ============================================================================\n     Tier-0.1 head/row build';
const i = html.indexOf(START);
if (i !== -1) { html = html.slice(0, i) + html.slice(html.indexOf(marker)); console.log('replaced previous block'); }
html = html.replace(marker, BLOCK + '\n' + marker);
fs.writeFileSync(TGT, html);
console.log('landed, bytes now', html.length);
