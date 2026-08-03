// Regression tests for the six review findings. Each reproduces the reviewer's exact repro.
import { chromium } from 'playwright';
const EXEC='/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const b=await chromium.launch({executablePath:EXEC});
const pg=await b.newPage({viewport:{width:440,height:1700}});
const errs=[]; pg.on('pageerror',e=>errs.push(String(e).slice(0,160)));
await pg.goto('http://127.0.0.1:9147/index.html',{waitUntil:'networkidle'});
await pg.waitForTimeout(3000);
const out={};

// F2 — data-open must actually vary with collapsed/open
out.F2_dataOpen = await pg.evaluate(`(()=>{
  const g=[...document.querySelectorAll('.gate')];
  const before=g.map(x=>x.getAttribute('data-open'));
  // collapse the first group by clicking its head
  document.querySelector('.scp1').click();
  return {before};
})()`);
await pg.waitForTimeout(700);
out.F2_afterCollapse = await pg.evaluate(`(()=>{
  const g=document.querySelector('.gate');
  const chev=g.querySelector('.gate__chev');
  return { dataOpen:g.getAttribute('data-open'), inlineTransform:chev.style.transform||'none',
           gateTransform:getComputedStyle(g).transform };
})()`);
await pg.evaluate(`document.querySelector('.scp1').click()`); await pg.waitForTimeout(700);

// F1 — staleness: filter to Done, check the surviving row's rack matches ITS record
out.F1_done = await pg.evaluate(`(()=>{
  const done=[...document.querySelectorAll('.seg__opt')].find(b=>/done/i.test(b.textContent||''));
  if(done) done.click(); return !!done;
})()`);
await pg.waitForTimeout(900);
out.F1_doneRows = await pg.evaluate(`(()=>{
  return [...document.querySelectorAll('[data-row]')].map(r=>{
    const pin=r.querySelector('.pin[data-hint]');
    return { name:((r.querySelector('.rmq')||{}).textContent||'').trim(),
             state:((r.querySelector('.signal')||{}).textContent||'').trim(),
             board:((r.querySelector('.rw-board span')||{}).textContent||'').trim(),
             ticks:r.querySelectorAll('.rw-tick').length,
             tone:r.getAttribute('data-tone'),
             realIssues: pin?(pin.getAttribute('data-hint')||'').split(/\\n+/).filter(Boolean).length:0 };
  });
})()`);
// reset filter
await pg.evaluate(`(()=>{const w=[...document.querySelectorAll('.seg__opt')].find(b=>/work/i.test(b.textContent||''));if(w)w.click();})()`);
await pg.waitForTimeout(600);

// F1b — search staleness
await pg.evaluate(`(()=>{const i=document.querySelector('input');if(i){i.focus();}})()`);
await pg.keyboard.type('a'); await pg.waitForTimeout(900);
out.F1_search = await pg.evaluate(`(()=>{
  return [...document.querySelectorAll('[data-row]')].slice(0,6).map(r=>{
    const pin=r.querySelector('.pin[data-hint]');
    const real=pin?(pin.getAttribute('data-hint')||'').split(/\\n+/).filter(Boolean)
      .map(l=>{const p=l.split(',').map(s=>s.trim());return p.length>=2?p[1]:p[0];}):[];
    return { name:((r.querySelector('.rmq')||{}).textContent||'').trim(),
             board:((r.querySelector('.rw-board span')||{}).textContent||'').trim(),
             expectBoard: real[0]?real[0].toUpperCase():'—',
             ticks:r.querySelectorAll('.rw-tick').length, expectTicks:real.length,
             ok: (real[0]?real[0].toUpperCase():'—')===((r.querySelector('.rw-board span')||{}).textContent||'').trim()
                 && real.length===r.querySelectorAll('.rw-tick').length };
  });
})()`);

// F3 — jump band survives an unmount/remount while open
await pg.evaluate(`(()=>{const i=document.querySelector('input');i.value='';i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
await pg.waitForTimeout(700);
await pg.evaluate(`(()=>{const r=document.querySelector('[data-row]');const bb=r.getBoundingClientRect();
  r.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:bb.x+4,clientY:bb.y+bb.height/2}));})()`);
await pg.waitForTimeout(800);
await pg.evaluate(`(()=>{const i=document.querySelector('input');i.focus();i.value='zzzz';i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
await pg.waitForTimeout(800);
await pg.evaluate(`(()=>{const i=document.querySelector('input');i.value='';i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
await pg.waitForTimeout(900);
out.F3_jumpBand = await pg.evaluate(`(()=>{
  const jb=document.querySelector('[data-jump-band]');
  if(!jb) return 'no band present (row not open)';
  return { hasRwOff:jb.classList.contains('rw-off'), display:getComputedStyle(jb).display };
})()`);

// F4 — only the laser frame is hidden, not the rails/U-groove
out.F4_noframe = await pg.evaluate(`(()=>{
  const n=[...document.querySelectorAll('.rw-noframe')];
  return { count:n.length, allHaveTransformOrigin:n.every(e=>/transform-origin\\s*:\\s*top/.test(e.getAttribute('style')||'')) };
})()`);

// F5 — a group with nothing open must read NOMINAL, not "N OPEN"
out.F5_heads = await pg.evaluate(`(()=>{
  return [...document.querySelectorAll('.scp1')].map(s=>{
    const grp=s.parentElement;
    let real=0; grp.querySelectorAll('[data-row]').forEach(r=>{const p=r.querySelector('.pin[data-hint]');
      if(p) real+=(p.getAttribute('data-hint')||'').split(/\\n+/).filter(Boolean).length;});
    const board=((s.querySelector('.rw-board span')||{}).textContent||'').trim();
    return { name:((s.querySelector('.sc-interp')||{}).textContent||'').trim(), board,
             realIssues:real, ticks:s.querySelectorAll('.rw-tick').length,
             ok: real===0 ? board==='NOMINAL' : board===real+' OPEN' };
  });
})()`);
out.errs=errs;
console.log(JSON.stringify(out,null,2));
await b.close();
