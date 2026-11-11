import {describe,expect,it} from "vitest";
import {isStaffNoticeResolved} from "../src/lib/staff-notice-status";

describe("staff application notification triage",()=>{
  const reviewed=new Set(["reviewed"]);
  it("keeps a newly submitted, unread application in the active inbox",()=>{
    expect(isStaffNoticeResolved({application_id:"new",read_at:null},reviewed)).toBe(false);
  });
  it("removes an already-read notice even if the review is still pending",()=>{
    expect(isStaffNoticeResolved({application_id:"new",read_at:"2026-11-11T07:00:00Z"},reviewed)).toBe(true);
  });
  it("removes a reviewed application without depending on the read flag",()=>{
    expect(isStaffNoticeResolved({application_id:"reviewed",read_at:null},reviewed)).toBe(true);
  });
  it("keeps orphaned, unread history visible until it is marked read",()=>{
    expect(isStaffNoticeResolved({application_id:null,read_at:null},reviewed)).toBe(false);
  });
});
