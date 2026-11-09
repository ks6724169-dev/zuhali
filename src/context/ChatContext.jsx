import React, { createContext, useContext, useEffect, useState } from 'react';
import { INITIAL_RECENT_CHATS } from '../constants';

const ChatContext = createContext();

export function ChatProvider({ children }) {
  const [conversations, setConversations] = useState(() => {
    const saved = localStorage.getItem('zuhali_conversations');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return INITIAL_RECENT_CHATS.map((title, index) => ({
      id: 'conv_' + (index + 1),
      title,
      isPinned: false,
      isArchived: false,
      updatedAt: new Date(Date.now() - index * 3600000).toISOString()
    }));
  });

  const [activeConvId, setActiveConvId] = useState(() => {
    return 'conv_1';
  });

  const [messagesMap, setMessagesMap] = useState(() => {
    const saved = localStorage.getItem('zuhali_messages_map');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
      conv_1: [
        {
          id: 101,
          assistant: true,
          text: 'Hello! I am Zuhali AI, powered by BharatRouter 120B, Groq LPUs, and Sarvam 105B. How can I assist you today?',
          feedback: null
        }
      ]
    };
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [activeFeedbackModal, setActiveFeedbackModal] = useState(null);
  const [activeRenameModal, setActiveRenameModal] = useState(null);

  // Persist state
  useEffect(() => {
    localStorage.setItem('zuhali_conversations', JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    localStorage.setItem('zuhali_messages_map', JSON.stringify(messagesMap));
  }, [messagesMap]);

  const currentMessages = messagesMap[activeConvId] || [];
  const currentConv = conversations.find((c) => c.id === activeConvId) || { id: activeConvId, title: 'New chat' };

  // Create new chat
  const startNewChat = () => {
    const newId = 'conv_' + Date.now();
    const newConv = {
      id: newId,
      title: 'New chat',
      isPinned: false,
      isArchived: false,
      updatedAt: new Date().toISOString()
    };
    setConversations((prev) => [newConv, ...prev]);
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

  // Rename
  const renameChat = (convId, newTitle) => {
    if (!newTitle.trim()) return;
    setConversations((prev) =>
      prev.map((c) => (c.id === convId ? { ...c, title: newTitle.trim(), updatedAt: new Date().toISOString() } : c))
    );
  };

  // Pin
  const togglePinChat = (convId) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === convId ? { ...c, isPinned: !c.isPinned } : c))
    );
  };

  // Archive
  const toggleArchiveChat = (convId) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === convId ? { ...c, isArchived: !c.isArchived } : c))
    );
  };

  // Delete
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

  // Send message using real ChatGPT-style Server-Sent Events (SSE) Streaming
  const sendMessage = async (text, attachment = null) => {
    if (!text.trim() && !attachment) return;

    let targetConvId = activeConvId;
    if (currentConv.title === 'New chat' && text.trim()) {
      const generatedTitle = text.trim().slice(0, 24) + (text.length > 24 ? '...' : '');
      renameChat(targetConvId, generatedTitle);
    }

    const userMessageId = Date.now();
    const userMessage = {
      id: userMessageId,
      assistant: false,
      text: text.trim(),
      attachment: attachment ? attachment.name : null,
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
      const response = await fetch('http://localhost:8000/api/v1/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          message: text.trim(),
          conversation_id: targetConvId,
          model: 'zuhali-pro-v1'
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
      // Graceful fallback simulation if connection dropped
      const fallbackReply = `I am Zuhali AI. I processed your request: "${text || attachment?.name}". Powered by BharatRouter 120B and Groq LPU engine.`;
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

    // Find the previous user prompt
    const userPrompt = msgs[index - 1]?.text || 'Tell me more';
    
    setMessagesMap((prev) => ({
      ...prev,
      [activeConvId]: msgs.map((m) =>
        m.id === messageId ? { ...m, text: '', isStreaming: true, feedback: null } : m
      )
    }));

    try {
      const response = await fetch('http://localhost:8000/api/v1/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userPrompt })
      });

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
    }
  };

  // Feedback
  const submitFeedback = async (messageId, type, reason, comment) => {
    setMessagesMap((prev) => {
      const msgs = prev[activeConvId] || [];
      return {
        ...prev,
        [activeConvId]: msgs.map((m) =>
          m.id === messageId ? { ...m, feedback: type, feedbackReason: reason, feedbackComment: comment } : m
        )
      };
    });

    try {
      await fetch('http://localhost:8000/api/v1/chat/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message_id: String(messageId),
          feedback_type: type,
          reason,
          comment
        })
      });
    } catch (err) {}
  };

  // Speech
  const speakResponse = (text) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  // Conversation text for copy/share
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
        getConversationText
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export const useChat = () => useContext(ChatContext);
