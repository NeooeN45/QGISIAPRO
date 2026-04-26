/**
 * Connecteur GBIF — Global Biodiversity Information Facility.
 * Occurrences d'espèces géoréférencées dans le monde entier.
 *
 * Doc : https://www.gbif.org/developer/occurrence
 * Aucune clé requise. Retourne du JSON, à transformer en GeoJSON.
 */

import {
  type ConnectorResult,
  type GeoJsonFeature,
  type GeoJsonFeatureCollection,
  ConnectorError,
  fetchJson,
} from "./types";

const GBIF_BASE = "https://api.gbif.org/v1";
const SOURCE = "GBIF";

export interface GbifParams {
  /** Nom scientifique ou vernaculaire (ex: "Quercus robur") */
  scientificName?: string;
  /** Clé taxon GBIF si déjà connue */
  taxonKey?: number;
  /** Code pays ISO 3166-1 alpha-2 (ex: "FR") */
  country?: string;
  /** Bounding box [minLon, minLat, maxLon, maxLat] */
  bbox?: [number, number, number, number];
  /** Année min/max */
  yearStart?: number;
  yearEnd?: number;
  /** Limite résultats (max 300 par GBIF, défaut 100) */
  limit?: number;
}

interface GbifOccurrence {
  key: number;
  scientificName?: string;
  vernacularName?: string;
  decimalLatitude?: number;
  decimalLongitude?: number;
  eventDate?: string;
  country?: string;
  basisOfRecord?: string;
  datasetName?: string;
  taxonKey?: number;
}

interface GbifSearchResponse {
  count: number;
  results: GbifOccurrence[];
  endOfRecords: boolean;
}

function buildSearchUrl(params: GbifParams): string {
  const query = new URLSearchParams();
  query.set("limit", String(Math.min(params.limit ?? 100, 300)));
  query.set("hasCoordinate", "true");
  query.set("hasGeospatialIssue", "false");
  if (params.scientificName) query.set("scientificName", params.scientificName);
  if (params.taxonKey != null) query.set("taxonKey", String(params.taxonKey));
  if (params.country) query.set("country", params.country.toUpperCase());
  if (params.yearStart && params.yearEnd) {
    query.set("year", `${params.yearStart},${params.yearEnd}`);
  } else if (params.yearStart) {
    query.set("year", `${params.yearStart},*`);
  }
  if (params.bbox) {
    const [minLon, minLat, maxLon, maxLat] = params.bbox;
    // GBIF utilise WKT polygon
    const wkt = `POLYGON((${minLon} ${minLat},${maxLon} ${minLat},${maxLon} ${maxLat},${minLon} ${maxLat},${minLon} ${minLat}))`;
    query.set("geometry", wkt);
  }
  return `${GBIF_BASE}/occurrence/search?${query.toString()}`;
}

function occurrenceToFeature(occ: GbifOccurrence): GeoJsonFeature | null {
  if (occ.decimalLongitude == null || occ.decimalLatitude == null) return null;
  return {
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [occ.decimalLongitude, occ.decimalLatitude],
    },
    properties: {
      gbif_key: occ.key,
      scientificName: occ.scientificName ?? "",
      vernacularName: occ.vernacularName ?? "",
      eventDate: occ.eventDate ?? "",
      country: occ.country ?? "",
      basisOfRecord: occ.basisOfRecord ?? "",
      datasetName: occ.datasetName ?? "",
      taxonKey: occ.taxonKey ?? null,
    },
  };
}

export async function fetchGbifOccurrences(
  params: GbifParams,
): Promise<ConnectorResult> {
  if (!params.scientificName && params.taxonKey == null && !params.country && !params.bbox) {
    throw new ConnectorError(
      "Précise au moins scientificName, taxonKey, country ou bbox.",
      SOURCE,
    );
  }
  const url = buildSearchUrl(params);
  const json = await fetchJson<GbifSearchResponse>(url, SOURCE);

  const features: GeoJsonFeature[] = (json.results ?? [])
    .map(occurrenceToFeature)
    .filter((f): f is GeoJsonFeature => f !== null);

  const fc: GeoJsonFeatureCollection = {
    type: "FeatureCollection",
    features,
  };

  return {
    ok: true,
    count: features.length,
    geojson: fc,
    source: SOURCE,
    message: `${features.length} occurrences GBIF récupérées (total disponible : ${json.count ?? "?"})`,
  };
}
