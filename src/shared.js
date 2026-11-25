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

  // ---------- cipher rooms: a Caesar cipher (every letter moved the same number of places along the alphabet) ----------
  // The teacher writes each secret message in plain words; the game shows it in code (moved `shift` places) and
  // the student turns a cipher wheel until it reads again. Only A-Z and a-z move; accented letters, digits and
  // punctuation stay as they are, so a message always decodes back to exactly what the teacher wrote.
  const cipherShift = room => { const n = Math.round(Number(room && room.shift)); return n >= 1 && n <= 25 ? n : 3; };
  function caesar(text, by) {
    const k = ((Math.round(Number(by) || 0) % 26) + 26) % 26;
    return String(text ?? "").replace(/[A-Za-z]/g, ch => { const base = ch <= "Z" ? 65 : 97; return String.fromCharCode(base + (ch.charCodeAt(0) - base + k) % 26); });
  }
  const hasLetters = s => /[A-Za-z]/.test(String(s ?? ""));

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
    if (t === "cipher") return [`Cipher wheel: turn it **${cipherShift(room)}** places to read the messages.`,
      ...(room.messages || []).map((m, i) => `${i + 1}. ${m.text}  →  **${String(m.answers || "").split("|").map(a => a.trim()).filter(Boolean).join(" / ")}**`)];
    return [];
  }

  // ---------- hints ----------
  const HINT_ROOMS = ["matching", "quiz", "ordering", "sorting", "cipher"];        // rooms where a student can get it wrong
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
      if (room.type === "cipher") {
        const given = (room.messages || []).filter(m => accepted(m.answers).some(a => a.length >= 4 && has(h, a))).length;
        if (given) why.push(`it contains the answer to ${given} message${given > 1 ? "s" : ""}`);
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
      if (room.type === "cipher") add(room.messages, "messages");
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
      if (room.type === "cipher") {
        if (!(room.messages || []).length) errs.push(`${where}: add at least one secret message.`);
        (room.messages || []).forEach((m, i) => {
          if (!String(m.text || "").trim()) errs.push(`${where}, message ${i + 1}: the message is empty.`);
          else if (!hasLetters(m.text)) errs.push(`${where}, message ${i + 1}: the message needs some letters (A to Z) to put in code.`);
          if (!accepted(m.answers).length) errs.push(`${where}, message ${i + 1}: needs at least one accepted answer.`);
        });
        const sh = room.shift;
        if (sh !== undefined && sh !== null && String(sh).trim() !== "" && !(Number.isInteger(Number(sh)) && Number(sh) >= 1 && Number(sh) <= 25))
          errs.push(`${where}: the wheel setting must be a whole number from 1 to 25.`);
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
  // `home` is the front page the game links back to when a class link is broken: set for the website's play.html
  // only. Exported files (the .html download, SCORM) leave it empty, because they have no front page beside them.
  const P_TITLE = "__ESCAPE_" + "TITLE__", P_CONFIG = "__ESCAPE_" + "CONFIG__", P_HOME = "__ESCAPE_" + "HOME__";
  const buildGame = (template, cfg, { home = "" } = {}) => template.split(P_TITLE).join(esc(cfg.meta?.title || "Escape Room"))
    .split(P_HOME).join(esc(home)).split(P_CONFIG).join(encodeConfig(cfg));
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

  return { esc, fmt, paras, norm, accepted, hash, scramble, matching, cipherShift, caesar, LOOKS, look, initials, answerKey, HINT_ROOMS, hintRules, hintWarnings, reviewItems, reviewStatus, validate,
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
  // Each sentence names the real control (its button text) as well as the picture of it, and says what to do in order.
  if (t === "matching") {
    const m = ER.matching(room), look = ER.look(room), things = look === "books" ? "books" : look === "portraits" ? "portraits" : "cards";
    const decoys = m.display.length > m.answerCards.length ? ` Some ${things} are decoys that no clue describes.` : "";
    return `Each clue describes one of the ${things}. Take the clues in order: the codes of the ${things} they describe, in that order, open the lock.${decoys}`
      + ` Set each dial with its up and down arrows or the arrow keys, or type the whole code in the box. Then press “Pull the shackle” to try it.`;
  }
  if (t === "quiz") return "Answer every question, then press “Check answers” (the handle) to try the lock.";
  if (t === "ordering") return "Put the cards in order with each card's Move up and Move down buttons, then press “Check order” (the handle) to try the lock.";
  if (t === "sorting") return "Stamp every slip: press one of the boxes on the slip, or pick the slip up and press a rubber stamp. Then press “Submit” (the handle) to try the lock.";
  if (t === "cipher") return "The messages are in code. Turn the cipher wheel with its “Turn back” and “Turn forward” buttons, or the arrow keys, until the messages read as plain words; the line under each message shows what it says now. Type the answer each message points to, then press “Check answers” (the handle) to try the lock.";
  if (t === "reflection") {
    let last = String((room && room.buttonLabel) || "");
    try { last = last.replace(new RegExp("[\\p{Extended_Pictographic}\\uFE0F\\u200D]", "gu"), ""); } catch (e) {}
    return `Choose the answer closest to your view for each question and press “Next question”; on the last question, press “${last.trim() || "Continue"}”. There are no wrong answers.`;
  }
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
  } else if (t === "cipher") {
    const msgs = room.messages || [], shift = ER.cipherShift(room), turn = state.turn;
    out.push({ h: `${msgs.length} secret message${msgs.length === 1 ? "" : "s"}, in code`, ordered: true, list: msgs.map(m => ER.caesar(s(m.text), shift)) });
    out.push({ h: "The cipher wheel", text: ["A wheel with two rings of letters, A to Z. Turning it moves every letter of the messages along the alphabet. At the right setting the messages read as plain words."]
      .concat(turn != null ? [`It is turned ${turn} place${turn === 1 ? "" : "s"} now, and the messages read:`] : []),
      list: turn != null ? msgs.map(m => ER.caesar(ER.caesar(s(m.text), shift), -turn)) : undefined, ordered: turn != null });
    out.push({ h: "The lock", text: [`A strongbox with a handle and ${msgs.length === 1 ? "an answer line" : "an answer line for each message"}. After each try, a counter shows how many answers were right.`, ER.a11yHow(room)] });
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
    if (room.type === "cipher") (room.messages || []).forEach((m, i) => { texts.push(m.text);
      if (ER.accepted(m.answers).length < 2) add(r, `Message ${i + 1} accepts only one typed answer. Add other spellings or forms (separated by |) so a small typing difference isn't marked wrong.`);
      if (s(m.text).length > 200) add(r, `Message ${i + 1} is long (${s(m.text).length} characters). Coded text is hard work to read; one short sentence is kinder.`); });
    if (room.type === "ordering" && (room.items || []).length > 9) add(r, `There are ${(room.items || []).length} cards to put in order. More than 9 takes many moves without a mouse.`);
    texts.push(room.story, ...(room.hints || []));
    const hit = texts.map(s).map(x => (x.match(SENSE) || [])[0]).filter(Boolean)[0];
    if (hit) add(r, `Some text uses the word "${hit}". Check that it doesn't point to something by its colour, shape or place alone.`);
    const long = texts.map(s).reduce((a, x) => a + x.length, 0);
    if (long > 2500) add(r, `This room has a lot of reading (about ${Math.round(long / 5)} words). Consider splitting it into two rooms.`);
  });
  return out;
};
/* ---------- class links (ER.toLink, ER.fromLink, ER.cleanConfig) ----------
 * A class link is the play page's address with the whole escape room packed into its fragment:
 *   play.html#play=1.<data>
 * "1" is the format version (so the format can change later); <data> is the content as JSON, compressed with
 * deflate-raw and written in base64url (A-Z a-z 0-9 - _), which survives email, Moodle and Canvas unchanged.
 * The part after # is never sent to a web server: the escape room travels only inside the link.
 * Anyone can make a link, so what comes out of one is UNTRUSTED. fromLink() limits its size (also after
 * decompression), cleans it with cleanConfig() (only the shapes the game knows; keys starting with "__", such as
 * __preview, are dropped) and checks it with validate(). The game escapes every text it draws.
 * Works in browsers and in Node 18+ (CompressionStream). Without CompressionStream, toLink() writes uncompressed
 * ("stored") deflate blocks, which every reader understands; fromLink() can read those without it, and says
 * plainly that the browser is too old for anything else. */
