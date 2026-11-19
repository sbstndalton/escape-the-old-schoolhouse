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
const WAIT = 1500;

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
  page.on("dialog", d => d.accept());           // accept confirm() prompts
  await page.goto(base + "/editor.html");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  return page;
}
async function download(page, clickSelector) {
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click(clickSelector)]);
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
  await page.fill("textarea[aria-label='Questions as text']", QUIZ_TEXT);
  await page.click("text=Use this text");
  // New questions come back un-checked; tick them the way the teacher would.
  for (const box of await page.locator(".entry .verify label.chk").all()) await box.click();
}

(async () => {
  const server = await start(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await engine.launch();
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
    await game.click("#try"); await game.waitForTimeout(WAIT);
    assert.match(await game.textContent("#stage"), /You Escaped!/);
    assert.equal(await game.textContent("#exit-password"), "MANN1837");
    assert.deepEqual(errors, []);
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
    await game.fill("input[name=q0]", "John Dewey"); await game.click("#try"); await game.waitForTimeout(WAIT);
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
    await page.fill("textarea[aria-label='Questions as text']", "Q: 2+2?\nA: 4");
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
    const ta = page.locator("textarea[aria-label='Questions as text']");
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
    await page.locator("input[aria-label='Choice 1']").first().fill("");          // blank before the correct choice
    await page.click("text=Edit all questions as text");
    const text = await page.inputValue("textarea[aria-label='Questions as text']");
    assert.match(text, /\* Perennialism/); assert.match(text, /- Existentialism/);
    await page.close();
  });

  await test("removing a sorting category makes its items pick a new answer", async () => {
    const page = await openEditor(browser, base);
    await page.click("#nav .item:has-text('4.')");
    await page.click("text=+ Add category");
    await page.locator("text=Category 3 >> xpath=.. >> input[type=text]").fill("Mixed");
    await page.locator(".entry").first().locator(".rotary label:has(input[value='2'])").click();      // the new 3rd category
    await page.locator(".entry").first().locator("label.chk").click();
    await page.click("button:has-text('Remove') >> nth=2");                       // remove "Mixed"
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
    assert.equal(await page.locator(".pop").count(), 0);
    await page.focus("text=Course >> xpath=.. >> input");
    await page.keyboard.press("Tab");                                     // Tab reaches the next ⓘ, which shows its slip
    assert.equal(await mark.evaluate(el => el === document.activeElement), true);
    await page.locator(".pop").waitFor();
    assert.match(await page.textContent(".pop"), /Starts each student's completion code/);
    assert.equal(await mark.getAttribute("aria-expanded"), "true");
    assert.equal(await page.getAttribute(".pop", "id"), await mark.getAttribute("aria-describedby"));
    await page.keyboard.press("Escape");
    assert.equal(await page.locator(".pop").count(), 0, "Esc puts it away");
    assert.equal(await mark.getAttribute("aria-expanded"), "false");
    await page.keyboard.press("Enter");                                   // Enter opens it again and pins it
    assert.equal(await page.locator(".pop").count(), 1);
    await page.keyboard.press("Tab");
    assert.equal(await page.locator(".pop").count(), 0, "moving on closes it");
    await mark.hover();                                                   // and it works with a mouse
    assert.equal(await page.locator(".pop").count(), 1);
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

  await test("the editor asks for nothing from the internet and its fonts are built in", async () => {
    const page = await browser.newPage();
    const outside = [];
    page.on("request", r => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) outside.push(u); });
    await page.goto(base + "/editor.html");
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
