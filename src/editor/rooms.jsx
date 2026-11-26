/* Advanced mode's pages: one per part of the escape room, each a set of index tabs { id, label, help?, body }. */
import { useState, Fragment } from "react";
import { RadioGroup, Radio } from "@ui-sdk/react/radio";
import { S, ER, changed, rerender, say, grow, nextId } from "./store.js";
import { Icon, Tip, useTipId, Field, Select, Toggle, ListEditor, unverify, objKey } from "./controls.jsx";
import { ask, toast } from "./layers.jsx";
import { a11yCheck, a11yGroups, A11Y_BY_HAND } from "./check.js";
import { choose } from "./workshop.jsx";

/* ===================== Room types ===================== */
export function blankQuestion(kind = "short"){ return { prompt: "", kind, answers: "", choices: ["", "", "", ""], correct: 0, source: "", verified: false }; }
export function blankCard(){ return { term: "", detail: "", icon: "", clue: "", code: "", source: "", verified: false }; }
function blankOrder(){ return { text: "", label: "", source: "", verified: false }; }
function blankSort(){ return { text: "", category: 0, source: "", verified: false }; }
export function blankMessage(){ return { text: "", answers: "", source: "", verified: false }; }
function blankProfile(k){ return { key: k || ("P" + Date.now().toString(36)), name: "", who: "", desc: "", next: "", source: "", verified: false }; }
export const TYPES = {
  quiz:       { icon: "key", name: "Question lock", desc: "Short-answer or multiple-choice questions. All must be right to open the lock. Works like a chapter quiz.",
                blank: () => ({ type: "quiz", title: "New question room", story: "", reference: "", lockLabel: "Question lock", successMessage: "Every answer is right. The lock opens!", hints: [], questions: [blankQuestion()] }) },
  matching:   { icon: "lock", name: "Matching code", desc: "Cards with codes and clues. Students match each clue to a card and enter the codes as the lock combination.",
                blank: () => ({ type: "matching", title: "New matching room", story: "", reference: "", look: "cards", codeStyle: "letters", codeWord: "", cluesHeading: "Clues", lockLabel: "Lock", successMessage: "The lock opens!", failMessage: "The lock won't budge. Check each clue again.", hints: [], cards: [blankCard(), blankCard()] }) },
  ordering:   { icon: "glass", name: "Put in order", desc: "Students arrange items in the correct order (timelines, steps in a process).",
                blank: () => ({ type: "ordering", title: "New timeline room", story: "", reference: "", lockLabel: "Order lock", successMessage: "Everything is in order. The lock opens!", hints: [], items: [blankOrder(), blankOrder()] }) },
  sorting:    { icon: "trays", name: "Sort into groups", desc: "Students put each item into the right category.",
                blank: () => ({ type: "sorting", title: "New sorting room", story: "", reference: "", categories: ["Group A", "Group B"], lockLabel: "Sorting lock", successMessage: "All sorted. The lock opens!", hints: [], items: [blankSort()] }) },
  cipher:     { icon: "wheel", name: "Secret message", desc: "A message in code. Students turn a cipher wheel until it reads, then type the answer it points to.",
                blank: () => ({ type: "cipher", title: "New cipher room", story: "", reference: "", shift: 3 + Math.floor(Math.random() * 20), lockLabel: "Cipher lock", successMessage: "Every answer is right. The lock opens!", failMessage: "", hints: [], messages: [blankMessage()] }) },
  reflection: { icon: "mirror", name: "Reflection survey", desc: "No wrong answers. Each choice counts toward a result profile, shown on the certificate.",
                blank: () => ({ type: "reflection", title: "New reflection room", story: "", reference: "", buttonLabel: "Continue", successMessage: "Done!", resultHeading: "Your result", resultNote: "", hints: [], profiles: [blankProfile("A"), blankProfile("B")], questions: [] }) }
};

