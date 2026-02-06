import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export default function PerformanceChart({ league, tournamentData }) {
  const { standings, tournaments } = league;
  const [disabledPlayers, setDisabledPlayers] = useState(new Set());

  const chartData = useMemo(() => {
    // 2. Identify all players who have EVER been in the Top 10 (Cumulative) at any point
    // This solves "scored high in weeks 1-3 should be visible"

    // Sort tourneys chronological
    const chronTournaments = [...tournaments].sort((a, b) => {
      const numA = parseInt(a.split("-")[1]);
      const numB = parseInt(b.split("-")[1]);
      return numA - numB;
    });

    const playersOfInterest = new Set();
    const runningTotals = {}; // { playerName: score }
    standings.forEach((p) => (runningTotals[p.name] = 0));

    const historyData = chronTournaments.map((tId) => {
      const t = tournamentData[tId];
      const point = {
        name: t ? `W${t.name.split(" ")[1]}` : tId,
        fullDate: t ? t.date : "",
      };

      // Update totals
      standings.forEach((p) => {
        const score = p.history[tId] || 0;
        runningTotals[p.name] += score;
        point[p.name] = runningTotals[p.name];
      });

      // Find Top 10 for THIS week
      const sortedThisWeek = Object.entries(point)
        .filter(([key]) => key !== "name" && key !== "fullDate")
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      sortedThisWeek.forEach(([name]) => playersOfInterest.add(name));

      return point;
    });

    // Convert Select players to array
    const chartPlayers = standings.filter((p) => playersOfInterest.has(p.name));

    return { data: historyData, players: chartPlayers };
  }, [standings, tournaments, tournamentData]);

  // Colors for lines (extended palette)
  const colors = [
    "#3b82f6",
    "#ef4444",
    "#10b981",
    "#f59e0b",
    "#8b5cf6",
    "#ec4899",
    "#06b6d4",
    "#84cc16",
    "#f97316",
    "#6366f1",
    "#a855f7",
    "#e11d48",
    "#14b8a6",
    "#fbbf24",
    "#4338ca",
  ];

  /* Custom Tooltip to Sort by Score */
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      // Sort payload by value desc
      const sorted = [...payload].sort((a, b) => b.value - a.value);

      return (
        <div className="bg-slate-900 border border-slate-700 p-3 rounded shadow-xl opacity-95">
          <p className="font-bold text-slate-200 mb-2 border-b border-slate-700 pb-1">
            {label}
          </p>
          {sorted.map((entry) => (
            <div
              key={entry.name}
              className="flex items-center justify-between gap-4 text-xs mb-1"
            >
              <span style={{ color: entry.stroke }}>{entry.name}:</span>
              <span className="font-mono text-slate-300">{entry.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const handleLegendClick = (e) => {
    const { dataKey } = e;
    setDisabledPlayers((prev) => {
      const next = new Set(prev);
      if (next.has(dataKey)) {
        next.delete(dataKey);
      } else {
        next.add(dataKey);
      }
      return next;
    });
  };

  if (!chartData.data || chartData.data.length === 0) return null;

  return (
    <div className="w-full h-[500px] bg-slate-900/50 rounded-xl border border-slate-700 p-4">
      <h3 className="text-lg font-semibold text-slate-200 mb-4 ml-2">
        Top Performance History
      </h3>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData.data}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
          <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 12 }} />
          <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            onClick={handleLegendClick}
            wrapperStyle={{ cursor: "pointer" }}
          />
          {chartData.players.map((p, i) => (
            <Line
              key={p.name}
              type="monotone"
              dataKey={p.name}
              stroke={colors[i % colors.length]}
              strokeWidth={2}
              strokeOpacity={disabledPlayers.has(p.name) ? 0.1 : 1}
              dot={false}
              activeDot={{ r: 6 }}
              connectNulls
              hide={disabledPlayers.has(p.name)}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
