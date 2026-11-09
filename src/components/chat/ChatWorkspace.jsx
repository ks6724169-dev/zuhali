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
    sendMessage(draft, attachment);
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
                    <p style={{ whiteSpace: 'pre-line' }}>{message.text}</p>
                    {message.isStreaming && <span className="streaming-cursor">▋</span>}
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
                        <div className="attached-file">
                          <Folder size={15} />
                          {message.attachment}
                        </div>
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
          <div className="attachment-chip">
            <Folder size={14} />
            <span>{attachment.name}</span>
            <button onClick={() => setAttachment(null)} aria-label="Remove attachment">
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
              disabled={!draft.trim() && !attachment}
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
          if (file) setAttachment(file);
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
          if (file) setAttachment(file);
        }}
      />
    </>
  );
}
