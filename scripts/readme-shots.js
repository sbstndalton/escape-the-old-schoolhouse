// Takes the pictures in README.md, from the built files, into docs/images/.
// Run `npm run build` first, then `node scripts/readme-shots.js`. Retake them after a visible change.
// Each picture is saved as WebP (turned from Playwright's PNG by the browser's own encoder, so nothing
// extra needs installing). Run with `--only <text>` to retake only the pictures whose name contains it.
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const { start } = require("./serve.js");

const OUT = path.join(__dirname, "..", "docs", "images");
fs.mkdirSync(OUT, { recursive: true });
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : "";
const DESKTOP = { width: 1280, height: 800 }, PHONE = { width: 390, height: 844 };
const QUALITY = 0.86;
const LIBRARY = "learn";                      // the sample's answers (see README.md, "The sample escape room")
const ORDER = ["Plato", "Rousseau", "Horace", "Montessori", "Dewey", "Freire", "Adler"];
const OBSERVATIONS = [0, 1, 0, 1, 0, 1, 0, 1];

let browser, base, encoder;
const made = [];

// A returning visitor, so the first-visit accessibility window stays shut (except for the one picture of it).
const skipAsk = () => { try { localStorage.setItem("escape-room-a11y-asked", "x"); } catch (e) {} };

// Reduced motion keeps every picture still (no door or fade caught halfway).
async function open(url, { viewport = DESKTOP, ask = false, motion = "reduce" } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: motion, acceptDownloads: true });
  if (!ask) await ctx.addInitScript(skipAsk);
  // Nothing from outside, ever (the site makes no outside requests anyway).
  await ctx.route("**/*", r => (r.request().url().startsWith(base) || /^(data|blob|about):/.test(r.request().url()) ? r.continue() : r.abort()));
  const page = await ctx.newPage();
  page.on("dialog", d => d.accept().catch(() => {}));
  if (url) await page.goto(base + url);
  await page.evaluate(() => document.fonts.ready);
  return page;
}

// Save a screenshot (a PNG buffer) as WebP.
async function save(name, png) {
  const data = await encoder.evaluate(async ([b64, q]) => {
    const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
    const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext("2d").drawImage(img, 0, 0);
    return c.toDataURL("image/webp", q).split(",")[1];
  }, [png.toString("base64"), QUALITY]);
  const file = path.join(OUT, name + ".webp");
  fs.writeFileSync(file, Buffer.from(data, "base64"));
  made.push([name + ".webp", fs.statSync(file).size]);
}
const want = name => !only || name.includes(only);
const settle = page => page.waitForTimeout(1000);          // past any room change or fade
const heading = (page, text) => page.waitForFunction(t => { const h = document.getElementById("wiz-h1"); return h && h.textContent.includes(t); }, text, { timeout: 8000 });
const room = (page, text) => page.locator("#stage h2", { hasText: text }).waitFor();
// Press OK on every slip the maker asks (the exit password, the not-yet-checked items).
async function okAll(page) {
  for (let i = 0; i < 4; i++) {
    const ok = page.locator(".modal #ask-ok");
    try { await ok.waitFor({ timeout: 1500 }); } catch (e) { return; }
    await ok.click(); await page.waitForTimeout(200);
  }
}
// The maker, on the sample, as a teacher who has just started.
async function makerWithSample() {
  const page = await open("/editor.html");
  await heading(page, "Make an escape room for your class");
  await page.click("#wiz-continue"); await heading(page, "How do you want to start?");
  await page.click("label[for=start-sample]"); await page.click("#wiz-continue"); await heading(page, "What is this escape room called?");
  return page;
}
// Scroll the maker's sheet so an element is near the top, then take the window.
async function shotAt(page, name, sel, { offset = 24 } = {}) {
  await page.evaluate(([s, o]) => { const el = document.querySelector(s); const y = el.getBoundingClientRect().top + scrollY - o; scrollTo(0, Math.max(0, y)); }, [sel, offset]);
  await page.waitForTimeout(300);
  await save(name, await page.screenshot());
}
async function solveTimeline(page) {
  const rank = s => ORDER.findIndex(k => s.includes(k));
  for (let pass = 0; pass < 8; pass++) for (let i = 0; i < 6; i++) {
    const t = await page.$$eval("#order li .t", els => els.map(e => e.textContent));
    if (rank(t[i]) > rank(t[i + 1])) await page.locator("#order li").nth(i).getByRole("button", { name: "Move down" }).click();
  }
}

