import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from "recharts";

export default function PerformanceChart({ league, tournamentData }) {
  const { standings, tournaments, max_counted } = league;
  const [disabledPlayers, setDisabledPlayers] = useState(new Set());
  const [hoveredPlayer, setHoveredPlayer] = useState(null);

  const chartData = useMemo(() => {
    // Sort tourneys chronological
    const chronTournaments = [...tournaments].sort((a, b) => {
      const numA = parseInt(a.split("-")[1]);
      const numB = parseInt(b.split("-")[1]);
      return numA - numB;
    });

    const playersOfInterest = new Set();
    // Track each player's tournament scores for best-N calculation
    const playerScores = {}; // { playerName: [score1, score2, ...] }
    standings.forEach((p) => (playerScores[p.name] = []));

    const historyData = chronTournaments.map((tId) => {
      const t = tournamentData[tId];
      const point = {
        name: t ? `W${t.name.split(" ")[1]}` : tId,
        fullDate: t ? t.date : "",
      };

      // Update scores and calculate best-N for each player
      standings.forEach((p) => {
        const score = p.history[tId] || 0;
        if (score > 0) {
          playerScores[p.name].push(score);
        }

        // Calculate best-N sum (like actual league standings)
        const scores = [...playerScores[p.name]].sort((a, b) => b - a);
        const bestN = max_counted ? scores.slice(0, max_counted) : scores;
        point[p.name] = bestN.reduce((sum, s) => sum + s, 0);
      });

      // Find Top 15 for THIS week (to capture more players of interest)
      const sortedThisWeek = Object.entries(point)
        .filter(([key]) => key !== "name" && key !== "fullDate")
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15);

      sortedThisWeek.forEach(([name]) => playersOfInterest.add(name));

      return point;
    });

    // Get the final week's data for sorting
    const finalWeekData = historyData[historyData.length - 1] || {};

    // Convert Select players to array, sorted by their score in the FINAL week
    const chartPlayers = standings
      .filter((p) => playersOfInterest.has(p.name))
      .sort(
        (a, b) => (finalWeekData[b.name] || 0) - (finalWeekData[a.name] || 0),
      );

    return { data: historyData, players: chartPlayers };
  }, [standings, tournaments, tournamentData, max_counted]);

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
    // Don't show tooltip when hovering on legend
    if (hoveredPlayer) return null;

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

  const handleLegendClick = (playerName) => {
    setDisabledPlayers((prev) => {
      const next = new Set(prev);
      if (next.has(playerName)) {
        next.delete(playerName);
      } else {
        next.add(playerName);
      }
      return next;
    });
  };

  // Calculate line opacity based on hover and disabled state
  const getLineOpacity = (playerName) => {
    if (disabledPlayers.has(playerName)) return 0.1;
    if (hoveredPlayer === null) return 1;
    return hoveredPlayer === playerName ? 1 : 0.15;
  };

  const getLineWidth = (playerName) => {
    if (hoveredPlayer === playerName) return 3;
    return 2;
  };

  if (!chartData.data || chartData.data.length === 0) return null;

  return (
    <div className="w-full bg-slate-900/50 rounded-xl border border-slate-700 p-4">
      <h3 className="text-lg font-semibold text-slate-200 mb-4 ml-2">
        Top Performance History
      </h3>
      <div className="flex" style={{ minHeight: "450px" }}>
        {/* Chart area */}
        <div className="flex-1 min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData.data}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#334155"
                opacity={0.5}
              />
              <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 12 }} />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              {chartData.players.map((p, i) => (
                <Line
                  key={p.name}
                  type="monotone"
                  dataKey={p.name}
                  stroke={colors[i % colors.length]}
                  strokeWidth={getLineWidth(p.name)}
                  strokeOpacity={getLineOpacity(p.name)}
                  dot={
                    hoveredPlayer === p.name
                      ? { r: 4, fill: colors[i % colors.length] }
                      : false
                  }
                  activeDot={hoveredPlayer ? false : { r: 6 }}
                  connectNulls
                  hide={disabledPlayers.has(p.name)}
                >
                  {hoveredPlayer === p.name && (
                    <LabelList
                      dataKey={p.name}
                      position="top"
                      fill="#e2e8f0"
                      fontSize={10}
                      offset={8}
                    />
                  )}
                </Line>
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        {/* Custom Legend - sorted by final score */}
        <div
          className="flex flex-col justify-center pl-6 pr-2 text-sm"
          style={{ minWidth: "180px" }}
        >
          {chartData.players.map((p, i) => (
            <div
              key={p.name}
              onClick={() => handleLegendClick(p.name)}
              onMouseEnter={() => setHoveredPlayer(p.name)}
              onMouseLeave={() => setHoveredPlayer(null)}
              className="flex items-center gap-2 py-0.5 px-1 cursor-pointer whitespace-nowrap transition-all rounded"
              style={{
                opacity: disabledPlayers.has(p.name)
                  ? 0.3
                  : hoveredPlayer && hoveredPlayer !== p.name
                    ? 0.5
                    : 1,
                backgroundColor:
                  hoveredPlayer === p.name
                    ? "rgba(100, 116, 139, 0.3)"
                    : "transparent",
              }}
            >
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: colors[i % colors.length] }}
              />
              <span className="text-slate-200">{p.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
