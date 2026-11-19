// Automated tests for the teacher editor (editor.html). Run with `npm test`.
const playwright = require("playwright");
const engine = playwright[process.env.BROWSER || "chromium"];   // BROWSER=webkit npm test also runs the editor in WebKit
const assert = require("assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { start } = require("../scripts/serve.js");
const ER = require("../src/shared.js");

const SHOTS = path.join(__dirname, "screenshots");
fs.mkdirSync(SHOTS, { recursive: true });
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "escape-editor-"));
// After a solve the game waits for the player: "Go through the door" (#onward) moves on.
const door = async (game, heading) => { await game.click("#onward"); await game.locator("#stage h2", { hasText: heading }).waitFor(); };

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log(`  ✔ ${name}`); }
  catch (e) { failed++; console.log(`  ✘ ${name}\n      ${String(e.stack || e).split("\n").slice(0, 4).join("\n      ")}`); }
}

const QUIZ_TEXT = `Q: Who wrote Democracy and Education?
A: John Dewey | Dewey
Source: Test source p. 1
Verified: yes

Q: Which philosophy is built around the "Great Books"?
- Essentialism
* Perennialism
- Existentialism
Source: Test source p. 2
Verified: yes`;

async function openEditor(browser, base) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  page.errors = [];
  page.on("pageerror", e => page.errors.push(e.message));
  page.on("dialog", d => { page.errors.push("native dialog: " + d.message()); d.dismiss(); });   // the editor asks on its own slips now
  await page.goto(base + "/editor.html?mode=advanced");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  return page;
}
async function download(page, clickSelector) {
  // Exporting a draft asks first on an in-app slip ("Export anyway"); a teacher would press it, so the helper does too.
  const [dl] = await Promise.all([page.waitForEvent("download"), (async () => {
    await page.click(clickSelector); await page.waitForTimeout(50);
    // up to two slips: the exit password (changed sample or none yet), then the unchecked-items one
    for (let i = 0; i < 2; i++) { if (!(await page.locator(".modal #ask-ok").count())) break; await page.click("#ask-ok"); await page.waitForTimeout(50); }
  })()]);
  const file = path.join(TMP, dl.suggestedFilename());
  await dl.saveAs(file);
  return file;
}
// New blank escape room with one quiz room filled from QUIZ_TEXT, everything verified.
async function makeQuizRoom(page) {
  await page.click("#btn-new"); await page.click("#new-blank");
  await page.fill("text=Escape room title >> xpath=.. >> input", "Chapter 3 Review");
  await page.click("#nav .item:has-text('Finish & grading')");
  await page.fill("text=Exit password >> xpath=.. >> input", "MANN1837");
  await page.click("#nav .item:has-text('1.')");
  await page.click("text=Edit all questions as text");
  await page.fill("#quiz-text", QUIZ_TEXT);
  await page.click("text=Use this text");
  // New questions come back un-checked; tick them the way the teacher would.
  for (const box of await page.locator(".entry .verify label.chk").all()) await box.click();
}

