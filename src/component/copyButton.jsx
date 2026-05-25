import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCopy } from "@fortawesome/free-solid-svg-icons";

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const value = text ?? "";
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch (err) {
      console.error("Failed to copy: ", err);
    }
  };

  const disabled = !text;

  return (
    <button
      type="button"
      className="calculator-copy-btn"
      onClick={handleCopy}
      disabled={disabled}
      title={disabled ? "Nothing to copy" : "Copy current expression"}
      aria-label="Copy current expression to clipboard"
    >
      <FontAwesomeIcon icon={faCopy} className="calculator-copy-btn__icon" />
      <span>{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}

export default CopyButton;
