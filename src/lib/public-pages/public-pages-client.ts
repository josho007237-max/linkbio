import { BuilderData } from "@/features/builder/types";
import { resolveBuilderDataImagesForPersistence } from "@/lib/local-storage/image-storage";

export type PublicPageListItem = {
  slug: string;
  data: BuilderData;
  updatedAt: string | null;
};

const parseErrorMessage = async (response: Response, fallback: string) => {
  try {
    const payload = (await parseJsonResponse(response)) as { error?: unknown } | null;
    if (typeof payload?.error === "string" && payload.error.trim()) {
      return payload.error;
    }
  } catch {
    return fallback;
  }
  return fallback;
};

const parseJsonResponse = async <T = unknown>(response: Response): Promise<T | null> => {
  const text = await response.text();
  if (!text.trim()) {
    return null;
  }
  return JSON.parse(text) as T;
};

export const listPublicPages = async (): Promise<PublicPageListItem[]> => {
  const response = await fetch("/api/public-pages", {
    method: "GET",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "Failed to list public pages."));
  }

  const payload = await parseJsonResponse<{ pages?: PublicPageListItem[] }>(response);
  return Array.isArray(payload?.pages) ? payload.pages : [];
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

  const payload = await parseJsonResponse<{ data?: BuilderData }>(response);
  return payload?.data ?? null;
};

export const upsertPublicPageBySlug = async (slug: string, data: BuilderData): Promise<void> => {
  const durableData = await resolveBuilderDataImagesForPersistence(data);
  const response = await fetch(`/api/public-pages/${encodeURIComponent(slug)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: durableData }),
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
