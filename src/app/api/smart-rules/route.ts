import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerActionClient } from "@/lib/supabase/server";
import { z } from "zod";

export async function GET() {
  const supabase = await createSupabaseServerActionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json([], { status: 200 });
  const { data, error } = await supabase
    .from("smart_rules")
    .select("id, enabled, priority, match, action")
    .eq("user_id", user.id)
    .order("priority", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerActionClient();
  const body = await req.json();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const matchSchema = z.object({
    notesIncludes: z.array(z.string()).optional(),
    notesRegex: z.string().optional(),
    amountMin: z.number().optional(),
    amountMax: z.number().optional(),
    accountId: z.string().optional(),
    type: z.enum(["income", "expense"]).optional(),
  });
  const actionSchema = z.object({
    type: z.enum(["income", "expense"]).optional(),
    categoryId: z.string().optional(),
    categoryName: z.string().optional(),
    accountId: z.string().optional(),
  });
  const createSchema = z.object({
    enabled: z.boolean().optional(),
    priority: z.number().int().min(0).optional(),
    match: matchSchema.optional(),
    action: actionSchema.optional(),
  });
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const payload = {
    user_id: user.id,
    enabled: parsed.data.enabled ?? true,
    priority: parsed.data.priority ?? 1,
    match: parsed.data.match ?? {},
    action: parsed.data.action ?? {},
  };
  const { data, error } = await supabase
    .from("smart_rules")
    .insert(payload)
    .select("id, enabled, priority, match, action")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
