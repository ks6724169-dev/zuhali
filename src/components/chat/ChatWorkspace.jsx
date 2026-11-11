import React, { useState, useRef, useEffect } from 'react';
import {
  PanelLeft, SquarePen, MoreHorizontal, Copy, Pencil, Share2, Pin,
  Archive, FolderPlus, Download, Flag, Trash2, GitBranch, Volume2,
  Heart, ThumbsDown, RefreshCw, Folder, Camera, Mic, SlidersHorizontal,
  ArrowUp, X, Check, Square
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import FormattedMessage from './FormattedMessage';

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
  const [attachment, setAttachment] = useState(null);
  const [attachOpen, setAttachOpen] = useState(false);
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
    if (!draft.trim() && !attachment) return;
    if (isListening && recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      setIsListening(false);
    }
    sendMessage(draft, attachment, { mode: reasoningMode });
    setDraft('');
    setAttachment(null);
    setAttachOpen(false);
    setModeMenuOpen(false);
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

  const processSelectedFile = (file) => {
    if (!file) return;
    const isImage = file.type?.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(file.name);
    const reader = new FileReader();

    if (isImage) {
      reader.onload = () => {
        setAttachment({
          name: file.name,
          type: file.type || 'image/png',
          size: file.size,
          dataUrl: reader.result,
          preview: reader.result,
          isImage: true
        });
      };
      reader.readAsDataURL(file);
    } else {
      reader.onload = () => {
        setAttachment({
          name: file.name,
          type: file.type || 'text/plain',
          size: file.size,
          textContent: typeof reader.result === 'string' ? reader.result : '',
          preview: null,
          isImage: false
        });
      };
      reader.readAsText(file);
    }
  };

  return (
    <>
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
          {hasConversation && (
            <button
              className="icon-button"
              aria-label="New chat"
              title="New chat"
              onClick={startNewChat}
            >
              <SquarePen size={19} />
            </button>
          )}
        </div>

        {hasConversation && (
          <div className="header-actions">
            <div className="menu-anchor">
              <button
                className="icon-button"
                aria-label="More options"
                title="More options"
                onClick={() => setMenuOpen((v) => !v)}
              >
                <MoreHorizontal size={20} />
              </button>
              {menuOpen && (
                <div className="dropdown-menu">
                  <button onClick={copyConversation}>
                    <Copy size={16} />
                    {copied ? 'Copied to clipboard' : 'Copy conversation'}
                  </button>
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
                  <button onClick={exportChat}>
                    <Download size={16} />
                    Export chat (.txt)
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


                    {/* Natural clean thinking indicator while generating before text begins */}
                    {message.isStreaming && !message.text && (
                      <div className="ai-thinking-indicator" aria-label="Thinking">
                        <span className="thinking-dot" />
                        <span className="thinking-dot" />
                        <span className="thinking-dot" />
                      </div>
                    )}

                    <FormattedMessage text={message.text} onSelectChoice={(val) => sendMessage(val)} />
                    {message.isStreaming && <span className="streaming-cursor">▋</span>}
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
                      className="user-bubble"
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
                      {message.attachment && (
                        message.attachmentData && (message.attachmentType?.startsWith('image/') || message.attachmentData.startsWith('data:image/')) ? (
                          <div className="attached-image-card" style={{ marginBottom: '8px' }}>
                            <img
                              src={message.attachmentData}
                              alt={message.attachment}
                              style={{ maxWidth: '260px', maxHeight: '180px', borderRadius: '10px', objectFit: 'cover', display: 'block', border: '1px solid rgba(255,255,255,0.2)' }}
                            />
                            <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '4px' }}>{message.attachment}</div>
                          </div>
                        ) : (
                          <div className="attached-file" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 10px', background: 'rgba(0,0,0,0.18)', borderRadius: '8px', marginBottom: '6px', fontSize: '12px' }}>
                            <Folder size={15} />
                            <span>{message.attachment}</span>
                          </div>
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
        {attachment && (
          <div className="attachment-chip" style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 12px',
            background: 'var(--surface-active, rgba(22, 163, 74, 0.12))',
            border: '1px solid var(--accent-color, #16a34a)',
            borderRadius: '10px',
            marginBottom: '8px',
            fontSize: '12px'
          }}>
            {attachment.isImage && attachment.preview ? (
              <img src={attachment.preview} alt="preview" style={{ width: 24, height: 24, borderRadius: 4, objectFit: 'cover' }} />
            ) : (
              <Folder size={15} />
            )}
            <span style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {attachment.name}
            </span>
            <button
              type="button"
              onClick={() => setAttachment(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: '2px', display: 'flex' }}
              aria-label="Remove attachment"
            >
              <X size={14} />
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
              type="submit"
              className="send-button"
              aria-label="Send message"
              disabled={(!draft.trim() && !attachment) || isGenerating}
            >
              <ArrowUp size={20} />
            </button>
          </div>
        </form>

      </div>

      <input
        ref={fileRef}
        type="file"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            processSelectedFile(file);
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
          const file = e.target.files?.[0];
          if (file) {
            processSelectedFile(file);
            e.target.value = '';
          }
        }}
      />
    </>
  );
}
