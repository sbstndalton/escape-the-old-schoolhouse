/* =====================================================================
   Guided steps (the wizard). The first way in for a teacher: one question per page, ten steps, then a hub
   ("Your escape room") to come back to. It edits the same content (S.cfg) and the same browser storage as the
   workshop, which is "Advanced mode" (all settings). Every step can open Advanced mode, and Advanced mode can come
   back. The page address says where you are (#step=name, #step=room&room=2&part=questions, #advanced&room=2), so
   the browser's Back and Forward buttons work, and a reload stays put.
   ===================================================================== */
import { Fragment } from "react";
import { RadioGroup, Radio } from "@ui-sdk/react/radio";
import { Checkbox } from "@ui-sdk/react/checkbox";
import { S, ER, SAMPLE, clone, changed, rerender, say, saveNow, saveMeta, unbacked, when, download, gameHtml, slug, backedUp, lsDel, keyOf, writeLib,
  switchTo, sampleUnchecked, isHttp } from "./store.js";
import { Icon } from "./controls.jsx";
import { ask, toast } from "./layers.jsx";
import { TYPES, PAGES, roomStatus, blankQuestion, blankCard } from "./rooms.jsx";
import { closeCabinet, benchMq, SaveStatus } from "./workshop.jsx";
import { backup, blankConfig, parseSaved, startEscapeRoom, openPreview, openAnswerSheet, openTeacherCard, readyToDownload, needsPassword, suggestPassword,
  makeClassLink, linkFresh, linkWords, LinkNotes, copyText, askA11y } from "./actions.jsx";
import { QUIZ_Q, ROOM_KIND, LMS, deliveryWords } from "./words.js";

export const STEP_ORDER = ["welcome", "start", "name", "rooms", "room", "facts", "try", "deliver", "walk", "done"];
const STEP_LABEL = { welcome: "Welcome", start: "How to start", name: "Name it", rooms: "Your rooms", room: "Fill in each room", facts: "Check your facts",
  try: "Try it as a student", deliver: "How students get it", walk: "Put it in your course", done: "Done" };
export const WSTEPS = {};
export const WIZ = { route: null, errors: [], start: null, fileCfg: null, fileName: "", fileErr: "", stepsOpen: null };
export const hashFor = (step, extra = {}) => "#" + new URLSearchParams({ step, ...extra }).toString();
export function readHash(){
  const raw = location.hash.replace(/^#/, "");
  if (/^advanced(&|$)/.test(raw)) { const q = new URLSearchParams(raw.slice(8)); return { advanced: true, room: q.get("room"), page: q.get("page") }; }
  const q = new URLSearchParams(raw), step = q.get("step");
  if (!step) return null;                                   // some other mark in the address (the skip link's #main): not a page
  return { step, r: Math.max(0, (parseInt(q.get("room"), 10) || 1) - 1), part: q.get("part") || "", q };
}
const stepNo = step => { const i = STEP_ORDER.indexOf(step === "add" ? "rooms" : step === "password" ? "walk" : step); return i < 0 ? 0 : i + 1; };
export function setMode(m){ S.mode = m; document.documentElement.dataset.mode = m; }
export function wizGo(hash){ WIZ.errors = []; WIZ.warn = null; if (location.hash === hash) routeTo(readHash(), true); else location.hash = hash; }
export const homeRoute = () => (/[?&]mode=advanced/.test(location.search) ? { advanced: true } : { step: S.stored ? "hub" : "welcome", r: 0, part: "", q: new URLSearchParams() });
addEventListener("hashchange", () => { const r = readHash() || (location.hash.length <= 1 ? homeRoute() : null); if (r) { WIZ.errors = []; WIZ.warn = null; routeTo(r, true); } });
export function routeTo(r, focus){
  if (r.advanced) {
    const was = S.mode;
    setMode("advanced");
    if (r.room != null && S.cfg.rooms[+r.room - 1]) S.sel = +r.room - 1; else if (r.page && (PAGES[r.page])) S.sel = r.page;
    rerender();
    if (focus || was === "wizard") document.getElementById("page-title").focus({ preventScroll: true });
    return;
  }
  if (!WSTEPS[r.step] || (r.step === "hub" && !S.stored)) r = { step: S.stored ? "hub" : "welcome", r: 0, part: "", q: new URLSearchParams() };
  if (r.step === "room") { const seq = roomSeq(); if (!seq.some(([k, p]) => k === r.r && p === r.part)) { const first = seq.find(([k]) => k === r.r) || seq[0]; if (first) { r.r = first[0]; r.part = first[1]; } else r.step = "rooms"; } }
  closeCabinet(false);
  setMode("wizard");
  WIZ.route = r;
  if (r.step !== "password") WIZ.pw = null;                 // a new exit password typed but not saved is dropped on leaving its page
  const n = stepNo(r.step); if (n > (S.meta.reached || 0) && S.stored) { S.meta.reached = n; saveMeta(); }
  renderWizard(focus ? "heading" : null);
  if (focus) scrollTo(0, 0);
  if (r.step === "welcome" && !ER.a11yAsked()) askA11y(document.getElementById("wiz-h1"));   // first visit: asked once, first thing
}
/* Redraw the guided steps; focus "heading" (the page's question) or "errors" (the error summary), or keep it where it was. */
export function renderWizard(focus){
  if (!WIZ.route) return;
  rerender();
  const r = WIZ.route, def = WSTEPS[r.step];
  if (focus === "errors") document.getElementById("wiz-errors")?.focus();
  else if (focus) { const f = def.focus && def.focus(r); (f && document.getElementById(f) || document.getElementById("wiz-h1"))?.focus({ preventScroll: true }); }
}
export const wizardTitle = () => {
  const r = WIZ.route; if (!r) return document.title;
  const def = WSTEPS[r.step], n = stepNo(r.step);
  return `${WIZ.errors.length ? "Error: " : ""}${n ? `Step ${n} of ${STEP_ORDER.length}: ` : ""}${def.title(r)} – Escape room maker`;
};

/* ---------- small builders for the steps ---------- */
const wErr = key => WIZ.errors.find(e => e.key === key);
const Btn = ({ children, ...props }) => <button type="button" {...props}>{children}</button>;
/* The printable quick-start guide: beside the maker on the website, or the website's own copy when the maker was opened
   as a file. It opens in a new tab, so leaving the maker never asks about unsaved work. */
const guideHref = () => (isHttp() ? "" : ER.SITE) + "guide.html";
export const guideLink = (id, cls) => <a id={id} className={cls || undefined} href={guideHref()} target="_blank" rel="noopener"><Icon name="print" />Printable quick-start guide<span className="sr"> (opens in a new tab)</span></a>;
const WHelp = ({ children }) => <details className="whelp" id="wiz-help"><summary>Help with this step</summary><div>{children}
  <p className="wguide">All the steps on one page: {guideLink("wiz-help-guide")}.</p></div></details>;
const H1 = ({ children }) => <h1 id="wiz-h1" tabIndex={-1}>{children}</h1>;
const Err = ({ id, text }) => <p className="ferr" id={id}><span className="sr">Error: </span>{text}</p>;
/* A field: a label you can read (or the page's question as its label), an optional hint, the error if any, then the box. */
function WField({ id, label, value, set, hint, area, rows, asH1, placeholder, item, k, live = true }){
  const err = wErr(k || id);
  const desc = [hint ? id + "-hint" : null, err ? id + "-err" : null].filter(Boolean).join(" ") || undefined;
  const common = { id, value: value ?? "", autoComplete: "off", placeholder, "aria-describedby": desc, "aria-invalid": err ? "true" : undefined,
    onChange: e => { set(e.target.value); if (live) { if (item) wUnverify(item); changed(); } else rerender(); } };
  const lab = <label htmlFor={id} className={asH1 ? undefined : "wlabel"}>{label}</label>;
  return <div className={"wf" + (err ? " bad" : "")}>{asH1 ? <h1 id="wiz-h1" tabIndex={-1}>{lab}</h1> : lab}
    {hint ? <p className="whint" id={id + "-hint"}>{hint}</p> : null}
    {err ? <Err id={id + "-err"} text={err.text} /> : null}
    {area ? <textarea {...common} rows={rows || 3} spellCheck="true" /> : <input {...common} type="text" />}
  </div>;
}
/* Radio "cards": a fieldset and legend (the page's question when asH1) that is a ui-sdk radio group, one slip per choice. */
function WRadios({ name, legend, asH1, hint, options, value, set, cls }){
  const err = wErr(name);
  const desc = [hint ? name + "-hint" : null, err ? name + "-err" : null].filter(Boolean).join(" ") || undefined;
  return <RadioGroup render={<fieldset className="wradios" aria-describedby={desc} />} name={name} value={value == null ? null : String(value)} onValueChange={v => { if (v != null) set(v); }}>
    <legend>{asH1 ? <H1>{legend}</H1> : <span className="wlegend">{legend}</span>}</legend>
    {hint ? <p className="whint" id={name + "-hint"}>{hint}</p> : null}
    {err ? <Err id={name + "-err"} text={err.text} /> : null}
    <div className={cls || "wopts"}>{options.map(o => {
      const id = `${name}-${o.value}`, on = String(value) === String(o.value);
      return <div key={o.value} className={"wopt-wrap" + (err ? " bad" : "")}>
        <label className="wopt" htmlFor={id}>
          <Radio id={id} className="ctl" value={String(o.value)} aria-describedby={o.desc ? id + "-d" : undefined} />
          <span className="dot" aria-hidden="true" />
          {o.pic ? <span className="pic" aria-hidden="true"><Icon name={o.pic} /></span> : null}
          <span className="t"><b>{o.title}</b>{o.desc ? <span className="d" id={id + "-d"}>{o.desc}</span> : null}{o.eg ? <span className="eg">{o.eg}</span> : null}</span>
        </label>
        {on && o.reveal ? <div className="wreveal">{o.reveal()}</div> : null}
      </div>;
    })}</div>
  </RadioGroup>;
}
/* A ticked box ("Correct", "I checked this is correct"): a ui-sdk checkbox under a drawn box. */
const WCheck = ({ id, checked, onChange, children }) => <label className="wchk"><Checkbox id={id} className="ctl" checked={!!checked} onCheckedChange={c => onChange(c === true)} />
  <span className="box" aria-hidden="true"><Icon name="tick" /></span>{children}</label>;
function ErrorSummary(){
  return <section className="errsum" id="wiz-errors" tabIndex={-1} aria-labelledby="wiz-errors-title">
    <h2 id="wiz-errors-title">There is a problem</h2>
    <ul>{WIZ.errors.map((e, i) => <li key={i}>{e.href ? <a href={e.href}>{e.text}</a> : <a href={"#" + e.target} onClick={ev => { ev.preventDefault(); const el = document.getElementById(e.target); if (el) { el.focus(); el.scrollIntoView({ block: "center" }); } }}>{e.text}</a>}</li>)}</ul>
  </section>;
}
/* An edit in the guided steps lifts the item's check, the same as in Advanced mode, and Check your facts says why. */
const changedAfterCheck = new WeakSet();
function wUnverify(item){ if (item && item.verified) { item.verified = false; changedAfterCheck.add(item); say("You changed this after checking it, so it needs checking again."); } }
function advHash(r){
  const s = r && r.step;
  if (s === "room") return `#advanced&room=${r.r + 1}`;
  if (s === "name") return "#advanced&page=settings";
  if (s === "deliver" || s === "walk" || s === "done" || s === "password") return "#advanced&page=finish";
  return "#advanced";
}
function WFooter({ r }){
  return <div className="wfoot">
    {S.stored && r.step !== "hub" ? <Btn className="inkline" id="wiz-later" onClick={() => { saveNow(); wizGo(hashFor("hub")); toast("Saved in this browser. Open this page again to carry on, and download a backup to keep a copy of your own."); }}><Icon name="save" />Save and finish later</Btn> : null}
    <a className="inkline" id="wiz-advanced" href={advHash(r)}><Icon name="gear" />Show all settings (Advanced mode)</a>
  </div>;
}
function Steps({ n }){
  if (!n) return <div className="wsteps" id="wiz-steps" role="navigation" aria-label="Steps" hidden />;
  const open = WIZ.stepsOpen ?? !benchMq.matches;
  return <div className="wsteps" id="wiz-steps" role="navigation" aria-label="Steps">
    <details open={open} onToggle={e => { WIZ.stepsOpen = e.currentTarget.open; }}>
      <summary>{`All ${STEP_ORDER.length} steps`}</summary>
      <ol>{STEP_ORDER.map((id, i) => {
        const cur = i + 1 === n, can = !cur && (S.stored ? true : i + 1 < n);
        return <li key={id} className={i + 1 < n ? "done" : undefined} aria-current={cur ? "step" : undefined}>
          {can ? <a href={hashFor(id)}>{STEP_LABEL[id]}</a> : <span>{STEP_LABEL[id]}</span>}{cur ? <span className="sr"> (this step)</span> : null}</li>;
      })}</ol>
    </details>
  </div>;
}
async function wizContinue(def, r){
  WIZ.errors = def.check ? def.check(r) : [];
  if (WIZ.errors.length) { renderWizard("errors"); return; }
  if (def.gate && def.gate(r)) return;
  if (def.save && (await def.save(r)) === false) return;
  wizGo(def.next(r));
}
export function Wizard(){
  const r = WIZ.route;
  const def = r && WSTEPS[r.step];
  const n = r ? stepNo(r.step) : 0, back = def && def.back ? def.back(r) : null;
  return <div id="wizard">
    <div className="wtop" role="banner">
      <p className="brand">Escape room maker</p>
      {isHttp() ? <a className="cut" id="wiz-home" href="index.html">Front page</a> : null}
      <button type="button" className="cut" id="wiz-a11y" aria-haspopup="dialog" onClick={e => askA11y(e.currentTarget)}>Accessibility options</button>
      <SaveStatus id="wiz-save" cls="save" />
    </div>
    <div className={"wbody" + (n ? "" : " solo")}>
      <Steps n={n} />
      <div id="wiz-main" role="main" tabIndex={-1}><div className="paper wsheet" id="wiz-sheet">{def ?
        <form key={r.step + ":" + r.r + ":" + r.part} id="wiz-form" noValidate aria-labelledby="wiz-h1" onSubmit={e => { e.preventDefault(); wizContinue(def, r); }}>
          {back ? <a className="inkline wback" id="wiz-backlink" href={back}><Icon name="back" />Back</a> : null}
          {n ? <p className="wcap" id="wiz-cap">{`Step ${n} of ${STEP_ORDER.length}`}{def.cap ? def.cap(r) : null}</p> : null}
          {WIZ.errors.length ? <ErrorSummary /> : null}
          {def.body(r)}
          {def.continue === false ? null : <div className="wacts">
            <button type="submit" className="plate big" id="wiz-continue">{def.go ? def.go(r) : "Continue"}</button>
            {back ? <a className="inkline" id="wiz-back" href={back}>Back</a> : null}</div>}
          <WFooter r={r} />
        </form> : null}</div></div>
    </div>
  </div>;
}

/* ---------- the welcome pictures (decoration: the words beside them say the same) ---------- */
const STRIP = [
  ["You write the puzzles", '<path d="M64 32.500V18L54 8H14v56h29M54 8v10h10M64 51.500V64h-5"/><path d="M20 24h1.500M27 24h20M20 32h1.500M27 32h27M20 40h1.500M27 40h23M20 48h1.500M27 48h16M20 56h1.500M27 56h10"/><path d="M46 63l3.500-13.500L72 27l6.500 6.500L56 56zM49.500 49.500 56 56M68 31l6.500 6.500M72 27l2.800-2.800a2.500 2.500 0 0 1 3.500 0l3 3a2.500 2.500 0 0 1 0 3.500l-2.800 2.800M46 63l3.800-1.400-2.700-2.700M53 53l19-19"/>'],
  ["Students play them in a browser", '<rect x="6" y="8" width="76" height="54" rx="3"/><path d="M6 20h76M12 14h.2M17 14h.2M22 14h.2"/><rect x="29" y="11.500" width="46" height="5" rx="2.500"/><rect x="33" y="39" width="22" height="17" rx="2"/><path d="M37.500 39v-5a6.500 6.500 0 0 1 13 0v5M44 48.500v3"/><circle cx="44" cy="46.500" r="2"/><path d="M13 31h12v17H13zM16 36h6M16 40h6M16 44h3M63 31h12v17H63zM66 36h6M66 40h6M66 44h3"/>'],
  ["Your course records the grade", '<path d="M10 10h68v52H10zM10 22h68M10 34h68M10 46h68M34 10v52M56 10v52M15 16h13M41 16h8M63 16h8M15 28h14M15 40h11M15 52h13"/><path d="M40 28.500l3 3 6-7M40 40.500l3 3 6-7M40 52.500l3 3 6-7M62 28.500l3 3 6-7M62 40.500l3 3 6-7M64 53h6" stroke-width="2.200"/>']];
const Strip = () => <ol className="strip">{STRIP.map(([t, d]) => <li key={t}><svg viewBox="0 0 88 70" aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{ __html: d }} /><span>{t}</span></li>)}</ol>;

