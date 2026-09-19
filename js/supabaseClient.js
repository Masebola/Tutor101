// Supabase client setup.
// Replace these two values with the ones from your project's
// Settings → API page (see supabase/SETUP.md), then every page
// that loads this file after the supabase-js CDN script can use
// the `supabase` object below.

const SUPABASE_URL = 'https://kdjexvklmvfujfawlpxz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkamV4dmtsbXZmdWpmYXdscHh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk4MjQwNzEsImV4cCI6MjEwNTQwMDA3MX0.2Vrh__7Z06k00DN9WfcO9-ZyqpIu8unLgqHSm-m1Lbc';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
