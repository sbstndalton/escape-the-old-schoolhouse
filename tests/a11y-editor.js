// Accessibility tests for the teacher editor (editor.html). Run with `npm test`, or `node tests/a11y-editor.js`.
//   A11Y_AUDIT=1   list every finding and keep going (used for the before/after audit) instead of failing
//   A11Y_SHOTS=dir also save a screenshot of every state there
// What is checked: axe-core (WCAG 2.0/2.1/2.2 A and AA plus best practices) on every page, tab and overlay at
// 1440×900 and 390×844, in the default look, High contrast, Readable text, forced colours and prefers-contrast;
// contrast measured from the rendered pixels (textures and lamplight included); a keyboard-only authoring run;
// focus visible and not obscured; target sizes; 200% text; 320px reflow; text spacing; the accessibility tree.
const playwright = require("playwright");
const engine = playwright[process.env.BROWSER || "chromium"];
const assert = require("assert/strict");
const fs = require("fs");
const path = require("path");
const { start } = require("../scripts/serve.js");

const AXE = path.join(path.dirname(require.resolve("axe-core")), "axe.min.js");
const AUDIT = !!process.env.A11Y_AUDIT;
const SHOTS = process.env.A11Y_SHOTS || "";
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const DESKTOP = { width: 1440, height: 900 }, PHONE = { width: 390, height: 844 };
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

// Tests are queued, then run a few at a time (each in its own browser context), because there are many screens to scan.
let passed = 0, failed = 0;
const queue = [];
function test(name, fn) { queue.push({ name, fn }); }
async function runAll() {
  const workers = Math.max(1, Math.min(+process.env.A11Y_JOBS || 4, require("os").cpus().length, queue.length));
  let next = 0;
  await Promise.all(Array.from({ length: workers }, async () => {
    while (next < queue.length) {
      const { name, fn } = queue[next++], lines = [];
      try { await fn(l => lines.push("      " + l)); passed++; console.log([`  ✔ ${name}`, ...lines].join("\n")); }
      catch (e) { failed++; console.log([`  ✘ ${name}`, ...lines, "      " + String(e.stack || e).split("\n").slice(0, 14).join("\n      ")].join("\n")); }
    }
  }));
}
// In audit mode problems are collected and printed; otherwise the first list of problems fails the test.
const audit = {};
function report(kind, problems) {
  if (!problems.length) return;
  if (!AUDIT) assert.fail(`${kind}: ${problems.length} problem(s)\n      ` + problems.slice(0, 12).join("\n      "));
  (audit[kind] = audit[kind] || []).push(...problems);
}

async function open(browser, base, viewport, opts = {}) {
  const { ask, ...ctxOpts } = opts;
  const ctx = await browser.newContext({ viewport, acceptDownloads: true, ...ctxOpts });
  if (!ask) await ctx.addInitScript(require("./skip-ask.js"));      // the first-visit prompt has its own states (opts.ask: see it)
  const page = await ctx.newPage();
  page.errors = [];
  page.on("pageerror", e => page.errors.push(e.message));
  page.on("dialog", d => { page.errors.push("native dialog: " + d.message()); d.accept(); });
  await page.goto(base + "/editor.html?mode=advanced");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.evaluate(() => document.fonts.ready);
  return page;
}
// Wait until the page is still: the cabinet's delayed refresh is done now, and running animations have finished.
const settle = page => page.evaluate(() => { if (typeof refreshStatus === "function") { clearTimeout(refreshStatus.t); renderNav(); refreshNote(); } return Promise.all(document.getAnimations().map(a => a.finished.catch(() => {}))).then(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); });
const isPhone = page => page.evaluate(() => getComputedStyle(document.getElementById("cabinet-handle")).display !== "none");   // the cabinet is a slide-out drawer
async function drawer(page, text) {          // open a drawer of the cabinet (through the brass handle on a phone)
  if ((await isPhone(page)) && !(await page.evaluate(() => document.body.classList.contains("cab-open")))) await page.click("#cabinet-handle");
  await page.click(`#nav .item:has-text("${text}") .pull`);
  await settle(page);
}
async function escapeAll(page) {
  for (let i = 0; i < 4; i++) { if (!(await page.locator(".overlay, .preview, .modal, #a11y-ask, body.cab-open, #tools.open, #add-menu").count())) break; await page.keyboard.press("Escape"); await settle(page); }
}

