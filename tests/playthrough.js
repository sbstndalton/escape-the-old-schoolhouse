// Automated play-through of the web version. Run with `npm test`.
// Screenshots of every room are saved to tests/screenshots/ for a visual check.
const { chromium } = require("playwright");
const assert = require("assert/strict");
const fs = require("fs");
const path = require("path");
const { start } = require("../scripts/serve.js");

const SHOTS = path.join(__dirname, "screenshots");
fs.mkdirSync(SHOTS, { recursive: true });

const TIMELINE_ORDER = ["Plato", "Rousseau", "Horace", "Montessori", "Dewey", "Freire", "Adler"];
const OBSERVATIONS = [0, 1, 0, 1, 0, 1, 0, 1]; // 0 = Traditional, 1 = Progressive
const WAIT = 1500; // rooms advance ~1.3s after a correct answer

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log(`  ✔ ${name}`); }
  catch (e) { failed++; console.log(`  ✘ ${name}\n      ${e.message.split("\n").join("\n      ")}`); }
}

async function newPage(browser, base, { scorm = false, viewport = { width: 1000, height: 900 }, reducedMotion = "no-preference", init = null } = {}) {
  const page = await browser.newPage({ viewport, reducedMotion });
  if (init) await page.addInitScript(init);
  page.errors = [];
  page.externalRequests = [];
  page.on("pageerror", e => page.errors.push(e.message));
  page.on("console", m => { if (m.type() === "error") page.errors.push(m.text()); });
  await page.route("**/*", route => {
    const u = route.request().url();
    if (u.startsWith(base) || u.startsWith("data:")) return route.continue();
    page.externalRequests.push(u); return route.abort();
  });
  if (scorm) {
    await page.addInitScript(() => {
      window.__scorm = {};
      window.API = {
        LMSInitialize: () => "true", LMSCommit: () => "true", LMSFinish: () => "true",
        LMSGetValue: k => (k === "cmi.core.student_name" ? "Doe, Jane" : k === "cmi.core.lesson_status" ? "not attempted" : ""),
        LMSSetValue: (k, v) => { window.__scorm[k] = v; return "true"; },
      };
    });
  }
  await page.goto(base + "/index.html");
  return page;
}

async function solveTimeline(page) {
  const rank = s => TIMELINE_ORDER.findIndex(k => s.includes(k));
  for (let pass = 0; pass < 8; pass++) {
    for (let i = 0; i < 6; i++) {
      const t = await page.$$eval("#order li span:nth-child(2)", els => els.map(e => e.textContent));
      if (rank(t[i]) > rank(t[i + 1])) await page.locator("#order li").nth(i).getByRole("button", { name: "Move down" }).click();
    }
  }
}

async function playThrough(page, shotPrefix) {
  const shot = n => shotPrefix && page.screenshot({ path: path.join(SHOTS, `${shotPrefix}-${n}.png`), fullPage: true });
  await shot("0-intro");
  await page.fill("#pname", (await page.inputValue("#pname")) || "Test Student");
  await page.click("#begin");
  await shot("1-library");
  await page.fill("#answer", "learn"); await page.click("#try"); await page.waitForTimeout(WAIT);
  await shot("2-gallery");
  await page.fill("#answer", "9154"); await page.click("#try"); await page.waitForTimeout(WAIT);
  await shot("3-timeline");
  await solveTimeline(page); await page.click("#try");
  assert.match(await page.textContent("#msg"), /lock drops open/);
  await page.waitForTimeout(WAIT);
  await shot("4-observation");
  for (let i = 0; i < 8; i++) await page.click(`.seg button[data-i="${i}"][data-v="${OBSERVATIONS[i]}"]`);
  await page.click("#try"); await page.waitForTimeout(WAIT);
  await shot("5-mirror");
  for (let i = 0; i < 6; i++) await page.locator(`input[name=q${i}]`).nth(2).check();
  await page.click("#mf button[type=submit]"); await page.waitForTimeout(WAIT);
  await shot("6-escaped");
}

