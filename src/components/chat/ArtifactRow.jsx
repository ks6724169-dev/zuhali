import React from 'react';
import {
  AppWindow,
  Download,
  FileCode2,
  FileSpreadsheet,
  FileText,
  Presentation,
  Workflow,
  Sparkles,
  Box
} from 'lucide-react';

/**
 * Fallback glyphs based on LibreChat's ArtifactRow:
 * FALLBACK_GLYPHS: Record<ArtifactGlyph, React.ComponentType<{ className?: string }>>
 */
const FALLBACK_GLYPHS = {
  preview: AppWindow,
  code: FileCode2,
  text: FileText,
  diagram: Workflow,
  document: FileText,
  spreadsheet: FileSpreadsheet,
  presentation: Presentation,
  sparkles: Sparkles,
  threejs: Box
};

/**
 * Exact artifactRowKind mapping from LibreChat
 * (client/src/utils/artifacts.ts & client/src/components/Chat/Messages/Content/Parts/ArtifactRow.tsx)
 */
export function getArtifactRowKind(type, language, title) {
  const normType = (type || 'text/html').toLowerCase().trim();

  if (normType === 'text/html') {
    return {
      lang: 'html',
      label: 'HTML',
      rendersPreview: true,
      fallbackGlyph: 'preview'
    };
  }
  if (normType === 'application/vnd.react' || normType === 'react') {
    return {
      lang: 'react',
      label: 'React',
      rendersPreview: true,
      fallbackGlyph: 'code'
    };
  }
  if (normType === 'image/svg+xml' || normType === 'svg') {
    return {
      lang: 'svg',
      label: 'SVG',
      rendersPreview: true,
      fallbackGlyph: 'sparkles'
    };
  }
  if (normType === 'application/vnd.mermaid' || normType === 'mermaid') {
    return {
      lang: 'mermaid',
      label: 'Diagram',
      rendersPreview: true,
      fallbackGlyph: 'diagram'
    };
  }
  if (normType === 'text/markdown' || normType === 'markdown') {
    return {
      lang: 'markdown',
      label: 'Document',
      rendersPreview: true,
      fallbackGlyph: 'text'
    };
  }
  if (normType === 'threejs' || normType === '3d') {
    return {
      lang: 'threejs',
      label: '3D Scene',
      rendersPreview: true,
      fallbackGlyph: 'threejs'
    };
  }

  return {
    lang: language || 'code',
    label: 'Code',
    rendersPreview: false,
    fallbackGlyph: 'code'
  };
}

/**
 * Exact LibreChat ArtifactRow Component
 * The single chat-side trigger for every artifact.
 */
export default function ArtifactRow({ artifact, onOpen, isSelected = false }) {
  if (!artifact) return null;

  const kind = getArtifactRowKind(artifact.type, artifact.language, artifact.title);
  const Fallback = FALLBACK_GLYPHS[kind.fallbackGlyph] || AppWindow;
  const title = artifact.title || artifact.identifier || 'Interactive Artifact';

  const handleDownload = (e) => {
    e.stopPropagation();
    const content = artifact.content || '';
    const normType = (artifact.type || 'text/html').toLowerCase().trim();
    let ext = '.txt';
    let mime = 'text/plain';

    if (normType === 'text/html') {
      ext = '.html';
      mime = 'text/html';
    } else if (normType.includes('react')) {
      ext = '.jsx';
      mime = 'text/javascript';
    } else if (normType.includes('svg')) {
      ext = '.svg';
      mime = 'image/svg+xml';
    } else if (normType.includes('mermaid')) {
      ext = '.mmd';
      mime = 'text/plain';
    } else if (normType.includes('markdown')) {
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

  return (
    <div
      className={`librechat-artifact-row ${isSelected ? 'is-selected' : ''}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        maxWidth: '100%',
        margin: '8px 0',
        padding: '3px 4px',
        borderRadius: '8px',
        boxSizing: 'border-box'
      }}
    >
      <button
        type="button"
        data-artifact-trigger={artifact.id}
        aria-expanded={isSelected}
        onClick={onOpen}
        title={`Click to open ${title} in Artifacts panel`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flex: 1,
          minWidth: 0,
          background: isSelected ? 'rgba(37, 99, 235, 0.08)' : 'var(--bg-surface-secondary, rgba(148, 163, 184, 0.08))',
          border: isSelected ? '1px solid #2563eb' : '1px solid var(--border-color, rgba(148, 163, 184, 0.25))',
          borderRadius: '8px',
          padding: '8px 12px',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'all 0.15s ease',
          outline: 'none',
          color: 'var(--text-primary, #0f172a)'
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: kind.rendersPreview ? '#0284c7' : 'var(--text-secondary, #64748b)',
            flexShrink: 0
          }}
          aria-hidden="true"
        >
          <Fallback size={16} />
        </span>

        <span
          style={{
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: '13.5px',
            fontWeight: 500,
            letterSpacing: '-0.01em'
          }}
          title={title}
        >
          {title}
        </span>

        <span
          style={{
            fontSize: '10px',
            fontWeight: 600,
            lineHeight: '18px',
            padding: '0 6px',
            borderRadius: '4px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            background: 'var(--bg-surface, rgba(255, 255, 255, 0.7))',
            color: 'var(--text-tertiary, #64748b)',
            border: '1px solid var(--border-light, rgba(148, 163, 184, 0.25))',
            flexShrink: 0
          }}
        >
          {kind.label}
        </span>
      </button>

      <button
        type="button"
        onClick={handleDownload}
        title={`Download ${title}`}
        aria-label={`Download ${title}`}
        style={{
          width: '28px',
          height: '28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '6px',
          border: 'none',
          background: 'transparent',
          color: 'var(--text-secondary, #64748b)',
          cursor: 'pointer',
          marginLeft: '4px',
          flexShrink: 0,
          transition: 'all 0.15s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = '#2563eb';
          e.currentTarget.style.background = 'rgba(37, 99, 235, 0.08)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--text-secondary, #64748b)';
          e.currentTarget.style.background = 'transparent';
        }}
      >
        <Download size={14} />
      </button>
    </div>
  );
}
