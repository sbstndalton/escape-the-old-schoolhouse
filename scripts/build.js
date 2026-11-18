// Builds the files people actually use from src/ and content/:
//   index.html            the student game with the default content
//   editor.html           the teacher editor (includes the game template so it can export new games)
//   EscapeRoom_SCORM.zip  the student game packaged for Moodle/Canvas
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
const gameTemplate = read("src/game.html").replace("/*__SHARED__*/", () => shared);
const content = JSON.parse(read("content/foundations-of-education.json"));

const errors = ER.validate(content);
if (errors.length) { console.error("Content has problems:\n- " + errors.join("\n- ")); process.exit(1); }

const game = ER.buildGame(gameTemplate, content);
const editor = read("src/editor.html")
  .replace("/*__SHARED__*/", () => shared)
  .replace('"__GAME_TEMPLATE__"', () => jsLiteral(gameTemplate))
  .replace('"__DEFAULT_CONFIG__"', () => jsLiteral(content));

// Fixed date so rebuilding unchanged content produces an identical zip.
const zip = ER.scorm(game, content.meta.title, new Date(2026, 0, 1, 12, 0, 0));

fs.writeFileSync(path.join(root, "index.html"), game);
fs.writeFileSync(path.join(root, "editor.html"), editor);
fs.writeFileSync(path.join(root, "EscapeRoom_SCORM.zip"), zip);
fs.writeFileSync(path.join(root, "imsmanifest.xml"), ER.manifest(content.meta.title));
const st = ER.reviewStatus(content);
console.log(`Built index.html, editor.html, EscapeRoom_SCORM.zip  (${content.rooms.length} rooms; ${st.verified}/${st.total} items verified)`);
