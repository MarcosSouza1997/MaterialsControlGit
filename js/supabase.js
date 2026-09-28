import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

// Load Supabase JS v2 client from global window.supabase (loaded via CDN)
if (!window.supabase || !window.supabase.createClient) {
  console.error('Supabase client library not loaded.');
}

export const supabase = window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;
