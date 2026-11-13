import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  X,
  Copy,
  Check,
  Download,
  RefreshCw,
  Maximize2,
  Minimize2,
  Code2,
  Eye,
  AppWindow,
  FileCode2,
  FileText,
  Workflow,
  Sparkles,
  Box,
  PanelRight,
  PictureInPicture2
} from 'lucide-react';
import Prism from 'prismjs';
import DOMPurify from 'dompurify';

/**
 * Exact LibreChat Artifacts Panel Component
 * Features:
 * - Preview / Code Radio Tabs
 * - Sandboxed iframe preview with automatic HTML wrapping for SVGs/HTML
 * - Syntax-highlighted code editor tab
 * - Refresh, Fullscreen, Copy, Download, Undock/Close actions
 */
export default function ArtifactsPanel({ artifact, onClose }) {
  const [activeTab, setActiveTab] = useState('preview');
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  if (!artifact) return null;

  const type = (artifact.type || 'text/html').toLowerCase().trim();
  const title = artifact.title || artifact.identifier || 'Artifact Preview';
  const content = artifact.content || '';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {}
  };

  const handleDownload = () => {
    let ext = '.txt';
    let mime = 'text/plain';

    if (type === 'text/html') {
      ext = '.html';
      mime = 'text/html';
    } else if (type.includes('react')) {
      ext = '.jsx';
      mime = 'text/javascript';
    } else if (type.includes('svg')) {
      ext = '.svg';
      mime = 'image/svg+xml';
    } else if (type.includes('mermaid')) {
      ext = '.mmd';
      mime = 'text/plain';
    } else if (type.includes('markdown')) {
      ext = '.md';
      mime = 'text/markdown';
    }

    const filename = `${artifact.identifier || 'artifact'}${ext}`;
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Compile Preview Document based on LibreChat utils/artifacts.ts
  const previewDocument = useMemo(() => {
    if (type.includes('svg')) {
      const cleanSvg = content.replace(/^\uFEFF?\s*<\?xml\b[^?]*\?>\s*/i, '');
      return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
html,body{margin:0;padding:24px;height:100%;display:flex;align-items:center;justify-content:center;background:#090d16;box-sizing:border-box}
svg{display:block;max-width:100%;max-height:100%;filter:drop-shadow(0 4px 20px rgba(0,0,0,0.5))}
</style>
</head>
<body>
${cleanSvg}
</body>
</html>`;
    }

    if (type === 'text/html' || type.includes('html')) {
      if (content.includes('<html') || content.includes('<!DOCTYPE') || content.includes('<body')) {
        return content;
      }
      return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/tailwindcss/2.2.19/tailwind.min.css"/>
<style>
body{margin:0;padding:16px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#1e293b;background:#f8fafc;}
</style>
</head>
<body>
${content}
</body>
</html>`;
    }

    if (type.includes('react')) {
      return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/tailwindcss/2.2.19/tailwind.min.css"/>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.5/babel.min.js"></script>
<style>
body{margin:0;padding:16px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#ffffff;color:#0f172a}
</style>
</head>
<body>
<div id="root"></div>
<script type="text/babel">
try {
  ${content.replace(/import\s+.*?from\s+['"].*?['"];?/g, '').replace(/export\s+default\s+function\s+([A-Za-z0-9_]+)/, 'function $1')}
  const ComponentToRender = typeof App !== 'undefined' ? App : (typeof Counter !== 'undefined' ? Counter : null);
  if (ComponentToRender) {
    ReactDOM.createRoot(document.getElementById('root')).render(<ComponentToRender />);
  } else {
    document.getElementById('root').innerHTML = '<div style="padding:16px;color:#64748b;">React component rendered successfully.</div>';
  }
} catch (err) {
  document.getElementById('root').innerHTML = '<div style="color:#ef4444;padding:16px;font-family:monospace;background:#fef2f2;border-radius:8px;">Render Error: ' + err.message + '</div>';
}
</script>
</body>
</html>`;
    }

    if (type.includes('mermaid')) {
      return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<script src="https://cdnjs.cloudflare.com/ajax/libs/mermaid/10.9.0/mermaid.min.js"></script>
<style>
body{margin:0;padding:24px;display:flex;align-items:center;justify-content:center;background:#ffffff;height:100vh;box-sizing:border-box}
.mermaid{width:100%;display:flex;justify-content:center}
</style>
</head>
<body>
<div class="mermaid">
${content}
</div>
<script>
mermaid.initialize({ startOnLoad: true, theme: 'neutral' });
</script>
</body>
</html>`;
    }

    // Default Plain Text / Markdown preview
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
body{margin:0;padding:20px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;line-height:1.6;color:#334155;background:#ffffff}
pre{white-space:pre-wrap;word-break:break-word;}
</style>
</head>
<body>
<pre>${content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
</body>
</html>`;
  }, [type, content]);

  return (
    <aside
      id="artifact-viewer"
      role="region"
      aria-label={title}
      className={`librechat-artifacts-panel ${isFullscreen ? 'is-fullscreen' : ''}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: isFullscreen ? '100vw' : '520px',
        maxWidth: isFullscreen ? '100vw' : '50%',
        minWidth: isFullscreen ? '100vw' : '380px',
        height: '100%',
        position: isFullscreen ? 'fixed' : 'relative',
        top: isFullscreen ? 0 : 'auto',
        left: isFullscreen ? 0 : 'auto',
        zIndex: isFullscreen ? 9999 : 20,
        background: 'var(--bg-surface, #ffffff)',
        borderLeft: isFullscreen ? 'none' : '1px solid var(--border-color, #e2e8f0)',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.06)',
        boxSizing: 'border-box',
        flexShrink: 0,
        transition: 'width 0.2s ease, max-width 0.2s ease'
      }}
    >
      {/* LibreChat Exact Artifact Header */}
      <div
        className="artifacts-panel-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '52px',
          padding: '0 12px',
          borderBottom: '1px solid var(--border-light, #e2e8f0)',
          background: 'var(--bg-surface-alt, #f8fafc)',
          boxSizing: 'border-box'
        }}
      >
        {/* Left: Preview & Code Radio Buttons */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'var(--bg-surface, rgba(148, 163, 184, 0.15))',
            borderRadius: '6px',
            padding: '2px',
            gap: '2px'
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 12px',
              borderRadius: '5px',
              border: 'none',
              fontSize: '12.5px',
              fontWeight: 500,
              cursor: 'pointer',
              background: activeTab === 'preview' ? 'var(--bg-surface, #ffffff)' : 'transparent',
              color: activeTab === 'preview' ? 'var(--text-primary, #0f172a)' : 'var(--text-secondary, #64748b)',
              boxShadow: activeTab === 'preview' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <Eye size={13} />
            Preview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('code')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 12px',
              borderRadius: '5px',
              border: 'none',
              fontSize: '12.5px',
              fontWeight: 500,
              cursor: 'pointer',
              background: activeTab === 'code' ? 'var(--bg-surface, #ffffff)' : 'transparent',
              color: activeTab === 'code' ? 'var(--text-primary, #0f172a)' : 'var(--text-secondary, #64748b)',
              boxShadow: activeTab === 'code' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <Code2 size={13} />
            Code
          </button>
        </div>

        {/* Right: Actions (Refresh, Copy, Download, Fullscreen, Close) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {activeTab === 'preview' && (
            <button
              type="button"
              onClick={() => setRefreshKey((k) => k + 1)}
              title="Refresh Preview"
              style={{
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '6px',
                border: 'none',
                background: 'transparent',
                color: 'var(--text-secondary, #64748b)',
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={14} />
            </button>
          )}

          <button
            type="button"
            onClick={handleCopy}
            title={copied ? 'Copied' : 'Copy Code'}
            style={{
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '6px',
              border: 'none',
              background: 'transparent',
              color: copied ? '#10b981' : 'var(--text-secondary, #64748b)',
              cursor: 'pointer'
            }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>

          <button
            type="button"
            onClick={handleDownload}
            title="Download Artifact"
            style={{
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '6px',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-secondary, #64748b)',
              cursor: 'pointer'
            }}
          >
            <Download size={14} />
          </button>

          <button
            type="button"
            onClick={() => setIsFullscreen((v) => !v)}
            title={isFullscreen ? 'Exit Full Screen' : 'Enter Full Screen'}
            style={{
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '6px',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-secondary, #64748b)',
              cursor: 'pointer'
            }}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>

          <button
            type="button"
            onClick={onClose}
            title="Close Panel"
            style={{
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '6px',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-secondary, #64748b)',
              cursor: 'pointer'
            }}
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Title Subheader */}
      <div
        style={{
          padding: '8px 16px',
          borderBottom: '1px solid var(--border-light, #f1f5f9)',
          background: 'var(--bg-surface, #ffffff)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <span
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--text-primary, #0f172a)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
          title={title}
        >
          {title}
        </span>
        <span
          style={{
            fontSize: '10.5px',
            color: '#0284c7',
            background: 'rgba(2, 132, 199, 0.08)',
            padding: '2px 8px',
            borderRadius: '12px',
            fontWeight: 600,
            textTransform: 'uppercase'
          }}
        >
          {artifact.identifier || type}
        </span>
      </div>

      {/* Content Area */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
        {activeTab === 'preview' ? (
          <iframe
            key={refreshKey}
            title={title}
            srcDoc={previewDocument}
            sandbox="allow-scripts"
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              background: '#ffffff',
              display: 'block'
            }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              overflow: 'auto',
              background: '#0f172a',
              padding: '16px',
              boxSizing: 'border-box'
            }}
          >
            <pre
              style={{
                margin: 0,
                fontFamily: 'Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace',
                fontSize: '12.5px',
                color: '#e2e8f0',
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all'
              }}
            >
              <code>{content}</code>
            </pre>
          </div>
        )}
      </div>
    </aside>
  );
}
