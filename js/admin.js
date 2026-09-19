// ===== Admin dashboard: real tutor + module application review =====

async function loadCount(table, filters) {
  let query = supabase.from(table).select('id', { count: 'exact', head: true });
  Object.entries(filters).forEach(([col, val]) => { query = query.eq(col, val); });
  const { count } = await query;
  return count || 0;
}

async function loadOverview() {
  const [students, tutors, pendingTutors, modules] = await Promise.all([
    loadCount('profiles', { role: 'student' }),
    loadCount('profiles', { role: 'tutor' }),
    loadCount('profiles', { role: 'tutor', tutor_status: 'pending' }),
    loadCount('modules', { status: 'available' }),
  ]);
  document.getElementById('statStudents').textContent = students;
  document.getElementById('statTutors').textContent = tutors;
  document.getElementById('statPendingTutors').textContent = pendingTutors;
  document.getElementById('statModules').textContent = modules;
  document.getElementById('pendingTutorBadge').textContent = pendingTutors;
}

async function loadPendingTutors() {
  const { data } = await supabase.from('profiles').select('*').eq('role', 'tutor').eq('tutor_status', 'pending').order('created_at', { ascending: true });
  return data || [];
}

async function loadApprovedTutors() {
  const { data } = await supabase.from('profiles').select('*').eq('role', 'tutor').in('tutor_status', ['approved', 'suspended']).order('created_at', { ascending: true });
  return data || [];
}

function renderPendingTutors(tutors) {
  const list = document.getElementById('pendingTutorList');
  if (!tutors.length) { list.innerHTML = '<li class="applicant-card"><p>No pending applications.</p></li>'; return; }
  list.innerHTML = tutors.map(() => `
    <li class="applicant-card" data-id="">
      <div class="applicant-main">
        <div><h3></h3><p class="applicant-meta"></p></div>
        <span class="tag tag-open">Pending</span>
      </div>
      <details class="applicant-details">
        <summary>View application</summary>
        <p><strong>Academic background:</strong> <span class="app-academic"></span></p>
      </details>
      <div class="applicant-actions">
        <button class="btn btn-primary btn-sm" data-action="approve-tutor" type="button">Approve</button>
        <button class="btn btn-outline btn-sm" data-action="reject-tutor" type="button">Reject</button>
      </div>
    </li>
  `).join('');
  list.querySelectorAll('.applicant-card').forEach((card, i) => {
    const t = tutors[i];
    card.dataset.id = t.id;
    card.querySelector('h3').textContent = t.full_name;
    card.querySelector('.applicant-meta').textContent = `Student no. ${t.student_number || '—'} · ${t.email || ''} · Applied ${formatDate(t.created_at)}`;
    card.querySelector('.app-academic').textContent = t.academic_info || 'Not provided.';
  });
}

function renderApprovedTutors(tutors) {
  const list = document.getElementById('approvedTutorList');
  if (!tutors.length) { list.innerHTML = '<li class="applicant-card"><p>No approved tutors yet.</p></li>'; return; }
  list.innerHTML = tutors.map(() => `
    <li class="applicant-card" data-id="">
      <div class="applicant-main">
        <div><h3></h3><p class="applicant-meta"></p></div>
        <span class="tag"></span>
      </div>
      <div class="applicant-actions"></div>
    </li>
  `).join('');
  list.querySelectorAll('.applicant-card').forEach((card, i) => {
    const t = tutors[i];
    card.dataset.id = t.id;
    card.querySelector('h3').textContent = t.full_name;
    card.querySelector('.applicant-meta').textContent = `Student no. ${t.student_number || '—'} · ${t.email || ''}`;
    const tag = card.querySelector('.tag');
    const actions = card.querySelector('.applicant-actions');
    if (t.tutor_status === 'suspended') {
      tag.textContent = 'Suspended';
      tag.className = 'tag tag-rejected';
      actions.innerHTML = '<button class="btn btn-outline btn-sm" data-action="reinstate-tutor" type="button">Reinstate</button>';
    } else {
      tag.textContent = 'Approved';
      tag.className = 'tag tag-available';
      actions.innerHTML = '<button class="btn btn-outline btn-sm" data-action="suspend-tutor" type="button">Suspend</button>';
    }
  });
}

