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
// Nothing moves on by itself after a solve: the player presses "Go through the door" (#onward), and the next
// screen appears within about 150 ms. door() presses it and waits for the new heading.
async function door(page, heading) {
  await page.click("#onward");
  await page.locator("#stage h2", { hasText: heading }).waitFor();
}

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
  await page.goto(base + "/play.html");
  return page;
}

async function solveTimeline(page) {
  const rank = s => TIMELINE_ORDER.findIndex(k => s.includes(k));
  for (let pass = 0; pass < 8; pass++) {
    for (let i = 0; i < 6; i++) {
      const t = await page.$$eval("#order li .t", els => els.map(e => e.textContent));
      if (rank(t[i]) > rank(t[i + 1])) await page.locator("#order li").nth(i).getByRole("button", { name: "Move down" }).click();
    }
  }
}

async function playThrough(page, shotPrefix) {
  // The page itself never scrolls (the room scrolls inside the scene when it is taller than the window), so a
  // plain screenshot shows the top of each room. Wait for the doors to finish parting first.
  const shot = async n => { if (!shotPrefix) return; await page.waitForTimeout(900); await page.screenshot({ path: path.join(SHOTS, `${shotPrefix}-${n}.png`) }); };
  await shot("0-intro");
  await page.fill("#pname", (await page.inputValue("#pname")) || "Test Student");
  await page.click("#begin");
  await shot("1-library");
  await page.fill("#answer", "learn"); await page.click("#try"); await door(page, "Room 2");
  await shot("2-gallery");
  await page.fill("#answer", "9154"); await page.click("#try"); await door(page, "Room 3");
  await shot("3-timeline");
  await solveTimeline(page); await page.click("#try");
  assert.match(await page.textContent("#msg"), /lock drops open/);
  await door(page, "Room 4");
  await shot("4-observation");
  for (let i = 0; i < 8; i++) await page.click(`.seg button[data-i="${i}"][data-v="${OBSERVATIONS[i]}"]`);
  await page.click("#try"); await door(page, "Room 5");
  await shot("5-mirror");
  // The mirror asks one question at a time. Nothing moves on by itself: the plate goes to the next question,
  // and on the last one it finishes.
  for (let i = 0; i < 6; i++) { await page.locator(`input[name=q${i}]`).nth(2).check(); await page.click("#try"); }
  await door(page, "You Escaped");
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
    assert.match(await page.textContent("#draft-more"), /40 of 40 items haven't been checked/);
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
    await page.fill("#answer", "learn"); await page.click("#try"); await door(page, "Room 2");
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
    await door(page, "Room 2");
    // Room 2 is drawn as framed portraits with brass plates
    assert.equal(await page.locator(".gallery .portrait").count(), 8);
    assert.deepEqual((await page.locator(".plate b").allTextContents()).sort(), ["1", "2", "3", "4", "5", "7", "8", "9"]);
    const dewey = clean(await page.locator(".portrait", { hasText: "John Dewey" }).textContent());
    assert.match(dewey, /John Dewey.*Code (No\. ?)?9$/);
    assert.equal(await page.locator(".portrait .gilt[aria-hidden=true]").count(), 8);
    await page.fill("#answer", "9154"); await page.click("#try");
    await door(page, "Room 3");
    // Every portrait is signed with the sitter's initials; an unknown look, or a very long name on a book, falls back to plain cards
    await page.evaluate(() => go(2));
    await page.locator(".portrait", { hasText: "John Dewey" }).locator(".sitter i", { hasText: /^JD$/ }).waitFor();
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
    assert.equal(await page.evaluate(() => document.activeElement.tagName + ":" + document.activeElement.textContent), "H2:You Escaped!", "focus moves to the new screen's heading");
    assert.deepEqual(page.errors, []);
    await page.close();
  });

  await test("reduced motion: the whole game plays with no animation at all", async () => {
    const page = await newPage(browser, base, { reducedMotion: "reduce" });
    assert.equal(await page.getAttribute("html", "data-motion"), "off");
    assert.equal(await page.isDisabled("#motion-toggle"), true);
    assert.equal(await page.getAttribute("#motion-toggle", "aria-checked"), "false");
    assert.equal(await page.evaluate(() => document.querySelector("#motion-why").hidden), false, "the notebook says why the switch can't be turned on");
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

  await test("the Motion switch in the notebook turns animation off, remembers it, and works without browser storage", async () => {
    const page = await newPage(browser, base);
    await page.click("#watch");                                    // the pocket watch opens the notebook (pause menu)
    await page.click("#motion-toggle");
    assert.equal(await page.getAttribute("#motion-toggle", "aria-checked"), "false");
    assert.equal(await page.textContent("#motion-toggle .st"), "off", "the state is also written out");
    assert.equal(await page.getAttribute("html", "data-motion"), "off");
    await page.keyboard.press("Escape");
    assert.equal(await page.isHidden("#pause"), true, "Esc closes the notebook");
    await page.click("#begin");
    assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
    await page.reload();
    assert.equal(await page.getAttribute("html", "data-motion"), "off", "the choice is remembered");
    await page.keyboard.press("Escape");                           // Esc opens it too
    await page.click("#motion-toggle");
    assert.equal(await page.getAttribute("html", "data-motion"), "on");
    await page.close();
    // Some LMS frames block storage: the game and the button must still work.
    const blocked = await newPage(browser, base, { init: () => {
      Object.defineProperty(window, "localStorage", { get(){ throw new Error("storage is blocked"); } });
    } });
    assert.equal(await blocked.getAttribute("html", "data-motion"), "on");
    await blocked.click("#watch");
    await blocked.click("#motion-toggle");
    assert.equal(await blocked.getAttribute("html", "data-motion"), "off");
    await blocked.click("#sound-toggle-2");                        // the sound switch must not need storage either
    await blocked.click("#resume");
    await blocked.click("#begin");
    await blocked.fill("#answer", "learn"); await blocked.click("#try");
    await door(blocked, "Room 2");
    assert.deepEqual(blocked.errors, []);
    await blocked.close();
  });

  await test("the combination lock opens from the keyboard alone: arrows, typing and Enter", async () => {
    const page = await newPage(browser, base);
    await page.click("#begin");
    await page.locator("#stage h2:has-text('Room 1')").waitFor();
    const dial = page.locator(".dial");
    assert.equal(await dial.count(), 5, "one dial per character");
    await dial.first().focus();
    for (let i = 0; i < 12; i++) await page.keyboard.press("ArrowUp");      // blank, A, B ... L
    assert.equal(await dial.first().getAttribute("aria-valuetext"), "L, 12 of 26");
    await page.keyboard.press("ArrowUp"); await page.keyboard.press("ArrowDown");
    assert.equal(await page.inputValue("#answer"), "L", "the text field follows the dials");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.type("earn");                                        // typing sets a dial and moves to the next
    assert.equal(await page.inputValue("#answer"), "LEARN");
    assert.deepEqual(await dial.evaluateAll(els => els.map(e => e.querySelectorAll(".strip i")[1].textContent)), ["L", "E", "A", "R", "N"]);
    await page.keyboard.press("Enter");
    assert.equal(await page.locator(".lock.unlocked").count(), 1);
    assert.equal(await page.evaluate(() => document.activeElement.id), "onward", "focus moves to the door plate");
    await page.keyboard.press("Enter");
    await page.locator("#stage h2:has-text('Room 2')").waitFor();
    // and the other way round: typing in the field turns the dials; a click on a dial's stud turns it one notch
    await page.fill("#answer", "91");
    assert.deepEqual(await dial.evaluateAll(els => els.map(e => e.getAttribute("aria-valuetext"))), ["9", "1", "blank", "blank"]);
    await page.locator(".dial").nth(2).locator(".nub").first().click();
    assert.equal(await page.inputValue("#answer"), "910");
    assert.deepEqual(page.errors, []);
    await page.close();
  });

  await test("papers open in the examine view and go back with Esc, the close button or a click outside", async () => {
    const page = await newPage(browser, base);
    await page.click("#begin");
    await page.locator("#stage h2:has-text('Room 1')").waitFor();
    assert.equal(await page.isHidden("#examine"), true);
    const card = page.locator(".icard").first();
    await card.click();
    assert.equal(await page.isVisible("#examine"), true);
    assert.equal(await page.getAttribute("#examine", "role"), "dialog");
    assert.match(await page.textContent("#examine"), /Clue 1.*E\. D\. Hirsch Jr\./s, "the whole clue is readable up close");
    assert.equal(await page.evaluate(() => document.activeElement.className), "x", "focus moves to the close button");
    await page.keyboard.press("Escape");
    assert.equal(await page.isHidden("#examine"), true);
    assert.equal(await page.isHidden("#pause"), true, "that Esc only put the paper back");
    assert.equal(await page.evaluate(() => document.activeElement.matches(".icard > button.no")), true, "focus returns to the card's button");
    await page.locator(".vol").first().click();                            // a book tips out and shows its catalogue card
    assert.match(await page.textContent("#examine"), /Code [A-Z]/);
    await page.mouse.click(8, 8);                                           // click outside
    assert.equal(await page.isHidden("#examine"), true);
    await page.locator(".story").click();
    assert.match(await page.textContent("#examine"), /5-letter word/);
    await page.click("#examine .x");
    assert.equal(await page.isHidden("#examine"), true);
    assert.deepEqual(page.errors, []);
    await page.close();
  });

  await test("sorting: pick up a slip and press a rubber stamp, or use the slip's own boxes", async () => {
    const page = await newPage(browser, base);
    await page.click("#begin");
    await page.evaluate(() => go(4));
    await page.locator("#stage h2:has-text('Room 4')").waitFor();
    assert.equal(await page.locator(".stamp").count(), 2, "one stamp per category");
    await page.locator(".ev .pick").nth(2).click();
    assert.equal(await page.locator(".ev.sel").getAttribute("data-i"), "2");
    await page.click(".stamp[data-v='0']");
    assert.equal(await page.getAttribute(".seg button[data-i='2'][data-v='0']", "aria-pressed"), "true", "the slip takes the ink");
    assert.equal(await page.getAttribute(".seg button[data-i='2'][data-v='1']", "aria-pressed"), "false");
    assert.equal(await page.locator(".ev.sel").getAttribute("data-i"), "3", "the next unstamped slip is picked up");
    await page.click(".stamp[data-v='1']");
    assert.equal(await page.locator(".seg button.on").count(), 2);
    await page.click(".stamp[data-v='0']");                                 // slip 5, stamped wrong on purpose
    await page.click(".seg button[data-i='4'][data-v='1']");                // then corrected with its own box
    assert.equal(await page.locator(".seg button[data-i='4'].on").count(), 1, "a slip holds one stamp at a time");
    await page.click("#try");
    assert.match(await page.textContent("#msg"), /Choose a category for every item first/);
    for (const i of [0, 1, 4, 5, 6, 7]) await page.click(`.seg button[data-i="${i}"][data-v="${OBSERVATIONS[i]}"]`);
    await page.click("#try");
    assert.equal(await page.locator(".lock.unlocked").count(), 1);
    assert.equal(await page.textContent("#counter span"), "8");
    assert.deepEqual(page.errors, []);
    await page.close();
  });

  await test("sound: the mute button is remembered, and the game runs with no Web Audio at all", async () => {
    const page = await newPage(browser, base);
    assert.equal(await page.getAttribute("#sound-toggle", "aria-checked"), "true", "sound starts on");
    assert.equal(await page.getAttribute("#sound-toggle", "role"), "switch");
    assert.equal(await page.evaluate(() => typeof SND.play), "function");
    await page.click("#sound-toggle");
    assert.equal(await page.getAttribute("#sound-toggle", "aria-checked"), "false");
    assert.equal(await page.getAttribute("#sound-toggle", "title"), "Sound is off");
    await page.reload();
    assert.equal(await page.getAttribute("#sound-toggle", "aria-checked"), "false", "the choice is remembered");
    await page.click("#watch");
    assert.equal(await page.getAttribute("#sound-toggle-2", "aria-checked"), "false");
    assert.equal(await page.textContent("#sound-toggle-2 .st"), "off");
    await page.click("#sound-toggle-2");                                     // the notebook has the same switch
    assert.equal(await page.getAttribute("#sound-toggle", "aria-checked"), "true");
    await page.click("#resume");
    await page.click("#begin");
    await page.fill("#answer", "learn"); await page.click("#try");
    await door(page, "Room 2");
    assert.deepEqual(page.errors, []);
    await page.close();
    for (const init of [() => { window.AudioContext = undefined; window.webkitAudioContext = undefined; },
                        () => { window.AudioContext = window.webkitAudioContext = function(){ throw new Error("audio is blocked"); }; }]) {
      const mute = await newPage(browser, base, { init });
      await mute.click("#begin");
      await mute.fill("#answer", "wrong"); await mute.click("#try");
      await mute.locator(".dial").first().focus(); await mute.keyboard.type("learn"); await mute.keyboard.press("Enter");
      await mute.keyboard.press("Enter");                                  // focus is on "Go through the door"
      await mute.locator("#stage h2:has-text('Room 2')").waitFor();
      assert.deepEqual(mute.errors, [], "no errors without audio");
      await mute.close();
    }
  });

  await test("the notebook (pause menu) opens from the watch, stops the clock and keeps the keyboard inside", async () => {
    const page = await newPage(browser, base);
    await page.click("#begin");
    await page.locator("#stage h2:has-text('Room 1')").waitFor();
    assert.equal(await page.locator("#doors .door").count(), 5, "one key per room");
    assert.equal(await page.locator("#doors .door.current").count(), 1);
    await page.click("#watch");
    assert.equal(await page.isVisible("#pause"), true);
    assert.equal(await page.evaluate(() => document.activeElement.id), "resume");
    const t0 = await page.textContent("#p-time");
    await page.waitForTimeout(1300);
    assert.equal(await page.evaluate(() => fmtTime(elapsed())), t0, "the clock stands still while the notebook is open");
    for (let i = 0; i < 6; i++) { await page.keyboard.press("Tab"); assert.equal(await page.evaluate(() => !!document.activeElement.closest("#pause")), true, "Tab stays in the notebook"); }
    await page.click("#restart");
    assert.match(await page.textContent("#restart"), /Press again/, "starting over asks first");
    await page.keyboard.press("Escape");
    assert.equal(await page.isHidden("#pause"), true);
    assert.match(await page.textContent("#stage h2"), /Room 1/, "still in the room");
    const name = await page.textContent("#draft");
    await page.click("#draft");                                              // the pencilled note unfolds
    assert.equal(await page.getAttribute("#draft", "aria-expanded"), "true");
    assert.equal(await page.isVisible("#draft-more"), true);
    assert.equal(await page.getAttribute("#draft", "aria-controls"), "draft-more");
    assert.equal(await page.textContent("#draft"), name, "the note keeps the same name when it unfolds");
    assert.deepEqual(page.errors, []);
    await page.close();
  });

  await test("a wide desktop window and a short LMS frame: the page never scrolls, and the room scrolls inside the scene when it must", async () => {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 1100, height: 620 }]) {
      const page = await newPage(browser, base, { viewport });
      await playThrough(page, viewport.width === 1440 ? "wide" : null);
      const o = await page.evaluate(() => ({ x: document.documentElement.scrollWidth - innerWidth, y: document.documentElement.scrollHeight - innerHeight }));
      assert.ok(o.x <= 1 && o.y <= 1, `page scrolls by ${o.x} x ${o.y}px at ${viewport.width}x${viewport.height}`);
      assert.equal(await page.evaluate(() => { const v = document.querySelector("#view"); return v.scrollWidth <= v.clientWidth + 1 && getComputedStyle(v).overflowY === "auto"; }), true, "the room scrolls up and down only");
      assert.match(await page.textContent("#stage"), /DEWEY1916/);
      assert.deepEqual(page.errors, []);
      await page.close();
    }
  });

  await browser.close();
  server.close();
  console.log(`\n${passed} passed, ${failed} failed. Screenshots: tests/screenshots/`);
  process.exit(failed ? 1 : 0);
})();
