"use client";

import { Line, LineChart, ResponsiveContainer } from "recharts";

export default function Sparkline({ data, className, stroke }: { data: number[]; className?: string; stroke?: string }) {
  const points = data.map((y, i) => ({ x: i, y }));
  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={36}>
        <LineChart data={points} margin={{ top: 6, right: 0, bottom: 0, left: 0 }}>
          <Line type="monotone" dataKey="y" stroke={stroke ?? "#10b981"} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
