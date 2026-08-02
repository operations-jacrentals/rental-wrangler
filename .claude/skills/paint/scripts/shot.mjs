import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
const OUT='/tmp/claude-0/-home-user-rental-wrangler/10a973a8-b1b9-5794-8775-4aaf37a97dd9/scratchpad';
const b = await chromium.launch();
const p = await b.newPage({ viewport:{width:1098,height:217} });
await p.goto('file://'+OUT+'/dump-recreation.html');
await p.waitForTimeout(400);
await p.screenshot({ path: OUT+'/recreation.png', clip:{x:0,y:0,width:1098,height:217} });
await b.close();
