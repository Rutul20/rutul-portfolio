// QA (performance lens): summarise the Lighthouse mobile runs qa/lighthouse/qa-performance-mobile-N.json
// Usage: node qa/qa-performance-lh-summary.mjs [filePrefix]
import { readFileSync, readdirSync } from 'node:fs';

const prefix = process.argv[2] || 'qa-performance-mobile';
const files = readdirSync('qa/lighthouse')
  .filter((f) => f.startsWith(prefix + '-') && /^\d+\.json$/.test(f.slice(prefix.length + 1)))
  .sort();
const rows = files.map((f) => {
  const j = JSON.parse(readFileSync(`qa/lighthouse/${f}`, 'utf8'));
  const c = j.categories;
  const a = j.audits;
  return {
    f,
    formFactor: j.configSettings.formFactor,
    throttling: j.configSettings.throttlingMethod,
    perf: Math.round(c.performance.score * 100),
    a11y: Math.round(c.accessibility.score * 100),
    bp: Math.round(c['best-practices'].score * 100),
    seo: Math.round(c.seo.score * 100),
    fcp: Math.round(a['first-contentful-paint'].numericValue),
    lcp: Math.round(a['largest-contentful-paint'].numericValue),
    tbt: Math.round(a['total-blocking-time'].numericValue),
    cls: +a['cumulative-layout-shift'].numericValue.toFixed(3),
    si: Math.round(a['speed-index'].numericValue),
    lcpEl: (a['lcp-breakdown-insight']?.details?.items ?? []).find((i) => i.type === 'node')?.selector ?? '',
    failing: Object.values(c)
      .flatMap((cat) => cat.auditRefs.filter((r) => r.weight > 0).map((r) => a[r.id]))
      .filter((x) => x.score !== null && x.score < 0.9 && x.scoreDisplayMode !== 'informative')
      .map((x) => `${x.id}(${x.score})`),
  };
});
const med = (k) => {
  const s = rows.map((r) => r[k]).sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
for (const r of rows)
  console.log(
    `${r.f} [${r.formFactor}/${r.throttling}] perf ${r.perf} a11y ${r.a11y} bp ${r.bp} seo ${r.seo} | FCP ${r.fcp} LCP ${r.lcp} TBT ${r.tbt} CLS ${r.cls} SI ${r.si} | LCP el ${r.lcpEl}\n   below 0.9: ${r.failing.join(', ') || 'none'}`,
  );
console.log(
  `MEDIAN perf ${med('perf')} a11y ${med('a11y')} bp ${med('bp')} seo ${med('seo')} | FCP ${med('fcp')} LCP ${med('lcp')} TBT ${med('tbt')} CLS ${med('cls')} SI ${med('si')}`,
);
