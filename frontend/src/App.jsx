import { useState } from 'react';
import { ConversationProvider, useConversation } from './context/ConversationContext';
import ConversationList from './components/ConversationList';
import ConversationView from './components/ConversationView';
import styles from './App.module.css';

function AppContent() {
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const { dispatch } = useConversation();

  function handleSelectConversation(convId) {
    // Clear any conversation-specific state so the next ConversationView
    // mounts with a clean slate and doesn't show stale messages.
    dispatch({ type: 'RESET' });
    setCurrentConversationId(convId);
  }

  function handleBack() {
    dispatch({ type: 'RESET' });
    setCurrentConversationId(null);
  }

  return (
    <div className={styles.app}>
      {currentConversationId ? (
        <ConversationView
          conversationId={currentConversationId}
          onBack={handleBack}
        />
      ) : (
        <ConversationList onSelectConversation={handleSelectConversation} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ConversationProvider>
      <AppContent />
    </ConversationProvider>
  );
}
