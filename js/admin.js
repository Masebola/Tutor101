// ===== Admin dashboard: real tutor + module application review =====

async function loadCount(table, filters) {
  let query = supabaseClient.from(table).select('id', { count: 'exact', head: true });
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
  const { data } = await supabaseClient.from('profiles').select('*').eq('role', 'tutor').eq('tutor_status', 'pending').order('created_at', { ascending: true });
  return data || [];
}

async function loadApprovedTutors() {
  const { data } = await supabaseClient.from('profiles').select('*').eq('role', 'tutor').in('tutor_status', ['approved', 'suspended']).order('created_at', { ascending: true });
  return data || [];
}

async function loadRejectedTutors() {
  const { data } = await supabaseClient.from('profiles').select('*').eq('role', 'tutor').eq('tutor_status', 'rejected').order('created_at', { ascending: true });
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

function renderRejectedTutors(tutors) {
  const list = document.getElementById('rejectedTutorList');
  if (!tutors.length) { list.innerHTML = '<li class="applicant-card"><p>No rejected applications.</p></li>'; return; }
  list.innerHTML = tutors.map(() => `
    <li class="applicant-card" data-id="">
      <div class="applicant-main">
        <div><h3></h3><p class="applicant-meta"></p></div>
        <span class="tag tag-rejected">Rejected</span>
      </div>
      <div class="applicant-actions">
        <button class="btn btn-outline btn-sm" data-action="reconsider-tutor" type="button">Reconsider</button>
      </div>
    </li>
  `).join('');
  list.querySelectorAll('.applicant-card').forEach((card, i) => {
    const t = tutors[i];
    card.dataset.id = t.id;
    card.querySelector('h3').textContent = t.full_name;
    card.querySelector('.applicant-meta').textContent = `Student no. ${t.student_number || '—'} · ${t.email || ''}`;
  });
}

async function loadModuleApplications() {
  const { data } = await supabaseClient
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

async function loadAllModulesForAdmin() {
  const { data } = await supabase.from('modules').select('*').order('code');
  return data || [];
}

function renderModuleMgmtList(modules) {
  const list = document.getElementById('moduleMgmtList');
  if (!modules.length) { list.innerHTML = '<li class="applicant-card"><p>No modules yet.</p></li>'; return; }

  list.innerHTML = modules.map(() => `
    <li class="applicant-card" data-id="" data-status="">
      <div class="applicant-main">
        <div><h3></h3><p class="applicant-meta"></p></div>
        <span class="tag"></span>
      </div>
      <details class="applicant-details">
        <summary>Edit</summary>
        <div class="field-grid" style="margin-top:10px;">
          <div class="form-row"><label>Name</label><input type="text" class="edit-name"></div>
          <div class="form-row"><label>Department</label><input type="text" class="edit-department"></div>
        </div>
        <div class="field-grid">
          <div class="form-row"><label>Price (R / month)</label><input type="number" class="edit-price" min="0" step="10"></div>
        </div>
        <div class="form-row"><label>Description</label><textarea class="edit-description" rows="2"></textarea></div>
        <button class="btn btn-primary btn-sm" data-action="save-module" type="button">Save changes</button>
      </details>
      <div class="applicant-actions">
        <button class="btn btn-outline btn-sm" data-action="toggle-module-status" type="button"></button>
      </div>
    </li>
  `).join('');

  list.querySelectorAll('.applicant-card').forEach((card, i) => {
    const m = modules[i];
    card.dataset.id = m.id;
    card.dataset.status = m.status;
    card.querySelector('h3').textContent = `${m.code} — ${m.name}`;
    card.querySelector('.applicant-meta').textContent = `${m.department || 'No department set'} · R${m.price}/month`;

    const tag = card.querySelector('.tag');
    tag.textContent = m.status === 'available' ? 'Available' : 'Unavailable';
    tag.className = m.status === 'available' ? 'tag tag-available' : 'tag tag-rejected';

    card.querySelector('.edit-name').value = m.name;
    card.querySelector('.edit-department').value = m.department || '';
    card.querySelector('.edit-price').value = m.price;
    card.querySelector('.edit-description').value = m.description || '';

    const toggleBtn = card.querySelector('[data-action="toggle-module-status"]');
    toggleBtn.textContent = m.status === 'available' ? 'Deactivate' : 'Activate';
  });
}

const createModuleForm = document.getElementById('createModuleForm');
if (createModuleForm) {
  createModuleForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = document.getElementById('modCode').value.trim().toUpperCase();
    const name = document.getElementById('modName').value.trim();
    const department = document.getElementById('modDepartment').value.trim();
    const price = parseFloat(document.getElementById('modPrice').value);
    const description = document.getElementById('modDescription').value.trim();
    if (!code || !name) return;

    const submitBtn = createModuleForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
      const { error } = await supabase.from('modules').insert({ code, name, department: department || null, price, description: description || null });
      if (error) throw error;
      createModuleForm.reset();
      document.getElementById('modPrice').value = 100;
      renderModuleMgmtList(await loadAllModulesForAdmin());
      loadOverview();
    } catch (err) {
      alert(err.message || 'Could not create that module — check the code is unique.');
    } finally {
      submitBtn.disabled = false;
    }
  });
}