(async () => {
  const server = await start(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  console.log("Escape the Old Schoolhouse: web tests\n");

  await test("full play-through reaches the certificate with the exit password", async () => {
    const page = await newPage(browser, base);
    await playThrough(page, "desktop");
    const text = await page.textContent("#stage");
    assert.match(text, /You Escaped!/);
    assert.match(text, /DEWEY1916/);
    assert.match(text, /Your reflection: Progressivism/);
    assert.match(await page.textContent("#draft"), /40 of 40 items haven't been checked/);
    assert.deepEqual(page.errors, [], "page had JavaScript errors");
    await page.close();
  });

  await test("SCORM: fills student name and reports completed + score 100", async () => {
    const page = await newPage(browser, base, { scorm: true });
    assert.equal(await page.inputValue("#pname"), "Jane Doe");
    await playThrough(page);
    const s = await page.evaluate(() => window.__scorm);
    assert.equal(s["cmi.core.lesson_status"], "completed");
    assert.equal(s["cmi.core.score.raw"], "100");
    assert.match(s["cmi.core.session_time"], /^\d{4}:\d{2}:\d{2}$/);
    await page.close();
  });

  await test("wrong answers are rejected with feedback", async () => {
    const page = await newPage(browser, base);
    await page.click("#begin");
    await page.fill("#answer", "wrong"); await page.click("#try");
    assert.match(await page.textContent("#msg"), /won't budge/);
    await page.fill("#answer", "learn"); await page.click("#try"); await page.waitForTimeout(WAIT);
    await page.fill("#answer", "1234"); await page.click("#try");
    assert.match(await page.textContent("#msg"), /ERROR/);
    await page.close();
  });

  await test("no hints appear unless the teacher turns them on", async () => {
    const page = await newPage(browser, base);
    await page.click("#begin");
    assert.equal(await page.locator("#hint-btn").count(), 0);
    await page.fill("#answer", "wrong"); await page.click("#try");
    assert.equal(await page.locator("#hint-btn").count(), 0);
    assert.doesNotMatch(await page.textContent("#stage"), /hint/i);
    await page.close();
  });

  await test("works on a phone-sized screen without sideways scrolling", async () => {
    const page = await newPage(browser, base, { viewport: { width: 390, height: 844 } });
    await playThrough(page, "phone");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 1, `page is ${overflow}px wider than the screen`);
    await page.close();
  });

  await test("makes no requests outside the game (fully offline)", async () => {
    const page = await newPage(browser, base);
    await playThrough(page);
    assert.deepEqual(page.externalRequests, []);
    await page.close();
  });

  await test("books and portraits show every code as text, and the rooms still solve", async () => {
    const page = await newPage(browser, base);
    await page.click("#begin");
    const clean = t => t.replace(/\s+/g, " ").trim();
    // Room 1 is drawn as books on a shelf
    await page.locator(".shelf").waitFor();
    assert.equal(await page.locator(".shelf .vol").count(), 5);
    assert.deepEqual((await page.locator(".vol .letter b").allTextContents()).sort(), ["A", "E", "L", "N", "R"]);
    const books = (await page.locator(".shelf > li").allTextContents()).map(clean);
    assert.ok(books.includes("Code L: Essentialism"), `screen-reader text for a book, got: ${books.join(" | ")}`);
    assert.equal(await page.locator("ol.clues .icard").count(), 5, "clues are index cards");
    assert.match(clean(await page.locator(".icard").first().textContent()), /^Clue 1 ?All students should master/);
    assert.equal(await page.locator(".vol .band:not([aria-hidden=true])").count(), 0, "decoration is hidden from screen readers");
    await page.fill("#answer", "learn"); await page.click("#try");
    assert.equal(await page.locator(".lock.unlocked").count(), 1, "the padlock opens");
    await page.locator("#stage h2:has-text('Room 2')").waitFor();
    // Room 2 is drawn as framed portraits with brass plates
    assert.equal(await page.locator(".gallery .portrait").count(), 8);
    assert.deepEqual((await page.locator(".plate b").allTextContents()).sort(), ["1", "2", "3", "4", "5", "7", "8", "9"]);
    const dewey = clean(await page.locator(".portrait", { hasText: "John Dewey" }).textContent());
    assert.match(dewey, /John Dewey.*Code (No\. ?)?9$/);
    assert.equal(await page.locator(".portrait .gilt[aria-hidden=true]").count(), 8);
    await page.fill("#answer", "9154"); await page.click("#try");
    await page.locator("#stage h2:has-text('Room 3')").waitFor();
    // A portrait with no icon shows initials; an unknown look, or a very long name on a book, falls back to plain cards
    await page.evaluate(() => { ROOMS[1].cards[0].icon = ""; go(2); });
    await page.locator(".sitter", { hasText: /^JD$/ }).waitFor();
    await page.evaluate(() => { ROOMS[0].look = "something-else"; go(1); });
    await page.locator(".mcard").first().waitFor();
    assert.equal(await page.locator(".mcard").count(), 5);
    assert.equal(await page.locator("ol.clues li").count(), 5);
    await page.evaluate(() => { ROOMS[0].look = "books"; ROOMS[0].cards[0].term = "A very long name that could never fit on the spine of a book"; go(1); });
    await page.locator(".mcard").first().waitFor();
    assert.deepEqual(page.errors, []);
    await page.close();
  });

  await test("a wrong answer moves only the lock, and the certificate gets a seal and one burst of confetti", async () => {
    const page = await newPage(browser, base);
    assert.equal(await page.getAttribute("html", "data-motion"), "on");
    await page.click("#begin");
    await page.fill("#answer", "wrong"); await page.click("#try");
    assert.equal(await page.locator(".lock.nope").count(), 1);
    assert.equal(await page.locator("#stage.shake").count(), 0, "the board itself doesn't shake");
    assert.equal(await page.evaluate(() => document.activeElement.id), "try", "focus stays where the student was");
    await page.evaluate(() => { S.player = "Test Student"; go(ROOMS.length + 1); });
    await page.locator(".cert .seal").waitFor();
    assert.equal(await page.getAttribute(".cert .seal", "aria-hidden"), "true");
    await page.locator("#confetti").waitFor({ state: "attached", timeout: 3000 });
    await page.locator("#confetti").waitFor({ state: "detached", timeout: 5000 });   // it cleans up after itself
    assert.equal(await page.evaluate(() => document.activeElement.id), "stage", "focus moves to the new screen");
    assert.deepEqual(page.errors, []);
    await page.close();
  });

  await test("reduced motion: the whole game plays with no animation at all", async () => {
    const page = await newPage(browser, base, { reducedMotion: "reduce" });
    assert.equal(await page.getAttribute("html", "data-motion"), "off");
    assert.equal(await page.isDisabled("#motion-toggle"), true);
    assert.match(await page.textContent("#motion-toggle"), /Motion: off/);
    await page.click("#begin");
    assert.equal(await page.evaluate(() => document.getAnimations().length), 0, "nothing animates when a room opens");
    await page.fill("#answer", "wrong"); await page.click("#try");
    assert.match(await page.textContent("#msg"), /won't budge/);
    assert.equal(await page.evaluate(() => document.getAnimations().length), 0, "nothing animates on a wrong try");
    await page.fill("#answer", "learn"); await page.click("#try");
    assert.equal(await page.locator(".lock.unlocked").count(), 1, "the lock still shows as open");
    assert.equal(await page.locator(".sparks").count(), 0);
    assert.equal(await page.evaluate(() => document.getAnimations().length), 0, "nothing animates when a lock opens");
    await page.evaluate(() => go(0));
    await playThrough(page, "reduced");
    assert.match(await page.textContent("#stage"), /DEWEY1916/);
    assert.equal(await page.locator("#confetti").count(), 0);
    assert.equal(await page.evaluate(() => document.getAnimations().length), 0, "nothing animates on the certificate");
    assert.deepEqual(page.errors, []);
    await page.close();
  });

  await test("the Motion button switches animation off, remembers it, and works without browser storage", async () => {
    const page = await newPage(browser, base);
    await page.click("#motion-toggle");
    assert.match(await page.textContent("#motion-toggle"), /Motion: off/);
    assert.equal(await page.getAttribute("html", "data-motion"), "off");
    await page.click("#begin");
    assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
    await page.reload();
    assert.equal(await page.getAttribute("html", "data-motion"), "off", "the choice is remembered");
    await page.click("#motion-toggle");
    assert.equal(await page.getAttribute("html", "data-motion"), "on");
    await page.close();
    // Some LMS frames block storage: the game and the button must still work.
    const blocked = await newPage(browser, base, { init: () => {
      Object.defineProperty(window, "localStorage", { get(){ throw new Error("storage is blocked"); } });
    } });
    assert.equal(await blocked.getAttribute("html", "data-motion"), "on");
    await blocked.click("#motion-toggle");
    assert.equal(await blocked.getAttribute("html", "data-motion"), "off");
    await blocked.click("#begin");
    await blocked.fill("#answer", "learn"); await blocked.click("#try");
    await blocked.locator("#stage h2:has-text('Room 2')").waitFor();
    assert.deepEqual(blocked.errors, []);
    await blocked.close();
  });

  await browser.close();
  server.close();
  console.log(`\n${passed} passed, ${failed} failed. Screenshots: tests/screenshots/`);
  process.exit(failed ? 1 : 0);
})();
