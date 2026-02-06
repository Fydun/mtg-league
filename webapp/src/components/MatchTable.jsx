export default function MatchTable({ rounds }) {
  if (!rounds || rounds.length === 0) {
    return (
      <div className="text-slate-400 text-center py-10">No matches found.</div>
    );
  }

  return (
    <div className="space-y-8">
      {rounds.map((round) => (
        <div
          key={round.round}
          className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden"
        >
          <div className="px-6 py-3 bg-slate-800/80 border-b border-slate-700 font-semibold text-slate-200">
            Round {round.round}
          </div>
          <div className="divide-y divide-slate-700/50">
            {round.matches.map((match, idx) => (
              <div
                key={idx}
                className="px-6 py-4 flex flex-col sm:flex-row justify-between items-center hover:bg-slate-700/20 transition-colors"
              >
                {/* Player 1 */}
                <div
                  className={`flex-1 text-right sm:pr-4 font-medium ${match.p1_wins > match.p2_wins ? "text-green-400" : "text-slate-300"}`}
                >
                  {match.p1} {match.p1_wins > match.p2_wins && "🏆"}
                </div>

                {/* Score */}
                <div className="px-4 py-1 bg-slate-900 rounded-lg text-sm font-mono text-slate-400 my-2 sm:my-0 whitespace-nowrap">
                  <span
                    className={
                      match.p1_wins > match.p2_wins
                        ? "text-white font-bold"
                        : ""
                    }
                  >
                    {match.p1_wins}
                  </span>
                  <span className="mx-2 opacity-50">-</span>
                  <span
                    className={
                      match.p2_wins > match.p1_wins
                        ? "text-white font-bold"
                        : ""
                    }
                  >
                    {match.p2_wins}
                  </span>
                  {match.draws > 0 && (
                    <span className="text-slate-500 ml-1">({match.draws})</span>
                  )}
                </div>

                {/* Player 2 */}
                <div
                  className={`flex-1 text-left sm:pl-4 font-medium ${match.p2_wins > match.p1_wins ? "text-green-400" : "text-slate-300"}`}
                >
                  {match.p2_wins > match.p1_wins && "🏆"}{" "}
                  {match.p2 === "BYE" ? (
                    <span className="italic text-slate-500">BYE</span>
                  ) : (
                    match.p2
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
