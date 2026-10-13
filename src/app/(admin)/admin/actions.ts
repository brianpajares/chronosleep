'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/server/auth/admin';
import { env, appOrigin } from '@/server/env';
import { checkRateLimit, POLICIES } from '@/server/ratelimit';
import { headers } from 'next/headers';

/** Sends a magic link — only for emails in ADMIN_EMAILS, but the response is always identical. */
export async function sendLoginLink(formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const ip = ((await headers()).get('x-forwarded-for') ?? 'unknown').split(',')[0]?.trim() ?? 'unknown';
  const rl = await checkRateLimit(POLICIES.admin, ip);
  if (rl.ok && email && env.adminEmails().includes(email)) {
    const supabase = await createSupabaseServerClient();
    if (supabase) {
      await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${appOrigin()}/admin/auth/callback`, shouldCreateUser: true },
      });
    }
  }
  redirect('/admin?sent=1');
}