function HintWarnings({ room }){
  return <div id="hint-warnings">{ER.hintWarnings(room).map((w, i) => <div key={i} className="inknote" role="status">{w.message + " Try pointing students toward how to find it instead."}</div>)}</div>;
}
function hintsTab(room){
  if (!ER.HINT_ROOMS.includes(room.type)) return null;      // reflection rooms have no wrong answers
  if (!Array.isArray(room.hints)) room.hints = [];
  if (room.hints.length > 2) room.hints.length = 2; while (room.hints.length < 2) room.hints.push("");
  const rules = ER.hintRules(S.cfg);
  const kept = (room.hints || []).some(x => String(x).trim());
  return { id: "hints", label: "Hints",
    help: `Up to two hints. Hint 1 unlocks after ${rules.first} wrong ${rules.first === 1 ? "try" : "tries"} in this room, and hint 2 after ${Math.max(rules.first, rules.second)} (change this in Settings). Write hints that point students toward how to find the answer, not the answer itself.`,
    body: <>
      <Toggle id="hints-toggle" label="Hints in this room" on={room.hintsEnabled} onChange={on => { room.hintsEnabled = on; changed(); say(on ? "Hints are on in this room." : "Hints are off in this room."); }} />
      {room.hintsEnabled ? <>
        <Field label="Hint 1: a gentle nudge" obj={room.hints} k={0} type="textarea" rows={2} placeholder="e.g. Look for one key idea in each description…" />
        <Field label="Hint 2: a stronger nudge" obj={room.hints} k={1} type="textarea" rows={2} placeholder="e.g. Start with the ones you're surest about…" />
        <HintWarnings room={room} />
      </> : <p className="typed">No hints in this room.{kept ? " Your saved hints are kept." : ""}</p>}
    </> };
}
function roomTextTab(room){
  return { id: "text", label: "Room text", body: <>
    <Field label="Room title" obj={room} k="title" />
    <Field label="Story / instructions" obj={room} k="story" type="textarea" rows={3} help="What students read when they enter. Use **bold** and *italics*." />
    <Field label="Reading reference shown to students" obj={room} k="reference" placeholder="e.g. Review: Chapter 4, pages 88–102" help="Optional. Tells students where to look things up." />
    <div className="row">
      {room.type === "reflection" ? null : <Field label="Lock label" obj={room} k="lockLabel" />}
      <Field label="Message when solved" obj={room} k="successMessage" />
    </div></> };
}

const LOOK_HELP = {
  cards: "Each card is a plain tile with its code on a brass badge.",
  books: "Each card is a book spine with its code in gilt, and clues are index cards. Best for short names (up to about 25 letters).",
  portraits: "Each card is a framed portrait above a brass plate with its code, and clues are index cards. The frame shows the card's icon, or initials if it has none."
};
function matchingTabs(room){
  const look = ER.LOOKS.includes(room.look) ? room.look : "cards";
  return [
    { id: "items", label: "Cards & clues", help: "Each card is a term or person. Give it a clue to make it part of the answer. A card with no clue is a decoy. Students see cards in A–Z order and clues in the order you list them.",
      body: <ListEditor list={room.cards} noun="Card" blank={blankCard} item={c => <>
        <div className="row"><Field label="Name on card" obj={c} k="term" item={c} /><Field label="Small detail" obj={c} k="detail" placeholder="e.g. dates" item={c} />
          <Field label="Icon" obj={c} k="icon" narrow help="Optional. One emoji or symbol shown on the card and in a portrait frame." /><Field label="Fixed code" obj={c} k="code" narrow help="Optional. Overrides the automatic letter or number for this card." item={c} /></div>
        <Field label="Clue" obj={c} k="clue" type="textarea" rows={2} item={c} placeholder="e.g. The thinker who… (blank: a decoy card)" />
      </>} /> },
    { id: "lock", label: "Lock", help: "The lock combination (in the answer key envelope) is worked out from the cards: the codes of the clue cards, in clue order.",
      body: <>
        <div className="row">
          <Select label="Code on each card" obj={room} k="codeStyle" options={[["letters", "Letters A–Z"], ["numbers", "Numbers 1–9"]]} />
          {room.codeStyle !== "numbers" ? <Field label="Code word (optional)" obj={room} k="codeWord" help="One letter per clue, for example LEARN. Leave blank for automatic letters." /> : null}</div>
        <div id="look-row">
          <Select label="Look of the cards" obj={room} k="look" options={[["cards", "Plain cards", "cards"], ["books", "Books on a shelf", "books"], ["portraits", "Framed portraits", "portraits"]]}
            fallback="cards" help={["This changes the picture only, not the puzzle. ", LOOK_HELP[look]]} /></div>
        <p className="sr" id="look-help" role="status">{LOOK_HELP[look]}</p>
        {room.look === "books" && ER.look(room) !== "books" ? <div className="inknote">One of your names is longer than 48 characters, so students see plain cards for now.</div> : null}
        <div className="row"><Field label="Clues heading" obj={room} k="cluesHeading" /><Field label="Message for a wrong code" obj={room} k="failMessage" /></div>
      </> },
    roomTextTab(room), hintsTab(room) ];
}

