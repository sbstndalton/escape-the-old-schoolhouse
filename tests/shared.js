// Quick checks of src/shared.js that don't need a browser. Run with `npm test`.
const assert = require("assert/strict");
const ER = require("../src/shared.js");
let n = 0; const t = (name, fn) => { fn(); n++; console.log("  ✔ " + name); };
console.log("\nShared logic tests\n");
t("answers ignore case, accents, apostrophes and letters like ø", () => {
  assert.equal(ER.norm("Émile"), "emile");
  assert.equal(ER.norm("Søren Kierkegaard"), "soren kierkegaard");
  assert.equal(ER.norm("Plato’s Republic"), ER.norm("Platos republic"));
  assert.ok(ER.accepted("John Dewey | Dewey").includes(ER.norm("  dewey! ")));
});
t("a fixed card code with a space still makes a solvable lock", () => {
  const m = ER.matching({ codeStyle: "letters", cards: [{ term: "a", clue: "x", code: "X Y" }, { term: "b", clue: "y" }] });
  assert.equal(m.answer, "XYA");
  assert.ok(!/\s/.test(m.answer));
});
t("hint check flags the lock code as a whole word only", () => {
  const room = { type: "matching", codeWord: "LEARN", cards: "ABCDE".split("").map(x => ({ term: x, clue: x })) };
  room.hints = ["learning by doing"]; assert.equal(ER.hintWarnings(room).length, 0);
  room.hints = ["The code is LEARN."]; assert.equal(ER.hintWarnings(room).length, 1);
});
t("cipher rooms: letters move round the alphabet and back, everything else stays, and the checks know the room", () => {
  assert.equal(ER.caesar("Abc, xyz! Émile 1916", 3), "Def, abc! Éploh 1916", "only A-Z and a-z move; case, accents, digits and punctuation stay");
  for (const k of [1, 3, 13, 25]) assert.equal(ER.caesar(ER.caesar("Learning by doing.", k), -k), "Learning by doing.");
  assert.equal(ER.cipherShift({ shift: "7" }), 7); assert.equal(ER.cipherShift({}), 3); assert.equal(ER.cipherShift({ shift: 40 }), 3);
  const room = { type: "cipher", title: "c", shift: 4, messages: [{ text: "Children learn by doing.", answers: "Dewey|John Dewey" }] };
  assert.deepEqual(ER.validate({ meta: { title: "x" }, rooms: [room] }), []);
  const bad = ER.validate({ meta: { title: "x" }, rooms: [{ type: "cipher", title: "c", shift: 26, messages: [{ text: "1916", answers: "" }] }] }).join(" ");
  assert.match(bad, /needs some letters/); assert.match(bad, /needs at least one accepted answer/); assert.match(bad, /whole number from 1 to 25/);
  assert.match(ER.validate({ meta: { title: "x" }, rooms: [{ type: "cipher", title: "c", messages: [] }] }).join(" "), /at least one secret message/);
  assert.deepEqual(ER.reviewItems({ rooms: [room] }).map(x => x.list), ["messages"]);
  assert.match(ER.answerKey(room).join("\n"), /turn it \*\*4\*\* places[\s\S]*John Dewey/);
  assert.ok(ER.HINT_ROOMS.includes("cipher"));
  assert.equal(ER.hintWarnings({ ...room, hints: ["The answer is Dewey."] }).length, 1, "a hint that gives the answer away is flagged");
  const d = ER.a11yDescribe(room, { turn: 4 });
  assert.equal(d[0].list[0], "Glmphvir pievr fc hsmrk.", "the description lists the message in code");
  assert.equal(d[1].list[0], "Children learn by doing.", "and what it reads at the wheel's setting");
  assert.match(ER.a11yHow(room), /“Turn back” and “Turn forward”[\s\S]*“Check answers”/);
  const clean = ER.cleanConfig({ rooms: [{ type: "cipher", shift: "9", messages: [{ text: "a", answers: "b", __x: 1 }] }, { type: "cipher", shift: "<b>" }] });
  assert.equal(clean.rooms[0].shift, 9, "the wheel setting stays a number in a class link"); assert.equal(clean.rooms[1].shift, undefined, "and a setting that isn't a number is dropped");
  assert.deepEqual(clean.rooms[0].messages, [{ text: "a", answers: "b" }]);
});
t("validate catches a sorting item with no category and a blank correct choice", () => {
  const base = { meta: { title: "x" } };
  assert.ok(ER.validate({ ...base, rooms: [{ type: "sorting", title: "s", categories: ["A", "B"], items: [{ text: "i", category: -1 }] }] }).some(e => /pick its correct category/.test(e)));
  assert.ok(ER.validate({ ...base, rooms: [{ type: "quiz", title: "q", questions: [{ prompt: "p", kind: "choice", choices: ["a", "b"], correct: -1 }] }] }).some(e => /mark which choice is correct/.test(e)));
});
t("a matching room's look falls back to plain cards; portrait initials skip small words", () => {
  assert.equal(ER.look({}), "cards");
  assert.equal(ER.look({ look: "nonsense" }), "cards");
  assert.equal(ER.look({ look: "portraits", cards: [{ term: "x".repeat(80) }] }), "portraits");
  assert.equal(ER.look({ look: "books", cards: [{ term: "Essentialism" }] }), "books");
  assert.equal(ER.look({ look: "books", cards: [{ term: "x".repeat(49) }] }), "cards");
  assert.equal(ER.initials("Jean-Jacques Rousseau"), "JJR");
  assert.equal(ER.initials("George S. Counts"), "GSC");
  assert.equal(ER.initials("**Maria** de la Cruz"), "MC");
  assert.equal(ER.initials("Élise von Stein"), "ÉS");
  assert.equal(ER.initials(""), "?");
});
t("a11yDescribe lists a room as text in reading order; a11yHow says how to work each lock", () => {
  const room = { type: "matching", title: "Shelf", look: "books", story: "Find the word.", codeWord: "AB", cardsHeading: "", cards: [{ term: "Zeta", clue: "first clue" }, { term: "Alpha", clue: "second clue", detail: "1900" }] };
  const d = ER.a11yDescribe(room);
  assert.deepEqual(d.map(p => p.h), ["The note", "2 books on the shelf", "Clues", "The lock"]);
  assert.deepEqual(d[1].list, ["Code **B**: Alpha (1900)", "Code **A**: Zeta"]);
  assert.deepEqual(d[2].list, ["Clue 1: first clue", "Clue 2: second clue"]);
  assert.match(d[3].text.join(" "), /2 dials.*arrow keys, or type the whole code in the box\. Then press “Pull the shackle”/);
  assert.ok(!JSON.stringify(d).includes("AB"), "the description never contains the answer");
  const sort = { type: "sorting", categories: ["Old", "New"], items: [{ text: "one", category: 0 }, { text: "two", category: 1 }] };
  assert.deepEqual(ER.a11yDescribe(sort, { picks: [1, null] })[1].list, ["one (stamped **New**)", "two (not stamped yet)"]);
  const order = { type: "ordering", title: "T", items: [{ text: "a" }, { text: "b" }, { text: "c" }] };
  assert.deepEqual(ER.a11yDescribe(order, { order: [2, 0, 1] })[0].list, ["c", "a", "b"]);
  for (const type of ["matching", "quiz", "ordering", "sorting", "reflection"]) assert.ok(ER.a11yHow({ type }).length > 20, type);
  assert.equal(ER.a11yHow({ type: "other" }), "");
});
t("a11yCheck gives teachers advisory notes about content that is hard to use", () => {
  const cfg = { intro: {}, rooms: [
    { type: "matching", title: "m", codeWord: "ABCDEFGHIJ", cards: "ABCDEFGHIJ".split("").map(x => ({ term: x, clue: "the red one on the left" })) },
    { type: "quiz", title: "q", story: "s", questions: [{ kind: "short", prompt: "p", answers: "Dewey" }, { kind: "short", prompt: "p", answers: "Dewey|John Dewey" }] }] };
  const notes = ER.a11yCheck(cfg), text = notes.map(n => n.room + ": " + n.message).join("\n");
  assert.match(text, /-1: The opening page has no story/);
  assert.match(text, /0: This room has no story/);
  assert.match(text, /0: The lock code has 10 characters/);
  assert.match(text, /0: Some text uses the word "red"/);
  assert.match(text, /1: Question 1 accepts only one typed answer/);
  assert.doesNotMatch(text, /Question 2/);
  assert.deepEqual(ER.a11yCheck({ intro: { story: "x" }, rooms: [{ type: "quiz", story: "s", questions: [{ kind: "choice", prompt: "p", choices: ["a", "b"], correct: 0 }] }] }), []);
});

