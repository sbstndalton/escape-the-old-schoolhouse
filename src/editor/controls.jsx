/* The drawn controls of the workshop. Each is a real control (a native field, or a ui-sdk radio, checkbox, switch or
   tooltip) under the drawing, so names, states and the keyboard are the browser's and ui-sdk's, not ours. */
import { useState } from "react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@ui-sdk/react/tooltip";
import { RadioGroup, Radio } from "@ui-sdk/react/radio";
import { Checkbox } from "@ui-sdk/react/checkbox";
import { Switch } from "@ui-sdk/react/switch";
import { S, ER, changed, rerender, say, grow, nextId } from "./store.js";
import { ask } from "./layers.jsx";

/* Engraved line icons, drawn here so nothing is downloaded and no emoji is used. */
export const ICONS = {
  link: '<path d="M10.2 13.8a3.9 3.9 0 0 1 0-5.5l2.9-2.9a3.9 3.9 0 0 1 5.5 5.5l-1.4 1.4M13.8 10.2a3.9 3.9 0 0 1 0 5.5l-2.9 2.9a3.9 3.9 0 0 1-5.5-5.5l1.4-1.4"/>',
  gear: '<path d="M10.6 5.1L10.9 2.9L13.1 2.9L13.4 5.1L15.8 6.1L17.7 4.8L19.2 6.3L17.9 8.2L18.9 10.6L21.1 10.9L21.1 13.1L18.9 13.4L17.9 15.8L19.2 17.7L17.7 19.2L15.8 17.9L13.4 18.9L13.1 21.1L10.9 21.1L10.6 18.9L8.2 17.9L6.3 19.2L4.8 17.7L6.1 15.8L5.1 13.4L2.9 13.1L2.9 10.9L5.1 10.6L6.1 8.2L4.8 6.3L6.3 4.8L8.2 6.1z"/><circle cx="12" cy="12" r="2.800"/>',
  page: '<path d="M6 3.500h9l3 3v14H6zM15 3.500v3h3M8.600 7.500h3.400M8.600 10.500h6.800M8.600 13.500h6.800M8.600 16.500h4.200"/>',
  key: '<circle cx="7" cy="12" r="4"/><circle cx="7" cy="12" r="1.500"/><path d="M11 12h10.200M12.800 10.600v2.800M17 12v3.600h1.800V12M21.200 12v2.600"/>',
  lock: '<rect x="5" y="10.500" width="14" height="10" rx="1.300"/><path d="M8.300 10.500V7.700a3.700 3.700 0 0 1 7.400 0v2.800M5 13h14M12 17v1.500M7.200 18.400h.2M16.600 18.400h.2"/><circle cx="12" cy="16" r="1.100"/>',
  glass: '<path d="M6.500 3.500h11M6.500 20.500h11M8 3.500c0 5 8 5.400 8 8.500s-8 3.500-8 8.500M16 3.500c0 5-8 5.400-8 8.500s8 3.500 8 8.500M6.500 2.500v2M17.500 2.500v2M6.500 19.500v2M17.500 19.500v2M9.500 7h5M12 12v3M10 18.600c.6-1.200 3.400-1.200 4 0"/>',
  trays: '<path d="M3.500 8H11v10.500H3.500zM13 8h7.500v10.500H13zM5.500 8V5.500H9V8M15 8V5.500h3.500V8M5.500 11.500H9M5.500 14.500H9M15 11.500h3.500M15 14.500h3.500"/>',
  mirror: '<ellipse cx="12" cy="9.800" rx="5.800" ry="7"/><ellipse cx="12" cy="9.800" rx="4.100" ry="5.300"/><path d="M12 16.800V19M8 21c.6-1.400 2-2 4-2s3.400.6 4 2zM10 7.400c.8-1.200 1.600-1.700 2.600-1.800M12 2.800v-.9"/>',
  rosette: '<circle cx="12" cy="9.300" r="5.600"/><circle cx="12" cy="9.300" r="2.600"/><path d="M12 3.700v1.800M12 13.100v1.800M6.400 9.300h1.800M15.800 9.300h1.800M8 5.300l1.300 1.300M14.700 12l1.300 1.300M8 13.300 9.300 12M14.700 6.600 16 5.300M9 14.100 7.600 21l4.400-2.400 4.400 2.400-1.400-6.900"/>',
  door: '<path d="M6.500 20.500v-17h11v17M4 20.500h16M9 6h6v5H9zM9 13.500h6V18H9z"/><circle cx="16.200" cy="12.300" r=".5"/>',
  info: '<path d="M12 11v6.2M12 6.8v.3"/>',
  up: '<path d="M12 18.5V6M7 10.8l5-5 5 5"/>', down: '<path d="M12 5.5V18M7 13.2l5 5 5-5"/>',
  left: '<path d="M14.5 6l-6 6 6 6"/>', right: '<path d="M9.5 6l6 6-6 6"/>', back: '<path d="M19 12H5.5M10.5 7l-5 5 5 5"/>',
  x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>', plus: '<path d="M12 5.5v13M5.5 12h13"/>', tick: '<path d="M5 12.8l4.4 4.6L19 6.6"/>',
  play: '<path d="M8 5.5v13L18.5 12z"/>', eye: '<path d="M2.500 12s3.500-6 9.500-6 9.500 6 9.500 6-3.500 6-9.500 6-9.500-6-9.500-6z"/><circle cx="12" cy="12" r="2.800"/><path d="M12 11.800v.4M12 3.200v1M6 4.800l.7 1M18 4.800l-.7 1"/>',
  print: '<path d="M7 8.500V4h10v4.500M7 16.500H4.500v-8h15v8H17M7 13.500h10V20H7zM9.500 16h5M9.500 18h3M16.800 11h.2"/>',
  folder: '<path d="M3.500 7.500v11h17v-9h-8l-2-2zM3.500 11.500h17M14 9.500V7h5v2.500"/>', save: '<path d="M12 4v10M8 10.2l4 4 4-4M4.5 16v3.5h15V16"/>',
  export: '<path d="M12 14V3.6M8 7.4l4-4 4 4M5 11v8.5h14V11"/>', sheet: '<path d="M6 3.5h12v17H6zM8.6 8l1.4 1.5 2.4-2.8M8.6 13.5h6.8M8.6 16.5h6.8M14 8.5h1.5"/>',
  restart: '<path d="M5.2 13.5a7 7 0 1 0 1.7-6.3M5 4v3.6h3.6"/>', more: '<circle cx="5.5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18.5" cy="12" r="1.3"/>',
  pencil: '<path d="M4.500 19.500l1-4L16 5l3 3L8.500 18.500zM14 7l3 3M5.500 15.500l3 3M7.500 16.500l8-8"/>', type: '<path d="M4 7h16v10H4zM6.800 10h.4M9.700 10h.4M12.600 10h.4M15.500 10h.4M17.200 10h.2M6.800 12.600h.4M9.700 12.600h.4M12.600 12.600h.4M15.500 12.600h1.700M8 15h8"/>',
  cards: '<rect x="4" y="5" width="7" height="6"/><rect x="13" y="5" width="7" height="6"/><rect x="4" y="13" width="7" height="6"/><rect x="13" y="13" width="7" height="6"/><path d="M5.800 7.300h3.400M5.800 9h2M14.800 7.300h3.400M14.800 9h2M5.800 15.300h3.400M5.800 17h2M14.800 15.300h3.400M14.800 17h2"/>',
  books: '<path d="M5 4.500h3.500v15H5zM8.500 6.500h3v13h-3zM11.500 4.500H15v15h-3.500zM15.600 7.300l3-.8L21 18.700l-3 .8zM3.500 19.500h17M5 7.500h3.500M5 16.500h3.500M11.500 7.500H15M11.500 16.500H15M8.500 9.500h3M16.300 10.200l3-.8"/>',
  portraits: '<path d="M9 3.500l3-2 3 2"/><rect x="4.500" y="3.500" width="15" height="14"/><rect x="6.800" y="5.800" width="10.400" height="9.400"/><circle cx="12" cy="9.300" r="1.700"/><path d="M8.800 15.200c.4-2.200 1.600-3.200 3.200-3.200s2.800 1 3.200 3.200M9.500 20h5"/>'
};
export const Icon = ({ name }) => <span className="icw" aria-hidden="true"><svg className="ic" viewBox="0 0 24 24" focusable="false" dangerouslySetInnerHTML={{ __html: ICONS[name] || "" }} /></span>;

