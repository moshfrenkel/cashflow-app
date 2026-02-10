// ===== Supabase Client Initialization =====
const SUPABASE_URL = 'https://vvtmzivyeaxlpupxobgn.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_o_MPAbdqodiy88g4qDxCyg_0l3ZLMVn';

let supabase = null;
try {
    if (window.supabase && window.supabase.createClient) {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('Supabase client initialized successfully');
    } else {
        console.warn('Supabase CDN not loaded - running in offline mode');
    }
} catch (e) {
    console.error('Supabase init failed:', e);
}
