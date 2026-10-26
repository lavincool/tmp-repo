import "server-only";
import { Viso, VisoError, VisoConnectionError } from "@viso-lol/sdk";
import { getVisoConfig, createVisoClient, ConfigurationError } from "./viso";
import { validateImageBytes, ImageValidationError } from "./images";
import type {
  PersonDto,
  PeopleListResponse,
  RecognizeResponseDto,
  RecognizedFaceDto,
} from "@/lib/contracts";

export class FaceEnrollmentError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code = "enrollment_error", status = 400) {
    super(message);
    this.name = "FaceEnrollmentError";
    this.code = code;
    this.status = status;
  }
}

/**
 * Enrolls a single person's face into the server-configured collection.
 * 1. Validates image bytes with sharp.
 * 2. Runs detection: exactly one face must be detected.
 * 3. Indexes the face with server-generated externalId and metadata.
 */
export async function enrollPerson(
  rawImageBytes: Buffer | Uint8Array,
  name: string,
  consent: string,
  visoClientOverride?: Viso,
  collectionIdOverride?: string,
): Promise<PersonDto> {
  const trimmedName = name.trim();
  if (!trimmedName || trimmedName.length > 64) {
    throw new FaceEnrollmentError(
      "El nombre debe tener entre 1 y 64 caracteres.",
      "invalid_name",
      400,
    );
  }

  if (consent !== "true") {
    throw new FaceEnrollmentError(
      "Debe aceptar el consentimiento para continuar.",
      "consent_required",
      400,
    );
  }

  // Validate image bytes and dimensions on the server
  const validated = await validateImageBytes(rawImageBytes);

  const config = getVisoConfig();
  const collectionId = collectionIdOverride ?? config.collectionId;
  const viso = visoClientOverride ?? createVisoClient(config);

  // 1. Detect faces: ensure exactly one face is present in the portrait
  const detection = await viso.face.detect({
    image: validated.buffer,
    attributes: "default",
  });

  const faceCount = detection.faces.length;
  if (faceCount === 0) {
    throw new FaceEnrollmentError(
      "No se detectó ningún rostro en la fotografía. La imagen debe contener exactamente un rostro visible.",
      "no_face_detected",
      422,
    );
  }

  if (faceCount > 1) {
    throw new FaceEnrollmentError(
      `Se detectaron ${faceCount} rostros en la fotografía. La imagen debe contener exactamente un solo rostro.`,
      "multiple_faces_detected",
      422,
    );
  }

  // 2. Index the face into the collection
  const externalId = crypto.randomUUID();
  const consentAt = new Date().toISOString();

  const indexResult = await viso.face.collections.faces.index(collectionId, {
    image: validated.buffer,
    externalId,
    metadata: {
      name: trimmedName,
      consentAt,
    },
    maxFaces: 1,
    qualityFilter: "auto",
  });

  if (!indexResult.indexed || indexResult.indexed.length !== 1) {
    const reason = indexResult.unindexed?.[0]?.reasons?.join(", ");
    throw new FaceEnrollmentError(
      reason
        ? `No se pudo indexar el rostro: ${reason}.`
        : "No se pudo indexar el rostro en la colección.",
      "indexing_failed",
      422,
    );
  }

  const indexedFace = indexResult.indexed[0];
  const registeredName =
    typeof indexedFace.metadata?.name === "string" && indexedFace.metadata.name.trim().length > 0
      ? indexedFace.metadata.name.trim()
      : trimmedName;

  return {
    faceId: indexedFace.id,
    externalId: indexedFace.externalId ?? externalId,
    name: registeredName,
  };
}

/**
 * Lists registered people in the collection with pagination.
 */
export async function listPeople(
  cursor?: string,
  visoClientOverride?: Viso,
  collectionIdOverride?: string,
): Promise<PeopleListResponse> {
  const config = getVisoConfig();
  const collectionId = collectionIdOverride ?? config.collectionId;
  const viso = visoClientOverride ?? createVisoClient(config);

  const page = await viso.face.collections.faces.list(collectionId, {
    limit: 20,
    cursor: cursor || undefined,
  });

  const people: PersonDto[] = page.data.map((face) => {
    let displayName = "Persona sin nombre";
    if (typeof face.metadata?.name === "string" && face.metadata.name.trim().length > 0) {
      displayName = face.metadata.name.trim();
    }

    return {
      faceId: face.id,
      externalId: face.externalId ?? null,
      name: displayName,
    };
  });

  return {
    people,
    nextCursor: page.nextCursor ?? null,
  };
}

/**
 * Deletes a registered face from the server-configured collection.
 */
export async function deletePerson(
  faceId: string,
  visoClientOverride?: Viso,
  collectionIdOverride?: string,
): Promise<{ success: boolean; id: string }> {
  if (!faceId || typeof faceId !== "string" || !faceId.trim()) {
    throw new FaceEnrollmentError("Identificador de rostro inválido.", "invalid_id", 400);
  }

  const config = getVisoConfig();
  const collectionId = collectionIdOverride ?? config.collectionId;
  const viso = visoClientOverride ?? createVisoClient(config);

  const result = await viso.face.collections.faces.delete(collectionId, faceId.trim());

  return {
    success: result.deleted === true,
    id: result.id,
  };
}

