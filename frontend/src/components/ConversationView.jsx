import { useState, useEffect, useRef } from 'react';
import { useConversation } from '../context/ConversationContext';
import MessageBubble from './MessageBubble';
import IntentPanel from './IntentPanel';
import ContextPanel from './ContextPanel';
import InputBar from './InputBar';
import styles from './ConversationView.module.css';

export default function ConversationView({ conversationId, onBack }) {
  const { state, dispatch } = useConversation();
  const { currentConversation, messages, lastClassification, lastContextVars, isLoading, error } = state;
  const messagesEndRef = useRef(null);
  const [sending, setSending] = useState(false);

  // Load conversation on mount
  useEffect(() => {
    if (!conversationId) return;
    
    async function load() {
      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        const { getConversation, getMessages } = await import('../api/simulator.js');
        const [conv, msgsData] = await Promise.all([
          getConversation(conversationId),
          getMessages(conversationId)
        ]);
        dispatch({ type: 'SET_CURRENT_CONVERSATION', payload: conv });
        dispatch({ type: 'SET_MESSAGES', payload: msgsData.messages || [] });
        
        // Set last classification and context from last message
        const msgs = msgsData.messages || [];
        if (msgs.length > 0) {
          const lastIncoming = [...msgs].reverse().find(m => m.direction === 'incoming');
          if (lastIncoming) {
            dispatch({ 
              type: 'SET_CLASSIFICATION', 
              payload: lastIncoming.allIntents ? {
                intent: lastIncoming.intent,
                score: lastIncoming.intentScore,
                allIntents: lastIncoming.allIntents
              } : null
            });
            dispatch({ type: 'SET_CONTEXT_VARS', payload: lastIncoming.contextVars });
          }
        }
      } catch (err) {
        dispatch({ type: 'SET_ERROR', payload: err.message });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    }
    
    load();
  }, [conversationId, dispatch]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(text) {
    if (!text.trim() || sending) return;
    
    setSending(true);
    try {
      const { sendMessage } = await import('../api/simulator.js');
      const result = await sendMessage(conversationId, text);
      
      // The API returns the incoming message, we need to refetch to get both
      const { getMessages } = await import('../api/simulator.js');
      const msgsData = await getMessages(conversationId);
      dispatch({ type: 'SET_MESSAGES', payload: msgsData.messages || [] });
      
      // Update classification from last incoming
      const msgs = msgsData.messages || [];
      const lastIncoming = [...msgs].reverse().find(m => m.direction === 'incoming');
      if (lastIncoming) {
        dispatch({ 
          type: 'SET_CLASSIFICATION', 
          payload: lastIncoming.allIntents ? {
            intent: lastIncoming.intent,
            score: lastIncoming.intentScore,
            allIntents: lastIncoming.allIntents
          } : null
        });
        dispatch({ type: 'SET_CONTEXT_VARS', payload: lastIncoming.contextVars });
      }
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err.message });
    } finally {
      setSending(false);
    }
  }

  async function handleButtonClick(buttonId) {
    if (sending) return;
    
    setSending(true);
    try {
      const { clickButton } = await import('../api/simulator.js');
      await clickButton(conversationId, buttonId);
      
      // Refetch messages
      const { getMessages } = await import('../api/simulator.js');
      const msgsData = await getMessages(conversationId);
      dispatch({ type: 'SET_MESSAGES', payload: msgsData.messages || [] });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err.message });
    } finally {
      setSending(false);
    }
  }

  async function handleReset() {
    if (!window.confirm('Resetar contexto desta sessão?')) return;
    
    try {
      const { getConversation } = await import('../api/simulator.js');
      const conv = await getConversation(conversationId);
      
      // Reset via the simulator endpoint
      await fetch(`/sim/sessions/${conv.userId}/reset`);
      
      // Reload conversation
      const { getMessages } = await import('../api/simulator.js');
      const msgsData = await getMessages(conversationId);
      dispatch({ type: 'SET_MESSAGES', payload: msgsData.messages || [] });
      dispatch({ type: 'SET_CONTEXT_VARS', payload: null });
      dispatch({ type: 'SET_CLASSIFICATION', payload: null });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err.message });
    }
  }

  if (isLoading) {
    return <div className={styles.loading}>Carregando...</div>;
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <button className={styles.backButton} onClick={onBack}>←</button>
        <div className={styles.headerInfo}>
          <span className={styles.userId}>
            {currentConversation ? `Conversa com ${currentConversation.userId}` : '...'}
          </span>
        </div>
        <button className={styles.resetButton} onClick={handleReset}>Reset</button>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.messages}>
        {messages.length === 0 ? (
          <p className={styles.empty}>Nenhuma mensagem ainda. Digite algo para começar!</p>
        ) : (
          messages.map((msg, i) => (
            <MessageBubble
              key={msg.id || i}
              message={msg}
              onButtonClick={handleButtonClick}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {lastClassification && (
        <IntentPanel
          intents={lastClassification.allIntents || []}
          winner={lastClassification.intent}
          score={lastClassification.score}
        />
      )}

      {lastContextVars && (
        <ContextPanel variables={lastContextVars} />
      )}

      <InputBar onSend={handleSend} disabled={sending} messages={messages} />
    </div>
  );
}