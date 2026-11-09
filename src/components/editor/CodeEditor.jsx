import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  PanelLeft, SquarePen, Plus, FolderOpen,
  Monitor, Play, ChevronDown, ChevronRight, Folder, RefreshCw, X, Code2,
  Pencil, Trash2
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

  // Long-press folder context menu & operations
  const [folderMenu, setFolderMenu] = useState(null); // { folderName, x, y }
  const [renamingFolder, setRenamingFolder] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [deletingFolder, setDeletingFolder] = useState(null);
  const longPressTimer = useRef(null);
  const isLongPressTriggered = useRef(false);

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

  // Long-press handlers for folder header
  const handleFolderPointerDown = (folderName, e) => {
    isLongPressTriggered.current = false;
    const clientX = e.clientX || (e.touches && e.touches[0]?.clientX) || 120;
    const clientY = e.clientY || (e.touches && e.touches[0]?.clientY) || 150;
    longPressTimer.current = setTimeout(() => {
      isLongPressTriggered.current = true;
      setFolderMenu({ folderName, x: clientX, y: clientY });
    }, 450);
  };

  const handleFolderPointerUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const handleFolderClick = (folderName) => {
    if (isLongPressTriggered.current) {
      isLongPressTriggered.current = false;
      return;
    }
    toggleFolder(folderName);
  };

  // Confirm rename folder
  const handleConfirmRename = async (oldName) => {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === oldName) {
      setRenamingFolder(null);
      return;
    }

    const newFolder = trimmed.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const updated = {};
    for (const [k, v] of Object.entries(files)) {
      if (k.startsWith(`${oldName}/`)) {
        const suffix = k.slice(oldName.length + 1);
        updated[`${newFolder}/${suffix}`] = v;
      } else {
        updated[k] = v;
      }
    }

    updateFiles(updated);

    if (activeFile && activeFile.startsWith(`${oldName}/`)) {
      const suffix = activeFile.slice(oldName.length + 1);
      setActiveFile(`${newFolder}/${suffix}`);
    }

    setRenamingFolder(null);

    // Sync rename to backend disk
    try {
      await fetch(
        `http://localhost:8000/api/v1/chat/project/rename?old_name=${encodeURIComponent(oldName)}&new_name=${encodeURIComponent(newFolder)}${user?.email ? `&user_email=${encodeURIComponent(user.email)}` : ''}`,
        { method: 'PATCH' }
      );
    } catch (e) {}
  };

  // Confirm delete folder
  const handleConfirmDelete = async (folderName) => {
    const updated = {};
    for (const [k, v] of Object.entries(files)) {
      if (!k.startsWith(`${folderName}/`)) {
        updated[k] = v;
      }
    }

    updateFiles(updated);

    if (activeFile && activeFile.startsWith(`${folderName}/`)) {
      const remaining = Object.keys(updated);
      setActiveFile(remaining.length > 0 ? remaining[0] : null);
    }

    setDeletingFolder(null);
    setFolderMenu(null);

    // Sync delete to backend disk
    try {
      await fetch(
        `http://localhost:8000/api/v1/chat/project?project_name=${encodeURIComponent(folderName)}${user?.email ? `&user_email=${encodeURIComponent(user.email)}` : ''}`,
        { method: 'DELETE' }
      );
    } catch (e) {}
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
    const htmlKey = Object.keys(files).find(
      (k) => k.endsWith('.html') || k.endsWith('.htm')
    );
    if (!htmlKey) {
      return `<!DOCTYPE html><html><body style="font-family:'Segoe UI',sans-serif;padding:40px;color:#64748b;text-align:center;"><h3>No HTML File Selected</h3><p>Create or select an <code>index.html</code> file to preview your web application.</p></body></html>`;
    }

    let html = files[htmlKey] || '';

    // Inject CSS
    const cssKeys = Object.keys(files).filter((k) => k.endsWith('.css'));
    const combinedCss = cssKeys.map((k) => files[k]).join('\n');
    if (combinedCss) {
      if (html.includes('</head>')) {
        html = html.replace('</head>', `<style>\n${combinedCss}\n</style></head>`);
      } else {
        html = `<style>\n${combinedCss}\n</style>` + html;
      }
    }

    // Inject JS
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
            {showPreview ? 'Live Preview' : 'Code Workspace'}
          </strong>
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
                            title={`${folderName} (Long-press / right-click for options)`}
                            onClick={() => handleFolderClick(folderName)}
                            onMouseDown={(e) => handleFolderPointerDown(folderName, e)}
                            onMouseUp={handleFolderPointerUp}
                            onMouseLeave={handleFolderPointerUp}
                            onTouchStart={(e) => handleFolderPointerDown(folderName, e)}
                            onTouchEnd={handleFolderPointerUp}
                            onTouchCancel={handleFolderPointerUp}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              handleFolderPointerUp();
                              setFolderMenu({ folderName, x: e.clientX, y: e.clientY });
                            }}
                          >
                            {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                            <Folder size={14} className="vs-folder-icon" />

                            {renamingFolder === folderName ? (
                              <input
                                type="text"
                                autoFocus
                                className="folder-rename-input"
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleConfirmRename(folderName);
                                  if (e.key === 'Escape') setRenamingFolder(null);
                                }}
                                onBlur={() => handleConfirmRename(folderName)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : (
                              <span className="vs-folder-name">{folderName}</span>
                            )}
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

        {/* When showPreview is TRUE: Pure full-screen preview with zero extra bars */}
        {showPreview ? (
          <div className="code-editor-preview-pane">
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

      {/* Folder Context Menu (Long-press / Right-click) */}
      {folderMenu && (
        <>
          <div
            className="folder-menu-backdrop"
            onClick={() => setFolderMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setFolderMenu(null);
            }}
          />
          <div
            className="folder-context-menu"
            style={{
              top: Math.min(folderMenu.y, window.innerHeight - 110),
              left: Math.min(folderMenu.x, window.innerWidth - 190)
            }}
          >
            <div className="folder-menu-header">{folderMenu.folderName}</div>
            <button
              type="button"
              className="folder-menu-item"
              onClick={() => {
                setRenamingFolder(folderMenu.folderName);
                setRenameValue(folderMenu.folderName);
                setFolderMenu(null);
              }}
            >
              <Pencil size={14} style={{ color: 'var(--accent-color, #16a34a)' }} />
              <span>Rename</span>
            </button>
            <button
              type="button"
              className="folder-menu-item danger"
              onClick={() => {
                setDeletingFolder(folderMenu.folderName);
                setFolderMenu(null);
              }}
            >
              <Trash2 size={14} />
              <span>Delete</span>
            </button>
          </div>
        </>
      )}

      {/* Delete Project Modal */}
      {deletingFolder && (
        <div className="delete-project-modal-overlay" onClick={() => setDeletingFolder(null)}>
          <div className="delete-project-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#fee2e2', color: '#dc2626', display: 'grid', placeItems: 'center' }}>
                <Trash2 size={18} />
              </div>
              <div>
                <strong style={{ fontSize: 15, color: '#0f172a', display: 'block' }}>Delete Project</strong>
                <span style={{ fontSize: 12, color: '#64748b' }}>Permanently remove from system</span>
              </div>
            </div>
            <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.5, margin: '0 0 18px' }}>
              Are you sure you want to delete <strong>"{deletingFolder}"</strong> and all of its files? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}
                onClick={() => setDeletingFolder(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                style={{
                  background: '#dc2626',
                  color: '#fff',
                  border: 0,
                  borderRadius: 8,
                  padding: '8px 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
                onClick={() => handleConfirmDelete(deletingFolder)}
              >
                Delete Project
              </button>
            </div>
          </div>
        </div>
      )}

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