(() => {
  const VERSION = "1", MAX_CHARS = 2000000, MAX_BYTES = 4 * 1024 * 1024;
  const WORDS = {
    "not-link": "That doesn't look like a class link. A class link is a long web address with “#play=” in it. Ask your teacher to send it again.",
    incomplete: "This class link is incomplete. Ask your teacher to send it again.",
    newer: "This class link was made with a newer version of the escape room maker. Ask your teacher to send it again.",
    "old-browser": "This browser is too old to open class links. Try an up-to-date Chrome, Edge, Firefox or Safari, or ask your teacher for the escape room as a file.",
    "too-big": "This class link is too long to open. Ask your teacher for the escape room as a file instead.",
    invalid: "This class link doesn't hold a working escape room. Ask your teacher to send it again."
  };
  const fail = (kind, detail) => { const e = new Error(WORDS[kind]); e.kind = kind; if (detail) e.detail = detail; return e; };
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_", IDX = {};
  for (let i = 0; i < 64; i++) IDX[A[i]] = i;
  function b64u(bytes){
    let s = "";
    for (let i = 0; i < bytes.length; i += 3) {
      const k = bytes.length - i, n = (bytes[i] << 16) | ((k > 1 ? bytes[i + 1] : 0) << 8) | (k > 2 ? bytes[i + 2] : 0);
      s += A[n >> 18 & 63] + A[n >> 12 & 63] + (k > 1 ? A[n >> 6 & 63] : "") + (k > 2 ? A[n & 63] : "");
    }
    return s;
  }
  function unb64u(s){
    const out = new Uint8Array(Math.floor(s.length * 3 / 4)); let o = 0, acc = 0, bits = 0;
    for (let i = 0; i < s.length; i++) { const v = IDX[s[i]]; if (v === undefined) throw fail("incomplete");
      acc = ((acc << 6) | v) & 0xFFFFFF; bits += 6; if (bits >= 8) { bits -= 8; out[o++] = (acc >> bits) & 255; } }
    return out.subarray(0, o);
  }
  async function through(bytes, stream, limit){
    const reader = new Blob([bytes]).stream().pipeThrough(stream).getReader(), parts = []; let n = 0;
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      n += value.length;
      if (n > limit) { try { await reader.cancel(); } catch (e) {} throw fail("too-big"); }
      parts.push(value);
    }
    const out = new Uint8Array(n); let p = 0; for (const a of parts) { out.set(a, p); p += a.length; }
    return out;
  }
  const make = (C, kind) => { try { return typeof C === "function" ? new C(kind) : null; } catch (e) { return null; } };
  // Uncompressed deflate blocks: a valid deflate-raw stream that needs no compressor to write or read.
  function stored(bytes){
    const n = Math.max(1, Math.ceil(bytes.length / 65535)), out = new Uint8Array(bytes.length + n * 5); let p = 0;
    for (let b = 0; b < n; b++) { const part = bytes.subarray(b * 65535, (b + 1) * 65535), len = part.length;
      out[p++] = b === n - 1 ? 1 : 0; out[p++] = len & 255; out[p++] = len >> 8; out[p++] = ~len & 255; out[p++] = (~len >> 8) & 255; out.set(part, p); p += len; }
    return out;
  }
  function unstored(bytes){
    const parts = []; let p = 0, n = 0;
    for (;;) {
      if (p + 5 > bytes.length) throw fail("incomplete");
      const head = bytes[p]; if (head & 6) throw fail("old-browser");      // a compressed block: this browser can't read it
      const len = bytes[p + 1] | (bytes[p + 2] << 8); p += 5;
      if (p + len > bytes.length) throw fail("incomplete");
      parts.push(bytes.subarray(p, p + len)); p += len; n += len; if (n > MAX_BYTES) throw fail("too-big");
      if (head & 1) break;
    }
    const out = new Uint8Array(n); let q = 0; for (const a of parts) { out.set(a, q); q += a.length; }
    return out;
  }
  /* The link's code from anything a person pastes: the whole address, the part from #play=, or the code alone.
     Punctuation around it (a full stop at the end of a sentence, angle brackets from an email) is ignored. */
  function linkCode(text){
    let s = String(text == null ? "" : text).trim();
    try { if (/%2e|%3d/i.test(s)) s = decodeURIComponent(s); } catch (e) {}
    const m = s.match(/[#&?]play=(\d*)(?:\.([A-Za-z0-9_-]*))?/) || s.match(/^(\d+)\.([A-Za-z0-9_-]{8,})/);
    return m ? { version: m[1], data: m[2] || "" } : null;
  }
  const hasLink = text => !!linkCode(text);
  async function toLink(cfg, base = ""){
    const json = JSON.stringify(cfg, (k, v) => (k.startsWith("__") ? undefined : v));
    const bytes = new TextEncoder().encode(json), cs = make(typeof CompressionStream !== "undefined" ? CompressionStream : null, "deflate-raw");
    const packed = cs ? await through(bytes, cs, Infinity) : stored(bytes);
    return String(base).split("#")[0] + "#play=" + VERSION + "." + b64u(packed);
  }
  async function fromLink(text){
    if (String(text == null ? "" : text).length > MAX_CHARS) throw fail("too-big");
    const c = linkCode(text); if (!c) throw fail("not-link");
    if (c.version !== VERSION) throw fail(c.version && +c.version > +VERSION ? "newer" : "incomplete");
    if (c.data.length < 8) throw fail("incomplete");
    const bytes = unb64u(c.data);
    const ds = make(typeof DecompressionStream !== "undefined" ? DecompressionStream : null, "deflate-raw");
    let raw;
    if (ds) { try { raw = await through(bytes, ds, MAX_BYTES); } catch (e) { throw e.kind ? e : fail("incomplete"); } }
    else raw = unstored(bytes);
    let data;
    try { data = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw)); } catch (e) { throw fail("incomplete"); }
    const cfg = ER.cleanConfig(data), errs = ER.validate(cfg);
    if (errs.length) throw fail("invalid", errs);
    return cfg;
  }
  /* Only the shapes the game knows survive: these lists of objects, lists of texts and groups; known numbers become
     numbers; every other value must be plain text, a number, true/false or null (anything else is dropped). Keys
     that start with "__" (such as the editor's __preview), "constructor" and "prototype" are dropped. Sizes are
     capped, and nothing is nested deeper than the format goes. A valid escape room comes out unchanged. */
  const LISTS = new Set(["rooms", "cards", "questions", "items", "profiles", "options", "messages"]);
  const TEXTS = new Set(["hints", "categories", "choices"]);
  const GROUPS = new Set(["meta", "intro", "scoring", "finish", "hintRules"]);
  const NUMBERS = new Set(["correct", "category", "hintPenalty", "wrongPenalty", "minScore", "first", "second", "schema", "shift"]);
  const MAX_TEXT = 50000, MAX_LIST = 500;
  function cleanConfig(input){
    if (!input || typeof input !== "object" || Array.isArray(input)) throw fail("invalid", ["This isn't an escape room."]);
    let budget = 100000;
    const text = v => typeof v === "string" ? v.slice(0, MAX_TEXT) : typeof v === "number" && isFinite(v) ? String(v) : "";
    const obj = (o, depth) => {
      const out = {};
      if (!o || typeof o !== "object" || Array.isArray(o) || depth > 6) return out;
      if (--budget < 0) throw fail("too-big");
      for (const k of Object.keys(o).slice(0, 200)) {
        if (/^__|^(constructor|prototype)$/.test(k)) continue;
        const v = o[k];
        if (LISTS.has(k)) out[k] = Array.isArray(v) ? v.slice(0, MAX_LIST).filter(x => x && typeof x === "object" && !Array.isArray(x)).map(x => obj(x, depth + 1)) : [];
        else if (TEXTS.has(k)) out[k] = Array.isArray(v) ? v.slice(0, MAX_LIST).map(text) : [];
        else if (GROUPS.has(k)) out[k] = obj(v, depth + 1);
        else if (NUMBERS.has(k)) { const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN; if (isFinite(n)) out[k] = n; }
        else if (typeof v === "string") out[k] = v.slice(0, MAX_TEXT);
        else if ((typeof v === "number" && isFinite(v)) || typeof v === "boolean" || v === null) out[k] = v;
      }
      return out;
    };
    const cfg = obj(input, 0);
    if (!Array.isArray(cfg.rooms)) cfg.rooms = [];
    return cfg;
  }
  Object.assign(ER, { toLink, fromLink, cleanConfig, linkCode, hasLink, LINK_WORDS: WORDS, LINK_LONG: 30000,
    SITE: "https://sbstndalton.github.io/escape-the-old-schoolhouse/" });
})();
/* ---------- QR codes (ER.qr, ER.qrSvg) ----------
 * A small QR Code encoder (byte mode, error correction level L or M, versions 1 to 40), so a short class link can
 * be shown as a QR code with nothing downloaded. It follows the structure of Project Nayuki's "QR Code generator
 * library" (Copyright (c) Project Nayuki, MIT License, https://www.nayuki.io/page/qr-code-generator-library):
 *   Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
 *   documentation files (the "Software"), to deal in the Software without restriction, including without limitation
 *   the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and
 *   to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above
 *   copyright notice and this permission notice shall be included in all copies or substantial portions of the
 *   Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED.
 * ER.qr(text, { ecl, maxVersion }) returns { size, version, dark(x, y) }, or null when the text doesn't fit. */
