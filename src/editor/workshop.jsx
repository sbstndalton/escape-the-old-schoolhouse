/* Advanced mode ("the Curator's workshop"): the top rail, the cabinet of drawers, and the page on the blotter. */
import { useRef, useLayoutEffect } from "react";
import { Tabs, TabsList, TabsTab, TabsPanel } from "@ui-sdk/react/tabs";
import { Collapsible, CollapsibleTrigger, CollapsiblePanel } from "@ui-sdk/react/collapsible";
import { S, ER, SAMPLE, clone, changed, rerender, say, saveWords, download, gameHtml, slug, backedUp, prefSet, PREF, contrastOn, readableOn, applyDisplay,
  sampleUnchecked, isHttp } from "./store.js";
import { Icon, Tip, Toggle } from "./controls.jsx";
import { ask, tell, toast, overlay, closeFolder, modalOpen, modalClose, modals, openDialog } from "./layers.jsx";
import { a11yCheck } from "./check.js";
import { TYPES, pageFor, roomStatus } from "./rooms.jsx";
import { backup, blankConfig, startEscapeRoom, openPreview, openAnswerSheet, readyToDownload, makeClassLink, copyText, LinkNotes, askA11y } from "./actions.jsx";
import { wizGo, hashFor, guideLink } from "./wizard.jsx";

/* ---------- the save line: where the work is (the cabinet's foot, and the guided steps' top bar) ---------- */
export function SaveStatus({ id, cls }){
  const [a, b] = saveWords(), fresh = !S.stored && !S.meta.failed;
  const was = useRef(fresh), had = useRef(null);
  had.current = document.activeElement && document.activeElement.id;
  useLayoutEffect(() => {        // the button that had the keyboard is swapped for the other one: the keyboard follows
    if (was.current !== fresh && (had.current === id + (fresh ? "-backup" : "-open"))) document.getElementById(id + (fresh ? "-open" : "-backup"))?.focus();
    was.current = fresh;
  });
  return <div className={cls} id={id}>
    <p className="line" id={id + "-line"}><span>{a}</span> <span>{b}</span></p>
    <button type="button" className="cut" id={id + "-open"} hidden={!fresh} onClick={() => document.getElementById("file").click()}><Icon name="folder" />Open your saved file</button>
    <button type="button" className="cut" id={id + "-backup"} hidden={fresh} onClick={backup}><Icon name="save" />Download a backup</button>
    <Tip text="Your work is saved in this browser, on this computer only, as you type. Another browser or computer won't have it, and clearing your browsing history removes it. A backup is one file you keep: it plays as the game in any browser, and you can open it here to keep working." about="saving" />
  </div>;
}

/* ---------- choosing a drawer ---------- */
export function choose(key){
  S.sel = key; closeCabinet(); rerender();
  const m = document.getElementById("main"); m.scrollTop = 0; if (getComputedStyle(m).overflowY === "visible") scrollTo(0, 0);
  document.getElementById("page-title").focus({ preventScroll: true });      // the new page's heading is read out
}

/* ---------- phone: the cabinet slides out from the brass handle ----------
   While it is out it is a dialog: the bench behind it is inert, Tab stays in the cabinet, and Esc, the Close button,
   the dark bench, or choosing a drawer puts it away. */
let cabModal = null;
export function openCabinet(){
  S.cabOpen = true; rerender();
  cabModal = modalOpen(document.getElementById("nav"), () => closeCabinet(true), document.getElementById("cabinet-handle"));
  (document.querySelector("#nav .item.sel .pull") || document.querySelector("#nav .pull")).focus();
}
export function closeCabinet(focusHandle){
  if (!S.cabOpen) return;
  S.cabOpen = false; S.addOpen = false; rerender();
  if (cabModal) { modalClose(cabModal, false); cabModal = null; }
  if (focusHandle) document.getElementById("cabinet-handle").focus();
}
export const benchMq = matchMedia("(max-width:51.25em)");
benchMq.addEventListener && benchMq.addEventListener("change", () => { closeCabinet(false); closeTools(); });
/* The file list behind the three dots (phones): a disclosure. Opening it moves to its first entry; Esc or leaving closes it. */
export const closeTools = () => { if (S.toolsOpen) { S.toolsOpen = false; rerender(); } };
document.addEventListener("pointerdown", e => { if (S.toolsOpen && !e.target.closest("#tools,#btn-more")) closeTools(); });
/* Esc: the add-a-room list first, then the top layer that is not ui-sdk's (the cabinet, the accessibility prompt), then the file list. */
document.addEventListener("keydown", e => {
  if (e.key !== "Escape" || e.defaultPrevented || openDialog() || document.querySelector(".pop:not([hidden])")) return;
  if (S.addOpen) { S.addOpen = false; rerender(); document.getElementById("add-room").focus(); e.preventDefault(); return; }
  const top = modals[modals.length - 1];
  if (top) { e.preventDefault(); top.onEsc(); return; }
  if (S.toolsOpen) { closeTools(); document.getElementById("btn-more").focus(); }
});

