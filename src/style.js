// import bootstrap css
import './style.scss';

// detect and set dark mode by users preference
export default function setTheme() {
  const theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.setAttribute('data-bs-theme', theme);
}
