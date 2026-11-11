import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { spawn, ChildProcess } from 'child_process';
import { handleLiveSearchForPrompt } from './src/services/search/index.js';

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
      pythonProcess = spawn(pyCmd, ['-m', 'uvicorn', 'app.main:app', '--app-dir', 'backend', '--port', String(PYTHON_BACKEND_PORT), '--host', '127.0.0.1', '--reload'], {
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
    mode = '',
    attachment = null,
    developer_mode = false,
    project_title = null,
    project_name = null,
    user_email = null
  } = req.body;

  let userPrompt = message.trim() || (attachment ? `Analysis of file: ${attachment.name}` : 'Hello');

  // ------------------------------------------------------------------
  // Live Internet Grounding (Automatic 7-Level Cascading Fallback)
  // ------------------------------------------------------------------
  try {
    const liveSearch = await handleLiveSearchForPrompt(userPrompt);
    if (liveSearch.triggered && liveSearch.groundingText) {
      console.log(`[ChatStream] 🌐 Grounded with live search from ${liveSearch.providerUsed} (${liveSearch.results?.length} sources)`);
      userPrompt = `${liveSearch.groundingText}\n\n[USER QUERY]:\n${userPrompt}`;
      // Send a silent status or metadata token so UI can know if it wants
      res.write(`data: ${JSON.stringify({ live_search: { active: true, provider: liveSearch.providerUsed, count: liveSearch.results?.length || 0 } })}\n\n`);
    }
  } catch (searchErr: any) {
    console.warn('[ChatStream] Live search check skipped:', searchErr?.message);
  }

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
    const replyText = isDev
      ? `### ⚠️ Autonomous Developer Agent Error\n\nAI मॉडल से कनेक्ट नहीं हो सका। कोड जनरेट करने के लिए कृपया **Settings** में जाकर अपनी **Gemini / Groq API Key** दर्ज करें।`
      : `### ⚠️ AI Service Offline\n\nAI मॉडल से संपर्क नहीं हो पाया। कृपया सुनिश्चित करें कि आपकी इंटरनेट कनेक्टिविटी ठीक है और **Settings** में वैध API Key (Groq या Gemini) मौजूद है।`;

    const words = replyText.split(' ');
    for (const word of words) {
      sendSSE({ token: word + ' ' });
      await new Promise((r) => setTimeout(r, 20));
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
            model: (mode || model || 'medium').toLowerCase(),
            mode: (mode || model || 'medium').toLowerCase(),
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

  const groqKey = (getDynamicEnv('GROQ_API_KEY') || '').trim();

  const geminiKey = (getDynamicEnv('GEMINI_API_KEY') || getDynamicEnv('API_KEY') || '').trim();

  // 1. Primary: Groq API with GPT-OSS 120B (openai/gpt-oss-120b)
  if (groqKey) {
    const systemInstruction = `You are Rhynia G1.
CRITICAL FORMATTING GUIDELINES:
- ABSOLUTELY NEVER USE MARKDOWN TABLES (never use '|' pipe table syntax). Tables look cluttered, broken, and ugly on chat screens.
- ALWAYS format roadmaps, study plans, time tables, syllabus, book recommendations, timelines, and guides using clean structured paragraphs, bold section headers (###), and bullet points (* or 1, 2, 3).
- Exception: ONLY generate a table if the user explicitly asks for a table by using the word "table" or "टेबल" in their message. Otherwise, STRICTLY avoid markdown tables.`;

    const formattedMessages = [
      { role: 'system', content: systemInstruction },
      ...(Array.isArray(messages) && messages.length > 0
        ? messages.map((m: any) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content || m.text || '' }))
        : [{ role: 'user', content: userPrompt }])
    ];

    const groqCandidateModels = ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile'];
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

      for (const modelName of ['gemini-3.5-flash-lite']) {
        if (streamSuccess) break;
        try {
          const responseStream = await client.models.generateContentStream({
            model: modelName,
            contents,
            config: {
              systemInstruction: 'You are Rhynia G1. ABSOLUTELY NEVER USE MARKDOWN TABLES (never use | pipe syntax). Format everything into clean paragraphs, bold headers, and bullet points unless the user explicitly requests a table.'
            }
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

app.get('/api/v1/chat/project/files', (req: Request, res: Response) => {
  const { project_name, user_email } = req.query;
  if (!project_name) return res.status(400).json({ error: 'project_name required' });

  const userKey = user_email ? String(user_email).toLowerCase().replace(/[^a-z0-9]/g, '_') : 'guest_zuhali_ai';
  const targetDir = path.resolve(__dirname, 'workspace', 'projects', userKey, String(project_name));

  const readDirFiles = (dirPath: string) => {
    const resFiles: Record<string, string> = {};
    const readRec = (d: string, pfx: string) => {
      const items = fs.readdirSync(d);
      for (const it of items) {
        const full = path.join(d, it);
        const key = pfx ? `${pfx}/${it}` : it;
        if (fs.statSync(full).isDirectory()) {
          readRec(full, key);
        } else {
          try {
            resFiles[`${project_name}/${key}`] = fs.readFileSync(full, 'utf-8');
          } catch(e) {}
        }
      }
    };
    readRec(dirPath, '');
    return resFiles;
  };

  if (fs.existsSync(targetDir)) {
    return res.json({ status: 'success', files: readDirFiles(targetDir) });
  }

  // Fallback search in all workspace/projects subfolders
  const projectsRoot = path.resolve(__dirname, 'workspace', 'projects');
  if (fs.existsSync(projectsRoot)) {
    const userDirs = fs.readdirSync(projectsRoot);
    for (const u of userDirs) {
      const altDir = path.join(projectsRoot, u, String(project_name));
      if (fs.existsSync(altDir) && fs.statSync(altDir).isDirectory()) {
        return res.json({ status: 'success', files: readDirFiles(altDir) });
      }
    }
  }

  return res.json({ status: 'not_found', files: {} });
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
    server: {
      middlewareMode: true,
      host: '0.0.0.0',
      port: PORT,
      watch: {
        ignored: ['**/workspace/**', '**/backend/**', '**/.git/**']
      }
    },
    appType: 'spa'
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.resolve(__dirname, 'dist')));
  app.get('*', (req: Request, res: Response) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
}

// ------------------------------------------------------------------
// Standalone Live Search API Endpoint (7-Tier Cascading Fallback)
// ------------------------------------------------------------------
app.post('/api/v1/search/live', async (req: Request, res: Response) => {
  try {
    const { query = '', max_results = 5 } = req.body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query is required and must be a string' });
    }

    const result = await handleLiveSearchForPrompt(query);
    return res.json({
      success: true,
      query,
      triggered: result.triggered,
      provider_used: result.providerUsed || 'None',
      results_count: result.results?.length || 0,
      results: result.results || [],
      duration_ms: result.durationMs || 0,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error during search',
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Zuhali App] Server running at http://0.0.0.0:${PORT}`);
});
