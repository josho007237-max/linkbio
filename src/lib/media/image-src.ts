"use client";

const normalizeSrc = (src: string | null | undefined): string => {
  if (typeof src !== "string") {
    return "";
  }
  return src.trim();
};

export const isBrowserOnlyImageSrc = (src: string | null | undefined): boolean => {
  const normalized = normalizeSrc(src);
  return (
    normalized.startsWith("idbimg:") ||
    normalized.startsWith("blob:") ||
    normalized.startsWith("data:")
  );
};

export const isNextImageSafeSrc = (src: string | null | undefined): boolean => {
  const normalized = normalizeSrc(src);
  if (!normalized) {
    return false;
  }
  if (normalized.startsWith("/")) {
    return true;
  }
  return normalized.startsWith("http://") || normalized.startsWith("https://");
};

export const isNextSafeImageSrc = isNextImageSafeSrc;

export const normalizeImageSrcForRender = (src: string | null | undefined): string =>
  normalizeSrc(src);
