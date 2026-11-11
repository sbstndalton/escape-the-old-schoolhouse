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
const OBSERVATIONS = "TPTPTPTP";
const WAIT = 1500; // rooms advance ~1.3s after a correct answer

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log(`  ✔ ${name}`); }
  catch (e) { failed++; console.log(`  ✘ ${name}\n      ${e.message.split("\n").join("\n      ")}`); }
}

async function newPage(browser, base, { scorm = false, viewport = { width: 1000, height: 900 } } = {}) {
  const page = await browser.newPage({ viewport });
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
      const t = await page.$$eval("#tl li span:nth-child(2)", els => els.map(e => e.textContent));
      if (rank(t[i]) > rank(t[i + 1])) await page.locator("#tl li").nth(i).getByRole("button", { name: "Move down" }).click();
    }
  }
}

async function playThrough(page, shotPrefix) {
  const shot = n => shotPrefix && page.screenshot({ path: path.join(SHOTS, `${shotPrefix}-${n}.png`), fullPage: true });
  await shot("0-intro");
  await page.fill("#pname", (await page.inputValue("#pname")) || "Test Student");
  await page.click("#begin");
  await shot("1-library");
  await page.fill("#a1", "learn"); await page.click("#t1"); await page.waitForTimeout(WAIT);
  await shot("2-gallery");
  await page.fill("#a2", "9154"); await page.click("#t2"); await page.waitForTimeout(WAIT);
  await shot("3-timeline");
  await solveTimeline(page); await page.click("#t3");
  assert.match(await page.textContent("#m3"), /lock drops open/);
  await page.waitForTimeout(WAIT);
  await shot("4-observation");
  for (let i = 0; i < 8; i++) await page.click(`.seg button[data-i="${i}"][data-v="${OBSERVATIONS[i]}"]`);
  await page.click("#t4"); await page.waitForTimeout(WAIT);
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
    await page.fill("#a1", "wrong"); await page.click("#t1");
    assert.match(await page.textContent("#m1"), /won't budge/);
    await page.fill("#a1", "learn"); await page.click("#t1"); await page.waitForTimeout(WAIT);
    await page.fill("#a2", "1234"); await page.click("#t2");
    assert.match(await page.textContent("#m2"), /ERROR/);
    await page.close();
  });

  await test("hints are counted and run out", async () => {
    const page = await newPage(browser, base);
    await page.click("#begin");
    for (let i = 0; i < 3; i++) await page.click("#hb-r1");
    assert.equal(await page.textContent("#hintCount"), "3");
    assert.equal(await page.isDisabled("#hb-r1"), true);
    assert.equal(await page.locator("#h-r1 .hint").count(), 3);
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

  await browser.close();
  server.close();
  console.log(`\n${passed} passed, ${failed} failed. Screenshots: tests/screenshots/`);
  process.exit(failed ? 1 : 0);
})();
