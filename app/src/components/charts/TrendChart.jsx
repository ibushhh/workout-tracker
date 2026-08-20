import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

export default function TrendChart({ data, xKey, yKey, color = "var(--accent)", height = 220, formatY, formatX, yDomain }) {
  if (!data || data.length === 0) {
    return <div className="text-faint" style={{ height, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>Not enough data yet</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey={xKey} tickFormatter={formatX} tick={{ fontSize: 11, fill: "var(--text-faint)" }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "var(--text-faint)" }} tickFormatter={formatY} axisLine={false} tickLine={false} width={44} domain={yDomain} />
        <Tooltip
          formatter={(value) => [formatY ? formatY(value) : value, ""]}
          labelFormatter={formatX}
          contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12 }}
        />
        <Line type="monotone" dataKey={yKey} stroke={color} strokeWidth={2.5} dot={{ r: 3, fill: color }} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
