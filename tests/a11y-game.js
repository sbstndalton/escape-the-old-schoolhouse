// Accessibility tests for the student game. Run with `npm test` (or `node tests/a11y-game.js`).
//
// What is checked, on every screen and state of the sample game (plus a quiz room and the plain-cards look):
//   - axe-core (WCAG 2.0/2.1/2.2 A and AA rules, and best practices): zero violations, at 1440x900 and 390x844,
//     in the normal look, High contrast, Readable text, forced colours and prefers-contrast: more;
//   - a full play-through with the keyboard alone;
//   - focus: every focusable element shows a focus ring and is not covered by anything when focused;
//   - target size: at least 24 CSS px everywhere, 44 px for the game's own controls;
//   - 200% text, 320 px reflow, 200% and 400% zoom-sized windows, and the WCAG text-spacing override: no clipped
//     text and no sideways scrolling;
//   - forced colours and High contrast: controls and states are still drawn;
//   - announcements (the polite live region), names, roles, states, headings and page titles;
//   - contrast of the main text styles, measured from screenshots against the real textured, lamplit background.
//
// Options:  --report <file.json>   don't fail; write counts and the contrast table (used for ACCESSIBILITY.md)
//           --url <url>            test another build of the game (for a before/after comparison)
//           --snapshots <dir>      write the accessibility tree of every state as text
//           --only <name>          run only tests whose name contains this
const { chromium, webkit } = require("playwright");
const assert = require("assert/strict");
const fs = require("fs");
const path = require("path");
const { start } = require("../scripts/serve.js");
const speechMock = require("./speech-mock.js");

const arg = k => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : null; };
const REPORT = arg("report"), URL_ = arg("url"), SNAP = arg("snapshots"), ONLY = arg("only");
const AXE = require.resolve("axe-core/axe.min.js");
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];
const DESKTOP = { width: 1440, height: 900 }, PHONE = { width: 390, height: 844 };

const QUIZ = { type: "quiz", title: "The Strongbox", story: "Two questions guard the strongbox.", lockLabel: "Strongbox", hintsEnabled: false, questions: [
  { kind: "short", prompt: "Who wrote *Democracy and Education*?", answers: "Dewey|John Dewey" },
  { kind: "choice", prompt: "Which philosophy stresses a common core of knowledge?", choices: ["Essentialism", "Existentialism", "Progressivism"], correct: 0 }] };
const TIMELINE = ["Plato", "Rousseau", "Horace", "Montessori", "Dewey", "Freire", "Adler"];
const SORT = [0, 1, 0, 1, 0, 1, 0, 1];

let passed = 0, failed = 0; const report = { counts: {}, contrast: {} };
// Tests are queued and run a few at a time (each has its own browser context); results print in order.
// { solo: true } tests are timing-sensitive (real key presses, animation on) and run one by one afterwards.
const queue = [];
function test(name, fn, { solo = false } = {}) { if (!ONLY || name.includes(ONLY)) queue.push({ name, fn, solo }); }
async function runAll(width = 3) {
  const lines = new Array(queue.length); let printed = 0;
  const run = async i => { const t = queue[i];
    try { await t.fn(); passed++; lines[i] = `  ✔ ${t.name}`; }
    catch (e) { failed++; lines[i] = `  ✘ ${t.name}\n      ${String(e.message).split("\n").slice(0, 40).join("\n      ")}`; }
    while (printed < queue.length && lines[printed]) console.log(lines[printed++]); };
  const pool = queue.map((t, i) => i).filter(i => !queue[i].solo); let next = 0;
  await Promise.all(Array.from({ length: width }, async () => { while (next < pool.length) await run(pool[next++]); }));
  for (let i = 0; i < queue.length; i++) if (queue[i].solo) await run(i);
}
// In report mode a list of problems is counted instead of failing the run.
function expectNone(key, list) {
  report.counts[key] = (report.counts[key] || 0) + list.length;
  if (!REPORT) assert.equal(list.length, 0, `${list.length} problem(s):\n` + list.slice(0, 25).join("\n"));
}

let base = "", browser = null;
async function open({ path = "/play.html", viewport = DESKTOP, hc = false, readable = false, forced = false, contrast = null, scale = 1, motion = "reduce", engine = null } = {}) {
  const ctx = await (engine || browser).newContext({ viewport, reducedMotion: motion, forcedColors: forced ? "active" : "none", deviceScaleFactor: scale, ...(contrast ? { contrast } : {}) });
  const page = await ctx.newPage();
  page.errors = [];
  page.on("pageerror", e => page.errors.push(e.message));
  page.on("console", m => { if (m.type() === "error") page.errors.push(m.text()); });
  // Speech is mocked with local voices, so every Listen button is drawn and checked; a sentence "takes" a minute,
  // so a state that is reading stays reading.
  await page.addInitScript(speechMock, { ms: 60000 });
  await page.addInitScript(require("./skip-ask.js"));          // the first-visit prompt is opened from its control in tour() and frontTour()
  await page.addInitScript(([hc, readable]) => { try { if (hc) localStorage.setItem("escape-room-contrast", "on"); if (readable) localStorage.setItem("escape-room-readable", "on"); } catch (e) {} }, [hc, readable]);
  await page.goto(URL_ || base + path);
  page.old = await page.evaluate(() => !document.querySelector("#view"));      // an older build, for the before/after report
  return page;
}
const done = async page => { const errs = page.errors; await page.context().close(); if (!REPORT) assert.deepEqual(errs, [], "the page had JavaScript errors"); };
const room = async (page, n) => { await page.evaluate(n => go(n), n); await page.waitForTimeout(60); };

/* Walks through every screen and state, calling visit(name) at each one. */
async function tour(page, visit) {
  const esc = async () => { await page.keyboard.press("Escape"); };
  await visit("title");
  await page.locator(".rules").click(); await visit("title, house rules open"); await esc();
  if (!page.old) { await page.click("#a11y-options"); await page.locator("#a11y-ask").waitFor(); await visit("title, accessibility options open"); await esc(); }
  await page.evaluate(() => { S.player = "Test Student"; startTimer();
    ROOMS[0].hintsEnabled = true; ROOMS[0].hints = ["Start with the clue you are surest about.", "Each clue names one book."]; });
  await room(page, 1); await visit("room 1, books");
  await page.locator(".icard").first().click(); await visit("room 1, a clue held up"); await esc();
  if (!page.old) { await page.click("#describe"); await visit("room 1, description open"); await esc(); }
  await page.click("#watch"); await visit("notebook open"); await esc();
  await page.fill("#answer", "xxxxx"); await page.click("#try"); await page.click("#hint-btn"); await visit("room 1, wrong try and a hint");
  if (!page.old) { await page.locator(".icard .listen").nth(1).click(); await visit("room 1, reading a clue aloud");
    await page.click("#describe"); await page.click("#examine .listen"); await visit("room 1, reading the description aloud"); await esc(); }
  await page.fill("#answer", "learn"); await page.click("#try"); await visit("room 1, solved");
  await page.evaluate(() => { ROOMS[0].look = "cards"; }); await room(page, 1); await visit("room 1, plain cards");
  await page.evaluate(() => { ROOMS[0].look = "books"; });
  await room(page, 2); await visit("room 2, portraits");
  await page.evaluate(q => { window.__keep = ROOMS[2]; ROOMS[2] = q; }, QUIZ); await room(page, 3); await visit("quiz room");
  if (!page.old) { await page.locator(".slip .listen").nth(1).click(); await visit("quiz room, reading a question aloud"); await page.locator(".slip .listen").nth(1).click(); }
  await page.fill("input[name=q0]", "nobody"); await page.check("input[name=q1][value='1']"); await page.click("#try"); await visit("quiz room, wrong try");
  await page.evaluate(() => { ROOMS[2] = window.__keep; }); await room(page, 3); await visit("room 3, timeline");
  await solveTimeline(page); await page.click("#try"); await visit("room 3, solved");
  await room(page, 4); await visit("room 4, slips and stamps");
  await page.locator(".ev .pick").nth(1).click(); await page.click(".stamp[data-v='0']"); await page.click(".seg button[data-i='0'][data-v='1']"); await visit("room 4, some slips stamped");
  await room(page, 5); await visit("room 5, mirror");
  await page.locator("input[name=q0]").nth(1).check(); if (!page.old) await page.click("#try"); await visit("room 5, second question");
  await page.evaluate(() => { const r = ROOMS[4]; S.reflection = { room: r, first: r.profiles[0], second: r.profiles[1] }; }); await room(page, 6); await visit("certificate");
  await page.locator(".result").click(); await visit("certificate, result held up"); await esc();
}
async function solveTimeline(page) {
  const rank = s => TIMELINE.findIndex(k => s.includes(k));
  for (let pass = 0; pass < 8; pass++) for (let i = 0; i < 6; i++) {
    const t = await page.$$eval("#order li .t", els => els.map(e => e.textContent));
    if (rank(t[i]) > rank(t[i + 1])) await page.locator("#order li").nth(i).getByRole("button", { name: "Move down" }).click();
  }
}

