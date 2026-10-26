export interface NormalizedImageResult {
  blob: Blob;
  previewUrl: string;
  width: number;
  height: number;
  release: () => void;
}

const MAX_PIXELS = 2_000_000;
const MIN_DIMENSION = 80;
const MAX_AXIS = 8192;
const MAX_BYTE_SIZE = 3 * 1024 * 1024; // 3 MiB

/**
 * Normalizes an uploaded JPEG or PNG in the browser:
 * 1. Checks file type.
 * 2. Auto-orients and checks dimensions.
 * 3. Scales down preserving aspect ratio so width*height <= 2,000,000 and max axis <= 8192.
 * 4. Renders on white background.
 * 5. Exports as oriented JPEG <= 3 MiB.
 * 6. Generates object preview URL.
 */
export async function normalizeBrowserImage(file: File): Promise<NormalizedImageResult> {
  const isJpeg = file.type === "image/jpeg" || /\.jpe?g$/i.test(file.name);
  const isPng = file.type === "image/png" || /\.png$/i.test(file.name);

  if (!isJpeg && !isPng) {
    throw new Error("Formato de imagen no soportado. Por favor, seleccione una imagen JPEG o PNG.");
  }

  // Load the image safely
  let sourceWidth = 0;
  let sourceHeight = 0;
  let imageSource: ImageBitmap | HTMLImageElement;

  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      sourceWidth = bitmap.width;
      sourceHeight = bitmap.height;
      imageSource = bitmap;
    } catch {
      // Fallback to HTMLImageElement
      const img = await loadImageElement(file);
      sourceWidth = img.naturalWidth;
      sourceHeight = img.naturalHeight;
      imageSource = img;
    }
  } else {
    const img = await loadImageElement(file);
    sourceWidth = img.naturalWidth;
    sourceHeight = img.naturalHeight;
    imageSource = img;
  }

  if (sourceWidth < MIN_DIMENSION || sourceHeight < MIN_DIMENSION) {
    if ("close" in imageSource && typeof imageSource.close === "function") {
      imageSource.close();
    }
    throw new Error(
      `La imagen es demasiado pequeña (${sourceWidth}x${sourceHeight}px). Se requiere un mínimo de ${MIN_DIMENSION}x${MIN_DIMENSION}px.`,
    );
  }

  // Calculate target dimensions
  let scale = 1;
  const maxAxis = Math.max(sourceWidth, sourceHeight);
  if (maxAxis > MAX_AXIS) {
    scale = Math.min(scale, MAX_AXIS / maxAxis);
  }

  const currentPixels = sourceWidth * scale * (sourceHeight * scale);
  if (currentPixels > MAX_PIXELS) {
    scale = Math.min(scale, Math.sqrt(MAX_PIXELS / (sourceWidth * sourceHeight)));
  }

  let targetWidth = Math.max(MIN_DIMENSION, Math.round(sourceWidth * scale));
  let targetHeight = Math.max(MIN_DIMENSION, Math.round(sourceHeight * scale));

  while (targetWidth * targetHeight > MAX_PIXELS) {
    targetWidth = Math.round(targetWidth * 0.98);
    targetHeight = Math.round(targetHeight * 0.98);
  }

  // Render onto canvas with white background
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    if ("close" in imageSource && typeof imageSource.close === "function") {
      imageSource.close();
    }
    throw new Error("No se pudo inicializar el contexto de imagen en el navegador.");
  }

  // Fill white background
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, targetWidth, targetHeight);

  // Draw oriented image
  ctx.drawImage(imageSource, 0, 0, targetWidth, targetHeight);

  if ("close" in imageSource && typeof imageSource.close === "function") {
    imageSource.close();
  }

  // Export to JPEG blob under 3 MiB
  const qualities = [0.92, 0.85, 0.75, 0.65];
  let finalBlob: Blob | null = null;

  for (const quality of qualities) {
    const blob = await canvasToBlob(canvas, "image/jpeg", quality);
    if (blob.size <= MAX_BYTE_SIZE) {
      finalBlob = blob;
      break;
    }
  }

  if (!finalBlob) {
    // If still over 3 MiB, scale down canvas further
    const scaledCanvas = document.createElement("canvas");
    scaledCanvas.width = Math.round(targetWidth * 0.75);
    scaledCanvas.height = Math.round(targetHeight * 0.75);
    const scaledCtx = scaledCanvas.getContext("2d");
    if (scaledCtx) {
      scaledCtx.fillStyle = "#FFFFFF";
      scaledCtx.fillRect(0, 0, scaledCanvas.width, scaledCanvas.height);
      scaledCtx.drawImage(canvas, 0, 0, scaledCanvas.width, scaledCanvas.height);
      finalBlob = await canvasToBlob(scaledCanvas, "image/jpeg", 0.75);
      targetWidth = scaledCanvas.width;
      targetHeight = scaledCanvas.height;
    } else {
      finalBlob = await canvasToBlob(canvas, "image/jpeg", 0.5);
    }
  }

  if (!finalBlob || finalBlob.size > MAX_BYTE_SIZE) {
    throw new Error("No se pudo comprimir la imagen por debajo del límite de 3 MiB.");
  }

  const previewUrl = URL.createObjectURL(finalBlob);

  return {
    blob: finalBlob,
    previewUrl,
    width: targetWidth,
    height: targetHeight,
    release: () => {
      URL.revokeObjectURL(previewUrl);
    },
  };
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo cargar la imagen seleccionada."));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Error al convertir imagen a Blob."));
        }
      },
      type,
      quality,
    );
  });
}
