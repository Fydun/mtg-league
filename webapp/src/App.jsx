import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import TournamentDetail from "./pages/TournamentDetail";
import { DataProvider } from "./contexts/DataContext";

function App() {
  return (
    <DataProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <div className="min-h-screen bg-slate-950 text-white">
          <nav className="border-b border-slate-800 bg-slate-900/50 backdrop-blur">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex h-16 items-center justify-between">
                <div className="flex items-center">
                  <span className="text-xl font-bold text-blue-500">
                    MTG League
                  </span>
                  <div className="ml-10 flex items-baseline space-x-4">
                    <Link
                      to="/"
                      className="text-slate-300 hover:bg-slate-800 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
                    >
                      Dashboard
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </nav>

          <main className="w-full py-6">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route
                path="/tournament/:tournamentId"
                element={<TournamentDetail />}
              />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </DataProvider>
  );
}

export default App;
