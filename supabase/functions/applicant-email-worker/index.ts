// Retired at the university's request: applicant notifications now stay inside the website.
// No outbound email or secret access is performed by this endpoint.
Deno.serve(() => new Response(
  JSON.stringify({ error: "EMAIL_NOTIFICATIONS_RETIRED", message: "Applicant notices are available in the RMUTI KKC website." }),
  { status: 410, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }
));