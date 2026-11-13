// Runs every 'py' task in real Pyodide (needs internet): the solution must pass, the start code must not.
const { chromium } = require('playwright-core');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--mute-audio'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto('file:///' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/'));
  await page.waitForTimeout(300);
  const t0 = Date.now();
  const res = await page.evaluate(async () => {
    await PY.load();
    const out = [];
    for (const lv of CONTENT.levels) for (const [i, s] of lv.plan.entries()) {
      if (s.k !== 'py') continue;
      const inputs = (s.inputs || []).map(sub);
      const good = await PY.run(sub(s.solution), s.check, inputs);
      const bad = await PY.run(sub(s.start || ''), s.check, inputs);
      out.push({ where: `${lv.id} seg ${i}`, solution: good.passed, err: good.err && good.err.line, out: good.out, startPasses: bad.passed });
    }
    return out;
  });
  const loop = await page.evaluate(async () => (await PY.run('while True:\n    pass', {})).err);
  await browser.close();
  let fails = errors.length;
  errors.forEach(e => console.log(e));
  for (const r of res) {
    const ok = r.solution && !r.startPasses;
    if (!ok) fails++;
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${r.where}${r.solution ? '' : ' solution fails: ' + (r.err || JSON.stringify(r.out))}${r.startPasses ? ' start code already passes' : ''}`);
  }
  console.log('infinite loop stopped:', loop ? loop.de : 'NO');
  if (!loop) fails++;
  console.log(`${res.length} py tasks, ${fails} failures, ${Math.round((Date.now() - t0) / 1000)} s`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
