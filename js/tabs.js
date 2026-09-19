// ===== Sidebar tab / panel switching (shared by dashboard + admin) =====
const dashTabs = document.querySelectorAll('.dash-tab');
const dashPanels = document.querySelectorAll('.dash-panel');

dashTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    dashTabs.forEach((t) => t.classList.remove('is-active'));
    dashPanels.forEach((p) => p.classList.remove('is-active'));

    tab.classList.add('is-active');
    const panel = document.getElementById(`panel-${tab.dataset.panel}`);
    if (panel) panel.classList.add('is-active');
  });
});
