import { useState } from 'react';
import styles from './InputBar.module.css';

export default function InputBar({ onSend, disabled, messages }) {
  const [text, setText] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim() || disabled) return;
    onSend(text.trim());
    setText('');
  }

  // Find last bot message with buttons
  const lastBotMsg = [...messages].reverse().find(m => m.direction === 'outgoing' && m.buttons?.length > 0);
  const buttons = lastBotMsg?.buttons || [];

  return (
    <div className={styles.container}>
      {buttons.length > 0 && (
        <div className={styles.quickButtons}>
          {buttons.map(btn => (
            <button
              key={btn.id}
              className={styles.quickButton}
              onClick={() => onSend(`[button:${btn.id}]`)}
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