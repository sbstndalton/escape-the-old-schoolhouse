/* The editor's state and storage. The content (S.cfg) is one plain object that the form edits in place, exactly as
   ER (src/shared.js) reads it; after a change, rerender() redraws the React tree at once (flushSync), so code that
   moves focus straight after a change finds the new elements already on the page. */
import { flushSync } from "react-dom";
import { useSyncExternalStore } from "react";
import ER from "../shared.js";

// Filled in by scripts/build.js: the game page (for exports and the preview) and the sample escape room.
export const GAME_TEMPLATE = "__GAME_TEMPLATE__";
export const SAMPLE = "__DEFAULT_CONFIG__";
export { ER };

export const STORE = "escape-room-editor-v1";
export const clone = o => JSON.parse(JSON.stringify(o));
/* Several escape rooms live in this browser, so making a second one never overwrites the first.
   LIB lists them ({ current, list: [{ id, title, created, updated }] }); each one's content is under STORE:id and its
   bookkeeping under STORE:id-meta. The single slot used before (STORE, STORE-meta) is moved into the list once. */
export const LIB = "escape-room-library-v1";
export const lsGet = k => { try { return localStorage.getItem(k); } catch(e){ return null; } };
export const lsSet = (k, v) => { try { localStorage.setItem(k, v); return true; } catch(e){ return false; } };
export const lsDel = k => { try { localStorage.removeItem(k); } catch(e){} };
export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const keyOf = (id, m) => `${STORE}:${id}${m ? "-meta" : ""}`;
function readLib(){
  let l = null; try { l = JSON.parse(lsGet(LIB)); } catch(e){}
  if (!l || !Array.isArray(l.list)) l = { current: null, list: [] };
  const old = lsGet(STORE);
  if (old && !l.list.length) {
    const id = newId(); let title = ""; try { title = JSON.parse(old).meta.title; } catch(e){}
    lsSet(keyOf(id), old); const m = lsGet(STORE + "-meta"); if (m) lsSet(keyOf(id, true), m);
    l.list.push({ id, title, created: Date.now(), updated: Date.now() }); l.current = id;
    if (lsSet(LIB, JSON.stringify(l))) { lsDel(STORE); lsDel(STORE + "-meta"); }
  }
  return l;
}
const lib0 = readLib();
const cur0 = lib0.list.some(e => e.id === lib0.current) ? lib0.current : null;
export function load(id = S.curId){ if (!id) return null; try { return JSON.parse(lsGet(keyOf(id))) || null; } catch(e){ return null; } }
export function readMeta(id = S.curId){ let m = null; try { m = JSON.parse(lsGet(keyOf(id, true))); } catch(e){} return m || { rev: 0, backupRev: 0, backupAt: 0, savedAt: 0 }; }

/* Everything that changes. sel: "settings" | "intro" | "finish" | "a11y" | room index (number). */
export const S = {
  lib: lib0, curId: cur0, cfg: null, meta: null, stored: false, saveTimer: null,
  sel: "settings",
  quizText: new WeakSet(),   // quiz rooms currently edited as plain text (keyed by room, so moving/deleting rooms can't mix them up)
  tabOf: new Map(),          // which index tab is open on each page (keyed by page name or room object)
  addOpen: false,            // the "add a drawer" list in the cabinet
  noteOpen: false,           // the pinned not-checked note, unfolded
  keyOpen: false,            // the answer-key envelope
  cabOpen: false,            // the phone cabinet
  toolsOpen: false,          // the phone file list
  mode: document.documentElement.dataset.mode || "wizard"
};
S.cfg = load(cur0) || clone(SAMPLE);
S.meta = readMeta(cur0);
S.stored = !!load(cur0);

/* ---------- drawing ---------- */
let version = 0;
const subs = new Set();
const subscribe = f => { subs.add(f); return () => subs.delete(f); };
export const useStore = () => useSyncExternalStore(subscribe, () => version);
const FOCUSABLE = "input,textarea,button,summary,a[href]";
let drawing = false, again = false;
/* Redraw now. If the control that had the keyboard was taken away (a deleted entry), the keyboard goes to the control
   that is now in its place, as it did when the page was rebuilt by hand. */
export function rerender(){
  version++;
  if (drawing) { again = true; return; }
  const box = document.activeElement && document.activeElement.closest && document.activeElement.closest("#main,#wiz-sheet");
  const had = box ? [...box.querySelectorAll(FOCUSABLE)].indexOf(document.activeElement) : -1, hadId = box && document.activeElement.id;
  drawing = true;
  try { do { again = false; flushSync(() => subs.forEach(f => f())); } while (again); } finally { drawing = false; }
  if (box && had >= 0 && (!document.activeElement || document.activeElement === document.body)) {
    const same = hadId && document.getElementById(hadId);
    if (same && box.contains(same)) { same.focus({ preventScroll: true }); return; }
    const list = [...box.querySelectorAll(FOCUSABLE)].filter(el => !el.disabled);
    const el = list[Math.min(had, list.length - 1)]; if (el) el.focus({ preventScroll: true });
  }
}

/* ---------- announcements ----------
   Said quietly to screen readers when something changes that sighted teachers simply see. */
let sayTimer = 0;
export function say(text){ const live = document.getElementById("live"); if (!live) return; clearTimeout(sayTimer); live.textContent = ""; sayTimer = setTimeout(() => { live.textContent = text; }, 80); }

