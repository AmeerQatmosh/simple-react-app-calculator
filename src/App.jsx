import React, { useCallback, useEffect, useState } from "react";
import {
  AlignCenterHorizontal,
  AlignLeft,
  History,
  Keyboard,
  Moon,
  Sun,
} from "lucide-react";
import Calculator from "./component/calculator";
import "./App.css";

const WIDE_MQ = "(min-width: 861px)";
const HISTORY_OPEN_KEY = "calcHistoryPanelOpen";
const CALC_PAGE_ALIGN_KEY = "calcPageAlign";

/** @returns {"middle" | "left"} */
function readCalcPageAlign() {
  try {
    const v = localStorage.getItem(CALC_PAGE_ALIGN_KEY);
    if (v === "left") return "left";
    if (v === "middle") return "middle";
  } catch {
    /* ignore */
  }
  return "middle";
}

function readIsDesktop() {
  if (typeof window === "undefined") return false;
  try {
    return window.matchMedia(WIDE_MQ).matches;
  } catch {
    return false;
  }
}

function readInitialHistoryOpen(compactViewport) {
  try {
    const v = localStorage.getItem(HISTORY_OPEN_KEY);
    if (v === "1") return true;
    if (v === "0") return false;
  } catch {
    /* ignore */
  }
  return !compactViewport;
}

function readStoredDarkMode() {
  try {
    if (localStorage.getItem("darkMode") === "true") return true;
    if (localStorage.getItem("darkMode") === "false") return false;
    const legacy = localStorage.getItem("calculatorTheme");
    if (legacy && legacy !== "light") return true;
  } catch {
    /* ignore */
  }
  return false;
}

export default function App() {
  const [darkMode, setDarkMode] = useState(readStoredDarkMode);
  const [desktop, setDesktop] = useState(readIsDesktop);
  const [histOpen, setHistOpen] = useState(() =>
    readInitialHistoryOpen(!readIsDesktop())
  );
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [historyCount, setHistoryCount] = useState(0);
  const [calcPageAlign, setCalcPageAlign] = useState(readCalcPageAlign);

  useEffect(() => {
    try {
      localStorage.setItem("darkMode", darkMode ? "true" : "false");
    } catch {
      /* ignore */
    }
  }, [darkMode]);

  useEffect(() => {
    document.documentElement.setAttribute(
      "data-theme",
      darkMode ? "dark" : "light"
    );
  }, [darkMode]);

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_OPEN_KEY, histOpen ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [histOpen]);

  useEffect(() => {
    try {
      localStorage.setItem(CALC_PAGE_ALIGN_KEY, calcPageAlign);
    } catch {
      /* ignore */
    }
  }, [calcPageAlign]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mq = window.matchMedia(WIDE_MQ);
    function onChange() {
      setDesktop(mq.matches);
    }
    onChange();
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    }
    mq.addListener(onChange);
    return () => mq.removeListener(onChange);
  }, []);

  const toggleHist = useCallback(() => setHistOpen((o) => !o), []);

  const historyBadge =
    historyCount === 0
      ? "0"
      : historyCount > 99
        ? "99+"
        : String(historyCount);

  return (
    <div className="App app-root">
      {desktop ? (
        <aside
          className="app-left-rail"
          aria-label="Theme, layout, and calculator tools"
        >
          <button
            type="button"
            role="switch"
            aria-checked={darkMode}
            aria-label="Color theme"
            className="app-left-rail__tile"
            onClick={() => setDarkMode((d) => !d)}
          >
            {darkMode ? (
              <Moon
                className="app-left-rail__leading-icon"
                size={18}
                strokeWidth={2.25}
                aria-hidden
              />
            ) : (
              <Sun
                className="app-left-rail__leading-icon"
                size={18}
                strokeWidth={2.25}
                aria-hidden
              />
            )}
            <span className="app-left-rail__tile-label">
              {darkMode ? "Dark" : "Light"}
            </span>
          </button>

          <button
            type="button"
            className="app-left-rail__tile"
            aria-label={`Calculator layout: ${calcPageAlign === "left" ? "left aligned" : "centered"}. Toggle left or middle.`}
            onClick={() =>
              setCalcPageAlign((p) => (p === "left" ? "middle" : "left"))
            }
          >
            {calcPageAlign === "left" ? (
              <AlignLeft
                className="app-left-rail__leading-icon"
                size={18}
                strokeWidth={2.25}
                aria-hidden
              />
            ) : (
              <AlignCenterHorizontal
                className="app-left-rail__leading-icon"
                size={18}
                strokeWidth={2.25}
                aria-hidden
              />
            )}
            <span className="app-left-rail__tile-label">
              {calcPageAlign === "left" ? "Left" : "Middle"}
            </span>
          </button>

          <button
            type="button"
            className="app-left-rail__tile"
            aria-expanded={histOpen}
            aria-controls="calc-history-region"
            onClick={toggleHist}
          >
            <History
              className="app-left-rail__leading-icon"
              size={18}
              strokeWidth={2.25}
              aria-hidden
            />
            <span className="app-left-rail__tile-label">History</span>
            <span
              className="app-left-rail__badge"
              data-empty={historyCount === 0}
            >
              {historyBadge}
            </span>
          </button>

          <button
            type="button"
            className="app-left-rail__tile"
            aria-expanded={showShortcuts}
            onClick={() => setShowShortcuts((s) => !s)}
          >
            <Keyboard
              className="app-left-rail__leading-icon"
              size={18}
              strokeWidth={2.25}
              aria-hidden
            />
            <span className="app-left-rail__tile-label">Shortcuts</span>
          </button>
        </aside>
      ) : null}

      <div className={`app-main${desktop ? " app-main--with-rail" : ""}`}>
        <Calculator
          histOpen={histOpen}
          setHistOpen={setHistOpen}
          showShortcuts={showShortcuts}
          setShowShortcuts={setShowShortcuts}
          desktopDockTools={desktop}
          onHistoryCountChange={setHistoryCount}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          calcPageAlign={calcPageAlign}
          setCalcPageAlign={setCalcPageAlign}
        />
      </div>
    </div>
  );
}
