// ===== My modules: subscribed modules + browsing/subscribing with a simulated payment step =====

let currentStudentId = null;
let selectedModule = null;

async function loadSubscriptions(studentId) {
  const { data } = await supabase
    .from('subscriptions')
    .select('*, modules(*)')
    .eq('student_id', studentId)
    .eq('status', 'active');
  return data || [];
}

async function loadAllModules() {
  const { data } = await supabase.from('modules').select('*').eq('status', 'available').order('code');
  return data || [];
}

function renderMyModules(subscriptions) {
  const container = document.getElementById('myModulesList');
  if (!subscriptions.length) {
    container.innerHTML = '<p>You haven\u2019t subscribed to a module yet — pick one below to get started.</p>';
    return;
  }
  container.innerHTML = subscriptions.map(() => `
    <div class="module-card">
      <span class="notch"></span>
      <span class="card-code"></span>
      <h3 class="card-title"></h3>
      <div class="card-footer">
        <div class="card-price">
          <span class="tag tag-available"></span>
          <span class="letterhead-expiry"></span>
        </div>
        <a class="btn btn-primary btn-sm" href="#">Open dashboard</a>
      </div>
    </div>
  `).join('');
  container.querySelectorAll('.module-card').forEach((card, i) => {
    const s = subscriptions[i];
    card.querySelector('.card-code').textContent = s.modules.code;
    card.querySelector('.card-title').textContent = s.modules.name;
    card.querySelector('.tag').textContent = 'Active';
    card.querySelector('.letterhead-expiry').textContent = `Renews ${formatDate(s.expiry_date)}`;
    card.querySelector('a').href = `dashboard.html?module=${s.modules.code}`;
  });
}

function renderAvailableModules(allModules, subscriptions) {
  const subscribedIds = new Set(subscriptions.map((s) => s.modules.id));
  const remaining = allModules.filter((m) => !subscribedIds.has(m.id));
  const container = document.getElementById('availableModulesList');

  if (!remaining.length) {
    container.innerHTML = '<p>You\u2019re subscribed to every available module.</p>';
    return;
  }

  container.innerHTML = remaining.map(() => `
    <div class="module-card">
      <span class="notch"></span>
      <span class="card-code"></span>
      <h3 class="card-title"></h3>
      <p class="card-desc"></p>
      <div class="card-footer">
        <div class="card-price"><strong>R</strong>&nbsp;<span class="price-amount"></span> / month</div>
        <button class="btn btn-primary btn-sm" data-action="subscribe" type="button">Subscribe</button>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.module-card').forEach((card, i) => {
    const m = remaining[i];
    card.querySelector('.card-code').textContent = m.code;
    card.querySelector('.card-title').textContent = m.name;
    card.querySelector('.card-desc').textContent = m.description || '';
    card.querySelector('.price-amount').textContent = m.price;
    card.querySelector('[data-action="subscribe"]').addEventListener('click', () => openPaymentModal(m));
  });
}

function addOneMonth(date) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().split('T')[0];
}

const paymentModal = document.getElementById('paymentModal');
const modalPay = document.getElementById('modalPay');
const modalCancel = document.getElementById('modalCancel');
const modalStatus = document.getElementById('modalStatus');

function openPaymentModal(module) {
  selectedModule = module;
  document.getElementById('modalModuleName').textContent = `${module.code} — ${module.name}`;
  document.getElementById('modalAmount').textContent = module.price;
  modalStatus.hidden = true;
  modalPay.disabled = false;
  modalPay.textContent = 'Pay now';
  paymentModal.showModal();
}

modalCancel.addEventListener('click', () => paymentModal.close());

modalPay.addEventListener('click', async () => {
  if (!selectedModule) return;
  modalPay.disabled = true;
  modalPay.textContent = 'Processing…';
  modalStatus.hidden = false;
  modalStatus.textContent = 'Processing simulated payment…';

  try {
    await new Promise((resolve) => setTimeout(resolve, 700));

    const { error } = await supabase.from('subscriptions').insert({
      student_id: currentStudentId,
      module_id: selectedModule.id,
      amount: selectedModule.price,
      expiry_date: addOneMonth(new Date()),
    });

    if (error) {
      modalStatus.textContent = `Payment failed: ${error.message}`;
      modalPay.disabled = false;
      modalPay.textContent = 'Pay now';
      return;
    }

    modalStatus.textContent = 'Payment successful — module joined!';
    await new Promise((resolve) => setTimeout(resolve, 900));
    paymentModal.close();

    const [subscriptions, allModules] = await Promise.all([loadSubscriptions(currentStudentId), loadAllModules()]);
    renderMyModules(subscriptions);
    renderAvailableModules(allModules, subscriptions);
  } catch (err) {
    modalStatus.textContent = `Couldn't reach Supabase: ${err.message}`;
    modalPay.disabled = false;
    modalPay.textContent = 'Pay now';
  }
});

async function init() {
  const ctx = await requireProfile(['student']);
  if (!ctx) return;
  const { profile } = ctx;
  currentStudentId = profile.id;

  document.getElementById('headerUserName').textContent = profile.full_name;
  document.getElementById('headerAvatar').textContent = initials(profile.full_name);
  document.getElementById('logoutLink').addEventListener('click', (e) => { e.preventDefault(); signOut(); });

  try {
    const [subscriptions, allModules] = await Promise.all([loadSubscriptions(profile.id), loadAllModules()]);
    renderMyModules(subscriptions);
    renderAvailableModules(allModules, subscriptions);
  } catch (err) {
    showFatalError(`Couldn't load your modules: ${err.message}. Check your connection and try refreshing.`);
  }
}

init();
