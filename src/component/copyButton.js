import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCopy } from '@fortawesome/free-solid-svg-icons';

function CopyButton({ text }) {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      alert('Text copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <button onClick={handleCopy}>
        <FontAwesomeIcon icon={faCopy} style={{ marginRight: 8 }} />
        Copy
      </button>
    </div>
  );
}

export default CopyButton;
