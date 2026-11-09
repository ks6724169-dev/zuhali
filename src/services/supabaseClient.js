// Frontend Supabase Client Configuration
export const SUPABASE_CONFIG = {
  url: 'https://uvibkxulhhknhptzvbwo.supabase.co',
  publishableKey: 'sb_publishable_11gKdjcSzqiV5XlfgxMetw_hyonNBXA',
  jwksUrl: 'https://uvibkxulhhknhptzvbwo.supabase.co/auth/v1/.well-known/jwks.json'
};

// Helper for authenticated queries to Supabase REST API
export async function supabaseRest(endpoint, options = {}) {
  const token = localStorage.getItem('zuhali_token') || SUPABASE_CONFIG.publishableKey;
  const url = `${SUPABASE_CONFIG.url}/rest/v1/${endpoint}`;
  
  const headers = {
    'apikey': SUPABASE_CONFIG.publishableKey,
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  try {
    const res = await fetch(url, { ...options, headers });
    return await res.json();
  } catch (err) {
    console.warn('[Supabase REST]', err.message);
    throw err;
  }
}
