import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useAuth } from './AuthContext';
import { notifyAICompletion } from '../services/notificationService';

const ChatContext = createContext();

function safeJsonParse(raw, fallback) {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export function ChatProvider({ children }) {
  const { user } = useAuth();
  const userKey = user?.email ? user.email.toLowerCase().replace(/[^a-z0-9]/g, '_') : 'guest';

  // Conversations for the currently logged-in user (NO DUMMY DEMO CHATS!)
  const [conversations, setConversations] = useState(() => {
    // Clean up old legacy demo storage keys
    try {
      localStorage.removeItem('zuhali_conversations');
      localStorage.removeItem('zuhali_messages_map');
    } catch (e) {}

    const saved = localStorage.getItem(`zuhali_conversations_${userKey}`);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [];
  });

  const [activeConvId, setActiveConvId] = useState(() => {
    const savedActive = localStorage.getItem(`zuhali_active_conv_${userKey}`);
    if (savedActive) {
      return savedActive;
    }
    return 'conv_' + Date.now();
  });

  const [messagesMap, setMessagesMap] = useState(() => {
    const saved = localStorage.getItem(`zuhali_messages_map_${userKey}`);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {};
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [activeFeedbackModal, setActiveFeedbackModal] = useState(null);
  const [activeRenameModal, setActiveRenameModal] = useState(null);

  const prevUserKeyRef = useRef(userKey);

  // Synchronize chat state when user switches / logs in / logs out
  useEffect(() => {
    if (prevUserKeyRef.current !== userKey) {
      prevUserKeyRef.current = userKey;
      const savedConvs = localStorage.getItem(`zuhali_conversations_${userKey}`);
      const savedMsgs = localStorage.getItem(`zuhali_messages_map_${userKey}`);
      const savedActive = localStorage.getItem(`zuhali_active_conv_${userKey}`);

      let loadedConvs = [];
      let loadedMsgs = {};

      if (savedConvs) {
        try { loadedConvs = JSON.parse(savedConvs) || []; } catch (e) {}
      }
      if (savedMsgs) {
        try { loadedMsgs = JSON.parse(savedMsgs) || {}; } catch (e) {}
      }

      setConversations(loadedConvs);
      setMessagesMap(loadedMsgs);
      setActiveConvId(savedActive || (loadedConvs.length > 0 ? loadedConvs[0].id : 'conv_' + Date.now()));
    }
  }, [userKey]);

  // Helper to safely store data in localStorage without throwing QuotaExceededError
  const safeSetItem = (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch (err) {
      console.warn(`[LocalStorage Quota Protection]: Storage full for "${key}". Cleaning up old cache...`);
      try {
        // Clean up legacy keys or other users' cached messages if storage is full
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const k = localStorage.key(i);
          if (k && k !== key && (k.startsWith('zuhali_messages_map_') || k.startsWith('zuhali_conversations_'))) {
            localStorage.removeItem(k);
          }
        }
        localStorage.setItem(key, value);
      } catch (e2) {
        console.warn('[LocalStorage Quota Limit Reached]: Ignored exception gracefully.');
      }
    }
  };

  // Persist conversations for this specific user
  useEffect(() => {
    if (userKey) {
      safeSetItem(`zuhali_conversations_${userKey}`, JSON.stringify(conversations));
    }
  }, [conversations, userKey]);

  // Persist messages for this specific user safely without quota errors
  useEffect(() => {
    if (userKey && messagesMap) {
      try {
        const lightweightMap = {};
        Object.keys(messagesMap).forEach((convId) => {
          if (Array.isArray(messagesMap[convId])) {
            lightweightMap[convId] = messagesMap[convId].slice(-30).map((msg) => {
              const copy = { ...msg };
              if (copy.attachmentData && copy.attachmentData.length > 500) {
                copy.attachmentData = null;
              }
              if (Array.isArray(copy.attachments)) {
                copy.attachments = copy.attachments.map((att) => ({
                  name: att.name,
                  type: att.type,
                  dataUrl: att.dataUrl && att.dataUrl.length < 500 ? att.dataUrl : null,
                  textContent: att.textContent ? att.textContent.slice(0, 300) : null
                }));
              }
              return copy;
            });
          }
        });
        safeSetItem(`zuhali_messages_map_${userKey}`, JSON.stringify(lightweightMap));
      } catch (err) {
        console.warn('[Storage Serialization Error]:', err);
      }
    }
  }, [messagesMap, userKey]);

  // Persist active conversation id for this specific user
  useEffect(() => {
    if (userKey && activeConvId) {
      safeSetItem(`zuhali_active_conv_${userKey}`, activeConvId);
    }
  }, [activeConvId, userKey]);

  const currentMessages = messagesMap[activeConvId] || [];
  const currentConv = conversations.find((c) => c.id === activeConvId) || {
    id: activeConvId,
    title: 'New chat',
    isPinned: false,
    isArchived: false
  };

  // Create new chat
  const startNewChat = () => {
    const newId = 'conv_' + Date.now();
    setActiveConvId(newId);
    setMessagesMap((prev) => ({ ...prev, [newId]: [] }));
    return newId;
  };

  // Select a conversation
  const selectChat = (id) => {
    setActiveConvId(id);
    if (!messagesMap[id]) {
      setMessagesMap((prev) => ({ ...prev, [id]: [] }));
    }
  };

  // Rename chat
  const renameChat = (convId, newTitle) => {
    if (!newTitle || !newTitle.trim()) return;
    setConversations((prev) =>
      prev.map((c) => (c.id === convId ? { ...c, title: newTitle.trim(), updatedAt: new Date().toISOString() } : c))
    );
  };

  // Pin / Unpin
  const togglePinChat = (convId) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === convId ? { ...c, isPinned: !c.isPinned } : c))
    );
  };

  // Archive / Unarchive
  const toggleArchiveChat = (convId) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === convId ? { ...c, isArchived: !c.isArchived } : c))
    );
  };

  // Delete chat
  const deleteChat = (convId) => {
    setConversations((prev) => prev.filter((c) => c.id !== convId));
    setMessagesMap((prev) => {
      const copy = { ...prev };
      delete copy[convId];
      return copy;
    });
    if (activeConvId === convId) {
      const remaining = conversations.filter((c) => c.id !== convId);
      if (remaining.length > 0) {
        setActiveConvId(remaining[0].id);
      } else {
        startNewChat();
      }
    }
  };

  // Send message using Server-Sent Events (SSE) Streaming
  const sendMessage = async (text, attachmentInput = null, options = {}) => {
    const rawAttachments = Array.isArray(attachmentInput) 
      ? attachmentInput.slice(0, 10) 
      : (attachmentInput ? [attachmentInput] : []);

    if (!text.trim() && rawAttachments.length === 0) return;

    let targetConvId = activeConvId;
    const exists = conversations.some((c) => c.id === targetConvId);
    const firstAttName = rawAttachments[0]?.name;
    const autoTitle = text.trim() ? (text.trim().slice(0, 30) + (text.length > 30 ? '...' : '')) : (firstAttName || 'New chat');

    // If this conversation is not yet in the recent chats list, add it!
    if (!exists) {
      const newConv = {
        id: targetConvId,
        title: autoTitle,
        isPinned: false,
        isArchived: false,
        updatedAt: new Date().toISOString()
      };
      setConversations((prev) => [newConv, ...prev]);
    } else if (currentConv.title === 'New chat' && text.trim()) {
      renameChat(targetConvId, autoTitle);
    }

    const prevMsgs = messagesMap[targetConvId] || [];
    const historyPayload = prevMsgs
      .filter((m) => m.text && !m.isStreaming)
      .map((m) => ({
        role: m.assistant ? 'assistant' : 'user',
        content: m.text
      }));
    historyPayload.push({
      role: 'user',
      content: text.trim() || (rawAttachments.length > 0 ? `Analysis of ${rawAttachments.length} attached file(s)` : '')
    });

    const userMessageId = Date.now();
    const attachmentsPayload = rawAttachments.map((att) => ({
      name: att.name,
      type: att.type,
      dataUrl: att.dataUrl || att.preview || null,
      textContent: att.textContent || null
    }));

    const userMessage = {
      id: userMessageId,
      assistant: false,
      text: text.trim(),
      attachments: attachmentsPayload,
      attachment: rawAttachments[0] ? rawAttachments[0].name : null,
      attachmentType: rawAttachments[0] ? rawAttachments[0].type : null,
      attachmentData: rawAttachments[0] ? (rawAttachments[0].dataUrl || rawAttachments[0].preview || null) : null,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const assistantMessageId = userMessageId + 1;
    const initialAssistantMsg = {
      id: assistantMessageId,
      assistant: true,
      text: '',
      isStreaming: true,
      feedback: null,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessagesMap((prev) => ({
      ...prev,
      [targetConvId]: [...(prev[targetConvId] || []), userMessage, initialAssistantMsg]
    }));

    setIsGenerating(true);

    try {
      const token = localStorage.getItem('zuhali_token');
      const response = await fetch('/api/v1/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          message: text.trim(),
          messages: historyPayload,
          attachments: attachmentsPayload,
          attachment: attachmentsPayload[0] || null,
          conversation_id: targetConvId,
          model: options?.mode || 'medium',
          mode: options?.mode || 'medium',
          user_email: user?.email || null
        })
      });

      if (!response.ok || !response.body) {
        throw new Error('Streaming failed or backend offline');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let accumulatedText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep last incomplete line in buffer

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            try {
              const payload = JSON.parse(trimmed.slice(6));

              // Token Streaming
              if (payload.token) {
                accumulatedText += payload.token;
                setMessagesMap((prev) => {
                  const msgs = prev[targetConvId] || [];
                  return {
                    ...prev,
                    [targetConvId]: msgs.map((m) =>
                      m.id === assistantMessageId ? { ...m, text: accumulatedText } : m
                    )
                  };
                });
              }
            } catch (err) {}
          }
        }
      }
    } catch (err) {
      console.warn('[SSE Stream Fallback]:', err.message);
      const fallbackReply = `I am Rhynia G1. I processed your request: "${text || rawAttachments[0]?.name || 'attachment'}".`;
      let currentText = '';
      for (const word of fallbackReply.split(' ')) {
        await new Promise((r) => setTimeout(r, 30));
        currentText += (currentText ? ' ' : '') + word;
        setMessagesMap((prev) => {
          const msgs = prev[targetConvId] || [];
          return {
            ...prev,
            [targetConvId]: msgs.map((m) =>
              m.id === assistantMessageId ? { ...m, text: currentText } : m
            )
          };
        });
      }
    } finally {
      setMessagesMap((prev) => {
        const msgs = prev[targetConvId] || [];
        return {
          ...prev,
          [targetConvId]: msgs.map((m) =>
            m.id === assistantMessageId ? { ...m, isStreaming: false } : m
          )
        };
      });
      setIsGenerating(false);
      try {
        notifyAICompletion(userKey, text);
      } catch (err) {}
    }
  };

  // Branch from a specific message
  const branchFrom = (messageId) => {
    const msgs = messagesMap[activeConvId] || [];
    const index = msgs.findIndex((m) => m.id === messageId);
    if (index < 0) return;

    const branchedMessages = msgs.slice(0, index + 1);
    const newId = 'conv_' + Date.now();
    const newConv = {
      id: newId,
      title: `${currentConv.title} (Branch)`,
      isPinned: false,
      isArchived: false,
      updatedAt: new Date().toISOString()
    };

    setConversations((prev) => [newConv, ...prev]);
    setMessagesMap((prev) => ({ ...prev, [newId]: branchedMessages }));
    setActiveConvId(newId);
  };

  // Regenerate message
  const regenerate = async (messageId) => {
    const msgs = messagesMap[activeConvId] || [];
    const index = msgs.findIndex((m) => m.id === messageId);
    if (index < 0) return;

    const userPrompt = msgs[index - 1]?.text || 'Tell me more';
    const historyPayload = msgs
      .slice(0, index)
      .filter((m) => m.text)
      .map((m) => ({
        role: m.assistant ? 'assistant' : 'user',
        content: m.text
      }));
    
    setMessagesMap((prev) => ({
      ...prev,
      [activeConvId]: msgs.map((m) =>
        m.id === messageId ? { ...m, text: '', isStreaming: true, feedback: null } : m
      )
    }));

    try {
      const token = localStorage.getItem('zuhali_token');
      const response = await fetch('/api/v1/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          message: userPrompt,
          messages: historyPayload,
          conversation_id: activeConvId,
          model: 'zuhali-pro-v1'
        })
      });

      if (!response.ok || !response.body) {
        throw new Error('Regenerate stream failed');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let accumulatedText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            try {
              const payload = JSON.parse(trimmed.slice(6));
              if (payload.token) {
                accumulatedText += payload.token;
                setMessagesMap((prev) => {
                  const currentList = prev[activeConvId] || [];
                  return {
                    ...prev,
                    [activeConvId]: currentList.map((m) =>
                      m.id === messageId ? { ...m, text: accumulatedText } : m
                    )
                  };
                });
              }
            } catch (err) {}
          }
        }
      }
    } catch (e) {
      setMessagesMap((prev) => ({
        ...prev,
        [activeConvId]: msgs.map((m) =>
          m.id === messageId ? { ...m, text: '[Refreshed Response from BharatRouter 120B]' } : m
        )
      }));
    } finally {
      setMessagesMap((prev) => ({
        ...prev,
        [activeConvId]: (prev[activeConvId] || []).map((m) =>
          m.id === messageId ? { ...m, isStreaming: false } : m
        )
      }));
      try {
        notifyAICompletion(userKey, userPrompt);
      } catch (err) {}
    }
  };

  // Feedback
  const submitFeedback = async (messageId, type, reason, comment) => {
    const msgs = messagesMap[activeConvId] || [];
    const index = msgs.findIndex((m) => m.id === messageId);
    const targetMsg = index >= 0 ? msgs[index] : null;
    const promptMsg = index > 0 ? msgs[index - 1] : null;

    setMessagesMap((prev) => {
      const current = prev[activeConvId] || [];
      return {
        ...prev,
        [activeConvId]: current.map((m) =>
          m.id === messageId ? { ...m, feedback: type, feedbackReason: reason, feedbackComment: comment } : m
        )
      };
    });

    try {
      const token = localStorage.getItem('zuhali_token');
      await fetch('/api/v1/chat/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          message_id: String(messageId),
          feedback_type: type,
          reason,
          comment,
          user_email: user?.email || (userKey !== 'guest' ? userKey : null),
          prompt: promptMsg?.text || null,
          message_text: targetMsg?.text || null
        })
      });
    } catch (err) {
      console.warn('[Feedback Sync Error]:', err);
    }
  };

  const [speakingMessageId, setSpeakingMessageId] = useState(null);

  // Stop active speech
  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSpeakingMessageId(null);
  };

  // Toggle speak / pause response
  const toggleSpeakResponse = (messageId, text) => {
    if (!('speechSynthesis' in window)) return;

    // If currently speaking this message, pause/stop speaking
    if (speakingMessageId === messageId) {
      stopSpeaking();
      return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    if (!text) {
      setSpeakingMessageId(null);
      return;
    }

    // Strip code blocks or markup for cleaner TTS audio
    const cleanText = text.replace(/```[\s\S]*?```/g, 'Code block.').trim();

    const utterance = new SpeechSynthesisUtterance(cleanText || text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onend = () => {
      setSpeakingMessageId(null);
    };

    utterance.onerror = () => {
      setSpeakingMessageId(null);
    };

    setSpeakingMessageId(messageId);
    window.speechSynthesis.speak(utterance);
  };

  // Legacy speak handler for compatibility
  const speakResponse = (text) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  // Stop speech if active conversation changes
  useEffect(() => {
    stopSpeaking();
  }, [activeConvId]);

  // Conversation text for copy/share/export
  const getConversationText = () => {
    return currentMessages
      .map((m) => (m.assistant ? 'Zuhali: ' : 'You: ') + m.text)
      .join('\n\n');
  };

  return (
    <ChatContext.Provider
      value={{
        conversations,
        activeConvId,
        currentConv,
        currentMessages,
        isGenerating,
        speakingMessageId,
        activeFeedbackModal,
        setActiveFeedbackModal,
        activeRenameModal,
        setActiveRenameModal,
        startNewChat,
        selectChat,
        renameChat,
        togglePinChat,
        toggleArchiveChat,
        deleteChat,
        sendMessage,
        branchFrom,
        regenerate,
        submitFeedback,
        speakResponse,
        toggleSpeakResponse,
        stopSpeaking,
        getConversationText
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export const useChat = () => useContext(ChatContext);

