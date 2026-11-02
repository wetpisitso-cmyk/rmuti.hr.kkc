import { describe, expect, it } from "vitest";
import {
  documentAccept, documentFormatLabel, validateDocumentUploadFile,
} from "../src/lib/document-file-policy";

const file = (name: string, type: string) => ({ name, type });

describe("new applicant upload format policy", () => {
  it("requires PDF for all normal and future document requirements", () => {
    for (const key of ["degree", "transcript", "id_card", "house_registration",
      "military", "name_change", "other", "certificates", "new_document"]) {
      expect(documentAccept(key)).toContain("application/pdf");
      expect(documentAccept(key)).not.toContain("image/jpeg");
      expect(documentFormatLabel(key)).toBe("PDF เท่านั้น");
      expect(validateDocumentUploadFile(key, file("document.pdf", "application/pdf"))).toBeNull();
      expect(validateDocumentUploadFile(key, file("document.JPG", "image/jpeg"))).toBe("PDF_ONLY_REQUIRED");
      expect(validateDocumentUploadFile(key, file("document.png", "image/png"))).toBe("PDF_ONLY_REQUIRED");
    }
  });

  it("accepts photo images but never a PDF for the portrait", () => {
    expect(documentFormatLabel("photo")).toBe("JPG / PNG");
    expect(validateDocumentUploadFile("photo", file("portrait.JPG", "image/jpeg"))).toBeNull();
    expect(validateDocumentUploadFile("photo", file("portrait.png", "image/png"))).toBeNull();
    expect(validateDocumentUploadFile("photo", file("portrait.pdf", "application/pdf"))).toBe("PHOTO_IMAGE_ONLY");
  });

  it("keeps payment slips compatible with PDF and images", () => {
    expect(documentFormatLabel("payment")).toBe("PDF / JPG / PNG");
    for (const entry of [
      file("slip.pdf", "application/pdf"),file("slip.jpeg", "image/jpeg"),
      file("slip.png", "image/png"),
    ]) {
      expect(validateDocumentUploadFile("payment", entry)).toBeNull();
    }
  });

  it("rejects mismatched extensions to help catch incorrectly named files", () => {
    expect(validateDocumentUploadFile("degree", file("test.jpg", "application/pdf"))).toBe("PDF_ONLY_REQUIRED");
    expect(validateDocumentUploadFile("photo", file("photo.pdf", "image/jpeg"))).toBe("PHOTO_IMAGE_ONLY");
    expect(validateDocumentUploadFile("payment", file("slip.webp", "image/webp"))).toBe("PAYMENT_FILE_TYPE_INVALID");
  });
});
