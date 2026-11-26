/* Words used in more than one place (the guided steps, the teacher card, the quick-start guide's checks). */
import { S } from "./store.js";

export const QUIZ_Q = "Type the exit password from the certificate at the end of the escape room.";
export const ROOM_KIND = { quiz: "Quiz questions", matching: "Match clues to cards", ordering: "Put in order (timeline)", sorting: "Sort into groups", reflection: "Reflection (no wrong answers)", cipher: "Secret message (cipher wheel)" };
export const LMS = { moodle: "Moodle", canvas: "Canvas" };
export function deliveryWords(){
  const d = S.meta.delivery || {};
  const where = { link: "A class link", moodle: "Moodle", canvas: "Canvas", other: "Another course system", file: "A file you share" }[d.where];
  if (!where) return null;
  const how = d.where === "moodle" || d.where === "canvas" ? (d.how === "scorm" ? ", grade file" : d.how === "quiz" ? ", file and exit-password quiz" : "") : "";
  return where + how;
}