/* ---------- 1 Welcome ---------- */
WSTEPS.welcome = {
  title: () => "Make an escape room for your class",
  body: () => <>
    <H1>Make an escape room for your class</H1>
    <p>Students solve a few short puzzles about your chapter to “escape”. At the end they get an exit password to type into a quiz in Moodle or Canvas, or Moodle or Canvas records the grade by itself.</p>
    <Strip />
    <p>{`There are ${STEP_ORDER.length} steps. It takes about 30 to 45 minutes. Your work is saved in this browser as you go, and the steps help you download a backup copy to keep.`}</p>
    <p>You don't need an account, and nothing you write is sent anywhere.</p>
    <WHelp><p>You can start from a finished sample about the foundations of education and change it, or start with an empty escape room.</p>
      <p>You can stop at any step with “Save and finish later”. When you come back to this page in the same browser, you'll see your escape room and what is left to do.</p></WHelp>
    <p><a id="wiz-have-one" href={hashFor("start", { open: "1" })}>I've made one before: open a saved escape room</a></p>
    <p className="wguide">{guideLink("wiz-guide")}</p>
  </>,
  go: () => "Start",
  next: () => hashFor("start")
};

/* ---------- 2 Start point ---------- */
function readStartFile(f){
  WIZ.fileCfg = null; WIZ.fileErr = ""; WIZ.fileName = f ? f.name : "";
  if (!f) return renderWizard();
  f.text().then(text => {
    try { WIZ.fileCfg = parseSaved(text, f.name); }
    catch (err) { WIZ.fileErr = "That file couldn't be opened. Choose a backup copy or a game file made with this editor."; }
    WIZ.errors = WIZ.errors.filter(e => e.key !== "start-file");
    renderWizard();
    say(WIZ.fileCfg ? `Chosen: ${f.name}.` : WIZ.fileErr);
  });
}
WSTEPS.start = {
  title: () => "How do you want to start?",
  back: () => hashFor("welcome"),
  body: r => {
    if (WIZ.start == null && r.q.get("open")) WIZ.start = "file";
    const title = S.cfg.meta?.title || "Untitled";
    return <WRadios name="start" legend="How do you want to start?" asH1 value={WIZ.start}
      hint={<>{S.stored ? <span id="wiz-start-note">{`You already have “${title}” in this browser. Starting another one keeps that one too: you'll find both under “Your escape rooms”. `}</span>
        : <span id="wiz-start-note">Nothing saved in this browser yet. If you worked on this before, open your saved file. </span>}You can change everything later.</>}
      set={v => { WIZ.start = v; renderWizard(); }}
      options={[
        { value: "sample", title: "Change the sample", pic: "books", desc: "“Escape the Old Schoolhouse”, about the foundations of education: five rooms, ready to play. Swap in your own questions." },
        { value: "empty", title: "Start with an empty escape room", pic: "page", desc: "One empty quiz room for you to fill in." },
        { value: "file", title: "Open one I saved before", pic: "folder", desc: "A backup copy, a game file you downloaded from here (it ends in .html), or a class link you shared.",
          reveal: () => {
            const err = wErr("start-file") || (WIZ.fileErr ? { text: WIZ.fileErr } : null);
            return <>{err ? <Err id="wiz-file-err" text={err.text} /> : null}
              <Btn className="stamp" id="wiz-file-btn" aria-describedby={err ? "wiz-file-err" : undefined} onClick={() => document.getElementById("wiz-file").click()}><Icon name="folder" />{WIZ.fileCfg ? "Choose a different file" : "Choose the file"}</Btn>
              {WIZ.fileCfg ? <p id="wiz-file-name">Chosen: <b>{WIZ.fileName}</b>{` (“${WIZ.fileCfg.meta?.title || "Untitled"}”).`}</p> : null}
              <input type="file" id="wiz-file" accept=".html,.htm,.json" hidden tabIndex={-1} aria-hidden="true" onChange={e => { readStartFile(e.target.files[0]); e.target.value = ""; }} />
              {WIZ.fileCfg ? null : <WField id="wiz-link-paste" k="start-link" label="Or paste a class link" value={WIZ.linkText}
                hint="A class link holds the whole escape room, so it works as a backup too. Paste all of it." set={v => { WIZ.linkText = v; }} />}</>;
          } }]} />;
  },
  check: () => {
    if (!WIZ.start) return [{ key: "start", target: "start-sample", text: "Choose how you want to start" }];
    if (WIZ.start === "file" && !WIZ.fileCfg && !String(WIZ.linkText || "").trim()) return [{ key: "start-file", target: "wiz-file-btn", text: WIZ.fileErr || "Choose the file you saved, or paste a class link" }];
    return [];
  },
  save: async () => {
    if (WIZ.start === "file" && !WIZ.fileCfg) {           // a pasted class link: unpack it (its content is untrusted: fromLink cleans and checks it)
      try { WIZ.fileCfg = await ER.fromLink(WIZ.linkText); WIZ.fileName = "class link"; }
      catch (e) { WIZ.errors = [{ key: "start-link", target: "wiz-link-paste", text: ER.LINK_WORDS[e.kind] ? linkWords(e.kind) : "That class link couldn't be opened" }]; renderWizard("errors"); return false; }
    }
    const next = WIZ.start === "sample" ? clone(SAMPLE) : WIZ.start === "empty" ? blankConfig() : WIZ.fileCfg;
    if (!(await startEscapeRoom(next, WIZ.start === "file"))) return false;
    const was = WIZ.start; WIZ.start = null; WIZ.fileCfg = null; WIZ.fileName = ""; WIZ.linkText = ""; WIZ.lastStart = was;
  },
  next: () => WIZ.lastStart === "file" ? hashFor("hub") : hashFor("name")
};
/* ---------- 3 Name it ---------- */
WSTEPS.name = {
  title: () => "What is this escape room called?",
  back: () => hashFor("start"),
  body: () => <>
    <WField id="wiz-title" label="What is this escape room called?" asH1 value={S.cfg.meta?.title} set={v => { S.cfg.meta.title = v; }}
      hint="For example: Chapter 4, learning theories. Students see it on the first screen and on their certificate." />
    <WField id="wiz-course" label="Which course is it for? (optional)" value={S.cfg.meta?.course} set={v => { S.cfg.meta.course = v; }} hint="For example: EDU 216. It is printed on the certificate." />
    <WHelp><p>A short, plain name works best, so students know which chapter it is about. It also names the files you download.</p></WHelp>
  </>,
  check: () => String(S.cfg.meta?.title || "").trim() ? [] : [{ key: "wiz-title", target: "wiz-title", text: "Enter a name for your escape room" }],
  next: () => hashFor("rooms")
};

