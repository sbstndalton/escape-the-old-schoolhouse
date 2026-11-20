/* What both modes do with the escape room as a whole: start or open one, back it up, check it before students get
   it (problems, the exit password, unchecked items), make a class link, and show the preview, answer sheet and card. */
import { S, ER, SAMPLE, clone, changed, saveNow, saveMeta, backedUp, download, gameHtml, fileName, rerender, say, stripCheck,
  lsGet, keyOf, switchTo, contrastOn, readableOn, prefSet, applyDisplay, mqForced, isHttp } from "./store.js";
import { Icon } from "./controls.jsx";
import { ask, tell, toast, overlay, closeFolder, askPasswordSlip, previewOpen, modalOpen, modalClose } from "./layers.jsx";
import { answerSheetHtml, teacherCardHtml } from "./sheets.js";
import { TYPES } from "./rooms.jsx";
import { WIZ, renderWizard, problemsLinked } from "./wizard.jsx";

/* A backup is the game file itself: it plays in any browser, and it opens again in this editor. */
export function backup(){
  download(`${fileName(S.cfg.meta?.title)} (backup).html`, gameHtml(), "text/html"); backedUp();
  toast("Backup downloaded to your Downloads folder. Keep it somewhere safe. To work on it again, open it in this editor.");
}
export function blankConfig(){
  const cfg = S.cfg;
  return { schema: 1, meta: { title: "New Escape Room", course: cfg.meta?.course || "", codePrefix: cfg.meta?.codePrefix || "", learningOutcome: "" },
    intro: { heading: "You're locked in!", story: "Solve every room to escape." },
    scoring: { mode: "completion", hintPenalty: 5, wrongPenalty: 2, minScore: 50 },
    finish: { exitPassword: "", certificateLine: "escaped by mastering this chapter", instructions: "" },
    rooms: [TYPES.quiz.blank()] };
}
export function parseSaved(text, name){
  const next = /\.json$/i.test(name) ? JSON.parse(text) : ER.configFromHtml(text);
  if (!next || !Array.isArray(next.rooms)) throw new Error("This file doesn't contain an escape room.");
  return ER.cleanConfig(next);
}
/* Put a new escape room on the bench (from the sample, empty, or a file). */
export async function startEscapeRoom(next, fromFile){
  if (S.saveTimer) saveNow();
  const text = JSON.stringify(next), same = fromFile && S.lib.list.find(e => lsGet(keyOf(e.id)) === text);
  if (same) { switchTo(same.id); toast(`“${next.meta?.title || "Untitled"}” was already in this browser, so it is open now.`); return true; }
  // a new entry in the list, unless the open one was only just started and never changed (then it is simply replaced)
  if (!(S.stored && S.meta.startRev === S.meta.rev)) S.curId = null;
  S.cfg = next; S.sel = "settings"; S.tabOf.clear(); S.meta = { rev: 0, backupRev: 0, backupAt: 0, savedAt: 0, reached: 3 };
  changed(); if (fromFile) backedUp(); else saveNow();
  S.meta.startRev = S.meta.rev; saveMeta();
  return true;
}