/* ---------------- checks that run inside the page; each returns a list of problems ---------------- */
// The layer the player can reach: an open sheet or notebook, otherwise the scene.
const LAYER = `(() => { const ex = document.querySelector("#examine"), pa = document.querySelector("#pause"), aq = document.querySelector("#a11y-ask");
  return aq ? aq : ex && !ex.hidden ? ex : pa && !pa.hidden ? pa : document.querySelector("#scene") || document.body; })()`;
const HELPERS = `
  const layer = ${LAYER};
  const shown = el => { if (!el.getClientRects().length) return false; const cs = getComputedStyle(el); return cs.visibility !== "hidden" && +cs.opacity > 0.01 || el.matches("input[type=radio]"); };
  const name = el => (el.id ? "#" + el.id : el.tagName.toLowerCase() + (el.classList.length ? "." + [...el.classList].join(".") : "")) + " “" + (el.getAttribute("aria-label") || el.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 40) + "”";
`;
function checkFocus() {
  // HELPERS
  const out = [];
  const els = [...layer.querySelectorAll("a[href],button,input,select,textarea,[tabindex]")].filter(el => el.tabIndex >= 0 && !el.disabled && shown(el) && !el.closest("[inert]"));
  const view = document.querySelector("#view") || document.querySelector("#stage");
  for (const el of els) {
    el.focus();
    if (document.activeElement !== el) { out.push("can't take focus: " + name(el)); continue; }
    const r = el.getClientRects()[0] || el.getBoundingClientRect(), x = r.left + r.width / 2;   // a link that wraps: the middle of its first line
    const y = r.height > innerHeight ? Math.max(r.top, 0) + 12 : r.top + r.height / 2;            // a box taller than the window: its visible top
    if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) { out.push("focused but off screen: " + name(el)); continue; }
    const top = document.elementFromPoint(x, y);
    if (!(top && (el === top || el.contains(top)))) out.push("covered when focused: " + name(el) + " by " + (top ? name(top) : "nothing"));
    const ring = n => { const cs = getComputedStyle(n); return cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 2; };
    // the ring may be drawn on the control's label or on the paper it sits on (a paper's heading button rings the whole paper)
    if (!(ring(el) || ring(el.parentElement) || (el.closest("label") && ring(el.closest("label"))))) out.push("no focus ring: " + name(el));
  }
  if (view) view.scrollTop = 0;
  return out;
}
function checkTargets() {
  // HELPERS
  const BIG = ".a11yq button,.listen,.nub,.stamp,.lever input,.stud,#watch,#sound-toggle,.x,.qnav .n,.seg button,#try,#hint-btn,.desc,.pushplate,#begin,.page li button,.grip,.story,.icard,.hint,.rules,.result,.grab";
  const PAPER = ".story .go,.icard .no,.hint .hb,.rules .rb,.result .h,.ev .pick";      // heading buttons stretched over their whole paper: the paper is the target
  const out = [];
  for (const el of layer.querySelectorAll("a[href],button,input,select,textarea,[role=spinbutton],.nub,.grip,.klabel")) {
    if (!shown(el) || el.closest("[inert]") || el.classList.contains("skip")) continue;
    if (el.matches("a") && getComputedStyle(el).display === "inline" && el.parentElement.closest("p,li,td")) continue;   // a link inside a sentence (exempt in 2.5.8)
    const box = el.matches(PAPER) ? el.parentElement : el, r = box.getBoundingClientRect(), min = box.matches(BIG) ? 43.5 : 24;
    if (el.matches(PAPER) && getComputedStyle(el, "::after").position !== "absolute") out.push("a paper's heading button isn't stretched over the paper: " + name(el));
    if (r.width < min - .01 || r.height < min - .01) out.push(`${Math.round(r.width)}x${Math.round(r.height)} (needs ${Math.ceil(min)}): ` + name(el));
  }
  return out;
}
function checkClip() {
  // HELPERS
  const out = [], seen = new Set();
  const add = s => { if (!seen.has(s)) { seen.add(s); out.push(s); } };
  const doc = document.documentElement, view = document.querySelector("#view");
  if (doc.scrollWidth > innerWidth + 1) add(`the page scrolls sideways by ${doc.scrollWidth - innerWidth}px`);
  if (view && view.scrollWidth > view.clientWidth + 1) add(`the room scrolls sideways by ${view.scrollWidth - view.clientWidth}px`);
  const walker = document.createTreeWalker(layer, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.nodeValue.trim()) continue;
    const el = n.parentElement; if (!shown(el) || el.closest(".sr,.strip,.skip,.old,script,style") || el.closest("[hidden]")) continue;
    const range = document.createRange(); range.selectNodeContents(n);
    const r = range.getBoundingClientRect(); if (!r.width || !r.height) continue;
    const inTable = !!el.closest(".tbl");     // a wide table in the accessibility statement scrolls inside its own labelled box (tables are exempt from reflow)
    if (!inTable && (r.left < -1 || r.right > innerWidth + 1)) add(`text runs off the side of the window: ` + name(el));
    let scrollsY = false;                                                    // inside something that scrolls up and down, text below the fold is reachable, not cut off
    for (let a = el; a && a !== document.body; a = a.parentElement) {
      const cs = getComputedStyle(a); if (cs.display === "inline") continue;
      const hid = v => v === "hidden" || v === "clip", scr = v => v === "auto" || v === "scroll";
      if (cs.webkitLineClamp && cs.webkitLineClamp !== "none") { add("text is cut short with line-clamp: " + name(el)); break; }   // stories, clues and results are never shortened
      const q = a.getBoundingClientRect();
      if (hid(cs.overflowX) && (r.right > q.right + 1.5 || r.left < q.left - 1.5)) add("text is cut off at the side: " + name(el) + " inside " + name(a));
      if (hid(cs.overflowY) && !scrollsY && (r.bottom > q.bottom + 1.5 || r.top < q.top - 1.5)) add("text is cut off: " + name(el) + " inside " + name(a));
      if (scr(cs.overflowX) && a.scrollWidth > a.clientWidth + 1 && !a.matches(".tbl")) add("scrolls sideways: " + name(a));
      if (scr(cs.overflowY)) scrollsY = true;
    }
  }
  // each dial shows its whole current character
  for (const d of layer.querySelectorAll(".dial")) { const w = d.querySelector(".dwin").getBoundingClientRect(), c = d.querySelectorAll(".strip i")[1].getBoundingClientRect();
    if (c.top < w.top - 1.5 || c.bottom > w.bottom + 1.5 || c.left < w.left - 1.5 || c.right > w.right + 1.5) add("a dial's character is cut off"); }
  return out;
}
function checkDrawn() {
  // HELPERS
  // In forced colours and High contrast, drawn surfaces go away: every control must still have a real edge.
  const out = [];
  const edge = el => { const cs = getComputedStyle(el); return ["Top", "Right", "Bottom", "Left"].some(s => cs["border" + s + "Style"] !== "none" && parseFloat(cs["border" + s + "Width"]) >= 1) || (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 1) || /inset/.test(cs.boxShadow); };
  for (const el of layer.querySelectorAll("button:not(.nub):not(.shackle):not(.key):not(#watch):not(.portrait button):not(.stamp):not(.go):not(.no):not(.hb):not(.rb):not(.h):not(.pick),input[type=text],.dial,.dwin,.lev,.paper,.story,.hint,.sheet,.page,.lbody,.esc,.seg button,.stamp .base")) {
    if (!shown(el) || el.closest("[inert]")) continue;
    if (!edge(el)) out.push("no visible edge: " + name(el));
  }
  for (const b of layer.querySelectorAll(".seg button")) { const on = b.classList.contains("on"), cs = getComputedStyle(b);
    if (on && !(cs.borderTopStyle === "solid" && parseFloat(cs.borderTopWidth) >= 2.5)) out.push("a stamped box doesn't look stamped: " + name(b));
    if (!on && cs.borderTopStyle !== "dashed") out.push("an empty box looks stamped: " + name(b)); }
  for (const i of layer.querySelectorAll(".dial .strip i:nth-child(2)")) { const cs = getComputedStyle(i), bg = getComputedStyle(i.closest(".dwin")).backgroundColor;
    if (cs.color === bg) out.push("a dial's character has the colour of its window"); }
  return out;
}
// The same focus checks, but walking the Tab order with real key presses (WebKit only shows a focus ring that way).
async function tabWalk(page, key = "Tab", max = 90) {
  const out = []; let first = null, stops = 0;
  for (let i = 0; i < max; i++) {
    await page.keyboard.press(key);
    const r = await page.evaluate(() => {
      const el = document.activeElement; if (!el || el === document.body) return null;
      const name = (el.id ? "#" + el.id : el.tagName.toLowerCase() + "." + el.className) + " “" + (el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40) + "”";
      const q = el.getBoundingClientRect(), x = q.left + q.width / 2, y = q.top + q.height / 2, bad = [];
      if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) bad.push("focused but off screen: " + name);
      else { const top = document.elementFromPoint(x, y); if (!(top && (el === top || el.contains(top)))) bad.push("covered when focused: " + name); }
      const ring = n => { const cs = getComputedStyle(n); return cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 2; };
      if (!(ring(el) || ring(el.parentElement) || (el.closest("label") && ring(el.closest("label"))))) bad.push("no focus ring: " + name);
      return { name, bad };
    });
    if (!r) continue;
    if (first === null) first = r.name; else if (r.name === first) break;
    stops++; out.push(...r.bad);
  }
  return { stops, out };
}
const inPage = (page, fn) => page.evaluate(`(${fn.toString().replace("// HELPERS", HELPERS)})()`);
async function axe(page) {
  await page.addScriptTag({ path: AXE });
  const r = await page.evaluate(tags => axe.run(document, { runOnly: tags }), AXE_TAGS);
  return r.violations.map(v => `${v.id} (${v.impact}): ${v.help}\n        ${v.nodes.slice(0, 3).map(n => n.target.join(" ")).join("\n        ")}`);
}