/* ---------- 10 Done ---------- */
WSTEPS.done = {
  title: () => "Your escape room is ready",
  back: () => hashFor("walk"),
  body: () => {
    const cfg = S.cfg, st = ER.reviewStatus(cfg), pw = String(cfg.finish?.exitPassword || "").trim();
    const row = (label, value, step, what, href) => <div><dt>{label}</dt><dd>{value}</dd>
      <dd><a href={href || hashFor(step)}>Change<span className="sr">{" " + what}</span></a></dd></div>;
    const fresh = S.meta.backupAt && !unbacked();
    return <>
      <H1>Your escape room is ready</H1>
      <dl className="wsum" id="wiz-summary">
        {row("Name", cfg.meta?.title || "Untitled", "name", "the name")}
        {row("Rooms", `${cfg.rooms.length} ${cfg.rooms.length === 1 ? "room" : "rooms"}: ${cfg.rooms.map(x => x.title || "Untitled").join(", ")}`, "rooms", "the rooms")}
        {row("Facts checked", `${st.verified} of ${st.total} checked`, "facts", "which facts are checked")}
        {row("How students get it", deliveryWords() || "Not chosen yet", "deliver", "how students get it")}
        {row("Exit password", pw || "Not chosen yet", "password", "the exit password", hashFor("password", { from: "done" }))}
      </dl>
      <h2>Keep a card</h2>
      <p id="wiz-card-note">One printed page with the name, the rooms, the exit password, the date of your last backup and how to change it later. Keep it with your course notes.</p>
      <Btn className="stamp" id="wiz-card" aria-describedby="wiz-card-note" onClick={openTeacherCard}><Icon name="print" />Print a card for this escape room</Btn>
      <h2>Keep a backup</h2>
      {fresh ? <p id="wiz-done-backup-note">The file you downloaded is also your backup copy: it opens in this maker. Keep it somewhere safe, such as your course folder.</p>
        : <p id="wiz-done-backup-note">Download a backup copy and keep it somewhere safe, such as your course folder. It is one file: it plays as the game in any browser, and it opens again in this maker.</p>}
      {fresh ? null : <Btn className="stamp" id="wiz-done-backup" onClick={() => { backup(); renderWizard(); document.getElementById("wiz-done-backup-note")?.focus?.(); }}><Icon name="save" />Download a backup copy</Btn>}
      <h2>Changing it later</h2>
      {(S.meta.delivery || {}).where === "link"
        ? <p>Open this maker, choose “Open one I saved before”, and paste your class link (or pick your backup file). Make the change, make a new class link, and share the new link instead of the old one.</p>
        : <p>Open this maker, choose “Open one I saved before”, and pick your file. Make the change, download it again, and replace the old file in Moodle or Canvas.</p>}
    </>;
  },
  go: () => "Go to your escape room",
  next: () => hashFor("hub")
};

/* ---------- the hub: "Your escape room", for coming back ---------- */
WSTEPS.hub = {
  title: () => "Your escape room",
  continue: false,
  body: () => {
    const cfg = S.cfg, st = ER.reviewStatus(cfg);
    const task = (id, label, href, status, todo) => <li id={id} key={id}><a href={href}>{label}</a><span className={"st" + (todo ? " todo" : "")}>{status}</span></li>;
    return <>
      <H1>Your escape room</H1>
      <p className="wcap" id="wiz-hub-title">{cfg.meta?.title || "Untitled"}</p>
      <p>Choose what to work on. You can do these in any order.</p>
      <ul className="tasks" id="wiz-tasks">
        {task("task-name", "Name and course", hashFor("name"), String(cfg.meta?.title || "").trim() ? "Done" : "Not started", !String(cfg.meta?.title || "").trim())}
        {cfg.rooms.map((room, r) => { const s = roomStatus(r); return task("task-room-" + (r + 1), <>{`Room ${r + 1}: ${room.title || "Untitled"}`}<span className="kind">{ROOM_KIND[room.type] || room.type}</span></>,
          hashFor("room", { room: r + 1 }), s.total ? (s.left ? `${s.total - s.left} of ${s.total} checked` : "All checked") : "Nothing to check", false); })}
        {task("task-add", "Add another room", hashFor("add"), `${cfg.rooms.length} ${cfg.rooms.length === 1 ? "room" : "rooms"} so far`)}
        {task("task-facts", "Check your facts", hashFor("facts"), st.unverified ? `${st.unverified} not checked` : "All checked", !!st.unverified)}
        {task("task-try", "Try it as a student", hashFor("try"), "")}
        {task("task-deliver", "Get it to students", hashFor("deliver"), deliveryWords() || "Not started", !deliveryWords())}
        {task("task-password", "Change the exit password", hashFor("password", { from: "hub" }), String(cfg.finish?.exitPassword || "").trim() || "Not chosen yet")}
        <li id="task-backup"><Btn id="wiz-hub-backup" onClick={() => { backup(); renderWizard(); }}>Download a backup</Btn>
          <span className={"st" + (unbacked() ? " todo" : "")}>{S.meta.backupAt ? (unbacked() ? `Changed since your backup ${when(S.meta.backupAt)}` : `Backed up ${when(S.meta.backupAt)}`) : "Not backed up yet"}</span></li>
      </ul>
      <p className="wguide">Every step on one page, to keep beside your screen: {guideLink("wiz-guide")}.</p>
      <Library />
    </>;
  }
};
/* Every escape room in this browser, newest first, with Make another and Make a copy. */
function Library(){
  const list = [...S.lib.list].sort((a, b) => (b.updated || 0) - (a.updated || 0));
  return <>
    <h2 id="wiz-lib-title">Your escape rooms</h2>
    <p>{list.length === 1 ? "This is the only escape room in this browser." : `There are ${list.length} escape rooms in this browser. Each one is saved separately.`}</p>
    <ul className="wlist" id="wiz-lib" aria-labelledby="wiz-lib-title">{list.map(e => {
      const cur = e.id === S.curId, name = e.title || "Untitled";
      return <li key={e.id} data-id={e.id}><div className="row1"><b>{name}</b>{cur ? <span className="kind">(open now)</span> : null}</div>
        <div className="kind">{e.updated ? `Last changed ${when(e.updated)}` : ""}</div>
        {cur ? null : <div className="tools">
          <Btn className="inkline" id={"lib-open-" + e.id} onClick={() => { if (switchTo(e.id)) { renderWizard("heading"); say(`“${name}” is open.`); toast(`Opened “${name}”.`); } }}><Icon name="folder" />Open<span className="sr">{` “${name}”`}</span></Btn>
          <Btn className="inkline red" id={"lib-remove-" + e.id} onClick={async () => {
            if (!(await ask(`Remove “${name}” from this browser?`, ["If you have a backup file of it, you can open it again later. If not, it is gone for good."], { ok: "Remove it", danger: true }))) return;
            S.lib.list = S.lib.list.filter(x => x.id !== e.id); lsDel(keyOf(e.id)); lsDel(keyOf(e.id, true)); writeLib(); renderWizard(); document.getElementById("wiz-lib-title").scrollIntoView({ block: "nearest" });
            document.getElementById("wiz-another").focus(); say(`“${name}” removed from this browser.`);
          }}><Icon name="x" />Remove<span className="sr">{` “${name}”`}</span></Btn></div>}
      </li>;
    })}</ul>
    <div className="wacts" style={{ marginTop: "1rem" }}>
      <Btn className="stamp" id="wiz-another" onClick={() => { WIZ.start = null; wizGo(hashFor("start")); }}><Icon name="plus" />Make another escape room</Btn>
      <Btn className="stamp" id="wiz-copy" onClick={() => {
        const copy = clone(S.cfg); copy.meta = { ...(copy.meta || {}), title: `${S.cfg.meta?.title || "Untitled"} (copy)` };
        if (S.saveTimer) saveNow();
        S.curId = null; S.cfg = copy; S.meta = { rev: 0, backupRev: 0, backupAt: 0, savedAt: 0, reached: S.meta.reached, delivery: S.meta.delivery ? { ...S.meta.delivery } : undefined };
        changed(); saveNow(); renderWizard("heading"); toast(`Made a copy: “${copy.meta.title}”. It is open now, and the original is still in your list.`);
      }}><Icon name="page" />Make a copy of this one</Btn>
    </div>
  </>;
}