function Choices({ q }){
  const [name] = useState(() => nextId("c"));
  const tid = useTipId();
  q.choices = q.choices || [];
  const addChoice = e => {
    const box = e.currentTarget.closest(".entry"), at = [...document.querySelectorAll("#panel .entry")].indexOf(box);
    q.choices.push(""); changed();
    const now = document.querySelectorAll("#panel .entry")[at]; [...(now ? now.querySelectorAll(".choice input[type=text]") : [])].pop()?.focus();
  };
  return <RadioGroup className="field choices" aria-labelledby={name + "l"} aria-describedby={tid} name={name}
    value={q.correct >= 0 && q.correct < q.choices.length ? String(q.correct) : null}
    onValueChange={v => { if (v == null) return; q.correct = Number(v); if (q.verified) say("You changed this item, so its seal is lifted. Check it again."); q.verified = false; changed(); }}>
    <div className="lblrow"><span className="lbl" id={name + "l"}>Choices</span><Tip text="Ring the correct one." about="Choices" id={tid} /></div>
    {q.choices.map((c, j) => { const id = name + "i" + j; return <div className="choice" key={j}>
      <label className="ring" title="Correct answer"><Radio className="ctl" value={String(j)} aria-label={`Choice ${j + 1} is the correct answer`} /><span aria-hidden="true"><Icon name="tick" /></span></label>
      <label className="n" htmlFor={id}><span className="sr">Choice </span>{String(j + 1)}<span aria-hidden="true">.</span></label>
      <input type="text" id={id} value={c ?? ""} autoComplete="off" onChange={e => { q.choices[j] = e.target.value; unverify(q); changed(); }} />
      <button className="glyph red" title="Delete choice" aria-label={`Delete choice ${j + 1}`} onClick={() => {
        q.choices.splice(j, 1); if (j < q.correct) q.correct--; else if (j === q.correct) q.correct = -1; q.verified = false; changed(); say(`Choice ${j + 1} deleted.`); }}><Icon name="x" /></button>
    </div>; })}
    <div><button className="inkline" onClick={addChoice}><Icon name="plus" />Add choice</button></div>
  </RadioGroup>;
}
/* Plain-text quiz format:
   Q: question            A: answer | other accepted answer
   - wrong choice         * correct choice
   Source: …              Verified: yes          (blank line between questions) */
