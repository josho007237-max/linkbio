import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { BuilderData } from "@/features/builder/types";

const DEV_PUBLIC_PAGES_FILE = path.join(
  process.cwd(),
  "data",
  "public-pages.dev.json",
);

const normalizeSlug = (value: string): string => value.trim().toLowerCase();

const readAllPublicPages = async (): Promise<Record<string, BuilderData>> => {
  try {
    const raw = await readFile(DEV_PUBLIC_PAGES_FILE, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    return parsed as Record<string, BuilderData>;
  } catch {
    return {};
  }
};

const writeAllPublicPages = async (
  pages: Record<string, BuilderData>,
): Promise<void> => {
  await mkdir(path.dirname(DEV_PUBLIC_PAGES_FILE), { recursive: true });
  await writeFile(DEV_PUBLIC_PAGES_FILE, JSON.stringify(pages, null, 2), "utf8");
};

export const getDevPublicPageBySlug = async (
  slug: string,
): Promise<BuilderData | null> => {
  const all = await readAllPublicPages();
  return all[normalizeSlug(slug)] ?? null;
};

export const upsertDevPublicPage = async (
  slug: string,
  data: BuilderData,
): Promise<void> => {
  const all = await readAllPublicPages();
  all[normalizeSlug(slug)] = data;
  await writeAllPublicPages(all);
};

export const removeDevPublicPageBySlug = async (slug: string): Promise<void> => {
  const all = await readAllPublicPages();
  const normalized = normalizeSlug(slug);
  if (!all[normalized]) {
    return;
  }
  delete all[normalized];
  await writeAllPublicPages(all);
};
