// ===== Shared auth guard =====
// Call this at the top of a dashboard page's init function:
//   const ctx = await requireProfile(['student']);
//   if (!ctx) return; // already redirected
async function requireProfile(allowedRoles) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = 'login.html';
    return null;
  }

  const { data: profile, error } = await supabase
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
}

async function signOut() {
  await supabase.auth.signOut();
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