/* Every page, tab and overlay of the editor, one after another. `visit(name)` is called in each state. */
async function eachState(page, visit, only) {
  const phone = await isPhone(page);
  const go = async (name, setup, cleanup) => {
    if (only && !only.test(name)) return;
    await setup(); await settle(page); await visit(name);
    if (cleanup) await cleanup(); else await escapeAll(page);
    await settle(page);
  };
  const tabs = async prefix => {
    const ids = await page.$$eval("[role=tab]", els => els.map(e => e.id));
    if (!ids.length) return go(prefix, async () => {});
    for (const id of ids) await go(`${prefix} / ${id.replace("tab-", "")}`, () => page.click("#" + id));
  };
  // The sample has no question room, so one is added for the scan (the 6th drawer).
  await page.evaluate(() => { if (cfg.rooms.some(r => r.type === "quiz")) return; const q = TYPES.quiz.blank(); q.title = "The Strongbox"; q.story = "Answer every slip to open the box.";
    q.questions = [{ prompt: "Who wrote Democracy and Education?", kind: "short", answers: "John Dewey | Dewey", choices: ["", "", "", ""], correct: 0, source: "", verified: false },
      { prompt: "Which philosophy is built around the Great Books?", kind: "choice", answers: "", choices: ["Essentialism", "Perennialism", "Existentialism"], correct: 1, source: "", verified: false }];
    cfg.rooms.push(q); changed(); render(); });
  await drawer(page, "Settings"); await tabs("settings");
  await drawer(page, "Story & intro"); await tabs("intro");
  for (let r = 1; r <= 6; r++) { await drawer(page, r + "."); await tabs("room " + r); }
  await drawer(page, "6."); await page.click("#tab-items");
  await go("room 6 / questions as text", () => page.click("text=Edit all questions as text"), () => page.click("text=Back to form view"));
  await go("room 6 / typed answer turned into choices", async () => { await page.locator(".entry").first().locator("text=Multiple choice").click(); },
    async () => { await page.locator(".entry").first().locator("text=Typed answer").click(); });
  await drawer(page, "1."); await page.click("#tab-items");
  await go("room 1 / envelope open, note unfolded", async () => { await page.click("#answer-key summary"); await page.click("#draft-note"); },
    async () => { await page.click("#answer-key summary"); await page.click("#draft-note"); });
  await go("room 1 / help slip open", async () => { await page.locator("main .i").first().focus(); }, async () => { await page.keyboard.press("Escape"); await page.evaluate(() => document.activeElement.blur()); });
  await page.click("#tab-hints");
  await go("room 1 / hints on", () => page.click("label.switch:has(#hints-toggle)"), () => page.click("label.switch:has(#hints-toggle)"));
  await drawer(page, "Finish & grading"); await tabs("finish");
  await page.click("#tab-grading");
  await go("finish / accuracy grading", () => page.click("text=Accuracy: points off"), () => page.click("text=Completion: 100%"));
  if (await page.locator("#nav .item:has-text('Accessibility check')").count()) { await drawer(page, "Accessibility check"); await tabs("accessibility check"); }
  // things that open from the cabinet and the top rail
  const cab = async () => { if (phone && !(await page.evaluate(() => document.body.classList.contains("cab-open")))) await page.click("#cabinet-handle"); };
  if (phone) await go("phone / cabinet open", cab);
  await go("cabinet / add a room list", async () => { await cab(); await page.click("#add-room"); }, async () => { await page.click("#add-room"); await escapeAll(page); });
  if (await page.locator("#display-toggles, #btn-view").count()) await go("cabinet / display switches", cab);
  if (await page.locator("#a11y-options").count()) await go("dialog / accessibility options", async () => { await cab(); await page.click("#a11y-options"); await page.locator("#a11y-ask").waitFor(); });
  const tool = async id => { if (phone) await page.click("#btn-more"); await page.click(id); };
  if (phone) await go("phone / file list open", () => page.click("#btn-more"));
  await go("overlay / new", () => tool("#btn-new"));
  await go("overlay / export", () => page.click("#btn-export"));
  if (await page.evaluate(() => typeof makeClassLink === "function")) await go("overlay / export, class link copied", async () => { await page.click("#btn-export"); await page.click("#export-link");
    for (let i = 0; i < 3 && !(await page.isVisible("#export-link-text")); i++) { await page.locator(".modal #ask-ok, #export-link-text").first().waitFor(); if (await page.isVisible(".modal #ask-ok")) await page.click(".modal #ask-ok"); }
    await page.locator("#export-link-text").waitFor(); });
  await go("overlay / answer sheet", async () => { await tool("#btn-review"); await page.frameLocator(".overlay iframe").locator("h1").waitFor(); });
  await go("overlay / preview rail", async () => { await page.click("#btn-preview"); await page.frameLocator(".preview iframe").locator("#begin").waitFor(); });
  // the student view itself, in a matching room with the teacher's answer strip on (its frame is scanned as well)
  await go("overlay / preview, room 1 with answers shown", async () => { await page.click("#btn-preview"); const f = page.frameLocator(".preview iframe"); await f.locator("#begin").waitFor();
    await page.click(".pbar button[data-room='1']"); await f.locator("#stage h2:has-text('Room 1')").waitFor(); await page.click("label.switch:has(#preview-answers)"); await f.locator("#teacher-key").waitFor(); });
  if (await page.evaluate(() => typeof ask === "function")) {
    await drawer(page, "1."); await page.click("#tab-items");
    await go("dialog / delete a card", () => page.click("[aria-label='Delete Card 1']"));
    await go("dialog / export unchecked", async () => { await page.click("#btn-export"); await page.click("#export-html"); });
    await go("dialog / delete a room", async () => { await cab(); await page.click("[aria-label^='Delete room 5']"); });
    await go("overlay / problems to fix", async () => {
      await page.evaluate(() => { window.__keep = JSON.stringify(cfg); cfg.rooms[5].questions[0].answers = ""; render(); });
      await page.click("#btn-preview");
    }, async () => { await escapeAll(page); await page.evaluate(() => { cfg = JSON.parse(window.__keep); changed(); render(); }); });
  }
  if (await page.evaluate(() => typeof renderWizard === "function")) await wizardStates(page, go, phone);
  await page.evaluate(() => { location.hash = "#advanced"; });
  await page.waitForFunction(() => document.documentElement.dataset.mode === "advanced");
}
/* The guided steps: every step and its variants (errors, choices revealed, the password slip), then the hub. */
async function wizardStates(page, go, phone){
  const to = async (hash, setup) => {
    if (setup) await page.evaluate(setup);
    await page.evaluate(h => { location.hash = h; }, hash);
    await page.waitForFunction(h => location.hash === h && document.documentElement.dataset.mode === "wizard" && document.getElementById("wiz-h1"), hash);
    await settle(page);
  };
  const stay = async () => {};
  const err = async () => { await page.click("#wiz-continue"); await page.locator("#wiz-errors, #wiz-warn").first().waitFor(); };
  await go("wizard / 1 welcome", () => to("#step=welcome"), stay);
  await go("wizard / accessibility options (asked first on a first visit)", async () => { await to("#step=welcome&a=1"); await page.click("#wiz-a11y"); await page.locator("#a11y-ask").waitFor(); });
  await go("wizard / 1 welcome, help open", async () => { await to("#step=welcome&h=1"); await page.click("#wiz-help summary"); }, stay);
  if (phone) await go("wizard / steps list open", async () => { await to("#step=name&s=1"); await page.click("#wiz-steps summary"); }, async () => { await page.click("#wiz-steps summary"); });
  await go("wizard / 2 start", () => to("#step=start", "WIZ.start = null"), stay);
  await go("wizard / 2 start, nothing chosen: error", async () => { await to("#step=start&e=1", "WIZ.start = null"); await err(); }, stay);
  await go("wizard / 2 start, open a saved file", async () => { await to("#step=start&f=1"); await page.click("label[for=start-file]"); }, async () => { await page.evaluate(() => { WIZ.start = null; }); });
  await go("wizard / 3 name", () => to("#step=name"), stay);
  await go("wizard / 3 name, empty: error", async () => { await to("#step=name&e=1", "window.__t = cfg.meta.title"); await page.fill("#wiz-title", ""); await err(); },
    async () => { await page.evaluate(() => { cfg.meta.title = window.__t; changed(); }); });
  await go("wizard / 4 rooms", () => to("#step=rooms"), stay);
  await go("wizard / 4 add a room", () => to("#step=add", "WIZ.kind = null"), stay);
  await go("wizard / 4 add a room, nothing chosen: error", async () => { await to("#step=add&e=1", "WIZ.kind = null"); await err(); }, stay);
  await go("wizard / 5 matching: cards", () => to("#step=room&room=1&part=cards"), stay);
  await go("wizard / 5 matching: clues", () => to("#step=room&room=1&part=clues"), stay);
  await go("wizard / 5 matching: clues, one missing: error", async () => { await to("#step=room&room=1&part=clues&e=1", "window.__c = cfg.rooms[0].cards[0].clue; cfg.rooms[0].cards[0].clue = ''; cfg.rooms[0].cards[0].decoy = false"); await err(); },
    async () => { await page.evaluate(() => { cfg.rooms[0].cards[0].clue = window.__c; delete cfg.rooms[0].cards[0].decoy; changed(); }); });
  await go("wizard / 5 room story", () => to("#step=room&room=1&part=story"), stay);
  await go("wizard / 5 timeline room: Advanced mode", () => to("#step=room&room=3&part=advanced"), stay);
  await go("wizard / 5 quiz questions", () => to("#step=room&room=6&part=questions"), stay);
  await go("wizard / 5 quiz questions, one empty: error", async () => { await to("#step=room&room=6&part=questions&e=1", "cfg.rooms[5].questions.push(blankQuestion())"); await err(); },
    async () => { await page.evaluate(() => { cfg.rooms[5].questions.pop(); changed(); }); });
  await go("wizard / 6 check your facts", () => to("#step=facts"), stay);
  await go("wizard / 6 check your facts, not all checked: note", async () => { await to("#step=facts&e=1"); await err(); }, stay);
  await go("wizard / 7 try it", () => to("#step=try"), stay);
  await go("wizard / 7 try it, problems listed", async () => { await to("#step=try&e=1", "window.__a = cfg.rooms[5].questions[0].answers; cfg.rooms[5].questions[0].answers = ''"); await page.click("#wiz-try"); await page.locator("#wiz-errors").waitFor(); },
    async () => { await page.evaluate(() => { cfg.rooms[5].questions[0].answers = window.__a; changed(); }); });
  await go("wizard / 8 how students get it, Moodle chosen", () => to("#step=deliver", "meta.delivery = { where: 'moodle' }"), stay);
  await go("wizard / 8 how students get it, nothing chosen: error", async () => { await to("#step=deliver&e=1", "meta.delivery = {}"); await err(); }, stay);
  for (const [route, d] of [["moodle-scorm", "{ where: 'moodle', how: 'scorm' }"], ["moodle-quiz", "{ where: 'moodle', how: 'quiz' }"], ["canvas-scorm", "{ where: 'canvas', how: 'scorm' }"],
    ["canvas-quiz", "{ where: 'canvas', how: 'quiz' }"], ["other", "{ where: 'other' }"], ["file", "{ where: 'file' }"]])
    await go(`wizard / 9 walkthrough: ${route}`, async () => { await to(`#step=walk&r=${route}`, `meta.delivery = ${d}`); if (route === "canvas-quiz") await page.click("details.wtrouble summary"); }, stay);
  await go("wizard / 8 how students get it, class link chosen", () => to("#step=deliver&l=1", "meta.delivery = { where: 'link' }"), stay);
  await go("wizard / 9 walkthrough: class link, before it is made", () => to("#step=walk&r=link0", "meta.delivery = { where: 'link' }; delete meta.link"), stay);
  await go("wizard / 9 walkthrough: class link made (too long for a QR code)", async () => { await to("#step=walk&r=link1", "meta.delivery = { where: 'link' }; delete meta.link");
    await page.click("#wiz-make-link"); for (let i = 0; i < 3 && !(await page.isVisible("#wiz-link")); i++) { await page.locator(".modal #ask-ok, #wiz-link").first().waitFor(); if (await page.isVisible(".modal #ask-ok")) await page.click(".modal #ask-ok"); }
    await page.locator("#wiz-link").waitFor(); await settle(page); }, stay);
  await go("wizard / 9 walkthrough: class link with a QR code, and out of date", async () => {
    await to("#step=walk&r=link2", "meta.delivery = { where: 'link' }; meta.link = { url: location.href.split('#')[0].replace(/editor\\.html.*/, 'play.html') + '#play=1.' + 'A'.repeat(300), rev: meta.rev, at: Date.now() }");
    await page.locator("#wiz-qr svg").waitFor();
    await page.evaluate(() => { meta.link.rev = -1; renderWizard(); }); }, stay);
  await go("wizard / 2 start, a cut-off class link: error", async () => { await to("#step=start&lk=1"); await page.click("label[for=start-file]");
    await page.fill("#wiz-link-paste", "https://example.org/play.html#play=1.abcdefghijkl"); await page.click("#wiz-continue"); await page.locator("#wiz-errors").waitFor(); },
    async () => { await page.evaluate(() => { WIZ.start = null; WIZ.linkText = ""; }); });
  await go("wizard / 9 the exit password slip", async () => { await to("#step=walk&r=pw", "meta.delivery = { where: 'file' }; cfg.finish.exitPassword = ''"); await page.click("#wiz-download"); await page.locator("#ask-password").waitFor(); },
    async () => { await escapeAll(page); await page.evaluate(() => { cfg.finish.exitPassword = "DEWEY1916"; changed(); }); });
  await go("wizard / 9 the exit password slip, empty: error", async () => { await to("#step=walk&r=pw2", "cfg.finish.exitPassword = ''"); await page.click("#wiz-download"); await page.locator("#ask-password").waitFor(); await page.fill("#ask-password", ""); await page.click("#ask-ok"); },
    async () => { await escapeAll(page); await page.evaluate(() => { cfg.finish.exitPassword = "DEWEY1916"; changed(); }); });
  await go("wizard / 9 change the exit password", () => to("#step=password&from=done"), stay);
  await go("wizard / 9 change the exit password, empty: error", async () => { await to("#step=password&from=done&e=1"); await page.fill("#wiz-pw", ""); await err(); },
    async () => { await page.evaluate(() => { WIZ.pw = null; }); });
  await go("wizard / 9 change the exit password, saved: what to do now", async () => {
    await to("#step=password&part=saved&from=done", "meta.pwOld = 'OLDPASS1'; meta.pwAt = Date.now(); meta.link = { url: 'x', rev: meta.rev, at: Date.now() }"); },
    async () => { await page.evaluate(() => { delete meta.pwOld; delete meta.link; saveMeta(); }); });
  await go("wizard / 10 done", () => to("#step=done"), stay);
  await go("wizard / 10 done, the teacher card", async () => { await to("#step=done&card=1"); await page.click("#wiz-card"); await page.frameLocator(".overlay iframe").locator("h1").waitFor(); }, async () => { await escapeAll(page); });
  await go("wizard / hub, two escape rooms", async () => {
    await to("#step=hub", "saveNow(); const id = newId(); lsSet(keyOf(id), JSON.stringify(SAMPLE)); lib.list.push({ id, title: 'Chapter 4', created: Date.now(), updated: Date.now() - 86400000 }); writeLib()"); }, stay);
  await go("wizard / hub, remove slip", async () => { await to("#step=hub&d=1"); await page.click("#wiz-lib [id^=lib-remove-]"); await page.locator(".modal").waitFor(); }, async () => { await escapeAll(page); });
}

/* ---------- axe ---------- */
async function axe(page, name) {
  if (!(await page.evaluate(() => !!window.axe))) await page.addScriptTag({ path: AXE });
  const run = tags => window.axe.run(document, { runOnly: tags, iframes: false, resultTypes: ["violations", "incomplete"] });
  const results = [[name, await page.evaluate(run, TAGS), false]];
  // Every frame is a document of its own, so each is scanned as one: the answer sheet and the teacher card in their folders, and the student
  // view in the preview (with whatever the teacher has switched on, such as the answer strip).
  for (const sel of [".overlay iframe", ".preview iframe"]) {
    const el = await page.$(sel); if (!el) continue;
    const frame = await el.contentFrame(); if (!(await frame.evaluate(() => !!window.axe))) await frame.addScriptTag({ path: AXE });
    results.push([name + (sel.startsWith(".overlay") ? " (the sheet itself)" : " (the student view inside the preview)"), await frame.evaluate(run, TAGS), true]);
  }
  const short = n => (n.target || []).flat().join(" ").slice(0, 90);
  // What is left out of "needs review", and why (ACCESSIBILITY.md says the same):
  // - color-contrast: axe can't work out text over a gradient or texture; those nodes are counted here, and their
  //   contrast is measured from the pixels by pixelContrast() below instead (the student view by tests/a11y-game.js);
  // - frame-tested: only says axe didn't enter a frame from the page around it; every frame is scanned on its own above;
  // - heading-order inside a frame: axe can't see the headings of the page around the frame.
  const skipped = { "color-contrast": 0 };
  const keep = (v, inFrame) => { if (v.id === "color-contrast") { skipped["color-contrast"] += v.nodes.length; return false; } return v.id !== "frame-tested" && !(inFrame && v.id === "heading-order"); };
  return {
    violations: results.flatMap(([where, res]) => res.violations.flatMap(v => v.nodes.map(n => `${where}: ${v.id} (${v.impact}) ${short(n)}`))),
    incomplete: results.flatMap(([where, res, inFrame]) => res.incomplete.filter(v => keep(v, inFrame)).flatMap(v => v.nodes.map(n => `${where}: ${v.id} needs review: ${short(n)}`))),
    contrastByPixels: skipped["color-contrast"]
  };
}

