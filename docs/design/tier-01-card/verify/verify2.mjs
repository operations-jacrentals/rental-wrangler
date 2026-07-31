// Clean-load verification of all six review findings, each independently.
import { chromium } from 'playwright';
const OUT='/tmp/claude-0/-home-user-rental-wrangler/0ae968fe-28c8-53d0-84a6-9fc8848ba315/scratchpad/p1';
const EXEC='/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const b=await chromium.launch({executablePath:EXEC});
const errs=[];
async function fresh(dsf){ const p=await b.newPage({viewport:{width:440,height:1700},deviceScaleFactor:dsf||1.5});
  p.on('pageerror',e=>errs.push(String(e).slice(0,150)));
  p.on('console',m=>{if(m.type()==='error'&&!/p\.icon|c\.icon/.test(m.text()))errs.push('con:'+m.text().slice(0,120));});
  await p.goto('http://127.0.0.1:9147/index.html',{waitUntil:'networkidle'}); await p.waitForTimeout(3000); return p; }
const R={};

// F4 — exactly the 10 laser frames hidden, nothing else
const p1=await fresh();
R.F4 = await p1.evaluate(`(()=>{const n=[...document.querySelectorAll('.rw-noframe')];
  return {count:n.length, allAreFrames:n.every(e=>/transform-origin/.test(e.getAttribute('style')||''))};})()`);

// F2 — data-open tracks collapse
R.F2_open = await p1.evaluate(`[...document.querySelectorAll('.gate')].map(g=>g.getAttribute('data-open'))`);
await p1.evaluate(`document.querySelector('.scp1').click()`); await p1.waitForTimeout(800);
R.F2_afterCollapse = await p1.evaluate(`(()=>{const g=document.querySelector('.gate');
  return {dataOpen:g.getAttribute('data-open'), inline:(g.querySelector('.gate__chev').style.transform||'none'),
          gateTransform:getComputedStyle(g).transform,
          faceColor:getComputedStyle(g.querySelector('.sc-interp')).color};})()`);
await p1.evaluate(`document.querySelector('.scp1').click()`); await p1.waitForTimeout(800);
R.F2_afterReopen = await p1.evaluate(`(()=>{const g=document.querySelector('.gate');
  return {dataOpen:g.getAttribute('data-open'), gateTransform:getComputedStyle(g).transform,
          faceColor:getComputedStyle(g.querySelector('.sc-interp')).color};})()`);
await p1.close();

// F1 — staleness under the Done filter
const p2=await fresh();
await p2.evaluate(`(()=>{const d=[...document.querySelectorAll('.seg__opt')].find(b=>/done/i.test(b.textContent||''));if(d)d.click();})()`);
await p2.waitForTimeout(1000);
R.F1_done = await p2.evaluate(`(()=>[...document.querySelectorAll('[data-row]')].map(r=>{
  const pin=r.querySelector('.pin[data-hint]');
  const real=pin?(pin.getAttribute('data-hint')||'').split(/\\n+/).filter(Boolean)
    .map(l=>{const p=l.split(',').map(s=>s.trim());return p.length>=2?p[1]:p[0];}):[];
  const board=((r.querySelector('.rw-board span')||{}).textContent||'').trim();
  const ticks=r.querySelectorAll('.rw-tick').length;
  return {name:((r.querySelector('.rmq')||{}).textContent||'').trim(), board, ticks,
          expectBoard:real[0]?real[0].toUpperCase():'\\u2014', expectTicks:real.length,
          tone:r.getAttribute('data-tone'),
          ok: board===(real[0]?real[0].toUpperCase():'\\u2014') && ticks===real.length};}))()`);
await p2.close();

// F3 — jump band survives unmount/remount while open
const p3=await fresh();
await p3.evaluate(`(()=>{const r=document.querySelector('[data-row]');const bb=r.getBoundingClientRect();
  r.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:bb.x+4,clientY:bb.y+bb.height/2}));})()`);
await p3.waitForTimeout(900);
R.F3_bandBefore = await p3.evaluate(`(()=>{const j=document.querySelector('[data-jump-band]');
  return j?{off:j.classList.contains('rw-off'),display:getComputedStyle(j).display}:'none';})()`);
await p3.evaluate(`(()=>{const i=document.querySelector('input');i.focus();i.value='zzzz';i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
await p3.waitForTimeout(800);
await p3.evaluate(`(()=>{const i=document.querySelector('input');i.value='';i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
await p3.waitForTimeout(1000);
R.F3_bandAfter = await p3.evaluate(`(()=>{const j=document.querySelector('[data-jump-band]');
  return j?{off:j.classList.contains('rw-off'),display:getComputedStyle(j).display}:'no band (row closed by remount)';})()`);
await p3.close();

// F5 + overall: heads read correctly on a clean load; no overflow
const p4=await fresh();
R.F5 = await p4.evaluate(`(()=>[...document.querySelectorAll('.scp1')].map(s=>{
  const grp=s.parentElement; let real=0;
  grp.querySelectorAll('[data-row]').forEach(r=>{const p=r.querySelector('.pin[data-hint]');
    if(p) real+=(p.getAttribute('data-hint')||'').split(/\\n+/).filter(Boolean).length;});
  const gate=s.querySelector('.gate');
  const board=((s.querySelector('.rw-board span')||{}).textContent||'').trim();
  return {group:((gate.querySelector('.sc-interp')||{}).textContent||'').trim(), board, realIssues:real,
          ticks:s.querySelectorAll('.rw-tick').length,
          ok: real===0 ? board==='NOMINAL' : board===real+' OPEN'};}))()`);
R.overflow = await p4.evaluate(`(()=>{const over=[];const cs=e=>getComputedStyle(e);
  document.querySelectorAll('.scp1').forEach(s=>{const bb=s.getBoundingClientRect();
    [...s.children].forEach(c=>{if(cs(c).position==='absolute')return;const r=c.getBoundingClientRect();
      if(r.right>bb.right+1)over.push('head+'+Math.round(r.right-bb.right));});});
  document.querySelectorAll('[data-row]').forEach(rw=>{const i=[...rw.children].find(c=>c.tagName==='DIV');if(!i)return;
    const bb=i.getBoundingClientRect();
    [...i.children].forEach(c=>{if(cs(c).position==='absolute')return;const r=c.getBoundingClientRect();
      if(r.right>bb.right+1)over.push('row+'+Math.round(r.right-bb.right));});});
  return over.length?over.slice(0,5):'NONE';})()`);
await p4.screenshot({path:`${OUT}/50-FIXED-rest.png`,fullPage:true});
await p4.close();
R.errs=errs;
console.log(JSON.stringify(R,null,2));
await b.close();
