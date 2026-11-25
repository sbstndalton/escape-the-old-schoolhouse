/* The accessibility check: advice about the content the teacher wrote: things that commonly shut students out. It never
   blocks preview or export, and every note says where it is, what was found, and what to do, in plain words.
   a11yCheck(config) returns [{ rule, page, tab, where, text, quote }]; page is "settings", "intro", "finish" or a room index. */
import { S, ER } from "./store.js";
export const A11Y_LIMITS = { dials: 8, cards: 12, clue: 300, story: 900, prompt: 300, item: 200, hint: 300, answer: 40, choices: 6, orderItems: 8, sortItems: 14, roomWords: 500 };
export const A11Y_THING = "(?:books?|cards?|buttons?|box(?:es)?|ones?|portraits?|frames?|pictures?|keys?|stamps?|slips?|levers?|doors?|locks?|labels?|text|letters?|words?|lines?|circles?|squares?|dots?|marks?|tabs?|drawers?|spines?|items?|clues?|answers?|options?|arrows?|icons?|lights?|numbers?|codes?|sections?|parts?|areas?|shapes?|stars?|rows?|columns?|shel(?:f|ves)|dials?)";
export const A11Y_WORDS = {
  colour: [
    new RegExp("\\b(?:the|a|an|this|that|these|those|each|every|which|what|any)\\s+(?:(?:bright|dark|light|pale)\\s+)?(?:red|green|blue|yellow|orange|purple|pink|brown|gr[ae]y|black|white|gold(?:en)?|silver)\\s+" + A11Y_THING + "\\b", "i"),
    /\b(?:marked|shown|written|highlighted|printed|painted|circled|underlined|glow(?:s|ing)?)\s+in\s+(?:red|green|blue|yellow|orange|purple|pink|gold|silver)\b/i,
    /\b(?:colou?r[- ]coded|the same colou?r|different colou?rs?|by (?:its |their )?colou?r|matching colou?rs?|the colou?r of the)\b/i ],
  position: [
    /\b(?:on|to|at|in|from)\s+(?:the|your)\s+(?:far\s+|upper\s+|lower\s+)?(?:left|right|top|bottom)\b(?!\s+(?:to|of way)\b)/i,
    /\b(?:top|bottom|upper|lower)[ -](?:left|right)\b/i, /\b(?:left|right)[- ]hand (?:side|column|corner|panel|page|shelf)\b/i,
    /\b(?:first|second|third|fourth|fifth|last|left|right|top|bottom|middle|leftmost|rightmost)\s+(?:shel(?:f|ves)|rows?|columns?|books?|cards?|portraits?|frames?|pictures?|drawers?|slips?|levers?|stamps?|dials?|box(?:es)?|buttons?|tabs?|spines?|icons?)\b/i,
    new RegExp("\\b(?:above|below|beneath|underneath|beside|next to|to the side of)\\s+(?:the|this|each|that)\\s+" + A11Y_THING + "\\b", "i"),
    /\b(?:shown|listed|pictured|seen|see|the (?:cards?|clues?|list|picture|image|table|boxe?s?))\s+(?:above|below)\b/i ],
  shape: [ new RegExp("\\b(?:round|square|circular|triangular|oval|biggest|largest|smallest|bigger|larger|smaller|tallest|shortest)\\s+" + A11Y_THING + "\\b", "i") ],
  sound: [ /\b(?:listen (?:for|to)|when you hear|until you hear|you(?:'ll| will) hear|after the (?:sound|chime|beep|bell|click)|wait for the (?:sound|chime|beep|bell|click))\b/i ],
  device: [ /\b(?:double|right)[- ]click/i, /\bclick(?:ing)?\s+(?:on|the|a|an|each|every|any|here|to|and|or|it|them)\b/i, /\b(?:drag(?:ging)?|swip(?:e|ing))\s+(?:the|a|an|each|every|it|them|and|to|left|right|up|down)\b/i,
    /\btap(?:ping)?\s+(?:on|the|a|an|each|every|any|here|to|it|them)\b/i, /\bhover(?:ing)?\s+(?:over|on)\b/i, /\b(?:your|the|with a|with the) mouse\b/i ],
  time: [ /\b(?:\d+|one|two|three|five|ten|fifteen|twenty|thirty|sixty)[- ]?(?:minutes?|mins?|seconds?|secs?)\b/i,
    /\b(?:hurry|race against|against the clock|beat the clock|before (?:the )?time runs out|time is running out|running out of time|time limit|countdown|as fast as you can|be quick|quickly now)\b/i ],
  caps: [ /(?:\b[A-Z]{2,}\b[\s,;:!?'’.-]+){3,}\b[A-Z]{2,}\b/ ],
  above: [ /\b(?:all|none|any|both) of the above\b/i, /\ball of these\b/i, /\bboth [a-d] (?:and|&) [a-d]\b/i ]
};
export const A11Y_ADVICE = {
  colour: "This points to something by its colour. Students who are colour-blind, or who use a screen reader, can't tell which one is meant. Name it instead (its title, or its code).",
  position: "This points to something by where it sits on the screen. The layout changes on phones, when zoomed in, and for screen readers. Name the thing instead.",
  shape: "This points to something by its shape or size. That doesn't reach students who can't see the screen well. Name the thing instead.",
  sound: "This relies on hearing something. Sound can be switched off, and some students can't hear it. Say the same thing in words.",
  device: "This names one way of working (“click”, “drag”, “tap”). Students may be using a keyboard, a switch or their voice. “Choose”, “select” or “enter” fits everyone.",
  time: "This sounds like a time limit. The game has none, and time pressure shuts out students who need longer. Leave it out, or say there is no rush.",
  caps: "A long run of capital letters is slower to read, and some screen readers spell it out letter by letter. Use ordinary capitals, and **bold** for emphasis.",
  above: "This choice depends on the order of the choices. Students who listen to the choices one at a time can't see what is “above”. Write out what it stands for."
};
export function a11yCheck(c){
  const out = [], L = A11Y_LIMITS;
  const str = v => String(v == null ? "" : v);
  const note = (rule, page, tab, where, text, quote) => out.push({ rule, page, tab, where, text, quote: str(quote) });
  const count = s => (str(s).trim().match(/\S+/g) || []).length;
  const noWords = s => str(s).trim() !== "" && !/[\p{L}\p{N}]/u.test(str(s));
  const short = s => { s = str(s).replace(/\s+/g, " ").trim(); return s.length > 70 ? s.slice(0, 70) + "…" : s; };
  const hit = (s, list) => { for (const re of list) { const m = str(s).match(re); if (m) return m[0]; } return null; };
  const wording = (s, page, tab, where, kinds = ["colour", "position", "shape", "sound", "device", "time", "caps"]) => {
    if (!str(s).trim()) return;
    for (const k of kinds) { const m = hit(s, A11Y_WORDS[k]); if (m) note(k, page, tab, where, A11Y_ADVICE[k], short(m)); }
  };
  const long = (s, max, page, tab, where, what) => { if (str(s).length > max) note("long-text", page, tab, where,
    `This ${what} is long (${count(s)} words). Long passages are hard going for students with dyslexia, students reading in a second language and anyone on a phone. Try shorter sentences, or split it.`); };
  const alike = s => { s = str(s); return /[A-Za-z]/.test(s) && /\d/.test(s) && ((/O/i.test(s) && /0/.test(s)) || (/[Il]/.test(s) && /1/.test(s))); };

  const meta = c.meta || {}, intro = c.intro || {}, finish = c.finish || {};
  if (!str(meta.title).trim()) note("missing-text", "settings", "about", "Settings · Escape room title", "There is no title. It names the browser tab and the certificate, and it is the first thing a screen reader says.");
  if (!str(intro.story).trim()) note("missing-text", "intro", "intro", "Story & intro · Story", "There is no opening story. Students, and especially students using a screen reader, need to be told what this is and what to do.");
  wording(intro.heading, "intro", "intro", "Story & intro · Heading"); wording(intro.story, "intro", "intro", "Story & intro · Story");
  long(intro.story, L.story * 1.5, "intro", "intro", "Story & intro · Story", "story");
  wording(finish.instructions, "finish", "cert", "Finish · Instructions under the certificate");
  if (alike(finish.exitPassword)) note("look-alike", "finish", "cert", "Finish · Exit password", "The exit password mixes characters that look alike (O and 0, or I, l and 1). Students copying it by eye will mistype it. Swap those characters for clearer ones.", finish.exitPassword);

  (c.rooms || []).forEach((room, r) => {
    const R = `Room ${r + 1}`;
    let total = count(room.story);
    if (!str(room.title).trim()) note("missing-text", r, "text", `${R} · Room title`, "This room has no title. The title is its heading, and it is how students using a screen reader know they have moved on.");
    if (!str(room.story).trim()) note("missing-text", r, "text", `${R} · Story / instructions`, "This room has no story or instructions. Say what students have to do here; not everyone can work it out from the picture.");
    wording(room.story, r, "text", `${R} · Story / instructions`); long(room.story, L.story, r, "text", `${R} · Story / instructions`, "story");
    wording(room.reference, r, "text", `${R} · Reading reference`, ["colour", "position", "device"]);
    if (ER.HINT_ROOMS.includes(room.type)) {
      const hints = (room.hints || []).map(str).filter(x => x.trim());
      if (!room.hintsEnabled) note("no-hints", r, "hints", `${R} · Hints`, "Hints are off in this room, so a student who is stuck has no help. One or two nudges make the room fairer for students who need more support.");
      else if (!hints.length) note("no-hints", r, "hints", `${R} · Hints`, "Hints are switched on, but nothing is written yet.");
      if (room.hintsEnabled) hints.forEach((x, i) => { wording(x, r, "hints", `${R} · Hint ${i + 1}`); long(x, L.hint, r, "hints", `${R} · Hint ${i + 1}`, "hint"); });
    }
    if (room.type === "matching") {
      const cards = room.cards || [];
      let answer = ""; try { answer = str(ER.matching(room).answer); } catch(e){}
      if (answer.length > L.dials) note("long-code", r, "items", `${R} · Lock`, `The lock has ${answer.length} dials, one for each clue. More than ${L.dials} is slow and tiring with a keyboard, a switch or a screen reader. Give fewer cards a clue (the rest become decoys), or split the room in two.`);
      if (alike(answer)) note("look-alike", r, "lock", `${R} · Lock`, "The combination mixes characters that look alike (O and 0, or I, l and 1). Use codes that can't be confused.", answer);
      if (cards.length > L.cards) note("many-items", r, "items", `${R} · Cards`, `There are ${cards.length} cards. That is a lot to keep in mind, and a long way to travel by keyboard. Around ${L.cards} or fewer works better.`);
      cards.forEach((card, i) => {
        const W = `${R} · Card ${i + 1}`;
        if (str(card.icon).trim() && !str(card.term).trim()) note("symbol-only", r, "items", W, "This card has an icon but no name. A picture on its own means nothing to a screen reader, and little to many students. Give the card a name in words.", card.icon);
        else if (noWords(card.term)) note("symbol-only", r, "items", W, "This card's name is only a symbol or emoji. Screen readers may skip it or read something odd. Use words; keep the symbol in the Icon box if you like it.", card.term);
        wording(card.term, r, "items", W, ["caps"]); wording(card.clue, r, "items", `${W} · Clue`); long(card.clue, L.clue, r, "items", `${W} · Clue`, "clue");
        total += count(card.clue) + count(card.term);
      });
    }
    if (room.type === "quiz") (room.questions || []).forEach((q, i) => {
      const W = `${R} · Question ${i + 1}`;
      wording(q.prompt, r, "items", W); long(q.prompt, L.prompt, r, "items", W, "question"); total += count(q.prompt);
      if (q.kind === "choice") {
        const filled = (q.choices || []).map(str).filter(x => x.trim());
        if (filled.length > L.choices) note("many-items", r, "items", W, `There are ${filled.length} choices. More than ${L.choices} is a lot to hold in mind when they are read out one at a time.`);
        filled.forEach(x => { if (noWords(x)) note("symbol-only", r, "items", W, "One choice is only a symbol or emoji. Use words, so every student gets the same meaning.", x); wording(x, r, "items", W, ["above", "colour", "position"]); total += count(x); });
      } else {
        const accepted = str(q.answers).split("|").map(x => x.trim()).filter(Boolean);
        if (!accepted.length) note("answer-list", r, "items", W, "No accepted answer is written yet, so nothing a student types can be right.");
        else {
          const longest = accepted.reduce((a, b) => a.length >= b.length ? a : b);
          if (accepted.every(x => x.length > L.answer)) note("answer-list", r, "items", W, `Every accepted answer is long (over ${L.answer} characters). A typed answer has to match, so long answers punish typing slips. Ask for a name or a term, or make it multiple choice.`, short(longest));
          else if (accepted.length === 1 && /\s/.test(accepted[0])) note("answer-list", r, "items", W, "Only one way of typing the answer is accepted, and it is more than one word. Add the other ways students might fairly type it, separated by | (a surname alone, a common spelling, with or without “the”).", accepted[0]);
        }
      }
    });
    if (room.type === "cipher") (room.messages || []).forEach((m, i) => {
      const W = `${R} · Message ${i + 1}`;
      wording(m.text, r, "items", W); long(m.text, L.prompt, r, "items", W, "message"); total += count(m.text);
      const accepted = str(m.answers).split("|").map(x => x.trim()).filter(Boolean);
      if (!accepted.length) note("answer-list", r, "items", W, "No accepted answer is written yet, so nothing a student types can be right.");
      else if (accepted.length === 1 && /\s/.test(accepted[0])) note("answer-list", r, "items", W, "Only one way of typing the answer is accepted, and it is more than one word. Add the other ways students might fairly type it, separated by | (a surname alone, without “the”).");
    });
    if (room.type === "ordering") {
      const items = room.items || [];
      if (items.length > L.orderItems) note("many-items", r, "items", `${R} · Items`, `There are ${items.length} items to put in order. Each move takes a key press, and a wrong try gives little to go on. ${L.orderItems} or fewer is kinder.`);
      items.forEach((it, i) => { const W = `${R} · Item ${i + 1}`; if (noWords(it.text)) note("symbol-only", r, "items", W, "This item is only a symbol or emoji. Use words.", it.text); wording(it.text, r, "items", W); long(it.text, L.item, r, "items", W, "item"); total += count(it.text); });
    }
    if (room.type === "sorting") {
      (room.categories || []).forEach((cat, j) => { if (!str(cat).trim()) note("missing-text", r, "items", `${R} · Category ${j + 1}`, "This category has no name. Its stamp would be blank."); else if (noWords(cat)) note("symbol-only", r, "items", `${R} · Category ${j + 1}`, "This category's name is only a symbol or emoji. Use words.", cat); });
      const items = room.items || [];
      if (items.length > L.sortItems) note("many-items", r, "items", `${R} · Items`, `There are ${items.length} items to sort. That is a long task in one go. Around ${L.sortItems} or fewer works better.`);
      items.forEach((it, i) => { const W = `${R} · Item ${i + 1}`; if (noWords(it.text)) note("symbol-only", r, "items", W, "This item is only a symbol or emoji. Use words.", it.text); wording(it.text, r, "items", W); long(it.text, L.item, r, "items", W, "item"); total += count(it.text); });
    }
    if (room.type === "reflection") (room.questions || []).forEach((q, i) => {
      const W = `${R} · Question ${i + 1}`;
      wording(q.prompt, r, "questions", W); long(q.prompt, L.prompt, r, "questions", W, "question"); total += count(q.prompt);
      (q.options || []).forEach(o => { if (noWords(o.text)) note("symbol-only", r, "questions", W, "One option is only a symbol or emoji. Use words.", o.text); wording(o.text, r, "questions", W, ["above", "colour", "position"]); total += count(o.text); });
    });
    if (total > L.roomWords) note("reading-load", r, "text", `${R} · The whole room`, `This room asks students to read about ${Math.round(total / 10) * 10} words. That is a heavy load for students with dyslexia or who read slowly. Consider trimming the text or splitting the room.`);
  });
  return out;
}
export const A11Y_BY_HAND = [
  "Open the preview and read each room's story on its own. Would a student who can't see the picture know what to do?",
  "Use plain words and short sentences. Spell out abbreviations the first time.",
  "For typed answers, accept every fair spelling (with and without accents, initials, “the”).",
  "Card icons and emoji are decoration. Make sure nothing depends on recognising them.",
  "Hints should point to how to find the answer, in different words from the story.",
  "Tell students at the start that there is no time limit, and how to ask you for help."
];
export function a11yGroups(notes){
  const groups = new Map();
  notes.forEach(n => { const k = typeof n.page === "number" ? `Room ${n.page + 1}: ${S.cfg.rooms[n.page]?.title || "Untitled"}` : ({ settings: "Settings", intro: "Story & intro", finish: "Finish & grading" })[n.page]; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(n); });
  return groups;
}
