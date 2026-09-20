// ===== Shared auth guard =====
// Call this at the top of a dashboard page's init function:
//   const ctx = await requireProfile(['student']);
//   if (!ctx) return; // already redirected, or a fatal error was shown
async function requireProfile(allowedRoles) {
  try {
    const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
    if (sessionError) throw sessionError;

    if (!session) {
      window.location.href = 'login.html';
      return null;
    }

    const { data: profile, error } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (error || !profile) {
      window.location.href = 'login.html';
      return null;
    }

    if (allowedRoles && !allowedRoles.includes(profile.role)) {
      if (profile.role === 'admin') window.location.href = 'admin.html';
      else if (profile.role === 'tutor') window.location.href = 'tutor.html';
      else window.location.href = 'dashboard.html';
      return null;
    }

    return { session, profile };
  } catch (err) {
    showFatalError(`Couldn't reach Supabase: ${err.message}. Check that js/supabaseClient.js has your real project URL and anon key, and that you're loading this page over http:// (not by double-clicking the file).`);
    return null;
  }
}

// Replaces the page with a plain, visible error — used instead of a
// redirect-on-failure, since redirecting to login.html would just hit the
// same broken client there and loop silently.
function showFatalError(message) {
  document.body.innerHTML = `
    <div style="max-width:480px;margin:80px auto;padding:0 24px;font:15px/1.6 -apple-system,sans-serif;text-align:center;color:#1F2E22;">
      <h1 style="font-size:1.3rem;">Something went wrong</h1>
      <p>${message}</p>
      <p><a href="index.html" style="color:#3E7C6B;font-weight:600;">Back to home</a></p>
    </div>
  `;
}

async function signOut() {
  await supabaseClient.auth.signOut();
  window.location.href = 'login.html';
}

// ===== Small formatting helpers =====
function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-ZA', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
}

function initials(fullName) {
  if (!fullName) return '?';
  return fullName.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}
