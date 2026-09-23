// ===== Tutor dashboard: real data for the tutor's approved modules =====

let currentTutorId = null;
let approvedModules = []; // [{ id, code, name }, ...]

async function loadAllModules() {
  const { data } = await supabaseClient.from('modules').select('*').eq('status', 'available').order('code');
  return data || [];
}

function populateApplySelect(allModules, applications) {
  const blockedIds = new Set(
    applications.filter((a) => a.status === 'pending' || a.status === 'approved').map((a) => a.modules.id)
  );
  const remaining = allModules.filter((m) => !blockedIds.has(m.id));
  const select = document.getElementById('applyModuleSelect');
  select.innerHTML = '';
  if (!remaining.length) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'No other modules available';
    select.appendChild(opt);
    return;
  }
  remaining.forEach((m) => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = `${m.code} — ${m.name}`;
    select.appendChild(opt);
  });
}

async function loadApprovedModules(tutorId) {
  const { data } = await supabaseClient
    .from('tutor_modules')
    .select('status, modules(*)')
    .eq('tutor_id', tutorId);
  return data || [];
}

function populateModuleSelects(modules) {
  const selects = [document.getElementById('sessModule'), document.getElementById('resModule'), document.getElementById('annModule')];
  const forms = [document.getElementById('sessionForm'), document.getElementById('resourceForm'), document.getElementById('announcementForm')];

  selects.forEach((sel, i) => {
    if (!sel) return;
    sel.innerHTML = '';
    const submitBtn = forms[i] ? forms[i].querySelector('button[type="submit"]') : null;

    if (!modules.length) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'No approved modules yet';
      sel.appendChild(opt);
      sel.disabled = true;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.title = 'Apply to tutor a module first, from My modules — this unlocks once an administrator approves it.';
      }
      return;
    }

    sel.disabled = false;
    if (submitBtn) { submitBtn.disabled = false; submitBtn.title = ''; }
    modules.forEach((m) => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = `${m.code} — ${m.name}`;
      sel.appendChild(opt);
    });
  });
}

function renderModulesList(applications) {
  const list = document.getElementById('modulesList');
  if (!applications.length) {
    list.innerHTML = '<li class="applicant-card"><p>You haven\u2019t applied to tutor a module yet.</p></li>';
    return;
  }
  list.innerHTML = applications.map(() => `
    <li class="applicant-card">
      <div class="applicant-main">
        <div><h3></h3><p class="applicant-meta"></p></div>
        <span class="tag"></span>
      </div>
    </li>
  `).join('');
  list.querySelectorAll('.applicant-card').forEach((card, i) => {
    const a = applications[i];
    card.querySelector('h3').textContent = `${a.modules.code} — ${a.modules.name}`;
    const tag = card.querySelector('.tag');
    if (a.status === 'approved') { tag.textContent = 'Active'; tag.className = 'tag tag-available'; card.querySelector('.applicant-meta').textContent = "You're approved to tutor this module."; }
    else if (a.status === 'pending') { tag.textContent = 'Pending review'; tag.className = 'tag tag-open'; card.querySelector('.applicant-meta').textContent = 'Application submitted, awaiting an administrator.'; }
    else { tag.textContent = 'Rejected'; tag.className = 'tag tag-rejected'; card.querySelector('.applicant-meta').textContent = 'This application was not approved.'; }
  });
}

async function loadSessions(tutorId) {
  const { data } = await supabaseClient.from('sessions').select('*').eq('tutor_id', tutorId).order('start_time', { ascending: true });
  return data || [];
}

function renderSessions(sessions) {
  const list = document.getElementById('sessionList');
  if (!sessions.length) { list.innerHTML = '<p>No sessions created yet.</p>'; return; }
  list.innerHTML = sessions.map((s) => `
    <div class="session-row" data-id="${s.id}">
      <div><h3></h3><p class="session-meta"></p><p class="session-desc"></p></div>
      <div class="applicant-actions"><button class="btn btn-outline btn-sm" data-action="cancel-session" type="button">Cancel</button></div>
    </div>
  `).join('');
  list.querySelectorAll('.session-row').forEach((row, i) => {
    const s = sessions[i];
    row.querySelector('h3').textContent = s.title;
    const when = s.recurring_rule ? `Every ${s.recurring_rule.replace('weekly:', '')}` : formatDate(s.start_time);
    row.querySelector('.session-meta').textContent = `${when} · ${formatTime(s.start_time)} · ${s.duration_minutes} minutes · ${s.platform || ''}`;
    row.querySelector('.session-desc').textContent = s.description || '';
  });
  document.getElementById('statSessions').textContent = sessions.filter((s) => new Date(s.start_time) >= new Date()).length;
}

