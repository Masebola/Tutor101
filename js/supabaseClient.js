// Supabase client setup.
// Replace these two values with the ones from your project's
// Settings → API page (see supabase/SETUP.md), then every page
// that loads this file after the supabase-js CDN script can use
// the `supabaseClient` object below.
//
// Named `supabaseClient` (not `supabase`) deliberately — the CDN script
// above already creates a global called `window.supabase`, and declaring
// our own top-level `const supabase = ...` collides with it and throws a
// fatal syntax error that silently breaks this whole file.

const SUPABASE_URL = 'https://kdjexvklmvfujfawlpxz.supabase.coo';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkamV4dmtsbXZmdWpmYXdscHh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk4MjQwNzEsImV4cCI6MjEwNTQwMDA3MX0.2Vrh__7Z06k00DN9WfcO9-ZyqpIu8unLgqHSm-m1Lbc';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

if (SUPABASE_URL.includes('YOUR_PROJECT') || SUPABASE_ANON_KEY.includes('YOUR_ANON_KEY')) {
  console.error(
    'Tutor 101: js/supabaseClient.js still has placeholder credentials. ' +
    'Sign-up/login will hang or fail silently until you replace SUPABASE_URL ' +
    'and SUPABASE_ANON_KEY with your real project values (see supabase/SETUP.md).'
  );
  document.addEventListener('DOMContentLoaded', () => {
    const banner = document.createElement('div');
    banner.textContent = 'Supabase isn\u2019t configured yet — add your project URL and anon key to js/supabaseClient.js (see supabase/SETUP.md).';
    banner.style.cssText = 'background:#B65C4B;color:#fff;font:600 14px/1.4 sans-serif;padding:10px 16px;text-align:center;position:sticky;top:0;z-index:9999;';
    document.body.prepend(banner);
  });
}
