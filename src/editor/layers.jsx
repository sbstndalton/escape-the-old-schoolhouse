/* Everything that is laid over the bench: the slips that ask (ask, tell, the exit password), the manila folders, the
   student preview, and the typed strips (toasts). The slips, folders and preview are ui-sdk dialogs: while one is open
   the page behind it is inert, Tab stays inside it, Esc closes the top one, and focus goes back to whatever opened it.
   Two layers are not React's and use modalOpen() below instead: the phone cabinet (the page's own navigation, made a
   dialog while it is out) and the shared first-visit accessibility prompt (ER.a11yAskOpen in shared.js). */
import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose, createDialogController } from "@ui-sdk/react/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogClose, createAlertDialogController } from "@ui-sdk/react/alert-dialog";
import { ToastRegion, Toast, ToastTitle, createToaster } from "@ui-sdk/react/toast";
import { S, ER, GAME_TEMPLATE, useStore, rerender, say, nextId } from "./store.js";
import { Icon, Toggle } from "./controls.jsx";

/* Elements that stay usable behind any modal layer: the live region and the lamp, scrim and vignette (decoration). */
export const KEEP = () => [...document.querySelectorAll("[data-keep]")];

/* ---------- the two layers that are not React's ---------- */
export const modals = [];
const topLevel = () => { const root = document.getElementById("root"); return [...document.body.children, ...(root ? root.children : [])].filter(n => n !== root); };
export function modalOpen(el, onEsc, opener){
  const behind = topLevel().filter(n => n !== el && !n.contains(el) && !n.inert && !n.hasAttribute("data-keep") && n.tagName !== "SCRIPT" && n.tagName !== "STYLE");
  behind.forEach(n => { n.inert = true; });
  const m = { el, onEsc, back: opener || document.activeElement, behind };
  modals.push(m); return m;
}
export function modalClose(m, refocus = true){
  const i = modals.indexOf(m); if (i < 0) return;
  modals.splice(i, 1); m.behind.forEach(n => { n.inert = false; });
  if (refocus) focusBack(m.back);
}
export const canFocus = el => el && el.isConnected && !el.disabled && !el.closest("[inert]") && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
/* Where the keyboard goes when a layer closes: back to what opened it, or the nearest sensible place if that is gone. */
export function backTarget(el){
  if (canFocus(el)) return el;
  const top = modals[modals.length - 1];
  if (top) return top.el.querySelector("#overlay-close,#cabinet-close,button") || top.el;
  const more = document.getElementById("btn-more");
  if (el && el.closest && el.closest("#tools") && canFocus(more)) return more;     // the file list on a phone has folded away
  return document.getElementById(S.mode === "wizard" ? "wiz-h1" : "page-title") || document.getElementById("page-title");
}
export function focusBack(el){ const t = backTarget(el); if (t) t.focus(); }
const TABBABLE = "a[href],button:not(:disabled),input:not(:disabled):not([type=hidden]),textarea:not(:disabled),summary,iframe,[tabindex]:not([tabindex='-1'])";
/* Tab stays inside the top layer that is not React's (ui-sdk keeps its own dialogs). */
document.addEventListener("keydown", e => {
  if (e.key !== "Tab" || openDialog()) return;
  const top = modals[modals.length - 1]; if (!top || top.el.querySelector("iframe")) return;
  const stops = [...top.el.querySelectorAll(TABBABLE)].filter(el => canFocus(el) && el.getAttribute("aria-hidden") !== "true" && !(el.type === "radio" && !el.checked && top.el.querySelector(`input[type=radio][name="${el.name}"]:checked`)));
  if (!stops.length) return;
  const first = stops[0], last = stops[stops.length - 1];
  if (e.shiftKey && (document.activeElement === first || !top.el.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && (document.activeElement === last || !top.el.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
});
/* Is one of ui-sdk's dialogs open? (It handles its own keys then.) */
export const openDialog = () => !!document.querySelector("[data-slot=dialog-content][data-open],[data-slot=alert-dialog-content][data-open]");

/* ---------- the stack of React layers ---------- */
const layers = [];
let lkey = 0;
const add = L => { L.key = ++lkey; layers.push(L); rerender(); return L; };
const drop = L => { const i = layers.indexOf(L); if (i >= 0) { layers.splice(i, 1); rerender(); } };
export const hasLayer = kind => layers.some(L => L.kind === kind && !L.closing);
/* The page behind a layer is made inert the moment it opens (ui-sdk waits until the layer's opening animation has
   finished), and given back the moment it closes. Live regions stay live. The folders, the password slip and the
   preview are ui-sdk dialogs with modal="trap-focus" (ui-sdk keeps Tab inside, closes on Esc, returns focus) and leave
   the inert page to this; the alert slips are always modal in ui-sdk, which then finds the page already inert. */
function inertBehind(el){
  const root = document.getElementById("root");
  const all = [...document.body.children, ...root.children].filter(n => n !== root && n !== el && !n.contains(el) && !n.inert
    && !n.hasAttribute("data-keep") && !n.hasAttribute("aria-live") && !/^(SCRIPT|STYLE)$/.test(n.tagName));
  all.forEach(n => { n.inert = true; });
  return all;
}
function release(L){ (L.behind || []).forEach(n => { n.inert = false; }); L.behind = []; }
function useBehind(L){
  useLayoutEffect(() => { L.behind = inertBehind(document.querySelector(`[data-layer="${L.key}"]`)); return () => release(L); }, []);
}
/* What every layer does as it closes: give the page back, answer whoever is waiting, and leave at once. */
const onClose = (L, answer) => (open, d) => {
  if (open || L.closing) return;
  L.closing = true; release(L); if (answer) answer(d || {});
  queueMicrotask(() => drop(L));
};

/* A slip that asks before anything is thrown away (in place of the browser's own confirm and alert boxes).
   It is an alert dialog: named by its heading, described by its text, Esc or Cancel backs out, and the keyboard starts on
   Cancel, never on the action that destroys something. Resolves true only when the action is chosen. */
export function ask(title, lines, opts = {}){
  return new Promise(resolve => add({ kind: "ask", title, lines: [lines].flat().filter(Boolean), opts, opener: document.activeElement, resolve, ctl: createAlertDialogController() }));
}
export const tell = (title, lines) => ask(title, lines, { info: true, ok: "Close" });
function AskSlip({ L }){
  const { opts } = L, id = useState(() => nextId("ask"))[0];
  useBehind(L);
  return <AlertDialog defaultOpen controller={L.ctl} persistentElements={KEEP}
    onOpenChange={onClose(L, d => L.resolve(d.returnValue === "ok"))}
    onOpenChangeComplete={open => { if (!open) drop(L); }}>
    <AlertDialogContent className="modal" data-layer={L.key} finalFocus={() => backTarget(L.opener)} aria-labelledby={id + "t"} aria-describedby={id + "d"}
      onClick={e => { if (e.target === e.currentTarget) L.ctl.close(); }}>
      <div className="slipbox"><AlertDialogTitle id={id + "t"}>{L.title}</AlertDialogTitle>
        <AlertDialogDescription id={id + "d"} render={<div />}>{L.lines.map((l, i) => <p key={i}>{l}</p>)}</AlertDialogDescription>
        <div className="actions">
          {opts.info ? null : <AlertDialogClose className="stamp" id="ask-cancel" value="cancel">{opts.cancel || "Cancel"}</AlertDialogClose>}
          <AlertDialogClose className={"stamp" + (opts.danger ? " red" : "")} id="ask-ok" value="ok">{opts.ok || "OK"}</AlertDialogClose>
        </div>
      </div>
    </AlertDialogContent>
  </AlertDialog>;
}

/* The slip that asks for the exit password before a student file is made. Resolves the password, or null to go back. */
export function askPasswordSlip({ old, suggest }){
  return new Promise(resolve => add({ kind: "password", old, value: suggest, err: false, opener: document.activeElement, resolve, ctl: createDialogController() }));
}
function PasswordSlip({ L }){
  const ok = () => {
    const v = String(L.value || "").trim();
    if (!v) { L.err = true; rerender(); document.getElementById("ask-password")?.focus(); return; }
    L.ctl.close({ returnValue: "ok" });
  };
  useBehind(L);
  return <Dialog defaultOpen modal="trap-focus" controller={L.ctl} closeOnOutsidePress={false}
    onOpenChange={onClose(L, d => L.resolve(d.returnValue === "ok" ? String(L.value).trim() : null))}
    onOpenChangeComplete={open => { if (!open) drop(L); }}>
    <DialogContent className="modal" data-layer={L.key} aria-modal="true" initialFocus="#ask-password" finalFocus={() => backTarget(L.opener)} onClick={e => { if (e.target === e.currentTarget) L.ctl.close(); }}>
      <div className="slipbox"><DialogTitle id="ask-password-title">What should the exit password be?</DialogTitle>
        <DialogDescription id="ask-password-why">{L.old ? `This escape room started as a copy of the sample, so it still has the sample's password, ${L.old}. Students who played the sample could use it again.` : "This escape room has no exit password yet."}</DialogDescription>
        <div className="wf"><label className="wlabel" htmlFor="ask-password">Exit password</label>
          <p className="whint" id="ask-password-hint">Students see it on their certificate and type it into your course quiz. Letters and numbers that are easy to copy work best. We suggest one; you can change it.</p>
          <p className="ferr" id="ask-password-err" hidden={!L.err}><span className="sr">Error: </span>Enter an exit password</p>
          <input type="text" id="ask-password" value={L.value} autoComplete="off" spellCheck="false" aria-invalid={L.err ? "true" : undefined}
            aria-describedby={L.err ? "ask-password-err ask-password-hint" : "ask-password-hint"}
            onChange={e => { L.value = e.target.value; rerender(); }} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); ok(); } }} />
        </div>
        <div className="actions"><DialogClose type="button" className="stamp" id="ask-cancel" value="cancel">Go back</DialogClose>
          <button type="button" className="stamp" id="ask-ok" onClick={ok}>Use this password</button></div>
      </div>
    </DialogContent>
  </Dialog>;
}