/**
 * Performs face-only recognition on an uploaded photo against the collection.
 * OMIT OBJECTS ENTIRELY.
 */
export async function recognizeFaces(
  rawImageBytes: Buffer | Uint8Array,
  visoClientOverride?: Viso,
  collectionIdOverride?: string,
): Promise<RecognizeResponseDto> {
  const validated = await validateImageBytes(rawImageBytes);

  const config = getVisoConfig();
  const collectionId = collectionIdOverride ?? config.collectionId;
  const viso = visoClientOverride ?? createVisoClient(config);

  const analysis = await viso.vision.analyze({
    image: validated.buffer,
    faces: {
      enabled: true,
      collectionId,
      threshold: 90,
      maxDetectedFaces: 10,
    },
  });

  const faces: RecognizedFaceDto[] = (analysis.faces || []).map((face) => {
    if (face.status === "matched") {
      const matchedName =
        face.name ||
        (typeof face.match.face.metadata?.name === "string" &&
        face.match.face.metadata.name.trim().length > 0
          ? face.match.face.metadata.name.trim()
          : "Persona registrada");

      return {
        detectionIndex: face.detectionIndex,
        status: "matched",
        boundingBox: face.boundingBox,
        name: matchedName,
        externalId: face.match.face.externalId ?? null,
        similarity: face.match.similarity,
      };
    }

    if (face.status === "failed") {
      return {
        detectionIndex: face.detectionIndex,
        status: "failed",
        boundingBox: face.boundingBox,
        name: null,
        error: {
          code: face.error.code,
          message: face.error.message,
          requestId: face.error.requestId,
        },
      };
    }

    // unknown
    return {
      detectionIndex: face.detectionIndex,
      status: "unknown",
      boundingBox: face.boundingBox,
      name: null,
    };
  });

  let operationError: { code: string; message: string; requestId?: string } | null = null;
  const faceOpErrors = analysis.operations?.faces?.errors;
  if (faceOpErrors && faceOpErrors.length > 0) {
    const firstErr = faceOpErrors[0];
    operationError = {
      code: firstErr.code,
      message: firstErr.message,
      requestId: firstErr.requestId,
    };
  }

  return {
    image: {
      width: analysis.image.width || validated.width,
      height: analysis.image.height || validated.height,
    },
    faces,
    partial: analysis.partial === true,
    operationError,
  };
}

/**
 * Safe error mapping for HTTP Route Handlers.
 * Guarantees no sensitive tokens, raw bytes, or internal secrets are exposed.
 */
export function mapServerError(error: unknown): {
  status: number;
  body: { error: { code: string; message: string; requestId?: string | null } };
} {
  if (error instanceof ConfigurationError) {
    return {
      status: error.status,
      body: {
        error: {
          code: error.code,
          message: error.message,
        },
      },
    };
  }

  if (error instanceof ImageValidationError) {
    return {
      status: error.status,
      body: {
        error: {
          code: error.code,
          message: error.message,
        },
      },
    };
  }

  if (error instanceof FaceEnrollmentError) {
    return {
      status: error.status,
      body: {
        error: {
          code: error.code,
          message: error.message,
        },
      },
    };
  }

  if (error instanceof VisoError) {
    let friendlyMessage = error.message;

    switch (error.code) {
      case "face.not_enabled":
        friendlyMessage =
          "El servicio de reconocimiento facial no está habilitado en este proyecto.";
        break;
      case "auth.insufficient_scope":
        friendlyMessage =
          "La clave de API no tiene los permisos necesarios (requiere face:read y face:write).";
        break;
      case "resource.not_found":
        friendlyMessage = "La colección de rostros no fue encontrada o no existe.";
        break;
      case "quota.exceeded":
        friendlyMessage = "Se ha alcanzado la cuota de operaciones del servicio Viso.";
        break;
      case "rate_limit.exceeded":
        friendlyMessage = "Límite de solicitudes superado. Inténtelo de nuevo en unos momentos.";
        break;
      case "face.no_face_detected":
        friendlyMessage = "No se detectó ningún rostro en la fotografía.";
        break;
      case "face.image_too_large":
      case "request.body_too_large":
        friendlyMessage = "La imagen supera el tamaño máximo permitido.";
        break;
      case "face.unsupported_format":
        friendlyMessage = "El formato de la imagen no es compatible. Use JPEG o PNG.";
        break;
      case "vision.analysis_failed":
        friendlyMessage = "No se pudo completar el análisis visual de la imagen.";
        break;
    }

    return {
      status:
        typeof error.status === "number" && error.status >= 400 && error.status < 600
          ? error.status
          : 500,
      body: {
        error: {
          code: error.code || "viso_error",
          message: friendlyMessage,
          requestId: error.requestId ?? null,
        },
      },
    };
  }

  if (error instanceof VisoConnectionError) {
    return {
      status: error.timeout ? 504 : 502,
      body: {
        error: {
          code: error.timeout ? "timeout" : "network_error",
          message: error.timeout
            ? "Tiempo de espera agotado al conectar con el servicio Viso."
            : "Error de red al conectar con el servicio Viso.",
        },
      },
    };
  }

  const message = error instanceof Error ? error.message : "Error interno del servidor.";
  return {
    status: 500,
    body: {
      error: {
        code: "internal_error",
        message,
      },
    },
  };
}
