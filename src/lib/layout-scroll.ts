/** 
 * A browser may restore a horizontal document scroll after a wide HR table
 * was viewed, hiding the sidebar and clipping the left side of the dashboard.
 * Do not reset scrollY: staff may be reviewing a long applicant list.
 */
export function resetPageHorizontalScroll(viewport: {
  scrollX: number;
  scrollY: number;
  scrollTo: (x: number, y: number) => void;
}): void {
  if (viewport.scrollX !== 0) {
    viewport.scrollTo(0, viewport.scrollY);
  }
}
