import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  userId: z
    .string()
    .trim()
    .min(3, "User ID must be at least 3 characters")
    .max(64)
    .regex(/^[A-Za-z0-9._-]+$/, "Only letters, numbers, dot, dash, underscore"),
  password: z.string().min(6, "Password must be at least 6 characters").max(128),
  fullName: z.string().trim().max(100).optional(),
  role: z.enum(["super_admin", "staff", "accountant", "branch_manager", "viewer"]).default("staff"),
});

export const createSuperAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => schema.parse(d))
  .handler(async ({ data, context }) => {
    // Caller must be super_admin
    const { data: rolesRow, error: roleErr } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (roleErr) throw new Error(roleErr.message);
    const isAdmin = (rolesRow ?? []).some((r) => r.role === "super_admin");
    if (!isAdmin) throw new Error("Forbidden: super_admin only");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const email = `${data.userId.toLowerCase()}@csc.local`;
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: data.fullName ?? data.userId,
        user_id: data.userId,
      },
    });
    if (error) throw new Error(error.message);
    const uid = created.user?.id;
    if (!uid) throw new Error("User creation failed");

    await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
    const { error: rErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: uid, role: data.role });
    if (rErr) throw new Error(rErr.message);

    return { ok: true, userId: data.userId, role: data.role };
  });
