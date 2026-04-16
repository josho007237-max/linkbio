"use client";

import Image from "next/image";
import { ChangeEvent, useId, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  ImagePersistencePreset,
  processImageForLocalPersistence,
} from "@/lib/media/file-data-url";

type CustomImageUploadProps = {
  value?: string | null;
  preset: ImagePersistencePreset;
  onValueChange: (nextValue: string) => void;
  onError?: (message: string | null) => void;
  uploadLabel?: string;
  changeLabel?: string;
  removeLabel?: string;
  emptyHint?: string;
  className?: string;
};

const UPLOAD_ICON_PRIMARY_SRC = "/placeholders/upload-icon.png";
const UPLOAD_ICON_FALLBACK_SRC = "/file.svg";

const normalizeImageSrc = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized || null;
};

const getDisplayFileName = (value: string | null, selectedName: string): string => {
  if (selectedName) {
    return selectedName;
  }
  if (!value) {
    return "";
  }
  if (value.startsWith("data:image/")) {
    const mime = value.slice(5, value.indexOf(";"));
    return `Uploaded image (${mime || "data"})`;
  }
  try {
    const parsed = new URL(value);
    const fromPath = parsed.pathname.split("/").pop();
    return fromPath || "Selected image";
  } catch {
    const fromPath = value.split("/").pop();
    return fromPath || "Selected image";
  }
};

export const CustomImageUpload = ({
  value,
  preset,
  onValueChange,
  onError,
  uploadLabel = "Upload image",
  changeLabel = "Change image",
  removeLabel = "Remove image",
  emptyHint = "PNG, JPG, or WebP",
  className,
}: CustomImageUploadProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [uploadIconSrc, setUploadIconSrc] = useState(UPLOAD_ICON_PRIMARY_SRC);
  const [isProcessing, setIsProcessing] = useState(false);
  const inputId = useId();

  const normalizedValue = useMemo(() => normalizeImageSrc(value), [value]);
  const displayName = useMemo(
    () => getDisplayFileName(normalizedValue, selectedFileName),
    [normalizedValue, selectedFileName],
  );

  const openFilePicker = () => {
    inputRef.current?.click();
  };

  const handleUpload = async (file: File) => {
    setIsProcessing(true);
    try {
      const processed = await processImageForLocalPersistence(file, preset);
      onValueChange(processed.dataUrl);
      setSelectedFileName(file.name);
      onError?.(null);
    } catch {
      onError?.(
        "Image is too large for local browser persistence. Please use a smaller image.",
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    await handleUpload(file);
    event.target.value = "";
  };

  return (
    <div className={className}>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
      <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
        {normalizedValue ? (
          <Image
            src={normalizedValue}
            alt=""
            className="h-24 w-full rounded-md border border-border/60 object-cover"
            width={640}
            height={192}
            unoptimized
          />
        ) : (
          <div className="flex h-24 items-center justify-center rounded-md border border-dashed border-border/70 bg-background/60">
            <Image
              src={uploadIconSrc}
              alt=""
              className="h-8 w-8 object-contain opacity-80"
              width={32}
              height={32}
              unoptimized
              onError={() => setUploadIconSrc(UPLOAD_ICON_FALLBACK_SRC)}
            />
          </div>
        )}
        <p className="mt-2 truncate text-xs text-muted-foreground">
          {displayName || emptyHint}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={openFilePicker}
            disabled={isProcessing}
          >
            {normalizedValue ? changeLabel : uploadLabel}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              onValueChange("");
              setSelectedFileName("");
              onError?.(null);
            }}
            disabled={!normalizedValue || isProcessing}
          >
            {removeLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};
