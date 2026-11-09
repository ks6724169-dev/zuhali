import React, { useState, useRef } from 'react';
import {
  PanelLeft, SquarePen, MoreHorizontal, Copy, Pencil, Share2, Pin,
  Archive, FolderPlus, Download, Flag, Trash2, GitBranch, Volume2,
  Heart, ThumbsDown, RefreshCw, Folder, Camera, Code2, Monitor, Mic,
  ArrowUp, X, Check
} from 'lucide-react';
import { useChat } from '../../context/ChatContext';

export default function ChatWorkspace({
  onToggleSidebar,
  onOpenEditor,
  onOpenTerminal
}) {
  const {
    currentConv,
    currentMessages,
    isGenerating,
    startNewChat,
    togglePinChat,
    toggleArchiveChat,
    deleteChat,
    sendMessage,
    branchFrom,
    regenerate,
    speakResponse,
    setActiveFeedbackModal,
    setActiveRenameModal,
    getConversationText
  } = useChat();

  const [menuOpen, setMenuOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const [developerMode, setDeveloperMode] = useState(false);
  const [developerPanel, setDeveloperPanel] = useState(null);
  const [copied, setCopied] = useState(false);
  const [activeUserMenu, setActiveUserMenu] = useState(null);

  const fileRef = useRef(null);
  const cameraRef = useRef(null);
  const inputRef = useRef(null);
  const longPressTimer = useRef(null);

  const hasConversation = currentMessages.length > 0;

  const handleSend = (e) => {
    e?.preventDefault();
    if (!draft.trim() && !attachment) return;
    sendMessage(draft, attachment, { developerMode });
    setDraft('');
    setAttachment(null);
    setAttachOpen(false);
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

  const copySingleResponse = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
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
      <section className={`conversation ${hasConversation ? 'has-messages' : 'empty-state'}`}>
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
                    <div className="assistant-label">
                      <span className="assistant-mark">z</span>
                      <strong>Zuhali</strong>
                    </div>

                    {message.devSteps && message.devSteps.length > 0 && (
                      <div className="dev-agent-card">
                        <div className="dev-agent-card-header">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div className="dev-agent-pulse-icon">
                              <Code2 size={15} />
                            </div>
                            <strong style={{ fontSize: 13, color: '#0f172a' }}>Autonomous Developer Agent</strong>
                            {message.projectData?.projectName && (
                              <span className="dev-project-badge">{message.projectData.projectName}</span>
                            )}
                          </div>
                          {message.isStreaming && (
                            <span className="dev-agent-status-badge">
                              <span className="dev-pulse-dot" /> Working...
                            </span>
                          )}
                        </div>

                        <div className="dev-agent-steps">
                          {message.devSteps.map((step, idx) => (
                            <div key={idx} className="dev-agent-step-item">
                              <span className="dev-step-icon">
                                {step.step === 'mkdir' ? '📁' : step.step === 'file_write' ? '📝' : step.step === 'terminal' ? '💻' : '⚡'}
                              </span>
                              <div className="dev-step-body">
                                <div className="dev-step-title">{step.title}</div>
                                {step.details && <div className="dev-step-details">{step.details}</div>}
                                {step.command && <div className="dev-step-command">$ {step.command}</div>}
                              </div>
                              <span className="dev-step-check">✓</span>
                            </div>
                          ))}
                        </div>

                        {message.projectData && (
                          <div className="dev-agent-actions">
                            <button
                              type="button"
                              className="dev-action-btn primary"
                              onClick={onOpenEditor}
                            >
                              <Code2 size={15} />
                              <span>Open in Code Editor</span>
                            </button>
                            <button
                              type="button"
                              className="dev-action-btn secondary"
                              onClick={onOpenTerminal}
                            >
                              <Monitor size={15} />
                              <span>Open Terminal</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    <p style={{ whiteSpace: 'pre-line' }}>{message.text}</p>
                    {message.isStreaming && <span className="streaming-cursor">▋</span>}
                    {!message.isStreaming && message.text && (
                      <div className="response-tools" aria-label="Response actions">
                        <button
                          title="Copy response"
                          aria-label="Copy response"
                          onClick={() => copySingleResponse(message.text)}
                        >
                          <Copy size={16} />
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
                          title="Read aloud"
                          aria-label="Read aloud"
                          onClick={() => speakResponse(message.text)}
                        >
                          <Volume2 size={16} />
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
                        <button role="menuitem" onClick={() => copySingleResponse(message.text)}>
                          <Copy size={15} /> Copy
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </article>
            ))}
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

        {developerMode && (
          <div className="mode-chip">
            <Code2 size={14} />
            Developer mode
            <button onClick={() => setDeveloperMode(false)} aria-label="Remove developer mode">
              <X size={13} />
            </button>
          </div>
        )}

        {developerMode && developerPanel && (
          <div className="developer-panel-note">
            <strong>{developerPanel === 'code' ? 'Code Editor' : 'Terminal View'}</strong>
            <span>
              {developerPanel === 'code'
                ? 'Full interactive Code Editor ready with Git preview.'
                : 'Interactive Web Terminal session active.'}
            </span>
            <button type="button" onClick={() => setDeveloperPanel(null)} aria-label="Close developer panel">
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
                  <button
                    type="button"
                    onClick={() => {
                      setDeveloperMode((v) => !v);
                      setAttachOpen(false);
                    }}
                  >
                    <Code2 size={18} />
                    <span>Developer</span>
                  </button>
                </div>
              )}
            </div>

            {developerMode && (
              <>
                <button
                  type="button"
                  className="developer-tool-button"
                  onClick={onOpenEditor}
                  aria-label="Open code editor"
                >
                  <Code2 size={17} />
                  <span>Code</span>
                </button>
                <button
                  type="button"
                  className="developer-tool-button"
                  onClick={onOpenTerminal}
                  aria-label="Open terminal"
                >
                  <Monitor size={17} />
                  <span>Terminal</span>
                </button>
              </>
            )}

            <div className="composer-spacer" />
            <button
              type="button"
              className="mic-button"
              aria-label="Voice input"
              onClick={() => {
                setDraft((prev) => (prev ? prev + ' ' : '') + 'Show me the project architecture and terminal execution');
              }}
            >
              <Mic size={19} />
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

        <p className="disclaimer">Zuhali can make mistakes. Verify important information.</p>
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
