import { BuilderData } from "@/features/builder/types";

export type PublicPageListItem = {
  slug: string;
  data: BuilderData;
  updatedAt: string | null;
};

const parseErrorMessage = async (response: Response, fallback: string) => {
  try {
    const payload = (await response.json()) as { error?: unknown };
    if (typeof payload?.error === "string" && payload.error.trim()) {
      return payload.error;
    }
  } catch {
    return fallback;
  }
  return fallback;
};

export const listPublicPages = async (): Promise<PublicPageListItem[]> => {
  const response = await fetch("/api/public-pages", {
    method: "GET",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "Failed to list public pages."));
  }

  const payload = (await response.json()) as { pages?: PublicPageListItem[] };
  return Array.isArray(payload.pages) ? payload.pages : [];
};

export const getPublicPageBySlug = async (slug: string): Promise<BuilderData | null> => {
  const response = await fetch(`/api/public-pages/${encodeURIComponent(slug)}`, {
    method: "GET",
    cache: "no-store",
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "Failed to load public page."));
  }

  const payload = (await response.json()) as { data?: BuilderData };
  return payload?.data ?? null;
};

export const upsertPublicPageBySlug = async (slug: string, data: BuilderData): Promise<void> => {
  const response = await fetch(`/api/public-pages/${encodeURIComponent(slug)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data }),
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "Failed to save public page."));
  }
};

export const deletePublicPageBySlug = async (slug: string): Promise<void> => {
  const response = await fetch(`/api/public-pages/${encodeURIComponent(slug)}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "Failed to delete public page."));
  }
};
