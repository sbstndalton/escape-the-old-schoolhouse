# 🏫 Escape the Old Schoolhouse

A browser-based escape room for an introductory **Foundations of Education** course.
Students solve 5 puzzle rooms about educational philosophies and philosophers, then reflect on their own philosophy of education.

- ⏱ Takes about 15–25 minutes
- 💻 Runs in any web browser: Chrome, Edge, Safari, or Firefox
- 🔌 Needs no internet, accounts, or installs
- 🎓 Works in **Moodle** and **Canvas**
- ✏️ Teachers can change every question and answer in a simple editor, and build new escape rooms for other chapters
- ♿ Built to [WCAG 2.2 AA](ACCESSIBILITY.md): keyboard and screen-reader support, your own text size, High contrast, Readable text, no time limit

> **Teachers: start at the website, <https://sbstndalton.github.io/escape-the-old-schoolhouse/>.** Press **I'm a teacher → Make an escape room** and follow the steps. When it's ready, you get a **class link** to paste into Moodle, Canvas, Google Classroom or an email. Students click it and play; the exit password on their certificate goes into a one-question quiz for the grade. The **[printable quick-start guide](https://sbstndalton.github.io/escape-the-old-schoolhouse/guide.html)** puts all of that on one page to keep beside your screen. Nothing on the rest of this page is needed for that.

