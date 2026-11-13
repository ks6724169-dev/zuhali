import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import crypto from 'crypto';
import { promisify } from 'util';
import v8 from 'v8';
import { monitorEventLoopDelay } from 'perf_hooks';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { spawn, ChildProcess } from 'child_process';
import { handleLiveSearchForPrompt } from './src/services/search/index.js';

const scryptAsync = promisify(crypto.scrypt);

dotenv.config();

// Dynamically read environment variable from process.env or .env file on disk
function getDynamicEnv(keyName: string): string {
  if (process.env[keyName]?.trim()) {
    return process.env[keyName]!.trim();
  }
  try {
    const envPaths = [
      path.resolve(__dirname, '.env'),
      path.resolve(__dirname, '.env.local'),
      path.resolve(__dirname, 'backend', '.env')
    ];
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
app.set('trust proxy', 1);

const RUNTIME_JWT_SECRET =
  (getDynamicEnv('SECRET_KEY') || '').trim() ||
  crypto.randomBytes(48).toString('hex');

if (!getDynamicEnv('SECRET_KEY')) {
  console.warn('[Security] SECRET_KEY not set in environment — using strong ephemeral runtime signing key.');
}

// ------------------------------------------------------------------
// Hybrid Microservices Configuration: Python AI Brain on Port 8000
// ------------------------------------------------------------------
let PYTHON_BACKEND_PORT = Number(process.env.PYTHON_BACKEND_PORT || 8000);
const getPythonBackendUrl = () => process.env.PYTHON_BACKEND_URL || `http://127.0.0.1:${PYTHON_BACKEND_PORT}`;
let pythonProcess: ChildProcess | null = null;
let pythonRestartTimestamps: number[] = [];
let isShuttingDown = false;
let pythonUnavailable = false;

async function isPortOccupiedByNonZuhali(port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(1000) });
    if (!res.ok) return false;
    const data: any = await res.json().catch(() => null);
    return data?.service !== 'Zuhali AI Backend';
  } catch {
    return false;
  }
}

let pyHealthCache: { ok: boolean; checkedAt: number } | null = null;
let pyHealthInFlight: Promise<boolean> | null = null;

async function checkPythonBackendHealth(): Promise<boolean> {
  const now = Date.now();
  if (pyHealthCache && now - pyHealthCache.checkedAt < 3000) {
    return pyHealthCache.ok;
  }
  if (pyHealthInFlight) {
    return pyHealthInFlight;
  }
  pyHealthInFlight = (async () => {
    try {
      const res = await fetch(`${getPythonBackendUrl()}/health`, { signal: AbortSignal.timeout(1500) });
      if (!res.ok) {
        pyHealthCache = { ok: false, checkedAt: Date.now() };
        return false;
      }
      const data: any = await res.json().catch(() => null);
      const ok = data?.service === 'Zuhali AI Backend';
      pyHealthCache = { ok, checkedAt: Date.now() };
      return ok;
    } catch {
      pyHealthCache = { ok: false, checkedAt: Date.now() };
      return false;
    } finally {
      pyHealthInFlight = null;
    }
  })();
  return pyHealthInFlight;
}

function ensurePythonBackendRunning() {
  const backendDir = path.resolve(__dirname, 'backend');
  if (!fs.existsSync(backendDir) || isShuttingDown || pythonUnavailable) return;

  checkPythonBackendHealth().then(async (isHealthy) => {
    if (isHealthy) {
      console.log(`[Microservice Architecture] ✅ Python AI Brain is ONLINE at ${getPythonBackendUrl()}`);
      return;
    }

    if (!process.env.PYTHON_BACKEND_URL && PYTHON_BACKEND_PORT === 8000 && (await isPortOccupiedByNonZuhali(8000))) {
      PYTHON_BACKEND_PORT = 8001;
      if (await checkPythonBackendHealth()) {
        console.log(`[Microservice Architecture] ✅ Python AI Brain is ONLINE at ${getPythonBackendUrl()}`);
        return;
      }
    }

    const now = Date.now();
    pythonRestartTimestamps = pythonRestartTimestamps.filter((ts) => now - ts < 60000);
    if (pythonRestartTimestamps.length >= 5) {
      console.error('[Microservice] Python restart limit reached (5/min). Staying in resilient Node fallback mode.');
      return;
    }
    pythonRestartTimestamps.push(now);

    console.log(`[Microservice Architecture] Spawning Python FastAPI Brain on port ${PYTHON_BACKEND_PORT}...`);
    try {
      const pyCmd = process.platform === 'win32' ? 'python' : 'python3';
      pythonProcess = spawn(pyCmd, ['-m', 'uvicorn', 'app.main:app', '--app-dir', 'backend', '--port', String(PYTHON_BACKEND_PORT), '--host', '127.0.0.1', '--reload'], {
        cwd: __dirname,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          SECRET_KEY: RUNTIME_JWT_SECRET
        }
      });

      pythonProcess.stdout?.on('data', (data) => {
        const text = data.toString().trim();
        if (text) console.log(`[Python Brain] ${text}`);
      });

      pythonProcess.stderr?.on('data', (data) => {
        const text = data.toString().trim();
        if (text.includes('No module named uvicorn') || text.includes('No module named fastapi')) {
          pythonUnavailable = true;
        }
        if (text && !text.includes('INFO:')) console.warn(`[Python Brain Log] ${text}`);
      });

      pythonProcess.on('exit', (code) => {
        console.log(`[Python Brain] Process terminated (code: ${code})`);
        pythonProcess = null;
        if (!isShuttingDown && !pythonUnavailable && code !== 0) {
          setTimeout(ensurePythonBackendRunning, 3000);
        }
      });
    } catch (e: any) {
      console.warn('[Microservice] Could not launch Python process automatically:', e.message);
    }
  });
}

