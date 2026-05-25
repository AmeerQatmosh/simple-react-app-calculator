import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useId,
} from "react";
import { evaluate } from "mathjs";
import Button from "react-bootstrap/Button";
import CopyButton from "./copyButton";
import History from "./history";
import {
  evaluateProgrammer,
  formatProgrammerBigInt,
} from "./programmerEval";
import {
  AlignCenterHorizontal,
  AlignLeft,
  Moon,
  Sun,
} from "lucide-react";
import "bootstrap/dist/css/bootstrap.min.css";
import "./calculator.scss";

export const CALC_STANDARD = "standard";
export const CALC_SCIENTIFIC = "scientific";
export const CALC_PROGRAMMER = "programmer";

function toFiniteNumber(value) {
  if (value == null) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "object" && typeof value.toNumber === "function") {
    const n = value.toNumber();
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatCalcResult(n) {
  if (Number.isInteger(n)) return String(n);
  const rounded = parseFloat(n.toPrecision(14));
  return String(rounded);
}

function displayToInternal(displayExpr) {
  return displayExpr.replace(/×/g, "*").replace(/÷/g, "/");
}

/** Normalize keyboard * / to match on-screen multiply / divide glyphs. */
function normalizeTypedDisplay(s) {
  return s.replace(/\*/g, "×").replace(/\//g, "÷");
}

/** Default idle expression (shows in the display / input when cleared). */
const DEFAULT_EXPR = "0";

/**
 * Merge an append into workbench state: replace idle `0`, `Error`, or unary `-`
 * (so e.g. tan( does not become 0tan( or lose a pending minus).
 */
function mergeAppendWorkbench(prevIn, prevDisp, internalFrag, displayFrag) {
  const dFrag = displayFrag ?? internalFrag;

  if (prevIn === "Error" || prevDisp === "Error") {
    return { input: internalFrag, displayed: dFrag };
  }

  const ei = prevIn.trim();
  const ed = prevDisp.trim();

  if (ei === DEFAULT_EXPR && ed === DEFAULT_EXPR) {
    return { input: internalFrag, displayed: dFrag };
  }

  if (ei === "-" && ed === "-") {
    return { input: `-${internalFrag}`, displayed: `-${dFrag}` };
  }

  return {
    input: `${prevIn}${internalFrag}`,
    displayed: `${prevDisp}${dFrag}`,
  };
}

/** Display glyph for multiply/divide (shared standard / scientific / programmer UI). */
function displayMulDiv(asciiOp) {
  if (asciiOp === "/") return "÷";
  if (asciiOp === "*") return "×";
  return asciiOp;
}

/** Scientific pad: one source of truth for insert snippets (avoids drift / copy-paste bugs). */
const SCI_PAD_BUTTONS = [
  {
    insert: "sin(",
    label: "sin",
    title: "Inserts sin( — type the argument, then press )",
  },
  {
    insert: "cos(",
    label: "cos",
    title: "Inserts cos( — type the argument, then press )",
  },
  {
    insert: "tan(",
    label: "tan",
    title: "Inserts tan( — type the argument, then press )",
  },
  {
    insert: "log(",
    label: "ln",
    title: "Natural ln: type the argument, then )",
  },
  {
    insert: "log10(",
    label: "log",
    title: "Log₁₀: type the argument, then )",
  },
  {
    insert: "sqrt(",
    label: "√",
    title: "Square root: type the argument, then )",
  },
  { insert: "^", label: "xʸ", title: "Power: x to the y (exponent on the right)" },
  {
    insert: "asin(",
    label: "sin⁻¹",
    title: "Arcsin: type the argument, then )",
  },
  {
    insert: "acos(",
    label: "cos⁻¹",
    title: "Arccos: type the argument, then )",
  },
  {
    insert: "atan(",
    label: "tan⁻¹",
    title: "Arctan: type the argument, then )",
  },
  { insert: "pi", label: "π", title: "Insert π" },
  { insert: "e", label: "e", title: "Insert e" },
  {
    insert: "factorial(",
    label: "n!",
    title: "Factorial: type n, then close with )",
  },
];

/** Idle before first real digit: lone 0 or leading unary minus. */
function isIdleBeforeDigit(internal, displayed) {
  const i = internal.trim();
  const d = displayed.trim();
  return (
    (i === DEFAULT_EXPR && d === DEFAULT_EXPR) ||
    (i === "-" && d === "-")
  );
}

/**
 * Bare number like "09" → "9" while typing (no operators/decimals involved).
 */
function collapseLeadingZeroBeforeDigit(display, calcMode, progRadix) {
  const trimmed = normalizeTypedDisplay(display).trim();
  const internal = displayToInternal(trimmed);

  let neg = false;
  let body = internal.trim();
  if (body.startsWith("-")) {
    neg = true;
    body = body.slice(1);
  }
  if (!body.length) return display;

  if (/[+]|[*+/^%&|()]/.test(body) || body.includes("<<") || body.includes(">>")) {
    return display;
  }
  if (/\./.test(body) || /[eE]/.test(body)) return display;

  let pairRe;
  if (calcMode === CALC_PROGRAMMER) {
    if (progRadix === 16) pairRe = /^0([1-9A-F])$/i;
    else if (progRadix === 8) pairRe = /^0([1-7])$/;
    else if (progRadix === 2) pairRe = /^0([1])$/;
    else pairRe = /^0([1-9])$/;
  } else {
    pairRe = /^0([1-9])$/;
  }

  const m = body.match(pairRe);
  if (m) {
    return `${neg ? "-" : ""}${m[1]}`;
  }
  if (/^0+$/.test(body)) {
    return `${neg ? "-" : ""}0`;
  }
  return display;
}
/** Appends trailing `)` so every `(` is closed (e.g. tan(9 → tan(9)). */
function closeUnbalancedParentheses(str) {
  let depth = 0;
  for (const c of str) {
    if (c === "(") depth++;
    else if (c === ")") depth--;
    if (depth < 0) return str;
  }
  return depth > 0 ? str + ")".repeat(depth) : str;
}

/** @typedef {2 | 8 | 10 | 16} ProgRadix */

function radixLabel(r) {
  if (r === 2) return "BIN";
  if (r === 8) return "OCT";
  if (r === 16) return "HEX";
  return "DEC";
}

const RADIX_PROG_DIGITS = {
  2: /^[01]$/,
  8: /^[0-7]$/,
  10: /^[0-9]$/,
  16: /^[0-9A-Fa-f]$/,
};

function progUnaryMinusContext(s) {
  if (!s) return true;
  if (s.endsWith("<<") || s.endsWith(">>")) return true;
  const c = /** @type {string} */ (s.at(-1));
  if (c === ")") return false;
  return "(*+-/%^&|(".includes(c);
}

function progOperandComplete(s) {
  return /[0-9A-Fa-f)]$/i.test(s);
}

function isEditableSurrogate(el) {
  if (!el || typeof el.closest !== "function") return false;
  return Boolean(
    el.closest(
      'input:not([readonly]):not([type="radio"]):not([type="checkbox"]), textarea, [contenteditable="true"], select'
    )
  );
}

/** Returns a media query list for the mobile layout breakpoint, or null in non-browser / test shims. */
function getCompactMediaQuery() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return null;
  }
  return window.matchMedia("(max-width: 860px)");
}

