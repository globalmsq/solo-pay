/** Check if running on mobile device */
export function isMobile(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

/** Inject CSS styles into the document */
export function injectStyles(css: string, id: string): void {
  if (typeof document === 'undefined') return;

  // Remove existing style element if present
  const existing = document.getElementById(id);
  if (existing) {
    existing.remove();
  }

  const style = document.createElement('style');
  style.id = id;
  style.textContent = css;
  document.head.appendChild(style);
}

/** Lock body scroll (for modals) */
export function lockBodyScroll(): () => void {
  if (typeof document === 'undefined') return () => {};

  const scrollY = window.scrollY;
  const body = document.body;
  const originalStyle = body.style.cssText;

  body.style.cssText = `
    position: fixed;
    top: -${scrollY}px;
    left: 0;
    right: 0;
    overflow: hidden;
  `;

  return () => {
    body.style.cssText = originalStyle;
    window.scrollTo(0, scrollY);
  };
}

/** Watch for dark mode changes */
export function watchDarkMode(callback: (isDark: boolean) => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return () => {};
  }

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = (e: MediaQueryListEvent) => callback(e.matches);

  mediaQuery.addEventListener('change', handler);
  return () => mediaQuery.removeEventListener('change', handler);
}
