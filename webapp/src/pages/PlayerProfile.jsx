import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useData } from "../contexts/DataContext";

export default function PlayerProfile() {
  const { playerName } = useParams();
  const decodedName = decodeURIComponent(playerName);
  const { data, loading, error } = useData();

  // Filters
  const [deckFilter, setDeckFilter] = useState("All");
  const [leagueFilter, setLeagueFilter] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  if (loading)
    return (
      <div className="p-8 text-slate-400 animate-pulse text-center">
        Loading profile...
      </div>
    );
  if (error)
    return <div className="p-8 text-red-500 text-center">Error: {error}</div>;
  if (!data)
    return (
      <div className="p-8 text-slate-400 text-center">
        League data not found.
      </div>
    );

  // --- 1. Helpers & Maps ---
  // Map tournamentId -> League Name for display (prioritizing specific leagues)
  const tournamentLeagueMap = useMemo(() => {
    const map = {};
    if (data.leagues) {
      // Process All-Time first (by reversing), so specific leagues overwrite it
      [...data.leagues].reverse().forEach((l) => {
        l.tournaments.forEach((tId) => (map[tId] = l.name));
      });
    }
    return map;
  }, [data]);

  const allLeagues = useMemo(() => {
    if (!data.leagues) return [];
    return data.leagues.map((l) => l.name).sort();
  }, [data]);

  // --- 2. Filter Tournaments (The Source of Truth) ---
  const filteredTournaments = useMemo(() => {
    let tours = Object.values(data.tournaments).sort(
      (a, b) => new Date(b.date) - new Date(a.date),
    );

    // Find the selected league object for precise filtering
    const selectedLeague =
      leagueFilter !== "All"
        ? data.leagues.find((l) => l.name === leagueFilter)
        : null;

    return tours.filter((t) => {
      const tDate = new Date(t.date);

      // Player must be in this tournament
      const playerInTournament = t.standings.some(
        (p) => p.name === decodedName,
      );
      if (!playerInTournament) return false;

      // Apply Global Filters
      if (selectedLeague && !selectedLeague.tournaments.includes(t.id))
        return false;
      if (dateFrom && tDate < new Date(dateFrom)) return false;
      if (dateTo && tDate > new Date(dateTo)) return false;

      return true;
    });
  }, [data, decodedName, leagueFilter, dateFrom, dateTo]);

  // --- 3. Aggregate Stats from Filtered Tournaments ---
  const playerStats = useMemo(() => {
    const stats = {
      totalTournaments: 0,
      totalMatches: 0,
      totalWins: 0,
      totalLosses: 0,
      totalDraws: 0,
      decks: {},
      history: [],
      activeLeagues: new Set(),
    };

    filteredTournaments.forEach((t) => {
      const playerEntry = t.standings.find((p) => p.name === decodedName);
      if (!playerEntry) return;

      stats.totalTournaments++;
      stats.totalWins += playerEntry.wins;
      stats.totalLosses += playerEntry.losses;
      stats.totalDraws += playerEntry.draws;
      stats.totalMatches +=
        playerEntry.wins + playerEntry.losses + playerEntry.draws;

      const leagueName = tournamentLeagueMap[t.id];
      if (leagueName) stats.activeLeagues.add(leagueName);

      // Deck Stats
      const deckName = playerEntry.deck || "Unknown";
      if (!stats.decks[deckName]) {
        stats.decks[deckName] = { count: 0, wins: 0, matches: 0 };
      }
      stats.decks[deckName].count++;
      stats.decks[deckName].wins += playerEntry.wins;
      stats.decks[deckName].matches +=
        playerEntry.wins + playerEntry.losses + playerEntry.draws;

      // History Entry
      stats.history.push({
        id: t.id,
        date: t.date,
        name: t.name,
        league: leagueName,
        deck: deckName,
        record: playerEntry.record,
        rank: playerEntry.rank,
        points: playerEntry.points,
        winRate:
          playerEntry.wins + playerEntry.losses + playerEntry.draws > 0
            ? (
                (playerEntry.wins /
                  (playerEntry.wins + playerEntry.losses + playerEntry.draws)) *
                100
              ).toFixed(1)
            : "0.0",
      });
    });

    return stats;
  }, [filteredTournaments, decodedName, tournamentLeagueMap]);

  const overallWinRate =
    playerStats.totalMatches > 0
      ? ((playerStats.totalWins / playerStats.totalMatches) * 100).toFixed(1)
      : "0.0";

  // --- 4. Deck Filter (for the history list only) ---
  const displayedHistory = playerStats.history.filter(
    (h) => deckFilter === "All" || h.deck === deckFilter,
  );

  // Top Decks List
  const deckList = Object.entries(playerStats.decks)
    .map(([name, s]) => ({
      name,
      count: s.count,
      winRate: s.matches > 0 ? ((s.wins / s.matches) * 100).toFixed(1) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header & Controls */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-4xl font-bold text-white mb-1">
              {decodedName}
            </h1>
            {/* Leagues Display - now based on filter or all */}
            <p className="text-slate-400 text-sm">
              {playerStats.activeLeagues.size > 0
                ? Array.from(playerStats.activeLeagues).join(" • ")
                : "No active leagues in selection"}
            </p>
          </div>
          <Link
            to="/"
            className="text-blue-400 hover:text-blue-300 text-sm font-medium"
          >
            &larr; Back to Dashboard
          </Link>
        </div>

        {/* Global Filters */}
        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 flex flex-wrap gap-4 items-center">
          <span className="text-slate-400 text-sm font-medium uppercase tracking-wider mr-2">
            Filters:
          </span>

          {/* League Select */}
          <select
            value={leagueFilter}
            onChange={(e) => setLeagueFilter(e.target.value)}
            className="bg-slate-900 text-white text-sm rounded-lg px-3 py-2 border border-slate-700 focus:outline-none focus:border-blue-500 min-w-[150px]"
          >
            <option value="All">All Leagues</option>
            {allLeagues.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>

          {/* Date From */}
          <div className="flex items-center gap-2">
            <span className="text-slate-500 text-xs uppercase">From</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-slate-900 text-white text-sm rounded-lg px-3 py-2 border border-slate-700 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Date To */}
          <div className="flex items-center gap-2">
            <span className="text-slate-500 text-xs uppercase">To</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-slate-900 text-white text-sm rounded-lg px-3 py-2 border border-slate-700 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Clear Filters */}
          {(leagueFilter !== "All" || dateFrom || dateTo) && (
            <button
              onClick={() => {
                setLeagueFilter("All");
                setDateFrom("");
                setDateTo("");
              }}
              className="text-xs text-red-400 hover:text-red-300 ml-auto"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
          <div className="text-slate-400 text-sm font-medium uppercase tracking-wider">
            Tournaments
          </div>
          <div className="text-3xl font-bold text-white mt-2">
            {playerStats.totalTournaments}
          </div>
        </div>
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
          <div className="text-slate-400 text-sm font-medium uppercase tracking-wider">
            Matches
          </div>
          <div className="text-3xl font-bold text-white mt-2">
            {playerStats.totalMatches}
          </div>
        </div>
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
          <div className="text-slate-400 text-sm font-medium uppercase tracking-wider">
            Win Rate
          </div>
          <div
            className={`text-3xl font-bold mt-2 ${
              parseFloat(overallWinRate) >= 60
                ? "text-green-400"
                : parseFloat(overallWinRate) >= 50
                  ? "text-blue-400"
                  : "text-slate-200"
            }`}
          >
            {overallWinRate}%
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {playerStats.totalWins}W - {playerStats.totalLosses}L -{" "}
            {playerStats.totalDraws}D
          </div>
        </div>
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
          <div className="text-slate-400 text-sm font-medium uppercase tracking-wider">
            Favorite Deck
          </div>
          <div
            className="text-xl font-bold text-purple-400 mt-2 truncate"
            title={deckList[0]?.name}
          >
            {deckList[0]?.name || "-"}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {deckList[0] ? `Played ${deckList[0].count} times` : "No data"}
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Col: Deck Stats */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-700 bg-slate-900/50">
              <h3 className="font-semibold text-white">Deck Performance</h3>
            </div>
            <div className="divide-y divide-slate-700/50">
              {deckList.map((d) => (
                <div
                  key={d.name}
                  className="p-4 hover:bg-slate-700/30 transition-colors"
                >
                  <div className="flex justify-between items-center mb-1">
                    <span
                      className="font-medium text-slate-200 truncate pr-2"
                      title={d.name}
                    >
                      {d.name}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-300 shrink-0">
                      {d.count}
                    </span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2 mt-2">
                    <div
                      className={`h-2 rounded-full ${
                        parseFloat(d.winRate) >= 60
                          ? "bg-green-500"
                          : parseFloat(d.winRate) >= 50
                            ? "bg-blue-500"
                            : "bg-slate-500"
                      }`}
                      style={{ width: `${d.winRate}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between mt-1 text-xs text-slate-500">
                    <span>Win Rate</span>
                    <span>{d.winRate}%</span>
                  </div>
                </div>
              ))}
              {deckList.length === 0 && (
                <div className="p-8 text-center text-slate-500">
                  No deck data matching filters
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Col: Tournament History */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden min-h-[500px]">
            <div className="p-4 border-b border-slate-700 bg-slate-900/50 flex flex-wrap justify-between items-center gap-4">
              <h3 className="font-semibold text-white">History</h3>

              {/* Deck Filter (Local) */}
              <select
                value={deckFilter}
                onChange={(e) => setDeckFilter(e.target.value)}
                className="bg-slate-700 text-white text-sm rounded-lg px-3 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500 max-w-[200px]"
              >
                <option value="All">All Decks</option>
                {deckList.map((d) => (
                  <option key={d.name} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-slate-300">
                <thead className="text-xs uppercase bg-slate-800/80 text-slate-400">
                  <tr>
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3">Tournament</th>
                    <th className="px-6 py-3">Deck</th>
                    <th className="px-6 py-3 text-center">Rec.</th>
                    <th className="px-6 py-3 text-center">Rank</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {displayedHistory.map((h) => (
                    <tr
                      key={h.id}
                      className="hover:bg-slate-700/30 transition-colors group"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-slate-400 font-mono text-xs">
                        {h.date}
                      </td>
                      <td className="px-6 py-4">
                        <Link
                          to={`/tournament/${h.id}`}
                          className="text-white group-hover:text-blue-400 font-medium transition-colors block mb-0.5"
                        >
                          {h.name}
                        </Link>
                        {/* Show League Name in smaller text if 'All Leagues' looks busy, or just rely on the filter */}
                        {leagueFilter === "All" && (
                          <span className="text-[10px] uppercase tracking-wide text-slate-500">
                            {h.league || "Unknown"}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-300">{h.deck}</td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`px-2 py-1 rounded text-xs font-bold ${
                            h.points >= 9
                              ? "bg-green-500/20 text-green-400"
                              : "bg-slate-700 text-slate-400"
                          }`}
                        >
                          {h.record}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center font-bold text-slate-500 group-hover:text-white">
                        #{h.rank}
                      </td>
                    </tr>
                  ))}
                  {displayedHistory.length === 0 && (
                    <tr>
                      <td
                        colSpan="5"
                        className="px-6 py-12 text-center text-slate-500"
                      >
                        No tournaments found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
