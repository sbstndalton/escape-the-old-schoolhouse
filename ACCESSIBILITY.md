## Editor

This section covers the teacher editor (`editor.html`, "the Curator's workshop"). The student game has its own section.

**Target:** WCAG 2.2 Level AA with no exceptions, and Level AAA where practical. Where the art direction and accessibility pulled in different directions, accessibility won; the lamplit workbench look was kept by finding an accessible way to draw it.

### How it was tested

Everything below runs in `npm test` (`tests/a11y-editor.js`, plus the editor tests in `tests/editor.js`), so it can't quietly regress.

| Check | How | Result |
|---|---|---|
| Automated rules | **axe-core 4.14.1**, tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`, `best-practice`, on **every page, tab and overlay** (44 states on a desktop, 46 on a phone: each room type and tab, questions as text, the answer-key envelope and note open, a help slip open, hints on, accuracy grading, the Accessibility check, the list of room kinds, the phone cabinet and file list, the New / Export / Answer sheet / problems folders, the confirm slips, and the preview rail). The answer sheet, which is a document of its own, is scanned as one. | **0 violations and 0 "needs review"** at 1440×900 and 390×844, in each of: the default look, **High contrast**, **Readable text**, emulated **forced colours**, and emulated **prefers-contrast: more** (450 scans) |
| Contrast | axe can't judge text over gradients and textures, so contrast is **measured from the pixels**: two screenshots of every state, one with the text made transparent, and the painted ink compared with what is behind it (textures, gradients, lamplight and vignette included). | About 2,700 runs of text per look, none below AA. Default look in Chromium: every one at 7:1 or better (lowest 7.04:1). WebKit draws thinner strokes: 12 small labels there measure between 6.3:1 and 7:1. Readable text: three labels between 6.3:1 and 7:1. High contrast: lowest 9.7:1 |
| Keyboard | A **keyboard-only authoring test** with no pointer events at all: skip link, add a question room, write a question and its answers, press its seal, switch index tab with the arrow keys, name the room, export, and answer the "export a draft?" slip. A second test presses Tab through every control on the main pages and every overlay (about 650 tab stops). | Passes. Every stop shows a 3px focus ring and is never covered by the top rail, the cabinet, a note or a slip (2.4.7, 2.4.11) |
| Dialogs | Delete, replace and "export a draft" slips, the folders, the phone cabinet and the preview: role, name, description, initial focus, Tab loop, Esc, focus return, inert background. No native `confirm()` or `alert()` is ever shown (the tests fail if one appears). | Passes |
| Help slips (1.4.13) | Open on hover and on focus, stay while the pointer is on the mark or the slip, dismissed with Esc without moving pointer or focus. | Passes |
| Target size | Every control measured in every state. | At least 24×24 CSS px everywhere; at least 44×44 on touch screens |
| Text size and reflow | (1) Browser default text size doubled to 32px at 1280×900, (2) 200% zoom, (3) **320 CSS px wide** (400% zoom), also only 256px tall, (4) the WCAG **text-spacing** override (line height 1.5, letter spacing 0.12em, word spacing 0.16em, paragraph spacing 2em). | No clipped text, no sideways scrolling, nothing lost (1.4.4, 1.4.10, 1.4.12) |
| Forced colours and increased contrast | Chromium's emulation of `forced-colors: active` and `prefers-contrast: more`. Every control must keep a real border, outline or underline, and "on" states must differ from "off" states. | Passes |
| Motion | With `prefers-reduced-motion: reduce`, `document.getAnimations()` is empty. No CSS 3D anywhere. | Passes |
| Screen-reader structure | The accessibility tree (`ariaSnapshot()`) of a room page is asserted line by line: landmarks, one `h1`, heading order, names, roles, states and reading order. It was also read through by hand, which found and fixed an unnamed image in the envelope and a drawer whose count was not spoken. | Passes |
| Browsers | Chromium 158 (everything). WebKit 27 (the editor tests, and the accessibility suite except the two checks only Chromium can do: forced colours and the default-text-size setting). | Passes in both |

**Before and after** (default look, both screen sizes together): axe violations 50 → 0; text below AA contrast 288 → 0 (lowest measured 1.9:1 → 7.0:1); axe "needs review" 222 → 0; tab stops without an outline ring 195 → 0 (text fields used to show only a tint and a thicker underline); controls under 24px (44px on touch) 682 → 0; native browser dialogs 5 → 0.

### What the editor does

- **Keyboard:** every action works without a pointer. Tab order follows the page: top rail, cabinet, then the sheet. A skip link jumps to the editing area. Index tabs are a real tab list (Left, Right, Home, End). Brass selectors are radio groups (arrow keys). Seals are checkboxes (Space). Switches are switches. Moving an entry keeps the keyboard on it, and deleting one hands the keyboard to its neighbour. There are no drag-only actions and no time limits; work is saved as you type.
- **Focus:** one 3px ring everywhere, lamp-yellow on wood and felt, ink on paper and brass, at least 3:1 against what is around it. Opening a drawer moves focus to the page heading and renames the browser tab.
- **Screen readers:** real labels on every field (never placeholder-only), each card or question is a named group ("Card 3"), every seal says which item it belongs to, help text is attached to its field as a description, decorative art is hidden, and changes that are only visible (a seal pressed or lifted, an entry moved or deleted, a room added, the preview changing room) are announced through a polite live region.
- **Dialogs:** anything that deletes or replaces work asks first on an in-app slip (an alert dialog with a title and description). Cancel has the focus, not the destructive button. Esc backs out. On a phone the open cabinet is a dialog too: focus moves in, the bench behind is inert, and Esc, **Close the cabinet**, the dark bench or choosing a drawer puts it away and returns focus.
- **Help slips (ⓘ):** reachable by Tab and by hover, persistent while pointed at, dismissed with Esc.
- **High contrast** (switch at the foot of the cabinet, remembered; also follows `prefers-contrast: more` and forced colours): plain black-on-white paper and white-on-black wood, no textures or lamplight, 2px borders on every control, states shown by borders and fill rather than glow. The answer sheet follows it.
- **Readable text** (switch at the foot of the cabinet, remembered): a plain sans-serif (Atkinson Hyperlegible if it is installed, otherwise Verdana or the system sans), 12.5% larger, with more letter, word and line spacing, in place of the old-book lettering. The answer sheet follows it.
- **Reading by default:** the distressed typewriter face and the small-caps face are used only for short labels and numbers. Everything a teacher reads or writes (field values, help, notes, the answer key, the answer sheet) is in a plain serif at 14px or more, with a line height of 1.5.
- **Colour is never the only signal:** the open drawer is slid out, underlined and marked `aria-current`; the selected tab is underlined; unchecked counts are written out ("0/5"); warnings carry a "!" mark.
- **Text size, zoom and small screens:** sizes are in `rem`, breakpoints are in `em`, tabs and buttons wrap, and on very small or heavily zoomed windows nothing is pinned.
- **The preview rail and the answer-key envelope** are fully operable and labelled: every rail button has a name, the current room is marked, room changes are announced, and Esc returns focus to the button that opened the preview.

### Accessibility check (helping teachers write accessible content)

The **Accessibility check** drawer reads what the teacher wrote and lists common barriers. Each note says where it is, why it matters and what to do, in plain language, and jumps to the spot. It is advice only: it never blocks preview or export. The count is shown on the drawer and in the Export folder, and the notes are printed at the end of the answer sheet together with a short "by hand" list.

| Rule | What it flags |
|---|---|
| `missing-text` | No escape-room title, opening story, room title, room story or instructions, or sorting-category name |
| `colour` | Directions that depend on colour ("the red book", "marked in green", "colour-coded"). Names such as *Brown v. Board* or "Black students" are left alone |
| `position` | Directions that depend on position ("on the left", "top-right", "the first shelf", "the card above") |
| `shape` | Directions that depend on shape or size ("the round button") |
| `sound` | Instructions that rely on hearing ("when you hear the chime") |
| `device` | Words for one way of working ("click on", "drag the", "tap", "hover over", "the mouse") |
| `time` | Time pressure ("10 minutes", "hurry", "before time runs out"); the game has no time limit |
| `caps` | Four or more words in a row in capitals |
| `long-code` | A dial lock with more than 8 dials (one per clue card) |
| `look-alike` | A combination or exit password that mixes O with 0, or I or l with 1 |
| `many-items` | More than 12 cards, 8 items to order, 14 items to sort, or 6 choices |
| `symbol-only` | A card with an icon but no name, or a name, item, choice, option or category that is only a symbol or emoji |
| `long-text` | A clue or question over 300 characters, an item over 200, a hint over 300, a story over 900 |
| `reading-load` | A room with more than about 500 words to read |
| `answer-list` | A typed answer with nothing accepted, with only one accepted spelling of a multi-word answer, or with only very long accepted answers |
| `above` | Choices such as "All of the above", which depend on the order of the choices |
| `no-hints` | A room with hints switched off, or switched on but empty |

### Known limitations

- **No screen reader has been run against it yet.** Structure, names, roles, states and announcements were checked through the accessibility tree and axe, which is not the same as listening to NVDA, JAWS or VoiceOver. This is the most important thing still to do.
- **Forced colours and increased contrast were tested with Chromium's emulation,** not on Windows with a real contrast theme. In forced colours the High contrast switch stays on and can't be turned off.
- **Readable text relies on fonts already on the computer.** No extra typeface is embedded in the editor, so the face you get depends on the system.
- **AAA contrast (7:1) is met for almost all text, not all of it.** Measured from pixels, a few small labels fall between 6.3:1 and 7:1: twelve in WebKit's default look and three with Readable text on. Disabled buttons are dimmer still (they are exempt). High contrast is above 9:1 throughout.
- **Other AAA criteria not met:** the old-book and small-caps faces are still used for short labels unless Readable text is on, and target sizes on a desktop are 24px or more rather than 44px (they are 44px on touch screens).
- **The Accessibility check matches patterns in English.** It will miss problems phrased in ways it doesn't know, and it will sometimes flag wording that is fine ("at the top of his class"). It can't judge reading level, the quality of a hint, or whether a story makes sense without the picture; the "By hand" tab lists what to check yourself.
- **Typing a quiz as text** is one plain text box. It is fully labelled, and mistakes are announced and listed, but a screen-reader user may find the form view easier.
- **Rooms can only be moved up** in the cabinet (move the next room up to move one down).
- **The typed strip that confirms an action** ("Project saved") disappears after six seconds. It is also announced, and nothing depends on it.
- **In the preview,** keyboard focus moves into the game when it loads. The brass rail is before it in Tab order (Shift+Tab), and Esc closes the preview from either place.
- **Firefox** was not available where the tests ran. The editor uses nothing Firefox lacks (`inert` needs Firefox 112 or later), but it has not been run there.

### Reporting a problem

Open an issue in this repository and say which page of the editor, which browser and assistive technology, and what happened. Accessibility problems are treated as bugs, not requests.
