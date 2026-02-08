function normalize(str) {
  return str.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
}

function fuzzyScore(query, target) {
  const q = normalize(query);
  const t = normalize(target);
  if (!q || !t) return 0;
  if (t === q) return 1;
  if (t.startsWith(q) || q.startsWith(t)) return 0.95;
  if (t.includes(q)) return 0.9;
  if (q.includes(t)) return 0.85;
  const qWords = q.split(/\s+/);
  const tWords = t.split(/\s+/);
  let matched = 0;
  for (const qw of qWords) {
    if (tWords.some(tw => tw.includes(qw) || qw.includes(tw))) matched++;
  }
  return matched / qWords.length * 0.8;
}

function bestMatch(query, items, getTitles, threshold = 0.3) {
  return items
    .map(item => {
      const titles = getTitles(item).filter(Boolean);
      const score = Math.max(...titles.map(t => fuzzyScore(query, t)), 0);
      return { item, score };
    })
    .filter(r => r.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .map(r => r.item);
}

module.exports = { fuzzyScore, bestMatch };
