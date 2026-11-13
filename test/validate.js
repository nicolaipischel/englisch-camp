// Prints the startup content validation of the built index.html (same report as #debug). Exit 1 on any finding.
const { chromium } = require('playwright-core');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--mute-audio'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto('file:///' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/') + '#debug');
  await page.waitForTimeout(300);
  const v = await page.evaluate(() => ({ errs: VALIDATION.errs, warns: VALIDATION.warns, text: validationText(), words: CONTENT.words.length, levels: CONTENT.levels.length }));
  await browser.close();
  errors.forEach(e => console.log(e));
  // --no-audio: ignore missing clips (audio is regenerated in one go at the end)
  const warns = process.argv.includes('--no-audio') ? v.warns.filter(w => !/^No audio clip/.test(w)) : v.warns;
  console.log(v.errs.length || warns.length ? [...v.errs.map(e => 'ERR ' + e), ...warns.map(w => 'WARN ' + w)].join('\n') : `OK (${v.words} words, ${v.levels} levels)`);
  process.exit(errors.length || v.errs.length || warns.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
