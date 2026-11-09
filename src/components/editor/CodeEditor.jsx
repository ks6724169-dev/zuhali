import React, { useState } from 'react';
import { PanelLeft, MessageCircle, Code2, GitBranch, RefreshCw, Check } from 'lucide-react';

const VIRTUAL_FILES = {
  'App.jsx': `import React from 'react';
import { AuthProvider } from './context/AuthContext';
import { ChatProvider } from './context/ChatContext';
import { ThemeProvider } from './context/ThemeContext';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ChatProvider>
          {/* Zuhali AI Production Workspace */}
        </ChatProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}`,
  'main.jsx': `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`,
  'styles.css': `/* Zuhali Design System & Tokens */
:root {
  --accent-color: #16A34A;
  --bg-primary: #FFFFFF;
  --text-primary: #111827;
}

.dark-mode {
  --bg-primary: #0F172A;
  --text-primary: #F8FAFC;
}`,
  'package.json': `{
  "name": "zuhali-ai-ui",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  }
}`
};

export default function CodeEditor({ onClose, onOpenTerminal }) {
  const [explorerOpen, setExplorerOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('Explorer');
  const [activeFile, setActiveFile] = useState('App.jsx');
  const [fileSearch, setFileSearch] = useState('');
  const [commitMsg, setCommitMsg] = useState('');
  const [committed, setCommitted] = useState(false);

  const fileList = Object.keys(VIRTUAL_FILES);
  const currentContent = VIRTUAL_FILES[activeFile] || '// Select a file to view source';
  const lines = currentContent.split('\n');

  const handleCommit = () => {
    if (!commitMsg.trim()) return;
    setCommitted(true);
    setTimeout(() => {
      setCommitMsg('');
      setCommitted(false);
    }, 2000);
  };

  return (
    <section className="code-editor-screen">
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
        <div className="code-header-spacer" />
        <button
          className="code-header-icon"
          type="button"
          aria-label="Back to chat"
          title="Back to chat"
          onClick={onClose}
        >
          <MessageCircle size={20} />
        </button>
      </header>

      <div className="editor-sidebar-layout">
        {explorerOpen && (
          <aside className="explorer-panel">
            <div className="editor-panel-nav">
              {['Explorer', 'Source Control', 'Terminal'].map((item) => (
                <button
                  type="button"
                  key={item}
                  className={activeTab === item ? 'active' : ''}
                  onClick={() => {
                    setActiveTab(item);
                    if (item === 'Terminal') onOpenTerminal();
                  }}
                >
                  {item}
                </button>
              ))}
            </div>

            {activeTab === 'Explorer' && (
              <>
                <input
                  className="explorer-search"
                  value={fileSearch}
                  onChange={(e) => setFileSearch(e.target.value)}
                  placeholder="Search files"
                />
                <div className="explorer-project">ZUHALI WORKSPACE</div>
                <div className="explorer-tree">
                  {fileList
                    .filter((name) => name.toLowerCase().includes(fileSearch.toLowerCase()))
                    .map((fileName) => (
                      <button
                        type="button"
                        key={fileName}
                        className={`explorer-file ${activeFile === fileName ? 'selected' : ''}`}
                        onClick={() => setActiveFile(fileName)}
                      >
                        <Code2 size={14} style={{ marginRight: 6, opacity: 0.7 }} />
                        <span>{fileName}</span>
                      </button>
                    ))}
                </div>
              </>
            )}

            {activeTab === 'Source Control' && (
              <div className="source-control-panel">
                <div className="source-control-branch">
                  <GitBranch size={14} style={{ marginRight: 6 }} /> main (synced)
                </div>
                <div className="source-control-section-title">
                  CHANGES <span>{committed ? '0' : '2'}</span>
                </div>
                {!committed ? (
                  <>
                    <div className="source-control-change">
                      <span> M </span><strong>App.jsx</strong><small>Modified</small>
                    </div>
                    <div className="source-control-change">
                      <span> M </span><strong>styles.css</strong><small>Modified</small>
                    </div>
                    <textarea
                      className="source-control-message"
                      placeholder="Commit message (e.g. refactor: modular architecture)"
                      rows={3}
                      value={commitMsg}
                      onChange={(e) => setCommitMsg(e.target.value)}
                    />
                    <button
                      type="button"
                      className="source-control-commit"
                      onClick={handleCommit}
                      disabled={!commitMsg.trim()}
                    >
                      Commit to main
                    </button>
                  </>
                ) : (
                  <div style={{ padding: '16px 0', color: 'var(--accent-color)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Check size={16} /> Changes committed successfully!
                  </div>
                )}
              </div>
            )}
          </aside>
        )}
      </div>

      <div className="code-editor-tabbar">
        <div className="code-editor-tab">
          <Code2 size={15} />
          <span>{activeFile}</span>
        </div>
      </div>

      <div className="code-editor-workspace">
        <div className="code-editor-gutter" aria-hidden="true">
          {lines.map((_, i) => (
            <span key={i}>{i + 1}</span>
          ))}
        </div>
        <pre className="code-editor-content">
          <code>{currentContent}</code>
        </pre>
      </div>
    </section>
  );
}
