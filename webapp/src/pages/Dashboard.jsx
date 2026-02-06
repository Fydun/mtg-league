import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import LeagueTable from "../components/LeagueTable";
import ScoreMatrix from "../components/ScoreMatrix";
import PerformanceChart from "../components/PerformanceChart";
import DeckChart from "../components/DeckChart";
import { useData } from "../contexts/DataContext";

export default function Dashboard() {
  const { data, loading, error } = useData();
  const [activeLeagueId, setActiveLeagueId] = useState(null);
  const [showLowest, setShowLowest] = useState(false);
  const [viewMode, setViewMode] = useState("table"); // 'table' | 'matrix'
  const [isExpanded, setIsExpanded] = useState(false);

  // Set default active league when data is loaded
  useEffect(() => {
    if (data && data.leagues && data.leagues.length > 0 && !activeLeagueId) {
      // Find 'active' or just take the first one (which matches our sorted logic)
      const first = data.leagues[0];
      setActiveLeagueId(first.id);
    }
  }, [data, activeLeagueId]);

  if (loading)
    return (
      <div className="p-8">
        <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700 p-12 text-center shadow-xl">
          <p className="text-slate-400 text-lg animate-pulse">
            Loading league database...
          </p>
        </div>
      </div>
    );

  if (error)
    return (
      <div className="p-8">
        <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-8 text-center">
          <h2 className="text-xl font-bold text-red-500 mb-2">
            Error Loading Data
          </h2>
          <p className="text-red-300">{error}</p>
        </div>
      </div>
    );

  // Get active league data
  const activeLeague = data.leagues.find((l) => l.id === activeLeagueId);

  return (
    <div className="space-y-6">
      {/* Header & League Selector */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div>
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
            League Standings
          </h1>
          <p className="text-slate-400 mt-1">Oslo Legacy League</p>
        </div>

        <div className="flex gap-2 bg-slate-800/50 p-1 rounded-lg">
          {data &&
            data.leagues.map((league) => (
              <button
                key={league.id}
                onClick={() => setActiveLeagueId(league.id)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  activeLeagueId === league.id
                    ? "bg-blue-600 text-white shadow-lg"
                    : "text-slate-400 hover:text-white hover:bg-slate-700/50"
                }`}
              >
                {league.name}
              </button>
            ))}
        </div>
      </div>

      {activeLeague && (
        <>
          <div
            className={`mx-auto transition-all duration-300 ${
              isExpanded && viewMode === "matrix" ? "w-[98%]" : "max-w-7xl"
            }`}
          >
            {/* Main Content Area */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-xl min-h-[500px]">
              {/* Toolbar */}
              <div className="sticky top-0 z-50 border-b border-slate-700/50 bg-slate-900/95 backdrop-blur shadow-md">
                <div className="h-[72px] px-4 flex flex-nowrap items-center justify-between gap-4 mx-auto w-full max-w-7xl transition-all duration-300">
                  {/* View Toggles */}
                  <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700">
                    <button
                      onClick={() => setViewMode("table")}
                      className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                        viewMode === "table"
                          ? "bg-slate-600 text-white shadow"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <span>📋</span> List
                    </button>
                    <button
                      onClick={() => setViewMode("matrix")}
                      className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                        viewMode === "matrix"
                          ? "bg-slate-600 text-white shadow"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <span>📅</span> Matrix
                    </button>
                    <button
                      onClick={() => setViewMode("analytics")}
                      className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                        viewMode === "analytics"
                          ? "bg-slate-600 text-white shadow"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <span>📈</span> Stats
                    </button>
                  </div>

                  <div className="flex items-center gap-4">
                    {viewMode === "matrix" && (
                      <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="text-xs font-bold uppercase tracking-wider text-blue-400 hover:text-white border border-blue-500/30 hover:bg-blue-600/20 px-3 py-1.5 rounded transition-all flex items-center gap-2"
                      >
                        <span>{isExpanded ? "⤡" : "⤢"}</span>{" "}
                        <span className="hidden sm:inline">
                          {isExpanded ? "Shrink" : "Expand"}
                        </span>
                      </button>
                    )}
                    {viewMode === "table" && (
                      <button
                        onClick={() => setShowLowest(!showLowest)}
                        className="text-xs font-medium px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors border border-slate-600/50"
                      >
                        {showLowest ? "Hide Lowest Score" : "Show Lowest Score"}
                      </button>
                    )}
                    <div className="text-sm text-slate-400 hidden sm:block">
                      {activeLeague.standings.length} Players &bull;{" "}
                      {activeLeague.tournaments.length} Tournaments
                      {activeLeague.max_counted && (
                        <> &bull; Best {activeLeague.max_counted} Count</>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* View Content */}
              {viewMode === "table" ? (
                <div className="px-4 sm:px-6 lg:px-8 py-6">
                  <LeagueTable
                    standings={activeLeague.standings}
                    showLowest={showLowest}
                  />
                </div>
              ) : viewMode === "matrix" ? (
                <ScoreMatrix
                  league={activeLeague}
                  tournamentData={data.tournaments}
                  isExpanded={isExpanded}
                />
              ) : (
                <div className="p-6 space-y-6">
                  <PerformanceChart
                    league={activeLeague}
                    tournamentData={data.tournaments}
                  />
                  <DeckChart
                    league={activeLeague}
                    tournamentData={data.tournaments}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h3 className="text-xl font-semibold text-white mb-4">
              Tournaments
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {activeLeague.tournaments.map((tId) => {
                const t = data.tournaments[tId];
                if (!t) return null;

                return (
                  <Link
                    key={tId}
                    to={`/tournament/${t.id}`}
                    className="group bg-slate-800/40 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 rounded-lg p-4 transition-all"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-slate-500 text-xs font-mono uppercase">
                        {t.date}
                      </span>
                      <span className="text-xs font-bold text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded">
                        W{t.name.split(" ")[1]}
                      </span>
                    </div>
                    <div className="font-semibold text-slate-200 group-hover:text-white truncate">
                      {t.name}
                    </div>
                    {t.metadata && (
                      <div className="mt-3 flex items-center gap-3 text-xs text-slate-400">
                        <div title="Players">👤 {t.metadata.players}</div>
                        <div title="Rounds">⚔️ {t.metadata.rounds}</div>
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