/* ---------- 4 Your rooms, and adding one ---------- */
export const PARTS = { quiz: ["questions", "story"], matching: ["cards", "clues", "story"] };
const roomSeq = () => S.cfg.rooms.flatMap((room, r) => (PARTS[room.type] || ["advanced"]).map(p => [r, p]));
const roomHash = (r, part) => hashFor("room", { room: r + 1, part });
function afterRooms(){ const s = roomSeq()[0]; return s ? roomHash(s[0], s[1]) : hashFor("facts"); }
WSTEPS.rooms = {
  title: () => "Your rooms",
  back: () => hashFor("name"),
  body: () => {
    const cfg = S.cfg, err = wErr("rooms");
    const move = r => { [cfg.rooms[r - 1], cfg.rooms[r]] = [cfg.rooms[r], cfg.rooms[r - 1]]; changed(); renderWizard();
      (document.getElementById(`wiz-room-up-${r}`) || document.getElementById(`wiz-room-change-${r}`))?.focus(); say(`Room ${r + 1} moved up. It is now room ${r}.`); };
    const remove = async r => {
      const room = cfg.rooms[r];
      if (!(await ask(`Remove room ${r + 1}?`, [`“${room.title || "Untitled"}” and everything in it will be removed.`, "This can't be undone."], { ok: "Remove room", danger: true }))) return;
      cfg.rooms.splice(r, 1); changed(); renderWizard();
      (document.getElementById(`wiz-room-change-${Math.min(r + 1, cfg.rooms.length)}`) || document.getElementById("wiz-add-room")).focus();
      say(`Room ${r + 1} removed. ${cfg.rooms.length} ${cfg.rooms.length === 1 ? "room" : "rooms"} left.`);
    };
    return <>
      <H1>Your rooms</H1>
      <p className="whint" id="wiz-rooms-hint">Students go through the rooms in this order. Most escape rooms have 3 to 5 rooms, and each takes students 3 to 5 minutes.</p>
      {err ? <Err id="wiz-rooms-err" text={err.text} /> : null}
      {cfg.rooms.length ? <ol className="wlist" id="wiz-room-list">{cfg.rooms.map((room, r) => <li key={r}>
        <div className="row1"><b>{`Room ${r + 1}: ${room.title || "Untitled"}`}</b><span className="kind">{ROOM_KIND[room.type] || room.type}</span></div>
        <div className="tools">
          <a className="inkline" id={`wiz-room-change-${r + 1}`} href={hashFor("room", { room: r + 1 })}><Icon name="pencil" />Change<span className="sr">{` room ${r + 1}`}</span></a>
          {r ? <Btn className="inkline" id={`wiz-room-up-${r + 1}`} onClick={() => move(r)}><Icon name="up" />Move up<span className="sr">{` room ${r + 1}`}</span></Btn> : null}
          <Btn className="inkline red" id={`wiz-room-remove-${r + 1}`} onClick={() => remove(r)}><Icon name="x" />Remove<span className="sr">{` room ${r + 1}`}</span></Btn>
        </div></li>)}</ol>
        : <p id="wiz-rooms-empty">No rooms yet. Add your first room. Not sure which kind? Start with quiz questions.</p>}
      {cfg.rooms.length > 8 ? <p className="wnote">{`That is ${cfg.rooms.length} rooms. Students may need more than half an hour; you could split it into two escape rooms.`}</p> : null}
      <div className="wacts" style={{ marginTop: "1rem" }}><Btn className="stamp" id="wiz-add-room" aria-describedby={err ? "wiz-rooms-err" : undefined} onClick={() => wizGo(hashFor("add"))}><Icon name="plus" />Add a room</Btn></div>
      <WHelp><p>Each room is one puzzle with a lock. Students open the lock to go on to the next room. After the last room they get a certificate with the exit password.</p>
        <p>Next you fill in each room, one page at a time.</p></WHelp>
    </>;
  },
  check: () => S.cfg.rooms.length ? [] : [{ key: "rooms", target: "wiz-add-room", text: "Add at least one room" }],
  next: () => afterRooms()
};
const KIND_OPTS = [
  { value: "quiz", title: "Quiz questions", pic: "key", desc: "Students answer questions to open the lock, like a chapter quiz.", eg: "For example: “Who wrote Democracy and Education (1916)?” Answer: John Dewey." },
  { value: "matching", title: "Match clues to cards", pic: "lock", desc: "Students match each clue to a person or idea. The codes on the matched cards open a padlock.", eg: "For example: the clue “learning by doing” matches the card “Progressivism”." },
  { value: "ordering", title: "Put in order (timeline)", pic: "glass", desc: "Students put events or steps in the right order. You set this kind up in Advanced mode.", eg: "For example: put five education laws in order, oldest first." },
  { value: "sorting", title: "Sort into groups", pic: "trays", desc: "Students sort each item into a group. You set this kind up in Advanced mode.", eg: "For example: is each classroom scene traditional or progressive?" },
  { value: "reflection", title: "Reflection (no wrong answers)", pic: "mirror", desc: "Students answer questions about their own views and get a result. You set this kind up in Advanced mode.", eg: "For example: “Your philosophy of education is closest to…”" }];
WSTEPS.add = {
  title: () => "What kind of puzzle should the next room be?",
  back: () => hashFor("rooms"),
  body: () => <>
    <WRadios name="kind" legend="What kind of puzzle should the next room be?" asH1 hint="Not sure? Start with quiz questions." value={WIZ.kind} options={KIND_OPTS} set={v => { WIZ.kind = v; rerender(); }} />
    <WHelp><p>Quiz questions and Match clues to cards are set up right here, step by step. The other kinds are set up in Advanced mode, where every setting is on one page.</p>
      <p>You can add more rooms later, and change their order on the “Your rooms” page.</p></WHelp>
  </>,
  check: () => WIZ.kind ? [] : [{ key: "kind", target: "kind-quiz", text: "Choose what kind of puzzle the room should be" }],
  save: () => { const room = TYPES[WIZ.kind].blank(); (room.cards || []).forEach(c => { c.decoy = false; }); S.cfg.rooms.push(room); changed(); say(`Room ${S.cfg.rooms.length} added: ${KIND_OPTS.find(o => o.value === WIZ.kind).title}.`); WIZ.kind = null; },
  next: () => hashFor("room", { room: S.cfg.rooms.length }),
  go: () => "Add this room"
};