/* A folder laid on the bench: a modal dialog. Esc, the Close mark, or a click on the dark bench puts it away, and the
   keyboard goes back to whatever opened it. { title, body(), extra(), wide, describe: id of the text that describes it (an alert) } */
export function overlay(o){
  closeFolder();
  const alert = !!o.describe;
  return add({ kind: "folder", ...o, opener: o.opener || document.activeElement, ctl: alert ? createAlertDialogController() : createDialogController() });
}
export function closeFolder(){ layers.filter(L => L.kind === "folder" && !L.closing).forEach(L => L.ctl.close()); }
function Folder({ L }){
  const tid = useState(() => nextId("ov"))[0];
  const P = L.describe ? { Root: AlertDialog, Content: AlertDialogContent, Title: AlertDialogTitle, Close: AlertDialogClose }
    : { Root: Dialog, Content: DialogContent, Title: DialogTitle, Close: DialogClose };
  useBehind(L);
  return <P.Root defaultOpen controller={L.ctl} {...(L.describe ? { persistentElements: KEEP } : { modal: "trap-focus" })}
    onOpenChange={onClose(L)} onOpenChangeComplete={open => { if (!open) drop(L); }}>
    <P.Content className="overlay" data-layer={L.key} aria-modal="true" initialFocus="#overlay-close" finalFocus={() => backTarget(L.opener)} aria-labelledby={tid} aria-describedby={L.describe || undefined}
      onClick={e => { if (e.target === e.currentTarget) L.ctl.close(); }}>
      <div className={"folder" + (L.wide ? " wide" : "")}>
        <div className="bar"><P.Title id={tid} render={<span />}>{L.title}</P.Title>{L.extra ? L.extra(L) : null}
          <P.Close className="inkline" id="overlay-close"><Icon name="x" />Close</P.Close></div>
        {L.body(L)}
      </div>
    </P.Content>
  </P.Root>;
}

