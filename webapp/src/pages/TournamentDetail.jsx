import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import MatchTable from "../components/MatchTable";
import { useData } from "../contexts/DataContext";

export default function TournamentDetail() {
  const { tournamentId } = useParams();
  const { data, loading } = useData();
  const [showTiebreakers, setShowTiebreakers] = useState(false);

  if (loading)
    return (
      <div className="p-8 text-center text-slate-400 animate-pulse">
        Loading tournament...
      </div>
    );
  if (!data || !data.tournaments[tournamentId])
    return (
      <div className="p-8 text-center text-red-400">Tournament not found.</div>
    );

  const tournament = data.tournaments[tournamentId];
  const { metadata, standings } = tournament;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col gap-6 border-b border-slate-800 pb-8">
        <div>
          <Link
            to="/"
            className="inline-flex items-center text-sm text-slate-400 hover:text-white transition-colors mb-4"
          >
            &larr; Back to Dashboard
          </Link>
          <h1 className="text-4xl font-bold text-white mb-2">
            {tournament.name}
          </h1>
          <div className="flex items-center space-x-4 text-sm text-slate-400">
            <span>📅 {tournament.date}</span>
            <span>&bull;</span>
            <span className="uppercase tracking-wider text-xs bg-slate-800 px-2 py-1 rounded border border-slate-700/50">
              {tournament.league_id}
            </span>
          </div>
        </div>

        {/* Metadata Cards (Removed Top Cut) */}
        {metadata && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-slate-800/30 p-4 rounded-lg border border-slate-700/50">
              <div className="text-slate-500 text-xs uppercase tracking-wider mb-1">
                Players
              </div>
              <div className="text-2xl font-bold text-white">
                {metadata.players}
              </div>
            </div>
            <div className="bg-slate-800/30 p-4 rounded-lg border border-slate-700/50">
              <div className="text-slate-500 text-xs uppercase tracking-wider mb-1">
                Rounds
              </div>
              <div className="text-2xl font-bold text-white">
                {metadata.rounds}
              </div>
            </div>
            <div className="bg-slate-800/30 p-4 rounded-lg border border-slate-700/50">
              <div className="text-slate-500 text-xs uppercase tracking-wider mb-1">
                Prize Pool
              </div>
              <div className="text-2xl font-bold text-amber-400">
                {metadata.prize_pool} NOK
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Standings Table with Decks & Tiebreakers */}
      <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700 shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700/50 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-white">
            Results & Standings
          </h2>
          <button
            onClick={() => setShowTiebreakers(!showTiebreakers)}
            className="text-xs font-medium px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors border border-slate-600/50"
          >
            {showTiebreakers ? "Hide Tiebreakers" : "Show Tiebreakers"}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm md:text-base">
            <thead>
              <tr className="bg-slate-900/50 text-slate-400 border-b border-slate-700/50">
                <th className="px-6 py-3 font-medium w-16 text-center">#</th>
                <th className="px-6 py-3 font-medium">Player</th>
                <th className="px-6 py-3 font-medium">Deck</th>
                <th className="px-6 py-3 font-medium text-center">Points</th>
                <th className="px-6 py-3 font-medium text-center">W-L-D</th>

                {showTiebreakers && (
                  <>
                    <th
                      className="px-6 py-3 font-medium text-right text-xs uppercase tracking-wider"
                      title="Opponent Match Win %"
                    >
                      OMW%
                    </th>
                    <th
                      className="px-6 py-3 font-medium text-right text-xs uppercase tracking-wider"
                      title="Game Win %"
                    >
                      GW%
                    </th>
                    <th
                      className="px-6 py-3 font-medium text-right text-xs uppercase tracking-wider"
                      title="Opponent Game Win %"
                    >
                      OGW%
                    </th>
                    <th
                      className="px-6 py-3 font-medium text-right text-xs uppercase tracking-wider"
                      title="Match Win %"
                    >
                      MW%
                    </th>
                  </>
                )}

                <th className="px-6 py-3 font-medium text-right">Payout</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {standings.map((player) => (
                <tr
                  key={player.rank}
                  className="hover:bg-slate-700/20 transition-colors"
                >
                  <td className="px-6 py-4 text-center text-slate-500 font-mono">
                    {player.rank}
                  </td>
                  <td className="px-6 py-4 font-medium text-white">
                    {player.name}
                  </td>
                  <td className="px-6 py-4 text-slate-300">
                    {player.deck ? (
                      <span className="inline-block px-2 py-1 rounded bg-slate-700/50 border border-slate-600/50 text-xs">
                        {player.deck}
                      </span>
                    ) : (
                      <span className="text-slate-600">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center font-bold text-blue-400">
                    {player.points}
                  </td>
                  <td className="px-6 py-4 text-center text-slate-400 font-mono text-xs">
                    {player.record}
                  </td>

                  {showTiebreakers && (
                    <>
                      <td className="px-6 py-4 text-right text-slate-500 font-mono text-xs">
                        {(player.omw * 100).toFixed(1)}%
                      </td>
                      <td className="px-6 py-4 text-right text-slate-500 font-mono text-xs">
                        {(player.gw * 100).toFixed(1)}%
                      </td>
                      <td className="px-6 py-4 text-right text-slate-500 font-mono text-xs">
                        {(player.ogw * 100).toFixed(1)}%
                      </td>
                      <td className="px-6 py-4 text-right text-slate-500 font-mono text-xs">
                        {(player.mw * 100).toFixed(1)}%
                      </td>
                    </>
                  )}

                  <td className="px-6 py-4 text-right">
                    {player.payout > 0 ? (
                      <span className="text-amber-400 font-bold">
                        {player.payout} kr
                      </span>
                    ) : (
                      <span className="text-slate-700">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Match History */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-6">Match History</h2>
        <MatchTable rounds={tournament.rounds} />
      </div>
    </div>
  );
}
