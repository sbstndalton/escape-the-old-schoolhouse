# Accessibility

*Escape the Old Schoolhouse* is meant to be playable by every student and editable by every teacher.

- **Target:** [WCAG 2.2](https://www.w3.org/TR/WCAG22/) Level AA for the student game and the teacher editor, with Level AAA wherever it was practical (see [What goes beyond AA](#what-goes-beyond-aa)).
- **Status:** the student game meets the target in everything we could test with tools and by hand. It has **not yet been tested by people who use assistive technology every day**, or with a real screen reader. That is the biggest gap, and it is listed first under [Known limitations](#known-limitations).
- **Last reviewed:** November 2026, against the sample game in this repository. An independent audit in November 2026 found problems this page had missed or overstated (listed under [Second review](#second-review-november-2026)); they are fixed, each has a test, and the claims below were corrected.

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
- **You move on when you are ready.** After a lock opens, the result stays on screen and a **Go through the door** plate appears under it, with the keyboard on it. Nothing changes room by itself.
- **Your own text size.** The game never sets the text size from the window. It follows the browser's font-size setting and zoom, up to 400%, and the room becomes one scrolling column when it no longer fits.
- **Keyboard only.** Everything works with Tab, Enter, Space, the arrow keys and Esc. Nothing needs a drag.
- **Windows High Contrast** and other forced-colour modes are supported.

### What was tested, and how

Automated tests run on every change (`npm test`, file `tests/a11y-game.js`). They walk through **20 screens and states**: the title, the house rules held up, each of the five rooms, a clue held up, the room description, the notebook, a wrong try with a hint, a solved room, the plain-cards look, a quiz room, a solved timeline, stamped slips, a later mirror question, the certificate, and the result held up.

| Check | How | Result |
|---|---|---|
| **axe-core 4.14.1** (rules tagged wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa, best-practice) | Every state at 1440×900 and 390×844; again with High contrast, with Readable text, with forced colours emulated, and with `prefers-contrast: more` emulated. 160 scans in Chromium and 20 in WebKit. | **0 violations** |
| **Keyboard only** | A full play-through from the title to the certificate using key presses alone (no pointer events), including reading papers, the room description, the dials by typing and by arrows, moving timeline cards, stamping, the mirror, and the notebook. | Completes |
| **Focus visible and not obscured** (2.4.7, 2.4.11, 2.4.13) | Every focusable control in every state is focused; it must show a focus ring, be inside the window, and be the top element at its centre. In WebKit the same is done by walking the Tab order with real key presses. The teacher's preview, with its answers shown, is checked separately by the editor's tests (centre and four corners of every focused control). | 0 problems |
| **Target size** (2.5.8, 2.5.5) | Every pointer target is measured. | All 24 CSS px or more; game controls (dial arrows, studs, stamps, levers, stamp boxes, handles, papers, close buttons, the watch, the bell, notebook rows) 44 px or more |
| **Text at 200%** (1.4.4) | The root font size is doubled (what a 32px browser default does to a page sized in `rem`), at 1440×900 and 390×844, and also together with Readable text and text spacing. | Nothing cut off, no sideways scrolling, and no text shortened with `line-clamp` |
| **Reflow** (1.4.10) | 320 CSS px wide (1280px at 400% zoom) and 720×450 (1440×900 at 200% zoom). | Nothing cut off, no sideways scrolling |
| **Text spacing** (1.4.12) | Line height 1.5, paragraph spacing 2em, letter spacing 0.12em, word spacing 0.16em forced on everything. | Nothing cut off |
| **Forced colours and High contrast** | Every control, paper, dial window and stamp state must still have a real edge; stamped and empty boxes must look different; dial characters must differ from their window. | 0 problems |
| **Announcements** (4.1.3) | Wrong answers, right answers, "2 of 3" results, moved cards, stamps, typed dial values and hints must appear in the polite live region; the same message twice is announced twice. A right answer stays in the live region (and on screen) until the player presses **Go through the door**, checked after waiting 9 seconds. A new room is announced **once**: focus moves to its heading, and nothing about it is sent to the live region (the test records every text the region holds). After every try the result is inside the window and not under the "more below" tab (390×844, 720×450, 320×256). | Pass |
| **Names, roles, states** (4.1.2, 1.3.1, 2.4.2, 2.4.6) | Page language and titles, one `h1`, heading order (in a matching room: the objects, the clues and the lock each have an `h3`), landmarks, the key ring's summary, dial values, switches, dialogs, the locked hint drawer, stamps, the Draft note's fixed name, the 14 timeline buttons' distinct names, "Play again" asking first, and that the mirror never moves on by itself. | Pass |
| **Instructions** (3.3.2, 1.3.3) | The line under every lock must name the button the player actually presses ("Check answers", "Check order", "Submit", "Pull the shackle", "Next question"), never only a picture ("turn the handle"); matching rooms must say to take the clues in order, and mention decoys when there are any. | Pass |
| **Contrast** (1.4.3, 1.4.6) | Measured from screenshots (median of the letter cores); see below, including the stricter darkest-pixel figures. | All text 4.5:1 or more and all reading text 7:1 or more by the median; not by the darkest pixel (see [Two ways to measure contrast](#two-ways-to-measure-contrast)) |
| **Reduced motion** (2.3.3) | With reduced motion, or the Motion switch off, `document.getAnimations()` must be empty through a whole play-through (`tests/playthrough.js`). | Pass |
| **Screen-reader structure** | The accessibility tree of every state was written out (`ariaSnapshot`) and read top to bottom by hand, checking that every object, its code, the lock and its state make sense in order. Several things were rebuilt because of it (see the last rows of the table below). | Reviewed by hand |
| **Browsers** | Chromium (all tests) and WebKit (axe, the Tab walk, 200% text) through Playwright 1.65. | Pass |

#### Before and after

The same checks were run on the game as it was before this work.

| Area | Before | After |
|---|---|---|
| axe-core violations | 0 (but axe could not judge the contrast of about 850 text nodes on textured backgrounds) | 0 |
| Measured contrast below AA | 27 of 63 text styles at 1440×900 (lowest 2.1:1), 32 of 62 at 390×844 (lowest 1.9:1) | 0 of 74 (lowest 5.0:1) |
| Reading text below 7:1 | 19 of 23 styles | 0 of 28 (lowest 7.5:1) |
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
| Room changes | Focus went to the whole room; no announcement; one page title for everything; the next room appeared by itself 1.2 s after a solve | Only when the player presses **Go through the door**; focus on the new heading, which reads the room out once; a title per screen |
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
| Portrait name plate | 5.7 | 12 | 12 | 16 |
| Portrait dates | 4.6 | 11.3 | 11.4 | 16 |
| Portrait code | 3.8 | 10.3 | 10.2 | 16 |
| Room title plate (brass) | 4.4 | 7.1 | 7.0 | 16 |
| Section label on the wall | 4.4 | 12.5 | 9.0 | 21 |
| Lock name on brass | 4.2 | 11 | 11 | 14 |
| "Pull the shackle to try" | 2.6 | 8.0 | 8.0 | 14 |
| Dial characters | 7.8 | 15.8 | 15.8 | 20.2 |
| Typed code | 4.1 | 9.6 | 9.6 | 20.2 |
| How-to line under the lock | (new) | 13.7 | 13.5 | 21 |
| Code box label ("Type the whole code instead") | (new) | 10.6 | 10.7 | 20 |
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

#### Two ways to measure contrast

The figures above are **typical-stroke** figures. The game's test takes the **median** of the letter cores (the third of changed pixels that changed most); the editor's test takes the **mean of the strongest 12%**. Both describe what most of each letter looks like against what is really behind it. They are not worst-case figures.

The November 2026 audit also measured the stricter way: the **declared text colour against every background pixel inside the text's line box** (text hidden), reporting the median, the 10th percentile and the **darkest pixel**. Re-run on the current build at 1440×900 and 390×844 (text that is hidden from assistive technology left out):

| | Text styles | Lowest median | Below AA by median | Below AA by 10th percentile | Below AA by darkest pixel | Reading text under 7:1 by darkest pixel |
|---|---|---|---|---|---|---|
| Game, before this review | 190 | 5.6:1 | 0 | 1 | 27 | 72 |
| Game, now | 188 | 6.0:1 | 0 | 1 | 17 | 61 |
| Editor, before this review | 212 | 5.6:1 | 0 | 5 | 7 | 41 |
| Editor, now | 232 | 5.6:1 | 0 | 4 | 8 | 44 |

The darkest pixel is very strict here: a line box often touches a pin, a ruled line, a paper's edge or a shadow, so one dark pixel can set it. Most of the "below AA by darkest pixel" cases are of that kind (clue headings next to the red ruled line, the Draft note's wavy underline), but they have **not all been checked by hand**, and a few 10th-percentile results (the clock in one state, the editor's page kicker with the note unfolded, the envelope's "Answer key" label) deserve a look. So the honest summary is: no text is under AA by the typical-stroke measure or by the median; by the darkest pixel, some is.

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
- **Locks.** Each dial is a `spinbutton` named "Dial 2 of 5" with a value such as "E, 5 of 26". A labelled text box beside the lock takes the whole code. A few plain sentences under every lock say how to work it, naming the real button ("Check order", not "turn the handle"); a matching room's also say to take the clues in order.
- **States.** The key ring says "you are in room 2 of 5, 1 solved"; each key says solved, you are here, or locked. Switches are `role="switch"`. Stamp boxes and slips are pressed buttons. The counter's result is also in the message.
- **No surprises.** Nothing changes by itself when you choose an option. There is no time limit. Wrong tries cost nothing unless the teacher turns on deductions, and the house rules say so before you start.

### What goes beyond AA

- 1.4.6 Contrast (Enhanced): all reading text measures 7:1 or more by the median of its letter cores (lowest 7.5:1); by the darkest background pixel some does not. Short labels measure between 5:1 and 14:1, so labels do not all reach 7:1 outside High contrast (where everything is 10:1 or more).
- 1.4.8 Visual presentation: lines are about 80 characters or fewer, text is never justified, and line height is 1.5 for reading text (1.6 in the examine view and with Readable text).
- 2.2.3 No timing: there is no time limit, nothing moves on by itself (a solved room waits for **Go through the door**; the mirror waits for **Next question**), and no message is cleared on a timer (the live region keeps the last message until the next one or a new screen). 3.2.5 Change on request: the room changes only when the player asks. (Until the November 2026 review the room changed by itself 1.2 s after a solve, so these two were not met then.)
- 2.3.3 Animation from interactions can be switched off.
- 2.4.10 Section headings: each room has a heading, and its parts (the objects, the clues, the lock) have their own.
- 2.4.13 Focus appearance; 2.5.5 Target size of 44px for game controls.
- 3.3.5 Help: instructions under every lock, the room description, and the notebook's "How to play".

### Known limitations

1. **No testing with real assistive technology or disabled players yet.** Screen-reader behaviour was checked through the browser's accessibility tree, not by listening to NVDA, JAWS, VoiceOver or TalkBack. Voice control, switch access and screen magnifiers were not tried. Automated tools find only part of what real use finds.
2. **Dials with a touch screen reader.** A custom `spinbutton` may not respond to the adjust gestures in VoiceOver on iOS or TalkBack. The text box next to the lock ("Type the whole code instead") does the same job and is the dependable route there. Typing a character on a dial moves to the next dial; the value set is announced first ("Dial 2: E"), but whether a screen reader speaks it before the next dial's name has not been checked by ear.
3. **Teacher-written content is not checked by the game.** A teacher can write clues that depend on colour or position, very long codes, or hard reading. The editor's accessibility check is meant to catch these. Emoji that a teacher adds to portraits are treated as decoration and are not read out.
4. **Focus and the success message.** After a solve, focus moves to **Go through the door** while the success message is sent to the polite live region. Screen readers normally read the button and then the message, but some may drop the message; it is also on screen right above the button. This needs checking with real screen readers.
5. **Narrow or zoomed windows put the lock below the objects.** In one-column layout the player scrolls between the clues and the lock. A "more below" mark shows when the room continues.
6. **The certificate still shows the time taken** when the clock is hidden, because teachers may ask for it.
7. **Zoom was tested by window size and font size, not by driving the browser's zoom control.** 200% and 400% zoom were reproduced as 720×450 and 320×256 windows and as a doubled default font size. Safari was covered by Playwright's WebKit, not by Safari on a Mac or iPhone. Forced colours were emulated in Chromium, not checked on Windows with each contrast theme.
8. **Language.** The page is marked as English. A game written in another language should set `meta.lang` in its content; the editor does not have a field for it yet.
9. **Reading level.** The sample content has not been checked for reading level (3.1.5, AAA).
10. **The editor's preview with answers shown** puts the answers in a strip above the room, which pushes the room down; the teacher can hide it from the strip or the rail. Students never see it.

### Second review (November 2026)

An independent audit of the game and the editor found these problems. The first version of this page did not catch them, mostly because the tests did not look in the right place (the preview's frame was not scanned, the preview rail was only checked at sizes where it fitted, and the announcement test accepted a room change that cut the success message short). Each is fixed and now has a test.

| Finding | WCAG | Fix |
|---|---|---|
| In the editor's preview, "Show answers" laid a panel over the room that hid focused controls (books, clues and the code box at 390×844) | 2.4.11 | The answers are a labelled `aside` strip in the page flow, above the room, with its own heading and a **Hide answers** button. Tested: no focused control in any room is covered (centre and four corners), at 1440×900 and 390×844 |
| The preview rail collapsed at 320×256 and with 32px text, drawing its buttons over the game | 1.4.10, 1.4.4 | The rail never shrinks below its controls; on short screens the preview scrolls. Tested at 320×256 and with 32px text |
| The editor scrolled sideways at 390px with 32px text | 1.4.10 | The Preview plate and the seals wrap; the envelope's labels sit in the flow. The 200% text test now includes 390×844 |
| A solved room moved on by itself after 1.2 s, cutting off the success message, and the new room was announced twice | 4.1.3; AAA 2.2.3, 3.2.5 | **Go through the door** (see above); the room is announced once, by its heading |
| The result of a try could be out of view, or under the "more below" tab | 1.3.2, 2.4.11 (related) | The result is scrolled into view, clear of the tab, which also steps aside from the focused control |
| The matching rooms' instructions did not say to take the clues in order or that some objects are decoys; other rooms said "turn the handle" though the button is named "Check answers", "Check order" or "Submit" | 3.3.2, 1.3.3 | The instructions say both, and name the real button |
| Smaller issues: "Play again" lost the certificate without asking; the preview took focus into the game; story, clue and result text was cut short (with the text-spacing override, Room 4's note lost its instruction); 14 timeline buttons shared two names; no headings for a matching room's objects and lock; typing on a dial moved on without confirming the value; "or type the code" did not make sense on its own; the Draft note changed its own name; portrait name plates dipped to 3.9:1 at their darkest; editor placeholders looked like typed answers; the mirror's legend ran the number into the question; the quiz text box's error list was not tied to it | various | All fixed as described in this page |

### Reporting a problem

If something in the game is hard or impossible to use, please open an issue on this repository's **Issues** page, or tell your instructor, who can pass it on. It helps to say what you were trying to do, what happened, and the browser, device and any assistive technology you use. Access problems are treated as bugs.

---

## Editor

This section covers the teacher editor (`editor.html`): the **guided steps** it opens on (one question per page, ten steps and a "Your escape room" page to come back to) and **Advanced mode** ("the Curator's workshop", every setting at once). The student game has its own section.

**Target:** WCAG 2.2 Level AA with no exceptions, and Level AAA where practical. Where the art direction and accessibility pulled in different directions, accessibility won; the lamplit workbench look was kept by finding an accessible way to draw it.

### How it was tested

Everything below runs in `npm test` (`tests/a11y-editor.js`, plus the editor tests in `tests/editor.js`), so it can't quietly regress.

| Check | How | Result |
|---|---|---|
| Automated rules | **axe-core 4.14.1**, tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`, `best-practice`, on **every page, tab and overlay**, and **every guided step** (each step and its variants: the error summary on each question page, a revealed second question, the six walkthroughs, the exit-password slip with and without its error, Done, and the "Your escape room" page with two escape rooms and its remove slip: 34 wizard states on a desktop, 35 on a phone; 79 and 82 states in all), plus Advanced mode (45 states on a desktop, 47 on a phone: each room type and tab, questions as text, the answer-key envelope and note open, a help slip open, hints on, accuracy grading, the Accessibility check, the list of room kinds, the phone cabinet and file list, the New / Export / Answer sheet / problems folders, the confirm slips, the preview rail, and the preview showing a room with **Show answers** on). Every frame is scanned as a document of its own: the answer sheet, and the student view inside the preview. | **0 violations** at 1440×900 and 390×844, in each of: the default look, **High contrast**, **Readable text**, emulated **forced colours**, and emulated **prefers-contrast: more** (10 runs). **"Needs review": 0, with three kinds left out on purpose:** `color-contrast` (axe can't work out text over a gradient or texture: about 2,000 nodes per desktop run and 800 per phone run in the default look, 20 to 180 in High contrast and forced colours; their contrast is measured from pixels instead, next row), `frame-tested` (it only says axe didn't enter a frame from the page around it; every frame is scanned on its own) and `heading-order` inside a frame (axe can't see the page around the frame). Before November 2026 the preview's student view was not scanned at all, and this row said "0 needs review" without saying what was left out |
| Contrast | axe can't judge text over gradients and textures, so contrast is **measured from the pixels**: two screenshots of every state, one with the text made transparent, and the painted ink compared with what is behind it (textures, gradients, lamplight and vignette included). **Method:** for each run of text, the average over its strongest 12% of changed pixels (the solid cores of the strokes, not their anti-aliased edges). That is a typical-stroke figure, not a worst-pixel figure; see [Two ways to measure contrast](#two-ways-to-measure-contrast) for the darkest-pixel figures. | About 1,900 runs of text per desktop look and 800 per phone look, none below AA. Default look in Chromium: lowest 6.1:1; everything under 7:1 is placeholder text (6.1 to 6.7:1, lighter on purpose so an example can't pass for an answer) apart from one cabinet label at 6.3:1. Readable text: lowest 4.6:1 (the page kicker over the felt at 390×844), 3 runs under 7:1 on a phone and 22 on a desktop. High contrast: lowest 7.4:1. WebKit draws thinner strokes and was not re-measured after these changes |
| Keyboard (guided steps) | A second **keyboard-only test** with no pointer events completes the guided steps from Welcome to the download: the skip link, radio cards with the arrow keys, Enter to continue from a text box, a question with a second accepted answer, the room's name and story, **Next not checked** and Space on the tick, the two delivery questions, and the exit-password slip (the keyboard starts in its box; Enter takes the suggestion). | Passes. Focus lands on the question at every step |
| Keyboard | A **keyboard-only authoring test** with no pointer events at all: skip link, add a question room, write a question and its answers, press its seal, switch index tab with the arrow keys, name the room, export, and answer the "export a draft?" slip. A second test presses Tab through every control on the main pages and every overlay (about 650 tab stops). | Passes. Every stop shows a 3px focus ring and is never covered by the top rail, the cabinet, a note or a slip (2.4.7, 2.4.11) |
| Dialogs | Delete, replace and "export a draft" slips, the folders, the phone cabinet and the preview: role, name, description, initial focus, Tab loop, Esc, focus return, inert background. No native `confirm()` or `alert()` is ever shown (the tests fail if one appears). | Passes |
| Help slips (1.4.13) | Open on hover and on focus, stay while the pointer is on the mark or the slip, dismissed with Esc without moving pointer or focus. | Passes |
| Target size | Every control measured in every state. | At least 24×24 CSS px everywhere; at least 44×44 on touch screens |
| Text size and reflow | (1) Browser default text size doubled to 32px at 1280×900 and at 390×844, (2) 200% zoom, (3) **320 CSS px wide** (400% zoom), also only 256px tall, (4) the WCAG **text-spacing** override (line height 1.5, letter spacing 0.12em, word spacing 0.16em, paragraph spacing 2em). The preview rail separately: at 320×256 and with 32px text, every rail control must lie inside the rail and off the student view. | No clipped text, no sideways scrolling, nothing lost (1.4.4, 1.4.10, 1.4.12). Until the November 2026 review this was **not** true at 390px with 32px text (the page scrolled sideways) or for the preview rail (it collapsed and its buttons covered the game); neither case was tested then |
| Forced colours and increased contrast | Chromium's emulation of `forced-colors: active` and `prefers-contrast: more`. Every control must keep a real border, outline or underline, and "on" states must differ from "off" states. | Passes |
| Motion | With `prefers-reduced-motion: reduce`, `document.getAnimations()` is empty. No CSS 3D anywhere. | Passes |
| Screen-reader structure | The accessibility tree (`ariaSnapshot()`) of a room page is asserted line by line: landmarks, one `h1`, heading order, names, roles, states and reading order. It was also read through by hand, which found and fixed an unnamed image in the envelope and a drawer whose count was not spoken. | Passes |
| Browsers | Chromium 158 (everything). WebKit 27 (the editor tests, and the accessibility suite except the two checks only Chromium can do: forced colours and the default-text-size setting). | Passes in both |

**Before and after** (default look, both screen sizes together): axe violations 50 → 0; text below AA contrast 288 → 0 (lowest measured 1.9:1 → 7.0:1 at the time; 6.1:1 now that placeholders are deliberately lighter); axe "needs review" 222 → 0 (colour contrast, frame-tested and in-frame heading order left out, as above); tab stops without an outline ring 195 → 0 (text fields used to show only a tint and a thicker underline); controls under 24px (44px on touch) 682 → 0; native browser dialogs 5 → 0.

### The guided steps

- **One question per page.** The question is the page's only `h1`: it is the label of the text box, or the `legend` of the radio choices, so a screen reader reads the question with the field. A short hint sits under it, and a visible **Help with this step** fold (a native disclosure) holds the rest. Nothing is hidden behind hover.
- **Where you are.** The browser tab reads "Step 3 of 10: What is this escape room called? – Escape room maker"; the same "Step 3 of 10" is above the question; the list of steps is an ordered list in a navigation landmark with `aria-current="step"` on the current one (folded away on phones, one tap to open). On every page change the keyboard moves to the question, so it is read straight away.
- **Back works.** Each page has its own address, so the browser's Back and Forward buttons, a reload and a bookmark all land on the right page; every page also has a Back link at the top and a Back button beside **Continue**.
- **Errors.** Continuing with something missing shows "There is a problem" at the top, takes the keyboard there, and starts the tab title with "Error:". Each problem is a link that moves the keyboard to its field; the same words sit by the field, which is marked invalid and described by them. Problems found in the student preview are linked to the page that fixes them.
- **Choices** are real radio buttons in a fieldset, drawn as slips of paper with a ring; the chosen one has a filled ring and a heavier border, not only a colour. A second question that depends on the first (Moodle or Canvas: should it record the grade?) appears under the chosen answer, and the keyboard stays where it was.
- **Nothing happens by itself.** Removing a room, question or card asks first on a slip, with **Go back**/**Cancel** first. Facts are never ticked for you. Continuing with unchecked items shows a note on the page (Check them now / Continue anyway), not a dialog. The exit-password slip is a labelled dialog whose keyboard starts in its box, with a suggestion that can be changed.
- **Announcements:** ticks, added and removed entries, copied text and the exit password are read out through the editor's one polite live region.
- **Where the work is saved** is always on screen: "Saved in this browser at 3:42 pm. Not backed up yet." with **Download a backup**. The browser asks before the page is closed while there are changes that are not in a backup.
- **The same options:** High contrast, Readable text, forced colours, 200% text, 320px reflow and the text-spacing override are tested on every step (see the table above).

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
- **The preview rail and the answer-key envelope** are fully operable and labelled: every rail button has a name, the current room is marked, room changes are announced, and Esc returns focus to the button that opened the preview. Opening the preview leaves focus on **Exit preview**; jumping to a room keeps it on the rail. With **Show answers** on, the answers are a labelled strip in the student view's page flow, above the room (never on top of it), with its own **Hide answers** button.
- **Placeholders** are examples that start with "e.g.", in lighter italic type than what you type (6.4:1 on paper, against 12:1 for typed text), and an empty one-line field has a dashed rule, so an example can't be mistaken for an answer. Every field also has a real label.

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
- **The guided steps have not been tried by teachers yet**, with or without assistive technology. Whether "Step 3 of 10" and the moved focus are read in a helpful order on each screen reader is untested.
- **The guided steps cover two kinds of room.** Quiz questions and Match clues to cards are set up step by step; timeline, sorting and reflection rooms, hints, the lock's own code word, the look of the cards and grading are still set in Advanced mode, which is denser.
- **The Moodle and Canvas instructions** were written from the official guides, not checked against a live course; steps whose menu names may differ say so on the page.
- **Readable text relies on fonts already on the computer.** No extra typeface is embedded in the editor, so the face you get depends on the system.
- **AAA contrast (7:1) is not met for all text.** Measured from pixels (typical stroke), placeholders are 6.1 to 6.7:1 on purpose, one cabinet label is 6.3:1, and with Readable text on a phone the page kicker measures 4.6:1. Measured against the darkest background pixel, more text falls under 7:1 (see [Two ways to measure contrast](#two-ways-to-measure-contrast)). Disabled buttons are dimmer still (they are exempt). High contrast is 7.4:1 or more throughout.
- **Other AAA criteria not met:** the old-book and small-caps faces are still used for short labels unless Readable text is on, and target sizes on a desktop are 24px or more rather than 44px (they are 44px on touch screens).
- **The Accessibility check matches patterns in English.** It will miss problems phrased in ways it doesn't know, and it will sometimes flag wording that is fine ("at the top of his class"). It can't judge reading level, the quality of a hint, or whether a story makes sense without the picture; the "By hand" tab lists what to check yourself.
- **Typing a quiz as text** is one plain text box. It is fully labelled, and mistakes are announced and listed, but a screen-reader user may find the form view easier.
- **Rooms can only be moved up** in the cabinet (move the next room up to move one down).
- **The typed strip that confirms an action** ("Project saved") disappears after six seconds (it stays while the pointer is on it). It is also announced, and nothing depends on it, but because it is timed **the editor does not claim AAA 2.2.3 (No timing)**. The student game does.
- **On short screens the preview scrolls.** At 320×256, or with very large text, the rail takes most of the window and the student view continues below it.
- **Firefox** was not available where the tests ran. The editor uses nothing Firefox lacks (`inert` needs Firefox 112 or later), but it has not been run there.

### Reporting a problem

Open an issue in this repository and say which page of the editor, which browser and assistive technology, and what happened. Accessibility problems are treated as bugs, not requests.