(async () => {
  const server = await start(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await engine.launch();
  // every page starts as a returning visitor: the first-visit accessibility prompt is tested in tests/a11y-prompt.js
  const plainPage = browser.newPage.bind(browser);
  browser.newPage = async (...a) => { const p = await plainPage(...a); await p.addInitScript(require("./skip-ask.js")); return p; };
  console.log("\nEscape room editor tests\n");

  await test("opens with the sample content, all 40 items unchecked", async () => {
    const page = await openEditor(browser, base);
    assert.match(await page.textContent("#meter"), /0 \/ 40 checked/);
    assert.equal(await page.locator("#nav .item:has-text('to check')").count(), 5);
    await page.click("#nav .item:has-text('1.')");
    assert.match(await page.textContent("#answer-key"), /Lock combination: LEARN/);
    await page.screenshot({ path: path.join(SHOTS, "editor-room.png") });
    assert.deepEqual(page.errors, []);
    await page.close();
  });

  await test("checking an item counts it; editing it afterwards un-checks it", async () => {
    const page = await openEditor(browser, base);
    await page.click("#nav .item:has-text('1.')");
    const first = page.locator(".entry").first();
    await first.locator("text=I checked this is correct").click();
    assert.match(await page.textContent("#meter"), /1 \/ 40/);
    await first.locator("textarea").first().fill("Changed clue text");
    assert.match(await page.textContent("#meter"), /0 \/ 40/);
    assert.equal(await first.locator(".verify input[type=checkbox]").isChecked(), false);
    await page.close();
  });

  await test("changing a code word updates the lock combination", async () => {
    const page = await openEditor(browser, base);
    await page.click("#nav .item:has-text('1.')");
    await page.click("#tab-lock");
    await page.fill("text=Code word (optional) >> xpath=.. >> input", "STUDY");
    assert.match(await page.textContent("#answer-key"), /Lock combination: STUDY/);
    await page.close();
  });

  await test("quiz questions can be written as plain text", async () => {
    const page = await openEditor(browser, base);
    await makeQuizRoom(page);
    assert.equal(await page.locator(".entry").count(), 2);
    assert.match(await page.textContent("#meter"), /2 \/ 2 checked/);
    await page.screenshot({ path: path.join(SHOTS, "editor-quiz.png"), fullPage: true });
    await page.close();
  });

  await test("problems are shown instead of exporting a broken game", async () => {
    const page = await openEditor(browser, base);
    await page.click("#btn-new"); await page.click("#new-blank");   // blank question has no answer
    await page.click("#btn-preview");
    assert.match(await page.textContent(".overlay"), /needs at least one accepted answer/);
    await page.close();
  });

  await test("exported game plays: quiz lock, exit password, no draft notice when all checked", async () => {
    const page = await openEditor(browser, base);
    await makeQuizRoom(page);
    await page.click("#btn-export");
    const file = await download(page, "#export-html");
    assert.equal(path.basename(file), "Chapter-3-Review.html");
    const html = fs.readFileSync(file, "utf8");
    assert.equal(ER.configFromHtml(html).meta.title, "Chapter 3 Review");

    const game = await browser.newPage();
    const errors = []; game.on("pageerror", e => errors.push(e.message));
    await game.goto("file://" + file);
    assert.equal(await game.isHidden("#draft"), true, "draft notice should be hidden");
    await game.click("#begin");
    await game.fill("input[name=q0]", "dewey");
    await game.check("input[name=q1][value='0']");                    // wrong choice
    await game.click("#try");
    assert.match(await game.textContent("#msg"), /1 of 2 answers are correct/);
    await game.check("input[name=q1][value='1']");
    await game.click("#try"); await door(game, "You Escaped");
    assert.match(await game.textContent("#stage"), /You Escaped!/);
    assert.equal(await game.textContent("#exit-password"), "MANN1837");
    assert.deepEqual(errors, []);
    await game.close(); await page.close();
  });

  await test("Export: “Copy class link” makes a link that holds the escape room and plays ", async () => {
    const page = await openEditor(browser, base);
    await makeQuizRoom(page);
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.click("#btn-export");
    assert.match(await page.locator(".slip h3").first().textContent(), /^Class link/, "the link comes first");
    await page.click("#export-link");
    await page.locator("#export-link-text").waitFor();
    const link = await page.inputValue("#export-link-text");
    assert.ok(link.startsWith(base + "/play.html#play=1."));
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), link, "copied");
    const cfg = await ER.fromLink(link);
    assert.equal(cfg.meta.title, "Chapter 3 Review"); assert.equal(cfg.finish.exitPassword, "MANN1837");
    assert.deepEqual(cfg, ER.cleanConfig(await page.evaluate(() => JSON.parse(JSON.stringify(cfg)))), "the link holds exactly what is in the editor");
    assert.equal(await page.locator("#export-qr svg").count(), 1, "a short link gets a QR code");
    const game = await browser.newPage();
    const errors = []; game.on("pageerror", e => errors.push(e.message));
    await game.goto(link); await game.click("#begin");
    assert.equal(await game.isHidden("#draft"), true, "everything was checked, so no Draft notice");
    await game.fill("input[name=q0]", "dewey"); await game.check("input[name=q1][value='1']");
    await game.click("#try"); await door(game, "You Escaped");
    assert.equal(await game.textContent("#exit-password"), "MANN1837");
    assert.deepEqual(errors, []); assert.deepEqual(page.errors, []);
    await game.close(); await page.close();
  });

  await test("SCORM export is a valid package containing the game", async () => {
    const page = await openEditor(browser, base);
    await makeQuizRoom(page);
    await page.click("#btn-export");
    const file = await download(page, "#export-scorm");
    assert.equal(path.basename(file), "Chapter-3-Review-SCORM.zip");
    const listing = execFileSync("unzip", ["-l", file]).toString();
    assert.match(listing, /imsmanifest\.xml/); assert.match(listing, /index\.html/);
    execFileSync("unzip", ["-tq", file]);
    const manifest = execFileSync("unzip", ["-p", file, "imsmanifest.xml"]).toString();
    assert.match(manifest, /<title>Chapter 3 Review<\/title>/);
    const inner = execFileSync("unzip", ["-p", file, "index.html"]).toString();
    assert.equal(ER.configFromHtml(inner).rooms[0].questions.length, 2);
    await page.close();
  });

  await test("accuracy grading sends a lower score to the LMS after a wrong try", async () => {
    const page = await openEditor(browser, base);
    await makeQuizRoom(page);
    await page.click("#nav .item:has-text('Finish & grading')");
    await page.click("#tab-grading");
    await page.click(".field[data-key=mode] label:has(input[value=deductions])");
    await page.click("#btn-export");
    const file = await download(page, "#export-html");
    const game = await browser.newPage();
    await game.addInitScript(() => { window.__scorm = {}; window.API = { LMSInitialize: () => "true", LMSCommit: () => "true", LMSFinish: () => "true",
      LMSGetValue: () => "", LMSSetValue: (k, v) => { window.__scorm[k] = v; return "true"; } }; });
    await game.goto("file://" + file);
    await game.click("#begin");
    await game.fill("input[name=q0]", "nope"); await game.check("input[name=q1][value='1']");
    await game.click("#try");                                         // 1 wrong try = -2 points
    await game.fill("input[name=q0]", "John Dewey"); await game.click("#try"); await door(game, "You Escaped");
    const s = await game.evaluate(() => window.__scorm);
    assert.equal(s["cmi.core.score.raw"], "98");
    assert.match(await game.textContent("#stage"), /Score: 98%/);
    await game.close(); await page.close();
  });

  await test("an exported game file can be reopened in the editor", async () => {
    const page = await openEditor(browser, base);
    await makeQuizRoom(page);
    await page.click("#btn-export");
    const file = await download(page, "#export-html");
    await page.keyboard.press("Escape");
    await page.click("#btn-new"); await page.click("#new-sample");
    assert.match(await page.textContent("#meter"), /\/ 40/);
    await page.setInputFiles("#file", file);
    // opening replaces what is on the bench, so a slip asks first; Esc backs out and nothing changes
    await page.locator(".modal[role=alertdialog]").waitFor();
    assert.match(await page.textContent(".modal h2"), /Open “Chapter 3 Review”\?/);
    await page.keyboard.press("Escape");
    assert.equal(await page.locator(".modal").count(), 0);
    assert.match(await page.textContent("#meter"), /\/ 40/);
    await page.setInputFiles("#file", file);
    await page.click("#ask-ok");
    await page.waitForFunction(() => /2 \/ 2/.test(document.querySelector("#meter").textContent));
    assert.match(await page.textContent("#nav"), /New question room/);
    await page.close();
  });

  await test("review sheet lists every answer", async () => {
    const page = await openEditor(browser, base);
    await page.click("#btn-review");
    const frame = page.frameLocator(".overlay iframe");
    const text = await frame.locator("body").textContent();
    for (const s of ["LEARN", "9154", "DEWEY1916", "Progressivism", "Paideia"]) assert.ok(text.includes(s), `review sheet is missing ${s}`);
    await page.screenshot({ path: path.join(SHOTS, "editor-review.png") });
    await page.close();
  });

  await test("student preview: jump between rooms, show answers, exit", async () => {
    const page = await openEditor(browser, base);
    await page.click("#btn-preview");
    const frame = page.frameLocator(".preview iframe");
    assert.equal(await frame.locator("#doors .door").count(), 5);
    assert.match(await frame.locator("#stage h2").textContent(), /Door Clicks Shut/);   // starts at the intro
    await page.click(".pbar button[data-room='2']");
    await frame.locator("#stage h2:has-text('Room 2')").waitFor();
    assert.equal(await page.getAttribute(".pbar button[data-room='2']", "aria-current"), "step");
    assert.equal(await frame.locator("#teacher-key").count(), 0, "answers hidden by default");
    await page.click("text=Show answers");
    assert.match(await frame.locator("#teacher-key").textContent(), /Lock combination: 9154/);
    await page.click(".pbar button[aria-label='Next room']");
    await frame.locator("#stage h2:has-text('Room 3')").waitFor();
    assert.match(await frame.locator("#teacher-key").textContent(), /1837/, "answers stay on when moving rooms");
    await page.screenshot({ path: path.join(SHOTS, "editor-preview.png") });
    await frame.locator("#stage").focus();                              // focus inside the student view
    await page.keyboard.press("Escape");
    await page.locator(".preview").waitFor({ state: "detached", timeout: 3000 });   // Esc exits the preview
    await page.click("#nav .item:has-text('4.')");
    await page.click("#preview-room");                                   // 'Preview this room' opens at that room
    await page.frameLocator(".preview iframe").locator("#stage h2:has-text('Room 4')").waitFor();
    await page.click("#preview-exit");
    assert.equal(await page.locator(".preview").count(), 0);
    assert.deepEqual(page.errors, []);
    await page.close();
  });

  await test("answers never appear in exported games", async () => {
    const page = await openEditor(browser, base);
    await page.click("#btn-export");
    const file = await download(page, "#export-html");
    const cfg = ER.configFromHtml(fs.readFileSync(file, "utf8"));
    assert.equal(cfg.__preview, undefined);
    const game = await browser.newPage();
    await game.goto("file://" + file);
    await game.evaluate(() => window.postMessage({ er: "key", on: true }, "*"));    // a student can't switch the key on
    await game.click("#begin"); await game.waitForTimeout(200);
    assert.equal(await game.locator("#teacher-key").count(), 0);
    await game.close(); await page.close();
  });

  await test("hints: off by default, max two, warn on give-aways, unlock only after wrong tries", async () => {
    const page = await openEditor(browser, base);
    await page.click("#nav .item:has-text('1.')");
    await page.click("#tab-hints");
    assert.equal(await page.isChecked("#hints-toggle"), false);
    await page.click("label.switch:has(#hints-toggle)");
    assert.equal(await page.locator("text=Hint 1: a gentle nudge").count(), 1);
    assert.equal(await page.locator("text=Hint 2: a stronger nudge").count(), 1);
    assert.equal(await page.locator("text=Hint 3").count(), 0);
    const hint2 = page.locator("text=Hint 2: a stronger nudge >> xpath=.. >> textarea");
    await hint2.fill("The answer is LEARN.");
    assert.match(await page.textContent("#hint-warnings"), /Hint 2 may give away the answer: it contains the lock combination/);
    await hint2.fill("Start with the descriptions you're surest about.");
    assert.equal((await page.textContent("#hint-warnings")).trim(), "");

    await page.click("#btn-export");
    const file = await download(page, "#export-html");
    const game = await browser.newPage();
    await game.goto("file://" + file);
    await game.click("#begin");
    assert.equal(await game.isDisabled("#hint-btn"), true, "hint 1 is locked on arrival");
    assert.match(await game.textContent("#hint-note"), /after 1 more wrong try/);
    await game.fill("#answer", "xxxxx"); await game.click("#try");
    assert.equal(await game.isDisabled("#hint-btn"), false, "hint 1 unlocks after 1 wrong try");
    await game.click("#hint-btn");
    assert.equal(await game.locator("#hints .hint").count(), 1);
    assert.equal(await game.isDisabled("#hint-btn"), true, "hint 2 still locked");
    assert.match(await game.textContent("#hint-note"), /after 2 more wrong tries/);
    for (let i = 0; i < 2; i++) { await game.fill("#answer", "yyyyy"); await game.click("#try"); }
    await game.waitForFunction(() => !document.querySelector("#hint-btn").disabled);   // the second hint unlocks a moment after the third wrong try
    await game.click("#hint-btn");
    assert.equal(await game.locator("#hints .hint").count(), 2);
    assert.match(await game.textContent("#hints"), /surest about/);
    assert.equal(await game.isDisabled("#hint-btn"), true);
    assert.equal(await game.textContent("#hintCount"), "2");
    await game.close(); await page.close();
  });

  await test("turning hints on without writing any is caught", async () => {
    const page = await openEditor(browser, base);
    await page.click("#btn-new"); await page.click("#new-blank");
    await page.click("#nav .item:has-text('1.')");
    await page.click("text=Edit all questions as text");
    await page.fill("#quiz-text", "Q: 2+2?\nA: 4");
    await page.click("text=Use this text");
    await page.click("#tab-hints");
    await page.click("label.switch:has(#hints-toggle)");
    await page.click("#btn-preview");
    assert.match(await page.textContent(".overlay"), /hints are turned on, but no hint has been written/);
    await page.close();
  });

  await test("answer key shows quiz answers and updates while typing", async () => {
    const page = await openEditor(browser, base);
    await makeQuizRoom(page);
    const key = await page.textContent("#answer-key");
    assert.match(key, /John Dewey \/ Dewey/); assert.match(key, /Perennialism/);
    await page.locator("text=Accepted answers >> xpath=.. >> input").first().fill("J. Dewey");
    assert.match(await page.textContent("#answer-key"), /J\. Dewey/);
    await page.close();
  });

  await test("questions changed in text mode come back un-checked", async () => {
    const page = await openEditor(browser, base);
    await makeQuizRoom(page);
    assert.match(await page.textContent("#meter"), /2 \/ 2 checked/);
    await page.click("text=Edit all questions as text");
    const ta = page.locator("#quiz-text");
    await ta.fill((await ta.inputValue()).replace("A: John Dewey | Dewey", "A: Horace Mann"));
    await page.click("text=Use this text");
    assert.match(await page.textContent("#meter"), /1 \/ 2 checked/, "the edited question is un-checked, the untouched one stays checked");
    await page.close();
  });

  await test("deleting a choice keeps the same correct answer and un-checks the question", async () => {
    const page = await openEditor(browser, base);
    await makeQuizRoom(page);                       // Q2 choices: Essentialism, *Perennialism, Existentialism
    await page.click("button[aria-label='Delete choice 1'] >> nth=0");
    assert.match(await page.textContent("#answer-key"), /Perennialism/);
    assert.doesNotMatch(await page.textContent("#answer-key"), /→\s*Existentialism/);
    assert.match(await page.textContent("#meter"), /1 \/ 2 checked/);
    await page.click("button[aria-label='Delete choice 1'] >> nth=0");   // delete the correct one itself
    await page.click("#btn-preview");
    assert.match(await page.textContent(".overlay"), /mark which choice is correct/);
    await page.close();
  });

  await test("text view marks the right choice when a blank choice comes first", async () => {
    const page = await openEditor(browser, base);
    await makeQuizRoom(page);
    await page.getByRole("textbox", { name: "Choice 1", exact: true }).first().fill("");          // blank before the correct choice
    await page.click("text=Edit all questions as text");
    const text = await page.inputValue("#quiz-text");
    assert.match(text, /\* Perennialism/); assert.match(text, /- Existentialism/);
    await page.close();
  });

  await test("removing a sorting category makes its items pick a new answer", async () => {
    const page = await openEditor(browser, base);
    await page.click("#nav .item:has-text('4.')");
    await page.click("text=Add category");
    await page.locator("text=Category 3 >> xpath=.. >> input[type=text]").fill("Mixed");
    await page.locator(".entry").first().locator(".rotary label:has(input[value='2'])").click();      // the new 3rd category
    await page.locator(".entry").first().locator("label.chk").click();
    await page.click("button:has-text('Remove') >> nth=2");                       // remove "Mixed"
    // it is an answer, so the editor asks first on its own slip: Cancel has the keyboard, not the destructive button
    assert.match(await page.textContent(".modal[role=alertdialog]"), /is the answer for 1 item/);
    assert.equal(await page.evaluate(() => document.activeElement.id), "ask-cancel");
    await page.click("#ask-ok");
    await page.click("#btn-preview");
    assert.match(await page.textContent(".overlay"), /item 1: pick its correct category/);
    await page.close();
  });

  await test("moving another room above keeps you on the room you're editing", async () => {
    const page = await openEditor(browser, base);
    await page.click("#nav .item:has-text('2.')");
    await page.click("button[aria-label='Move room 3 up']");
    assert.match(await page.textContent("main h2"), /The Portrait Gallery/);
    await page.close();
  });

  await test("empty or incomplete answers don't count as wrong tries", async () => {
    const page = await openEditor(browser, base);
    await page.click("#nav .item:has-text('1.')");
    await page.click("#tab-hints");
    await page.click("label.switch:has(#hints-toggle)");
    await page.click("#nav .item:has-text('Finish & grading')");
    await page.click("#tab-grading");
    await page.click(".field[data-key=mode] label:has(input[value=deductions])");
    await page.click("#btn-export");
    const file = await download(page, "#export-html");
    const game = await browser.newPage();
    await game.addInitScript(() => { window.__scorm = {}; window.API = { LMSInitialize: () => "true", LMSCommit: () => "true", LMSFinish: () => "true",
      LMSGetValue: () => "", LMSSetValue: (k, v) => { window.__scorm[k] = v; return "true"; } }; });
    await game.goto("file://" + file);
    await game.click("#begin");
    await game.click("#try");                                                     // nothing typed
    assert.match(await game.textContent("#msg"), /Type the code first/);
    assert.equal(await game.isDisabled("#hint-btn"), true, "an empty try doesn't unlock a hint");
    await game.fill("#answer", "xxxxx"); await game.click("#try");
    assert.equal(await game.isDisabled("#hint-btn"), false, "a real wrong try does unlock it");
    await game.close();

    await page.keyboard.press("Escape");                                         // close the export window
    await page.click("#nav .item:has-text('4.')");
    await page.click("#preview-room");
    const f = page.frameLocator(".preview iframe");
    await f.locator("#stage h2:has-text('Room 4')").waitFor();
    await f.locator("#try").click();
    assert.match(await f.locator("#msg").textContent(), /Choose a category for every item first/);
    assert.equal(await f.locator("#stage.shake").count(), 0, "no wrong-try shake for an incomplete answer");
    await page.close();
  });

  await test("the look of a matching room can be changed, and the preview follows", async () => {
    const page = await openEditor(browser, base);
    await page.click("#nav .item:has-text('1.')");
    await page.click("#tab-lock");
    assert.equal(await page.inputValue("#look-row input:checked"), "books", "the sample library uses books");
    assert.match(await page.textContent("#look-help"), /book spine/);
    await page.click("#preview-room");
    let f = page.frameLocator(".preview iframe");
    await f.locator("#stage h2:has-text('Room 1')").waitFor();
    assert.equal(await f.locator(".shelf .vol").count(), 5);
    await page.click("#preview-exit");
    await page.click("#look-row label:has(input[value=portraits])");
    assert.match(await page.textContent("#look-help"), /framed portrait/);
    assert.equal(await page.evaluate(() => cfg.rooms[0].look), "portraits");
    assert.equal(await page.evaluate(() => ER.reviewStatus(cfg).verified), 0, "changing the look never marks anything as checked");
    await page.click("#preview-room");
    f = page.frameLocator(".preview iframe");
    await f.locator(".gallery .portrait").first().waitFor();
    assert.equal(await f.locator(".gallery .portrait").count(), 5);
    assert.equal(await f.locator(".shelf").count(), 0);
    assert.deepEqual((await f.locator(".plate b").allTextContents()).sort(), ["A", "E", "L", "N", "R"]);
    await page.screenshot({ path: path.join(SHOTS, "editor-preview-look.png") });
    await page.click("#preview-exit");
    await page.click("#look-row label:has(input[value=cards])");
    await page.click("#preview-room");
    f = page.frameLocator(".preview iframe");
    await f.locator(".mcard").first().waitFor();
    assert.equal(await f.locator(".mcard").count(), 5);
    await page.click("#preview-exit");
    // A new matching room starts with plain cards, and the choice survives export and reopening.
    await page.click("#look-row label:has(input[value=books])");
    await page.click("#btn-export");
    const file = await download(page, "#export-html");
    assert.equal(ER.configFromHtml(fs.readFileSync(file, "utf8")).rooms[0].look, "books");
    assert.deepEqual(page.errors, []);
    await page.close();
  });

  await test("phone: the cabinet is a drawer that opens from the brass handle and closes when a room is chosen", async () => {
    const page = await openEditor(browser, base);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator("#nav").waitFor({ state: "hidden" });              // the cabinet is put away on a phone
    const top = await page.locator("main h2").evaluate(el => el.getBoundingClientRect().top);
    assert.ok(top < 160, `the page starts straight away, not under a list of rooms (heading at ${top}px)`);
    assert.equal(await page.getAttribute("#cabinet-handle", "aria-expanded"), "false");
    await page.click("#cabinet-handle");
    await page.locator("#nav").waitFor({ state: "visible" });
    assert.equal(await page.getAttribute("#cabinet-handle", "aria-expanded"), "true");
    await page.screenshot({ path: path.join(SHOTS, "editor-phone-cabinet.png") });
    await page.click("#nav .item:has-text('3.')");
    await page.locator("#nav").waitFor({ state: "hidden" });
    assert.equal(await page.getAttribute("#cabinet-handle", "aria-expanded"), "false");
    assert.match(await page.textContent("main h2"), /The History Hall/);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "no sideways scrolling");
    await page.screenshot({ path: path.join(SHOTS, "editor-phone-room.png") });
    await page.click("#cabinet-handle");                                  // Esc also puts it away
    await page.locator("#nav").waitFor({ state: "visible" });
    await page.keyboard.press("Escape");
    await page.locator("#nav").waitFor({ state: "hidden" });
    await page.setViewportSize({ width: 1280, height: 900 });             // on a desktop the cabinet is always there
    await page.locator("#nav").waitFor({ state: "visible" });
    assert.equal(await page.isVisible("#cabinet-handle"), false);
    assert.deepEqual(page.errors, []);
    await page.close();
  });

  await test("help sits behind ⓘ marks that open from the keyboard", async () => {
    const page = await openEditor(browser, base);
    assert.equal(await page.locator("main p.help, main small").count(), 0, "no helper paragraphs on the page");
    const mark = page.locator("main button.i[aria-label='Help: Completion code prefix']");
    assert.equal(await page.locator(".pop:visible").count(), 0);
    await page.focus("text=Course >> xpath=.. >> input");
    await page.keyboard.press("Tab");                                     // Tab reaches the next ⓘ, which shows its slip
    assert.equal(await mark.evaluate(el => el === document.activeElement), true);
    await page.locator(".pop:visible").waitFor();
    assert.match(await page.textContent(".pop:visible"), /Starts each student's completion code/);
    assert.equal(await mark.getAttribute("aria-expanded"), "true");
    assert.equal(await page.getAttribute(".pop:visible", "id"), await mark.getAttribute("aria-describedby"));
    await page.keyboard.press("Escape");
    assert.equal(await page.locator(".pop:visible").count(), 0, "Esc puts it away");
    assert.equal(await mark.getAttribute("aria-expanded"), "false");
    await page.keyboard.press("Enter");                                   // Enter opens it again and pins it
    assert.equal(await page.locator(".pop:visible").count(), 1);
    await page.keyboard.press("Tab");
    assert.equal(await page.locator(".pop:visible").count(), 0, "moving on closes it");
    await mark.hover();                                                   // and it works with a mouse
    assert.equal(await page.locator(".pop:visible").count(), 1);
    assert.deepEqual(page.errors, []);
    await page.close();
  });

  await test("the not-checked warning is one line on a pinned note that unfolds", async () => {
    const page = await openEditor(browser, base);
    assert.match(await page.textContent("#draft-line"), /40 of 40 items not checked yet/);
    assert.equal(await page.isVisible("#draft-note-more"), false, "the long explanation starts folded");
    assert.equal(await page.getAttribute("#draft-note", "aria-expanded"), "false");
    assert.ok((await page.locator(".note").boundingBox()).height < 90, "the folded note is small");
    await page.focus("#draft-note"); await page.keyboard.press("Enter");
    assert.equal(await page.isVisible("#draft-note-more"), true);
    assert.equal(await page.getAttribute("#draft-note", "aria-expanded"), "true");
    assert.match(await page.textContent("#draft-note-more"), /written with AI help/);
    await page.click("#draft-note");
    assert.equal(await page.isVisible("#draft-note-more"), false);
    await page.click("#nav .item:has-text('1.')");                        // the count follows the seals
    await page.locator(".entry .verify label.chk").first().click();
    await page.waitForFunction(() => /39 of 40/.test(document.querySelector("#draft-line").textContent));
    await makeQuizRoom(page);                                             // everything checked: no note at all
    await page.locator(".note").waitFor({ state: "detached" });
    await page.close();
  });

  await test("the answer key is a sealed envelope; a new room is added from the cabinet", async () => {
    const page = await openEditor(browser, base);
    await page.click("#nav .item:has-text('2.')");
    assert.equal(await page.isVisible("#answer-key .keycard"), false, "the envelope starts sealed");
    await page.focus("#answer-key summary"); await page.keyboard.press("Enter");
    assert.equal(await page.isVisible("#answer-key .keycard"), true);
    assert.match(await page.textContent("#answer-key .keycard"), /Lock combination: 9154/);
    await page.screenshot({ path: path.join(SHOTS, "editor-answer-key.png") });
    await page.click("#add-room");
    assert.equal(await page.locator("#add-menu button").count(), 5);
    await page.click("#add-menu button[data-type=ordering]");
    assert.equal(await page.locator("#nav .item:has-text('6.')").count(), 1);
    assert.match(await page.textContent("main h2"), /New timeline room/);
    assert.equal(await page.evaluate(() => cfg.rooms[5].type), "ordering");
    assert.deepEqual(page.errors, []);
    await page.close();
  });

  await test("accessibility check: every rule flags what it should and leaves fair wording alone", async () => {
    const page = await openEditor(browser, base);
    const check = cfg => page.evaluate(c => a11yCheck(c), cfg);
    const rules = async cfg => (await check(cfg)).map(n => n.rule).sort();
    const quiz = (over = {}) => ({ type: "quiz", title: "The Strongbox", story: "Answer every slip to open the box.", hintsEnabled: true, hints: ["Look again at chapter 3."],
      questions: [{ prompt: "Who wrote Democracy and Education?", kind: "short", answers: "John Dewey | Dewey" }], ...over });
    const matching = (n, over = {}) => ({ type: "matching", title: "The Library", story: "Match each clue to a book.", hintsEnabled: true, hints: ["Find one key idea in each clue."], codeStyle: "letters",
      cards: Array.from({ length: n }, (_, i) => ({ term: "Term " + (i + 1), clue: "Clue number " + (i + 1), icon: "", code: "" })), ...over });
    const make = (rooms, over = {}) => ({ meta: { title: "Chapter 3" }, intro: { heading: "Locked in", story: "Solve every room to leave." }, finish: { exitPassword: "MANN1837", instructions: "" }, rooms, ...over });
    const story = s => make([quiz({ story: s })]);

    assert.deepEqual(await rules(make([quiz(), matching(5)])), [], "well-made content gets no notes");

    // missing title, story and instructions
    assert.deepEqual(await rules(make([quiz({ title: "", story: " " })], { meta: { title: "" }, intro: { story: "" } })), ["missing-text", "missing-text", "missing-text", "missing-text"]);
    // directions that depend on colour, position, shape, hearing, one input device, or hurrying
    assert.deepEqual(await rules(story("Open the red book to begin.")), ["colour"]);
    assert.deepEqual(await rules(story("The answers are marked in green.")), ["colour"]);
    assert.deepEqual(await rules(story("Brown v. Board of Education ended the idea that Black students and white students could be kept apart.")), [], "colour words used as names are left alone");
    assert.deepEqual(await rules(story("Read the card on the left, then the one in the top-right corner.")), ["position"]);
    assert.deepEqual(await rules(story("Start with the first shelf.")), ["position"]);
    assert.deepEqual(await rules(story("Every child has the right to an education, and Mann said so first.")), [], "“the right to” is not a direction");
    assert.deepEqual(await rules(story("Press the round button.")), ["shape"]);
    assert.deepEqual(await rules(story("When you hear the chime, move on.")), ["sound"]);
    assert.deepEqual(await rules(story("The door clicks shut behind you.")), [], "a sound in the story is not an instruction");
    assert.deepEqual(await rules(story("Click on each book, then drag the cards into place.")), ["device"]);
    assert.deepEqual(await rules(story("Choose each book, then put the cards in order.")), []);
    assert.deepEqual(await rules(story("You have 10 minutes. Hurry!")), ["time"]);
    assert.deepEqual(await rules(story("DO NOT OPEN THIS DOOR until every lock is undone.")), ["caps"]);
    assert.deepEqual(await rules(story("NCLB and IDEA changed what schools must report.")), [], "abbreviations are not shouting");
    // the dial lock: one dial per clue
    assert.deepEqual(await rules(make([matching(8)])), []);
    const long = await check(make([matching(9)]));
    assert.deepEqual(long.map(n => n.rule), ["long-code"]);
    assert.match(long[0].text, /9 dials/); assert.equal(long[0].page, 0); assert.equal(long[0].where, "Room 1 · Lock");
    assert.deepEqual(await rules(make([matching(13, { cards: matching(13).cards.map((c, i) => i < 8 ? c : { ...c, clue: "" }) })])), ["many-items"], "decoys don't lengthen the lock, but 13 cards is a lot");
    // emoji or symbols as the only meaning
    const sym = await check(make([matching(3, { cards: [{ term: "", icon: "🔬", clue: "Clue one" }, { term: "📚", icon: "", clue: "Clue two" }, { term: "Dewey", icon: "🍎", clue: "Clue three" }] })]));
    assert.deepEqual(sym.map(n => [n.rule, n.where, n.tab]), [["symbol-only", "Room 1 · Card 1", "items"], ["symbol-only", "Room 1 · Card 2", "items"]], "an icon beside a name in words is fine");
    assert.deepEqual(await rules(make([quiz({ questions: [{ prompt: "Which is right?", kind: "choice", choices: ["✔", "Perennialism"], correct: 1 }] })])), ["symbol-only"]);
    // very long reading
    const clue = "Truth is universal and unchanging. ".repeat(10);
    const heavy = await check(make([matching(2, { cards: [{ term: "Perennialism", clue }, { term: "Essentialism", clue: "Short clue" }] })]));
    assert.deepEqual(heavy.map(n => [n.rule, n.where]), [["long-text", "Room 1 · Card 1 · Clue"]]);
    assert.deepEqual(await rules(story("Read this carefully. ".repeat(180))), ["long-text", "reading-load"]);
    // quiz answers a student can actually match
    const answers = a => rules(make([quiz({ questions: [{ prompt: "Who?", kind: "short", answers: a }] })]));
    assert.deepEqual(await answers(""), ["answer-list"]);
    assert.deepEqual(await answers("John Dewey"), ["answer-list"], "one accepted answer of two words: other fair spellings are needed");
    assert.deepEqual(await answers("John Dewey | Dewey"), []);
    assert.deepEqual(await answers("Dewey"), []);
    assert.deepEqual(await answers("Education is not preparation for life; education is life itself"), ["answer-list"], "too long to type exactly");
    assert.deepEqual(await rules(make([quiz({ questions: [{ prompt: "Which?", kind: "choice", choices: ["Essentialism", "Perennialism", "All of the above"], correct: 2 }] })])), ["above"]);
    assert.deepEqual(await rules(make([quiz({ questions: [{ prompt: "Which?", kind: "choice", choices: ["A", "B", "C", "D", "E", "F", "G"], correct: 2 }] })])), ["many-items"]);
    // hints, long lists, look-alike characters
    assert.deepEqual(await rules(make([quiz({ hintsEnabled: false })])), ["no-hints"]);
    assert.deepEqual(await rules(make([quiz({ hintsEnabled: true, hints: ["", ""] })])), ["no-hints"]);
    assert.deepEqual(await rules(make([{ type: "reflection", title: "The Mirror", story: "Choose what fits you.", profiles: [], questions: [{ prompt: "Which fits?", options: [{ text: "Order" }, { text: "Freedom" }] }] }])), [], "a reflection room has no hints to miss");
    const items = n => Array.from({ length: n }, (_, i) => ({ text: "Event " + (i + 1) }));
    assert.deepEqual(await rules(make([{ type: "ordering", title: "Timeline", story: "Put these in order, oldest first.", hintsEnabled: true, hints: ["Start with the oldest."], items: items(9) }])), ["many-items"]);
    assert.deepEqual(await rules(make([{ type: "ordering", title: "Timeline", story: "Put these in order, oldest first.", hintsEnabled: true, hints: ["Start with the oldest."], items: items(8) }])), []);
    assert.deepEqual(await rules(make([{ type: "sorting", title: "Sort", story: "Stamp each slip.", hintsEnabled: true, hints: ["Who decides?"], categories: ["Traditional", "👍"], items: [{ text: "Desks in rows", category: 0 }] }])), ["symbol-only"]);
    assert.deepEqual(await rules(make([quiz()], { finish: { exitPassword: "ROOM101" } })), ["look-alike"]);
    assert.deepEqual(await rules(make([quiz()], { finish: { exitPassword: "DEWEY1916" } })), []);
    // every note is written for a teacher: where it is, what to do, and which page and tab to open
    const all = await check(make([quiz({ title: "", story: "Click on the red book on the left. HURRY UP NOW PLEASE EVERYONE.", hintsEnabled: false }), matching(10)], { intro: { story: "" } }));
    assert.equal(all.length >= 8, true);
    for (const n of all) { assert.match(n.where, /\S/); assert.equal(n.text.length > 40, true); assert.equal(typeof n.tab, "string"); assert.equal(n.page === "intro" || typeof n.page === "number", true); }
    assert.deepEqual(page.errors, []);
    await page.close();
  });

  await test("accessibility check: a page of notes that jump to the spot, a count on the drawer, on the answer sheet, never blocking", async () => {
    const page = await openEditor(browser, base);
    const count = await page.evaluate(() => a11yCheck(cfg).length);
    assert.equal(count > 0, true, "the sample has some advice (hints are off in four rooms)");
    assert.match(await page.textContent("#nav .item:has-text('Accessibility check') .mark"), new RegExp(`${count} notes`));
    await page.click("#nav .item:has-text('Accessibility check')");
    assert.equal(await page.textContent("main h2"), "Accessibility check");
    assert.match(await page.textContent("#a11y-summary"), new RegExp(`^${count} notes on what you have written\\. These are advice, not errors`));
    assert.equal(await page.locator(".notes li").count(), count);
    assert.equal(await page.locator("#answer-key, #preview-room").count(), 0);
    // a note about room 1's hints opens room 1 on its Hints tab, with the keyboard on the heading
    await page.locator(".notes li[data-rule='no-hints'] button.where").first().click();
    assert.equal(await page.textContent("main h2"), "The Library");
    assert.equal(await page.getAttribute("#tab-hints", "aria-selected"), "true");
    assert.equal(await page.evaluate(() => document.activeElement.id), "page-title");
    // writing a problem adds a note; fixing it takes the note away
    await page.click("#tab-text");
    await page.fill("text=Story / instructions >> xpath=.. >> textarea", "Click on the red book on the left.");
    await page.click("#nav .item:has-text('Accessibility check')");
    assert.equal(await page.locator(".notes li").count(), count + 3);
    assert.deepEqual(await page.$$eval(".notes li", els => els.map(e => e.dataset.rule).filter(r => ["colour", "position", "device"].includes(r)).sort()).then(l => l.slice(0, 3)), ["colour", "device", "position"]);
    assert.match(await page.textContent(".notes li[data-rule='colour']"), /“the red book”.*colour-blind/s);
    await page.click("#tab-byhand");
    assert.match(await page.textContent("#panel"), /can't see the picture/);
    // the answer sheet carries the same notes
    await page.click("#btn-review");
    const sheet = page.frameLocator(".overlay iframe");
    assert.equal(await sheet.locator("#a11y h2").textContent(), "Before you publish Accessibility check");
    assert.equal(await sheet.locator("#a11y ul.notes").first().locator("li").count() > 0, true);
    assert.match(await sheet.locator("#a11y").textContent(), new RegExp(`${count + 3} notes on what is written`));
    assert.match(await sheet.locator("#a11y").textContent(), /“the red book”/);
    assert.equal(await sheet.locator("html").getAttribute("lang"), "en");
    assert.equal(await sheet.locator("[role=img][aria-label='Not yet checked']").count(), 40);
    await page.keyboard.press("Escape");
    // advice never blocks: preview still opens, and the export folder only mentions the notes
    await page.click("#btn-export");
    assert.match(await page.textContent("#export-a11y"), new RegExp(`${count + 3} notes`));
    assert.equal(await page.isEnabled("#export-html"), true);
    await page.click("#export-a11y button");
    assert.equal(await page.textContent("main h2"), "Accessibility check");
    await page.click("#btn-preview"); await page.frameLocator(".preview iframe").locator("#begin").waitFor();
    assert.deepEqual(page.errors, []);
    await page.close();
  });

  await test("the editor asks for nothing from the internet and its fonts are built in", async () => {
    const page = await browser.newPage();
    const outside = [];
    page.on("request", r => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) outside.push(u); });
    await page.goto(base + "/editor.html?mode=advanced");
    await page.click("#btn-review"); await page.keyboard.press("Escape");
    await page.click("#btn-preview"); await page.frameLocator(".preview iframe").locator("#begin").waitFor();
    assert.deepEqual(outside, []);
    assert.equal(await page.evaluate(async () => { await document.fonts.ready; return ["IM Fell English", "IM Fell English SC", "Special Elite"].every(f => document.fonts.check(`16px "${f}"`, "Abc")); }), true);
    await page.close();
  });

  await browser.close();
  server.close();
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`\n${passed} passed, ${failed} failed.`);
  process.exit(failed ? 1 : 0);
})();
