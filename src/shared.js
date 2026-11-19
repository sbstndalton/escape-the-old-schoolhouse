/* Shared logic for the escape-room game and the teacher editor.
 * Runs in browsers (inlined into both pages by scripts/build.js) and in Node (build + tests). */
const ER = (() => {
  // ---------- text ----------
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  // Plain text with **bold** and *italic*; everything else is escaped.
  const fmt = s => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>");
  const paras = (s, cls = "") => String(s ?? "").split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)
    .map(p => `<p${cls ? ` class="${cls}"` : ""}>${fmt(p).replace(/\n/g, "<br>")}</p>`).join("");
  // For comparing typed answers: case, accents, punctuation and extra spaces don't matter.
  // Letters that don't decompose into base letter + accent, so "Søren" matches "Soren".
  const FOLD = { "ø": "o", "æ": "ae", "œ": "oe", "ß": "ss", "ł": "l", "đ": "d", "ð": "d", "þ": "th", "ı": "i" };
  const norm = s => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[øæœßłđðþı]/g, c => FOLD[c]).replace(/['\u2018\u2019`]/g, "")   // "Plato's" = "Platos"
    .replace(/[^a-z0-9]+/g, " ").trim();
  const accepted = a => String(a ?? "").split("|").map(norm).filter(Boolean);

  // ---------- deterministic shuffle ----------
  const hash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const rng = seed => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  function scramble(n, seedText) {
    const idx = [...Array(n).keys()]; if (n < 2) return idx;
    const r = rng(hash(seedText));
    for (let tries = 0; tries < 20; tries++) {
      for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
      if (idx.some((v, i) => v !== i)) break;
    }
    return idx;
  }

  // ---------- matching rooms: which code is on each card, and what the lock wants ----------
  const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ", DIGITS = "123456789";
  function matching(room) {
    const cards = (room.cards || []).map((c, k) => ({ ...c, k }));
    const answerCards = cards.filter(c => String(c.clue || "").trim());
    const display = [...cards].sort((a, b) => String(a.term).localeCompare(String(b.term)));
    const numbers = room.codeStyle === "numbers";
    const code = {}; const used = new Set();
    cards.forEach(c => { const v = String(c.code || "").replace(/\s+/g, "").toUpperCase(); if (v) { code[c.k] = v; used.add(v); } });
    const word = String(room.codeWord || "").replace(/\s+/g, "").toUpperCase();
    if (!numbers && word && word.length === answerCards.length) {
      answerCards.forEach((c, i) => { if (!code[c.k]) { code[c.k] = word[i]; used.add(word[i]); } });
    }
    const pool = [...(numbers ? DIGITS : LETTERS)].filter(ch => !used.has(ch));
    display.forEach(c => { if (!code[c.k]) code[c.k] = pool.shift() || "?"; });
    return { cards, display, answerCards, numbers, code, answer: answerCards.map(c => code[c.k]).join("") };
  }

  // ---------- matching rooms: how the cards are drawn (presentation only, never graded) ----------
  // "cards" is the default and the fallback for anything unknown. Books need short names to fit on a
  // spine, so a room with a very long name falls back to plain cards instead of clipping text.
  const LOOKS = ["cards", "books", "portraits"];
  const plain = s => String(s == null ? "" : s).replace(/\*+/g, "").trim();
  function look(room) {
    const v = LOOKS.includes(room && room.look) ? room.look : "cards";
    if (v === "books" && (room.cards || []).some(c => plain(c.term).length > 48)) return "cards";
    return v;
  }
  // Initials for a portrait with no icon: "Jean-Jacques Rousseau" -> "JJR", "Maria de la Cruz" -> "MC".
  const PARTICLES = new Set(["de", "del", "della", "der", "di", "du", "la", "le", "of", "the", "van", "von", "and", "y"]);
  function initials(term) {
    const words = plain(term).split(/[\s\-\u2010-\u2015]+/).map(w => w.replace(/^[^\p{L}\p{N}]+/u, "")).filter(Boolean);
    const main = words.filter(w => !PARTICLES.has(w.toLowerCase()));
    return (main.length ? main : words).slice(0, 3).map(w => Array.from(w)[0].toUpperCase()).join("") || "?";
  }

  // ---------- answer key (teacher-only views: editor, preview, review sheet) ----------
  // Returns plain-text lines that may use **bold** (render with fmt).
  function answerKey(room) {
    const t = room.type;
    if (t === "matching") {
      const m = matching(room);
      const label = i => m.numbers ? String.fromCharCode(65 + i) : String(i + 1);
      return [`Lock combination: **${m.answer}**`, ...m.answerCards.map((c, i) => `Clue ${label(i)} → ${c.term} (code ${m.code[c.k]})`)];
    }
    if (t === "quiz") return (room.questions || []).map((q, i) => `${i + 1}. ${q.prompt}  →  **${q.kind === "choice"
      ? String((q.choices || [])[q.correct] ?? "?") : String(q.answers || "").split("|").map(a => a.trim()).filter(Boolean).join(" / ")}**`);
    if (t === "ordering") return (room.items || []).map((it, i) => `${i + 1}. ${it.text}${it.label ? ` (**${it.label}**)` : ""}`);
    if (t === "sorting") return (room.items || []).map(it => `${it.text}  →  **${(room.categories || [])[it.category] ?? "?"}**`);
    if (t === "reflection") return ["No wrong answers: any choices open the door. The most-chosen result is shown on the certificate."];
    return [];
  }

  // ---------- hints ----------
  const HINT_ROOMS = ["matching", "quiz", "ordering", "sorting"];        // rooms where a student can get it wrong
  const hintRules = cfg => ({ first: Math.max(0, +(cfg.hintRules?.first ?? 1)), second: Math.max(0, +(cfg.hintRules?.second ?? 3)) });
  // Hints that would hand over the answer instead of leading toward it.
  function hintWarnings(room) {
    const out = [];
    const hints = (room.hints || []).slice(0, 2);
    const has = (h, s) => { const a = norm(s); return a.length >= 3 && (" " + norm(h) + " ").includes(" " + a + " "); };
    hints.forEach((h, i) => {
      if (!String(h || "").trim()) return;
      const why = [];
      if (room.type === "matching") {
        const m = matching(room);
        if (m.answer.length >= 3 && has(h, m.answer)) why.push("it contains the lock combination");
        const named = m.answerCards.filter(c => has(h, c.term)).length;
        if (named >= 2) why.push(`it names ${named} of the answer cards`);
      }
      if (room.type === "quiz") {
        const given = (room.questions || []).filter(q => q.kind === "choice" ? has(h, (q.choices || [])[q.correct]) : accepted(q.answers).some(a => a.length >= 4 && has(h, a))).length;
        if (given) why.push(`it contains the answer to ${given} question${given > 1 ? "s" : ""}`);
      }
      if (room.type === "sorting") {
        const listed = (room.items || []).filter(it => norm(it.text).length > 12 && norm(h).includes(norm(it.text).slice(0, 25))).length;
        if (listed >= 2) why.push(`it quotes ${listed} of the items`);
      }
      if (room.type === "ordering") {
        const labels = (room.items || []).map(it => norm(it.label)).filter(l => l.length >= 2);
        if (labels.length >= 3 && labels.filter(l => (" " + norm(h) + " ").includes(" " + l + " ")).length >= 3) why.push("it lists most of the dates or labels");
      }
      if (why.length) out.push({ hint: i, message: `Hint ${i + 1} may give away the answer: ${why.join(" and ")}.` });
    });
    return out;
  }

  // ---------- review status ----------
  // Every fact a student is graded on, so the teacher can check each one.
  function reviewItems(cfg) {
    const out = [];
    (cfg.rooms || []).forEach((room, r) => {
      const add = (list, label) => (list || []).forEach((it, i) => out.push({ room: r, list: label, i, item: it }));
      if (room.type === "matching") add(room.cards, "cards");
      if (room.type === "quiz") add(room.questions, "questions");
      if (room.type === "ordering") add(room.items, "items");
      if (room.type === "sorting") add(room.items, "items");
      if (room.type === "reflection") { add(room.profiles, "profiles"); add(room.questions, "questions"); }
    });
    return out;
  }
  const reviewStatus = cfg => { const all = reviewItems(cfg); const done = all.filter(x => x.item.verified === true).length; return { total: all.length, verified: done, unverified: all.length - done }; };

  // ---------- validation (problems that would make a room unsolvable) ----------
  function validate(cfg) {
    const errs = [];
    if (!String(cfg.meta?.title || "").trim()) errs.push("Settings: the escape room needs a title.");
    if (!(cfg.rooms || []).length) errs.push("Add at least one room.");
    (cfg.rooms || []).forEach((room, r) => {
      const where = `Room ${r + 1} (${room.title || "untitled"})`;
      if (room.type === "matching") {
        const m = matching(room);
        if (!m.answerCards.length) errs.push(`${where}: at least one card needs a clue.`);
        if ((room.cards || []).some(c => !String(c.term || "").trim())) errs.push(`${where}: every card needs a name.`);
        if (m.answer.includes("?")) errs.push(`${where}: too many cards for ${m.numbers ? "number codes (max 9)" : "letter codes (max 26)"}.`);
        const word = String(room.codeWord || "").replace(/\s+/g, "");
        if (!m.numbers && word && word.length !== m.answerCards.length) errs.push(`${where}: the code word "${word}" has ${word.length} letters but there are ${m.answerCards.length} clues.`);
      }
      if (room.type === "quiz") {
        if (!(room.questions || []).length) errs.push(`${where}: add at least one question.`);
        (room.questions || []).forEach((q, i) => {
          if (!String(q.prompt || "").trim()) errs.push(`${where}, question ${i + 1}: the question is empty.`);
          if (q.kind === "choice") {
            const ch = (q.choices || []).filter(c => String(c).trim());
            if (ch.length < 2) errs.push(`${where}, question ${i + 1}: needs at least 2 choices.`);
            if (!(q.correct >= 0 && q.correct < (q.choices || []).length && String(q.choices[q.correct]).trim())) errs.push(`${where}, question ${i + 1}: mark which choice is correct.`);
          } else if (!accepted(q.answers).length) errs.push(`${where}, question ${i + 1}: needs at least one accepted answer.`);
        });
      }
      if (room.hintsEnabled && HINT_ROOMS.includes(room.type) && !(room.hints || []).slice(0, 2).some(x => String(x || "").trim()))
        errs.push(`${where}: hints are turned on, but no hint has been written.`);
      if (room.type === "ordering" && (room.items || []).length < 2) errs.push(`${where}: needs at least 2 items to put in order.`);
      if (room.type === "sorting") {
        const cats = (room.categories || []).filter(c => String(c).trim());
        if (cats.length < 2) errs.push(`${where}: needs at least 2 categories.`);
        if (!(room.items || []).length) errs.push(`${where}: add at least one item to sort.`);
        (room.items || []).forEach((it, i) => { if (!(it.category >= 0 && it.category < (room.categories || []).length)) errs.push(`${where}, item ${i + 1}: pick its correct category.`); });
      }
      if (room.type === "reflection") {
        const keys = new Set((room.profiles || []).map(p => p.key));
        if (!keys.size) errs.push(`${where}: add at least one result profile.`);
        (room.questions || []).forEach((q, i) => (q.options || []).forEach((o, j) => {
          if (!keys.has(o.profile)) errs.push(`${where}, question ${i + 1}, option ${j + 1}: pick which result it counts toward.`);
        }));
      }
    });
    return errs;
  }

  // ---------- packing content into the game file ----------
  const encodeConfig = cfg => { const bytes = new TextEncoder().encode(JSON.stringify(cfg)); let s = ""; for (const b of bytes) s += String.fromCharCode(b); return btoa(s); };
  const decodeConfig = b64 => JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(String(b64).trim()), c => c.charCodeAt(0))));
  // Placeholders are built by concatenation so this code never matches itself once inlined into the game.
  const P_TITLE = "__ESCAPE_" + "TITLE__", P_CONFIG = "__ESCAPE_" + "CONFIG__";
  const buildGame = (template, cfg) => template.split(P_TITLE).join(esc(cfg.meta?.title || "Escape Room")).split(P_CONFIG).join(encodeConfig(cfg));
  // Pull the content back out of an exported game file (so a teacher can reopen and edit it).
  function configFromHtml(html) {
    const m = String(html).match(/<script id="escape-config" type="text\/plain">([\s\S]*?)<\/script>/);
    if (!m) throw new Error("This file isn't an escape room made with this editor.");
    return decodeConfig(m[1]);
  }

  // ---------- zip (stored, no compression) for SCORM packages ----------
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = d => { let c = 0xFFFFFFFF; for (let i = 0; i < d.length; i++) c = CRC[(c ^ d[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  function zip(files, date = new Date()) {
    const enc = new TextEncoder();
    const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
    const dosDate = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
    const parts = [], central = []; let offset = 0;
    for (const f of files) {
      const name = enc.encode(f.name), data = typeof f.data === "string" ? enc.encode(f.data) : f.data, crc = crc32(data);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(10, dosTime, true); h.setUint16(12, dosDate, true); h.setUint32(14, crc, true);
      h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
      parts.push(new Uint8Array(h.buffer), name, data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
      c.setUint16(12, dosTime, true); c.setUint16(14, dosDate, true); c.setUint32(16, crc, true);
      c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true);
      c.setUint32(42, offset, true);
      central.push(new Uint8Array(c.buffer), name);
      offset += 30 + name.length + data.length;
    }
    const cdSize = central.reduce((s, p) => s + p.length, 0);
    const e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
    e.setUint32(12, cdSize, true); e.setUint32(16, offset, true);
    const all = [...parts, ...central, new Uint8Array(e.buffer)];
    const out = new Uint8Array(all.reduce((s, p) => s + p.length, 0)); let p = 0;
    for (const a of all) { out.set(a, p); p += a.length; }
    return out;
  }
  const xml = s => esc(s);
  function manifest(title) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="EscapeRoom_${hash(title)}" version="1.0"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd http://www.imsglobal.org/xsd/imsmd_rootv1p2p1 imsmd_rootv1p2p1.xsd http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata><schema>ADL SCORM</schema><schemaversion>1.2</schemaversion></metadata>
  <organizations default="ORG1">
    <organization identifier="ORG1">
      <title>${xml(title)}</title>
      <item identifier="ITEM1" identifierref="RES1"><title>${xml(title)}</title></item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="RES1" type="webcontent" adlcp:scormtype="sco" href="index.html"><file href="index.html"/></resource>
  </resources>
</manifest>
`;
  }
  const scorm = (gameHtml, title, date) => zip([{ name: "imsmanifest.xml", data: manifest(title) }, { name: "index.html", data: gameHtml }], date);
  const fileSlug = s => String(s || "escape-room").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || "escape-room";

  return { esc, fmt, paras, norm, accepted, hash, scramble, matching, LOOKS, look, initials, answerKey, HINT_ROOMS, hintRules, hintWarnings, reviewItems, reviewStatus, validate,
    encodeConfig, decodeConfig, buildGame, configFromHtml, zip, crc32, manifest, scorm, fileSlug };
})();
/* ---------- accessibility helpers (ER.a11y…) ----------
 * a11yHow(room): one plain sentence on how to work the room's lock (shown under the lock in the game).
 * a11yDescribe(room, state): the "Describe this room" text: everything in the room, in reading order,
 *   as sections { h, text: [paragraphs], list: [items], ordered }. Strings may use **bold** (render with ER.fmt).
 *   `state` is optional live state from the game: { order: [item indexes as placed], picks: [category index or null] }.
 * a11yCheck(cfg): advisory, plain-language notes for teachers about content that may be hard for some students.
 *   Returns [{ room (index, or -1 for the whole game), message }]. It never blocks anything. */
ER.a11yHow = room => {
  const t = room && room.type;
  if (t === "matching") return "Set each dial with its up and down arrows or the arrow keys, or type the code in the box. Then pull the shackle.";
  if (t === "quiz") return "Answer every question, then turn the handle to check.";
  if (t === "ordering") return "Use each card's up and down buttons to put the cards in order, then turn the handle to check.";
  if (t === "sorting") return "Stamp every slip with one of the stamps, then turn the handle to check.";
  if (t === "reflection") return "Choose the answer closest to your view for each question. There are no wrong answers.";
  return "";
};
ER.a11yDescribe = (room, state = {}) => {
  const out = [], t = room.type, s = v => String(v == null ? "" : v).trim();
  if (s(room.story)) out.push({ h: "The note", text: s(room.story).split(/\n\s*\n/).map(x => x.trim()).filter(Boolean).concat(s(room.reference) ? [s(room.reference)] : []) });
  if (t === "matching") {
    const m = ER.matching(room), look = ER.look(room), label = i => m.numbers ? String.fromCharCode(65 + i) : String(i + 1);
    const what = look === "books" ? "books on the shelf" : look === "portraits" ? "portraits on the wall" : "cards in the drawer";
    out.push({ h: `${m.display.length} ${what}`, text: [`Each one carries a code ${m.numbers ? "number" : "letter"}.`],
      list: m.display.map(c => `Code **${m.code[c.k]}**: ${s(c.term)}${s(c.detail) ? ` (${s(c.detail)})` : ""}`) });
    out.push({ h: s(room.cluesHeading) || "Clues", text: ["Each clue describes one of them. Take the clues in order: their codes, in that order, open the lock."],
      list: m.answerCards.map((c, i) => `Clue ${label(i)}: ${s(c.clue)}`) });
    out.push({ h: "The lock", text: [`A combination padlock with ${m.answer.length} dials, one for each ${m.numbers ? "number" : "letter"} of the code.`, ER.a11yHow(room)] });
  } else if (t === "quiz") {
    out.push({ h: `${(room.questions || []).length} questions`, ordered: true, list: (room.questions || []).map(q => s(q.prompt) + (q.kind === "choice"
      ? " Choices: " + (q.choices || []).filter(c => s(c)).map(s).join("; ") + "." : " Type a short answer.")) });
    out.push({ h: "The lock", text: ["A strongbox with a handle. After each try, a counter shows how many answers were right.", ER.a11yHow(room)] });
  } else if (t === "ordering") {
    const items = room.items || [], order = state.order || ER.scramble(items.length, (room.title || "") + items.map(i => i.text).join("|"));
    out.push({ h: `${items.length} cards on the timeline, as they are placed now`, ordered: true, list: order.map(i => s(items[i] && items[i].text)) });
    out.push({ h: "The lock", text: ["A handle with a counter. After each try, it shows how many cards are in the right place.", ER.a11yHow(room)] });
  } else if (t === "sorting") {
    const cats = (room.categories || []).map(s), picks = state.picks || [];
    out.push({ h: `${cats.length} stamps`, list: cats });
    out.push({ h: `${(room.items || []).length} slips to stamp`, ordered: true, list: (room.items || []).map((it, i) => s(it.text) + (picks[i] != null ? ` (stamped **${cats[picks[i]]}**)` : " (not stamped yet)")) });
    out.push({ h: "The lock", text: ["A handle with a counter. After each try, it shows how many slips were stamped correctly.", ER.a11yHow(room)] });
  } else if (t === "reflection") {
    out.push({ h: `${(room.questions || []).length} questions, one at a time`, ordered: true, list: (room.questions || []).map(q => s(q.prompt) + " Options: " + (q.options || []).map(o => s(o.text)).join("; ") + ".") });
    out.push({ h: "How it works", text: [ER.a11yHow(room), "Your most-chosen view is shown on the certificate."] });
  }
  return out;
};
ER.a11yCheck = cfg => {
  const out = [], add = (room, message) => out.push({ room, message }), s = v => String(v == null ? "" : v).trim();
  const SENSE = /\b(red|green|blue|yellow|orange|purple|pink|brown|grey|gray|left|right|above|below|top|bottom|round|square|corner)\b/i;
  let PIC; try { PIC = new RegExp("^[\\p{Extended_Pictographic}\\uFE0F\\u200D\\s]+$", "u"); } catch (e) { PIC = /^[☀-➿\uD83C-🠀-\uDFFF️\s]+$/; }
  if (!s(cfg.intro && cfg.intro.story)) add(-1, "The opening page has no story. A sentence or two tells students what to expect.");
  (cfg.rooms || []).forEach((room, r) => {
    const texts = [];
    if (!s(room.story)) add(r, "This room has no story or instructions. Students who can't take in the picture rely on that text.");
    if (room.type === "matching") {
      const m = ER.matching(room);
      if (m.answer.length > 8) add(r, `The lock code has ${m.answer.length} characters. More than 8 dials is slow with a keyboard, a switch or a screen reader.`);
      (room.cards || []).forEach(c => { texts.push(c.clue, c.term);
        if (s(c.clue).length > 300) add(r, `The clue for "${s(c.term)}" is long (${s(c.clue).length} characters). Shorter clues are easier to read and remember.`);
        if (PIC.test(s(c.term))) add(r, "A card is named with a picture only. A picture alone can't be read aloud; add a name in words."); });
    }
    if (room.type === "quiz") (room.questions || []).forEach((q, i) => { texts.push(q.prompt);
      if (q.kind !== "choice" && ER.accepted(q.answers).length < 2) add(r, `Question ${i + 1} accepts only one typed answer. Add other spellings or forms (separated by |) so a small typing difference isn't marked wrong.`); });
    if (room.type === "ordering" || room.type === "sorting") (room.items || []).forEach(it => texts.push(it.text));
    if (room.type === "ordering" && (room.items || []).length > 9) add(r, `There are ${(room.items || []).length} cards to put in order. More than 9 takes many moves without a mouse.`);
    texts.push(room.story, ...(room.hints || []));
    const hit = texts.map(s).map(x => (x.match(SENSE) || [])[0]).filter(Boolean)[0];
    if (hit) add(r, `Some text uses the word "${hit}". Check that it doesn't point to something by its colour, shape or place alone.`);
    const long = texts.map(s).reduce((a, x) => a + x.length, 0);
    if (long > 2500) add(r, `This room has a lot of reading (about ${Math.round(long / 5)} words). Consider splitting it into two rooms.`);
  });
  return out;
};
if (typeof module !== "undefined") module.exports = ER;
