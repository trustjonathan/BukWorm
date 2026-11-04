export const LAUNCH_BACKGROUND = "#0b1220"

export const LAUNCH_CRITICAL_CSS = `
:root {
  color-scheme: dark;
  --matrix-launch-background: ${LAUNCH_BACKGROUND};
}
html,
body {
  min-height: 100%;
  margin: 0;
  background: var(--matrix-launch-background);
}
body {
  min-height: 100vh;
  min-height: 100dvh;
}
html:has(.matrix-launch-screen),
body:has(.matrix-launch-screen) {
  overflow: hidden;
  overscroll-behavior: none;
}
.matrix-launch-screen {
  position: fixed;
  z-index: 2147483000;
  inset: 0;
  display: grid;
  overflow: hidden;
  place-items: center;
  background: var(--matrix-launch-background);
  color: #f1f5f9;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  text-align: center;
  opacity: 1;
  transition: opacity 200ms ease;
}
.matrix-launch-screen[data-state="leaving"] {
  pointer-events: none;
  opacity: 0;
}
.matrix-launch-screen .matrix-launch-content {
  display: grid;
  width: min(100% - 2rem, 24rem);
  justify-items: center;
  gap: 1.5rem;
  padding: 1.5rem;
}
.matrix-launch-screen .matrix-launch-mark {
  width: 5.5rem;
  height: 5.5rem;
  object-fit: contain;
  filter: drop-shadow(0 0 1.25rem rgb(34 211 238 / 18%));
  animation: matrix-launch-pulse 2.4s ease-in-out infinite;
}
.matrix-launch-screen .matrix-launch-status {
  min-height: 1.5rem;
  margin: 0;
  color: #aab8ca;
  font-size: 0.9375rem;
  line-height: 1.5;
}
.matrix-launch-screen .matrix-launch-delayed {
  visibility: hidden;
  opacity: 0;
  animation: matrix-launch-reveal 0s 6s forwards;
}
.matrix-launch-screen .matrix-launch-actions {
  visibility: hidden;
  opacity: 0;
  animation: matrix-launch-reveal 0s 15s forwards;
}
.matrix-launch-screen .matrix-launch-retry {
  min-height: 2.75rem;
  padding: 0.7rem 1.25rem;
  border: 0;
  border-radius: 0.75rem;
  background: #67e8f9;
  color: #0b1220;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}
.matrix-launch-screen .matrix-launch-retry:focus-visible {
  outline: 3px solid #f1f5f9;
  outline-offset: 3px;
}
@keyframes matrix-launch-pulse {
  0%, 100% { opacity: 0.82; transform: scale(0.97); }
  50% { opacity: 1; transform: scale(1.03); }
}
@keyframes matrix-launch-reveal {
  to { visibility: visible; opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .matrix-launch-screen *,
  .matrix-launch-screen *::before,
  .matrix-launch-screen *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
`

export const THEME_BOOTSTRAP_SCRIPT = `
(function () {
  var root = document.documentElement;
  var theme = "dark";
  try {
    var savedTheme = localStorage.getItem("theme");
    theme =
      savedTheme === "light" || savedTheme === "dark"
        ? savedTheme
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
  } catch (error) {
    theme = "dark";
  }
  root.classList.remove("light", "dark");
  root.classList.add(theme);
  root.style.colorScheme = theme;
})();
`
