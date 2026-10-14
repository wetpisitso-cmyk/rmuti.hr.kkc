import { backend, json, secureEqual } from '../_shared/helpers.ts';
Deno.serve(async req => {
  if (req.method !== 'POST') return json({error:'METHOD_NOT_ALLOWED'},405);
  const workerSecret = Deno.env.get('WORKER_SECRET') || '';
  if (workerSecret.length < 32 || !secureEqual(req.headers.get('x-worker-secret') || '', workerSecret)) return json({error:'UNAUTHORIZED'},401);
  const apiKey = Deno.env.get('RESEND_API_KEY'), from = Deno.env.get('MAIL_FROM');
  if (!apiKey || !from) return json({error:'MAIL_NOT_CONFIGURED'},503);
  const db = backend();
  const {data: rate} = await db.rpc('claim_rate',{p_scope:'mail',p_key:'worker',p_limit:4});
  if (!rate) return json({error:'RATE_LIMITED'},429);
  const {data: jobs,error} = await db.rpc('claim_emails',{p_limit:10});
  if (error) return json({error:'QUEUE_FAILED'},500);
  let sent = 0, failed = 0;
  for (const job of jobs || []) {
    try {
      const response = await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json','Idempotency-Key':`recruitment-${job.id}`},body:JSON.stringify({from,to:job.email,subject:job.subject,text:job.body}),signal:AbortSignal.timeout(15000)});
      const {error: finishError} = await db.rpc('finish_email',{p_id:job.id,p_lease:job.lease_token,p_ok:response.ok,p_code:response.ok?'':`PROVIDER_${response.status}`});
      if (finishError) failed++; else if (response.ok) sent++; else failed++;
    } catch { await db.rpc('finish_email',{p_id:job.id,p_lease:job.lease_token,p_ok:false,p_code:'NETWORK_FAILED'}); failed++; }
  }
  return json({processed:(jobs || []).length,sent,failed});
});
