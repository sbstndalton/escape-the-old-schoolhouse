// Tests for the first-visit accessibility prompt ("Before you start: make it easier to use?"), shared by the front
// page, the game's title screen and the maker's Welcome step. Run with `npm test`, or `node tests/a11y-prompt.js`.
const { chromium } = require("playwright");
const assert = require("assert/strict");
const path = require("path");
const fs = require("fs");
const { start } = require("../scripts/serve.js");
const speechMock = require("./speech-mock.js");

const SHOTS = path.join(__dirname, "screenshots");
fs.mkdirSync(SHOTS, { recursive: true });
let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log(`  ✔ ${name}`); }
  catch (e) { failed++; console.log(`  ✘ ${name}\n      ${String(e.stack || e).split("\n").slice(0, 6).join("\n      ")}`); }
}
let base, browser;
// A fresh browser (nothing stored): the first visit.
async function fresh({ viewport = { width: 1280, height: 900 }, motion = "no-preference", contrast = null } = {}) {
  const ctx = await browser.newContext({ viewport, reducedMotion: motion, ...(contrast ? { contrast } : {}) });
  await ctx.addInitScript(speechMock, {});
  ctx.errors = []; ctx.outside = [];
  await ctx.route("**/*", route => { const u = route.request().url(); if (u.startsWith(base) || /^(data|blob|about):/.test(u)) return route.continue(); ctx.outside.push(u); return route.abort(); });
  ctx.page = async url => { const p = await ctx.newPage();
    p.on("pageerror", e => ctx.errors.push(e.message)); p.on("console", m => { if (m.type() === "error") ctx.errors.push(m.text()); });
    p.on("dialog", d => { if (d.type() !== "beforeunload") ctx.errors.push("native dialog: " + d.message()); d.dismiss().catch(() => {}); });
    await p.goto(base + url); return p; };
  return ctx;
}
const close = async ctx => { const e = ctx.errors, o = ctx.outside; await ctx.close(); assert.deepEqual(e, [], "page errors"); assert.deepEqual(o, [], "requests to other places"); };
const ask = "#a11y-ask";
const shown = p => p.locator(ask).isVisible();
const focusId = p => p.evaluate(() => document.activeElement && (document.activeElement.id || document.activeElement.tagName));
const sw = (p, id) => p.getAttribute(`#a11y-ask-${id}`, "aria-checked");