async function loadModuleApplications() {
  const { data } = await supabase
    .from('tutor_modules')
    .select('*, profiles(*), modules(*)')
    .eq('status', 'pending')
    .order('applied_at', { ascending: true });
  return data || [];
}

function renderModuleApplications(apps) {
  const list = document.getElementById('moduleApplicationsList');
  document.getElementById('pendingModuleBadge').textContent = apps.length;
  if (!apps.length) { list.innerHTML = '<li class="applicant-card"><p>No pending module applications.</p></li>'; return; }
  list.innerHTML = apps.map(() => `
    <li class="applicant-card" data-id="">
      <div class="applicant-main">
        <div><h3></h3><p class="applicant-meta"></p></div>
        <span class="tag tag-open">Pending</span>
      </div>
      <div class="applicant-actions">
        <button class="btn btn-primary btn-sm" data-action="approve-module" type="button">Approve</button>
        <button class="btn btn-outline btn-sm" data-action="reject-module" type="button">Reject</button>
      </div>
    </li>
  `).join('');
  list.querySelectorAll('.applicant-card').forEach((card, i) => {
    const a = apps[i];
    card.dataset.id = a.id;
    card.querySelector('h3').textContent = `${a.profiles.full_name} → ${a.modules.code}`;
    card.querySelector('.applicant-meta').textContent = `Applying to tutor ${a.modules.name} · Applied ${formatDate(a.applied_at)}`;
  });
}

async function refreshTutors() {
  renderPendingTutors(await loadPendingTutors());
  renderApprovedTutors(await loadApprovedTutors());
  loadOverview();
}

async function init() {
  const ctx = await requireProfile(['admin']);
  if (!ctx) return;
  const { profile } = ctx;

  document.getElementById('headerUserName').textContent = profile.full_name;
  document.getElementById('headerAvatar').textContent = initials(profile.full_name);
  document.getElementById('logoutLink').addEventListener('click', (e) => { e.preventDefault(); signOut(); });

  loadOverview();
  renderPendingTutors(await loadPendingTutors());
  renderApprovedTutors(await loadApprovedTutors());
  renderModuleApplications(await loadModuleApplications());
}

document.addEventListener('click', async (e) => {
  const approveTutor = e.target.closest('[data-action="approve-tutor"]');
  const rejectTutor = e.target.closest('[data-action="reject-tutor"]');
  const suspendTutor = e.target.closest('[data-action="suspend-tutor"]');
  const reinstateTutor = e.target.closest('[data-action="reinstate-tutor"]');
  const approveModule = e.target.closest('[data-action="approve-module"]');
  const rejectModule = e.target.closest('[data-action="reject-module"]');

  if (approveTutor || rejectTutor) {
    const card = (approveTutor || rejectTutor).closest('.applicant-card');
    const status = approveTutor ? 'approved' : 'rejected';
    const { error } = await supabase.from('profiles').update({ tutor_status: status }).eq('id', card.dataset.id);
    if (error) { alert(error.message); return; }
    await refreshTutors();
  }

  if (suspendTutor || reinstateTutor) {
    const card = (suspendTutor || reinstateTutor).closest('.applicant-card');
    const status = suspendTutor ? 'suspended' : 'approved';
    const { error } = await supabase.from('profiles').update({ tutor_status: status }).eq('id', card.dataset.id);
    if (error) { alert(error.message); return; }
    await refreshTutors();
  }

  if (approveModule || rejectModule) {
    const card = (approveModule || rejectModule).closest('.applicant-card');
    const status = approveModule ? 'approved' : 'rejected';
    const { error } = await supabase.from('tutor_modules').update({ status }).eq('id', card.dataset.id);
    if (error) { alert(error.message); return; }
    renderModuleApplications(await loadModuleApplications());
  }
});

init();
