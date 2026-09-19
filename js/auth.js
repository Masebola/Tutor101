// ===== Registration role tabs (student / tutor) =====
const roleTabs = document.querySelectorAll('.role-tab');
const tutorFields = document.getElementById('tutorFields');
const submitBtn = document.getElementById('submitBtn');

function setRole(role) {
  roleTabs.forEach((tab) => {
    const active = tab.dataset.role === role;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
  });
  if (tutorFields) tutorFields.hidden = role !== 'tutor';
  if (submitBtn) submitBtn.textContent = role === 'tutor' ? 'Apply to tutor' : 'Create student account';
}

if (roleTabs.length) {
  roleTabs.forEach((tab) => {
    tab.addEventListener('click', () => setRole(tab.dataset.role));
  });

  // Pre-select a role via ?role=tutor (used by "Become a tutor" links)
  const params = new URLSearchParams(window.location.search);
  if (params.get('role') === 'tutor') setRole('tutor');
}

// ===== Show / hide password (register + login) =====
document.querySelectorAll('.password-toggle').forEach((btn) => {
  btn.addEventListener('click', () => {
    const input = btn.previousElementSibling;
    const willShow = input.type === 'password';
    input.type = willShow ? 'text' : 'password';
    btn.textContent = willShow ? 'Hide' : 'Show';
    btn.setAttribute('aria-label', willShow ? 'Hide password' : 'Show password');
  });
});

// ===== Registration submit: create the account in Supabase =====
const registerForm = document.getElementById('registerForm');
if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const activeTab = document.querySelector('.role-tab.is-active');
    const role = activeTab ? activeTab.dataset.role : 'student';

    const fullName = document.getElementById('fullName').value.trim();
    const studentNumber = document.getElementById('studentNumber').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const academicInfo = role === 'tutor' ? document.getElementById('academicInfo').value.trim() : null;

    submitBtn.disabled = true;
    const originalLabel = submitBtn.textContent;
    submitBtn.textContent = 'Creating account…';

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role,
          full_name: fullName,
          student_number: studentNumber,
          academic_info: academicInfo,
        },
      },
    });

    if (error) {
      alert(error.message);
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
      return;
    }

    // Which modules to tutor is now chosen from the tutor dashboard once
    // approved — applying requires a real session, which doesn't exist
    // until after email verification (see js/tutor.js).

    const successMessage = document.getElementById('successMessage');
    if (successMessage) {
      successMessage.textContent = role === 'tutor'
        ? "We've sent a verification link. Once verified, your application moves to Pending Approval for an administrator to review. After approval you can apply to tutor specific modules from your dashboard."
        : "We've sent a verification link. Once verified, your student account will be ready to use.";
    }

    registerForm.hidden = true;
    document.getElementById('authSuccess').hidden = false;
  });
}

// ===== Login submit: sign in and route by role =====
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      alert(error.message);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single();

    if (profileError || !profile) {
      alert("Signed in, but couldn't load your profile. Please try again.");
      return;
    }

    if (profile.role === 'admin') {
      window.location.href = 'admin.html';
    } else if (profile.role === 'tutor') {
      window.location.href = 'tutor.html';
    } else {
      window.location.href = 'dashboard.html';
    }
  });
}