/* ---------------- contrast measured from screenshots ---------------- */
// The text is photographed, then photographed again with only its glyphs made invisible. The pixels that
// changed most are the solid cores of the letters; each is compared with what is behind it at that spot,
// so textures, gradients, lamplight, the vignette and film grain are all in the measurement.
const HIDE = ".__hide,.__hide *{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;caret-color:transparent!important}";
async function contrastOf(page, helper, selector) {
  const worst = { ratio: Infinity, n: 0 };
  const count = await page.locator(selector).count();
  for (const i of [...new Set([0, Math.floor(count / 2), count - 1])].filter(i => i >= 0)) {     // the first, middle and last of each kind
    const el = page.locator(selector).nth(i);
    if (!(await el.isVisible())) continue;
    await el.scrollIntoViewIfNeeded();
    const b = await el.boundingBox(); if (!b || b.width < 2 || b.height < 2) continue;
    const vp = page.viewportSize(), clip = { x: Math.max(0, b.x), y: Math.max(0, b.y), width: Math.min(b.width, vp.width - Math.max(0, b.x)), height: Math.min(b.height, vp.height - Math.max(0, b.y)) };
    if (clip.width < 2 || clip.height < 2) continue;
    const A = await page.screenshot({ clip });
    await el.evaluate(e => e.classList.add("__hide")); const B = await page.screenshot({ clip }); await el.evaluate(e => e.classList.remove("__hide"));
    const r = await helper.evaluate(async ([a, b]) => {
      const load = async d => { const bm = await createImageBitmap(await (await fetch("data:image/png;base64," + d)).blob()); const c = new OffscreenCanvas(bm.width, bm.height), g = c.getContext("2d"); g.drawImage(bm, 0, 0); return g.getImageData(0, 0, bm.width, bm.height).data; };
      const [pa, pb] = [await load(a), await load(b)];
      const lin = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); };
      const lum = (p, i) => .2126 * lin(p[i]) + .7152 * lin(p[i + 1]) + .0722 * lin(p[i + 2]);
      const list = [];
      for (let i = 0; i < pa.length; i += 4) { const x = lum(pa, i), y = lum(pb, i), cr = (Math.max(x, y) + .05) / (Math.min(x, y) + .05); if (cr > 1.15) list.push(cr); }
      list.sort((p, q) => q - p);
      const core = list.slice(0, Math.max(1, Math.floor(list.length / 3)));       // the third that changed most: the letter cores
      return { n: list.length, ratio: core.length ? core[Math.floor(core.length / 2)] : 0 };
    }, [A.toString("base64"), B.toString("base64")]);
    if (r.n >= 12 && r.ratio < worst.ratio) { worst.ratio = r.ratio; worst.n = r.n; }
  }
  return worst.ratio === Infinity ? null : Math.round(worst.ratio * 10) / 10;
}
// [what it is, selector, kind]   kind: "read" = reading text (aim 7:1), "label" = short label (4.5:1), "big" = large text (3:1)
const TEXTS = {
  "title": [["Game title on the brass placard", ".placard span", "big"], ["Course name on the placard", ".placard small", "label"], ["Opening heading on the wall", "h2.said", "big"],
    ["Story note (teaser)", ".story .clip", "read"], ["“pick up to read”", ".story .go", "label"], ["Ledger label", ".ledger label", "label"], ["House rules", ".rules > span:not(.pin)", "read"],
    ["Begin plate", "#begin", "big"], ["Draft note", "#draft", "read"], ["Notebook caption under the watch", ".wl", "label"], ["Clock", "#timer", "label"], ["Key ring: a locked key's number", ".door b", "label"]],
  "room 1, books": [["Room title plate", "h2.bplate", "big"], ["“Describe this room” plate", ".desc span", "label"], ["Book titles on the spines", ".vol .title", "read"], ["Code letters on the books", ".vol .letter b", "big"],
    ["Section label on the wall (Clues)", ".cap", "label"], ["Clue number", ".icard .no", "label"], ["Clue text", ".icard .p", "read"], ["Lock name on brass", ".lname", "label"],
    ["“Pull the shackle to try”", ".pull", "label"], ["Tag: “Type the whole code instead”", ".tag span", "label"], ["How-to line under the lock", ".how", "read"], ["Hint drawer button (locked)", "#hint-btn span", "label"],
    ["Hint note", "#hint-note", "read"], ["Key ring: the current key's number", ".door.current b", "label"]],
  "title, accessibility options open": [["Prompt heading", "#a11y-ask h2", "big"], ["Prompt text", ".a11yq-lead", "read"], ["Prompt switch name", ".a11yq-lbl", "read"], ["Prompt switch state", ".a11yq-st", "read"],
    ["What a switch does", ".a11yq-d", "read"], ["Screen-reader line", ".a11yq-sr", "read"], ["Continue", "#a11y-ask-ok", "read"], ["Continue without changes", "#a11y-ask-skip", "read"]],
  "room 1, reading a clue aloud": [["Listen button on paper", ".icard .listen:not([data-reading]) .lw", "label"], ["Listen button, reading (Stop)", ".listen[data-reading] .lw", "label"], ["Listen button on the wall", "#how + .listen .lw", "label"]],
  "quiz room, reading a question aloud": [["Listen button on a question slip", ".slip .listen:not([data-reading]) .lw", "label"]],
  "room 1, wrong try and a hint": [["Result message", "#msg", "read"], ["Hint paper", ".hint > span", "read"], ["Hint heading", ".hint .hb", "label"], ["Dial characters", ".dial .strip i:nth-child(2)", "big"], ["Typed code", "#answer", "big"]],
  "room 1, plain cards": [["Card name", ".mcard strong", "read"], ["Card code tab", ".mcard .badge", "big"]],
  "room 2, portraits": [["Portrait name plate", ".pname strong", "read"], ["Portrait dates", ".pname .yrs", "read"], ["Portrait code", ".plate", "label"], ["Key ring: a solved key's number", ".door.open b", "label"]],
  "quiz room, wrong try": [["Question", ".slip legend", "read"], ["Question number", ".slip .qn", "label"], ["Choice", ".lever .lt", "read"], ["Typed answer", ".typer input", "read"],
    ["Handle tag", ".klabel", "read"], ["Counter digits", ".counter span", "big"], ["Counter words", ".counter em", "label"]],
  "room 3, solved": [["Timeline card", "#order .t", "read"], ["Position number", "#order .grip", "label"], ["Stamped date", ".when", "label"]],
  "room 4, some slips stamped": [["Slip text", ".ev .txt", "read"], ["Slip number", ".ev .pick", "label"], ["Empty stamp box", ".seg button:not(.on)", "label"], ["Stamped box", ".seg button.on", "label"], ["Rubber stamp label", ".stamp .base", "label"]],
  "room 5, second question": [["Mirror question", ".qcard:not([hidden]) legend", "read"], ["Option", ".qcard:not([hidden]) .lt", "read"], ["Question number button", ".qnav .n:not(.done)", "label"], ["Answered number button", ".qnav .n.done", "label"], ["Next plate", "#try", "big"]],
  "certificate": [["Certificate kicker", ".cert .kicker", "label"], ["Name", ".cert .name", "big"], ["Certificate line", ".cert .line", "read"], ["Facts", ".cert .facts", "read"], ["Small labels", ".cert .small", "label"],
    ["Exit password", "#exit-password", "big"], ["Result (teaser)", ".result .clip .p", "read"], ["Instructions note", ".note", "read"], ["Print button", "#print", "label"]],
  "room 1, a clue held up": [["Sheet heading", ".sheet h2", "big"], ["Sheet text", ".sheet p", "read"], ["Sheet footer", ".sheet .foot", "label"]],
  "notebook open": [["Notebook heading", ".page h2", "big"], ["Notebook stats", ".page .stat", "read"], ["Notebook rows", ".page li button .lbl", "read"], ["Switch state (on/off)", ".page li .st", "label"], ["How to play", ".page ul li", "read"]]
};
/* The other pages a student meets: the front page (also with a link error), a class link that didn't open, and the
   accessibility statement and the teachers' quick-start guide. frontTour() visits each, like tour() does for the game. */