function quizToText(qs){
  return qs.map(q => [ `Q: ${q.prompt}`,
    ...(q.kind === "choice" ? (q.choices || []).map((c, j) => [c, j]).filter(([c]) => String(c).trim()).map(([c, j]) => `${j === q.correct ? "*" : "-"} ${c}`) : [`A: ${q.answers}`]),
    q.source ? `Source: ${q.source}` : null, q.verified ? "Verified: yes" : null ].filter(x => x != null).join("\n")).join("\n\n");
}
function textToQuiz(text){
  const out = [], problems = [];
  text.replace(/\r/g, "").split(/\n\s*\n/).map(b => b.trim()).filter(Boolean).forEach((block, n) => {
    const q = blankQuestion(); q.choices = []; let hasA = false;
    block.split("\n").forEach(line => {
      const l = line.trim(); let m;
      if ((m = l.match(/^q\s*[:)]\s*(.*)$/i))) q.prompt = m[1];
      else if ((m = l.match(/^a\s*[:)]\s*(.*)$/i))) { q.answers = m[1]; hasA = true; }
      else if ((m = l.match(/^([*-])\s+(.*)$/))) { if (m[1] === "*") q.correct = q.choices.length; q.choices.push(m[2]); }
      else if ((m = l.match(/^source\s*:\s*(.*)$/i))) q.source = m[1];
      else if (/^verified\s*:\s*(yes|y|true|✔|✓)\s*$/i.test(l)) q.verified = true;
      else if (l) q.prompt = q.prompt ? q.prompt + " " + l : l;
    });
    q.kind = q.choices.length ? "choice" : "short";
    if (!q.choices.length) q.choices = ["", "", "", ""];
    if (!q.prompt) problems.push(`Question ${n+1} has no "Q:" line.`);
    if (q.kind === "short" && !hasA) problems.push(`Question ${n+1} has no "A:" answer line or choices.`);
    if (q.kind === "choice" && !block.split("\n").some(l => l.trim().startsWith("*"))) problems.push(`Question ${n+1}: mark the correct choice with * instead of -.`);
    out.push(q);
  });
  return { questions: out, problems };
}
function QuizText({ room }){
  const [problems, setProblems] = useState([]);
  const use = () => {
    const ta = document.getElementById("quiz-text");
    const { questions, problems } = textToQuiz(ta.value);
    const same = (a, b) => a.prompt === b.prompt && a.kind === b.kind && (a.kind === "choice"
      ? a.correct === b.correct && JSON.stringify(a.choices.filter(c => String(c).trim())) === JSON.stringify((b.choices || []).filter(c => String(c).trim()))
      : a.answers === b.answers);
    questions.forEach(q => { if (q.verified) q.verified = room.questions.some(old => old.verified && same(q, old)); });
    setProblems(problems);
    if (problems.length) { rerender(); ta.focus(); return; }
    room.questions = questions; S.quizText.delete(room); changed(); toast(`Saved ${questions.length} questions.`);
  };
  return <div>
    <details className="crib"><summary>How to type the questions</summary>
      <pre>{"One question per paragraph, with a blank line between questions.\nQuestions you add or change here come back without their seal;\npress the seal in the form view after checking them.\n\n" +
        "Q: Who wrote Democracy and Education (1916)?\nA: John Dewey | Dewey\nSource: Ch. 3, p. 45\n\nQ: Which philosophy focuses on the \"Great Books\"?\n- Essentialism\n* Perennialism\n- Existentialism\nVerified: yes"}</pre></details>
    <div className="field"><label htmlFor="quiz-text">Questions as text</label>
      <textarea className="mono" id="quiz-text" rows={12} defaultValue={quizToText(room.questions)} spellCheck="false" onInput={e => grow(e.target)}
        aria-invalid={problems.length ? "true" : undefined} aria-describedby={problems.length ? "quiz-text-errors" : undefined} /></div>
    <div id="quiz-text-errors">{problems.length ? <div className="errors" role="alert">Please fix:<ul>{problems.map((p, i) => <li key={i}>{p}</li>)}</ul></div> : null}</div>
    <div className="actions"><button className="stamp" onClick={use}><Icon name="tick" />Use this text</button></div>
  </div>;
}
function quizTabs(room){
  const asText = S.quizText.has(room);
  return [
    { id: "items", label: "Questions", help: "Students must get every question right to open the lock. They're told how many are right, not which ones.",
      body: <>
        <div className="actions" style={{ marginTop: 0 }}>
          <button className="inkline" onClick={() => { asText ? S.quizText.delete(room) : S.quizText.add(room); rerender(); }}><Icon name={asText ? "back" : "type"} />{asText ? "Back to form view" : "Edit all questions as text"}</button></div>
        {asText ? <QuizText room={room} /> : <ListEditor list={room.questions} noun="Question" blank={() => blankQuestion()} item={q => <>
          <Field label="Question" obj={q} k="prompt" type="textarea" rows={2} item={q} />
          <Select label="Answer type" obj={q} k="kind" options={[["short", "Typed answer"], ["choice", "Multiple choice"]]} item={q} />
          {q.kind === "choice" ? <Choices q={q} />
            : <Field label="Accepted answers" obj={q} k="answers" item={q} help="Separate different acceptable answers with |  for example  John Dewey | Dewey. Capitals, accents and punctuation are ignored." />}
        </>} />}
      </> },
    roomTextTab(room), hintsTab(room) ];
}

