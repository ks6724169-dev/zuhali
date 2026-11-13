import React, { createContext, useContext, useState } from 'react';
import { authApi } from '../services/api';

const AuthContext = createContext();

function safeReadUser() {
  try {
    const saved = localStorage.getItem('zuhali_user');
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (e) {
    try { localStorage.removeItem('zuhali_user'); } catch {}
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => safeReadUser());

  const [authView, setAuthView] = useState(() => {
    return safeReadUser() ? 'app' : 'login';
  });

  const [pendingEmail, setPendingEmail] = useState('');
  const [authNotice, setAuthNotice] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // 1. STRICT LOGIN
  const login = async (email, password) => {
    setAuthLoading(true);
    setAuthNotice('');
    try {
      const data = await authApi.login(email, password);

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
      const errorMsg = err.message || 'Login failed';
      // If unverified, send to verification screen immediately!
      if (errorMsg.toLowerCase().includes('not verified') || errorMsg.toLowerCase().includes('otp')) {
        setPendingEmail(email);
        setAuthView('verify');
        setAuthNotice(errorMsg);
      } else {
        setAuthNotice(errorMsg);
      }
      return { success: false, error: errorMsg };
    } finally {
      setAuthLoading(false);
    }
  };

  // 2. STRICT SIGNUP (Requires Email OTP verification to activate)
  const signup = async (name, email, password) => {
    setAuthLoading(true);
    setAuthNotice('');
    setPendingEmail(email);
    try {
      const res = await authApi.signup(name, email, password);
      setAuthNotice(res.message || `Verification code sent to ${email}`);
      // Send directly to OTP verification view!
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

  // 4. STRICT VERIFY OTP (No access granted without valid OTP)
  const verifyOtp = async (code) => {
    if (!code || code.length !== 6) {
      setAuthNotice('Please enter a valid 6-digit code');
      return false;
    }

    setAuthLoading(true);
    setAuthNotice('');
    const recipient = pendingEmail;

    if (!recipient) {
      setAuthNotice('Session expired. Please sign up or log in again.');
      setAuthView('signup');
      setAuthLoading(false);
      return false;
    }

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
      setAuthView('app'); // ONLY now enter workspace!
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

  const quickTestLogin = () => {
    const profile = {
      id: 'usr_guest_' + Date.now(),
      name: 'Guest Tester',
      email: 'guest@zuhali.ai',
      avatar: '',
      createdAt: new Date().toISOString()
    };
    setUser(profile);
    localStorage.setItem('zuhali_user', JSON.stringify(profile));
    localStorage.setItem('zuhali_token', 'guest_test_token');
    setAuthView('app');
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('zuhali_user');
    localStorage.removeItem('zuhali_token');
    setAuthView('login');
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
        quickTestLogin,
        logout,
        isAuthenticated: !!user && authView === 'app'
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
