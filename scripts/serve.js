// Tiny static server for local testing: `npm run serve` → http://localhost:8080
// No dependencies. Also used by the automated tests.
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".xml": "application/xml", ".png": "image/png", ".svg": "image/svg+xml", ".zip": "application/zip" };

function start(port = 8080) {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end("Not found"); }
      res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
      res.end(data);
    });
  });
  return new Promise(resolve => server.listen(port, "127.0.0.1", () => resolve(server)));
}

module.exports = { start };

if (require.main === module) {
  const port = Number(process.env.PORT) || 8080;
  start(port).then(() => console.log(`Front page at http://localhost:${port}/ · the game at /play.html · the maker at /editor.html  (Ctrl+C to stop)`));
}