document.addEventListener('click', async (e) => {
  const saveBtn = e.target.closest('[data-action="save-module"]');
  const toggleBtn = e.target.closest('[data-action="toggle-module-status"]');
  if (!saveBtn && !toggleBtn) return;

  const card = (saveBtn || toggleBtn).closest('.applicant-card');
  const id = card.dataset.id;

  if (saveBtn) {
    saveBtn.disabled = true;
    try {
      const { error } = await supabase.from('modules').update({
        name: card.querySelector('.edit-name').value.trim(),
        department: card.querySelector('.edit-department').value.trim() || null,
        price: parseFloat(card.querySelector('.edit-price').value),
        description: card.querySelector('.edit-description').value.trim() || null,
      }).eq('id', id);
      if (error) throw error;
      renderModuleMgmtList(await loadAllModulesForAdmin());
    } catch (err) {
      alert(err.message || 'Could not save those changes.');
      saveBtn.disabled = false;
    }
  }

  if (toggleBtn) {
    toggleBtn.disabled = true;
    const newStatus = card.dataset.status === 'available' ? 'unavailable' : 'available';
    try {
      const { error } = await supabase.from('modules').update({ status: newStatus }).eq('id', id);
      if (error) throw error;
      renderModuleMgmtList(await loadAllModulesForAdmin());
      loadOverview();
    } catch (err) {
      alert(err.message || 'Could not update that module.');
      toggleBtn.disabled = false;
    }
  }
});

async function refreshTutors() {
  renderPendingTutors(await loadPendingTutors());
  renderApprovedTutors(await loadApprovedTutors());
  renderRejectedTutors(await loadRejectedTutors());
  loadOverview();
}

async function init() {
  const ctx = await requireProfile(['admin']);
  if (!ctx) return;
  const { profile } = ctx;

  document.getElementById('headerUserName').textContent = profile.full_name;
  document.getElementById('headerAvatar').textContent = initials(profile.full_name);
  document.getElementById('logoutLink').addEventListener('click', (e) => { e.preventDefault(); signOut(); });

  try {
    loadOverview();
    renderPendingTutors(await loadPendingTutors());
    renderApprovedTutors(await loadApprovedTutors());
    renderRejectedTutors(await loadRejectedTutors());
    renderModuleApplications(await loadModuleApplications());
    renderModuleMgmtList(await loadAllModulesForAdmin());
  } catch (err) {
    showFatalError(`Couldn't load the admin dashboard: ${err.message}. Check your connection and try refreshing.`);
  }
}

document.addEventListener('click', async (e) => {
  const approveTutor = e.target.closest('[data-action="approve-tutor"]');
  const rejectTutor = e.target.closest('[data-action="reject-tutor"]');
  const suspendTutor = e.target.closest('[data-action="suspend-tutor"]');
  const reinstateTutor = e.target.closest('[data-action="reinstate-tutor"]');
  const reconsiderTutor = e.target.closest('[data-action="reconsider-tutor"]');
  const approveModule = e.target.closest('[data-action="approve-module"]');
  const rejectModule = e.target.closest('[data-action="reject-module"]');

  if (!approveTutor && !rejectTutor && !suspendTutor && !reinstateTutor && !reconsiderTutor && !approveModule && !rejectModule) return;

  const btn = approveTutor || rejectTutor || suspendTutor || reinstateTutor || reconsiderTutor || approveModule || rejectModule;
  const originalLabel = btn.textContent;
  btn.disabled = true;

  try {
    if (approveTutor || rejectTutor) {
      const card = (approveTutor || rejectTutor).closest('.applicant-card');
      const status = approveTutor ? 'approved' : 'rejected';
      const { error } = await supabaseClient.from('profiles').update({ tutor_status: status }).eq('id', card.dataset.id);
      if (error) throw error;
      await refreshTutors();
    }

    if (suspendTutor || reinstateTutor) {
      const card = (suspendTutor || reinstateTutor).closest('.applicant-card');
      const status = suspendTutor ? 'suspended' : 'approved';
      const { error } = await supabaseClient.from('profiles').update({ tutor_status: status }).eq('id', card.dataset.id);
      if (error) throw error;
      await refreshTutors();
    }

    if (reconsiderTutor) {
      const card = reconsiderTutor.closest('.applicant-card');
      const { error } = await supabaseClient.from('profiles').update({ tutor_status: 'pending' }).eq('id', card.dataset.id);
      if (error) throw error;
      await refreshTutors();
    }

    if (approveModule || rejectModule) {
      const card = (approveModule || rejectModule).closest('.applicant-card');
      const status = approveModule ? 'approved' : 'rejected';
      const { error } = await supabaseClient.from('tutor_modules').update({ status }).eq('id', card.dataset.id);
      if (error) throw error;
      renderModuleApplications(await loadModuleApplications());
    }
  } catch (err) {
    alert(err.message || 'Something went wrong — check your connection and try again.');
    btn.disabled = false;
    btn.textContent = originalLabel;
  }
});

init();
