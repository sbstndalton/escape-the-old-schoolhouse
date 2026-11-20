/* The answer sheet and the teacher card: plain, printable pages (strings), shown in a folder in an iframe and printed from there. */
import { S, ER, contrastOn, readableOn, sampleUnchecked, unbacked } from "./store.js";
import { a11yCheck, a11yGroups, A11Y_BY_HAND } from "./check.js";
import { QUIZ_Q, ROOM_KIND, deliveryWords } from "./words.js";
export function answerSheetHtml(){
  const E = ER.esc, F = ER.fmt;
  const chk = it => `<span class="ck${it.verified ? " on" : ""}" role="img" aria-label="${it.verified ? "Checked" : "Not yet checked"}"></span>`;
  const src = it => it.source ? `<div class="src">Source: ${E(it.source)}</div>` : `<div class="src none">Source: <span aria-hidden="true">________________________</span><span class="sr">not written yet</span></div>`;
  const rooms = S.cfg.rooms.map((r, i) => {
    let body = "";
    if (r.type === "matching") { const m = ER.matching(r);
      body = `<p><strong>Lock combination:</strong> <code>${E(m.answer)}</code> · Cards shown as: ${({ books: "books on a shelf", portraits: "framed portraits" })[ER.look(r)] || "plain cards"}</p><ol>${r.cards.map(c => `<li>${chk(c)} <strong>${F(c.term)}</strong>${c.detail ? ` (${F(c.detail)})` : ""}, code <code>${E(m.code[r.cards.indexOf(c)])}</code><br>${c.clue ? "Clue: " + F(c.clue) : "<em>Decoy card (no clue)</em>"}${src(c)}</li>`).join("")}</ol>`; }
    if (r.type === "quiz") body = `<ol>${r.questions.map(q => `<li>${chk(q)} ${F(q.prompt)}<br><strong>Answer:</strong> ${q.kind === "choice" ? (q.choices || []).filter(c=>String(c).trim()).map((c, j) => j === q.correct ? `<u><strong>${F(c)}</strong></u> (correct)` : F(c)).join(" · ") : E(q.answers)}${src(q)}</li>`).join("")}</ol>`;
    if (r.type === "ordering") body = `<p>Correct order:</p><ol>${r.items.map(it => `<li>${chk(it)} ${F(it.text)}${it.label ? ` <strong>(${F(it.label)})</strong>` : ""}${src(it)}</li>`).join("")}</ol>`;
    if (r.type === "sorting") body = `<ol>${r.items.map(it => `<li>${chk(it)} ${F(it.text)} → <strong>${E(r.categories[it.category] || "?")}</strong>${src(it)}</li>`).join("")}</ol>`;
    if (r.type === "reflection") body = `<p>Results:</p><ol>${r.profiles.map(p => `<li>${chk(p)} <strong>${E(p.name)}</strong>: ${F(p.desc)}${p.who ? `<br>Thinkers: ${F(p.who)}` : ""}${p.next ? `<br>Next step: ${F(p.next)}` : ""}${src(p)}</li>`).join("")}</ol>
      <p>Questions:</p><ol>${r.questions.map(q => `<li>${chk(q)} ${F(q.prompt)}<ul>${(q.options||[]).map(o => `<li>${F(o.text)} → ${E((r.profiles.find(p => p.key === o.profile) || {}).name || "?")}</li>`).join("")}</ul>${src(q)}</li>`).join("")}</ol>`;
    const hints = (r.hints || []).filter(x => String(x).trim()).length ? `<p class="hints"><strong>Hints${r.hintsEnabled ? "" : " (switched off)"}:</strong></p><ol class="hints">${r.hints.filter(x => String(x).trim()).map(x => `<li>${F(x)}</li>`).join("")}</ol>` : "";
    return `<section><h2><span>Room ${i+1}</span> ${E(r.title || "Untitled")}</h2>${r.story ? `<p class="story">${F(r.story)}</p>` : ""}${r.reference ? `<p>Reference shown to students: ${F(r.reference)}</p>` : ""}${body}${hints}</section>`;
  }).join("");
  const st = ER.reviewStatus(S.cfg);
  const notes = a11yCheck(S.cfg), groups = a11yGroups(notes);
  const check = `<section id="a11y"><h2><span>Before you publish</span> Accessibility check</h2>` + (notes.length
    ? `<p>${notes.length} ${notes.length === 1 ? "note" : "notes"} on what is written. These are advice, not errors.</p>` + [...groups].map(([title, items]) => `<h3>${E(title)}</h3><ul class="notes">${items.map(n => `<li><strong>${E(n.where.replace(/^Room \d+ · /, ""))}</strong>${n.quote ? ` <em>“${E(n.quote)}”</em>` : ""}<br>${E(n.text)}</li>`).join("")}</ul>`).join("")
    : `<p>Nothing flagged in what is written.</p>`) + `<h3>By hand</h3><ul class="notes">${A11Y_BY_HAND.map(x => `<li>${E(x)}</li>`).join("")}</ul></section>`;
  const fonts = document.getElementById("fonts")?.textContent || "";
  const hc = contrastOn(), big = readableOn();
  const READ = big ? `"Atkinson Hyperlegible",Verdana,"Segoe UI","Helvetica Neue","DejaVu Sans",Arial,sans-serif` : `Georgia,"Iowan Old Style","Palatino Linotype","Book Antiqua","DejaVu Serif","Times New Roman",serif`;
  const HEAD = big ? READ : `"IM Fell English",Georgia,serif`, CAPS = big ? READ : `"IM Fell English SC",Georgia,serif`;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Answer sheet: ${E(S.cfg.meta.title)}</title><style>${fonts}</style><style>
    html{color-scheme:light}
    body{font-family:${READ};max-width:44rem;margin:2rem auto 3rem;padding:0 1.5rem;color:${hc ? "#000" : "#1b140d"};background:${hc ? "#fff" : "#f4ecd8"};line-height:${big ? 1.7 : 1.6};font-size:${big ? "1.15rem" : "1.02rem"}${big ? ";letter-spacing:.02em;word-spacing:.06em" : ""}}
    h1{font-family:${HEAD};font-weight:400;font-size:2rem;line-height:1.2;margin:0 0 .5rem;padding-bottom:.6rem;border-bottom:3px double currentColor}
    h2{font-family:${HEAD};font-weight:400;font-size:1.45rem;line-height:1.25;margin:2.4rem 0 .5rem;padding-bottom:.25rem;border-bottom:1px solid currentColor;break-after:avoid}
    h2 span{font-family:${CAPS};font-size:.95rem;letter-spacing:.14em;display:block}
    h3{font-family:${CAPS};font-weight:400;font-size:1.05rem;letter-spacing:.1em;margin:1.4rem 0 .2rem;break-after:avoid}
    ol{padding-left:1.7rem} li{margin:.7rem 0;break-inside:avoid} ul li{margin:.3rem 0} ul.notes{padding-left:1.2rem} ul.notes li{margin:.6rem 0}
    .ck{display:inline-block;width:.95em;height:.95em;border:2px solid currentColor;vertical-align:-.12em;margin-right:.25em;position:relative}
    .ck.on::after{content:"";position:absolute;left:.2em;top:-.2em;width:.36em;height:.8em;border:solid ${hc ? "#000" : "#7d1717"};border-width:0 3px 3px 0;transform:rotate(40deg)}
    .src{font-size:.92rem;color:${hc ? "#000" : "#3d3124"};margin-top:.15rem}
    .story{font-style:italic;color:${hc ? "#000" : "#3d3124"}} .hints{font-size:.95rem;color:${hc ? "#000" : "#3d3124"}}
    .sr{position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
    code{font-family:"Special Elite",ui-monospace,Menlo,Consolas,"Courier New",monospace;font-size:1.05em;letter-spacing:.08em;text-decoration:underline;text-underline-offset:.2em}
    strong{font-weight:${big || hc ? 700 : 400};text-decoration:underline;text-underline-offset:.18em} u{text-decoration-style:double}
    :focus-visible{outline:3px solid currentColor;outline-offset:2px}
    @media print{body{margin:0;max-width:none;padding:0;font-size:10.5pt;background:none}}</style></head><body><main>
    <h1>Answer sheet: ${E(S.cfg.meta.title)}</h1>
    <p>${S.cfg.meta.course ? E(S.cfg.meta.course) + " · " : ""}${st.verified} of ${st.total} items checked · an empty box means not yet checked · ${notes.length} accessibility ${notes.length === 1 ? "note" : "notes"} (at the end)<br>
    Exit password: <code>${E(S.cfg.finish?.exitPassword || "(none)")}</code> · Grading: ${S.cfg.scoring?.mode === "deductions" ? "accuracy" : "completion"}</p>
    <p><em>Check every item against your textbook or sources.${sampleUnchecked(S.cfg) ? " The sample content was written with AI help and can contain mistakes." : ""} Mark items as checked in the editor.</em></p>
    ${rooms}${check}</main></body></html>`;
}
/* The teacher card: one printed page about one escape room (its name, rooms, exit password, last backup, and how to
   change it later), so the password can still be found a month on. Offered on the guided steps' Done page. */
export function teacherCardHtml(){
  const E = ER.esc, day = t => new Date(t).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const pw = String(S.cfg.finish?.exitPassword || "").trim(), st = ER.reviewStatus(S.cfg), d = S.meta.delivery || {}, L = S.meta.link;
  const hc = contrastOn(), big = readableOn();
  const READ = big ? `"Atkinson Hyperlegible",Verdana,"Segoe UI","Helvetica Neue","DejaVu Sans",Arial,sans-serif` : `Georgia,"Iowan Old Style","Palatino Linotype","Book Antiqua","DejaVu Serif","Times New Roman",serif`;
  const row = (k, v) => `<tr><th scope="row">${k}</th><td>${v}</td></tr>`;
  const backup = S.meta.backupAt ? `${day(S.meta.backupAt)}${unbacked() ? " (you have changed it since: download a new backup)" : ""}` : "No backup downloaded yet";
  const link = L && L.url ? `<br>Class link made on ${day(L.at)}${L.rev !== S.meta.rev ? " (you have changed the escape room since: make a new link)" : ""}` : "";
  const site = E(ER.SITE);
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Teacher card: ${E(S.cfg.meta?.title || "Untitled")}</title><style>
    html{color-scheme:light}
    body{font-family:${READ};max-width:44rem;margin:1.5rem auto 2.5rem;padding:0 1.5rem;color:${hc ? "#000" : "#1b140d"};background:#fff;line-height:${big ? 1.65 : 1.5};font-size:${big ? "1.12rem" : "1.02rem"}${big ? ";letter-spacing:.02em;word-spacing:.06em" : ""}}
    h1{font-size:1.7rem;line-height:1.2;margin:0 0 .3rem}
    .sub{margin:0 0 1rem;padding-bottom:.6rem;border-bottom:3px double currentColor}
    h2{font-size:1.2rem;margin:1.3rem 0 .4rem;padding-bottom:.15rem;border-bottom:1px solid currentColor}
    table{border-collapse:collapse;width:100%} th,td{text-align:left;vertical-align:top;padding:.4rem .5rem;border-bottom:1px solid #6b5a44}
    th{width:11rem;font-weight:700}
    code{font-family:ui-monospace,Menlo,Consolas,"Courier New",monospace;font-size:1.25em;font-weight:700;letter-spacing:.08em}
    ol{margin:.2rem 0;padding-left:1.5rem} li{margin:.15rem 0}
    .warn{font-weight:700}
    @page{margin:14mm}
    @media print{body{margin:0;max-width:none;padding:0;font-size:11pt}}</style></head><body><main>
    <h1>Teacher card: ${E(S.cfg.meta?.title || "Untitled")}</h1>
    <p class="sub">${S.cfg.meta?.course ? E(S.cfg.meta.course) + " · " : ""}Printed on ${day(Date.now())}. <span class="warn">Keep it away from students: it has the exit password.</span></p>
    <table><tbody>
    ${row("Exit password", pw ? `<code>${E(pw)}</code>${S.meta.pwOld && S.meta.pwOld !== pw ? `<br>Changed on ${day(S.meta.pwAt)}. Before that it was <code>${E(S.meta.pwOld)}</code>: keep it as a second correct answer in your quiz.` : ""}` : "Not chosen yet")}
    ${row("Quiz question", E(QUIZ_Q) + "<br>The answer is the exit password. Set the quiz to ignore capital letters.")}
    ${row("Rooms", `<ol>${S.cfg.rooms.map(r => `<li>${E(r.title || "Untitled")} (${E(ROOM_KIND[r.type] || r.type)})</li>`).join("")}</ol>`)}
    ${row("How students get it", E(deliveryWords() || "Not chosen yet") + link)}
    ${row("Facts checked", `${st.verified} of ${st.total}`)}
    ${row("Last backup", backup)}
    </tbody></table>
    <h2>Where your work is</h2>
    <p>Saved only in the browser you made it in. Your backup file${d.where === "link" ? " or your class link" : ""} brings it back on any computer.</p>
    <h2>How to change it later</h2>
    <ol>
      <li>Go to ${site} and choose “Open one I saved before”. (In the browser you made it in, it is also under “Your escape rooms”.)</li>
      <li>Choose your backup file${d.where === "link" ? " or paste your class link" : ""}, and make the change.</li>
      <li>${d.where === "link" ? "Make a new class link and share it instead of the old one: the old link keeps opening the old version." : "Download it again and replace the old file in your course."}</li>
      <li>To change the exit password, open it and choose “Change the exit password”. Then change the answer in your quiz, and keep the old password as a second correct answer.</li>
    </ol>
    <p>All the steps: the quick-start guide at ${site}guide.html</p>
    </main></body></html>`;
}
