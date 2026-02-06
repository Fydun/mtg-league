import { createContext, useContext, useState, useEffect } from "react";

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Construct path using the app's base URL (e.g. '/mtg-league/' or '/')
    // Remove trailing slash from base if present to avoid double slash, though fetch handles it usually.
    const baseUrl = import.meta.env.BASE_URL;
    const dbPath = `${baseUrl}data/db.json`;

    fetch(dbPath)
      .then((res) => {
        if (!res.ok)
          throw new Error(
            `Failed to load database from ${dbPath} (${res.status})`,
          );
        return res.json();
      })
      .then((db) => {
        setData(db);
        setLoading(false);
      })
      .catch((err) => {
        console.error("DB Load Error:", err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return (
    <DataContext.Provider value={{ data, loading, error }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  return useContext(DataContext);
}