/* ---------- the student preview ----------
   Full-screen "student view" of the game: a modal dialog. The brass rail on top is the teacher's: jump to any room,
   show the answers, restart, or exit (button or Esc). Nothing is saved or graded. */
export function previewOpen(startRoom, opener){
  layers.filter(L => L.kind === "preview").forEach(L => L.ctl.close());
  add({ kind: "preview", startRoom, opener, current: 0, showKey: false, where: "", ctl: createDialogController() });
}
function Preview({ L }){
  useStore();
  const frame = useRef(null);
  const cfg = S.cfg, n = cfg.rooms.length;
  const send = msg => frame.current && frame.current.contentWindow && frame.current.contentWindow.postMessage(msg, "*");
  const stepName = k => k === 0 ? "the intro" : k > n ? "the certificate" : `room ${k} of ${n}: ${cfg.rooms[k - 1].title || "Untitled"}`;
  const load = room => {
    const f = frame.current; if (!f) return;
    f.onload = () => { if (L.showKey) send({ er: "key", on: true }); if (room) send({ er: "goto", room }); };
    f.srcdoc = ER.buildGame(GAME_TEMPLATE, { ...S.cfg, __preview: true });
  };
  useEffect(() => {
    const onMsg = e => {
      if (!frame.current || e.source !== frame.current.contentWindow) return;
      if (e.data?.er === "escape") return L.ctl.close();
      if (e.data?.er === "key" && !e.data.on) {      // "Hide answers" in the game's answer strip: the switch follows, and keeps the keyboard
        L.showKey = false; L.where = "Answers hidden."; rerender(); document.getElementById("preview-answers")?.focus(); return;
      }
      if (e.data?.er === "room") {
        const moved = L.current !== e.data.room; L.current = e.data.room;
        // a disabled button can't keep the keyboard, so it moves to the other arrow before one is switched off
        const at = document.activeElement, prev = document.getElementById("preview-prev"), next = document.getElementById("preview-next");
        if (at === prev && L.current === 0) next?.focus(); if (at === next && L.current === n + 1) prev?.focus();
        if (moved) L.where = "The preview is showing " + stepName(L.current) + ".";
        rerender();
      }
    };
    window.addEventListener("message", onMsg);
    load(L.startRoom);
    return () => window.removeEventListener("message", onMsg);
  }, []);
  const steps = [[<Icon name="door" />, 0], ...cfg.rooms.map((r, i) => [String(i + 1), i + 1, r.title]), [<Icon name="rosette" />, n + 1, "Certificate"]];
  useBehind(L);
  return <Dialog defaultOpen modal="trap-focus" controller={L.ctl} closeOnOutsidePress={false}
    onOpenChange={onClose(L)} onOpenChangeComplete={open => { if (!open) drop(L); }}>
    <DialogContent className="preview" data-layer={L.key} aria-modal="true" aria-label="Student preview" initialFocus="#preview-exit" finalFocus={() => backTarget(L.opener)}>
      <div className="pbar">
        <div className="badge">Preview</div>
        <div className="rooms" role="group" aria-label="Jump to a room">
          <button id="preview-prev" aria-label="Previous room" disabled={L.current === 0} onClick={() => send({ er: "goto", room: Math.max(0, L.current - 1) })}><Icon name="left" /></button>
          {steps.map(([label, k, title]) => <button key={k} data-room={k} title={title || (k === 0 ? "Intro" : "")} aria-label={"Go to " + stepName(k)}
            aria-current={k === L.current ? "step" : undefined} onClick={() => send({ er: "goto", room: k })}>{label}</button>)}
          <button id="preview-next" aria-label="Next room" disabled={L.current === n + 1} onClick={() => send({ er: "goto", room: Math.min(n + 1, L.current + 1) })}><Icon name="right" /></button>
        </div>
        <div className="ctrl"><Toggle id="preview-answers" label="Show answers" on={L.showKey} state={false} onChange={on => { L.showKey = on; rerender(); send({ er: "key", on }); }} />
          <button className="eng" title="Start over from the intro" onClick={() => { load(0); L.where = "The preview has started again from the intro."; rerender(); }}><Icon name="restart" />Restart</button>
          <DialogClose className="eng exit" id="preview-exit"><Icon name="x" />Exit preview</DialogClose></div>
        <span className="sr" role="status">{L.where}</span>
      </div>
      <iframe ref={frame} title="Student view of the escape room" />
    </DialogContent>
  </Dialog>;
}

export function Layers(){
  useStore();
  return layers.map(L => L.kind === "ask" ? <AskSlip key={L.key} L={L} /> : L.kind === "password" ? <PasswordSlip key={L.key} L={L} />
    : L.kind === "folder" ? <Folder key={L.key} L={L} /> : <Preview key={L.key} L={L} />);
}

/* ---------- typed strips ----------
   A strip that says what just happened: a ui-sdk toast. It is read out once, stays six seconds, and waits while it is
   pointed at or has the keyboard. Only one at a time: a new one replaces the last. */
export const toaster = createToaster();
export function toast(text){ toaster.dismiss(); toaster(text, { duration: 6000 }); }
export function Toasts(){
  return <ToastRegion toaster={toaster} id="toasts" data-keep="" side="bottom" align="end" aria-label="Messages">
    {() => <Toast className="toast"><ToastTitle render={<span />} /></Toast>}
  </ToastRegion>;
}
