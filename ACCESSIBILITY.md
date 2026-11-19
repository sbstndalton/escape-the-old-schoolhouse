# Accessibility

*Escape the Old Schoolhouse* is meant to be playable by every student and editable by every teacher.

- **Target:** [WCAG 2.2](https://www.w3.org/TR/WCAG22/) Level AA for the student game and the teacher editor, with Level AAA wherever it was practical (see [What goes beyond AA](#what-goes-beyond-aa)).
- **Status:** the student game meets the target in everything we could test with tools and by hand. It has **not yet been tested by people who use assistive technology every day**, or with a real screen reader. That is the biggest gap, and it is listed first under [Known limitations](#known-limitations).
- **Last reviewed:** November 2026, against the sample game in this repository.

This page has two parts: the **student game** (below) and the **editor** (at the end).

---

## Student game

### Things a player can change

Open the **notebook** (the pocket watch at the top right, or the **Esc** key). Every choice is remembered on that device.

| Setting | What it does |
|---|---|
| **High contrast** | Solid backgrounds behind all text, no textures, no lamplight or film grain, black on cream and white on black, and a 2px border on every control. It starts on by itself when the device asks for more contrast. |
| **Readable text** | Every word in a plain face (Atkinson Hyperlegible) with no small caps and no typewriter lettering, 12.5% larger, with more line and word spacing, and nothing tilted. |
| **Motion** | Turns every animation off: sliding dials, doors, stamps, lamp flicker, drifting dust. It is off by itself when the device asks for reduced motion. |
| **Sound** | Turns the sound effects off (also the bell at the top right). Every sound comes with a message on screen. |
| **Hide the clock** | Hides the timer and stops the watch hands. There is **no time limit** in the game; the clock only shows how long you have played. |

Also built in:

- **Describe this room.** A button under each room's title lists everything in the room as plain text in reading order: the story, each object with its code, the clues, the lock and how to work it, and what you have done so far.
- **Your own text size.** The game never sets the text size from the window. It follows the browser's font-size setting and zoom, up to 400%, and the room becomes one scrolling column when it no longer fits.
- **Keyboard only.** Everything works with Tab, Enter, Space, the arrow keys and Esc. Nothing needs a drag.
- **Windows High Contrast** and other forced-colour modes are supported.

### What was tested, and how

Automated tests run on every change (`npm test`, file `tests/a11y-game.js`). They walk through **20 screens and states**: the title, the house rules held up, each of the five rooms, a clue held up, the room description, the notebook, a wrong try with a hint, a solved room, the plain-cards look, a quiz room, a solved timeline, stamped slips, a later mirror question, the certificate, and the result held up.

| Check | How | Result |
|---|---|---|
| **axe-core 4.14.1** (rules tagged wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa, best-practice) | Every state at 1440×900 and 390×844; again with High contrast, with Readable text, with forced colours emulated, and with `prefers-contrast: more` emulated. 160 scans in Chromium and 20 in WebKit. | **0 violations** |
| **Keyboard only** | A full play-through from the title to the certificate using key presses alone (no pointer events), including reading papers, the room description, the dials by typing and by arrows, moving timeline cards, stamping, the mirror, and the notebook. | Completes |
| **Focus visible and not obscured** (2.4.7, 2.4.11, 2.4.13) | Every focusable control in every state is focused; it must show a focus ring, be inside the window, and be the top element at its centre. In WebKit the same is done by walking the Tab order with real key presses. | 0 problems |
| **Target size** (2.5.8, 2.5.5) | Every pointer target is measured. | All 24 CSS px or more; game controls (dial arrows, studs, stamps, levers, stamp boxes, handles, papers, close buttons, the watch, the bell, notebook rows) 44 px or more |
| **Text at 200%** (1.4.4) | The browser's default font size is doubled (32px), at 1440×900 and 390×844, and also together with Readable text and text spacing. | Nothing cut off, no sideways scrolling |
| **Reflow** (1.4.10) | 320 CSS px wide (1280px at 400% zoom) and 720×450 (1440×900 at 200% zoom). | Nothing cut off, no sideways scrolling |
| **Text spacing** (1.4.12) | Line height 1.5, paragraph spacing 2em, letter spacing 0.12em, word spacing 0.16em forced on everything. | Nothing cut off |
| **Forced colours and High contrast** | Every control, paper, dial window and stamp state must still have a real edge; stamped and empty boxes must look different; dial characters must differ from their window. | 0 problems |
| **Announcements** (4.1.3) | Wrong answers, right answers, "2 of 3" results, moved cards, stamps, hints and room changes must appear in the polite live region; the same message twice is announced twice. | Pass |
| **Names, roles, states** (4.1.2, 1.3.1, 2.4.2, 2.4.6) | Page language and titles, one `h1`, heading order, landmarks, the key ring's summary, dial values, switches, dialogs, the locked hint drawer, stamps, and that the mirror never moves on by itself. | Pass |
| **Contrast** (1.4.3, 1.4.6) | Measured from screenshots; see below. | All text 4.5:1 or more; all reading text 7:1 or more |
| **Reduced motion** (2.3.3) | With reduced motion, or the Motion switch off, `document.getAnimations()` must be empty through a whole play-through (`tests/playthrough.js`). | Pass |
| **Screen-reader structure** | The accessibility tree of every state was written out (`ariaSnapshot`) and read top to bottom by hand, checking that every object, its code, the lock and its state make sense in order. Several things were rebuilt because of it (see the last rows of the table below). | Reviewed by hand |
| **Browsers** | Chromium (all tests) and WebKit (axe, the Tab walk, 200% text) through Playwright 1.65. | Pass |

#### Before and after

The same checks were run on the game as it was before this work.

| Area | Before | After |
|---|---|---|
| axe-core violations | 0 (but axe could not judge the contrast of about 850 text nodes on textured backgrounds) | 0 |
| Measured contrast below AA | 27 of 63 text styles at 1440×900 (lowest 2.1:1), 32 of 62 at 390×844 (lowest 1.9:1) | 0 of 74 (lowest 5.0:1) |
| Reading text below 7:1 | 19 of 23 styles | 0 of 28 (lowest 7.2:1) |
| Text size | Set from the window (12.5px to 20px), so the browser's font size was ignored and zoom enlarged text only a little | The reader's own size; nothing is sized from the window |
| Text at 200%, and 320px wide | Controls were pushed off screen and could not be reached (the automated play-through could not finish) | Playable; nothing cut off |
| Text spacing override | 69 clipped pieces of text | 0 |
| Pointer targets | 341 too small across all states (dial arrows 20px, studs 30px, close button 35px, question numbers 29px) | 0 |
| Reading face | A distressed typewriter face for all body text, some at 9px to 11px | Atkinson Hyperlegible; 16px or more for stories, clues, questions, answers and hints; 13.6px or more for labels (the numbers on the keys are 12.8px bold) |
| Book titles | Written sideways on the spines, shrunk to fit (down to 9px) | Left to right; books lie in piles with the spine facing out |
| Light | Lamplight, vignette and film grain were laid over all text | They light the room from behind the objects; nothing is laid over text |
| Focus ring | One colour; missing on notes with a clipped corner; none in Safari when the script moved focus | Two-tone ring on everything, in every browser |
| Papers | A whole story or clue was the name of one button | The words are plain text; a short heading button ("Clue 1") opens the paper large |
| Order on the title screen and the padlock | Begin came before the story and the name box; the shackle came before the dials | Reading order: story, name, rules, Begin; dials, code box, shackle |
| The mirror | Moved to the next question by itself after a click | One plate: "Next question", then "Continue" |
| Dial arrows | Acted when pressed down | Act on release, so a press can be cancelled |
| State shown by colour alone | Key ring (steel or brass), current question | Also a tick, a lamp dot and size, a filled or empty number, and words |
| Hints | A locked hint drawer could not be focused, so its reason could not be read | Focusable, with its reason attached |
| Messages | Shown twice to screen readers, and a repeated message was not read again | One polite live region; repeats are read |
| Room changes | Focus went to the whole room; no announcement; one page title for everything | Focus on the new heading, "Room 2 of 5: …" announced, a title per screen |
| Forced colours | Controls drawn with gradients and shadows disappeared | Every control has a real border; states use the system highlight |
| Options | Motion, Sound | Also High contrast, Readable text, Hide the clock, Describe this room |

#### Measured contrast

axe cannot work out contrast where text sits on a gradient or a texture, which is nearly everywhere in this game. So the tests measure it from pixels. Each piece of text is photographed at 2× scale, then photographed again with only its glyphs made invisible. The pixels that changed most (the top third) are the solid cores of the letters. Each one is compared with what is behind it at that exact spot, and the middle value is reported. Paper grain, wood, brass gradients and lamplight are all in the figure. The test fails if any reading text is under 7:1 or any other text is under 4.5:1.

| Text | Before, 1440×900 | After, 1440×900 | After, 390×844 | High contrast |
|---|---|---|---|---|
| Story note | 5.1 | 10.2 | 10.3 | 20.2 |
| Clue text | 3.5 | 10.2 | 10.2 | 20.2 |
| Clue number | 3.0 | 7.7 | 7.7 | 20.2 |
| Book titles on the spines | 8.0 | 13.2 | 13.2 | 21 |
| Code letters on the books | 6.4 | 12.9 | 12.8 | 16 |
| Portrait name plate | 5.7 | 8.2 | 8.2 | 16 |
| Portrait dates | 4.6 | 7.2 | 7.2 | 16 |
| Portrait code | 3.8 | 5.8 | 5.8 | 16 |
| Room title plate (brass) | 4.4 | 7.1 | 7.0 | 16 |
| Section label on the wall | 4.4 | 12.5 | 9.0 | 21 |
| Lock name on brass | 4.2 | 11 | 11 | 14 |
| "Pull the shackle to try" | 2.6 | 8.0 | 8.0 | 14 |
| Dial characters | 7.8 | 15.8 | 15.8 | 20.2 |
| Typed code | 4.1 | 9.6 | 9.6 | 20.2 |
| How-to line under the lock | (new) | 13.8 | 13.7 | 21 |
| Result message | 7.7 | 16.2 | 15.8 | 21 |
| Hint paper | (changed) | 10.1 | 10.1 | 20.2 |
| Quiz question | 5.9 | 10.7 | 10.6 | 20.2 |
| Quiz choice | 5.1 | 9.5 | 9.2 | 20.2 |
| Question number | 2.8 | 7.1 | 7.1 | 10.6 |
| Counter words | 4.9 | 7.0 | 7.0 | 14 |
| Timeline card | 4.9 | 10.2 | 10.4 | 20.2 |
| Stamped date | 3.6 | 6.6 | 6.7 | 10.6 |
| Slip text | (changed) | 10.6 | 10.6 | 20.2 |
| Empty stamp box | 2.7 | 8.8 | 8.8 | 20.2 |
| Stamped box (the weakest text) | 2.6 | 5.0 | 5.1 | 16 |
| Mirror question | (changed) | 7.5 | 10.7 | 21 |
| Mirror option | 5.5 | 10 | 10 | 20.2 |
| Key ring: locked key's number | 4.1 | 5.2 | 5.2 | 10.8 |
| Key ring: current key's number | 2.1 | 13.9 | 13.9 | 19.1 |
| Certificate line | 5.8 | 11.3 | 11.3 | 20.2 |
| Certificate small labels | 2.7 | 7.9 | 8.4 | 20.2 |
| Exit password | 5.3 | 10.6 | 10.9 | 20.2 |
| Print button | 2.9 | 7.1 | 7.1 | 16 |
| Examine sheet text | 6.9 | 10.3 | 10.5 | 20.2 |
| Notebook rows | (changed) | 10.6 | 10.6 | 20.2 |
| Draft note | 4.5 | 9.7 | 9.7 | 20.2 |
| Clock | 5.8 | 13.3 | 11.6 | 21 |

The full table of 74 styles is printed by `node tests/a11y-game.js --report report.json`.

**Parts that are not text** (1.4.11), from their colours:

| Part | Colours | Ratio |
|---|---|---|
| Focus ring: light band against dark band | `#ffe7ae` and `#120d09` | 15.9:1 |
| Focus ring: light band against the wall | `#ffe7ae` and `#1c2a22` | 12.3:1 |
| Focus ring: dark band against paper / brass | `#120d09` and `#e9dcc0` / `#cba858` | 14.2:1 / 8.5:1 (5.9:1 at the darkest brass) |
| Locked key against the wall | `#7a8792` and `#1c2a22` | 4.1:1 |
| Dial arrows on the lock's tray | `#f6dfa0` and `#140d06` | 14.7:1 |
| Empty stamp box border on paper | `#4a3b2c` and `#e9dcc0` | 7.9:1 |
| Question-number ring on the wall | `#e8d9b5` at 80% and `#1c2a22` | 7.4:1 |
| Lever's edge on a paper slip | `#4a360f` and `#e9dcc0` | 8.5:1 |
| Name line and code line on paper | `#2a1d14` and `#e9dcc0` | 12:1 |

### How it is built

- **Structure.** One `h1` (the game's title), an `h2` for each screen, `h3` for parts of a room; `header` and `main` landmarks; a skip link. Lists are real lists. Decoration (door, lantern, frames, pins, the mirror) is hidden from assistive technology.
- **Order.** Reading order, Tab order and the order of use match: story, objects, clues, lock, result, hints.
- **Papers.** Stories, clues, hints and results are ordinary text on the page. A short heading button opens each one large in a dialog (labelled, modal, the room behind it inert, Esc closes, focus returns).
- **Locks.** Each dial is a `spinbutton` named "Dial 2 of 5" with a value such as "E, 5 of 26". A labelled text box beside the lock takes the whole code. One plain sentence under every lock says how to work it.
- **States.** The key ring says "you are in room 2 of 5, 1 solved"; each key says solved, you are here, or locked. Switches are `role="switch"`. Stamp boxes and slips are pressed buttons. The counter's result is also in the message.
- **No surprises.** Nothing changes by itself when you choose an option. There is no time limit. Wrong tries cost nothing unless the teacher turns on deductions, and the house rules say so before you start.

### What goes beyond AA

- 1.4.6 Contrast (Enhanced): all reading text measures 7:1 or more. Short labels measure between 5:1 and 14:1, so labels do not all reach 7:1 outside High contrast (where everything is 10:1 or more).
- 1.4.8 Visual presentation: lines are about 80 characters or fewer, text is never justified, and line height is 1.5 for reading text (1.6 in the examine view and with Readable text).
- 2.2.3 No timing; 2.3.3 Animation from interactions can be switched off.
- 2.4.13 Focus appearance; 2.5.5 Target size of 44px for game controls.
- 3.3.5 Help: instructions under every lock, the room description, and the notebook's "How to play".

### Known limitations

1. **No testing with real assistive technology or disabled players yet.** Screen-reader behaviour was checked through the browser's accessibility tree, not by listening to NVDA, JAWS, VoiceOver or TalkBack. Voice control, switch access and screen magnifiers were not tried. Automated tools find only part of what real use finds.
2. **Dials with a touch screen reader.** A custom `spinbutton` may not respond to the adjust gestures in VoiceOver on iOS or TalkBack. The text box next to the lock ("or type the code") does the same job and is the dependable route there.
3. **Teacher-written content is not checked by the game.** A teacher can write clues that depend on colour or position, very long codes, or hard reading. The editor's accessibility check is meant to catch these. Emoji that a teacher adds to portraits are treated as decoration and are not read out.
4. **Short previews on papers.** Sighted players see the first lines of a story or clue and open it to read the rest. The whole text is always on the page for assistive technology and in "Describe this room".
5. **Narrow or zoomed windows put the lock below the objects.** In one-column layout the player scrolls between the clues and the lock. A "more below" mark shows when the room continues.
6. **The certificate still shows the time taken** when the clock is hidden, because teachers may ask for it.
7. **Zoom was tested by window size and font size, not by driving the browser's zoom control.** 200% and 400% zoom were reproduced as 720×450 and 320×256 windows and as a doubled default font size. Safari was covered by Playwright's WebKit, not by Safari on a Mac or iPhone. Forced colours were emulated in Chromium, not checked on Windows with each contrast theme.
8. **Language.** The page is marked as English. A game written in another language should set `meta.lang` in its content; the editor does not have a field for it yet.
9. **Reading level.** The sample content has not been checked for reading level (3.1.5, AAA).
10. **The editor's preview** can show the teacher an answer panel that covers a corner of the room. Students never see it.

### Reporting a problem

If something in the game is hard or impossible to use, please open an issue on this repository's **Issues** page, or tell your instructor, who can pass it on. It helps to say what you were trying to do, what happened, and the browser, device and any assistive technology you use. Access problems are treated as bugs.

---

## Editor

*(The editor's accessibility notes go here.)*