/* ---------- checks before students get it ---------- */
export function showErrors(errs){
  overlay({ title: "Returned: needs fixing", describe: "errors-list", body: () => <div className="sheet"><h2 id="errors-title">Fix these before previewing or exporting</h2>
    <div className="errors" id="errors-list"><ul>{errs.map((e, i) => <li key={i}>{e}</li>)}</ul></div></div> });
}
export async function checkReady(action){
  const errs = ER.validate(S.cfg);
  if (errs.length) { showErrors(errs); return false; }
  const st = ER.reviewStatus(S.cfg);
  if (st.unverified && action === "export") return ask("Export a draft?",
    [`${st.unverified} of ${st.total} items haven't been checked yet.`, "Students will see a “Draft” notice saying answers may contain errors."], { ok: "Export anyway", cancel: "Go back" });
  return true;
}
/* ---------- the exit password: never empty, and never the sample's on someone else's escape room ---------- */
export const SAMPLE_PW = String(SAMPLE.finish?.exitPassword || "");
const withoutPw = c => stripCheck({ ...c, finish: { ...(c.finish || {}), exitPassword: "" } }).replace(/,?"decoy":(true|false)/g, "");
const sameAsSample = c => withoutPw(c) === withoutPw(SAMPLE);
export function needsPassword(){
  const pw = String(S.cfg.finish?.exitPassword || "").trim();
  if (!pw) return true;
  return pw === SAMPLE_PW && S.meta.pwOk !== pw && !sameAsSample(S.cfg);
}
export function suggestPassword(){
  const words = String(S.cfg.meta?.title || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().match(/[A-Z0-9]+/g) || [];
  const num = words.find(w => /^\d+$/.test(w)) || "";
  const word = words.find(w => /^[A-Z]{3,}$/.test(w) && !["THE", "AND", "FOR", "ESCAPE", "ROOM"].includes(w)) || "CLASS";
  let s = word.slice(0, 8) + (num ? num.slice(0, 4) : "ESCAPE");
  if ((/O/.test(s) && /0/.test(s)) || (/[IL]/.test(s) && /1/.test(s)) || s === SAMPLE_PW) s = word.slice(0, 8) + "ESCAPE";
  return s;
}
export const askPassword = () => askPasswordSlip({ old: String(S.cfg.finish?.exitPassword || "").trim(), suggest: suggestPassword() });
/* Before any file for students is made: nothing that would stop a room working, an exit password of its own,
   and a word about unchecked items. Used by Advanced mode's Export and by the guided steps. */
export async function readyToDownload(what = "file"){
  const errs = ER.validate(S.cfg);
  if (errs.length) {
    if (S.mode === "wizard") { WIZ.errors = problemsLinked(); renderWizard("errors"); } else showErrors(errs);
    return false;
  }
  if (needsPassword()) {
    const pw = await askPassword(); if (pw == null) return false;
    S.cfg.finish = S.cfg.finish || {}; S.cfg.finish.exitPassword = pw; S.meta.pwOk = pw; changed(); saveNow();
    say(`The exit password is now ${pw}.`);
  }
  const st = ER.reviewStatus(S.cfg);
  if (st.unverified) return ask(what === "link" ? "Share a draft?" : "Download a draft?",
    [`${st.unverified} of ${st.total} items haven't been checked yet.`, "Students will see a “Draft” notice saying answers may contain errors."], { ok: what === "link" ? "Make the link anyway" : "Download anyway", cancel: "Go back" });
  return true;
}

/* ---------- class links ----------
   The whole escape room packed into the game's address (ER.toLink): play.html#play=1.<data>. Nothing is uploaded;
   the part after # never reaches a web server. A link is made on request (after the same checks as a download), and
   kept in this escape room's bookkeeping (meta.link) with the change count it was made at, so the steps can say
   when it is out of date: a link holds the version it was made from, and changing the escape room needs a new one. */
export const playBase = () => isHttp() ? new URL("play.html", location.href).href.split(/[?#]/)[0] : ER.SITE + "play.html";
export const linkWords = kind => ({ "not-link": "That isn't a class link. A class link is a long web address with “#play=” in it.",
  incomplete: "This class link is incomplete: part of it is missing. Copy the whole link and paste it again.",
  newer: "This class link was made with a newer version of the maker.", "old-browser": "This browser is too old to open class links. Try an up-to-date Chrome, Edge, Firefox or Safari.",
  "too-big": "This class link is too long to open.", invalid: "This class link doesn't hold a working escape room." })[kind] || "That class link couldn't be opened.";
/* Checks first (problems, the exit password, unchecked items), then the link. Resolves the link, or null. */
export async function makeClassLink(){
  if (!(await readyToDownload("link"))) return null;
  let url;
  try { url = await ER.toLink(S.cfg, playBase()); }
  catch (e) { tell("The class link couldn't be made", ["Share the escape room as a file instead (the game .html file)."]); return null; }
  if (S.saveTimer) saveNow();
  S.meta.link = { url, rev: S.meta.rev, at: Date.now() }; saveMeta();
  return url;
}
export const linkFresh = () => !!(S.meta.link && S.meta.link.url && S.meta.link.rev === S.meta.rev);
const kb = n => `${Math.round(n / 1024)} KB`;
/* What to say about a link: its length, a warning when it is very long, and a QR code when it fits one. */
export function LinkNotes({ url, pre }){
  const long = url.length > ER.LINK_LONG, svg = long ? "" : ER.qrSvg(url, { label: "QR code of your class link" });
  return <>
    {long ? <p className="ferr" id={pre + "-long"}><span className="sr">Warning: </span>{`This link is very long (${kb(url.length)}), usually because of long texts. Some course systems and email programs cut long links off, and a cut-off link won't open. If that happens, share the escape room as a file instead.`}</p> : null}
    {svg ? <figure className="wqr" id={pre + "-qr"}><span style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: svg }} /><figcaption>Or students can scan this QR code with a phone camera, for example from your projector screen.</figcaption></figure>
      : <p id={pre + "-qr-none"}>This link is too long for a QR code. Share the link itself.</p>}
  </>;
}
/* Copy, and say so beside the button (no toast: it would cover the buttons below). */
export async function copyText(text, btn, what){
  let ok = false;
  try { await navigator.clipboard.writeText(text); ok = true; } catch(e){
    const ta = document.createElement("textarea"); ta.style.cssText = "position:fixed;left:0;top:0;opacity:0"; ta.setAttribute("aria-hidden", "true"); ta.tabIndex = -1;
    ta.value = text; document.body.append(ta); ta.select();
    try { ok = document.execCommand("copy"); } catch(e2){} ta.remove(); btn.focus();
  }
  const note = btn.parentElement.querySelector(".done"); if (note) note.textContent = ok ? "Copied." : "Couldn't copy here: select the text and copy it yourself.";
  say(ok ? `${what} copied.` : "Couldn't copy. Select the text and copy it yourself.");
}

/* ---------- the student preview, the answer sheet and the teacher card ---------- */
export async function openPreview(startRoom = 0){
  const opener = document.activeElement;
  if (!(await checkReady("preview"))) return;
  previewOpen(startRoom, opener);
}
const printFrame = id => () => document.querySelector(".folder iframe")?.contentWindow.print();
/* Esc pressed while the keyboard is inside the sheet itself (its own page, in a frame) puts the folder away as well. */
const escInFrame = e => e.currentTarget.contentDocument?.addEventListener("keydown", ev => { if (ev.key === "Escape") { ev.preventDefault(); closeFolder(); } });
export function openAnswerSheet(){
  const html = answerSheetHtml();
  overlay({ title: "Answer sheet: for instructors only", wide: true, body: () => <iframe title="Answer sheet" srcDoc={html} onLoad={escInFrame} />,
    extra: () => <button className="inkline" id="sheet-print" onClick={printFrame()}><Icon name="print" />Print</button> });
}
export function openTeacherCard(){
  const html = teacherCardHtml();
  overlay({ title: "Teacher card: for you, not for students", wide: true, body: () => <iframe title="Teacher card" srcDoc={html} onLoad={escInFrame} />,
    extra: () => <button className="inkline" id="card-print" onClick={printFrame()}><Icon name="print" />Print</button> });
}

/* ---------- the first-visit accessibility prompt ----------
   Shared with the front page and the game (ER.a11yAskOpen in shared.js). It is asked once per browser, on the Welcome
   step, and "Accessibility options" (in the cabinet and in the guided steps' top bar) opens it again. The game-only
   settings it holds are kept for the student preview and the game. */
export function askA11y(opener){
  return ER.a11yAskOpen({ where: "maker", opener,
    get: id => id === "contrast" ? contrastOn() : id === "readable" ? readableOn() : ER.a11yPref(id),
    set: (id, on) => { prefSet(ER.A11Y_OPTIONS.find(o => o.id === id).key, on ? "on" : "off"); applyDisplay(); },
    locked: id => id === "contrast" && mqForced.matches ? "Your device’s forced colours keep it on." :
      id === "motion" && matchMedia("(prefers-reduced-motion: reduce)").matches ? "Your device asks for less motion, so it stays off." : "",
    modal: { open: (el, onEsc, back) => modalOpen(el, onEsc, back), close: m => modalClose(m) } });
}
export { rerender };