async function loadResources(tutorId, category) {
  const { data } = await supabaseClient.from('resources').select('*').eq('uploaded_by', tutorId).eq('category', category).order('uploaded_at', { ascending: false });
  return data || [];
}

function renderResourceList(listId, items) {
  const list = document.getElementById(listId);
  if (!items.length) { list.innerHTML = '<li><span>Nothing uploaded yet.</span></li>'; return; }
  list.innerHTML = items.map(() => `<li><span></span><a href="#" data-action="remove-resource">Remove</a></li>`).join('');
  list.querySelectorAll('li').forEach((li, i) => {
    li.querySelector('span').textContent = items[i].file_name;
    li.dataset.id = items[i].id;
    li.dataset.path = items[i].storage_path;
  });
}

async function loadAnnouncements(tutorId) {
  const { data } = await supabaseClient.from('announcements').select('*').eq('posted_by', tutorId).order('created_at', { ascending: false });
  return data || [];
}

function renderAnnouncements(items) {
  const list = document.getElementById('announcementList');
  if (!items.length) { list.innerHTML = '<p>No announcements posted yet.</p>'; return; }
  list.innerHTML = items.map(() => `<article class="announcement"><h3></h3><p></p><p class="announcement-date"></p></article>`).join('');
  list.querySelectorAll('.announcement').forEach((el, i) => {
    el.querySelector('h3').textContent = items[i].title;
    el.querySelector('p').textContent = items[i].body;
    el.querySelector('.announcement-date').textContent = `Posted ${formatDate(items[i].created_at)}`;
  });
}

async function loadRequests(moduleIds) {
  if (!moduleIds.length) return [];
  const { data } = await supabaseClient.from('support_requests').select('*').in('module_id', moduleIds).order('created_at', { ascending: false });
  return data || [];
}

function renderRequests(items) {
  const list = document.getElementById('requestsList');
  if (!items.length) { list.innerHTML = '<li class="applicant-card"><p>No support requests yet.</p></li>'; return; }
  list.innerHTML = items.map(() => `
    <li class="applicant-card" data-id="">
      <div class="applicant-main">
        <div>
          <h3></h3>
          <p class="applicant-meta"></p>
          <p class="request-message"></p>
        </div>
        <span class="tag"></span>
      </div>
      <details class="applicant-details">
        <summary>Respond</summary>
        <div class="form-row" style="margin-top:10px;"><textarea rows="3" placeholder="Write your reply..." class="reply-input"></textarea></div>
        <button class="btn btn-primary btn-sm" data-action="answer-request" type="button">Mark as answered</button>
      </details>
    </li>
  `).join('');
  list.querySelectorAll('.applicant-card').forEach((card, i) => {
    const r = items[i];
    card.dataset.id = r.id;
    card.querySelector('h3').textContent = r.topic;
    card.querySelector('.applicant-meta').textContent = `Submitted ${formatDate(r.created_at)}`;
    card.querySelector('.request-message').textContent = `"${r.message}"`;
    const tag = card.querySelector('.tag');
    tag.textContent = r.status.replace('_', ' ');
    tag.className = r.status === 'answered' || r.status === 'closed' ? 'tag tag-available' : 'tag tag-open';
    if (r.response) card.querySelector('.reply-input').value = r.response;
  });
  document.getElementById('statRequests').textContent = items.filter((r) => r.status === 'open' || r.status === 'in_progress').length;
}

