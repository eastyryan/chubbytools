const root = document.documentElement;
const STORAGE_KEY = 'chubby-theme';

const saved = localStorage.getItem(STORAGE_KEY);
if (saved) root.setAttribute('data-theme', saved);

const btns = document.querySelectorAll('.theme-toggle button');

function syncButtons() {
  const current = root.getAttribute('data-theme') || 'light';
  btns.forEach(b => b.classList.toggle('active', b.dataset.mode === current));
}

syncButtons();

btns.forEach(b => b.addEventListener('click', () => {
  root.setAttribute('data-theme', b.dataset.mode);
  localStorage.setItem(STORAGE_KEY, b.dataset.mode);
  syncButtons();
}));
