import React, { useMemo, useState, useEffect, useRef } from 'react';
import katex from 'katex';
import { marked } from 'marked';
import Prism from 'prismjs';
import mermaid from 'mermaid';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts';
import {
  Copy, Check, Eye, Compass, Atom, CheckCircle2, ChevronRight,
  GitBranch, GitPullRequest, ArrowDown, Code, CheckCircle, Loader2,
  GitFork, Box, BarChart2, Play, Pause, RotateCcw, Layers
} from 'lucide-react';
import QuizCard from './QuizCard';
import DOMPurify from 'dompurify';

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    const href = (node.getAttribute('href') || '').trim().toLowerCase();
    if (href.startsWith('javascript:') || href.startsWith('vbscript:') || href.startsWith('data:text/html')) {
      node.removeAttribute('href');
    }
    if (node.getAttribute('target') === '_blank') {
      node.setAttribute('rel', 'noopener noreferrer');
    }
  }
});

mermaid.initialize({
  startOnLoad: false,
  theme: 'neutral',
  securityLevel: 'strict',
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

  // Clean & sanitize SVG markup for inline rendering
  const cleanSvg = useMemo(() => {
    if (!svgContent) return '';
    let code = svgContent.trim();
    if (!code.startsWith('<svg') && code.includes('<svg')) {
      code = code.slice(code.indexOf('<svg'));
    }
    if (code.includes('</svg>')) {
      code = code.slice(0, code.indexOf('</svg>') + 6);
    }
    return DOMPurify.sanitize(code, {
      USE_PROFILES: { svg: true, svgFilters: true },
      FORBID_TAGS: ['script', 'foreignObject'],
      FORBID_ATTR: ['onload', 'onerror', 'onclick', 'onmouseover']
    });
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
          const safeSvg = DOMPurify.sanitize(svg, {
            USE_PROFILES: { svg: true, svgFilters: true },
            FORBID_TAGS: ['script'],
            FORBID_ATTR: ['onload', 'onerror', 'onclick', 'onmouseover']
          });
          setSvgHtml(safeSvg);
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
    } else if (shapeType.includes('dna') || shapeType.includes('helix') || shapeType.includes('डीएनए')) {
      // 3D Double Helix DNA Model
      const mat1 = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.3 });
      const mat2 = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 });
      const rungMat = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.4 });

      const numPoints = 22;
      for (let i = 0; i < numPoints; i++) {
        const t = (i / numPoints) * Math.PI * 4 - Math.PI * 2;
        const y = (i - numPoints / 2) * 0.22;
        const radius = 1.1;

        const x1 = Math.cos(t) * radius;
        const z1 = Math.sin(t) * radius;
        const s1 = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), mat1);
        s1.position.set(x1, y, z1);
        rootGroup.add(s1);

        const x2 = Math.cos(t + Math.PI) * radius;
        const z2 = Math.sin(t + Math.PI) * radius;
        const s2 = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), mat2);
        s2.position.set(x2, y, z2);
        rootGroup.add(s2);

        if (i % 2 === 0) {
          const p1 = new THREE.Vector3(x1, y, z1);
          const p2 = new THREE.Vector3(x2, y, z2);
          const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
          const dist = p1.distanceTo(p2);
          const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, dist, 12), rungMat);
          rung.position.copy(mid);
          rung.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3().subVectors(p2, p1).normalize());
          rootGroup.add(rung);
        }
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

  return (
    <div className="chatgpt-diagram-card three-d-card">
      <div className="chatgpt-diagram-header" style={{ justifyContent: 'flex-end' }}>
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
        </div>
      </div>

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
    </div>
  );
}