/* ---------- 5 Fill in each room ---------- */
const clueStash = new WeakMap();          // a clue put aside when its card is marked "extra", in case the teacher changes their mind
const isDecoy = (c, room) => !String(c.clue || "").trim() && (c.decoy === true || (c.decoy == null && (room.cards || []).some(x => String(x.clue || "").trim())));
function lockLine(room){
  const m = ER.matching(room);
  return m.answer ? <>Students will open the lock with <b>{m.answer}</b>.</> : "Write at least one clue, and the lock's combination will show here.";
}
const ROOM_PART = {
  questions: { title: r => `Room ${r + 1}: Write your questions`, body: r => quizBody(S.cfg.rooms[r], r), check: r => quizCheck(S.cfg.rooms[r]) },
  cards: { title: r => `Room ${r + 1}: Who or what is on each card?`, body: r => cardsBody(S.cfg.rooms[r], r), check: r => cardsCheck(S.cfg.rooms[r]) },
  clues: { title: r => `Room ${r + 1}: Write the clue for each card`, body: r => cluesBody(S.cfg.rooms[r], r), check: r => cluesCheck(S.cfg.rooms[r]) },
  story: { title: r => `Room ${r + 1}: What do students read when they walk in?`, body: r => storyBody(S.cfg.rooms[r], r), check: r => storyCheck(S.cfg.rooms[r]) },
  advanced: { title: r => `Room ${r + 1}: ${ROOM_KIND[S.cfg.rooms[r].type] || "A room"}`, check: () => [],
    body: r => <>
      <H1>{`Room ${r + 1}: ${ROOM_KIND[S.cfg.rooms[r].type] || "A room"}`}</H1>
      <p>{`“${S.cfg.rooms[r].title || "Untitled"}” is a kind of room you set up in Advanced mode for now. Advanced mode shows every setting for the room on one page, with an answer key and a preview.`}</p>
      <p><a id="wiz-room-advanced" href={`#advanced&room=${r + 1}`}>{`Set up room ${r + 1} in Advanced mode`}</a></p>
      <p>When you have finished there, choose “Guided steps” at the top to come back here. Or choose Continue to go on to the next room.</p></> }
};
WSTEPS.room = {
  title: r => ROOM_PART[r.part].title(r.r),
  cap: r => ` · Room ${r.r + 1} of ${S.cfg.rooms.length}`,
  body: r => ROOM_PART[r.part].body(r.r),
  check: r => ROOM_PART[r.part].check(r.r),
  back: r => { const seq = roomSeq(), i = seq.findIndex(([k, p]) => k === r.r && p === r.part); return i > 0 ? roomHash(...seq[i - 1]) : hashFor("rooms"); },
  next: r => { const seq = roomSeq(), i = seq.findIndex(([k, p]) => k === r.r && p === r.part); return seq[i + 1] ? roomHash(...seq[i + 1]) : hashFor("facts"); }
};
const HintsLater = ({ r }) => <p className="wnote">Hints: you can give students up to two hints in this room. <a href={`#advanced&room=${r + 1}`}>Set up hints in Advanced mode</a>.</p>;
/* Questions */
function quizBody(room, r){
  const qs = room.questions = room.questions || [];
  const err = wErr("questions");
  const add = () => { qs.push(blankQuestion()); changed(); renderWizard(); document.getElementById(`q${qs.length}-prompt`).focus(); say(`Question ${qs.length} added.`); };
  return <>
    <H1>{`Room ${r + 1}: Write your questions`}</H1>
    <p className="whint">Students must get every question right to open the lock. They are told how many are right, not which ones.</p>
    <WHelp><p>A worked example:</p>
      <ul><li>Question: Who wrote <i>Democracy and Education</i> (1916)?</li><li>Correct answer: John Dewey</li><li>Another accepted answer: Dewey</li></ul>
      <p>Students' typing is forgiving: capitals, accents and punctuation don't matter. Add the other fair ways of writing the answer, such as a surname alone.</p>
      <p>For multiple choice, write the choices and mark the correct one. Avoid “All of the above”: students who listen to the choices one at a time can't see what is above.</p>
      <p>Have many questions in a document already? In Advanced mode, “Edit all questions as text” lets you paste them in.</p></WHelp>
    {err ? <Err id="wiz-q-err" text={err.text} /> : null}
    {qs.length ? qs.map((q, i) => <QuestionBox key={i} room={room} q={q} i={i} />) : <p id="wiz-q-empty">No questions yet. Add your first question. Students must get them all right to open the lock.</p>}
    <div className="wacts" style={{ marginTop: "1rem" }}><Btn className="stamp" id="wiz-add-q" onClick={add}><Icon name="plus" />{qs.length ? "Add another question" : "Add a question"}</Btn></div>
    <HintsLater r={r} />
  </>;
}
function QuestionBox({ room, q, i }){
  const N = i + 1, qs = room.questions;
  const parts = () => String(q.answers || "").split("|").map(x => x.trim());
  const setPart = (j, v) => { const p = parts(); p[j] = v; q.answers = p.join(" | "); };
  const remove = async () => {
    if (!(await ask(`Remove question ${N}?`, [q.prompt ? `“${String(q.prompt).slice(0, 90)}”` : null, "This can't be undone."], { ok: "Remove question", danger: true }))) return;
    qs.splice(i, 1); changed(); renderWizard(); (document.getElementById(`q${Math.min(N, qs.length)}-prompt`) || document.getElementById("wiz-add-q")).focus(); say(`Question ${N} removed.`);
  };
  let answerPart;
  if (q.kind === "choice") {
    q.choices = q.choices || [];
    const ce = wErr(`q${N}-choices`) || wErr(`q${N}-correct`);
    answerPart = <RadioGroup render={<fieldset className="wradios" aria-describedby={ce ? `q${N}-choices-err` : undefined} />} name={`q${N}-correct`}
      value={q.correct >= 0 && q.correct < q.choices.length ? String(q.correct) : null}
      onValueChange={v => { if (v == null) return; const j = Number(v); q.correct = j; wUnverify(q); changed(); say(`Choice ${j + 1} is the correct answer.`); }}>
      <legend><span className="wlegend">Choices</span></legend>
      <p className="whint">Write the choices and mark the correct one.</p>
      {ce ? <Err id={`q${N}-choices-err`} text={ce.text} /> : null}
      {q.choices.map((c, j) => <div className="wline" key={j}>
        <WField id={`q${N}-c${j}`} label={`Choice ${j + 1}`} value={c} item={q} set={v => { q.choices[j] = v; }} />
        <label className="wchk"><Radio id={`q${N}-ok${j}`} className="ctl" value={String(j)} />
          <span className="box round" aria-hidden="true"><Icon name="tick" /></span>Correct<span className="sr">{` (choice ${j + 1})`}</span></label>
        <Btn className="inkline red" onClick={() => { q.choices.splice(j, 1); if (j < q.correct) q.correct--; else if (j === q.correct) q.correct = -1; wUnverify(q); changed(); renderWizard();
          (document.getElementById(`q${N}-c${Math.min(j, q.choices.length - 1)}`) || document.getElementById(`q${N}-add-c`)).focus(); say(`Choice ${j + 1} removed.`); }}><Icon name="x" />Remove<span className="sr">{` choice ${j + 1}`}</span></Btn>
      </div>)}
      <Btn className="inkline" id={`q${N}-add-c`} onClick={() => { q.choices.push(""); changed(); renderWizard(); document.getElementById(`q${N}-c${q.choices.length - 1}`).focus(); }}><Icon name="plus" />Add a choice</Btn>
    </RadioGroup>;
  } else {
    const p = parts();
    answerPart = <>
      <WField id={`q${N}-a0`} label="Correct answer" value={p[0]} item={q} set={v => setPart(0, v)} hint="Capitals, accents and punctuation don't matter." />
      {p.slice(1).map((a, k) => <div className="wline" key={k}>
        <WField id={`q${N}-a${k + 1}`} label="Another accepted answer" value={a} item={q} set={v => setPart(k + 1, v)} />
        <Btn className="inkline red" onClick={() => { const all = parts(); all.splice(k + 1, 1); q.answers = all.join(" | "); wUnverify(q); changed(); renderWizard(); document.getElementById(`q${N}-add-a`).focus(); }}>
          <Icon name="x" />Remove<span className="sr">{` accepted answer ${k + 2}`}</span></Btn>
      </div>)}
      <Btn className="inkline" id={`q${N}-add-a`} onClick={() => { q.answers = [...parts(), ""].join(" | "); changed(); renderWizard(); document.getElementById(`q${N}-a${parts().length - 1}`).focus(); }}>
        <Icon name="plus" />Add another accepted answer</Btn>
    </>;
  }
  return <fieldset className="wq-item" id={`q${N}`}><legend>{`Question ${N}`}</legend>
    <WField id={`q${N}-prompt`} label="Question" area rows={2} value={q.prompt} item={q} set={v => { q.prompt = v; }} />
    <WRadios name={`q${N}-kind`} legend="How do students answer?" cls="wkinds" value={q.kind === "choice" ? "choice" : "short"}
      options={[{ value: "short", title: "They type it" }, { value: "choice", title: "Multiple choice" }]}
      set={v => { q.kind = v; if (v === "choice" && !(q.choices || []).length) q.choices = ["", "", "", ""]; wUnverify(q); changed(); renderWizard(); }} />
    {answerPart}
    <div className="tools" style={{ marginTop: ".6rem" }}><Btn className="inkline red" id={`q${N}-remove`} onClick={remove}><Icon name="x" />{`Remove question ${N}`}</Btn></div>
  </fieldset>;
}
function quizCheck(room){
  const out = [], qs = room.questions || [];
  if (!qs.length) out.push({ key: "questions", target: "wiz-add-q", text: "Add at least one question" });
  qs.forEach((q, i) => {
    const N = i + 1;
    if (!String(q.prompt || "").trim()) out.push({ key: `q${N}-prompt`, target: `q${N}-prompt`, text: `Write question ${N}` });
    if (q.kind === "choice") {
      const filled = (q.choices || []).filter(c => String(c).trim());
      if (filled.length < 2) { const j = Math.max(0, (q.choices || []).findIndex(c => !String(c).trim())); out.push({ key: `q${N}-choices`, target: (q.choices || []).length ? `q${N}-c${j}` : `q${N}-add-c`, text: `Question ${N} needs at least 2 choices` }); }
      else if (!(q.correct >= 0 && String((q.choices || [])[q.correct] || "").trim())) out.push({ key: `q${N}-correct`, target: `q${N}-ok0`, text: `Question ${N}: mark which choice is correct` });
    } else if (!ER.accepted(q.answers).length) out.push({ key: `q${N}-a0`, target: `q${N}-a0`, text: `Question ${N} needs a correct answer` });
  });
  return out;
}
/* Cards and clues */
function cardsBody(room, r){
  const cards = room.cards = room.cards || [];
  const err = wErr("cards");
  const add = () => { cards.push({ ...blankCard(), decoy: false }); changed(); renderWizard(); document.getElementById(`c${cards.length}-term`).focus(); say(`Card ${cards.length} added.`); };
  return <>
    <H1>{`Room ${r + 1}: Who or what is on each card?`}</H1>
    <p className="whint">Each card shows a person or an idea, such as a philosopher or a theory. On the next page you write a clue for each one. Students see the cards in A to Z order, each with a code letter.</p>
    <WHelp><p>For example: a card named “Progressivism”, with the note “Dewey, 1916”.</p>
      <p>Four to eight cards works well. You can add an extra card with no clue to make it harder: students have to work out which card no clue points to.</p></WHelp>
    {err ? <Err id="wiz-c-err" text={err.text} /> : null}
    {cards.length ? cards.map((c, i) => <fieldset className="wq-item" key={i}><legend>{`Card ${i + 1}`}</legend>
      <WField id={`c${i + 1}-term`} label="Name on the card" value={c.term} item={c} set={v => { c.term = v; }} />
      <WField id={`c${i + 1}-detail`} label="Dates or a short note (optional)" value={c.detail} item={c} set={v => { c.detail = v; }} />
      <div className="tools" style={{ marginTop: ".5rem" }}><Btn className="inkline red" id={`c${i + 1}-remove`} onClick={async () => {
        if (!(await ask(`Remove card ${i + 1}?`, [c.term ? `“${c.term}” and its clue will be removed.` : null, "This can't be undone."], { ok: "Remove card", danger: true }))) return;
        cards.splice(i, 1); changed(); renderWizard(); (document.getElementById(`c${Math.min(i + 1, cards.length)}-term`) || document.getElementById("wiz-add-card")).focus(); say(`Card ${i + 1} removed.`);
      }}><Icon name="x" />{`Remove card ${i + 1}`}</Btn></div></fieldset>)
      : <p id="wiz-c-empty">No cards yet. Add your first card.</p>}
    <div className="wacts" style={{ marginTop: "1rem" }}><Btn className="stamp" id="wiz-add-card" onClick={add}><Icon name="plus" />Add a card</Btn></div>
  </>;
}
function cardsCheck(room){
  const out = [], cards = room.cards || [];
  if (cards.length < 2) out.push({ key: "cards", target: "wiz-add-card", text: "Add at least two cards" });
  cards.forEach((c, i) => { if (!String(c.term || "").trim()) out.push({ key: `c${i + 1}-term`, target: `c${i + 1}-term`, text: `Card ${i + 1} needs a name` }); });
  const max = room.codeStyle === "numbers" ? 9 : 26;
  if (cards.length > max) out.push({ key: "cards", target: `c${cards.length}-remove`, text: `A room can have at most ${max} cards` });
  return out;
}
function cluesBody(room, r){
  const cards = room.cards || [];
  const err = wErr("clues");
  return <>
    <H1>{`Room ${r + 1}: Write the clue for each card`}</H1>
    <p className="whint">Students read the clues in this order. Each clue points to one card. The cards' code letters, in the order of the clues, open the padlock.</p>
    <WHelp><p>For example, the clue for “Progressivism” could be: “Learning by doing: students solve real problems together.”</p>
      <p>Write the clue so it points to one card only, in your own words. Don't point to a card by its colour or where it is on the screen: the layout changes on phones and for screen readers.</p>
      <p>The code letters are given out by the game. To choose your own lock word, such as LEARN, use Advanced mode.</p></WHelp>
    <p className="lockline" id="wiz-lock-line">{lockLine(room)}</p>
    {err ? <Err id="wiz-clue-err" text={err.text} /> : null}
    {cards.map((c, i) => {
      const N = i + 1, extra = isDecoy(c, room), name = c.term || `card ${N}`;
      return <fieldset className="wq-item" key={i}><legend>{`Card ${N}: ${c.term || "no name yet"}`}</legend>
        {extra ? <p className="wnote">Students see this card, but no clue points to it.</p>
          : <WField id={`c${N}-clue`} label={`Clue for ${name}`} area rows={2} value={c.clue} item={c} set={v => { c.clue = v; if (v.trim()) delete c.decoy; }} />}
        <div className="wline">
          <WCheck id={`c${N}-extra`} checked={extra} onChange={on => {
            if (on) { if (c.clue) clueStash.set(c, c.clue); c.clue = ""; c.decoy = true; } else { c.decoy = false; if (clueStash.has(c)) c.clue = clueStash.get(c); clueStash.delete(c); }
            wUnverify(c); changed(); renderWizard(); say(on ? `${name} is now an extra card with no clue.` : `${name} needs a clue again.`); }}>Extra card, no clue<span className="sr">{` (${name})`}</span></WCheck>
          {i ? <Btn className="inkline" id={`c${N}-up`} onClick={() => { [cards[i - 1], cards[i]] = [cards[i], cards[i - 1]]; changed(); renderWizard(); (document.getElementById(`c${i}-up`) || document.getElementById(`c${i}-extra`)).focus(); say(`Moved up. It is now clue ${i}.`); }}>
            <Icon name="up" />Move up<span className="sr">{` (${name})`}</span></Btn> : null}
        </div></fieldset>;
    })}
    <HintsLater r={r} />
  </>;
}
function cluesCheck(room){
  const out = [], cards = room.cards || [];
  cards.forEach((c, i) => { if (!isDecoy(c, room) && !String(c.clue || "").trim()) out.push({ key: `c${i + 1}-clue`, target: `c${i + 1}-clue`, text: `Write the clue for “${c.term || "card " + (i + 1)}”, or mark it as an extra card` }); });
  if (!out.length && !cards.some(c => String(c.clue || "").trim())) out.push({ key: "clues", target: cards.length ? "c1-extra" : "wiz-lock-line", text: "Write at least one clue" });
  return out;
}
/* What students read */
function storyBody(room, r){
  return <>
    <H1>{`Room ${r + 1}: What do students read when they walk in?`}</H1>
    <WField id="room-title" label="Name of the room" value={room.title} set={v => { room.title = v; }} hint="For example: The Library." />
    <WField id="room-story" label="What students read" area rows={4} value={room.story} set={v => { room.story = v; }}
      hint={room.type === "matching" ? "Say what the room is about and what to do. For example: “The librarian left a clue for each book. Match each clue to a book, then use the books' letters to open the padlock.”"
        : "Say what the room is about and what to do. For example: “The strongbox opens when every answer is right. You can try as often as you need.”"} />
    <WHelp><p>Students read this first, before the puzzle. Keep it to two or three short sentences, and say plainly what to do: not everyone can work it out from the picture.</p>
      <p>To make words bold, put two stars on each side: **like this**. One star on each side makes them italic.</p></WHelp>
  </>;
}
function storyCheck(room){
  const out = [];
  if (!String(room.title || "").trim()) out.push({ key: "room-title", target: "room-title", text: "Enter a name for this room" });
  if (!String(room.story || "").trim()) out.push({ key: "room-story", target: "room-story", text: "Write what students read in this room" });
  return out;
}