async function frontTour(page, visit) {
  await page.goto(base + "/"); await page.locator("#student-h").waitFor(); await visit("front page");
  await page.click("#a11y-options"); await page.locator("#a11y-ask").waitFor(); await visit("front page, accessibility options open"); await page.keyboard.press("Escape");
  await page.fill("#class-link", "https://example.org/play.html#play=1.abcdefghijkl"); await page.click("#open-link");
  await page.locator("#link-error:not([hidden])").waitFor(); await visit("front page, link error");
  await page.goto(base + "/play.html#play=1.abcdefghijkl"); await page.locator("#link-problem").waitFor(); await visit("class link didn't open");
  await page.goto(base + "/accessibility.html"); await page.locator("#statement h1").waitFor(); await visit("accessibility statement");
  await page.goto(base + "/guide.html"); await page.locator("#print-guide").waitFor(); await visit("quick-start guide");
}
Object.assign(TEXTS, {
  "front page": [["Site name on the placard", ".placard", "label"], ["Front page heading", "h1", "big"], ["Intro line", ".intro", "read"], ["Door plate", ".door h2", "big"],
    ["Paper text on a door", ".sheet .lead", "read"], ["Field label", "label.big", "read"], ["Field hint", ".fhint", "read"], ["Brass button", ".btn", "label"], ["Text link on paper", "#open-saved", "read"],
    ["Small print on paper", ".sheet .small", "read"], ["How it works", ".how span", "read"], ["How it works, step names", ".how b", "read"], ["Privacy line", "#privacy", "read"],
    ["Footer link", "#a11y-link", "read"], ["Guide link", "#guide-link", "read"], ["Display switch", ".switch .lbl", "label"]],
  "front page, accessibility options open": [["Prompt heading", "#a11y-ask h2", "big"], ["Prompt switch name", ".a11yq-lbl", "read"], ["What a switch does", ".a11yq-d", "read"], ["Screen-reader line", ".a11yq-sr", "read"], ["Continue", "#a11y-ask-ok", "read"]],
  "front page, link error": [["Error message", "#link-error", "read"], ["Typed link", "#class-link", "read"]],
  "class link didn't open": [["Its heading", "h2.bplate", "big"], ["Its note", "#link-problem p:not(:last-child)", "read"], ["Front page plate", "#home", "label"]],
  "quick-start guide": [["Guide placard", ".placard", "label"], ["Guide heading", "h1", "big"], ["Guide intro", ".sub", "read"], ["Site address", ".where", "read"], ["QR caption", ".qr figcaption", "read"],
    ["Print button", ".btn", "label"], ["Print note", ".acts .note", "read"], ["Step names", "ol.steps h3", "read"], ["Step text", "ol.steps p", "read"], ["Quiz question", ".quote", "read"],
    ["Menus caution", ".menus", "read"], ["Saved box", ".box p", "read"], ["Troubles", "#trouble dd", "read"], ["Fine print", ".fine", "read"], ["Guide top bar link", ".top a", "read"]],
  "accessibility statement": [["Statement text", "#statement p", "read"], ["Statement heading", "#statement h2", "big"], ["Table text", "#statement td", "read"], ["Top bar link", ".top a", "read"]]
});
const NEED = { read: 7, label: 4.5, big: 4.5 };      // reading text is held to the AAA figure

