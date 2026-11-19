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
  const LISTS = new Set(["rooms", "cards", "questions", "items", "profiles", "options"]);
  const TEXTS = new Set(["hints", "categories", "choices"]);
  const GROUPS = new Set(["meta", "intro", "scoring", "finish", "hintRules"]);
  const NUMBERS = new Set(["correct", "category", "hintPenalty", "wrongPenalty", "minScore", "first", "second", "schema"]);
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
if (typeof module !== "undefined") module.exports = ER;
