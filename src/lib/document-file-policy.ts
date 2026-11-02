/**
 * File-format rules for NEW and REPLACEMENT applicant uploads.
 * Historical attachments are not converted or removed.
 */
const IMAGE_MIME = ["image/jpeg", "image/png"] as const;

export function documentAccept(documentType: string): string {
  if (documentType === "photo") return ".jpg,.jpeg,.png,image/jpeg,image/png";
  if (documentType === "payment") return ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";
  return ".pdf,application/pdf";
}

export function documentFormatLabel(documentType: string): string {
  if (documentType === "photo") return "JPG / PNG";
  if (documentType === "payment") return "PDF / JPG / PNG";
  return "PDF เท่านั้น";
}

export function validateDocumentUploadFile(
  documentType: string,
  file: Pick<File, "name" | "type">,
): string | null {
  const mime = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  if (documentType === "photo") {
    return IMAGE_MIME.some((allowed) => allowed === mime) &&
      /\.(jpe?g|png)$/.test(name) ? null : "PHOTO_IMAGE_ONLY";
  }
  if (documentType === "payment") {
    const validPdf = mime === "application/pdf" && /\.pdf$/.test(name);
    const validImage = IMAGE_MIME.some((allowed) => allowed === mime) &&
      /\.(jpe?g|png)$/.test(name);
    return validPdf || validImage ? null : "PAYMENT_FILE_TYPE_INVALID";
  }
  return mime === "application/pdf" && /\.pdf$/.test(name)
    ? null : "PDF_ONLY_REQUIRED";
}