/* ---------- the top rail ---------- */
function exportFolder(){
  const notes = a11yCheck(S.cfg).length;
  overlay({ title: "Export", body: L => <div className="sheet">
    <h2>Export for students</h2>
    <div className="slips">
      <div className="slip"><div className="to">To: anywhere, as a link</div><h3>Class link<Tip text="The whole escape room, packed into one web address. Paste it into Moodle, Canvas, Google Classroom or an email; students click it and play. Nothing is uploaded. If you change the escape room, copy a new link: the old one keeps the old version. The link also opens again in this editor." about="Class link" /></h3>
        <button id="export-link" className="stamp" onClick={async e => {
          const btn = e.currentTarget, url = await makeClassLink(); if (!url) return;
          L.link = url; rerender();
          copyText(url, btn, "The class link");      // "Copied." is written beside the button and announced (no toast: it would cover the buttons below)
        }}><Icon name="link" />Copy class link</button><span className="done" />
        <div id="export-link-box" className="linkbox" hidden={!L.link}>{L.link ? <>
          <label className="lbl" htmlFor="export-link-text">Your class link</label>
          <textarea id="export-link-text" className="wlink" readOnly rows={3} spellCheck="false" value={L.link} onFocus={ev => ev.target.select()} />
          <LinkNotes url={L.link} pre="export" /></> : null}</div></div>
      <div className="slip"><div className="to">To: Moodle or Canvas gradebook</div><h3>SCORM package<Tip text="Moodle: Add an activity → SCORM package. Canvas: SCORM tool. Upload the zip without unzipping it." about="SCORM package" /></h3>
        <button id="export-scorm" className="stamp" onClick={async () => { if (await readyToDownload()) { download(`${slug()}-SCORM.zip`, ER.scorm(gameHtml(), S.cfg.meta.title), "application/zip"); toast("SCORM package downloaded."); } }}><Icon name="save" />Download SCORM .zip</button></div>
      <div className="slip"><div className="to">To: anywhere, as one file</div><h3>Web page<Tip text="Double-click it, upload it as a Moodle or Canvas file, or put it on a website. Pair it with the exit password and an LMS quiz for credit. You can also reopen this file in the editor later." about="Web page" /></h3>
        <button id="export-html" className="stamp" onClick={async () => { if (await readyToDownload()) { download(`${slug()}.html`, gameHtml(), "text/html"); backedUp(); toast("Game file downloaded. It is also your backup: open it here to keep working."); } }}><Icon name="save" />Download game .html</button></div>
    </div>
    <p className="typed" id="export-a11y">{notes ? `The accessibility check has ${notes} ${notes === 1 ? "note" : "notes"} on what you wrote. ` : "The accessibility check has nothing to flag. "}
      {notes ? <button className="inkline" onClick={() => { closeFolder(); setTimeout(() => choose("a11y")); }}>Read the notes</button> : null}</p>
  </div> });
}
function newFolder(){
  const start = async (next, said) => { await startEscapeRoom(next, false); closeFolder(); rerender(); toast(said); setTimeout(() => document.getElementById("page-title").focus()); };
  overlay({ title: "New", body: () => <div className="sheet">
    <h2>Start a new escape room</h2>
    <p className="typed" id="new-warning">The escape room you have open now stays in this browser. To go back to it, choose Guided steps, then “Your escape rooms”.</p>
    <div className="actions">
      <button className="stamp" id="new-blank" aria-describedby="new-warning" onClick={() => start(blankConfig(), "Started a blank escape room.")}>Blank (one question room)</button>
      <button className="stamp" id="new-sample" aria-describedby="new-warning" onClick={() => start(clone(SAMPLE), "Loaded the sample escape room.")}>Copy of the sample (Old Schoolhouse)</button>
    </div></div> });
}
async function openFile(e){
  const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  try {
    const text = await f.text();
    const raw = /\.html?$/i.test(f.name) ? ER.configFromHtml(text) : JSON.parse(text);
    if (!raw || !Array.isArray(raw.rooms)) throw new Error("This file doesn't contain an escape room.");
    const next = ER.cleanConfig(raw);
    if (!(await ask(`Open “${next.meta?.title || f.name}”?`, ["It is added to the escape rooms in this browser. The one you have open now stays there too."], { ok: "Open it", cancel: "Keep what I have" }))) return;
    await startEscapeRoom(next, true); toast("Opened " + f.name);
    if (S.mode === "wizard") wizGo(hashFor("hub")); else { rerender(); document.getElementById("page-title").focus(); }
  } catch (err) { tell("That file couldn't be opened", [err.message, "Choose a project file (.json) saved from this editor, or a game file (.html) exported from it."]); }
}
function Header(){
  const st = ER.reviewStatus(S.cfg);
  const tool = (id, ic, label, onClick, title) => <button className="cut" id={id} title={title} onClick={() => { closeTools(); onClick(); }}><Icon name={ic} />{label}</button>;
  return <header>
    <button id="cabinet-handle" aria-controls="nav" aria-expanded={String(S.cabOpen)} aria-haspopup="dialog" aria-label="Rooms: open the cabinet of rooms"
      onClick={() => S.cabOpen ? closeCabinet(true) : openCabinet()}>Rooms</button>
    <h1>The Curator’s Workshop <span className="sr">(escape room editor)</span></h1>
    <p className="plate meter" id="meter" title="Items you have checked against your sources"><b>{st.verified}</b> / <b>{st.total}</b> <span className="w">checked</span></p>
    <span className="spacer" />
    <div className={"tools" + (S.toolsOpen ? " open" : "")} id="tools"
      onBlur={e => { if (S.toolsOpen && e.relatedTarget && !e.currentTarget.contains(e.relatedTarget) && e.relatedTarget.id !== "btn-more") closeTools(); }}>
      {tool("btn-new", "page", "New…", newFolder)}
      {tool("btn-open", "folder", "Open…", () => document.getElementById("file").click())}
      {tool("btn-save", "save", "Save project", () => { download(`${slug()}-project.json`, JSON.stringify(S.cfg, null, 2), "application/json"); toast("Project saved. Open it again with Open…"); })}
      {tool("btn-review", "sheet", "Answer sheet", openAnswerSheet, "Every room with its answers, for checking against your sources")}
      {tool("btn-guided", "back", "Guided steps", () => wizGo(hashFor(S.stored ? "hub" : "welcome")), "Back to the guided steps and the list of what is left to do")}
    </div>
    <div className="run">
      <button className="plate" id="btn-preview" title="Preview as student" onClick={() => openPreview(typeof S.sel === "number" ? S.sel + 1 : 0)}><Icon name="play" /><span className="w">Preview as student</span></button>
      <button className="plate" id="btn-export" title="Export" onClick={exportFolder}><Icon name="export" /><span className="w">Export</span></button>
      <button id="btn-more" aria-controls="tools" aria-expanded={String(S.toolsOpen)} aria-label="File: new, open, save, answer sheet"
        onClick={() => { S.toolsOpen = !S.toolsOpen; rerender(); if (S.toolsOpen) document.querySelector("#tools button").focus(); }}><Icon name="more" /></button>
    </div>
    <input type="file" id="file" accept=".json,.html,.htm" hidden aria-label="Open a project or an exported game" onChange={openFile} />
  </header>;
}

