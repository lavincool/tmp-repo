import { z } from "zod";

/**
 * Registration form and payload validation schema.
 * - name: trimmed 1-64 Unicode characters
 * - consent: strictly literal "true"
 */
export const registerPersonSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio.")
    .max(64, "El nombre no puede tener más de 64 caracteres."),
  consent: z.literal("true"),
});

export type RegisterPersonInput = z.infer<typeof registerPersonSchema>;

/**
 * Query parameters for listing people.
 */
export const listPeopleQuerySchema = z.object({
  cursor: z.string().optional(),
});

/**
 * DTO for a registered person.
 */
export interface PersonDto {
  faceId: string;
  externalId: string | null;
  name: string;
}

/**
 * Paginated response for registered people.
 */
export interface PeopleListResponse {
  people: PersonDto[];
  nextCursor: string | null;
}

/**
 * Normalized bounding box (0 to 1 relative coordinates).
 */
export interface BoundingBoxDto {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface RecognizedMatchedFace {
  detectionIndex: number;
  status: "matched";
  boundingBox: BoundingBoxDto;
  name: string;
  externalId: string | null;
  similarity: number;
}

export interface RecognizedUnknownFace {
  detectionIndex: number;
  status: "unknown";
  boundingBox: BoundingBoxDto;
  name: null;
}

export interface RecognizedFailedFace {
  detectionIndex: number;
  status: "failed";
  boundingBox: BoundingBoxDto;
  name: null;
  error: {
    code: string;
    message: string;
    requestId?: string;
  };
}

export type RecognizedFaceDto =
  | RecognizedMatchedFace
  | RecognizedUnknownFace
  | RecognizedFailedFace;

/**
 * Recognition response structure.
 */
export interface RecognizeResponseDto {
  image: {
    width: number;
    height: number;
  };
  faces: RecognizedFaceDto[];
  partial: boolean;
  operationError?: {
    code: string;
    message: string;
    requestId?: string;
  } | null;
}

/**
 * Consistent error response structure.
 */
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string | null;
  };
}