export default function Calculator({
  histOpen,
  setHistOpen,
  showShortcuts,
  setShowShortcuts,
  desktopDockTools,
  onHistoryCountChange,
  darkMode,
  setDarkMode,
  calcPageAlign,
  setCalcPageAlign,
}) {
  const exprInputId = useId();
  const exprInputRef = useRef(null);

  const [calcMode, setCalcMode] = useState(CALC_STANDARD);
  const [progRadix, setProgRadix] = useState(10);
  const [progBits, setProgBits] = useState(32);

  const [input, setInput] = useState(DEFAULT_EXPR);
  const [displayedInput, setDisplayedInput] = useState(DEFAULT_EXPR);
  const [history, setHistory] = useState([]);
  const [appliedHistoryEntryId, setAppliedHistoryEntryId] = useState(null);

  const [compact, setCompact] = useState(() => {
    const mq = getCompactMediaQuery();
    return mq ? mq.matches : false;
  });

  const histOpenRef = useRef(histOpen);
  const compactRef = useRef(compact);
  const shortcutsRef = useRef(showShortcuts);
  const workbenchRef = useRef({
    input: DEFAULT_EXPR,
    displayedInput: DEFAULT_EXPR,
  });

  useEffect(() => {
    workbenchRef.current = { input, displayedInput };
  }, [input, displayedInput]);

  useEffect(() => {
    histOpenRef.current = histOpen;
  }, [histOpen]);

  useEffect(() => {
    compactRef.current = compact;
  }, [compact]);

  useEffect(() => {
    shortcutsRef.current = showShortcuts;
  }, [showShortcuts]);

  useEffect(() => {
    if (typeof onHistoryCountChange === "function") {
      onHistoryCountChange(history.length);
    }
  }, [history, onHistoryCountChange]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mq = getCompactMediaQuery();
    if (!mq) return undefined;
    function syncViewport() {
      setCompact(mq.matches);
    }
    syncViewport();
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", syncViewport);
      return () => mq.removeEventListener("change", syncViewport);
    }
    mq.addListener(syncViewport);
    return () => mq.removeListener(syncViewport);
  }, []);

  const clearWorkbench = useCallback(() => {
    setInput(DEFAULT_EXPR);
    setDisplayedInput(DEFAULT_EXPR);
    setAppliedHistoryEntryId(null);
  }, []);

  const handleModeSwitch = useCallback((next) => {
    setCalcMode(next);
    if (next === CALC_PROGRAMMER) {
      setProgRadix(10);
      setProgBits(32);
    }
  }, []);

  const handleRadixPick = useCallback(
    (/** @type {ProgRadix} */ r) => {
      setProgRadix(r);
      clearWorkbench();
    },
    [clearWorkbench]
  );

  const handleWordPick = useCallback(
    (b) => {
      setProgBits(b);
      clearWorkbench();
    },
    [clearWorkbench]
  );

  const appendBoth = useCallback((internalFrag, displayFrag = internalFrag) => {
    const { input: inp, displayedInput: disp } = workbenchRef.current;
    const next = mergeAppendWorkbench(inp, disp, internalFrag, displayFrag);
    setInput(next.input);
    setDisplayedInput(next.displayed);
  }, []);

  const handleNumberClick = useCallback(
    (raw) => {
      const ch =
        calcMode === CALC_PROGRAMMER && typeof raw === "string"
          ? raw.toUpperCase()
          : String(raw);

      if (calcMode === CALC_PROGRAMMER && ch === ".") return;

      if (ch === "." && calcMode !== CALC_PROGRAMMER) {
        if (isIdleBeforeDigit(input, displayedInput)) {
          setInput("0.");
          setDisplayedInput("0.");
          return;
        }
        let i = input.length - 1;
        while (i >= 0 && /[0-9.]/.test(input[i])) i -= 1;
        const segment = input.slice(i + 1);
        if (segment.includes(".")) return;
      }

      if (calcMode === CALC_PROGRAMMER) {
        const test = RADIX_PROG_DIGITS[progRadix];
        if (!test.test(ch)) return;

        const idleDigit = isIdleBeforeDigit(input, displayedInput);

        if (idleDigit && ch !== "0") {
          const nextDigit =
            progRadix === 16 ? String(ch).toUpperCase() : ch;
          if (input === "-" && displayedInput === "-") {
            setDisplayedInput(`-${nextDigit}`);
            setInput(`-${nextDigit}`);
          } else {
            setDisplayedInput(nextDigit);
            setInput(nextDigit);
          }
          return;
        }
        if (idleDigit && ch === "0") return;

        appendBoth(ch);
        return;
      }

      if (/^[0-9]$/.test(ch)) {
        const idleDigit = isIdleBeforeDigit(input, displayedInput);

        if (idleDigit && ch !== "0") {
          if (input === "-" && displayedInput === "-") {
            setDisplayedInput(`-${ch}`);
            setInput(`-${ch}`);
          } else {
            setDisplayedInput(ch);
            setInput(ch);
          }
          return;
        }
        if (idleDigit && ch === "0") return;
      }

      appendBoth(raw);
    },
    [calcMode, progRadix, input, displayedInput, appendBoth]
  );

  /** Standard / scientific — unicode × ÷ */
  const handleSciOperationClick = useCallback(
    (operation) => {
      const internalOp =
        operation === "×" ? "*" : operation === "÷" ? "/" : operation;
      const displayOp =
        operation === "÷" ? "÷" : operation === "×" ? "×" : operation;

      if (internalOp === "-") {
        if (!input || input === "Error" || input === DEFAULT_EXPR) {
          setInput("-");
          setDisplayedInput("-");
          return;
        }
        if (/[+*/%(]$/.test(input)) {
          setInput((p) => (p === "Error" ? "-" : p + "-"));
          setDisplayedInput((p) => (p === "Error" ? "-" : p + displayOp));
          return;
        }
        if (input.endsWith("-")) {
          const before = input[input.length - 2];
          if (/[0-9)]/.test(before ?? "")) {
            setInput((p) => p + "-");
            setDisplayedInput((p) => p + displayOp);
            return;
          }
        }
      }

      if (!input || input === "Error") return;
      if (!/[0-9)]$/.test(input)) return;

      setInput((p) => p + internalOp);
      setDisplayedInput((p) => p + displayOp);
    },
    [input]
  );

  const handleProgOperationClick = useCallback(
    (asciiOp) => {
      if (input === "Error") return;

      if (asciiOp.length === 2) {
        if (!progOperandComplete(input)) return;
        appendBoth(asciiOp);
        return;
      }

      if (asciiOp === "-") {
        if (!input || input === DEFAULT_EXPR) {
          setInput("-");
          setDisplayedInput("-");
          return;
        }
        if (progUnaryMinusContext(input)) {
          appendBoth("-");
          return;
        }
        if (input.endsWith("-")) {
          const core = input.slice(0, -1);
          if (progOperandComplete(core)) {
            appendBoth("-");
            return;
          }
        }
        if (!progOperandComplete(input)) return;
        appendBoth("-");
        return;
      }

      if (asciiOp === "+") {
        if (
          input &&
          progUnaryMinusContext(input) &&
          !progOperandComplete(input)
        ) {
          appendBoth("+");
          return;
        }
        if (!progOperandComplete(input)) return;
        appendBoth("+");
        return;
      }

      if ("*/%^&|".includes(asciiOp)) {
        if (!progOperandComplete(input)) return;
        if (asciiOp === "*" || asciiOp === "/") {
          appendBoth(asciiOp, displayMulDiv(asciiOp));
          return;
        }
        appendBoth(asciiOp);
      }
    },
    [input, appendBoth]
  );

  const handleOperationClick = useCallback(
    (operation) => {
      if (calcMode === CALC_PROGRAMMER) {
        const ascii =
          operation === "×" ? "*" : operation === "÷" ? "/" : operation;
        handleProgOperationClick(ascii);
        return;
      }
      handleSciOperationClick(operation);
    },
    [calcMode, handleProgOperationClick, handleSciOperationClick]
  );

  const clear = useCallback(() => {
    clearWorkbench();
  }, [clearWorkbench]);

  const calculate = useCallback(() => {
    const exprRaw = displayToInternal(displayedInput).trim();
    const exprInternal = exprRaw || input.trim();
    if (!exprInternal || exprInternal === "Error") return;

    const dispShown = normalizeTypedDisplay(displayedInput.trim()) || exprInternal;
    const exprBalanced = closeUnbalancedParentheses(exprInternal);
    const dispBalanced = closeUnbalancedParentheses(dispShown);

    if (calcMode === CALC_PROGRAMMER) {
      const out = evaluateProgrammer(exprBalanced, progRadix, progBits);
      if (!out.ok) {
        setInput(DEFAULT_EXPR);
        setDisplayedInput("Error");
        return;
      }

      const resultStr = formatProgrammerBigInt(out.value, progRadix);
      const histExpr = `${dispBalanced} [${radixLabel(progRadix)}, ${progBits}-bit]`;

      const id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      setHistory((h) => [
        ...h,
        {
          id,
          expression: histExpr,
          result: resultStr,
          rawExpression: dispBalanced,
          at: new Date().toISOString(),
          calcMode: CALC_PROGRAMMER,
          progRadix,
          progBits,
        },
      ]);
      setInput(resultStr);
      setDisplayedInput(resultStr);
      return;
    }

    try {
      const result = evaluate(exprBalanced);
      const n = toFiniteNumber(result);
      if (n === null) {
        setInput(DEFAULT_EXPR);
        setDisplayedInput("Error");
        return;
      }

      const resultStr = formatCalcResult(n);
      const id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

      setHistory((h) => [
        ...h,
        {
          id,
          expression: dispBalanced,
          result: resultStr,
          at: new Date().toISOString(),
          calcMode,
        },
      ]);
      setInput(resultStr);
      setDisplayedInput(resultStr);
    } catch {
      setInput(DEFAULT_EXPR);
      setDisplayedInput("Error");
    }
  }, [calcMode, progRadix, progBits, input, displayedInput]);

  const applyHistoryEntry = useCallback((entry) => {
    const loadExpr = (entry.rawExpression ?? entry.expression).trim();
    if (!loadExpr || loadExpr === "Error") return;

    if (entry.calcMode === CALC_PROGRAMMER) {
      setCalcMode(CALC_PROGRAMMER);
      if (entry.progRadix != null) setProgRadix(entry.progRadix);
      if (entry.progBits != null) setProgBits(entry.progBits);
      const disp = normalizeTypedDisplay(loadExpr);
      setDisplayedInput(disp);
      setInput(displayToInternal(disp));
    } else if (entry.calcMode === CALC_SCIENTIFIC) {
      setCalcMode(CALC_SCIENTIFIC);
      const disp = normalizeTypedDisplay(loadExpr);
      setDisplayedInput(disp);
      setInput(displayToInternal(disp));
    } else {
      setCalcMode(CALC_STANDARD);
      const disp = normalizeTypedDisplay(loadExpr);
      setDisplayedInput(disp);
      setInput(displayToInternal(disp));
    }
    setAppliedHistoryEntryId(entry.id);
  }, []);

  const handleBackspaceClick = useCallback(() => {
    if (displayedInput === "Error" || input === "Error") {
      clearWorkbench();
      return;
    }
    setInput((prev) => {
      const next = prev.slice(0, -1);
      return next === "" ? DEFAULT_EXPR : next;
    });
    setDisplayedInput((prev) => {
      const next = prev.slice(0, -1);
      return next === "" ? DEFAULT_EXPR : next;
    });
  }, [clearWorkbench]);

  const handleExprChange = useCallback(
    (e) => {
      const raw = /** @type {string} */ (e.target?.value ?? "");
      let display = normalizeTypedDisplay(raw);
      if (display.trim() === "") {
        setDisplayedInput(DEFAULT_EXPR);
        setInput(DEFAULT_EXPR);
        setAppliedHistoryEntryId(null);
        return;
      }
      display = collapseLeadingZeroBeforeDigit(display, calcMode, progRadix);
      setDisplayedInput(display);
      setInput(displayToInternal(display));
      setAppliedHistoryEntryId(null);
    },
    [calcMode, progRadix]
  );

  const handleExprFocus = useCallback(() => {
    setDisplayedInput((d) => (d === "Error" ? DEFAULT_EXPR : d));
    setInput((i) => (i === "Error" ? DEFAULT_EXPR : i));
  }, []);

  const focusExpressionField = useCallback(() => {
    exprInputRef.current?.focus();
  }, []);

  const handleExprKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        calculate();
      }
    },
    [calculate]
  );

  const toggleSign = () => {
    if (calcMode === CALC_PROGRAMMER) return;
    if (!input || input === "Error" || isNaN(Number(input))) return;
    setInput((prev) => (prev.startsWith("-") ? prev.slice(1) : `-${prev}`));
    setDisplayedInput((prev) =>
      prev.startsWith("-") ? prev.slice(1) : `-${prev}`
    );
  };

  const clearHistory = useCallback(() => {
    setHistory([]);
    setAppliedHistoryEntryId(null);
  }, []);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === "h") {
        e.preventDefault();
        setHistOpen((o) => !o);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "/") {
        e.preventDefault();
        setShowShortcuts((s) => !s);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "i") {
        const t = /** @type {HTMLElement | null} */ (e.target);
        if (!isEditableSurrogate(t) || t === exprInputRef.current) {
          e.preventDefault();
          exprInputRef.current?.focus();
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    function onEsc(e) {
      if (e.key !== "Escape") return;
      if (shortcutsRef.current) {
        e.preventDefault();
        setShowShortcuts(false);
        return;
      }
      if (compactRef.current && histOpenRef.current) {
        e.preventDefault();
        setHistOpen(false);
      }
    }
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, []);

  useEffect(() => {
    if (appliedHistoryEntryId == null) return;
    const entry = history.find((h) => h.id === appliedHistoryEntryId);
    if (!entry) {
      setAppliedHistoryEntryId(null);
      return;
    }
    const cmp = (entry.rawExpression ?? entry.expression).trim();
    if (displayedInput.trim() !== cmp) setAppliedHistoryEntryId(null);
  }, [appliedHistoryEntryId, displayedInput, history]);

  const cardClass =
    calcMode === CALC_SCIENTIFIC
      ? "calculator-card calculator-card--scientific"
      : calcMode === CALC_PROGRAMMER
        ? "calculator-card calculator-card--programmer"
        : "calculator-card";

  const copyText = displayedInput === "Error" ? "" : displayedInput;

  const layoutClass = [
    "calculator-layout",
    compact ? "calculator-layout--narrow" : "",
    !compact && !histOpen ? "calculator-layout--history-collapsed" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const calculatorPageClass = [
    "calculator-page",
    calcPageAlign === "left"
      ? "calculator-page--align-left"
      : "calculator-page--align-middle",
  ].join(" ");

  const historyAsideClass = [
    "history-shell",
    histOpen ? "history-shell--open" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const historyBadge =
    history.length === 0
      ? "0"
      : history.length > 99
        ? "99+"
        : String(history.length);

  return (
    <div className={calculatorPageClass}>
      {!desktopDockTools ? (
      <div className="calc-page-toolbar" role="toolbar" aria-label="Calculator tools">
        <button
          type="button"
          role="switch"
          aria-checked={darkMode}
          aria-label="Color theme"
          className="toolbar-btn"
          onClick={() => setDarkMode((d) => !d)}
        >
          {darkMode ? (
            <Moon
              size={16}
              strokeWidth={2.25}
              aria-hidden
              className="toolbar-btn__icon"
            />
          ) : (
            <Sun
              size={16}
              strokeWidth={2.25}
              aria-hidden
              className="toolbar-btn__icon"
            />
          )}
          <span>{darkMode ? "Dark" : "Light"}</span>
        </button>
        {!compact ? (
          <button
            type="button"
            className="toolbar-btn"
            aria-label={`Calculator layout: ${calcPageAlign === "left" ? "left aligned" : "centered"}. Toggle left or middle.`}
            onClick={() =>
              setCalcPageAlign((p) => (p === "left" ? "middle" : "left"))
            }
          >
            {calcPageAlign === "left" ? (
              <AlignLeft
                size={16}
                strokeWidth={2.25}
                aria-hidden
                className="toolbar-btn__icon"
              />
            ) : (
              <AlignCenterHorizontal
                size={16}
                strokeWidth={2.25}
                aria-hidden
                className="toolbar-btn__icon"
              />
            )}
            <span>{calcPageAlign === "left" ? "Left" : "Middle"}</span>
          </button>
        ) : null}
        <button
          type="button"
          className={`toolbar-btn${compact ? " toolbar-btn--accent" : ""}`}
          aria-expanded={histOpen}
          aria-controls="calc-history-region"
          onClick={() => setHistOpen((o) => !o)}
        >
          History
          <span className="toolbar-btn__badge" data-empty={history.length === 0}>
            {historyBadge}
          </span>
        </button>
        {!compact ? (
          <button
            type="button"
            className="toolbar-btn"
            onClick={() => setShowShortcuts((s) => !s)}
          >
            Shortcuts
          </button>
        ) : null}
        <p className="toolbar-hint-inline">
          Focus expression · <kbd>Enter</kbd> evaluate ·{" "}
          <kbd title="Escape">Esc</kbd> close sheet · <kbd>Alt</kbd>
          +<kbd>H</kbd> history · <kbd>Ctrl</kbd>/<kbd>⌘</kbd>
          <kbd>/</kbd> shortcuts
        </p>
      </div>
      ) : null}

      {compact && histOpen ? (
        <button
          type="button"
          className="history-backdrop"
          aria-label="Close history"
          onClick={() => setHistOpen(false)}
        />
      ) : null}

      {showShortcuts ? (
        <div
          className="shortcuts-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="calc-shortcuts-title"
        >
          <button
            type="button"
            className="shortcuts-overlay__backdrop"
            aria-label="Close shortcuts"
            onClick={() => setShowShortcuts(false)}
          />
          <div className="shortcuts-sheet">
            <button
              type="button"
              className="shortcuts-sheet__close"
              aria-label="Close"
              onClick={() => setShowShortcuts(false)}
            >
              ×
            </button>
            <h2 id="calc-shortcuts-title">Keyboard &amp; shortcuts</h2>
            <dl>
              <dt>Expression</dt>
              <dd>
                Click the large expression field (or <kbd>Ctrl</kbd> /{" "}
                <kbd>⌘</kbd> + <kbd>I</kbd>) and type. Use <kbd>*</kbd> and{" "}
                <kbd>/</kbd> on the keyboard — they become × and ÷.
              </dd>
              <dt>Evaluate</dt>
              <dd>
                <kbd>Enter</kbd> (when the expression field is focused) or the{" "}
                <kbd>=</kbd> button.
              </dd>
              <dt>Theme</dt>
              <dd>
                Left rail on desktop or the <strong>Light</strong> /{" "}
                <strong>Dark</strong> button on the top toolbar on phones.
              </dd>
              <dt>Layout</dt>
              <dd>
                On desktop only: <strong>Left</strong> or <strong>Middle</strong>
                aligns the calculator in the window. Tap the corresponding
                icon button on the left rail. Phones use a single-column layout,
                so this control is omitted there.
              </dd>
              <dt>History</dt>
              <dd>
                Left rail on desktop, toolbar on phones, or{" "}
                <kbd>Alt</kbd> + <kbd>H</kbd>. On small screens it opens a
                bottom sheet; <kbd>Esc</kbd> or the dimmed backdrop closes it.
              </dd>
              <dt>Shortcuts list</dt>
              <dd>
                This panel: <kbd>Ctrl</kbd> / <kbd>⌘</kbd> + <kbd>/</kbd>
              </dd>
              <dt>Escape</dt>
              <dd>
                Closes shortcuts or the mobile history sheet (does not clear
                the expression).
              </dd>
            </dl>
          </div>
        </div>
      ) : null}

      <div className={layoutClass}>
        <section
          className={cardClass}
          aria-label="Calculator"
        >
          <div className="calculator-card__header">
            <span className="calculator-card__title">Calculator</span>
            <CopyButton text={copyText} />
          </div>

          <div className="calc-mode-switch" role="tablist" aria-label="Calculator mode">
            <button
              type="button"
              role="tab"
              aria-selected={calcMode === CALC_STANDARD}
              className={`calc-mode-switch__btn${calcMode === CALC_STANDARD ? " is-active" : ""}`}
              onClick={() => handleModeSwitch(CALC_STANDARD)}
            >
              Standard
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={calcMode === CALC_SCIENTIFIC}
              className={`calc-mode-switch__btn${calcMode === CALC_SCIENTIFIC ? " is-active" : ""}`}
              onClick={() => handleModeSwitch(CALC_SCIENTIFIC)}
            >
              Scientific
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={calcMode === CALC_PROGRAMMER}
              className={`calc-mode-switch__btn${calcMode === CALC_PROGRAMMER ? " is-active" : ""}`}
              onClick={() => handleModeSwitch(CALC_PROGRAMMER)}
            >
              Programmer
            </button>
          </div>

          {calcMode === CALC_PROGRAMMER ? (
            <div className="programmer-toolbar">
              <div className="programmer-toolbar__group" role="group" aria-label="Number base">
                <span className="programmer-toolbar__label">Base</span>
                {[
                  [2, "BIN"],
                  [8, "OCT"],
                  [10, "DEC"],
                  [16, "HEX"],
                ].map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    className={`programmer-toolbar__chip${progRadix === v ? " is-active" : ""}`}
                    onClick={() => handleRadixPick(/** @type {ProgRadix} */ (v))}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="programmer-toolbar__group" role="group" aria-label="Word size">
                <span className="programmer-toolbar__label">Bits</span>
                {[8, 16, 32, 64].map((b) => (
                  <button
                    key={b}
                    type="button"
                    className={`programmer-toolbar__chip${progBits === b ? " is-active" : ""}`}
                    onClick={() => handleWordPick(b)}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div
            className="calculator-screen"
            title="Click here to type from the keyboard"
            onClick={focusExpressionField}
          >
            {calcMode === CALC_SCIENTIFIC || calcMode === CALC_PROGRAMMER ? (
              <span className="calculator-screen__mode-hint">
                {calcMode === CALC_SCIENTIFIC
                  ? "Radians · type inside func(…) — Enter or = closes missing )"
                  : `${radixLabel(progRadix)} · ${progBits}-bit · unsigned wrap`}
              </span>
            ) : null}
            <input
              ref={exprInputRef}
              id={exprInputId}
              className="calculator-screen__input"
              type="text"
              dir="ltr"
              inputMode="text"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="off"
              aria-label={`Expression (${calcMode})`}
              value={displayedInput}
              onChange={handleExprChange}
              onFocus={handleExprFocus}
              onKeyDown={handleExprKeyDown}
            />
          </div>

          {calcMode === CALC_SCIENTIFIC ? (
            <>
              <div className="calculator-buttons calculator-buttons--scientific">
                {SCI_PAD_BUTTONS.map(({ insert, label, title }) => (
                  <Button
                    key={insert}
                    variant="outline-primary"
                    onClick={() => appendBoth(insert)}
                    title={title}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </>
          ) : null}

          {calcMode === CALC_PROGRAMMER ? (
            <div className="calculator-buttons calculator-buttons--prog-ops">
              <Button variant="outline-primary" onClick={() => handleProgOperationClick("&")}>
                AND
              </Button>
              <Button variant="outline-primary" onClick={() => handleProgOperationClick("|")}>
                OR
              </Button>
              <Button variant="outline-primary" onClick={() => handleProgOperationClick("^")}>
                XOR
              </Button>
              <Button variant="outline-primary" onClick={() => appendBoth("~")}>
                NOT
              </Button>
              <Button variant="outline-primary" onClick={() => handleProgOperationClick("<<")}>
                {"<<"}
              </Button>
              <Button variant="outline-primary" onClick={() => handleProgOperationClick(">>")}>
                {">>"}
              </Button>
              <Button variant="outline-secondary" disabled>
                +/-
              </Button>
              <Button variant="outline-primary" onClick={() => handleProgOperationClick("%")}>
                MOD
              </Button>
              {progRadix === 16 ? (
                <>
                  <Button variant="outline-primary" onClick={() => handleNumberClick("A")}>
                    A
                  </Button>
                  <Button variant="outline-primary" onClick={() => handleNumberClick("B")}>
                    B
                  </Button>
                  <Button variant="outline-primary" onClick={() => handleNumberClick("C")}>
                    C
                  </Button>
                  <Button variant="outline-primary" onClick={() => handleNumberClick("D")}>
                    D
                  </Button>
                  <Button variant="outline-primary" onClick={() => handleNumberClick("E")}>
                    E
                  </Button>
                  <Button variant="outline-primary" onClick={() => handleNumberClick("F")}>
                    F
                  </Button>
                </>
              ) : null}
            </div>
          ) : null}

          <div
            className={`calculator-buttons${calcMode === CALC_PROGRAMMER ? " calculator-buttons--programmer-num" : ""}`}
          >
            <Button variant="outline-primary" onClick={() => appendBoth("(")}>
              (
            </Button>
            <Button variant="outline-primary" onClick={() => appendBoth(")")}>
              )
            </Button>
            <Button variant="outline-primary" onClick={() => handleOperationClick("%")}>
              %
            </Button>
            <Button variant="outline-danger" onClick={clear}>
              AC
            </Button>

            <Button variant="outline-primary" onClick={() => handleNumberClick("7")}>
              7
            </Button>
            <Button variant="outline-primary" onClick={() => handleNumberClick("8")}>
              8
            </Button>
            <Button variant="outline-primary" onClick={() => handleNumberClick("9")}>
              9
            </Button>
            <Button variant="primary" onClick={() => handleOperationClick("÷")}>
              ÷
            </Button>

            <Button variant="outline-primary" onClick={() => handleNumberClick("4")}>
              4
            </Button>
            <Button variant="outline-primary" onClick={() => handleNumberClick("5")}>
              5
            </Button>
            <Button variant="outline-primary" onClick={() => handleNumberClick("6")}>
              6
            </Button>
            <Button variant="primary" onClick={() => handleOperationClick("×")}>
              ×
            </Button>

            <Button variant="outline-primary" onClick={() => handleNumberClick("1")}>
              1
            </Button>
            <Button variant="outline-primary" onClick={() => handleNumberClick("2")}>
              2
            </Button>
            <Button variant="outline-primary" onClick={() => handleNumberClick("3")}>
              3
            </Button>
            <Button variant="primary" onClick={() => handleOperationClick("-")}>
              -
            </Button>

            <Button variant="outline-primary" onClick={() => handleNumberClick("0")}>
              0
            </Button>
            <Button
              variant="outline-primary"
              onClick={() => handleNumberClick(".")}
              disabled={calcMode === CALC_PROGRAMMER}
            >
              .
            </Button>
            <Button
              variant="outline-primary"
              onClick={toggleSign}
              disabled={calcMode === CALC_PROGRAMMER}
            >
              +/-
            </Button>
            <Button variant="primary" onClick={() => handleOperationClick("+")}>
              +
            </Button>

            <Button variant="outline-secondary" onClick={handleBackspaceClick}>
              ←
            </Button>
            <Button variant="outline-success" onClick={calculate}>
              =
            </Button>
          </div>
        </section>

        <aside
          id="calc-history-region"
          className={historyAsideClass}
          aria-label="Calculation history"
          aria-hidden={compact ? !histOpen : false}
        >
          <History
            history={history}
            clearHistory={clearHistory}
            appliedEntryId={appliedHistoryEntryId}
            onApplyEntry={applyHistoryEntry}
          />
        </aside>
      </div>
    </div>
  );
}
