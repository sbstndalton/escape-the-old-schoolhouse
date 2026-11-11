# 🏫 Escape the Old Schoolhouse

A browser-based escape room for an introductory **Foundations of Education** course.
Students solve 5 puzzle rooms about educational philosophies and philosophers, then reflect on their own philosophy of education.

- ⏱ Takes about 15–25 minutes
- 💻 Runs in any web browser: Chrome, Edge, Safari, or Firefox
- 🔌 Needs no internet, accounts, or installs
- 🎓 Works in **Moodle** and **Canvas**

---

## ⬇️ Download

| File | What it's for |
|---|---|
| [`index.html`](index.html) | The game itself. Double-click it to play. |
| [`EscapeRoom_SCORM.zip`](EscapeRoom_SCORM.zip) | Upload this to Moodle or Canvas for automatic grading. **Don't unzip it.** |

To download a file, click its name above, then click the **download button** (⬇) at the top right of the file view.
To download everything at once, go to the main repository page and click the green **Code** button, then **Download ZIP**.

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

## 🗝️ Answer key (instructors only)

| Room | Puzzle | Answer |
|---|---|---|
| 1 · Library | Match 5 philosophies to their descriptions | **LEARN** |
| 2 · Portrait Gallery | Match clues to Dewey, Montessori, Freire, and Mann | **9154** |
| 3 · History Hall | Put the events in order | Plato → Rousseau (1762) → Mann (1837) → Montessori (1907) → Dewey (1916) → Freire (1968) → Adler (1982) |
| 4 · Observation Room | Label 8 classroom scenes | T, P, T, P, T, P, T, P (top to bottom) |
| 5 · Mirror | Self-reflection survey | Any answers are accepted. Gives a personal philosophy profile. |

Students get 2–3 hints per room, and wrong guesses are unlimited.

---

## ℹ️ Good to know

- **Privacy:** The game runs entirely in the student's browser. It doesn't send data anywhere, except that SCORM reports completion, score, and time to *your own* Moodle or Canvas gradebook.
- **Answers are only lightly hidden** in the code, so a tech-savvy student could find them. That's fine for a low-stakes activity.
- **Editing:** Open `index.html` in any text editor. The clues, hints, timeline events, and classroom scenes are written in plain English inside the `<script>` section. If you change the game, rebuild the SCORM zip with `index.html` and `imsmanifest.xml` together.
