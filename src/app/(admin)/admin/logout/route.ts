import { NextResponse } from 'next/server';
import { createSupabaseServerClient, TEST_COOKIE } from '@/server/auth/admin';
import { appOrigin } from '@/server/env';

export const runtime = 'nodejs';

export async function POST() {
  const supabase = await createSupabaseServerClient();
  await supabase?.auth.signOut();
  const res = NextResponse.redirect(`${appOrigin()}/admin`, { status: 303 });
  res.cookies.delete({ name: TEST_COOKIE, path: '/' });
  return res;
}
