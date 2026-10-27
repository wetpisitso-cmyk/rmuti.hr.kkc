/**
 * GitHub Pages uses HashRouter (#/jobs/id). A plain href="#positions"
 * replaces the router hash, so summary cards must scroll inside the Home
 * route instead of changing the URL fragment.
 */
export type HomeStatAction = "positions" | "vacancies" | "status";

export interface HomeStatDestination {
  section: "positions" | "home-job-results" | "home-news-section";
  filter: "all" | "open";
  vacanciesFirst: boolean;
}
export function getHomeStatDestination(
  action: HomeStatAction,
  hasOpenJobs: boolean,
): HomeStatDestination {
  if (action === "vacancies") {
    return { section: "home-job-results", filter: "all", vacanciesFirst: true };
  }
  if (action === "status") {
    return hasOpenJobs
      ? { section: "home-job-results", filter: "open", vacanciesFirst: false }
      : { section: "home-news-section", filter: "all", vacanciesFirst: false };
  }
  return { section: "positions", filter: "all", vacanciesFirst: false };
}
