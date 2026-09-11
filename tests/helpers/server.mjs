// Piepklein statisch servertje voor de tests — serveert de repo-root.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const types = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript", ".json": "application/json", ".sql": "text/plain",
  ".gpx": "application/gpx+xml", ".png": "image/png", ".svg": "image/svg+xml", ".md": "text/markdown; charset=utf-8"
};

let teller = 0;

http.createServer((req, res) => {
  const [pad, query] = req.url.split("?");
  const rel = decodeURIComponent(pad).replace(/^\/+/, "");

  // Vercel draait met cleanUrls: /x.html wordt 308'd naar /x, en /x serveert
  // x.html. Dat hier nabootsen, want die omleiding is geen detail — een
  // service worker die een omgeleid antwoord bewaart en dat later voor een
  // navigatie teruggeeft, levert een harde netwerkfout op. Zonder deze
  // nabootsing zien de tests dat nooit.
  if (rel.endsWith(".html")) {
    res.writeHead(308, { location: "/" + rel.slice(0, -5) + (query ? "?" + query : "") }).end();
    return;
  }
  const kaal = rel || "index";
  const kandidaat = path.join(root, kaal);
  const file = fs.existsSync(kandidaat) && !fs.statSync(kandidaat).isDirectory()
    ? kandidaat
    : path.join(root, kaal + ".html");

  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404).end("not found");
    return;
  }
  // Elk antwoord krijgt een eigen volgnummer mee. Daarmee kan een test zien of
  // iets écht van de server kwam of uit de voorraad van de service worker.
  res.writeHead(200, {
    "content-type": types[path.extname(file)] || "application/octet-stream",
    "x-vers": String(++teller)
  });
  fs.createReadStream(file).pipe(res);
}).listen(4173, "127.0.0.1");
