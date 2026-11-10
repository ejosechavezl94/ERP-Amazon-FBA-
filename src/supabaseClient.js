import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Capture recovery hash/query BEFORE createClient() consumes and clears window.location.hash
if (typeof window !== 'undefined') {
  const rawHash = window.location.hash || '';
  const rawSearch = window.location.search || '';
  const rawPath = window.location.pathname || '';

  if (
    rawHash.includes('type=recovery') ||
    rawSearch.includes('type=recovery') ||
    rawPath === '/reset-password'
  ) {
    sessionStorage.setItem('fba_password_recovery_active', 'true');
  }

  if (rawHash.includes('error_description=')) {
    const params = new URLSearchParams(rawHash.replace(/^#/, ''));
    const desc = params.get('error_description');
    if (desc) {
      sessionStorage.setItem('fba_auth_url_error', desc.replace(/\+/g, ' '));
    }
  }
}

export const isConfigured = !!(supabaseUrl && supabaseAnonKey);

export const supabase = isConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

if (supabase && typeof window !== 'undefined') {
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') {
      sessionStorage.setItem('fba_password_recovery_active', 'true');
    }
  });
}
