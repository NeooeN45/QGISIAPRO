import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchHubEauStations } from "../rest-connectors/hubeau";
import { fetchGbifOccurrences } from "../rest-connectors/gbif";
import { fetchDvfTransactions } from "../rest-connectors/dvf";
import { ConnectorError } from "../rest-connectors/types";

function mockFetchOk(payload: unknown) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function mockFetchStatus(status: number) {
  return vi.fn().mockResolvedValue(
    new Response("", { status, statusText: "Not Found" }),
  );
}

describe("Hub'Eau connector", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("should_return_geojson_when_response_is_FeatureCollection", async () => {
    globalThis.fetch = mockFetchOk({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [-1.68, 48.11] },
          properties: { code_station: "X1" },
        },
      ],
    });
    const r = await fetchHubEauStations({
      endpoint: "qualite_rivieres",
      codeCommune: "35238",
    });
    expect(r.ok).toBe(true);
    expect(r.count).toBe(1);
    expect(r.geojson.features[0].properties.code_station).toBe("X1");
  });

  it("should_pass_bbox_in_query", async () => {
    const fetchSpy = mockFetchOk({ type: "FeatureCollection", features: [] });
    globalThis.fetch = fetchSpy;
    await fetchHubEauStations({
      endpoint: "hydrometrie",
      bbox: [-2, 47, -1, 48],
    });
    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain("bbox=-2%2C47%2C-1%2C48");
    expect(url).toContain("/hydrometrie/referentiel/stations");
  });

  it("should_throw_ConnectorError_on_404", async () => {
    globalThis.fetch = mockFetchStatus(404);
    await expect(
      fetchHubEauStations({ endpoint: "piezometrie", codeCommune: "00000" }),
    ).rejects.toThrow(ConnectorError);
  });
});

describe("GBIF connector", () => {
  let originalFetch: typeof globalThis.fetch;
  beforeEach(() => { originalFetch = globalThis.fetch; });
  afterEach(() => { globalThis.fetch = originalFetch; vi.restoreAllMocks(); });

  it("should_require_one_filter_param", async () => {
    await expect(fetchGbifOccurrences({})).rejects.toThrow(/scientificName/);
  });

  it("should_transform_occurrences_to_geojson_points", async () => {
    globalThis.fetch = mockFetchOk({
      count: 2,
      results: [
        { key: 1, scientificName: "Quercus robur", decimalLatitude: 48.0, decimalLongitude: -2.0 },
        { key: 2, scientificName: "Fagus sylvatica", decimalLatitude: 48.5, decimalLongitude: -1.5 },
      ],
      endOfRecords: true,
    });
    const r = await fetchGbifOccurrences({ scientificName: "Quercus" });
    expect(r.count).toBe(2);
    expect(r.geojson.features[0].geometry.coordinates).toEqual([-2.0, 48.0]);
    expect(r.geojson.features[0].properties.scientificName).toBe("Quercus robur");
  });

  it("should_drop_occurrences_without_coordinates", async () => {
    globalThis.fetch = mockFetchOk({
      count: 2,
      results: [
        { key: 1, scientificName: "X" },
        { key: 2, scientificName: "Y", decimalLatitude: 48, decimalLongitude: -1 },
      ],
    });
    const r = await fetchGbifOccurrences({ country: "FR" });
    expect(r.count).toBe(1);
  });

  it("should_build_WKT_polygon_from_bbox", async () => {
    const fetchSpy = mockFetchOk({ count: 0, results: [] });
    globalThis.fetch = fetchSpy;
    await fetchGbifOccurrences({ scientificName: "Pinus", bbox: [-2, 47, -1, 48] });
    const url = decodeURIComponent(fetchSpy.mock.calls[0][0] as string);
    expect(url).toContain("POLYGON");
    expect(url).toContain("-2+47");
  });
});

describe("DVF connector", () => {
  let originalFetch: typeof globalThis.fetch;
  beforeEach(() => { originalFetch = globalThis.fetch; });
  afterEach(() => { globalThis.fetch = originalFetch; vi.restoreAllMocks(); });

  it("should_require_codeCommune_or_codePostal", async () => {
    await expect(fetchDvfTransactions({})).rejects.toThrow(/codeCommune/);
  });

  it("should_map_transactions_to_geojson", async () => {
    globalThis.fetch = mockFetchOk({
      nb_resultats: 1,
      resultats: [
        {
          id_mutation: "abc",
          date_mutation: "2024-03-15",
          nature_mutation: "Vente",
          valeur_fonciere: 250000,
          adresse_numero: 12,
          adresse_nom_voie: "Rue du Pré",
          code_postal: "35000",
          nom_commune: "Rennes",
          code_commune: "35238",
          type_local: "Maison",
          surface_reelle_bati: 95,
          nombre_pieces_principales: 4,
          longitude: -1.68,
          latitude: 48.11,
        },
      ],
    });
    const r = await fetchDvfTransactions({ codeCommune: "35238" });
    expect(r.count).toBe(1);
    const f = r.geojson.features[0];
    expect(f.geometry.coordinates).toEqual([-1.68, 48.11]);
    expect(f.properties.adresse).toBe("12 Rue du Pré");
    expect(f.properties.valeur_eur).toBe(250000);
  });

  it("should_apply_limit", async () => {
    globalThis.fetch = mockFetchOk({
      nb_resultats: 5,
      resultats: Array.from({ length: 5 }, (_, i) => ({
        id_mutation: `m${i}`,
        longitude: -1 + i * 0.01,
        latitude: 48,
      })),
    });
    const r = await fetchDvfTransactions({ codeCommune: "35238", limit: 2 });
    expect(r.count).toBe(2);
  });
});
