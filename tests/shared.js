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
console.log(`\n${n} passed, 0 failed.`);