const SHOTS = {
  // 1. The front page and its two doors.
  async "front-page"() {
    const page = await open("/");
    await save("front-page", await page.screenshot());
    await page.context().close();
  },
  // 2. The first-visit accessibility window (the only picture that lets it open).
  async "first-visit"() {
    const page = await open("/", { ask: true, motion: "no-preference" });   // so Motion shows as an ordinary switch
    await page.locator("#a11y-ask").waitFor(); await settle(page);
    await save("first-visit", await page.screenshot());
    await page.context().close();
  },
  // 3. The maker's Welcome step.
  async "maker-welcome"() {
    const page = await open("/editor.html");
    await heading(page, "Make an escape room for your class"); await settle(page);
    await save("maker-welcome", await page.screenshot());
    await page.context().close();
  },
  // 4. Writing quiz questions (a question room added to the sample).
  async "maker-questions"() {
    const page = await makerWithSample();
    await page.goto(base + "/editor.html#step=add"); await heading(page, "What kind of puzzle");
    await page.click("label[for=kind-quiz]"); await page.click("#wiz-continue"); await heading(page, "Write your questions");
    await page.fill("#q1-prompt", "Who wrote Democracy and Education (1916)?");
    await page.fill("#q1-a0", "John Dewey");
    await page.click("#q1-add-a"); await page.fill("#q1-a1", "Dewey");
    await page.click("#wiz-add-q");
    await page.fill("#q2-prompt", "Which philosophy is built around the Great Books?");
    await page.click("label[for=q2-kind-choice]");
    await page.fill("#q2-c0", "Essentialism"); await page.fill("#q2-c1", "Perennialism");
    await page.check("#q2-ok1");
    await page.focus("#wiz-h1"); await settle(page);
    await shotAt(page, "maker-questions", "#wiz-sheet");
    await page.context().close();
  },
  // 5. Check your facts.
  async "maker-facts"() {
    const page = await makerWithSample();
    await page.goto(base + "/editor.html#step=facts"); await heading(page, "Check your facts");
    await page.fill("#f1-cards-1-src", "Course textbook, ch. 3, p. 45");
    await page.check("#f1-cards-1-ok");
    await page.focus("#wiz-h1"); await settle(page);
    await shotAt(page, "maker-facts", "#wiz-sheet");
    await page.context().close();
  },
  // 6. How students get it, with "Share a class link" chosen; 7. the class link and its Copy link button.
  async "maker-deliver"() {
    const page = await makerWithSample();
    await page.goto(base + "/editor.html#step=deliver"); await heading(page, "How will your students get to the escape room?");
    await page.click("label[for=where-link]"); await page.focus("#wiz-h1"); await settle(page);
    await shotAt(page, "maker-deliver", "#wiz-sheet");
    await page.click("#wiz-continue"); await heading(page, "Share a class link");
    await page.click("#wiz-make-link"); await okAll(page); await page.locator("#wiz-link").waitFor();
    await page.evaluate(() => { document.activeElement.blur(); getSelection().removeAllRanges(); document.getElementById("wiz-link").scrollTop = 0; }); await settle(page);
    // Show the address teachers see on the website, not this script's local one (only the picture changes).
    await page.evaluate(site => { const t = document.getElementById("wiz-link"); t.value = t.value.replace(/^https?:\/\/[^/]+\//, site); }, require("../src/shared.js").SITE);
    await shotAt(page, "maker-link", "#wiz-h1", { offset: 90 });
    await page.context().close();
  },
  // 8. The printable quick-start guide.
  async "guide"() {
    const page = await open("/guide.html");
    await settle(page);
    await save("guide", await page.screenshot());
    await page.context().close();
  },
  // 9. What students see: the title screen, the Library (books and the padlock), the certificate.
  async "game"() {
    const page = await open("/play.html");
    await page.locator("#begin").waitFor();
    await page.fill("#pname", "Sam"); await settle(page);
    if (want("game-title")) await save("game-title", await page.screenshot());
    await page.click("#begin"); await room(page, "Room 1"); await settle(page);
    if (want("game-library")) await save("game-library", await page.screenshot());
    await page.fill("#answer", LIBRARY); await page.click("#try"); await page.click("#onward"); await room(page, "Room 2");
    await page.fill("#answer", "9154"); await page.click("#try"); await page.click("#onward"); await room(page, "Room 3");
    await solveTimeline(page); await page.click("#try"); await page.click("#onward"); await room(page, "Room 4");
    for (let i = 0; i < 8; i++) await page.click(`.seg button[data-i="${i}"][data-v="${OBSERVATIONS[i]}"]`);
    await page.click("#try"); await page.click("#onward"); await room(page, "Room 5");
    for (let i = 0; i < 6; i++) { await page.locator(`input[name=q${i}]`).nth(2).check(); await page.click("#try"); }
    await page.click("#onward"); await room(page, "You Escaped");
    await page.locator("#exit-password").scrollIntoViewIfNeeded(); await settle(page);
    if (want("game-certificate")) await save("game-certificate", await page.screenshot());
    await page.context().close();
  },
  // 10. A room on a phone.
  async "phone-room"() {
    const page = await open("/play.html", { viewport: PHONE });
    await page.fill("#pname", "Sam"); await page.click("#begin"); await room(page, "Room 1");
    await page.fill("#answer", LIBRARY); await page.click("#try"); await page.click("#onward"); await room(page, "Room 2"); await settle(page);
    await save("phone-room", await page.screenshot());
    await page.context().close();
  },
  // The maker on a phone.
  async "phone-maker"() {
    const page = await open("/editor.html", { viewport: PHONE });
    await heading(page, "Make an escape room for your class"); await settle(page);
    await save("phone-maker", await page.screenshot());
    await page.context().close();
  }
};

(async () => {
  if (!fs.existsSync(path.join(__dirname, "..", "play.html"))) { console.error("Run `npm run build` first."); process.exit(1); }
  const server = await start(0);
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
  encoder = await browser.newPage();
  for (const [name, fn] of Object.entries(SHOTS)) if (want(name) || (name === "game" && /game/.test(only))) await fn();
  await browser.close(); server.close();
  let total = 0;
  for (const [n, s] of made) { total += s; console.log(`  ${n.padEnd(24)} ${(s / 1024).toFixed(0).padStart(4)} KB`); }
  console.log(`  ${"total".padEnd(24)} ${(total / 1024).toFixed(0).padStart(4)} KB  in docs/images/`);
})().catch(e => { console.error(e); process.exit(1); });
