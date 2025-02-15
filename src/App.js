import React,{ useState, useEffect } from 'react';
import Calculator from './component/calculator';
import './App.css';

function App() {

  // Dark mode state and toggle function
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem("darkMode") === "true";
  });

  useEffect(() => {
    localStorage.setItem("darkMode", darkMode);
  }, [darkMode]);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };
  

  return (
    <div className="App">
      <div className={darkMode ? "dark-mode" : "light-mode"}>
        <button onClick={toggleDarkMode}>
          {darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
        </button>
        <Calculator />
      </div>
    </div>
  );
}

export default App;