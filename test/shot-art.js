// Screenshot sheet of all bosses (both moods), monsters, scenes and items: test/shots/art-*.png
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

(async () => {
  const SHOTS = path.resolve(__dirname, 'shots');
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
  await page.goto('file:///' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/'));
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const cell = (h, cap) => `<div style="display:inline-block;width:150px;margin:4px;text-align:center;font:12px sans-serif;vertical-align:top"><div style="height:110px">${h}</div>${cap}</div>`;
    const bosses = ['crab', ...Object.keys(ART.bosses)].map(b => cell(ART.boss(b, 'grumpy'), b) + cell(ART.boss(b, 'happy'), b + ' happy')).join('');
    const mons = CONTENT.units.flatMap(u => u.monster.map((m, i) => cell(`<div style="width:100px;margin:auto">${ART.monster(m)}</div>`, u.monsterNames[i]))).join('');
    const items = CONTENT.items.map(i => cell(`<div style="width:80px;margin:auto">${ART.item(i.id)}</div>`, i.id)).join('') + CONTENT.badges.map(b => cell(`<div style="width:80px;margin:auto">${ART.badge(b)}</div>`, b.name)).join('');
    const scenes = CONTENT.units.map(u => cell(`<div style="width:140px;height:110px;overflow:hidden">${ART.scene(u.scene, 400)}</div>`, u.scene)).join('');
    const words = CONTENT.words.filter(w => w.unit !== 'u1').map(w => cell(`<div style="width:70px;margin:auto">${ART.pic(w)}</div>`, w.en)).join('');
    document.body.innerHTML = `<div id="b">${bosses}</div><div id="m">${mons}</div><div id="i">${items}</div><div id="s">${scenes}</div><div id="w">${words}</div>`;
    document.body.style.background = '#fff';
  });
  for (const id of ['b', 'm', 'i', 's', 'w']) await page.locator('#' + id).screenshot({ path: path.join(SHOTS, `art-${id}.png`) });
  await browser.close();
  console.log('ok');
})().catch(e => { console.error(e); process.exit(1); });
