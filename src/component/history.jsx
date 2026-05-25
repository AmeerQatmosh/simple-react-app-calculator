import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { Trash2 } from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCopy, faTimeline } from "@fortawesome/free-solid-svg-icons";
import "./history.scss";

function HistoryCopyChip({ text, variant, ariaLabel }) {
  const [copied, setCopied] = useState(false);

  const copy = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (_) {
      /* ignore */
    }
  };

  return (
    <button
      type="button"
      className={`history-entry__mini-copy history-entry__mini-copy--${variant}`}
      title={copied ? "Copied" : ariaLabel}
      aria-label={ariaLabel}
      onClick={copy}
    >
      <FontAwesomeIcon icon={faCopy} className="history-entry__mini-copy-icon" />
      <span aria-hidden>{variant === "expr" ? "Eq" : "="}</span>
      {copied ? (
        <span className="visually-hidden">Copied to clipboard</span>
      ) : null}
    </button>
  );
}

function formatHistoryTime(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "";
  }
}

function entryModeLabel(entry) {
  if (entry.calcMode === "programmer" && entry.progRadix != null) {
    const r =
      entry.progRadix === 2
        ? "BIN"
        : entry.progRadix === 8
          ? "OCT"
          : entry.progRadix === 16
            ? "HEX"
            : "DEC";
    return `PROG · ${r} · ${entry.progBits ?? "?"}b`;
  }
  if (entry.calcMode === "scientific") return "Scientific";
  if (entry.calcMode === "standard") return "Standard";
  return entry.calcMode ?? "—";
}

/** Equation text for display / load (not the decorated history line). */
function entryExpressionForLoad(entry) {
  if (entry.rawExpression) return entry.rawExpression;
  if (entry.calcMode === "programmer" && typeof entry.expression === "string") {
    const i = entry.expression.indexOf("[");
    if (i !== -1) return entry.expression.slice(0, i).trim();
  }
  return entry.expression;
}

