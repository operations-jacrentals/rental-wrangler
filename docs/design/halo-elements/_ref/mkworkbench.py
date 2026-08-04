#!/usr/bin/env python3
"""Build the steel workbench from the real assembly page.

The workbench is GENERATED, never hand-edited, so it can't drift from
assembly/main-plus-subitem.html. It takes that page, inlines every stylesheet
it links (plus steel-skin.css), and bolts on a knob rail that drives the three
steel variables live.

    python3 _ref/mkworkbench.py            -> steel-workbench.html  (repo, linked-free)
    python3 _ref/mkworkbench.py --artifact -> steel-workbench.artifact.html

--artifact emits a fragment with no <!doctype>/<html>/<head>/<body>, which is
what the Artifact publisher wants.
"""
import re, sys, pathlib

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent
SRC = ROOT / "assembly" / "main-plus-subitem.html"

RAIL = """
<div class="wb">
  <header class="wb__head">
    <h1>Steel workbench</h1>
    <p>Every steel surface is one hue, one saturation, and its own lightness from
       the original sculpt. Move a knob and the whole kit follows — the grain,
       bevels and machined highlights are relative lightness, so they survive.</p>
  </header>

  <div class="wb__rail">
    <div class="wb__knobs">
      <label>Hue <output id="oH">214</output>
        <input id="kH" type="range" min="0" max="360" step="1" value="214"></label>
      <label>Saturation <output id="oS">30%</output>
        <input id="kS" type="range" min="0" max="60" step="1" value="30"></label>
      <label>Lightness <output id="oT">0.82</output>
        <input id="kT" type="range" min="0.45" max="1.15" step="0.01" value="0.82"></label>
      <label>Hue spread <output id="oP">0</output>
        <input id="kP" type="range" min="0" max="1" step="0.05" value="0"></label>
    </div>

    <div class="wb__presets">
      <span class="wb__lbl">Drafts</span>
      <button data-p="214,30,0.82,0" class="is-on">Deep blued</button>
      <button data-p="214,7,0.92,0">Gunmetal</button>
      <button data-p="206,16,1,0">Slate</button>
      <button data-p="218,10,0.7,0">Charcoal</button>
      <button data-p="212,30,1,1">Original</button>
    </div>

    <div class="wb__presets">
      <span class="wb__lbl">Row state <em>(the laser follows it, the steel never does)</em></span>
      <button data-r="overdue" class="is-on">Overdue</button>
      <button data-r="due">Due</button>
      <button data-r="waiting">Waiting</button>
      <button data-r="done">Done</button>
      <button data-r="off">None</button>
    </div>

    <div class="wb__ladder" id="wbLadder"></div>
    <output id="wbOut" class="wb__out"></output>
  </div>

  <div class="wb__stagewrap"><div class="wb__scaler">
"""

RAIL_TAIL = """
  </div></div>
</div>
"""

