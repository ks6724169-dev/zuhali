import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  PanelLeft, SquarePen, Plus, FolderOpen,
  Monitor, Play, ChevronDown, ChevronRight, Folder, RefreshCw, X, Code2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';

export default function CodeEditor({ onClose, onOpenTerminal }) {
  const { user } = useAuth();
  const { startNewChat } = useChat();
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
  const [showPreview, setShowPreview] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [collapsedFolders, setCollapsedFolders] = useState({});

  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  // Live Sync with AI Developer Agent created files
  useEffect(() => {
    const handleSync = (e) => {
      if (e.detail?.files) {
        setFiles(e.detail.files);
        if (e.detail.activeFile) {
          setActiveFile(e.detail.activeFile);
        }
      }
    };
    window.addEventListener('zuhali_editor_sync', handleSync);
    return () => window.removeEventListener('zuhali_editor_sync', handleSync);
  }, []);

  // Sync files to localStorage per user
  const updateFiles = (updated) => {
    setFiles(updated);
    try {
      localStorage.setItem(`zuhali_editor_files_${userKey}`, JSON.stringify(updated));
    } catch (e) {}
  };

  // Toggle folder collapse
  const toggleFolder = (folderName) => {
    setCollapsedFolders((prev) => ({
      ...prev,
      [folderName]: !prev[folderName]
    }));
  };

  // Build VS Code Folder / File Tree
  const fileTree = useMemo(() => {
    const folders = {};
    const rootFiles = [];
    const query = fileSearch.trim().toLowerCase();

    Object.keys(files).forEach((fullPath) => {
      if (query && !fullPath.toLowerCase().includes(query)) return;

      if (fullPath.includes('/')) {
        const parts = fullPath.split('/');
        const folder = parts[0];
        const filename = parts.slice(1).join('/');
        if (!folders[folder]) folders[folder] = [];
        folders[folder].push({ fullPath, filename });
      } else {
        rootFiles.push({ fullPath, filename: fullPath });
      }
    });

    return { folders, rootFiles };
  }, [files, fileSearch]);

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

  // Render VS Code file extension badge
  const renderFileBadge = (filename) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'html':
      case 'htm':
        return <span className="vs-file-badge html">HTML</span>;
      case 'css':
        return <span className="vs-file-badge css">CSS</span>;
      case 'js':
      case 'jsx':
        return <span className="vs-file-badge js">JS</span>;
      case 'py':
        return <span className="vs-file-badge py">PY</span>;
      case 'json':
        return <span className="vs-file-badge json">JSON</span>;
      case 'md':
        return <span className="vs-file-badge md">MD</span>;
      default:
        return <span className="vs-file-badge generic">{ext?.toUpperCase() || 'FILE'}</span>;
    }
  };

  // Live Preview HTML Compiler
  const previewHtml = useMemo(() => {
    // 1. Find HTML file
    const htmlKey = Object.keys(files).find(
      (k) => k.endsWith('.html') || k.endsWith('.htm')
    );
    if (!htmlKey) {
      return `<!DOCTYPE html><html><body style="font-family:'Segoe UI',sans-serif;padding:40px;color:#64748b;text-align:center;"><h3>No HTML File Selected</h3><p>Create or select an <code>index.html</code> file to preview your web application.</p></body></html>`;
    }

    let html = files[htmlKey] || '';

    // 2. Inject CSS
    const cssKeys = Object.keys(files).filter((k) => k.endsWith('.css'));
    const combinedCss = cssKeys.map((k) => files[k]).join('\n');
    if (combinedCss) {
      if (html.includes('</head>')) {
        html = html.replace('</head>', `<style>\n${combinedCss}\n</style></head>`);
      } else {
        html = `<style>\n${combinedCss}\n</style>` + html;
      }
    }

    // 3. Inject JS
    const jsKeys = Object.keys(files).filter((k) => k.endsWith('.js') && !k.endsWith('.json'));
    const combinedJs = jsKeys.map((k) => files[k]).join('\n;\n');
    if (combinedJs) {
      if (html.includes('</body>')) {
        html = html.replace('</body>', `<script>\n${combinedJs}\n</script></body>`);
      } else {
        html = html + `<script>\n${combinedJs}\n</script>`;
      }
    }

    return html;
  }, [files, previewKey]);

  const fileList = Object.keys(files);
  const currentContent = activeFile && files[activeFile] !== undefined ? files[activeFile] : '';
  const lines = currentContent ? currentContent.split('\n') : [''];
  const activeFileName = activeFile ? activeFile.split('/').pop() : '';

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
          {/* Live Preview / Code View Toggle Button */}
          <button
            type="button"
            className={`code-header-tool-btn ${showPreview ? 'active' : ''}`}
            title={showPreview ? 'Return to Code Editor' : 'Live Preview'}
            onClick={() => setShowPreview((v) => !v)}
          >
            {showPreview ? <Code2 size={14} /> : <Play size={14} />}
            <span>{showPreview ? 'Code View' : 'Preview'}</span>
          </button>

          {/* Terminal Button */}
          <button
            type="button"
            className="code-header-tool-btn"
            title="Terminal"
            onClick={onOpenTerminal}
          >
            <Monitor size={15} />
            <span>Terminal</span>
          </button>

          {/* Back to Chat / New Chat Icon */}
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
        {/* Left Sidebar (VS Code Style Explorer - Auto-closed in Preview mode) */}
        {!showPreview && explorerOpen && (
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
                        cursor: 'pointer'
                      }}
                    >
                      + Create File
                    </button>
                  </div>
                ) : (
                  <>
                    {/* VS Code Folders */}
                    {Object.entries(fileTree.folders).map(([folderName, items]) => {
                      const isCollapsed = !!collapsedFolders[folderName];
                      return (
                        <div key={folderName} className="vs-folder">
                          <div
                            className="vs-folder-header"
                            onClick={() => toggleFolder(folderName)}
                            title={folderName}
                          >
                            {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                            <Folder size={14} className="vs-folder-icon" />
                            <span className="vs-folder-name">{folderName}</span>
                          </div>
                          {!isCollapsed && (
                            <div className="vs-folder-children">
                              {items.map(({ fullPath, filename }) => (
                                <div
                                  key={fullPath}
                                  className={`explorer-file ${activeFile === fullPath ? 'selected' : ''}`}
                                  onClick={() => setActiveFile(fullPath)}
                                  title={filename}
                                >
                                  {renderFileBadge(filename)}
                                  <span className="vs-file-name">{filename}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Root Files */}
                    {fileTree.rootFiles.map(({ fullPath, filename }) => (
                      <div
                        key={fullPath}
                        className={`explorer-file ${activeFile === fullPath ? 'selected' : ''}`}
                        onClick={() => setActiveFile(fullPath)}
                        title={filename}
                      >
                        {renderFileBadge(filename)}
                        <span className="vs-file-name">{filename}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          </aside>
        )}

        {/* When showPreview is TRUE: Code screen & sidebar auto-close, only Preview is shown */}
        {showPreview ? (
          <div className="code-editor-preview-pane">
            <div className="preview-pane-header">
              <div className="preview-url-bar">
                <span style={{ color: '#16a34a', fontWeight: 700, fontSize: 10 }}>●</span>
                <span>http://localhost:3000/</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  title="Reload Preview"
                  onClick={() => setPreviewKey((k) => k + 1)}
                  style={{ background: 'none', border: 0, cursor: 'pointer', color: '#64748b', padding: 4 }}
                >
                  <RefreshCw size={15} />
                </button>
                <button
                  type="button"
                  className="code-header-tool-btn"
                  onClick={() => setShowPreview(false)}
                  style={{ height: 30, fontSize: 12, padding: '0 12px', gap: 6 }}
                >
                  <Code2 size={14} />
                  <span>Back to Code</span>
                </button>
                <button
                  type="button"
                  title="Close Preview"
                  onClick={() => setShowPreview(false)}
                  style={{ background: 'none', border: 0, cursor: 'pointer', color: '#94a3b8', padding: 4 }}
                >
                  <X size={17} />
                </button>
              </div>
            </div>
            <iframe
              key={previewKey}
              title="Live Preview"
              className="preview-iframe-wrapper"
              srcDoc={previewHtml}
              sandbox="allow-scripts allow-forms allow-modals"
            />
          </div>
        ) : (
          <main className="code-editor-main">
            {activeFile ? (
              <>
                <div className="code-editor-tabbar">
                  <div className="code-editor-tab">
                    {renderFileBadge(activeFileName)}
                    <span style={{ fontWeight: 600 }}>{activeFileName}</span>
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
                <Folder size={56} style={{ opacity: 0.35, color: 'var(--accent-color, #16a34a)' }} />
                <h2 style={{ margin: 0, fontSize: 19, fontWeight: 650, color: 'var(--text-primary, #1e293b)' }}>
                  Zuhali Code Workspace
                </h2>
                <p style={{ margin: 0, fontSize: 13, maxWidth: 320, textAlign: 'center', color: '#64748b', lineHeight: 1.5 }}>
                  Select a file from the explorer on the left or create a new one to start editing.
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
        )}
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