/* ---------- the cabinet ---------- */
function Drawer({ k, ic, label, mark, acts }){
  const on = S.sel === k;
  return <div className={"item" + (on ? " sel" : "")} onClick={e => { if (!e.target.closest(".acts")) choose(k); }}>
    <button className="pull" aria-current={on ? "page" : undefined}><span className="holder"><Icon name={ic} /><span className="t">{label}</span>{mark || null}</span></button>
    {acts || <span className="knob" aria-hidden="true" />}
  </div>;
}
function Cabinet(){
  const cfg = S.cfg, notes = a11yCheck(cfg).length;
  const moveUp = r => { [cfg.rooms[r-1], cfg.rooms[r]] = [cfg.rooms[r], cfg.rooms[r-1]]; if (S.sel === r) S.sel = r - 1; else if (S.sel === r - 1) S.sel = r; changed();
    const b = document.querySelector(`#nav [aria-label="Move room ${r} up"]`); (b && !b.disabled ? b : document.querySelectorAll("#nav .item .pull")[r + 1])?.focus(); say(`Room ${r+1} moved up. It is now room ${r}.`); };
  const del = async (room, r) => {
    if (!(await ask(`Delete room ${r+1}?`, [`“${room.title || "Untitled"}” and everything in it will be removed.`, "This can't be undone."], { ok: "Delete room", danger: true }))) return;
    cfg.rooms.splice(r, 1); S.sel = "settings"; changed();
    (S.cabOpen ? document.getElementById("add-room") : document.getElementById("page-title")).focus(); say(`Room ${r+1} deleted.`);
  };
  return <nav id="nav" aria-label="Cabinet of rooms"><div id="cab" {...(S.cabOpen ? { role: "dialog", "aria-modal": "true", "aria-label": "Cabinet of rooms" } : {})}>
    <button id="cabinet-close" className="cut" onClick={() => closeCabinet(true)}><Icon name="x" />Close the cabinet</button>
    <Drawer k="settings" ic="gear" label="Settings" /><Drawer k="intro" ic="page" label="Story & intro" />
    <h2 className="bay">Rooms</h2>
    {cfg.rooms.map((room, r) => {
      const st = roomStatus(r);
      const mark = st.total ? <span className={"mark" + (st.left ? "" : " ok")} title={`${st.total - st.left} of ${st.total} checked`}>
        {st.left ? <><span aria-hidden="true">{`${st.total - st.left}/${st.total}`}</span><span className="sr">{` ${st.left} to check`}</span></> : <><Icon name="tick" /><span className="sr"> all checked</span></>}</span> : null;
      return <Drawer key={r} k={r} ic={TYPES[room.type]?.icon || "door"} label={`${r+1}. ${room.title || "Untitled"}`} mark={mark} acts={<span className="acts">
        <button className="stud" title="Move up" aria-label={`Move room ${r+1} up`} disabled={r === 0} onClick={() => moveUp(r)}><Icon name="up" /></button>
        <button className="stud" title="Delete room" aria-label={`Delete room ${r+1}: ${room.title || "Untitled"}`} onClick={() => del(room, r)}><Icon name="x" /></button></span>} />;
    })}
    <button id="add-room" aria-expanded={String(S.addOpen)} aria-controls={S.addOpen ? "add-menu" : undefined} onClick={() => {
      S.addOpen = !S.addOpen; rerender();
      if (S.addOpen) { document.getElementById("add-menu").scrollIntoView({ block: "nearest" }); document.querySelector("#add-menu button").focus(); } else document.getElementById("add-room").focus(); }}><Icon name="plus" />Add a room</button>
    {S.addOpen ? <div className="addmenu" id="add-menu" role="group" aria-label="Kinds of room">{Object.entries(TYPES).map(([k, t]) =>
      <button key={k} data-type={k} onClick={() => { S.addOpen = false; cfg.rooms.push(t.blank()); changed(); choose(cfg.rooms.length - 1); say(`Room ${cfg.rooms.length} added: ${t.name}.`); }}><Icon name={t.icon} /><b>{t.name}</b><span>{t.desc}</span></button>)}</div> : null}
    <h2 className="bay">End</h2><Drawer k="finish" ic="rosette" label="Finish & grading" />
    <Drawer k="a11y" ic="eye" label="Accessibility check" mark={<span className={"mark adv" + (notes ? "" : " ok")} title={notes ? `${notes} ${notes === 1 ? "note" : "notes"} to read` : "Nothing flagged"}>
      {notes ? <><span aria-hidden="true">{String(notes)}</span><span className="sr">{` ${notes} ${notes === 1 ? "note" : "notes"}`}</span></> : <><Icon name="tick" /><span className="sr"> nothing flagged</span></>}</span>} />
    <div id="display-toggles" className="gap" role="group" aria-label="Display">
      <div className="opt"><Toggle id="contrast-toggle" label="High contrast" on={contrastOn()} onChange={on => { prefSet(PREF.contrast, on ? "on" : "off"); applyDisplay(); say(`High contrast ${contrastOn() ? "on" : "off"}.`); }} />
        <Tip text="Plain backgrounds, black on white, and heavier outlines, here and in the student preview. It follows your system's contrast setting until you choose." about="High contrast" /></div>
      <div className="opt"><Toggle id="readable-toggle" label="Readable text" on={readableOn()} onChange={on => { prefSet(PREF.readable, on ? "on" : "off"); applyDisplay(); say(`Readable text ${on ? "on" : "off"}.`); }} />
        <Tip text="A plain, larger typeface with more room between letters and lines, in place of the old-book lettering." about="Readable text" /></div>
      <button type="button" className="cut" id="a11y-options" aria-haspopup="dialog" onClick={e => askA11y(e.currentTarget)}>Accessibility options</button>
    </div>
    {guideLink("adv-guide", "cut")}
    <SaveStatus id="save-status" cls="foot save" />
  </div></nav>;
}