(async () => {
  const server = await start(0);
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
  console.log("\nStudent game: accessibility tests\n");

  /* ---------- axe on every screen and state, in every look ---------- */
  const LOOKS = [["normal, 1440x900", {}], ["normal, 390x844", { viewport: PHONE }], ["High contrast, 1440x900", { hc: true }], ["High contrast, 390x844", { hc: true, viewport: PHONE }],
    ["Readable text, 1440x900", { readable: true }], ["Readable text, 390x844", { readable: true, viewport: PHONE }],
    ["forced colours, 1440x900", { forced: true }], ["prefers-contrast: more, 390x844", { contrast: "more", viewport: PHONE }]];
  for (const [label, opts] of (REPORT ? LOOKS.slice(0, 2) : LOOKS)) test(`axe finds nothing on any screen or state (${label})`, async () => {
    const page = await open(opts), bad = []; let states = 0;
    if (opts.hc || opts.contrast) assert.equal(await page.getAttribute("html", "data-contrast"), "more");
    if (opts.readable) assert.equal(await page.getAttribute("html", "data-readable"), "on");
    await tour(page, async name => { states++; for (const v of await axe(page)) bad.push(`[${name}] ${v}`);
      if (SNAP && !opts.viewport && !opts.hc && !opts.readable && !opts.forced) { fs.mkdirSync(SNAP, { recursive: true }); fs.writeFileSync(path.join(SNAP, name.replace(/[^a-z0-9]+/gi, "-") + ".txt"), await page.locator("body").ariaSnapshot()); } });
    report.states = states; expectNone("axe violations", bad); await done(page);
  });

  /* ---------- keyboard only ---------- */
  test("the whole game can be played with the keyboard alone, start to certificate", async () => {
    if (REPORT && URL_) return;
    const page = await open({ viewport: { width: 1280, height: 800 }, motion: "no-preference" });
    const mouse = await page.evaluateHandle(() => { window.__mouse = 0; ["pointerdown", "mousedown", "touchstart"].forEach(t => addEventListener(t, () => window.__mouse++, true)); });
    const key = k => page.keyboard.press(k);
    const tabTo = async (sel, max = 150) => { for (let i = 0; i < max; i++) { await key("Tab"); if (await page.evaluate(s => !!document.activeElement && document.activeElement.matches(s), sel)) return; } throw new Error("Tab never reached " + sel); };
    const heading = async re => { await page.waitForFunction(s => new RegExp(s).test((document.querySelector("#stage h2") || {}).textContent || ""), re.source, { timeout: 5000 }); await page.waitForTimeout(900); };
    const focusOn = () => page.evaluate(() => { const a = document.activeElement; return a ? a.tagName + (a.id ? "#" + a.id : "") + "." + a.className : ""; });
    // after a solve, focus is on "Go through the door"; Enter goes on
    const through = async re => { await page.locator("#onward").waitFor(); assert.match(await focusOn(), /#onward/, "focus moves to the door plate"); await key("Enter"); await heading(re); };
    // title: the skip link is the first stop; sign the ledger, read the rules, push the door
    await key("Tab"); assert.match(await focusOn(), /skip/, "the first Tab stop is the skip link");
    // the Tab order is the reading order: HUD, the story, the ledger, the rules, and Begin last (though it is drawn on the door at the left)
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll("#view a[href], #view button, #view input")].map(e => e.id || e.className)), ["skip", "draft", "sound-toggle", "watch", "go", "listen", "a11y-options", "pname", "rb", "listen", "begin"]);
    await tabTo("#pname"); await page.keyboard.type("Keyboard Player");
    await tabTo(".rules .rb"); await key("Enter"); assert.equal(await page.isVisible("#examine"), true); await key("Tab"); await key("Tab"); assert.equal(await page.evaluate(() => !!document.activeElement.closest("#examine")), true, "Tab stays in the sheet");
    await key("Escape"); assert.match(await focusOn(), /\.rb/, "focus returns to the paper");
    await tabTo("#begin"); await key("Enter"); await heading(/Room 1/);
    assert.match(await focusOn(), /^H2/, "focus is on the new room's heading");
    // room 1: read a clue, hear the description, set the dials, try
    await tabTo("#describe"); await key("Enter"); assert.match(await page.textContent("#examine"), /Code L: Essentialism/); await key("Escape");
    await tabTo(".icard .no"); await key("Enter"); assert.match(await page.textContent("#examine"), /Clue 1/); await key("Escape");
    // the lock is worked in reading order: dials, the code box, then the shackle
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll(".dlock [tabindex='0'], .dlock input, .dlock button")].map(e => e.id || e.className.split(" ")[0])), ["dial", "dial", "dial", "dial", "dial", "answer", "try"]);
    await tabTo(".dial"); await page.keyboard.type("lear"); await key("ArrowUp"); for (let i = 0; i < 13; i++) await key("ArrowUp");   // the last dial by arrows: blank … N
    assert.equal(await page.inputValue("#answer"), "LEARN");
    await key("Enter"); await through(/Room 2/);
    // room 2: type the code in the box instead
    await tabTo("#answer"); await page.keyboard.type("9154"); await key("Enter"); await through(/Room 3/);
    // room 3: move cards with the studs (focus stays on the card being moved)
    const rank = s => TIMELINE.findIndex(k => s.includes(k));
    for (let pass = 0; pass < 8; pass++) for (let i = 0; i < 6; i++) {
      const t = await page.$$eval("#order li .t", els => els.map(e => e.textContent));
      if (rank(t[i]) > rank(t[i + 1])) { await page.evaluate(i => { window.__want = document.querySelectorAll("#order li")[i].querySelector("button[data-d='1']"); }, i);
        for (let k = 0; k < 150; k++) { await key(k % 60 === 59 ? "Shift+Tab" : "Tab"); if (await page.evaluate(() => document.activeElement === window.__want)) break; }
        assert.equal(await page.evaluate(() => document.activeElement === window.__want), true, "reached the Move down stud"); await key("Enter"); }
    }
    await tabTo("#try"); await key("Enter"); await through(/Room 4/);
    // room 4: stamp each slip with its own boxes (Space presses)
    for (let i = 0; i < 8; i++) { await tabTo(`.seg button[data-i="${i}"][data-v="${SORT[i]}"]`); await key("Space"); }
    await tabTo("#try"); await key("Enter"); await through(/Room 5/);
    // room 5: arrow to an option, Enter goes to the next question, and on the last one finishes
    for (let q = 0; q < 6; q++) { await tabTo(`.qcard:not([hidden]) input`); await key("Space"); await key("ArrowDown"); await key("Enter"); await page.waitForTimeout(80); }
    await through(/You Escaped/);
    assert.match(await page.textContent("#stage"), /Keyboard Player/); assert.equal(await page.textContent("#exit-password"), "DEWEY1916");
    // the notebook: Esc opens it, Tab stays inside, Esc closes it and focus goes back to the watch
    await key("Escape"); assert.equal(await page.isVisible("#pause"), true);
    for (let i = 0; i < 12; i++) { await key("Tab"); assert.equal(await page.evaluate(() => !!document.activeElement.closest("#pause")), true); }
    await key("Escape"); assert.match(await focusOn(), /#watch/);
    assert.equal(await page.evaluate(() => window.__mouse), 0, "no pointer events were used"); await mouse.dispose();
    await done(page);
  }, { solo: true });

  /* ---------- focus and targets ---------- */
  for (const [label, opts] of [["1440x900", {}], ["390x844", { viewport: PHONE }], ["390x844, High contrast and Readable text", { viewport: PHONE, hc: true, readable: true }]]) {
    if (REPORT && opts.hc) continue;
    test(`every focusable control shows a focus ring and is never covered; targets are 24px or more, game controls 44px (${label})`, async () => {
      const page = await open(opts), focus = [], size = [];
      await page.keyboard.press("Tab");                          // keyboard mode, so :focus-visible applies to scripted focus
      await tour(page, async name => { await page.keyboard.press("Shift"); for (const p of await inPage(page, checkFocus)) focus.push(`[${name}] ${p}`); for (const p of await inPage(page, checkTargets)) size.push(`[${name}] ${p}`); });
      expectNone("focus hidden or covered", focus); expectNone("targets too small", size); await done(page);
    });
  }

  /* ---------- resize, reflow, spacing ---------- */
  const SPACING = "*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}";
  const SIZES = [["text at 200% (browser font size 32px), 1440x900", { viewport: DESKTOP }, "big"], ["text at 200%, 390x844", { viewport: PHONE }, "big"],
    ["320px wide (1280px at 400% zoom)", { viewport: { width: 320, height: 256 } }, ""], ["720x450 (1440x900 at 200% zoom)", { viewport: { width: 720, height: 450 } }, ""],
    ["WCAG text spacing, 1440x900", { viewport: DESKTOP }, "space"], ["WCAG text spacing, 390x844", { viewport: PHONE }, "space"],
    ["text at 200% with Readable text and text spacing, 390x844", { viewport: PHONE, readable: true }, "big space"]];
  for (const [label, opts, how] of SIZES) {
    if (REPORT && /Readable/.test(label)) continue;
    test(`nothing is cut off and nothing scrolls sideways: ${label}`, async () => {
      const page = await open(opts), bad = [];
      if (how.includes("big")) await page.addStyleTag({ content: "html{font-size:200%!important}" });       // what a 32px browser default does to a page sized in rem
      if (how.includes("space")) await page.addStyleTag({ content: SPACING });
      await page.evaluate(() => window.dispatchEvent(new Event("resize")));
      await tour(page, async name => { for (const p of await inPage(page, checkClip)) bad.push(`[${name}] ${p}`); });
      expectNone(/spacing/.test(label) ? "text spacing: clipped" : /200%\)|200%,/.test(label) ? "200% text: clipped" : "reflow: clipped or sideways scroll", bad);
      await done(page);
    });
  }
  test("text size is the reader's: the root font size is never set from the window, and pinch zoom is allowed", async () => {
    if (REPORT) return;
    for (const viewport of [DESKTOP, PHONE, { width: 2200, height: 1300 }, { width: 700, height: 400 }]) {
      const page = await open({ viewport });
      assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize), "16px", "the root stays at the browser's size");
      assert.equal(await page.evaluate(() => document.documentElement.style.fontSize), "");
      assert.doesNotMatch(await page.getAttribute("meta[name=viewport]", "content"), /user-scalable|maximum-scale/);
      await page.addStyleTag({ content: "html{font-size:24px}" });
      assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector("#begin")).fontSize), "30px", "text follows a larger browser font size");
      await done(page);
    }
  });

  /* ---------- forced colours and high contrast ---------- */
  for (const [label, opts] of [["forced colours", { forced: true }], ["prefers-contrast: more", { contrast: "more" }], ["the High contrast switch, 390x844", { hc: true, viewport: PHONE }]]) test(`controls and states are still drawn in ${label}`, async () => {
    if (REPORT) return;
    const page = await open(opts), bad = [];
    if (opts.forced) assert.equal(await page.evaluate(() => matchMedia("(forced-colors: active)").matches), true);
    else assert.equal(await page.getAttribute("html", "data-contrast"), "more");
    await tour(page, async name => { for (const p of await inPage(page, checkDrawn)) bad.push(`[${name}] ${p}`); });
    expectNone("forced colours: undrawn", bad);
    if (!opts.forced) {      // no textures or lamplight are left over text
      assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector("#light")).display), "none");
      assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector("#grainfx")).display), "none");
    }
    await done(page);
  });

  /* ---------- announcements, names, roles, states ---------- */
  test("wrong and right answers are announced in the polite live region; a new room is announced once, by its heading", async () => {
    if (REPORT) return;
    const page = await open();
    const said = re => page.waitForFunction(s => new RegExp(s).test(document.querySelector("#live").textContent), re.source, { timeout: 4000 });
    const focused = () => page.evaluate(() => { const a = document.activeElement; return a.tagName + ":" + a.textContent.replace(/\s+/g, " ").trim(); });
    // every text the live region ever holds, in order
    await page.evaluate(() => { window.__said = []; new MutationObserver(() => { const t = document.querySelector("#live").textContent.trim(); if (t) window.__said.push(t); }).observe(document.querySelector("#live"), { childList: true, characterData: true, subtree: true }); });
    assert.equal(await page.getAttribute("#live", "aria-live"), "polite");
    await page.click("#begin"); await page.locator("#stage h2:has-text('Room 1')").waitFor(); await page.waitForTimeout(400);
    assert.match(await focused(), /^H2:Room 1 · The Library$/, "focus moves to the room's heading, which reads the room out");
    assert.deepEqual(await page.evaluate(() => window.__said), [], "the room is not announced a second time through the live region");
    await page.click("#try"); await said(/Type the code first/);
    await page.fill("#answer", "wrong"); await page.click("#try"); await said(/won't budge/);
    await page.evaluate(() => { document.querySelector("#live").textContent = ""; });
    await page.click("#try"); await said(/won't budge/);                   // the same message again is announced again
    await page.fill("#answer", "learn"); await page.click("#try"); await said(/lock|open/i);
    const success = await page.textContent("#live");
    assert.equal(await page.evaluate(() => document.activeElement.id), "onward", "focus moves to “Go through the door”");
    assert.equal(await page.textContent("#onward"), "Go through the door");
    await page.waitForTimeout(9000);                                       // nothing moves on, and nothing clears the message, however long the player takes
    assert.match(await page.textContent("#stage h2"), /Room 1/, "the room doesn't change by itself");
    assert.equal(await page.textContent("#live"), success, "the success message is still in the live region");
    assert.equal(await page.textContent("#msg"), success, "and on screen");
    await page.evaluate(() => { window.__said = []; });
    await page.keyboard.press("Enter"); await page.locator("#stage h2:has-text('Room 2')").waitFor(); await page.waitForTimeout(400);
    assert.match(await focused(), /^H2:Room 2 · /, "focus is on the new room's heading");
    assert.deepEqual(await page.evaluate(() => window.__said), [], "the new room is announced once (by its heading), not again in the live region");
    assert.equal(await page.textContent("#live"), "", "the old message is cleared silently");
    await room(page, 3); await page.locator("#order li").first().getByRole("button", { name: "Move down" }).click(); await said(/^Moved to position 2 of 7: /);
    await room(page, 4); await page.click("#try"); await said(/Choose a category for every item first/);
    await page.click(".stamp[data-v='0']"); await said(/Slip 1 stamped Traditional.*Slip 2 is picked up/);
    for (let i = 0; i < 8; i++) await page.click(`.seg button[data-i="${i}"][data-v="0"]`);
    await page.click("#try"); await said(/4 of 8 are in the correct category/);
    assert.equal(await page.textContent("#counter"), "4of8right", "the counter shows the same result");
    await page.evaluate(() => { S.player = "Test"; go(6); }); await page.locator("#stage h2:has-text('You Escaped')").waitFor();
    assert.match(await focused(), /^H2:You Escaped!$/, "the certificate's heading takes focus");
    await done(page);
  }, { solo: true });
  test("names, roles and states: title, headings, key ring, dials, switches, dialogs, hints, stamps", async () => {
    if (REPORT) return;
    const page = await open({ motion: "no-preference" });
    assert.equal(await page.getAttribute("html", "lang"), "en");
    assert.equal(await page.title(), "Escape the Old Schoolhouse");
    assert.equal(await page.locator("h1").count(), 1); assert.equal(await page.locator("main").count(), 1); assert.equal(await page.locator("header").count(), 1);
    assert.match(await page.getAttribute("#doors", "aria-label"), /5 to solve, none started/);
    await page.evaluate(() => { ROOMS[0].hintsEnabled = true; ROOMS[0].hints = ["Start with the clue you are surest about."]; });
    await page.click("#begin"); await page.locator("#stage h2:has-text('Room 1')").waitFor();
    assert.equal(await page.title(), "Room 1 of 5: The Library · Escape the Old Schoolhouse", "each screen has its own page title");
    assert.equal(await page.getAttribute("#doors", "aria-label"), "Rooms: you are in room 1 of 5, 0 solved");
    assert.deepEqual((await page.locator("#doors .door .sr").allTextContents()).slice(0, 2), ["Room 1, you are here", "Room 2, locked"]);
    // headings in order, one h1
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll("#scene h1,#scene h2,#scene h3")].map(h => h.tagName + " " + h.textContent.trim())),
      ["H1 Escape the Old Schoolhouse", "H2 Room 1 · The Library", "H3 Books on the shelf", "H3 Card Catalog", "H3 Library lock"], "the objects, the clues and the lock each have a heading");
    // the Draft note keeps one name and unfolds a region it controls
    const draftName = await page.textContent("#draft"); await page.click("#draft");
    assert.equal(await page.textContent("#draft"), draftName); assert.equal(await page.getAttribute("#draft", "aria-expanded"), "true"); assert.equal(await page.isVisible("#" + await page.getAttribute("#draft", "aria-controls")), true);
    await page.click("#draft");
    // dials
    const dial = page.locator(".dial").first();
    assert.equal(await dial.getAttribute("role"), "spinbutton"); assert.equal(await dial.getAttribute("aria-label"), "Dial 1 of 5"); assert.equal(await dial.getAttribute("aria-valuetext"), "blank");
    await dial.focus(); await page.keyboard.press("e");
    assert.equal(await dial.getAttribute("aria-valuetext"), "E, 5 of 26"); assert.equal(await dial.getAttribute("aria-valuenow"), "5");
    await page.waitForFunction(() => document.querySelector("#live").textContent === "Dial 1: E");     // typing moves on to the next dial, so the value set is said first
    assert.equal(await page.locator(".dials").getAttribute("role"), "group");
    assert.match(await page.textContent("#" + await page.locator(".dials").getAttribute("aria-describedby")), /up and down arrows or the arrow keys, or type the whole code/, "the lock says how to work it, in plain words");
    assert.equal(await page.locator("label:has(#answer)").count(), 1, "the code box has a real label");
    // a dial arrow works on release, not on press (pointer cancellation), and a drag has a tap alternative
    const nub = await page.locator(".dial").nth(1).locator(".nub").first().boundingBox();
    await page.mouse.move(nub.x + nub.width / 2, nub.y + nub.height / 2); await page.mouse.down();
    assert.equal(await page.locator(".dial").nth(1).getAttribute("aria-valuetext"), "blank", "nothing happens on press");
    await page.mouse.up(); assert.equal(await page.locator(".dial").nth(1).getAttribute("aria-valuetext"), "A, 1 of 26");
    // hints: locked drawer is reachable and says why
    assert.equal(await page.getAttribute("#hint-btn", "aria-disabled"), "true"); assert.equal(await page.getAttribute("#hint-btn", "aria-describedby"), "hint-note");
    await page.focus("#hint-btn"); assert.equal(await page.evaluate(() => document.activeElement.id), "hint-btn", "a locked hint drawer can still be focused");
    // papers: the words are plain text, and a short heading button opens the paper large
    assert.deepEqual(await page.locator(".clues button.no").allTextContents(), ["Clue 1", "Clue 2", "Clue 3", "Clue 4", "Clue 5"]);
    assert.equal(await page.locator(".clues button[aria-haspopup=dialog]").count(), 5);
    assert.equal(await page.locator(".story .go").textContent(), "Pick up the note to read it");
    assert.equal(await page.evaluate(() => document.querySelector(".story .clip").closest("button")), null, "the story is text on the page, not a button's name");
    // describe this room
    await page.click("#describe");
    assert.equal(await page.getAttribute("#examine", "role"), "dialog"); assert.equal(await page.getAttribute("#examine", "aria-modal"), "true"); assert.equal(await page.getAttribute("#examine", "aria-label"), "Room description");
    const d = (await page.textContent("#examine")).replace(/\s+/g, " ");
    for (const re of [/Room 1 of 5: The Library/, /10 books on the shelf/, /Code L: Essentialism/, /Clue 1: All students should master/, /combination padlock with 5 dials/, /Pull the shackle/]) assert.match(d, re);
    assert.equal(await page.evaluate(() => document.querySelector("#scene").inert), true, "the room behind a sheet is inert");
    await page.keyboard.press("Escape"); assert.equal(await page.evaluate(() => document.activeElement.id), "describe"); assert.equal(await page.evaluate(() => document.querySelector("#scene").inert), false);
    // notebook switches
    await page.click("#watch");
    assert.equal(await page.getAttribute("#pause", "role"), "dialog"); assert.equal(await page.getAttribute("#pause", "aria-modal"), "true"); assert.equal(await page.getAttribute("#pause", "aria-labelledby"), "pause-h");
    for (const [id, label, on] of [["sound-toggle-2", "Sound", "true"], ["motion-toggle", "Motion", "true"], ["contrast-toggle", "High contrast", "false"], ["readable-toggle", "Readable text", "false"], ["clock-toggle", "Hide the clock", "false"]]) {
      const b = page.locator("#" + id); assert.equal(await b.getAttribute("role"), "switch"); assert.equal(await b.getAttribute("aria-checked"), on, id); assert.equal(await b.locator(".lbl").textContent(), label);
    }
    await page.click("#contrast-toggle"); assert.equal(await page.getAttribute("html", "data-contrast"), "more"); assert.equal(await page.getAttribute("#contrast-toggle", "aria-checked"), "true");
    await page.click("#readable-toggle"); assert.equal(await page.getAttribute("html", "data-readable"), "on");
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize), "18px", "Readable text is larger");
    assert.match(await page.evaluate(() => getComputedStyle(document.querySelector(".page h2")).fontFamily), /^"?Atkinson Hyperlegible/, "and uses the plain face for labels too");
    await page.click("#clock-toggle"); assert.equal(await page.getAttribute("html", "data-clock"), "off");
    await page.keyboard.press("Escape");
    assert.equal(await page.isHidden("#timer"), true, "the clock can be hidden");
    await page.reload();
    assert.equal(await page.getAttribute("html", "data-contrast"), "more", "High contrast is remembered"); assert.equal(await page.getAttribute("html", "data-readable"), "on"); assert.equal(await page.getAttribute("html", "data-clock"), "off");
    // sorting: stamps are pressed buttons with the slip in their group name
    await page.evaluate(() => { S.player = "T"; go(4); }); await page.locator("#stage h2:has-text('Room 4')").waitFor();
    assert.equal(await page.locator(".seg").first().getAttribute("aria-label"), "Stamp slip 1 as");
    await page.click(".seg button[data-i='0'][data-v='1']"); assert.equal(await page.getAttribute(".seg button[data-i='0'][data-v='1']", "aria-pressed"), "true");
    await page.click("#describe"); assert.match((await page.textContent("#examine")).replace(/\s+/g, " "), /\(stamped Progressive\).*\(not stamped yet\)/, "the description follows what has been done"); await page.keyboard.press("Escape");
    // reflection: nothing moves on by itself
    await page.evaluate(() => go(5)); await page.locator("#stage h2:has-text('Room 5')").waitFor();
    await page.locator("input[name=q0]").first().check(); await page.waitForTimeout(500);
    assert.equal(await page.isVisible("input[name=q0]"), true, "choosing an answer doesn't change the question");
    assert.equal(await page.textContent("#try"), "Next question");
    assert.equal(await page.getAttribute(".qnav .n >> nth=0", "aria-label"), "Question 1, answered"); assert.equal(await page.getAttribute(".qnav .n >> nth=0", "aria-current"), "step");
    assert.match(await page.textContent(".qcard:not([hidden]) legend"), /^Question 1 of 6:\s+\S/, "the question number and the question read as two phrases");
    // ordering: each stud names its card and where it is now
    await page.evaluate(() => go(3)); await page.locator("#stage h2:has-text('Room 3')").waitFor();
    const studs = await page.$$eval("#order li:nth-child(2) .stud", els => els.map(e => e.getAttribute("aria-label")));
    assert.match(studs[0], /^Move up: .+ \(now 2nd of 7\)$/); assert.match(studs[1], /^Move down: .+ \(now 2nd of 7\)$/);
    assert.equal(await page.$$eval("#order .stud", els => new Set(els.map(e => e.getAttribute("aria-label"))).size), 14, "no two studs share a name");
    // Play again asks first, because it throws the certificate away
    await page.evaluate(() => go(6)); await page.locator("#again").waitFor();
    await page.click("#again"); assert.match(await page.textContent("#again"), /certificate and exit password will be lost. Press again/);
    assert.equal(await page.isVisible("#exit-password"), true, "the first press keeps the certificate");
    await done(page);
  }, { solo: true });
  for (const viewport of [PHONE, { width: 720, height: 450 }, { width: 320, height: 256 }]) test(`after every try the result is in view and not under the more-below tab (${viewport.width}x${viewport.height})`, async () => {
    if (REPORT) return;
    const page = await open({ viewport }), bad = [];
    const check = async what => {
      const r = await page.evaluate(() => { const m = document.querySelector("#msg").getBoundingClientRect(), more = document.querySelector("#more"), c = more.hidden ? null : more.getBoundingClientRect();
        return { inView: m.top >= 0 && m.bottom <= innerHeight, covered: !!c && m.left < c.right && m.right > c.left && m.top < c.bottom && m.bottom > c.top, text: document.querySelector("#msg").textContent }; });
      if (!r.text) bad.push(`${what}: no result shown`);
      if (!r.inView) bad.push(`${what}: the result “${r.text}” is out of view`);
      if (r.covered) bad.push(`${what}: the result “${r.text}” is under the more-below tab`);
    };
    await page.evaluate(() => { S.player = "T"; });
    for (let n = 1; n <= 5; n++) {
      await room(page, n);
      if (n <= 2) await page.fill("#answer", n === 1 ? "xxxxx" : "1111");
      if (n === 4) await page.click(".seg button[data-i='0'][data-v='1']");
      await page.locator("#try").focus(); await page.keyboard.press("Enter"); await page.waitForTimeout(150);
      await check(`room ${n}, ${n === 3 ? "a wrong order" : n === 4 ? "an incomplete answer" : n === 5 ? "no answer chosen" : "a wrong code"}`);
    }
    // and after a right answer: the result stays in view above the door plate, which has focus
    await room(page, 1); await page.fill("#answer", "learn"); await page.locator("#try").focus(); await page.keyboard.press("Enter"); await page.waitForTimeout(150);
    await check("room 1, solved");
    assert.equal(await page.evaluate(() => document.activeElement.id), "onward");
    assert.equal(bad.length, 0, bad.join("\n"));
    await done(page);
  });
  test("the instructions under every lock name the real control, and matching rooms say to take the clues in order", async () => {
    if (REPORT) return;
    const page = await open();
    await page.evaluate(q => { S.player = "T"; ROOMS.push(q); }, QUIZ);
    for (let n = 1; n <= 6; n++) {
      await room(page, n);
      const r = await page.evaluate(() => ({ type: ROOMS[S.room - 1].type, how: document.querySelector("#how").textContent, name: document.querySelector("#try .sr")?.textContent || document.querySelector("#try").textContent }));
      if (r.type !== "reflection") assert.ok(r.how.includes(`“${r.name}”`), `room ${n} (${r.type}): the instructions should name the button “${r.name}”, got: ${r.how}`);
      else assert.match(r.how, /“Next question”/);
      assert.doesNotMatch(r.how, /^turn the handle|, turn the handle|then turn the handle/i, "no picture-only wording");
      if (r.type === "matching") assert.match(r.how, /Take the clues in order: the codes of the \w+ they describe, in that order, open the lock/);
      if (n === 2) assert.match(r.how, /Some portraits are decoys/);
    }
    await room(page, 1);
    assert.equal(await page.textContent("label:has(#answer) span"), "Type the whole code instead", "the code box's label makes sense on its own");
    await done(page);
  });
  test("the reading face is Atkinson Hyperlegible, built in; the typewriter face is only on short tags", async () => {
    if (REPORT) return;
    const page = await open();
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.evaluate(() => document.fonts.check('16px "Atkinson Hyperlegible"') && document.fonts.check('bold 16px "Atkinson Hyperlegible"')), true);
    await page.evaluate(() => { S.player = "T"; go(1); });
    const fam = sel => page.evaluate(s => getComputedStyle(document.querySelector(s)).fontFamily.split(",")[0].replace(/"/g, ""), sel);
    for (const sel of [".story", ".icard .p", ".how", "#answer", ".vol .letter b", ".dial .strip i", "#timer", "#draft"]) assert.equal(await fam(sel), "Atkinson Hyperlegible", sel);
    const typewriter = await page.evaluate(() => [...document.querySelectorAll("#scene *")].filter(e => e.childNodes.length && [...e.childNodes].some(n => n.nodeType === 3 && n.nodeValue.trim()) && /^"?Special Elite/.test(getComputedStyle(e).fontFamily)).map(e => e.textContent.trim()));
    assert.ok(typewriter.every(t => t.split(/\s+/).length <= 4), "typewriter face only on short tags, got: " + typewriter.join(" | "));
    const small = await page.evaluate(() => [...document.querySelectorAll("#scene *")].filter(e => [...e.childNodes].some(n => n.nodeType === 3 && n.nodeValue.trim()) && e.getClientRects().length && !e.closest(".sr") && parseFloat(getComputedStyle(e).fontSize) < 12.75).map(e => e.className + ":" + getComputedStyle(e).fontSize));
    assert.deepEqual(small, [], "no text smaller than 12.8px (0.8rem)");
    await done(page);
  });

  /* ---------- contrast ---------- */
  for (const [label, opts] of [["normal, 1440x900", {}], ["normal, 390x844", { viewport: PHONE }], ["High contrast, 1440x900", { hc: true }]]) test(`measured contrast of every text style against its real background (${label})`, async () => {
    const page = await open({ ...opts, scale: 2 }), helper = await page.context().newPage(), bad = [], table = {};
    await helper.goto("about:blank"); await page.addStyleTag({ content: HIDE });
    await tour(page, async name => { for (const [what, sel, kind] of TEXTS[name] || []) {
      const c = await contrastOf(page, helper, sel); if (c == null) { if (!page.old) bad.push(`[${name}] couldn't measure ${what} (${sel})`); continue; }
      table[what] = { ratio: c, kind };
      if (c < NEED[kind]) bad.push(`[${name}] ${what} (${sel}): ${c}:1, needs ${NEED[kind]}:1`);
    } });
    report.contrast[label] = table; expectNone("contrast below AA", bad); await done(page);
  });

  /* ---------- WebKit ---------- */
  test("WebKit: axe finds nothing, focus is never covered, nothing is cut off at 200% text (390x844)", async () => {
    if (REPORT) return;
    let wk; try { wk = await webkit.launch(); } catch (e) { console.log("      (WebKit isn't installed here; skipped)"); return; }
    try {
      const page = await open({ viewport: PHONE, engine: wk }), bad = [];
      let stops = 0;
      await tour(page, async name => { for (const v of await axe(page)) bad.push(`[${name}] ${v}`);
        const w = await tabWalk(page, "Alt+Tab"); stops += w.stops; for (const p of w.out) bad.push(`[${name}] ${p}`); });
      assert.ok(stops > 150, `the Tab walk reached only ${stops} controls`);
      await done(page);
      const big = await open({ viewport: PHONE, engine: wk });
      await big.addStyleTag({ content: "html{font-size:200%!important}" }); await big.evaluate(() => window.dispatchEvent(new Event("resize")));
      await tour(big, async name => { for (const p of await inPage(big, checkClip)) bad.push(`[${name}, 200%] ${p}`); });
      await done(big);
      assert.equal(bad.length, 0, bad.slice(0, 25).join("\n"));
    } finally { await wk.close(); }
  });

  /* ---------- the front page, a broken class link, and the statement ---------- */
  for (const [label, opts] of (REPORT ? LOOKS.slice(0, 2) : LOOKS)) test(`front pages: axe finds nothing (${label})`, async () => {
    const page = await open({ ...opts, path: "/" }), bad = [];
    await frontTour(page, async name => { for (const v of await axe(page)) bad.push(`[${name}] ${v}`); });
    expectNone("axe violations (front pages)", bad); await done(page);
  });
  for (const [label, opts] of [["1440x900", {}], ["390x844", { viewport: PHONE }], ["390x844, High contrast and Readable text", { viewport: PHONE, hc: true, readable: true }]]) {
    if (REPORT && opts.hc) continue;
    test(`front pages: focus rings, never covered, targets 24px or more (${label})`, async () => {
      const page = await open({ ...opts, path: "/" }), focus = [], size = [];
      await page.keyboard.press("Tab");
      await frontTour(page, async name => { await page.keyboard.press("Tab"); for (const p of await inPage(page, checkFocus)) focus.push(`[${name}] ${p}`); for (const p of await inPage(page, checkTargets)) size.push(`[${name}] ${p}`); });
      expectNone("focus hidden or covered", focus); expectNone("targets too small", size); await done(page);
    });
  }
  for (const [label, opts, how] of SIZES) {
    if (REPORT && /Readable/.test(label)) continue;
    test(`front pages: nothing is cut off and nothing scrolls sideways: ${label}`, async () => {
      const page = await open({ ...opts, path: "/" }), bad = [];
      const style = async () => { if (how.includes("big")) await page.addStyleTag({ content: "html{font-size:200%!important}" }); if (how.includes("space")) await page.addStyleTag({ content: SPACING }); };
      await frontTour(page, async name => { await style(); for (const p of await inPage(page, checkClip)) bad.push(`[${name}] ${p}`); });
      expectNone("front pages: clipped", bad); await done(page);
    });
  }
  for (const [label, opts] of [["forced colours", { forced: true }], ["the High contrast switch, 390x844", { hc: true, viewport: PHONE }]]) test(`front pages: controls are still drawn in ${label}`, async () => {
    if (REPORT) return;
    const page = await open({ ...opts, path: "/" }), bad = [];
    await frontTour(page, async name => { for (const p of await inPage(page, checkDrawn)) bad.push(`[${name}] ${p}`);
      if (name === "front page") for (const p of await page.evaluate(() => [...document.querySelectorAll(".btn, .switch, #class-link, .door, .sheet")].filter(el => { const cs = getComputedStyle(el); return !(parseFloat(cs.borderTopWidth) >= 1 && cs.borderTopStyle !== "none"); }).map(el => "no edge: " + (el.id || el.className)))) bad.push(`[${name}] ${p}`); });
    expectNone("forced colours: undrawn", bad); await done(page);
  });
  for (const [label, opts] of [["normal, 1440x900", {}], ["normal, 390x844", { viewport: PHONE }], ["High contrast, 1440x900", { hc: true }]]) test(`front pages: measured contrast of every text style (${label})`, async () => {
    const page = await open({ ...opts, scale: 2, path: "/" }), helper = await page.context().newPage(), bad = [], table = {};
    await helper.goto("about:blank");
    await frontTour(page, async name => { await page.addStyleTag({ content: HIDE }); for (const [what, sel, kind] of TEXTS[name] || []) {
      const c = await contrastOf(page, helper, sel); if (c == null) { bad.push(`[${name}] couldn't measure ${what} (${sel})`); continue; }
      table[what] = { ratio: c, kind };
      if (c < NEED[kind]) bad.push(`[${name}] ${what} (${sel}): ${c}:1, needs ${NEED[kind]}:1`);
    } });
    report.contrast["front pages, " + label] = table; expectNone("contrast below AA (front pages)", bad); await done(page);
  });
  test("front pages: language, titles, one h1, landmarks, a labelled box with its hint, switches", async () => {
    if (REPORT) return;
    const page = await open({ path: "/" });
    assert.equal(await page.getAttribute("html", "lang"), "en");
    assert.equal(await page.locator("h1").count(), 1); assert.equal(await page.locator("main").count(), 1); assert.equal(await page.locator("footer").count(), 1);
    assert.equal(await page.getAttribute("#student", "aria-labelledby"), "student-h"); assert.equal(await page.getAttribute("#teacher", "aria-labelledby"), "teacher-h");
    assert.equal(await page.locator("label[for=class-link]").count(), 1); assert.equal(await page.getAttribute("#class-link", "aria-describedby"), "link-hint");
    for (const id of ["contrast-toggle", "readable-toggle"]) { assert.equal(await page.getAttribute("#" + id, "role"), "switch"); assert.equal(await page.getAttribute("#" + id, "aria-checked"), "false"); }
    await page.click("#readable-toggle"); assert.equal(await page.getAttribute("html", "data-readable"), "on");
    await page.waitForFunction(() => document.querySelector("#live").textContent === "Readable text is on.");
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize), "18px");
    await page.goto(base + "/play.html#play=1.abc"); await page.locator("#link-problem").waitFor();
    assert.equal(await page.locator("#stage h2").count(), 1, "one h2 in the stage");
    assert.equal(await page.evaluate(() => document.activeElement.tagName), "H2", "focus is on the message, which reads it out");
    await page.goto(base + "/accessibility.html");
    assert.equal(await page.locator("h1").count(), 1); assert.equal(await page.locator("main").count(), 1);
    assert.equal(await page.locator(".tbl[role=region][aria-label][tabindex='0']").count(), await page.locator("table").count(), "every table scrolls in a labelled, focusable box");
    await done(page);
  });

  await runAll();
  await browser.close(); server.close();
  if (REPORT) { fs.writeFileSync(REPORT, JSON.stringify(report, null, 1)); console.log("\nReport written to " + REPORT + "\n" + JSON.stringify(report.counts, null, 1)); process.exit(0); }
  console.log(`\n${passed} passed, ${failed} failed.`);
  process.exit(failed ? 1 : 0);
})();
