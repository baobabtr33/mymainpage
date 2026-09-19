import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase access.
 *
 * The variables are namespaced (MAINPAGE_*) so this app can never pick up a
 * stray SUPABASE_URL/SUPABASE_SECRET_KEY that belongs to another project in
 * the same shell. The service key bypasses RLS, so it stays on the server and
 * every write is gated by the page's edit token.
 */
const url = process.env.MAINPAGE_SUPABASE_URL;
const serviceKey = process.env.MAINPAGE_SUPABASE_SERVICE_KEY;

export const dbConfigured = Boolean(url && serviceKey);

let client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (!url || !serviceKey) throw new Error("Supabase is not configured");
  client ??= createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

export type PageRow = {
  slug: string;
  edit_token: string;
  display_name: string;
  prefs: Record<string, unknown>;
  widgets: unknown[];
  created_at: string;
  updated_at: string;
};

export type MarketRow = {
  id: string;
  author_slug: string;
  author_name: string;
  title: string;
  description: string;
  icon: string;
  tags: string[];
  spec: Record<string, unknown>;
  installs: number;
  created_at: string;
  updated_at: string;
};

const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

export function newSlug(length = 8): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/** Constant-time-ish comparison so a wrong token leaks nothing by timing. */
export function tokenMatches(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Load a page and check the caller owns it. */
export async function authorizePage(slug: string, token: string | null) {
  const { data, error } = await db().from("pages").select("*").eq("slug", slug).maybeSingle();
  if (error) throw new Error(error.message);
  const page = data as PageRow | null;
  if (!page) return { page: null, owner: false };
  return { page, owner: tokenMatches(page.edit_token, token) };
}