/* ---------- 6 Check your facts: every gradable item in one list ---------- */
const plainText = s => String(s ?? "").replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1").trim();
function factWords(room, list, it){
  if (list === "cards") return [`Card: ${plainText(it.term) || "(no name)"}${it.detail ? ` (${plainText(it.detail)})` : ""}`, String(it.clue || "").trim() ? `Clue: ${plainText(it.clue)}` : "An extra card, with no clue"];
  if (room.type === "quiz") return [`Question: ${plainText(it.prompt) || "(not written yet)"}`, `Answer: ${it.kind === "choice" ? plainText((it.choices || [])[it.correct]) || "(none marked)" : ER.accepted(it.answers).length ? String(it.answers).split("|").map(x => x.trim()).filter(Boolean).join(" / ") : "(none yet)"}`];
  if (room.type === "ordering") { const i = room.items.indexOf(it); return [`Number ${i + 1} in the order: ${plainText(it.text)}`, it.label ? `Shown after solving: ${plainText(it.label)}` : ""]; }
  if (room.type === "sorting") return [`Item: ${plainText(it.text)}`, `Group: ${plainText((room.categories || [])[it.category]) || "(none chosen)"}`];
  if (list === "profiles") return [`Result: ${plainText(it.name)}`, plainText(it.desc)];
  return [`Question: ${plainText(it.prompt)}`, (it.options || []).map(o => `${plainText(o.text)} → ${plainText((room.profiles.find(p => p.key === o.profile) || {}).name || "?")}`).join("; ")];
}
const NOUN = { cards: "card", questions: "question", items: "item", profiles: "result" };
const isOn = b => b.getAttribute("aria-checked") === "true";
function nextUnchecked(){
  const boxes = [...document.querySelectorAll(".wfacts [role=checkbox]")], open = boxes.filter(b => !isOn(b));
  if (!open.length) { say("Everything is checked."); document.getElementById("wiz-facts-count").focus(); return; }
  const at = boxes.indexOf(document.activeElement.closest?.("li")?.querySelector("[role=checkbox]"));
  const next = open.find(b => boxes.indexOf(b) > at) || open[0];
  next.closest("li").scrollIntoView({ block: "center" }); next.focus({ preventScroll: true });
}
WSTEPS.facts = {
  title: () => "Check your facts",
  back: () => { const s = roomSeq(); return s.length ? roomHash(...s[s.length - 1]) : hashFor("rooms"); },
  body: () => {
    const cfg = S.cfg, st = ER.reviewStatus(cfg), items = ER.reviewItems(cfg);
    const n = st.unverified;
    return <>
      <H1>Check your facts</H1>
      <p id="wiz-facts-count" tabIndex={-1}><b>{`${st.verified} of ${st.total} checked.`}</b></p>
      <p className="whint">Check each item against your textbook or other sources, and say where you checked it. Students see a “Draft” notice until every item is checked.</p>
      {sampleUnchecked(cfg) ? <p id="wiz-ai-note">The sample was written with AI help and may contain mistakes, so check every item from it.</p> : null}
      {WIZ.warn && n ? <section className="errsum" id="wiz-warn" tabIndex={-1} aria-labelledby="wiz-warn-title">
        <h2 id="wiz-warn-title">{`${n} ${n === 1 ? "item isn't" : "items aren't"} checked yet`}</h2>
        <p>Students will see the “Draft” notice, which says the answers may contain mistakes, until every item is checked.</p>
        <div className="wacts" style={{ marginTop: ".6rem" }}><Btn className="stamp" id="wiz-check-now" onClick={() => { WIZ.warn = false; rerender(); nextUnchecked(); }}>Check them now</Btn>
          <Btn className="stamp" id="wiz-continue-anyway" onClick={() => wizGo(hashFor("try"))}>Continue anyway</Btn></div></section> : null}
      <div className="wacts" style={{ marginTop: ".8rem" }}>
        <Btn className="stamp" id="wiz-next-unchecked" onClick={nextUnchecked}><Icon name="down" />Next not checked</Btn>
        <Btn className="inkline" id="wiz-print" onClick={openAnswerSheet}><Icon name="print" />Print the answer key</Btn></div>
      <WHelp><p>Nothing is ever checked for you. Tick an item only after you have checked it yourself.</p>
        <p>If you change an item later, its tick is taken off, so you can check it again.</p>
        <p>To check on paper, print the answer key, then come back and tick the items here.</p></WHelp>
      {cfg.rooms.map((room, r) => {
        const mine = items.filter(x => x.room === r);
        if (!mine.length) return null;
        return <Fragment key={r}><h2>{`Room ${r + 1}: ${room.title || "Untitled"}`}</h2><ul className="wfacts">{mine.map(x => {
          const it = x.item, k = `f${r + 1}-${x.list}-${x.i + 1}`, name = `room ${r + 1}, ${NOUN[x.list] || "item"} ${x.i + 1}`;
          const [what, ans] = factWords(room, x.list, it);
          return <li key={k}><p className="what">{what}</p>{ans ? <p className="ans">{ans}</p> : null}
            {changedAfterCheck.has(it) && !it.verified ? <p className="again">You changed this after checking it, so check it again.</p> : null}
            <div className="wline">
              <WField id={k + "-src"} label="Where you checked it" value={it.source} placeholder="e.g. Textbook ch. 3, p. 45" set={v => { it.source = v; }} />
              <WCheck id={k + "-ok"} checked={it.verified === true} onChange={on => {
                it.verified = on; changedAfterCheck.delete(it); changed();
                const s = ER.reviewStatus(S.cfg); say(`${on ? "Checked" : "No longer checked"}: ${name}. ${s.verified} of ${s.total} checked.`); }}>I checked this is correct<span className="sr">{` (${name})`}</span></WCheck>
            </div></li>;
        })}</ul></Fragment>;
      })}
    </>;
  },
  gate: () => { if (ER.reviewStatus(S.cfg).unverified && !WIZ.warn) { WIZ.warn = true; renderWizard(); document.getElementById("wiz-warn").focus(); return true; } return false; },
  next: () => hashFor("try")
};

/* ---------- 7 Try it as a student (the same preview as Advanced mode) ---------- */
/* Problems that would make a room impossible to solve, each linked to the step where it is fixed. */
export function problemsLinked(){
  return ER.validate(S.cfg).map(text => {
    const m = text.match(/^Room (\d+)/), r = m ? +m[1] - 1 : -1;
    const href = r >= 0 ? (PARTS[S.cfg.rooms[r]?.type] ? hashFor("room", { room: r + 1 }) : `#advanced&room=${r + 1}`) : /^Settings/.test(text) ? hashFor("name") : hashFor("rooms");
    return { key: "problem", href, text };
  });
}
WSTEPS.try = {
  title: () => "Try it as a student",
  back: () => hashFor("facts"),
  body: () => <>
    <H1>Try it as a student</H1>
    <p>Play it the way your students will. In the bar at the top you can jump to any room and use “Show answers” to skip ahead. Nothing you do here is graded or saved.</p>
    <div className="wacts" style={{ marginTop: "1rem" }}><Btn className="plate" id="wiz-try" onClick={() => {
      const errs = problemsLinked();
      if (errs.length) { WIZ.errors = errs; renderWizard("errors"); return; }
      WIZ.errors = []; rerender(); openPreview(0);
    }}><Icon name="play" />Start the student view</Btn></div>
    <WHelp><p>The student view fills the screen. Press Esc, or “Exit preview” at the top, to come back to this page.</p>
      <p>If something needs fixing first, a list of problems appears here, each with a link to the page where you fix it.</p></WHelp>
  </>,
  next: () => hashFor("deliver")
};

/* ---------- class links (the walkthrough's first step) ---------- */
function LinkStep(){
  const L = S.meta.link;
  if (!linkFresh()) return <li>
    {L && L.url ? <p className="ferr" id="wiz-link-stale">{"You changed the escape room after making your link. The old link still opens the old version" + (S.meta.pwRev > L.rev ? ", with the old exit password" : "") + ". Make a new link, and share that one instead."}</p>
      : <p>The link holds the whole escape room. Nothing is uploaded anywhere.</p>}
    <Btn className="plate" id="wiz-make-link" onClick={async () => {
      const url = await makeClassLink(); if (!url) return;
      renderWizard(); document.getElementById("wiz-link")?.focus(); say("Your class link is ready. Copy it with the Copy link button.");
    }}><Icon name="link" />{L && L.url ? "Make a new class link" : "Make the class link"}</Btn></li>;
  return <li>
    <label className="wlabel" htmlFor="wiz-link">Your class link</label>
    <p className="whint" id="wiz-link-size">{`It is ${L.url.length.toLocaleString("en-US")} characters long, so copy it with the button rather than by hand.`}</p>
    <textarea id="wiz-link" className="wlink" readOnly rows={3} spellCheck="false" aria-describedby="wiz-link-size" value={L.url} onFocus={e => e.target.select()} />
    <div className="copy"><Btn className="stamp" id="wiz-link-copy" onClick={e => copyText(L.url, e.currentTarget, "The class link")}><Icon name="page" />Copy link</Btn>
      <a className="inkline" id="wiz-link-open" href={L.url} target="_blank" rel="noopener"><Icon name="play" />Open it as a student<span className="sr"> (opens in a new tab)</span></a>
      <span className="done" /></div>
    <LinkNotes url={L.url} pre="wiz" />
  </li>;
}

