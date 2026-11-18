# 🏫 Escape the Old Schoolhouse

A browser-based escape room for an introductory **Foundations of Education** course.
Students solve 5 puzzle rooms about educational philosophies and philosophers, then reflect on their own philosophy of education.

- ⏱ Takes about 15–25 minutes
- 💻 Runs in any web browser: Chrome, Edge, Safari, or Firefox
- 🔌 Needs no internet, accounts, or installs
- 🎓 Works in **Moodle** and **Canvas**
- ✏️ Teachers can change every question and answer in a simple editor, and build new escape rooms for other chapters

> ⚠️ **The sample content has not been fact-checked yet.** It was written with AI help and may contain mistakes. Until the instructor checks every item in the editor, students see a "Draft" notice at the top of the game. See [Checking the content](#-checking-the-content).

---

## ⬇️ Download

| File | What it's for |
|---|---|
| [`index.html`](index.html) | The game itself. Double-click it to play. |
| [`editor.html`](editor.html) | **For teachers:** change questions and answers, check content, and export new games. **Don't give this to students**, because it shows the answers. |
| [`EscapeRoom_SCORM.zip`](EscapeRoom_SCORM.zip) | Upload this to Moodle or Canvas for automatic grading. **Don't unzip it.** |
| **Mac app**: under **Releases**, on the right side of the repository page | An optional stand-alone Mac app. See [Mac app](#-mac-app-optional). |

To download a file, click its name above, then click the **download button** (⬇) at the top right of the file view.
To download everything at once, go to the main repository page and click the green **Code** button, then **Download ZIP**.

---

## ✏️ Editing questions and answers (for teachers)

Download **`editor.html`** and double-click it. Everything happens in the browser, with no account and no internet needed.

- **Change anything students see.** Story text, clues, questions, answers, hints, the exit password, and grading are all text boxes.
- **Add, remove, or reorder rooms.** There are five kinds of rooms:
  - **Question lock**: short-answer or multiple-choice questions. All must be right to open the lock. *This one works like a chapter quiz.*
  - **Matching code**: match clues to cards and enter the codes on the cards.
  - **Put in order**: timelines or steps in a process.
  - **Sort into groups**: for example traditional vs. progressive.
  - **Reflection survey**: no wrong answers; shows a result profile on the certificate.
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
- **One escape room per chapter.** Use **New…** to start a blank room or copy the sample. Each escape room is its own file.
- **Preview** plays the game exactly as students see it.
- **Export for students** downloads the game as an `.html` file or a **SCORM `.zip`** for Moodle/Canvas, ready to upload.
- **Save project** downloads your work so you can reopen it later with **Open…**. You can also reopen an exported game `.html` file. The editor also remembers your work in the browser between visits.

---

## ✅ Checking the content

Every gradable item (each card, question, timeline event, sorting item, and reflection result) has a **Source** box and a **✔ I checked this is correct** checkbox.

1. Click **Review sheet** to see or print every room with all the answers.
2. Compare each item with your textbook or other sources. Fix anything that's wrong.
3. Type where you checked it in **Source** (for example, *Ch. 3, p. 45*) and tick **✔ I checked this is correct**.

The counter at the top shows how many items are checked, and the room list shows how many are left in each room. If you edit an item after checking it, it un-checks itself so you look at it again. Until every item is checked, the student game shows a **Draft** notice at the top.

---

## ▶️ Try it yourself first

1. Download `index.html`.
2. Double-click it, and it opens in your browser.
3. If you see code instead, right-click the file → **Open with** → choose your browser.

> Phones and iPads often show the code instead of running the game. Test on a laptop or desktop.

---

## 🔑 The exit password (for auto-graded quizzes)

When students escape, the certificate shows this exit password:

### `DEWEY1916`

**It's the same for every student**, so a one-question quiz can grade it automatically.
(It refers to John Dewey's *Democracy and Education*, 1916.)

---

## 🎓 Put it in Canvas

### Option A: Quiz with the exit password (easiest, auto-graded)
1. **Files** → **Upload** → choose `index.html`.
2. **Pages** → **+ Page**. Type *"Start the escape room,"* highlight it, and click **Link** → **Course Links** → **Files** → `index.html`. Click **Save & Publish**.
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
1. **Add an activity or resource** → **File** → upload `index.html` → set **Display** to *Open* → **Save**.
2. **Add an activity or resource** → **Quiz** → add a **Short answer** question with the correct answer `DEWEY1916`. Moodle short-answer questions ignore capitalization by default.

**Check it as a student:** In either platform, use **Student View** (Canvas) or **Switch role to → Student** (Moodle) to play it the way students will.

---

## 🍎 Mac app (optional)

The game also comes as a small native Mac app called **Escape the Old Schoolhouse.app**. It opens in its own window, works offline, and has a working **Print certificate** button. The puzzles are exactly the same as in the browser version.

### Download it
1. On this repository's main page, look on the right side for **Releases** → **Mac app (latest)**.
2. Download **`EscapeTheOldSchoolhouse-mac.zip`** and double-click it to unzip.
3. Drag **Escape the Old Schoolhouse** into your **Applications** folder. This step is optional.

### The first time you open it
The app isn't registered with Apple, so the first time you open it, macOS will warn you that it *"cannot verify the developer."* This is normal for small free apps. To open it:

- **macOS 15 (Sequoia) or newer:** Double-click the app, then click **Done**. Open **System Settings** → **Privacy & Security**, scroll down, and click **Open Anyway** next to the message about the app. Enter your password.
- **macOS 14 or older:** **Right-click** (or Control-click) the app → **Open** → **Open**.

You only have to do this once.

### Or build it yourself on your Mac
If you build the app on your own Mac, you won't get the warning at all.

1. Download this repository: click the green **Code** button → **Download ZIP**, then unzip it.
2. Open **Terminal** (press ⌘-Space and type *Terminal*).
3. If you've never installed Apple's free developer tools, run this once:
   ```bash
   xcode-select --install
   ```
4. Type `bash ` (with a space after it), then drag the **`mac/build.sh`** file into the Terminal window and press **Return**.
5. The finished app appears in the **`mac/build`** folder.

Requires macOS 11 (Big Sur) or newer. It runs on both Apple Silicon and Intel Macs.

> **For classes, the browser version or SCORM version is still the best choice.** The Mac app can't report grades to Moodle or Canvas. Students who play it can type the exit password into your course quiz.

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
| `npm run serve` | Runs the game at http://localhost:8080 |
| `npm run build` | Rebuilds `index.html`, `editor.html`, and `EscapeRoom_SCORM.zip` from `src/` and `content/` |
| `npm test` | Builds, then plays the whole game and drives the editor automatically, and saves screenshots to `tests/screenshots/` |

**Browser control (MCP):** the `.mcp.json` file gives Claude Code the **Playwright** browser tools. The first time you open Claude Code in this folder, it asks whether to allow the `playwright` server. Say yes. After that you can ask things like *"Play the escape room on a phone-sized screen and tell me what's confusing,"* or *"Add a sixth room about Horace Mann and test it."* The `CLAUDE.md` file tells Claude the rules for this project.

The tests also run automatically on GitHub every time the game or editor changes.

**How the files fit together:** the game's code is in `src/game.html`, the editor's is in `src/editor.html`, shared logic is in `src/shared.js`, and the sample escape room's content is in `content/foundations-of-education.json`. `npm run build` combines them into the files at the top of the repository. Don't edit `index.html` or `editor.html` directly.

---

## 🗝️ Answer key (instructors only)

| Room | Puzzle | Answer |
|---|---|---|
| 1 · Library | Match 5 philosophies to their descriptions | **LEARN** |
| 2 · Portrait Gallery | Match clues to Dewey, Montessori, Freire, and Mann | **9154** |
| 3 · History Hall | Put the events in order | Plato → Rousseau (1762) → Mann (1837) → Montessori (1907) → Dewey (1916) → Freire (1968) → Adler (1982) |
| 4 · Observation Room | Label 8 classroom scenes | T, P, T, P, T, P, T, P (top to bottom) |
| 5 · Mirror | Self-reflection survey | Any answers are accepted. Gives a personal philosophy profile. |

Students get 2–3 hints per room. By default, wrong guesses and hints don't lower the grade; you can change that under **Finish & grading** in the editor. The editor's **Review sheet** always shows the current answers, including for escape rooms you've changed.

---

## ℹ️ Good to know

- **Privacy:** The game runs entirely in the student's browser. It doesn't send data anywhere, except that SCORM reports completion, score, and time to *your own* Moodle or Canvas gradebook.
- **Answers are only lightly hidden.** Everything runs in the student's browser, so a tech-savvy student could dig the answers out of the game file. That's fine for practice and low-stakes quizzes, but don't rely on it for high-stakes tests.
- **Editing:** use `editor.html` (see [Editing questions and answers](#️-editing-questions-and-answers-for-teachers)). Don't edit `index.html` by hand; it's generated.
