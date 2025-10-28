export type FxRateRow = {
  date: string; // yyyy-mm-dd
  from_currency: string;
  to_currency: string;
  rate: number; // multiply amount in from -> to
};

export function buildFxConverter(rates: FxRateRow[]) {
  // Index by pair -> sorted by date ascending
  const byPair = new Map<string, { d: number; r: number }[]>();
  for (const r of rates) {
    const key = `${r.from_currency}|${r.to_currency}`;
    const arr = byPair.get(key) ?? [];
    const t = Date.parse(r.date + 'T00:00:00');
    arr.push({ d: t, r: Number(r.rate) });
    byPair.set(key, arr);
  }
  for (const [k, arr] of byPair) arr.sort((a, b) => a.d - b.d);

  function findRate(from: string, to: string, onDate: Date | string): number | null {
    if (from === to) return 1;
    const key = `${from}|${to}`;
    const arr = byPair.get(key);
    if (!arr || arr.length === 0) {
      // Try inverse pair
      const ik = `${to}|${from}`;
      const inv = byPair.get(ik);
      if (!inv || inv.length === 0) return null;
      const rate = searchLatest(inv, onDate);
      return rate != null && rate !== 0 ? 1 / rate : null;
    }
    return searchLatest(arr, onDate);
  }

  function searchLatest(arr: { d: number; r: number }[], onDate: Date | string): number | null {
    const ts = typeof onDate === 'string' ? Date.parse(onDate + 'T00:00:00') : new Date(onDate.getFullYear(), onDate.getMonth(), onDate.getDate()).getTime();
    let lo = 0, hi = arr.length - 1, ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (arr[mid].d <= ts) { ans = mid; lo = mid + 1; }
      else { hi = mid - 1; }
    }
    return ans === -1 ? null : arr[ans].r;
  }

  return function convert(amount: number, from: string, to: string, onDate: Date | string): number | null {
    if (!isFinite(amount)) return null;
    const r = findRate(from, to, onDate);
    if (r == null) return from === to ? amount : null;
    return amount * r;
  };
}
