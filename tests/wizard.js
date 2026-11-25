// Tests for the guided steps (the wizard) in the teacher editor. Run with `npm test`, or `node tests/wizard.js`.
// The wizard edits the same content and browser storage as Advanced mode; these tests walk it the way a teacher would.
const playwright = require("playwright");
const engine = playwright[process.env.BROWSER || "chromium"];
const assert = require("assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { start } = require("../scripts/serve.js");
const ER = require("../src/shared.js");

const SHOTS = path.join(__dirname, "screenshots");
fs.mkdirSync(SHOTS, { recursive: true });
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "escape-wizard-"));

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log(`  ✔ ${name}`); }
  catch (e) { failed++; console.log(`  ✘ ${name}\n      ${String(e.stack || e).split("\n").slice(0, 5).join("\n      ")}`); }
}

let base, browser;
async function fresh(viewport = { width: 1280, height: 900 }) {
  const ctx = await browser.newContext({ viewport, acceptDownloads: true });
  await ctx.addInitScript(require("./skip-ask.js"));            // a returning visitor: the first-visit prompt is tested in tests/a11y-prompt.js
  const page = await ctx.newPage();
  page.errors = [];
  page.on("pageerror", e => page.errors.push(e.message));
  page.on("dialog", d => { if (d.type() !== "beforeunload") page.errors.push("native dialog: " + d.message()); d.dismiss().catch(() => {}); });
  await page.goto(base + "/editor.html");
  return page;
}
// Wait for a step: the address changes first, then the page is drawn and the heading takes focus.
const heading = (page, text) => page.waitForFunction(t => { const h = document.getElementById("wiz-h1"); return h && h.textContent.includes(t); }, text, { timeout: 5000 });
const go = async (page, text) => { await page.click("#wiz-continue"); await heading(page, text); };
const h1 = page => page.textContent("#wiz-h1");
const squash = s => String(s).replace(/\s+/g, " ").trim();
const active = page => page.evaluate(() => document.activeElement && document.activeElement.id);
async function download(page, selector, answer = []) {
  // Slips may ask first (the exit password, then unchecked items); `answer` says what to do with each.
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 8000 }), (async () => {
    await page.click(selector);
    for (const a of answer) { await page.locator(".modal #ask-ok").waitFor(); if (typeof a === "function") await a(); await page.click("#ask-ok"); await page.waitForTimeout(60); }
  })()]);
  const file = path.join(TMP, `${Date.now()}-${dl.suggestedFilename()}`);
  await dl.saveAs(file);
  return file;
}
async function startWith(page, how) {
  await go(page, "How do you want to start?");
  await page.click(`label[for=start-${how}]`);
  await page.click("#wiz-continue");
}

