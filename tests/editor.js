// Automated tests for the teacher editor (editor.html). Run with `npm test`.
const { chromium } = require("playwright");
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
}

(async () => {
  const server = await start(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  console.log("\nEscape room editor tests\n");

  await test("opens with the sample content, all 40 items unchecked", async () => {
    const page = await openEditor(browser, base);
    assert.match(await page.textContent("#meter"), /0 of 40 checked/);
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
    assert.match(await page.textContent("#meter"), /1 of 40/);
    await first.locator("textarea").first().fill("Changed clue text");
    assert.match(await page.textContent("#meter"), /0 of 40/);
    assert.equal(await first.locator(".verify input[type=checkbox]").isChecked(), false);
    await page.close();
  });

  await test("changing a code word updates the lock combination", async () => {
    const page = await openEditor(browser, base);
    await page.click("#nav .item:has-text('1.')");
    await page.fill("text=Code word (optional) >> xpath=.. >> input", "STUDY");
    assert.match(await page.textContent("#answer-key"), /Lock combination: STUDY/);
    await page.close();
  });

  await test("quiz questions can be written as plain text", async () => {
    const page = await openEditor(browser, base);
    await makeQuizRoom(page);
    assert.equal(await page.locator(".entry").count(), 2);
    assert.match(await page.textContent("#meter"), /2 of 2 checked/);
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
    await page.selectOption("text=Grading >> xpath=.. >> select", "deductions");
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
    assert.match(await page.textContent("#meter"), /of 40/);
    await page.setInputFiles("#file", file);
    await page.waitForFunction(() => /2 of 2/.test(document.querySelector("#meter").textContent));
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

  await browser.close();
  server.close();
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`\n${passed} passed, ${failed} failed.`);
  process.exit(failed ? 1 : 0);
})();
