// Server-side Google Drive API client for RMUTI KKC's private Shared Drive.
// No Drive credential may be included in VITE_* variables or public GitHub code.
const DRIVE_API = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3/files";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_ID = "[A-Za-z0-9_-]{10,200}";
const DRIVE_PATH = new RegExp(
  "^([0-9a-f-]{36})/([0-9a-f-]{36})/gdrive/(" + GOOGLE_ID + ")\\.(pdf|jpg|png)$", "i",
);
type Credentials = { client_email: string; private_key: string; type: string };
let cachedToken: { token: string; expires: number } | null = null;

export function driveEnabled(): boolean {
  return Deno.env.get("GDRIVE_ENABLED") === "true";
}

export function parseDrivePath(path: string) {
  const match = DRIVE_PATH.exec(path);
  if (!match) throw new Error("INVALID_DRIVE_PATH");
  return { userId: match[1], applicationId: match[2], fileId: match[3], ext: match[4].toLowerCase() };
}

export function drivePath(userId: string, applicationId: string, fileId: string, ext: string) {
  const path = userId + "/" + applicationId + "/gdrive/" + fileId + "." + ext;
  parseDrivePath(path);
  return path;
}

function folderId() {
  const id = Deno.env.get("GDRIVE_FOLDER_ID") || "";
  if (!new RegExp("^" + GOOGLE_ID + "$").test(id)) throw new Error("GDRIVE_FOLDER_NOT_CONFIGURED");
  return id;
}

function credentials(): Credentials {
  const raw = Deno.env.get("GDRIVE_SERVICE_ACCOUNT_JSON");
  if (!raw) throw new Error("GDRIVE_CREDENTIALS_MISSING");
  const value: Credentials = JSON.parse(raw);
  if (value.type !== "service_account" ||
      !value.client_email?.endsWith("@rmuti-kkc.iam.gserviceaccount.com") ||
      !value.private_key?.includes("-----BEGIN PRIVATE KEY-----")) {
    throw new Error("GDRIVE_CREDENTIALS_INVALID");
  }
  return value;
}

function base64url(bytes: Uint8Array) {
  let bin = "";
  for (const byte of bytes) bin += String.fromCharCode(byte);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expires > Date.now() + 60_000) return cachedToken.token;
  const sa = credentials();
  const now = Math.floor(Date.now() / 1000);
  const encoder = new TextEncoder();
  const head = base64url(encoder.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const payload = base64url(encoder.encode(JSON.stringify({
    iss: sa.client_email, scope: "https://www.googleapis.com/auth/drive",
    aud: TOKEN_URL, iat: now, exp: now + 3600,
  })));
  const unsigned = head + "." + payload;
  const der = Uint8Array.from(atob(
    sa.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s+/g, ""),
  ), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"],
  );
  const signature = new Uint8Array(await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5", key, encoder.encode(unsigned),
  ));
  const assertion = unsigned + "." + base64url(signature);
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion,
    }),
  });
  if (!response.ok) throw new Error("GDRIVE_AUTH_FAILED");
  const data = await response.json();
  if (!data.access_token || typeof data.expires_in !== "number") {
    throw new Error("GDRIVE_AUTH_FAILED");
  }
  cachedToken = { token: data.access_token, expires: Date.now() + data.expires_in * 1000 };
  return cachedToken.token;
}

async function api(url: string, init: RequestInit = {}): Promise<Response> {
  const token = await accessToken();
  return fetch(url, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: "Bearer " + token },
  });
}

export async function uploadDrive(data: Uint8Array, mime: string, ext: string): Promise<string> {
  const parent = folderId();
  const filename = "document-" + crypto.randomUUID() + "." + ext;
  // Drive v3 multipart/related upload: metadata first, binary second.
  const boundary = "rmuti-" + crypto.randomUUID();
  const lead = "--" + boundary + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify({ name: filename, mimeType: mime, parents: [parent] }) +
    "\r\n--" + boundary + "\r\nContent-Type: " + mime + "\r\n\r\n";
  const tail = "\r\n--" + boundary + "--\r\n";
  const body = new Blob([new TextEncoder().encode(lead), data, new TextEncoder().encode(tail)]);
  const response = await api(
    DRIVE_UPLOAD_API + "?uploadType=multipart&supportsAllDrives=true&fields=id,parents,size,mimeType",
    { method: "POST", headers: { "Content-Type": "multipart/related; boundary=" + boundary }, body },
  );
  if (!response.ok) throw new Error("GDRIVE_UPLOAD_FAILED");
  const file = await response.json();
  if (!file.id || !new RegExp("^" + GOOGLE_ID + "$").test(file.id)) throw new Error("GDRIVE_UPLOAD_INVALID");
  if (!Array.isArray(file.parents) || !file.parents.includes(parent) ||
      Number(file.size) !== data.byteLength || file.mimeType !== mime) {
    // Never leave a possibly misplaced/partial applicant document accessible.
    try { await deleteDrive(file.id); } catch { /* separately audit orphan if cleanup fails */ }
    throw new Error("GDRIVE_UPLOAD_VERIFICATION_FAILED");
  }
  return file.id;
}

export async function deleteDrive(fileId: string): Promise<void> {
  if (!new RegExp("^" + GOOGLE_ID + "$").test(fileId)) throw new Error("INVALID_DRIVE_FILE_ID");
  const result = await api(DRIVE_API + "/" + encodeURIComponent(fileId) + "?supportsAllDrives=true", {
    method: "DELETE",
  });
  if (!result.ok && result.status !== 404) throw new Error("GDRIVE_DELETE_FAILED");
}

export async function readDrive(path: string): Promise<Uint8Array> {
  const { fileId, ext } = parseDrivePath(path);
  // Even if a reference is compromised, never read files outside the approved folder.
  const location = await api(
    DRIVE_API + "/" + encodeURIComponent(fileId) +
    "?supportsAllDrives=true&fields=id,parents,mimeType,size",
  );
  if (!location.ok) throw new Error("GDRIVE_FILE_NOT_FOUND");
  const meta = await location.json();
  const expectedMime = ext === "pdf" ? "application/pdf" : ext === "png" ? "image/png" : "image/jpeg";
  if (!meta.parents?.includes(folderId()) || meta.mimeType !== expectedMime ||
      Number(meta.size) > 3 * 1048576) throw new Error("GDRIVE_FILE_INVALID");
  const result = await api(
    DRIVE_API + "/" + encodeURIComponent(fileId) + "?alt=media&supportsAllDrives=true",
  );
  if (!result.ok) throw new Error("GDRIVE_DOWNLOAD_FAILED");
  const bytes = new Uint8Array(await result.arrayBuffer());
  if (bytes.byteLength < 1 || bytes.byteLength > 3 * 1048576) throw new Error("GDRIVE_FILE_INVALID");
  return bytes;
}
