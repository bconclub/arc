import { checkIngestAuth, authError } from "@/lib/ingest-auth";
import { supabaseAdmin } from "@/lib/supabase";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const auth = checkIngestAuth(req);
  if (!auth.ok) return authError(auth);
  const b = await req.json().catch(() => null);
  const phone = String(b?.phone || '').replace(/\D/g, '').slice(-10);
  if (phone.length !== 10) return Response.json({ error: 'Valid phone required' }, { status: 400 });
  const matches: { id: string; phone: string; status: string }[] = [];
  for (let offset=0; ; offset+=1000) {
    const {data,error} = await supabaseAdmin.from('outreach_targets').select('id,phone,status').order('id').range(offset,offset+999);
    if (error) return Response.json({ error: 'Target lookup unavailable' }, { status: 503 });
    matches.push(...(data || []).filter(t => String(t.phone || '').replace(/\D/g,'').slice(-10) === phone && (!b.target_id || t.id === b.target_id)));
    if ((data || []).length < 1000) break;
  }
  if (matches.length !== 1) return Response.json({ error: 'Create or select one matching ARC target before dialing' }, { status: 409 });
  const target = matches[0];
  if (['lost','won'].includes(target.status)) return Response.json({ error: 'Target closed. Review before dialing.' }, { status: 409 });
  // Dry runs read readiness and cooldown; they never reserve or place calls.
  if (b.dry_run === true) {
    const {data,error} = await supabaseAdmin.from('outreach_dial_reservations').select('reserved_at').eq('phone',phone).maybeSingle();
    if (error) return Response.json({ error: 'ARC migration required' }, { status: 503 });
    if (data && Date.now()-Date.parse(data.reserved_at)<86400000) return Response.json({ reason: 'recently_called' }, { status: 409 });
    return Response.json({ ok: true, dry_run: true, target_id: target.id });
  }
  const { data, error } = await supabaseAdmin.rpc('reserve_outreach_dial', { dial_phone: phone, worker_name: auth.agent });
  if (error) return Response.json({ error: 'Dial reservation unavailable. No call placed.' }, { status: 503 });
  return data ? Response.json({ ok: true, reservation_id: data, target_id: target.id })
    : Response.json({ reason: 'recently_called' }, { status: 409 });
}
