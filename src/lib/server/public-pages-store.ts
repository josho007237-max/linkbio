import { createClient } from "@supabase/supabase-js";

import { BuilderData } from "@/features/builder/types";

type PublicPageRow = {
  slug: string;
  data: BuilderData;
  updated_at?: string | null;
};

const PUBLIC_PAGES_TABLE = "public_pages";

const getSupabaseServerConfig = () => {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();

  return {
    url,
    anonKey,
    serviceRoleKey,
    isReady: Boolean(url && anonKey && serviceRoleKey),
  };
};

const getSupabaseAdminClient = () => {
  const config = getSupabaseServerConfig();
  if (!config.isReady) {
    throw new Error("Supabase env is incomplete for public page persistence.");
  }

  return createClient(config.url, config.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

export const getPublicPageBySlug = async (slug: string): Promise<BuilderData | null> => {
  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from(PUBLIC_PAGES_TABLE)
    .select("slug,data")
    .eq("slug", slug)
    .maybeSingle<PublicPageRow>();

  if (error) {
    throw error;
  }
  return data?.data ?? null;
};

export const listPublicPages = async (): Promise<PublicPageRow[]> => {
  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from(PUBLIC_PAGES_TABLE)
    .select("slug,data,updated_at")
    .order("updated_at", { ascending: false })
    .returns<PublicPageRow[]>();

  if (error) {
    throw error;
  }

  return data ?? [];
};

export const upsertPublicPage = async (slug: string, data: BuilderData): Promise<void> => {
  const client = getSupabaseAdminClient();
  const { error } = await client
    .from(PUBLIC_PAGES_TABLE)
    .upsert({ slug, data, updated_at: new Date().toISOString() }, { onConflict: "slug" });

  if (error) {
    throw error;
  }
};

export const removePublicPageBySlug = async (slug: string): Promise<void> => {
  const client = getSupabaseAdminClient();
  const { error } = await client.from(PUBLIC_PAGES_TABLE).delete().eq("slug", slug);

  if (error) {
    throw error;
  }
};