ER.qr = (() => {
  const ECC = { L: [7,10,15,20,26,18,20,24,30,18,20,24,26,30,22,24,28,30,28,28,28,28,30,30,26,28,30,30,30,30,30,30,30,30,30,30,30,30,30,30],
    M: [10,16,26,18,24,16,18,22,22,26,30,22,22,24,24,28,28,26,26,26,26,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28] };
  const BLOCKS = { L: [1,1,1,1,1,2,2,2,2,4,4,4,4,4,6,6,6,6,7,8,8,9,9,10,12,12,12,13,14,15,16,17,18,19,19,20,21,22,24,25],
    M: [1,1,1,2,2,4,4,4,5,5,5,8,9,9,10,10,11,13,14,16,17,17,18,20,21,23,25,26,28,29,31,33,35,37,38,40,43,45,47,49] };
  const FORMAT = { L: 1, M: 0 };
  const bit = (x, i) => ((x >>> i) & 1) !== 0;
  const rawModules = v => { let r = (16 * v + 128) * v + 64; if (v >= 2) { const n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; } return r; };
  const dataCodewords = (v, e) => Math.floor(rawModules(v) / 8) - ECC[e][v - 1] * BLOCKS[e][v - 1];
  const mul = (x, y) => { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z; };
  function divisor(deg){ const r = new Array(deg).fill(0); r[deg - 1] = 1; let root = 1;
    for (let i = 0; i < deg; i++) { for (let j = 0; j < deg; j++) { r[j] = mul(r[j], root); if (j + 1 < deg) r[j] ^= r[j + 1]; } root = mul(root, 2); } return r; }
  function remainder(data, div){ const r = div.map(() => 0);
    for (const b of data) { const f = b ^ r.shift(); r.push(0); div.forEach((c, i) => { r[i] ^= mul(c, f); }); } return r; }
  return (text, { ecl = "L", maxVersion = 40 } = {}) => {
    const bytes = Array.from(new TextEncoder().encode(String(text)));
    let v = 1; for (; v <= maxVersion; v++) if (4 + (v < 10 ? 8 : 16) + 8 * bytes.length <= dataCodewords(v, ecl) * 8) break;
    if (v > maxVersion) return null;
    // the data bits: byte mode, the count, the bytes, a terminator, then padding
    const bits = [], put = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    put(4, 4); put(bytes.length, v < 10 ? 8 : 16); bytes.forEach(b => put(b, 8));
    const cap = dataCodewords(v, ecl) * 8;
    put(0, Math.min(4, cap - bits.length)); put(0, (8 - bits.length % 8) % 8);
    for (let p = 0xEC; bits.length < cap; p ^= 0xEC ^ 0x11) put(p, 8);
    const data = []; for (let i = 0; i < bits.length; i += 8) { let b = 0; for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j]; data.push(b); }
    // error correction, block by block, then interleaved
    const nb = BLOCKS[ecl][v - 1], el = ECC[ecl][v - 1], raw = Math.floor(rawModules(v) / 8), short = nb - raw % nb, slen = Math.floor(raw / nb), div = divisor(el), blocks = [];
    for (let i = 0, k = 0; i < nb; i++) { const d = data.slice(k, k + slen - el + (i < short ? 0 : 1)); k += d.length; const ec = remainder(d, div); if (i < short) d.push(0); blocks.push(d.concat(ec)); }
    const words = []; for (let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => { if (i !== slen - el || j >= short) words.push(b[i]); });
    // the grid
    const size = v * 4 + 17, mod = [], fn = [];
    for (let y = 0; y < size; y++) { mod.push(new Array(size).fill(false)); fn.push(new Array(size).fill(false)); }
    const set = (x, y, d) => { mod[y][x] = d; fn[y][x] = true; };
    for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    const finder = (cx, cy) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const x = cx + dx, y = cy + dy, d = Math.max(Math.abs(dx), Math.abs(dy));
      if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4); } };
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    if (v > 1) { const n = Math.floor(v / 7) + 2, step = Math.floor((v * 8 + n * 3 + 5) / (n * 4 - 4)) * 2, pos = [6];
      for (let p = size - 7; pos.length < n; p -= step) pos.splice(1, 0, p);
      pos.forEach((a, i) => pos.forEach((b, j) => { if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) return;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(a + dx, b + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1); })); }
    const format = mask => { const d = FORMAT[ecl] << 3 | mask; let r = d; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
      const b = (d << 10 | r) ^ 0x5412;
      for (let i = 0; i <= 5; i++) set(8, i, bit(b, i));
      set(8, 7, bit(b, 6)); set(8, 8, bit(b, 7)); set(7, 8, bit(b, 8));
      for (let i = 9; i < 15; i++) set(14 - i, 8, bit(b, i));
      for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(b, i));
      for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(b, i));
      set(8, size - 8, true); };
    format(0);
    if (v >= 7) { let r = v; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1F25); const b = v << 12 | r;
      for (let i = 0; i < 18; i++) { const a = size - 11 + i % 3, c = Math.floor(i / 3); set(a, c, bit(b, i)); set(c, a, bit(b, i)); } }
    let i = 0;
    for (let right = size - 1; right >= 1; right -= 2) { if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) { const x = right - j, y = ((right + 1) & 2) === 0 ? size - 1 - vert : vert;
        if (!fn[y][x] && i < words.length * 8) { mod[y][x] = bit(words[i >>> 3], 7 - (i & 7)); i++; } } }
    // pick the mask that scores best (long runs, 2x2 blocks, finder look-alikes, and the balance of dark and light)
    const MASKS = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, x => x % 3 === 0, (x, y) => (x + y) % 3 === 0, (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
      (x, y) => x * y % 2 + x * y % 3 === 0, (x, y) => (x * y % 2 + x * y % 3) % 2 === 0, (x, y) => ((x + y) % 2 + x * y % 3) % 2 === 0];
    const flip = m => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && MASKS[m](x, y)) mod[y][x] = !mod[y][x]; };
    const score = () => { let s = 0, dark = 0;
      const lines = []; for (let y = 0; y < size; y++) { lines.push(mod[y].map(d => d ? 1 : 0).join("")); lines.push(mod.map(r => r[y] ? 1 : 0).join("")); }
      for (const l of lines) { for (const run of l.match(/0+|1+/g)) if (run.length >= 5) s += run.length - 2;
        s += 40 * ((l.match(/(?=10111010000|00001011101)/g) || []).length); }
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { if (mod[y][x]) dark++;
        if (x < size - 1 && y < size - 1 && mod[y][x] === mod[y][x + 1] && mod[y][x] === mod[y + 1][x] && mod[y][x] === mod[y + 1][x + 1]) s += 3; }
      return s + 10 * Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)); };
    let best = 0, low = Infinity;
    for (let m = 0; m < 8; m++) { flip(m); format(m); const s = score(); if (s < low) { low = s; best = m; } flip(m); }
    flip(best); format(best);
    return { size, version: v, dark: (x, y) => x >= 0 && y >= 0 && x < size && y < size && mod[y][x] };
  };
})();
/* An SVG picture of a QR code: dark squares on white with the usual quiet border of 4 modules. */
ER.qrSvg = (text, { label = "QR code" } = {}) => {
  const q = ER.qr(text); if (!q) return "";
  let d = "";        // one path, a rectangle per run of dark squares in a row
  for (let y = 0; y < q.size; y++) for (let x = 0; x < q.size; x++) { if (!q.dark(x, y)) continue; let n = 1; while (q.dark(x + n, y)) n++; d += `M${x + 4} ${y + 4}h${n}v1h-${n}z`; x += n - 1; }
  const n = q.size + 8;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" role="img" aria-label="${ER.esc(label)}" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
};
/* ---------- the first-visit accessibility prompt (ER.a11yAsk…) ----------
 * One dialog, used by the front page, the game's title screen and the maker's Welcome step: "Before you start: make
 * it easier to use?" with big switches for the settings all three share (the same localStorage keys), "Continue"
 * and "Continue without changes". It is asked once per browser: escape-room-a11y-asked, shared by all three pages.
 * Each switch applies at once (the page's set() hook), so the change shows behind the dialog. "Continue without
 * changes" and Esc put back what the person had when it opened. Every page also has a visible "Accessibility
 * options" control that opens it again. Only the dialog's own markup, CSS and keyboard handling live here; the page
 * says how to read and apply each setting. */