// Auto-check and spawn on boot
setTimeout(ensurePythonBackendRunning, 1000);

process.on('SIGINT', () => {
  isShuttingDown = true;
  if (pythonProcess) {
    try { pythonProcess.kill(); } catch (e) {}
  }
  process.exit();
});

process.on('SIGTERM', () => {
  isShuttingDown = true;
  if (pythonProcess) {
    try { pythonProcess.kill(); } catch (e) {}
  }
  process.exit();
});

process.on('exit', () => {
  isShuttingDown = true;
  if (pythonProcess) {
    try { pythonProcess.kill(); } catch (e) {}
  }
});

// Global process crash-proofing
process.on('unhandledRejection', (reason) => {
  console.error('[CrashGuard] Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[CrashGuard] Uncaught Exception:', err);
});

// Security Headers (iFrame-compatible for AI Studio preview)
app.use(
  helmet({
    contentSecurityPolicy: false,
    frameguard: false,
    crossOriginEmbedderPolicy: false
  })
);

// Strict CORS origin validation (supports same-host, APP_URL, localhost, and multi-level *.run.app)
const allowedOrigins = new Set(
  [
    ...(process.env.ALLOWED_ORIGINS || '').split(','),
    process.env.APP_URL || ''
  ]
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean)
);

app.use(
  cors((req, callback) => {
    const origin = req.headers.origin;
    if (!origin) {
      return callback(null, { origin: true, credentials: true });
    }

    const normalizedOrigin = origin.replace(/\/+$/, '');
    let isSameHost = false;
    try {
      const originHost = new URL(normalizedOrigin).host;
      const reqHost = String(req.headers['x-forwarded-host'] || req.headers.host || '')
        .split(',')[0]
        .trim();
      if (reqHost && originHost === reqHost) {
        isSameHost = true;
      }
    } catch {}

    const isAllowed =
      isSameHost ||
      allowedOrigins.has(normalizedOrigin) ||
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(normalizedOrigin) ||
      /^https:\/\/([a-z0-9-]+\.)+run\.app$/i.test(normalizedOrigin) ||
      /^https:\/\/([a-z0-9-]+\.)+(usercontent\.goog|googleusercontent\.com)$/i.test(normalizedOrigin) ||
      /^https:\/\/zuhali\.(onrender\.com|vercel\.app)$/i.test(normalizedOrigin);

    if (isAllowed) {
      return callback(null, {
        origin: true,
        credentials: true,
        methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS']
      });
    }

    return callback(new Error('Not allowed by CORS'));
  })
);

// Event-loop & Heap Backpressure Guard (prevents OOM / process crash under massive bursts)
const eventLoopDelay = monitorEventLoopDelay({ resolution: 20 });
eventLoopDelay.enable();
let activeInFlightRequests = 0;
const MAX_CONCURRENT_REQUESTS = 3500;
let cachedOverloaded = false;

setInterval(() => {
  const heapStats = v8.getHeapStatistics();
  const heapRatio = heapStats.used_heap_size / Math.max(1, heapStats.heap_size_limit);
  const p99LagMs = eventLoopDelay.percentile(99) / 1e6;
  cachedOverloaded = heapRatio > 0.9 || p99LagMs > 2500;
}, 250).unref();

app.use((req: Request, res: Response, next: NextFunction) => {
  activeInFlightRequests++;
  let cleaned = false;
  const release = () => {
    if (!cleaned) {
      cleaned = true;
      activeInFlightRequests = Math.max(0, activeInFlightRequests - 1);
    }
  };
  res.on('finish', release);
  res.on('close', release);

  if (req.path !== '/health' && (activeInFlightRequests > MAX_CONCURRENT_REQUESTS || cachedOverloaded)) {
    res.setHeader('Retry-After', '2');
    return res.status(503).json({
      detail: 'Server is handling peak traffic. Please retry in a couple of seconds.'
    });
  }
  return next();
});

// Route-scoped JSON body size limits (10MB only for multimodal chat, 256KB for all other routes)
app.use('/api/v1/chat/stream', express.json({ limit: '10mb' }));
app.use(express.json({ limit: '256kb' }));

// Rate limiters
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 240,
  standardHeaders: true,
  legacyHeaders: false,
  message: { detail: 'Too many requests. Please slow down and try again.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { detail: 'Too many authentication attempts. Please wait 15 minutes.' }
});

const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { detail: 'Too many OTP verification attempts. Please request a new OTP later.' }
});

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { detail: 'Chat rate limit exceeded. Please wait a moment.' }
});

app.use('/api', apiLimiter);

// In-memory data stores for fallback dev runtime
interface User {
  id: string;
  name: string;
  email: string;
  canonicalEmail: string;
  passwordHash: string;
  verified: boolean;
}

interface OtpRecord {
  otp: string;
  expiresAt: number;
  attempts: number;
}

const usersMap = new Map<string, User>();
const otpsMap = new Map<string, OtpRecord>();
const feedbackStore: any[] = [];

