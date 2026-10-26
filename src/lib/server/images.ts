import "server-only";
import sharp, { type Metadata, type Sharp } from "sharp";

export const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // 3 MiB
export const MAX_INPUT_PIXELS = 2_000_000;
export const MIN_DIMENSION = 80;
export const MAX_DIMENSION = 8192;

export class ImageValidationError extends Error {
  readonly code = "invalid_image";
  readonly status = 400;

  constructor(message: string) {
    super(message);
    this.name = "ImageValidationError";
  }
}

export interface ValidatedImage {
  buffer: Buffer;
  width: number;
  height: number;
  format: "jpeg" | "png";
}

/**
 * Validates format, size, dimensions, and decodes pixels to ensure valid image data.
 * Enforces limitInputPixels: 2_000_000 and 3 MiB payload limit.
 */
export async function validateImageBytes(input: Buffer | Uint8Array): Promise<ValidatedImage> {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);

  if (!buffer || buffer.length === 0) {
    throw new ImageValidationError("No se proporcionó ningún archivo de imagen.");
  }

  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new ImageValidationError("La imagen excede el tamaño máximo permitido de 3 MiB.");
  }

  let sharpInstance: Sharp;
  try {
    sharpInstance = sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" });
  } catch {
    throw new ImageValidationError("El archivo no es una imagen válida o está corrupto.");
  }

  let metadata: Metadata;
  try {
    metadata = await sharpInstance.metadata();
  } catch {
    throw new ImageValidationError("No se pudieron leer los metadatos de la imagen.");
  }

  const format = metadata.format;
  if (!format || (format !== "jpeg" && format !== "png")) {
    throw new ImageValidationError("Formato de imagen no soportado. Se requiere JPEG o PNG.");
  }

  const width = metadata.width;
  const height = metadata.height;

  if (typeof width !== "number" || typeof height !== "number") {
    throw new ImageValidationError("No se pudieron determinar las dimensiones de la imagen.");
  }

  if (width < MIN_DIMENSION || height < MIN_DIMENSION) {
    throw new ImageValidationError(
      `La imagen es demasiado pequeña (${width}x${height}px). Las dimensiones mínimas son ${MIN_DIMENSION}x${MIN_DIMENSION}px.`,
    );
  }

  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    throw new ImageValidationError(
      `Las dimensiones de la imagen (${width}x${height}px) exceden el límite de ${MAX_DIMENSION}px por eje.`,
    );
  }

  if (width * height > MAX_INPUT_PIXELS) {
    throw new ImageValidationError(
      `La imagen tiene ${width * height} píxeles, excediendo el límite de ${MAX_INPUT_PIXELS} píxeles (2 MP).`,
    );
  }

  // Fully decode pixels to verify that the image is not truncated or corrupt
  try {
    await sharpInstance.raw().toBuffer();
  } catch {
    throw new ImageValidationError(
      "No se pudieron decodificar los píxeles de la imagen; el archivo podría estar incompleto o dañado.",
    );
  }

  return {
    buffer,
    width,
    height,
    format: format as "jpeg" | "png",
  };
}
