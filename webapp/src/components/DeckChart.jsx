import { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const MAX_DECKS_SHOWN = 16; // <-- Change this number to show more/less decks

export default function DeckChart({ league, tournamentData }) {
  const { tournaments } = league;

  const data = useMemo(() => {
    const deckCounts = {};
    const FORCE_TO_OTHERS = ["XXXXX"]; // These decks always go into "Others"
    let forcedOthersCount = 0;

    // Iterate all tournaments in this league
    tournaments.forEach((tId) => {
      const t = tournamentData[tId];
      if (!t || !t.standings) return;

      t.standings.forEach((p) => {
        const deck = p.deck;
        if (deck) {
          // Normalize deck names roughly
          const name = deck.trim();

          // Count forced-to-others decks separately
          if (FORCE_TO_OTHERS.includes(name)) {
            forcedOthersCount++;
            return;
          }

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

    // Take top X and Group others (including forced ones)
    if (arr.length > MAX_DECKS_SHOWN || forcedOthersCount > 0) {
      const topDecks = arr.slice(0, MAX_DECKS_SHOWN);
      const othersFromOverflow = arr
        .slice(MAX_DECKS_SHOWN)
        .reduce((acc, curr) => acc + curr.value, 0);
      const totalOthers = othersFromOverflow + forcedOthersCount;
      if (totalOthers > 0) {
        topDecks.push({ name: "Others", value: totalOthers });
      }
      return topDecks;
    }

    return arr;
  }, [tournaments, tournamentData]);

  // Generate distinct colors dynamically using HSL
  const generateColors = (count) => {
    const colors = [];
    for (let i = 0; i < count; i++) {
      // Spread hues evenly around the color wheel (0-360)
      const hue = (i * 360) / count;
      // Use consistent saturation and lightness for vibrant but readable colors
      colors.push(`hsl(${hue}, 70%, 55%)`);
    }
    return colors;
  };

  const COLORS = generateColors(data.length);

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
            label={({ name, percent }) => (percent >= 0.025 ? name : "")}
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
            formatter={(value, name, props) => {
              const total = data.reduce((sum, d) => sum + d.value, 0);
              const percent = ((value / total) * 100).toFixed(0);
              return [`${name}: ${value} (${percent}%)`];
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
