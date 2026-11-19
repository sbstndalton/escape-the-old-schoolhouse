// Tests for class links and the front page. Run with `npm test`, or `node tests/links.js`.
//   - a link round-trips in the browser as in Node, and plays to the certificate;
//   - broken, cut-off and odd links get a plain message and a way back;
//   - link content is untrusted: hostile text never becomes HTML or script, and __preview can't be switched on;
//   - very large content still opens (or is refused plainly);
//   - the front page's two doors work by keyboard; old index.html addresses still reach the game;
//   - nothing is fetched from outside.
const { chromium } = require("playwright");
const assert = require("assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { start } = require("../scripts/serve.js");
const ER = require("../src/shared.js");

const SAMPLE = require("../content/foundations-of-education.json");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "escape-links-"));
const SHOTS = path.join(__dirname, "screenshots");
fs.mkdirSync(SHOTS, { recursive: true });
let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log(`  ✔ ${name}`); }
  catch (e) { failed++; console.log(`  ✘ ${name}\n      ${String(e.stack || e).split("\n").slice(0, 6).join("\n      ")}`); }
}
let base, browser;
async function open(url, { viewport = { width: 1280, height: 900 }, motion = "reduce" } = {}) {
  const ctx = await browser.newContext({ viewport, reducedMotion: motion });
  await ctx.addInitScript(require("./skip-ask.js"));            // a returning visitor: the first-visit prompt is tested in tests/a11y-prompt.js
  const page = await ctx.newPage();
  page.errors = []; page.outside = [];
  page.on("pageerror", e => page.errors.push(e.message));
  page.on("console", m => { if (m.type() === "error") page.errors.push(m.text()); });
  page.on("dialog", d => { page.errors.push("native dialog: " + d.message()); d.dismiss().catch(() => {}); });
  await ctx.route("**/*", route => { const u = route.request().url(); if (u.startsWith(base) || /^(data|blob|about|file):/.test(u)) return route.continue(); page.outside.push(u); return route.abort(); });
  if (url) await page.goto(url);
  return page;
}
const close = async page => { const e = page.errors, o = page.outside; await page.context().close(); assert.deepEqual(e, [], "page errors"); assert.deepEqual(o, [], "requests to other places"); };
const focused = page => page.evaluate(() => { const a = document.activeElement; return a ? (a.id || a.tagName.toLowerCase()) : ""; });
const door = async (page, heading) => { await page.click("#onward"); await page.locator("#stage h2", { hasText: heading }).waitFor(); };

/* An escape room where every text a teacher can write is an attack. */
const P = n => `**<img src=x onerror="window.__pwned=${n}">** *<script>window.__pwned=${n}</script>* [click](javascript:window.__pwned=${n}) <svg onload="window.__pwned=${n}"></svg> "' & </p></div><iframe src="javascript:parent.__pwned=${n}"></iframe>`;
function hostile() {
  let i = 0; const t = () => P(++i);
  return {
    __preview: true, schema: 1,
    meta: { title: t(), course: t(), learningOutcome: t(), codePrefix: t(), lang: '"><script>window.__pwned=99</script>' },
    intro: { heading: t(), story: t() },
    scoring: { mode: "deductions", wrongPenalty: '<img src=x onerror="window.__pwned=77">', hintPenalty: "<b>5</b>", minScore: "x" },
    hintRules: { first: 0, second: 0 },
    finish: { exitPassword: "SAFE1", certificateLine: t(), instructions: t() },
    rooms: [
      { type: "matching", title: t(), story: t(), reference: t(), cluesHeading: t(), lockLabel: t(), successMessage: t(), failMessage: t(), look: "portraits", hintsEnabled: true, hints: [t(), t()],
        cards: [{ term: t(), detail: t(), icon: t(), clue: t(), source: t() }, { term: "B" + t(), detail: t(), clue: t() }, { term: "C" + t(), detail: t() }] },
      { type: "matching", title: t(), look: "books", cards: [{ term: "x" + t(), clue: t() }] },
      { type: "quiz", title: t(), story: t(), lockLabel: t(), hintsEnabled: true, hints: [t()], questions: [{ kind: "short", prompt: t(), answers: "a|" + t() }, { kind: "choice", prompt: t(), choices: [t(), t()], correct: 1 }] },
      { type: "ordering", title: t(), story: t(), lockLabel: t(), items: [{ text: t(), label: t() }, { text: t(), label: t() }] },
      { type: "sorting", title: t(), story: t(), lockLabel: t(), categories: [t(), t()], items: [{ text: t(), category: 0 }, { text: t(), category: 1 }] },
      { type: "constructor", title: t(), story: t() },
      { type: "reflection", title: t(), story: t(), buttonLabel: t(), resultHeading: t(), resultNote: t(),
        profiles: [{ key: '"><img src=x onerror="window.__pwned=55">', name: t(), desc: t(), who: t(), next: t() }, { key: "b", name: t(), desc: t() }],
        questions: [{ prompt: t(), options: [{ text: t(), profile: '"><img src=x onerror="window.__pwned=55">' }, { text: t(), profile: "b" }] }] }
    ]
  };
}
// What must never be in the page, however the content was written.
const unsafe = page => page.evaluate(() => {
  const bad = [];
  if (window.__pwned !== undefined) bad.push("script ran: " + window.__pwned);
  for (const el of document.querySelectorAll("img, iframe, object, embed")) bad.push("element: " + el.outerHTML.slice(0, 80));
  for (const el of document.querySelectorAll("*")) {
    for (const a of el.attributes) if (/^on/i.test(a.name)) bad.push(`handler ${a.name} on ${el.tagName}`);
    const href = el.getAttribute("href"); if (href && /^\s*javascript:/i.test(href)) bad.push("javascript: link");
  }
  for (const s of document.querySelectorAll("script")) if (/__pwned/.test(s.textContent)) bad.push("script element from content");
  for (const s of document.querySelectorAll("svg")) if (s.closest("#stage, #examine") && /__pwned/.test(s.outerHTML)) bad.push("svg from content");
  return bad;
});