// A screenshot's pixels, read with nothing but zlib (8-bit RGB or RGBA, not interlaced: what the browsers write).
const LIN = Float64Array.from({ length: 256 }, (_, v) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); });
function decodePng(buf) {
  let pos = 8, width = 0, height = 0, type = 0; const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), kind = buf.toString("latin1", pos + 4, pos + 8), body = buf.subarray(pos + 8, pos + 8 + len);
    if (kind === "IHDR") { width = body.readUInt32BE(0); height = body.readUInt32BE(4); type = body[9]; assert.equal(body[8], 8); assert.equal(body[12], 0); assert.ok(type === 2 || type === 6); }
    if (kind === "IDAT") idat.push(body);
    pos += 12 + len;
  }
  const raw = require("zlib").inflateSync(Buffer.concat(idat)), bpp = type === 6 ? 4 : 3, stride = width * bpp;
  const data = new Uint8Array(width * height * 4), line = new Uint8Array(stride), prev = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)], at = y * (stride + 1) + 1;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? line[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0, v = raw[at + x];
      let add = 0;
      if (f === 1) add = a; else if (f === 2) add = b; else if (f === 3) add = (a + b) >> 1;
      else if (f === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); add = pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      line[x] = (v + add) & 255;
    }
    for (let x = 0, o = y * width * 4; x < width; x++, o += 4) { data[o] = line[x * bpp]; data[o + 1] = line[x * bpp + 1]; data[o + 2] = line[x * bpp + 2]; data[o + 3] = 255; }
    prev.set(line);
  }
  return { width, height, data };
}

/* ---------- contrast measured from what is actually painted ----------
   Two screenshots, one normal and one with every glyph and icon made transparent. Where they differ is ink; the
   contrast of the ink against what is behind it (textures, gradients, lamplight and vignette included) is read from
   the pixels. Small text needs 4.5:1, large text 3:1. */
async function pixelContrast(page, name) {
  const marks = await page.evaluate(() => {
    const out = [], seen = new Set();
    const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const root = document.querySelector(".modal") || document.querySelector(".preview") || document.querySelector(".overlay") || document.body;
    for (let n; (n = tw.nextNode());) {
      if (!n.nodeValue.trim()) continue;
      const el = n.parentElement; if (!el || seen.has(el) || !root.contains(el)) continue;
      if (el.closest("[aria-hidden=true],[inert],.sr,script,style,:disabled") && !el.closest(".mark")) continue;
      const cs = getComputedStyle(el); if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity === 0) continue;
      const range = document.createRange(); range.selectNodeContents(n);
      for (const r of range.getClientRects()) {
        if (r.width < 3 || r.height < 3 || r.top < 0 || r.bottom > innerHeight || r.left < 0 || r.right > innerWidth) continue;      // whole glyphs only
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const top = document.elementFromPoint(Math.min(innerWidth - 1, Math.max(0, cx)), Math.min(innerHeight - 1, Math.max(0, cy)));
        if (!top || !(el.contains(top) || top.contains(el))) continue;        // covered or scrolled out of its box
        seen.add(el);
        const px = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 700;
        out.push({ x: r.left, y: r.top, w: r.width, h: r.height, large: px >= 24 || (bold && px >= 18.66), text: n.nodeValue.trim().slice(0, 40),
          sel: el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).join(".") : "") });
        break;
      }
    }
    // values typed into fields
    for (const el of document.querySelectorAll("input[type=text],input[type=number],textarea")) {
      if (!root.contains(el) || el.closest("[inert]") || !/[\p{L}\p{N}]/u.test(el.value || el.placeholder)) continue;     // emoji and symbols paint in their own colours
      const r = el.getBoundingClientRect(); if (r.width < 3 || r.bottom <= 0 || r.top >= innerHeight) continue;
      const top = document.elementFromPoint(r.left + 6, r.top + r.height / 2); if (top !== el) continue;
      out.push({ x: r.left, y: r.top, w: r.width, h: Math.min(r.height, 40), large: false, text: (el.value ? "value: " + el.value : "placeholder: " + el.placeholder).slice(0, 40), sel: el.tagName.toLowerCase() });
    }
    return out;
  });
  // Chromium can be asked for a quickly-packed PNG, which matters with this many textured screenshots; other browsers use the usual route.
  if (engine === playwright.chromium && !page.__cdp) page.__cdp = await page.context().newCDPSession(page);
  const shot = async () => decodePng(page.__cdp ? Buffer.from((await page.__cdp.send("Page.captureScreenshot", { format: "png", optimizeForSpeed: true })).data, "base64")
    : await page.screenshot({ animations: "disabled", caret: "hide", scale: "css" }));
  const A = await shot();
  const style = await page.addStyleTag({ content: "*,*::before,*::after{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;text-decoration-color:transparent!important}::placeholder{color:transparent!important}" });
  const B = await shot();
  await style.evaluate(s => s.remove());
  const W = A.width, H = A.height;
  const lum = (d, i) => .2126 * LIN[d[i]] + .7152 * LIN[d[i + 1]] + .0722 * LIN[d[i + 2]];
  const results = marks.map(m => {
    const ratios = [];
    const x0 = Math.max(0, Math.floor(m.x)), x1 = Math.min(W, Math.ceil(m.x + m.w)), y0 = Math.max(0, Math.floor(m.y)), y1 = Math.min(H, Math.ceil(m.y + m.h));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = (y * W + x) * 4;
      if (Math.abs(A.data[i] - B.data[i]) + Math.abs(A.data[i + 1] - B.data[i + 1]) + Math.abs(A.data[i + 2] - B.data[i + 2]) < 24) continue;
      const la = lum(A.data, i), lb = lum(B.data, i);
      ratios.push((Math.max(la, lb) + .05) / (Math.min(la, lb) + .05));
    }
    if (ratios.length < 6) return { ...m, ratio: null };
    ratios.sort((p, q) => q - p);
    const top = ratios.slice(0, Math.max(3, Math.ceil(ratios.length * .12)));      // the solid middles of the strokes, not their soft edges
    return { ...m, ratio: top.reduce((s, v) => s + v, 0) / top.length };
  });
  const measured = results.filter(r => r.ratio != null);
  return {
    count: measured.length,
    min: measured.reduce((m, r) => Math.min(m, r.ratio), 99),
    below7: measured.filter(r => r.ratio < 7).length,
    aaa: measured.filter(r => r.ratio < 7 && !r.large).map(r => `${name}: under 7:1 (${r.ratio.toFixed(2)}:1) "${r.text}" ${r.sel.slice(0, 60)}`),
    fails: measured.filter(r => r.ratio < (r.large ? 3 : 4.5)).map(r => `${name}: contrast ${r.ratio.toFixed(2)}:1 "${r.text}" ${r.sel.slice(0, 60)}`)
  };
}