/* ---------- 8 How will students get it? ---------- */
WSTEPS.deliver = {
  title: () => "How will your students get to the escape room?",
  back: () => hashFor("try"),
  body: () => {
    const d = S.meta.delivery = S.meta.delivery || {};
    const set = (k, v) => { d[k] = v; saveMeta(); renderWizard(); };
    const how = where => <WRadios name="how" legend={`Should ${LMS[where]} record the grade by itself?`} value={d.how} set={v => set("how", v)}
      options={[{ value: "quiz", title: "No: I'll add a one-question quiz with the exit password", desc: "Works everywhere, with no help from your administrator. Recommended if you are not sure." },
        { value: "scorm", title: "Yes: use a grade file (SCORM), if my school allows it", desc: `${LMS[where]} records the grade when a student finishes. Your school must have SCORM switched on.` }]} />;
    return <>
      <WRadios name="where" legend="How will your students get to the escape room?" asH1 value={d.where} set={v => set("where", v)}
        hint="Next you get step-by-step instructions for the one you choose."
        options={[{ value: "link", title: "Share a class link (recommended)", desc: "Works anywhere: paste it into Moodle, Canvas, Google Classroom or an email. Students click it and play. The grade comes from a one-question quiz with the exit password." },
          { value: "moodle", title: "Moodle", reveal: () => how("moodle") }, { value: "canvas", title: "Canvas", reveal: () => how("canvas") },
          { value: "other", title: "Another course system", desc: "Such as Blackboard or D2L Brightspace, with a file. (For Google Classroom, a class link is easiest.)" },
          { value: "file", title: "I'll email or post a file", desc: "Students download one file and open it in their browser." }]} />
      <WHelp><p>Which should I pick?</p>
        <table className="wcompare"><thead><tr><th scope="col"></th><th scope="col">Grade file (SCORM)</th><th scope="col">File and exit-password quiz</th></tr></thead>
          <tbody>{[["Needs your administrator to switch something on", "Sometimes (often in Canvas)", "Never"], ["The grade appears by itself", "Yes", "Yes, the quiz marks it"],
            ["Students could share the password", "No", "Yes, so use it for low-stakes work"], ["Updating it later", "Replace the package", "Replace the file"],
            ["Recommended for a first time", "", "Yes"]].map(([a, b, c]) => <tr key={a}><th scope="row">{a}</th><td>{b}</td><td>{c}</td></tr>)}</tbody></table></WHelp>
    </>;
  },
  check: () => {
    const d = S.meta.delivery || {};
    if (!d.where) return [{ key: "where", target: "where-link", text: "Choose how your students will get to the escape room" }];
    if (LMS[d.where] && !d.how) return [{ key: "how", target: "how-quiz", text: `Choose how the grade gets to ${LMS[d.where]}` }];
    return [];
  },
  next: () => hashFor("walk")
};

/* ---------- 9 (part) Change the exit password ----------
   Reached from the Done page's summary ("Change"), the walkthrough and the hub. One field, focused on arrival; nothing is
   saved until "Save the new password". After a change, a second page says what it means for students who already finished,
   the quiz, and a class link or file made before (changed() moves meta.rev on, so the walkthrough flags an old link). */
const pwNow = () => String(S.cfg.finish?.exitPassword || "").trim();
const pwFrom = r => ({ done: "done", walk: "walk", hub: "hub" })[r.q.get("from")] || "done";
/* Menu names are written as B("…") calls: tests/guide.js checks that every course-system menu name in the quick-start
   guide is one of them, by reading the built page (a property call keeps the name B when the bundle is minified). */
const M = { B: t => <b>{t}</b> };
const MENUS = () => <span className="menus"> Menus can differ by version.</span>;
const CopyRow = ({ id, label, text, what, cls = "" }) => <div className="copy"><span className={"val " + cls} id={id}>{text}</span>
  <Btn className="stamp" id={id + "-copy"} onClick={e => copyText(text, e.currentTarget, what)}>Copy<span className="sr">{" " + label}</span></Btn><span className="done" /></div>;
