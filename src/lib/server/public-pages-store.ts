import { createClient } from "@supabase/supabase-js";

import { builderDataSchema } from "@/features/builder/schema";
import { BuilderData } from "@/features/builder/types";
import { normalizeBuilderData } from "@/features/builder/utils";
import { validateCriticalServerEnv } from "@/lib/server/env-validation";

type PublicPageRow = {
  slug: string;
  data: BuilderData;
  updated_at?: string | null;
};

const PUBLIC_PAGES_TABLE = "public_pages";

const getSupabaseServerConfig = () => {
  const env = validateCriticalServerEnv();
  const url = env.nextPublicSupabaseUrl;
  const anonKey = env.nextPublicSupabaseAnonKey;
  const serviceRoleKey = env.supabaseServiceRoleKey;

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

const parseStoredPublicPageData = (rawData: unknown, slug: string): BuilderData | null => {
  const parsed = builderDataSchema.safeParse(rawData);
  if (!parsed.success) {
    console.error("[public-pages] Stored profile payload is invalid", {
      slug,
      details: parsed.error.issues.map((issue) => ({
        path: issue.path.length ? issue.path.join(".") : "(root)",
        message: issue.message,
      })),
    });
    return null;
  }
  return normalizeBuilderData(parsed.data as BuilderData);
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
  return data ? parseStoredPublicPageData(data.data, data.slug) : null;
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

  return (data ?? [])
    .map((row) => {
      const parsedData = parseStoredPublicPageData(row.data, row.slug);
      return parsedData ? { ...row, data: parsedData } : null;
    })
    .filter((row): row is PublicPageRow => Boolean(row));
};

export const upsertPublicPage = async (slug: string, data: BuilderData): Promise<void> => {
  const client = getSupabaseAdminClient();
  const normalizedData = normalizeBuilderData(data);
  const { error } = await client
    .from(PUBLIC_PAGES_TABLE)
    .upsert({ slug, data: normalizedData, updated_at: new Date().toISOString() }, { onConflict: "slug" });

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
