// Tests for the game's Read aloud buttons. Run with `npm test`, or `node tests/read-aloud.js`.
// Headless browsers have no usable voices, so speech is mocked (tests/speech-mock.js): the mock offers an online
// voice and local ones, and records every utterance. Real voices must be checked by hand (see ACCESSIBILITY.md).
const { chromium } = require("playwright");
const assert = require("assert/strict");
const path = require("path");
const fs = require("fs");
const { start } = require("../scripts/serve.js");
const ER = require("../src/shared.js");
const speechMock = require("./speech-mock.js");

const SHOTS = path.join(__dirname, "screenshots");
fs.mkdirSync(SHOTS, { recursive: true });
let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log(`  ✔ ${name}`); }
  catch (e) { failed++; console.log(`  ✘ ${name}\n      ${String(e.stack || e).split("\n").slice(0, 6).join("\n      ")}`); }
}
let base, browser;
async function open({ url = "/play.html", mock = {}, viewport = { width: 1280, height: 900 }, init = null } = {}) {
  const ctx = await browser.newContext({ viewport, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  page.errors = []; page.outside = [];
  page.on("pageerror", e => page.errors.push(e.message));
  page.on("console", m => { if (m.type() === "error") page.errors.push(m.text()); });
  await ctx.route("**/*", route => { const u = route.request().url(); if (u.startsWith(base) || /^(data|blob|about):/.test(u)) return route.continue(); page.outside.push(u); return route.abort(); });
  await page.addInitScript(require("./skip-ask.js"));
  if (mock) await page.addInitScript(speechMock, mock);
  if (init) await page.addInitScript(init);
  await page.goto(url.startsWith("http") ? url : base + url);
  return page;
}
const close = async page => { const e = page.errors, o = page.outside; await page.context().close(); assert.deepEqual(e, [], "page errors"); assert.deepEqual(o, [], "requests to other places"); };
const spoken = page => page.evaluate(() => window.__spoken.map(s => s.text).join(" | "));
const waitQuiet = page => page.waitForFunction(() => !document.querySelector(".listen[data-reading]"), null, { timeout: 5000 });
const visibleListens = page => page.locator(".listen:visible").count();

(async () => {
  const server = await start(0);
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
  console.log("\nRead aloud: tests (speech is mocked)\n");

  await test("only a voice that works on the device is used, in the content's language", async () => {
    const page = await open();
    await page.locator(".story .listen").waitFor();
    await page.click(".story .listen"); await waitQuiet(page);
    const v = await page.evaluate(() => [...new Set(window.__spoken.map(s => s.voice + "/" + s.lang))]);
    assert.deepEqual(v, ["Local English (UK)/en-GB"], "never the online Google voice, never the German one");
    await close(page);
    // only online voices: no buttons, and the notebook says why
    const online = await open({ mock: { voices: [{ name: "Google US English", lang: "en-US", localService: false, default: true }] } });
    await online.locator("#begin").waitFor(); await online.waitForTimeout(400);
    assert.equal(await visibleListens(online), 0, "no Listen buttons with only online voices");
    await online.click("#watch");
    assert.match(await online.textContent("#read-why"), /isn’t available in this browser/);
    assert.equal(await online.isVisible("#read-why"), true); assert.equal(await online.isVisible("#read-toggle"), false);
    await close(online);
    // a German escape room picks the German local voice
    const de = await ER.toLink({ meta: { title: "Raum", lang: "de" }, rooms: [{ type: "quiz", title: "Eins", story: "Ein kurzer Text. Noch ein Satz.", questions: [{ kind: "short", prompt: "Wer?", answers: "Dewey" }] }] }, base + "/play.html");
    const g = await open({ url: de }); await g.click("#begin"); await g.locator(".story .listen").waitFor(); await g.click(".story .listen"); await waitQuiet(g);
    assert.deepEqual(await g.evaluate(() => [...new Set(window.__spoken.map(s => s.voice))]), ["Local Deutsch"]);
    assert.equal(await g.evaluate(() => window.__spoken.length), 2, "read a sentence at a time");
    await close(g);
  });

  await test("voices that arrive late (voiceschanged) still bring the buttons", async () => {
    const page = await open({ mock: { late: 700 } });
    await page.locator("#begin").waitFor();
    assert.equal(await visibleListens(page), 0, "nothing before there is a voice");
    await page.locator(".story .listen").waitFor({ state: "visible", timeout: 3000 });
    await close(page);
  });

  await test("each button reads its own text, and nothing is read without a press", async () => {
    const page = await open();
    await page.locator(".story .listen").waitFor();
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => window.__spoken.length), 0, "no reading on its own");
    assert.equal(await page.textContent(".story .listen"), "Listen to the note");
    await page.click(".story .listen"); await waitQuiet(page);
    assert.match(await spoken(page), /^You came to the old county schoolhouse, now a museum of education history, to research your Philosophy assignment\. \| You lost track of time/, "the note");
    const say = async (sel, re, name) => { await page.evaluate(() => { window.__spoken.length = 0; });
      if (name) assert.equal(await page.locator(sel).textContent(), name);
      await page.click(sel); await waitQuiet(page); const t = await spoken(page); assert.match(t, re, sel + ": " + t); return t; };
    await say(".rules .listen", /^House rules \| Solve the puzzle.*There are 5 rooms.*no time limit/, "Listen to the house rules");
    await page.click("#begin"); await page.locator("#stage h2:has-text('Room 1')").waitFor();
    const clue = await say(".icard .listen >> nth=0", /^Clue 1 \| All students should master/, "Listen to Clue 1");
    assert.doesNotMatch(clue, /Listen|Pick up/, "the button's own words are not read");
    await say("#how + .listen", /^Each clue describes one of the books/, "Listen to how to work the lock");
    // the examine view: a clue held up, and the room description
    await page.locator(".icard .no").first().click(); await page.locator("#examine:not([hidden])").waitFor();
    await say("#examine .listen", /^Clue 1 \| All students/, "Listen to Clue 1");
    await page.keyboard.press("Escape");
    await page.click("#describe");
    const d = await say("#examine .listen", /^Room 1 of 5: .*\| The note \|.*Code L: Essentialism/, "Listen to the room description");
    assert.doesNotMatch(d, /\*\*/, "no markup is read");
    await page.keyboard.press("Escape");
    // hints
    await page.evaluate(() => { ROOMS[0].hintsEnabled = true; ROOMS[0].hints = ["Start with the clue you are surest about."]; go(1); });
    await page.locator("#stage h2:has-text('Room 1')").waitFor();
    await page.fill("#answer", "xx"); await page.click("#try"); await page.click("#hint-btn");
    await say(".hint .listen", /^Hint 1 \| Start with the clue you are surest about\.$/, "Listen to Hint 1");
    // a quiz question with its choices
    await page.evaluate(() => { ROOMS[2] = { type: "quiz", title: "Q", questions: [{ kind: "short", prompt: "Who wrote *Emile*?", answers: "Rousseau" }, { kind: "choice", prompt: "Which one?", choices: ["Essentialism", "Progressivism"], correct: 0 }] }; go(3); });
    await page.locator(".slip .listen").first().waitFor();
    await say(".slip >> nth=0 >> .listen", /^Question 1\. \| Who wrote Emile\? \| Type your answer\.$/, "Listen to question 1");
    await say(".slip >> nth=1 >> .listen", /^Question 2\. \| Which one\? \| Choices: \| Essentialism \| Progressivism$/);
    // the mirror's question
    await page.evaluate(() => go(5)); await page.locator(".qcard:not([hidden]) .listen").waitFor();
    await say(".qcard:not([hidden]) .listen", /^Question 1 of 6 \| The main purpose of school is to… \| Choices: \| pass on the essential knowledge/, "Listen to question 1");
    // the result on the certificate
    await page.evaluate(() => { const r = ROOMS[4]; S.reflection = { room: r, first: r.profiles[0], second: r.profiles[1] }; go(6); });
    await page.locator(".result .listen").waitFor();
    await say(".result .listen", /^Your reflection: /, "Listen to your result");
    await close(page);
  });

  await test("Stop works, only one thing reads at a time, and reading stops on a room change, a sheet or the notebook", async () => {
    const page = await open({ mock: { ms: 60000 } });       // every sentence takes a minute, so reading is still going on
    await page.click("#begin"); await page.locator("#stage h2:has-text('Room 1')").waitFor();
    const clue = page.locator(".icard .listen").first();
    await clue.click();
    assert.equal(await clue.getAttribute("data-reading"), "");
    assert.equal(await clue.locator(".lw").textContent(), "Stop", "the word on it");
    assert.equal(await clue.textContent(), "Stop reading Clue 1", "its name contains the word on it");
    assert.equal(await clue.getAttribute("aria-pressed"), null, "not a toggle: a toggle keeps one name");
    assert.equal(await page.evaluate(() => document.querySelector("#live").textContent), "", "nothing is added to the live region");
    // the sentence being read is highlighted
    await page.waitForFunction(() => CSS.highlights.has("er-read"));   // drawn when the voice starts the sentence, a moment after the press
    assert.equal(await page.evaluate(() => [...CSS.highlights.get("er-read")][0].toString()), "Clue 1");
    await clue.click();
    assert.equal(await clue.getAttribute("data-reading"), null); assert.equal(await clue.textContent(), "Listen to Clue 1");
    assert.equal(await page.evaluate(() => speechSynthesis.speaking), false, "speech is cancelled");
    assert.equal(await page.evaluate(() => CSS.highlights.has("er-read")), false, "the highlight goes");
    // one at a time
    await clue.click(); await page.locator(".icard .listen").nth(1).click(); await page.waitForTimeout(150);
    assert.equal(await page.locator(".listen[data-reading]").count(), 1);
    assert.equal(await page.textContent(".listen[data-reading]"), "Stop reading Clue 2");
    // a room change stops it
    await page.evaluate(() => go(2)); await page.locator("#stage h2:has-text('Room 2')").waitFor();
    assert.equal(await page.evaluate(() => !!(speechSynthesis.speaking || READ.reading)), false);
    // the notebook stops it
    await page.click("#how + .listen"); assert.equal(await page.evaluate(() => READ.reading), "how");
    await page.keyboard.press("Escape"); assert.equal(await page.isVisible("#pause"), true);
    assert.equal(await page.evaluate(() => READ.reading), null); await page.keyboard.press("Escape");
    // a sheet: opening one stops the room's reading, closing it stops the sheet's
    await page.click("#how + .listen"); await page.click("#describe");
    assert.equal(await page.evaluate(() => READ.reading), null);
    await page.click("#examine .listen"); assert.equal(await page.evaluate(() => READ.reading), "sheet");
    await page.keyboard.press("Escape"); assert.equal(await page.evaluate(() => !!(READ.reading || speechSynthesis.speaking)), false);
    // by keyboard: the Listen button is its own Tab stop after the paper's heading button
    await page.evaluate(() => go(1)); await page.locator("#stage h2:has-text('Room 1')").waitFor();
    await page.locator(".icard .no").first().focus(); await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement.textContent), "Listen to Clue 1");
    await page.keyboard.press("Enter"); assert.equal(await page.evaluate(() => READ.reading), "clue-0");
    assert.equal(await page.isHidden("#examine"), true, "pressing Listen never opens the paper");
    await page.keyboard.press("Space"); assert.equal(await page.evaluate(() => READ.reading), null);
    await close(page);
  });

  await test("no speechSynthesis at all: no buttons, and the notebook says so plainly", async () => {
    const page = await open({ mock: null, init: () => { try { delete window.speechSynthesis; Object.defineProperty(window, "speechSynthesis", { value: undefined }); } catch (e) {} } });
    await page.locator("#begin").waitFor(); await page.click("#begin"); await page.locator("#stage h2:has-text('Room 1')").waitFor();
    assert.equal(await visibleListens(page), 0);
    assert.equal(await page.getAttribute("html", "data-read"), "off");
    await page.click("#watch");
    assert.equal(await page.textContent("#read-why"), "Read aloud isn’t available in this browser.");
    assert.equal(await page.isVisible("#read-toggle"), false); assert.equal(await page.isVisible("#read-rate"), false);
    for (let i = 0; i < 10; i++) { await page.keyboard.press("Tab"); assert.equal(await page.evaluate(() => !!document.activeElement.closest("#pause") && document.activeElement.getClientRects().length > 0), true, "Tab stays on what is shown"); }
    await close(page);
  });

  await test("the notebook switch hides the buttons and is remembered; the speed is remembered too", async () => {
    const page = await open();
    await page.locator(".story .listen").waitFor();
    await page.click("#watch");
    assert.equal(await page.getAttribute("#read-toggle", "role"), "switch");
    assert.equal(await page.getAttribute("#read-toggle", "aria-checked"), "true", "on by default");
    assert.equal(await page.textContent("#read-toggle .lbl"), "Read aloud buttons");
    await page.click("#read-rate"); assert.equal(await page.textContent("#read-rate"), "Reading speed:faster");
    await page.click("#read-toggle");
    assert.equal(await page.getAttribute("#read-toggle", "aria-checked"), "false");
    assert.equal(await page.textContent("#read-toggle .st"), "off");
    await page.waitForFunction(() => /Read aloud buttons are off/.test(document.querySelector("#live").textContent));
    assert.equal(await page.isVisible("#read-rate"), false, "no speed while it is off");
    await page.keyboard.press("Escape");
    assert.equal(await visibleListens(page), 0);
    assert.equal(await page.evaluate(() => localStorage.getItem("escape-room-read")), "off");
    await page.reload(); await page.locator("#begin").waitFor(); await page.waitForTimeout(300);
    assert.equal(await visibleListens(page), 0, "still off after a reload");
    await page.click("#watch"); await page.click("#read-toggle"); await page.keyboard.press("Escape");
    await page.click(".story .listen"); await waitQuiet(page);
    assert.deepEqual(await page.evaluate(() => [...new Set(window.__spoken.map(s => s.rate))]), [1.25], "the faster speed is used and remembered");
    await close(page);
  });

  await test("hostile content in a class link is spoken as text and never becomes HTML", async () => {
    const evil = '<img src=x onerror="window.__pwned=1"> **bold** <script>window.__pwned=2</script>';
    const link = await ER.toLink({ meta: { title: evil }, intro: { story: "Hello. " + evil },
      rooms: [{ type: "matching", title: evil, story: evil, cards: [{ term: "Plato" + evil, clue: "First " + evil }, { term: "Rousseau", clue: "Second" }] }] }, base + "/play.html");
    const page = await open({ url: link });
    await page.locator(".story .listen").waitFor();
    await page.click(".story .listen"); await waitQuiet(page);
    assert.match(await spoken(page), /<img src=x onerror="window\.__pwned=1">/, "the attack is read as the text it is");
    await page.click("#begin"); await page.locator(".icard .listen").first().waitFor();
    for (const sel of [".story .listen", ".icard .listen >> nth=0", "#how + .listen"]) { await page.click(sel); await waitQuiet(page); }
    await page.locator(".mcard").first().click(); await page.click("#examine .listen"); await waitQuiet(page);
    assert.match(await page.textContent("#examine .listen"), /^Listen to Plato<img src=x/, "the name is text");
    const bad = await page.evaluate(() => [window.__pwned, document.querySelectorAll("#stage img, #examine img, #stage script, #examine script").length]);
    assert.deepEqual(bad, [undefined, 0]);
    await close(page);
  });

  await test("screenshots: a matching room, a quiz room and the examine view while reading", async () => {
    for (const [w, h, tag] of [[1440, 900, "wide"], [390, 844, "phone"]]) {
      const page = await open({ mock: { ms: 60000 }, viewport: { width: w, height: h } });
      await page.click("#begin"); await page.locator(".icard .listen").first().waitFor();
      await page.locator(".icard .listen").nth(1).click(); await page.waitForTimeout(100);
      await page.screenshot({ path: path.join(SHOTS, `read-aloud-${tag}-matching.png`) });
      await page.evaluate(() => { ROOMS[2] = { type: "quiz", title: "The Strongbox", story: "Two questions guard the strongbox.", questions: [{ kind: "short", prompt: "Who wrote *Democracy and Education*?", answers: "Dewey" }, { kind: "choice", prompt: "Which philosophy stresses a common core of knowledge?", choices: ["Essentialism", "Existentialism", "Progressivism"], correct: 0 }] }; go(3); });
      await page.locator(".slip .listen").first().waitFor(); await page.locator(".slip .listen").first().click(); await page.waitForTimeout(100);
      await page.screenshot({ path: path.join(SHOTS, `read-aloud-${tag}-quiz.png`) });
      await page.click("#describe"); await page.click("#examine .listen"); await page.waitForTimeout(100);
      await page.screenshot({ path: path.join(SHOTS, `read-aloud-${tag}-examine.png`) });
      await close(page);
    }
  });

  await browser.close(); server.close();
  console.log(`\n${passed} passed, ${failed} failed.`);
  process.exit(failed ? 1 : 0);
})();
