import type { Metadata } from "next";

import { PublicProfilePageClient } from "@/components/public/public-profile-page-client";
import { BuilderData } from "@/features/builder/types";
import { getPublicPageBySlug } from "@/lib/server/public-pages-store";

type PublicPageParams = {
  username: string;
};

type PublicPageProps = {
  params: Promise<PublicPageParams>;
};

const normalizeSlug = (value: string): string => value.trim().toLowerCase();

const getFirstNonEmpty = (...values: Array<string | null | undefined>): string => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
};

const isShareableImageUrl = (value: string): boolean =>
  value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/");

const resolveShareMetadata = (profile: BuilderData, slug: string) => {
  const title = getFirstNonEmpty(
    profile.header.shareTitle,
    profile.header.displayName,
    profile.header.publicHandle,
    profile.header.publicUsername,
    profile.header.username,
    slug,
  );
  const description = getFirstNonEmpty(
    profile.header.shareDescription,
    profile.text.intro,
    profile.header.tagline,
    profile.text.body,
  );
  const imageCandidate = getFirstNonEmpty(
    profile.header.shareImageUrl,
    profile.header.heroImageUrl,
    profile.header.avatarUrl,
  );
  const image = isShareableImageUrl(imageCandidate) ? imageCandidate : "";

  return { title, description, image };
};

export async function generateMetadata({ params }: PublicPageProps): Promise<Metadata> {
  const { username } = await params;
  const slug = normalizeSlug(username);

  if (!slug) {
    return {};
  }

  let profile: BuilderData | null = null;
  try {
    profile = await getPublicPageBySlug(slug);
  } catch (error) {
    console.error("[public-page] metadata load failed", error);
  }

  if (!profile) {
    return {};
  }

  const { title, description, image } = resolveShareMetadata(profile, slug);
  const imageList = image ? [image] : undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: imageList,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      images: imageList,
    },
  };
}

export default async function PublicProfilePage({ params }: PublicPageProps) {
  const { username } = await params;
  return <PublicProfilePageClient username={username ?? ""} />;
}
