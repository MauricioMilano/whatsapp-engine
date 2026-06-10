import { useState, useEffect, useRef, useMemo } from 'react';
import { useConversation } from '../context/ConversationContext';
import MessageBubble from './MessageBubble';
import IntentPanel from './IntentPanel';
import ContextPanel from './ContextPanel';
import InputBar from './InputBar';
import { getConversation, getMessages, sendMessage, clickButton, resetSession } from '../api/simulator';
import styles from './ConversationView.module.css';

export default function ConversationView({ conversationId, onBack }) {
  const { state, dispatch } = useConversation();
  const { currentConversation, messages, lastClassification, lastContextVars, isLoadingView, error } = state;
  const messagesEndRef = useRef(null);
  const [sending, setSending] = useState(false);

  // Load conversation on mount (or when conversationId changes)
  // Note: dispatch is stable from useReducer, intentionally excluded from deps.
  useEffect(() => {
    if (!conversationId) return;

    async function load() {
      dispatch({ type: 'SET_LOADING_VIEW', payload: true });
      try {
        const [conv, msgsData] = await Promise.all([
          getConversation(conversationId),
          getMessages(conversationId)
        ]);
        dispatch({ type: 'SET_CURRENT_CONVERSATION', payload: conv });
        dispatch({ type: 'SET_MESSAGES', payload: msgsData.messages || [] });

        // Set last classification and context from last incoming message
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
        dispatch({ type: 'SET_LOADING_VIEW', payload: false });
      }
    }

    load();
  }, [conversationId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Compute the quick-buttons list (from the most recent bot message
  // that has buttons). Owned by the view to avoid stale state when
  // navigating between conversations.
  const lastBotButtons = useMemo(() => {
    const lastBotMsg = [...messages].reverse().find(m => m.direction === 'outgoing' && m.buttons?.length > 0);
    return lastBotMsg?.buttons || [];
  }, [messages]);

  async function handleSend(text) {
    if (!text.trim() || sending) return;

    setSending(true);
    try {
      await sendMessage(conversationId, text);

      // Refetch messages to get both incoming and outgoing
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

  async function handleButtonClick(convId, buttonId) {
    if (sending) return;

    setSending(true);
    try {
      await clickButton(convId, buttonId);

      // Refetch messages
      const msgsData = await getMessages(convId);
      dispatch({ type: 'SET_MESSAGES', payload: msgsData.messages || [] });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err.message });
    } finally {
      setSending(false);
    }
  }

  async function handleReset() {
    if (!window.confirm('Resetar contexto desta sessão?')) return;
    if (!currentConversation) return;

    setSending(true);
    try {
      // Reset NLP context on the backend (clears context vars only;
      // conversation history is preserved).
      await resetSession(currentConversation.userId);

      // Refetch messages and clear panels.
      const msgsData = await getMessages(conversationId);
      dispatch({ type: 'SET_MESSAGES', payload: msgsData.messages || [] });
      dispatch({ type: 'SET_CONTEXT_VARS', payload: null });
      dispatch({ type: 'SET_CLASSIFICATION', payload: null });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err.message });
    } finally {
      setSending(false);
    }
  }

  if (isLoadingView) {
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
        <button className={styles.resetButton} onClick={handleReset} disabled={sending}>Reset</button>
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
              onButtonClick={(buttonId) => handleButtonClick(conversationId, buttonId)}
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

      <InputBar
        onSend={handleSend}
        onButtonClick={handleButtonClick}
        conversationId={conversationId}
        buttons={lastBotButtons}
        disabled={sending}
      />
    </div>
  );
}
