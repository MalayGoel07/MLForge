import { useEffect, useReducer, useState } from "react";
import HomePage from "./components/HomePage";
import CBXLanding from "./components/LandingPage";
import DataAnalyzer from "./components/DataAnalyzer";
import CompareModel from "./components/CompareModel";
import Roadmap from "./components/Roadmap";
import CreateData from "./components/CreateData";
import Compiler from "./components/Compiler";
import AiChat from "./components/AiChat";
import TextCode from "./components/TextCode";
import Logsignpage from "./components/Logsignpage";
import CleanData from "./components/CleanData";
import { loadTheme, useGlobalTheme } from "./components/ThemeButton";
import { getToken } from "./api/auth";

const PUBLIC_ROUTES = ["/", "/login"];

const ROUTES = {
  "/home": HomePage,
  "/analyze": DataAnalyzer,
  "/compare": CompareModel,
  "/roadmap": Roadmap,
  "/createdata": CreateData,
  "/compiler": Compiler,
  "/textcode": TextCode,
  "/cleandata": CleanData,
};

export default function App() {
  const [path, setPath] = useState(window.location.pathname);
  const [, rerender] = useReducer((n) => n + 1, 0); // forces a re-render so the auth guard re-checks the token
  const [theme, setTheme] = useState(() => loadTheme());
  const selectTheme = (id) => setTheme(id);
  useGlobalTheme(theme);

  useEffect(() => {
    // Keep `path` in sync with the URL even if a component calls
    // history.pushState / replaceState directly (those don't fire any event by themselves).
    const patch = (method) => {
      const original = window.history[method];
      window.history[method] = function (...args) {
        const result = original.apply(this, args);
        window.dispatchEvent(new Event("locationchange"));
        return result;
      };
      return () => { window.history[method] = original; };
    };
    const restore = [patch("pushState"), patch("replaceState")];
    const sync = () => { setPath(window.location.pathname); rerender(); };
    window.addEventListener("popstate", sync);
    window.addEventListener("locationchange", sync);
    return () => {
      restore.forEach((undo) => undo());
      window.removeEventListener("popstate", sync);
      window.removeEventListener("locationchange", sync);
    };
  }, []);

  const navigate = (nextPath) => {
    if (nextPath !== window.location.pathname) {window.history.pushState({}, "", nextPath);}
    setPath(nextPath);
    rerender();
  };

  const pageProps = { onNavigate: navigate, theme, onSelectTheme: selectTheme };

  if (!PUBLIC_ROUTES.includes(path) && !getToken()) {
    return <Logsignpage {...pageProps} redirectTo={path} />;
  }

  let page;
  if (path === "/login") page = <Logsignpage {...pageProps} />;
  else if (ROUTES[path]) { const Page = ROUTES[path]; page = <Page {...pageProps} />; }
  else page = <CBXLanding {...pageProps} />;

  const showAI = path !== "/" && path !== "/login" && !!getToken();

  return (
    <>
      {page}
      {showAI && <AiChat onNavigate={navigate} />}
    </>
  );
}