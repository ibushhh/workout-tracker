import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

export default function BarTrendChart({ data, xKey, yKey, color = "var(--cardio)", height = 220, formatY, formatX }) {
  if (!data || data.length === 0) {
    return <div className="text-faint" style={{ height, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>Not enough data yet</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey={xKey} tickFormatter={formatX} tick={{ fontSize: 11, fill: "var(--text-faint)" }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "var(--text-faint)" }} tickFormatter={formatY} axisLine={false} tickLine={false} width={44} />
        <Tooltip
          formatter={(value) => [formatY ? formatY(value) : value, ""]}
          labelFormatter={formatX}
          contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12 }}
          cursor={{ fill: "var(--bg-subtle)" }}
        />
        <Bar dataKey={yKey} fill={color} radius={[5, 5, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
