import { describe, expect, it } from "vitest";
import type { Job } from "../src/types/models";
import {
  addCalendarMonths, bangkokDateKey, calendarDateKey, calendarMonthGrid,
  jobsInCalendarMonth, jobsOnCalendarDay, publishedRecruitmentJobs, recruitmentPhase,
} from "../src/lib/recruitment-calendar";

function makeJob(id: string, start: string, end: string, options: {
  published?: boolean; archived?: boolean; roundPublished?: boolean; roundArchived?: boolean;
} = {}): Job {
  return {
    id, title: id, round_id: id, department_id:id, category: "support",
    employment_type:"ลูกจ้างเงินรายได้", vacancies:1, qualifications:"",
    required_documents:[], require_national_id:false, fee_amount:0,
    payment_instructions:"", announcement_url:"", max_file_mb:3,
    published: options.published ?? true,
    archived:options.archived ?? false,
    recruitment_rounds: {
      id, name:id, description:"", year_be:2569,
      opens_at:start, closes_at:end, max_per_user:1,
      published: options.roundPublished ?? true,
      archived: options.roundArchived ?? false,
    },
    departments: { id, name:"ฝ่ายบุคคล", archived:false },
  };
}

describe("public recruitment calendar", () => {
  const early = makeJob("early", "2026-11-01T17:00:00Z", "2026-11-06T16:59:00Z");
  const later = makeJob("later", "2026-11-08T17:00:00Z", "2026-11-13T16:59:00Z");
  it("uses Bangkok date, not UTC, for the opening day", () => {
    expect(bangkokDateKey(early.recruitment_rounds.opens_at)).toBe("2026-11-02");
    expect(bangkokDateKey(early.recruitment_rounds.closes_at)).toBe("2026-11-06");
  });
  it("renders November 2026 with Sunday-first alignment (Nov 1 is Sunday)", () => {
    const grid=calendarMonthGrid(2026,11);
    expect(grid[0]).toBe(1);
    expect(grid[29]).toBe(30);
    expect(grid.length%7).toBe(0);
    expect(calendarDateKey(2026,11,2)).toBe("2026-11-02");
  });
  it("accounts for months beginning on other weekdays and leap days", () => {
    expect(calendarMonthGrid(2024,2).filter(Boolean).length).toBe(29);
    expect(calendarMonthGrid(2026,12).slice(0,2)).toEqual([null,null]);
    expect(addCalendarMonths(2026,12,1)).toEqual({year:2027,month:1});
    expect(addCalendarMonths(2027,1,-1)).toEqual({year:2026,month:12});
  });
  it("includes opening and closing calendar dates", () => {
    expect(jobsOnCalendarDay([early],"2026-11-02").map(x=>x.id)).toEqual(["early"]);
    expect(jobsOnCalendarDay([early],"2026-11-06").map(x=>x.id)).toEqual(["early"]);
    expect(jobsOnCalendarDay([early],"2026-11-07")).toEqual([]);
  });
  it("lists overlapping positions and shows only jobs relevant to the month", () => {
    expect(jobsOnCalendarDay([early,later],"2026-11-10").map(x=>x.id)).toEqual(["later"]);
    expect(jobsInCalendarMonth([early,later],2026,11).map(x=>x.id)).toEqual(["early","later"]);
    expect(jobsInCalendarMonth([early,later],2026,12)).toEqual([]);
  });
  it("hides unpublished and archived recruitment even when dates match", () => {
    const hidden=makeJob("hidden","2026-11-01T17:00:00Z","2026-11-06T16:59:00Z",{roundPublished:false});
    const archived=makeJob("archived","2026-11-01T17:00:00Z","2026-11-06T16:59:00Z",{archived:true});
    expect(publishedRecruitmentJobs([early,hidden,archived]).map(x=>x.id)).toEqual(["early"]);
  });
  it("separates upcoming, open, closing soon, and closed by actual time", () => {
    expect(recruitmentPhase(early,Date.parse("2026-11-01T16:59:00Z"))).toBe("upcoming");
    expect(recruitmentPhase(early,Date.parse("2026-11-03T00:00:00Z"))).toBe("open");
    expect(recruitmentPhase(early,Date.parse("2026-11-05T00:00:00Z"))).toBe("closing");
    expect(recruitmentPhase(early,Date.parse("2026-11-06T17:00:00Z"))).toBe("closed");
  });
});
