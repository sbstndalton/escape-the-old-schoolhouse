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
  assert.match(d[3].text.join(" "), /2 dials.*arrow keys, or type the code/);
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
console.log(`\n${n} passed, 0 failed.`);
