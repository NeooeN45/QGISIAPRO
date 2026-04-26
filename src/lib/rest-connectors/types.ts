/**
 * Types communs pour les connecteurs REST (Hub'Eau, GBIF, DVF, etc.)
 */

export interface GeoJsonPoint {
  type: "Point";
  coordinates: [number, number];
}

export interface GeoJsonFeature {
  type: "Feature";
  geometry: GeoJsonPoint;
  properties: Record<string, unknown>;
}

export interface GeoJsonFeatureCollection {
  type: "FeatureCollection";
  features: GeoJsonFeature[];
}

export interface ConnectorResult {
  ok: boolean;
  count: number;
  geojson: GeoJsonFeatureCollection;
  message: string;
  source: string;
}

export interface BboxParams {
  /** Bounding box [minLon, minLat, maxLon, maxLat] WGS84 */
  bbox?: [number, number, number, number];
}

export const DEFAULT_TIMEOUT_MS = 15000;

export class ConnectorError extends Error {
  constructor(
    message: string,
    public readonly source: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ConnectorError";
  }
}

/**
 * Wrapper fetch avec timeout + JSON parse + erreurs typées.
 */
export async function fetchJson<T>(
  url: string,
  source: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new ConnectorError(
        `${source} a répondu ${response.status} ${response.statusText}`,
        source,
        response.status,
      );
    }
    return (await response.json()) as T;
  } catch (err) {
    if (err instanceof ConnectorError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ConnectorError(
        `${source} : timeout après ${timeoutMs}ms`,
        source,
      );
    }
    const msg = err instanceof Error ? err.message : String(err);
    throw new ConnectorError(`${source} : ${msg}`, source);
  } finally {
    clearTimeout(timer);
  }
}

export function emptyCollection(): GeoJsonFeatureCollection {
  return { type: "FeatureCollection", features: [] };
}
