import React, { useState, useRef } from 'react';
import {
  PanelLeft, SquarePen, Code2, Check, Plus,
  Trash2, FolderOpen, MessageSquare, FileCode, Monitor
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';

export default function CodeEditor({ onClose, onOpenTerminal }) {
  const { user } = useAuth();
  const { sendMessage, startNewChat } = useChat();
  const userKey = user?.email ? user.email.toLowerCase().replace(/[^a-z0-9]/g, '_') : 'guest';

  // Real user files (ZERO fake demo files!)
  const [files, setFiles] = useState(() => {
    try {
      const saved = localStorage.getItem(`zuhali_editor_files_${userKey}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        const clean = {};
        for (const [k, v] of Object.entries(parsed)) {
          if (!['App.jsx', 'main.jsx', 'styles.css', 'package.json'].includes(k)) {
            clean[k] = v;
          }
        }
        return clean;
      }
    } catch (e) {}
    return {};
  });

  const [explorerOpen, setExplorerOpen] = useState(true);
  const [activeFile, setActiveFile] = useState(() => Object.keys(files)[0] || null);
  const [fileSearch, setFileSearch] = useState('');
  const [newFilePrompt, setNewFilePrompt] = useState(false);
  const [newFileName, setNewFileName] = useState('');

  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  // Sync files to localStorage per user
  const updateFiles = (updated) => {
    setFiles(updated);
    try {
      localStorage.setItem(`zuhali_editor_files_${userKey}`, JSON.stringify(updated));
    } catch (e) {}
  };

  // Create new file
  const handleCreateFile = (e) => {
    e?.preventDefault();
    const name = newFileName.trim();
    if (!name) return;
    
    const finalName = name.includes('.') ? name : `${name}.js`;
    const updated = { ...files, [finalName]: '' };
    updateFiles(updated);
    setActiveFile(finalName);
    setNewFileName('');
    setNewFilePrompt(false);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  // Delete file
  const handleDeleteFile = (fileName, e) => {
    e?.stopPropagation();
    const copy = { ...files };
    delete copy[fileName];
    updateFiles(copy);
    if (activeFile === fileName) {
      const remaining = Object.keys(copy);
      setActiveFile(remaining.length > 0 ? remaining[0] : null);
    }
  };

  // Open file from local computer
  const handleOpenFileFromDevice = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      const updated = { ...files, [file.name]: content };
      updateFiles(updated);
      setActiveFile(file.name);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Handle Code Change
  const handleCodeChange = (e) => {
    if (!activeFile) return;
    const newContent = e.target.value;
    const updated = { ...files, [activeFile]: newContent };
    updateFiles(updated);
  };

  // Handle Tab key in editor
  const handleKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = textarea.value;

      textarea.value = val.substring(0, start) + '  ' + val.substring(end);
      textarea.selectionStart = textarea.selectionEnd = start + 2;

      if (activeFile) {
        updateFiles({ ...files, [activeFile]: textarea.value });
      }
    }
  };

  // Send Code to AI for Review
  const handleSendToAI = () => {
    if (!activeFile || !files[activeFile]) return;
    const content = files[activeFile];
    sendMessage(`Please review and optimize this code (${activeFile}):\n\n\`\`\`\n${content}\n\`\`\``);
    onClose();
  };

  const fileList = Object.keys(files);
  const currentContent = activeFile && files[activeFile] !== undefined ? files[activeFile] : '';
  const lines = currentContent ? currentContent.split('\n') : [''];

  return (
    <section className="code-editor-screen">
      {/* Top Header */}
      <header className="code-editor-header">
        <button
          className="code-header-icon"
          type="button"
          aria-label="Toggle sidebar"
          title="Toggle sidebar"
          onClick={() => setExplorerOpen((v) => !v)}
        >
          <PanelLeft size={20} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 12 }}>
          <strong style={{ fontSize: 15, fontWeight: 650, color: 'var(--text-primary, #1e293b)' }}>
            Code Workspace
          </strong>
          {activeFile && (
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: '#e2e8f0', color: '#475569', fontWeight: 600 }}>
              {lines.length} lines
            </span>
          )}
        </div>

        <div className="code-header-spacer" />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            className="code-header-tool-btn"
            title="Terminal"
            onClick={onOpenTerminal}
          >
            <Monitor size={15} />
            <span>Terminal</span>
          </button>

          {activeFile && (
            <button
              type="button"
              className="code-header-tool-btn"
              title="Ask AI to review this code"
              style={{ color: 'var(--accent-color, #16a34a)', borderColor: 'var(--accent-color, #16a34a)' }}
              onClick={handleSendToAI}
            >
              <MessageSquare size={15} />
              <span>Review with AI</span>
            </button>
          )}

          <button
            className="code-header-icon"
            type="button"
            aria-label="New chat"
            title="New chat / Return to chat"
            onClick={() => {
              if (startNewChat) startNewChat();
              onClose();
            }}
          >
            <SquarePen size={19} />
          </button>
        </div>
      </header>

      {/* Main Body */}
      <div className="code-editor-body">
        {/* Left Sidebar */}
        {explorerOpen && (
          <aside className="code-editor-sidebar">
            <div className="explorer-content-wrap">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 14px 8px' }}>
                <div className="explorer-project" style={{ padding: 0, fontSize: 11 }}>WORKSPACE FILES</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    title="New File"
                    onClick={() => setNewFilePrompt(true)}
                    style={{ background: 'none', border: 0, cursor: 'pointer', color: 'var(--accent-color, #16a34a)', padding: 2, display: 'flex' }}
                  >
                    <Plus size={18} />
                  </button>
                  <button
                    type="button"
                    title="Open File from Computer"
                    onClick={() => fileInputRef.current?.click()}
                    style={{ background: 'none', border: 0, cursor: 'pointer', color: '#64748b', padding: 2, display: 'flex' }}
                  >
                    <FolderOpen size={18} />
                  </button>
                </div>
              </div>

              {newFilePrompt && (
                <form onSubmit={handleCreateFile} style={{ padding: '0 12px 10px' }}>
                  <input
                    type="text"
                    autoFocus
                    className="explorer-search"
                    style={{ margin: 0, width: '100%' }}
                    placeholder="filename.py, index.js..."
                    value={newFileName}
                    onChange={(e) => setNewFileName(e.target.value)}
                    onBlur={() => { if (!newFileName.trim()) setNewFilePrompt(false); }}
                  />
                </form>
              )}

              {fileList.length > 0 && (
                <input
                  className="explorer-search"
                  value={fileSearch}
                  onChange={(e) => setFileSearch(e.target.value)}
                  placeholder="Search files..."
                />
              )}

              <div className="explorer-tree">
                {fileList.length === 0 ? (
                  <div style={{ padding: '36px 14px', textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
                    <FileCode size={36} style={{ margin: '0 auto 10px', display: 'block', opacity: 0.5 }} />
                    <p style={{ margin: '0 0 14px', fontWeight: 500 }}>No files in workspace</p>
                    <button
                      type="button"
                      onClick={() => setNewFilePrompt(true)}
                      style={{
                        background: 'var(--accent-color, #16a34a)',
                        color: '#fff',
                        border: 0,
                        borderRadius: 10,
                        padding: '8px 16px',
                        fontSize: 12.5,
                        fontWeight: 650,
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px color-mix(in srgb, var(--accent-color, #16a34a) 30%, transparent)'
                      }}
                    >
                      + Create File
                    </button>
                  </div>
                ) : (
                  fileList
                    .filter((name) => name.toLowerCase().includes(fileSearch.toLowerCase()))
                    .map((fileName) => (
                      <div
                        key={fileName}
                        className={`explorer-file ${activeFile === fileName ? 'selected' : ''}`}
                        onClick={() => setActiveFile(fileName)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 8 }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <Code2 size={15} style={{ marginRight: 8, opacity: 0.8, flexShrink: 0 }} />
                          <span>{fileName}</span>
                        </div>
                        <button
                          type="button"
                          title="Delete file"
                          onClick={(e) => handleDeleteFile(fileName, e)}
                          style={{ background: 'none', border: 0, color: '#94a3b8', cursor: 'pointer', padding: 2, display: 'flex' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))
                )}
              </div>
            </div>
          </aside>
        )}

        {/* Right Editor Area */}
        <main className="code-editor-main">
          {activeFile ? (
            <>
              <div className="code-editor-tabbar">
                <div className="code-editor-tab">
                  <Code2 size={15} />
                  <span>{activeFile}</span>
                  <span style={{ fontSize: 10, color: 'var(--accent-color, #16a34a)', fontWeight: 650 }}>• saved</span>
                </div>
              </div>

              <div className="code-editor-workspace">
                <div className="code-editor-gutter" aria-hidden="true">
                  {lines.map((_, i) => (
                    <span key={i}>{i + 1}</span>
                  ))}
                </div>
                <textarea
                  ref={textareaRef}
                  value={currentContent}
                  onChange={handleCodeChange}
                  onKeyDown={handleKeyDown}
                  spellCheck="false"
                  placeholder="// Write your code here..."
                  style={{
                    flex: 1,
                    minHeight: '100%',
                    border: 0,
                    outline: 0,
                    resize: 'none',
                    background: 'transparent',
                    color: 'inherit',
                    fontFamily: 'inherit',
                    fontSize: 'inherit',
                    lineHeight: 'inherit',
                    padding: '0 28px 0 0',
                    tabSize: 2,
                    caretColor: 'var(--accent-color, #16a34a)'
                  }}
                />
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', gap: 14 }}>
              <Code2 size={56} style={{ opacity: 0.4, color: 'var(--accent-color, #16a34a)' }} />
              <h2 style={{ margin: 0, fontSize: 19, fontWeight: 650, color: 'var(--text-primary, #1e293b)' }}>
                Zuhali Code Editor
              </h2>
              <p style={{ margin: 0, fontSize: 13, maxWidth: 320, textAlign: 'center', color: '#64748b', lineHeight: 1.5 }}>
                No file open. Create a new file or open one from your computer to start coding.
              </p>
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  className="choose-files-btn"
                  onClick={() => {
                    setExplorerOpen(true);
                    setNewFilePrompt(true);
                  }}
                >
                  + Create New File
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: '1px solid #cbd5e1',
                    borderRadius: 12,
                    padding: '10px 18px',
                    background: '#fff',
                    color: '#334155',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Open File
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Hidden local file picker */}
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: 'none' }}
        onChange={handleOpenFileFromDevice}
      />
    </section>
  );
}
