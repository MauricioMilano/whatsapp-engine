import { useConversation } from '../context/ConversationContext';
import styles from './ConversationList.module.css';

export default function ConversationList({ onSelectConversation }) {
  const { state, dispatch } = useConversation();
  const { storedConversations, dialogueInfo, isLoading, error } = state;

  async function handleNewConversation() {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const userId = `debug-${crypto.randomUUID().slice(0, 8)}`;
      const { createConversation, getMessages } = await import('../api/simulator.js');
      const conv = await createConversation(userId);
      dispatch({ type: 'ADD_STORED_CONVERSATION', payload: conv });
      onSelectConversation(conv.id);
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err.message });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }

  function formatTime(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function timeAgo(isoString) {
    if (!isoString) return '';
    const now = Date.now();
    const then = new Date(isoString).getTime();
    const diff = now - then;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'agora';
    if (minutes < 60) return `${minutes}min atrás`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h atrás`;
    return `${Math.floor(hours / 24)}d atrás`;
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>☕ Café Bot Debug</h1>
        {dialogueInfo && (
          <span className={styles.info}>{dialogueInfo.name} v{dialogueInfo.version}</span>
        )}
      </header>

      {error && <div className={styles.error}>{error}</div>}

      <button 
        className={styles.newButton}
        onClick={handleNewConversation}
        disabled={isLoading}
      >
        {isLoading ? 'Criando...' : '+ Nova Conversa'}
      </button>

      <section className={styles.listSection}>
        <h2>Conversas Recentes</h2>
        
        {storedConversations.length === 0 ? (
          <p className={styles.empty}>Nenhuma conversa ainda. Clique acima para começar!</p>
        ) : (
          <ul className={styles.list}>
            {storedConversations.map(conv => (
              <li key={conv.conversationId} className={styles.item}>
                <div className={styles.itemInfo}>
                  <span className={styles.userId}>👤 {conv.userId}</span>
                  <span className={styles.time}>{timeAgo(conv.updatedAt)}</span>
                </div>
                <button 
                  className={styles.openButton}
                  onClick={() => onSelectConversation(conv.conversationId)}
                >
                  Abrir →
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}