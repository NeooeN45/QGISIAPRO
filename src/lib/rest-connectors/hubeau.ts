/**
 * Connecteur Hub'Eau — API publique française sur l'eau (eaufrance.fr).
 * Endpoints couverts :
 *   - qualite_rivieres : stations de mesure qualité des cours d'eau
 *   - hydrometrie : stations hydrométriques (débits, hauteurs)
 *   - piezometrie : stations piézométriques (nappes phréatiques)
 *
 * Doc : https://hubeau.eaufrance.fr/page/apis
 * Aucune clé requise. Retourne nativement du GeoJSON quand on précise
 * `format=geojson`.
 */

import {
  type ConnectorResult,
  type GeoJsonFeatureCollection,
  ConnectorError,
  fetchJson,
  emptyCollection,
} from "./types";

const HUBEAU_BASE = "https://hubeau.eaufrance.fr/api/v2";
const SOURCE = "Hub'Eau";

export type HubEauEndpoint =
  | "qualite_rivieres"
  | "hydrometrie"
  | "piezometrie";

const ENDPOINT_PATHS: Record<HubEauEndpoint, string> = {
  qualite_rivieres: "/qualite_rivieres/station_pc",
  hydrometrie: "/hydrometrie/referentiel/stations",
  piezometrie: "/niveaux_nappes/stations",
};

const ENDPOINT_LABELS: Record<HubEauEndpoint, string> = {
  qualite_rivieres: "Stations qualité rivières",
  hydrometrie: "Stations hydrométriques",
  piezometrie: "Stations piézométriques",
};

export interface HubEauParams {
  endpoint: HubEauEndpoint;
  /** Code INSEE de la commune (ex: "35238" pour Rennes) */
  codeCommune?: string;
  /** Code INSEE du département (ex: "35") */
  codeDepartement?: string;
  /** Bounding box [minLon, minLat, maxLon, maxLat] */
  bbox?: [number, number, number, number];
  /** Limite de résultats (max 20000, défaut 200) */
  size?: number;
}

interface HubEauResponse {
  count: number;
  data: GeoJsonFeatureCollection;
}

/**
 * Récupère les stations Hub'Eau au format GeoJSON.
 */
export async function fetchHubEauStations(
  params: HubEauParams,
): Promise<ConnectorResult> {
  const path = ENDPOINT_PATHS[params.endpoint];
  if (!path) {
    throw new ConnectorError(`Endpoint inconnu : ${params.endpoint}`, SOURCE);
  }

  const query = new URLSearchParams();
  query.set("format", "geojson");
  query.set("size", String(Math.min(params.size ?? 200, 20000)));
  if (params.codeCommune) query.set("code_commune", params.codeCommune);
  if (params.codeDepartement) query.set("code_departement", params.codeDepartement);
  if (params.bbox) query.set("bbox", params.bbox.join(","));

  const url = `${HUBEAU_BASE}${path}?${query.toString()}`;
  const json = await fetchJson<HubEauResponse | GeoJsonFeatureCollection>(url, SOURCE);

  // Hub'Eau renvoie soit { count, data: FeatureCollection } soit directement la FC.
  const fc: GeoJsonFeatureCollection =
    "type" in json && json.type === "FeatureCollection"
      ? (json as GeoJsonFeatureCollection)
      : (json as HubEauResponse).data ?? emptyCollection();

  const count = fc.features.length;
  return {
    ok: true,
    count,
    geojson: fc,
    source: SOURCE,
    message: `${count} ${ENDPOINT_LABELS[params.endpoint].toLowerCase()} récupérées via Hub'Eau`,
  };
}
