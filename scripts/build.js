// Builds the files people actually use from src/, content/ and ACCESSIBILITY.md:
//   index.html            the front page: "I'm a student" (open a class link, or play the sample) and "I'm a teacher"
//   play.html             the student game with the sample content; it also plays any class link (play.html#play=…)
//   editor.html           the teacher's maker: src/editor/ (React + ui-sdk) bundled by esbuild, with the game template so it can export games and make links
//   accessibility.html    the accessibility statement (ACCESSIBILITY.md as a page)
//   guide.html            the teachers' printable one-page quick-start guide
//   EscapeRoom_SCORM.zip  the sample game packaged for Moodle/Canvas (its own launch file is index.html inside the zip)
//   imsmanifest.xml       the SCORM manifest, for reference
// Run: npm run build
const fs = require("fs");
const path = require("path");
const ER = require("../src/shared.js");

const root = path.resolve(__dirname, "..");
const read = p => fs.readFileSync(path.join(root, p), "utf8");
// Safe to embed inside a <script> block as a JS literal.
const LS = String.fromCharCode(0x2028), PS = String.fromCharCode(0x2029);
const jsLiteral = v => JSON.stringify(v).replace(/</g, "\\u003c").split(LS).join("\\u2028").split(PS).join("\\u2029");

const shared = read("src/shared.js");
const gameSrc = read("src/game.html");
const gameTemplate = gameSrc.replace("/*__SHARED__*/", () => shared);
const content = JSON.parse(read("content/foundations-of-education.json"));

const errors = ER.validate(content);
if (errors.length) { console.error("Content has problems:\n- " + errors.join("\n- ")); process.exit(1); }

// The website's game links back to the front page when a class link is broken; exported and SCORM games don't.
const play = ER.buildGame(gameTemplate, content, { home: "index.html" });
const packaged = ER.buildGame(gameTemplate, content);
/* The editor is React + ui-sdk (src/editor/*.jsx, with src/shared.js imported). esbuild bundles it into one classic
   script (an IIFE, so it also runs from file://), which goes inline into the page with the CSS and the embedded fonts. */
function editorBundle(){
  const out = require("esbuild").buildSync({
    entryPoints: [path.join(root, "src/editor/main.jsx")], bundle: true, write: false, format: "iife", platform: "browser",
    target: ["es2020"], jsx: "automatic", minify: true, legalComments: "eof", charset: "utf8", logLevel: "warning",
    define: { "process.env.NODE_ENV": '"production"' }
  }).outputFiles[0].text;
  const once = (s, from, to) => { const i = s.indexOf(from); if (i < 0 || s.indexOf(from, i + 1) >= 0) throw new Error(`The editor bundle should hold ${from} once`); return s.slice(0, i) + to + s.slice(i + from.length); };
  let js = once(once(out, '"__GAME_TEMPLATE__"', jsLiteral(gameTemplate)), '"__DEFAULT_CONFIG__"', jsLiteral(content));
  return js.replace(/<\/(script)/gi, "<\\/$1").replace(/<!--/g, "<\\!--");
}
const EDITOR_NOTE = "/* The editor bundles React and React DOM (MIT License, Copyright (c) Meta Platforms, Inc. and affiliates; their notices are at the end of this script) and ui-sdk (@ui-sdk/react and @ui-sdk/core, Copyright 2026 Vercel, Inc., Apache License 2.0). */\n";
const editor = read("src/editor/index.html")
  .replace("/*__EDITOR_CSS__*/", () => read("src/editor/editor.css"))
  .replace("/*__EDITOR_JS__*/", () => EDITOR_NOTE + editorBundle());

// The front page and the statement use the game's own embedded fonts (the reading face and the label face).
const fontFaces = families => gameSrc.split("\n").filter(l => l.startsWith("@font-face") && families.some(f => l.includes(`font-family:"${f}"`))).join("\n");
const FONT_NOTE = "/* Embedded fonts (no internet needed). Atkinson Hyperlegible: Copyright 2020 Braille Institute of America, Inc., SIL Open Font License 1.1."
  + " IM Fell English SC: Copyright (c) 2007 Igino Marini, with Reserved Font Name \"IM FELL English SC\", SIL Open Font License 1.1 (its digits are left out on purpose). */\n";
const front = read("src/front.html")
  .replace("/*__FONTS__*/", () => FONT_NOTE + fontFaces(["Atkinson Hyperlegible", "IM Fell English SC"]))
  .replace("/*__SHARED__*/", () => shared);

// The quick-start guide carries the site's address as text and as a QR code, so a printed copy leads back.
const guide = read("src/guide.html")
  .replace("/*__FONTS__*/", () => FONT_NOTE + fontFaces(["Atkinson Hyperlegible", "IM Fell English SC"]))
  .replace("<!--__SITE__-->", () => ER.esc(ER.SITE))
  .replace("<!--__QR__-->", () => ER.qrSvg(ER.SITE, { label: "QR code of the site's address, " + ER.SITE }));

