// #146 audit: nothing on the HOUSING may emit. An emissive shadow is an outer
// "0 0 Npx" blur; an inset shadow or a hard offset is shading/paint, not light.
import { chromium } from 'playwright';
const EXEC='/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const b=await chromium.launch({executablePath:EXEC});
const pg=await b.newPage({viewport:{width:440,height:1700}});
await pg.goto('http://127.0.0.1:9147/index.html',{waitUntil:'networkidle'});
await pg.waitForTimeout(3000);
console.log(JSON.stringify(await pg.evaluate(`(()=>{
  const emissive = bs => {
    if(!bs||bs==='none') return false;
    // split top-level commas
    const parts=bs.split(/,(?![^(]*\\))/);
    return parts.some(p=>{ const t=p.trim(); if(/^inset/.test(t)) return false;
      // outer shadow with zero offsets and a real blur = glow
      const m=t.match(/(-?[\\d.]+)px\\s+(-?[\\d.]+)px\\s+([\\d.]+)px/);
      return !!m && Math.abs(+m[1])<0.5 && Math.abs(+m[2])<0.5 && +m[3]>0.5; });
  };
  const out={housingGlow:[], litRowGlow:null};
  document.querySelectorAll('.scp1').forEach(s=>{
    const grp=s.parentElement;
    // the head band and every non-row element inside the group container
    [s, ...s.querySelectorAll('*'), ...[...grp.children].filter(c=>!c.hasAttribute('data-row'))]
      .forEach(e=>{ if(e.closest && e.closest('[data-row]')) return;
        const bs=getComputedStyle(e).boxShadow;
        if(emissive(bs)) out.housingGlow.push({cls:String(e.className).slice(0,24)||e.tagName, bs:bs.slice(0,70)}); });
  });
  return {housingEmissiveCount: out.housingGlow.length, sample: out.housingGlow.slice(0,4)};
})()`),null,2));
await b.close();
