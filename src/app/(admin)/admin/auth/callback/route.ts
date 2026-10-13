import { createClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/server/auth/admin';
import { appOrigin, env } from '@/server/env';

export const runtime = 'nodejs';

/** PKCE magic-link callback: exchange the code, then mark the user as admin (RLS claim) if allow-listed. */
export async function GET(req: NextRequest) {
  const code = new URL(req.url).searchParams.get('code');
  const supabase = await createSupabaseServerClient();
  if (!code || !supabase) return NextResponse.redirect(`${appOrigin()}/admin`);

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  const email = data?.user?.email?.toLowerCase();
  if (error || !email || !env.adminEmails().includes(email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${appOrigin()}/admin?denied=1`);
  }

  // `public.is_admin()` (spec/db_schema.sql) reads app_metadata.is_admin from the JWT.
  const url = env.supabaseUrl();
  const service = env.supabaseServiceKey();
  if (url && service && data.user.app_metadata?.is_admin !== true) {
    const admin = createClient(url, service, { auth: { persistSession: false } });
    await admin.auth.admin.updateUserById(data.user.id, { app_metadata: { ...data.user.app_metadata, is_admin: true } });
  }
  return NextResponse.redirect(`${appOrigin()}/admin`);
}
