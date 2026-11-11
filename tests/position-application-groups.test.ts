import { describe, expect, it } from "vitest";
import { formatPositionRecruitmentPeriods, groupPositionApplicationBars, positionStatus, type PositionWithWindow } from "../src/lib/position-application-groups";

const now = Date.parse("2026-11-11T08:00:00Z");
const window = { year_be:2569, opens_at:"2026-11-08T17:00:00Z", closes_at:"2026-11-13T16:59:00Z", published:true, archived:false };
const job = (id:string, title:string, change:Partial<PositionWithWindow> = {}): PositionWithWindow => ({
  id, title, round_id:"round", department_id:"dept", published:true, archived:false, recruitment_rounds:window, ...change,
});
const filters = { year:"", round:"", job:"", department:"", status:"", search:"", from:"", to:"" };

describe("group the position chart by recruitment window", () => {
  it("keeps open positions expanded and includes positions with zero applications", () => {
    const result = groupPositionApplicationBars(
      [{name:"ช่างเทคนิค", value:2},{name:"เจ้าหน้าที่",value:181}],
      [job("1","ช่างเทคนิค"),job("2","ไฟฟ้า"),job("3","เจ้าหน้าที่",{recruitment_rounds:{...window,opens_at:"2026-10-25T17:00:00Z",closes_at:"2026-10-30T16:59:00Z"}})],
      filters, now,
    );
    expect(result.open.map(x=>[x.name,x.value])).toEqual([["ช่างเทคนิค",2],["ไฟฟ้า",0]]);
    expect(result.closed.map(x=>[x.name,x.value])).toEqual([["เจ้าหน้าที่",181]]);
    expect(result.open[0].period).toContain("9 พ.ย. 2569 ถึง 13 พ.ย. 2569");
    expect(result.closed[0].period).toContain("30 ต.ค. 2569");
  });
  it("separates upcoming rounds from already closed positions", () => {
    const upcoming = job("1","รอเปิด",{recruitment_rounds:{...window,opens_at:"2026-11-12T17:00:00Z"}});
    expect(positionStatus(upcoming,now)).toBe("upcoming");
    expect(positionStatus(job("2","ปิด",{archived:true}),now)).toBe("closed");
    expect(positionStatus(job("3","เปิด"),now)).toBe("open");
  });
  it("keeps applicant filters accurate without adding artificial zero applicants",()=>{
    const r = groupPositionApplicationBars([], [job("1","ช่างเทคนิค")], {...filters,status:"eligible"},now);
    expect(r.open).toEqual([]);
  });
  it("respects selected position and does not include unrelated zero-count positions",()=>{
    const r = groupPositionApplicationBars([], [job("1","ช่างเทคนิค"),job("2","ไฟฟ้า")], {...filters,job:"2"},now);
    expect(r.open.map(x=>[x.name,x.value])).toEqual([["ไฟฟ้า",0]]);
    expect(r.open[0].period).toBe("9 พ.ย. 2569 ถึง 13 พ.ย. 2569");
  });
  it("moves a position to closed when the exact closing instant has passed",()=>{
    const item=job("1","ช่างเทคนิค");
    expect(positionStatus(item,Date.parse(window.closes_at))).toBe("open");
    expect(positionStatus(item,Date.parse(window.closes_at)+1)).toBe("closed");
  });
  it("formats recruitment dates in Thai Buddhist Era using the Bangkok timezone",()=>{
    const result=formatPositionRecruitmentPeriods([job("date","ช่างเทคนิค",{
      recruitment_rounds:{...window,opens_at:"2026-11-08T17:00:00Z",closes_at:"2026-11-13T16:59:00Z"}
    })]);
    expect(result).toBe("9 พ.ย. 2569 ถึง 13 พ.ย. 2569");
  });
  it("keeps distinct date windows when job titles repeat across rounds",()=>{
    const earlier=job("old","ช่างเทคนิค",{recruitment_rounds:{...window,opens_at:"2026-10-25T17:00:00Z",closes_at:"2026-10-30T16:59:00Z"}});
    const latest=job("new","ช่างเทคนิค");
    const result=formatPositionRecruitmentPeriods([latest,earlier,earlier]);
    expect(result).toBe("26 ต.ค. 2569 ถึง 30 ต.ค. 2569 • 9 พ.ย. 2569 ถึง 13 พ.ย. 2569");
  });
  it("does not invent a date when the recruitment round is missing",()=>{
    expect(formatPositionRecruitmentPeriods([job("x","ไม่มีวัน",{recruitment_rounds:null})])).toBe("");
  });

});
