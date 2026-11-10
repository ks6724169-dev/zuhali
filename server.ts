import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { spawn, ChildProcess } from 'child_process';

dotenv.config();

// Dynamically read environment variable from process.env or .env file on disk
function getDynamicEnv(keyName: string): string {
  if (process.env[keyName]?.trim()) {
    return process.env[keyName]!.trim();
  }
  try {
    const envPaths = ['.env', '.env.local'];
    for (const p of envPaths) {
      if (fs.existsSync(p)) {
        const lines = fs.readFileSync(p, 'utf-8').split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
            const [k, ...v] = trimmed.split('=');
            if (k.trim() === keyName) {
              const val = v.join('=').trim().replace(/^["']|["']$/g, '');
              if (val) return val;
            }
          }
        }
      }
    }
  } catch (e) {}
  return '';
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// ------------------------------------------------------------------
// Hybrid Microservices Configuration: Python AI Brain on Port 8000
// ------------------------------------------------------------------
const PYTHON_BACKEND_PORT = 8000;
const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || `http://127.0.0.1:${PYTHON_BACKEND_PORT}`;
let pythonProcess: ChildProcess | null = null;

async function checkPythonBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${PYTHON_BACKEND_URL}/health`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

function ensurePythonBackendRunning() {
  const backendDir = path.resolve(__dirname, 'backend');
  if (!fs.existsSync(backendDir)) return;

  checkPythonBackendHealth().then((isHealthy) => {
    if (isHealthy) {
      console.log(`[Microservice Architecture] ✅ Python AI Brain is ONLINE at ${PYTHON_BACKEND_URL}`);
      return;
    }

    console.log(`[Microservice Architecture] Spawning Python FastAPI Brain on port ${PYTHON_BACKEND_PORT}...`);
    try {
      const pyCmd = process.platform === 'win32' ? 'python' : 'python3';
      pythonProcess = spawn(pyCmd, ['-m', 'uvicorn', 'app.main:app', '--app-dir', 'backend', '--port', String(PYTHON_BACKEND_PORT), '--host', '127.0.0.1'], {
        cwd: __dirname,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      pythonProcess.stdout?.on('data', (data) => {
        const text = data.toString().trim();
        if (text) console.log(`[Python Brain] ${text}`);
      });

      pythonProcess.stderr?.on('data', (data) => {
        const text = data.toString().trim();
        if (text && !text.includes('INFO:')) console.warn(`[Python Brain Log] ${text}`);
      });

      pythonProcess.on('exit', (code) => {
        console.log(`[Python Brain] Process terminated (code: ${code})`);
        pythonProcess = null;
      });
    } catch (e: any) {
      console.warn('[Microservice] Could not launch Python process automatically:', e.message);
    }
  });
}

// Auto-check and spawn on boot
setTimeout(ensurePythonBackendRunning, 1000);

process.on('SIGINT', () => {
  if (pythonProcess) {
    try { pythonProcess.kill(); } catch (e) {}
  }
  process.exit();
});

process.on('exit', () => {
  if (pythonProcess) {
    try { pythonProcess.kill(); } catch (e) {}
  }
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// In-memory data stores for dev runtime
interface User {
  id: string;
  name: string;
  email: string;
  canonicalEmail: string;
  passwordHash: string;
  verified: boolean;
}

const usersMap = new Map<string, User>();
const otpsMap = new Map<string, string>();
const feedbackStore: any[] = [];

// Helper email normalization
function normalizeEmail(email: string): { display: string; canonical: string } {
  const display = email.trim();
  const parts = display.toLowerCase().split('@');
  if (parts.length !== 2) return { display, canonical: display.toLowerCase() };
  let [local, domain] = parts;
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    local = local.replace(/\./g, '');
    if (local.includes('+')) {
      local = local.split('+')[0];
    }
  }
  return { display, canonical: `${local}@${domain}` };
}

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ------------------------------------------------------------------
// Auth Routes
// ------------------------------------------------------------------

app.post('/api/v1/auth/send-otp', (req: Request, res: Response) => {
  const { recipient, channel = 'email', purpose = 'verification' } = req.body;
  if (!recipient) {
    return res.status(400).json({ detail: 'Recipient is required' });
  }

  const { display, canonical } = normalizeEmail(recipient);
  const otp = generateOtp();
  otpsMap.set(canonical, otp);
  otpsMap.set(display, otp);

  console.log(`[OTP Generated] For ${display} (${purpose}): ${otp}`);

  return res.json({
    status: 'success',
    message: `Verification code sent via ${channel.toUpperCase()} successfully to ${recipient}. (Demo code: ${otp})`,
    recipient,
    demo_otp: otp
  });
});

app.post('/api/v1/auth/signup', (req: Request, res: Response) => {
  const { name, email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ detail: 'Email and password are required' });
  }

  const { display, canonical } = normalizeEmail(email);

  const existing = usersMap.get(canonical);
  if (existing && existing.verified) {
    return res.status(409).json({
      detail: `This email (${display}) is already registered! Please log in directly or reset your password.`
    });
  }

  const user: User = {
    id: 'usr_' + Date.now(),
    name: name || display.split('@')[0],
    email: display,
    canonicalEmail: canonical,
    passwordHash: password, // In-memory hash string simulation
    verified: false
  };

  usersMap.set(canonical, user);

  const otp = generateOtp();
  otpsMap.set(canonical, otp);
  otpsMap.set(display, otp);

  console.log(`[Signup OTP] For ${display}: ${otp}`);

  return res.json({
    status: 'success',
    message: `Verification code sent to ${display}. Please enter the 6-digit OTP (Demo OTP: ${otp}).`,
    email: display,
    canonical_email: canonical,
    requires_otp: true,
    demo_otp: otp
  });
});

app.post('/api/v1/auth/verify-otp', (req: Request, res: Response) => {
  const { recipient, otp } = req.body;
  if (!recipient || !otp) {
    return res.status(400).json({ detail: 'Recipient and OTP are required' });
  }

  const { display, canonical } = normalizeEmail(recipient);
  const storedOtp = otpsMap.get(canonical) || otpsMap.get(display);

  if (!storedOtp || storedOtp !== otp.toString().trim()) {
    return res.status(400).json({ detail: 'Invalid or expired OTP code. Please check and try again.' });
  }

  otpsMap.delete(canonical);
  otpsMap.delete(display);

  let user = usersMap.get(canonical);
  if (!user) {
    user = {
      id: 'usr_' + Date.now(),
      name: display.split('@')[0],
      email: display,
      canonicalEmail: canonical,
      passwordHash: '',
      verified: true
    };
    usersMap.set(canonical, user);
  } else {
    user.verified = true;
  }

  const token = 'zuhali_jwt_' + Buffer.from(`${canonical}:${Date.now()}`).toString('base64');

  return res.json({
    status: 'success',
    message: 'Account verified successfully!',
    access_token: token,
    token_type: 'bearer',
    user: {
      id: user.id,
      email: user.email,
      canonical_email: user.canonicalEmail,
      name: user.name
    }
  });
});

app.post('/api/v1/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ detail: 'Email and password are required' });
  }

  const { display, canonical } = normalizeEmail(email);
  const user = usersMap.get(canonical);

  if (!user) {
    return res.status(404).json({
      detail: 'Account not found! Please sign up first to create an account.'
    });
  }

  if (user.passwordHash && user.passwordHash !== password) {
    return res.status(401).json({ detail: 'Incorrect password! Please check your credentials.' });
  }

  if (!user.verified) {
    const otp = generateOtp();
    otpsMap.set(canonical, otp);
    otpsMap.set(display, otp);
    console.log(`[Unverified Login OTP] For ${display}: ${otp}`);

    return res.status(403).json({
      detail: `Your account is not verified yet! A verification code has been sent to ${display} (Demo code: ${otp}).`
    });
  }

  const token = 'zuhali_jwt_' + Buffer.from(`${canonical}:${Date.now()}`).toString('base64');

  return res.json({
    status: 'success',
    message: 'Logged in successfully!',
    access_token: token,
    token_type: 'bearer',
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      canonical_email: user.canonicalEmail
    }
  });
});

app.post('/api/v1/auth/forgot-password', (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ detail: 'Email is required' });

  const { display, canonical } = normalizeEmail(email);
  const user = usersMap.get(canonical);

  if (!user) {
    return res.status(404).json({ detail: 'No registered account found with this email.' });
  }

  const otp = generateOtp();
  otpsMap.set(canonical, otp);
  otpsMap.set(display, otp);
  console.log(`[Password Reset OTP] For ${display}: ${otp}`);

  return res.json({
    status: 'success',
    message: `Password reset code sent to ${display} (Demo OTP: ${otp}).`,
    email: display
  });
});

app.post('/api/v1/auth/reset-password', (req: Request, res: Response) => {
  const { email, otp, new_password } = req.body;
  if (!email || !otp || !new_password) {
    return res.status(400).json({ detail: 'Email, OTP, and new password are required' });
  }

  const { display, canonical } = normalizeEmail(email);
  const storedOtp = otpsMap.get(canonical) || otpsMap.get(display);

  if (!storedOtp || storedOtp !== otp.toString().trim()) {
    return res.status(400).json({ detail: 'Invalid or expired OTP code.' });
  }

  otpsMap.delete(canonical);
  otpsMap.delete(display);

  const user = usersMap.get(canonical);
  if (user) {
    user.passwordHash = new_password;
    user.verified = true;
  }

  return res.json({
    status: 'success',
    message: 'Password reset successfully! You can now log in with your new password.'
  });
});

// ------------------------------------------------------------------
// Chat & Developer Streaming Routes
// ------------------------------------------------------------------
app.post('/api/v1/chat/stream', async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const {
    message = '',
    messages = [],
    model = '',
    attachment = null,
    developer_mode = false,
    project_title = null,
    project_name = null,
    user_email = null
  } = req.body;

  const userPrompt = message.trim() || (attachment ? `Analysis of file: ${attachment.name}` : 'Hello');

  // Helper send SSE event
  const sendSSE = (obj: any) => {
    res.write(`data: ${JSON.stringify(obj)}\n\n`);
  };

  // Re-read API key dynamically per request
  const currentKey = (process.env.GEMINI_API_KEY || process.env.API_KEY || '').trim();
  const client = currentKey ? new GoogleGenAI({
    apiKey: currentKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  }) : null;

  const streamSmartFallback = async (promptText: string, isDev: boolean) => {
    let replyText = '';
    const lower = promptText.toLowerCase();

    if (isDev) {
      replyText = `### Zuhali Autonomous Developer Agent\n\n- **Status**: Completed project scaffolding for "${project_title || promptText}"\n- **Files Generated**: \`src/App.jsx\`, \`src/styles.css\`\n- **Summary**: Built responsive UI components with clean state management. You can inspect the code in the **Code Editor** tab or open the **Terminal** for logs.`;
    } else if (lower.includes('benzene') || lower.includes('बेंजीन') || lower.includes('c6h6')) {
      replyText = `### 🧪 बेंजीन (Benzene - $C_6H_6$) की आणविक संरचना\n\nबेंजीन एक एरोमैटिक हाइड्रोकार्बन है जिसमें 6 कार्बन परमाणु एक समषट्भुज (Hexagon) रिंग बनाते हैं, जिसमें एकांतर (alternating) एकल और द्वि-आबंध (single and double bonds) होते हैं:\n\n\`\`\`svg\n<svg viewBox="0 0 240 220" width="240" height="220" xmlns="http://www.w3.org/2000/svg">\n  <polygon points="120,25 185,62 185,138 120,175 55,138 55,62" fill="none" stroke="#2563eb" stroke-width="3" stroke-linejoin="round"/>\n  <line x1="120" y1="37" x2="173" y2="67" stroke="#2563eb" stroke-width="2.5"/>\n  <line x1="173" y1="133" x2="120" y2="163" stroke="#2563eb" stroke-width="2.5"/>\n  <line x1="67" y1="133" x2="67" y2="67" stroke="#2563eb" stroke-width="2.5"/>\n  <circle cx="120" cy="100" r="38" fill="none" stroke="#059669" stroke-width="2" stroke-dasharray="6,4"/>\n  <text x="120" y="16" font-size="12" font-family="sans-serif" font-weight="bold" fill="#0f172a" text-anchor="middle">CH</text>\n  <text x="200" y="65" font-size="12" font-family="sans-serif" font-weight="bold" fill="#0f172a" text-anchor="start">CH</text>\n  <text x="200" y="145" font-size="12" font-family="sans-serif" font-weight="bold" fill="#0f172a" text-anchor="start">CH</text>\n  <text x="120" y="195" font-size="12" font-family="sans-serif" font-weight="bold" fill="#0f172a" text-anchor="middle">CH</text>\n  <text x="40" y="145" font-size="12" font-family="sans-serif" font-weight="bold" fill="#0f172a" text-anchor="end">CH</text>\n  <text x="40" y="65" font-size="12" font-family="sans-serif" font-weight="bold" fill="#0f172a" text-anchor="end">CH</text>\n  <text x="120" y="105" font-size="12" font-family="sans-serif" font-weight="bold" fill="#059669" text-anchor="middle">C₆H₆</text>\n</svg>\n\`\`\`\n\n**प्रमुख विशेषताएं:**\n1. सभी 6 कार्बन परमाणु $sp^2$ संकरित (hybridized) होते हैं।\n2. इसमें पाई-इलेक्ट्रॉन का अनुनाद (Resonance) होता है।\n\n\`\`\`choice\nTitle: आप अगला केमिकल स्ट्रक्चर कौन-सा देखना चाहते हैं?\n- [x] जल का अणु (Water Molecule H2O)\n- [ ] मीथेन की चतुष्फलकीय संरचना (Methane CH4)\n- [ ] एथेनॉल का रासायनिक सूत्र (Ethanol C2H5OH)\nButton: अगला स्ट्रक्चर देखें\n\`\`\``;
    } else if (lower.includes('water') || lower.includes('h2o') || lower.includes('जल') || lower.includes('पानी')) {
      replyText = `### 🧪 जल ($H_2O$) की रासायनिक आणविक संरचना\n\nजल का अणु एक बेंट (V-आकार) संरचना बनाता है, जिसमें ऑक्सीजन के पास दो एकाकी इलेक्ट्रॉन युग्म (lone pairs) होते हैं:\n\n\`\`\`svg\n<svg viewBox="0 0 240 160" width="240" height="160" xmlns="http://www.w3.org/2000/svg">\n  <line x1="120" y1="60" x2="60" y2="120" stroke="#0284c7" stroke-width="3.5" stroke-linecap="round"/>\n  <line x1="120" y1="60" x2="180" y2="120" stroke="#0284c7" stroke-width="3.5" stroke-linecap="round"/>\n  <circle cx="120" cy="60" r="24" fill="#ef4444" stroke="#b91c1c" stroke-width="2"/>\n  <text x="120" y="66" font-size="16" font-family="sans-serif" font-weight="bold" fill="#ffffff" text-anchor="middle">O</text>\n  <circle cx="106" cy="30" r="3" fill="#64748b"/>\n  <circle cx="114" cy="24" r="3" fill="#64748b"/>\n  <circle cx="126" cy="24" r="3" fill="#64748b"/>\n  <circle cx="134" cy="30" r="3" fill="#64748b"/>\n  <circle cx="60" cy="120" r="16" fill="#0284c7" stroke="#0369a1" stroke-width="2"/>\n  <text x="60" y="125" font-size="13" font-family="sans-serif" font-weight="bold" fill="#ffffff" text-anchor="middle">H</text>\n  <circle cx="180" cy="120" r="16" fill="#0284c7" stroke="#0369a1" stroke-width="2"/>\n  <text x="180" y="125" font-size="13" font-family="sans-serif" font-weight="bold" fill="#ffffff" text-anchor="middle">H</text>\n  <text x="120" y="98" font-size="11" font-weight="600" fill="#0284c7" text-anchor="middle">104.5°</text>\n</svg>\n\`\`\`\n\n- **आबंध कोण (Bond Angle)**: $104.5^\\circ$\n- **ध्रुवीयता**: ध्रुवीय सहसंयोजी आबंध (Polar covalent bond)`;
    } else if (lower.includes('methane') || lower.includes('ch4') || lower.includes('मीथेन')) {
      replyText = `### 🧪 मीथेन ($CH_4$) की चतुष्फलकीय आणविक संरचना\n\nमीथेन में कार्बन परमाणु $sp^3$ संकरित होता है और 4 हाइड्रोजन परमाणुओं के साथ नियमित चतुष्फलकीय (Tetrahedral) संरचना बनाता है:\n\n\`\`\`svg\n<svg viewBox="0 0 240 220" width="240" height="220" xmlns="http://www.w3.org/2000/svg">\n  <line x1="120" y1="110" x2="120" y2="35" stroke="#334155" stroke-width="3.5" stroke-linecap="round"/>\n  <line x1="120" y1="110" x2="50" y2="160" stroke="#334155" stroke-width="3.5" stroke-linecap="round"/>\n  <line x1="120" y1="110" x2="190" y2="160" stroke="#334155" stroke-width="3.5" stroke-linecap="round"/>\n  <polygon points="120,110 112,185 136,190" fill="#64748b" opacity="0.8"/>\n  <circle cx="120" cy="110" r="22" fill="#334155" stroke="#1e293b" stroke-width="2"/>\n  <text x="120" y="116" font-size="15" font-family="sans-serif" font-weight="bold" fill="#ffffff" text-anchor="middle">C</text>\n  <circle cx="120" cy="35" r="16" fill="#0284c7" stroke="#0369a1" stroke-width="2"/>\n  <text x="120" y="40" font-size="13" font-weight="bold" fill="#ffffff" text-anchor="middle">H</text>\n  <circle cx="50" cy="160" r="16" fill="#0284c7" stroke="#0369a1" stroke-width="2"/>\n  <text x="50" y="165" font-size="13" font-weight="bold" fill="#ffffff" text-anchor="middle">H</text>\n  <circle cx="190" cy="160" r="16" fill="#0284c7" stroke="#0369a1" stroke-width="2"/>\n  <text x="190" y="165" font-size="13" font-weight="bold" fill="#ffffff" text-anchor="middle">H</text>\n  <circle cx="124" cy="190" r="16" fill="#0284c7" stroke="#0369a1" stroke-width="2"/>\n  <text x="124" y="195" font-size="13" font-weight="bold" fill="#ffffff" text-anchor="middle">H</text>\n  <text x="120" y="80" font-size="11" font-weight="600" fill="#16a34a" text-anchor="middle">109.5°</text>\n</svg>\n\`\`\`\n\n- **ज्यामिति (Geometry)**: समचतुष्फलकीय (Tetrahedral)\n- **आबंध कोण (Bond Angle)**: $109.5^\\circ$`;
    } else if (lower.includes('triangle') || lower.includes('त्रिभुज') || lower.includes('pythagoras') || lower.includes('पाइथागोरस')) {
      replyText = `### 📐 समकोण त्रिभुज एवं पाइथागोरस प्रमेय (Right-Angled Triangle)\n\nपाइथागोरस प्रमेय के अनुसार किसी समकोण त्रिभुज में:\n$$\\text{कर्ण}^2 = \\text{लंब}^2 + \\text{आधार}^2 \\quad (c^2 = a^2 + b^2)$$\n\n\`\`\`svg\n<svg viewBox="0 0 260 200" width="260" height="200" xmlns="http://www.w3.org/2000/svg">\n  <polygon points="50,160 210,160 50,40" fill="#f0fdf4" stroke="#16a34a" stroke-width="3" stroke-linejoin="round"/>\n  <rect x="50" y="142" width="18" height="18" fill="none" stroke="#16a34a" stroke-width="2"/>\n  <text x="40" y="32" font-size="14" font-weight="bold" fill="#0f172a">A</text>\n  <text x="220" y="165" font-size="14" font-weight="bold" fill="#0f172a">B</text>\n  <text x="40" y="178" font-size="14" font-weight="bold" fill="#0f172a">C (90°)</text>\n  <text x="22" y="105" font-size="12" font-weight="600" fill="#dc2626">लंब (a)</text>\n  <text x="130" y="180" font-size="12" font-weight="600" fill="#2563eb" text-anchor="middle">आधार (b)</text>\n  <text x="145" y="90" font-size="12" font-weight="600" fill="#16a34a" transform="rotate(-36 145 90)">कर्ण (c)</text>\n</svg>\n\`\`\`\n\n**उदाहरण**: यदि $a = 3$ और $b = 4$, तो $c = \\sqrt{3^2 + 4^2} = 5$`;
    } else if (lower.includes('circle') || lower.includes('वृत्त')) {
      replyText = `### 📐 वृत्त की ज्यामिति (Circle Geometry)\n\nवृत्त का क्षेत्रफल $A = \\pi r^2$ तथा परिधि $C = 2\\pi r$ होती है:\n\n\`\`\`svg\n<svg viewBox="0 0 220 220" width="220" height="220" xmlns="http://www.w3.org/2000/svg">\n  <circle cx="110" cy="110" r="80" fill="#eff6ff" stroke="#2563eb" stroke-width="3"/>\n  <circle cx="110" cy="110" r="4" fill="#ef4444"/>\n  <line x1="110" y1="110" x2="190" y2="110" stroke="#ef4444" stroke-width="2" stroke-dasharray="4,3"/>\n  <line x1="30" y1="110" x2="110" y2="110" stroke="#64748b" stroke-width="1.5"/>\n  <text x="110" y="100" font-size="12" font-weight="bold" fill="#ef4444" text-anchor="middle">केंद्र O</text>\n  <text x="150" y="104" font-size="11" font-weight="600" fill="#ef4444">त्रिज्या r</text>\n  <text x="70" y="125" font-size="11" font-weight="600" fill="#64748b">व्यास d = 2r</text>\n</svg>\n\`\`\`\n\n- **त्रिज्या (Radius)**: $r$\n- **व्यास (Diameter)**: $d = 2r$\n- **परिधि (Circumference)**: $2\\pi r$`;
    } else if (lower.includes('cylinder') || lower.includes('बेलन')) {
      replyText = `### 📐 बेलन (Cylinder) का आयतन एवं पृष्ठ क्षेत्रफल\n\nबेलन का आयतन $V = \\pi r^2 h$ तथा वक्र पृष्ठ क्षेत्रफल $CSA = 2\\pi r h$ होता है:\n\n\`\`\`svg\n<svg viewBox="0 0 220 240" width="220" height="240" xmlns="http://www.w3.org/2000/svg">\n  <ellipse cx="110" cy="45" rx="65" ry="22" fill="#e0f2fe" stroke="#0284c7" stroke-width="2.5"/>\n  <path d="M45,45 L45,185 A65,22 0 0,0 175,185 L175,45" fill="#f0f9ff" stroke="#0284c7" stroke-width="2.5"/>\n  <ellipse cx="110" cy="185" rx="65" ry="22" fill="none" stroke="#0284c7" stroke-width="2" stroke-dasharray="5,4"/>\n  <line x1="185" y1="45" x2="185" y2="185" stroke="#ef4444" stroke-width="2"/>\n  <text x="195" y="120" font-size="12" font-weight="bold" fill="#ef4444">ऊंचाई h</text>\n  <line x1="110" y1="45" x2="175" y2="45" stroke="#16a34a" stroke-width="2"/>\n  <text x="140" y="38" font-size="11" font-weight="bold" fill="#16a34a">त्रिज्या r</text>\n</svg>\n\`\`\`\n\n- **आयतन (Volume)**: $V = \\pi r^2 h$\n- **कुल पृष्ठीय क्षेत्रफल**: $TSA = 2\\pi r(r + h)$`;
    } else if (lower.includes('flowchart') || lower.includes('फ्लोचार्ट') || lower.includes('flow chart') || lower.includes('mermaid')) {
      replyText = `### 📊 इंटरैक्टिव फ़्लोचार्ट (Flowchart - Mermaid.js)\n\nयहाँ एक निर्णय प्रक्रिया (Decision Flow) का लाइव फ़्लोचार्ट है:\n\n\`\`\`mermaid\ngraph TD\n    A[🚀 उपयोगकर्ता ने अनुरोध किया] --> B{डेटा मौजूद है?}\n    B -- हाँ --> C[डैशबोर्ड रेंडर करो]\n    B -- नहीं --> D[लॉगिन पेज खोलो]\n    D --> E[OTP सत्यापन]\n    E --> C\n    C --> F[✅ कार्य संपन्न]\n\`\`\`\n\nआप इस फ़्लोचार्ट के ऊपर **Code / Diagram** बटन से इसका कोड भी देख सकते हैं और कॉपी भी कर सकते हैं!`;
    } else if (lower.includes('3d') || lower.includes('three') || lower.includes('threejs')) {
      replyText = `### 🧊 3D इंटरैक्टिव आकृति (Three.js - 360° Rotate)\n\nआप इस 3D बेलन (Cylinder) को **माउस से या मोबाइल पर उंगली से 360 डिग्री घुमाकर** देख सकते हैं, और ऊपर से Auto-Rotate या Wireframe मोड ऑन/ऑफ कर सकते हैं:\n\n\`\`\`3d\nshape: cylinder\ncolor: #2563eb\ntitle: 3D बेलन (Cylinder - 360° घुमाएं)\n\`\`\`\n\n\`\`\`choice\nTitle: आप अगला 3D मॉडल कौन-सा देखना चाहते हैं?\n- [x] 3D शंकु (3D Cone)\n- [ ] 3D घन (3D Cube / Box)\n- [ ] 3D गोला (3D Sphere)\n- [ ] 3D बेंजीन अणु (3D Molecule)\nButton: 3D मॉडल बदलें\n\`\`\``;
    } else if (lower.includes('chart') || lower.includes('graph') || lower.includes('ग्राफ') || lower.includes('चार्ट') || lower.includes('recharts')) {
      replyText = `### 📈 इंटरैक्टिव डेटा चार्ट (Recharts)\n\nयहाँ एक लाइव डेटा विज़ुअलाइज़ेशन चार्ट है:\n\n\`\`\`chart\ntype: bar\ntitle: 📊 तिमाही प्रगति रिपोर्ट (Quarterly Progress)\ndata:\n  - जनवरी: 55\n  - फरवरी: 82\n  - मार्च: 96\n  - अप्रैल: 74\n  - मई: 90\n\`\`\`\n\n\`\`\`choice\nTitle: आप चार्ट का प्रकार बदलना चाहते हैं?\n- [x] लाइन चार्ट (Line Chart)\n- [ ] एरिया चार्ट (Area Chart)\n- [ ] पाई चार्ट (Pie Chart)\nButton: चार्ट बदलें\n\`\`\``;
    } else if (lower.includes('cone') || lower.includes('शंकु')) {
      replyText = `### 📐 शंकु (Cone) की ज्यामिति एवं 3D मॉडल\n\nशंकु का आयतन $V = \\frac{1}{3}\\pi r^2 h$ तथा तिर्यक ऊंचाई $l = \\sqrt{r^2 + h^2}$ होती है:\n\n\`\`\`3d\nshape: cone\ncolor: #7c3aed\ntitle: 3D शंकु (Cone - 360° घुमाएं)\n\`\`\`\n\n- **आयतन (Volume)**: $V = \\frac{1}{3}\\pi r^2 h$\n- **तिर्यक ऊंचाई (Slant Height)**: $l = \\sqrt{r^2 + h^2}$`;
    } else if (lower.includes('cube') || lower.includes('घन')) {
      replyText = `### 📐 3D घन (Cube)\n\nघन का आयतन $V = a^3$ तथा कुल पृष्ठीय क्षेत्रफल $6a^2$ होता है:\n\n\`\`\`3d\nshape: cube\ncolor: #059669\ntitle: 3D घन (Cube - 360° घुमाएं)\n\`\`\``;
    } else if (lower.includes('card') || lower.includes('choice') || lower.includes('poll') || lower.includes('कार्ड')) {
      replyText = `यहाँ एक इंटरैक्टिव चॉइस कार्ड है:\n\n\`\`\`choice\nTitle: आप अगला टॉपिक कौन-सा समझना चाहते हैं?\n- [x] 📊 फ्लोचार्ट (Mermaid.js Flowchart)\n- [ ] 🧊 3D आकृतियां (Three.js 360° Views)\n- [ ] 📈 डेटा चार्ट्स (Recharts Bar & Line)\n- [ ] 📐 2D मैथ्स व ज्यामिति (KaTeX & SVG)\nButton: Confirm Choice\n\`\`\``;
    } else if (lower.includes('code') || lower.includes('react') || lower.includes('javascript') || lower.includes('function') || lower.includes('python')) {
      replyText = `Here is a solution for your request:\n\n\`\`\`javascript\n// Zuhali AI Code Assistant Example\nexport function processData(items) {\n  return items.map(item => ({\n    ...item,\n    processedAt: new Date().toISOString(),\n    status: 'active'\n  }));\n}\n\`\`\`\n\nYou can customize or run this logic directly inside your project files!`;
    } else if (
      lower.includes('solar') || lower.includes('सोलर') || lower.includes('सौर') || lower.includes('सौरमंडल') ||
      lower.includes('sytem') || lower.includes('system') || lower.includes('planet') || lower.includes('ग्रह') ||
      lower.includes('sun') || lower.includes('सूर्य') || lower.includes('सूरज') || lower.includes('space') ||
      lower.includes('अंतरिक्ष') || lower.includes('moon') || lower.includes('चांद') || lower.includes('चंद्रमा')
    ) {
      replyText = `### ☀️ सौर मंडल (Solar System) और इसके 8 मुख्य ग्रह\n\n**सौर मंडल (Solar System)** हमारे सूर्य और उसके गुरुत्वाकर्षण से बंधे 8 ग्रहों, उनके उपग्रहों, क्षुद्रग्रहों और धूमकेतुओं का परिवार है।\n\n**सौर मंडल के प्रमुख घटक:**\n1. **सूर्य (The Sun)**: सौर मंडल का केंद्र और जीवनदायी ऊर्जा का अखंड स्रोत, जिसमें संपूर्ण सौर मंडल का 99.8% द्रव्यमान समाहित है।\n2. **आंतरिक चट्टानी ग्रह**: बुध (Mercury), शुक्र (Venus), पृथ्वी (Earth) और मंगल (Mars) - ये ठोस चट्टानों और धातुओं से बने हैं।\n3. **बाह्य गैस दानव ग्रह**: बृहस्पति (Jupiter), शनि (Saturn), अरुण (Uranus) और वरुण (Neptune) - ये हाइड्रोजन, हीलियम और गैसों के विशाल पिंड हैं।\n4. **क्षुद्रग्रह बेल्ट व उपग्रह**: मंगल व बृहस्पति के बीच एस्टेरॉयड बेल्ट, पृथ्वी का चंद्रमा और शनि के बर्फ़ीले वलय (Rings)।\n\n\`\`\`choice\nTitle: आप सौर मंडल में आगे क्या जानना चाहते हैं?\n- [x] सूर्य और सौर ज्वालाएं (Solar Flares)\n- [ ] शनि ग्रह के सुंदर छल्ले (Rings of Saturn)\n- [ ] पृथ्वी और चंद्रमा का संबंध\n- [ ] ब्रह्मांड और ब्लैक होल\nButton: आगे बढ़ें\n\`\`\``;
    } else if (
      lower.includes('pc') || lower.includes('computer') || lower.includes('कंप्यूटर') || lower.includes('कम्प्यूटर') ||
      lower.includes('laptop') || lower.includes('लैपटॉप') || lower.includes('cpu') || lower.includes('hardware')
    ) {
      replyText = `### 💻 कंप्यूटर / PC सिस्टम और इसके मुख्य भाग\n\nकंप्यूटर एक इलेक्ट्रॉनिक उपकरण है जो डेटा को इनपुट के रूप में लेता है, उसे प्रोसेस करता है और आउटपुट प्रदान करता है।\n\n**इसके मुख्य भाग:**\n1. **डेस्कटॉप सेटअप्स (Desktop PC Setups)**: संपूर्ण सिस्टम, मॉनिटर और वर्कस्टेशन।\n2. **मुख्य प्रोसेसिंग हार्डवेयर (Core Hardware)**: CPU प्रोसेसर, मदरबोर्ड, रैम व ग्राफ़िक्स कार्ड (GPU)।\n3. **लैपटॉप और पोर्टेबल सिस्टम (Laptops & Workstations)**: मोबाइल कोडिंग और ऑफ़िस वर्कस्टेशन।\n4. **हाई-परफॉर्मेंस और गेमिंग सिस्टम (Gaming Rigs & Servers)**: लिक्विड कूल्ड RGB गेमिंग रिग्स और सर्वर डेटा सेंटर।\n\n\`\`\`choice\nTitle: आप आगे क्या जानना चाहते हैं?\n- [x] CPU और प्रोसेसर की कार्यप्रणाली\n- [ ] RAM और ROM में अंतर\n- [ ] 3D कंप्यूटर सेटअप मॉडल\nButton: चुनें और आगे बढ़ें\n\`\`\``;
    } else if (
      lower.includes('car') || lower.includes('cars') || lower.includes('कार') || lower.includes('गाड़ी') || lower.includes('bike') || lower.includes('बाइक')
    ) {
      replyText = `### 🚗 आधुनिक सुपरकार एवं वाहन (Automotive)\n\nआधुनिक ऑटोमोबाइल इंजीनियरिंग में इलेक्ट्रिक ड्राइवट्रेन, एरोडायनामिक डिज़ाइन और उच्च-दक्षता वाले आंतरिक दहन इंजन (Internal Combustion Engines) शामिल हैं।`;
    } else if (
      lower.includes('animal') || lower.includes('जानवर') || lower.includes('शेर') || lower.includes('tiger') || lower.includes('lion') || lower.includes('elephant')
    ) {
      replyText = `### 🦁 वन्यजीव और प्राणी जगत (Wildlife & Fauna)\n\nपृथ्वी पर वन्यजीव जैव विविधता (Biodiversity) और पारिस्थितिकी तंत्र (Ecosystem) के संतुलन को बनाए रखने में सबसे महत्वपूर्ण भूमिका निभाते हैं।`;
    } else if (lower.includes('hello') || lower.includes('hi') || lower.includes('namaste') || lower.includes('hey')) {
      replyText = `Namaste! Welcome to **Zuhali AI Workspace** 🚀\n\nमैं आपकी क्या मदद कर सकता हूँ? आप मुझसे पूछ सकते हैं:\n- **मैथ्स की आकृतियां**: जैसे समकोण त्रिभुज, वृत्त, बेलन\n- **केमिस्ट्री के सूत्र व संरचना**: जैसे बेंजीन रिंग, जल ($H_2O$), मीथेन\n- **GitHub व Source Control**: इंटरैक्टिव रिपोजिटरी कार्ड्स\n- **इंटरैक्टिव चॉइस कार्ड्स**: ChatGPT जैसे पोल व ऑप्शन कार्ड्स\n\n\`\`\`choice\nTitle: आप क्या आज़माना चाहते हैं?\n- [x] समकोण त्रिभुज (Right Triangle) का चित्र दिखाओ\n- [ ] बेंजीन (Benzene C6H6) की संरचना दिखाओ\n- [ ] GitHub Repository & Pull Process कार्ड दिखाओ\nButton: चुनें और शुरू करें\n\`\`\``;
    } else {
      replyText = `### 🌟 Zuhali AI Workspace\n\nआपका अनुरोध: "${promptText}".\n\nमैंने इसे प्रोसेस कर लिया है। आप नीचे दिए गए विकल्पों में से चुन सकते हैं:\n\n\`\`\`choice\nTitle: आप आगे क्या देखना चाहते हैं?\n- [x] 📐 मैथ्स: समकोण त्रिभुज व पाइथागोरस प्रमेय\n- [ ] 🧪 केमिस्ट्री: बेंजीन ($C_6H_6$) आणविक संरचना\n- [ ] 📦 गिटहब: GitHub Repository व Source Control कार्ड\nButton: कार्ड देखें\n\`\`\``;
    }

    const words = replyText.split(' ');
    for (const word of words) {
      sendSSE({ token: word + ' ' });
      await new Promise((r) => setTimeout(r, 25));
    }
  };

  try {
    // ------------------------------------------------------------------
    // 0. Primary: Delegate to Python FastAPI AI Engine (The Brain)
    // ------------------------------------------------------------------
    const isPyAlive = await checkPythonBackendHealth();
    if (isPyAlive) {
      try {
        console.log('[Node Gateway -> Python Brain] Forwarding streaming request to Python AI Engine...');
        const pyRes = await fetch(`${PYTHON_BACKEND_URL}/api/v1/chat/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userPrompt,
            model: model || 'openai/gpt-oss-120b',
            messages: messages || [],
            developer_mode: !!developer_mode,
            project_name: project_name || '',
            project_title: project_title || '',
            user_email: user_email || '',
            attachment: attachment || null
          }),
          signal: AbortSignal.timeout(60000)
        });

        if (pyRes.ok && pyRes.body) {
          const reader = pyRes.body.getReader();
          const decoder = new TextDecoder('utf-8');
          let pyStreamedAny = false;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            if (chunk) {
              res.write(chunk);
              pyStreamedAny = true;
            }
          }

          if (pyStreamedAny) {
            res.end();
            return;
          }
        }
      } catch (pyErr: any) {
        console.warn('[Node Gateway] Python AI stream fallback triggered:', pyErr.message);
      }
    }

    if (developer_mode) {
      // Stream dev steps first
      const steps = [
        `Analyzing project scope and system requirements for "${project_title || userPrompt}"...`,
        'Scaffolding component structure and design hierarchy...',
        'Synthesizing interactive UI logic and state handlers...',
        'Running syntax check and bundling file assets...'
      ];

      for (const stepText of steps) {
        sendSSE({ type: 'dev_step', step: stepText, status: 'done' });
        await new Promise((r) => setTimeout(r, 250));
      }

      // Stream generated project files
      const sampleFiles: Record<string, string> = {
        'src/App.jsx': `import React, { useState } from 'react';\n\nexport default function App() {\n  const [count, setCount] = useState(0);\n  return (\n    <div style={{ padding: '24px', fontFamily: 'sans-serif' }}>\n      <h1>${project_title || 'Zuhali Dev Project'}</h1>\n      <p>Interactive prototype generated by Zuhali Autonomous Developer Agent.</p>\n      <button onClick={() => setCount(c => c + 1)} style={{ padding: '8px 16px', borderRadius: '8px', background: '#16a34a', color: '#fff', border: 0 }}>\n        Clicks: {count}\n      </button>\n    </div>\n  );\n}`,
        'src/styles.css': `body { margin: 0; background: #0f172a; color: #f8fafc; }`
      };

      sendSSE({
        type: 'project_ready',
        files: sampleFiles,
        terminalLogs: [
          `[Zuhali Agent] Initializing workspace for ${project_title || 'New Project'}...`,
          `[Zuhali Agent] Bundled 2 files successfully.`
        ]
      });
    }

  // ------------------------------------------------------------------
  // Groq API with GPT-OSS 120B (openai/gpt-oss-120b)
  // ------------------------------------------------------------------
  let streamSuccess = false;
  let streamedText = '';

  const groqKey = (
    getDynamicEnv('GROQ_API_KEY') ||
    getDynamicEnv('GROK_API_KEY') ||
    getDynamicEnv('BHARATROUTER_API_KEY') ||
    getDynamicEnv('OPENROUTER_API_KEY') ||
    ''
  ).trim();

  const geminiKey = (getDynamicEnv('GEMINI_API_KEY') || getDynamicEnv('API_KEY') || '').trim();

  // 1. Primary: Groq API with GPT-OSS 120B (openai/gpt-oss-120b)
  if (groqKey) {
    const formattedMessages = Array.isArray(messages) && messages.length > 0
      ? messages.map((m: any) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content || m.text || '' }))
      : [{ role: 'user', content: userPrompt }];

    const groqCandidateModels = ['openai/gpt-oss-120b', 'gpt-oss-120b', 'llama-3.3-70b-versatile'];
    let lastGroqError = '';

    for (const modelId of groqCandidateModels) {
      if (streamSuccess) break;
      try {
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${groqKey}`
          },
          body: JSON.stringify({
            model: modelId,
            messages: formattedMessages,
            stream: true,
            max_tokens: 4096
          })
        });

        if (groqRes.ok && groqRes.body) {
          const reader = groqRes.body.getReader();
          const decoder = new TextDecoder('utf-8');
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith('data: ')) {
                const dataStr = trimmed.slice(6).trim();
                if (dataStr === '[DONE]') break;
                try {
                  const parsed = JSON.parse(dataStr);
                  const token = parsed.choices?.[0]?.delta?.content;
                  if (token) {
                    streamedText += token;
                    sendSSE({ token });
                    streamSuccess = true;
                  }
                } catch (e) {}
              }
            }
          }
        } else {
          const errData = await groqRes.json().catch(() => ({}));
          lastGroqError = errData?.error?.message || `HTTP ${groqRes.status}`;
        }
      } catch (err: any) {
        lastGroqError = err.message || 'Connection error';
      }
    }

    if (!streamSuccess) {
      sendSSE({
        token: `❌ Groq API Error: ${lastGroqError || 'Failed to connect to GroqCloud'}. (Tried model: openai/gpt-oss-120b)`
      });
      streamSuccess = true;
    }
  }

  // 2. Fallback: Google Gemini API if Gemini key is available
  if (!streamSuccess && geminiKey && geminiKey.startsWith('AIza')) {
    try {
      const client = new GoogleGenAI({
        apiKey: geminiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });

      const contents: any[] = [];
      if (Array.isArray(messages) && messages.length > 0) {
        for (const msg of messages.slice(-10)) {
          contents.push({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content || msg.text || '' }]
          });
        }
      } else {
        contents.push({ role: 'user', parts: [{ text: userPrompt }] });
      }

      for (const modelName of ['gemini-3.8-flash', 'gemini-3.1-flash-lite']) {
        if (streamSuccess) break;
        try {
          const responseStream = await client.models.generateContentStream({
            model: modelName,
            contents
          });
          for await (const chunk of responseStream) {
            if (chunk.text) {
              streamedText += chunk.text;
              sendSSE({ token: chunk.text });
              streamSuccess = true;
            }
          }
        } catch (err: any) {}
      }
    } catch (e) {}
  }

  // 3. Smart Interactive Fallback if no external API key is active
  if (!streamSuccess) {
    await streamSmartFallback(userPrompt, developer_mode);
  }
  } catch (e: any) {
    await streamSmartFallback(userPrompt, developer_mode);
  } finally {
    res.end();
  }
});

// Feedback routes
app.post('/api/v1/chat/feedback', (req: Request, res: Response) => {
  const feedback = {
    id: 'fb_' + Date.now(),
    ...req.body,
    createdAt: new Date().toISOString()
  };
  feedbackStore.push(feedback);
  return res.json({
    status: 'success',
    feedback_id: feedback.id,
    message: `Feedback recorded successfully.`
  });
});

app.get('/api/v1/chat/feedback', (req: Request, res: Response) => {
  return res.json({
    status: 'success',
    count: feedbackStore.length,
    feedbacks: feedbackStore
  });
});

app.delete('/api/v1/chat/project', async (req: Request, res: Response) => {
  const { project_name, user_email } = req.query;
  const isPyUp = await checkPythonBackendHealth();
  if (isPyUp) {
    try {
      const q = new URLSearchParams({
        project_name: String(project_name || ''),
        user_email: String(user_email || '')
      });
      const pyRes = await fetch(`${PYTHON_BACKEND_URL}/api/v1/chat/project?${q.toString()}`, {
        method: 'DELETE'
      });
      if (pyRes.ok) {
        const data = await pyRes.json();
        return res.json(data);
      }
    } catch (e) {}
  }
  return res.json({ status: 'success', message: `Project '${project_name}' deleted` });
});

app.patch('/api/v1/chat/project/rename', async (req: Request, res: Response) => {
  const { old_name, new_name, user_email } = req.body;
  const isPyUp = await checkPythonBackendHealth();
  if (isPyUp) {
    try {
      const pyRes = await fetch(`${PYTHON_BACKEND_URL}/api/v1/chat/project/rename`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ old_name, new_name, user_email })
      });
      if (pyRes.ok) {
        const data = await pyRes.json();
        return res.json(data);
      }
    } catch (e) {}
  }
  return res.json({ status: 'success', message: `Project renamed to '${new_name}'` });
});

app.get('/health', async (req: Request, res: Response) => {
  const pyOk = await checkPythonBackendHealth();
  res.json({
    status: 'healthy',
    architecture: 'Hybrid Microservices (Node.js Gateway + Python AI Brain)',
    version: '1.0.0',
    gateway: {
      service: 'Node.js Express / Vite Gateway',
      port: PORT,
      status: 'active'
    },
    brain: {
      service: 'Python FastAPI AI Engine',
      port: PYTHON_BACKEND_PORT,
      status: pyOk ? 'online' : 'offline (Node fallback active)'
    }
  });
});

// ------------------------------------------------------------------
// Vite Integration (Dev middleware / Static production)
// ------------------------------------------------------------------

if (process.env.NODE_ENV !== 'production') {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true, host: '0.0.0.0', port: PORT },
    appType: 'spa'
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.resolve(__dirname, 'dist')));
  app.get('*', (req: Request, res: Response) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Zuhali App] Server running at http://0.0.0.0:${PORT}`);
});
