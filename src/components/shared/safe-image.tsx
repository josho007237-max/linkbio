"use client";

import Image from "next/image";
import { ImgHTMLAttributes } from "react";

import {
  isBrowserOnlyImageSrc,
  isNextImageSafeSrc,
  normalizeImageSrcForRender,
} from "@/lib/media/image-src";

type SafeImageProps = {
  src: string;
  alt: string;
  className?: string;
  width: number;
  height: number;
  onError?: ImgHTMLAttributes<HTMLImageElement>["onError"];
  unoptimized?: boolean;
};

export const SafeImage = ({
  src,
  alt,
  className,
  width,
  height,
  onError,
  unoptimized,
}: SafeImageProps) => {
  const normalizedSrc = normalizeImageSrcForRender(src);
  if (!normalizedSrc) {
    return null;
  }

  if (isBrowserOnlyImageSrc(normalizedSrc)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={normalizedSrc}
        alt={alt}
        className={className}
        width={width}
        height={height}
        onError={onError}
        loading="lazy"
        decoding="async"
      />
    );
  }

  if (isNextImageSafeSrc(normalizedSrc)) {
    return (
      <Image
        src={normalizedSrc}
        alt={alt}
        className={className}
        width={width}
        height={height}
        onError={onError}
        unoptimized={unoptimized}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={normalizedSrc}
      alt={alt}
      className={className}
      width={width}
      height={height}
      onError={onError}
      loading="lazy"
      decoding="async"
    />
  );
};
