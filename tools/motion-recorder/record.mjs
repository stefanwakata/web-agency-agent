#!/usr/bin/env node
// motion-recorder: record a web page while it scrolls like a person, measure smoothness
// (frame times, long tasks, layout shifts, console errors) and build contact sheets
// so animations can be reviewed frame by frame.
//
// Usage: node record.mjs <url> [--out dir] [--profile desktop|mobile] [--reduced-motion]
//                              [--step 100] [--wait 40]
import { chromium, devices } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, readdirSync, renameSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith("--") && !/^\d+$/.test(a) && !args[args.indexOf(a) - 1]?.startsWith("--"));
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const flag = (name) => args.includes(`--${name}`);
if (!url) {
  console.error("usage: node record.mjs <url> [--out dir] [--profile desktop|mobile] [--reduced-motion] [--step 100] [--wait 40]");
  process.exit(1);
}
const outDir = opt("out", "motion-out");
const profile = opt("profile", "desktop");
const reduced = flag("reduced-motion");
const step = Number(opt("step", 100)), wait = Number(opt("wait", 40));
const tag = `${profile}${reduced ? "-reduced" : ""}`;
const vp = profile === "mobile" ? { width: 390, height: 844 } : { width: 1440, height: 900 };
const framesDir = path.join(outDir, `frames-${tag}`);
mkdirSync(framesDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const contextOptions = {
  viewport: vp, deviceScaleFactor: 1, reducedMotion: reduced ? "reduce" : "no-preference",
  ...(profile === "mobile" ? { isMobile: true, hasTouch: true, userAgent: devices["Pixel 7"].userAgent } : {}),
};

// Pass 1: measured and filmed. Scroll with the wheel (desktop) or by script (mobile), like a person.
const ctx = await browser.newContext({ ...contextOptions, recordVideo: { dir: outDir, size: vp } });
const page = await ctx.newPage();
const consoleErrors = [];
page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
page.on("pageerror", (e) => consoleErrors.push(String(e)));
await page.addInitScript(() => {
  const w = window; w.__mr = { cls: 0, shifts: [], longTasks: [], frames: [], recording: false, scrollStart: 0 };
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) { w.__mr.cls += e.value; w.__mr.shifts.push({ t: Math.round(e.startTime), v: +e.value.toFixed(4) }); } }).observe({ type: "layout-shift", buffered: true }); } catch {}
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) w.__mr.longTasks.push({ t: Math.round(e.startTime), d: Math.round(e.duration) }); }).observe({ type: "longtask", buffered: true }); } catch {}
  let last = 0; const tick = (t) => { if (w.__mr.recording && last) w.__mr.frames.push(t - last); last = t; requestAnimationFrame(tick); }; requestAnimationFrame(tick);
});
const t0 = Date.now();
await page.goto(url, { waitUntil: "load" });
await page.waitForTimeout(1500);
const loadMs = Date.now() - t0;
const scrollStart = await page.evaluate(() => { window.__mr.recording = true; return Math.round(performance.now()); });
const total = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
await page.mouse.move(vp.width / 2, vp.height / 2);
for (let y = 0; y < total + vp.height; y += step) {
  if (profile === "mobile") await page.evaluate((d) => scrollBy(0, d), step); else await page.mouse.wheel(0, step);
  await page.waitForTimeout(wait);
}
await page.waitForTimeout(1200);
const mr = await page.evaluate(() => { window.__mr.recording = false; return window.__mr; });
await ctx.close();

// Pass 2: one still per screen, after motion settles (does every screen look finished?).
const ctx2 = await browser.newContext(contextOptions);
const p2 = await ctx2.newPage();
await p2.goto(url, { waitUntil: "load" }); await p2.waitForTimeout(1500);
const h = await p2.evaluate(() => document.documentElement.scrollHeight);
let shot = 0;
for (let sy = 0; sy < h; sy += vp.height) {
  await p2.evaluate((t) => scrollTo(0, t), sy);
  await p2.waitForTimeout(900);
  await p2.screenshot({ path: path.join(framesDir, `${String(shot++).padStart(3, "0")}.png`) });
}
await ctx2.close(); await browser.close();

// Video and contact sheets (12 frames per sheet, about 6 sheets per run).
const raw = readdirSync(outDir).find((f) => f.endsWith(".webm") && !f.startsWith("video-"));
const video = path.join(outDir, `video-${tag}.webm`); renameSync(path.join(outDir, raw), video);
const dur = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", video]).toString()) || 10;
const fps = Math.max(1, Math.min(6, +(72 / dur).toFixed(2)));
execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", video, "-vf", `fps=${fps},scale=${profile === "mobile" ? 260 : 480}:-1,tile=4x3`, path.join(outDir, `sheet-${tag}-%02d.png`)]);

// Report. Long tasks are split by phase: before scrolling (load, hydration) and while scrolling.
const f = mr.frames.filter((x) => x > 0 && x < 1000).sort((a, b) => a - b);
const q = (p) => (f.length ? +f[Math.min(f.length - 1, Math.floor(f.length * p))].toFixed(1) : null);
const duringScroll = mr.longTasks.filter((x) => x.t >= scrollStart);
const report = {
  url, profile, reducedMotion: reduced, viewport: vp, loadMs, videoSeconds: +dur.toFixed(1),
  frames: { count: f.length, medianMs: q(0.5), p95Ms: q(0.95), maxMs: f.length ? +f[f.length - 1].toFixed(1) : null },
  longTasks: {
    beforeScroll: mr.longTasks.filter((x) => x.t < scrollStart).length,
    duringScroll: duringScroll.length,
    worstDuringScroll: duringScroll.sort((a, b) => b.d - a.d).slice(0, 5),
  },
  cls: +mr.cls.toFixed(4), shifts: mr.shifts.slice(0, 10), consoleErrors: consoleErrors.slice(0, 10),
};
const problems = [];
if (report.longTasks.duringScroll) problems.push(`${report.longTasks.duringScroll} long task(s) while scrolling, worst ${duringScroll[0].d} ms`);
if (report.cls >= 0.02) problems.push(`layout shift ${report.cls} (target < 0.02)`);
if (consoleErrors.length) problems.push(`${consoleErrors.length} console error(s)`);
report.verdict = problems.length ? "INVESTIGATE" : "SMOOTH";
report.problems = problems;
writeFileSync(path.join(outDir, `report-${tag}.json`), JSON.stringify(report, null, 2));
console.log(`${report.verdict}  ${tag}  long tasks while scrolling: ${report.longTasks.duringScroll}  CLS: ${report.cls}  console errors: ${consoleErrors.length}`);
for (const p of problems) console.log(`  - ${p}`);
console.log(`  sheets, stills and video in ${outDir}/`);
