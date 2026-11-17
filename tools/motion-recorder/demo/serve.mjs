// Minimal static server for the demo page (no dependencies).
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
const port = Number(process.env.PORT || 4173);
createServer(async (req, res) => {
  if (!req.url.startsWith("/") || req.url.split("?")[0] !== "/") { res.writeHead(404).end(); return; }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(await readFile(new URL("./index.html", import.meta.url)));
}).listen(port, () => console.log(`demo on http://localhost:${port}/`));
