import { checkIngestAuth, authError } from "@/lib/ingest-auth";
import { supabaseAdmin } from "@/lib/supabase";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const auth = checkIngestAuth(req);
  if (!auth.ok) return authError(auth);
  const b = await req.json().catch(() => null);
  const phone = String(b?.phone || '').replace(/\D/g, '').slice(-10);
  if (phone.length !== 10) return Response.json({ error: 'Valid phone required' }, { status: 400 });
  const manual = b?.manual_override === true && auth.agent === 'bdr-bdr';
  const matches: { id: string; phone: string; status: string }[] = [];
  for (let offset=0; ; offset+=1000) {
    const {data,error} = await supabaseAdmin.from('outreach_targets').select('id,phone,status').order('id').range(offset,offset+999);
    if (error) return Response.json({ error: 'Target lookup unavailable' }, { status: 503 });
    matches.push(...(data || []).filter(t => String(t.phone || '').replace(/\D/g,'').slice(-10) === phone && (!b.target_id || t.id === b.target_id)));
    if ((data || []).length < 1000) break;
  }
  if (!manual && matches.length !== 1) return Response.json({ error: 'Create or select one matching ARC target before dialing' }, { status: 409 });
  let target = matches.length === 1 ? matches[0] : null;
  if (!manual && target && ['lost','won'].includes(target.status)) return Response.json({ error: 'Target closed. Review before dialing.' }, { status: 409 });
  if (manual && (!target || ['lost','won'].includes(target.status))) {
    if (b.target_id) return Response.json({ reason: 'target_mismatch', error: 'Selected ARC target does not match this phone.' }, { status: 409 });
    if (b.dry_run === true) return Response.json({ ok: true, dry_run: true, target_id: 'new_manual_target' });
    const { data, error } = await supabaseAdmin.from('outreach_targets').insert({
      kind: 'business', name: String(b.first_name || b.business_name || phone).trim().slice(0, 80),
      org: String(b.business_name || '').trim().slice(0, 120) || null,
      segment: String(b.vertical || '').trim().slice(0, 80) || null,
      city: String(b.city || '').trim().slice(0, 80) || null,
      phone, source: 'bdr_manual', status: 'identified',
    }).select('id,phone,status').single();
    if (error || !data) return Response.json({ error: 'Could not create ARC target. No call placed.' }, { status: 503 });
    target = data;
  }
  if (!target) return Response.json({ error: 'Target required' }, { status: 409 });

  if (manual) {
    if (b.dry_run === true) return Response.json({ ok: true, dry_run: true, target_id: target.id });
    const { error } = await supabaseAdmin.from('outreach_dial_reservations').upsert({
      phone, reservation_id: crypto.randomUUID(), reserved_at: new Date().toISOString(), worker: auth.agent,
    }, { onConflict: 'phone' });
    if (error) return Response.json({ error: 'Could not record manual dial. No call placed.' }, { status: 503 });
    return Response.json({ ok: true, target_id: target.id, manual: true });
  }

  if (!manual) {
    // Scheduled callbacks remain the only cooldown exception for automated callers.
    const {data: fullTarget} = await supabaseAdmin.from('outreach_targets').select('next_at').eq('id',target.id).single();
    const isScheduledCallback = fullTarget?.next_at && Date.parse(fullTarget.next_at) <= Date.now();

    if (b.dry_run === true) {
    const {data,error} = await supabaseAdmin.from('outreach_dial_reservations').select('reserved_at').eq('phone',phone).maybeSingle();
    if (error) return Response.json({ error: 'ARC migration required' }, { status: 503 });
    // Allow bypass for scheduled callbacks with next_at due.
    if (data && Date.now()-Date.parse(data.reserved_at)<86400000 && !isScheduledCallback) {
      return Response.json({ reason: 'recently_called' }, { status: 409 });
    }
    return Response.json({ ok: true, dry_run: true, target_id: target.id, callback: isScheduledCallback });
    }
    // Pass target_id to RPC so it can check for scheduled callback exception.
    const { data, error } = await supabaseAdmin.rpc('reserve_outreach_dial', {
    dial_phone: phone, 
    worker_name: auth.agent,
    target_id: target.id 
  });
    if (error) return Response.json({ error: 'Dial reservation unavailable. No call placed.' }, { status: 503 });
    return data
      ? Response.json({ ok: true, reservation_id: data, target_id: target.id, callback: isScheduledCallback })
      : Response.json({ reason: 'recently_called' }, { status: 409 });
  }
}
