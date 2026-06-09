import { useConversation } from '../context/ConversationContext';
import styles from './ContextPanel.module.css';

export default function ContextPanel({ variables }) {
  const { state, dispatch } = useConversation();
  const { contextPanelOpen } = state;

  if (!variables) return null;

  return (
    <div className={styles.container}>
      <button 
        className={styles.header}
        onClick={() => dispatch({ type: 'TOGGLE_CONTEXT_PANEL' })}
      >
        <span>📋 Context Variables</span>
        <span className={styles.toggle}>{contextPanelOpen ? '▼' : '▶'}</span>
      </button>
      
      {contextPanelOpen && (
        <pre className={styles.json}>
          {JSON.stringify(variables, null, 2)}
        </pre>
      )}
    </div>
  );
}