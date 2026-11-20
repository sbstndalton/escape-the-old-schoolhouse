/* The teacher editor: the guided steps (the wizard) and Advanced mode (the Curator's workshop), drawn with React and
   ui-sdk from one mutable content object (see store.js). Built into editor.html by scripts/build.js. */
import { useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { S, ER, SAMPLE, useStore, rerender, changed, saveNow, saveMeta, unbacked, grow, applyDisplay, lsGet, lsSet, keyOf, newId, writeLib } from "./store.js";
import { Layers, Toasts, ask, tell } from "./layers.jsx";
import { Workshop, pageTitle, skipText, closeCabinet } from "./workshop.jsx";
import { Wizard, WIZ, renderWizard, routeTo, readHash, homeRoute, wizardTitle, wizGo, hashFor } from "./wizard.jsx";
import { a11yCheck } from "./check.js";
import { TYPES, blankQuestion, blankCard } from "./rooms.jsx";
import { makeClassLink } from "./actions.jsx";

function App(){
  useStore();
  useLayoutEffect(() => {
    document.title = S.mode === "wizard" && WIZ.route ? wizardTitle() : pageTitle();
    document.body.classList.toggle("cab-open", S.cabOpen);
    document.querySelectorAll("main textarea, #wizard textarea:not([readonly])").forEach(grow);
  });
  const [skip, href] = skipText();
  return <>
    <a className="skip" href={href} onClick={e => { e.preventDefault(); document.getElementById(S.mode === "wizard" ? "wiz-main" : "main").focus(); }}>{skip}</a>
    <Workshop />
    {/* Guided steps (the wizard). Its landmarks are roles on plain boxes, so the workshop's header/nav/main styles never reach them. */}
    <Wizard />
    <div id="cab-scrim" data-keep="" aria-hidden="true" onClick={() => closeCabinet(true)} />
    <div className="light" data-keep="" aria-hidden="true" /><div className="shade" data-keep="" aria-hidden="true" />
    {/* What changed is said here for screen readers (seals, moves, deletions); the toasts are read out by ui-sdk. */}
    <div id="live" className="sr" data-keep="" role="status" aria-live="polite" aria-atomic="true" />
    <Toasts />
    <Layers />
  </>;
}

/* ---------- leaving the page ---------- */
addEventListener("beforeunload", e => { if (S.saveTimer) saveNow(); if (unbacked()) { e.preventDefault(); e.returnValue = ""; } });
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden" && S.saveTimer) saveNow(); });
addEventListener("pagehide", () => { if (S.saveTimer) saveNow(); });
/* A little parallax on the lamp glow (2D shift only), skipped when motion is reduced. */
if (matchMedia("(prefers-reduced-motion: no-preference)").matches && matchMedia("(hover:hover)").matches) {
  let raf = 0;
  addEventListener("pointermove", e => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0;
    document.body.style.setProperty("--px", (e.clientX / innerWidth - .5).toFixed(3)); document.body.style.setProperty("--py", (e.clientY / innerHeight - .5).toFixed(3)); }); }, { passive: true });
}

/* ---------- for the tests and the browser console ----------
   The tests read and change the content and call a few functions by name, as they did when the editor was one script. */
const expose = { ER, SAMPLE, changed, saveNow, saveMeta, unbacked, a11yCheck, TYPES, blankQuestion, blankCard, ask, tell, makeClassLink, WIZ, renderWizard,
  routeTo, wizGo, hashFor, lsSet, keyOf, newId, writeLib, render: () => rerender() };
Object.assign(window, expose);
for (const k of ["cfg", "meta", "lib", "sel", "stored"]) Object.defineProperty(window, k, { get: () => S[k], set: v => { S[k] = v; }, configurable: true });

const root = createRoot(document.getElementById("root"));
flushSync(() => root.render(<App />));
applyDisplay();
routeTo(readHash() || homeRoute(), false);
