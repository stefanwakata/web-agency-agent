// End-to-end check: the clean demo must pass, the broken demo must be flagged.
import { spawn, execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const server = spawn(process.execPath, [path.join(root, "demo/serve.mjs")], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 800));

const run = (url, out) => {
  execFileSync(process.execPath, [path.join(root, "record.mjs"), url, "--out", out], { cwd: root, stdio: "inherit" });
  return JSON.parse(readFileSync(path.join(root, out, "report-desktop.json"), "utf8"));
};

let failed = false;
const expect = (name, ok, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  ${detail}`);
  if (!ok) failed = true;
};

try {
  const clean = run("http://localhost:4173/", "out/test-clean");
  expect("clean page is SMOOTH", clean.verdict === "SMOOTH", `verdict ${clean.verdict}, CLS ${clean.cls}`);

  const jank = run("http://localhost:4173/?jank=1", "out/test-jank");
  expect("broken page is flagged", jank.verdict === "INVESTIGATE", `verdict ${jank.verdict}`);
  expect("late banner shift is measured", jank.cls >= 0.05, `CLS ${jank.cls}`);
  expect("scroll-handler work is measured", jank.longTasks.duringScroll >= 1, `${jank.longTasks.duringScroll} long task(s) while scrolling`);
} finally {
  server.kill();
}
process.exit(failed ? 1 : 0);
