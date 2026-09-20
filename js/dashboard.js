// ===== Student module dashboard: loads real data for one subscribed module =====

let currentModule = null;
let currentSubscription = null;
let currentStudentId = null;

async function loadSubscription(studentId, moduleCode) {
  let query = supabase
    .from('subscriptions')
    .select('*, modules!inner(*)')
    .eq('student_id', studentId)
    .eq('status', 'active');

  if (moduleCode) query = query.eq('modules.code', moduleCode);

  const { data, error } = await query.limit(1).maybeSingle();
  if (error || !data) return null;
  return data;
}

function renderLetterhead(subscription, module) {
  document.getElementById('headerModuleName').textContent = `${module.code} — ${module.name}`;
  document.getElementById('letterheadCode').textContent = module.code;
  document.getElementById('letterheadName').textContent = module.name;
  document.getElementById('letterheadStatus').textContent =
    subscription.status === 'active' ? 'Subscription active' : subscription.status;
  document.getElementById('letterheadExpiry').textContent =
    subscription.expiry_date ? `Renews ${formatDate(subscription.expiry_date)}` : '';
}

async function loadTutor(moduleId) {
  const { data } = await supabase
    .from('tutor_modules')
    .select('tutor_id, profiles(*)')
    .eq('module_id', moduleId)
    .eq('status', 'approved')
    .limit(1)
    .maybeSingle();
  return data ? data.profiles : null;
}

function renderTutorProfile(tutor) {
  const container = document.getElementById('tutorProfile');
  document.getElementById('letterheadTutor').textContent = tutor ? `Tutor: ${tutor.full_name}` : 'Tutor: not yet assigned';

  if (!tutor) {
    container.innerHTML = '<p>No tutor has been assigned to this module yet.</p>';
    return;
  }

  container.innerHTML = `
    <span class="avatar avatar-lg"></span>
    <div>
      <h3></h3>
      <p class="tutor-academic"></p>
      <p class="tutor-bio"></p>
      <div class="card-rating">
        <span class="stars">★★★★★</span>
        <span class="rating-value"></span>
      </div>
      <p class="tutor-email"></p>
    </div>
  `;
  container.querySelector('.avatar').textContent = initials(tutor.full_name);
  container.querySelector('h3').textContent = tutor.full_name;
  container.querySelector('.tutor-academic').textContent = tutor.academic_info || '';
  container.querySelector('.tutor-bio').textContent = tutor.bio || '';
  container.querySelector('.rating-value').textContent = tutor.average_rating ? `${tutor.average_rating}` : 'No ratings yet';
  container.querySelector('.tutor-email').textContent = tutor.email || '';
}

async function loadSessions(moduleId) {
  const { data } = await supabase
    .from('sessions')
    .select('*')
    .eq('module_id', moduleId)
    .order('start_time', { ascending: true });
  return data || [];
}

function renderSessions(sessions) {
  const list = document.getElementById('sessionList');
  if (!sessions.length) {
    list.innerHTML = '<p>No sessions scheduled yet.</p>';
    return;
  }
  list.innerHTML = sessions.map(() => `
    <div class="session-row">
      <div>
        <h3></h3>
        <p class="session-meta"></p>
        <p class="session-desc"></p>
      </div>
      <a class="btn btn-primary btn-sm" target="_blank" rel="noopener" hidden>Join session</a>
    </div>
  `).join('');

  list.querySelectorAll('.session-row').forEach((row, i) => {
    const s = sessions[i];
    row.querySelector('h3').textContent = s.title;
    const when = s.recurring_rule ? `Every ${s.recurring_rule.replace('weekly:', '')}` : formatDate(s.start_time);
    row.querySelector('.session-meta').textContent =
      `${when} · ${formatTime(s.start_time)} · ${s.duration_minutes} minutes · ${s.platform || ''}`;
    row.querySelector('.session-desc').textContent = s.description || '';

    const link = row.querySelector('a');
    if (s.meeting_link && /^https?:\/\//i.test(s.meeting_link)) {
      link.href = s.meeting_link;
      link.hidden = false;
    } else {
      link.remove();
    }
  });

  const upcoming = sessions.find((s) => new Date(s.start_time) >= new Date());
  document.getElementById('statNextSession').textContent = upcoming
    ? `${formatDate(upcoming.start_time).split(',')[0]}, ${formatTime(upcoming.start_time)}` : 'None scheduled';
  document.getElementById('statNextSessionDesc').textContent = upcoming
    ? `${upcoming.title} — ${upcoming.platform || ''}` : '';
}

async function loadAnnouncements(moduleId) {
  const { data } = await supabase
    .from('announcements')
    .select('*')
    .eq('module_id', moduleId)
    .order('created_at', { ascending: false });
  return data || [];
}

function renderAnnouncements(items) {
  const list = document.getElementById('announcementList');
  if (!items.length) {
    list.innerHTML = '<p>No announcements yet.</p>';
  } else {
    list.innerHTML = items.map((a) => `
      <article class="announcement">
        <h3></h3>
        <p></p>
        <p class="announcement-date"></p>
      </article>
    `).join('');
    list.querySelectorAll('.announcement').forEach((el, i) => {
      el.querySelector('h3').textContent = items[i].title;
      el.querySelector('p').textContent = items[i].body;
      el.querySelector('.announcement-date').textContent = `Posted ${formatDate(items[i].created_at)}`;
    });
  }
  document.getElementById('statAnnouncements').textContent = items.length;
  document.getElementById('statAnnouncementsDesc').textContent = items.length ? `Latest: ${items[0].title}` : '';
}

