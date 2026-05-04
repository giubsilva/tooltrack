/**
 * ToolTrack — pure utility functions
 * Shared between index.html (browser) and the test suite (Node.js).
 */

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function locClass(loc) {
  if (!loc || loc === '?') return 'unknown';
  const l = loc.toLowerCase();
  if (l.includes('decom') || l.includes('scrap')) return 'decom';
  if (l.includes('repair')) return 'repair';
  return '';
}

function siteNames(sites, tools) {
  const sheetNames = (sites  || []).map(s => s.name);
  const toolLocs   = (tools  || []).map(t => t.loc).filter(l => l && l !== '?');
  return [...new Set([...sheetNames, ...toolLocs])].sort();
}

function filterTools(tools, query, siteFilter) {
  const q = (query || '').toLowerCase().trim();
  return (tools || []).filter(t => {
    const matchQ = !q ||
      t.name.toLowerCase().includes(q) ||
      (t.notes || '').toLowerCase().includes(q) ||
      (t.loc   || '').toLowerCase().includes(q);
    const matchSite = !siteFilter || t.loc === siteFilter;
    return matchQ && matchSite;
  });
}

function filterSites(sites, tools, query, siteFilter) {
  const q     = (query || '').toLowerCase().trim();
  const names = siteNames(sites, tools);
  return names.filter(site => {
    if (siteFilter && site !== siteFilter) return false;
    const toolsHere = (tools || []).filter(t => t.loc === site);
    if (!toolsHere.length) return false;
    if (q) {
      const siteMatch = site.toLowerCase().includes(q);
      const toolMatch = toolsHere.some(t => t.name.toLowerCase().includes(q));
      if (!siteMatch && !toolMatch) return false;
    }
    return true;
  });
}

function filterLog(moveLog, query, siteFilter) {
  const q = (query || '').toLowerCase().trim();
  return (moveLog || []).filter(h => {
    const matchQ = !q ||
      h.name.toLowerCase().includes(q) ||
      (h.from || '').toLowerCase().includes(q) ||
      (h.to   || '').toLowerCase().includes(q) ||
      (h.by   || '').toLowerCase().includes(q);
    const matchSite = !siteFilter || h.to === siteFilter || h.from === siteFilter;
    return matchQ && matchSite;
  });
}

// Builds a CSV string from the move log array for client-side download.
function buildCsv(moveLog) {
  const header = ['Tool Name', 'From', 'To', 'Moved By', 'Time'];
  const escape = v => {
    const s = String(v == null ? '' : v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? '"' + s.replace(/"/g, '""') + '"'
      : s;
  };
  const rows = (moveLog || []).map(h =>
    [h.name, h.from, h.to, h.by, h.time].map(escape).join(',')
  );
  return [header.join(','), ...rows].join('\r\n');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { esc, locClass, siteNames, filterTools, filterSites, filterLog, buildCsv };
}