function pwSaved(r){
  const pw = pwNow(), old = S.meta.pwOld && S.meta.pwOld !== pw ? S.meta.pwOld : "", d = S.meta.delivery || {}, L = S.meta.link;
  const remake = (text, id) => <a id={id} href={hashFor(d.where ? "walk" : "deliver")}>{text}</a>;
  return <>
    <H1>Your new exit password is saved</H1>
    <p>From now on, students see it on their certificate at the end:</p><CopyRow id="wiz-pw-new" label="the new exit password" text={pw} what="The exit password" />
    <h2>What to do now</h2>
    <ol className="walk" id="wiz-pw-todo">
      {old ? <li id="wiz-pw-finished">Students who already finished saw the old password, <b>{old}</b>, on their certificate. That doesn't change for them.</li> : null}
      <li id="wiz-pw-quiz">In your course quiz, change the correct answer to <b>{pw}</b>.</li>
      {old ? <li id="wiz-pw-keep">Keep <b>{old}</b> as a second correct answer in the quiz, so students who already finished still get their mark.</li> : null}
      {L && L.url ? <li id="wiz-pw-link">Your class link still has the old password: a link keeps the escape room as it was when you made it. {remake("Make a new class link", "wiz-pw-relink")} and share it instead of the old one.</li>
        : S.meta.downloaded ? <li id="wiz-pw-link">The file you downloaded before still has the old password. {remake("Download it again", "wiz-pw-relink")} and replace the old file in your course.</li>
        : <li id="wiz-pw-link">If you already shared a class link or a file, it still has the old password. Make a new one and share it instead.</li>}
    </ol>
  </>;
}
WSTEPS.password = {
  title: r => r.part === "saved" ? "Your new exit password is saved" : "What should the exit password be?",
  focus: r => r.part === "saved" ? null : "wiz-pw",
  back: r => hashFor(pwFrom(r)),
  body: r => {
    if (r.part === "saved") return pwSaved(r);
    const pw = pwNow();
    return <>
      <WField id="wiz-pw" label="What should the exit password be?" asH1 value={WIZ.pw ?? pw} live={false} set={v => { WIZ.pw = v; }}
        hint={(pw ? `Now it is ${pw}. ` : "") + "Students see it on their certificate at the end, and type it into your course quiz. Letters and numbers that are easy to copy work best."} />
      {pw ? <p id="wiz-pw-note">Students have already played? You can still change it. After you save, the next page says what to do about your quiz and your class link.</p> : null}
    </>;
  },
  check: r => r.part === "saved" || String(WIZ.pw ?? pwNow()).trim() ? [] : [{ key: "wiz-pw", target: "wiz-pw", text: "Enter an exit password" }],
  save: r => {
    WIZ.pwChanged = false;
    if (r.part === "saved" || WIZ.pw == null) return;
    const v = WIZ.pw.trim(), old = pwNow(); WIZ.pw = null;
    if (v === old) return;
    S.cfg.finish = S.cfg.finish || {}; S.cfg.finish.exitPassword = v; S.meta.pwOk = v; changed();
    if (old) { S.meta.pwOld = old; S.meta.pwAt = Date.now(); }
    S.meta.pwRev = S.meta.rev; saveNow();
    WIZ.pwChanged = true;
  },
  go: r => r.part === "saved" ? "Continue" : "Save the new password",
  next: r => WIZ.pwChanged ? hashFor("password", { part: "saved", from: pwFrom(r) }) : hashFor(pwFrom(r))
};

/* ---------- 9 Walkthroughs: the download, then the menus to use ---------- */
function walkRoute(){ const d = S.meta.delivery || {}; return LMS[d.where] ? `${d.where}-${d.how}` : d.where; }
const WALK_TITLE = { "moodle-scorm": "Put it in Moodle (grade file)", "moodle-quiz": "Put it in Moodle (file and exit-password quiz)", "canvas-scorm": "Put it in Canvas (grade file)",
  "canvas-quiz": "Put it in Canvas (file and exit-password quiz)", other: "Put it in your course system", file: "Share it as a file", link: "Share a class link" };
function DownloadStep({ route }){
  const zip = /scorm$/.test(route), lms = LMS[(S.meta.delivery || {}).where];
  const label = zip ? `Download the ${lms} grade file (.zip)` : "Download the game file (.html)";
  return <li><Btn className="plate" id="wiz-download" onClick={async () => {
      if (!(await readyToDownload())) return;
      if (zip) { download(`${slug()}-SCORM.zip`, ER.scorm(gameHtml(), S.cfg.meta.title), "application/zip"); toast(`The ${lms} grade file is in your Downloads folder. Don't unzip it.`); }
      else { download(`${slug()}.html`, gameHtml(), "text/html"); backedUp(); toast("The game file is in your Downloads folder. It is also your backup: it opens again in this maker."); }
      S.meta.downloaded = Date.now(); saveMeta(); renderWizard(); document.getElementById("wiz-download")?.focus();
    }}><Icon name="save" />{label}</Btn>
    {zip ? <p>Don't unzip it: {M.B(lms)} needs the .zip file exactly as it is.</p> : <p>This one file is the whole escape room. It is also your backup copy: it opens again in this maker.</p>}
    {S.meta.downloaded ? <p className="wnote" id="wiz-downloaded">{`Downloaded ${when(S.meta.downloaded)}.`}</p> : null}
  </li>;
}
function PasswordPart({ withQuiz, how = "when you download the file in step 1" }){
  const pw = String(S.cfg.finish?.exitPassword || "").trim(), ready = pw && !needsPassword();
  return <>
    <h2>Your exit password</h2>
    {ready ? <><p>Students see it on their certificate at the end.</p><CopyRow id="wiz-password" label="the exit password" text={pw} what="The exit password" /></>
      : <p id="wiz-password-later">{`You choose it ${how}.`}</p>}
    <p><a id="wiz-password-change" href={hashFor("password", { from: "walk" })}>{ready ? "Change the exit password" : "Choose it now"}</a></p>
    {withQuiz ? <>
      <h2>Ready to copy into your quiz</h2>
      <p>Question text:</p><CopyRow id="wiz-quiz-q" label="the question text" text={QUIZ_Q} what="The question text" cls="text" />
      {ready ? <><p>Correct answer:</p><CopyRow id="wiz-quiz-a" label="the correct answer" text={pw} what="The answer" /></> : null}
      <p>Set the quiz to ignore capital letters, so <i>{(ready ? pw : suggestPassword()).toLowerCase()}</i> and <i>{(ready ? pw : suggestPassword()).toUpperCase()}</i> both count. If you change the password after students have played, keep the old one as a second correct answer.</p>
    </> : null}
  </>;
}
const Trouble = ({ q, children }) => <details className="wtrouble"><summary>{q}</summary><div>{children}</div></details>;
const name = () => S.cfg.meta?.title || "Escape room";
const WALKS = {
  link: () => <>
    <ol className="walk"><LinkStep />
      <li>{M.B("In Moodle:")} turn on {M.B("Edit mode")}, click {M.B("Add an activity or resource")} (in Moodle 5, the {M.B("+")} and then {M.B("Activity or resource")}), choose {M.B("URL")} and click {M.B("Add")}. Type a {M.B("Name")}{`, for example “${name()}”, and paste the link into `}{M.B("External URL")}. Click {M.B("Save and return to course")}.<MENUS /></li>
      <li>{M.B("In Canvas:")} go to {M.B("Modules")}, click the {M.B("+")} on a module, choose {M.B("External URL")}, paste the link into {M.B("URL")}, type a {M.B("Page Name")}, tick {M.B("Load in a new tab")}, and click {M.B("Add Item")}. Publish it. (You can also put the link on a {M.B("Page")} with the {M.B("Link")} button.)<MENUS /></li>
      <li>{M.B("In Google Classroom or an email:")} paste the link into a post, an assignment or a message. Students click it.</li>
      <li>For the grade, add a one-question quiz with the exit password as the answer: in Moodle, a {M.B("Quiz")} with a {M.B("Short answer")} question ({M.B("Case sensitivity")}: {M.B("No, case is unimportant")}); in Canvas, a {M.B("Quiz")} with a {M.B("Fill in the Blank")} question. The text is below, ready to copy.<MENUS /></li>
      <li>Try it the way a student would: open the link, play to the end, and type the password into your quiz.</li></ol>
    <PasswordPart withQuiz how="when you make the link in step 1" />
    <h2>Changing it later</h2>
    <p id="wiz-link-change">The link holds the escape room as it is when you make it. If you change anything, make a new link here and share that one: the old link keeps opening the old version.</p>
    <p id="wiz-link-backup">The link is also a backup copy. To work on this escape room again, on any computer, open this maker, choose “Open one I saved before”, and paste the link.</p>
    <h2>If something goes wrong</h2>
    <Trouble q="Students see “This class link is incomplete”"><p>Part of the link was cut off on the way. Copy it again with the Copy link button and paste all of it. If your course system keeps cutting it, share the escape room as a file instead: <a href={hashFor("deliver")}>choose “I'll email or post a file”</a>.</p></Trouble>
    <Trouble q="My course system won't take such a long link"><p>Some systems limit how long a web address can be. Share the escape room as a file instead: <a href={hashFor("deliver")}>choose “I'll email or post a file”</a>.</p></Trouble>
  </>,
  "moodle-scorm": () => <>
    <ol className="walk"><DownloadStep route="moodle-scorm" />
      <li>In your Moodle course, turn on {M.B("Edit mode")} (top right).</li>
      <li>In the section you want, click {M.B("Add an activity or resource")}. In Moodle 5, click the {M.B("+")} and then {M.B("Activity or resource")}.<MENUS /></li>
      <li>Choose {M.B("SCORM package")}, then {M.B("Add")}. Not in the list? Your Moodle administrator has switched it off: <a href={hashFor("deliver")}>choose the quiz instead</a>.</li>
      <li>Type a {M.B("Name")}{`, for example “${name()}”.`}</li>
      <li>Under {M.B("Package")}, drag the .zip file you downloaded into {M.B("Package file")}. Don't unzip it first.</li>
      <li>Under {M.B("Grade")}, leave {M.B("Grading method")} as {M.B("Highest grade")} and {M.B("Maximum grade")} as 100.</li>
      <li>Click {M.B("Save and display")}. To try it as a student, open your user menu and choose {M.B("Switch role to…")}, then {M.B("Student")}.</li></ol>
    <h2>If something goes wrong</h2>
    <Trouble q="It says the package is not valid"><p>Upload the .zip file exactly as you downloaded it. A folder, or a .zip you made yourself from a folder, won't work.</p></Trouble>
    <Trouble q="My Mac unzipped it into a folder"><p>Safari opens “safe” files after downloading. In Safari, open {M.B("Settings")}, then {M.B("General")}, and untick {M.B("Open “safe” files after downloading")}. Then download the file again.</p><MENUS /></Trouble>
    <Trouble q="Students see an empty page"><p>Open the activity's {M.B("Settings")}. Under {M.B("Appearance")}, set {M.B("Display package")} to {M.B("Current window")}, and save.</p></Trouble>
    <Trouble q="I need to fix a mistake after students have started"><p>Fix it here and download the grade file again. In Moodle, open the activity's {M.B("Settings")}, drag the new .zip into {M.B("Package file")}, and save. Students' grades are kept.</p></Trouble>
  </>,
  "moodle-quiz": () => <>
    <ol className="walk"><DownloadStep route="moodle-quiz" />
      <li>In your Moodle course, turn on {M.B("Edit mode")} (top right).</li>
      <li>Click {M.B("Add an activity or resource")} (in Moodle 5, the {M.B("+")} and then {M.B("Activity or resource")}), choose {M.B("File")}, and drag in the game file. Under {M.B("Appearance")}, set {M.B("Display")} to {M.B("Open")}. Click {M.B("Save and return to course")}.<MENUS /></li>
      <li>Add another activity: {M.B("Quiz")}{`. Name it “${name()}: exit password” and click `}{M.B("Save and display")}.</li>
      <li>Click {M.B("Add")}, then {M.B("a new question")}, then {M.B("Short answer")}. Paste the question text below. Set {M.B("Case sensitivity")} to {M.B("No, case is unimportant")}. Paste the exit password as {M.B("Answer 1")} with {M.B("Grade")} 100%. Save.</li>
      <li>To try it as a student, open your user menu and choose {M.B("Switch role to…")}, then {M.B("Student")}.</li></ol>
    <PasswordPart withQuiz />
    <h2>If something goes wrong</h2>
    <Trouble q="The file downloads instead of playing"><p>Some Moodle sites always download files. That's fine: tell students to open the downloaded file. It opens in their browser.</p></Trouble>
    <Trouble q="I need to fix a mistake after students have started"><p>Fix it here and download the game file again. In Moodle, open the file's {M.B("Settings")}, delete the old file, drag in the new one, and save.</p></Trouble>
  </>,
  "canvas-scorm": () => <>
    <ol className="walk"><DownloadStep route="canvas-scorm" />
      <li>Look for {M.B("SCORM")} in your course menu. If it isn't there, go to {M.B("Settings")}, then {M.B("Navigation")}, drag {M.B("SCORM")} into the top list (or use its menu and choose {M.B("Enable")}), and click {M.B("Save")}. If SCORM isn't in the list at all, your school hasn't switched it on: ask your Canvas administrator, or <a href={hashFor("deliver")}>choose the quiz instead</a>.<MENUS /></li>
      <li>Click {M.B("SCORM")}, then {M.B("Upload")}, choose the .zip file, and click {M.B("Open")}. Don't unzip it first.<MENUS /></li>
      <li>Under {M.B("Choose Import Type")}, choose {M.B("Import as a graded assignment")} and click {M.B("Go")}. This choice can't be changed later.<MENUS /></li>
      <li>It appears under {M.B("Assignments")}, worth 100 points. Publish it. To try it as a student, use {M.B("Student View")} in the course settings.</li>
      <li>To remove it later, delete it from the {M.B("SCORM")} page, not from Assignments.</li></ol>
    <h2>If something goes wrong</h2>
    <Trouble q="I don't see SCORM anywhere"><p>SCORM is an extra tool that your Canvas administrator has to switch on. Ask them, or use the file and exit-password quiz, which always works.</p></Trouble>
    <Trouble q="My Mac unzipped it into a folder"><p>Safari opens “safe” files after downloading. In Safari, open {M.B("Settings")}, then {M.B("General")}, and untick {M.B("Open “safe” files after downloading")}. Then download the file again.</p><MENUS /></Trouble>
    <Trouble q="A student finished but has no grade"><p>Canvas sometimes loses the grade if the student closes the tab straight away or their browser blocks cookies. Ask them to stay on the certificate for a few seconds, then grade them by hand.</p></Trouble>
  </>,
  "canvas-quiz": () => <>
    <ol className="walk"><DownloadStep route="canvas-quiz" />
      <li>In your Canvas course, go to {M.B("Files")} and click {M.B("Upload")} to add the game file.</li>
      <li>Go to {M.B("Pages")} and click {M.B("+ Page")}{`. Call it “${name()}”. In the editor, add a link to the file (`}{M.B("Link")}, then {M.B("Course Links")}, then {M.B("Files")}). Click {M.B("Save & Publish")}.<MENUS /></li>
      <li>Go to {M.B("Quizzes")} and click {M.B("+ Quiz")}. Add a {M.B("Fill in the Blank")} question. Paste the question text below, and the exit password as the answer. To ignore capital letters, choose {M.B("Close enough")} and {M.B("Spelling only (ignore case)")}, or add the password in small letters as a second answer.<MENUS /></li>
      <li>To try it as a student, use {M.B("Student View")} in the course settings.</li></ol>
    <PasswordPart withQuiz />
    <h2>If something goes wrong</h2>
    <Trouble q="The file downloads instead of playing"><p>That's fine: tell students to open the downloaded file. It opens in their browser.</p></Trouble>
    <Trouble q="I need to fix a mistake after students have started"><p>Fix it here and download the game file again. In {M.B("Files")}, upload the new file with the same name and choose to replace the old one.</p><MENUS /></Trouble>
  </>,
  other: () => <>
    <ol className="walk"><DownloadStep route="other" />
      <li>Upload the game file to your course as a file. Tell students to download it and open it: it opens in their browser.</li>
      <li>For the grade, make a one-question quiz in your course system, with the exit password as the answer. The text is below, ready to copy.</li>
      <li>Try it yourself the way a student would.</li></ol>
    <PasswordPart withQuiz />
  </>,
  file: () => <>
    <ol className="walk"><DownloadStep route="file" />
      <li>Email or post the game file. Students download it and double-click it: it opens in their browser, and needs no internet connection.</li>
      <li>Phones and tablets sometimes show the file as code instead of playing it. Ask students to use a computer.</li>
      <li>Ask students to send you the exit password from their certificate, or a screenshot of it.</li></ol>
    <PasswordPart withQuiz={false} />
  </>
};
WSTEPS.walk = {
  title: () => WALK_TITLE[walkRoute()] || "Put it in your course",
  back: () => hashFor("deliver"),
  body: () => {
    const route = walkRoute();
    if (!WALKS[route]) return <><H1>Put it in your course</H1><p>First choose how your students will get to the escape room.</p><p><a href={hashFor("deliver")}>Choose how students get it</a></p></>;
    return <><H1>{WALK_TITLE[route]}</H1><p className="whint">Do these in order. Step 1 is here; the rest happen in your course.</p>{WALKS[route]()}</>;
  },
  next: () => hashFor("done")
};
export { QUIZ_Q };
