import React, { useState } from "react";
import Button from "react-bootstrap/Button";

import History from "./history"; // Import the new History component
import "bootstrap/dist/css/bootstrap.min.css";
import "./calculator.scss";

export default function Calculator() {
  const [input, setInput] = useState("");
  const [displayedInput, setDisplayedInput] = useState("");
  const [history, setHistory] = useState([]); // Track history

  const handleNumberClick = (number) => {
    if (number === "." && input.endsWith(".")) {
      return; // Prevent multiple decimals
    }
    setInput((prevInput) => prevInput + number);
    setDisplayedInput((prevDisplayedInput) => prevDisplayedInput + number);
  };

  const handleOperationClick = (operation) => {
    if (!input || /[\+\-\*\/]$/.test(input)) {
      return; // Prevent multiple consecutive operations
    }

    let updatedOperation = operation;
    if (operation === "×") updatedOperation = "*";
    if (operation === "÷") updatedOperation = "/";

    setInput((prevInput) => prevInput + updatedOperation);
    setDisplayedInput((prevDisplayedInput) => prevDisplayedInput + operation);
  };

  const clear = () => {
    setInput("");
    setDisplayedInput("");
  };

  const handleBackspaceClick = () => {
    setInput((prevInput) => prevInput.slice(0, -1));
    setDisplayedInput((prevDisplayedInput) => prevDisplayedInput.slice(0, -1));
  };

  const calculate = () => {
    try {
      const result = new Function(`return ${input}`)(); // Evaluate the input
      const newHistoryEntry = `${displayedInput} = ${result}`;

      // Update history with a new entry (only the last calculation result)
      setHistory((prevHistory) => [...prevHistory, newHistoryEntry]);

      // Reset input for subsequent calculations
      setInput(result.toString());
      setDisplayedInput(result.toString());
    } catch (error) {
      setInput("");
      setDisplayedInput("");
    }
  };

  const toggleSign = () => {
    if (!input || isNaN(Number(input))) return; // Only allow toggling numbers
    setInput((prevInput) =>
      prevInput.startsWith("-") ? prevInput.slice(1) : `-${prevInput}`
    );
    setDisplayedInput((prevDisplayedInput) =>
      prevDisplayedInput.startsWith("-")
        ? prevDisplayedInput.slice(1)
        : `-${prevDisplayedInput}`
    );
  };

  const clearHistory = () => {
    setHistory([]); // Clear history
  };

  return (
    <div className="calculator-container">
      {/* Calculator */}
      <div className="body">
        <div className="calculator-structure">
          <h1>Simple Calculator</h1>

          <div className="calculator-screen">{displayedInput || "0"}</div>

          <div className="calculator-buttons">
            <Button variant="outline-primary" onClick={() => handleNumberClick("(")}>
              (
            </Button>
            <Button variant="outline-primary" onClick={() => handleNumberClick(")")}>
              )
            </Button>
            <Button variant="outline-primary" onClick={() => handleNumberClick("%")}>
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
            <Button variant="outline-primary" onClick={() => handleNumberClick(".")}>
              .
            </Button>
            <Button variant="outline-primary" onClick={toggleSign}>
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
        </div>
      </div>

       {/* History Panel */}
       {/* <div className="calculator-container">
        <History history={history} clearHistory={clearHistory}/>
       </div> */}
    </div>
  );
}