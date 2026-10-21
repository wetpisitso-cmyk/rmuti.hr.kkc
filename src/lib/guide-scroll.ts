/**
 * Scroll within handbook pages without changing the URL fragment.
 * The app uses HashRouter, so href="#section-id" would replace the route.
 */
export function scrollToGuideSection(id: string): void {
  const target = document.getElementById(id);
  if (!target) return;

  // Let keyboard and assistive technology users follow the selected heading.
  target.tabIndex = -1;
  target.focus({ preventScroll: true });
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
}
