import React from "react";
import Button from "react-bootstrap/Button";
import "bootstrap/dist/css/bootstrap.min.css";
import "./calculator.scss";

export default function History({ history, clearHistory }) {
  return (
    <div className="history-panel">
      <h3>History</h3>
      <Button
        variant="outline-danger"
        size="sm"
        className="clear-history-btn"
        onClick={clearHistory}
      >
        Clear History
      </Button>
      <ul className="history-list">
        {history.map((entry, index) => (
          <li key={index}>{entry}</li>
        ))}
      </ul>
    </div>
  );
}