(async () => {
  const server = await start(0);
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
  console.log("\nClass links and the front page\n");

  await test("a link made in the browser is the same as one made in Node, and both open", async () => {
    const page = await open(base + "/play.html");
    const [inPage, back] = await page.evaluate(async cfg => { const l = await ER.toLink(cfg, "https://x/play.html"); return [l, await ER.fromLink(l)]; }, SAMPLE);
    assert.equal(inPage, await ER.toLink(SAMPLE, "https://x/play.html"), "the browser and Node write the same link");
    assert.deepEqual(back, SAMPLE);
    assert.deepEqual(await ER.fromLink(inPage), SAMPLE);
    await close(page);
  });

  await test("the sample as a class link plays to the certificate; the page title is the escape room's", async () => {
    const small = JSON.parse(JSON.stringify(SAMPLE)); small.meta.title = "Linked Schoolhouse"; small.finish.exitPassword = "LINKPASS";
    const link = await ER.toLink(small, base + "/play.html");
    const page = await open(link);
    await page.locator("#begin").waitFor();
    assert.equal(await page.title(), "Linked Schoolhouse");
    assert.equal(await page.textContent("#game-title"), "Linked Schoolhouse");
    assert.equal(await page.isVisible("#draft"), true, "the Draft notice follows the link's content");
    await page.fill("#pname", "Link Student"); await page.click("#begin");
    await page.locator("#stage h2", { hasText: "Room 1" }).waitFor();
    await page.fill("#answer", "learn"); await page.click("#try"); await door(page, "Room 2");
    await page.fill("#answer", "9154"); await page.click("#try"); await door(page, "Room 3");
    const order = ["Plato", "Rousseau", "Horace", "Montessori", "Dewey", "Freire", "Adler"], rank = s => order.findIndex(k => s.includes(k));
    for (let pass = 0; pass < 8; pass++) for (let i = 0; i < 6; i++) { const t = await page.$$eval("#order li .t", els => els.map(e => e.textContent));
      if (rank(t[i]) > rank(t[i + 1])) await page.locator("#order li").nth(i).getByRole("button", { name: "Move down" }).click(); }
    await page.click("#try"); await door(page, "Room 4");
    for (let i = 0; i < 8; i++) await page.click(`.seg button[data-i="${i}"][data-v="${i % 2}"]`);
    await page.click("#try"); await door(page, "Room 5");
    for (let q = 0; q < 6; q++) { await page.locator(".qcard:not([hidden]) input").first().check(); await page.click("#try"); }
    await door(page, "You Escaped");
    assert.equal(await page.textContent("#exit-password"), "LINKPASS");
    assert.match(await page.textContent(".cert .name"), /Link Student/);
    // Start over keeps the link
    await page.reload(); await page.locator("#begin").waitFor(); assert.equal(await page.title(), "Linked Schoolhouse");
    await close(page);
  });

  await test("broken links get a plain message, focus on it, and a way back to the front page", async () => {
    const link = await ER.toLink(SAMPLE, base + "/play.html");
    for (const [url, heading] of [[link.slice(0, 900), "This class link is incomplete"], [base + "/play.html#play=", "This class link is incomplete"],
      [base + "/play.html#play=1.@@@@", "This class link is incomplete"], [link.replace("#play=1.", "#play=7."), "This class link was made with a newer version of the escape room maker"],
      [base + "/play.html#play=1." + Buffer.from(require("zlib").deflateRawSync(Buffer.from('{"meta":{"title":"x"},"rooms":[]}'))).toString("base64url"), "This class link doesn't hold a working escape room"]]) {
      const page = await open(url);
      await page.locator("#link-problem").waitFor();
      assert.equal(await page.textContent("#stage h2"), heading, url.slice(-30));
      assert.equal(await focused(page), "h2", "focus is on the message's heading");
      assert.match(await page.textContent("#link-problem"), /Ask your teacher to send it again|Ask your teacher/);
      assert.equal(await page.title(), "The class link didn't open · Escape room");
      assert.equal(await page.isHidden("#doors"), true, "no key ring for rooms that aren't there");
      assert.equal(await page.isHidden("#draft"), true);
      await page.click("#home"); await page.locator("#class-link").waitFor();
      assert.equal(new URL(page.url()).pathname, "/index.html");
      await close(page);
    }
  });

  await test("an exported game file with a broken link offers its own escape room instead (it has no front page)", async () => {
    const template = fs.readFileSync(path.join(__dirname, "../src/game.html"), "utf8").replace("/*__SHARED__*/", () => fs.readFileSync(path.join(__dirname, "../src/shared.js"), "utf8"));
    const file = path.join(TMP, "exported.html"); fs.writeFileSync(file, ER.buildGame(template, SAMPLE));
    assert.doesNotMatch(fs.readFileSync(file, "utf8"), /__ESCAPE_HOME__/);
    const page = await open("file://" + file + "#play=1.abcdefghijk");
    await page.locator("#link-problem").waitFor();
    assert.equal(await page.locator("#home").count(), 0);
    await page.click("#play-file"); await page.locator("#begin").waitFor();
    assert.equal(await page.title(), "Escape the Old Schoolhouse");
    await close(page);
  });

  await test("hostile content in a link never becomes HTML or script, anywhere in the game", async () => {
    const cfg = hostile();
    assert.deepEqual(ER.validate(ER.cleanConfig(cfg)), [], "it is a valid escape room");
    const link = await ER.toLink(cfg, base + "/play.html");
    const page = await open(link, { motion: "no-preference" });
    await page.locator("#begin").waitFor();
    const all = [];
    const check = async where => { for (const b of await unsafe(page)) all.push(`[${where}] ${b}`); };
    const papers = async where => {
      await check(where);
      for (const sel of ["[data-ex]", "#describe"]) for (let i = 0; i < await page.locator("#stage " + sel).count(); i++) {
        await page.locator("#stage " + sel).nth(i).click(); await page.locator("#examine:not([hidden])").waitFor(); await check(`${where}, paper ${sel} ${i}`); await page.keyboard.press("Escape");
      }
    };
    assert.match(await page.textContent(".placard"), /<img src=x onerror=/, "the attack is shown as text");
    assert.match(await page.textContent(".rules"), /Wrong answers cost nothing/, "a penalty that isn't a number counts as none");
    await page.click("#draft"); await papers("title");
    await page.click("#begin");
    for (let n = 1; n <= 7; n++) {
      await page.locator("#stage h2").first().waitFor();
      if (n === 1) { await page.fill("#answer", "zz"); await page.click("#try"); await page.click("#hint-btn"); await page.click("#hint-btn"); }   // wrong try: messages and both hints
      await papers("room " + n);
      await page.evaluate(n => go(n + 1), n); await page.waitForTimeout(200);
    }
    await page.evaluate(() => { const r = ROOMS[6]; S.reflection = { room: r, first: r.profiles[0], second: r.profiles[1] }; go(8); });
    await page.locator("#exit-password").waitFor(); await papers("certificate");
    // the reflection room's option values (profile keys) stay attribute text
    await page.evaluate(() => go(7)); await page.locator("#mf input").first().check(); await page.click("#try"); await check("reflection solved");
    // __preview from a link is ignored: no answers on request, no jumping between rooms
    await page.evaluate(() => { postMessage({ er: "key", on: true }, "*"); postMessage({ er: "goto", room: 2 }, "*"); }); await page.waitForTimeout(300);
    assert.equal(await page.locator("#teacher-key").count(), 0, "no answer strip");
    assert.equal(await page.evaluate(() => PREVIEW), false);
    assert.match(await page.evaluate(() => document.documentElement.lang), /^en$/, "a language that isn't a language tag is ignored");
    assert.deepEqual(all, []);
    await close(page);
  });

  await test("very large content: a long link still opens; an enormous one is refused plainly", async () => {
    const big = { meta: { title: "Big" }, rooms: [{ type: "quiz", title: "Many", story: "y".repeat(40000), questions: Array.from({ length: 300 }, (_, i) => ({ kind: "short", prompt: `Question ${i} ` + "z".repeat(100), answers: "a" })) }] };
    const link = await ER.toLink(big, base + "/play.html");
    let page = await open(link); await page.locator("#begin").waitFor(); await page.click("#begin");
    assert.equal(await page.locator(".slip").count(), 300);
    await close(page);
    const bomb = base + "/play.html#play=1." + Buffer.from(require("zlib").deflateRawSync(Buffer.from(JSON.stringify({ meta: { title: "x" }, rooms: [{ type: "quiz", title: "q", questions: [{ kind: "short", prompt: "p", answers: "a" }] }], pad: " ".repeat(20 * 1024 * 1024) })))).toString("base64url");
    page = await open(bomb); await page.locator("#link-problem").waitFor();
    assert.equal(await page.textContent("#stage h2"), "This class link is too long to open");
    await close(page);
  });

  await test("a new class link pasted into the address bar of an open game is played (the page reloads)", async () => {
    const page = await open(base + "/play.html"); await page.locator("#begin").waitFor();
    assert.equal(await page.title(), "Escape the Old Schoolhouse");
    const link = await ER.toLink({ meta: { title: "Second one" }, rooms: [{ type: "quiz", title: "Q", questions: [{ kind: "short", prompt: "p", answers: "a" }] }] }, "");
    await Promise.all([page.waitForEvent("load"), page.evaluate(h => { location.hash = h; }, link)]);
    await page.locator("#begin").waitFor(); assert.equal(await page.title(), "Second one");
    await close(page);
  });

  await test("old addresses: index.html#play=… goes on to play.html with the same link; the root is the front page", async () => {
    const link = await ER.toLink({ meta: { title: "Old bookmark" }, rooms: [{ type: "quiz", title: "Q", questions: [{ kind: "short", prompt: "p", answers: "a" }] }] }, "");
    let page = await open(base + "/index.html" + link);
    await page.locator("#begin").waitFor();
    assert.equal(new URL(page.url()).pathname, "/play.html"); assert.equal(new URL(page.url()).hash, link);
    assert.equal(await page.title(), "Old bookmark");
    await close(page);
    page = await open(base + "/"); await page.locator("#student-h").waitFor();
    assert.equal(await page.title(), "Escape the Old Schoolhouse: escape rooms for your class");
    assert.equal(await page.getAttribute("#play-sample", "href"), "play.html", "the old game is one press away");
    await close(page);
  });

  await test("the front page's two doors, by keyboard alone", async () => {
    const link = await ER.toLink({ meta: { title: "Keyboard link" }, rooms: [{ type: "quiz", title: "Q", questions: [{ kind: "short", prompt: "p", answers: "a" }] }] }, "https://example.org/somewhere/play.html");
    const page = await open(base + "/");
    await page.evaluate(() => { window.__mouse = 0; ["pointerdown", "mousedown"].forEach(t => addEventListener(t, () => window.__mouse++, true)); });
    // structure: one h1, the two doors are headed regions, in reading order
    assert.equal(await page.locator("h1").count(), 1);
    assert.deepEqual(await page.$$eval("h2", hs => hs.map(h => h.textContent)), ["I'm a student", "I'm a teacher"]);
    assert.deepEqual(await page.$$eval("a[href], button, input", els => els.map(e => e.id || e.className)),
      ["skip", "class-link", "open-link", "play-sample", "make", "open-saved", "guide-link", "a11y-link", "contrast-toggle", "readable-toggle", "a11y-options"], "Tab order is reading order");
    const tabs = []; for (let i = 0; i < 11; i++) { await page.keyboard.press("Tab"); tabs.push(await focused(page)); }
    assert.deepEqual(tabs, ["a", "class-link", "open-link", "play-sample", "make", "open-saved", "guide-link", "a11y-link", "contrast-toggle", "readable-toggle", "a11y-options"]);
    // an empty box and a cut-off link: a plain error on the box, focus stays there
    await page.focus("#class-link"); await page.keyboard.press("Enter");
    assert.equal(await page.textContent("#link-error"), "Paste your class link in the box first.");
    assert.equal(await page.getAttribute("#class-link", "aria-invalid"), "true");
    assert.match(await page.getAttribute("#class-link", "aria-describedby"), /link-error/);
    assert.match(await page.title(), /^Error: /);
    assert.equal(await focused(page), "class-link");
    await page.keyboard.insertText(link.slice(0, 60)); await page.keyboard.press("Enter");
    await page.waitForFunction(() => /incomplete/.test(document.querySelector("#link-error").textContent));
    assert.equal(await page.textContent("#link-error"), "This class link is incomplete. Ask your teacher to send it again.");
    await page.fill("#class-link", "my teacher said to come here"); await page.keyboard.press("Enter");
    assert.match(await page.textContent("#link-error"), /doesn't look like a class link/);
    // the whole link (from another address, with words around it): opens here, never elsewhere
    await page.fill("#class-link", ""); await page.keyboard.insertText(`Link: ${link} `); await page.keyboard.press("Enter");
    await page.locator("#begin").waitFor();
    assert.equal(new URL(page.url()).origin + new URL(page.url()).pathname, base + "/play.html");
    assert.equal(await page.title(), "Keyboard link");
    // the sample
    await page.goto(base + "/"); await page.focus("#play-sample"); await page.keyboard.press("Enter");
    await page.locator("#begin").waitFor(); assert.equal(await page.title(), "Escape the Old Schoolhouse");
    // the teacher's door: the guided steps, and "Open one I saved before" with that choice made
    await page.goto(base + "/"); await page.focus("#make"); await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.getElementById("wiz-h1")); assert.match(await page.textContent("#wiz-h1"), /Make an escape room for your class/);
    assert.equal(await page.getAttribute("#wiz-home", "href"), "index.html", "the maker links back to the front page");
    await page.goto(base + "/"); await page.focus("#open-saved"); await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.getElementById("wiz-h1") && /How do you want to start/.test(document.getElementById("wiz-h1").textContent));
    assert.equal(await page.isChecked("#start-file"), true);
    assert.equal(await page.isVisible("#wiz-link-paste"), true, "a class link can be pasted there");
    // display switches, remembered and shared with the game
    await page.goto(base + "/"); await page.focus("#contrast-toggle"); await page.keyboard.press("Enter");
    assert.equal(await page.getAttribute("html", "data-contrast"), "more"); assert.equal(await page.getAttribute("#contrast-toggle", "aria-checked"), "true");
    await page.goto(base + "/play.html"); assert.equal(await page.getAttribute("html", "data-contrast"), "more", "the game follows");
    await page.goto(base + "/"); await page.click("#contrast-toggle"); assert.equal(await page.getAttribute("html", "data-contrast"), "normal");
    assert.equal(await page.evaluate(() => window.__mouse || 0), 0);
    await page.screenshot({ path: path.join(SHOTS, "front-1280.png"), fullPage: true });
    await close(page);
  });

  await test("the front page says what to press, the privacy line and the accessibility statement", async () => {
    const page = await open(base + "/", { viewport: { width: 390, height: 844 } });
    const text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, " ");
    for (const re of [/I'm a student/, /I'm a teacher/, /Open my escape room/, /Play the sample escape room/, /Make an escape room/, /Open one I saved before/, /Printable quick-start guide/,
      /You make it/, /You share a class link/, /Students type the exit password into your quiz/, /Moodle, Canvas, Google Classroom or an email/,
      /nothing is sent anywhere. The escape room travels inside the link itself/, /never reaches a web server/]) assert.match(text, re);
    assert.doesNotMatch(text, /GitHub/i, "no GitHub on the front page");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "no sideways scrolling on a phone");
    await page.screenshot({ path: path.join(SHOTS, "front-390.png"), fullPage: true });
    await page.click("#a11y-link"); await page.locator("main#statement h1").waitFor();
    assert.equal(await page.title(), "Accessibility statement: Escape the Old Schoolhouse");
    assert.equal(await page.textContent("h1"), "Accessibility");
    for (const id of ["known-limitations", "what-goes-beyond-aa", "two-ways-to-measure-contrast"]) assert.equal(await page.locator("#" + id).count(), 1, "heading anchor " + id);
    assert.ok(await page.locator("table").count() > 5);
    assert.equal(await page.getAttribute("#home", "href"), "index.html");
    await close(page);
  });

  await browser.close(); server.close();
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`\n${passed} passed, ${failed} failed.`);
  process.exit(failed ? 1 : 0);
})();
