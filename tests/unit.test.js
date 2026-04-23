/**
 * ToolTrack — Unit Tests
 * Run with: npm test
 */

const { esc, locClass, siteNames, filterTools, filterSites, filterLog } = require('../src/utils');

// ── esc() ─────────────────────────────────────────────────────────────────────

describe('esc()', () => {
  test('passes through safe strings unchanged', () => {
    expect(esc('hello world')).toBe('hello world');
  });

  test('encodes <, >, &, ", \'', () => {
    expect(esc('<b>bold</b>')).toBe('&lt;b&gt;bold&lt;/b&gt;');
    expect(esc('"quoted"')).toBe('&quot;quoted&quot;');
    expect(esc("it's")).toBe('it&#39;s');
    expect(esc('a & b')).toBe('a &amp; b');
  });

  test('blocks XSS via script injection', () => {
    const payload = '<script>alert(1)</script>';
    expect(esc(payload)).not.toContain('<script>');
    expect(esc(payload)).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  test('blocks attribute-breaking injection', () => {
    const payload = `'); alert(1); ('`;
    const result = esc(payload);
    expect(result).not.toContain("'");
    expect(result).toContain('&#39;');
  });

  test('blocks HTML attribute injection via double quote', () => {
    const payload = '" onmouseover="alert(1)"';
    expect(esc(payload)).not.toContain('"');
  });

  test('handles null and undefined gracefully', () => {
    expect(esc(null)).toBe('');
    expect(esc(undefined)).toBe('');
  });

  test('handles non-string input', () => {
    expect(esc(42)).toBe('42');
    expect(esc(true)).toBe('true');
  });
});

// ── locClass() ────────────────────────────────────────────────────────────────

describe('locClass()', () => {
  test('returns "unknown" for empty/missing location', () => {
    expect(locClass('')).toBe('unknown');
    expect(locClass(null)).toBe('unknown');
    expect(locClass('?')).toBe('unknown');
  });

  test('returns "decom" for decommissioned or scrap', () => {
    expect(locClass('Decommissioned')).toBe('decom');
    expect(locClass('Scrap Yard')).toBe('decom');
    expect(locClass('SCRAP')).toBe('decom');
  });

  test('returns "repair" for repair locations', () => {
    expect(locClass('Repair Shop')).toBe('repair');
    expect(locClass('In Repair')).toBe('repair');
  });

  test('returns "" for normal job sites', () => {
    expect(locClass('123 Main St')).toBe('');
    expect(locClass('Warehouse')).toBe('');
  });
});

// ── siteNames() ───────────────────────────────────────────────────────────────

describe('siteNames()', () => {
  const sites = [{ name: 'Site A' }, { name: 'Site B' }];
  const tools = [
    { loc: 'Site B' },
    { loc: 'Site C' },
    { loc: '?' },
    { loc: '' },
  ];

  test('merges sites and tool locations, deduplicates, sorts', () => {
    expect(siteNames(sites, tools)).toEqual(['Site A', 'Site B', 'Site C']);
  });

  test('excludes empty and ? locations', () => {
    const result = siteNames([], tools);
    expect(result).not.toContain('?');
    expect(result).not.toContain('');
  });

  test('handles empty inputs', () => {
    expect(siteNames([], [])).toEqual([]);
    expect(siteNames(null, null)).toEqual([]);
  });
});

// ── filterTools() ─────────────────────────────────────────────────────────────

describe('filterTools()', () => {
  const tools = [
    { name: 'Chainsaw', notes: 'Stihl brand', loc: 'Site A' },
    { name: 'Rake',     notes: '',             loc: 'Site B' },
    { name: 'Shovel',   notes: 'broken handle', loc: 'Site A' },
  ];

  test('returns all tools when no filter applied', () => {
    expect(filterTools(tools, '', '')).toHaveLength(3);
  });

  test('filters by name (case-insensitive)', () => {
    expect(filterTools(tools, 'chain', '')).toHaveLength(1);
    expect(filterTools(tools, 'CHAIN', '')).toHaveLength(1);
  });

  test('filters by notes', () => {
    expect(filterTools(tools, 'stihl', '')).toHaveLength(1);
    expect(filterTools(tools, 'broken', '')).toHaveLength(1);
  });

  test('filters by location', () => {
    expect(filterTools(tools, 'site a', '')).toHaveLength(2);
  });

  test('applies site filter', () => {
    expect(filterTools(tools, '', 'Site B')).toHaveLength(1);
  });

  test('combines query and site filter', () => {
    expect(filterTools(tools, 'shovel', 'Site A')).toHaveLength(1);
    expect(filterTools(tools, 'shovel', 'Site B')).toHaveLength(0);
  });

  test('handles null/empty inputs', () => {
    expect(filterTools(null, '', '')).toEqual([]);
    expect(filterTools([], 'x', '')).toEqual([]);
  });
});

// ── filterSites() ─────────────────────────────────────────────────────────────

describe('filterSites()', () => {
  const sites = [{ name: 'Site A' }, { name: 'Site B' }, { name: 'Empty Site' }];
  const tools = [
    { name: 'Chainsaw', loc: 'Site A' },
    { name: 'Rake',     loc: 'Site B' },
  ];

  test('returns only sites that have tools', () => {
    const result = filterSites(sites, tools, '', '');
    expect(result).toContain('Site A');
    expect(result).toContain('Site B');
    expect(result).not.toContain('Empty Site');
  });

  test('filters by query matching site name', () => {
    expect(filterSites(sites, tools, 'site a', '')).toEqual(['Site A']);
  });

  test('filters by query matching tool at site', () => {
    expect(filterSites(sites, tools, 'chainsaw', '')).toEqual(['Site A']);
  });

  test('applies siteFilter parameter', () => {
    expect(filterSites(sites, tools, '', 'Site A')).toEqual(['Site A']);
  });
});

// ── filterLog() ───────────────────────────────────────────────────────────────

describe('filterLog()', () => {
  const log = [
    { name: 'Chainsaw', from: 'Warehouse', to: 'Site A', by: 'Carlos' },
    { name: 'Rake',     from: 'Site A',    to: 'Site B', by: 'Marco' },
    { name: 'Shovel',   from: 'Site B',    to: 'Warehouse', by: 'Carlos' },
  ];

  test('returns all entries with no filter', () => {
    expect(filterLog(log, '', '')).toHaveLength(3);
  });

  test('filters by tool name', () => {
    expect(filterLog(log, 'chainsaw', '')).toHaveLength(1);
  });

  test('filters by moved-by name', () => {
    expect(filterLog(log, 'carlos', '')).toHaveLength(2);
  });

  test('filters by from/to location', () => {
    expect(filterLog(log, 'warehouse', '')).toHaveLength(2);
  });

  test('applies site filter (to or from)', () => {
    const result = filterLog(log, '', 'Site A');
    expect(result).toHaveLength(2);
    result.forEach(h => {
      expect(h.to === 'Site A' || h.from === 'Site A').toBe(true);
    });
  });

  test('handles empty input', () => {
    expect(filterLog(null, '', '')).toEqual([]);
  });
});
