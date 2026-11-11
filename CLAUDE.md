# Escape the Old Schoolhouse

A browser-based educational escape room for an introductory Foundations of Education course (philosophies and philosophers of education). Students solve 5 rooms; the certificate shows the exit password `DEWEY1916` for an auto-graded LMS quiz.

## Layout
- `index.html`: **the whole game**. One self-contained file with inline CSS and JS. Keep it that way: it must work by double-clicking, inside Moodle/Canvas, and inside the Mac app.
- `imsmanifest.xml` + `EscapeRoom_SCORM.zip`: the SCORM 1.2 package for Moodle/Canvas. **Run `npm run build:scorm` after any change to `index.html`** and commit the rebuilt zip.
- `mac/`: Swift (AppKit + WebKit) wrapper. CI (`.github/workflows/build-mac.yml`) builds it on macOS and publishes the `mac-latest` release from `main`.
- `scripts/serve.js`: zero-dependency static server. `tests/playthrough.js`: automated play-through.

## Testing the web version
- `npm install` once (installs Playwright), then `npx playwright install chromium`.
- `npm test` plays the whole game in headless Chromium: full run, SCORM reporting, wrong answers, hints, phone layout, no outside network requests. Screenshots of every room go to `tests/screenshots/`. Look at them after visual changes.
- `npm run serve` serves the game at http://localhost:8080.
- **Playwright MCP** (`.mcp.json`): start `npm run serve`, then use the `playwright` MCP tools to open http://localhost:8080, play the game, resize to a phone width (390×844), and take screenshots. Use this to check layout and feel, not only the automated tests.

### Answer key (for testing)
Room 1 `LEARN` · Room 2 `9154` · Room 3 oldest→newest: Plato, Rousseau, Mann, Montessori, Dewey, Freire, Adler · Room 4 top→bottom T,P,T,P,T,P,T,P · Room 5 any answers.

## Rules for changes
- **No external requests**: no CDNs, web fonts, analytics, or images from URLs. The offline test enforces this.
- **Accessibility**: use real buttons and labels, keep everything keyboard-operable (no drag-and-drop-only puzzles), and keep text readable.
- **Accuracy matters**: this is course content. Double-check names, dates, quotes, and how each philosophy is described before changing them.
- Answers are stored lightly obfuscated with `btoa` (e.g. `enc(input) === "TEVBUk4="`). Keep that pattern when adding locks.
- If you change answers, the exit password, room count, or element IDs, update `tests/playthrough.js`, the README answer key, and this file.
- No personal information (names, emails, school details) in any file or commit.
- The SCORM code must keep working when no LMS is present (the plain-browser case).