const MAX_USERS_CACHE = 10000;
const MAX_OTPS_CACHE = 10000;
const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

function setBoundedMap<K, V>(map: Map<K, V>, key: K, value: V, maxSize: number) {
  if (!map.has(key) && map.size >= maxSize) {
    const oldestKey = map.keys().next().value;
    if (oldestKey !== undefined) {
      map.delete(oldestKey);
    }
  }
  map.set(key, value);
}

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of otpsMap.entries()) {
    if (now > v.expiresAt) {
      otpsMap.delete(k);
    }
  }
  if (eventLoopDelay.max > 0) {
    eventLoopDelay.reset();
  }
}, 60 * 1000).unref();

async function hashPasswordScrypt(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}$${derived.toString('hex')}`;
}

async function verifyPasswordScrypt(password: string, storedHash: string): Promise<boolean> {
  try {
    const [salt, keyHex] = storedHash.split('$');
    if (!salt || !keyHex) return false;
    const derived = (await scryptAsync(password, salt, 64)) as Buffer;
    const keyBuf = Buffer.from(keyHex, 'hex');
    if (derived.length !== keyBuf.length) return false;
    return crypto.timingSafeEqual(derived, keyBuf);
  } catch {
    return false;
  }
}

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf-8') : input;
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): Buffer {
  const pad = '='.repeat((4 - (str.length % 4)) % 4);
  const b64 = (str + pad).replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(b64, 'base64');
}

function signJwt(subject: string, ttlSeconds = 7 * 24 * 3600): string {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64UrlEncode(JSON.stringify({ sub: subject, iat: now, exp: now + ttlSeconds }));
  const signingInput = `${header}.${payload}`;
  const sig = crypto.createHmac('sha256', RUNTIME_JWT_SECRET).update(signingInput).digest();
  return `${signingInput}.${base64UrlEncode(sig)}`;
}

function verifyJwt(token: string): { sub: string; exp?: number } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [encHeader, encPayload, encSig] = parts;
    const signingInput = `${encHeader}.${encPayload}`;
    const expectedSig = crypto.createHmac('sha256', RUNTIME_JWT_SECRET).update(signingInput).digest();
    const providedSig = base64UrlDecode(encSig);
    if (expectedSig.length !== providedSig.length) return null;
    if (!crypto.timingSafeEqual(expectedSig, providedSig)) return null;
    const payload = JSON.parse(base64UrlDecode(encPayload).toString('utf-8'));
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return null;
    if (!payload.sub) return null;
    return payload;
  } catch {
    return null;
  }
}

function extractAuthContext(req: Request): { authenticated: boolean; guest: boolean; email: string | null; invalidToken: boolean } {
  const authHeader = req.headers.authorization || '';
  if (!authHeader) {
    return { authenticated: false, guest: true, email: null, invalidToken: false };
  }
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return { authenticated: false, guest: false, email: null, invalidToken: true };
  }
  const token = match[1].trim();
  if (token === 'guest_test_token') {
    return { authenticated: false, guest: true, email: null, invalidToken: false };
  }
  const verified = verifyJwt(token);
  if (!verified) {
    return { authenticated: false, guest: false, email: null, invalidToken: true };
  }
  return { authenticated: true, guest: false, email: String(verified.sub), invalidToken: false };
}

function sanitizeProjectName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 80) return null;
  if (trimmed.includes('..') || trimmed.includes('/') || trimmed.includes('\\') || trimmed.includes('\0')) {
    return null;
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

function resolveSafeProjectPath(userKey: string, projectName: string): string | null {
  const safeUserKey = userKey.replace(/[^a-z0-9_]/gi, '_') || 'guest_zuhali_ai';
  const safeProj = sanitizeProjectName(projectName);
  if (!safeProj) return null;
  const baseRoot = path.resolve(__dirname, 'workspace', 'projects', safeUserKey);
  const resolved = path.resolve(baseRoot, safeProj);
  if (!resolved.startsWith(baseRoot + path.sep)) {
    return null;
  }
  return resolved;
}

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
  return crypto.randomInt(100000, 1000000).toString();
}

function storeOtpRecord(keys: string[], otp: string) {
  const record: OtpRecord = {
    otp,
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0
  };
  for (const k of keys) {
    setBoundedMap(otpsMap, k, { ...record }, MAX_OTPS_CACHE);
  }
}

function verifyOtpRecord(keys: string[], enteredOtp: string): { ok: boolean; reason?: string } {
  const targetKey = keys.find((k) => otpsMap.has(k));
  if (!targetKey) return { ok: false, reason: 'OTP not found or expired. Please request a new code.' };
  const record = otpsMap.get(targetKey)!;
  if (Date.now() > record.expiresAt) {
    keys.forEach((k) => otpsMap.delete(k));
    return { ok: false, reason: 'OTP has expired. Please request a new code.' };
  }
  if (record.attempts >= MAX_OTP_ATTEMPTS) {
    keys.forEach((k) => otpsMap.delete(k));
    return { ok: false, reason: 'Too many failed OTP attempts. Please request a new code.' };
  }
  const providedBuf = Buffer.from(enteredOtp.trim(), 'utf-8');
  const storedBuf = Buffer.from(record.otp, 'utf-8');
  if (providedBuf.length === storedBuf.length && crypto.timingSafeEqual(providedBuf, storedBuf)) {
    keys.forEach((k) => otpsMap.delete(k));
    return { ok: true };
  }
  record.attempts += 1;
  return { ok: false, reason: `Invalid OTP code. ${Math.max(0, MAX_OTP_ATTEMPTS - record.attempts)} attempt(s) remaining.` };
}

async function proxyAuthToPython(endpoint: string, body: unknown, res: Response): Promise<boolean> {
  const isPyAlive = await checkPythonBackendHealth();
  if (!isPyAlive) return false;
  try {
    const pyRes = await fetch(`${getPythonBackendUrl()}/api/v1/auth${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000)
    });
    const data = await pyRes.json().catch(() => ({ detail: 'Authentication service error' }));
    res.status(pyRes.status).json(data);
    return true;
  } catch {
    return false;
  }
}

