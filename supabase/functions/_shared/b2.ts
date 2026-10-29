import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "npm:@aws-sdk/client-s3@3.821.0";

// Never expose these secrets to the browser or GitHub Pages.
function settings() {
  const endpoint = Deno.env.get("B2_ENDPOINT") || "";
  const keyId = Deno.env.get("B2_KEY_ID") || "";
  const appKey = Deno.env.get("B2_APP_KEY") || "";
  const bucket = Deno.env.get("B2_BUCKET") || "";
  const match = /^https:\/\/s3\.([a-z0-9-]+)\.backblazeb2\.com\/?$/.exec(endpoint);
  if (!match || !keyId || !appKey || !bucket) throw new Error("B2_NOT_CONFIGURED");
  return {endpoint: endpoint.replace(/\/$/, ""), region:match[1], keyId, appKey, bucket};
}
function client() {
  const s = settings();
  return {bucket: s.bucket, s3: new S3Client({
    region: s.region,
    endpoint: s.endpoint,
    credentials: { accessKeyId: s.keyId, secretAccessKey: s.appKey },
    forcePathStyle: true,
    maxAttempts: 2,
  })};
}
export function b2Enabled() {
  return Deno.env.get("B2_ENABLED") === "true";
}
export function isB2Path(path: string): boolean {
  return /^[0-9a-f-]{36}\/[0-9a-f-]{36}\/b2\/[0-9a-f-]{36}\.(pdf|jpg|png)$/i.test(path);
}
export async function uploadB2(path: string, data: Uint8Array, mime: string) {
  if (!isB2Path(path)) throw new Error("INVALID_B2_PATH");
  const {s3,bucket} = client();
  await s3.send(new PutObjectCommand({ Bucket:bucket, Key:path, Body:data, ContentType:mime }));
}
export async function removeB2(path: string) {
  const {s3,bucket} = client();
  await s3.send(new DeleteObjectCommand({Bucket:bucket,Key:path}));
}
export async function readB2(path: string): Promise<Uint8Array> {
  if (!isB2Path(path)) throw new Error("INVALID_B2_PATH");
  const {s3,bucket} = client();
  const result = await s3.send(new GetObjectCommand({Bucket:bucket,Key:path}));
  if (!result.Body) throw new Error("FILE_NOT_FOUND");
  return await result.Body.transformToByteArray();
}