function cipherTabs(room){
  room.messages = room.messages || [];
  const first = (room.messages.find(m => String(m.text || "").trim()) || {}).text, shift = ER.cipherShift(room);
  return [
    { id: "items", label: "Messages", help: "Write each message in plain words, as a clue: the game puts it in code. Students turn the cipher wheel until it reads, then type the answer it points to. Every answer must be right to open the lock.",
      body: <ListEditor list={room.messages} noun="Message" blank={blankMessage} item={m => <>
        <Field label="Secret message (in plain words)" obj={m} k="text" type="textarea" rows={2} item={m} placeholder="e.g. This thinker said children learn by doing." />
        <Field label="Accepted answers" obj={m} k="answers" item={m} help="The answer the message points to. Separate different acceptable answers with |  for example  John Dewey | Dewey. Capitals, accents and punctuation are ignored." />
      </>} /> },
    { id: "wheel", label: "Wheel", help: "The wheel setting is how many places along the alphabet every letter is moved. Students don't need to know it: they turn the wheel until the messages read.",
      body: <>
        <div className="row"><Field label="Wheel setting" obj={room} k="shift" narrow help="Any whole number from 1 to 25. Only the letters A to Z move; accented letters, numbers and punctuation stay as they are." /></div>
        <p className="typed" id="cipher-sample">{first ? <>{`With the wheel set to ${shift}, students see the first message as: `}<b>{ER.caesar(first, shift)}</b></> : "Write a message, and you will see here how it looks in code."}</p>
        <div className="row"><Field label="Message for a wrong answer" obj={room} k="failMessage" placeholder="e.g. Not yet. Read the messages again." /></div>
      </> },
    roomTextTab(room), hintsTab(room) ];
}

function orderingTabs(room){
  return [
    { id: "items", label: "Items in order", help: "List these in the right order (first at the top). Students see them shuffled. The label (like a year) is revealed after they solve it.",
      body: <ListEditor list={room.items} noun="Item" blank={blankOrder} item={it => <div className="row">
        <div className="grow3"><Field label="Item" obj={it} k="text" type="textarea" rows={2} item={it} /></div>
        <div className="grow1"><Field label="Label shown after solving" obj={it} k="label" item={it} placeholder="e.g. a year (optional)" /></div></div>} /> },
    roomTextTab(room), hintsTab(room) ];
}

function sortingTabs(room){
  room.categories = room.categories || [];
  const remove = async (c, j) => {
    const used = room.items.filter(it => it.category === j).length;
    if (used && !(await ask(`Remove category ${j+1}?`, [`“${c || "Category " + (j + 1)}” is the answer for ${used} ${used === 1 ? "item" : "items"}. They will need a new answer.`], { ok: "Remove category", danger: true }))) return;
    room.categories.splice(j, 1); room.items.forEach(it => { if (it.category === j) { it.category = -1; it.verified = false; } else if (it.category > j) it.category--; }); changed();
    document.querySelector("#panel .actions .inkline")?.focus(); say(`Category ${j+1} removed.`);
  };
  return [
    { id: "items", label: "Groups & items", body: <>
      <h3 style={{ marginTop: ".2rem" }}>Categories</h3>
      {room.categories.map((c, j) => <div className="row" key={j}><Field label={`Category ${j+1}`} obj={room.categories} k={j} />
        {room.categories.length > 2 ? <button className="inkline red" aria-label={`Remove category ${j+1}`} onClick={() => remove(c, j)}>Remove</button> : null}</div>)}
      <div className="actions"><button className="inkline" onClick={() => { room.categories.push(""); changed(); [...document.querySelectorAll("#panel .row > .field input")].filter(i => i.closest(".ledger") == null).pop()?.focus(); }}><Icon name="plus" />Add category</button></div>
      <h3>Items to sort</h3>
      <ListEditor list={room.items} noun="Item" blank={blankSort} item={it => <div className="row">
        <div className="grow3"><Field label="Item" obj={it} k="text" type="textarea" rows={2} item={it} /></div>
        <div className="grow1"><Select label="Correct category" obj={it} k="category" options={room.categories.map((c, j) => [j, c || `Category ${j+1}`])} number item={it} /></div></div>} />
    </> },
    roomTextTab(room), hintsTab(room) ];
}

