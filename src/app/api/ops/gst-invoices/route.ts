import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("gst_invoices")
    .select("id,invoice_no,issued_on,client,brand_id,billed_amount,total_amount,gst_amount,gstin,gst_status,notes")
    .order("issued_on", { ascending: false, nullsFirst: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
