// Tests for the teachers' printable quick-start guide (guide.html) and the teacher card. Run with `npm test`, or `node tests/guide.js`.
//   - the guide loads with nothing fetched from outside, has its Print this guide button, the site's address and a QR code of it;
//   - printed, it is exactly one page on US Letter and on A4 (also with Readable text and High contrast switched on);
//   - the front page, the guided steps (Welcome, the hub, every "Help with this step") and Advanced mode link to it;
//   - every button or field name it cites (class "ui") is a real label in the front page or the maker, found by walking them;
//     the course-system menu names it cites (class "lms") are the maker's own walkthrough words;
//   - the guided steps' Done page prints a one-page teacher card with the name, rooms, exit password and last backup.
const { chromium } = require("playwright");
const assert = require("assert/strict");
const fs = require("fs");
const path = require("path");
const { start } = require("../scripts/serve.js");
const ER = require("../src/shared.js");

const SHOTS = path.join(__dirname, "screenshots");
fs.mkdirSync(SHOTS, { recursive: true });
let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log(`  ✔ ${name}`); }
  catch (e) { failed++; console.log(`  ✘ ${name}\n      ${String(e.stack || e).split("\n").slice(0, 6).join("\n      ")}`); }
}
let base, browser;
async function open(url, { viewport = { width: 1280, height: 900 } } = {}) {
  const ctx = await browser.newContext({ viewport, reducedMotion: "reduce", acceptDownloads: true });
  await ctx.addInitScript(require("./skip-ask.js"));            // a returning visitor: the first-visit prompt is tested in tests/a11y-prompt.js
  const page = await ctx.newPage();
  page.errors = []; page.outside = [];
  page.on("pageerror", e => page.errors.push(e.message));
  page.on("console", m => { if (m.type() === "error") page.errors.push(m.text()); });
  page.on("dialog", d => { if (d.type() === "beforeunload") return d.accept().catch(() => {}); page.errors.push("native dialog: " + d.message()); d.dismiss().catch(() => {}); });
  await ctx.route("**/*", route => { const u = route.request().url(); if (u.startsWith(base) || /^(data|blob|about|file):/.test(u)) return route.continue(); page.outside.push(u); return route.abort(); });
  if (url) await page.goto(url);
  return page;
}
const close = async page => { const e = page.errors, o = page.outside; await page.context().close(); assert.deepEqual(e, [], "page errors"); assert.deepEqual(o, [], "requests to other places"); };
// How many pages a PDF made by Chromium has.
const pages = pdf => (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
const heading = (page, text) => page.waitForFunction(t => { const h = document.getElementById("wiz-h1"); return h && h.textContent.includes(t); }, text, { timeout: 5000 });
const squash = t => t.replace(/\s+/g, " ").trim();

(async () => {
  const server = await start(0);
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
  console.log("\nQuick-start guide and teacher card tests\n");

  await test("the guide loads with nothing from outside: heading, the site's address, its QR code, and a Print this guide button", async () => {
    const page = await open(base + "/guide.html");
    assert.equal(await page.title(), "Quick-start guide for teachers: Escape the Old Schoolhouse");
    assert.equal(await page.locator("h1").count(), 1);
    assert.equal(await page.textContent("h1"), "Quick-start guide for teachers");
    assert.equal(await page.textContent("#site-address"), ER.SITE);
    assert.equal(await page.getAttribute("#site-qr svg", "role"), "img");
    assert.match(await page.getAttribute("#site-qr svg", "aria-label"), /QR code of the site's address/);
    assert.equal(await page.getAttribute("#site-qr svg path", "d"), ER.qrSvg(ER.SITE).match(/ d="([^"]+)"/)[1], "the QR code is the site's address");
    // seven numbered steps, the box, and the three troubles
    assert.equal(await page.locator("ol.steps > li").count(), 7);
    assert.deepEqual(await page.$$eval("ol.steps h3", hs => hs.map(h => h.textContent)), ["Open the maker", "Follow the steps (about 30 to 45 minutes)", "Check your facts",
      "Try it as a student", "Share a class link", "Make the one-question exit-password quiz", "Keep your backup"]);
    assert.equal(await page.textContent("#saved-h"), "Your work is saved in this browser only");
    assert.equal(await page.locator("#trouble dt").count(), 3);
    const text = squash(await page.evaluate(() => document.body.innerText));
    for (const word of [/\brepository\b/i, /\bexport/i, /\bSCORM\b/, /\bconfig/i, /GitHub/]) assert.doesNotMatch(text.replace(ER.SITE, ""), word, "plain words: " + word);
    assert.match(text, /Menus can differ by version/);
    // the button prints (window.print is the browser's own dialog: it is replaced here so the test can see the call)
    await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
    assert.equal(await page.textContent("#print-guide"), "Print this guide");
    await page.focus("#print-guide"); await page.keyboard.press("Enter");
    assert.equal(await page.evaluate(() => window.__printed), 1, "Print this guide calls window.print()");
    assert.equal(await page.getAttribute("#home", "href"), "index.html");
    assert.equal(await page.getAttribute("#open-maker", "href"), "editor.html");
    await page.screenshot({ path: path.join(SHOTS, "guide-1440.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "no sideways scrolling on a phone");
    await page.screenshot({ path: path.join(SHOTS, "guide-390.png"), fullPage: true });
    await close(page);
  });

  await test("printed, the guide is one page on US Letter and on A4, black on white, with no buttons or site links", async () => {
    for (const [look, prefs] of [["normal", {}], ["Readable text and High contrast", { "escape-room-readable": "on", "escape-room-contrast": "on" }]]) {
      const page = await open(base + "/guide.html");
      if (Object.keys(prefs).length) { await page.evaluate(p => Object.entries(p).forEach(([k, v]) => localStorage.setItem(k, v)), prefs); await page.reload(); }
      for (const format of ["Letter", "A4"]) {
        const pdf = await page.pdf({ format });
        assert.equal(pages(pdf), 1, `${format}, ${look}: one page`);
        if (look === "normal") fs.writeFileSync(path.join(SHOTS, `guide-${format}.pdf`), pdf);
      }
      await page.emulateMedia({ media: "print" });
      const seen = await page.evaluate(() => ({
        bg: getComputedStyle(document.body).backgroundColor, ink: getComputedStyle(document.body).color, sheet: getComputedStyle(document.querySelector(".sheet")).backgroundImage,
        hidden: [".acts", ".top", ".skip"].map(s => getComputedStyle(document.querySelector(s)).display) }));
      assert.equal(seen.bg, "rgb(255, 255, 255)", look); assert.equal(seen.ink, "rgb(0, 0, 0)", look); assert.equal(seen.sheet, "none", "no paper texture when printed");
      assert.deepEqual(seen.hidden, ["none", "none", "none"], "no button or site links on paper");
      await close(page);
    }
  });

  await test("the front page, the guided steps and Advanced mode link to the guide", async () => {
    const page = await open(base + "/");
    assert.equal(await page.textContent("#guide-link"), "Printable quick-start guide");
    assert.ok(await page.locator("#teacher #guide-link").count(), "on the teacher's door");
    await page.focus("#guide-link"); await page.keyboard.press("Enter");
    await page.locator("#print-guide").waitFor(); assert.equal(new URL(page.url()).pathname, "/guide.html");
    // the maker: in a new tab, so leaving the maker never asks about unsaved work
    const inMaker = async sel => {
      const a = page.locator(sel);
      assert.equal(await a.getAttribute("href"), "guide.html", sel); assert.equal(await a.getAttribute("target"), "_blank", sel);
      assert.match(squash(await a.textContent()), /^Printable quick-start guide \(opens in a new tab\)$/, sel);
    };
    await page.goto(base + "/editor.html"); await heading(page, "Make an escape room for your class");
    await inMaker("#wiz-guide"); await inMaker("#wiz-help-guide");
    const [tab] = await Promise.all([page.context().waitForEvent("page"), page.click("#wiz-guide")]);
    await tab.locator("#print-guide").waitFor(); await tab.close();
    // every step's "Help with this step" carries it
    await page.click("#wiz-continue"); await heading(page, "How do you want to start?");
    await page.click("label[for=start-sample]"); await page.click("#wiz-continue"); await heading(page, "What is this escape room called?"); await inMaker("#wiz-help-guide");
    await page.goto(base + "/editor.html#step=hub"); await heading(page, "Your escape room"); await inMaker("#wiz-guide");
    await page.goto(base + "/editor.html?mode=advanced"); await page.locator("#adv-guide").waitFor(); await inMaker("#adv-guide");
    await close(page);
  });

  await test("every name the guide cites is a real label in the front page or the maker", async () => {
    const guide = await open(base + "/guide.html");
    const ui = [...new Set(await guide.$$eval(".ui", els => els.map(e => e.textContent.replace(/\s+/g, " ").trim())))];
    const lms = [...new Set(await guide.$$eval(".lms", els => els.map(e => e.textContent.replace(/\s+/g, " ").trim())))];
    const question = squash(await guide.textContent("#quiz-question"));
    await close(guide);
    assert.ok(ui.length >= 20, "the guide cites the interface: " + ui.length);
    // Walk the front page and the maker the way the guide says, collecting the names of everything you can press or fill in.
    const page = await open(base + "/");
    const seen = new Set();
    const collect = () => page.evaluate(() => [...document.querySelectorAll("button, a, label, summary, h1, h2, h3, legend, .wopt b, .tasks a, .pull .t")]
      .filter(el => el.getClientRects().length).map(el => { const c = el.cloneNode(true); c.querySelectorAll(".sr").forEach(x => x.remove()); return c.textContent.replace(/\s+/g, " ").trim(); }));
    const take = async () => (await collect()).forEach(t => seen.add(t));
    await take();
    await page.click("#make"); await heading(page, "Make an escape room for your class"); await take();
    await page.click("#wiz-continue"); await heading(page, "How do you want to start?"); await take();
    await page.click("label[for=start-file]"); await take();
    await page.click("label[for=start-sample]"); await page.click("#wiz-continue"); await heading(page, "What is this escape room called?"); await take();
    await page.fill("#wiz-title", "Guide test"); await page.click("#wiz-continue"); await heading(page, "Your rooms");
    await page.goto(base + "/editor.html#step=facts"); await heading(page, "Check your facts"); await take();
    await page.goto(base + "/editor.html#step=try"); await heading(page, "Try it as a student"); await take();
    await page.click("#wiz-try"); await page.locator("#preview-exit").waitFor(); await take();
    await page.keyboard.press("Escape"); await page.locator("#preview-exit").waitFor({ state: "detached" });
    await page.goto(base + "/editor.html#step=deliver"); await heading(page, "How will your students get to the escape room?"); await take();
    await page.click("label[for=where-link]"); await page.click("#wiz-continue"); await heading(page, "Share a class link"); await take();
    await page.click("#wiz-make-link"); await page.click("#ask-ok"); await page.click("#ask-ok"); await page.locator("#wiz-link").waitFor(); await take();
    assert.equal(squash(await page.textContent("#wiz-quiz-q")), question, "the quiz question is word for word the maker's");
    await page.goto(base + "/editor.html#step=name"); await heading(page, "What is this escape room called?"); await page.fill("#wiz-title", "Guide test, changed");
    await page.goto(base + "/editor.html#step=walk"); await heading(page, "Share a class link"); await page.locator("#wiz-link-stale").waitFor(); await take();
    await page.goto(base + "/editor.html#step=hub"); await heading(page, "Your escape room"); await take();
    await page.click("#wiz-advanced"); await page.locator("#page-title").waitFor(); await take();
    await page.click("#nav .pull:has-text('Finish & grading')"); await page.locator("#page-title", { hasText: "Finish & grading" }).waitFor(); await take();
    const missing = ui.filter(t => !seen.has(t));
    assert.deepEqual(missing, [], "names in the guide that aren't on any button, link, field or heading");
    const words = squash(fs.readFileSync(path.join(__dirname, "..", "editor.html"), "utf8"));
    assert.deepEqual(lms.filter(t => !words.includes(`B("${t}")`)), [], "course-system menu names are the maker's walkthrough words");
    await close(page);
  });

  await test("Done: Print a card for this escape room shows a one-page card with the name, rooms, exit password and last backup", async () => {
    const page = await open(base + "/editor.html");
    await page.click("#wiz-continue"); await heading(page, "How do you want to start?");
    await page.click("label[for=start-sample]"); await page.click("#wiz-continue"); await heading(page, "What is this escape room called?");
    await page.fill("#wiz-title", "Card test <b>bold</b>"); await page.click("#wiz-continue"); await heading(page, "Your rooms");
    await page.goto(base + "/editor.html#step=deliver"); await heading(page, "How will your students get to the escape room?");
    await page.click("label[for=where-link]"); await page.click("#wiz-continue"); await heading(page, "Share a class link");
    await page.click("#wiz-make-link"); await page.fill("#ask-password", "CARDTEST7"); await page.click("#ask-ok"); await page.click("#ask-ok"); await page.locator("#wiz-link").waitFor();
    await page.goto(base + "/editor.html#step=done"); await heading(page, "Your escape room is ready");
    await Promise.all([page.waitForEvent("download"), page.click("#wiz-done-backup")]);
    assert.equal(squash(await page.textContent("#wiz-card")), "Print a card for this escape room");
    await page.focus("#wiz-card"); await page.keyboard.press("Enter");
    const card = page.frameLocator(".overlay iframe");
    await card.locator("h1").waitFor();
    assert.equal(await page.locator(".overlay[role=dialog]").count(), 1);
    assert.equal(await card.locator("h1").textContent(), "Teacher card: Card test <b>bold</b>", "the name is text, never markup");
    const text = squash(await card.locator("body").innerText());
    for (const re of [/Exit password CARDTEST7/, /Type the exit password from the certificate at the end of the escape room\./, /The Library \(Match clues to cards\)/,
      /The Mirror \(Reflection \(no wrong answers\)\)/, /How students get it A class link Class link made on /, /Last backup [A-Z][a-z]+ \d{1,2}, \d{4}/,
      /Keep it away from students/, /How to change it later/, /Open one I saved before/, /Make a new class link and share it instead/, new RegExp(ER.SITE.replace(/[.]/g, "\\.") + "guide\\.html")])
      assert.match(text, re);
    // the Print button prints the card's own frame
    await page.locator(".overlay iframe").evaluate(f => { f.contentWindow.__printed = 0; f.contentWindow.print = () => { f.contentWindow.__printed++; }; });
    await page.click("#card-print");
    assert.equal(await page.locator(".overlay iframe").evaluate(f => f.contentWindow.__printed), 1);
    await page.screenshot({ path: path.join(SHOTS, "teacher-card.png") });
    // one page on Letter and A4
    const html = await page.locator(".overlay iframe").evaluate(f => f.srcdoc);
    const sheet = await page.context().newPage();
    await sheet.setContent(html);
    for (const format of ["Letter", "A4"]) assert.equal(pages(await sheet.pdf({ format })), 1, format);
    await sheet.close();
    await page.keyboard.press("Escape"); await page.locator(".overlay").waitFor({ state: "detached" });
    assert.equal(await page.evaluate(() => document.activeElement.id), "wiz-card", "focus goes back to the button");
    await close(page);
  });

  await browser.close(); server.close();
  console.log(`\n${passed} passed, ${failed} failed.`);
  process.exit(failed ? 1 : 0);
})();