const sendOtpSchema = z.object({
  recipient: z.string().trim().min(3).max(254),
  channel: z.enum(['email', 'sms']).optional().default('email'),
  purpose: z.string().trim().max(64).optional().default('verification')
});

const signupSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128)
});

const verifyOtpSchema = z.object({
  recipient: z.string().trim().min(3).max(254),
  otp: z.string().trim().regex(/^\d{6}$/, 'OTP must be 6 digits')
});

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128)
});

const forgotSchema = z.object({
  email: z.string().trim().email().max(254)
});

const resetSchema = z.object({
  email: z.string().trim().email().max(254),
  otp: z.string().trim().regex(/^\d{6}$/, 'OTP must be 6 digits'),
  new_password: z.string().min(8).max(128)
});

// ------------------------------------------------------------------
// Auth Routes (Python FastAPI Primary + Hardened Node Fallback)
// ------------------------------------------------------------------

app.post('/api/v1/auth/send-otp', authLimiter, async (req: Request, res: Response) => {
  const parsed = sendOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ detail: parsed.error.issues[0]?.message || 'Invalid request' });
  }
  if (await proxyAuthToPython('/send-otp', parsed.data, res)) return;

  const { recipient, channel, purpose } = parsed.data;
  const { display, canonical } = normalizeEmail(recipient);
  const otp = generateOtp();
  storeOtpRecord([canonical, display], otp);
  console.log(`[OTP Dispatched] Channel=${channel} Purpose=${purpose} Target=${display}`);

  return res.json({
    status: 'success',
    message: `Verification code sent via ${channel.toUpperCase()} to ${recipient}.`,
    recipient
  });
});

app.post('/api/v1/auth/signup', authLimiter, async (req: Request, res: Response) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ detail: parsed.error.issues[0]?.message || 'Invalid signup data' });
  }
  if (await proxyAuthToPython('/signup', parsed.data, res)) return;

  const { name, email, password } = parsed.data;
  const { display, canonical } = normalizeEmail(email);

  const existing = usersMap.get(canonical);
  if (existing && existing.verified) {
    return res.status(409).json({
      detail: `This email (${display}) is already registered! Please log in directly or reset your password.`
    });
  }

  const user: User = {
    id: 'usr_' + crypto.randomUUID(),
    name: name || display.split('@')[0],
    email: display,
    canonicalEmail: canonical,
    passwordHash: await hashPasswordScrypt(password),
    verified: false
  };

  setBoundedMap(usersMap, canonical, user, MAX_USERS_CACHE);

  const otp = generateOtp();
  storeOtpRecord([canonical, display], otp);
  console.log(`[Signup OTP Generated] For ${display}`);

  return res.json({
    status: 'success',
    message: `Verification code sent to ${display}. Please enter the 6-digit OTP.`,
    email: display,
    canonical_email: canonical,
    requires_otp: true
  });
});

app.post('/api/v1/auth/verify-otp', otpVerifyLimiter, async (req: Request, res: Response) => {
  const parsed = verifyOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ detail: parsed.error.issues[0]?.message || 'Invalid OTP payload' });
  }
  if (await proxyAuthToPython('/verify-otp', parsed.data, res)) return;

  const { recipient, otp } = parsed.data;
  const { display, canonical } = normalizeEmail(recipient);
  const check = verifyOtpRecord([canonical, display], otp);

  if (!check.ok) {
    return res.status(400).json({ detail: check.reason });
  }

  let user = usersMap.get(canonical);
  if (!user) {
    user = {
      id: 'usr_' + crypto.randomUUID(),
      name: display.split('@')[0],
      email: display,
      canonicalEmail: canonical,
      passwordHash: '',
      verified: true
    };
    setBoundedMap(usersMap, canonical, user, MAX_USERS_CACHE);
  } else {
    user.verified = true;
  }

  const token = signJwt(canonical);

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

app.post('/api/v1/auth/login', authLimiter, async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ detail: parsed.error.issues[0]?.message || 'Invalid credentials format' });
  }
  if (await proxyAuthToPython('/login', parsed.data, res)) return;

  const { email, password } = parsed.data;
  const { display, canonical } = normalizeEmail(email);
  const user = usersMap.get(canonical);

  if (!user || !user.passwordHash || !(await verifyPasswordScrypt(password, user.passwordHash))) {
    return res.status(401).json({ detail: 'Invalid email or password.' });
  }

  if (!user.verified) {
    const otp = generateOtp();
    storeOtpRecord([canonical, display], otp);
    console.log(`[Unverified Login OTP] For ${display}`);

    return res.status(403).json({
      detail: `Your account is not verified yet! A verification code has been sent to ${display}.`
    });
  }

  const token = signJwt(canonical);

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

