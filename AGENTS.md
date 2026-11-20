# Agents

Everything about this project (what it is, its layout, the build, the tests and the rules for changes) is in
[CLAUDE.md](CLAUDE.md). Read it first; it applies to every agent, not only Claude.

## ui-sdk (the teacher editor)

The teacher editor (`src/editor/`) is built with React and ui-sdk (`@ui-sdk/react`, `@ui-sdk/core`).

- Before using ui-sdk, follow the ui-sdk skill if it's installed (`.agents/skills/ui-sdk`), and read
  `node_modules/@ui-sdk/react/docs/llms.txt`.
- To build a new component, also search `node_modules/@ui-sdk/react/docs/core.md` by heading (it is very large: don't
  read it whole), and read `rendering.md` next to it.
