# Screen-reader test script

This is a step-by-step check of *Escape the Old Schoolhouse* with a real screen reader. You don't need any testing experience. A teacher or a student helper can do it in about an hour.

A **screen reader** is a program that reads the screen aloud and lets people use a computer or phone without seeing it. Our automated tests check what a screen reader is *given*, but no one has yet listened to it with a real one (see [ACCESSIBILITY.md](ACCESSIBILITY.md#known-limitations)). That is what this script is for.

**How to use it:** do the tasks in order. For each one, do what it says and listen. Under **What you should hear** are the words the screen reader should say. The exact wording around them can differ between screen readers (one says "button", another "push button"), and that's fine. Tick the box if it works. If it doesn't, write it down (see [If something's wrong](#if-somethings-wrong)) and carry on.

You can stop speech at any time with **Control** (computer) or a **two-finger tap** (phone).

---

## Before you start

### Pick a pair

Screen readers work best with certain browsers. Please use one of these pairs:

- **VoiceOver + Safari** on a Mac, iPhone or iPad
- **NVDA + Firefox** or **NVDA + Chrome** on Windows
- (optional) **TalkBack + Chrome** on Android

### The addresses

- Front page: <https://sbstndalton.github.io/escape-the-old-schoolhouse/>
- Test escape room (one quiz room with hints, made for this script): [open the test escape room](https://sbstndalton.github.io/escape-the-old-schoolhouse/play.html#play=1.fZJBaxtBDIX_itC1g2lNTnsJbckhEEqIDT0EH8azWs-Q3dFG0sZ1Xf_3orVJUgq5zszT-97THFFTpiFi8yXgQBaxOaIV6wkbXCUhqiAUWxIwUsOAiSdRv72XmKwkwlPAUk3YpWosB2zwK2hmMSBNcSQQ5gE6FkiZ0lOpO7BMsIsDwb5Yhgj63msBtwY5KnC9aOdXtmd4nkitcFWItZ1PcqmmC6foSi2aHYN-FbuPqnuWFhu8u12tb35cLR2fxEpXUjS6K9VznFXUzkj6f-RTQEdQbB6PaIfRNc9T-Y3htah1JliTGjwwDxjeWqi6J4EtW34Hbgw8Up39WmZZYMA5xE2N255abEwmupxh84gPFFugmN6GQNzFUkF73vcH1ztBV0QN4tmzKESo07D1Nr_zVA24woEnga7UHYkucBPwlWpO91Sq1zWvDgOOwsNo2ODPHM0nLuETLK9hfRhppr_Mx4BnV8UGr_50PImXwJMkbwcDvpCUrni0LvZKp_DqlTL7H_rHrKQM3LmD0jlI4p7l2tc3P59b-dZPrlt7ZxhwRS9UPVJiEUqGzeePGTanzekv)

**Start fresh.** Some things only happen on a first visit. Use a **private window** so the site treats you as new: Safari: File → New Private Window. Firefox: Ctrl+Shift+P. Chrome: Ctrl+Shift+N. Close it and open a new one to start again.

### The answers (so you can get through quickly)

The sample escape room: Room 1 `LEARN` · Room 2 `9154` · Room 3, oldest to newest: Plato, Rousseau, Horace Mann, Montessori, Dewey, Freire, Adler · Room 4, slips 1 to 8: Traditional, Progressive, Traditional, Progressive, Traditional, Progressive, Traditional, Progressive · Room 5: any answers.

The test escape room: question 1 `4`, question 2 `Blue`.

---

## How to start each screen reader

### VoiceOver on a Mac (with Safari)

- **Turn on or off:** Cmd+F5. (On a Mac with Touch ID you can also hold Cmd and press Touch ID three times.)
- **The VO keys:** Control+Option held together. Below, "VO+Right Arrow" means hold Control+Option and press Right Arrow.
- **Move through the page:** VO+Right Arrow (next), VO+Left Arrow (back). **Read from here:** VO+A.
- **Press a button or link:** VO+Space. **Tab** also moves between controls.
- **Next heading:** VO+Cmd+H.
- **The rotor** (a menu of headings, links and form controls): VO+U. Left and Right Arrow change the list, Up and Down choose, Enter goes there, Esc closes it.
- **One setting first:** in Safari, open Settings → Advanced and tick **Press Tab to highlight each item on a webpage**. Without it, Tab skips links.

### VoiceOver on an iPhone or iPad (with Safari)

- **Turn on:** Settings → Accessibility → VoiceOver. Or ask Siri: "Turn on VoiceOver".
- **Quick on and off:** set Settings → Accessibility → Accessibility Shortcut to VoiceOver. Then triple-click the side button (or the Home button on older phones).
- **Move:** swipe right with one finger (next), swipe left (back). Touching the screen reads what is under your finger.
- **Press:** double-tap anywhere.
- **Change a value** (such as a dial): swipe up or down with one finger.
- **The rotor:** twist two fingers on the screen like turning a dial, and pick **Headings**. Then swipe down to go to the next heading.
- **Type:** double-tap a text box, and the keyboard opens.

### NVDA on Windows (with Firefox or Chrome)

- **Get it:** NVDA is free. Download it from [nvaccess.org](https://www.nvaccess.org/download/) (you can skip the donation) and install it.
- **Start:** Ctrl+Alt+N. **Quit:** Insert+Q.
- **The NVDA key** is Insert. (If you chose the laptop layout, it can be Caps Lock.)
- **Two modes.** In **browse mode** NVDA reads the page and single letters jump around: **H** next heading (Shift+H back), **B** next button, **F** next form field, **K** next link, **D** next landmark. In **focus mode** your keys go to the page instead, for typing and arrow keys. NVDA usually switches by itself when you reach a box or a control (you hear a soft click). To switch yourself: **Insert+Space**.
- **Move:** Tab and Shift+Tab between controls; Down Arrow line by line in browse mode. **Read from here:** Insert+Down Arrow. **Press:** Enter or Space.
- **Window title:** Insert+T.
- **Tip: the Speech Viewer** shows everything NVDA says as text, so you can copy it. Press Insert+N, then Tools → Speech viewer.

### TalkBack on Android (optional, with Chrome)

- **Turn on:** Settings → Accessibility → TalkBack. Or hold both volume keys for three seconds, if that shortcut is on.
- **Move:** swipe right (next) and left (back). **Press:** double-tap.
- **Headings:** open the reading controls (swipe up then down, or on newer phones swipe up or down with three fingers) and choose **Headings**; then swipe down to go to the next one.

---

## Part 1: The front page

Open the front page in a **private window**, with your screen reader on.

**1. The first-visit window**

- [ ] **Do:** open the front page. A window opens by itself, asking about settings.
- **What you should hear:** "Before you start: make it easier to use?", as a heading, inside a dialog.

**2. The switches in that window**

- [ ] **Do:** move through the window (Tab, or swipe right). Turn **Readable text** on, then off again.
- **What you should hear:** each switch's name, that it is a **switch** (some screen readers say "toggle button"), and **on** or **off**: "Readable text", "High contrast", "Motion", "Sound", "Listen buttons (read aloud)", "Hide the clock". Motion, Sound and Listen buttons start **on**. After each switch, one line says what it does. When you press it, you should hear it change to on or off.
- [ ] Near the end: "Using a screen reader, switch control or keyboard? Everything works with them; there's nothing to turn on."

**3. Leave the window**

- [ ] **Do:** press **Continue**.
- **What you should hear:** the window closes and you are back on the page. It should not open again when you reload the page. (The button **Accessibility options**, at the foot of the page, opens it again.)

**4. The two doors**

- [ ] **Do:** move by headings (NVDA: H; Mac: VO+Cmd+H; iPhone: rotor on Headings, swipe down).
- **What you should hear:** "Escape rooms for your class, in the browser" (heading level 1), then "I'm a student" and "I'm a teacher" (level 2), then "How it works" (level 3).

**5. Paste a class link that isn't one**

- [ ] **Do:** go to the box **Or paste your class link here**, type `hello`, then Tab to the button **Open my escape room** and press it.
- **What you should hear:** you are taken back to the box, which is now marked **invalid**, and then: "That doesn't look like a class link. A class link is a long web address with “#play=” in it. Ask your teacher to send it again."
- [ ] **Also try:** press Enter while you are still in the box, instead of the button. Write down whether you hear the message.

**6. Paste a real class link**

- [ ] **Do:** copy the [test escape room link](#the-addresses), paste it in the box, and press **Open my escape room**.
- **What you should hear:** a new page opens: the test escape room, "Screen reader test".

---

## Part 2: The game

Use the sample: on the front page, choose **Play the sample escape room**. (Some tasks use the test escape room instead; they say so.)

**7. The first screen and Begin**

- [ ] **Do:** read the first screen from the top. Type a name in the box, then press **Begin**.
- **What you should hear:** the heading "The Door Clicks Shut Behind You…", the story, the box "Sign the guest ledger (your name, for the certificate)", **House rules**, and a button "Begin, push to enter".

**8. Each room's heading**

- [ ] **Do:** after Begin, just listen. Do the same each time you go into a new room.
- **What you should hear:** "Room 1 · The Library", heading level 2, read once by itself (the keyboard is put on it). The window title is "Room 1 of 5: The Library · Escape the Old Schoolhouse" (NVDA: Insert+T). The room should **not** be announced twice.
- [ ] At the top of the page, a list named like "Rooms: you are in room 1 of 5, 0 solved".

**9. Describe this room**

- [ ] **Do:** under the room's text, press **Describe this room**. Read it, then press **Esc** (on a phone: the **Put it back** button).
- **What you should hear:** a dialog "Room description", starting on the button **Put it back**, then the heading "Room 1 of 5: The Library" and lists of everything in the room: "Code L: Essentialism", "Clue 1: All students should master…" and how the lock works. After Esc you are back on **Describe this room**.

**10. Books and clues (Room 1)**

- [ ] **Do:** move through the room.
- **What you should hear:** a heading "Books on the shelf", then buttons such as "Code L: Essentialism"; a heading "Card Catalog", then "Clue 1", "Clue 2"… each followed by the clue's text.

**11. The dial lock (Room 1)**

- [ ] **Do:** find the heading "Library lock". Tab to the first dial and press Up Arrow. (NVDA: if the arrow moves you somewhere else, press Insert+Space first. iPhone: swipe up.)
- **What you should hear:** "Dial 1 of 5", a dial (Mac: "stepper"; NVDA: "spin button"), "blank" at first, then "A, 1 of 26" after Up Arrow.
- [ ] **Do:** Tab to "Dial 2 of 5" and type the letter `E`.
- **What you should hear:** "Dial 2: E", and the keyboard moves on to "Dial 3 of 5". (Write down if you hear only one of the two, or them in the other order.)
- [ ] **Or type the whole code:** the box "Type the whole code instead" takes the whole code at once. On a phone this is the easier way.

**12. A wrong try**

- [ ] **Do:** type `XXXXX` in "Type the whole code instead", then press **Pull the shackle**.
- **What you should hear:** "The lock won't budge. Check which philosophy matches each description." (The words depend on the room; in your own escape room they are the teacher's.)

**13. A right answer, then the door**

- [ ] **Do:** type `LEARN` in the box and press **Pull the shackle**.
- **What you should hear:** "Click! The library door swings open." and the keyboard lands on the button **Go through the door**. Nothing moves on by itself.
- [ ] Write down the order you heard them in, and whether you heard the message at all. (This is one we most need checked.)
- [ ] **Do:** press **Go through the door**. **Hear:** "Room 2 · The Portrait Gallery". Room 2 is the same kind of lock: portraits such as "Plato c. 428–348 BCE Code 7", four dials, code `9154`.

**14. The timeline (Room 3)**

- [ ] **Do:** move through the cards. Press one card's **Move up** button.
- **What you should hear:** each card as "Position 1 of 7: …", followed by two buttons named with the card and its place, such as "Move up: Rousseau publishes Émile, arguing that children learn best through nature and experience. (now 2nd of 7)". After pressing: "Moved to position 1 of 7: Rousseau publishes Émile…". The top card's Move up and the bottom card's Move down are dimmed (unavailable).
- [ ] **Do:** press **Check order** before they are all right. **Hear:** something like "2 of 7 are in the correct position."
- [ ] **Do:** put them in order (see [the answers](#the-answers-so-you-can-get-through-quickly)) and press **Check order**. **Hear:** "The timeline lights up and the lock drops open!"

**15. The sorting stamps (Room 4)**

- [ ] **Do:** on "Slip 1", press **Traditional** in the group "Stamp slip 1 as".
- **What you should hear:** "Traditional", and that it is now **pressed** (or "selected").
- [ ] **The other way:** press the button **Slip 2** (you hear "Slip 2 · picked up"), then go to the group "Rubber stamps: they stamp the slip you picked up" and press **Progressive stamp**. **Hear:** "Slip 2 stamped Progressive. Slip 3 is picked up."
- [ ] **Do:** stamp the rest and press **Submit**. **Hear:** "Sharp eye! The observation room door opens."

**16. The mirror (Room 5)**

- [ ] **Do:** choose an answer and press **Next question**.
- **What you should hear:** the question as a group, "Question 1 of 6: The main purpose of school is to…", then the choices as radio buttons. After **Next question**, the keyboard is on the first choice of question 2, and you hear "Question 2 of 6: …". It never moves on by itself.
- [ ] On the last question the button is **Look into the mirror**. **Hear:** "The mirror shimmers and becomes a doorway…", then **Go through the door**.

**17. The certificate and the exit password**

- [ ] **Do:** go through the last door.
- **What you should hear:** "You Escaped!" (heading), then a group "Certificate" with your name, and "Exit password (enter this in your course quiz)" followed by **DEWEY1916**.
- [ ] **Do:** press **Play again** once. **Hear:** "Play again? Your certificate and exit password will be lost. Press again to start over." (Don't press it again.)

**18. The notebook and its switches**

- [ ] **Do:** press **Esc** (on a phone: the button "Notebook: settings and help" at the top).
- **What you should hear:** a dialog "Notebook", with the keyboard on **Back to the room**. Then switches: "Sound", "Motion", "High contrast", "Readable text", "Read aloud buttons" (with a button "Reading speed: normal" under it), "Hide the clock", and the button **Start over**.
- [ ] **Do:** switch **Sound** off. **Hear:** "Sound is off." (Motion says "Animations are off.", High contrast "High contrast is on.", Hide the clock "The clock is hidden.") Switch them back.
- [ ] **Do:** press Esc again. **Hear:** you are back in the game, on the notebook button.
- If your device has no offline voice, "Read aloud buttons" and "Reading speed" are replaced by: "Read aloud isn't available in this browser…". That's expected, and the game has no Listen buttons then (skip task 19).

**19. A Listen button, with the screen reader on**

- [ ] **Do:** on a paper (a story note or a clue), press its **Listen** button.
- **What you should hear:** the button is named "Listen to the note" (or "Listen to Clue 1"). After you press it, a second voice (the game's own) starts reading, and the button's name becomes "Stop reading the note". Press it again to stop.
- **Both voices may talk at once.** That is expected: Listen is for students who want it, and it is their choice. Check only that nothing starts reading unless you press Listen, and that the screen reader itself is not cut off or silenced afterwards.

**20. Quiz questions and hints (test escape room)**

The sample has no quiz room and no hints, so use the [test escape room](#the-addresses).

- [ ] **Do:** press Begin and move through the room.
- **What you should hear:** a group "1. What is 2 + 2? Type the number." with a box "Answer to question 1"; a group "2. Which of these is a color?" with radio buttons "Blue", "Table", "Seven"; the button **Check answers**; and a button "Hint drawer: take hint 1", **dimmed** (unavailable), with "Unlocks after 1 more wrong try."
- [ ] **Do:** answer `5` and **Table**, and press **Check answers**. **Hear:** "0 of 2 answers are correct." The hint button is no longer dimmed.
- [ ] **Do:** press the hint button. **Hear:** "Hint 1: Read each question again slowly."
- [ ] **Do:** answer `4` and **Blue**, and press **Check answers**. **Hear:** "Every answer is right. The lock opens!", then **Go through the door**. The certificate shows the exit password **LISTEN42**.

---

## Part 3: The maker (guided steps)

On the front page, choose **Make an escape room**. (In a private window the first-visit window from task 1 opens first; press **Continue**.)

**21. "Step N of 10" on each step**

- [ ] **Do:** press **Start**, and listen on each new page.
- **What you should hear:** the page's question, read by itself as a heading: "How do you want to start?". The line just above it says "Step 2 of 10": move back one line to hear it (NVDA: Up Arrow in browse mode; Mac: VO+Left Arrow; iPhone: swipe left). The window title starts with it too: "Step 2 of 10: How do you want to start? – Escape room maker" (NVDA: Insert+T).

**22. The error summary**

- [ ] **Do:** without choosing anything, press **Continue**.
- **What you should hear:** "There is a problem" and a link "Choose how you want to start". The window title now starts with "Error:". Pressing the link takes you to the first choice. Next to the choices you also hear "Error: Choose how you want to start".

**23. Radio cards**

- [ ] **Do:** move through the choices with the arrow keys.
- **What you should hear:** each choice as a radio button with its title and description, such as "Change the sample “Escape the Old Schoolhouse”, about the foundations of education: five rooms, ready to play…", and "1 of 3". Choose **Change the sample** and press **Continue**.
- [ ] On the next page, "What is this escape room called?" is both the heading and the name of the box. Type a new name and press **Continue**.

**24. Check your facts**

- [ ] **Do:** go to step 6: in the list of steps near the top ("All 10 steps"), choose **Check your facts**. Find the first checkbox and press Space.
- **What you should hear:** a checkbox named "I checked this is correct (room 1, card 1)", then "Checked: room 1, card 1. 1 of 45 checked." The button **Next not checked** takes you to the next one.

**25. The exit-password slip and Copy link**

- [ ] **Do:** in the list of steps, choose **How students get it** (step 8). Choose **Share a class link (recommended)**, then Continue. Press **Make the class link**.
- **What you should hear:** a dialog "What should the exit password be?", with the keyboard already in the box "Exit password" (a suggestion is filled in). Press **Use this password**: "The exit password is now …". Then a second slip, "Share a draft?", with the keyboard on **Go back**; press **Make the link anyway**.
- [ ] **Hear:** "Your class link is ready. Copy it with the Copy link button." The keyboard is in the box "Your class link".
- [ ] **Do:** press **Copy link**. **Hear:** "The class link copied."

**26. Change the exit password later**

- [ ] **Do:** press Continue to reach **Done** ("Your escape room is ready"). Beside "Exit password", press the link **Change** (its full name is "Change the exit password").
- **What you should hear:** the keyboard is in a box named "What should the exit password be?", holding the current password.
- [ ] **Do:** type a new password and press **Save the new password**. **Hear:** "Your new exit password is saved", then a numbered list under "What to do now": the old password for students who already finished, changing your quiz answer, keeping the old one as a second correct answer, and that your class link still has the old password.

---

## If something's wrong

Please write down:

1. **The page:** the front page, the game (which room) or the maker (which step), and the task number from this script.
2. **What you did:** the keys or gestures you used.
3. **What you heard,** word for word if you can (NVDA's Speech Viewer helps), and **what you expected** to hear.
4. **Your setup:** the screen reader and its version, the browser and its version, and the device (for example: NVDA 2025.3, Firefox 145, Windows 11; or VoiceOver, Safari, iPhone, iOS 26).

Then send it as described under **Reporting a problem** in [ACCESSIBILITY.md](ACCESSIBILITY.md#reporting-a-problem): open an issue on this project's GitHub **Issues** page, or give it to the instructor who shared the escape room. Every problem with access is treated as a bug.

Thank you. This is the most useful accessibility check the project can get.