async function openResourceDownload(storagePath) {
  const { data, error } = await supabase.storage.from('resources').createSignedUrl(storagePath, 60);
  if (error) { alert(error.message); return; }
  window.open(data.signedUrl, '_blank', 'noopener');
}

async function loadResources(moduleId, category) {
  const { data } = await supabase
    .from('resources')
    .select('*')
    .eq('module_id', moduleId)
    .eq('category', category)
    .order('uploaded_at', { ascending: false });
  return data || [];
}

function renderResourceList(listId, items) {
  const list = document.getElementById(listId);
  if (!items.length) {
    list.innerHTML = '<li><span>Nothing uploaded yet.</span></li>';
    return;
  }
  list.innerHTML = items.map(() => `<li><span></span><a href="#" data-action="download">Download</a></li>`).join('');
  list.querySelectorAll('li').forEach((li, i) => {
    li.querySelector('span').textContent = items[i].file_name;
    li.querySelector('a').addEventListener('click', (e) => {
      e.preventDefault();
      openResourceDownload(items[i].storage_path);
    });
  });
}

async function loadRequests(studentId, moduleId) {
  const { data } = await supabase
    .from('support_requests')
    .select('*')
    .eq('student_id', studentId)
    .eq('module_id', moduleId)
    .order('created_at', { ascending: false });
  return data || [];
}

function requestTagClass(status) {
  return status === 'answered' || status === 'closed' ? 'tag tag-available' : 'tag tag-open';
}

function renderRequests(items) {
  const list = document.getElementById('requestList');
  if (!items.length) {
    list.innerHTML = '<li><p>You haven\u2019t sent any requests yet.</p></li>';
  } else {
    list.innerHTML = items.map(() => `
      <li>
        <div>
          <h4></h4>
          <p class="request-message"></p>
          <p class="request-response" hidden></p>
        </div>
        <span class="tag"></span>
      </li>
    `).join('');
    list.querySelectorAll('li').forEach((li, i) => {
      const r = items[i];
      li.querySelector('h4').textContent = r.topic;
      li.querySelector('.request-message').textContent = `"${r.message}"`;
      const tag = li.querySelector('.tag');
      tag.textContent = r.status.replace('_', ' ');
      tag.className = requestTagClass(r.status);
      if (r.response) {
        const responseEl = li.querySelector('.request-response');
        responseEl.hidden = false;
        responseEl.textContent = `Tutor: "${r.response}"`;
      }
    });
  }
  const open = items.filter((r) => r.status === 'open' || r.status === 'in_progress');
  document.getElementById('statRequests').textContent = `${open.length} open`;
  document.getElementById('statRequestsDesc').textContent = open.length ? `Waiting on a reply about ${open[0].topic}` : 'No open requests';
}

async function loadNotifications(userId) {
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);
  return data || [];
}

function renderNotifications(items) {
  const list = document.getElementById('notificationList');
  if (!items.length) {
    list.innerHTML = '<li><p>No notifications yet.</p></li>';
    return;
  }
  list.innerHTML = items.map(() => `
    <li>
      <span class="dot"></span>
      <p></p>
      <span class="notif-date"></span>
    </li>
  `).join('');
  list.querySelectorAll('li').forEach((li, i) => {
    li.querySelector('p').textContent = items[i].message;
    li.querySelector('.notif-date').textContent = formatDate(items[i].created_at);
  });
}

async function init() {
  const ctx = await requireProfile(['student']);
  if (!ctx) return;
  const { profile } = ctx;
  currentStudentId = profile.id;

  document.getElementById('headerUserName').textContent = profile.full_name;
  document.getElementById('headerAvatar').textContent = initials(profile.full_name);
  document.getElementById('logoutLink').addEventListener('click', (e) => { e.preventDefault(); signOut(); });

  try {
    const moduleCode = new URLSearchParams(window.location.search).get('module');
    const subscription = await loadSubscription(profile.id, moduleCode);

    if (!subscription) {
      document.getElementById('emptyState').hidden = false;
      return;
    }

    currentSubscription = subscription;
    currentModule = subscription.modules;
    document.getElementById('dashboardShell').hidden = false;

    renderLetterhead(subscription, currentModule);

    const [tutor, sessions, announcements, notes, guides, papers, requests, notifications] = await Promise.all([
      loadTutor(currentModule.id),
      loadSessions(currentModule.id),
      loadAnnouncements(currentModule.id),
      loadResources(currentModule.id, 'notes'),
      loadResources(currentModule.id, 'study_guide'),
      loadResources(currentModule.id, 'past_paper'),
      loadRequests(profile.id, currentModule.id),
      loadNotifications(profile.id),
    ]);

    renderTutorProfile(tutor);
    renderSessions(sessions);
    renderAnnouncements(announcements);
    renderResourceList('notesList', notes);
    renderResourceList('guidesList', guides);
    renderResourceList('papersList', papers);
    renderRequests(requests);
    renderNotifications(notifications);
  } catch (err) {
    showFatalError(`Couldn't load your dashboard: ${err.message}. Check your connection and try refreshing.`);
  }
}

const requestForm = document.getElementById('requestForm');
if (requestForm) {
  requestForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentModule || !currentStudentId) return;

    const topic = document.getElementById('reqTopic').value.trim();
    const message = document.getElementById('reqMessage').value.trim();
    if (!topic || !message) return;

    const { error } = await supabase.from('support_requests').insert({
      student_id: currentStudentId,
      module_id: currentModule.id,
      topic,
      message,
    });

    if (error) {
      alert(error.message);
      return;
    }

    requestForm.reset();
    renderRequests(await loadRequests(currentStudentId, currentModule.id));
  });
}

init();
