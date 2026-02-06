import { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export default function DeckChart({ league, tournamentData }) {
  const { tournaments } = league;

  const data = useMemo(() => {
    const deckCounts = {};

    // Iterate all tournaments in this league
    tournaments.forEach((tId) => {
      const t = tournamentData[tId];
      if (!t || !t.standings) return;

      t.standings.forEach((p) => {
        const deck = p.deck;
        if (deck) {
          // Normalize deck names roughly
          const name = deck.trim();
          deckCounts[name] = (deckCounts[name] || 0) + 1;
        }
      });
    });

    // Convert to array
    const arr = Object.keys(deckCounts).map((name) => ({
      name,
      value: deckCounts[name],
    }));

    // Sort by count
    arr.sort((a, b) => b.value - a.value);

    // Take top 8 and Group others
    if (arr.length > 8) {
      const top8 = arr.slice(0, 8);
      const others = arr.slice(8).reduce((acc, curr) => acc + curr.value, 0);
      top8.push({ name: "Others", value: others });
      return top8;
    }

    return arr;
  }, [tournaments, tournamentData]);

  const COLORS = [
    "#0088FE",
    "#00C49F",
    "#FFBB28",
    "#FF8042",
    "#8884d8",
    "#82ca9d",
    "#ffc658",
    "#8dd1e1",
    "#a4de6c",
  ];

  if (data.length === 0) return null;

  return (
    <div className="w-full h-[400px] bg-slate-900/50 rounded-xl border border-slate-700 p-4">
      <h3 className="text-lg font-semibold text-slate-200 mb-4 ml-2">
        Deck Metagame
      </h3>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
            outerRadius={120}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "#0f172a",
              borderColor: "#334155",
              color: "#f1f5f9",
              borderRadius: "8px",
            }}
            itemStyle={{ color: "#fff" }}
          />
          <Legend layout="vertical" align="right" verticalAlign="middle" />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
