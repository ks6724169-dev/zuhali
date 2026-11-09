import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
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
          text: 'Hello! I am Zuhali AI. How can I assist you with your projects, code, or ideas today?',
          feedback: null
        }
      ]
    };
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [activeFeedbackModal, setActiveFeedbackModal] = useState(null); // { messageId, type }
  const [activeRenameModal, setActiveRenameModal] = useState(null); // { convId, currentTitle }

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

  // Send message with streaming effect
  const sendMessage = async (text, attachment = null) => {
    if (!text.trim() && !attachment) return;

    let targetConvId = activeConvId;
    // Auto title if new chat
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

    // Mock Streaming response (word by word like ChatGPT) or connects to Backend SSE
    const fullReply = `I am Zuhali AI. I processed your request: "${text || attachment?.name}".\n\nHere is a structured, production-ready solution tailored to your specification. You can inspect the code in the built-in Editor, run test commands in the Web Terminal, or continue refining this discussion.`;

    const words = fullReply.split(' ');
    let currentText = '';

    for (let i = 0; i < words.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 35));
      currentText += (i === 0 ? '' : ' ') + words[i];

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

    const refreshedText = `[Refreshed Response] Here is an enhanced perspective on your query with updated reasoning, alternative implementations, and full test cases.`;

    setMessagesMap((prev) => ({
      ...prev,
      [activeConvId]: msgs.map((m) =>
        m.id === messageId ? { ...m, text: refreshedText, feedback: null } : m
      )
    }));
  };

  // Feedback
  const submitFeedback = (messageId, type, reason, comment) => {
    setMessagesMap((prev) => {
      const msgs = prev[activeConvId] || [];
      return {
        ...prev,
        [activeConvId]: msgs.map((m) =>
          m.id === messageId ? { ...m, feedback: type, feedbackReason: reason, feedbackComment: comment } : m
        )
      };
    });
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
