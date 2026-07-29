import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local",
  );
}

export const supabase = createClient(url, key);

/**
 * Atlas doesn't ask for signup during onboarding, so every browser gets a
 * frictionless anonymous Supabase user on first visit. Requires "Anonymous
 * sign-ins" enabled in the project's Auth settings.
 */
export async function ensureSession(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  if (data.session?.user.id) return data.session.user.id;

  const { data: signInData, error } = await supabase.auth.signInAnonymously();
  if (error || !signInData.session) {
    throw new Error(error?.message ?? "Couldn't create an anonymous session");
  }
  return signInData.session.user.id;
}