/* ---------- the page on the blotter ---------- */
function DraftNote({ st }){
  if (!st.unverified) return null;
  return <Collapsible className="note" open={S.noteOpen} onOpenChange={o => { S.noteOpen = o; rerender(); }}>
    <CollapsibleTrigger id="draft-note"><span id="draft-line">{`${st.unverified} of ${st.total} items not checked yet.`}</span><span className="more">{S.noteOpen ? "fold" : "why?"}</span></CollapsibleTrigger>
    <CollapsiblePanel id="draft-note-more" render={<p />}>
      {sampleUnchecked(S.cfg) ? "Everything in the sample was written with AI help and may contain mistakes. " : null}
      Check each item against your textbook or sources, then press its seal (“I checked this is correct”). Students see a “Draft” notice until every item is checked. The Answer sheet lists everything with the answers, ready to print.
    </CollapsiblePanel>
  </Collapsible>;
}
/* Teacher-only answer key for the room being edited: a sealed envelope that opens to a card. Refreshed as you type. */
function AnswerKey({ room }){
  const lines = ER.answerKey(room);
  return <details className="answerkey" id="answer-key" open={S.keyOpen} onToggle={e => { S.keyOpen = e.currentTarget.open; }}>
    <summary><svg className="env" aria-hidden="true" focusable="false" viewBox="0 0 100 40" preserveAspectRatio="none"><path d="M0 40 39 19M100 40 61 19" vectorEffect="non-scaling-stroke" /><path className="lid" d="M0 0 50 24 100 0Z" vectorEffect="non-scaling-stroke" /></svg>
      <span className="wax" aria-hidden="true">K</span><span className="lbl">Answer key</span><span className="act" aria-hidden="true" /></summary>
    <div className="keycard"><div className="only">For your eyes only</div>
      <ul dangerouslySetInnerHTML={{ __html: lines.map(l => `<li>${ER.fmt(l)}</li>`).join("") || "<li>Nothing to answer yet.</li>" }} /></div>
  </details>;
}
const TITLES = { settings: "Settings", intro: "Story & intro", finish: "Finish & grading", a11y: "Accessibility check" };
export const pageTitle = () => {
  if (typeof S.sel === "number" && !S.cfg.rooms[S.sel]) S.sel = "settings";
  const page = { title: typeof S.sel === "number" ? S.cfg.rooms[S.sel].title || "Untitled" : TITLES[S.sel] };
  return `${page.title}${typeof S.sel === "number" ? ` (room ${S.sel + 1})` : ""} · ${S.cfg.meta?.title || "Untitled"} · Escape Room Editor`;
};
function Page(){
  if (typeof S.sel === "number" && !S.cfg.rooms[S.sel]) S.sel = "settings";
  const st = ER.reviewStatus(S.cfg);
  const page = pageFor(S.sel);
  const cur = page.tabs.find(t => t.id === S.tabOf.get(page.key)) || page.tabs[0];
  const pkey = (typeof page.key === "string" ? page.key : "room" + S.cfg.rooms.indexOf(page.key)) + ":" + cur.id;
  const body = <>{cur.help ? <Tip text={cur.help} about={cur.label} /> : null}{cur.body}</>;
  return <main id="main" tabIndex={-1}><div className="blotter">
    <div className="head">
      <div className="kicker"><Icon name={page.icon} /><span id="page-kicker">{page.kicker}</span>{page.help ? <Tip text={page.help} about={page.title} /> : null}</div>
      <h2 id="page-title" tabIndex={-1} aria-describedby="page-kicker">{page.title}</h2></div>
    <div className="loose"><DraftNote st={st} />{page.room ? <AnswerKey room={page.room} /> : null}
      {page.room ? <button className="plate" id="preview-room" onClick={() => openPreview(page.r + 1)}><Icon name="play" />Preview this room</button> : null}
      <svg className="bdecor" viewBox="0 0 200 150" aria-hidden="true" focusable="false"><g transform="translate(150 38) rotate(-18)"><rect x="-26" y="-6" width="52" height="12" rx="2" fill="#8e1b1b" stroke="#3a0b0b" /><path d="M-22-2.500h44" stroke="#fff" strokeOpacity=".18" /></g><path d="M168 66c5-1 12 3 12 11s-5 12-12 12-13-5-12-12 5-10 12-11z" fill="#9b1f1f" stroke="#3a0b0b" /><circle cx="168" cy="78" r="6" fill="none" stroke="#3a0b0b" strokeOpacity=".5" /><path d="M165 78h6M168 75v6" stroke="#3a0b0b" strokeOpacity=".6" /><g strokeLinecap="round" fill="none"><path d="M104 93l46 39" stroke="#120a05" strokeWidth="13" /><path d="M104 93l46 39" stroke="#4a2c15" strokeWidth="10.500" /><path d="M106 91.500l42 35.500" stroke="#fde0aa" strokeOpacity=".16" strokeWidth="2" /><path d="M89 80.500l15 12.500" stroke="#120a05" strokeWidth="11" strokeLinecap="butt" /><path d="M89 80.500l15 12.500" stroke="#b08a3e" strokeWidth="8.500" strokeLinecap="butt" /></g><circle cx="62" cy="58" r="34" fill="rgba(210,230,240,.1)" stroke="#120a05" strokeWidth="8.500" /><circle cx="62" cy="58" r="34" fill="none" stroke="#c9a556" strokeWidth="6" /><circle cx="62" cy="58" r="31.700" fill="none" stroke="#f4dc9c" strokeOpacity=".5" strokeWidth=".8" /><path d="M41 46a25 25 0 0 1 15-12" fill="none" stroke="#fff" strokeOpacity=".4" strokeWidth="2.400" strokeLinecap="round" /><g stroke="#120a05" strokeWidth="1" strokeLinejoin="round"><path d="M57.500 130.600 190.400 109l1 6-132.900 21.600z" fill="#5a1d16" /><path d="M39.800 133.500l17.700-2.900 1 6-17.700 2.900z" fill="#b08a3e" /><path d="M17 141l22.800-7.500 1 6z" fill="#aab3bb" /><path d="M20 140.300l15-3.400" fill="none" strokeWidth=".7" /></g></svg></div>
    {page.tabs.length > 1
      ? <Tabs className="leaf" value={cur.id} onValueChange={v => { if (v != null) { S.tabOf.set(page.key, v); rerender(); } }}>
          <TabsList className="tabs" aria-label={page.title}>{page.tabs.map(t => <TabsTab key={t.id} id={"tab-" + t.id} value={t.id} aria-controls="panel">{t.label}</TabsTab>)}</TabsList>
          <TabsPanel key={pkey} value={cur.id} className="paper" id="panel">{body}</TabsPanel>
        </Tabs>
      : <div className="leaf"><div className="paper" id="panel" key={pkey}>{body}</div></div>}
  </div></main>;
}

export function Workshop(){
  return <>
    <Header />
    <Cabinet />
    {S.mode === "advanced" ? <Page /> : <main id="main" tabIndex={-1} />}
  </>;
}
export const skipText = () => S.mode === "wizard" ? ["Skip to the question", "#wiz-main"] : ["Skip to the editing area", "#main"];
export { isHttp };