CSS = """
/* ---- workbench chrome (not part of the kit) ---- */
.wb { font-family: var(--sans); color: #eef2f7; max-width: 1340px; margin: 0 auto; padding: 20px 16px 48px; }
.wb__head h1 { font-size: 22px; font-weight: 700; letter-spacing: .02em; margin-bottom: 6px; }
.wb__head p { color: #aab4c1; font-size: 13.5px; line-height: 1.55; max-width: 74ch; }
.wb__rail { margin: 18px 0; padding: 14px 16px; background: #12171e; border: 1px solid #2c343f; border-radius: 10px; }
.wb__knobs { display: flex; flex-wrap: wrap; gap: 18px 28px; }
.wb__knobs label { display: flex; flex-direction: column; gap: 6px; font: 600 11px/1 var(--mono); letter-spacing: .09em; text-transform: uppercase; color: #838e9c; min-width: 210px; flex: 1 1 210px; }
.wb__knobs output { font-size: 13px; color: #eef2f7; letter-spacing: .04em; }
.wb__knobs input { width: 100%; accent-color: #ff7e1f; }
.wb__presets { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 14px; padding-top: 14px; border-top: 1px solid #212834; }
.wb__lbl { font: 600 11px/1 var(--mono); letter-spacing: .09em; text-transform: uppercase; color: #838e9c; margin-right: 4px; }
.wb__lbl em { font-style: normal; text-transform: none; letter-spacing: 0; color: #5d6979; }
.wb__presets button { font: 600 12px/1 var(--sans); color: #aab4c1; background: #1a212b; border: 1px solid #2c343f; border-radius: 999px; padding: 7px 14px; cursor: pointer; }
.wb__presets button:hover { color: #eef2f7; border-color: #44546a; }
.wb__presets button.is-on { color: #1a1205; background: #ff7e1f; border-color: #ff7e1f; }
.wb__ladder { display: flex; flex-wrap: wrap; gap: 2px; margin-top: 14px; padding-top: 14px; border-top: 1px solid #212834; }
.wb__sw { flex: 1 1 78px; min-width: 78px; }
.wb__sw i { display: block; height: 34px; border: 1px solid rgba(0,0,0,.45); }
.wb__sw b { display: block; font: 500 9.5px/1.5 var(--mono); color: #838e9c; letter-spacing: .04em; padding-top: 4px; }
.wb__sw b span { display: block; color: #5d6979; text-transform: uppercase; letter-spacing: .1em; font-size: 8.5px; }
.wb__out { display: block; margin-top: 12px; font: 500 11.5px/1.6 var(--mono); color: #838e9c; word-break: break-all; }
/* The stage is the full 1292x635 canvas but the card only occupies a ~250px
   band of it. Clip to that band rather than shipping a screen of empty
   ground — the canvas keeps its real coordinates, we just window it. */
.wb__stagewrap { overflow-x: auto; border: 1px solid #2c343f; border-radius: 10px; }
.wb__scaler { width: 1292px; height: 264px; overflow: hidden; }
.wb__scaler .stage { margin-top: -122px; }
"""

