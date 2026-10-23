import { createContext, useContext, useEffect, useState } from "react";
import { api, clearToken, getToken, setToken } from "../services/api.js";
import { login } from "../services/auth.js";

const AppContext = createContext(null);
const EMPTY_DB = { patients: [], sessions: [] };

export function AppProvider({ children }) {
  const [db, setDb] = useState(EMPTY_DB);
  const [me, setMe] = useState(() => {
    try {
      return getToken() ? JSON.parse(sessionStorage.getItem("rehabrep-user")) : null;
    } catch {
      clearToken();
      return null;
    }
  });
  const [loading, setLoading] = useState(Boolean(getToken() && sessionStorage.getItem("rehabrep-user")));
  const [loadError, setLoadError] = useState("");

  const refreshDb = async () => {
    try {
      const data = await api("/bootstrap");
      setDb(data);
      setLoadError("");
    } catch (error) {
      setLoadError(error.message);
      throw error;
    }
  };

  useEffect(() => {
    if (!me) return;
    let active = true;
    setLoading(true);
    api("/bootstrap")
      .then((data) => {
        if (active) {
          setDb(data);
          setLoadError("");
        }
      })
      .catch((error) => {
        if (active) setLoadError(error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [me]);

  const signIn = async (role, id, password) => {
    const result = await login(role, id, password);
    setToken(result.token);
    sessionStorage.setItem("rehabrep-user", JSON.stringify(result.user));
    setLoading(true);
    setMe(result.user);
  };

  const logout = () => {
    clearToken();
    sessionStorage.removeItem("rehabrep-user");
    setDb(EMPTY_DB);
    setMe(null);
    setLoading(false);
    setLoadError("");
  };

  const retryDb = async () => {
    try {
      await refreshDb();
    } catch (error) {
      setLoadError(error.message);
    }
  };

  return (
    <AppContext.Provider value={{ db, me, signIn, logout, loading, loadError, refreshDb, retryDb }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
