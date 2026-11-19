// The first-visit accessibility prompt asks once per browser. Tests that are about something else start as a
// returning visitor: this init script marks the question as already asked (tests/a11y-prompt.js tests the prompt).
//   await page.addInitScript(skipAsk)   or   await context.addInitScript(skipAsk)
module.exports = function skipAsk() { try { localStorage.setItem("escape-room-a11y-asked", "test"); } catch (e) {} };
