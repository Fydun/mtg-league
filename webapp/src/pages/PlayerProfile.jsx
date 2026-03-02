import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useData } from "../contexts/DataContext";

export default function PlayerProfile() {
  const { playerName } = useParams();
  const decodedName = decodeURIComponent(playerName || "");
  const { data, loading, error } = useData();

  // Filters
  const [deckFilter, setDeckFilter] = useState("All");
  const [leagueFilter, setLeagueFilter] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Tabs
  const [activeTab, setActiveTab] = useState("history");

  // Matchup tab filters
  const [matchupOwnDeckFilter, setMatchupOwnDeckFilter] = useState("All");
  const [matchupOpponentDeckInput, setMatchupOpponentDeckInput] = useState("");
  const [matchupOpponentDeckTags, setMatchupOpponentDeckTags] = useState([]);

  const addMatchupDeckTag = (value) => {
    const tag = value.trim();
    if (!tag) return;

    setMatchupOpponentDeckTags((prev) => {
      const exists = prev.some((t) => t.toLowerCase() === tag.toLowerCase());
      if (exists) return prev;
      return [...prev, tag];
    });
    setMatchupOpponentDeckInput("");
  };

  const removeMatchupDeckTag = (tagToRemove) => {
    setMatchupOpponentDeckTags((prev) =>
      prev.filter((t) => t.toLowerCase() !== tagToRemove.toLowerCase()),
    );
  };

  // --- 1. Helpers & Maps ---
  // Map tournamentId -> League Name for display (prioritizing specific leagues)
  const tournamentLeagueMap = useMemo(() => {
    const map = {};
    if (data && data.leagues) {
      // Process "All-Time" first (as "Non-League Games"), so specific leagues overwrite it
      const allTime = data.leagues.find((l) => l.id === "all-time");
      if (allTime) {
        allTime.tournaments.forEach((tId) => (map[tId] = "Non-League Games"));
      }

      // Then process specific leagues
      data.leagues.forEach((l) => {
        if (l.id !== "all-time") {
          l.tournaments.forEach((tId) => (map[tId] = l.name));
        }
      });
    }
    return map;
  }, [data]);

  // --- 2. Filter Tournaments (The Source of Truth) ---
  const filteredTournaments = useMemo(() => {
    if (!data || !data.tournaments) return [];

    let tours = Object.values(data.tournaments).sort(
      (a, b) => new Date(b.date) - new Date(a.date),
    );

    return tours.filter((t) => {
      const tDate = new Date(t.date);
      const mappedLeagueName = tournamentLeagueMap[t.id];

      // Player must be in this tournament
      const playerInTournament = t.standings.some(
        (p) => p.name === decodedName,
      );
      if (!playerInTournament) return false;

      // Apply Global Filters (Logic Change: Filter by Mapped Name)
      if (leagueFilter !== "All" && mappedLeagueName !== leagueFilter)
        return false;
      if (dateFrom && tDate < new Date(dateFrom)) return false;
      if (dateTo && tDate > new Date(dateTo)) return false;

      return true;
    });
  }, [data, decodedName, leagueFilter, dateFrom, dateTo, tournamentLeagueMap]);

  // Derive Available Leagues (Dynamically based on player history)
  const availableLeagues = useMemo(() => {
    if (!data || !data.tournaments) return [];
    const leagues = new Set();
    Object.values(data.tournaments).forEach((t) => {
      if (t.standings.some((p) => p.name === decodedName)) {
        const lName = tournamentLeagueMap[t.id];
        if (lName) leagues.add(lName);
      }
    });

    return Array.from(leagues).sort((a, b) => {
      if (a === "Non-League Games") return 1;
      if (b === "Non-League Games") return -1;

      // Extract Year and Season
      const getYear = (s) => parseInt(s.match(/\d{4}/)?.[0] || "0");
      const getSeasonVal = (s) =>
        s.includes("Autumn") ? 2 : s.includes("Spring") ? 1 : 0;

      const yearA = getYear(a);
      const yearB = getYear(b);

      if (yearA !== yearB) return yearB - yearA; // Newest year first
      return getSeasonVal(b) - getSeasonVal(a); // Autumn before Spring (within same year)
    });
  }, [data, decodedName, tournamentLeagueMap]);

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
      matches: [], // Flattened match history
      headToHead: {}, // Opponent -> { wins, losses, draws, total }
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

      // --- Match History (Head-to-Head / Form) ---
      if (t.rounds) {
        const standingsDeckMap = new Map(
          t.standings.map((s) => [s.name, s.deck || "Unknown"]),
        );

        t.rounds.forEach((round) => {
          if (!round.matches) return;
          round.matches.forEach((m) => {
            let result = null; // W, L, D
            let opponent = null;

            if (m.p1 === decodedName) {
              opponent = m.p2;
              if (m.p1_wins > m.p2_wins) result = "W";
              else if (m.p1_wins < m.p2_wins) result = "L";
              else result = "D";
            } else if (m.p2 === decodedName) {
              opponent = m.p1;
              if (m.p2_wins > m.p1_wins) result = "W";
              else if (m.p2_wins < m.p1_wins) result = "L";
              else result = "D";
            }

            if (opponent && opponent !== "BYE") {
              // Add to H2H
              if (!stats.headToHead[opponent]) {
                stats.headToHead[opponent] = {
                  wins: 0,
                  losses: 0,
                  draws: 0,
                  total: 0,
                };
              }
              const h2h = stats.headToHead[opponent];
              h2h.total++;
              if (result === "W") h2h.wins++;
              else if (result === "L") h2h.losses++;
              else h2h.draws++;

              // Add to flattened matches (for Form)
              const matchDate = new Date(t.date);
              stats.matches.push({
                date: matchDate,
                result: result,
                opponent: opponent,
                tournamentId: t.id,
                tournamentName: t.name,
                ownDeck: deckName,
                opponentDeck: standingsDeckMap.get(opponent) || "Unknown",
              });
            }
          });
        });
      }
    });

    // Sort flattened matches by date descending (Newest first)
    // IMPORTANT: Since filteredTournaments is already sorted by date DESC,
    // and within tournaments matches are roughly chronological, we can just sort by date.
    stats.matches.sort((a, b) => b.date - a.date);

    return stats;
  }, [filteredTournaments, decodedName, tournamentLeagueMap]);

  const overallWinRate =
    playerStats.totalMatches > 0
      ? ((playerStats.totalWins / playerStats.totalMatches) * 100).toFixed(1)
      : "0.0";

  // Form: Last 5 matches

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

  // H2H Sorted List
  const h2hList = Object.entries(playerStats.headToHead)
    .map(([name, s]) => ({
      name,
      ...s,
      winRate: s.total > 0 ? ((s.wins / s.total) * 100).toFixed(1) : 0,
    }))
    .sort((a, b) => b.total - a.total); // Most played opponent first

  const matchupRows = useMemo(() => {
    const targetDeckTags = matchupOpponentDeckTags.map((t) => t.toLowerCase());

    return playerStats.matches.filter((m) => {
      const ownDeckMatches =
        matchupOwnDeckFilter === "All" || m.ownDeck === matchupOwnDeckFilter;
      if (!ownDeckMatches) return false;

      if (targetDeckTags.length === 0) return true;
      const opponentDeck = (m.opponentDeck || "").toLowerCase();
      return targetDeckTags.some((tag) => opponentDeck.includes(tag));
    });
  }, [playerStats.matches, matchupOpponentDeckTags, matchupOwnDeckFilter]);

  const matchupSummary = useMemo(() => {
    const summary = { wins: 0, losses: 0, draws: 0, total: 0 };

    matchupRows.forEach((m) => {
      summary.total++;
      if (m.result === "W") summary.wins++;
      else if (m.result === "L") summary.losses++;
      else summary.draws++;
    });

    return {
      ...summary,
      winRate:
        summary.total > 0
          ? ((summary.wins / summary.total) * 100).toFixed(1)
          : "0.0",
    };
  }, [matchupRows]);

  // --- CONDITIONAL RENDERS (Must be LAST) ---
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header & Controls */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-4xl font-bold text-white mb-1">
              {decodedName}
            </h1>
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
            {availableLeagues.map((l) => (
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
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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

      {/* Tabs */}
      <div className="border-b border-slate-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab("history")}
            className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "history"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-300"
            }`}
          >
            Tournament History
          </button>
          <button
            onClick={() => setActiveTab("h2h")}
            className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "h2h"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-300"
            }`}
          >
            Head-to-Head
          </button>
          <button
            onClick={() => setActiveTab("matchups")}
            className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "matchups"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-300"
            }`}
          >
            Deck Matchups
          </button>
        </nav>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Col: Deck Stats (Always Visible) */}
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

        {/* Right Col: Tab Content */}
        <div className="lg:col-span-2 space-y-4">
          {/* TAB: History */}
          {activeTab === "history" && (
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
          )}

          {/* TAB: Head-to-Head */}
          {activeTab === "h2h" && (
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden min-h-[500px]">
              <div className="p-4 border-b border-slate-700 bg-slate-900/50 flex flex-wrap justify-between items-center gap-4">
                <h3 className="font-semibold text-white">Head-to-Head Stats</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-slate-300">
                  <thead className="text-xs uppercase bg-slate-800/80 text-slate-400">
                    <tr>
                      <th className="px-6 py-3">Opponent</th>
                      <th className="px-6 py-3 text-center">Matches</th>
                      <th className="px-6 py-3 text-center">Wins</th>
                      <th className="px-6 py-3 text-center">Losses</th>
                      <th className="px-6 py-3 text-center">Draws</th>
                      <th className="px-6 py-3 text-right">Win Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {h2hList.length > 0 ? (
                      h2hList.map((opp) => (
                        <tr
                          key={opp.name}
                          className="hover:bg-slate-700/30 transition-colors"
                        >
                          <td className="px-6 py-4 font-medium text-white">
                            <Link
                              to={`/player/${encodeURIComponent(opp.name)}`}
                              className="hover:text-blue-400 transition-colors"
                            >
                              {opp.name}
                            </Link>
                          </td>
                          <td className="px-6 py-4 text-center text-slate-400">
                            {opp.total}
                          </td>
                          <td className="px-6 py-4 text-center text-green-400">
                            {opp.wins}
                          </td>
                          <td className="px-6 py-4 text-center text-red-400">
                            {opp.losses}
                          </td>
                          <td className="px-6 py-4 text-center text-slate-500">
                            {opp.draws}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span
                              className={`font-bold ${
                                parseFloat(opp.winRate) >= 50
                                  ? "text-green-400"
                                  : "text-slate-400"
                              }`}
                            >
                              {opp.winRate}%
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan="6"
                          className="px-6 py-12 text-center text-slate-500"
                        >
                          No matches played against specific opponents in this
                          selection.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: Deck Matchups */}
          {activeTab === "matchups" && (
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden min-h-[500px]">
              <div className="p-4 border-b border-slate-700 bg-slate-900/50 space-y-4">
                <h3 className="font-semibold text-white">Matchups vs Decks</h3>

                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs uppercase tracking-wide text-slate-400">
                      Your deck
                    </label>
                    <select
                      value={matchupOwnDeckFilter}
                      onChange={(e) => setMatchupOwnDeckFilter(e.target.value)}
                      className="bg-slate-700 text-white text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:border-blue-500 min-w-[220px]"
                    >
                      <option value="All">All Your Decks</option>
                      {deckList.map((d) => (
                        <option key={d.name} value={d.name}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs uppercase tracking-wide text-slate-400">
                      Opponent deck tags
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={matchupOpponentDeckInput}
                        onChange={(e) => setMatchupOpponentDeckInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addMatchupDeckTag(matchupOpponentDeckInput);
                          }
                        }}
                        placeholder="Add tag (e.g. grixis, tempo)"
                        className="bg-slate-700 text-white text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:border-blue-500 min-w-[280px]"
                      />
                      <button
                        onClick={() => addMatchupDeckTag(matchupOpponentDeckInput)}
                        className="px-3 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-500 text-white"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  {(matchupOpponentDeckInput ||
                    matchupOpponentDeckTags.length > 0 ||
                    matchupOwnDeckFilter !== "All") && (
                    <button
                      onClick={() => {
                        setMatchupOpponentDeckInput("");
                        setMatchupOpponentDeckTags([]);
                        setMatchupOwnDeckFilter("All");
                      }}
                      className="text-xs text-red-400 hover:text-red-300 pb-1"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-slate-800/70 border border-slate-700 rounded-lg p-3">
                    <div className="text-xs text-slate-400 uppercase tracking-wide">
                      Matches
                    </div>
                    <div className="text-xl font-bold text-white mt-1">
                      {matchupSummary.total}
                    </div>
                  </div>
                  <div className="bg-slate-800/70 border border-slate-700 rounded-lg p-3">
                    <div className="text-xs text-slate-400 uppercase tracking-wide">
                      Win Rate
                    </div>
                    <div className="text-xl font-bold text-green-400 mt-1">
                      {matchupSummary.winRate}%
                    </div>
                  </div>
                  <div className="bg-slate-800/70 border border-slate-700 rounded-lg p-3">
                    <div className="text-xs text-slate-400 uppercase tracking-wide">
                      Record
                    </div>
                    <div className="text-xl font-bold text-slate-200 mt-1">
                      {matchupSummary.wins}-{matchupSummary.losses}-{matchupSummary.draws}
                    </div>
                  </div>
                  <div className="bg-slate-800/70 border border-slate-700 rounded-lg p-3">
                    <div className="text-xs text-slate-400 uppercase tracking-wide">
                      Filter
                    </div>
                    <div className="text-xs text-slate-300 mt-2 truncate">
                      {matchupOpponentDeckTags.length > 0
                        ? matchupOpponentDeckTags.join(" OR ")
                        : "All opponent decks"}
                    </div>
                  </div>
                </div>

                {matchupOpponentDeckTags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {matchupOpponentDeckTags.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => removeMatchupDeckTag(tag)}
                        className="px-2.5 py-1 rounded-full text-xs bg-slate-700 text-slate-200 border border-slate-600 hover:border-red-400 hover:text-red-300"
                        title="Remove tag"
                      >
                        {tag} ×
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-slate-300">
                  <thead className="text-xs uppercase bg-slate-800/80 text-slate-400">
                    <tr>
                      <th className="px-6 py-3">Date</th>
                      <th className="px-6 py-3">Tournament</th>
                      <th className="px-6 py-3">Your Deck</th>
                      <th className="px-6 py-3">Opponent</th>
                      <th className="px-6 py-3">Opponent Deck</th>
                      <th className="px-6 py-3 text-center">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {matchupRows.length > 0 ? (
                      matchupRows.map((m, idx) => (
                        <tr
                          key={`${m.tournamentId}-${m.opponent}-${m.date.toISOString()}-${idx}`}
                          className="hover:bg-slate-700/30 transition-colors"
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-slate-400 font-mono text-xs">
                            {m.date.toISOString().slice(0, 10)}
                          </td>
                          <td className="px-6 py-4">
                            <Link
                              to={`/tournament/${m.tournamentId}`}
                              className="text-white hover:text-blue-400 transition-colors"
                            >
                              {m.tournamentName}
                            </Link>
                          </td>
                          <td className="px-6 py-4 text-slate-300">{m.ownDeck}</td>
                          <td className="px-6 py-4">
                            <Link
                              to={`/player/${encodeURIComponent(m.opponent)}`}
                              className="text-slate-200 hover:text-blue-400 transition-colors"
                            >
                              {m.opponent}
                            </Link>
                          </td>
                          <td className="px-6 py-4 text-slate-300">{m.opponentDeck}</td>
                          <td className="px-6 py-4 text-center">
                            <span
                              className={`px-2 py-1 rounded text-xs font-bold ${
                                m.result === "W"
                                  ? "bg-green-500/20 text-green-400"
                                  : m.result === "L"
                                    ? "bg-red-500/20 text-red-400"
                                    : "bg-slate-700 text-slate-300"
                              }`}
                            >
                              {m.result}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan="6"
                          className="px-6 py-12 text-center text-slate-500"
                        >
                          No games found for this matchup filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