function renderProfile(profile) {
  document.getElementById('welcomeHeading').textContent = `Welcome back, ${profile.full_name.split(' ')[0]}`;
  document.getElementById('statRating').textContent = profile.average_rating ? profile.average_rating : '—';

  const container = document.getElementById('tutorProfileDisplay');
  container.innerHTML = `
    <span class="avatar avatar-lg"></span>
    <div>
      <h3></h3>
      <p class="tutor-academic"></p>
      <p id="profileBio"></p>
      <div class="card-rating"><span class="stars">★★★★★</span><span class="rating-value"></span></div>
      <p class="tutor-email"></p>
      <div class="profile-actions">
        <button class="btn btn-outline btn-sm" id="editProfileBtn" type="button">Edit profile</button>
        <button class="btn btn-outline btn-sm" id="changePictureBtn" type="button">Change picture</button>
        <input type="file" id="avatarFile" accept="image/*" hidden>
      </div>
      <form class="panel-form" id="profileForm" hidden style="margin-top:16px;">
        <div class="form-row"><label for="editBio">Short biography</label><textarea id="editBio" rows="3"></textarea></div>
        <button type="submit" class="btn btn-primary btn-sm">Save</button>
      </form>
    </div>
  `;

  const avatarEl = container.querySelector('.avatar');
  if (profile.avatar_url) {
    avatarEl.innerHTML = '';
    const img = document.createElement('img');
    img.src = profile.avatar_url;
    img.alt = `${profile.full_name}'s profile picture`;
    avatarEl.appendChild(img);
  } else {
    avatarEl.textContent = initials(profile.full_name);
  }

  container.querySelector('h3').textContent = profile.full_name;
  container.querySelector('.tutor-academic').textContent = profile.academic_info || '';
  container.querySelector('#profileBio').textContent = profile.bio || 'No biography added yet.';
  container.querySelector('.rating-value').textContent = profile.average_rating ? profile.average_rating : 'No ratings yet';
  container.querySelector('.tutor-email').textContent = profile.email || '';

  const editBtn = container.querySelector('#editProfileBtn');
  const form = container.querySelector('#profileForm');
  const bioEl = container.querySelector('#profileBio');
  const editBio = container.querySelector('#editBio');

  editBtn.addEventListener('click', () => {
    editBio.value = bioEl.textContent === 'No biography added yet.' ? '' : bioEl.textContent;
    form.hidden = !form.hidden;
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newBio = editBio.value.trim();
    const { error } = await supabaseClient.from('profiles').update({ bio: newBio }).eq('id', profile.id);
    if (error) { alert(error.message); return; }
    bioEl.textContent = newBio || 'No biography added yet.';
    form.hidden = true;
  });

  const changePictureBtn = container.querySelector('#changePictureBtn');
  const avatarFile = container.querySelector('#avatarFile');

  changePictureBtn.addEventListener('click', () => avatarFile.click());

  avatarFile.addEventListener('change', async () => {
    const file = avatarFile.files[0];
    if (!file) return;

    const originalLabel = changePictureBtn.textContent;
    changePictureBtn.disabled = true;
    changePictureBtn.textContent = 'Uploading…';

    try {
      const ext = file.name.split('.').pop();
      const path = `${profile.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabaseClient.storage.from('avatars').upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabaseClient.storage.from('avatars').getPublicUrl(path);
      const { error: updateError } = await supabaseClient.from('profiles').update({ avatar_url: urlData.publicUrl }).eq('id', profile.id);
      if (updateError) throw updateError;

      avatarEl.innerHTML = '';
      const img = document.createElement('img');
      img.src = urlData.publicUrl;
      img.alt = `${profile.full_name}'s profile picture`;
      avatarEl.appendChild(img);
      profile.avatar_url = urlData.publicUrl;
    } catch (err) {
      alert(err.message || 'Could not upload that image.');
    } finally {
      changePictureBtn.disabled = false;
      changePictureBtn.textContent = originalLabel;
      avatarFile.value = '';
    }
  });
}

async function init() {
  const ctx = await requireProfile(['tutor']);
  if (!ctx) return;
  const { profile } = ctx;
  currentTutorId = profile.id;

  document.getElementById('headerUserName').textContent = profile.full_name;
  document.getElementById('headerAvatar').textContent = initials(profile.full_name);
  document.getElementById('logoutLink').addEventListener('click', (e) => { e.preventDefault(); signOut(); });

  if (profile.tutor_status !== 'approved') {
    document.getElementById('pendingState').hidden = false;
    if (profile.tutor_status === 'rejected') {
      document.getElementById('pendingMessage').textContent = 'Your tutor application was not approved. Contact an administrator if you think this is a mistake.';
    } else if (profile.tutor_status === 'suspended') {
      document.getElementById('pendingMessage').textContent = 'Your tutor account has been suspended. Contact an administrator for details.';
    }
    return;
  }

  document.getElementById('dashboardShell').hidden = false;

  try {
    const applications = await loadApprovedModules(profile.id);
    approvedModules = applications.filter((a) => a.status === 'approved').map((a) => a.modules);
    populateModuleSelects(approvedModules);
    renderModulesList(applications);
    document.getElementById('statModules').textContent = approvedModules.length;
    populateApplySelect(await loadAllModules(), applications);

    const [sessions, notes, guides, papers, announcements, requests] = await Promise.all([
      loadSessions(profile.id),
      loadResources(profile.id, 'notes'),
      loadResources(profile.id, 'study_guide'),
      loadResources(profile.id, 'past_paper'),
      loadAnnouncements(profile.id),
      loadRequests(approvedModules.map((m) => m.id)),
    ]);

    renderSessions(sessions);
    renderResourceList('notesList', notes);
    renderResourceList('guidesList', guides);
    renderResourceList('papersList', papers);
    renderAnnouncements(announcements);
    renderRequests(requests);
    renderProfile(profile);
  } catch (err) {
    showFatalError(`Couldn't load your dashboard: ${err.message}. Check your connection and try refreshing.`);
  }
}

