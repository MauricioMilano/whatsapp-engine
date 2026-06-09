import { useState } from 'react';
import { ConversationProvider, useConversation } from './context/ConversationContext';
import ConversationList from './components/ConversationList';
import ConversationView from './components/ConversationView';
import styles from './App.module.css';

function AppContent() {
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const { state } = useConversation();

  function handleSelectConversation(convId) {
    setCurrentConversationId(convId);
  }

  function handleBack() {
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