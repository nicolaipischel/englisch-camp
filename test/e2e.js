// End-to-end smoke test: plays every Unit 1 level by touch-style clicks in headless Edge.
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const FILE = 'file:///' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/');
const SHOTS = path.resolve(__dirname, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });
const problems = [];
const note = m => { problems.push(m); console.log('PROBLEM:', m); };

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--mute-audio'] });
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  // Silent TTS: Edge on Windows speaks via SAPI, which --mute-audio does not cover.
  await ctx.addInitScript(() => {
    if (!window.speechSynthesis) return;
    speechSynthesis.speak = u => setTimeout(() => u.onend && u.onend(), 30);
    speechSynthesis.cancel = () => {};
  });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') note('console.error: ' + m.text()); if (m.type() === 'warning' && /validation/i.test(m.text())) console.log('WARN:', m.text()); });
  page.on('pageerror', e => note('pageerror: ' + e.message));
  await page.goto(FILE + (process.argv.includes('--debug') ? '#debug' : ''));
  await page.waitForTimeout(300);

  const shot = async n => page.screenshot({ path: path.join(SHOTS, n + '.png') });
  const checkLayout = async where => {
    const r = await page.evaluate(() => {
      const out = { overflow: document.documentElement.scrollWidth > innerWidth + 1, small: [] };
      document.querySelectorAll('button, input, select, label.btn').forEach(b => {
        const s = b.getBoundingClientRect();
        if (!s.width || !s.height || getComputedStyle(b).visibility === 'hidden') return;
        if (b.closest('.sheet-back')) return;
        if (Math.min(s.width, s.height) < 44) out.small.push((b.className || b.tagName) + ' ' + (b.getAttribute('aria-label') || b.textContent.trim().slice(0, 20)) + ` ${Math.round(s.width)}x${Math.round(s.height)}`);
      });
      return out;
    });
    if (r.overflow) note(`${where}: horizontal overflow`);
    if (r.small.length) note(`${where}: small targets: ${[...new Set(r.small)].join(' | ')}`);
  };
  const tap = async sel => { await page.locator(sel).first().click({ timeout: 5000, force: true }); };
  const state = () => page.evaluate(() => ({ screen: currentScreen, task: Run && Run.tasks[Run.idx], idx: Run && Run.idx, n: Run && Run.tasks.length, level: Run && Run.level.id }));

  // ---------- start + onboarding ----------
  await shot('01-start'); await checkLayout('start');
  await tap('[data-go]');
  await shot('02-onb1'); await checkLayout('onb1');
  await page.fill('.namein', 'Mia'); await tap('[data-n]');
  await tap('.avbtn[data-i="2"]'); await shot('03-onb2'); await checkLayout('onb2');
  await tap('[data-n]');
  await shot('04-onb3');
  await tap('[data-n]');

  let missDone = false, shotKinds = new Set();
  async function playLevel() {
    let guard = 0;
    while (guard++ < 200) {
      const st = await state();
      if (st.screen !== 'level') return st.screen;
      const t = st.task;
      await page.waitForTimeout(150);
      if (!shotKinds.has(t.k)) { shotKinds.add(t.k); await shot(`k-${t.k}-${st.level}`); await checkLayout('task ' + t.k); }
      const before = st.idx;
      switch (t.k) {
        case 'intro': case 'card': await tap('.foot .btn'); break;
        case 'catch': case 'listen':
          if (!missDone && t.k === 'catch' && st.level === 'u1l1' && st.idx > 5) {
            missDone = true; // exercise adaptive help: 4 misses -> demo
            for (let i = 0; i < 4; i++) {
              const wrong = page.locator(`.opt:not(.gone):not([data-id="${t.w}"])`);
              if (await wrong.count() === 0) break;
              await wrong.first().click(); await page.waitForTimeout(700);
            }
            await shot('help-demo'); await page.waitForTimeout(3500);
            break;
          }
          await tap(`.opt[data-id="${t.w}"]`); await page.waitForTimeout(1300); break;
        case 'spell': {
          const word = await page.evaluate(id => W(id).en, t.w);
          if ((t.mode || 'tiles') === 'tiles') {
            for (const c of word) { await page.locator(`.tile:not(.used)`, { hasText: c }).first().click(); }
          } else {
            const pre = t.mode === 'first' ? word[0] : '';
            // type with one swapped letter to exercise near-miss acceptance
            const rest = word.slice(pre.length);
            const typed = rest.length > 3 ? rest.slice(0, -2) + rest.slice(-1) + rest.slice(-2, -1) : rest;
            await page.fill('.typebox input', typed);
            await tap('.foot .btn');
          }
          await page.waitForTimeout(2300); break;
        }
        case 'speak': await tap('[data-r="super"]'); await page.waitForTimeout(1000); break;
        case 'memory': {
          const cards = await page.evaluate(() => [...document.querySelectorAll('.mcard')].length);
          const ids = await page.evaluate(() => { const t = Run.tasks[Run.idx]; return t.words; });
          // find pairs by reading data from DOM after flips: cheat via evaluate of card faces
          const map = await page.evaluate(() => [...document.querySelectorAll('.mcard')].map(b => b.querySelector('.f').textContent.trim() || 'pic:' + b.querySelector('.f').innerHTML.length));
          // simpler: flip each card pair using internal order
          const order = await page.evaluate(() => {
            const btns = [...document.querySelectorAll('.mcard')];
            return Run.tasks[Run.idx].words.slice(0, 6).map(id => [btns.findIndex(b => b.dataset.id === id && b.dataset.ty === 'w'), btns.findIndex(b => b.dataset.id === id && b.dataset.ty === 'p')]);
          });
          // one deliberate mismatch first
          await page.locator('.mcard').nth(order[0][0]).click(); await page.locator('.mcard').nth(order[1][1]).click(); await page.waitForTimeout(1200);
          for (const [a, b] of order) { await page.locator('.mcard').nth(a).click(); await page.locator('.mcard').nth(b).click(); await page.waitForTimeout(250); }
          await page.waitForTimeout(1500); break;
        }
        case 'dialogue': {
          let g = 0;
          while (g++ < 60) {
            const s2 = await state(); if (s2.idx !== before || s2.screen !== 'level') break;
            const ok = await page.evaluate(() => {
              const d = CONTENT.dialogues[Run.tasks[Run.idx].id];
              const btns = [...document.querySelectorAll('.foot .choices [data-k]')];
              if (!btns.length) return null;
              if (!btns[0].hasAttribute('lang')) return '[data-k="0"]';
              const node = d.nodes.find(n => n.ask && btns.length && n.ask && document.querySelector('.foot .story') && document.querySelector('.foot .story').textContent === n.ask.replace(/\[\[|\]\]/g, ''));
              const k = node ? node.options.findIndex(o => o.ok) : 0;
              return `.foot [data-k="${k}"]`;
            });
            if (ok) { await page.locator(ok).first().click(); if (!shotKinds.has('dlg2')) { shotKinds.add('dlg2'); await page.waitForTimeout(300); await shot('k-dialogue-mid'); } }
            await page.waitForTimeout(600);
          }
          break;
        }
        case 'build': {
          const parts = await page.evaluate(() => Run.tasks[Run.idx].parts.map(sub));
          for (const p of parts) await page.locator('.tiles .tile:not(.used)', { hasText: p }).filter({ hasText: new RegExp('^' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }).first().click();
          await page.waitForTimeout(300); await shot('build-done-' + st.idx); await tap('.foot .btn'); break;
        }
        case 'predict':
          await tap(`.popts [data-k="${t.answer}"]`); await page.waitForTimeout(300); await tap('.foot .btn'); break;
        case 'bug':
          await tap(`.tok[data-i="${t.bug}"]`);
          await page.locator(`[data-o]`).filter({ hasText: await page.evaluate(f => sub(f), t.fix) }).first().click();
          await page.waitForTimeout(300); await tap('.foot .btn'); break;
        case 'falling': {
          let g = 0;
          while (g++ < 20) {
            const s2 = await state(); if (s2.idx !== before || s2.screen !== 'level') break;
            await page.evaluate(() => { const id = document.querySelector('.tp').dataset.id; const d = document.querySelector(`.drop[data-id="${id}"]`); if (d) d.click(); });
            await page.waitForTimeout(1100);
          }
          break;
        }
        default: note('unknown kind ' + t.k);
      }
      await page.waitForTimeout(250);
    }
    note('level loop guard hit');
  }

  async function finishResult(name) {
    await page.waitForTimeout(400);
    if (await page.evaluate(() => currentScreen) !== 'result') { note('expected result screen after ' + name); return; }
    await shot('res-' + name); await checkLayout('result');
    if (await page.locator('[data-gift]').count()) { await tap('[data-gift]'); await page.waitForTimeout(1500); await shot('res-open-' + name); }
    await tap('[data-next]');
  }

  // first level started from onboarding
  let s = await playLevel(); await finishResult('u1l1');
  const order = ['u1l2', 'u1l3', 'u1l4', 'u1l5', 'u1l6', 'u1l7', 'u1boss', 'u1secret'];
  for (const id of order) {
    await page.waitForTimeout(300);
    if (id === 'u1l2') { await shot('map-after-l1'); await checkLayout('map'); }
    await page.evaluate(i => document.querySelector(`.node[data-l="${i}"]`).scrollIntoView({block:"center"}), id);
    await tap(`.node[data-l="${id}"]`);
    await page.waitForTimeout(300);
    if (id === 'u1l2') await shot('sheet');
    await tap('[data-start]');
    s = await playLevel();
    await finishResult(id);
  }
  await shot('map-end');
  const summary = await page.evaluate(() => ({ levels: S.levels, coins: S.coins, xp: S.xp, owned: S.owned, badges: S.badges, words: Object.keys(S.words).length, stage: monsterStage('u1'), resume: S.resume }));
  console.log('SUMMARY', JSON.stringify(summary));
  if (Object.keys(summary.levels).length !== 9) note('not all levels done');

  // other screens
  for (const sc of ['album', 'shop', 'room', 'settings']) { await page.evaluate(n => go(n), sc); await page.waitForTimeout(250); await shot('scr-' + sc); await checkLayout(sc); }
  await page.evaluate(() => go('album', 'w')); await shot('scr-album-words'); await checkLayout('album words');
  await page.evaluate(() => go('album', 'st')); await shot('scr-album-st');
  // review challenge
  await page.evaluate(() => { learnedIds().forEach(id => { S.words[id].due = today(); }); go('map'); });
  await page.waitForTimeout(200); await shot('map-review');
  await tap('[data-review]'); await playLevel(); await finishResult('review');
  const boxes = await page.evaluate(() => learnedIds().map(id => S.words[id].box));
  console.log('boxes after review', boxes.join(','));
  // turbo
  await page.evaluate(() => { S.settings.turbo = true; go('map'); });
  await tap('[data-turbo]');
  for (let i = 0; i < 6; i++) { const t = (await state()).task; if (t) await page.locator(`.opt[data-id="${t.w}"]`).first().click().catch(() => {}); await page.waitForTimeout(1300); }
  await page.evaluate(() => { Run.endAt = Date.now(); });
  await page.waitForTimeout(800); await shot('turbo-result'); await tap('[data-next]');
  // parent gate: hold gear
  const gear = page.locator('[data-parent]');
  const box = await gear.boundingBox();
  await page.mouse.move(box.x + 20, box.y + 20); await page.mouse.down(); await page.waitForTimeout(1600); await page.mouse.up();
  await page.waitForTimeout(300); await shot('pin');
  for (const d of '12341234') await tap(`[data-k="${d}"]`).then(() => page.waitForTimeout(80));
  await page.waitForTimeout(400); await shot('parent'); await checkLayout('parent');
  if (await page.evaluate(() => currentScreen) !== 'parent') note('parent panel not reached');
  // themes
  for (const th of ['umbreon', 'mew']) { await page.evaluate(t => { S.settings.theme = t; applyLook(); go('map'); }, th); await page.waitForTimeout(200); await shot('theme-' + th); }
  // landscape + level
  await page.setViewportSize({ width: 740, height: 360 });
  await page.evaluate(() => startLevel('u1l3')); await page.waitForTimeout(400);
  await tap('.foot .btn'); await tap('.foot .btn'); await tap('.foot .btn'); await tap('.foot .btn'); await tap('.foot .btn');
  await page.waitForTimeout(300); await shot('landscape-memory'); await checkLayout('landscape memory');
  await browser.close();
  console.log('\nPROBLEMS:', problems.length); problems.forEach(p => console.log(' -', p));
})().catch(e => { console.error('TEST CRASH', e); process.exit(1); });