// ===== Create session =====
const sessionForm = document.getElementById('sessionForm');
if (sessionForm) {
  sessionForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const moduleId = document.getElementById('sessModule').value;
    const title = document.getElementById('sessTitle').value.trim();
    const date = document.getElementById('sessDate').value;
    const time = document.getElementById('sessTime').value;
    const duration = parseInt(document.getElementById('sessDuration').value, 10);
    const platform = document.getElementById('sessPlatform').value;
    const link = document.getElementById('sessLink').value.trim();
    const desc = document.getElementById('sessDesc').value.trim();
    const recurring = document.getElementById('sessRecurring').checked;
    if (!moduleId || !title || !date || !time) return;

    const startTime = new Date(`${date}T${time}`);
    const weekday = recurring ? startTime.toLocaleDateString('en-ZA', { weekday: 'long' }).toLowerCase() : null;

    const { error } = await supabaseClient.from('sessions').insert({
      module_id: moduleId,
      tutor_id: currentTutorId,
      title,
      description: desc || null,
      start_time: startTime.toISOString(),
      duration_minutes: duration,
      platform,
      meeting_link: link || null,
      recurring_rule: recurring ? `weekly:${weekday}` : null,
    });

    if (error) { alert(error.message); return; }
    sessionForm.reset();
    renderSessions(await loadSessions(currentTutorId));
  });
}

// ===== Cancel session =====
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action="cancel-session"]');
  if (!btn) return;
  const row = btn.closest('.session-row');
  const id = row.dataset.id;
  const { error } = await supabaseClient.from('sessions').delete().eq('id', id);
  if (error) { alert(error.message); return; }
  row.remove();
});

// ===== Upload resource =====
const resourceForm = document.getElementById('resourceForm');
if (resourceForm) {
  resourceForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const moduleId = document.getElementById('resModule').value;
    const category = document.getElementById('resCategory').value;
    const fileInput = document.getElementById('resFile');
    const file = fileInput.files[0];
    if (!moduleId || !file) return;

    const module = approvedModules.find((m) => m.id === moduleId);
    const path = `${module ? module.code : 'module'}/${category}/${Date.now()}_${file.name}`;

    const { error: uploadError } = await supabaseClient.storage.from('resources').upload(path, file);
    if (uploadError) { alert(uploadError.message); return; }

    const { error } = await supabaseClient.from('resources').insert({
      module_id: moduleId,
      uploaded_by: currentTutorId,
      category,
      file_name: file.name,
      storage_path: path,
    });
    if (error) { alert(error.message); return; }

    resourceForm.reset();
    const targetId = category === 'notes' ? 'notesList' : category === 'study_guide' ? 'guidesList' : 'papersList';
    renderResourceList(targetId, await loadResources(currentTutorId, category));
  });
}

// ===== Remove resource =====
document.addEventListener('click', async (e) => {
  const link = e.target.closest('[data-action="remove-resource"]');
  if (!link) return;
  e.preventDefault();
  const li = link.closest('li');
  const id = li.dataset.id;
  const path = li.dataset.path;
  await supabaseClient.storage.from('resources').remove([path]);
  const { error } = await supabaseClient.from('resources').delete().eq('id', id);
  if (error) { alert(error.message); return; }
  li.remove();
});

// ===== Post announcement =====
const announcementForm = document.getElementById('announcementForm');
if (announcementForm) {
  announcementForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const moduleId = document.getElementById('annModule').value;
    const title = document.getElementById('annTitle').value.trim();
    const body = document.getElementById('annBody').value.trim();
    if (!moduleId || !title || !body) return;

    const { error } = await supabaseClient.from('announcements').insert({ module_id: moduleId, posted_by: currentTutorId, title, body });
    if (error) { alert(error.message); return; }

    announcementForm.reset();
    renderAnnouncements(await loadAnnouncements(currentTutorId));
  });
}

// ===== Respond to a support request =====
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action="answer-request"]');
  if (!btn) return;
  const card = btn.closest('.applicant-card');
  const id = card.dataset.id;
  const reply = card.querySelector('.reply-input').value.trim();
  if (!reply) return;

  const { error } = await supabaseClient.from('support_requests').update({ response: reply, status: 'answered' }).eq('id', id);
  if (error) { alert(error.message); return; }

  const tag = card.querySelector('.tag');
  tag.textContent = 'Answered';
  tag.className = 'tag tag-available';
  card.querySelector('.applicant-details').removeAttribute('open');
});

// ===== Apply to tutor another module =====
const applyModuleForm = document.getElementById('applyModuleForm');
if (applyModuleForm) {
  applyModuleForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const moduleId = document.getElementById('applyModuleSelect').value;
    if (!moduleId) return;

    const { error } = await supabaseClient.from('tutor_modules').insert({ tutor_id: currentTutorId, module_id: moduleId, status: 'pending' });
    if (error) { alert(error.message); return; }

    const applications = await loadApprovedModules(currentTutorId);
    renderModulesList(applications);
    populateApplySelect(await loadAllModules(), applications);
  });
}

init();