/* ---------- class links ---------- */
const SAMPLE = require("../content/foundations-of-education.json");
const SITE = "https://sbstndalton.github.io/escape-the-old-schoolhouse/play.html";
const at = async (name, fn) => { await fn(); n++; console.log("  ✔ " + name); };
const kindOf = async p => { try { await p; return "opened"; } catch (e) { return e.kind || e.message; } };
const linkOf = async obj => "#play=1." + Buffer.from(require("zlib").deflateRawSync(Buffer.from(typeof obj === "string" ? obj : JSON.stringify(obj)))).toString("base64url");
(async () => {
  await at("a class link round-trips the sample exactly, starts with #play=1. and is about 7.3 KB", async () => {
    const link = await ER.toLink(SAMPLE, SITE);
    assert.ok(link.startsWith(SITE + "#play=1."), link.slice(0, 80));
    assert.match(link.slice(SITE.length), /^#play=1\.[A-Za-z0-9_-]+$/, "only characters that survive email and course systems");
    assert.ok(link.length > 6000 && link.length < 8500, "length " + link.length);
    assert.deepEqual(await ER.fromLink(link), SAMPLE);
    assert.deepEqual(ER.cleanConfig(SAMPLE), SAMPLE, "cleaning a valid escape room changes nothing");
    // zlib in Node reads it too, so the format is plain deflate-raw
    const data = link.split("#play=1.")[1];
    assert.deepEqual(JSON.parse(require("zlib").inflateRawSync(Buffer.from(data, "base64url"))), SAMPLE);
  });
  await at("a link is found in whatever a person pastes: the address, the code, a sentence, angle brackets", async () => {
    const link = await ER.toLink(SAMPLE, SITE), code = link.split("#play=")[1];
    for (const pasted of [link, "  " + link + "  ", `Here is the escape room: ${link}.`, `<${link}>`, code, "#play=" + code, link.replace("#play=1.", "#play=1%2E")])
      assert.deepEqual(await ER.fromLink(pasted), SAMPLE, pasted.slice(0, 60));
    assert.equal(ER.hasLink("https://example.com/"), false);
    assert.equal(await kindOf(ER.fromLink("https://example.com/page")), "not-link");
    assert.equal(await kindOf(ER.fromLink("")), "not-link");
  });
  await at("a cut-off or damaged link says so plainly, wherever it was cut", async () => {
    const link = await ER.toLink(SAMPLE, SITE), cut = [SITE.length + 8, SITE.length + 20, 200, 1000, 3000, 6000, link.length - 40, link.length - 3, link.length - 1];
    for (const at of cut) assert.equal(await kindOf(ER.fromLink(link.slice(0, at))), "incomplete", "cut at " + at);
    assert.equal(await kindOf(ER.fromLink(link.slice(0, 3000) + "AAAAAAAAAAAAAAA")), "incomplete");
    assert.equal(await kindOf(ER.fromLink(link.replace("#play=1.", "#play=2."))), "newer");
    assert.equal(await kindOf(ER.fromLink(SITE + "#play=")), "incomplete");
    assert.equal(await kindOf(ER.fromLink(await linkOf("not json at all"))), "incomplete");
    assert.equal(await kindOf(ER.fromLink(await linkOf([1, 2, 3]))), "invalid");
    assert.equal(await kindOf(ER.fromLink(await linkOf({ meta: { title: "x" }, rooms: [] }))), "invalid", "validated: an escape room needs a room");
    assert.match(ER.LINK_WORDS.incomplete, /^This class link is incomplete\. Ask your teacher to send it again\.$/);
  });
  await at("link content is untrusted: __preview and odd shapes are dropped, numbers stay numbers, sizes are capped", async () => {
    const bad = JSON.parse(JSON.stringify(SAMPLE));
    Object.assign(bad, { __preview: true, __proto__x: 1, constructor: "x" });
    bad["__proto__"] = { polluted: true };
    bad.scoring = { mode: "deductions", wrongPenalty: "<img src=x onerror=alert(1)>", hintPenalty: "5", minScore: { a: 1 } };
    bad.meta.title = { toString: "<b>" }; bad.rooms[0].cards = "not a list"; bad.rooms[1].hints = [{ x: 1 }, "<script>alert(1)</script>", 7];
    bad.rooms[2].items[0].text = "x".repeat(200000); bad.rooms[3].type = "constructor";
    const c = ER.cleanConfig(JSON.parse(JSON.stringify(bad).replace('"__proto__x"', '"__proto__"')));
    assert.equal(c.__preview, undefined); assert.equal(Object.getPrototypeOf(c), Object.prototype); assert.equal({}.polluted, undefined);
    assert.equal(c.constructor, Object, "an own 'constructor' key is dropped");
    assert.equal(c.scoring.wrongPenalty, undefined, "a penalty that isn't a number is dropped"); assert.equal(c.scoring.hintPenalty, 5); assert.equal(c.scoring.minScore, undefined);
    assert.equal(c.meta.title, undefined, "a title that isn't text is dropped");
    assert.deepEqual(c.rooms[0].cards, []); assert.deepEqual(c.rooms[1].hints, ["", "<script>alert(1)</script>", "7"], "texts stay texts (the game escapes them)");
    assert.equal(c.rooms[2].items[0].text.length, 50000);
    // nesting deeper than the format goes is cut off; huge lists are capped
    const deep = JSON.parse('{"rooms":[{"cards":['.repeat(400) + "]}]}".repeat(400));
    assert.equal(JSON.stringify(ER.cleanConfig(deep)).length < 200, true, "deep nesting is cut off");
    assert.ok(["incomplete", "invalid"].includes(await kindOf(ER.fromLink(await linkOf('{"rooms":' + "[".repeat(200000) + "]".repeat(200000) + "}")))), "very deep nesting can't break it");
    assert.equal(ER.cleanConfig({ rooms: Array.from({ length: 5000 }, () => ({ type: "quiz" })) }).rooms.length, 500);
    assert.throws(() => ER.cleanConfig("x")); assert.throws(() => ER.cleanConfig(null));
  });
  await at("a link that unpacks to something huge is refused (a 'zip bomb')", async () => {
    const big = await linkOf({ meta: { title: "x" }, rooms: [{ type: "quiz", title: "q", questions: [{ kind: "short", prompt: "p", answers: "a" }] }], pad: " ".repeat(30 * 1024 * 1024) });
    assert.ok(big.length < 60000, "the link itself is small: " + big.length);
    assert.equal(await kindOf(ER.fromLink(big)), "too-big");
    assert.equal(await kindOf(ER.fromLink("#play=1." + "A".repeat(2100000))), "too-big");
  });
  await at("without CompressionStream a link is still made (uncompressed) and read; a compressed one says the browser is too old", async () => {
    const keep = [globalThis.CompressionStream, globalThis.DecompressionStream], small = { meta: { title: "Tiny" }, rooms: [{ type: "quiz", title: "Q", questions: [{ kind: "short", prompt: "Who?", answers: "Dewey" }] }] };
    const zipped = await ER.toLink(small, SITE);
    try {
      globalThis.CompressionStream = undefined; globalThis.DecompressionStream = undefined;
      const plain = await ER.toLink(small, SITE);
      assert.ok(plain.length > zipped.length);
      assert.deepEqual(await ER.fromLink(plain), small);
      assert.equal(await kindOf(ER.fromLink(zipped)), "old-browser");
      assert.equal(await kindOf(ER.fromLink(plain.slice(0, plain.length - 10))), "incomplete");
    } finally { [globalThis.CompressionStream, globalThis.DecompressionStream] = keep; }
    assert.deepEqual(await ER.fromLink(await ER.toLink(small, SITE)), small);
  });
  await at("QR codes: the right size, finder squares in three corners, none when the link is too long, and they decode", async () => {
    const q = ER.qr("https://example.com/");
    assert.equal(q.size, q.version * 4 + 17);
    for (const [x, y] of [[0, 0], [q.size - 7, 0], [0, q.size - 7]]) { assert.equal(q.dark(x, y), true); assert.equal(q.dark(x + 1, y + 1), false); assert.equal(q.dark(x + 3, y + 3), true); }
    assert.equal(ER.qr("x".repeat(3000)), null); assert.equal(ER.qr("x".repeat(2000), { maxVersion: 25 }), null);
    assert.match(ER.qrSvg("hello", { label: "QR <code>" }), /^<svg [^>]*role="img" aria-label="QR &lt;code&gt;"/);
    let jsQR = null; try { jsQR = require("jsqr"); } catch (e) {}
    if (!jsQR) return console.log("      (jsqr isn't installed, so the codes weren't decoded)");
    const small = await ER.toLink({ meta: { title: "Tiny" }, rooms: [{ type: "quiz", title: "Q", questions: [{ kind: "short", prompt: "Who?", answers: "Dewey" }] }] }, SITE);
    for (const text of ["A", "https://example.com/", small, "é and ü: " + "z".repeat(600), "q".repeat(2900)]) {
      const c = ER.qr(text), s = 3, w = (c.size + 8) * s, px = new Uint8ClampedArray(w * w * 4);
      for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4, d = c.dark(Math.floor(x / s) - 4, Math.floor(y / s) - 4); px[i] = px[i + 1] = px[i + 2] = d ? 0 : 255; px[i + 3] = 255; }
      const r = jsQR(px, w, w); assert.ok(r, "decodes (version " + c.version + ")"); assert.equal(r.data, text);
    }
  });
  await at("the test class link in SCREEN-READER-TESTS.md opens the escape room the script describes", async () => {
    const doc = require("fs").readFileSync(require("path").join(__dirname, "..", "SCREEN-READER-TESTS.md"), "utf8");
    const links = [...new Set(doc.match(/https:\/\/\S+?#play=[\w.-]+/g) || [])];
    assert.equal(links.length, 1, "one test link");
    assert.ok(links[0].startsWith(SITE + "#play=1."));
    const c = await ER.fromLink(links[0]);
    assert.equal(c.meta.title, "Screen reader test"); assert.equal(c.finish.exitPassword, "LISTEN42");
    const room = c.rooms[0];
    assert.equal(room.type, "quiz"); assert.equal(room.hintsEnabled, true); assert.equal(room.hints[0], "Read each question again slowly.");
    assert.equal(room.questions[0].prompt, "What is 2 + 2? Type the number."); assert.ok(ER.accepted(room.questions[0].answers).includes("4"));
    assert.equal(room.questions[1].prompt, "Which of these is a color?"); assert.equal(room.questions[1].choices[room.questions[1].correct], "Blue");
    assert.ok(room.questions.every(q => q.verified === false), "nothing in it is marked as checked");
  });
  console.log(`\n${n} passed, 0 failed.`);
})().catch(e => { console.error("  ✘ " + e.stack); process.exit(1); });
