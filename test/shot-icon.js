const { chromium } = require('playwright-core'); const path = require('path');
(async () => {
  const b = await chromium.launch({ channel: 'msedge', headless: true, args: ['--mute-audio'] });
  const p = await b.newPage({ viewport: { width: 420, height: 440 } });
  await p.addInitScript(() => { if (window.speechSynthesis) speechSynthesis.speak = () => {}; });
  await p.goto('file:///' + path.resolve('index.html').replace(/\\/g, '/'));
  await p.evaluate(() => { document.body.innerHTML = '<div style="display:flex;gap:10px;padding:10px;background:#fff">' + ["wave","bye"].map(k => `<div style="width:200px">${ART.pic(W(CONTENT.words.find(w=>w.icon===k).id),'')}</div>`).join('') + '</div>'; });
  await p.screenshot({ path: 'test/shots/icons.png' }); await b.close();
})();