> ⚠️ **The sample content has not been fact-checked yet.** It was written with AI help and may contain mistakes. Until the instructor checks every item in the editor, students see a "Draft" notice at the top of the game. See [Checking the content](#-checking-the-content).

---

## 🚪 The front page and class links

The website's front page has two doors:

- **I'm a student:** paste a class link (or just click the one your teacher shared), or play the sample escape room.
- **I'm a teacher:** make an escape room (the guided steps), open one you saved before, the **Printable quick-start guide**, and a short "How it works".

A **class link** is the whole escape room packed into one web address (`…/play.html#play=1.…`). Nothing is uploaded or stored anywhere: the part after `#` never reaches a web server. That also means:

- **Changing the escape room means sharing a new link.** The old link keeps opening the old version.
- **The link is a backup.** In the maker, choose **Open one I saved before** and paste it to get the escape room back.
- **Long links:** the sample is about 7 KB of link, which Moodle, Canvas and email handle fine. Over about 30 KB (very long texts), the maker warns that some systems may cut it off and suggests the file instead. Short links also get a QR code.

---

## ⬇️ Download

| File | What it's for |
|---|---|
| [`index.html`](index.html) | The front page (the website's start page). |
| [`play.html`](play.html) | The game with the sample escape room. Double-click it to play. It also plays any class link. |
| [`editor.html`](editor.html) | **For teachers:** change questions and answers, check content, and export new games. **Don't give this to students**, because it shows the answers. |
| [`EscapeRoom_SCORM.zip`](EscapeRoom_SCORM.zip) | Upload this to Moodle or Canvas for automatic grading. **Don't unzip it.** |
| [`accessibility.html`](accessibility.html) | The accessibility statement as a page (made from `ACCESSIBILITY.md`). |
| [`guide.html`](guide.html) | **For teachers:** the one-page quick-start guide. Press **Print this guide**: it fits one page on Letter or A4. |

To download a file, click its name above, then click the **download button** (⬇) at the top right of the file view.
To download everything at once, go to the main repository page and click the green **Code** button, then **Download ZIP**.

---

## ✏️ Editing questions and answers (for teachers)

Open the website and press **I'm a teacher → Make an escape room**, or download **`editor.html`** and double-click it. Everything happens in the browser, with no account and nothing sent anywhere.

**Print the [quick-start guide](https://sbstndalton.github.io/escape-the-old-schoolhouse/guide.html)** (also on the front page as **Printable quick-start guide**, and in the editor's help): the seven steps from opening the maker to the exit-password quiz and your backup, plus what to do if something goes wrong, on one page.

### Start here: the guided steps

The first time you open the editor, it takes you through **10 short steps**, one question per page:

1. **Welcome**: what an escape room is and what you'll do.
2. **How to start**: change the sample, start with an empty escape room, or open one you saved before (a backup file, or a class link you shared).
3. **Name it**: the title students see, and your course.
4. **Your rooms**: add, remove and order rooms. Quiz questions and Match clues to cards are set up right in the steps; the other kinds open in Advanced mode.
5. **Fill in each room**: your questions (with other accepted spellings) or your cards and clues ("Students will open the lock with LEARN"), then what students read.
6. **Check your facts**: every item in one list. Say where you checked it and tick it. Nothing is ever ticked for you.
7. **Try it as a student**: play it the way students will.
8. **How students get it**: **Share a class link** (recommended: works anywhere), Moodle, Canvas, another course system, or a file.
9. **Put it in your course**: make the class link (with **Copy link**, **Open it as a student**, and a QR code when it is short enough) or download the right file, then numbered steps with the menu names for your system, your exit password with a **Copy** button, and the quiz question ready to paste.
10. **Done**: a summary with **Change** links, a reminder to keep your backup, and **Print a card for this escape room**: one page with its name, rooms, exit password, quiz question, the date of your last backup and how to change it later.

Every step has **Back**, **Continue**, **Help with this step**, **Save and finish later**, and **Show all settings (Advanced mode)**. When you come back to the editor in the same browser, it opens on **Your escape room**: a list of what's done and what's left, plus **Your escape rooms** (every escape room in this browser), **Make another escape room** and **Make a copy of this one**.

**Where your work is saved.** As you type, the editor saves in *this browser on this computer only*. The line at the top says so ("Saved in this browser at 3:42 pm. Not backed up yet."). Press **Download a backup** to keep a copy of your own: the backup is the game file itself, so it plays in any browser and opens again in the editor (choose **Open one I saved before**). The browser warns you before you close the page with changes that aren't in a backup yet.

**The exit password.** Before you download a file for students, the editor makes sure your escape room has its own exit password. If it has none, or it is a changed copy of the sample still using `DEWEY1916`, it asks "What should the exit password be?" and suggests one from your title.

### Advanced mode (all settings)

**Show all settings** opens the full editor described below; **Guided steps** in its file list takes you back. Both work on the same escape room.

The editor looks like a curator's workbench at night. The **cabinet** on the left has one drawer for each room, plus Settings, Story & intro, and Finish & grading. On a phone, tap the brass **Rooms** handle at the top to slide the cabinet out. The drawer you pick is laid out on paper in the middle, with index tabs along the top (for example *Cards & clues*, *Lock*, *Room text*, *Hints*). A small **ⓘ** next to a label opens a short explanation (point at it, tap it, or reach it with the Tab key; **Esc** puts it away).

**The editor is built to be used by everyone.** Everything works from the keyboard alone, with a visible focus ring. Screen readers get real labels, groups and announcements. Before anything is deleted or replaced, the editor asks on its own slip (never a browser pop-up), with **Cancel** selected first. At the foot of the cabinet are two switches, remembered in your browser: **High contrast** (plain black-on-white, heavier outlines; it also follows your system's contrast setting) and **Readable text** (a plain, larger typeface with more spacing). The editor works at 200% text size, at 400% zoom and on a phone, and it is styled for Windows High Contrast (checked with the browser's emulation, not yet on Windows). See [ACCESSIBILITY.md](ACCESSIBILITY.md) for what was tested and what still falls short.

- **Change anything students see.** Story text, clues, questions, answers, hints, the exit password, and grading are all lines you type on.
- **Add, remove, or reorder rooms.** **Add a room** in the cabinet lists the five kinds of rooms:
  - **Question lock**: short-answer or multiple-choice questions. All must be right to open the lock. *This one works like a chapter quiz.*
  - **Matching code**: match clues to cards and enter the codes on the cards.
    - Choose a **Look of the cards** for each matching room: *Plain cards* (index cards in a catalogue drawer), *Books on a shelf* (the code is the gilt letter on each spine), or *Framed portraits* (the code is on a brass plate; each painting is signed with the card's initials, and the card's icon appears as a small emblem). The look changes the picture only, never the puzzle or the answer. Books suit short names. A name over 48 characters makes that room fall back to plain cards.
  - **Put in order**: timelines or steps in a process.
  - **Sort into groups**: for example traditional vs. progressive.
  - **Reflection survey**: no wrong answers; shows a result profile on the certificate.
- **Animation and sound are optional for students.** Dials click, locks spring open, doors part between rooms, and the certificate gets a wax seal. Students can switch animation off with **Motion** in the notebook (click the pocket watch or press **Esc**), and sound off with the bell at the top right. Motion is off automatically on devices set to "reduce motion", and the game works the same either way. The notebook also has **High contrast**, **Readable text** and **Hide the clock**. See [Accessibility](#-accessibility).
- **Type a whole quiz as text.** In a Question lock room, click **Edit all questions as text** and write:
  ```text
  Q: Who wrote Democracy and Education (1916)?
  A: John Dewey | Dewey

  Q: Which philosophy is built around the "Great Books"?
  - Essentialism
  * Perennialism
  - Existentialism
  ```
  `A:` lists accepted answers (separate alternatives with `|`; capitals and punctuation are ignored). For multiple choice, mark the right answer with `*`.
- **One escape room per chapter.** Use **New…** to start a blank room or copy the sample. The escape room you had open stays in this browser too (find it under **Guided steps**, *Your escape rooms*), so a new one never overwrites the last.
- **See the answers.** Every room has an **Answer key** envelope beside the page (only in the editor). Click it to open the key; it updates as you type. **Answer sheet** shows every room's answers on one page, ready to print.
- **Accessibility check.** The **Accessibility check** drawer (at the end of the cabinet) reads what you wrote and lists things that often shut students out: directions that depend on colour, position, shape or sound ("the red book", "on the left"), words like "click" or "drag", time pressure, a lock with more than 8 dials, missing titles or instructions, symbols or emoji used as the only meaning, very long clues and reading-heavy rooms, typed answers with only one accepted spelling, long lists to order or sort, and rooms with no hints. Each note says where it is, why it matters, and what to do; clicking it takes you to the spot. The notes are advice only. They never stop you previewing or exporting, and they are printed at the end of the **Answer sheet**.
- **Hints (optional).** Hints are **off** until you switch them on for a room. Each room can have **two hints** that you write. Students can't open a hint straight away: hint 1 unlocks after 1 wrong try and hint 2 after 3 wrong tries in that room (you can change these numbers in **Settings**). The editor warns you if a hint gives away the answer.
- **Preview as student** opens the game exactly as students see it, full screen. The brass rail at the top is just for you: jump to any room, switch **Show answers** on or off, **Restart**, or **Exit preview** (or press **Esc**). Each room also has a **Preview this room** button. Nothing in the preview is saved or graded.
- **Export for students** has **Copy class link**, and downloads the game as an `.html` file or a **SCORM `.zip`** for Moodle/Canvas, ready to upload.
- **Download a backup** (at the foot of the cabinet) downloads the game `.html`, which reopens with **Open…**. **Save project** downloads the same content as a `.json` file. The editor also remembers your work in this browser between visits, and the line at the foot of the cabinet says when it last saved and whether it is backed up.

---

## ✅ Checking the content

Every gradable item (each card, question, timeline event, sorting item, and reflection result) has a **Source** line and a wax seal labelled **I checked this is correct**.

1. Click **Answer sheet** to see or print every room with all the answers.
2. Compare each item with your textbook or other sources. Fix anything that's wrong.
3. Type where you checked it in **Source** (for example, *Ch. 3, p. 45*) and press the seal, **I checked this is correct**.

The brass plate at the top shows how many items are checked (for example *31 / 40 checked*), and each drawer label shows that room's count (for example *3/8*, or a tick when the room is done). A pinned note on the page says how many items are still unchecked; click it for the full explanation. If you edit an item after checking it, it un-checks itself so you look at it again. Until every item is checked, the student game shows a **Draft** notice at the top.

---

## ▶️ Try it yourself first

1. On the website, press **Play the sample escape room**. Or download `play.html` and double-click it: it opens in your browser.
2. Class links open in any up-to-date browser (Chrome, Edge, Firefox, Safari).
3. If you see code instead, right-click the file → **Open with** → choose your browser.

> Phones and iPads often show the code instead of running the game. Test on a laptop or desktop.

### How it plays
The game is one night-time scene per room. Everything is an object you handle:

- **Papers** (clue cards, books, portraits, the story note): click one to read it up close. **Esc** or the close button puts it back.
- **Describe this room:** a button under each room's title that lists everything in the room as plain text.
- **Combination padlock:** take the clues in order; the codes they point to, in that order, open the lock. Turn each dial with its arrows, a drag, the scroll wheel or the arrow keys, or type the whole code in the box. Then press **Pull the shackle** (or **Enter**).
- **Other locks:** press the handle on the door (its button is named **Check answers**, **Check order** or **Submit**). A small counter shows how many you got right.
- **After a lock opens** the result stays on screen until the student presses **Go through the door**. Nothing moves on by itself.
- **Sorting slips:** click a slip, then press a rubber stamp. Each slip also has its own boxes to stamp.
- **Timeline cards:** move them with the round up and down buttons, or drag a card by its number.
- **The mirror:** choose an answer, then press **Next question**.
- **Key ring** (top left): one key per room. A key turns brass and gets a tick when you escape its room.
- **Pocket watch** (top right): opens the notebook (so does **Esc**): sound, motion, high contrast, readable text, hide the clock, start over. There is no time limit; the clock only shows how long you have played.
- **A tall room scrolls.** On a phone or a small window the room is one column. A "more below" mark shows when there is more to see.

Everything also works from the keyboard (**Tab**, **Enter**, **Space**, arrow keys, **Esc**).

### ♿ Accessibility
The game follows your browser's text size and zoom, works with the keyboard alone and with screen readers, and supports Windows High Contrast. In the notebook you can switch on **High contrast** and **Readable text** (plain letters, larger, more space), switch off **Motion** and **Sound**, and **hide the clock**. What was tested, the measured contrast figures, and the known limits are in **[ACCESSIBILITY.md](ACCESSIBILITY.md)**.

---

## 🔑 The exit password (for auto-graded quizzes)

When students escape, the certificate shows this exit password:

### `DEWEY1916`

**It's the same for every student**, so a one-question quiz can grade it automatically.
(It refers to John Dewey's *Democracy and Education*, 1916.)

---

## 🔗 Share it as a class link (Moodle, Canvas, Google Classroom, email)

The guided steps (step 8, **Share a class link**) make the link and show the steps. In short:

- **Moodle:** **Add an activity or resource** → **URL** → paste the link into **External URL** → **Save and return to course**.
- **Canvas:** **Modules** → **+** → **External URL** → paste it into **URL**, tick **Load in a new tab** → **Add Item**.
- **Google Classroom or email:** paste the link into a post or a message.

For the grade, add a one-question quiz with the exit password as the answer (below). Menus can differ by version.

---

## 🎓 Put it in Canvas

### Option A: Quiz with the exit password (easiest, auto-graded)
1. **Files** → **Upload** → choose `play.html`.
2. **Pages** → **+ Page**. Type *"Start the escape room,"* highlight it, and click **Link** → **Course Links** → **Files** → `play.html`. Click **Save & Publish**.
3. **Quizzes** → **+ Quiz**. Add one **Fill in the Blank** question:
   *"Enter the exit password from the escape room certificate."*
   Correct answer: `DEWEY1916`. Add `dewey1916` as a second correct answer in case students type lowercase.
4. Publish the quiz.

### Option B: SCORM (auto-graded, may need your Canvas admin)
1. **Settings** → **Navigation** → drag **SCORM** into the visible list → **Save**.
   *If SCORM isn't there, ask your Canvas administrator to turn it on.*
2. Click **SCORM** in the course menu → upload `EscapeRoom_SCORM.zip` → choose **Import as a graded assignment**.
3. Publish the assignment. Students get 100% when they escape.

---

## 🎓 Put it in Moodle

### Option A: SCORM (auto-graded)
1. Turn on **Edit mode** → **Add an activity or resource** → **SCORM package**.
2. Name it, then drag `EscapeRoom_SCORM.zip` into **Package file**.
3. *Optional:* under **Appearance**, set **Display package** to *New window*.
4. **Save and display**. Students get 100% in the gradebook when they escape.

*If "SCORM package" isn't in the list, ask your Moodle administrator to enable it, or use Option B.*

### Option B: File and quiz with the exit password
1. **Add an activity or resource** → **File** → upload `play.html` → set **Display** to *Open* → **Save**.
2. **Add an activity or resource** → **Quiz** → add a **Short answer** question with the correct answer `DEWEY1916`. Moodle short-answer questions ignore capitalization by default.

**Check it as a student:** In either platform, use **Student View** (Canvas) or **Switch role to → Student** (Moodle) to play it the way students will.

---

## 🛠️ Improving the game with Claude Code (optional)

The repository is set up so **Claude Code** can open the game in a real browser, play it, and check its own changes.

**One-time setup** (needs [Node.js](https://nodejs.org)):
```bash
npm install
```
```bash
npx playwright install chromium
```

**Useful commands:**
| Command | What it does |
|---|---|
| `npm run serve` | Serves the site at http://localhost:8080 (front page; the game is `/play.html`, the maker `/editor.html`) |
| `npm run build` | Rebuilds `index.html`, `play.html`, `editor.html`, `accessibility.html` and `EscapeRoom_SCORM.zip` from `src/`, `content/` and `ACCESSIBILITY.md` |
| `npm test` | Builds, then plays the whole game, tests class links and the front page (`tests/links.js`), drives the editor and its guided steps automatically (`tests/editor.js`, `tests/wizard.js`), and runs the game's and the editor's accessibility tests (several minutes). Screenshots go to `tests/screenshots/` |
| `npm run test:a11y` | Builds, then runs only the accessibility tests (`tests/a11y-game.js` and `tests/a11y-editor.js`) |

**Browser control (MCP):** the `.mcp.json` file gives Claude Code the **Playwright** browser tools. The first time you open Claude Code in this folder, it asks whether to allow the `playwright` server. Say yes. After that you can ask things like *"Play the escape room on a phone-sized screen and tell me what's confusing,"* or *"Add a sixth room about Horace Mann and test it."* The `CLAUDE.md` file tells Claude the rules for this project.

The tests also run automatically on GitHub every time the game or editor changes.

**How the files fit together:** the game's code is in `src/game.html`, the editor's is in `src/editor.html`, the front page is `src/front.html`, the statement page's frame is `src/statement.html`, shared logic (including class links and the QR code maker) is in `src/shared.js`, and the sample escape room's content is in `content/foundations-of-education.json`. `npm run build` combines them into the files at the top of the repository. Don't edit `index.html`, `play.html`, `editor.html` or `accessibility.html` directly.

---

## 🗝️ Answer key (instructors only)

| Room | Puzzle | Answer |
|---|---|---|
| 1 · Library | Match 5 philosophies to their descriptions | **LEARN** |
| 2 · Portrait Gallery | Match clues to Dewey, Montessori, Freire, and Mann | **9154** |
| 3 · History Hall | Put the events in order | Plato → Rousseau (1762) → Mann (1837) → Montessori (1907) → Dewey (1916) → Freire (1968) → Adler (1982) |
| 4 · Observation Room | Label 8 classroom scenes | T, P, T, P, T, P, T, P (top to bottom) |
| 5 · Mirror | Self-reflection survey | Any answers are accepted. Gives a personal philosophy profile. |

Hints are **off** in the sample. Each room has two ready-made hints that point students in the right direction without giving the answer; turn them on per room in the editor. By default, wrong guesses and hints don't lower the grade; you can change that under **Finish & grading**. The editor's answer key and **Answer sheet** always show the current answers, including for escape rooms you've changed.

---

## ℹ️ Good to know

- **Privacy:** The game runs entirely in the student's browser. It doesn't send data anywhere, except that SCORM reports completion, score, and time to *your own* Moodle or Canvas gradebook. A class link carries the escape room inside the link itself; the part after `#` is never sent to a web server.
- **Class links can be made by anyone.** The game treats what a link carries as untrusted: it is size-limited, cleaned, checked, and every text is shown as plain text, never as code.
- **Answers are only lightly hidden.** Everything runs in the student's browser, so a tech-savvy student could dig the answers out of the game file. That's fine for practice and low-stakes quizzes, but don't rely on it for high-stakes tests.
- **Editing:** use `editor.html` (see [Editing questions and answers](#️-editing-questions-and-answers-for-teachers)). Don't edit `index.html` or `play.html` by hand; they're generated.
- **Facts vary by source:** some details differ between references. For example, *The Republic* is usually dated between 380 and 370 BCE, and Freire wrote *Pedagogy of the Oppressed* in Chile around 1967–68. Check them against your own textbook.
