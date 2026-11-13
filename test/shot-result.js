const { chromium } = require('playwright-core'); const path = require('path');
(async () => {
  const b = await chromium.launch({ channel: 'msedge', headless: true, args: ['--mute-audio'] });
  const p = await b.newPage({ viewport: { width: 360, height: 740 } });
  await p.addInitScript(() => { if (window.speechSynthesis) speechSynthesis.speak = () => {}; });
  await p.goto('file:///' + path.resolve('index.html').replace(/\\/g, '/'));
  await p.evaluate(() => go('result', { lv: L('u1l1'), stars: 3, xp: 130, coins: 14, prize: { item: 'acc_cap' }, badges: [CONTENT.badges[0]], evolve: { unit: 'u1', stage: 1 }, rankUp: 'Trainer', story: 'Test' }));
  await p.click('[data-gift]', { force: true }); await p.waitForTimeout(2000);
  await p.screenshot({ path: 'test/shots/result-evolve.png' }); await b.close();
})();
