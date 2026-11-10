import React, { useState } from 'react';
import {
  Mail, LockKeyhole, Eye, EyeOff, UserRound, ArrowLeft, CheckCircle2, ArrowRight
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function AuthScreen() {
  const {
    authView,
    setAuthView,
    pendingEmail,
    setPendingEmail,
    authNotice,
    setAuthNotice,
    authLoading,
    login,
    signup,
    sendOtp,
    verifyOtp,
    resetPassword,
    user,
    updateProfile,
    quickTestLogin
  } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setAuthNotice('Please enter both email and password.');
      return;
    }
    await login(email, password);
  };

  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setAuthNotice('Passwords do not match. Please check and try again.');
      return;
    }
    if (password.length < 8) {
      setAuthNotice('Password must be at least 8 characters.');
      return;
    }
    await signup(name, email, password);
  };

  const handleVerifySubmit = async (e) => {
    e.preventDefault();
    if (!verifyCode || verifyCode.length !== 6) {
      setAuthNotice('Please enter the 6-digit code received in your email.');
      return;
    }
    await verifyOtp(verifyCode);
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      setAuthNotice('Please enter your email.');
      return;
    }
    await resetPassword(email);
  };

  const handleProfileSubmit = (e) => {
    e.preventDefault();
    updateProfile({ name: name || 'Explorer', email: email || 'user@zuhali.ai' });
    setAuthView('app');
  };

  return (
    <section className="auth-screen">
      <div className="auth-layout">
        {/* Left Branding Panel */}
        <aside className="auth-brand-panel">
          <div className="auth-brand-art">
            <span className="auth-brand-leaf"><i /><i /></span>
            <div className="auth-brand-name">Zuhali</div>
            <div className="auth-brand-subtitle">INTELLIGENCE</div>
          </div>
          <p>One account. A smarter way to create, learn and build with AI.</p>
          <div className="auth-brand-footer">
            <span /> Built for curious minds <span />
          </div>
        </aside>

        {/* Right Form Panel */}
        <div className="auth-form-panel">
          {/* LOGIN VIEW */}
          {authView === 'login' && (
            <form className="auth-card" onSubmit={handleLoginSubmit}>
              <div className="auth-eyebrow">WELCOME BACK</div>
              <h1>Log in to Zuhali</h1>
              <p className="auth-description">Continue where your ideas left off.</p>

              <label className="auth-field-label" htmlFor="login-email">Email address</label>
              <div className="auth-input-wrap">
                <Mail size={18} />
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>

              <div className="auth-label-row">
                <label className="auth-field-label" htmlFor="login-password">Password</label>
                <button
                  type="button"
                  className="auth-text-button"
                  onClick={() => { setAuthNotice(''); setAuthView('forgot'); }}
                >
                  Forgot password?
                </button>
              </div>
              <div className="auth-input-wrap">
                <LockKeyhole size={18} />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  className="auth-eye"
                  aria-label="Toggle password visibility"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>

              <label className="auth-check">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Keep me logged in</span>
              </label>

              <button className="auth-primary" type="submit" disabled={authLoading}>
                {authLoading ? 'Signing in...' : 'Log In'} <ArrowRight size={16} style={{ display: 'inline', verticalAlign: 'middle', marginLeft: 4 }} />
              </button>

              <button
                className="auth-quick-test"
                type="button"
                onClick={quickTestLogin}
                style={{
                  width: '100%',
                  marginTop: '12px',
                  padding: '12px 16px',
                  border: '1px dashed #16a34a',
                  borderRadius: '10px',
                  background: 'rgba(22, 163, 74, 0.08)',
                  color: '#15803d',
                  fontWeight: '600',
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.15s ease'
                }}
              >
                ⚡ Quick Test Mode — Direct Chat में जाएं <ArrowRight size={16} />
              </button>

              <div className="auth-or"><span />or continue with<span /></div>
              <button
                className="auth-google"
                type="button"
                onClick={() => setAuthNotice('Google OAuth requires production setup. Please log in with your email.')}
              >
                <b>G</b> Continue with Google
              </button>

              <p className="auth-switch">
                New to Zuhali?{' '}
                <button
                  type="button"
                  onClick={() => { setAuthNotice(''); setAuthView('signup'); }}
                >
                  Create an account
                </button>
              </p>

              {authNotice && <div className="auth-notice" role="status">{authNotice}</div>}
            </form>
          )}

          {/* SIGNUP VIEW */}
          {authView === 'signup' && (
            <form className="auth-card" onSubmit={handleSignupSubmit}>
              <div className="auth-eyebrow">GET STARTED</div>
              <h1>Create your account</h1>
              <p className="auth-description">A verification code will be sent to your email to activate your account.</p>

              <label className="auth-field-label" htmlFor="signup-name">Full name</label>
              <div className="auth-input-wrap">
                <UserRound size={18} />
                <input
                  id="signup-name"
                  autoComplete="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                />
              </div>

              <label className="auth-field-label" htmlFor="signup-email">Email address</label>
              <div className="auth-input-wrap">
                <Mail size={18} />
                <input
                  id="signup-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>

              <label className="auth-field-label" htmlFor="signup-password">Password</label>
              <div className="auth-input-wrap">
                <LockKeyhole size={18} />
                <input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                />
                <button
                  type="button"
                  className="auth-eye"
                  aria-label="Toggle password visibility"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>

              <label className="auth-field-label" htmlFor="signup-confirm">Confirm password</label>
              <div className="auth-input-wrap">
                <LockKeyhole size={18} />
                <input
                  id="signup-confirm"
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Enter password again"
                />
                <button
                  type="button"
                  className="auth-eye"
                  aria-label="Toggle confirm password visibility"
                  onClick={() => setShowConfirm((v) => !v)}
                >
                  {showConfirm ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>

              <label className="auth-check auth-terms-check">
                <input type="checkbox" required />
                <span>I agree to the <a href="#terms" onClick={(e) => e.preventDefault()}>Terms</a> and <a href="#privacy" onClick={(e) => e.preventDefault()}>Privacy Policy</a>.</span>
              </label>

              <button className="auth-primary" type="submit" disabled={authLoading}>
                {authLoading ? 'Sending OTP code...' : 'Create Account & Get OTP'} <ArrowRight size={16} style={{ display: 'inline', verticalAlign: 'middle', marginLeft: 4 }} />
              </button>

              <p className="auth-switch">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setAuthNotice(''); setAuthView('login'); }}
                >
                  Log in
                </button>
              </p>

              {authNotice && <div className="auth-notice" role="status">{authNotice}</div>}
            </form>
          )}

          {/* VERIFY VIEW */}
          {authView === 'verify' && (
            <form className="auth-card auth-compact-card" onSubmit={handleVerifySubmit}>
              <div className="auth-back-row">
                <button type="button" onClick={() => { setAuthNotice(''); setAuthView('signup'); }}>
                  <ArrowLeft size={17} /> Back to sign up
                </button>
              </div>
              <div className="auth-icon-tile"><Mail size={23} /></div>
              <div className="auth-eyebrow">EMAIL VERIFICATION</div>
              <h1>Check your inbox</h1>
              <p className="auth-description">
                Enter the 6-digit verification code sent to <strong>{pendingEmail || email || 'your email address'}</strong>.
              </p>

              <label className="auth-field-label" htmlFor="verify-code">Verification code</label>
              <div className="auth-input-wrap">
                <CheckCircle2 size={18} />
                <input
                  id="verify-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  pattern="[0-9]{6}"
                  required
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                />
              </div>

              <button className="auth-primary" type="submit" disabled={authLoading}>
                {authLoading ? 'Verifying OTP...' : 'Verify & Enter Workspace'} <ArrowRight size={16} style={{ display: 'inline', verticalAlign: 'middle', marginLeft: 4 }} />
              </button>

              <button
                type="button"
                className="auth-preview-link"
                disabled={authLoading}
                onClick={async () => {
                  const target = pendingEmail || email;
                  if (target) {
                    await sendOtp(target, 'email', 'resend verification');
                  } else {
                    setAuthNotice('Please enter an email address first.');
                  }
                }}
              >
                {authLoading ? 'Sending new code...' : 'Resend verification code'}
              </button>

              {authNotice && <div className="auth-notice" role="status">{authNotice}</div>}
            </form>
          )}

          {/* FORGOT PASSWORD VIEW */}
          {authView === 'forgot' && (
            <form className="auth-card auth-compact-card" onSubmit={handleForgotSubmit}>
              <div className="auth-back-row">
                <button type="button" onClick={() => { setAuthNotice(''); setAuthView('login'); }}>
                  <ArrowLeft size={17} /> Back to login
                </button>
              </div>
              <div className="auth-icon-tile"><Mail size={23} /></div>
              <div className="auth-eyebrow">ACCOUNT RECOVERY</div>
              <h1>Forgot password?</h1>
              <p className="auth-description">Enter the email linked to your account. We'll send a password reset code.</p>

              <label className="auth-field-label" htmlFor="reset-email">Email address</label>
              <div className="auth-input-wrap">
                <Mail size={18} />
                <input
                  id="reset-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>

              <button className="auth-primary" type="submit" disabled={authLoading}>
                {authLoading ? 'Sending code...' : 'Send reset code'} <ArrowRight size={16} style={{ display: 'inline', verticalAlign: 'middle', marginLeft: 4 }} />
              </button>

              {authNotice && <div className="auth-notice" role="status">{authNotice}</div>}
            </form>
          )}

          {/* PROFILE SETUP VIEW */}
          {authView === 'profile' && (
            <form className="auth-card auth-compact-card" onSubmit={handleProfileSubmit}>
              <div className="auth-back-row">
                <button type="button" onClick={() => { setAuthNotice(''); setAuthView('signup'); }}>
                  <ArrowLeft size={17} /> Back
                </button>
              </div>
              <div className="auth-icon-tile"><UserRound size={23} /></div>
              <div className="auth-eyebrow">ONE LAST STEP</div>
              <h1>Set up your profile</h1>
              <p className="auth-description">Personalize your Zuhali account. You can update these details anytime.</p>

              <div className="auth-avatar-placeholder">
                <UserRound size={34} />
                <span>+</span>
              </div>

              <label className="auth-field-label" htmlFor="profile-name">Display name</label>
              <div className="auth-input-wrap">
                <UserRound size={18} />
                <input
                  id="profile-name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="How should we call you?"
                />
              </div>

              <label className="auth-field-label" htmlFor="profile-email">Email address</label>
              <div className="auth-input-wrap">
                <Mail size={18} />
                <input
                  id="profile-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>

              <button className="auth-primary" type="submit">
                Save &amp; Enter Workspace <ArrowRight size={16} style={{ display: 'inline', verticalAlign: 'middle', marginLeft: 4 }} />
              </button>

              {authNotice && <div className="auth-notice" role="status">{authNotice}</div>}
            </form>
          )}

          <p className="auth-legal">By continuing, you agree to Zuhali's Terms of Service and Privacy Policy.</p>
        </div>
      </div>
    </section>
  );
}
