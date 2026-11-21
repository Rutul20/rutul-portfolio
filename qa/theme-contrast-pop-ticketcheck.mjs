// one-off: is the ticket's backdrop blur live (not isolated by the wrap)? move the ticket over the globe.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const src = readFileSync('qa/theme-contrast-pop.mjs', 'utf8');
const grab = (name) => src.split(`const ${name} = \``)[1].split('`;')[0];
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:3100/?mode=live', { waitUntil: 'networkidle' });
await page.waitForSelector('.live.is-shown', { timeout: 30000 });
await page.waitForTimeout(1500);
await page.addStyleTag({ content: grab('LIGHT') + grab('COMPONENTS') + '.ticket-wrap{transform:translateX(640px)}' });
await page.waitForTimeout(800);
await page.screenshot({ path: 'qa/shots/theme-contrast-pop-ticketcheck.png' });
await browser.close();
