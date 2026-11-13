// Exports englishLines() + audioKey() from the built app into tts/lines.json (silent, headless).
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--mute-audio'] });
  const page = await browser.newPage();
  await page.addInitScript(() => { if (window.speechSynthesis) speechSynthesis.speak = () => {}; });
  await page.goto('file:///' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/'));
  const lines = await page.evaluate(() => englishLines().map(t => ({ text: Speech.clean(t), key: audioKey(t) })));
  fs.writeFileSync(path.join(__dirname, 'lines.json'), JSON.stringify(lines, null, 1));
  console.log(lines.length + ' lines');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
