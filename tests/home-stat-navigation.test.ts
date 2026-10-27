import { describe, expect, it } from "vitest";
import { getHomeStatDestination } from "../src/lib/home-stat-navigation";
describe("home stat card navigation", () => {
  it("positions shows all job filters", () => {
    expect(getHomeStatDestination("positions", true)).toEqual({
      section: "positions", filter: "all", vacanciesFirst: false,
    });
  });
  it("vacancies shows open jobs ordered by vacancies", () => {
    expect(getHomeStatDestination("vacancies", true)).toEqual({
      section: "home-job-results", filter: "open", vacanciesFirst: true,
    });
  });
  it("open status reveals open positions", () => {
    expect(getHomeStatDestination("status", true)).toEqual({
      section: "home-job-results", filter: "open", vacanciesFirst: false,
    });
  });
  it("closed status shows announcements", () => {
    expect(getHomeStatDestination("status", false)).toEqual({
      section: "home-news-section", filter: "all", vacanciesFirst: false,
    });
  });
});