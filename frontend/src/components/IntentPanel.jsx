import { useConversation } from '../context/ConversationContext';
import styles from './IntentPanel.module.css';

export default function IntentPanel({ intents = [], winner, score }) {
  const { state, dispatch } = useConversation();
  const { intentPanelOpen } = state;

  if (!intents || intents.length === 0) {
    return null;
  }

  // Sort by score descending
  const sorted = [...intents].sort((a, b) => b.score - a.score);

  return (
    <div className={styles.container}>
      <button 
        className={styles.header}
        onClick={() => dispatch({ type: 'TOGGLE_INTENT_PANEL' })}
      >
        <span>🎯 Intent Classification</span>
        <span className={styles.toggle}>{intentPanelOpen ? '▼' : '▶'}</span>
      </button>
      
      {intentPanelOpen && (
        <div className={styles.list}>
          {sorted.map((item, i) => {
            const isWinner = item.intent === winner;
            const pct = Math.round(item.score * 100);
            
            return (
              <div key={item.intent} className={styles.item}>
                <div className={styles.itemHeader}>
                  <span className={styles.icon}>{isWinner ? '🎯' : '○'}</span>
                  <span className={`${styles.name} ${isWinner ? styles.winner : ''}`}>
                    {item.intent}
                  </span>
                  <span className={styles.pct}>{pct}%</span>
                </div>
                <div className={styles.barContainer}>
                  <div 
                    className={`${styles.bar} ${isWinner ? styles.winnerBar : ''}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}