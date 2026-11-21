// QA helper: main-thread events over 40 ms during a phone-like load (4x CPU slowdown, no GPU).
import { chromium, devices } from 'playwright';
import { readFileSync } from 'node:fs';
const base = process.argv[2] || 'http://localhost:4100';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ ...devices['Pixel 7'] });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
await browser.startTracing(page, { path: 'qa/trace.json', categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline'] });
await page.goto(base, { waitUntil: 'load' });
await page.waitForTimeout(6000);
await browser.stopTracing();
const { traceEvents } = JSON.parse(readFileSync('qa/trace.json', 'utf8'));
const main = traceEvents.find((e) => e.name === 'thread_name' && e.args?.name === 'CrRendererMain');
const t0 = Math.min(...traceEvents.filter((e) => e.ts > 0).map((e) => e.ts));
traceEvents
  .filter((e) => e.ph === 'X' && e.tid === main.tid && e.dur > 40000 && e.name !== 'RunTask' && e.name !== 'ThreadControllerImpl::RunTask')
  .sort((a, b) => b.dur - a.dur)
  .slice(0, 14)
  .forEach((e) => console.log(String(Math.round(e.dur / 1000)).padStart(6), 'ms at', Math.round((e.ts - t0) / 1000), e.name, JSON.stringify(e.args?.data?.url || e.args?.data?.functionName || e.args?.beginData?.frame || '').slice(0, 80)));
await browser.close();