function reflectionTabs(room){
  const profOpts = () => room.profiles.map(p => [p.key, p.name || "(unnamed result)"]);
  return [
    { id: "items", label: "Results", help: "The result with the most matching answers is shown on the certificate.",
      body: <ListEditor list={room.profiles} noun="Result" blank={() => blankProfile()} item={p => <>
        <div className="row"><Field label="Result name" obj={p} k="name" item={p} /><Field label="Thinkers to explore" obj={p} k="who" item={p} /></div>
        <Field label="Description" obj={p} k="desc" type="textarea" rows={2} item={p} />
        <Field label="Next step" obj={p} k="next" type="textarea" rows={2} item={p} />
      </>} /> },
    { id: "questions", label: "Questions", help: "Each option counts toward one result.",
      body: <ListEditor list={room.questions} noun="Question" blank={() => ({ prompt: "", options: [{ text: "", profile: "" }, { text: "", profile: "" }], source: "", verified: false })} item={q => {
        q.options = q.options || [];
        return <>
          <Field label="Question" obj={q} k="prompt" item={q} />
          {q.options.map((o, j) => <div className="row" key={objKey(o)}>
            <div className="grow3"><Field label={`Option ${j+1}`} obj={o} k="text" item={q} /></div>
            <div className="grow1"><Select label="Counts toward" obj={o} k="profile" options={profOpts()} item={q} /></div>
            <button className="glyph red" title="Delete option" aria-label={`Delete option ${j+1}`} onClick={() => { q.options.splice(j, 1); changed(); }}><Icon name="x" /></button></div>)}
          <div className="actions"><button className="inkline" onClick={() => { q.options.push({ text: "", profile: "" }); changed(); }}><Icon name="plus" />Add option</button></div>
        </>;
      }} /> },
    { id: "result", label: "Result screen", body: <>
      <div className="row"><Field label="Result heading" obj={room} k="resultHeading" /><Field label="Button label" obj={room} k="buttonLabel" /></div>
      <Field label="Note under the result" obj={room} k="resultNote" type="textarea" rows={2} /></> },
    roomTextTab(room) ];
}

