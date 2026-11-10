import React, { useMemo, useState, useEffect, useRef } from 'react';
import katex from 'katex';
import { marked } from 'marked';
import Prism from 'prismjs';
import mermaid from 'mermaid';
import * as THREE from 'three';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts';
import {
  Copy, Check, Eye, Compass, Atom, CheckCircle2, ChevronRight,
  GitBranch, GitPullRequest, ArrowDown, Code, CheckCircle, Loader2,
  GitFork, Box, BarChart2, Play, Pause, RotateCcw, Layers
} from 'lucide-react';

mermaid.initialize({
  startOnLoad: false,
  theme: 'neutral',
  securityLevel: 'loose',
  suppressErrorRendering: true
});

// Custom Octocat/GitHub SVG Icon
function GithubIcon({ size = 18, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

// -------------------------------------------------------------
// Interactive Choice / Decision Card (Just like the user's screenshot!)
// -------------------------------------------------------------
function ChoiceCard({ data, onSelectChoice }) {
  const [selectedIdx, setSelectedIdx] = useState(data.defaultIndex ?? 0);
  const [submitted, setSubmitted] = useState(false);

  const handleConfirm = () => {
    if (submitted) return;
    setSubmitted(true);
    const chosenText = data.options[selectedIdx];
    if (onSelectChoice && chosenText) {
      onSelectChoice(chosenText);
    }
  };

  return (
    <div className="chatgpt-choice-card">
      {data.title && <div className="chatgpt-choice-title">{data.title}</div>}
      <div className="chatgpt-choice-options">
        {data.options.map((opt, idx) => {
          const isSelected = selectedIdx === idx;
          return (
            <div
              key={idx}
              className={`chatgpt-choice-option ${isSelected ? 'selected' : ''}`}
              onClick={() => {
                if (!submitted) setSelectedIdx(idx);
              }}
            >
              <div className={`chatgpt-choice-radio ${isSelected ? 'checked' : ''}`}>
                {isSelected && <span className="chatgpt-choice-radio-inner" />}
              </div>
              <span className="chatgpt-choice-label">{opt}</span>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        className={`chatgpt-choice-btn ${submitted ? 'submitted' : ''}`}
        onClick={handleConfirm}
        disabled={submitted}
      >
        {submitted ? (
          <>
            <CheckCircle2 size={16} style={{ color: '#10b981' }} />
            <span>Confirmed: {data.options[selectedIdx]}</span>
          </>
        ) : (
          <span>{data.buttonText || 'Confirm Design'}</span>
        )}
      </button>
    </div>
  );
}

// -------------------------------------------------------------
// Maths Geometry & Chemistry Molecular Diagram Card
// -------------------------------------------------------------
function DiagramCard({ svgContent, language = 'svg' }) {
  const [viewCode, setViewCode] = useState(false);
  const [copied, setCopied] = useState(false);

  // Detect whether this is Maths Geometry or Chemistry Structure
  const isChemistry = useMemo(() => {
    const lower = (svgContent || '').toLowerCase();
    return (
      lower.includes('benzene') ||
      lower.includes('molecule') ||
      lower.includes('chemical') ||
      lower.includes('atom') ||
      lower.includes('bond') ||
      lower.includes('c6h6') ||
      lower.includes('h2o') ||
      language.toLowerCase() === 'chemistry'
    );
  }, [svgContent, language]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(svgContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {}
  };

  // Clean SVG markup for inline rendering
  const cleanSvg = useMemo(() => {
    if (!svgContent) return '';
    let code = svgContent.trim();
    if (!code.startsWith('<svg') && code.includes('<svg')) {
      code = code.slice(code.indexOf('<svg'));
    }
    if (code.includes('</svg>')) {
      code = code.slice(0, code.indexOf('</svg>') + 6);
    }
    return code;
  }, [svgContent]);

  return (
    <div className="chatgpt-diagram-card">
      <div className="chatgpt-diagram-header">
        <div className="chatgpt-diagram-tag">
          {isChemistry ? (
            <>
              <Atom size={15} style={{ color: '#059669' }} />
              <span style={{ color: '#059669' }}>Chemical Structure (रासायनिक संरचना)</span>
            </>
          ) : (
            <>
              <Compass size={15} style={{ color: '#2563eb' }} />
              <span style={{ color: '#2563eb' }}>Geometric Diagram (ज्यामिति आकृति)</span>
            </>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            className="chatgpt-code-copy-btn"
            onClick={() => setViewCode((v) => !v)}
            title={viewCode ? 'View Diagram' : 'View SVG Code'}
          >
            <Eye size={13} />
            <span>{viewCode ? 'Diagram' : 'Code'}</span>
          </button>
          <button
            type="button"
            className="chatgpt-code-copy-btn"
            onClick={handleCopy}
            title={copied ? 'Copied' : 'Copy SVG'}
          >
            {copied ? (
              <>
                <Check size={13} style={{ color: '#10b981' }} />
                <span style={{ color: '#10b981' }}>Copied</span>
              </>
            ) : (
              <>
                <Copy size={13} />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {viewCode ? (
        <pre className="chatgpt-code-pre">
          <code>{cleanSvg}</code>
        </pre>
      ) : (
        <div
          className="chatgpt-diagram-viewport"
          dangerouslySetInnerHTML={{ __html: cleanSvg }}
        />
      )}
    </div>
  );
}

// -------------------------------------------------------------
// Flowchart Card Component (Powered by Mermaid.js)
// -------------------------------------------------------------
function MermaidCard({ code }) {
  const [svgHtml, setSvgHtml] = useState('');
  const [err, setErr] = useState('');
  const [viewCode, setViewCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef(null);
  const renderId = useRef(`mermaid_${Math.random().toString(36).substring(2, 9)}`);

  useEffect(() => {
    let active = true;
    async function renderChart() {
      if (!code || !code.trim()) return;
      try {
        const cleanCode = code.trim();
        const { svg } = await mermaid.render(renderId.current, cleanCode);
        if (active) {
          setSvgHtml(svg);
          setErr('');
        }
      } catch (e) {
        if (active) {
          setErr(e?.message || 'Flowchart parsing error');
        }
      }
    }
    renderChart();
    return () => {
      active = false;
    };
  }, [code]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {}
  };

  return (
    <div className="chatgpt-diagram-card mermaid-card">
      <div className="chatgpt-diagram-header">
        <div className="chatgpt-diagram-tag">
          <GitFork size={15} style={{ color: '#0284c7' }} />
          <span style={{ color: '#0284c7' }}>Flowchart & Process Diagram (फ़्लोचार्ट)</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            className="chatgpt-code-copy-btn"
            onClick={() => setViewCode((v) => !v)}
            title={viewCode ? 'View Diagram' : 'View Code'}
          >
            <Eye size={13} />
            <span>{viewCode ? 'Diagram' : 'Code'}</span>
          </button>
          <button
            type="button"
            className="chatgpt-code-copy-btn"
            onClick={handleCopy}
            title={copied ? 'Copied' : 'Copy'}
          >
            {copied ? (
              <>
                <Check size={13} style={{ color: '#10b981' }} />
                <span style={{ color: '#10b981' }}>Copied</span>
              </>
            ) : (
              <>
                <Copy size={13} />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {viewCode ? (
        <pre className="chatgpt-code-pre">
          <code>{code}</code>
        </pre>
      ) : err ? (
        <div style={{ padding: '16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', color: '#b91c1c', fontSize: '12px' }}>
          <strong>Flowchart Notice:</strong> {err}
          <pre style={{ margin: '8px 0 0', background: 'transparent', color: 'inherit' }}>{code}</pre>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="chatgpt-diagram-viewport mermaid-viewport"
          dangerouslySetInnerHTML={{ __html: svgHtml }}
        />
      )}
    </div>
  );
}

// -------------------------------------------------------------
// Interactive 3D Shape Card (Powered by Three.js - 360° Rotate)
// -------------------------------------------------------------
function ThreeDCard({ spec }) {
  const mountRef = useRef(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [wireframe, setWireframe] = useState(false);
  const [viewCode, setViewCode] = useState(false);
  const [copied, setCopied] = useState(false);

  const parsed = useMemo(() => {
    let shape = 'cylinder';
    let color = '#2563eb';
    let title = '3D Geometric Shape (360° घुमाएं)';
    const lines = (spec || '').split('\n');
    lines.forEach((l) => {
      const trimmed = l.trim();
      const lower = trimmed.toLowerCase();
      if (lower.startsWith('shape:')) shape = lower.slice(6).trim();
      else if (lower.startsWith('color:')) color = trimmed.split(':')[1]?.trim() || color;
      else if (lower.startsWith('title:')) title = trimmed.split(':')[1]?.trim() || title;
    });
    return { shape, color, title };
  }, [spec]);

  const autoRotateRef = useRef(autoRotate);
  autoRotateRef.current = autoRotate;

  const wireframeRef = useRef(wireframe);
  wireframeRef.current = wireframe;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Dimensions
    const width = container.clientWidth || 340;
    const height = 260;

    // Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xfcfcfc);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 2.2, 5.5);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.4);
    dirLight1.position.set(5, 10, 7);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x93c5fd, 0.6);
    dirLight2.position.set(-5, -5, -5);
    scene.add(dirLight2);

    // Root mesh group
    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    // Construct procedural geometry based on parsed shape
    let geom;
    const shapeType = parsed.shape.toLowerCase();
    const matColor = new THREE.Color(parsed.color || '#2563eb');

    const material = new THREE.MeshStandardMaterial({
      color: matColor,
      roughness: 0.25,
      metalness: 0.2,
      wireframe: wireframeRef.current
    });

    if (shapeType.includes('cylinder') || shapeType.includes('बेलन')) {
      geom = new THREE.CylinderGeometry(1.2, 1.2, 2.8, 36);
    } else if (shapeType.includes('cone') || shapeType.includes('शंकु')) {
      geom = new THREE.ConeGeometry(1.5, 3.0, 36);
    } else if (shapeType.includes('sphere') || shapeType.includes('गोला')) {
      geom = new THREE.SphereGeometry(1.5, 36, 36);
    } else if (shapeType.includes('cube') || shapeType.includes('box') || shapeType.includes('घन')) {
      geom = new THREE.BoxGeometry(2.0, 2.0, 2.0);
    } else if (shapeType.includes('pyramid') || shapeType.includes('पिरामिड')) {
      geom = new THREE.ConeGeometry(1.8, 2.6, 4);
    } else if (shapeType.includes('torus') || shapeType.includes('डोनट')) {
      geom = new THREE.TorusGeometry(1.4, 0.45, 24, 100);
    } else if (shapeType.includes('benzene') || shapeType.includes('molecule')) {
      // 3D Ball-and-Stick Molecule Model for Benzene
      const cMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.3 });
      const hMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 });
      const bondMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.4 });

      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3;
        const nextAngle = ((i + 1) * Math.PI) / 3;
        const rC = 1.6;
        const rH = 2.4;

        // Carbon atom sphere
        const cSphere = new THREE.Mesh(new THREE.SphereGeometry(0.28, 24, 24), cMat);
        cSphere.position.set(rC * Math.cos(angle), rC * Math.sin(angle), 0);
        rootGroup.add(cSphere);

        // Hydrogen atom sphere
        const hSphere = new THREE.Mesh(new THREE.SphereGeometry(0.18, 20, 20), hMat);
        hSphere.position.set(rH * Math.cos(angle), rH * Math.sin(angle), 0);
        rootGroup.add(hSphere);

        // C-C bond cylinder
        const p1 = new THREE.Vector3(rC * Math.cos(angle), rC * Math.sin(angle), 0);
        const p2 = new THREE.Vector3(rC * Math.cos(nextAngle), rC * Math.sin(nextAngle), 0);
        const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
        const bondDist = p1.distanceTo(p2);
        const bondCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, bondDist, 16), bondMat);
        bondCyl.position.copy(mid);
        bondCyl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3().subVectors(p2, p1).normalize());
        rootGroup.add(bondCyl);

        // C-H bond cylinder
        const chMid = new THREE.Vector3().addVectors(p1, hSphere.position).multiplyScalar(0.5);
        const chDist = p1.distanceTo(hSphere.position);
        const chCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, chDist, 16), bondMat);
        chCyl.position.copy(chMid);
        chCyl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3().subVectors(hSphere.position, p1).normalize());
        rootGroup.add(chCyl);
      }
    } else {
      geom = new THREE.CylinderGeometry(1.2, 1.2, 2.8, 36);
    }

    if (geom) {
      const mesh = new THREE.Mesh(geom, material);
      rootGroup.add(mesh);

      // Subtle edge line helper for clean look
      if (!shapeType.includes('sphere')) {
        const edges = new THREE.EdgesGeometry(geom, 25);
        const edgeLine = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x1e3a8a, linewidth: 1.5 }));
        rootGroup.add(edgeLine);
      }
    }

    // Interactive Dragging / Rotation handlers
    let isDragging = false;
    let prevX = 0;
    let prevY = 0;

    const onDown = (e) => {
      isDragging = true;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      prevX = clientX;
      prevY = clientY;
    };

    const onMove = (e) => {
      if (!isDragging) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const dx = clientX - prevX;
      const dy = clientY - prevY;

      rootGroup.rotation.y += dx * 0.012;
      rootGroup.rotation.x += dy * 0.012;

      prevX = clientX;
      prevY = clientY;
    };

    const onUp = () => {
      isDragging = false;
    };

    const domEl = renderer.domElement;
    domEl.addEventListener('mousedown', onDown);
    domEl.addEventListener('touchstart', onDown, { passive: true });
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);

    // Animation Loop
    let animId;
    const animate = () => {
      animId = requestAnimationFrame(animate);

      if (autoRotateRef.current && !isDragging) {
        rootGroup.rotation.y += 0.01;
        rootGroup.rotation.x += 0.003;
      }

      material.wireframe = wireframeRef.current;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      domEl.removeEventListener('mousedown', onDown);
      domEl.removeEventListener('touchstart', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchend', onUp);
      renderer.dispose();
      if (geom) geom.dispose();
      material.dispose();
      container.innerHTML = '';
    };
  }, [parsed]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(spec);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {}
  };

  return (
    <div className="chatgpt-diagram-card three-d-card">
      <div className="chatgpt-diagram-header">
        <div className="chatgpt-diagram-tag">
          <Box size={16} style={{ color: '#7c3aed' }} />
          <span style={{ color: '#7c3aed' }}>{parsed.title}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            className="chatgpt-code-copy-btn"
            onClick={() => setAutoRotate((v) => !v)}
            title={autoRotate ? 'Pause Rotation' : 'Auto Rotate'}
            style={{ color: autoRotate ? '#16a34a' : 'inherit' }}
          >
            {autoRotate ? <Pause size={13} /> : <Play size={13} />}
            <span>{autoRotate ? 'Pause' : 'Rotate'}</span>
          </button>

          <button
            type="button"
            className="chatgpt-code-copy-btn"
            onClick={() => setWireframe((v) => !v)}
            title="Toggle Wireframe"
            style={{ color: wireframe ? '#7c3aed' : 'inherit' }}
          >
            <Layers size={13} />
            <span>{wireframe ? 'Solid' : 'Wire'}</span>
          </button>

          <button
            type="button"
            className="chatgpt-code-copy-btn"
            onClick={() => setViewCode((v) => !v)}
            title={viewCode ? 'View 3D Viewport' : 'View Code'}
          >
            <Eye size={13} />
            <span>{viewCode ? '3D' : 'Code'}</span>
          </button>

          <button
            type="button"
            className="chatgpt-code-copy-btn"
            onClick={handleCopy}
            title={copied ? 'Copied' : 'Copy'}
          >
            {copied ? (
              <>
                <Check size={13} style={{ color: '#10b981' }} />
                <span style={{ color: '#10b981' }}>Copied</span>
              </>
            ) : (
              <>
                <Copy size={13} />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {viewCode ? (
        <pre className="chatgpt-code-pre">
          <code>{spec}</code>
        </pre>
      ) : (
        <div style={{ position: 'relative', width: '100%' }}>
          <div
            ref={mountRef}
            className="chatgpt-diagram-viewport three-viewport"
            style={{ height: '260px', padding: 0, cursor: 'grab' }}
          />
          <div style={{ position: 'absolute', bottom: 8, right: 12, fontSize: '11px', color: '#94a3b8', pointerEvents: 'none', background: 'rgba(255,255,255,0.7)', padding: '2px 8px', borderRadius: '6px' }}>
            🖱️ 360° Drag to rotate
          </div>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// Interactive Data Chart Card (Powered by Recharts)
// -------------------------------------------------------------
function DataChartCard({ spec }) {
  const [copied, setCopied] = useState(false);
  const [viewCode, setViewCode] = useState(false);

  const parsed = useMemo(() => {
    let type = 'bar';
    let title = 'Data Chart';
    let data = [];

    try {
      if (spec.trim().startsWith('{') || spec.trim().startsWith('[')) {
        const obj = JSON.parse(spec);
        if (Array.isArray(obj)) {
          data = obj;
        } else {
          type = obj.type || type;
          title = obj.title || title;
          data = obj.data || [];
        }
      } else {
        const lines = spec.split('\n');
        lines.forEach((l) => {
          const lower = l.trim().toLowerCase();
          if (lower.startsWith('type:')) type = lower.slice(5).trim();
          else if (lower.startsWith('title:')) title = l.trim().slice(6).trim();
          else if (l.includes(':') && (l.includes('-') || l.includes(','))) {
            const parts = l.replace(/^[-*]\s*/, '').split(/[:,]/);
            if (parts.length >= 2) {
              const name = parts[0].trim();
              const val = parseFloat(parts[1].trim());
              if (name && !isNaN(val)) data.push({ name, value: val });
            }
          }
        });
      }
    } catch (e) {}

    if (data.length === 0) {
      data = [
        { name: 'A', value: 45 },
        { name: 'B', value: 80 },
        { name: 'C', value: 65 },
        { name: 'D', value: 95 }
      ];
    }

    return { type: type.toLowerCase(), title, data };
  }, [spec]);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(spec);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {}
  };

  return (
    <div className="chatgpt-diagram-card chart-card">
      <div className="chatgpt-diagram-header">
        <div className="chatgpt-diagram-tag">
          <BarChart2 size={16} style={{ color: '#059669' }} />
          <span style={{ color: '#059669' }}>{parsed.title}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            className="chatgpt-code-copy-btn"
            onClick={() => setViewCode((v) => !v)}
            title={viewCode ? 'View Chart' : 'View Data'}
          >
            <Eye size={13} />
            <span>{viewCode ? 'Chart' : 'Data'}</span>
          </button>
          <button
            type="button"
            className="chatgpt-code-copy-btn"
            onClick={handleCopy}
            title={copied ? 'Copied' : 'Copy'}
          >
            {copied ? (
              <>
                <Check size={13} style={{ color: '#10b981' }} />
                <span style={{ color: '#10b981' }}>Copied</span>
              </>
            ) : (
              <>
                <Copy size={13} />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {viewCode ? (
        <pre className="chatgpt-code-pre">
          <code>{spec}</code>
        </pre>
      ) : (
        <div className="chatgpt-diagram-viewport chart-viewport" style={{ height: '260px', width: '100%', padding: '16px 8px 8px' }}>
          <ResponsiveContainer width="100%" height="100%">
            {parsed.type === 'line' ? (
              <LineChart data={parsed.data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }} />
                <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            ) : parsed.type === 'area' ? (
              <AreaChart data={parsed.data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }} />
                <Area type="monotone" dataKey="value" stroke="#10b981" fill="#d1fae5" />
              </AreaChart>
            ) : parsed.type === 'pie' ? (
              <PieChart>
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }} />
                <Pie data={parsed.data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {parsed.data.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            ) : (
              <BarChart data={parsed.data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }} />
                <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]}>
                  {parsed.data.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// Code Block Component with Syntax Highlighting & Live Preview
// -------------------------------------------------------------
function CodeBlock({ language, code }) {
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {}
  };

  const langLower = (language || '').toLowerCase().trim();

  // If code is Mermaid flowchart
  if (langLower === 'mermaid') {
    return <MermaidCard code={code} />;
  }

  // If code is 3D shape (Three.js)
  if (['3d', 'three', 'threejs'].includes(langLower)) {
    return <ThreeDCard spec={code} />;
  }

  // If code is Data Chart (Recharts)
  if (['chart', 'recharts', 'graph'].includes(langLower)) {
    return <DataChartCard spec={code} />;
  }

  // If code is an SVG diagram, render DiagramCard directly
  if (langLower === 'svg' || (code.trim().startsWith('<svg') && code.includes('</svg>'))) {
    return <DiagramCard svgContent={code} language={language} />;
  }

  const isPreviewable = ['html', 'markup', 'xml', 'jsx', 'js', 'javascript', 'css'].includes(langLower);

  const previewSrcDoc = useMemo(() => {
    if (!isPreviewable || !code) return '';
    if (langLower === 'html' || langLower === 'markup' || langLower === 'xml' || code.includes('<html') || code.includes('<!DOCTYPE')) {
      return code;
    }
    if (langLower === 'css') {
      return `<!DOCTYPE html><html><head><style>${code}</style></head><body><div style="padding:24px;font-family:sans-serif;"><h3>CSS Live Preview</h3><p>Style preview rendered live.</p><button style="padding:10px 16px;border-radius:8px;background:#16a34a;color:#fff;border:0;cursor:pointer;">Sample Button</button></div></body></html>`;
    }
    return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><style>body{font-family:system-ui,sans-serif;padding:24px;margin:0;background:#fff;color:#0f172a;}</style><script src="https://unpkg.com/react@18/umd/react.development.js"></script><script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script><script src="https://unpkg.com/@babel/standalone/babel.min.js"></script></head><body><div id="root"></div><script type="text/babel">try{ ${code.replace(/import\s+.*?from\s+['"].*?['"];?/g, '')} if (typeof App !== 'undefined') { ReactDOM.createRoot(document.getElementById('root')).render(<App />); } }catch(e){ document.getElementById('root').innerHTML = '<div style="color:red;padding:16px;">Preview Error: ' + e.message + '</div>'; }</script></body></html>`;
  }, [code, langLower, isPreviewable]);

  const highlightedHtml = useMemo(() => {
    if (!code) return '';
    let grammarLang = langLower;
    if (['html', 'xml', 'svg', 'vue'].includes(langLower)) grammarLang = 'markup';
    if (['js', 'jsx'].includes(langLower)) grammarLang = 'javascript';
    if (['ts', 'tsx'].includes(langLower)) grammarLang = 'typescript';
    if (['py'].includes(langLower)) grammarLang = 'python';

    const grammar = Prism.languages[grammarLang] || Prism.languages.markup || Prism.languages.clike;

    try {
      return Prism.highlight(code, grammar, grammarLang);
    } catch (e) {
      return code
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }
  }, [code, langLower]);

  const displayLang = (language || 'code').toUpperCase();

  return (
    <div className="chatgpt-code-card">
      <div className="chatgpt-code-header">
        <span className="chatgpt-code-lang">{displayLang}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {isPreviewable && (
            <button
              type="button"
              className="chatgpt-code-copy-btn"
              onClick={() => setShowPreview((v) => !v)}
              title={showPreview ? 'Show Code' : 'Live Preview'}
              style={{ color: showPreview ? '#16a34a' : 'inherit', fontWeight: 600 }}
            >
              <Eye size={14} />
              <span>{showPreview ? 'Code' : 'Preview'}</span>
            </button>
          )}
          <button
            type="button"
            className="chatgpt-code-copy-btn"
            onClick={handleCopy}
            title={copied ? 'Copied' : 'Copy code'}
          >
            {copied ? (
              <>
                <Check size={14} style={{ color: '#10b981' }} />
                <span style={{ color: '#10b981' }}>Copied</span>
              </>
            ) : (
              <>
                <Copy size={14} />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {showPreview ? (
        <div className="chatgpt-code-preview-frame">
          <iframe
            title="Code Live Preview"
            srcDoc={previewSrcDoc}
            sandbox="allow-scripts allow-modals"
            style={{ width: '100%', height: '260px', border: 0, background: '#ffffff', display: 'block' }}
          />
        </div>
      ) : (
        <pre className="chatgpt-code-pre">
          <code dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
        </pre>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// FormattedMessage Main Component
// -------------------------------------------------------------
export default function FormattedMessage({ text, onSelectChoice }) {
  const renderedContent = useMemo(() => {
    if (!text) return null;

    try {
      const choicePlaceholders = [];
      let processed = text;

      // 0a. Extract Interactive Choice / Poll Cards
      // Format 1: ```choice ... ``` or :::choice ... :::
      processed = processed.replace(/(?:```choice|:::choice)\n([\s\S]*?)(?:```|:::)/g, (match, block) => {
        const lines = block.split('\n');
        let title = '';
        const options = [];
        let buttonText = 'Confirm Design';
        let defaultIndex = 0;

        lines.forEach((line) => {
          const trimmed = line.trim();
          if (trimmed.toLowerCase().startsWith('title:')) {
            title = trimmed.slice(6).trim();
          } else if (trimmed.toLowerCase().startsWith('button:')) {
            buttonText = trimmed.slice(7).trim();
          } else if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
            let optText = trimmed.replace(/^[-*]\s*/, '').trim();
            if (optText.startsWith('[x]') || optText.startsWith('(selected)')) {
              defaultIndex = options.length;
              optText = optText.replace(/^(\[x\]|\(selected\))\s*/, '').trim();
            } else if (optText.startsWith('[ ]')) {
              optText = optText.replace(/^\[ \]\s*/, '').trim();
            }
            if (optText) options.push(optText);
          }
        });

        if (options.length > 0) {
          const key = `CHATGPTCHOICEPH${choicePlaceholders.length}XYZ`;
          choicePlaceholders.push({
            key,
            data: { title, options, buttonText, defaultIndex }
          });
          return key;
        }
        return match;
      });

      const mathPlaceholders = [];

      // 1. Extract Display/Block Math $$ ... $$ or \[ ... \]
      processed = processed.replace(/\$\$([\s\S]+?)\$\$/g, (match, mathStr) => {
        const trimmed = mathStr.trim();
        let html = '';
        try {
          html = katex.renderToString(trimmed, { displayMode: true, throwOnError: false });
        } catch (e) {
          html = `<span class="katex-error">${trimmed}</span>`;
        }
        const key = `KATEXBLOCKPH${mathPlaceholders.length}XYZ`;
        mathPlaceholders.push({ key, html });
        return key;
      });

      processed = processed.replace(/\\\[([\s\S]+?)\\\]/g, (match, mathStr) => {
        const trimmed = mathStr.trim();
        let html = '';
        try {
          html = katex.renderToString(trimmed, { displayMode: true, throwOnError: false });
        } catch (e) {
          html = `<span class="katex-error">${trimmed}</span>`;
        }
        const key = `KATEXBLOCKPH${mathPlaceholders.length}XYZ`;
        mathPlaceholders.push({ key, html });
        return key;
      });

      // 2. Extract Inline Math $ ... $ or \( ... \)
      processed = processed.replace(/(^|[^\\])\$([^\$\n]+?)\$/g, (match, prefix, mathStr) => {
        const trimmed = mathStr.trim();
        let html = '';
        try {
          html = katex.renderToString(trimmed, { displayMode: false, throwOnError: false });
        } catch (e) {
          html = `<span class="katex-error">${trimmed}</span>`;
        }
        const key = `KATEXINLINEPH${mathPlaceholders.length}XYZ`;
        mathPlaceholders.push({ key, html });
        return prefix + key;
      });

      processed = processed.replace(/\\\(([\s\S]+?)\\\)/g, (match, mathStr) => {
        const trimmed = mathStr.trim();
        let html = '';
        try {
          html = katex.renderToString(trimmed, { displayMode: false, throwOnError: false });
        } catch (e) {
          html = `<span class="katex-error">${trimmed}</span>`;
        }
        const key = `KATEXINLINEPH${mathPlaceholders.length}XYZ`;
        mathPlaceholders.push({ key, html });
        return key;
      });

      // 3. Extract Code Blocks (auto-close during streaming if unclosed)
      const tripleBacktickCount = (processed.match(/```/g) || []).length;
      if (tripleBacktickCount % 2 === 1) {
        processed += '\n```';
      }

      const codePlaceholders = [];
      processed = processed.replace(/```([a-zA-Z0-9_+#-]*)[^\S\r\n]*\r?\n([\s\S]*?)```/g, (match, lang, code) => {
        const key = `KATEXCODEPH${codePlaceholders.length}XYZ`;
        codePlaceholders.push({
          key,
          language: lang.trim() || 'code',
          code: code.replace(/\r?\n$/, '')
        });
        return key;
      });

      // 4. Render Markdown to HTML using marked
      marked.setOptions({ gfm: true, breaks: true });
      let rawHtml = marked.parse(processed);

      // Clean paragraph wrappers around widget placeholders
      rawHtml = rawHtml.replace(/<p>\s*(KATEXCODEPH\d+XYZ|CHATGPTCHOICEPH\d+XYZ)\s*<\/p>/g, '$1');

      // 5. Replace Math Placeholders back with KaTeX rendered HTML
      mathPlaceholders.forEach(({ key, html }) => {
        rawHtml = rawHtml.replace(key, `<span class="katex-rendered-wrapper">${html}</span>`);
      });

      // 6. Assemble Final React Components combining Markdown, Code/Diagrams & Choice Cards
      const allWidgets = [
        ...codePlaceholders.map((c) => ({
          key: c.key,
          render: () => <CodeBlock key={c.key} language={c.language} code={c.code} />
        })),
        ...choicePlaceholders.map((ch) => ({
          key: ch.key,
          render: () => <ChoiceCard key={ch.key} data={ch.data} onSelectChoice={onSelectChoice} />
        }))
      ];

      if (allWidgets.length === 0) {
        return (
          <div
            className="formatted-markdown-body"
            dangerouslySetInnerHTML={{ __html: rawHtml }}
          />
        );
      }

      const parts = [];
      let remaining = rawHtml;

      allWidgets.forEach(({ key, render }, idx) => {
        const splitIndex = remaining.indexOf(key);
        if (splitIndex !== -1) {
          const before = remaining.slice(0, splitIndex);
          if (before) {
            parts.push(
              <div
                key={`text_${idx}`}
                className="formatted-markdown-body"
                dangerouslySetInnerHTML={{ __html: before }}
              />
            );
          }
          parts.push(render());
          remaining = remaining.slice(splitIndex + key.length);
        }
      });

      if (remaining) {
        parts.push(
          <div
            key="text_last"
            className="formatted-markdown-body"
            dangerouslySetInnerHTML={{ __html: remaining }}
          />
        );
      }

      return <div className="formatted-message-container">{parts}</div>;
    } catch (err) {
      return <p style={{ whiteSpace: 'pre-line' }}>{text}</p>;
    }
  }, [text, onSelectChoice]);

  return renderedContent;
}
