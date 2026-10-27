import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ThaiDateField } from "../src/components/ThaiDateField";

describe("ThaiDateField nullable saved dates", () => {
  const render = (value: string | null | undefined) =>
    renderToStaticMarkup(createElement(ThaiDateField, {
      label: "วันที่เริ่มงาน", value, onChange: () => {},
    }));
  it("renders a blank calendar input for database NULL", () => {
    const html = render(null);
    expect(html).toContain('placeholder="วว/ดด/พ.ศ."');
    expect(html).not.toContain('value="null"');
  });
  it("renders undefined and empty strings", () => {
    expect(render(undefined)).toContain('placeholder="วว/ดด/พ.ศ."');
    expect(render("")).toContain('placeholder="วว/ดด/พ.ศ."');
  });
  it("preserves a real ISO date", () => {
    expect(render("2026-10-27")).toContain('value="27/10/2569"');
  });
});
