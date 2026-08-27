import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || 'null',
  'Access-Control-Allow-Headers': 'authorization, x-cron-token, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const cronSecret = Deno.env.get('CRON_SECRET_TOKEN');
const resendKey = Deno.env.get('RESEND_API_KEY');
const from = Deno.env.get('MAIL_FROM_ADDRESS') || 'appointments@example.com';
const fromName = Deno.env.get('MAIL_FROM_NAME') || 'Astrid Nails & Beauty Bar';

if (!serviceKey || !supabaseUrl || !cronSecret || !resendKey) {
  console.error('Missing notification function secrets');
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!serviceKey || !supabaseUrl || !cronSecret || !resendKey) return json({ error: 'Function is not configured' }, 500);

  const supplied = request.headers.get('x-cron-token') || '';
  if (supplied.length !== cronSecret.length || supplied !== cronSecret) return json({ error: 'Unauthorized' }, 401);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: maintenanceError } = await admin.rpc('run_appointment_maintenance');
  if (maintenanceError) {
    console.error('maintenance failed', maintenanceError);
    return json({ error: 'Maintenance failed' }, 500);
  }
  const { data: jobs, error: claimError } = await admin.rpc('claim_notification_outbox', { p_limit: 25 });
  if (claimError) {
    console.error('claim failed', claimError);
    return json({ error: 'Could not claim notification jobs' }, 500);
  }

  let sent = 0;
  for (const job of jobs || []) {
    try {
      const { data: profile, error: profileError } = await admin.from('profiles').select('email,first_name').eq('id', job.recipient_id).single();
      if (profileError || !profile?.email) throw new Error('Recipient profile is missing an email');
      const payload = job.payload || {};
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `luxeglow-outbox-${job.id}` },
        body: JSON.stringify({
          from: `${fromName} <${from}>`,
          to: [profile.email],
          subject: payload.title || 'Astrid Nails appointment update',
          text: `Hi ${profile.first_name || 'there'},\n\n${payload.message || 'You have an appointment update.'}\n\nAstrid Nails & Beauty Bar`,
        }),
      });
      if (!response.ok) throw new Error(`Email provider returned ${response.status}`);
      const { error: updateError } = await admin.from('notification_outbox').update({ sent_at: new Date().toISOString(), claimed_at: null, last_error: null }).eq('id', job.id);
      if (updateError) throw updateError;
      sent += 1;
    } catch (error) {
      const message = String(error instanceof Error ? error.message : error).slice(0, 500);
      await admin.from('notification_outbox').update({ claimed_at: null, available_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), last_error: message }).eq('id', job.id);
      console.error('notification job failed', job.id, message);
    }
  }
  return json({ claimed: jobs?.length || 0, sent });
});
