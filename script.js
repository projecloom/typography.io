/* ═══════════════════════════════════════════════════════
   TYPOREEL v4 — LANDING PAGE SCRIPTS
   ═══════════════════════════════════════════════════════ */

/* ── TAB SWITCHING ── */
function showTab(id) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.getElementById('tab-' + id).classList.add('active');
  event.target.classList.add('active');
}

/* ── DIALOG ── */
function closeDialog() {
  const d = document.getElementById('notification');
  d.style.transition = 'transform 0.3s ease';
  d.style.transform = 'translateX(400px)';
  setTimeout(() => d.style.display = 'none', 300);
}

// Auto-dismiss dialog after 12 seconds
setTimeout(closeDialog, 12000);

/* ── SMOOTH SCROLL ── */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });
});

/* ── FX TAG ANIMATION ON SCROLL ── */
const tags = document.querySelectorAll('.fx-tag');

const observer = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      const i = Array.from(tags).indexOf(e.target);
      e.target.style.animationDelay = (i * 0.025) + 's';
      e.target.style.animation = 'tagPop 0.4s cubic-bezier(0.34,1.56,0.64,1) both';
      observer.unobserve(e.target);
    }
  });
}, { threshold: 0.1 });

tags.forEach(t => observer.observe(t));