app.post('/api/v1/auth/forgot-password', authLimiter, async (req: Request, res: Response) => {
  const parsed = forgotSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ detail: parsed.error.issues[0]?.message || 'Valid email is required' });
  }
  if (await proxyAuthToPython('/forgot-password', parsed.data, res)) return;

  const { display, canonical } = normalizeEmail(parsed.data.email);
  const user = usersMap.get(canonical);

  if (user) {
    const otp = generateOtp();
    storeOtpRecord([canonical, display], otp);
    console.log(`[Password Reset OTP] For ${display}`);
  }

  return res.json({
    status: 'success',
    message: `If an account exists for ${display}, a password reset code has been sent.`,
    email: display
  });
});

app.post('/api/v1/auth/reset-password', otpVerifyLimiter, async (req: Request, res: Response) => {
  const parsed = resetSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ detail: parsed.error.issues[0]?.message || 'Invalid reset payload' });
  }
  if (await proxyAuthToPython('/reset-password', parsed.data, res)) return;

  const { email, otp, new_password } = parsed.data;
  const { display, canonical } = normalizeEmail(email);
  const check = verifyOtpRecord([canonical, display], otp);

  if (!check.ok) {
    return res.status(400).json({ detail: check.reason });
  }

  const user = usersMap.get(canonical);
  if (user) {
    user.passwordHash = await hashPasswordScrypt(new_password);
    user.verified = true;
  }

  return res.json({
    status: 'success',
    message: 'Password reset successfully! You can now log in with your new password.'
  });
});

const chatStreamSchema = z.object({
  message: z.string().max(32000).optional().default(''),
  messages: z.array(z.any()).max(40).optional().default([]),
  model: z.string().max(120).optional().default(''),
  mode: z.string().max(120).optional().default(''),
  attachment: z.any().nullable().optional().default(null),
  attachments: z.array(z.any()).max(10).nullable().optional().default(null),
  developer_mode: z.boolean().optional().default(false),
  project_title: z.string().max(120).nullable().optional().default(null),
  project_name: z.string().max(120).nullable().optional().default(null),
  user_email: z.string().max(254).nullable().optional().default(null)
});

