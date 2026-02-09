import { useState } from "react";
import { Link } from "react-router-dom";

export default function LeagueTable({ standings, showLowest }) {
  if (!standings || standings.length === 0) {
    return (
      <div className="text-slate-400 text-center py-10">
        No standings available.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left text-slate-300">
        <thead className="text-xs uppercase bg-slate-800 text-slate-400">
          <tr>
            <th
              scope="col"
              className="px-6 py-3 rounded-tl-lg w-16 text-center"
            >
              Rank
            </th>
            <th scope="col" className="px-6 py-3">
              Player
            </th>
            <th scope="col" className="px-6 py-3 text-right w-24">
              Points
            </th>
            <th
              scope="col"
              className={`px-6 py-3 text-center w-32 ${
                !showLowest ? "rounded-tr-lg" : ""
              }`}
            >
              Tournaments
            </th>
            {showLowest && (
              <th
                scope="col"
                className="px-6 py-3 text-center text-xs uppercase tracking-wider text-slate-500 w-24 rounded-tr-lg"
              >
                Lowest
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {standings.map((player) => (
            <tr
              key={player.name}
              className="border-b border-slate-700 hover:bg-slate-700/50 transition-colors"
            >
              <td className="px-6 py-4 font-medium text-white text-center">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full mx-auto ${
                    player.rank === 1
                      ? "bg-yellow-500/20 text-yellow-500"
                      : player.rank === 2
                        ? "bg-slate-300/20 text-slate-300"
                        : player.rank === 3
                          ? "bg-amber-700/20 text-amber-600"
                          : "bg-slate-800 text-slate-500"
                  }`}
                >
                  {player.rank}
                </div>
              </td>
              <td className="px-6 py-4 font-semibold text-white">
                <Link
                  to={`/player/${encodeURIComponent(player.name)}`}
                  className="hover:text-blue-400 hover:underline transition-colors"
                >
                  {player.name}
                </Link>
              </td>
              <td className="px-6 py-4 text-right font-bold text-blue-400">
                {player.points}
              </td>
              <td className="px-6 py-4 text-center text-slate-500">
                {player.tournaments_display}
              </td>
              {showLowest && (
                <td className="px-6 py-4 text-center text-slate-600 font-mono text-xs">
                  {player.lowest_counting}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
