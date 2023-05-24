import './calculator.scss';
import React, { useState } from 'react';
import Button from 'react-bootstrap/Button';
import FloatingLabel from 'react-bootstrap/FloatingLabel';
import Form from 'react-bootstrap/Form';

import 'bootstrap/dist/css/bootstrap.min.css';

export default function Calculator() {
  const [input, setInput] = useState('');
  const [displayedInput, setDisplayedInput] = useState('');

  const handleNumberClick = (number) => {
    if (number === '.' && input.includes('.')) {
      // Decimal point already present, ignore
      return;
    }
  
    setInput((prevInput) => prevInput + number.toString());
    setDisplayedInput((prevDisplayedInput) => prevDisplayedInput + number.toString());
  };
  
  const handleBackspaceClick = () => {
    setInput((prevInput) => prevInput.slice(0, -1));
    setDisplayedInput((prevDisplayedInput) => prevDisplayedInput.slice(0, -1));
  };

  const handleOperationClick = (operation) => {
    if (input.trim() === '') {
      // No input yet, ignore the operation
      return;
    }
  
    // Remove multiple consecutive operations
    let updatedInput = input;
    while (updatedInput.endsWith('+') || updatedInput.endsWith('-') || updatedInput.endsWith('*') || updatedInput.endsWith('/')) {
      updatedInput = updatedInput.slice(0, -1);
    }
    
    setInput(updatedInput + operation);
    setDisplayedInput((prevDisplayedInput) => {
      if (prevDisplayedInput.endsWith('=')) {
        return updatedInput + operation;
      } else {
        return prevDisplayedInput + operation;
      }
    });
  };
  
  const clear = () => {
    setInput('');
    setDisplayedInput('');
  };

  const calculate = () => {
    if (input.trim() === '') {
      // No input yet, ignore the calculation
      return;
    }
  
    try {
      const result = new Function('return ' + input)();
      if (isNaN(result) || !isFinite(result)) {
        // Invalid calculation result
        setInput('Error');
        setDisplayedInput('Error');
      } else {
        setInput(result.toString());
        setDisplayedInput((prevDisplayedInput) => prevDisplayedInput + '=' + result.toString());
      }
    } catch (error) {
      // Error in evaluation
      setInput('Error');
      setDisplayedInput('Error');
    }
  };

  const toggleSign = () => {
    setInput((prevInput) => {
      if (prevInput.startsWith('-')) {
        return prevInput.slice(1);
      } else {
        return '-' + prevInput;
      }
    });
  };
  
  return (
    <div className="body">
      <div className="calculator-structure">
        <h1>Simple Calculator App</h1>

        <FloatingLabel controlId="floatingInput" label={displayedInput || '0'} className="mb-3">
          <Form.Control
            className='calculator-screen'
            type="text"
            placeholder="Input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </FloatingLabel>

        <div className="calculator-buttons">
          <Button variant="outline-primary" onClick={() => handleNumberClick('(')}>(</Button>
          <Button variant="outline-primary" onClick={() => handleNumberClick(')')}>)</Button>
          <Button variant="outline-primary" onClick={() => handleNumberClick('%')}>%</Button>
          <Button variant="outline-danger" onClick={clear}>AC</Button>
          <Button variant="outline-primary" onClick={() => handleNumberClick(7)}>7</Button>
          <Button variant="outline-primary" onClick={() => handleNumberClick(8)}>8</Button>
          <Button variant="outline-primary" onClick={() => handleNumberClick(9)}>9</Button>
          <Button variant="primary" onClick={() => handleOperationClick('+')}>+</Button>
          <Button variant="outline-primary" onClick={() => handleNumberClick(4)}>4</Button>
          <Button variant="outline-primary" onClick={() => handleNumberClick(5)}>5</Button>
          <Button variant="outline-primary" onClick={() => handleNumberClick(6)}>6</Button>
          <Button variant="primary" onClick={() => handleOperationClick('-')}>-</Button>
          <Button variant="outline-primary" onClick={() => handleNumberClick(1)}>1</Button>
          <Button variant="outline-primary" onClick={() => handleNumberClick(2)}>2</Button>
          <Button variant="outline-primary" onClick={() => handleNumberClick(3)}>3</Button>
          <Button variant="primary" onClick={() => handleOperationClick('*')}>×</Button>
          <Button variant="outline-primary" onClick={() => handleNumberClick(0)}>0</Button>
          <Button variant="outline-primary" onClick={() => handleNumberClick('.')}>.</Button>
          <Button variant="outline-primary" onClick={toggleSign}>+/-</Button> 
          <Button variant="primary" onClick={() => handleOperationClick('/')}>÷</Button>
          <Button variant="outline-secondary" onClick={handleBackspaceClick}>←</Button>
          <Button variant="outline-success" onClick={calculate}>=</Button>
        </div>
      </div>
    </div>
  );
}
