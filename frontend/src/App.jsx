import { useEffect, useState } from "react";
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
import CleanData from "./components/Cleandata";
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
  const [theme, setTheme] = useState(() => loadTheme());
  const selectTheme = (id) => setTheme(id);
  useGlobalTheme(theme);
  useEffect(() => {
    const handlePopState = () => setPath(window.location.pathname);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = (nextPath) => { window.history.pushState({}, "", nextPath); setPath(nextPath); };
  const pageProps = { onNavigate: navigate, theme, onSelectTheme: selectTheme };
  if (!PUBLIC_ROUTES.includes(path) && !getToken()) {return <Logsignpage {...pageProps} redirectTo={path} />;}
  let page;
  if (path === "/login") page = <Logsignpage {...pageProps} />;
  else if (ROUTES[path]) { const Page = ROUTES[path]; page = <Page {...pageProps} />; }
  else page = <CBXLanding {...pageProps} />;
  const showAI = !PUBLIC_ROUTES.includes(path) && !!getToken();
  return (
    <>
      {page}
      {showAI && <AiChat onNavigate={navigate} />}
    </>
  );
}