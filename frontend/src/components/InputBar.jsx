import { useState } from 'react';
import styles from './InputBar.module.css';

export default function InputBar({ onSend, onButtonClick, conversationId, buttons = [], disabled }) {
  const [text, setText] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim() || disabled) return;
    onSend(text.trim());
    setText('');
  }

  function handleQuickButton(btn) {
    if (disabled) return;
    // Use the dedicated button-click endpoint so the backend can route
    // the click through the dialogue engine's button handler. Previously
    // this sent "[button:id]" as a text message, which was a bug.
    if (onButtonClick) {
      onButtonClick(conversationId, btn.id);
    } else {
      // Fallback for backward compat: send as text
      onSend(`[button:${btn.id}]`);
    }
  }

  return (
    <div className={styles.container}>
      {buttons.length > 0 && (
        <div className={styles.quickButtons}>
          {buttons.map(btn => (
            <button
              key={btn.id}
              type="button"
              className={styles.quickButton}
              onClick={() => handleQuickButton(btn)}
              disabled={disabled}
            >
              {btn.title}
            </button>
          ))}
        </div>
      )}

      <form className={styles.form} onSubmit={handleSubmit}>
        <input
          type="text"
          className={styles.input}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Digite uma mensagem..."
          disabled={disabled}
        />
        <button
          type="submit"
          className={styles.sendButton}
          disabled={disabled || !text.trim()}
        >
          {disabled ? '...' : 'Enviar'}
        </button>
      </form>
    </div>
  );
}