/* ---------- display options: High contrast and Readable text ----------
   Remembered in this browser under the same keys as the game, so the student preview follows them.
   High contrast also follows the system (prefers-contrast: more, and forced colours) until the teacher chooses. */
export const PREF = { contrast: "escape-room-contrast", readable: "escape-room-readable" };
export const prefGet = lsGet;
export const prefSet = (k, v) => { lsSet(k, v); };
export const mqContrast = matchMedia("(prefers-contrast: more)"), mqForced = matchMedia("(forced-colors: active)");
export function contrastOn(){ const s = prefGet(PREF.contrast); return s === "on" || mqForced.matches || (s !== "off" && mqContrast.matches); }
export function readableOn(){ return prefGet(PREF.readable) === "on"; }
export function grow(ta){ ta.style.height = "auto"; ta.style.height = Math.max(ta.scrollHeight, 28 * (Number(ta.getAttribute("rows")) || 1)) + "px"; }
export function applyDisplay(){
  const d = document.documentElement;
  if (contrastOn()) d.dataset.contrast = "more"; else delete d.dataset.contrast;
  if (readableOn()) d.dataset.readable = "on"; else delete d.dataset.readable;
  rerender();
  document.querySelectorAll("main textarea, #wizard textarea").forEach(grow);
}
[mqContrast, mqForced].forEach(m => m.addEventListener && m.addEventListener("change", applyDisplay));

/* ---------- saving ----------
   Work is saved in this browser as the teacher types. Alongside it we keep a little bookkeeping (meta): how many
   changes there have been, and how many there were when the last backup file was downloaded, so the page can say
   plainly where the work is and warn before the tab is closed with changes that exist nowhere else. */
export const writeLib = () => lsSet(LIB, JSON.stringify(S.lib));
export function saveMeta(){ if (S.curId) lsSet(keyOf(S.curId, true), JSON.stringify(S.meta)); }
export function saveNow(){
  clearTimeout(S.saveTimer); S.saveTimer = null;
  if (!S.curId) { S.curId = newId(); S.lib.list.push({ id: S.curId, title: "", created: Date.now(), updated: 0 }); }
  S.lib.current = S.curId;
  if (lsSet(keyOf(S.curId), JSON.stringify(S.cfg))) { S.meta.savedAt = Date.now(); S.meta.failed = false; S.stored = true; } else S.meta.failed = true;
  const e = S.lib.list.find(x => x.id === S.curId); e.title = S.cfg.meta?.title || ""; e.updated = Date.now();
  writeLib(); saveMeta();
  rerender();
}
/* Something in the content changed: count it, save it shortly, and redraw what depends on it. */
export function changed(){ S.meta.rev++; clearTimeout(S.saveTimer); S.saveTimer = setTimeout(saveNow, 300); rerender(); }
// Changes that are only in this browser: nothing has been backed up since they were made.
export const unbacked = () => S.meta.rev > S.meta.backupRev;
export const when = t => { const d = new Date(t), now = new Date(), time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return d.toDateString() === now.toDateString() ? "at " + time : "on " + d.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" }) + " at " + time; };
/* The one line that says where the work is: "Saved in this browser at 3:42 pm. Not backed up yet." */
export function saveWords(){
  const { meta } = S;
  if (meta.failed) return ["This browser couldn't save your work.", "Download a backup to keep it."];
  if (!S.stored) return ["Nothing saved in this browser yet.", "If you worked on this before, open your saved file."];
  const saved = meta.savedAt ? `Saved in this browser ${when(meta.savedAt)}.` : "Saved in this browser.";
  if (!meta.backupAt) return [saved, "Not backed up yet."];
  return [saved, unbacked() ? `Changed since your backup ${when(meta.backupAt)}.` : `Backup downloaded ${when(meta.backupAt)}.`];
}
/* Open another escape room from this browser's list. */
export function switchTo(id){
  if (S.saveTimer) saveNow();
  const next = load(id); if (!next) return false;
  S.curId = id; S.lib.current = id; writeLib(); S.cfg = next; S.meta = readMeta(id); S.stored = true;
  S.sel = "settings"; S.tabOf.clear(); rerender(); return true;
}
export const fileName = s => String(s || "").replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "Escape room";
export function backedUp(){ S.meta.backupRev = S.meta.rev; S.meta.backupAt = Date.now(); saveNow(); }
export const gameHtml = () => ER.buildGame(GAME_TEMPLATE, S.cfg);
export const slug = () => ER.fileSlug(S.cfg.meta?.title);
export function download(name, data, type){
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a"); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/* The sample was written with AI help; a teacher's own words were not. Items whose wording is still the sample's
   (and that no one has checked) are the only ones the "written with AI help" warning is about. */
export const stripCheck = o => JSON.stringify(o, (k, v) => (k === "verified" || k === "source") ? undefined : v);
let sampleSigs = null;
export function sampleUnchecked(c){
  if (!sampleSigs) sampleSigs = new Set(ER.reviewItems(SAMPLE).map(x => stripCheck(x.item)));
  return ER.reviewItems(c).filter(x => x.item.verified !== true && sampleSigs.has(stripCheck(x.item))).length;
}
export const isHttp = () => /^https?:$/.test(location.protocol);
let uid = 0;
export const nextId = p => p + (++uid);