export default function History({
  history,
  clearHistory,
  appliedEntryId,
  onApplyEntry,
}) {
  const ordered = useMemo(() => [...history].reverse(), [history]);

  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const clearConfirmCancelRef = useRef(null);

  const entryCount =
    typeof history.length === "number" ? history.length : ordered.length;

  const openClearConfirm = useCallback(() => {
    if (entryCount === 0) return;
    setClearConfirmOpen(true);
  }, [entryCount]);

  const closeClearConfirm = useCallback(() => {
    setClearConfirmOpen(false);
  }, []);

  const executeClearAll = useCallback(() => {
    if (entryCount === 0) return;
    clearHistory();
    setClearConfirmOpen(false);
  }, [entryCount, clearHistory]);

  useEffect(() => {
    if (entryCount === 0) setClearConfirmOpen(false);
  }, [entryCount]);

  useEffect(() => {
    if (!clearConfirmOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setClearConfirmOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    const t = window.setTimeout(() => {
      clearConfirmCancelRef.current?.focus({ preventScroll: true });
    }, 0);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [clearConfirmOpen]);

  const onRowActivate = useCallback(
    (entry) => () => {
      onApplyEntry(entry);
    },
    [onApplyEntry]
  );

  const onRowKeyDown = useCallback(
    (entry) => (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onApplyEntry(entry);
      }
    },
    [onApplyEntry]
  );

  const clearEntriesWord = entryCount === 1 ? "entry" : "entries";

  return (
    <>
      <aside className="history-panel" aria-label="Calculation history">
      <div className="history-panel__head">
        <div className="history-panel__title-row">
          <h2 className="history-panel__title">History</h2>
          <div className="history-panel__actions">
            <span className="history-panel__count" aria-live="polite">
              {history.length === 0
                ? "Empty"
                : `${history.length} ${history.length === 1 ? "step" : "steps"}`}
            </span>
            <button
              type="button"
              className="history-panel__clear"
              onClick={openClearConfirm}
              disabled={history.length === 0}
              title="Clear all history"
              aria-label="Clear all history"
            >
              <Trash2
                className="history-panel__clear-icon"
                size={14}
                strokeWidth={2.25}
                aria-hidden
              />
              <span>Clear</span>
            </button>
          </div>
        </div>
      </div>

      <div
        className="history-panel__scroll"
        role="log"
        aria-relevant="additions"
        aria-label="Past calculations"
      >
        {ordered.length === 0 ? (
          <div className="history-panel__empty">
            <div className="history-panel__empty-icon" aria-hidden>
              <FontAwesomeIcon icon={faTimeline} />
            </div>
            <p className="history-panel__empty-title">No calculations yet</p>
            <p className="history-panel__empty-hint">
              Press <kbd>=</kbd> or <kbd>Enter</kbd> in the expression field to
              record a step. Tap any step to reopen it in the calculator and
              continue.
            </p>
          </div>
        ) : (
          <ul className="history-timeline">
            {ordered.map((entry, index) => {
              const isApplied = appliedEntryId === entry.id;
              const stepNum = ordered.length - index;
              const eq = entryExpressionForLoad(entry);
              return (
                <li key={entry.id} className="history-timeline__item">
                  <div className="history-timeline__axis" aria-hidden>
                    <span className="history-timeline__node" />
                    {index < ordered.length - 1 ? (
                      <span className="history-timeline__connector" />
                    ) : null}
                  </div>
                  <article
                    className={`history-entry${isApplied ? " history-entry--applied" : ""}`}
                  >
                    <header className="history-entry__head">
                      <span className="history-entry__step">Step {stepNum}</span>
                      <span className="history-entry__mode" title="Calculator mode">
                        {entryModeLabel(entry)}
                      </span>
                      <time
                        className="history-entry__time"
                        dateTime={entry.at}
                        title={entry.at}
                      >
                        {formatHistoryTime(entry.at)}
                      </time>
                      <div className="history-entry__chips">
                        <HistoryCopyChip
                          variant="expr"
                          text={eq}
                          ariaLabel="Copy equation only"
                        />
                        <HistoryCopyChip
                          variant="result"
                          text={entry.result}
                          ariaLabel="Copy result only"
                        />
                      </div>
                    </header>
                    <div
                      className="history-entry__load-zone"
                      role="button"
                      tabIndex={0}
                      aria-label={`Load ${eq} into calculator`}
                      onClick={onRowActivate(entry)}
                      onKeyDown={onRowKeyDown(entry)}
                    >
                      <p className="history-entry__expr">{eq}</p>
                      {entry.calcMode === "programmer" &&
                      entry.expression &&
                      entry.expression !== eq ? (
                        <p className="history-entry__expr-note">{entry.expression}</p>
                      ) : null}
                      <div className="history-entry__outcome">
                        <span className="history-entry__equals" aria-hidden="true">
                          =
                        </span>
                        <span className="history-entry__result">{entry.result}</span>
                      </div>
                      <span className="history-entry__hint">
                        Tap to edit in calculator
                      </span>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>

      {clearConfirmOpen ? (
        <div className="history-clear-confirm-overlay" role="presentation">
          <button
            type="button"
            className="history-clear-confirm-overlay__backdrop"
            aria-label="Cancel"
            onClick={closeClearConfirm}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="history-clear-confirm-title"
            className="history-clear-confirm-sheet"
          >
            <div className="history-clear-confirm-sheet__icon" aria-hidden>
              <Trash2 size={22} strokeWidth={2.25} />
            </div>
            <h3 id="history-clear-confirm-title" className="history-clear-confirm-sheet__title">
              Clear all history?
            </h3>
            <p className="history-clear-confirm-sheet__body">
              This will permanently remove{" "}
              <strong>
                {entryCount} {clearEntriesWord}
              </strong>{" "}
              from your timeline. You cannot undo this.
            </p>
            <div className="history-clear-confirm-sheet__actions">
              <button
                ref={clearConfirmCancelRef}
                type="button"
                className="history-clear-confirm-sheet__btn history-clear-confirm-sheet__btn--secondary"
                onClick={closeClearConfirm}
              >
                Cancel
              </button>
              <button
                type="button"
                className="history-clear-confirm-sheet__btn history-clear-confirm-sheet__btn--danger"
                onClick={executeClearAll}
              >
                <Trash2 size={15} strokeWidth={2.25} aria-hidden />
                Clear all
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
