import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerActionClient } from "@/lib/supabase/server";
import { z } from "zod";

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const supabase = await createSupabaseServerActionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const body = await req.json();
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
  const patchSchema = z.object({
    enabled: z.boolean().optional(),
    priority: z.number().int().min(0).optional(),
    match: matchSchema.optional(),
    action: actionSchema.optional(),
  });
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const patch = parsed.data;
  const { error } = await supabase
    .from("smart_rules")
    .update(patch)
    .eq("id", params.id)
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const supabase = await createSupabaseServerActionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { error } = await supabase
    .from("smart_rules")
    .delete()
    .eq("id", params.id)
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