/* ---------- things measured in the page ---------- */
const VISIBLE = `(el => { const cs = getComputedStyle(el); const r = el.getBoundingClientRect(); return cs.visibility !== "hidden" && cs.display !== "none" && r.width > 0 && r.height > 0 && !el.closest("[inert]"); })`;
// Every focusable control: big enough to hit (24px, or 44px for fingers) and not covered by something else.
async function targets(page, name, min) {
  return page.evaluate(({ name, min, VISIBLE }) => {
    const vis = eval(VISIBLE), out = [];
    const root = document.querySelector(".modal") || document.querySelector(".preview") || document.querySelector(".overlay") || document.body;
    const box = el => {                         // a hidden radio or checkbox is operated through its label
      const r = el.getBoundingClientRect(); const l = el.closest("label");
      return (r.width < 6 || r.height < 6 || getComputedStyle(el).opacity === "0") && l ? l.getBoundingClientRect() : r;
    };
    for (const el of root.querySelectorAll("a[href],button,input:not([type=hidden]):not([type=file]),textarea,summary,[tabindex]:not([tabindex='-1'])")) {
      if (el.disabled || !vis(el.closest("label") || el) || el.classList.contains("skip")) continue;
      const r = box(el), label = (el.getAttribute("aria-label") || el.textContent || el.id || el.name || "").trim().slice(0, 40);
      if (r.width < min - .5 || r.height < min - .5) out.push(`${name}: target ${Math.round(r.width)}×${Math.round(r.height)} is under ${min}px: ${el.tagName.toLowerCase()} "${label}"`);
    }
    return out;
  }, { name, min, VISIBLE });
}
// Tab through the page: each stop must show a focus ring and must not sit under the top rail, the cabinet or a note.
async function focusWalk(page, name, limit = 400) {
  const problems = []; const seen = new Set();
  await page.evaluate(() => { document.activeElement && document.activeElement.blur(); window.scrollTo(0, 0); });
  for (let i = 0; i < limit; i++) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate(async () => {
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));        // let the browser finish scrolling the focus into view
      const el = document.activeElement; if (!el || el === document.body) return null;
      if (el.tagName === "IFRAME") return { key: "iframe", iframe: true };
      if (!el.__n) el.__n = ++window.__fc || (window.__fc = 1);
      const cs = getComputedStyle(el);
      // the ring may be drawn on the control itself or on the drawn piece next to a hidden radio or checkbox
      const ringOn = [el, el.nextElementSibling, ...(el.parentElement ? el.parentElement.querySelectorAll(":scope > span") : []), el.closest("label")].filter(Boolean);
      const ring = ringOn.some(x => { const s = getComputedStyle(x); return (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) >= 2); });
      let r = el.getBoundingClientRect(); const l = el.closest("label");
      if ((r.width < 6 || r.height < 6 || cs.opacity === "0") && l) r = l.getBoundingClientRect();
      const pts = [[r.left + r.width / 2, r.top + r.height / 2], [r.left + 3, r.top + 3], [r.right - 3, r.bottom - 3]];
      const inView = r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
      const hit = pts.map(([x, y]) => document.elementFromPoint(x, y)).filter(Boolean);
      const own = t => el.contains(t) || t.contains(el) || (l && l.contains(t)) || t.closest(".tip,.pop") != null;
      return { key: el.__n, ring, inView, covered: hit.length ? !hit.some(own) : true, by: hit[0] ? hit[0].tagName.toLowerCase() + "." + hit[0].className : "",
        label: (el.getAttribute("aria-label") || el.textContent || el.id || "").trim().slice(0, 40), tag: el.tagName.toLowerCase() };
    });
    if (!info) { if (seen.size) break; else continue; }
    if (seen.has(info.key)) break;
    seen.add(info.key);
    if (info.iframe) continue;
    if (!info.ring) problems.push(`${name}: no focus ring on ${info.tag} "${info.label}"`);
    if (!info.inView) problems.push(`${name}: focus is off screen on ${info.tag} "${info.label}"`);
    else if (info.covered) problems.push(`${name}: focus is covered by ${info.by} on ${info.tag} "${info.label}"`);
  }
  return { stops: seen.size, problems };
}
// Nothing may be cut off: no sideways scrolling of the page, and no text box whose words spill out of it.
async function clipping(page, name) {
  return page.evaluate(({ name, VISIBLE }) => {
    const vis = eval(VISIBLE), out = [];
    const de = document.documentElement;
    if (de.scrollWidth > de.clientWidth + 1) out.push(`${name}: the page scrolls sideways (${de.scrollWidth} > ${de.clientWidth})`);
    const main = document.getElementById("main");
    if (main && main.scrollWidth > main.clientWidth + 1) out.push(`${name}: the editing area scrolls sideways (${main.scrollWidth} > ${main.clientWidth})`);
    const root = document.querySelector(".modal") || document.querySelector(".preview") || document.querySelector(".overlay") || document.body;
    for (const el of root.querySelectorAll("button,label,h1,h2,h3,p,li,span,div,summary,textarea,legend")) {
      if (!vis(el) || el.closest(".sr,[aria-hidden=true]") || el.classList.contains("sr")) continue;
      const cs = getComputedStyle(el);
      if (cs.clipPath !== "none" || el.getBoundingClientRect().width <= 2) continue;        // deliberately hidden from sight, still read out
      const own = [...el.childNodes].some(n => n.nodeType === 3 && n.nodeValue.trim());
      if (!own && el.tagName !== "TEXTAREA") continue;
      const clipsX = cs.overflowX !== "visible", clipsY = cs.overflowY !== "visible";
      if ((clipsX && cs.overflowX !== "auto" && cs.overflowX !== "scroll" && el.scrollWidth > el.clientWidth + 2) || (clipsY && cs.overflowY !== "auto" && cs.overflowY !== "scroll" && el.scrollHeight > el.clientHeight + 2))
        out.push(`${name}: text is cut off in ${el.tagName.toLowerCase()}.${el.className} "${(el.value || el.textContent).trim().slice(0, 30)}"`);
      const r = el.getBoundingClientRect();
      if (r.right > innerWidth + 1 && r.left < innerWidth && !el.closest("nav")) { let p = el.parentElement, scroller = false; while (p && p !== document.body) { const o = getComputedStyle(p).overflowX; if ((o === "auto" || o === "scroll") && p.id !== "main") { scroller = true; break; } p = p.parentElement; } if (!scroller) out.push(`${name}: runs off the right edge: ${el.tagName.toLowerCase()}.${el.className} "${el.textContent.trim().slice(0, 30)}"`); }
    }
    return out;
  }, { name, VISIBLE });
}
// In forced colours and High contrast every control must keep an edge you can see (a border or outline, not a shadow).
async function edges(page, name) {
  return page.evaluate(({ name, VISIBLE }) => {
    const vis = eval(VISIBLE), out = [];
    const root = document.querySelector(".modal") || document.querySelector(".preview") || document.querySelector(".overlay") || document.body;
    const has = s => ["Top", "Right", "Bottom", "Left"].some(k => s["border" + k + "Style"] !== "none" && parseFloat(s["border" + k + "Width"]) >= 1 && !/rgba\(0, 0, 0, 0\)|transparent/.test(s["border" + k + "Color"]))
      || (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) >= 1) || s.textDecorationLine.includes("underline");
    const edged = el => has(getComputedStyle(el)) || ["::before", "::after"].some(ps => { const s = getComputedStyle(el, ps); return s.content !== "none" && s.display !== "none" && has(s); });
    for (const el of root.querySelectorAll("button,input:not([type=hidden]):not([type=file]),textarea,summary")) {
      if (!vis(el.closest("label") || el) || el.classList.contains("skip")) continue;
      const hiddenInput = el.matches("input,[role=checkbox],[role=radio],[role=switch]") && el.closest("label") && (getComputedStyle(el).opacity === "0" || el.classList.contains("sr"));
      const drawn = hiddenInput ? [...el.closest("label").querySelectorAll("span")] : [el, ...el.querySelectorAll(":scope > span")];
      if (!drawn.some(edged)) out.push(`${name}: no visible edge on ${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") || el.textContent || el.id || "").trim().slice(0, 40)}"`);
    }
    return out;
  }, { name, VISIBLE });
}
const SPACING = "*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important} p{margin-bottom:2em!important}";