/* ---------- ACCESSIBILITY.md as a page ----------
   A small Markdown reader for what that file uses: headings, paragraphs, lists, tables, rules, **bold**, *italic*,
   `code` and [links](…). Everything is escaped first; links may only go to web addresses, other pages here, or
   headings on the page. Headings get the same ids GitHub gives them, so the file's own links still work. */
function markdown(md){
  const E = ER.esc;
  const used = new Map();     // a repeated heading gets -1, -2 … like on GitHub
  const unique = id => { const n = used.get(id) || 0; used.set(id, n + 1); return n ? `${id}-${n}` : id; };
  const slug = t => t.toLowerCase().replace(/<[^>]+>/g, "").replace(/[^\p{L}\p{N}\s-]/gu, "").trim().replace(/\s/g, "-");
  const inline = t => E(t)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, text, href) => {
      const h = href.replace(/&amp;/g, "&");
      if (!/^(https?:\/\/|#|[A-Za-z0-9_.-]+\.(html|md)(#[\w-]*)?$)/.test(h)) return text;
      return `<a href="${E(h.replace(/^ACCESSIBILITY\.md/, "accessibility.html").replace(/^README\.md.*/, "index.html").replace(/^([A-Z][A-Z-]*\.md)/, "https://github.com/sbstndalton/escape-the-old-schoolhouse/blob/main/$1"))}">${text}</a>`;
    });
  const lines = md.replace(/\r/g, "").split("\n"), out = [];
  let tables = 0, section = "Accessibility";
  for (let i = 0; i < lines.length;) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    let m;
    if ((m = l.match(/^(#{1,4})\s+(.*)$/))) { const n = m[1].length, t = inline(m[2]); section = m[2].replace(/[*`]/g, ""); out.push(`<h${n} id="${unique(slug(m[2].replace(/[*`]/g, "")))}">${t}</h${n}>`); i++; continue; }
    if (/^---+\s*$/.test(l)) { out.push("<hr>"); i++; continue; }
    if (/^\|/.test(l)) {
      const rows = []; while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++]);
      const cells = r => r.replace(/^\||\|\s*$/g, "").split("|").map(c => c.trim());
      const head = cells(rows[0]), body = rows.slice(2).map(cells);
      // each table scrolls sideways in its own box when the window is narrow; the box is named after the section it is in
      out.push(`<div class="tbl" role="region" aria-label="Table ${++tables}: ${E(section)}" tabindex="0"><table><thead><tr>${head.map(c => c ? `<th scope="col">${inline(c)}</th>` : "<td></td>").join("")}</tr></thead><tbody>`
        + body.map(r => `<tr>${r.map((c, k) => k === 0 ? `<th scope="row">${inline(c)}</th>` : `<td>${inline(c)}</td>`).join("")}</tr>`).join("") + "</tbody></table></div>");
      continue;
    }
    if ((m = l.match(/^(\s*)([-*]|\d+\.)\s+/))) {
      const ordered = /\d/.test(m[2]), items = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        let t = lines[i++].replace(/^\s*([-*]|\d+\.)\s+/, "");
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*([-*]|\d+\.)\s+/.test(lines[i])) t += " " + lines[i++].trim();
        items.push(`<li>${inline(t)}</li>`);
      }
      out.push(`<${ordered ? "ol" : "ul"}>${items.join("")}</${ordered ? "ol" : "ul"}>`);
      continue;
    }
    const para = []; while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|\||---+\s*$|\s*([-*]|\d+\.)\s+)/.test(lines[i])) para.push(lines[i++].trim());
    out.push(`<p>${inline(para.join(" "))}</p>`);
  }
  return out.join("\n");
}
const statement = read("src/statement.html")
  .replace("/*__FONTS__*/", () => FONT_NOTE + fontFaces(["Atkinson Hyperlegible"]))
  .replace("<!--__STATEMENT__-->", () => markdown(read("ACCESSIBILITY.md")));

// Fixed date so rebuilding unchanged content produces an identical zip.
const zip = ER.scorm(packaged, content.meta.title, new Date(2026, 0, 1, 12, 0, 0));

fs.writeFileSync(path.join(root, "index.html"), front);
fs.writeFileSync(path.join(root, "play.html"), play);
fs.writeFileSync(path.join(root, "editor.html"), editor);
fs.writeFileSync(path.join(root, "accessibility.html"), statement);
fs.writeFileSync(path.join(root, "guide.html"), guide);
fs.writeFileSync(path.join(root, "EscapeRoom_SCORM.zip"), zip);
fs.writeFileSync(path.join(root, "imsmanifest.xml"), ER.manifest(content.meta.title));
const st = ER.reviewStatus(content);
console.log(`Built index.html (front page), play.html, editor.html, accessibility.html, guide.html, EscapeRoom_SCORM.zip  (${content.rooms.length} rooms; ${st.verified}/${st.total} items verified)`);
