import "server-only";
import { Viso } from "@viso-lol/sdk";

export interface VisoServerConfig {
  apiKey: string;
  collectionId: string;
  baseUrl?: string;
}

export class ConfigurationError extends Error {
  readonly code = "configuration_required";
  readonly status = 503;

  constructor(
    message = "Configuración incompleta: configure VISO_API_KEY y VISO_COLLECTION_ID en el servidor.",
  ) {
    super(message);
    this.name = "ConfigurationError";
  }
}

/**
 * Validates and retrieves Viso server environment variables inside request handling.
 * Never throws at module load time.
 */
export function getVisoConfig(): VisoServerConfig {
  const apiKey = process.env.VISO_API_KEY?.trim();
  const collectionId = process.env.VISO_COLLECTION_ID?.trim();
  const baseUrl = process.env.VISO_BASE_URL?.trim() || undefined;

  if (!apiKey || !collectionId) {
    throw new ConfigurationError();
  }

  return { apiKey, collectionId, baseUrl };
}

/**
 * Creates an instance of the Viso SDK with maxRetries set to 0.
 */
export function createVisoClient(config: VisoServerConfig): Viso {
  return new Viso({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    maxRetries: 0,
  });
}
