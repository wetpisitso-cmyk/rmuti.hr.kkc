// Private Cloudflare R2 integration. Never embed secrets in browser code.
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "npm:@aws-sdk/client-s3@3";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner@3";

type R2Config = { bucket:string; client:S3Client };
let instance: R2Config | null = null;
export const r2Enabled = () => Deno.env.get("R2_ENABLED") === "true";
export function r2Config(): R2Config {
  if (instance) return instance;
  if (!r2Enabled()) throw new Error("R2_NOT_ENABLED");
  const accountId = Deno.env.get("R2_ACCOUNT_ID")?.trim() || "";
  const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID")?.trim() || "";
  const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY") || "";
  const bucket = Deno.env.get("R2_BUCKET")?.trim() || "";
  if (!/^[a-f0-9]{32}$/i.test(accountId) ||
      !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket) ||
      !accessKeyId || !secretAccessKey) {
    throw new Error("R2_NOT_CONFIGURED");
  }
  const client = new S3Client({
    region: "auto",
    endpoint: "https://" + accountId + ".r2.cloudflarestorage.com",
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });
  instance = { bucket, client };
  return instance;
}
export function isR2Path(path: string): boolean {
  return /^r2\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|jpg|png)$/.test(path);
}
export async function uploadR2(path: string, bytes: Uint8Array, mime: string) {
  if (!isR2Path(path)) throw new Error("INVALID_FILE_PATH");
  const { client, bucket } = r2Config();
  await client.send(new PutObjectCommand({
    Bucket: bucket, Key: path, Body: bytes, ContentType: mime, ContentLength: bytes.length,
  }));
}
export async function signedR2Download(path: string) {
  if (!isR2Path(path)) throw new Error("INVALID_FILE_PATH");
  const { client, bucket } = r2Config();
  return await getSignedUrl(client,new GetObjectCommand({Bucket:bucket,Key:path}),{expiresIn:120});
}
export async function deleteR2(path: string) {
  if (!isR2Path(path)) throw new Error("INVALID_FILE_PATH");
  const { client,bucket } = r2Config();
  await client.send(new DeleteObjectCommand({ Bucket:bucket,Key:path }));
}
