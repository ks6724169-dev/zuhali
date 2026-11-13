import React, { useState, useRef, useEffect } from 'react';
import {
  PanelLeft, MoreHorizontal, MoreVertical, Copy, Pencil, Share2, Pin,
  Archive, FolderPlus, Download, Flag, Trash2, GitBranch, Volume2,
  Heart, ThumbsDown, RefreshCw, Folder, Camera, Mic, SlidersHorizontal,
  ArrowUp, X, Check, Square, Box, Layers, Sparkles
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import FormattedMessage from './FormattedMessage';
import ArtifactsPanel from './ArtifactsPanel';
import AiSparkIcon from '../common/AiSparkIcon';

export default function ChatWorkspace({
  onToggleSidebar
}) {
  const { user } = useAuth();
  const userKey = user?.email ? user.email.toLowerCase().replace(/[^a-z0-9]/g, '_') : 'guest';

  const {
    currentConv,
    currentMessages,
    isGenerating,
    speakingMessageId,
    startNewChat,
    togglePinChat,
    toggleArchiveChat,
    deleteChat,
    sendMessage,
    branchFrom,
    regenerate,
    speakResponse,
    toggleSpeakResponse,
    setActiveFeedbackModal,
    setActiveRenameModal,
    getConversationText
  } = useChat();

  const [menuOpen, setMenuOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [attachOpen, setAttachOpen] = useState(false);
  const [artifactMode, setArtifactMode] = useState(false);
  const [artifactSubMode, setArtifactSubMode] = useState('default'); // 'default' | 'shadcnui' | 'custom'
  const [activeArtifact, setActiveArtifact] = useState(null);
  const [copied, setCopied] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState(null);
  const [activeUserMenu, setActiveUserMenu] = useState(null);

  // Model Intelligence & Speed Modes (Fast, Medium, Complex High)
  const MODES = [
    {
      id: 'fast',
      label: 'Fast',
      badge: '⚡',
      desc: 'Lightweight & instant speed response',
      tag: 'Fast'
    },
    {
      id: 'medium',
      label: 'Medium',
      badge: '⚖️',
      desc: 'Balanced reasoning & precision (Default)',
      tag: 'Standard'
    },
    {
      id: 'complex_high',
      label: 'Complex High',
      badge: '🧠',
      desc: 'Deep analytical reasoning & complex tasks',
      tag: 'Deep Think'
    }
  ];

  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [reasoningMode, setReasoningMode] = useState(() => {
    return localStorage.getItem('zuhali_ai_mode') || 'medium';
  });

  // Voice Speech-to-Text Recognition
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRec) {
      try {
        const recognition = new SpeechRec();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'hi-IN,en-US';

        recognition.onresult = (event) => {
          let transcriptText = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            transcriptText += event.results[i][0].transcript;
          }
          if (transcriptText) {
            setDraft((prev) => {
              const trimmed = prev.trim();
              return trimmed ? `${trimmed} ${transcriptText.trim()}` : transcriptText.trim();
            });
          }
        };

        recognition.onerror = (e) => {
          console.warn('[Speech Recognition]:', e.error);
          if (e.error !== 'no-speech') {
            setIsListening(false);
          }
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      } catch (err) {
        console.warn('SpeechRecognition init error:', err);
      }
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('Speech Recognition आपके ब्राउज़र में उपलब्ध नहीं है। कृपया Google Chrome या Edge का उपयोग करें।');
      return;
    }
    if (isListening) {
      try { recognitionRef.current.stop(); } catch {}
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.warn('Recognition start error:', err);
        setIsListening(false);
      }
    }
  };

  const handleSelectMode = (modeId) => {
    setReasoningMode(modeId);
    localStorage.setItem('zuhali_ai_mode', modeId);
    setModeMenuOpen(false);
  };

  const fileRef = useRef(null);
  const cameraRef = useRef(null);
  const inputRef = useRef(null);
  const longPressTimer = useRef(null);
  const conversationRef = useRef(null);
  const messagesEndRef = useRef(null);

  const hasConversation = currentMessages.length > 0;

  const scrollToBottom = (behavior = 'smooth') => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior, block: 'end' });
    } else if (conversationRef.current) {
      conversationRef.current.scrollTop = conversationRef.current.scrollHeight;
    }
  };

  // Auto scroll to last line of chat when opening or selecting recent chat
  useEffect(() => {
    if (hasConversation) {
      scrollToBottom('instant');
      const t1 = setTimeout(() => scrollToBottom('instant'), 50);
      const t2 = setTimeout(() => scrollToBottom('smooth'), 180);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [currentConv?.id]);

  // Auto scroll when new messages arrive or during AI streaming
  useEffect(() => {
    if (hasConversation) {
      scrollToBottom('smooth');
    }
  }, [currentMessages.length, isGenerating]);

  // Close popups when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (menuOpen && !e.target.closest('.topbar .menu-anchor')) {
        setMenuOpen(false);
      }
      if (attachOpen && !e.target.closest('.composer-tools .menu-anchor:first-child')) {
        setAttachOpen(false);
      }
      if (modeMenuOpen && !e.target.closest('.mode-anchor')) {
        setModeMenuOpen(false);
      }
      if (activeUserMenu !== null && !e.target.closest('.user-message-menu')) {
        setActiveUserMenu(null);
      }
    };

    if (menuOpen || attachOpen || modeMenuOpen || activeUserMenu !== null) {
      document.addEventListener('pointerdown', handleOutsideClick);
      document.addEventListener('click', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('pointerdown', handleOutsideClick);
      document.removeEventListener('click', handleOutsideClick);
    };
  }, [menuOpen, attachOpen, modeMenuOpen, activeUserMenu]);

  const handleSend = (e) => {
    e?.preventDefault();
    if (!draft.trim() && attachments.length === 0) return;
    if (isListening && recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      setIsListening(false);
    }
    let promptToSend = draft;
    if (artifactMode) {
      promptToSend = `${draft.trim()}\n\n# Artifacts Mode Directive (${artifactSubMode})\nPlease format the primary deliverable strictly as an interactive LibreChat artifact:\n:::artifact{identifier="interactive-app" type="text/html" title="Interactive Artifact"}\n\`\`\`\`\n<!-- complete self-contained executable content -->\n\`\`\`\`\n:::`;
    }
    sendMessage(promptToSend, attachments, { mode: reasoningMode });
    setDraft('');
    setAttachments([]);
    setAttachOpen(false);
    setModeMenuOpen(false);
  };

  const removeAttachment = (id) => {
    setAttachments((prev) => prev.filter((att) => att.id !== id));
  };

  const copyConversation = async () => {
    try {
      await navigator.clipboard.writeText(getConversationText());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
    setMenuOpen(false);
  };

  const shareConversation = async () => {
    const text = getConversationText();
    try {
      if (navigator.share) {
        await navigator.share({ title: currentConv.title, text });
      } else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    } catch {}
    setMenuOpen(false);
  };

  const exportChat = () => {
    const blob = new Blob([getConversationText()], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentConv.title.replace(/\s+/g, '_')}_chat.txt`;
    a.click();
    setMenuOpen(false);
  };

  const copySingleResponse = async (msgId, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMsgId(msgId);
      setTimeout(() => {
        setCopiedMsgId((prev) => (prev === msgId ? null : prev));
      }, 2000);
    } catch {}
    setActiveUserMenu(null);
  };

  const editUserMessage = (msg) => {
    setDraft(msg.text || '');
    setActiveUserMenu(null);
    inputRef.current?.focus();
  };

  const compressImageFile = (file) => {
    return new Promise((resolve) => {
      const isCompressibleImage = file.type?.startsWith('image/') || /\.(png|jpe?g|webp|bmp)$/i.test(file.name);
      if (!isCompressibleImage || file.type?.includes('svg') || file.type?.includes('gif')) {
        const reader = new FileReader();
        reader.onload = () => {
          resolve({
            dataUrl: reader.result,
            size: file.size,
            originalSize: file.size,
            compressed: false
          });
        };
        reader.readAsDataURL(file);
        return;
      }

      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        // Ultra compression: max dimension 800px (crystal clear for AI vision & UI preview, super tiny footprint)
        const maxDim = 800;
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Try WebP compression at 0.55 quality (ultra high compression)
        let dataUrl = canvas.toDataURL('image/webp', 0.55);
        if (!dataUrl.startsWith('data:image/webp')) {
          dataUrl = canvas.toDataURL('image/jpeg', 0.55);
        }

        const compressedSizeBytes = Math.round((dataUrl.length * 3) / 4);
        const percentSaved = Math.max(0, Math.round(((file.size - compressedSizeBytes) / file.size) * 100));

        resolve({
          dataUrl,
          size: compressedSizeBytes,
          originalSize: file.size,
          percentSaved,
          compressed: file.size > compressedSizeBytes
        });
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        const reader = new FileReader();
        reader.onload = () => {
          resolve({
            dataUrl: reader.result,
            size: file.size,
            originalSize: file.size,
            percentSaved: 0,
            compressed: false
          });
        };
        reader.readAsDataURL(file);
      };
      img.src = objectUrl;
    });
  };

  const processSelectedFiles = async (fileList) => {
    if (!fileList || fileList.length === 0) return;
    const currentCount = attachments.length;
    const remainingSlots = 10 - currentCount;

    if (remainingSlots <= 0) {
      alert('एक बार में अधिकतम 10 अटैचमेंट ही जोड़े जा सकते हैं।');
      return;
    }

    const filesArray = Array.from(fileList).slice(0, remainingSlots);

    for (const file of filesArray) {
      const isImage = file.type?.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(file.name);

      if (isImage) {
        const compressedRes = await compressImageFile(file);
        setAttachments((prev) => {
          if (prev.length >= 10) return prev;
          return [
            ...prev,
            {
              id: 'att_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
              name: file.name,
              type: file.type || 'image/jpeg',
              size: compressedRes.size,
              originalSize: compressedRes.originalSize,
              compressed: compressedRes.compressed,
              dataUrl: compressedRes.dataUrl,
              preview: compressedRes.dataUrl,
              isImage: true
            }
          ];
        });
      } else {
        const reader = new FileReader();
        reader.onload = () => {
          setAttachments((prev) => {
            if (prev.length >= 10) return prev;
            return [
              ...prev,
              {
                id: 'att_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
                name: file.name,
                type: file.type || 'text/plain',
                size: file.size,
                originalSize: file.size,
                compressed: false,
                textContent: typeof reader.result === 'string' ? reader.result : '',
                preview: null,
                isImage: false
              }
            ];
          });
        };
        reader.readAsText(file);
      }
    }
  };

  return (
    <div
      className={`workspace-split-view ${activeArtifact ? 'with-artifact-open' : ''}`}
      style={{
        display: 'flex',
        flex: 1,
        minWidth: 0,
        height: '100%',
        width: '100%',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <div
        className="workspace-chat-pane"
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minWidth: 0,
          height: '100%',
          position: 'relative'
        }}
      >
        {/* TOPBAR */}
        <header className="topbar">
        <div className="header-left">
          <button
            className="icon-button"
            aria-label="Open sidebar"
            title="Open sidebar"
            onClick={onToggleSidebar}
          >
            <PanelLeft size={19} />
          </button>
        </div>

        {hasConversation && (
          <div className="header-actions">
            <button
              className="icon-button"
              aria-label="New chat"
              title="New chat"
              onClick={startNewChat}
            >
              <AiSparkIcon size={18} />
            </button>

            <div className="menu-anchor">
              <button
                className="icon-button"
                aria-label="More options"
                title="More options"
                onClick={() => setMenuOpen((v) => !v)}
              >
                <MoreHorizontal size={19} />
              </button>
              {menuOpen && (
                <div className="dropdown-menu">
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setActiveRenameModal({ convId: currentConv.id, currentTitle: currentConv.title });
                    }}
                  >
                    <Pencil size={16} />
                    Rename chat
                  </button>
                  <button onClick={shareConversation}>
                    <Share2 size={16} />
                    Share chat
                  </button>
                  <button onClick={() => { togglePinChat(currentConv.id); setMenuOpen(false); }}>
                    <Pin size={16} />
                    {currentConv.isPinned ? 'Unpin chat' : 'Pin chat'}
                  </button>
                  <button onClick={() => { toggleArchiveChat(currentConv.id); setMenuOpen(false); }}>
                    <Archive size={16} />
                    {currentConv.isArchived ? 'Unarchive chat' : 'Archive chat'}
                  </button>
                  <div className="menu-divider" />
                  <button
                    className="danger-item"
                    onClick={() => {
                      deleteChat(currentConv.id);
                      setMenuOpen(false);
                    }}
                  >
                    <Trash2 size={16} />
                    Delete chat
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* CONVERSATION AREA */}
      <section ref={conversationRef} className={`conversation ${hasConversation ? 'has-messages' : 'empty-state'}`}>
        {!hasConversation ? (
          <div className="welcome">
            <h1>How can I help you?</h1>
            <p>Ask anything. Let's get started.</p>
          </div>
        ) : (
          <div className="message-list">
            {currentMessages.map((message) => (
              <article
                className={message.assistant ? 'message assistant-message' : 'message user-message'}
                key={message.id}
              >
                {message.assistant ? (
                  <>


                    {message.isStreaming && !message.text && (
                      <div className="ai-thinking-indicator" aria-label="Thinking">
                        <span className="spinning-snowflake">❄️</span>
                        <span className="thinking-text">Thinking.....</span>
                      </div>
                    )}
                    <FormattedMessage
                      text={message.text}
                      onSelectChoice={(val) => sendMessage(val)}
                      onOpenArtifact={(art) => setActiveArtifact(art)}
                    />
                    {!message.isStreaming && message.text && (
                      <div className="response-tools" aria-label="Response actions">
                        <button
                          className={copiedMsgId === message.id ? 'is-copied' : ''}
                          title={copiedMsgId === message.id ? 'Copied to clipboard!' : 'Copy response'}
                          aria-label={copiedMsgId === message.id ? 'Copied to clipboard!' : 'Copy response'}
                          onClick={() => copySingleResponse(message.id, message.text)}
                        >
                          {copiedMsgId === message.id ? (
                            <Check size={16} className="copied-check-icon" style={{ color: '#10b981' }} />
                          ) : (
                            <Copy size={16} />
                          )}
                        </button>
                        <button
                          title="Share entire chat"
                          aria-label="Share entire chat"
                          onClick={shareConversation}
                        >
                          <Share2 size={16} />
                        </button>
                        <button
                          title="Branch from this message"
                          aria-label="Branch from this message"
                          onClick={() => branchFrom(message.id)}
                        >
                          <GitBranch size={16} />
                        </button>
                        <button
                          className={speakingMessageId === message.id ? 'is-speaking' : ''}
                          title={speakingMessageId === message.id ? 'Pause / Stop reading' : 'Read aloud'}
                          aria-label={speakingMessageId === message.id ? 'Pause / Stop reading' : 'Read aloud'}
                          onClick={() => toggleSpeakResponse(message.id, message.text)}
                        >
                          {speakingMessageId === message.id ? (
                            <Square size={14} fill="currentColor" className="speaking-square-icon" style={{ color: '#ef4444' }} />
                          ) : (
                            <Volume2 size={16} />
                          )}
                        </button>
                        <button
                          className={message.feedback === 'like' ? 'is-active' : ''}
                          title="Like response"
                          aria-label="Like response"
                          onClick={() => setActiveFeedbackModal({ messageId: message.id, type: 'like' })}
                        >
                          <Heart size={16} />
                        </button>
                        <button
                          className={message.feedback === 'dislike' ? 'is-active' : ''}
                          title="Dislike response"
                          aria-label="Dislike response"
                          onClick={() => setActiveFeedbackModal({ messageId: message.id, type: 'dislike' })}
                        >
                          <ThumbsDown size={16} />
                        </button>
                        <button
                          title="Regenerate response"
                          aria-label="Regenerate response"
                          onClick={() => regenerate(message.id)}
                        >
                          <RefreshCw size={16} />
                        </button>
                      </div>
                    )}
                  </>

                ) : (
                  <div className="user-message-wrap">
                    <div
                      className={!message.text && (
                        (Array.isArray(message.attachments) && message.attachments.some(a => a.dataUrl?.startsWith('data:image') || a.type?.startsWith('image/'))) ||
                        (message.attachmentData && (message.attachmentType?.startsWith('image/') || message.attachmentData.startsWith('data:image/')))
                      ) ? "user-bubble-image-only" : "user-bubble"}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setActiveUserMenu(message.id);
                      }}
                      onTouchStart={() => {
                        longPressTimer.current = setTimeout(() => setActiveUserMenu(message.id), 500);
                      }}
                      onTouchEnd={() => clearTimeout(longPressTimer.current)}
                    >
                      {message.text && <p>{message.text}</p>}
                      {Array.isArray(message.attachments) && message.attachments.length > 0 ? (
                        <div className="attached-media-grid" style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '6px',
                          marginTop: message.text ? '8px' : '0'
                        }}>
                          {message.attachments.map((att, idx) => (
                            att.dataUrl && (att.type?.startsWith('image/') || att.dataUrl.startsWith('data:image/')) ? (
                              <div key={idx} className="attached-image-card" style={{ border: 'none', background: 'transparent', padding: 0 }}>
                                <img
                                  src={att.dataUrl}
                                  alt=""
                                  style={{
                                    maxWidth: message.attachments.length === 1 ? '240px' : '140px',
                                    maxHeight: message.attachments.length === 1 ? '320px' : '140px',
                                    borderRadius: '14px',
                                    objectFit: 'cover',
                                    display: 'block',
                                    border: 'none',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.12)'
                                  }}
                                />
                              </div>
                            ) : (
                              <div key={idx} className="attached-file" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 10px', background: 'rgba(0,0,0,0.18)', borderRadius: '8px', fontSize: '12px' }}>
                                <Folder size={15} />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.name}</span>
                              </div>
                            )
                          ))}
                        </div>
                      ) : (
                        message.attachment && (
                          message.attachmentData && (message.attachmentType?.startsWith('image/') || message.attachmentData.startsWith('data:image/')) ? (
                            <div className="attached-image-card" style={{ border: 'none', background: 'transparent', padding: 0 }}>
                              <img
                                src={message.attachmentData}
                                alt=""
                                style={{
                                  maxWidth: '240px',
                                  maxHeight: '320px',
                                  borderRadius: '14px',
                                  objectFit: 'cover',
                                  display: 'block',
                                  border: 'none',
                                  boxShadow: '0 2px 8px rgba(0,0,0,0.12)'
                                }}
                              />
                            </div>
                          ) : (
                            <div className="attached-file" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 10px', background: 'rgba(0,0,0,0.18)', borderRadius: '8px', marginBottom: '6px', fontSize: '12px' }}>
                              <Folder size={15} />
                              <span>{message.attachment}</span>
                            </div>
                          )
                        )
                      )}
                    </div>
                    {activeUserMenu === message.id && (
                      <div className="user-message-menu" role="menu">
                        <button role="menuitem" onClick={() => editUserMessage(message)}>
                          <Pencil size={15} /> Edit
                        </button>
                        <button role="menuitem" onClick={() => copySingleResponse(message.id, message.text)}>
                          {copiedMsgId === message.id ? (
                            <>
                              <Check size={15} style={{ color: '#10b981' }} /> Copied
                            </>
                          ) : (
                            <>
                              <Copy size={15} /> Copy
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </article>
            ))}
            <div ref={messagesEndRef} style={{ height: 1 }} />
          </div>
        )}
      </section>

      {/* COMPOSER */}
      <div className="composer-wrap">
        {attachments.length > 0 && (
          <div className="composer-attachments-bar" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            overflowX: 'auto',
            padding: '6px 4px 10px',
            marginBottom: '4px',
            maxWidth: '100%',
            scrollbarWidth: 'thin'
          }}>
            {attachments.map((att) => (
              <div
                key={att.id}
                className="square-attachment-card"
                style={{
                  position: 'relative',
                  width: '68px',
                  height: '68px',
                  borderRadius: '14px',
                  flexShrink: 0,
                  background: 'var(--surface-active, #f1f5f9)',
                  border: '1px solid var(--border-color, #cbd5e1)',
                  boxShadow: '0 3px 10px rgba(0,0,0,0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'visible'
                }}
              >
                {att.isImage && att.preview ? (
                  <>
                    <img
                      src={att.preview}
                      alt="attachment preview"
                      style={{
                        width: '100%',
                        height: '100%',
                        borderRadius: '13px',
                        objectFit: 'cover',
                        display: 'block'
                      }}
                    />
                    {att.compressed && (
                      <span
                        title={`Original: ${(att.originalSize / 1024 / 1024).toFixed(2)}MB | Ultra Compressed: ${(att.size / 1024).toFixed(0)}KB (${att.percentSaved || 85}% smaller)`}
                        style={{
                          position: 'absolute',
                          bottom: '3px',
                          left: '3px',
                          background: 'rgba(16, 185, 129, 0.92)',
                          color: '#ffffff',
                          fontSize: '8px',
                          fontWeight: 700,
                          padding: '1.5px 4px',
                          borderRadius: '5px',
                          backdropFilter: 'blur(2px)',
                          lineHeight: 1,
                          pointerEvents: 'none',
                          boxShadow: '0 1px 4px rgba(0,0,0,0.2)'
                        }}
                      >
                        ⚡{(att.size / 1024).toFixed(0)}K
                      </span>
                    )}
                  </>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', color: '#64748b' }}>
                    <Folder size={22} />
                    <span style={{ fontSize: '9px', fontWeight: 600, maxWidth: '58px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {att.name?.split('.').pop()?.toUpperCase() || 'FILE'}
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removeAttachment(att.id)}
                  style={{
                    position: 'absolute',
                    top: '-6px',
                    right: '-6px',
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: '#0f172a',
                    color: '#ffffff',
                    border: '1.5px solid #ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    zIndex: 10,
                    boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                    padding: 0
                  }}
                  aria-label="Remove image"
                >
                  <X size={12} strokeWidth={2.5} />
                </button>
              </div>
            ))}
            {attachments.length < 10 && (
              <div style={{
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--text-secondary, #64748b)',
                padding: '0 6px',
                flexShrink: 0
              }}>
                ({attachments.length}/10)
              </div>
            )}
          </div>
        )}

        {artifactMode && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 8px',
              borderRadius: '6px',
              background: 'rgba(37, 99, 235, 0.08)',
              border: '1px solid rgba(37, 99, 235, 0.25)',
              color: '#2563eb',
              fontSize: '11.5px',
              fontWeight: 500,
              marginBottom: '6px',
              userSelect: 'none'
            }}
          >
            <Layers size={13} style={{ color: '#2563eb' }} />
            <span style={{ fontWeight: 600 }}>Artifacts</span>
            <span style={{
              fontSize: '10.5px',
              padding: '1px 5px',
              borderRadius: '4px',
              background: 'rgba(37, 99, 235, 0.12)',
              color: '#1d4ed8',
              textTransform: 'capitalize'
            }}>
              {artifactSubMode}
            </span>
            <button
              type="button"
              onClick={() => {
                const modes = ['default', 'shadcnui', 'custom'];
                const nextIdx = (modes.indexOf(artifactSubMode) + 1) % modes.length;
                setArtifactSubMode(modes[nextIdx]);
              }}
              title="Change Artifact Mode (Default / Shadcn UI / Custom)"
              style={{
                border: 'none',
                background: 'transparent',
                color: '#2563eb',
                cursor: 'pointer',
                fontSize: '10.5px',
                padding: '1px 4px',
                textDecoration: 'underline'
              }}
            >
              switch
            </button>
            <button
              type="button"
              onClick={() => setArtifactMode(false)}
              title="Turn off Artifacts"
              style={{
                border: 'none',
                background: 'transparent',
                color: '#64748b',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '2px',
                marginLeft: '2px'
              }}
            >
              <X size={12} />
            </button>
          </div>
        )}

        <form className="composer" onSubmit={handleSend}>
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Message Zuhali..."
            rows={1}
          />

          <div className="composer-tools">
            <div className="menu-anchor">
              <button
                type="button"
                className={`plus-button ${attachOpen ? 'is-open' : ''}`}
                aria-label="Add attachment"
                onClick={() => setAttachOpen((v) => !v)}
              >
                +
              </button>
              {attachOpen && (
                <div className="attachment-menu">
                  <button
                    type="button"
                    onClick={() => {
                      setAttachOpen(false);
                      setArtifactMode((v) => !v);
                    }}
                    style={{
                      background: artifactMode ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
                      color: artifactMode ? '#2563eb' : 'inherit',
                      fontWeight: artifactMode ? 600 : 'normal',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Layers size={18} style={{ color: artifactMode ? '#2563eb' : 'var(--text-secondary, #64748b)' }} />
                      <span>Artifacts</span>
                    </div>
                    {artifactMode && (
                      <span style={{
                        fontSize: '10px',
                        padding: '1px 5px',
                        borderRadius: '4px',
                        background: '#2563eb',
                        color: '#ffffff',
                        fontWeight: 700
                      }}>
                        ON
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAttachOpen(false);
                      cameraRef.current?.click();
                    }}
                  >
                    <Camera size={18} />
                    <span>Camera</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAttachOpen(false);
                      fileRef.current?.click();
                    }}
                  >
                    <Folder size={18} />
                    <span>Files</span>
                  </button>
                </div>
              )}
            </div>

            <div className="composer-spacer" />

            {/* Model Speed & Reasoning Mode Popup Selector */}
            <div className="menu-anchor mode-anchor">
              <button
                type="button"
                className={`mode-button ${modeMenuOpen ? 'is-open' : ''}`}
                aria-label="Select Intelligence Mode"
                title={`Mode: ${MODES.find(m => m.id === reasoningMode)?.label || 'Medium'}`}
                onClick={() => setModeMenuOpen((v) => !v)}
              >
                <SlidersHorizontal size={17} />
              </button>

              {modeMenuOpen && (
                <div className="mode-popup-menu">
                  {MODES.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className={`mode-option-btn ${reasoningMode === m.id ? 'is-selected' : ''}`}
                      onClick={() => handleSelectMode(m.id)}
                    >
                      <span className="mode-option-name">{m.label}</span>
                      {reasoningMode === m.id && <Check size={16} className="mode-check" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Mic Button for Speech-to-Text */}
            <button
              type="button"
              className={`mic-button ${isListening ? 'is-listening' : ''}`}
              aria-label={isListening ? "Listening... Click to stop" : "Speak to type"}
              title={isListening ? "Listening... Click to stop" : "Speak to type"}
              onClick={toggleListening}
            >
              <Mic size={18} className={isListening ? 'mic-pulse-icon' : ''} />
            </button>

            <button
              type={isGenerating ? "button" : "submit"}
              className={`send-button ${isGenerating ? 'is-generating-square' : ''}`}
              aria-label={isGenerating ? "AI is generating..." : "Send message"}
              disabled={!isGenerating && (!draft.trim() && attachments.length === 0)}
            >
              {isGenerating ? (
                <Square size={13} fill="currentColor" />
              ) : (
                <ArrowUp size={20} />
              )}
            </button>
          </div>
        </form>

      </div>

      <input
        ref={fileRef}
        type="file"
        multiple
        accept="image/*,.pdf,.txt,.js,.jsx,.ts,.tsx,.json,.css,.html"
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            processSelectedFiles(e.target.files);
            e.target.value = '';
          }
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            processSelectedFiles(e.target.files);
            e.target.value = '';
          }
        }}
      />
      </div>

      {activeArtifact && (
        <ArtifactsPanel
          artifact={activeArtifact}
          onClose={() => setActiveArtifact(null)}
        />
      )}
    </div>
  );
}
