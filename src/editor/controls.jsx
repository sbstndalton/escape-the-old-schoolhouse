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
  gear: '<circle cx="12" cy="12" r="3.1"/><circle cx="12" cy="12" r="6.8"/><path d="M12 2.6v2.6M12 18.8v2.6M2.6 12h2.6M18.8 12h2.6M5.4 5.4l1.8 1.8M16.8 16.8l1.8 1.8M5.4 18.6l1.8-1.8M16.8 7.2l1.8-1.8"/>',
  page: '<path d="M6 3.5h9l3 3v14H6zM15 3.5v3h3M8.6 10.5h6.8M8.6 13.5h6.8M8.6 16.5h4.2"/>',
  key: '<circle cx="7.3" cy="12" r="3.6"/><circle cx="7.3" cy="12" r="1.1"/><path d="M10.9 12h10.3M17.4 12v3.2M20.3 12v2.4"/>',
  lock: '<rect x="5.5" y="10.5" width="13" height="9.8" rx="1"/><path d="M8.6 10.5V8a3.4 3.4 0 0 1 6.8 0v2.5M12 16.2v1.9M7.5 12.5v6M16.5 12.5v6"/><circle cx="12" cy="15" r="1.2"/>',
  glass: '<path d="M7 3.5h10M7 20.5h10M8 3.5c0 5 8 5.4 8 8.5s-8 3.5-8 8.5M16 3.5c0 5-8 5.4-8 8.5s8 3.5 8 8.5M10.5 18.5h3"/>',
  trays: '<rect x="3.5" y="6" width="7.5" height="12"/><rect x="13" y="6" width="7.5" height="12"/><path d="M5.5 9h3.5M5.5 12h3.5M15 9h3.5M15 12h3.5M15 15h3.5"/>',
  mirror: '<ellipse cx="12" cy="9.8" rx="5.6" ry="6.8"/><ellipse cx="12" cy="9.8" rx="4" ry="5.1"/><path d="M12 16.6v3.9M8.5 20.5h7M10 7.4c.8-1.2 1.6-1.7 2.6-1.8"/>',
  rosette: '<circle cx="12" cy="9.3" r="5.6"/><circle cx="12" cy="9.3" r="2.6"/><path d="M9 14.1 7.6 21l4.4-2.4 4.4 2.4-1.4-6.9"/>',
  door: '<path d="M6.5 20.5v-17h11v17M4 20.5h16M9 6h6v5.5H9zM9 14h6v6.5"/><circle cx="14.2" cy="12.8" r=".6"/>',
  info: '<path d="M12 11v6.2M12 6.8v.3"/>',
  up: '<path d="M12 18.5V6M7 10.8l5-5 5 5"/>', down: '<path d="M12 5.5V18M7 13.2l5 5 5-5"/>',
  left: '<path d="M14.5 6l-6 6 6 6"/>', right: '<path d="M9.5 6l6 6-6 6"/>', back: '<path d="M19 12H5.5M10.5 7l-5 5 5 5"/>',
  x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>', plus: '<path d="M12 5.5v13M5.5 12h13"/>', tick: '<path d="M5 12.8l4.4 4.6L19 6.6"/>',
  play: '<path d="M8 5.5v13L18.5 12z"/>', eye: '<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="2.6"/>',
  print: '<path d="M7 8.5V4h10v4.5M7 16.5H4.5v-8h15v8H17M7 13.5h10v6.5H7z"/>',
  folder: '<path d="M3.5 7.5v11h17v-9h-8l-2-2zM3.5 11.5h17"/>', save: '<path d="M12 4v10M8 10.2l4 4 4-4M4.5 16v3.5h15V16"/>',
  export: '<path d="M12 14V3.6M8 7.4l4-4 4 4M5 11v8.5h14V11"/>', sheet: '<path d="M6 3.5h12v17H6zM8.6 8l1.4 1.5 2.4-2.8M8.6 13.5h6.8M8.6 16.5h6.8M14 8.5h1.5"/>',
  restart: '<path d="M5.2 13.5a7 7 0 1 0 1.7-6.3M5 4v3.6h3.6"/>', more: '<circle cx="5.5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18.5" cy="12" r="1.3"/>',
  pencil: '<path d="M4.5 19.5l1-4L16 5l3 3L8.5 18.5zM14 7l3 3"/>', type: '<path d="M4 7h16v10H4zM7 10h1M10.5 10h1M14 10h1M7 13.5h10"/>',
  cards: '<rect x="4" y="5" width="7" height="6"/><rect x="13" y="5" width="7" height="6"/><rect x="4" y="13" width="7" height="6"/><rect x="13" y="13" width="7" height="6"/>',
  books: '<path d="M5 4.5h3.5v15H5zM8.5 6.5h3v13h-3zM11.5 4.5h3.5v15h-3.5zM15.6 7.3l3-.8 2.4 12.2-3 .8zM3.5 19.5h17M5 8h3.5M11.5 8h3.5"/>',
  portraits: '<rect x="4.5" y="3.5" width="15" height="14"/><rect x="6.8" y="5.8" width="10.4" height="9.4"/><circle cx="12" cy="9.3" r="1.7"/><path d="M8.8 15.2c.4-2.2 1.6-3.2 3.2-3.2s2.8 1 3.2 3.2M9.5 20h5"/>'
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