/* A small ⓘ that shows a slip of help: a ui-sdk tooltip. It opens on hover and on keyboard focus, stays while the
   pointer is on the mark or on the slip itself, pins on a press (toggleable), and Esc puts it away without moving the
   pointer or the focus (WCAG 1.4.13). The slip is always in the page, so the mark's description is read at once. */
export function Tip({ text, about, id }){
  const [own] = useState(() => nextId("tip"));
  const [open, setOpen] = useState(false);
  const pid = id || own;
  return <span className="tip">
    <Tooltip toggleable delay={0} closeDelay={350} open={open} onOpenChange={setOpen}>
      <TooltipTrigger className="i" aria-label={"Help: " + about} aria-expanded={String(open)}><Icon name="info" /></TooltipTrigger>
      <TooltipContent id={pid} className="pop" side="bottom" align="start" sideOffset={4} collisionPadding={8} render={<span />}>{text}</TooltipContent>
    </Tooltip>
  </span>;
}
/* Some fields need the slip's id before the slip is drawn (to describe the field by it). */
export function useTipId(){ const [id] = useState(() => nextId("tip")); return id; }

/* Mark an item unchecked; its seal lifts on the next draw. */
export function unverify(item){
  if (!item || !item.verified) return; item.verified = false;
  say("You changed this item, so its seal is lifted. Check it again when you have finished.");
}