// ------------------------------------------------------------------
// Chat & Developer Streaming Routes
// ------------------------------------------------------------------
app.post('/api/v1/chat/stream', chatLimiter, async (req: Request, res: Response) => {
  const auth = extractAuthContext(req);
  if (auth.invalidToken) {
    return res.status(401).json({ detail: 'Invalid or expired authentication token.' });
  }

  const parsed = chatStreamSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ detail: parsed.error.issues[0]?.message || 'Invalid chat request payload.' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const streamAbortController = new AbortController();
  let clientClosed = false;
  req.on('close', () => {
    clientClosed = true;
    streamAbortController.abort();
  });
  req.on('error', () => {
    clientClosed = true;
    streamAbortController.abort();
  });
  res.on('error', () => {
    clientClosed = true;
    streamAbortController.abort();
  });

  const {
    message,
    messages,
    model,
    mode,
    attachment,
    attachments,
    developer_mode,
    project_title,
    project_name,
    user_email
  } = parsed.data;

  const effectiveUserEmail = auth.authenticated ? auth.email : user_email;

  const attachmentList = Array.isArray(attachments) && attachments.length > 0
    ? attachments
    : (attachment ? [attachment] : []);
  let userPrompt = message.trim() || (attachmentList.length > 0 ? `Analysis of file: ${attachmentList[0]?.name || 'file'}` : 'Hello');

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

  // Helper send SSE event safely
  const sendSSE = (obj: any) => {
    if (clientClosed || res.writableEnded) return;
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
        const pyRes = await fetch(`${getPythonBackendUrl()}/api/v1/chat/stream`, {
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
            user_email: effectiveUserEmail || '',
            attachment: attachmentList[0] || null,
            attachments: attachmentList
          }),
          signal: AbortSignal.any([AbortSignal.timeout(180000), streamAbortController.signal])
        });

        if (pyRes.ok && pyRes.body) {
          const reader = pyRes.body.getReader();
          const decoder = new TextDecoder('utf-8');
          let pyStreamedAny = false;

          while (!clientClosed) {
            const { done, value } = await reader.read();
            if (done || clientClosed) break;
            const chunk = decoder.decode(value, { stream: true });
            if (chunk && !res.writableEnded) {
              res.write(chunk);
              pyStreamedAny = true;
            }
          }

          if (pyStreamedAny || clientClosed) {
            if (!res.writableEnded) res.end();
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
      const safeProjectTitle = String(project_title || 'Zuhali Dev Project').replace(/[<>&"'`{}]/g, '');
      const sampleFiles: Record<string, string> = {
        'src/App.jsx': `import React, { useState } from 'react';\n\nexport default function App() {\n  const [count, setCount] = useState(0);\n  return (\n    <div style={{ padding: '24px', fontFamily: 'sans-serif' }}>\n      <h1>${safeProjectTitle}</h1>\n      <p>Interactive prototype generated by Zuhali Autonomous Developer Agent.</p>\n      <button onClick={() => setCount(c => c + 1)} style={{ padding: '8px 16px', borderRadius: '8px', background: '#16a34a', color: '#fff', border: 0 }}>\n        Clicks: {count}\n      </button>\n    </div>\n  );\n}`,
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
    const systemInstruction = `You are Rhynia G1, a thoughtful AI workspace assistant created by Zuhali.

FORMATTING & TABLE GUIDELINES:
- WHEN THE USER ASKS FOR A TABLE, TABULAR DATA, OR LIST (e.g. using "table", "टेबल", "सूची", "list", "grocery list", etc.), ALWAYS generate a clean standard Markdown Table using proper '|' pipe table syntax (e.g. | क्र.सं. | सामान | मात्रा |\n|---|---|---|).
- NEVER generate ASCII text art tables with '+----+----+' borders or raw code blocks for tables; ALWAYS use clean Markdown tables.
- CRITICAL FOR TABLES: Use short, concise words and compact abbreviations so tables fit neatly on mobile screens.

INTERACTIVE QUIZ & FLASHCARD GUIDELINES:
- WHEN THE USER ASKS FOR A QUIZ, MOCK TEST, MCQ, FLASH CARD, OR PRACTICE QUESTIONS (e.g., "quiz", "mock test", "MCQ", "flashcard", "सवाल", "प्रश्न", "test", etc.), ALWAYS format them using a \`\`\`quiz block so the app renders interactive clickable cards:
\`\`\`quiz
title: Quiz Title
subtitle: 5 प्रश्न | Level

Q1: Question text here?
category: Category Name
A) Option A
B) Option B [correct]
C) Option C
D) Option D
explanation: Explanation for the correct answer.
\`\`\`

3D OBJECTS & SHAPES GUIDELINES (DIRECT THREE.JS ONLY - NO HTML):
- WHEN THE USER ASKS FOR ANY 3D IMAGE, 3D MODEL, 3D OBJECT, 3RD IMAGE, OR 360° ROTATING VIEW (e.g. "3D image", "3rd image", "3D DNA", "3D cylinder", "3D cube", "3D sphere", "3D car", "3D solar system", "3D molecule", "3D house", "3D robot", etc.):
  - NEVER generate HTML (\`<!DOCTYPE html>\`, \`<html>\`, \`<head>\`, \`<body>\`, \`<script>\` tags) and NEVER tell the user to copy-paste code into an \`.html\` file! Our app executes Three.js JavaScript code directly and renders the live 3D WebGL model automatically in the chat.
  - ALWAYS write direct Three.js JavaScript code ONLY inside a \`\`\`threejs code block using \`THREE\` and \`OrbitControls\` directly in scope.

LIBRECHAT & CLAUDE ARTIFACTS GUIDELINES:
- When the user asks to build an interactive web app, calculator, game, dashboard, SVG vector, or when ARTIFACT REQUEST is present, ALWAYS wrap the full self-contained code inside an artifact block:
:::artifact{identifier="my-app" type="text/html" title="Interactive App Title"}
\`\`\`\`
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>App</title><style>/* CSS */</style></head>
<body>
<!-- Complete self-contained HTML/JS app -->
<script>// JS logic</script>
</body>
</html>
\`\`\`\`
:::
- Supported artifact types: 'text/html' (interactive HTML5/CSS3/JS app), 'application/vnd.react' (React JSX component), 'image/svg+xml' (scalable vector graphic), 'application/vnd.mermaid' (diagrams).
- Use bold section headers (###), bullet points, and clean structured markdown for text responses.`;

    const formattedMessages = [
      { role: 'system', content: systemInstruction },
      ...(Array.isArray(messages) && messages.length > 0
        ? messages.map((m: any) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content || m.text || '' }))
        : [{ role: 'user', content: userPrompt }])
    ];

    const groqCandidateModels = ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile'];
    let lastGroqError = '';

    for (const modelId of groqCandidateModels) {
      if (streamSuccess || clientClosed) break;
      try {
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          signal: AbortSignal.any([AbortSignal.timeout(90000), streamAbortController.signal]),
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

      for (const att of attachmentList.slice(0, 10)) {
        if (att?.dataUrl && att.dataUrl.startsWith('data:image')) {
          const [header, base64Data] = att.dataUrl.split(';base64,');
          const mimeType = header.replace('data:', '');
          if (contents.length > 0 && base64Data) {
            const lastItem = contents[contents.length - 1];
            lastItem.parts.push({
              inlineData: { mimeType, data: base64Data }
            });
          }
        }
      }

      for (const modelName of ['gemini-3.5-flash-lite']) {
        if (streamSuccess) break;
        try {
          const responseStream = await client.models.generateContentStream({
            model: modelName,
            contents,
            config: {
              systemInstruction: `You are Rhynia G1, a thoughtful AI workspace assistant created by Zuhali.
FORMATTING & TABLE GUIDELINES:
- WHEN THE USER ASKS FOR A TABLE, TABULAR DATA, OR LIST (e.g. using "table", "टेबल", "सूची", "list", "grocery list", etc.), ALWAYS generate a clean standard Markdown Table using proper '|' pipe table syntax. Keep column names and cell entries short and concise for mobile screens.
- NEVER generate ASCII text art tables with '+----+----+' borders.
INTERACTIVE QUIZ & FLASHCARD GUIDELINES:
- WHEN THE USER ASKS FOR A QUIZ, MOCK TEST, MCQ, FLASH CARD, OR PRACTICE QUESTIONS, ALWAYS format them using a \`\`\`quiz block (title, subtitle, Q1:, category:, A), B) [correct], C), D), explanation:) so the app renders interactive clickable cards.
3D OBJECTS & SHAPES GUIDELINES (DIRECT THREE.JS ONLY - NO HTML):
- WHEN THE USER ASKS FOR ANY 3D IMAGE, 3D MODEL, OR 3D OBJECT, NEVER generate HTML tags. ALWAYS write direct Three.js JavaScript code ONLY inside a \`\`\`threejs code block using THREE and OrbitControls directly in scope.`
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
const feedbackSchema = z.object({
  message_id: z.union([z.string(), z.number()]).transform(String),
  feedback_type: z.enum(['like', 'dislike']),
  reason: z.string().max(300).nullable().optional(),
  comment: z.string().max(2000).nullable().optional(),
  prompt: z.string().max(4000).nullable().optional(),
  message_text: z.string().max(8000).nullable().optional(),
  user_email: z.string().max(254).nullable().optional()
});

app.post('/api/v1/chat/feedback', (req: Request, res: Response) => {
  const auth = extractAuthContext(req);
  if (auth.invalidToken) {
    return res.status(401).json({ detail: 'Invalid or expired authentication token.' });
  }
  const parsed = feedbackSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ detail: 'Invalid feedback payload.' });
  }
  const feedback = {
    id: 'fb_' + crypto.randomUUID(),
    ...parsed.data,
    user_email: auth.authenticated ? auth.email : (parsed.data.user_email || null),
    createdAt: new Date().toISOString()
  };
  feedbackStore.push(feedback);
  if (feedbackStore.length > 500) feedbackStore.shift();
  return res.json({
    status: 'success',
    feedback_id: feedback.id,
    message: `Feedback recorded successfully.`
  });
});

app.get('/api/v1/chat/feedback', (req: Request, res: Response) => {
  const auth = extractAuthContext(req);
  if (!auth.authenticated) {
    return res.status(401).json({ detail: 'Authentication required to audit feedback.' });
  }
  const userFeedbacks = feedbackStore.filter((f) => f.user_email === auth.email);
  return res.json({
    status: 'success',
    count: userFeedbacks.length,
    feedbacks: userFeedbacks
  });
});

app.get('/api/v1/chat/project/files', async (req: Request, res: Response) => {
  const auth = extractAuthContext(req);
  if (auth.invalidToken) {
    return res.status(401).json({ detail: 'Invalid or expired authentication token.' });
  }

  const project_name = sanitizeProjectName(req.query.project_name);
  if (!project_name) {
    return res.status(400).json({ error: 'Valid project_name required' });
  }

  const guestHeader = typeof req.headers['x-guest-session-id'] === 'string'
    ? req.headers['x-guest-session-id'].trim()
    : (typeof req.query.guest_session_id === 'string' ? req.query.guest_session_id.trim() : '');
  const safeGuestId = /^[a-zA-Z0-9_-]{8,64}$/.test(guestHeader) ? `guest_${guestHeader.toLowerCase()}` : 'guest_developer';

  const userKey = auth.authenticated && auth.email
    ? auth.email.toLowerCase().replace(/[^a-z0-9]/g, '_')
    : safeGuestId;

  const targetDir = resolveSafeProjectPath(userKey, project_name);
  if (!targetDir) {
    return res.status(400).json({ error: 'Invalid project path' });
  }

  const readDirFiles = async (dirPath: string) => {
    const resFiles: Record<string, string> = {};
    let totalBytes = 0;
    let fileCount = 0;
    const MAX_TOTAL_BYTES = 2 * 1024 * 1024;
    const MAX_FILES = 200;

    const readRec = async (d: string, pfx: string, depth = 0) => {
      if (depth > 10 || fileCount >= MAX_FILES || totalBytes >= MAX_TOTAL_BYTES) return;
      const items = await fs.promises.readdir(d);
      for (const it of items) {
        if (fileCount >= MAX_FILES || totalBytes >= MAX_TOTAL_BYTES) break;
        if (it === 'node_modules' || it === '.git' || it === '.env') continue;
        const full = path.join(d, it);
        const st = await fs.promises.lstat(full);
        if (st.isSymbolicLink()) continue;
        const key = pfx ? `${pfx}/${it}` : it;
        if (st.isDirectory()) {
          await readRec(full, key, depth + 1);
        } else if (st.isFile() && st.size <= 512 * 1024 && totalBytes + st.size <= MAX_TOTAL_BYTES) {
          try {
            resFiles[`${project_name}/${key}`] = await fs.promises.readFile(full, 'utf-8');
            totalBytes += st.size;
            fileCount++;
          } catch (e) {}
        }
      }
    };
    await readRec(dirPath, '', 0);
    return resFiles;
  };

  try {
    const stat = await fs.promises.stat(targetDir).catch(() => null);
    if (stat && stat.isDirectory()) {
      return res.json({ status: 'success', files: await readDirFiles(targetDir) });
    }
  } catch (e) {}

  return res.json({ status: 'not_found', files: {} });
});

app.delete('/api/v1/chat/project', async (req: Request, res: Response) => {
  const auth = extractAuthContext(req);
  if (auth.invalidToken) {
    return res.status(401).json({ detail: 'Invalid or expired authentication token.' });
  }

  const project_name = sanitizeProjectName(req.query.project_name);
  if (!project_name) {
    return res.status(400).json({ detail: 'Valid project_name is required.' });
  }

  const guestHeader = typeof req.headers['x-guest-session-id'] === 'string'
    ? req.headers['x-guest-session-id'].trim()
    : (typeof req.query.guest_session_id === 'string' ? req.query.guest_session_id.trim() : '');
  const safeGuestId = /^[a-zA-Z0-9_-]{8,64}$/.test(guestHeader) ? `guest_${guestHeader.toLowerCase()}` : 'guest_developer';

  const effectiveEmail = auth.authenticated ? auth.email! : safeGuestId;
  const isPyUp = await checkPythonBackendHealth();
  if (isPyUp) {
    try {
      const q = new URLSearchParams({
        project_name,
        user_email: effectiveEmail
      });
      const headers: Record<string, string> = {};
      if (req.headers.authorization) headers['Authorization'] = req.headers.authorization;
      if (guestHeader) headers['X-Guest-Session-ID'] = guestHeader;

      const pyRes = await fetch(`${getPythonBackendUrl()}/api/v1/chat/project?${q.toString()}`, {
        method: 'DELETE',
        headers,
        signal: AbortSignal.timeout(10000)
      });
      if (pyRes.ok) {
        const data = await pyRes.json();
        return res.json(data);
      }
    } catch (e) {}
  }

  const userKey = auth.authenticated && auth.email
    ? auth.email.toLowerCase().replace(/[^a-z0-9]/g, '_')
    : safeGuestId;

  const safePath = resolveSafeProjectPath(userKey, project_name);
  if (safePath) {
    await fs.promises.rm(safePath, { recursive: true, force: true }).catch(() => {});
  }
  return res.json({ status: 'success', message: `Project '${project_name}' deleted` });
});

app.patch('/api/v1/chat/project/rename', async (req: Request, res: Response) => {
  const auth = extractAuthContext(req);
  if (auth.invalidToken) {
    return res.status(401).json({ detail: 'Invalid or expired authentication token.' });
  }

  const old_name = sanitizeProjectName(req.body?.old_name ?? req.query.old_name);
  const new_name = sanitizeProjectName(req.body?.new_name ?? req.query.new_name);
  if (!old_name || !new_name) {
    return res.status(400).json({ detail: 'Valid old_name and new_name are required.' });
  }

  const guestHeader = typeof req.headers['x-guest-session-id'] === 'string'
    ? req.headers['x-guest-session-id'].trim()
    : (typeof req.query.guest_session_id === 'string' ? req.query.guest_session_id.trim() : '');
  const safeGuestId = /^[a-zA-Z0-9_-]{8,64}$/.test(guestHeader) ? `guest_${guestHeader.toLowerCase()}` : 'guest_developer';

  const effectiveEmail = auth.authenticated ? auth.email! : safeGuestId;
  const isPyUp = await checkPythonBackendHealth();
  if (isPyUp) {
    try {
      const q = new URLSearchParams({
        old_name,
        new_name,
        user_email: effectiveEmail
      });
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (req.headers.authorization) headers['Authorization'] = req.headers.authorization;
      if (guestHeader) headers['X-Guest-Session-ID'] = guestHeader;

      const pyRes = await fetch(`${getPythonBackendUrl()}/api/v1/chat/project/rename?${q.toString()}`, {
        method: 'PATCH',
        headers,
        signal: AbortSignal.timeout(10000)
      });
      if (pyRes.ok) {
        const data = await pyRes.json();
        return res.json(data);
      }
    } catch (e) {}
  }

  const userKey = auth.authenticated && auth.email
    ? auth.email.toLowerCase().replace(/[^a-z0-9]/g, '_')
    : safeGuestId;

  const oldPath = resolveSafeProjectPath(userKey, old_name);
  const newPath = resolveSafeProjectPath(userKey, new_name);
  if (oldPath && newPath) {
    await fs.promises.rename(oldPath, newPath).catch(() => {});
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
// Standalone Live Search API Endpoint (7-Tier Cascading Fallback)
// ------------------------------------------------------------------
const liveSearchSchema = z.object({
  query: z.string().trim().min(1).max(500)
});

app.post('/api/v1/search/live', chatLimiter, async (req: Request, res: Response) => {
  const auth = extractAuthContext(req);
  if (auth.invalidToken) {
    return res.status(401).json({ detail: 'Invalid or expired authentication token.' });
  }
  try {
    const parsed = liveSearchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Valid query string is required' });
    }

    const result = await handleLiveSearchForPrompt(parsed.data.query);
    return res.json({
      success: true,
      query: parsed.data.query,
      triggered: result.triggered,
      provider_used: result.providerUsed || 'None',
      results_count: result.results?.length || 0,
      results: result.results || [],
      duration_ms: result.durationMs || 0
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: 'Internal server error during search'
    });
  }
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
  app.use(express.static(path.resolve(__dirname, 'dist'), { maxAge: '1d', etag: true }));
  app.get('*', (req: Request, res: Response) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
}

// Express Global Error Handler (never leak stack traces or crash server)
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  console.error('[Express Error Handler]:', err?.message || err);
  if (res.headersSent) return;
  if (err?.message === 'Not allowed by CORS') {
    return res.status(403).json({ detail: 'Origin not allowed' });
  }
  return res.status(err?.status || 500).json({ detail: 'Internal server error' });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Zuhali App] Server running at http://0.0.0.0:${PORT}`);
});

server.keepAliveTimeout = 15000;
server.headersTimeout = 16000;
server.requestTimeout = 190000;
server.maxRequestsPerSocket = 0;
server.on('clientError', (_err, socket) => {
  if (socket.writable) {
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
  }
});
