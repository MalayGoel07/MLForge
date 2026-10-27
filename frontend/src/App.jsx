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
import { loadTheme, useGlobalTheme } from "./components/ThemeButton";

export default function App() {
  const [path, setPath] = useState(window.location.pathname);
  // Universal theme — saved to localStorage, persists across pages AND reloads
  // until the user picks another one.
  const [theme, setTheme] = useState(() => loadTheme());
  const selectTheme = (id) => setTheme(id);
  useGlobalTheme(theme);

  useEffect(() => {
    const handlePopState = () => setPath(window.location.pathname);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = (nextPath) => {window.history.pushState({}, "", nextPath);setPath(nextPath);};

  if (path === "/home") {return <HomePage onNavigate={navigate} theme={theme} onSelectTheme={selectTheme} />;}
  if (path === "/analyze") {return <DataAnalyzer onNavigate={navigate} theme={theme} onSelectTheme={selectTheme} />;}
  if (path === "/compare") {return <CompareModel onNavigate={navigate} theme={theme} onSelectTheme={selectTheme} />;}
  if (path === "/roadmap") {return <Roadmap onNavigate={navigate} theme={theme} onSelectTheme={selectTheme} />;}
  if (path === "/createdata") {return <CreateData onNavigate={navigate} theme={theme} onSelectTheme={selectTheme} />;}
  if (path === "/compiler") {return <Compiler onNavigate={navigate} theme={theme} onSelectTheme={selectTheme} />;}
  if (path === "/aichat") {return <AiChat onNavigate={navigate} theme={theme} onSelectTheme={selectTheme} />;}
  if (path === "/textcode") {return <TextCode onNavigate={navigate} theme={theme} onSelectTheme={selectTheme} />;}
  if (path === "/cleandata") {return <CreateData onNavigate={navigate} theme={theme} onSelectTheme={selectTheme} />;}
  if (path === "/") {return <CBXLanding onNavigate={navigate} theme={theme} onSelectTheme={selectTheme} />;}
  if (path === "/login") {return <Logsignpage onNavigate={navigate} theme={theme} onSelectTheme={selectTheme} />;}
  return <CBXLanding onNavigate={navigate} theme={theme} onSelectTheme={selectTheme} />;
}