/* A typed label over a ruled line, bound to obj[key]. {type, help, rows, placeholder, item (editing it un-verifies the item), onChange, narrow} */
export function Field({ label, obj, k, type, help, rows, placeholder, item, onChange, narrow, min, max }){
  const [id] = useState(() => nextId("f"));
  const tid = useTipId();
  const area = type === "textarea";
  const input = e => {
    obj[k] = type === "number" ? Number(e.target.value) : e.target.value;
    if (area) grow(e.target);
    if (item) unverify(item);
    onChange && onChange(e);
    changed();
  };
  const common = { id, placeholder, autoComplete: "off", "aria-describedby": help ? tid : undefined, onChange: input };
  return <div className={"field" + (narrow ? " narrow" : "")} data-key={String(k)}>
    <label htmlFor={id}>{label}</label>
    {help ? <Tip text={help} about={label} id={tid} /> : null}
    {area ? <textarea {...common} rows={rows} value={obj[k] ?? ""} />
      : type === "number" ? <input {...common} type="number" min={min} max={max} defaultValue={obj[k] ?? ""} />
      : <input {...common} type="text" value={obj[k] ?? ""} />}
  </div>;
}

/* A brass selector: one of a few positions is switched in. A ui-sdk radio group underneath. options: [value, text, icon?] */
export function Select({ label, obj, k, options, help, fallback, number, item, onPick }){
  const [lid] = useState(() => nextId("s"));
  let cur = obj[k] ?? fallback ?? "";
  if (!options.some(([v]) => String(v) === String(cur)) && fallback != null) cur = fallback;     // missing or unknown value: show the default
  return <RadioGroup className="field pick" data-key={String(k)} aria-labelledby={lid + "l"} name={lid} value={String(cur)}
    onValueChange={v => {
      if (v == null) return;
      obj[k] = number ? Number(v) : v;
      if (item && item.verified) { item.verified = false; say("You changed this item, so its seal is lifted. Check it again."); }
      onPick && onPick(v);
      changed();
    }}>
    <div className="lblrow"><span className="lbl" id={lid + "l"}>{label}</span>{help ? <Tip text={help} about={label} /> : null}</div>
    <div className="rotary">{options.map(([v, t, ic]) => <label key={String(v)}>
      <Radio className="sr" value={String(v)} render={<button value={String(v)} />} />
      <span>{ic ? <Icon name={ic} /> : null}{t}</span>
    </label>)}</div>
  </RadioGroup>;
}

/* A brass two-way switch (a ui-sdk switch underneath). */
export function Toggle({ id, label, on, onChange, describedby, state = true, keep }){
  return <label className="switch">
    <Switch id={id} className="ctl" checked={!!on} aria-describedby={describedby} onCheckedChange={v => onChange(v)} {...(keep ? { "data-keep": "" } : {})} />
    <span className="track" aria-hidden="true" /><span className="sl">{label}</span>{state ? <span className="state" aria-hidden="true" /> : null}
  </label>;
}

