import React, { createContext, useContext, useState } from 'react';
import { authApi } from '../services/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('zuhali_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [authView, setAuthView] = useState(() => {
    return localStorage.getItem('zuhali_user') ? 'app' : 'login';
  });

  const [pendingEmail, setPendingEmail] = useState('');
  const [authNotice, setAuthNotice] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // 1. LOGIN
  const login = async (email, password) => {
    setAuthLoading(true);
    setAuthNotice('');
    try {
      let data = null;
      try {
        data = await authApi.login(email, password);
      } catch (e) {
        console.warn('Backend login fallback:', e.message);
      }

      const profile = {
        id: data?.user?.id || 'usr_' + Date.now(),
        name: data?.user?.name || email.split('@')[0],
        email: email,
        avatar: '',
        createdAt: new Date().toISOString()
      };

      if (data?.access_token) {
        localStorage.setItem('zuhali_token', data.access_token);
      }
      setUser(profile);
      localStorage.setItem('zuhali_user', JSON.stringify(profile));
      setAuthView('app');
      return { success: true };
    } catch (err) {
      setAuthNotice(err.message || 'Login failed');
      return { success: false, error: err.message };
    } finally {
      setAuthLoading(false);
    }
  };

  // 2. SIGNUP (Dispatches live OTP via Gmail SMTP)
  const signup = async (name, email, password) => {
    setAuthLoading(true);
    setAuthNotice('');
    setPendingEmail(email);
    try {
      const res = await authApi.signup(name, email, password);
      setAuthNotice(res.message || `Verification code sent to ${email}`);
      setAuthView('verify');
      return { success: true };
    } catch (err) {
      const errorMsg = err.message || 'Signup failed';
      setAuthNotice(errorMsg);
      console.error('[Signup Error]:', errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setAuthLoading(false);
    }
  };

  // 3. SEND OTP (Email or SMS)
  const sendOtp = async (recipient, channel = 'email', purpose = 'verification') => {
    setAuthLoading(true);
    setAuthNotice('');
    setPendingEmail(recipient);
    try {
      const res = await authApi.sendOtp(recipient, channel, purpose);
      setAuthNotice(res.message || `Code sent to ${recipient}`);
      return { success: true };
    } catch (err) {
      const errorMsg = err.message || `Could not send OTP to ${recipient}`;
      setAuthNotice(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setAuthLoading(false);
    }
  };

  // 4. VERIFY OTP
  const verifyOtp = async (code) => {
    if (!code || code.length !== 6) {
      setAuthNotice('Please enter a valid 6-digit code');
      return false;
    }

    setAuthLoading(true);
    setAuthNotice('');
    const recipient = pendingEmail || user?.email || 'user@zuhali.ai';

    try {
      const res = await authApi.verifyOtp(recipient, code);
      if (res.access_token) {
        localStorage.setItem('zuhali_token', res.access_token);
      }

      const profile = {
        id: 'usr_' + Date.now(),
        name: res?.user?.name || recipient.split('@')[0],
        email: recipient,
        avatar: '',
        createdAt: new Date().toISOString()
      };
      setUser(profile);
      localStorage.setItem('zuhali_user', JSON.stringify(profile));
      setAuthView('app');
      return true;
    } catch (err) {
      const errorMsg = err.message || 'OTP verification failed';
      setAuthNotice(errorMsg);
      return false;
    } finally {
      setAuthLoading(false);
    }
  };

  // 5. FORGOT PASSWORD
  const resetPassword = async (email) => {
    setAuthLoading(true);
    setAuthNotice('');
    setPendingEmail(email);
    try {
      const res = await authApi.forgotPassword(email);
      setAuthNotice(res.message || `Password reset code sent to ${email}`);
      setAuthView('verify');
    } catch (err) {
      setAuthNotice(err.message || 'Failed to send reset code');
    } finally {
      setAuthLoading(false);
    }
  };

  const updateProfile = (updates) => {
    setUser((prev) => {
      const updated = { ...prev, ...updates };
      localStorage.setItem('zuhali_user', JSON.stringify(updated));
      return updated;
    });
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('zuhali_user');
    localStorage.removeItem('zuhali_token');
    setAuthView('login');
  };

  const bypassToApp = () => {
    if (!user) {
      const guest = { id: 'guest_' + Date.now(), name: 'Explorer', email: 'guest@zuhali.ai' };
      setUser(guest);
      localStorage.setItem('zuhali_user', JSON.stringify(guest));
    }
    setAuthView('app');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
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
        updateProfile,
        logout,
        bypassToApp,
        isAuthenticated: !!user && authView === 'app'
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