// -------------------------------------------------------------
// Direct Three.js Code Execution Card (Runs AI's Three.js JS directly)
// -------------------------------------------------------------
function ThreeJSRunnerCard({ code, isStreaming = false }) {
  const mountRef = useRef(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [wireframe, setWireframe] = useState(false);
  const [renderError, setRenderError] = useState('');
  const [isReady, setIsReady] = useState(false);

  const autoRotateRef = useRef(autoRotate);
  autoRotateRef.current = autoRotate;

  const wireframeRef = useRef(wireframe);
  wireframeRef.current = wireframe;

  const runtimeRef = useRef({
    renderer: null,
    scene: null,
    camera: null,
    controls: null,
    resumeCallbacks: null
  });

  // Toggle wireframe across all scene meshes dynamically
  useEffect(() => {
    const { scene, renderer, camera } = runtimeRef.current;
    if (!scene) return;
    scene.traverse((obj) => {
      if (obj.isMesh && obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => {
            if ('wireframe' in m) m.wireframe = wireframe;
          });
        } else if ('wireframe' in obj.material) {
          obj.material.wireframe = wireframe;
        }
      }
    });
    if (renderer && camera) {
      try {
        renderer.render(scene, camera);
      } catch (e) {}
    }
  }, [wireframe]);

  // Toggle pause / auto-rotate dynamically
  useEffect(() => {
    const { controls, resumeCallbacks } = runtimeRef.current;
    if (controls) {
      controls.autoRotate = autoRotate;
    }
    if (autoRotate && typeof resumeCallbacks === 'function') {
      resumeCallbacks();
    }
  }, [autoRotate]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container || !code || isStreaming) {
      setIsReady(false);
      return;
    }

    let unmounted = false;
    const rafIds = new Set();
    let pausedFrameCbs = [];

    const timer = setTimeout(() => {
      if (unmounted) return;

      let capturedRenderer = null;
      let capturedScene = null;
      let capturedCamera = null;
      let capturedControls = null;
      let autoAddedControls = false;

      const width = container.clientWidth || 340;
      const height = 280;

      try {
        // Strip ES import/export syntax if AI included any
        let cleanCode = code
          .replace(/^\s*import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
          .replace(/^\s*import\s+['"][^'"]+['"];?\s*$/gm, '')
          .replace(/\bexport\s+default\s+/g, '')
          .replace(/\bexport\s+(?=(?:const|let|var|function|class)\b)/g, '')
          .trim();

        // Check syntax first before initializing WebGL
        const hasSceneDecl = /\b(?:const|let|var)\s+scene\b/.test(cleanCode);
        const hasCameraDecl = /\b(?:const|let|var)\s+camera\b/.test(cleanCode);
        const hasRendererDecl = /\b(?:const|let|var)\s+renderer\b/.test(cleanCode);
        const hasRenderCall = /\.render\s*\(/.test(cleanCode);

        let prefix = '';
        if (!hasSceneDecl) {
          prefix += `const scene = new THREE.Scene(); scene.background = new THREE.Color(0xf8fafc); scene.add(new THREE.AmbientLight(0xffffff, 0.8)); const _dl = new THREE.DirectionalLight(0xffffff, 1.2); _dl.position.set(5, 10, 7); scene.add(_dl);\n`;
        }
        if (!hasCameraDecl) {
          prefix += `const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 1000); camera.position.set(0, 2, 7);\n`;
        }
        if (!hasRendererDecl) {
          prefix += `const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setSize(innerWidth, innerHeight); container.appendChild(renderer.domElement);\n`;
        }

        let suffix = '';
        if (!hasRenderCall) {
          suffix += `\nfunction _autoAnimate() { requestAnimationFrame(_autoAnimate); renderer.render(scene, camera); } _autoAnimate();`;
        }

        const fullScript = `${prefix}${cleanCode}${suffix}`;

        class WrappedWebGLRenderer extends THREE.WebGLRenderer {
          constructor(options = {}) {
            super({ antialias: true, alpha: true, ...options });
            capturedRenderer = this;
            const origRender = this.render.bind(this);
            this.render = (s, c) => {
              if (s) {
                capturedScene = s;
                runtimeRef.current.scene = s;
              }
              if (c) {
                capturedCamera = c;
                runtimeRef.current.camera = c;
              }
              if (wireframeRef.current && s) {
                s.traverse((obj) => {
                  if (obj.isMesh && obj.material) {
                    if (Array.isArray(obj.material)) {
                      obj.material.forEach((m) => { if ('wireframe' in m) m.wireframe = true; });
                    } else if ('wireframe' in obj.material) {
                      obj.material.wireframe = true;
                    }
                  }
                });
              }
              return origRender(s, c);
            };
          }
        }

        class WrappedOrbitControls extends OrbitControls {
          constructor(cam, dom) {
            super(cam, dom);
            capturedControls = this;
            runtimeRef.current.controls = this;
          }
        }

        const THREE_ENV = {
          ...THREE,
          WebGLRenderer: WrappedWebGLRenderer,
          OrbitControls: WrappedOrbitControls,
          SphereBufferGeometry: THREE.SphereGeometry,
          BoxBufferGeometry: THREE.BoxGeometry,
          CylinderBufferGeometry: THREE.CylinderGeometry,
          ConeBufferGeometry: THREE.ConeGeometry,
          TorusBufferGeometry: THREE.TorusGeometry,
          PlaneBufferGeometry: THREE.PlaneGeometry
        };

        const sandboxDocument = {
          createElement: (tag) => document.createElement(tag),
          createElementNS: (ns, tag) => document.createElementNS(ns, tag),
          body: {
            appendChild: (el) => {
              container.innerHTML = '';
              container.appendChild(el);
              return el;
            },
            removeChild: (el) => {
              if (el && el.parentNode === container) container.removeChild(el);
            },
            style: {}
          },
          getElementById: () => container,
          querySelector: () => container,
          addEventListener: (...args) => container.addEventListener(...args),
          removeEventListener: (...args) => container.removeEventListener(...args)
        };

        const resizeHandlers = [];
        const sandboxWindow = {
          innerWidth: width,
          innerHeight: height,
          devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
          addEventListener: (ev, cb) => {
            if (ev === 'resize' && typeof cb === 'function') resizeHandlers.push(cb);
          },
          removeEventListener: () => {}
        };

        const sandboxRAF = (cb) => {
          const id = window.requestAnimationFrame((ts) => {
            rafIds.delete(id);
            if (unmounted) return;
            if (!autoRotateRef.current) {
              pausedFrameCbs.push(cb);
              return;
            }
            if (autoAddedControls && capturedControls) {
              capturedControls.update();
            }
            try {
              cb(ts);
            } catch (e) {}
          });
          rafIds.add(id);
          return id;
        };

        const sandboxCancelRAF = (id) => {
          rafIds.delete(id);
          window.cancelAnimationFrame(id);
        };

        runtimeRef.current.resumeCallbacks = () => {
          const pending = [...pausedFrameCbs];
          pausedFrameCbs = [];
          pending.forEach((cb) => sandboxRAF(cb));
        };

        const dangerousPattern = /\b(localStorage|sessionStorage|document\.cookie|cookie|indexedDB|XMLHttpRequest|WebSocket|sendBeacon|eval|Function|importScripts|constructor|__proto__|prototype|navigator|location|parent|top|opener|frames)\b|window\s*\[|document\s*\[|\bimport\s*\(/;
        if (dangerousPattern.test(fullScript)) {
          throw new Error('Blocked unsafe API access inside 3D script');
        }

        const frozenWindow = Object.freeze(Object.assign(Object.create(null), sandboxWindow));
        const frozenDocument = Object.freeze(Object.assign(Object.create(null), sandboxDocument));

        const compiledFn = new Function(
          'THREE',
          'OrbitControls',
          'container',
          'width',
          'height',
          'innerWidth',
          'innerHeight',
          'window',
          'document',
          'requestAnimationFrame',
          'cancelAnimationFrame',
          'localStorage',
          'sessionStorage',
          'fetch',
          'XMLHttpRequest',
          'WebSocket',
          'globalThis',
          'self',
          'top',
          'parent',
          'opener',
          'frames',
          'navigator',
          'location',
          'eval',
          'Function',
          fullScript
        );

        container.innerHTML = '';
        compiledFn(
          THREE_ENV,
          WrappedOrbitControls,
          container,
          width,
          height,
          width,
          height,
          frozenWindow,
          frozenDocument,
          sandboxRAF,
          sandboxCancelRAF,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined
        );

        if (capturedRenderer) {
          runtimeRef.current.renderer = capturedRenderer;
          if (!container.contains(capturedRenderer.domElement)) {
            container.innerHTML = '';
            container.appendChild(capturedRenderer.domElement);
          }
          capturedRenderer.setSize(width, height);
          capturedRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
          capturedRenderer.domElement.style.display = 'block';
          capturedRenderer.domElement.style.width = '100%';
          capturedRenderer.domElement.style.height = '100%';

          if (capturedCamera && !capturedControls) {
            capturedControls = new WrappedOrbitControls(capturedCamera, capturedRenderer.domElement);
            capturedControls.enableDamping = true;
            capturedControls.autoRotate = autoRotateRef.current;
            capturedControls.autoRotateSpeed = 2.0;
            autoAddedControls = true;
          } else if (capturedControls) {
            capturedControls.autoRotate = autoRotateRef.current;
          }
        }

        const resizeObserver = new ResizeObserver((entries) => {
          if (unmounted || !capturedRenderer || !capturedCamera) return;
          for (const entry of entries) {
            const w = Math.max(200, Math.floor(entry.contentRect.width));
            const h = height;
            sandboxWindow.innerWidth = w;
            sandboxWindow.innerHeight = h;
            if ('aspect' in capturedCamera) {
              capturedCamera.aspect = w / h;
              capturedCamera.updateProjectionMatrix();
            }
            capturedRenderer.setSize(w, h);
          }
        });
        resizeObserver.observe(container);
        runtimeRef.current._resizeObserver = resizeObserver;

        setRenderError('');
        setIsReady(true);
      } catch (err) {
        setRenderError(err?.message || '3D Scene execution error');
        setIsReady(false);
      }
    }, 150);

    return () => {
      clearTimeout(timer);
      unmounted = true;
      rafIds.forEach((id) => window.cancelAnimationFrame(id));
      rafIds.clear();
      if (runtimeRef.current._resizeObserver) {
        runtimeRef.current._resizeObserver.disconnect();
      }
      if (runtimeRef.current.controls && typeof runtimeRef.current.controls.dispose === 'function') {
        runtimeRef.current.controls.dispose();
      }
      if (runtimeRef.current.scene) {
        runtimeRef.current.scene.traverse((obj) => {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
            if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
            else obj.material.dispose();
          }
        });
      }
      if (runtimeRef.current.renderer) {
        runtimeRef.current.renderer.dispose();
      }
      runtimeRef.current = { renderer: null, scene: null, camera: null, controls: null, resumeCallbacks: null };
      if (container) container.innerHTML = '';
    };
  }, [code, isStreaming]);

  return (
    <div className="chatgpt-diagram-card three-d-card">
      <div className="chatgpt-diagram-header" style={{ justifyContent: 'flex-end' }}>
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
        </div>
      </div>

      <div style={{ position: 'relative', width: '100%', height: '280px', background: '#f8fafc' }}>
        <div
          ref={mountRef}
          className="chatgpt-diagram-viewport three-viewport"
          style={{ width: '100%', height: '280px', padding: 0, cursor: 'grab' }}
        />

        {(isStreaming || (!isReady && !renderError)) && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              background: '#f8fafc',
              color: '#475569',
              fontSize: '13px'
            }}
          >
            <Loader2 size={22} className="animate-spin" style={{ color: '#2563eb' }} />
            <span>3D Model तैयार हो रहा है...</span>
          </div>
        )}

        {renderError && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
              background: '#fef2f2',
              color: '#b91c1c',
              fontSize: '12px',
              textAlign: 'center'
            }}
          >
            3D Render Notice: {renderError}
          </div>
        )}

        {isReady && !renderError && (
          <div style={{ position: 'absolute', bottom: 8, right: 12, fontSize: '11px', color: '#64748b', pointerEvents: 'none', background: 'rgba(255,255,255,0.78)', padding: '2px 8px', borderRadius: '6px' }}>
            🖱️ 360° Drag to rotate
          </div>
        )}
      </div>
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
function CodeBlock({ language, code, isStreaming = false }) {
  const [copied, setCopied] = useState(false);

  const langLower = (language || '').toLowerCase().trim();
  const isHtmlDoc = (code || '').includes('<!DOCTYPE') || (code || '').includes('<html');
  const isDirectThreeJS =
    !isHtmlDoc &&
    (['three', 'threejs', 'webgl'].includes(langLower) ||
      (code || '').includes('THREE.') ||
      (code || '').includes("from 'three'") ||
      (code || '').includes('from "three"') ||
      (code || '').includes('WebGLRenderer') ||
      (code || '').includes('PerspectiveCamera'));

  const isThreeHtml = isHtmlDoc && ((code || '').includes('three.js') || (code || '').includes('THREE.'));
  const isReactOrWeb =
    ['html', 'markup', 'xml', 'css', 'jsx', 'tsx'].includes(langLower) ||
    isHtmlDoc ||
    ((['js', 'javascript'].includes(langLower)) && ((code || '').includes('ReactDOM') || (code || '').includes('export default function App')));
  const isPreviewable = isThreeHtml || isReactOrWeb;

  const [showPreview, setShowPreview] = useState(isThreeHtml || isPreviewable);

  // Automatically switch to live preview mode when 3D/HTML code streams in
  useEffect(() => {
    if (isThreeHtml || (isPreviewable && (code || '').length > 30)) {
      setShowPreview(true);
    }
  }, [isThreeHtml, isPreviewable, code]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {}
  };

  const previewSrcDoc = useMemo(() => {
    if (!isPreviewable || !code) return '';
    const previewCsp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' https://unpkg.com; style-src 'unsafe-inline'; img-src data: blob: https:; font-src data: https:;">`;
    if (langLower === 'html' || langLower === 'markup' || langLower === 'xml' || code.includes('<html') || code.includes('<!DOCTYPE')) {
      return code.includes('<head>')
        ? code.replace('<head>', `<head>${previewCsp}`)
        : `${previewCsp}${code}`;
    }
    if (langLower === 'css') {
      return `<!DOCTYPE html><html><head>${previewCsp}<style>${code.replace(/<\/style>/gi, '')}</style></head><body><div style="padding:24px;font-family:sans-serif;"><h3>CSS Live Preview</h3><p>Style preview rendered live.</p><button style="padding:10px 16px;border-radius:8px;background:#16a34a;color:#fff;border:0;cursor:pointer;">Sample Button</button></div></body></html>`;
    }
    return `<!DOCTYPE html><html><head><meta charset="utf-8"/>${previewCsp}<meta name="viewport" content="width=device-width, initial-scale=1"/><style>body{font-family:system-ui,sans-serif;padding:24px;margin:0;background:#fff;color:#0f172a;}</style><script src="https://unpkg.com/react@18/umd/react.development.js"></script><script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script><script src="https://unpkg.com/@babel/standalone/babel.min.js"></script></head><body><div id="root"></div><script type="text/babel">try{ ${code.replace(/import\s+.*?from\s+['"].*?['"];?/g, '')} if (typeof App !== 'undefined') { ReactDOM.createRoot(document.getElementById('root')).render(<App />); } }catch(e){ document.getElementById('root').textContent = 'Preview Error: ' + (e && e.message ? e.message : 'Unknown error'); }</script></body></html>`;
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

  // If code is Mermaid flowchart
  if (langLower === 'mermaid') {
    return <MermaidCard code={code} />;
  }

  // If code is direct Three.js JavaScript code, execute natively inside interactive 3D runner
  if (isDirectThreeJS) {
    return <ThreeJSRunnerCard code={code} isStreaming={isStreaming} />;
  }

  // If code is declarative 3D shape spec (```3d shape: cylinder)
  const is3DSpec =
    ['3d', '3dcard'].includes(langLower) ||
    (code.includes('shape:') &&
      (code.includes('cylinder') ||
        code.includes('cube') ||
        code.includes('sphere') ||
        code.includes('cone') ||
        code.includes('pyramid') ||
        code.includes('benzene') ||
        code.includes('dna') ||
        code.includes('helix')));

  if (is3DSpec && !isHtmlDoc) {
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
            sandbox="allow-scripts"
            referrerPolicy="no-referrer"
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
      let processed = text;

      // Cleanly strip any legacy media tokens (:::videos, :::images)
      processed = processed.replace(/:::videos\s*([\s\S]*?):::/gi, '');
      processed = processed.replace(/:::images\s*([\s\S]*?):::/gi, '');

      const choicePlaceholders = [];
      const quizPlaceholders = [];

      // 0a. Extract Interactive Quiz / Flash Cards (```quiz ... ``` or ```flashcard ... ```)
      processed = processed.replace(/(?:```quiz|:::quiz|```flashcard|:::flashcard)\n([\s\S]*?)(?:```|:::)/g, (match, block) => {
        const lines = block.split('\n');
        let title = '';
        let subtitle = '';
        const questions = [];
        let currentQ = null;

        lines.forEach((line) => {
          const trimmed = line.trim();
          if (!trimmed) return;

          if (trimmed.toLowerCase().startsWith('title:')) {
            title = trimmed.slice(6).trim();
          } else if (trimmed.toLowerCase().startsWith('subtitle:')) {
            subtitle = trimmed.slice(9).trim();
          } else if (trimmed.match(/^(?:Q\d*:?|प्रश्न\s*\d*:?|\d+[\.\)])/i) || trimmed.toLowerCase().startsWith('question:')) {
            if (currentQ && currentQ.question && currentQ.options.length > 0) {
              questions.push(currentQ);
            }
            const qText = trimmed.replace(/^(?:Q\d*:?|प्रश्न\s*\d*:?|\d+[\.\)])\s*/i, '').replace(/^question:\s*/i, '').trim();
            currentQ = {
              question: qText,
              category: '',
              options: [],
              correctIndex: 0,
              explanation: ''
            };
          } else if (currentQ && trimmed.toLowerCase().startsWith('category:')) {
            currentQ.category = trimmed.slice(9).trim();
          } else if (currentQ && (trimmed.match(/^[A-E][\.\)]/i) || trimmed.startsWith('-') || trimmed.startsWith('*'))) {
            let optText = trimmed.replace(/^[A-E][\.\)]\s*/i, '').replace(/^[-*]\s*/, '').trim();
            let isCorrect = false;
            if (optText.includes('[correct]') || optText.includes('(correct)') || optText.includes('[x]')) {
              isCorrect = true;
              optText = optText.replace(/\[correct\]|\(correct\)|\[x\]/gi, '').trim();
            }
            if (isCorrect) {
              currentQ.correctIndex = currentQ.options.length;
            }
            if (optText) {
              currentQ.options.push(optText);
            }
          } else if (currentQ && (trimmed.toLowerCase().startsWith('correct:') || trimmed.toLowerCase().startsWith('answer:'))) {
            const ansVal = trimmed.split(':')[1]?.trim()?.toUpperCase() || '';
            const idx = ['A', 'B', 'C', 'D', 'E'].indexOf(ansVal);
            if (idx !== -1) {
              currentQ.correctIndex = idx;
            }
          } else if (currentQ && (trimmed.toLowerCase().startsWith('explanation:') || trimmed.toLowerCase().startsWith('vyakhya:') || trimmed.toLowerCase().startsWith('विवरण:'))) {
            const expText = trimmed.replace(/^(?:explanation|vyakhya|विवरण):\s*/i, '').trim();
            currentQ.explanation = expText;
          } else if (currentQ && currentQ.explanation) {
            currentQ.explanation += ' ' + trimmed;
          }
        });

        if (currentQ && currentQ.question && currentQ.options.length > 0) {
          questions.push(currentQ);
        }

        if (questions.length > 0) {
          const key = `CHATGPTQUIZPH${quizPlaceholders.length}XYZ`;
          quizPlaceholders.push({
            key,
            quizData: { title, subtitle, questions }
          });
          return key;
        }
        return match;
      });

      // 0b. Extract Interactive Choice / Poll Cards
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
      const wasUnclosedCodeBlock = tripleBacktickCount % 2 === 1;
      if (wasUnclosedCodeBlock) {
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
      rawHtml = rawHtml.replace(/<p>\s*(KATEXCODEPH\d+XYZ|CHATGPTCHOICEPH\d+XYZ|CHATGPTQUIZPH\d+XYZ)\s*<\/p>/g, '$1');

      // 5. Replace Math Placeholders back with KaTeX rendered HTML
      mathPlaceholders.forEach(({ key, html }) => {
        rawHtml = rawHtml.replace(key, `<span class="katex-rendered-wrapper">${html}</span>`);
      });

      // 6. Assemble Final React Components combining Markdown, Code/Diagrams, Choice & Quiz Cards
      const allWidgets = [
        ...codePlaceholders.map((c, idx) => ({
          key: c.key,
          render: () => (
            <CodeBlock
              key={c.key}
              language={c.language}
              code={c.code}
              isStreaming={wasUnclosedCodeBlock && idx === codePlaceholders.length - 1}
            />
          )
        })),
        ...choicePlaceholders.map((ch) => ({
          key: ch.key,
          render: () => <ChoiceCard key={ch.key} data={ch.data} onSelectChoice={onSelectChoice} />
        })),
        ...quizPlaceholders.map((q) => ({
          key: q.key,
          render: () => <QuizCard key={q.key} quizData={q.quizData} />
        }))
      ];

      const sanitizeHtml = (htmlStr) =>
        DOMPurify.sanitize(htmlStr, {
          ADD_TAGS: ['math', 'semantics', 'mrow', 'mi', 'mo', 'mn', 'msup', 'msub', 'mfrac', 'mtext', 'annotation'],
          ADD_ATTR: ['class', 'style', 'aria-hidden', 'xmlns', 'encoding', 'target', 'rel'],
          FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
          FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus']
        });

      if (allWidgets.length === 0) {
        return (
          <div className="formatted-message-wrapper">
            <div
              className="formatted-markdown-body"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(rawHtml) }}
            />
          </div>
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
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(before) }}
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
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(remaining) }}
          />
        );
      }

      return (
        <div className="formatted-message-container">
          {parts}
        </div>
      );
    } catch (err) {
      return <p style={{ whiteSpace: 'pre-line' }}>{text}</p>;
    }
  }, [text, onSelectChoice]);

  return renderedContent;
}
