import MonthSpendCard from "@/components/month-spend-card";
import SegmentedTabs from "@/components/segmented-tabs";

export default function DashboardMobileMock() {
  const width = 390;
  const ratio = 9 / 19.5;
  const height = Math.round(width / ratio);

  const spends = Array.from({ length: 31 }, (_, i) => (i === 7 ? 28 : Math.max(0, Math.round(5 + Math.sin(i / 3) * 20 + (i % 5 === 0 ? 40 : 0)))));
  spends[7] = 28;
  const cum = spends.map((_, i) => spends.slice(0, i + 1).reduce((a, b) => a + b, 0));
  const total = cum[cum.length - 1] ?? 0;
  const avgPerDay = total / 31;
  const avg = Array.from({ length: 31 }, (_, i) => avgPerDay * (i + 1));

  function bucket(v: number) {
    if (v <= 0) return "bucket-0";
    if (v < 25) return "bucket-1";
    if (v < 75) return "bucket-2";
    if (v < 150) return "bucket-3";
    return "bucket-4";
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "#0B0E13" }}>
      <div
        className="relative rounded-[2.2rem] shadow-[0_40px_80px_rgba(0,0,0,0.6)] border border-white/10 overflow-hidden"
        style={{ width, height }}
      >
        <div className="absolute inset-0" style={{ background: "radial-gradient(1200px_800px_at_10%_-10%, hsl(var(--primary)/0.08), transparent_60%), radial-gradient(1000px_700px_at_120%_10%, hsl(var(--accent)/0.06), transparent_60%), hsl(var(--bg))" }} />
        <div className="absolute inset-0 flex flex-col">
          <div className="hero text-white">
            <div className="px-4 pt-2 pb-3">
              <div className="flex items-center justify-between text-[12px] opacity-90">
                <div>9:41</div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-3 rounded-sm bg-white/80" />
                  <div className="h-2 w-3 rounded-sm bg-white/80" />
                  <div className="h-2 w-4 rounded-sm bg-white/80" />
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <button aria-label="Settings" className="h-11 w-11 rounded-full bg-white/12 ring-1 ring-inset ring-white/15 shadow-sm flex items-center justify-center" />
                <div className="text-sm"><span>Overview: </span><strong>My Household</strong> ▸</div>
                <button aria-label="Notifications" className="relative h-11 w-11 rounded-full bg-white/12 ring-1 ring-inset ring-white/15 shadow-sm flex items-center justify-center">
                  <span className="absolute top-2 right-2 inline-block h-2 w-2 rounded-full" style={{ background: "hsl(var(--accent))" }} />
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-3">
            <div className="flex justify-center">
              <SegmentedTabs
                tabs={[{ key: "overview", label: "OVERVIEW" }, { key: "spending", label: "SPENDING" }, { key: "list", label: "LIST" }]}
                activeKey="overview"
                hrefBase="/dashboard"
                queryKey="tab"
              />
            </div>

            <div className="mt-3">
              <MonthSpendCard total={28} currency="USD" locale="en-US" cumSeries={cum} avgSeries={avg} />
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-center text-sm text-zinc-300">
                <span>‹ October 2025 ›</span>
              </div>
              <div className="mt-2 grid grid-cols-7 gap-1">
                {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d) => (
                  <div key={d} className="text-[10px] text-zinc-500 text-center">{d}</div>
                ))}
                {Array.from({ length: 31 + 3 }).map((_, idx) => {
                  const dayNum = idx - 2; // assume month starts Wed
                  const inMonth = dayNum >= 1 && dayNum <= 31;
                  const v = inMonth ? spends[dayNum - 1] : 0;
                  const isToday = dayNum === 12;
                  const isBadge = dayNum === 8;
                  return (
                    <div key={idx} className={`${inMonth ? bucket(v) : "opacity-0"} relative h-12 rounded-xl p-1 text-center` + (isToday ? " outline outline-1 outline-[hsl(var(--accent))]" : "") }>
                      {isBadge ? (
                        <div className="absolute inset-1 rounded-lg bg-white/6 ring-1 ring-inset ring-white/10 flex flex-col items-center justify-center">
                          <div className="text-[10px] text-zinc-300">8</div>
                          <div className="text-[11px] font-semibold tabular text-white">$28</div>
                        </div>
                      ) : (
                        <div className="text-[10px] text-zinc-400 text-left">{inMonth ? dayNum : ""}</div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex items-center justify-center gap-3 text-[10px] text-zinc-400">
                <div className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-white/15" /> $0</div>
                <div className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: "hsl(var(--primary)/0.10)" }} /> &lt;$25</div>
                <div className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: "hsl(var(--primary)/0.18)" }} /> $25–$74</div>
                <div className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: "hsl(var(--primary)/0.26)" }} /> $75–$149</div>
                <div className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: "hsl(var(--accent)/0.32)" }} /> ≥$150</div>
              </div>
            </div>

            <div className="pointer-events-none">
              <div className="fixed" style={{ right: 16, bottom: 110 }}>
                <div className="relative">
                  <div className="absolute -top-16 -left-10 h-9 w-9 rounded-full flex items-center justify-center text-white" style={{ background: "hsl(var(--accent))", boxShadow: "0 0 24px hsl(var(--accent)/0.6)" }}>＋</div>
                  <div className="absolute -top-28 -left-0 h-9 w-9 rounded-full flex items-center justify-center text-white" style={{ background: "hsl(180 90% 50%)", boxShadow: "0 0 24px hsl(180 90% 50% / 0.6)" }}>＋</div>
                  <div className="h-14 w-14 rounded-full flex items-center justify-center text-white" style={{ background: "hsl(var(--primary))", boxShadow: "0 0 36px hsl(var(--primary)/0.6)" }}>＋</div>
                </div>
              </div>
            </div>

            <div className="fixed inset-x-0" style={{ bottom: 16 }}>
              <div className="mx-auto w-[90%] rounded-full glass border border-white/10 backdrop-blur px-3 py-2 flex items-center justify-between">
                {[
                  { key: "Overview", active: true },
                  { key: "Budget", active: false },
                  { key: "Wallets", active: false },
                  { key: "Save", active: false },
                  { key: "Tools", active: false },
                ].map((it) => (
                  <div key={it.key} className={`flex flex-col items-center text-[11px] ${it.active ? "text-white" : "text-zinc-400"}`}>
                    <div className={`h-6 w-6 rounded-full ${it.active ? "ring-2 ring-cyan-400/50" : "ring-0"}`} />
                    <div className="mt-1">{it.key}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
