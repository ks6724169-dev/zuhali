// Zuhali API Client for Backend Communication
const API_BASE = '/api/v1';

export async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const token = localStorage.getItem('zuhali_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || data.message || 'API request failed');
    }
    return data;
  } catch (err) {
    // If backend is offline or network error, let the caller know
    console.warn(`[Zuhali API] ${endpoint} request error:`, err.message);
    throw err;
  }
}

// Authentication API methods
export const authApi = {
  sendOtp: (recipient, channel = 'email', purpose = 'login') =>
    apiRequest('/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ recipient, channel, purpose })
    }),

  verifyOtp: (recipient, otp) =>
    apiRequest('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ recipient, otp })
    }),

  signup: (name, email, password) =>
    apiRequest('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name, email, password })
    }),

  login: (email, password) =>
    apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    }),

  forgotPassword: (email) =>
    apiRequest('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email })
    }),

  resetPassword: (email, otp, new_password) =>
    apiRequest('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, otp, new_password })
    })
};