/* Source + the wax seal ("I checked this is correct") on every gradable item. */
export function VerifyRow({ item, name }){
  return <div className="verify">
    <Field label="Source" obj={item} k="source" placeholder="e.g. Textbook ch. 3, p. 45" />
    <label className="chk">
      <Checkbox className="ctl" checked={item.verified === true} onCheckedChange={c => {
        item.verified = c === true; changed();
        const st = ER.reviewStatus(S.cfg); say(`${name || "Item"} ${item.verified ? "marked as checked" : "is no longer marked as checked"}. ${st.verified} of ${st.total} checked.`);
      }} />
      <span className="spot" aria-hidden="true"><span className="wax"><Icon name="tick" /></span></span>
      <span className="w">I checked this is correct{name ? <span className="sr">{` (${name})`}</span> : null}</span>
    </label>
  </div>;
}

/* Ledger of entries: number in the margin, with move / delete marks; add at the foot. */
const keyFor = new WeakMap(); let keyN = 0;
export const objKey = o => { if (o && typeof o === "object") { if (!keyFor.has(o)) keyFor.set(o, "k" + (++keyN)); return keyFor.get(o); } return String(o); };
export function ListEditor({ list, item: renderItem, noun, blank, gradable = true, id }){
  const lower = noun.toLowerCase(), lid = id || lower.replace(/\W+/g, "-");
  // After a move the keyboard stays with the entry that moved, so it can be moved again.
  const move = (i, d) => {
    [list[i + d], list[i]] = [list[i], list[i + d]]; changed();
    const entry = document.querySelectorAll(`[data-ledger="${lid}"] > .entry`)[i + d];
    const btns = entry ? entry.querySelectorAll(".gut button") : [];
    const b = [btns[d < 0 ? 0 : 1], btns[d < 0 ? 1 : 0]].find(x => x && !x.disabled); if (b) b.focus();
    say(`${noun} ${i + 1} moved ${d < 0 ? "up" : "down"}. It is now ${lower} ${i + d + 1} of ${list.length}.`);
  };
  const del = async (it, i) => {
    const name = `${noun} ${i + 1}`, what = String(it.term || it.prompt || it.text || it.name || "").trim();
    if (!(await ask(`Delete ${lower} ${i + 1}?`, [what ? `“${what.length > 90 ? what.slice(0, 90) + "…" : what}”` : null, "This can't be undone."], { ok: `Delete ${lower}`, danger: true }))) return;
    list.splice(i, 1); changed();
    const left = document.querySelectorAll(`[data-ledger="${lid}"] > .entry`);
    (left.length ? left[Math.min(i, left.length - 1)].querySelector(".gut button.red") : document.querySelector(`[data-add="${lid}"]`))?.focus();
    say(`${name} deleted. ${list.length} left.`);
  };
  return <>
    <div className="ledger" data-ledger={lid}>{list.map((it, i) => {
      const name = `${noun} ${i + 1}`;
      return <div key={objKey(it)} className={"entry" + (gradable && it.verified ? " verified" : "")} role="group" aria-label={name}>
        <div className="gut"><strong>{noun} <b>{i + 1}</b></strong>
          <button className="glyph" title="Move up" aria-label={`Move ${noun} ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)}><Icon name="up" /></button>
          <button className="glyph" title="Move down" aria-label={`Move ${noun} ${i + 1} down`} disabled={i === list.length - 1} onClick={() => move(i, 1)}><Icon name="down" /></button>
          <button className="glyph red" title="Delete" aria-label={`Delete ${noun} ${i + 1}`} onClick={() => del(it, i)}><Icon name="x" /></button>
        </div>
        <div className="body">{renderItem(it, i)}{gradable ? <VerifyRow item={it} name={name} /> : null}</div>
      </div>;
    })}</div>
    <div className="actions"><button className="stamp" data-add={lid} onClick={() => {
      list.push(blank()); changed();
      const added = [...document.querySelectorAll(`[data-ledger="${lid}"] > .entry`)].pop();
      added?.querySelector(".body input,.body textarea")?.focus(); say(`${noun} ${list.length} added.`);
    }}><Icon name="plus" />{`Add ${lower}`}</button></div>
  </>;
}
export { rerender };