/* ===================== Pages ===================== */
function pageSettings(){
  const cfg = S.cfg; cfg.meta = cfg.meta || {}; cfg.hintRules = cfg.hintRules || { first: 1, second: 3 };
  return { key: "settings", icon: "gear", kicker: "Workshop ledger", title: "Settings", help: "Make one escape room per chapter or unit, and save each as its own file.", tabs: [
    { id: "about", label: "Particulars", body: <>
      <Field label="Escape room title" obj={cfg.meta} k="title" />
      <div className="row"><Field label="Course" obj={cfg.meta} k="course" placeholder="e.g. EDU 216" />
        <Field label="Completion code prefix" obj={cfg.meta} k="codePrefix" help="Letters or numbers. Starts each student's completion code." /></div>
      <Field label="Learning outcome shown to students" obj={cfg.meta} k="learningOutcome" type="textarea" rows={2} /></> },
    { id: "hintrules", label: "Hint rules", help: "Hints are off unless you turn them on in a room. When they're on, students must try first: a hint stays locked until they've made this many wrong tries in that room, counted from entering the room.",
      body: <div className="row">
        <Field label="Hint 1 unlocks after … wrong tries" obj={cfg.hintRules} k="first" type="number" min={0} max={20} />
        <Field label="Hint 2 unlocks after … wrong tries" obj={cfg.hintRules} k="second" type="number" min={0} max={20} /></div> } ] };
}
function pageIntro(){
  const cfg = S.cfg; cfg.intro = cfg.intro || {};
  return { key: "intro", icon: "page", kicker: "The first screen", title: "Story & intro", help: "The first screen students see. The “How to play” box is added automatically.", tabs: [
    { id: "intro", label: "Opening", body: <><Field label="Heading" obj={cfg.intro} k="heading" />
      <Field label="Story" obj={cfg.intro} k="story" type="textarea" rows={7} help="Leave a blank line between paragraphs. Use **bold** and *italics*." /></> } ] };
}
function pageFinish(){
  const cfg = S.cfg; cfg.finish = cfg.finish || {}; cfg.scoring = cfg.scoring || { mode: "completion" };
  const deductions = cfg.scoring.mode === "deductions";
  return { key: "finish", icon: "rosette", kicker: "The way out", title: "Finish & grading", tabs: [
    { id: "cert", label: "Certificate", body: <>
      <Field label="Exit password" obj={cfg.finish} k="exitPassword" help="The same for every student: they type it into a one-question quiz in Moodle or Canvas. If it is empty, or still the sample's on changed content, you are asked for one when you export." />
      <Field label="Certificate line" obj={cfg.finish} k="certificateLine" help="Printed after the student's name." />
      <Field label="Instructions under the certificate" obj={cfg.finish} k="instructions" type="textarea" rows={2} /></> },
    { id: "grading", label: "Grading", help: "This is the grade sent to Moodle or Canvas by the SCORM version. The plain HTML version can't send grades; use the exit password with an LMS quiz instead.",
      body: <>
        <Select label="Grading" obj={cfg.scoring} k="mode" options={[["completion", "Completion: 100% for finishing"], ["deductions", "Accuracy: points off for hints and wrong tries"]]} />
        {deductions ? <div className="row">
          <Field label="Points off per hint" obj={cfg.scoring} k="hintPenalty" type="number" min={0} max={100} />
          <Field label="Points off per wrong try" obj={cfg.scoring} k="wrongPenalty" type="number" min={0} max={100} />
          <Field label="Lowest possible score" obj={cfg.scoring} k="minScore" type="number" min={0} max={100} help="What a student gets for finishing, however many hints and tries it took." /></div> : null}
      </> } ] };
}
function pageRoom(r){
  const room = S.cfg.rooms[r]; const t = TYPES[room.type];
  const make = { matching: matchingTabs, quiz: quizTabs, ordering: orderingTabs, sorting: sortingTabs, reflection: reflectionTabs, cipher: cipherTabs }[room.type];
  return { key: room, room, r, icon: t ? t.icon : "door", kicker: `Room ${r+1} · ${t ? t.name : room.type}`, title: room.title || "Untitled", help: t ? t.desc : "",
    tabs: make ? make(room).filter(Boolean) : [{ id: "none", label: "Room", body: <p className="typed">This room type can't be edited here.</p> }] };
}
function a11yGo(n){ const key = typeof n.page === "number" ? S.cfg.rooms[n.page] : n.page; if (key != null && n.tab) S.tabOf.set(key, n.tab); choose(n.page); }
function pageA11y(){
  const notes = a11yCheck(S.cfg), groups = a11yGroups(notes);
  return { key: "a11y", icon: "eye", kicker: "Before you publish", title: "Accessibility check",
    help: "This reads what you wrote and points out things that often shut students out: directions that depend on colour or position, very long locks, missing instructions, heavy reading. It can't judge everything, and it never blocks you.",
    tabs: [ { id: "notes", label: "Notes", body: <>
        <p className="typed" id="a11y-summary">{notes.length
          ? `${notes.length} ${notes.length === 1 ? "note" : "notes"} on what you have written. These are advice, not errors: nothing here stops you previewing or exporting.`
          : "Nothing flagged in what you have written. This check only looks for common problems, so the By hand tab is still worth a read."}</p>
        {[...groups].map(([title, items]) => <Fragment key={title}><h3>{title}</h3><ul className="notes">{items.map((n, i) => <li key={i} data-rule={n.rule}>
          <button className="inkline where" onClick={() => a11yGo(n)}><Icon name="right" />{n.where.replace(/^Room \d+ · /, "")}</button>
          <p>{n.quote ? <span className="quote">{`“${n.quote}” `}</span> : null}{n.text}</p></li>)}</ul></Fragment>)}
      </> },
      { id: "byhand", label: "By hand", help: "Things no automatic check can see.", body: <><p className="typed">Worth a look before you share the game:</p><ul className="plain">{A11Y_BY_HAND.map((x, i) => <li key={i}>{x}</li>)}</ul></> } ] };
}
export const PAGES = { settings: pageSettings, intro: pageIntro, finish: pageFinish, a11y: pageA11y };
export const pageFor = sel => typeof sel === "number" ? pageRoom(sel) : PAGES[sel]();
export function roomStatus(r){ const items = ER.reviewItems({ rooms: [S.cfg.rooms[r]] }); const left = items.filter(x => x.item.verified !== true).length; return { left, total: items.length }; }
