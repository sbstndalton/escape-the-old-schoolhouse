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
  const norm = s => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
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
    cards.forEach(c => { const v = String(c.code || "").trim().toUpperCase(); if (v) { code[c.k] = v; used.add(v); } });
    const word = String(room.codeWord || "").replace(/\s+/g, "").toUpperCase();
    if (!numbers && word && word.length === answerCards.length) {
      answerCards.forEach((c, i) => { if (!code[c.k]) { code[c.k] = word[i]; used.add(word[i]); } });
    }
    const pool = [...(numbers ? DIGITS : LETTERS)].filter(ch => !used.has(ch));
    display.forEach(c => { if (!code[c.k]) code[c.k] = pool.shift() || "?"; });
    return { cards, display, answerCards, numbers, code, answer: answerCards.map(c => code[c.k]).join("") };
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
  const fileSlug = s => String(s || "escape-room").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || "escape-room";

  return { esc, fmt, paras, norm, accepted, hash, scramble, matching, answerKey, HINT_ROOMS, hintRules, hintWarnings, reviewItems, reviewStatus, validate,
    encodeConfig, decodeConfig, buildGame, configFromHtml, zip, crc32, manifest, scorm, fileSlug };
})();
if (typeof module !== "undefined") module.exports = ER;