(async () => {
  const server = await start(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await engine.launch();
  console.log("\nEditor accessibility tests\n");
  const only = process.env.A11Y_ONLY ? new RegExp(process.env.A11Y_ONLY, "i") : null;
  const variants = {
    "default": async () => {},
    "High contrast": async page => { await page.evaluate(() => { localStorage.setItem("escape-room-contrast", "on"); }); await page.reload(); },
    "Readable text": async page => { await page.evaluate(() => { localStorage.setItem("escape-room-readable", "on"); }); await page.reload(); },
    "forced colours": async page => { await page.emulateMedia({ forcedColors: "active" }); await page.reload(); },
    "prefers-contrast: more": async page => { await page.emulateMedia({ contrast: "more" }); await page.reload(); }
  };
  const CHROMIUM = engine === playwright.chromium;
  if (!CHROMIUM) delete variants["forced colours"];        // only Chromium has (and can emulate) forced colours
  const wanted = process.env.A11Y_VARIANTS ? process.env.A11Y_VARIANTS.split(",") : Object.keys(variants);

  for (const [vname, apply] of Object.entries(variants)) {
    if (!wanted.includes(vname)) continue;
    for (const [size, viewport] of [["1440×900", DESKTOP], ["390×844", PHONE]]) {
      test(`axe finds nothing on any page, tab or overlay: ${vname}, ${size}`, async log => {
        // (motion is switched off for the scans only, so nothing is caught half-way through a slide; the behaviour tests below run with motion)
        const page = await open(browser, base, viewport, { reducedMotion: "reduce", ...(size === "390×844" ? { hasTouch: true, isMobile: true } : {}) });
        await apply(page);
        if (!AUDIT && (vname === "High contrast" || vname === "prefers-contrast: more")) assert.equal(await page.evaluate(() => document.documentElement.dataset.contrast), "more");
        if (!AUDIT && vname === "Readable text") assert.equal(await page.evaluate(() => document.documentElement.dataset.readable), "on");
        const v = [], inc = [], px = [], tg = [], ed = []; let states = 0, texts = 0, min = 99, below7 = 0, byPixels = 0; const T = { axe: 0, px: 0, start: Date.now() };
        await eachState(page, async name => {
          states++;
          const tag = `[${vname}, ${size}] ${name}`;
          if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${vname}-${size}-${name}`.replace(/[^a-z0-9×]+/gi, "-") + ".png") });
          const t0 = Date.now(); const res = await axe(page, tag); v.push(...res.violations); inc.push(...res.incomplete); byPixels += res.contrastByPixels; T.axe += Date.now() - t0;
          const t1 = Date.now(); if (vname !== "forced colours") { const c = await pixelContrast(page, tag); T.px += Date.now() - t1; px.push(...c.fails); if (AUDIT) report("contrast under 7 to 1 (AAA, not required)", c.aaa); texts += c.count; min = Math.min(min, c.min); below7 += c.below7; }
          tg.push(...await targets(page, tag, size === "390×844" ? 44 : 24));
          if (vname !== "default" && vname !== "Readable text") ed.push(...await edges(page, tag));
        }, only);
        if (process.env.A11Y_TIME) log(`time: axe ${T.axe} ms, pixels ${T.px} ms, total ${Date.now() - T.start} ms`);
        log(`${states} states; axe violations ${v.length}; needs review ${inc.length} (plus ${byPixels} colour-contrast nodes axe left to the pixel measurement); text runs measured ${texts}, lowest contrast ${min.toFixed(2)}:1, under 7:1 ${below7}, failing ${px.length}; small targets ${tg.length}; edges ${ed.length}`);
        assert.deepEqual(page.errors, []);
        report("axe violations", v); report("axe needs review", inc); report("target size", tg); report("contrast (pixels)", px); report("visible edges", ed);
        await page.context().close();
      });
    }
  }

  for (const [size, viewport] of [["1440×900", DESKTOP], ["390×844", PHONE]]) {
    test(`every tab stop shows a focus ring and is never covered: ${size}`, async log => {
      const page = await open(browser, base, viewport);
      const problems = []; let stops = 0;
      await eachState(page, async name => { const r = await focusWalk(page, `[${size}] ${name}`); stops += r.stops; problems.push(...r.problems); }, only || /room 1 \/ items|room 6|room 4 \/ items|room 5 \/ questions|settings \/ about|finish \/ accuracy|accessibility check|overlay|dialog|phone|cabinet|wizard/);
      log(`${stops} tab stops checked`);
      report("focus", problems);
      await page.context().close();
    });
  }

  test("text at 200% (root font size and browser zoom) loses nothing and never scrolls sideways", async () => {
    const problems = [];
    // (1) the reader's own default text size doubled (a browser setting), (2) the browser zoomed to 200%
    const big = engine === playwright.chromium ? await engine.launch({ args: ["--blink-settings=defaultFontSize=32,defaultFixedFontSize=26"] }) : null;
    for (const mode of ["default font size 32px at 1280×900", "default font size 32px at 390×844", "zoom 200% (640×450)"]) {
      if (mode.startsWith("default") && !big) continue;
      const page = await open(mode.startsWith("default") ? big : browser, base, mode.includes("1280") ? { width: 1280, height: 900 } : mode.includes("390") ? PHONE : { width: 640, height: 450 });
      if (mode.startsWith("default")) assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize), "32px");
      await eachState(page, async name => { problems.push(...await clipping(page, `[${mode}] ${name}`)); if (SHOTS && /room 1 \/ items/.test(name)) await page.screenshot({ path: path.join(SHOTS, `text-200-${mode.slice(0, 4)}.png`) }); }, only);
      await page.context().close();
    }
    if (big) await big.close();
    report("200% text", problems);
  });

  test("reflows at 320px wide (400% zoom) with no sideways scrolling, even 256px tall", async () => {
    const problems = [];
    for (const viewport of [{ width: 320, height: 640 }, { width: 320, height: 256 }]) {
      const page = await open(browser, base, viewport);
      await eachState(page, async name => {
        const tag = `[${viewport.width}×${viewport.height}] ${name}`;
        problems.push(...await clipping(page, tag));
        if (SHOTS && /room 1 \/ items|cabinet open/.test(name)) await page.screenshot({ path: path.join(SHOTS, `reflow-${viewport.width}x${viewport.height}-${name.replace(/[^a-z0-9]+/gi, "-")}.png`) });
      }, only);
      if (viewport.height === 256) { const r = await focusWalk(page, "[320×256] settings"); problems.push(...r.problems); }
      await page.context().close();
    }
    report("320px reflow", problems);
  });

  test("the WCAG text-spacing override clips nothing", async () => {
    const problems = [];
    for (const viewport of [DESKTOP, PHONE]) {
      const page = await open(browser, base, viewport);
      await page.addStyleTag({ content: SPACING });
      await page.evaluate(() => typeof render === "function" && render());
      await eachState(page, async name => { problems.push(...await clipping(page, `[text spacing, ${viewport.width}] ${name}`)); if (SHOTS && /room 1 \/ items/.test(name)) await page.screenshot({ path: path.join(SHOTS, `text-spacing-${viewport.width}.png`) }); }, only);
      await page.context().close();
    }
    report("text spacing", problems);
  });

  /* ---------- behaviour: keyboard, dialogs, help slips, announcements, the accessibility tree ---------- */
  const active = page => page.evaluate(() => { const el = document.activeElement; return el ? { id: el.id, tag: el.tagName.toLowerCase(), label: el.getAttribute("aria-label") || "", text: (el.textContent || "").trim().slice(0, 60), cls: String(el.className) } : null; });
  const tabTo = async (page, selector, max = 400, key = "Tab") => {
    for (let i = 0; i < max; i++) { await page.keyboard.press(key); if (await page.evaluate(sel => !!document.activeElement && document.activeElement.matches(sel), selector)) return; }
    throw new Error("the Tab key never reached " + selector);
  };
  const said = (page, re) => page.waitForFunction(src => new RegExp(src).test(document.getElementById("live").textContent), re.source, { timeout: 5000 });
  const inert = (page, sel) => page.evaluate(s => !!document.querySelector(s).closest("[inert]"), sel);

  test("keyboard only: add a question room, write a question, mark it checked and export it, without a mouse", async log => {
    const page = await open(browser, base, DESKTOP);
    await page.evaluate(() => { window.__pointer = 0; ["mousedown", "pointerdown", "touchstart"].forEach(t => addEventListener(t, () => window.__pointer++, true)); });
    const K = page.keyboard;
    await K.press("Tab");
    assert.equal((await active(page)).cls, "skip", "the first Tab stop is the skip link");
    await K.press("Enter");
    assert.equal((await active(page)).id, "main", "the skip link lands in the editing area");
    // add a question room from the cabinet
    await tabTo(page, "#add-room"); await K.press("Enter");
    assert.equal(await page.getAttribute("#add-room", "aria-expanded"), "true");
    assert.equal(await page.evaluate(() => document.activeElement.dataset.type), "quiz", "the list of room kinds takes the keyboard");
    await K.press("Enter");
    await page.waitForFunction(() => document.activeElement && document.activeElement.id === "page-title");
    assert.equal(await page.textContent("#page-title"), "New question room");
    assert.match(await page.title(), /^New question room \(room 6\) · /, "the browser tab is named after the page");
    await said(page, /Room 6 added: Question lock/);
    // write the question, its accepted answers and its source
    await tabTo(page, "#panel .entry textarea"); await K.type("Who wrote Democracy and Education?");
    await tabTo(page, "#panel .entry [role=radio]");
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute("aria-checked") === "true" && document.activeElement.value), "short");
    await tabTo(page, "#panel .entry [data-key=answers] input"); await K.type("John Dewey | Dewey");
    await tabTo(page, "#panel .entry [data-key=source] input"); await K.type("Course text, ch. 3");
    // press the seal
    await tabTo(page, "#panel .entry .verify [role=checkbox]");
    assert.equal(await page.getByRole("checkbox", { name: "I checked this is correct (Question 1)" }).count(), 1);
    await K.press("Space");
    assert.match(await page.textContent("#meter"), /1 \/ 41 checked/);
    await said(page, /Question 1 marked as checked\. 1 of 41 checked\./);
    // the index tabs: back to the tablist, Right arrow to "Room text", then name the room
    await tabTo(page, "[role=tab]", 60, "Shift+Tab");
    assert.equal((await active(page)).id, "tab-items");
    await K.press("ArrowRight");
    assert.equal((await active(page)).id, "tab-text");
    assert.equal(await page.getAttribute("#tab-text", "aria-selected"), "true");
    await tabTo(page, "#panel [data-key=title] input"); await K.press("Control+A"); await K.type("The Strongbox");
    await tabTo(page, "#panel [data-key=story] textarea"); await K.type("Answer the slip to open the box.");
    // export: the folder, then the slip that asks about exporting a draft
    await tabTo(page, "#btn-export"); await K.press("Enter");
    assert.equal((await active(page)).id, "overlay-close");
    await tabTo(page, "#export-html", 12);
    const [dl] = await Promise.all([page.waitForEvent("download"), (async () => {
      await K.press("Enter");
      // the sample was changed, so the exit password is asked for first: the keyboard is in the box, Enter takes the suggestion
      await page.locator("#ask-password").waitFor();
      assert.equal((await active(page)).id, "ask-password");
      await K.press("Enter");
      await page.locator(".modal[role=alertdialog]").waitFor();
      assert.equal((await active(page)).id, "ask-cancel", "the keyboard starts on the safe button");
      await K.press("Tab");
      assert.equal((await active(page)).id, "ask-ok");
      await K.press("Enter");
    })()]);
    assert.equal((await active(page)).id, "export-html", "focus goes back to the button that asked");
    await K.press("Escape");
    assert.equal((await active(page)).id, "btn-export", "and then to the button that opened the folder");
    const file = path.join(require("os").tmpdir(), `a11y-export-${process.pid}.html`); await dl.saveAs(file);
    const cfg = require("../src/shared.js").configFromHtml(fs.readFileSync(file, "utf8")); fs.rmSync(file, { force: true });
    assert.equal(cfg.rooms[5].title, "The Strongbox");
    assert.equal(cfg.rooms[5].questions[0].prompt, "Who wrote Democracy and Education?");
    assert.equal(cfg.rooms[5].questions[0].answers, "John Dewey | Dewey");
    assert.equal(cfg.rooms[5].questions[0].verified, true);
    assert.equal(await page.evaluate(() => window.__pointer), 0, "no pointer was used");
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  test("keyboard only: the guided steps from Welcome to the download, without a mouse", async () => {
    const page = await open(browser, base, DESKTOP);
    await page.goto(base + "/editor.html");
    await page.evaluate(() => { window.__pointer = 0; ["mousedown", "pointerdown", "touchstart"].forEach(t => addEventListener(t, () => window.__pointer++, true)); });
    const K = page.keyboard;
    const step = text => page.waitForFunction(t => { const h = document.getElementById("wiz-h1"); return h && h.textContent.includes(t) && document.activeElement === h; }, text);
    await K.press("Tab");
    assert.equal((await active(page)).text, "Skip to the question");
    await K.press("Enter"); assert.equal((await active(page)).id, "wiz-main");
    await tabTo(page, "#wiz-continue"); await K.press("Enter");
    await step("How do you want to start?");
    assert.match(await page.title(), /^Step 2 of 10: How do you want to start\?/);
    await tabTo(page, "#start-sample"); await K.press("ArrowDown");
    assert.equal((await active(page)).id, "start-empty", "arrow keys choose within the radio cards");
    await tabTo(page, "#wiz-continue"); await K.press("Enter");
    await step("What is this escape room called?");
    await K.press("Tab"); assert.equal((await active(page)).id, "wiz-title", "the question's own box is next");
    await K.press("Control+A"); await K.type("Week 3 review"); await K.press("Enter");          // Enter sends the page, like Continue
    await step("Your rooms");
    await tabTo(page, "#wiz-continue"); await K.press("Enter");
    await step("Room 1: Write your questions");
    await tabTo(page, "#q1-prompt"); await K.type("Who wrote Emile (1762)?");
    await tabTo(page, "#q1-a0"); await K.type("Jean-Jacques Rousseau");
    await tabTo(page, "#q1-add-a"); await K.press("Enter");
    assert.equal((await active(page)).id, "q1-a1"); await K.type("Rousseau");
    await tabTo(page, "#wiz-continue"); await K.press("Enter");
    await step("What do students read");
    await tabTo(page, "#room-title"); await K.press("Control+A"); await K.type("The Reading Room");
    await tabTo(page, "#room-story"); await K.type("Answer the slip to open the box.");
    await tabTo(page, "#wiz-continue"); await K.press("Enter");
    await step("Check your facts");
    await tabTo(page, "#wiz-next-unchecked"); await K.press("Enter");
    assert.equal((await active(page)).id, "f1-questions-1-ok");
    await K.press("Space");
    await said(page, /Checked: room 1, question 1\. 1 of 1 checked\./);
    await tabTo(page, "#wiz-continue"); await K.press("Enter");
    await step("Try it as a student");
    await tabTo(page, "#wiz-continue"); await K.press("Enter");
    await step("How will your students get");
    await tabTo(page, "#where-link"); assert.equal((await active(page)).id, "where-link", "a class link is the first choice");
    await K.press("ArrowDown");
    assert.equal((await active(page)).id, "where-moodle", "the keyboard stays on the choice when the next question opens");
    await K.press("Tab"); assert.equal((await active(page)).id, "how-quiz");
    await K.press("ArrowDown"); assert.equal((await active(page)).id, "how-scorm");
    await tabTo(page, "#wiz-continue"); await K.press("Enter");
    await step("Put it in Moodle (grade file)");
    await tabTo(page, "#wiz-download");
    const [dl] = await Promise.all([page.waitForEvent("download"), (async () => {
      await K.press("Enter");
      await page.locator("#ask-password").waitFor();
      assert.equal((await active(page)).id, "ask-password");
      await K.press("Enter");
    })()]);
    assert.equal(dl.suggestedFilename(), "Week-3-review-SCORM.zip");
    assert.equal(await page.evaluate(() => cfg.finish.exitPassword), "WEEK3");
    assert.equal(await page.evaluate(() => window.__pointer), 0, "no pointer was used");
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  test("slips that ask before deleting: labelled alert dialogs, Cancel first, Esc, Tab stays inside, focus returns", async () => {
    const page = await open(browser, base, DESKTOP);
    await drawer(page, "1.");
    await page.focus("[aria-label='Delete Card 2']"); await page.keyboard.press("Enter");
    const box = page.locator(".modal[role=alertdialog]");
    await box.waitFor();
    assert.equal(await box.getAttribute("aria-modal"), "true");
    assert.equal(await page.evaluate(() => { const m = document.querySelector(".modal"); return document.getElementById(m.getAttribute("aria-labelledby")).textContent; }), "Delete card 2?");
    assert.match(await page.evaluate(() => { const m = document.querySelector(".modal"); return document.getElementById(m.getAttribute("aria-describedby")).textContent; }), /Existentialism.*can't be undone/);
    assert.equal((await active(page)).id, "ask-cancel", "the destructive button is not the default");
    assert.equal(await inert(page, "main"), true, "the bench behind the slip is inert");
    assert.equal(await inert(page, "#nav"), true);
    const stops = [];
    for (let i = 0; i < 5; i++) { await page.keyboard.press("Tab"); stops.push((await active(page)).id); }
    assert.deepEqual(stops, ["ask-ok", "ask-cancel", "ask-ok", "ask-cancel", "ask-ok"], "Tab goes round inside the slip");
    await page.keyboard.press("Shift+Tab"); await page.keyboard.press("Shift+Tab");
    assert.equal((await active(page)).id, "ask-ok");
    await page.keyboard.press("Escape");
    assert.equal(await box.count(), 0);
    assert.equal(await page.locator(".entry").count(), 5, "Esc deletes nothing");
    assert.equal((await active(page)).label, "Delete Card 2", "focus returns to the button that asked");
    assert.equal(await inert(page, "main"), false);
    await page.keyboard.press("Enter"); await box.waitFor(); await page.keyboard.press("Enter");        // Enter on Cancel
    assert.equal(await page.locator(".entry").count(), 5);
    await page.keyboard.press("Enter"); await box.waitFor(); await page.keyboard.press("Tab"); await page.keyboard.press("Enter");
    assert.equal(await page.locator(".entry").count(), 4);
    assert.equal((await active(page)).label, "Delete Card 2", "after deleting, focus is on the entry that took its place");
    await said(page, /Card 2 deleted\. 4 left\./);
    // a file that isn't an escape room: an alert slip with one button, not the browser's alert()
    await page.setInputFiles("#file", { name: "notes.json", mimeType: "application/json", buffer: Buffer.from("{\"hello\":1}") });
    await box.waitFor();
    assert.match(await page.textContent(".modal"), /couldn't be opened.*doesn't contain an escape room/s);
    assert.equal(await page.locator(".modal button").count(), 1);
    assert.equal((await active(page)).id, "ask-ok");
    await page.keyboard.press("Escape");
    assert.equal(await box.count(), 0);
    assert.deepEqual(page.errors, [], "no native confirm() or alert() was shown");
    await page.context().close();
  });

  test("folders (New, Export, Answer sheet, problems) are modal dialogs with a name, a Tab loop and Esc", async () => {
    const page = await open(browser, base, DESKTOP);
    for (const [btn, name] of [["#btn-new", "New"], ["#btn-export", "Export"], ["#btn-review", "Answer sheet: for instructors only"]]) {
      await page.focus(btn); await page.keyboard.press("Enter");
      const o = page.locator(".overlay");
      assert.equal(await o.getAttribute("role"), "dialog"); assert.equal(await o.getAttribute("aria-modal"), "true");
      assert.equal(await page.getByRole("dialog", { name, exact: true }).count(), 1, `the ${name} folder is a named dialog`);
      assert.equal((await active(page)).id, "overlay-close");
      assert.equal(await inert(page, "header"), true);
      if (btn !== "#btn-review") {
        const n = await page.locator(".overlay button").count();
        for (let i = 0; i < n; i++) { await page.keyboard.press("Tab"); assert.equal(await page.evaluate(() => !!document.activeElement.closest(".overlay")), true, "Tab stays in the folder"); }
        assert.equal((await active(page)).id, "overlay-close", "and comes back round to Close");
      }
      await page.keyboard.press("Escape");
      assert.equal(await o.count(), 0);
      assert.equal((await active(page)).id, btn.slice(1), "focus returns to the opener");
      assert.equal(await inert(page, "header"), false);
    }
    // the problems folder is an alert dialog whose description is the list of problems
    await page.evaluate(() => { cfg.rooms[0].cards[0].term = ""; render(); });
    await page.focus("#btn-preview"); await page.keyboard.press("Enter");
    const alert = page.getByRole("alertdialog", { name: "Returned: needs fixing" });
    await alert.waitFor();
    assert.match(await page.evaluate(() => document.getElementById(document.querySelector(".overlay").getAttribute("aria-describedby")).textContent), /every card needs a name/);
    await page.keyboard.press("Escape");
    assert.equal((await active(page)).id, "btn-preview");
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  test("phone: the open cabinet is a dialog (focus inside, bench inert, Tab loop, Esc and Close return to the handle)", async () => {
    const page = await open(browser, base, PHONE, { hasTouch: true, isMobile: true });
    assert.equal(await page.locator("#cab[role=dialog]").count(), 0);
    await page.focus("#cabinet-handle"); await page.keyboard.press("Enter");
    assert.equal(await page.getAttribute("#cab", "role"), "dialog"); assert.equal(await page.getAttribute("#cab", "aria-modal"), "true");
    assert.equal(await page.getByRole("dialog", { name: "Cabinet of rooms" }).count(), 1);
    assert.equal(await page.evaluate(() => !!document.activeElement.closest("#cab") && document.activeElement.getAttribute("aria-current")), "page", "focus moves to the open drawer");
    assert.equal(await inert(page, "main"), true); assert.equal(await inert(page, "header"), true);
    for (let i = 0; i < 40; i++) { await page.keyboard.press("Tab"); assert.equal(await page.evaluate(() => !!document.activeElement.closest("#cab")), true, "Tab never leaves the cabinet"); }
    await page.keyboard.press("Escape");
    assert.equal(await page.evaluate(() => document.body.classList.contains("cab-open")), false);
    assert.equal((await active(page)).id, "cabinet-handle");
    assert.equal(await page.getAttribute("#cab", "role"), null);
    assert.equal(await inert(page, "main"), false);
    await page.keyboard.press("Enter"); await page.focus("#cabinet-close"); await page.keyboard.press("Enter");
    assert.equal((await active(page)).id, "cabinet-handle", "the Close button also returns to the handle");
    // the list of room kinds inside it: Esc closes the list first, then the cabinet
    await page.keyboard.press("Enter"); await page.focus("#add-room"); await page.keyboard.press("Enter");
    assert.equal(await page.locator("#add-menu").count(), 1);
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#add-menu").count(), 0); assert.equal((await active(page)).id, "add-room");
    assert.equal(await page.evaluate(() => document.body.classList.contains("cab-open")), true);
    // choosing a drawer closes it and moves to the page heading
    await page.click("#nav .item:has-text('3.') .pull");
    assert.equal((await active(page)).id, "page-title"); assert.equal(await page.textContent("#page-title"), "The History Hall");
    // the file list behind the three dots: a disclosure that takes the keyboard and gives it back
    await page.focus("#btn-more"); await page.keyboard.press("Enter");
    assert.equal(await page.getAttribute("#btn-more", "aria-expanded"), "true"); assert.equal((await active(page)).id, "btn-new");
    await page.keyboard.press("Escape");
    assert.equal(await page.getAttribute("#btn-more", "aria-expanded"), "false"); assert.equal((await active(page)).id, "btn-more");
    await page.keyboard.press("Enter"); await page.keyboard.press("Enter");          // New… from the list
    await page.keyboard.press("Escape");
    assert.equal((await active(page)).id, "btn-more", "after the folder closes, focus is on the three dots (the list has folded away)");
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  test("help slips: hover or focus opens them, they stay while pointed at, and Esc dismisses them (WCAG 1.4.13)", async () => {
    const page = await open(browser, base, DESKTOP);
    await drawer(page, "1."); await page.click("#tab-text");
    const mark = page.locator("[data-key=story] .i"), pop = page.locator(".pop:visible");
    assert.equal(await mark.getAttribute("aria-label"), "Help: Story / instructions");
    assert.equal(await pop.count(), 0);
    await mark.hover(); await pop.waitFor();
    assert.equal(await pop.getAttribute("role"), "tooltip");
    assert.equal(await pop.getAttribute("id"), await mark.getAttribute("aria-describedby"));
    assert.equal(await page.evaluate(() => !!document.querySelector(".pop:not([hidden])").closest("main")), true, "the slip is inside a landmark");
    const b = await pop.boundingBox();
    await page.mouse.move(b.x + 20, b.y + 2); await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);      // across the gap, onto the slip itself
    await page.waitForTimeout(500);
    assert.equal(await pop.count(), 1, "the slip stays while the pointer is on it");
    await page.keyboard.press("Escape");
    assert.equal(await pop.count(), 0, "Esc dismisses it without moving the pointer");
    await mark.hover(); await pop.waitFor();
    await page.mouse.move(5, 500, { steps: 3 }); await page.waitForTimeout(500);
    assert.equal(await pop.count(), 0, "it goes when the pointer leaves");
    // keyboard: focus shows it, the field itself is described by the same slip, Enter pins it, Esc keeps focus on the mark
    await mark.focus(); await pop.waitFor();
    assert.match(await page.locator("[data-key=story] textarea").getAttribute("aria-describedby"), new RegExp(await pop.getAttribute("id")));
    await page.keyboard.press("Escape");
    assert.equal(await pop.count(), 0);
    assert.equal(await mark.evaluate(el => el === document.activeElement), true);
    // an open slip never covers the mark that owns it
    await mark.blur(); await mark.focus(); await pop.waitFor();
    const m = await mark.boundingBox(), p2 = await pop.boundingBox();
    assert.equal(p2.y >= m.y + m.height || p2.y + p2.height <= m.y, true);
    // every field's help is also wired to the field, and every mark has a name
    assert.equal(await page.evaluate(() => [...document.querySelectorAll("main .i")].every(b => /^Help: \S/.test(b.getAttribute("aria-label")) && document.getElementById(b.getAttribute("aria-describedby")))), true);
    await page.context().close();
  });

  test("brass selectors are radio groups, seals are checkboxes, index tabs are a tablist: names, states and arrow keys", async () => {
    const page = await open(browser, base, DESKTOP);
    await drawer(page, "1.");
    // tablist
    const tabs = page.getByRole("tab");
    assert.deepEqual(await tabs.allTextContents(), ["Cards & clues", "Lock", "Room text", "Hints"]);
    assert.equal(await page.getByRole("tablist", { name: "The Library" }).count(), 1);
    assert.equal(await page.getByRole("tab", { selected: true }).textContent(), "Cards & clues");
    assert.equal(await page.evaluate(() => [...document.querySelectorAll("[role=tab]")].every(t => t.getAttribute("aria-controls") === "panel" && document.getElementById("panel"))), true);
    assert.equal(await page.getAttribute("#panel", "role"), "tabpanel"); assert.equal(await page.getAttribute("#panel", "aria-labelledby"), "tab-items");
    assert.deepEqual(await page.$$eval("[role=tab]", els => els.map(e => e.tabIndex)), [0, -1, -1, -1], "one tab stop; arrows move between tabs");
    await page.focus("#tab-items"); await page.keyboard.press("ArrowRight");
    assert.equal((await active(page)).id, "tab-lock"); assert.equal(await page.getAttribute("#tab-lock", "aria-selected"), "true"); assert.equal(await page.getAttribute("#panel", "aria-labelledby"), "tab-lock");
    await page.keyboard.press("End"); assert.equal((await active(page)).id, "tab-hints");
    await page.keyboard.press("ArrowRight"); assert.equal((await active(page)).id, "tab-items", "arrows wrap round");
    await page.keyboard.press("ArrowLeft"); await page.keyboard.press("Home"); await page.keyboard.press("ArrowRight");
    // radio group
    const group = page.getByRole("radiogroup", { name: "Look of the cards" });
    assert.equal(await group.count(), 1);
    assert.deepEqual(await group.getByRole("radio").evaluateAll(els => els.map(e => e.closest("label").textContent.trim() + (e.getAttribute("aria-checked") === "true" ? " ✓" : ""))), ["Plain cards", "Books on a shelf ✓", "Framed portraits"]);
    await group.getByRole("radio", { checked: true }).focus();
    await page.keyboard.press("ArrowRight");
    assert.equal(await page.evaluate(() => cfg.rooms[0].look), "portraits");
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute("role") === "radio" && document.activeElement.value), "portraits", "the keyboard stays on the selector after it turns");
    await page.keyboard.press("ArrowLeft"); await page.keyboard.press("ArrowLeft");
    assert.equal(await page.evaluate(() => cfg.rooms[0].look), "cards");
    assert.equal(await page.getAttribute("#look-help", "role"), "status");
    await page.keyboard.press("ArrowRight");
    // seals
    await page.keyboard.press("Shift+Tab"); await page.focus("#tab-items"); await page.keyboard.press("Enter");
    const seal = page.getByRole("checkbox", { name: "I checked this is correct (Card 3)" });
    assert.equal(await seal.count(), 1); assert.equal(await seal.isChecked(), false);
    await seal.focus(); await page.keyboard.press("Space");
    assert.equal(await seal.isChecked(), true);
    await said(page, /Card 3 marked as checked\. 1 of 45 checked\./);
    assert.equal(await page.getByRole("group", { name: "Card 3", exact: true }).count(), 1, "each entry is a named group");
    await page.getByRole("group", { name: "Card 3", exact: true }).getByLabel("Name on card").fill("Perennialism!");
    assert.equal(await seal.isChecked(), false);
    await said(page, /its seal is lifted/);
    // moving an entry keeps the keyboard with it and says where it went
    await page.focus("[aria-label='Move Card 2 down']"); await page.keyboard.press("Enter");
    assert.equal((await active(page)).label, "Move Card 3 down");
    await said(page, /Card 2 moved down\. It is now card 3 of 5\./);
    await page.keyboard.press("Enter"); await page.keyboard.press("Enter");
    assert.equal((await active(page)).label, "Move Card 5 up", "at the end of the list focus moves to the button that still works");
    // the hints switch
    await page.click("#tab-hints");
    const sw = page.getByRole("switch", { name: "Hints in this room" });
    assert.equal(await sw.count(), 1); assert.equal(await sw.isChecked(), false);
    await sw.focus(); await page.keyboard.press("Space");
    assert.equal(await page.getByRole("switch", { name: "Hints in this room" }).isChecked(), true);
    assert.equal(await page.evaluate(() => document.activeElement.id), "hints-toggle");
    await said(page, /Hints are on in this room/);
    // the envelope and the pinned note
    assert.equal(await page.evaluate(() => document.querySelector("#answer-key").open), false);
    await page.focus("#answer-key summary"); await page.keyboard.press("Enter");
    assert.equal(await page.evaluate(() => document.querySelector("#answer-key").open), true);
    assert.match(await page.textContent("#answer-key .keycard"), /Lock combination/);
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  test("the preview rail: a named modal dialog, every control named, room changes announced, Esc returns to the opener", async () => {
    const page = await open(browser, base, DESKTOP);
    await drawer(page, "2.");
    await page.focus("#preview-room"); await page.keyboard.press("Enter");
    await page.frameLocator(".preview iframe").locator("#stage h2").waitFor();
    assert.equal(await page.getByRole("dialog", { name: "Student preview" }).count(), 1);
    assert.equal(await page.getAttribute(".preview", "aria-modal"), "true");
    assert.equal(await inert(page, "main"), true);
    await page.waitForTimeout(300);
    assert.equal((await active(page)).id, "preview-exit", "focus is on the rail's Exit button, not pulled into the game when it loads or changes room");
    assert.equal(await page.getAttribute(".preview iframe", "title"), "Student view of the escape room");
    assert.equal(await page.$$eval(".pbar button, .pbar input", els => els.every(e => (e.getAttribute("aria-label") || e.closest("label")?.textContent || e.textContent).trim().length > 2)), true);
    assert.equal(await page.getByRole("group", { name: "Jump to a room" }).count(), 1);
    await page.waitForFunction(() => document.querySelector(".pbar [aria-current=step]")?.dataset.room === "2");
    assert.equal(await page.locator(".pbar [aria-current]").count(), 1);
    await page.focus(".pbar [aria-label='Next room']"); await page.keyboard.press("Enter");
    await page.waitForFunction(() => /showing room 3 of 5: The History Hall/.test(document.querySelector(".pbar [role=status]").textContent));
    const sw = page.getByRole("switch", { name: "Show answers" });
    await sw.focus(); await page.keyboard.press("Space");
    const key = page.frameLocator(".preview iframe").locator("#teacher-key");
    await key.waitFor();
    // the answers are a labelled complementary landmark in the page flow, with a heading and a Hide button
    assert.equal(await key.evaluate(el => el.tagName + " " + document.getElementById(el.getAttribute("aria-labelledby")).tagName), "ASIDE H2");
    assert.equal(await key.evaluate(el => getComputedStyle(el).position), "relative", "the answer strip is in the flow, not an overlay");
    await key.locator("#tk-hide").click();
    await key.waitFor({ state: "detached" });
    await page.waitForFunction(() => document.getElementById("preview-answers").getAttribute("aria-checked") !== "true", null, { timeout: 3000 });     // the game tells the rail by postMessage
    assert.equal(await sw.isChecked(), false, "Hide answers turns the rail's switch off too");
    assert.equal((await active(page)).id, "preview-answers", "and the keyboard lands on that switch");
    await page.focus("#preview-exit"); await page.keyboard.press("Escape");
    assert.equal(await page.locator(".preview").count(), 0);
    assert.equal((await active(page)).id, "preview-room", "focus returns to the plate that opened the preview");
    assert.equal(await inert(page, "main"), false);
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  for (const [size, viewport] of [["1440×900", DESKTOP], ["390×844", PHONE]]) test(`the preview's answer strip never covers a focused control in the student view: ${size}`, async log => {
    const page = await open(browser, base, viewport, { reducedMotion: "reduce" });
    await page.click("#btn-preview");
    const frame = page.frameLocator(".preview iframe"); await frame.locator("#begin").waitFor();
    await page.click("label.switch:has(#preview-answers)");
    const game = (await (await page.$(".preview iframe")).contentFrame());
    const bad = []; let checked = 0;
    for (let room = 1; room <= 5; room++) {
      await page.click(`.pbar button[data-room='${room}']`); await frame.locator("#stage h2", { hasText: `Room ${room}` }).waitFor(); await frame.locator("#teacher-key").waitFor();
      const r = await game.evaluate(() => {
        const key = document.getElementById("teacher-key"), out = []; let n = 0;
        const els = [...document.querySelectorAll("#view a[href], #view button, #view input, #view [tabindex='0']")].filter(el => !el.disabled && el.getClientRects().length && !key.contains(el));
        for (const el of els) {
          el.focus(); if (document.activeElement !== el) continue; n++;
          const q = el.getBoundingClientRect(), i = Math.min(3, q.width / 4, q.height / 4);
          // the centre and four points just inside the corners
          for (const [x, y] of [[q.left + q.width / 2, q.top + q.height / 2], [q.left + i, q.top + i], [q.right - i, q.top + i], [q.left + i, q.bottom - i], [q.right - i, q.bottom - i]]) {
            if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) { out.push("off screen when focused: " + (el.id || el.className) + " " + (el.getAttribute("aria-label") || el.textContent).trim().slice(0, 30)); break; }
            const hit = document.elementFromPoint(x, y);
            if (hit && key.contains(hit)) { out.push("covered by the answer strip: " + (el.id || el.className) + " " + (el.getAttribute("aria-label") || el.textContent).trim().slice(0, 30)); break; }
          }
        }
        return { n, out };
      });
      checked += r.n; bad.push(...r.out.map(x => `[room ${room}] ${x}`));
    }
    log(`${checked} focused controls checked with the answers shown`);
    assert.ok(checked > 60, "only " + checked + " controls were checked");
    report("covered by the answer strip", bad);
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  test("the preview rail keeps all its controls inside it and off the student view: 320×256, and with 32px text", async () => {
    const big = engine === playwright.chromium ? await engine.launch({ args: ["--blink-settings=defaultFontSize=32,defaultFixedFontSize=26"] }) : null;
    const bad = [];
    for (const [label, b, viewport] of [["320×256", browser, { width: 320, height: 256 }], ["32px text, 1280×900", big, { width: 1280, height: 900 }], ["32px text, 390×844", big, PHONE]]) {
      if (!b) continue;
      const page = await open(b, base, viewport, { reducedMotion: "reduce" });
      await page.click("#btn-preview"); await page.frameLocator(".preview iframe").locator("#begin").waitFor();
      const r = await page.evaluate(() => {
        const bar = document.querySelector(".pbar").getBoundingClientRect(), fr = document.querySelector(".preview iframe").getBoundingClientRect(), out = [];
        for (const el of document.querySelectorAll(".pbar button, .pbar label, .pbar input")) {
          const q = el.getBoundingClientRect(); if (!q.width) continue;
          if (q.left < bar.left - .5 || q.right > bar.right + .5 || q.top < bar.top - .5 || q.bottom > bar.bottom + .5) out.push("outside the rail: " + (el.id || el.getAttribute("aria-label") || el.textContent.trim()));
          if (q.bottom > fr.top + .5 && q.top < fr.bottom && q.right > fr.left && q.left < fr.right) out.push("over the student view: " + (el.id || el.getAttribute("aria-label") || el.textContent.trim()));
        }
        if (bar.bottom > fr.top + .5) out.push(`the rail (bottom ${Math.round(bar.bottom)}) runs onto the student view (top ${Math.round(fr.top)})`);
        if (document.documentElement.scrollWidth > innerWidth + 1) out.push("the page scrolls sideways");
        return out;
      });
      bad.push(...r.map(x => `[${label}] ${x}`));
      // everything in the rail can still be reached and used: the last control, Exit, is in view once focused
      await page.focus("#preview-exit");
      const exitBox = await page.evaluate(() => { const q = document.getElementById("preview-exit").getBoundingClientRect(); return q.top >= 0 && q.bottom <= innerHeight; });
      if (!exitBox) bad.push(`[${label}] Exit preview is out of view when focused`);
      await page.context().close();
    }
    if (big) await big.close();
    report("preview rail", bad);
  });

  test("High contrast and Readable text: keyboard switches, remembered, follow the system, reach the answer sheet", async () => {
    const page = await open(browser, base, DESKTOP);
    const html = () => page.evaluate(() => { const d = { ...document.documentElement.dataset }; delete d.mode; return d; });
    assert.deepEqual(await html(), {});
    const hc = page.getByRole("switch", { name: "High contrast" }), rt = page.getByRole("switch", { name: "Readable text" });
    assert.equal(await page.getByRole("group", { name: "Display" }).count(), 1);
    await hc.focus(); await page.keyboard.press("Space");
    assert.equal((await html()).contrast, "more");
    assert.equal(await page.evaluate(() => localStorage.getItem("escape-room-contrast")), "on");
    assert.equal(await page.evaluate(() => document.activeElement.id), "contrast-toggle", "the switch keeps the keyboard");
    await said(page, /High contrast on/);
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector(".paper")).backgroundColor), "rgb(255, 255, 255)");
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector(".paper")).backgroundImage), "none", "no texture under the text");
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector(".light")).display), "none");
    await rt.focus(); await page.keyboard.press("Space");
    assert.equal((await html()).readable, "on");
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize), "18px");
    assert.match(await page.evaluate(() => getComputedStyle(document.querySelector(".field label")).fontFamily), /Atkinson Hyperlegible|Verdana/);
    assert.doesNotMatch(await page.evaluate(() => getComputedStyle(document.querySelector("#page-title")).fontFamily), /IM Fell|Special Elite/);
    await page.reload();
    assert.deepEqual(await html(), { contrast: "more", readable: "on" }, "both are remembered");
    assert.equal(await hc.isChecked(), true); assert.equal(await rt.isChecked(), true);
    await page.click("#btn-review");
    const sheet = page.frameLocator(".overlay iframe");
    assert.equal(await sheet.locator("body").evaluate(b => getComputedStyle(b).backgroundColor), "rgb(255, 255, 255)");
    assert.match(await sheet.locator("body").evaluate(b => getComputedStyle(b).fontFamily), /Atkinson Hyperlegible|Verdana/);
    await page.keyboard.press("Escape");
    await hc.focus(); await page.keyboard.press("Space"); await rt.focus(); await page.keyboard.press("Space");
    assert.deepEqual(await html(), {});
    // by default the typewriter face is only for short labels: what is read or typed uses a plain serif
    assert.doesNotMatch(await page.evaluate(() => getComputedStyle(document.querySelector("main input[type=text]")).fontFamily), /Special Elite|IM Fell/);
    assert.doesNotMatch(await page.evaluate(() => getComputedStyle(document.body).fontFamily), /Special Elite/);
    // the system's own setting switches High contrast on until the teacher says otherwise
    await page.evaluate(() => localStorage.clear());
    await page.emulateMedia({ contrast: "more" }); await page.reload();
    assert.equal((await html()).contrast, "more"); assert.equal(await hc.isChecked(), true);
    await hc.focus(); await page.keyboard.press("Space");
    assert.equal((await html()).contrast, undefined); assert.equal(await page.evaluate(() => localStorage.getItem("escape-room-contrast")), "off");
    if (!CHROMIUM) return page.context().close();
    await page.emulateMedia({ contrast: "no-preference", forcedColors: "active" }); await page.reload();
    assert.equal((await html()).contrast, "more", "forced colours always get the plain edges");
    // forced colours: "on" states use the system highlight, so they can be told apart without the art
    await drawer(page, "1."); await page.click("#tab-lock");
    const states = await page.evaluate(() => { const bg = s => getComputedStyle(document.querySelector(s)).backgroundColor;
      return { on: bg(".rotary input:checked + span"), off: bg(".rotary input:not(:checked) + span"), tabOn: bg("[role=tab][aria-selected=true]"), tabOff: bg("[role=tab][aria-selected=false]") }; });
    assert.notEqual(states.on, states.off); assert.notEqual(states.tabOn, states.tabOff);
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  test("with reduced motion nothing animates, and there is no 3D", async () => {
    const page = await open(browser, base, DESKTOP, { reducedMotion: "reduce" });
    await drawer(page, "1."); await page.click(".verify label.chk >> nth=0"); await page.click("#answer-key summary");
    await page.click("#btn-export");
    assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
    assert.equal(await page.evaluate(() => [...document.querySelectorAll("*")].some(el => { const s = getComputedStyle(el); return s.perspective !== "none" || s.transformStyle === "preserve-3d" || /matrix3d/.test(s.transform); })), false);
    await page.context().close();
  });

  test("the accessibility tree of a room page reads in order, with names, roles and states", async log => {
    const page = await open(browser, base, DESKTOP);
    await drawer(page, "1.");
    const tree = await page.locator("body").ariaSnapshot();
    if (SHOTS) fs.writeFileSync(path.join(SHOTS, "aria-tree-room-1.txt"), tree);
    const want = [
      /^- link "Skip to the editing area"/m,
      /^- banner:/m, /- heading "The Curator’s Workshop \(escape room editor\)" \[level=1\]/,
      /- paragraph: 0 \/ 45 checked/,
      /- button "New…"/, /- button "Answer sheet"/, /- button "Preview as student"/, /- button "Export"/,
      /^- navigation "Cabinet of rooms":/m, /- button "Settings"/, /- heading "Rooms" \[level=2\]/,
      /- button "1\. The Library 10 to check"/,
      /- button "Move room 2 up"/, /button "Delete room 2: The Portrait Gallery"/, /- button "Add a room" \[expanded=false\]|- button "Add a room"/,
      /- button "Accessibility check \d+ notes?"/, /button "Help: saving"/, /- group "Display":/, /- switch "High contrast"/, /- switch "Readable text"/,
      /^- main:/m, /- heading "The Library" \[level=2\]/, /- button "45 of 45 items not checked yet\. why\?"/, /- group: Answer key|Answer key/,
      /- button "Preview this room"/,
      /- tablist "The Library":/, /- tab "Cards & clues" \[selected\]/, /- tab "Hints"/, /- tabpanel "Cards & clues":/,
      /- group "Card 1":/, /- button "Move Card 1 up" \[disabled\]/, /- button "Delete Card 1"/,
      /- textbox "Name on card": Essentialism/, /- textbox "Clue":[\s\S]{0,90}All students should master/, /- textbox "Source"/,
      /- checkbox "I checked this is correct \(Card 1\)"/, /- button "Add card"/
    ];
    const missing = want.filter(re => !re.test(tree)).map(String);
    if (missing.length) log(tree.split("\n").slice(0, 120).join("\n      "));
    assert.deepEqual(missing, []);
    // reading order: rail, then cabinet, then the editing area; inside the entry: label, help, field, source, seal
    const order = ["banner", "navigation \"Cabinet of rooms\"", "- main:", "heading \"The Library\"", "tablist", "tabpanel", "group \"Card 1\"", "textbox \"Name on card\"", "textbox \"Clue\"", "checkbox \"I checked this is correct (Card 1)\"", "group \"Card 2\""].map(s => tree.indexOf(s));
    assert.deepEqual(order, [...order].sort((a, b) => a - b), "landmarks and fields come in reading order");
    assert.equal(order.includes(-1), false);
    // nothing decorative leaks into the tree, and no control is nameless
    assert.doesNotMatch(tree, /- img(?! ")|- button$|- button:$|- textbox$|- checkbox$/m);
    assert.equal(await page.evaluate(() => document.querySelectorAll("h1").length), 1);
    assert.deepEqual(await page.$$eval("h1,h2,h3", els => els.filter(e => e.offsetParent !== null || e.tagName === "H1").map(e => +e.tagName[1])).then(l => l.every((n, i) => i === 0 || n - l[i - 1] <= 1)), true, "heading levels never skip");
    assert.equal(await page.getAttribute("html", "lang"), "en");
    assert.equal(await page.getAttribute("#nav .item.sel .pull", "aria-current"), "page");
    assert.equal(await page.locator("#nav [aria-current]").count(), 1);
    await page.context().close();
  });

  const wantTest = process.env.A11Y_TEST ? new RegExp(process.env.A11Y_TEST, "i") : null;
  if (wantTest) queue.splice(0, queue.length, ...queue.filter(t => wantTest.test(t.name)));
  await runAll();

  await browser.close();
  server.close();
  if (AUDIT) {
    if (process.env.A11Y_DUMP) fs.writeFileSync(process.env.A11Y_DUMP, Object.entries(audit).map(([k, list]) => `## ${k}\n${list.join("\n")}`).join("\n\n"));
    console.log("\nAudit summary");
    for (const [k, list] of Object.entries(audit)) {
      console.log(`\n${k}: ${list.length}`);
      const by = {};
      list.forEach(l => { const key = l.replace(/^\[[^\]]*\]\s*[^:]*:\s*/, "").replace(/\d+(\.\d+)?:1/, "N:1").replace(/\d+×\d+/, "N×N").slice(0, 110); by[key] = (by[key] || 0) + 1; });
      Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, +process.env.A11Y_TOP || 40).forEach(([key, n]) => console.log(`  ${String(n).padStart(4)}  ${key}`));
    }
  }
  console.log(`\n${passed} passed, ${failed} failed.`);
  process.exit(failed ? 1 : 0);
})();
