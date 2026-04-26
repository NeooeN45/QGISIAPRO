/**
 * Connecteur DVF — Demandes de Valeurs Foncières (transactions immobilières).
 *
 * API publique : https://api.cquest.org/dvf
 * Source officielle : data.gouv.fr (Etalab). Aucune clé requise.
 * Couverture : France entière, 2014 → présent.
 */

import {
  type ConnectorResult,
  type GeoJsonFeature,
  type GeoJsonFeatureCollection,
  ConnectorError,
  fetchJson,
} from "./types";

const DVF_BASE = "https://api.cquest.org/dvf";
const SOURCE = "DVF";

export interface DvfParams {
  /** Code INSEE de la commune (ex: "35238") */
  codeCommune?: string;
  /** Code postal (ex: "35000") */
  codePostal?: string;
  /** Section cadastrale */
  section?: string;
  /** Numéro de plan */
  numeroPlan?: string;
  /** Nature de mutation : "Vente", "Vente en l'état futur d'achèvement", etc. */
  natureMutation?: string;
  /** Type local : "Maison", "Appartement", "Local", "Dépendance" */
  typeLocal?: string;
  /** Nombre max de transactions (défaut 500) */
  limit?: number;
}

interface DvfTransaction {
  id_mutation?: string;
  date_mutation?: string;
  nature_mutation?: string;
  valeur_fonciere?: number;
  adresse_numero?: number;
  adresse_nom_voie?: string;
  code_postal?: string;
  nom_commune?: string;
  code_commune?: string;
  type_local?: string;
  surface_reelle_bati?: number;
  nombre_pieces_principales?: number;
  surface_terrain?: number;
  longitude?: number;
  latitude?: number;
}

interface DvfResponse {
  resultats: DvfTransaction[];
  nb_resultats: number;
}

function transactionToFeature(t: DvfTransaction): GeoJsonFeature | null {
  if (t.longitude == null || t.latitude == null) return null;
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: [t.longitude, t.latitude] },
    properties: {
      id_mutation: t.id_mutation ?? "",
      date: t.date_mutation ?? "",
      nature: t.nature_mutation ?? "",
      valeur_eur: t.valeur_fonciere ?? null,
      adresse: [t.adresse_numero, t.adresse_nom_voie].filter(Boolean).join(" "),
      code_postal: t.code_postal ?? "",
      commune: t.nom_commune ?? "",
      code_commune: t.code_commune ?? "",
      type_local: t.type_local ?? "",
      surface_bati: t.surface_reelle_bati ?? null,
      nb_pieces: t.nombre_pieces_principales ?? null,
      surface_terrain: t.surface_terrain ?? null,
    },
  };
}

export async function fetchDvfTransactions(params: DvfParams): Promise<ConnectorResult> {
  if (!params.codeCommune && !params.codePostal) {
    throw new ConnectorError(
      "Précise au moins codeCommune ou codePostal.",
      SOURCE,
    );
  }

  const query = new URLSearchParams();
  if (params.codeCommune) query.set("code_commune", params.codeCommune);
  if (params.codePostal) query.set("code_postal", params.codePostal);
  if (params.section) query.set("section", params.section);
  if (params.numeroPlan) query.set("numero_plan", params.numeroPlan);
  if (params.natureMutation) query.set("nature_mutation", params.natureMutation);
  if (params.typeLocal) query.set("type_local", params.typeLocal);

  const url = `${DVF_BASE}?${query.toString()}`;
  const json = await fetchJson<DvfResponse>(url, SOURCE);

  const limit = params.limit ?? 500;
  const transactions = (json.resultats ?? []).slice(0, limit);
  const features = transactions
    .map(transactionToFeature)
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
    message: `${features.length} transactions DVF récupérées (${json.nb_resultats ?? "?"} disponibles, ${features.length} géoréférencées)`,
  };
}