ER.A11Y_ASKED = "escape-room-a11y-asked";
ER.A11Y_OPTIONS = [
  { id: "readable", key: "escape-room-readable", label: "Readable text", line: "Bigger, clearer letters, with more space between lines and words." },
  { id: "contrast", key: "escape-room-contrast", label: "High contrast", line: "Solid backgrounds and strong black-and-white text, with no textures or lamplight." },
  { id: "motion", key: "escape-room-motion", label: "Motion", line: "Doors swing, dials slide and stamps thump in the game. Off: everything stays still.", game: true },
  { id: "sound", key: "escape-room-sound", label: "Sound", line: "Small sound effects in the game. Every sound also comes with words on screen.", game: true },
  { id: "read", key: "escape-room-read", label: "Listen buttons (read aloud)", line: "A Listen button on each paper in the game reads it aloud with a voice on this device.", game: true },
  { id: "clock", key: "escape-room-clock", label: "Hide the clock", line: "Hides the game’s timer. There is no time limit either way.", game: true },
];
(() => {
  const mem = {};                 // used where the browser blocks storage (often inside an LMS frame)
  const store = {
    get(k) { try { const v = localStorage.getItem(k); if (v != null) return v; } catch (e) {} return mem[k] == null ? null : mem[k]; },
    set(k, v) { mem[k] = v; try { localStorage.setItem(k, v); } catch (e) {} },
  };
  ER.a11yStore = store;
  const mq = q => { try { return !!(typeof matchMedia === "function" && matchMedia(q).matches); } catch (e) { return false; } };
  /* What a setting is now, the way the game reads it: a choice that was saved, else the device's wish, else the default. */
  ER.a11yPref = id => {
    const o = ER.A11Y_OPTIONS.find(x => x.id === id); if (!o) return false;
    const v = store.get(o.key);
    if (id === "motion") return !mq("(prefers-reduced-motion: reduce)") && v !== "off";
    if (id === "contrast") return v === "on" ? true : v === "off" ? false : mq("(prefers-contrast: more)");
    if (id === "sound" || id === "read") return v !== "off";
    return v === "on";
  };
  /* Asked already? Where the browser can't keep anything (storage blocked, as in some LMS frames) the answer couldn't
     be remembered, so it would open on every visit: there it counts as asked, and the Accessibility options button
     still opens it. */
  ER.a11yAsked = () => {
    try { localStorage.setItem("escape-room-probe", "1"); localStorage.removeItem("escape-room-probe"); } catch (e) { return true; }
    return store.get(ER.A11Y_ASKED) != null;
  };
  const CSS = `
.a11yq{position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;padding:1rem;overflow:hidden auto;
  background:radial-gradient(ellipse 70% 60% at 50% 40%,rgba(120,78,30,.55),rgba(24,15,7,.9) 60%,rgba(4,3,2,.97))}
.a11yq-sheet{position:relative;flex:none;width:min(36rem,100%);min-width:0;max-width:100%;margin:auto;overflow-wrap:break-word;padding:1.6rem 1.7rem 1.4rem;color:#2a1d14;text-align:left;
  font:400 1.0625rem/1.5 "Atkinson Hyperlegible",Verdana,"Segoe UI",Arial,sans-serif;letter-spacing:normal;
  background:linear-gradient(175deg,#f3e8cf,#e6d7b5);border-radius:.25rem;box-shadow:inset 0 0 0 1px rgba(42,29,20,.45),inset 0 0 0 .4rem #efe3c8,inset 0 0 0 .46rem rgba(42,29,20,.35),.4rem 1.2rem 2.2rem rgba(0,0,0,.7)}
.a11yq-sheet h2{margin:0 0 .4rem;font:400 1.5rem/1.25 "IM Fell English SC","IM Fell English",Georgia,serif;letter-spacing:.04em;color:#5e140d}
#a11y-ask h2:focus{outline:none!important;box-shadow:none!important}   /* focus lands on the heading so it is read; it is not a control */
.a11yq-lead{margin:0 0 .9rem}
.a11yq-list{list-style:none;margin:0;padding:0;border-top:1px solid rgba(42,29,20,.45)}
.a11yq-list li{margin:0;padding:.35rem 0 .5rem;border-bottom:1px solid rgba(42,29,20,.45)}
.a11yq-sw{display:flex;align-items:center;gap:.8rem;width:100%;min-height:2.9rem;padding:.3rem .25rem;margin:0;border:0;background:none;color:inherit;font-family:inherit;font-size:1.125rem;font-weight:700;line-height:1.3;letter-spacing:normal;text-align:left;cursor:pointer}
.a11yq-track{position:relative;flex:none;width:3.3rem;height:1.85rem;border-radius:1rem;background:#fffaf0;border:2px solid #2a1d14}
.a11yq-track::after{content:"";position:absolute;top:.17rem;left:.2rem;width:1.25rem;height:1.25rem;border-radius:50%;background:#2a1d14}
.a11yq-sw[aria-checked=true] .a11yq-track{background:#2a1d14}
.a11yq-sw[aria-checked=true] .a11yq-track::after{left:auto;right:.2rem;background:#f6dfa0}
.a11yq-sw[aria-disabled=true]{cursor:default}
.a11yq-sw[aria-disabled=true] .a11yq-track{border-style:dashed}
.a11yq-lbl{flex:1;min-width:0}
.a11yq-st{flex:none;min-width:2.2rem;text-align:right}
.a11yq-sw[aria-checked=true] .a11yq-st{text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:.2em}
.a11yq-d{margin:0 0 0 4.35rem;font-size:1rem;line-height:1.5;color:#3a2c1c}
.a11yq-d em{font-style:normal;font-weight:700}
.a11yq-sr{margin:1rem 0 1.1rem;padding:.6rem .8rem;font-size:1rem;border-left:4px solid #6e1a12;background:rgba(255,250,240,.6)}
.a11yq-btns{display:flex;flex-wrap:wrap;gap:.7rem 1rem;align-items:center}
.a11yq-btns button{min-height:2.9rem;padding:.6rem 1.3rem;margin:0;font-family:inherit;font-size:1.0625rem;font-weight:700;line-height:1.2;letter-spacing:normal;border-radius:.25rem;cursor:pointer;color:#1d1205}
.a11yq-ok{background:linear-gradient(170deg,#f8e4a8,#dcbb69 60%,#cba858);border:2px solid #4a360f;box-shadow:0 .2rem .4rem rgba(0,0,0,.35)}
.a11yq-skip{background:transparent;border:2px solid #2a1d14}
.a11yq button:focus{outline:none}
.a11yq button:focus-visible,.a11yq button.kf:focus{outline:3px solid #120d09!important;outline-offset:3px!important;box-shadow:0 0 0 3px #ffe7ae!important}
.a11yq-sw:hover .a11yq-lbl,.a11yq-skip:hover{text-decoration:underline}
.a11yq-ok:hover{filter:brightness(1.07)}
html[data-readable=on] .a11yq-sheet{font-size:1.15rem;line-height:1.6;word-spacing:.08em}
html[data-readable=on] .a11yq-sheet h2{font-family:"Atkinson Hyperlegible",Verdana,Arial,sans-serif;font-weight:700;letter-spacing:0}
html[data-contrast=more] .a11yq{background:rgba(0,0,0,.94)}
html[data-contrast=more] .a11yq-sheet{background:#fffaf0;color:#000;border:3px solid #fff;box-shadow:none}
html[data-contrast=more] .a11yq-sheet h2,html[data-contrast=more] .a11yq-d{color:#000}
html[data-contrast=more] .a11yq-sr{background:#fff;border-color:#000}
html[data-contrast=more] .a11yq-ok{background:#f6dfa0;border-color:#000;box-shadow:none}
html[data-contrast=more] .a11yq-track{border-color:#000}
html[data-contrast=more] .a11yq-sw{border:2px solid #000;margin:.15rem 0}
@media (forced-colors: active){
  .a11yq{background:Canvas}
  .a11yq-sheet{background:Canvas;color:CanvasText;border:2px solid CanvasText}
  .a11yq-btns button,.a11yq-sw{border:1px solid ButtonText;color:ButtonText;background:ButtonFace}
  .a11yq-track{border-color:ButtonText;background:ButtonFace}
  .a11yq-track::after{background:ButtonText}
  .a11yq-sw[aria-checked=true] .a11yq-track{background:Highlight}
  .a11yq-sw[aria-checked=true] .a11yq-track::after{background:HighlightText}
  .a11yq-sr{border-color:CanvasText}
  .a11yq button:focus-visible{outline-color:Highlight!important}
}
@media (prefers-reduced-motion: no-preference){ html:not([data-motion=off]) .a11yq-sheet{animation:a11yq-in .22s ease-out} }
@keyframes a11yq-in{from{opacity:0;transform:translateY(.6rem)}to{opacity:1;transform:none}}
@media (min-width:62em){ .a11yq-sheet{width:min(56rem,100%)} .a11yq-list{display:grid;grid-template-columns:1fr 1fr;column-gap:2rem} }
@media (max-width:30em){ .a11yq{padding:.5rem} .a11yq-sheet{padding:1.2rem 1.1rem 1.1rem} .a11yq-d{margin-left:0} }`;
  let open = null;
  /* ER.a11yAskOpen({ get(id), set(id, on), locked(id) -> reason or "", where: "game"|"front"|"maker", later, opener, modal, onClose(kept) })
     get/set default to the shared storage; modal is { open(el, onEsc, opener) -> handle, close(handle) } (the
     maker's own modal layer, which then makes the page inert, loops Tab and handles Esc); without it the dialog
     does those itself. Returns the dialog element. */
  ER.a11yAskOpen = (opts = {}) => {
    if (open) return open.el;
    const doc = document, esc = ER.esc;
    const get = opts.get || (id => ER.a11yPref(id));
    const set = opts.set || ((id, on) => { const o = ER.A11Y_OPTIONS.find(x => x.id === id); store.set(o.key, on ? "on" : "off"); });
    const locked = opts.locked || (id => id === "motion" && mq("(prefers-reduced-motion: reduce)") ? "Your device asks for less motion, so it stays off." : "");
    if (!doc.getElementById("a11yq-style")) { const st = doc.createElement("style"); st.id = "a11yq-style"; st.textContent = CSS; doc.head.appendChild(st); }
    const before = {}; ER.A11Y_OPTIONS.forEach(o => { before[o.id] = !!get(o.id); });
    const later = opts.later || "You can change them at any time with “Accessibility options”.";
    const el = doc.createElement("div");
    el.className = "a11yq"; el.id = "a11y-ask"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-labelledby", "a11y-ask-h"); el.setAttribute("aria-describedby", "a11y-ask-lead");
    el.innerHTML = `<div class="a11yq-sheet"><h2 id="a11y-ask-h" tabindex="-1">Before you start: make it easier to use?</h2>
      <p class="a11yq-lead" id="a11y-ask-lead">Turn on anything that helps. Each switch works straight away. ${esc(later)}</p>
      <ul class="a11yq-list" role="list">${ER.A11Y_OPTIONS.map(o => `<li><button type="button" class="a11yq-sw" role="switch" id="a11y-ask-${o.id}" aria-checked="false" aria-describedby="a11y-ask-${o.id}-d"><span class="a11yq-track" aria-hidden="true"></span><span class="a11yq-lbl">${esc(o.label)}</span><span class="a11yq-st" aria-hidden="true">off</span></button>
        <p class="a11yq-d" id="a11y-ask-${o.id}-d">${esc(o.line)}${o.game && opts.where !== "game" ? " <em>(In the game.)</em>" : ""}<span class="a11yq-why"></span></p></li>`).join("")}</ul>
      <p class="a11yq-sr">Using a screen reader, switch control or keyboard? Everything works with them; there’s nothing to turn on.</p>
      <div class="a11yq-btns"><button type="button" class="a11yq-ok" id="a11y-ask-ok">Continue</button><button type="button" class="a11yq-skip" id="a11y-ask-skip">Continue without changes</button></div></div>`;
    const paint = () => ER.A11Y_OPTIONS.forEach(o => {
      const b = el.querySelector("#a11y-ask-" + o.id), on = !!get(o.id), why = locked(o.id);
      b.setAttribute("aria-checked", on ? "true" : "false"); b.querySelector(".a11yq-st").textContent = on ? "on" : "off";
      if (why) b.setAttribute("aria-disabled", "true"); else b.removeAttribute("aria-disabled");
      el.querySelector(`#a11y-ask-${o.id}-d .a11yq-why`).textContent = why ? " " + why : "";
    });
    const behind = [], back = opts.opener || doc.activeElement;
    let handle = null;
    const keys = e => {
      if (opts.modal) return;              // the maker's modal layer loops Tab and calls onEsc
      if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); close(false); return; }
      if (e.key !== "Tab") return;
      const f = [...el.querySelectorAll("button")].filter(b => b.getClientRects().length);
      const i = f.indexOf(doc.activeElement), j = e.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : (i === f.length - 1 || i < 0 ? 0 : i + 1);
      e.preventDefault(); e.stopImmediatePropagation(); f[j].focus();
    };
    function close(keep) {
      if (!open) return; open = null;
      if (!keep) ER.A11Y_OPTIONS.forEach(o => { if (!locked(o.id) && !!get(o.id) !== before[o.id]) set(o.id, before[o.id]); });
      store.set(ER.A11Y_ASKED, keep ? "continue" : "skip");
      window.removeEventListener("keydown", keys, true);
      el.remove();
      if (opts.modal && handle) opts.modal.close(handle);
      else { behind.forEach(n => { n.inert = false; }); if (back && back.isConnected && back.focus) back.focus(); }
      if (opts.onClose) opts.onClose(keep);
    }
    el.addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.id === "a11y-ask-ok") return close(true);
      if (b.id === "a11y-ask-skip") return close(false);
      const o = ER.A11Y_OPTIONS.find(x => "a11y-ask-" + x.id === b.id); if (!o || locked(o.id)) return;
      set(o.id, !get(o.id)); paint();
    });
    doc.body.appendChild(el); paint();
    if (opts.modal) handle = opts.modal.open(el, () => close(false), back);
    else [...doc.body.children].forEach(n => { if (n !== el && !n.inert && n.tagName !== "SCRIPT" && n.tagName !== "STYLE" && !n.hasAttribute("aria-live") /* the live region stays live */) { n.inert = true; behind.push(n); } });
    window.addEventListener("keydown", keys, true);
    open = { el, close };
    el.querySelector("h2").focus();
    return el;
  };
  ER.a11yAskClose = keep => { if (open) open.close(!!keep); };
})();
if (typeof module !== "undefined") module.exports = ER;
