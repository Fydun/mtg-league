import { useMemo, useRef, useEffect } from "react";
import { Link } from "react-router-dom";

export default function ScoreMatrix({ league, tournamentData, isExpanded }) {
  const { standings, tournaments, max_counted } = league;
  const headerRef = useRef(null);
  const bodyRef = useRef(null);

  const handleScroll = (e) => {
    if (headerRef.current) {
      headerRef.current.scrollLeft = e.target.scrollLeft;
    }
  };

  // Process data for the matrix
  const matrixData = useMemo(() => {
    // 1. Map tournament IDs to metadata (date, name)
    // tournaments is a list of IDs ["week-89", "week-88"...] (Sorted newest first usually)
    // We might want to sort them Chronologically (Oldest -> Newest) for the matrix usually?
    // Or Newest -> Oldest? Excel usually does Left->Right Chronological.
    // The list in JSON is Newest First. Let's reverse it for the table (Oldest Left).

    // Sort chronologically based on ID number
    const sortedTournaments = [...tournaments].sort((a, b) => {
      const numA = parseInt(a.split("-")[1]);
      const numB = parseInt(b.split("-")[1]);
      return numA - numB;
    });

    const headers = sortedTournaments.map((tId) => {
      const t = tournamentData[tId];
      return {
        id: tId,
        name: t ? t.name : tId,
        date: t ? t.date : "",
        shortVer: t ? `W${t.name.split(" ")[1]}` : tId,
      };
    });

    // 2. Process players
    const rows = standings.map((player) => {
      // Logic to determine which scores count
      // We need to simulate the "top X" logic to highlight cells
      const history = player.history || {};

      // Get all scores for this league's tournaments
      const scores = sortedTournaments.map((tId) => ({
        id: tId,
        score: history[tId] || 0,
      }));

      // Identify which are counted
      // Filter out 0s? Usually 0s don't help.
      // The rule is "Best X Results".
      // We take values > 0 (participation usually gives 3?)
      // Actually strictly value based.

      const values = scores.map((s) => s.score);
      // We want to find the threshold or specifically mark the N highest.
      // Easiest is to sort values, pick top N, and Count frequencies?
      // A score of 9 might appear twice, one counts, one doesn't?
      // No, usually if you have [9, 9] and need 1, one counts.
      // So we tag them by index.

      // Create a list of { score, tournamentId }
      const scoreObjects = scores
        .filter((s) => s.score > 0) // Only positive scores usually count/matter
        .map((s) => ({ ...s }));

      // Sort desc
      scoreObjects.sort((a, b) => b.score - a.score);

      const countedIds = new Set();
      const limit = max_counted || 9999;

      scoreObjects.slice(0, limit).forEach((obj) => {
        countedIds.add(obj.id);
      });

      return {
        ...player,
        cells: scores.map((s) => ({
          ...s,
          isCounted: countedIds.has(s.id) && s.score > 0,
          isParticipated: s.score > 0,
        })),
      };
    });

    return { headers, rows };
  }, [standings, tournaments, tournamentData, max_counted]);

  if (!standings || standings.length === 0) return null;

  const colWidthClass = "w-20 min-w-[5rem] max-w-[5rem]"; // 80px
  const playerColClass = "w-[220px] min-w-[220px] max-w-[220px]";

  return (
    <div className="pb-4 border-t border-slate-700 relative">
      {/* Sticky Header Container */}
      <div
        ref={headerRef}
        className="sticky top-[72px] z-40 overflow-hidden bg-slate-900 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.3)] border-b border-slate-700 select-none"
      >
        <table className="border-collapse w-full text-sm text-left table-fixed">
          <thead>
            <tr>
              <th
                className={`
                p-4 font-medium text-slate-400 border-r border-slate-700
                sticky left-0 z-50 bg-slate-900
                ${playerColClass}
              `}
              >
                Player
              </th>
              {matrixData.headers.map((h) => (
                <th
                  key={h.id}
                  className={`
                    bg-slate-900 border-r border-slate-700/50 p-1 text-center
                    ${colWidthClass}
                  `}
                >
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[10px] font-mono text-slate-500 whitespace-nowrap leading-tight">
                      {h.date}
                    </span>
                    <span className="font-bold text-blue-400 bg-blue-400/10 px-2 rounded">
                      {h.shortVer}
                    </span>
                  </div>
                </th>
              ))}
              {/* Spacer for scrollbar alignment and extra space */}
              <th className="min-w-[100px]"></th>
            </tr>
          </thead>
        </table>
      </div>

      {/* Scrollable Body Container */}
      <div
        ref={bodyRef}
        onScroll={handleScroll}
        className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-800/50"
      >
        <table className="border-collapse w-full text-sm text-left table-fixed">
          {/* Invisible Header to enforce widths in Body Table */}
          <thead className="invisible h-0 opacity-0 pointer-events-none">
            <tr>
              <th className={playerColClass}></th>
              {matrixData.headers.map((h) => (
                <th key={h.id} className={colWidthClass}></th>
              ))}
              <th className="min-w-[100px]"></th>
            </tr>
          </thead>
          <tbody>
            {matrixData.rows.map((row) => (
              <tr
                key={row.name}
                className="group border-b border-slate-800 hover:bg-blue-900/20 transition-colors duration-150 ease-in-out"
              >
                <td
                  className={`sticky left-0 z-20 bg-slate-900 px-4 py-3 border-r border-slate-700 font-medium text-slate-200 truncate group-hover:bg-slate-800 transition-colors shadow-[4px_0_8px_rgba(0,0,0,0.3)] ${playerColClass}`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs w-6 h-6 flex items-center justify-center rounded-full shrink-0 ${
                        row.rank <= 3
                          ? "bg-blue-500/20 text-blue-400"
                          : "bg-slate-800 text-slate-500"
                      }`}
                    >
                      {row.rank}
                    </span>
                    <span className="truncate">{row.name}</span>
                  </div>
                </td>
                {row.cells.map((cell) => {
                  let bgStyle = {};
                  let textClass = "text-slate-500 opacity-60";

                  if (cell.score > 0) {
                    if (cell.isCounted) {
                      textClass = "text-white shadow-sm";
                      if (cell.score >= 12) {
                        bgStyle = {
                          backgroundColor: "#eab308",
                          color: "black",
                          boxShadow: "0 0 10px rgba(234, 179, 8, 0.4)",
                        };
                        textClass = "text-black font-extrabold";
                      } else if (cell.score >= 9) {
                        bgStyle = { backgroundColor: "#f97316" };
                      } else {
                        const intensity = Math.min((cell.score - 3) / 8, 1);
                        bgStyle = {
                          backgroundColor: `rgba(59, 130, 246, ${0.5 + intensity * 0.5})`,
                        };
                      }
                    } else {
                      bgStyle = { backgroundColor: "rgba(30, 41, 59, 0.5)" };
                    }
                  }

                  return (
                    <td
                      key={cell.id}
                      className={`p-1 text-center ${colWidthClass}`}
                    >
                      {cell.score > 0 ? (
                        <div
                          className={`
                                mx-auto w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-all
                                border border-transparent
                                ${textClass}
                            `}
                          style={bgStyle}
                          title={
                            cell.isCounted
                              ? `Counted: ${cell.score}`
                              : `Dropped: ${cell.score}`
                          }
                        >
                          {cell.score}
                        </div>
                      ) : (
                        <div className="w-1 h-1 bg-slate-800 rounded-full mx-auto" />
                      )}
                    </td>
                  );
                })}
                <td className="min-w-[100px]"></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
