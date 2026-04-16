"use client";

export const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Could not read file as data URL."));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });

type ImageToDataUrlOptions = {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
};

export type ImagePersistencePreset = "avatar_hero" | "thumbnail_banner" | "icon";

type ImagePersistenceRule = {
  maxWidth: number;
  maxHeight: number;
  targetBytes: number;
};

const IMAGE_PERSISTENCE_RULES: Record<ImagePersistencePreset, ImagePersistenceRule> = {
  avatar_hero: {
    maxWidth: 512,
    maxHeight: 512,
    targetBytes: 150 * 1024,
  },
  thumbnail_banner: {
    maxWidth: 1200,
    maxHeight: 630,
    targetBytes: 250 * 1024,
  },
  icon: {
    maxWidth: 256,
    maxHeight: 256,
    targetBytes: 50 * 1024,
  },
};

const dataUrlByteLength = (dataUrl: string): number => {
  const [, encoded = ""] = dataUrl.split(",", 2);
  const padding = encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((encoded.length * 3) / 4) - padding);
};

const calculateTargetSize = (
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number,
) => {
  const widthRatio = maxWidth / width;
  const heightRatio = maxHeight / height;
  const ratio = Math.min(1, widthRatio, heightRatio);
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
};

const loadImage = async (objectUrl: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image for processing."));
    image.src = objectUrl;
  });

const drawImageToCanvas = (
  image: HTMLImageElement,
  width: number,
  height: number,
): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Failed to initialize canvas context.");
  }
  context.clearRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  return canvas;
};

const canvasHasTransparency = (canvas: HTMLCanvasElement): boolean => {
  const context = canvas.getContext("2d");
  if (!context) {
    return false;
  }
  const { width, height } = canvas;
  if (width <= 0 || height <= 0) {
    return false;
  }
  const imageData = context.getImageData(0, 0, width, height).data;
  for (let index = 3; index < imageData.length; index += 4) {
    if (imageData[index] < 255) {
      return true;
    }
  }
  return false;
};

const tryEncode = (
  canvas: HTMLCanvasElement,
  outputType: "image/png" | "image/webp" | "image/jpeg",
  targetBytes: number,
): string | null => {
  if (outputType === "image/png") {
    const pngDataUrl = canvas.toDataURL("image/png");
    return dataUrlByteLength(pngDataUrl) <= targetBytes ? pngDataUrl : null;
  }

  const qualities = [0.9, 0.82, 0.74, 0.66, 0.58, 0.5, 0.42];
  let bestCandidate: string | null = null;
  for (const quality of qualities) {
    const candidate = canvas.toDataURL(outputType, quality);
    bestCandidate = candidate;
    if (dataUrlByteLength(candidate) <= targetBytes) {
      return candidate;
    }
  }
  return bestCandidate;
};

type ProcessedImageResult = {
  dataUrl: string;
  bytes: number;
  mimeType: "image/png" | "image/webp" | "image/jpeg";
};

export const processImageForLocalPersistence = async (
  file: File,
  preset: ImagePersistencePreset,
): Promise<ProcessedImageResult> => {
  if (!file.type.startsWith("image/")) {
    throw new Error("Unsupported file type.");
  }

  const { maxWidth, maxHeight, targetBytes } = IMAGE_PERSISTENCE_RULES[preset];
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(objectUrl);
    const firstSize = calculateTargetSize(image.width, image.height, maxWidth, maxHeight);
    let width = firstSize.width;
    let height = firstSize.height;

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const canvas = drawImageToCanvas(image, width, height);
      const hasTransparency = canvasHasTransparency(canvas);
      const preferredType: "image/png" | "image/webp" | "image/jpeg" = hasTransparency
        ? "image/png"
        : "image/webp";

      const fallbackType: "image/webp" | "image/jpeg" =
        preferredType === "image/webp" ? "image/jpeg" : "image/webp";

      const primary = tryEncode(canvas, preferredType, targetBytes);
      const secondary = hasTransparency ? null : tryEncode(canvas, fallbackType, targetBytes);

      const candidate = [primary, secondary]
        .filter((value): value is string => Boolean(value))
        .sort((a, b) => dataUrlByteLength(a) - dataUrlByteLength(b))[0];

      if (candidate && dataUrlByteLength(candidate) <= targetBytes) {
        return {
          dataUrl: candidate,
          bytes: dataUrlByteLength(candidate),
          mimeType: candidate.startsWith("data:image/png")
            ? "image/png"
            : candidate.startsWith("data:image/webp")
              ? "image/webp"
              : "image/jpeg",
        };
      }

      const nextWidth = Math.max(1, Math.round(width * 0.82));
      const nextHeight = Math.max(1, Math.round(height * 0.82));
      if (nextWidth === width && nextHeight === height) {
        break;
      }
      width = nextWidth;
      height = nextHeight;
    }

    throw new Error("Image exceeds local persistence limits after compression.");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

export const imageFileToDataUrl = async (
  file: File,
  options: ImageToDataUrlOptions = {},
): Promise<string> => {
  const {
    maxWidth = 1400,
    maxHeight = 1400,
    quality = 0.82,
  } = options;

  if (!file.type.startsWith("image/")) {
    return fileToDataUrl(file);
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to load image for processing."));
      img.src = objectUrl;
    });

    const widthRatio = maxWidth / image.width;
    const heightRatio = maxHeight / image.height;
    const ratio = Math.min(1, widthRatio, heightRatio);
    const targetWidth = Math.max(1, Math.round(image.width * ratio));
    const targetHeight = Math.max(1, Math.round(image.height * ratio));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      return fileToDataUrl(file);
    }
    context.drawImage(image, 0, 0, targetWidth, targetHeight);

    const outputType =
      file.type === "image/png" ? "image/png" : "image/jpeg";
    return canvas.toDataURL(outputType, quality);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};
