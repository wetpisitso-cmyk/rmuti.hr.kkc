import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
export {sniff} from './file-validation.ts';
export function backend() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
}
export function json(body: unknown, status = 200, cors: Record<string,string> = {}) { return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors } }); }
export function corsFor(req: Request) {
  const origin = req.headers.get('origin') || '';
  const allowed = (Deno.env.get('ALLOWED_ORIGINS') || 'http://localhost:5173,https://wetpisitso-cmyk.github.io').split(',').map(s => s.trim());
  if (!allowed.includes(origin)) throw new Error('ORIGIN_DENIED');
  return { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin' };
}
export function secureEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0; for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
