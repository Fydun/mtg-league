import { useState, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useData } from "../contexts/DataContext";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  ScatterChart,
  Scatter,
  ZAxis,
  Legend,
} from "recharts";

const CHART_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#f97316",
  "#14b8a6",
  "#a855f7",
  "#6366f1",
  "#84cc16",
  "#e11d48",
  "#0ea5e9",
  "#d946ef",
  "#facc15",
];

const DARK_TOOLTIP = {
  contentStyle: {
    backgroundColor: "#0f172a",
    borderColor: "#334155",
    color: "#f1f5f9",
    borderRadius: "8px",
    fontSize: "12px",
  },
  itemStyle: { color: "#e2e8f0" },
};

export default function DeckStats() {
  const { data, loading, error } = useData();
  const [searchParams, setSearchParams] = useSearchParams();

  const selectedDeck = searchParams.get("deck") || null;
  const [leagueFilter, setLeagueFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("count"); // count | winRate | avgRank | matches

  // Map tournamentId -> league info
  const tournamentLeagueMap = useMemo(() => {
    const map = {};
    if (data && data.leagues) {
      const allTime = data.leagues.find((l) => l.id === "all-time");
      if (allTime) {
        allTime.tournaments.forEach(
          (tId) => (map[tId] = { id: "all-time", name: "Non-League Games" }),
        );
      }
      data.leagues.forEach((l) => {
        if (l.id !== "all-time") {
          l.tournaments.forEach((tId) => (map[tId] = { id: l.id, name: l.name }));
        }
      });
    }
    return map;
  }, [data]);

  const availableLeagues = useMemo(() => {
    if (!data || !data.leagues) return [];
    return data.leagues
      .filter((l) => l.id !== "all-time")
      .map((l) => ({ id: l.id, name: l.name }));
  }, [data]);

  const isUnknownDeck = (deck) => {
    if (!deck) return true;
    const n = String(deck).trim().toLowerCase();
    return n === "" || n === "unknown";
  };

  // Aggregate all deck stats across tournaments
  const deckData = useMemo(() => {
    if (!data || !data.tournaments) return { decks: {}, totalEntries: 0 };

    const decks = {};
    let totalEntries = 0;

    Object.values(data.tournaments).forEach((t) => {
      const leagueInfo = tournamentLeagueMap[t.id];
      if (
        leagueFilter !== "All" &&
        (!leagueInfo || leagueInfo.name !== leagueFilter)
      )
        return;

      if (!t.standings) return;

      t.standings.forEach((p) => {
        if (isUnknownDeck(p.deck)) return;

        const deckName = p.deck.trim();
        totalEntries++;

        if (!decks[deckName]) {
          decks[deckName] = {
            name: deckName,
            count: 0,
            wins: 0,
            losses: 0,
            draws: 0,
            matches: 0,
            ranks: [],
            players: new Set(),
            tournaments: [],
            top4: 0,
            undefeated: 0,
          };
        }

        const dk = decks[deckName];
        dk.count++;
        dk.wins += p.wins;
        dk.losses += p.losses;
        dk.draws += p.draws;
        dk.matches += p.wins + p.losses + p.draws;
        dk.ranks.push(p.rank);
        dk.players.add(p.name);
        dk.tournaments.push({
          id: t.id,
          name: t.name,
          date: t.date,
          player: p.name,
          record: p.record,
          rank: p.rank,
          wins: p.wins,
          losses: p.losses,
          draws: p.draws,
          points: p.points,
          league: leagueInfo?.name || "Unknown",
        });
        if (p.rank <= 4) dk.top4++;
        if (p.losses === 0 && p.draws === 0 && p.wins > 0) dk.undefeated++;
      });
    });

    return { decks, totalEntries };
  }, [data, tournamentLeagueMap, leagueFilter]);

  const deckList = useMemo(() => {
    const arr = Object.values(deckData.decks).map((dk) => {
      const winRate =
        dk.matches > 0 ? ((dk.wins / dk.matches) * 100).toFixed(1) : "0.0";
      const avgRank =
        dk.ranks.length > 0
          ? (dk.ranks.reduce((a, b) => a + b, 0) / dk.ranks.length).toFixed(1)
          : "-";
      const bestFinish = dk.ranks.length > 0 ? Math.min(...dk.ranks) : "-";

      return {
        ...dk,
        winRate,
        avgRank,
        bestFinish,
        playerCount: dk.players.size,
        players: dk.players,
        metaShare:
          deckData.totalEntries > 0
            ? ((dk.count / deckData.totalEntries) * 100).toFixed(1)
            : "0.0",
      };
    });

    // Filter by search
    const filtered = search
      ? arr.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()))
      : arr;

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "winRate":
          return parseFloat(b.winRate) - parseFloat(a.winRate);
        case "avgRank":
          if (a.avgRank === "-") return 1;
          if (b.avgRank === "-") return -1;
          return parseFloat(a.avgRank) - parseFloat(b.avgRank);
        case "matches":
          return b.matches - a.matches;
        case "count":
        default:
          return b.count - a.count;
      }
    });

    return filtered;
  }, [deckData, search, sortBy]);

  // Selected deck detail
  const selectedDeckData = useMemo(() => {
    if (!selectedDeck || !deckData.decks[selectedDeck]) return null;
    const dk = deckData.decks[selectedDeck];
    const winRate =
      dk.matches > 0 ? ((dk.wins / dk.matches) * 100).toFixed(1) : "0.0";
    const avgRank =
      dk.ranks.length > 0
        ? (dk.ranks.reduce((a, b) => a + b, 0) / dk.ranks.length).toFixed(1)
        : "-";
    const bestFinish = dk.ranks.length > 0 ? Math.min(...dk.ranks) : "-";
    const worstFinish = dk.ranks.length > 0 ? Math.max(...dk.ranks) : "-";

    // Unique pilots sorted by appearances
    const pilotMap = {};
    dk.tournaments.forEach((t) => {
      if (!pilotMap[t.player])
        pilotMap[t.player] = { wins: 0, losses: 0, draws: 0, count: 0 };
      const pl = pilotMap[t.player];
      pl.count++;
      pl.wins += t.wins;
      pl.losses += t.losses;
      pl.draws += t.draws;
    });
    const pilots = Object.entries(pilotMap)
      .map(([name, s]) => ({
        name,
        ...s,
        matches: s.wins + s.losses + s.draws,
        winRate:
          s.wins + s.losses + s.draws > 0
            ? ((s.wins / (s.wins + s.losses + s.draws)) * 100).toFixed(1)
            : "0.0",
      }))
      .sort((a, b) => b.count - a.count);

    const sortedTournaments = [...dk.tournaments].sort(
      (a, b) => new Date(b.date) - new Date(a.date),
    );

    return {
      name: dk.name,
      count: dk.count,
      wins: dk.wins,
      losses: dk.losses,
      draws: dk.draws,
      matches: dk.matches,
      winRate,
      avgRank,
      bestFinish,
      worstFinish,
      top4: dk.top4,
      undefeated: dk.undefeated,
      playerCount: dk.players.size,
      pilots,
      tournaments: sortedTournaments,
      metaShare:
        deckData.totalEntries > 0
          ? ((dk.count / deckData.totalEntries) * 100).toFixed(1)
          : "0.0",
    };
  }, [selectedDeck, deckData]);

  // General meta stats
  const metaStats = useMemo(() => {
    const totalDecks = Object.keys(deckData.decks).length;
    const totalEntries = deckData.totalEntries;
    const totalMatches = Object.values(deckData.decks).reduce(
      (s, d) => s + d.matches,
      0,
    );
    const allPlayers = new Set();
    Object.values(deckData.decks).forEach((d) =>
      d.players.forEach((p) => allPlayers.add(p)),
    );

    return { totalDecks, totalEntries, totalMatches, totalPlayers: allPlayers.size };
  }, [deckData]);

  // --- Chart data for main listing ---
  const metaPieData = useMemo(() => {
    const sorted = [...deckList].sort((a, b) => b.count - a.count);
    const top = sorted.slice(0, 12);
    const othersCount = sorted.slice(12).reduce((s, d) => s + d.count, 0);
    const result = top.map((d) => ({ name: d.name, value: d.count }));
    if (othersCount > 0) result.push({ name: "Others", value: othersCount });
    return result;
  }, [deckList]);

  const winRateBarData = useMemo(() => {
    return [...deckList]
      .filter((d) => d.matches >= 8)
      .sort((a, b) => parseFloat(b.winRate) - parseFloat(a.winRate))
      .slice(0, 15)
      .map((d) => ({
        name: d.name.length > 18 ? d.name.slice(0, 16) + "…" : d.name,
        fullName: d.name,
        winRate: parseFloat(d.winRate),
        matches: d.matches,
      }));
  }, [deckList]);

  const popularityOverTimeData = useMemo(() => {
    if (!data || !data.tournaments) return [];
    const tourns = Object.values(data.tournaments)
      .filter((t) => {
        if (leagueFilter === "All") return true;
        const li = tournamentLeagueMap[t.id];
        return li && li.name === leagueFilter;
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    const topDecks = [...deckList]
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
      .map((d) => d.name);

    return tourns.map((t) => {
      const point = { name: t.name.replace(/^Week\s*/, "W") };
      const total = (t.standings || []).filter(
        (p) => !isUnknownDeck(p.deck),
      ).length;
      topDecks.forEach((deck) => {
        const cnt = (t.standings || []).filter(
          (p) => p.deck && p.deck.trim() === deck,
        ).length;
        point[deck] = total > 0 ? parseFloat(((cnt / total) * 100).toFixed(1)) : 0;
      });
      return point;
    });
  }, [data, deckList, leagueFilter, tournamentLeagueMap]);

  const popularityTopDecks = useMemo(() => {
    return [...deckList]
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
      .map((d) => d.name);
  }, [deckList]);

  const winRateVsPopData = useMemo(() => {
    return deckList
      .filter((d) => d.matches >= 4)
      .map((d) => ({
        name: d.name,
        x: d.count,
        y: parseFloat(d.winRate),
        z: d.matches,
      }));
  }, [deckList]);

  // --- Chart data for deck detail ---
  const detailPerformanceOverTime = useMemo(() => {
    if (!selectedDeckData) return [];
    const byDate = {};
    selectedDeckData.tournaments.forEach((t) => {
      const key = t.date;
      if (!byDate[key]) byDate[key] = { wins: 0, losses: 0, draws: 0, entries: 0, ranks: [] };
      byDate[key].wins += t.wins;
      byDate[key].losses += t.losses;
      byDate[key].draws += t.draws;
      byDate[key].entries++;
      byDate[key].ranks.push(t.rank);
    });
    return Object.entries(byDate)
      .sort(([a], [b]) => new Date(a) - new Date(b))
      .map(([date, s]) => ({
        date,
        winRate: s.wins + s.losses + s.draws > 0
          ? parseFloat(((s.wins / (s.wins + s.losses + s.draws)) * 100).toFixed(1))
          : 0,
        avgRank: parseFloat((s.ranks.reduce((a, b) => a + b, 0) / s.ranks.length).toFixed(1)),
        entries: s.entries,
      }));
  }, [selectedDeckData]);

  const detailRankDistribution = useMemo(() => {
    if (!selectedDeckData) return [];
    const counts = {};
    selectedDeckData.tournaments.forEach((t) => {
      counts[t.rank] = (counts[t.rank] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([rank, count]) => ({ rank: `#${rank}`, value: count, numRank: parseInt(rank) }))
      .sort((a, b) => a.numRank - b.numRank);
  }, [selectedDeckData]);

  const detailPilotPieData = useMemo(() => {
    if (!selectedDeckData) return [];
    const top = selectedDeckData.pilots.slice(0, 10);
    const othersCount = selectedDeckData.pilots.slice(10).reduce((s, p) => s + p.count, 0);
    const result = top.map((p) => ({ name: p.name, value: p.count }));
    if (othersCount > 0) result.push({ name: "Others", value: othersCount });
    return result;
  }, [selectedDeckData]);

  const detailRecordPieData = useMemo(() => {
    if (!selectedDeckData) return [];
    return [
      { name: "Wins", value: selectedDeckData.wins },
      { name: "Losses", value: selectedDeckData.losses },
      { name: "Draws", value: selectedDeckData.draws },
    ].filter((d) => d.value > 0);
  }, [selectedDeckData]);

  const RECORD_COLORS = ["#10b981", "#ef4444", "#64748b"];

  if (loading)
    return (
      <div className="p-8 text-slate-400 animate-pulse text-center">
        Loading deck stats...
      </div>
    );
  if (error)
    return <div className="p-8 text-red-500 text-center">Error: {error}</div>;
  if (!data)
    return (
      <div className="p-8 text-slate-400 text-center">
        No data found.
      </div>
    );

  // Detail view for a specific deck
  if (selectedDeckData) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-4xl font-bold text-white mb-1">
              {selectedDeckData.name}
            </h1>
            <p className="text-slate-400">
              {selectedDeckData.metaShare}% of meta &middot;{" "}
              {selectedDeckData.playerCount} pilot
              {selectedDeckData.playerCount !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={() => setSearchParams({})}
            className="text-blue-400 hover:text-blue-300 text-sm font-medium"
          >
            &larr; Back to All Decks
          </button>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
            <div className="text-xs text-slate-400 uppercase tracking-wide">
              Entries
            </div>
            <div className="text-2xl font-bold text-white mt-1">
              {selectedDeckData.count}
            </div>
          </div>
          <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
            <div className="text-xs text-slate-400 uppercase tracking-wide">
              Match Win Rate
            </div>
            <div
              className={`text-2xl font-bold mt-1 ${
                parseFloat(selectedDeckData.winRate) >= 55
                  ? "text-green-400"
                  : parseFloat(selectedDeckData.winRate) >= 50
                    ? "text-blue-400"
                    : "text-slate-200"
              }`}
            >
              {selectedDeckData.winRate}%
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {selectedDeckData.wins}W-{selectedDeckData.losses}L-
              {selectedDeckData.draws}D
            </div>
          </div>
          <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
            <div className="text-xs text-slate-400 uppercase tracking-wide">
              Avg Finish
            </div>
            <div className="text-2xl font-bold text-slate-200 mt-1">
              #{selectedDeckData.avgRank}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Best: #{selectedDeckData.bestFinish} &middot; Worst: #
              {selectedDeckData.worstFinish}
            </div>
          </div>
          <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
            <div className="text-xs text-slate-400 uppercase tracking-wide">
              Top 4 / Undefeated
            </div>
            <div className="text-2xl font-bold text-purple-400 mt-1">
              {selectedDeckData.top4}{" "}
              <span className="text-sm text-slate-400 font-normal">/ {selectedDeckData.undefeated}</span>
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Top 4 rate:{" "}
              {selectedDeckData.count > 0
                ? (
                    (selectedDeckData.top4 / selectedDeckData.count) *
                    100
                  ).toFixed(0)
                : 0}
              %
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Win Rate Over Time */}
          {detailPerformanceOverTime.length > 1 && (
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-slate-200 mb-3">
                Win Rate Over Time
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={detailPerformanceOverTime}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis
                    dataKey="date"
                    stroke="#94a3b8"
                    tick={{ fontSize: 10 }}
                    angle={-30}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    tick={{ fontSize: 11 }}
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    {...DARK_TOOLTIP}
                    formatter={(v, name) =>
                      name === "winRate" ? [`${v}%`, "Win Rate"] : [v, name]
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="winRate"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ fill: "#10b981", r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Avg Finish Over Time */}
          {detailPerformanceOverTime.length > 1 && (
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-slate-200 mb-3">
                Average Finish Over Time
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={detailPerformanceOverTime}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis
                    dataKey="date"
                    stroke="#94a3b8"
                    tick={{ fontSize: 10 }}
                    angle={-30}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    tick={{ fontSize: 11 }}
                    reversed
                    tickFormatter={(v) => `#${v}`}
                  />
                  <Tooltip
                    {...DARK_TOOLTIP}
                    formatter={(v) => [`#${v}`, "Avg Finish"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="avgRank"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ fill: "#3b82f6", r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Finish Distribution */}
          {detailRankDistribution.length > 0 && (
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-slate-200 mb-3">
                Finish Distribution
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={detailRankDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="rank" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip {...DARK_TOOLTIP} />
                  <Bar dataKey="value" name="Count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Record Breakdown + Pilot Share */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
            <div className="grid grid-cols-2 gap-4 h-full">
              <div>
                <h3 className="text-sm font-semibold text-slate-200 mb-3">
                  Match Record
                </h3>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={detailRecordPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      dataKey="value"
                      label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                    >
                      {detailRecordPieData.map((_, i) => (
                        <Cell key={i} fill={RECORD_COLORS[i]} />
                      ))}
                    </Pie>
                    <Tooltip {...DARK_TOOLTIP} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-200 mb-3">
                  Pilot Share
                </h3>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={detailPilotPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      dataKey="value"
                      label={({ name, percent }) =>
                        percent >= 0.05 ? name : ""
                      }
                    >
                      {detailPilotPieData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip {...DARK_TOOLTIP} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* Two-column: Pilots + Tournament Results */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Pilots */}
          <div className="lg:col-span-1">
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
              <div className="p-4 border-b border-slate-700 bg-slate-900/50">
                <h3 className="font-semibold text-white">
                  Pilots ({selectedDeckData.pilots.length})
                </h3>
              </div>
              <div className="divide-y divide-slate-700/50 max-h-[600px] overflow-y-auto">
                {selectedDeckData.pilots.map((p) => (
                  <div
                    key={p.name}
                    className="p-3 hover:bg-slate-700/30 transition-colors"
                  >
                    <div className="flex justify-between items-center">
                      <Link
                        to={`/player/${encodeURIComponent(p.name)}`}
                        className="font-medium text-slate-200 hover:text-blue-400 transition-colors truncate"
                      >
                        {p.name}
                      </Link>
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-300 shrink-0 ml-2">
                        {p.count}×
                      </span>
                    </div>
                    <div className="flex justify-between mt-1 text-xs text-slate-500">
                      <span>
                        {p.wins}W-{p.losses}L-{p.draws}D
                      </span>
                      <span
                        className={`font-bold ${
                          parseFloat(p.winRate) >= 50
                            ? "text-green-400"
                            : "text-slate-400"
                        }`}
                      >
                        {p.winRate}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Tournament Results */}
          <div className="lg:col-span-2">
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
              <div className="p-4 border-b border-slate-700 bg-slate-900/50">
                <h3 className="font-semibold text-white">
                  All Results ({selectedDeckData.tournaments.length})
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-slate-300">
                  <thead className="text-xs uppercase bg-slate-800/80 text-slate-400">
                    <tr>
                      <th className="px-5 py-3">Date</th>
                      <th className="px-5 py-3">Tournament</th>
                      <th className="px-5 py-3">Player</th>
                      <th className="px-4 py-3 text-center">Record</th>
                      <th className="px-4 py-3 text-center">Rank</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {selectedDeckData.tournaments.map((t, idx) => (
                      <tr
                        key={`${t.id}-${t.player}-${idx}`}
                        className="hover:bg-slate-700/30 transition-colors"
                      >
                        <td className="px-5 py-3 whitespace-nowrap text-slate-400 font-mono text-xs">
                          {t.date}
                        </td>
                        <td className="px-5 py-3">
                          <Link
                            to={`/tournament/${t.id}`}
                            className="text-white hover:text-blue-400 transition-colors"
                          >
                            {t.name}
                          </Link>
                          <div className="text-[10px] uppercase tracking-wide text-slate-500">
                            {t.league}
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <Link
                            to={`/player/${encodeURIComponent(t.player)}`}
                            className="text-slate-200 hover:text-blue-400 transition-colors"
                          >
                            {t.player}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-bold ${
                              t.points >= 9
                                ? "bg-green-500/20 text-green-400"
                                : "bg-slate-700 text-slate-400"
                            }`}
                          >
                            {t.record}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-slate-500">
                          #{t.rank}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main listing view
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-bold text-white mb-1">Deck Stats</h1>
          <p className="text-slate-400">
            Global deck performance across all tournaments
          </p>
        </div>
        <Link
          to="/"
          className="text-blue-400 hover:text-blue-300 text-sm font-medium"
        >
          &larr; Back to Dashboard
        </Link>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
          <div className="text-xs text-slate-400 uppercase tracking-wide">
            Unique Decks
          </div>
          <div className="text-2xl font-bold text-white mt-1">
            {metaStats.totalDecks}
          </div>
        </div>
        <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
          <div className="text-xs text-slate-400 uppercase tracking-wide">
            Deck Entries
          </div>
          <div className="text-2xl font-bold text-white mt-1">
            {metaStats.totalEntries}
          </div>
        </div>
        <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
          <div className="text-xs text-slate-400 uppercase tracking-wide">
            Total Matches
          </div>
          <div className="text-2xl font-bold text-white mt-1">
            {metaStats.totalMatches}
          </div>
        </div>
        <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
          <div className="text-xs text-slate-400 uppercase tracking-wide">
            Players
          </div>
          <div className="text-2xl font-bold text-white mt-1">
            {metaStats.totalPlayers}
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Meta Pie Chart */}
        {metaPieData.length > 0 && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
            <h3 className="text-sm font-semibold text-slate-200 mb-3">
              Metagame Share
            </h3>
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={metaPieData}
                  cx="50%"
                  cy="50%"
                  outerRadius={110}
                  dataKey="value"
                  label={({ name, percent }) =>
                    percent >= 0.03
                      ? `${name.length > 15 ? name.slice(0, 13) + "…" : name}`
                      : ""
                  }
                  labelLine={false}
                >
                  {metaPieData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  {...DARK_TOOLTIP}
                  formatter={(value, name) => {
                    const total = metaPieData.reduce((s, d) => s + d.value, 0);
                    return [`${value} entries (${((value / total) * 100).toFixed(1)}%)`, name];
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Win Rate Bar Chart */}
        {winRateBarData.length > 0 && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
            <h3 className="text-sm font-semibold text-slate-200 mb-3">
              Win Rate by Deck
              <span className="text-xs text-slate-500 ml-2 font-normal">
                (min 8 matches)
              </span>
            </h3>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={winRateBarData} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  stroke="#94a3b8"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `${v}%`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="#94a3b8"
                  tick={{ fontSize: 10 }}
                  width={120}
                />
                <Tooltip
                  {...DARK_TOOLTIP}
                  formatter={(v, name, props) => [
                    `${v}% (${props.payload.matches} games)`,
                    props.payload.fullName,
                  ]}
                />
                <Bar dataKey="winRate" name="Win Rate" radius={[0, 4, 4, 0]}>
                  {winRateBarData.map((d, i) => (
                    <Cell
                      key={i}
                      fill={
                        d.winRate >= 55
                          ? "#10b981"
                          : d.winRate >= 50
                            ? "#3b82f6"
                            : "#64748b"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Popularity Over Time */}
        {popularityOverTimeData.length > 1 && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 md:col-span-2">
            <h3 className="text-sm font-semibold text-slate-200 mb-3">
              Deck Popularity Over Time
              <span className="text-xs text-slate-500 ml-2 font-normal">
                (top 8 decks, % of field)
              </span>
            </h3>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={popularityOverTimeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="name"
                  stroke="#94a3b8"
                  tick={{ fontSize: 10 }}
                  interval={Math.max(0, Math.floor(popularityOverTimeData.length / 12))}
                />
                <YAxis
                  stroke="#94a3b8"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  {...DARK_TOOLTIP}
                  formatter={(v, name) => [`${v}%`, name]}
                />
                <Legend
                  wrapperStyle={{ fontSize: "11px", color: "#94a3b8" }}
                />
                {popularityTopDecks.map((deck, i) => (
                  <Line
                    key={deck}
                    type="monotone"
                    dataKey={deck}
                    stroke={CHART_COLORS[i % CHART_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Win Rate vs Popularity Scatter */}
        {winRateVsPopData.length > 3 && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 md:col-span-2">
            <h3 className="text-sm font-semibold text-slate-200 mb-3">
              Win Rate vs Popularity
              <span className="text-xs text-slate-500 ml-2 font-normal">
                (bubble size = total matches, min 4 matches)
              </span>
            </h3>
            <ResponsiveContainer width="100%" height={350}>
              <ScatterChart margin={{ bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  type="number"
                  dataKey="x"
                  name="Entries"
                  stroke="#94a3b8"
                  tick={{ fontSize: 11 }}
                  label={{
                    value: "Tournament Entries",
                    position: "insideBottom",
                    offset: -5,
                    style: { fill: "#64748b", fontSize: 11 },
                  }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name="Win Rate"
                  stroke="#94a3b8"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `${v}%`}
                  domain={["auto", "auto"]}
                />
                <ZAxis type="number" dataKey="z" range={[40, 400]} />
                <Tooltip
                  {...DARK_TOOLTIP}
                  formatter={(v, name) => {
                    if (name === "Entries") return [v, "Entries"];
                    if (name === "Win Rate") return [`${v}%`, "Win Rate"];
                    return [v, name];
                  }}
                  labelFormatter={(_, payload) =>
                    payload?.[0]?.payload?.name || ""
                  }
                />
                <Scatter
                  data={winRateVsPopData}
                  fill="#8b5cf6"
                  fillOpacity={0.7}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Filters & Sort */}
      <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 flex flex-wrap gap-4 items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search decks…"
          className="bg-slate-900 text-white text-sm rounded-lg px-3 py-2 border border-slate-700 focus:outline-none focus:border-blue-500 min-w-[200px]"
        />

        <select
          value={leagueFilter}
          onChange={(e) => setLeagueFilter(e.target.value)}
          className="bg-slate-900 text-white text-sm rounded-lg px-3 py-2 border border-slate-700 focus:outline-none focus:border-blue-500"
        >
          <option value="All">All Leagues</option>
          {availableLeagues.map((l) => (
            <option key={l.id} value={l.name}>
              {l.name}
            </option>
          ))}
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="bg-slate-900 text-white text-sm rounded-lg px-3 py-2 border border-slate-700 focus:outline-none focus:border-blue-500"
        >
          <option value="count">Sort: Popularity</option>
          <option value="winRate">Sort: Win Rate</option>
          <option value="avgRank">Sort: Avg Finish</option>
          <option value="matches">Sort: Total Matches</option>
        </select>

        <span className="text-slate-500 text-sm ml-auto">
          {deckList.length} deck{deckList.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Deck Table */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-300">
            <thead className="text-xs uppercase bg-slate-900/80 text-slate-400">
              <tr>
                <th className="px-5 py-3">Deck</th>
                <th className="px-4 py-3 text-center">Entries</th>
                <th className="px-4 py-3 text-center">Pilots</th>
                <th className="px-4 py-3 text-center">Meta %</th>
                <th className="px-4 py-3 text-center">Record</th>
                <th className="px-4 py-3 text-center">Win Rate</th>
                <th className="px-4 py-3 text-center">Avg Rank</th>
                <th className="px-4 py-3 text-center">Best</th>
                <th className="px-4 py-3 text-center">Top 4</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {deckList.map((d) => (
                <tr
                  key={d.name}
                  onClick={() => setSearchParams({ deck: d.name })}
                  className="hover:bg-slate-700/30 transition-colors cursor-pointer"
                >
                  <td className="px-5 py-4 font-medium text-white">
                    {d.name}
                  </td>
                  <td className="px-4 py-4 text-center text-slate-400">
                    {d.count}
                  </td>
                  <td className="px-4 py-4 text-center text-slate-400">
                    {d.playerCount}
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="text-purple-400 font-medium">
                      {d.metaShare}%
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="text-green-400">{d.wins}</span>-
                    <span className="text-red-400">{d.losses}</span>-
                    <span className="text-slate-500">{d.draws}</span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span
                      className={`font-bold ${
                        parseFloat(d.winRate) >= 55
                          ? "text-green-400"
                          : parseFloat(d.winRate) >= 50
                            ? "text-blue-400"
                            : "text-slate-400"
                      }`}
                    >
                      {d.winRate}%
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center text-slate-300">
                    {d.avgRank}
                  </td>
                  <td className="px-4 py-4 text-center text-green-400">
                    #{d.bestFinish}
                  </td>
                  <td className="px-4 py-4 text-center text-slate-400">
                    {d.top4}
                  </td>
                </tr>
              ))}
              {deckList.length === 0 && (
                <tr>
                  <td
                    colSpan="9"
                    className="px-6 py-12 text-center text-slate-500"
                  >
                    No decks found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
