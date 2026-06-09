import { createContext, useContext, useReducer, useEffect } from 'react';

const ConversationContext = createContext(null);

const STORAGE_KEY = 'debug_conversations';

function loadStoredConversations() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveConversations(convs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(convs));
}

const initialState = {
  // Conversation list
  storedConversations: loadStoredConversations(),
  
  // Current conversation
  currentConversation: null,
  messages: [],
  
  // Intent/Context display
  lastClassification: null,
  lastContextVars: null,
  
  // UI state
  isLoading: false,
  intentPanelOpen: true,
  contextPanelOpen: false,
  
  // Dialogue info
  dialogueInfo: null,
  
  // Error
  error: null
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    
    case 'SET_DIALOGUE_INFO':
      return { ...state, dialogueInfo: action.payload };
    
    case 'SET_STORED_CONVERSATIONS':
      saveConversations(action.payload);
      return { ...state, storedConversations: action.payload };
    
    case 'ADD_STORED_CONVERSATION': {
      const updated = [
        { conversationId: action.payload.conversationId, userId: action.payload.userId, updatedAt: new Date().toISOString() },
        ...state.storedConversations.filter(c => c.conversationId !== action.payload.conversationId)
      ].slice(0, 20);
      saveConversations(updated);
      return { ...state, storedConversations: updated };
    }
    
    case 'SET_CURRENT_CONVERSATION':
      return { ...state, currentConversation: action.payload };
    
    case 'SET_MESSAGES':
      return { ...state, messages: action.payload };
    
    case 'ADD_MESSAGES': {
      // Add incoming and bot response messages
      const newMessages = [...state.messages];
      if (action.payload.incoming) {
        newMessages.push(action.payload.incoming);
      }
      if (action.payload.bot) {
        newMessages.push(action.payload.bot);
      }
      return { ...state, messages: newMessages };
    }
    
    case 'SET_CLASSIFICATION':
      return { ...state, lastClassification: action.payload };
    
    case 'SET_CONTEXT_VARS':
      return { ...state, lastContextVars: action.payload };
    
    case 'TOGGLE_INTENT_PANEL':
      return { ...state, intentPanelOpen: !state.intentPanelOpen };
    
    case 'TOGGLE_CONTEXT_PANEL':
      return { ...state, contextPanelOpen: !state.contextPanelOpen };
    
    case 'RESET':
      return {
        ...state,
        currentConversation: null,
        messages: [],
        lastClassification: null,
        lastContextVars: null
      };
    
    default:
      return state;
  }
}

export function ConversationProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  
  // Fetch dialogue info on mount
  useEffect(() => {
    import('../api/simulator.js').then(api => {
      api.getInfo()
        .then(info => dispatch({ type: 'SET_DIALOGUE_INFO', payload: info }))
        .catch(err => dispatch({ type: 'SET_ERROR', payload: err.message }));
    });
  }, []);
  
  return (
    <ConversationContext.Provider value={{ state, dispatch }}>
      {children}
    </ConversationContext.Provider>
  );
}

export function useConversation() {
  const ctx = useContext(ConversationContext);
  if (!ctx) throw new Error('useConversation must be used within ConversationProvider');
  return ctx;
}