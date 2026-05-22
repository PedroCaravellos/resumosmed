// supabase.js — cliente Supabase (carrega antes de tudo)

(function(){
  const SUPABASE_URL = "https://tlaoalfnzykrdwwlvmpq.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsYW9hbGZuenlrcmR3d2x2bXBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzODM3NzIsImV4cCI6MjA5NDk1OTc3Mn0.8bvJXpIyiN4ZruBJNDGW8QK4E7z2D8m2RJ59Cf48K7I";

  if (!window.supabase || !window.supabase.createClient){
    console.error("[resumosmed] @supabase/supabase-js não carregou.");
    return;
  }

  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: "pkce",
      // No-op lock — navigator.locks pode travar em iframe sandboxed
      lock: async (_name, _timeout, fn) => fn(),
    },
    global: {
      // Timeout em qualquer fetch do SDK pra evitar hang
      fetch: (url, options = {}) => {
        const ctrl = new AbortController();
        const timer = setTimeout(()=>ctrl.abort(), 15000);
        return fetch(url, { ...options, signal: ctrl.signal }).finally(()=>clearTimeout(timer));
      },
    },
  });

  window.sb = client;
  window.SUPABASE_URL = SUPABASE_URL;
})();