(async () => {
  const server = await start(0);
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
  console.log("\nThe first-visit accessibility prompt\n");

  await test("the game asks first thing on a first visit, as a real modal dialog, and never again", async () => {
    const ctx = await fresh(), p = await ctx.page("/play.html");
    await p.locator(ask).waitFor();
    assert.equal(await p.getAttribute(ask, "role"), "dialog"); assert.equal(await p.getAttribute(ask, "aria-modal"), "true");
    assert.equal(await p.locator(`${ask} h2`).textContent(), "Before you start: make it easier to use?");
    assert.equal(await p.getAttribute(ask, "aria-labelledby"), "a11y-ask-h");
    assert.equal(await focusId(p), "a11y-ask-h", "focus starts on the heading");
    assert.equal(await p.evaluate(() => document.querySelector("#scene").inert), true, "the game behind it is inert");
    assert.match(await p.textContent(ask), /Using a screen reader, switch control or keyboard\? Everything works with them; there’s nothing to turn on\./);
    assert.deepEqual(await p.locator(`${ask} .a11yq-lbl`).allTextContents(), ["Readable text", "High contrast", "Motion", "Sound", "Listen buttons (read aloud)", "Hide the clock"]);
    for (const b of await p.locator(`${ask} button`).all()) { const r = await b.boundingBox(); assert.ok(r.height >= 44, "44px targets"); }
    await p.click("#a11y-ask-ok");
    assert.equal(await p.locator(ask).count(), 0);
    assert.equal(await p.evaluate(() => document.querySelector("#scene").inert), false);
    assert.match(await focusId(p), /^H2$/, "focus goes back to the title screen's heading");
    assert.equal(await p.evaluate(() => localStorage.getItem("escape-room-a11y-asked")), "continue");
    await p.reload(); await p.locator("#begin").waitFor(); await p.waitForTimeout(300);
    assert.equal(await p.locator(ask).count(), 0, "not asked again");
    await close(ctx);
  });

  await test("each switch applies at once behind the dialog, and is remembered", async () => {
    const ctx = await fresh(), p = await ctx.page("/play.html");
    await p.locator(ask).waitFor();
    const html = a => p.getAttribute("html", a);
    await p.click("#a11y-ask-readable"); assert.equal(await html("data-readable"), "on"); assert.equal(await sw(p, "readable"), "true");
    await p.click("#a11y-ask-contrast"); assert.equal(await html("data-contrast"), "more");
    await p.click("#a11y-ask-motion"); assert.equal(await html("data-motion"), "off");
    await p.click("#a11y-ask-sound"); assert.equal(await p.getAttribute("#sound-toggle", "aria-checked"), "false");
    await p.click("#a11y-ask-read"); assert.equal(await html("data-read"), "off");
    await p.click("#a11y-ask-clock"); assert.equal(await html("data-clock"), "off");
    assert.equal(await p.textContent("#a11y-ask-clock .a11yq-st"), "on");
    await p.click("#a11y-ask-ok");
    const keys = await p.evaluate(() => ["readable", "contrast", "motion", "sound", "read", "clock"].map(k => localStorage.getItem("escape-room-" + k)));
    assert.deepEqual(keys, ["on", "on", "off", "off", "off", "on"]);
    await p.reload(); await p.locator("#begin").waitFor();
    assert.deepEqual([await html("data-readable"), await html("data-contrast"), await html("data-motion"), await html("data-read"), await html("data-clock")], ["on", "more", "off", "off", "off"]);
    // the notebook shows the same
    await p.click("#watch"); assert.equal(await p.getAttribute("#readable-toggle", "aria-checked"), "true"); assert.equal(await p.getAttribute("#read-toggle", "aria-checked"), "false");
    await close(ctx);
  });

  await test("“Continue without changes” and Esc keep what the person had; Esc closes it", async () => {
    const ctx = await fresh(), p = await ctx.page("/play.html");
    await p.locator(ask).waitFor();
    await p.click("#a11y-ask-readable"); assert.equal(await p.getAttribute("html", "data-readable"), "on");
    await p.keyboard.press("Escape");
    assert.equal(await p.locator(ask).count(), 0, "Esc closes it");
    assert.equal(await p.isHidden("#pause"), true, "Esc doesn't also open the notebook");
    assert.equal(await p.getAttribute("html", "data-readable"), "off", "what was tried is put back");
    assert.equal(await p.evaluate(() => localStorage.getItem("escape-room-a11y-asked")), "skip");
    // a setting chosen before stays as it was
    await p.evaluate(() => localStorage.setItem("escape-room-contrast", "on")); await p.reload(); await p.locator("#begin").waitFor();
    await p.click("#a11y-options"); await p.locator(ask).waitFor();
    assert.equal(await sw(p, "contrast"), "true", "shows what is on now");
    await p.click("#a11y-ask-contrast"); assert.equal(await p.getAttribute("html", "data-contrast"), "normal");
    await p.click("#a11y-ask-skip");
    assert.equal(await p.getAttribute("html", "data-contrast"), "more", "nothing the person already had is reset");
    assert.equal(await focusId(p), "a11y-options", "focus returns to the control that opened it");
    await close(ctx);
  });

  await test("the device's own settings show as already on", async () => {
    const ctx = await fresh({ motion: "reduce", contrast: "more" }), p = await ctx.page("/play.html");
    await p.locator(ask).waitFor();
    assert.equal(await sw(p, "contrast"), "true");
    assert.equal(await sw(p, "motion"), "false");
    assert.equal(await p.getAttribute("#a11y-ask-motion", "aria-disabled"), "true");
    assert.match(await p.textContent("#a11y-ask-motion-d"), /Your device asks for less motion/);
    assert.equal(await p.evaluate(() => document.getAnimations().length), 0, "no motion, the dialog included");
    await close(ctx);
  });

  await test("a choice on the front page carries into the game and the maker, which don't ask again", async () => {
    const ctx = await fresh(), p = await ctx.page("/");
    await p.locator(ask).waitFor();
    assert.match(await p.textContent("#a11y-ask-sound-d"), /\(In the game\.\)/, "game-only settings say so");
    await p.click("#a11y-ask-contrast"); assert.equal(await p.getAttribute("html", "data-contrast"), "more", "at once, on the front page too");
    assert.equal(await p.getAttribute("#contrast-toggle", "aria-checked"), "true", "the page's own switch follows");
    await p.click("#a11y-ask-clock"); await p.click("#a11y-ask-read");
    await p.click("#a11y-ask-ok");
    const g = await ctx.page("/play.html"); await g.locator("#begin").waitFor(); await g.waitForTimeout(300);
    assert.equal(await g.locator(ask).count(), 0, "the game doesn't ask");
    assert.deepEqual([await g.getAttribute("html", "data-contrast"), await g.getAttribute("html", "data-clock"), await g.getAttribute("html", "data-read")], ["more", "off", "off"]);
    const m = await ctx.page("/editor.html"); await m.locator("#wiz-h1").waitFor(); await m.waitForTimeout(300);
    assert.equal(await m.locator(ask).count(), 0, "the maker doesn't ask");
    assert.equal(await m.getAttribute("html", "data-contrast"), "more");
    await close(ctx);
  });

  await test("the maker asks on its Welcome step, through its own modal layer, and its controls open it again", async () => {
    const ctx = await fresh(), p = await ctx.page("/editor.html");
    await p.locator(ask).waitFor();
    assert.equal(await p.locator("#wiz-h1").textContent() !== "", true);
    assert.equal(await p.evaluate(() => document.querySelector("#wizard").inert), true, "the steps behind it are inert");
    await p.click("#a11y-ask-readable"); assert.equal(await p.getAttribute("html", "data-readable"), "on");
    await p.keyboard.press("Escape");
    assert.equal(await p.locator(ask).count(), 0); assert.equal(await p.getAttribute("html", "data-readable"), null, "put back");
    assert.equal(await focusId(p), "wiz-h1");
    await p.click("#wiz-a11y"); await p.locator(ask).waitFor();
    await p.click("#a11y-ask-ok"); assert.equal(await focusId(p), "wiz-a11y");
    await p.goto(base + "/editor.html#advanced"); await p.locator("#page-title").waitFor();
    assert.equal(await p.locator(ask).count(), 0);
    await p.click("#a11y-options"); await p.locator(ask).waitFor();
    await p.click("#a11y-ask-contrast"); assert.equal(await p.getAttribute("html", "data-contrast"), "more");
    assert.equal(await p.isChecked("#contrast-toggle"), true, "the maker's own switch follows");
    await p.click("#a11y-ask-ok"); assert.equal(await focusId(p), "a11y-options");
    await close(ctx);
  });

  await test("it works with the keyboard alone, and Tab stays inside it (game and front page)", async () => {
    for (const url of ["/play.html", "/"]) {
      const ctx = await fresh(), p = await ctx.page(url);
      await p.locator(ask).waitFor();
      const ids = [];
      for (let i = 0; i < 9; i++) { await p.keyboard.press("Tab"); ids.push(await focusId(p)); }
      assert.deepEqual(ids, ["a11y-ask-readable", "a11y-ask-contrast", "a11y-ask-motion", "a11y-ask-sound", "a11y-ask-read", "a11y-ask-clock", "a11y-ask-ok", "a11y-ask-skip", "a11y-ask-readable"], url);
      await p.keyboard.press("Shift+Tab"); assert.equal(await focusId(p), "a11y-ask-skip");
      await p.keyboard.press("Shift+Tab"); await p.keyboard.press("Shift+Tab"); await p.keyboard.press("Shift+Tab"); await p.keyboard.press("Shift+Tab"); await p.keyboard.press("Shift+Tab"); await p.keyboard.press("Shift+Tab"); await p.keyboard.press("Shift+Tab");
      assert.equal(await focusId(p), "a11y-ask-readable");
      await p.keyboard.press("Space"); assert.equal(await p.getAttribute("html", "data-readable"), "on");
      await p.locator("#a11y-ask-ok").focus(); await p.keyboard.press("Enter");
      assert.equal(await p.locator(ask).count(), 0); assert.equal(await p.getAttribute("html", "data-readable"), "on");
      // and back again from its control
      await p.locator("#a11y-options").focus(); await p.keyboard.press("Enter"); await p.locator(ask).waitFor();
      await p.keyboard.press("Escape"); assert.equal(await focusId(p), "a11y-options");
      await close(ctx);
    }
  });

  await test("where storage is blocked (some LMS frames) it doesn't open by itself, and its button still works", async () => {
    const ctx = await fresh();
    await ctx.addInitScript(() => { Object.defineProperty(window, "localStorage", { get(){ throw new Error("storage is blocked"); } }); });
    const p = await ctx.page("/play.html"); await p.locator("#begin").waitFor(); await p.waitForTimeout(300);
    assert.equal(await p.locator(ask).count(), 0);
    await p.click("#a11y-options"); await p.locator(ask).waitFor();
    await p.click("#a11y-ask-readable"); assert.equal(await p.getAttribute("html", "data-readable"), "on");
    await p.click("#a11y-ask-ok"); assert.equal(await p.getAttribute("html", "data-readable"), "on", "kept for this visit");
    await close(ctx);
  });

  await test("never in the editor's preview of the game", async () => {
    const ctx = await fresh(), p = await ctx.page("/editor.html");
    await p.locator(ask).waitFor(); await p.click("#a11y-ask-ok");
    await p.evaluate(() => localStorage.removeItem("escape-room-a11y-asked"));
    await p.goto(base + "/editor.html#advanced"); await p.locator("#page-title").waitFor();
    await p.click("#btn-preview"); const f = p.frameLocator("iframe").first(); await f.locator("#stage h2").first().waitFor();
    assert.equal(await f.locator(ask).count(), 0);
    await close(ctx);
  });

  await test("screenshots: 1440x900 and 390x844, normal and High contrast", async () => {
    for (const [w, h] of [[1440, 900], [390, 844]]) for (const hc of [false, true]) {
      const ctx = await fresh({ viewport: { width: w, height: h } }), p = await ctx.page("/play.html");
      await p.locator(ask).waitFor(); if (hc) await p.click("#a11y-ask-contrast");
      await p.waitForTimeout(400); await p.screenshot({ path: path.join(SHOTS, `a11y-prompt-${w}${hc ? "-hc" : ""}.png`) });
      await close(ctx);
    }
    const ctx = await fresh(), p = await ctx.page("/"); await p.locator(ask).waitFor(); await p.waitForTimeout(400);
    await p.screenshot({ path: path.join(SHOTS, "a11y-prompt-front.png") });
    const m = await ctx.page("/editor.html"); await m.locator(ask).waitFor(); await m.waitForTimeout(400);
    await m.screenshot({ path: path.join(SHOTS, "a11y-prompt-maker.png") });
    await close(ctx);
  });

  await browser.close(); server.close();
  console.log(`\n${passed} passed, ${failed} failed. Screenshots: tests/screenshots/a11y-prompt-*.png`);
  process.exit(failed ? 1 : 0);
})();