JS = """
(function(){
  var root = document.querySelector('.wb__scaler .stage') || document.querySelector('.stage');
  var kH=document.getElementById('kH'), kS=document.getElementById('kS'),
      kT=document.getElementById('kT'), kP=document.getElementById('kP');
  var oH=document.getElementById('oH'), oS=document.getElementById('oS'),
      oT=document.getElementById('oT'), oP=document.getElementById('oP');
  var out=document.getElementById('wbOut');
  /* Set on the stage AND on :root. The stage is what gets previewed, but the
     swatch rail lives outside it and would otherwise resolve :root's stale
     defaults instead of what is actually on screen. */
  var SCOPES = [document.documentElement, root];
  function setVar(k,v){ SCOPES.forEach(function(el){ el.style.setProperty(k,v); }); }
  function apply(){
    setVar('--steel-h', kH.value);
    setVar('--steel-s', kS.value + '%');
    setVar('--steel-tint', kT.value);
    setVar('--steel-spread', kP.value);
    oH.textContent = kH.value;
    oS.textContent = kS.value + '%';
    oT.textContent = (+kT.value).toFixed(2);
    oP.textContent = (+kP.value).toFixed(2);
    var exact = (kH.value==='212' && kS.value==='30' && +kT.value===1 && +kP.value===1);
    readout((exact ? 'EXACT original canvas — the knobs alone reproduce it   ·   ' : '')
      + 'h ' + kH.value + '  s ' + kS.value + '%  tint ' + kT.value + '  spread ' + kP.value + '   ·   ');
  }

  /* getComputedStyle on a custom property hands back the unresolved token
     ("hsl(214 30% calc(41.4% * .82))"), so paint it onto a probe and read the
     resolved colour back off that instead. */
  var probe = document.createElement('span');
  probe.style.display = 'none';
  function resolve(name){
    root.appendChild(probe);
    probe.style.color = 'var(' + name + ')';
    var c = getComputedStyle(probe).color;
    var m = c.match(/\\d+/g);
    return m ? '#' + m.slice(0,3).map(function(n){ return (+n).toString(16).padStart(2,'0'); }).join('') : c;
  }
  /* the ladder, brightest to deepest, with the role each rung actually plays */
  var RUNGS = [['--chrome','bright'],['--silver','sheen'],['--rim-left','edge L'],
               ['--rim-bot','edge B'],['--rim-right','edge R'],['--rim-top','body'],
               ['--slate','recess'],['--field','field'],['--cavity','cavity'],
               ['--edge','edge'],['--circuit','groove']];
  var lad = document.getElementById('wbLadder');
  lad.innerHTML = RUNGS.map(function(r){
    return '<div class="wb__sw"><i data-k="' + r[0] + '"></i><b><span>' + r[1] + '</span>'
         + '<em data-h="' + r[0] + '" style="font-style:normal"></em></b></div>';
  }).join('');
  function paintLadder(){
    RUNGS.forEach(function(r){
      var hex = resolve(r[0]);
      lad.querySelector('[data-k="' + r[0] + '"]').style.background = 'var(' + r[0] + ')';
      lad.querySelector('[data-h="' + r[0] + '"]').textContent = hex;
    });
  }
  function readout(prefix){
    out.textContent = prefix + 'body ' + resolve('--rim-top')
      + '  ·  edge ' + resolve('--rim-right')
      + '  ·  bright ' + resolve('--chrome')
      + '  ·  groove ' + resolve('--circuit');
    paintLadder();
  }
  [kH,kS,kT,kP].forEach(function(k){ k.addEventListener('input', apply); });

  document.querySelectorAll('[data-p]').forEach(function(b){
    b.addEventListener('click', function(){
      document.querySelectorAll('[data-p]').forEach(function(x){ x.classList.remove('is-on'); });
      b.classList.add('is-on');
      var p = b.dataset.p.split(',');
      kH.value = p[0]; kS.value = p[1]; kT.value = p[2]; kP.value = p[3];
      apply();
    });
  });

  document.querySelectorAll('[data-r]').forEach(function(b){
    b.addEventListener('click', function(){
      document.querySelectorAll('[data-r]').forEach(function(x){ x.classList.remove('is-on'); });
      b.classList.add('is-on');
      root.className = root.className.replace(/\\brow--\\S+/g,'').trim() + ' row--' + b.dataset.r;
    });
  });

  root.classList.add('row--overdue');
  apply();
})();
"""


def build(artifact: bool) -> str:
    src = SRC.read_text()
    head = re.search(r"<head[^>]*>(.*?)</head>", src, re.S).group(1)
    body = re.search(r"<body[^>]*>(.*)</body>", src, re.S).group(1)

    # inline every stylesheet the assembly links, in order, then the skin
    sheets = re.findall(r'<link\s+rel="stylesheet"\s+href="([^"]+)"', head)
    css_parts = []
    for href in sheets:
        p = (ROOT / "assembly" / href).resolve()
        css_parts.append("/* ===== %s ===== */\n%s" % (href, p.read_text()))
        if href.endswith("tokens.css"):
            skin = ROOT / "steel-skin.css"
            css_parts.append("/* ===== steel-skin.css ===== */\n%s" % skin.read_text())
    css_parts.append("/* ===== workbench chrome ===== */\n%s" % CSS)
    css = "\n\n".join(css_parts)

    page = RAIL + body + RAIL_TAIL
    title = "Steel workbench — Halo elements"

    if artifact:
        return "<title>%s</title>\n<style>\n%s\n</style>\n%s\n<script>\n%s\n</script>\n" % (
            title, css, page, JS)
    return (
        "<!doctype html>\n<html><head><meta charset=\"utf-8\">\n"
        "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n"
        "<title>%s</title>\n<style>\n%s\n</style>\n</head>\n<body>\n%s\n"
        "<script>\n%s\n</script>\n</body></html>\n" % (title, css, page, JS))


if __name__ == "__main__":
    art = "--artifact" in sys.argv
    outp = ROOT / ("steel-workbench.artifact.html" if art else "steel-workbench.html")
    outp.write_text(build(art))
    print("wrote %s (%d bytes)" % (outp.relative_to(ROOT.parent.parent.parent), outp.stat().st_size))