(async () => {
  const server = await start(0);
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await engine.launch();
  console.log("\nGuided steps (wizard) tests\n");

  await test("a first visit opens the guided steps at Welcome: the question is the heading, the step is in the title", async () => {
    const page = await fresh();
    assert.equal(await page.getAttribute("html", "data-mode"), "wizard");
    assert.equal(await h1(page), "Make an escape room for your class");
    assert.equal(await page.title(), "Step 1 of 10: Make an escape room for your class – Escape room maker");
    assert.equal(await page.locator("#wiz-steps li").count(), 10);
    assert.equal(await page.locator("#wiz-steps li[aria-current=step]").textContent(), "Welcome (this step)");
    assert.equal(await page.isVisible("#main"), false, "Advanced mode is put away");
    assert.match(await page.textContent("#wiz-save"), /Nothing saved in this browser yet\. If you worked on this before, open your saved file\./);
    await page.screenshot({ path: path.join(SHOTS, "wizard-welcome.png") });
    await go(page, "How do you want to start?");
    assert.equal(await active(page), "wiz-h1", "focus moves to the new question");
    assert.equal(await page.locator("fieldset legend #wiz-h1").count(), 1, "the radio question is the legend");
    assert.match(await page.textContent("#wiz-start-note"), /Nothing saved in this browser yet/);
    await page.goBack(); await heading(page, "Make an escape room");
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  await test("the error summary: linked errors that focus their field, Error: in the title, inline errors", async () => {
    const page = await fresh();
    await go(page, "How do you want to start?");
    await page.click("#wiz-continue");
    await page.locator("#wiz-errors").waitFor();
    assert.equal(await active(page), "wiz-errors", "focus moves to the summary");
    assert.match(await page.title(), /^Error: Step 2 of 10/);
    assert.equal(await page.textContent("#wiz-errors h2"), "There is a problem");
    await page.click("#wiz-errors a");
    assert.equal(await active(page), "start-sample", "the link focuses the first choice");
    await page.click("label[for=start-sample]"); await page.click("#wiz-continue");
    await heading(page, "What is this escape room called?");
    await page.fill("#wiz-title", "   ");
    await page.click("#wiz-continue");
    await page.locator("#wiz-errors").waitFor();
    assert.match(await page.textContent("#wiz-errors"), /Enter a name for your escape room/);
    assert.equal(await page.getAttribute("#wiz-title", "aria-invalid"), "true");
    assert.match(await page.getAttribute("#wiz-title", "aria-describedby"), /wiz-title-err/);
    await page.click("#wiz-errors a");
    assert.equal(await active(page), "wiz-title");
    await page.fill("#wiz-title", "Chapter 3: Progressive education");
    await go(page, "Your rooms");
    assert.doesNotMatch(await page.title(), /^Error/);
    // a quiz room's errors link to the very box
    await page.goto(base + "/editor.html#step=add"); await heading(page, "What kind of puzzle");
    await page.click("label[for=kind-quiz]"); await go(page, "Write your questions");
    await page.click("#wiz-continue"); await page.locator("#wiz-errors").waitFor();
    assert.deepEqual(await page.$$eval("#wiz-errors a", a => a.map(x => x.textContent)), ["Write question 1", "Question 1 needs a correct answer"]);
    await page.click("#wiz-errors a >> nth=1");
    assert.equal(await active(page), "q1-a0");
    await page.screenshot({ path: path.join(SHOTS, "wizard-errors.png") });
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  await test("a secret-message room in two short pages: the messages with their answers and the code shown, then what students read", async () => {
    const page = await fresh();
    await startWith(page, "sample"); await heading(page, "What is this escape room called?");
    await page.goto(base + "/editor.html#step=add"); await heading(page, "What kind of puzzle");
    assert.match(squash(await page.textContent("label[for=kind-cipher]")), /Secret message \(cipher wheel\).*turn a cipher wheel/);
    await page.click("label[for=kind-cipher]"); await go(page, "Room 6: Write the secret messages");
    assert.match(await page.title(), /^Step 5 of 10: Room 6: Write the secret messages/);
    await page.click("#wiz-continue"); await page.locator("#wiz-errors").waitFor();
    assert.deepEqual(await page.$$eval("#wiz-errors a", a => a.map(x => x.textContent)), ["Write message 1", "Message 1 needs a correct answer"]);
    await page.click("#wiz-errors a >> nth=0"); assert.equal(await active(page), "m1-text");
    await page.fill("#m1-text", "Children learn by doing.");
    const shift = await page.evaluate(() => cfg.rooms[5].shift);
    assert.equal(await page.textContent("#m1-code"), "In code, students see: " + ER.caesar("Children learn by doing.", shift), "the code is shown as the teacher types");
    assert.match(await page.textContent("#wiz-wheel-line"), new RegExp(`The wheel is set to ${shift}`));
    await page.fill("#m1-a0", "John Dewey"); await page.click("#m1-add-a"); assert.equal(await active(page), "m1-a1"); await page.fill("#m1-a1", "Dewey");
    await page.click("#wiz-add-m"); assert.equal(await active(page), "m2-text");
    await page.click("#m2-remove"); await page.locator(".modal #ask-ok").waitFor(); await page.click("#ask-ok");
    assert.equal(await page.evaluate(() => cfg.rooms[5].messages.length), 1);
    await go(page, "Room 6: What do students read when they walk in?");
    await page.fill("#room-title", "The Telegraph Office"); await page.fill("#room-story", "The telegram is in code. Turn the cipher wheel until it reads.");
    await go(page, "Check your facts");
    assert.match(squash(await page.$$eval(".wfacts", e => e.map(x => x.textContent).join(" "))), /Message: Children learn by doing\. ?Answer: John Dewey \/ Dewey/);
    assert.deepEqual(await page.evaluate(() => ER.validate(cfg)), []);
    assert.deepEqual(await page.evaluate(() => cfg.rooms[5].messages.map(m => m.verified)), [false], "nothing in the guided steps marks a fact as checked");
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  await test("the full journey: sample, change a question, check facts, try it, Moodle grade file, then the Canvas password route", async () => {
    const page = await fresh();
    await startWith(page, "sample");
    await heading(page, "What is this escape room called?");
    assert.equal(await page.inputValue("#wiz-title"), "Escape the Old Schoolhouse");
    await page.fill("#wiz-title", "Chapter 3: Philosophies");
    await go(page, "Your rooms");
    assert.equal(await page.locator("#wiz-room-list > li").count(), 5);
    // room 1 (matching): names, then clues with the live lock line, then the story
    await go(page, "Room 1: Who or what is on each card?");
    assert.match(await page.textContent("#wiz-cap"), /Step 5 of 10 · Room 1 of 5/);
    await go(page, "Room 1: Write the clue for each card");
    assert.match(await page.textContent("#wiz-lock-line"), /Students will open the lock with LEARN\./);
    await page.fill("#c1-clue", "Every student masters a shared core of knowledge.");
    assert.match(await page.textContent("#wiz-lock-line"), /LEARN/);
    await page.check("#c1-extra");
    assert.match(await page.textContent("#wiz-lock-line"), /Students will open the lock with [A-Z]{4}\./, "a card marked extra drops out of the lock");
    await page.uncheck("#c1-extra");
    assert.equal(await page.inputValue("#c1-clue"), "Every student masters a shared core of knowledge.", "its clue comes back");
    await go(page, "Room 1: What do students read");
    await go(page, "Room 2: Who or what");
    // timeline, sorting and reflection rooms are set up in Advanced mode
    await page.goto(base + "/editor.html#step=room&room=3"); await heading(page, "Room 3: Put in order");
    assert.equal(await page.getAttribute("#wiz-room-advanced", "href"), "#advanced&room=3");
    // add a quiz room and write a question
    await page.goto(base + "/editor.html#step=add"); await heading(page, "What kind of puzzle");
    await page.click("label[for=kind-quiz]"); await go(page, "Room 6: Write your questions");
    await page.fill("#q1-prompt", "Who wrote Democracy and Education (1916)?");
    await page.fill("#q1-a0", "John Dewey");
    await page.click("#q1-add-a"); assert.equal(await active(page), "q1-a1");
    await page.fill("#q1-a1", "Dewey");
    await page.click("#wiz-add-q"); assert.equal(await active(page), "q2-prompt");
    await page.fill("#q2-prompt", "Which philosophy is built around the Great Books?");
    await page.click("label[for=q2-kind-choice]");
    await page.fill("#q2-c0", "Essentialism"); await page.fill("#q2-c1", "Perennialism");
    await page.check("#q2-ok1");
    assert.equal(await page.evaluate(() => cfg.rooms[5].questions[0].answers), "John Dewey | Dewey");
    await page.screenshot({ path: path.join(SHOTS, "wizard-questions.png"), fullPage: true });
    await go(page, "Room 6: What do students read");
    await page.fill("#room-title", "The Strongbox"); await page.fill("#room-story", "Answer every slip to open the box.");
    await go(page, "Check your facts");
    // check your facts: nothing checked for you; Next not checked; one tick
    assert.match(await page.textContent("#wiz-facts-count"), /0 of 47 checked/);
    assert.match(await page.textContent("#wiz-ai-note"), /written with AI help/);
    await page.click("#wiz-next-unchecked"); assert.equal(await active(page), "f1-cards-1-ok");
    await page.fill("#f6-questions-1-src", "Course text, ch. 3");
    await page.check("#f6-questions-1-ok");
    assert.match(await page.textContent("#wiz-facts-count"), /1 of 47 checked/);
    assert.equal(await page.evaluate(() => cfg.rooms[5].questions[0].verified), true);
    await page.click("#wiz-continue"); await page.locator("#wiz-warn").waitFor();
    assert.equal(await active(page), "wiz-warn", "an inline note, not a dialog");
    assert.match(await page.textContent("#wiz-warn"), /46 items aren't checked yet/);
    await page.click("#wiz-continue-anyway"); await heading(page, "Try it as a student");
    // try it: the same preview as Advanced mode; Esc comes back here
    await page.click("#wiz-try");
    await page.frameLocator(".preview iframe").locator("#begin").waitFor();
    assert.equal(await page.frameLocator(".preview iframe").locator("#doors .door").count(), 6);
    await page.keyboard.press("Escape"); await page.locator(".preview").waitFor({ state: "detached" });
    assert.equal(await active(page), "wiz-try");
    // how students get it: Moodle, grade file
    await go(page, "How will your students get to the escape room?");
    await page.click("#wiz-continue"); await page.locator("#wiz-errors").waitFor();
    assert.match(await page.textContent("#wiz-errors"), /Choose how your students will get to the escape room/);
    await page.click("label[for=where-moodle]");
    await page.click("#wiz-continue"); await page.locator("#wiz-errors").waitFor();
    assert.match(await page.textContent("#wiz-errors"), /Choose how the grade gets to Moodle/);
    await page.click("label[for=how-scorm]");
    await go(page, "Put it in Moodle (grade file)");
    assert.equal((await page.textContent("#wiz-download")).trim(), "Download the Moodle grade file (.zip)");
    assert.match(await page.textContent("ol.walk"), /Add an activity or resource.*SCORM package.*Package file.*Save and display/s);
    assert.match(await page.textContent("ol.walk"), /Menus can differ by version\./);
    assert.ok(await page.locator("details.wtrouble").count() >= 3, "troubleshooting folds");
    // a changed copy of the sample is asked for its own exit password
    let suggested = "";
    const zip = await download(page, "#wiz-download", [async () => { suggested = await page.inputValue("#ask-password"); }, null]);
    assert.equal(suggested, "CHAPTER3", "suggested from the title");
    assert.match(path.basename(zip), /Chapter-3-Philosophies-SCORM\.zip$/);
    assert.match(execFileSync("unzip", ["-l", zip]).toString(), /imsmanifest\.xml/);
    const inner = ER.configFromHtml(execFileSync("unzip", ["-p", zip, "index.html"]).toString());
    assert.equal(inner.finish.exitPassword, "CHAPTER3");
    assert.equal(inner.rooms[5].questions[0].answers, "John Dewey | Dewey");
    assert.equal(inner.__preview, undefined);
    // the Canvas route with the exit-password quiz: no second password question
    await page.click("#wiz-backlink"); await heading(page, "How will your students get");
    await page.click("label[for=where-canvas]"); await page.click("label[for=how-quiz]");
    await go(page, "Put it in Canvas (file and exit-password quiz)");
    assert.equal(await page.textContent("#wiz-password"), "CHAPTER3");
    assert.match(await page.textContent("#wiz-quiz-q"), /Type the exit password/);
    assert.equal(await page.textContent("#wiz-quiz-a"), "CHAPTER3");
    assert.match(await page.textContent("ol.walk"), /Fill in the Blank/);
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => {});
    await page.click("#wiz-password-copy");
    await page.waitForFunction(() => /Copied|Couldn't copy/.test(document.querySelector("#wiz-password-copy").parentElement.querySelector(".done").textContent));
    const html = await download(page, "#wiz-download", [null]);           // only the unchecked-items slip now
    assert.match(path.basename(html), /Chapter-3-Philosophies\.html$/);
    assert.equal(ER.configFromHtml(fs.readFileSync(html, "utf8")).finish.exitPassword, "CHAPTER3");
    await page.screenshot({ path: path.join(SHOTS, "wizard-walkthrough.png"), fullPage: true });
    await go(page, "Your escape room is ready");
    assert.match(await page.textContent("#wiz-summary"), /Chapter 3: Philosophies.*6 rooms.*1 of 47 checked.*Canvas, file and exit-password quiz.*CHAPTER3/s);
    assert.match(await page.textContent("#wiz-done-backup-note"), /also your backup/, "the game file just downloaded is the backup");
    await go(page, "Your escape room");
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  await test("the untouched sample keeps DEWEY1916; an empty escape room is asked for a password, and can go back", async () => {
    let page = await fresh();
    await startWith(page, "sample"); await heading(page, "What is this escape room called?");
    await page.goto(base + "/editor.html#step=deliver"); await heading(page, "How will your students");
    await page.click("label[for=where-file]"); await go(page, "Share it as a file");
    const f = await download(page, "#wiz-download", [null]);              // no password slip, only the draft one
    assert.equal(ER.configFromHtml(fs.readFileSync(f, "utf8")).finish.exitPassword, "DEWEY1916");
    await page.context().close();

    page = await fresh();
    await startWith(page, "empty"); await heading(page, "What is this escape room called?");
    await page.fill("#wiz-title", "Week 2 review"); await go(page, "Your rooms");
    await go(page, "Room 1: Write your questions");
    await page.fill("#q1-prompt", "What is 2 + 2?"); await page.fill("#q1-a0", "4");
    await page.goto(base + "/editor.html#step=deliver"); await heading(page, "How will your students");
    await page.click("label[for=where-other]"); await go(page, "Put it in your course system");
    assert.match(await page.textContent("#wiz-password-later"), /You choose it when you download/);
    await page.click("#wiz-download");
    await page.locator("#ask-password").waitFor();
    assert.equal(await page.getAttribute(".modal", "role"), "dialog");
    assert.equal(await page.textContent("#ask-password-title"), "What should the exit password be?");
    assert.match(await page.textContent("#ask-password-why"), /no exit password yet/);
    assert.equal(await active(page), "ask-password", "the keyboard starts in the box");
    assert.equal(await page.inputValue("#ask-password"), "WEEK2");
    await page.fill("#ask-password", ""); await page.click("#ask-ok");
    assert.equal(await page.isVisible("#ask-password-err"), true);
    assert.equal(await page.getAttribute("#ask-password", "aria-invalid"), "true");
    await page.click("#ask-cancel");
    assert.equal(await page.locator(".modal").count(), 0);
    assert.equal(await page.evaluate(() => cfg.finish.exitPassword), "", "going back changes nothing");
    assert.equal(await active(page), "wiz-download");
    const g = await download(page, "#wiz-download", [async () => { await page.fill("#ask-password", "SQUARE4"); }, null]);
    assert.equal(ER.configFromHtml(fs.readFileSync(g, "utf8")).finish.exitPassword, "SQUARE4");
    assert.equal(await page.textContent("#wiz-password"), "SQUARE4");
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  await test("leaving and coming back: Save and finish later goes to the hub, and a new visit lands there", async () => {
    const page = await fresh();
    await startWith(page, "empty"); await heading(page, "What is this escape room called?");
    await page.fill("#wiz-title", "Unit 5 escape room");
    await page.click("#wiz-later"); await heading(page, "Your escape room");
    assert.match(await page.title(), /^Your escape room – Escape room maker$/);
    assert.equal(await page.textContent("#wiz-hub-title"), "Unit 5 escape room");
    assert.match(await page.textContent("#task-facts"), /1 not checked/);
    assert.match(await page.textContent("#task-deliver"), /Not started/);
    assert.match(await page.textContent("#wiz-save"), /Saved in this browser at .*Not backed up yet\./);
    // a new visit (another tab, same browser) opens on the hub, not the welcome
    const again = await page.context().newPage();
    await again.goto(base + "/editor.html");
    await heading(again, "Your escape room");
    assert.equal(await again.textContent("#wiz-hub-title"), "Unit 5 escape room");
    await again.click("#task-room-1 a"); await heading(again, "Room 1: Write your questions");
    // Advanced mode and back
    await again.click("#wiz-advanced");
    await again.waitForFunction(() => document.documentElement.dataset.mode === "advanced");
    assert.equal(await again.textContent("#page-title"), "New question room");
    assert.equal(await again.evaluate(() => document.activeElement.id), "page-title");
    await again.click("#btn-guided"); await heading(again, "Your escape room");
    await again.goBack(); await again.waitForFunction(() => document.documentElement.dataset.mode === "advanced");
    await page.screenshot({ path: path.join(SHOTS, "wizard-hub.png"), fullPage: true });
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  await test("two escape rooms live side by side; Make a copy; neither overwrites the other", async () => {
    const page = await fresh();
    await startWith(page, "sample"); await heading(page, "What is this escape room called?");
    await page.fill("#wiz-title", "Chapter 3"); await page.click("#wiz-later"); await heading(page, "Your escape room");
    await page.click("#wiz-another"); await heading(page, "How do you want to start?");
    assert.match(await page.textContent("#wiz-start-note"), /You already have “Chapter 3” in this browser\. Starting another one keeps that one too/);
    await page.click("label[for=start-empty]"); await page.click("#wiz-continue"); await heading(page, "What is this escape room called?");
    await page.fill("#wiz-title", "Chapter 4"); await page.click("#wiz-later"); await heading(page, "Your escape room");
    assert.deepEqual((await page.$$eval("#wiz-lib > li b", b => b.map(x => x.textContent))).sort(), ["Chapter 3", "Chapter 4"]);
    assert.match(await page.textContent("#wiz-lib"), /Chapter 4\s*\(open now\)/);
    const first = await page.evaluate(() => lib.list.find(e => e.title === "Chapter 3").id);
    await page.click(`#lib-open-${first}`); await heading(page, "Your escape room");
    assert.equal(await page.textContent("#wiz-hub-title"), "Chapter 3");
    assert.equal(await page.evaluate(() => cfg.rooms.length), 5, "the first one still has the sample's five rooms");
    await page.click("#wiz-copy"); await heading(page, "Your escape room");
    assert.equal(await page.textContent("#wiz-hub-title"), "Chapter 3 (copy)");
    assert.equal(await page.locator("#wiz-lib > li").count(), 3);
    // the same list survives a new visit, and Advanced mode's New adds rather than replaces
    const again = await page.context().newPage();
    await again.goto(base + "/editor.html?mode=advanced");
    await again.click("#btn-new"); await again.click("#new-blank");
    assert.equal(await again.evaluate(() => lib.list.length), 4);
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  await test("the backup is the game file: it reopens in a browser with nothing saved", async () => {
    let page = await fresh();
    await startWith(page, "empty"); await heading(page, "What is this escape room called?");
    await page.fill("#wiz-title", "Backup test"); await page.click("#wiz-later"); await heading(page, "Your escape room");
    const file = await download(page, "#wiz-hub-backup");
    assert.match(path.basename(file), /Backup test \(backup\)\.html$/);
    await heading(page, "Your escape room");
    assert.match(await page.textContent("#task-backup"), /Backed up at/);
    assert.match(await page.textContent("#wiz-save"), /Backup downloaded at/);
    await page.context().close();

    page = await fresh();                                             // another computer: nothing saved here
    await page.click("#wiz-have-one"); await heading(page, "How do you want to start?");
    assert.equal(await page.isChecked("#start-file"), true, "“I've made one before” picks the file choice");
    await page.click("#wiz-continue"); await page.locator("#wiz-errors").waitFor();
    assert.match(await page.textContent("#wiz-errors"), /Choose the file you saved/);
    await page.setInputFiles("#wiz-file", file);
    await page.locator("#wiz-file-name").waitFor();
    assert.match(await page.textContent("#wiz-file-name"), /Backup test/);
    await page.click("#wiz-continue"); await heading(page, "Your escape room");
    assert.equal(await page.textContent("#wiz-hub-title"), "Backup test");
    assert.match(await page.textContent("#wiz-save"), /Backup downloaded at/, "an opened backup counts as backed up");
    // a file that isn't an escape room
    await page.click("#wiz-another"); await heading(page, "How do you want to start?");
    await page.click("label[for=start-file]");
    await page.setInputFiles("#wiz-file", { name: "notes.html", mimeType: "text/html", buffer: Buffer.from("<p>hello</p>") });
    await page.locator("#wiz-file-err").waitFor();
    assert.match(await page.textContent("#wiz-file-err"), /couldn't be opened/);
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  await test("the leave warning: only while there are changes since the last backup", async () => {
    const page = await fresh();
    const warned = async p => { let seen = false; p.on("dialog", d => { if (d.type() === "beforeunload") seen = true; }); await p.close({ runBeforeUnload: true }); await new Promise(r => setTimeout(r, 400)); return seen; };
    assert.equal(await page.evaluate(() => unbacked()), false, "nothing to lose on a first visit");
    await startWith(page, "empty"); await heading(page, "What is this escape room called?");
    await page.fill("#wiz-title", "Leave test");
    const second = await page.context().newPage(); await second.goto(base + "/editor.html"); await heading(second, "Your escape room");
    assert.equal(await page.evaluate(() => unbacked()), true);
    assert.equal(await warned(page), true, "closing with changes that are only in this browser warns");
    await download(second, "#wiz-hub-backup");
    assert.equal(await second.evaluate(() => unbacked()), false);
    await second.click("#wiz-hub-title");                                // a click, so the browser lets the page warn at all
    assert.equal(await warned(second), false, "after a backup, closing does not warn");
    await second.context().close();
  });

  await test("phone width: no sideways scrolling, the step list folds away", async () => {
    const page = await fresh({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.querySelector("#wiz-steps details").open), false);
    await startWith(page, "sample"); await heading(page, "What is this escape room called?");
    for (const step of ["rooms", "facts", "deliver", "hub"]) {
      await page.goto(base + "/editor.html#step=" + step); await page.waitForTimeout(150);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `no sideways scrolling on ${step}`);
    }
    await page.screenshot({ path: path.join(SHOTS, "wizard-phone-hub.png"), fullPage: true });
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  await test("a class link: the recommended first choice, the password slip, Copy link, a QR code, and it plays to the certificate", async () => {
    const page = await fresh();
    await startWith(page, "empty"); await heading(page, "What is this escape room called?");
    await page.fill("#wiz-title", "Week 3 check"); await go(page, "Your rooms");
    await go(page, "Room 1: Write your questions");
    await page.fill("#q1-prompt", "Who wrote Democracy and Education?"); await page.fill("#q1-a0", "Dewey");
    await page.goto(base + "/editor.html#step=deliver"); await heading(page, "How will your students");
    // the link is the first choice, and recommended
    assert.equal(await page.getAttribute(".wradios [role=radio] >> nth=0", "id"), "where-link");
    assert.match(await page.textContent("label[for=where-link]"), /Share a class link \(recommended\).*Works anywhere: paste it into Moodle, Canvas, Google Classroom or an email/s);
    await page.click("#wiz-continue"); await page.locator("#wiz-errors").waitFor();
    assert.equal(await page.evaluate(() => { document.querySelector("#wiz-errors a").click(); return document.activeElement.id; }), "where-link", "the error leads to the first choice");
    await page.click("label[for=where-link]"); await go(page, "Share a class link");
    assert.match(await page.textContent("#wiz-password-later"), /when you make the link in step 1/);
    assert.match(await page.textContent("ol.walk"), /URL.*External URL.*Menus can differ by version.*External URL.*Load in a new tab.*Add Item.*Google Classroom/s);
    assert.match(await page.textContent("#wiz-link-change"), /make a new link here and share that one: the old link keeps opening the old version/);
    assert.match(await page.textContent("#wiz-link-backup"), /also a backup copy.*Open one I saved before.*paste the link/);
    // making it asks for the exit password first, then about unchecked items
    await page.click("#wiz-make-link"); await page.locator("#ask-password").waitFor();
    await page.fill("#ask-password", "WEEK3GO"); await page.click("#ask-ok");
    await page.locator(".modal #ask-ok").waitFor(); assert.match(await page.textContent(".modal"), /Share a draft\?.*Make the link anyway/s); await page.click("#ask-ok");
    await page.locator("#wiz-link").waitFor();
    assert.equal(await active(page), "wiz-link", "the keyboard goes to the link");
    const link = await page.inputValue("#wiz-link");
    assert.ok(link.startsWith(base + "/play.html#play=1."), link.slice(0, 60));
    assert.equal(await page.getAttribute("#wiz-link", "readonly"), "");
    assert.equal(await page.getAttribute("#wiz-link-open", "href"), link);
    assert.equal(await page.getAttribute("#wiz-link-open", "target"), "_blank");
    assert.equal(await page.textContent("#wiz-password"), "WEEK3GO");
    const back = await ER.fromLink(link);
    assert.equal(back.meta.title, "Week 3 check"); assert.equal(back.finish.exitPassword, "WEEK3GO"); assert.equal(back.rooms[0].questions[0].answers, "Dewey");
    // a short link gets a QR code (the same one ER.qrSvg draws, which decodes back to the link in tests/shared.js)
    assert.equal(await page.locator("#wiz-qr svg[role=img]").count(), 1);
    assert.equal(await page.getAttribute("#wiz-qr svg path", "d"), ER.qrSvg(link).match(/ d="([^"]+)"/)[1]);
    assert.equal(await page.getAttribute("#wiz-qr svg", "aria-label"), "QR code of your class link");
    assert.equal(await page.locator("#wiz-long").count(), 0);
    // Copy link
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.click("#wiz-link-copy"); await page.waitForFunction(() => /Copied|Couldn't/.test(document.querySelector(".copy .done").textContent));
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), link);
    // Open it as a student: a new tab plays it to the certificate with the exit password
    const [student] = await Promise.all([page.context().waitForEvent("page"), page.click("#wiz-link-open")]);
    await student.locator("#begin").waitFor();
    assert.equal(await student.title(), "Week 3 check");
    await student.fill("#pname", "Link Student"); await student.click("#begin");
    await student.locator("#stage h2", { hasText: "Room 1" }).waitFor();
    await student.fill("input[name=q0]", "dewey"); await student.click("#try"); await student.click("#onward");
    await student.locator("#exit-password").waitFor();
    assert.equal(await student.textContent("#exit-password"), "WEEK3GO");
    await student.close();
    // changing the escape room makes the link out of date: the step says so and offers a new one
    await page.goto(base + "/editor.html#step=room&room=1&part=questions"); await heading(page, "Room 1");
    await page.fill("#q1-a0", "John Dewey");
    await page.goto(base + "/editor.html#step=walk"); await heading(page, "Share a class link");
    assert.match(await page.textContent("#wiz-link-stale"), /You changed the escape room after making your link. The old link still opens the old version/);
    assert.equal((await page.textContent("#wiz-make-link")).trim(), "Make a new class link");
    await page.click("#wiz-make-link"); await page.locator(".modal #ask-ok").waitFor(); await page.click("#ask-ok"); await page.locator("#wiz-link").waitFor();
    assert.notEqual(await page.inputValue("#wiz-link"), link);
    assert.equal((await ER.fromLink(await page.inputValue("#wiz-link"))).rooms[0].questions[0].answers, "John Dewey");
    await page.goto(base + "/editor.html#step=done"); await heading(page, "Your escape room is ready");
    assert.match(await page.textContent("#wiz-summary"), /A class link/);
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  await test("the exit password changes from the Done page: the field is focused, then the next page says what to do; summary, card, walkthrough and an old link follow", async () => {
    const page = await fresh();
    await startWith(page, "empty"); await heading(page, "What is this escape room called?");
    await page.fill("#wiz-title", "Week 5 check"); await go(page, "Your rooms");
    await go(page, "Room 1: Write your questions");
    await page.fill("#q1-prompt", "Who wrote Emile?"); await page.fill("#q1-a0", "Rousseau");
    await page.evaluate(() => { meta.delivery = { where: "link" }; saveMeta(); });
    await page.goto(base + "/editor.html#step=walk"); await heading(page, "Share a class link");
    await page.click("#wiz-make-link"); await page.fill("#ask-password", "WEEKFIVE"); await page.click("#ask-ok");
    await page.locator(".modal #ask-ok").waitFor(); await page.click("#ask-ok"); await page.locator("#wiz-link").waitFor();
    const oldLink = await page.inputValue("#wiz-link");
    const verifiedBefore = await page.evaluate(() => ER.reviewStatus(cfg).verified);
    // the Done page's Change link leads straight to the field, with the keyboard on it
    await page.goto(base + "/editor.html#step=done"); await heading(page, "Your escape room is ready");
    const change = page.locator("#wiz-summary div:has(dt:text-is('Exit password')) a");
    assert.equal(squash(await change.textContent()), "Change the exit password");
    await change.focus(); await page.keyboard.press("Enter");
    await heading(page, "What should the exit password be?");
    assert.equal(await active(page), "wiz-pw", "focus is on the field");
    assert.equal(await page.inputValue("#wiz-pw"), "WEEKFIVE");
    assert.equal(await page.evaluate(() => document.querySelector("#wiz-h1 label").htmlFor), "wiz-pw", "the question is the field's label");
    assert.match(await page.title(), /^Step 9 of 10: What should the exit password be\? – Escape room maker$/);
    assert.match(await page.textContent("#wiz-pw-hint"), /Now it is WEEKFIVE\./);
    // empty: a linked error, nothing saved
    await page.fill("#wiz-pw", "  "); await page.click("#wiz-continue"); await page.locator("#wiz-errors").waitFor();
    assert.match(await page.textContent("#wiz-errors"), /Enter an exit password/);
    assert.equal(await page.getAttribute("#wiz-pw", "aria-invalid"), "true");
    assert.equal(await page.evaluate(() => cfg.finish.exitPassword), "WEEKFIVE", "nothing changes until it is saved");
    await page.fill("#wiz-pw", "WEEKSIX"); await page.keyboard.press("Enter");
    await heading(page, "Your new exit password is saved");
    assert.equal(await page.evaluate(() => cfg.finish.exitPassword), "WEEKSIX");
    assert.equal(await page.textContent("#wiz-pw-new"), "WEEKSIX");
    assert.match(squash(await page.textContent("#wiz-pw-finished")), /Students who already finished saw the old password, WEEKFIVE, on their certificate/);
    assert.match(squash(await page.textContent("#wiz-pw-quiz")), /change the correct answer to WEEKSIX/);
    assert.match(squash(await page.textContent("#wiz-pw-keep")), /Keep WEEKFIVE as a second correct answer/);
    assert.match(squash(await page.textContent("#wiz-pw-link")), /Your class link still has the old password.*Make a new class link and share it instead of the old one/);
    assert.equal(await page.evaluate(() => ER.reviewStatus(cfg).verified), verifiedBefore, "nothing is marked as checked");
    await page.click("#wiz-continue"); await heading(page, "Your escape room is ready");
    assert.match(await page.textContent("#wiz-summary"), /Exit password\s*WEEKSIX/);
    // the teacher card has the new one, and the old one to keep in the quiz
    await page.click("#wiz-card");
    const card = page.frameLocator(".overlay iframe"); await card.locator("h1").waitFor();
    const text = squash(await card.locator("body").innerText());
    assert.match(text, /Exit password WEEKSIX Changed on .*Before that it was WEEKFIVE: keep it as a second correct answer/);
    assert.match(text, /you have changed the escape room since: make a new link/);
    assert.match(text, /choose “Change the exit password”/);
    await page.keyboard.press("Escape"); await page.locator(".overlay").waitFor({ state: "detached" });
    // the walkthrough: the new password to copy, and the old link flagged
    await page.goto(base + "/editor.html#step=walk"); await heading(page, "Share a class link");
    assert.match(squash(await page.textContent("#wiz-link-stale")), /old link still opens the old version, with the old exit password\. Make a new link/);
    assert.equal(await page.textContent("#wiz-password"), "WEEKSIX");
    assert.equal(await page.textContent("#wiz-quiz-a"), "WEEKSIX");
    assert.equal(await page.getAttribute("#wiz-password-change", "href"), "#step=password&from=walk");
    await page.click("#wiz-make-link"); await page.locator(".modal #ask-ok").waitFor(); await page.click("#ask-ok"); await page.locator("#wiz-link").waitFor();
    assert.notEqual(await page.inputValue("#wiz-link"), oldLink);
    assert.equal((await ER.fromLink(await page.inputValue("#wiz-link"))).finish.exitPassword, "WEEKSIX");
    assert.equal((await ER.fromLink(oldLink)).finish.exitPassword, "WEEKFIVE");
    // the hub offers it too; saving the same password again just goes back
    await page.goto(base + "/editor.html#step=hub"); await heading(page, "Your escape room");
    assert.match(squash(await page.textContent("#task-password")), /Change the exit password\s*WEEKSIX/);
    await page.click("#task-password a"); await heading(page, "What should the exit password be?");
    await page.click("#wiz-continue"); await heading(page, "Your escape room");
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  await test("a long link (the sample) has no QR code and says so; a very long one warns about being cut off", async () => {
    const page = await fresh();
    await startWith(page, "sample"); await heading(page, "What is this escape room called?");
    await page.evaluate(() => { meta.delivery = { where: "link" }; saveMeta(); });
    await page.goto(base + "/editor.html#step=walk"); await heading(page, "Share a class link");
    await page.click("#wiz-make-link"); await page.locator(".modal #ask-ok").waitFor(); await page.click("#ask-ok"); await page.locator("#wiz-link").waitFor();
    const link = await page.inputValue("#wiz-link");
    assert.ok(link.length > 6500 && link.length < 8500, "about 7.3 KB: " + link.length);
    assert.match(await page.textContent("#wiz-qr-none"), /too long for a QR code/);
    assert.equal(await page.locator("#wiz-long").count(), 0);
    // a huge story makes a link over 30 KB: a plain warning, and the file route suggested
    await page.evaluate(() => { let t = ""; for (let i = 0; t.length < 60000; i++) t += Math.random().toString(36).slice(2) + " "; cfg.rooms[0].story = t; changed(); });
    await page.goto(base + "/editor.html#step=walk&x=1"); await heading(page, "Share a class link");
    await page.click("#wiz-make-link");
    while (!(await page.isVisible("#wiz-link"))) { await page.locator(".modal #ask-ok, #wiz-link").first().waitFor(); if (await page.isVisible(".modal #ask-ok")) await page.click(".modal #ask-ok"); }
    assert.match(await page.textContent("#wiz-long"), /very long \(\d+ KB\).*cut long links off.*share the escape room as a file instead/s);
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  await test("a class link is also a backup: pasting it into “Open one I saved before” brings the escape room back", async () => {
    const small = { schema: 1, meta: { title: "From a link" }, finish: { exitPassword: "LINKED1" }, rooms: [{ type: "quiz", title: "Q", questions: [{ kind: "short", prompt: "2 + 2?", answers: "4", verified: false }] }] };
    const link = await ER.toLink(small, base + "/play.html");
    const page = await fresh();
    await page.goto(base + "/editor.html#step=start&open=1"); await heading(page, "How do you want to start?");
    assert.equal(await page.isChecked("#start-file"), true, "the front page's “Open one I saved before” arrives with that choice made");
    // a cut-off link gets a linked error on the box
    await page.fill("#wiz-link-paste", link.slice(0, 120)); await page.click("#wiz-continue"); await page.locator("#wiz-errors").waitFor();
    assert.match(await page.textContent("#wiz-errors"), /This class link is incomplete: part of it is missing/);
    assert.equal(await page.getAttribute("#wiz-link-paste", "aria-invalid"), "true");
    await page.fill("#wiz-link-paste", "Here it is: " + link + " ");
    await page.click("#wiz-continue"); await heading(page, "Your escape room");
    assert.equal(await page.textContent("#wiz-hub-title"), "From a link");
    assert.deepEqual(await page.evaluate(() => cfg), small);
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  await test("the guided steps ask for nothing from the internet", async () => {
    const page = await fresh();
    const outside = [];
    page.on("request", r => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) outside.push(u); });
    await page.reload(); await startWith(page, "sample"); await heading(page, "What is this escape room called?");
    for (const step of ["rooms", "facts", "try", "deliver", "walk", "done", "hub"]) { await page.goto(base + "/editor.html#step=" + step); await page.waitForTimeout(80); }
    assert.deepEqual(outside, []);
    await page.context().close();
  });

  await browser.close();
  server.close();
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`\n${passed} passed, ${failed} failed.`);
  process.exit(failed ? 1 : 0);
})();
