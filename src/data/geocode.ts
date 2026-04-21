/**
 * Geocoding via Nominatim (OpenStreetMap).
 *
 * Nominatim is a free public geocoder with no API key required. In exchange
 * it has strict usage rules we follow:
 *   - max 1 request per second
 *   - a descriptive User-Agent
 *   - no bulk / automated crawling
 * See https://operations.osmfoundation.org/policies/nominatim/
 *
 * If a user's network can't reach Nominatim (e.g. China mainland without VPN),
 * Resolve will fail with a network error. They can still use the drop-pin
 * workflow or paste coordinates manually — geocoding is strictly additive.
 */

export interface GeocodeResult {
  lat: number;
  lng: number;
  /** Human-readable address Nominatim matched. Shown to user for confirmation. */
  displayName: string;
}

export class GeocodeError extends Error {
  constructor(
    message: string,
    public readonly kind: "not-found" | "network" | "rate-limit",
  ) {
    super(message);
  }
}

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "Odyssey-Obsidian-Plugin/0.1";
const MIN_INTERVAL_MS = 1000; // Nominatim policy: max 1 rps

let lastRequestAt = 0;

async function respectRateLimit(): Promise<void> {
  const since = Date.now() - lastRequestAt;
  if (since < MIN_INTERVAL_MS) {
    await new Promise((r) => setTimeout(r, MIN_INTERVAL_MS - since));
  }
  lastRequestAt = Date.now();
}

/**
 * Resolve a free-text location to lat/lng.
 * Returns the top match, or throws GeocodeError.
 */
export async function geocode(query: string): Promise<GeocodeResult> {
  const q = query.trim();
  if (!q) throw new GeocodeError("Empty query", "not-found");

  await respectRateLimit();

  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "0");

  let resp: Response;
  try {
    resp = await fetch(url.toString(), {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
    });
  } catch (e) {
    throw new GeocodeError(
      `Couldn't reach geocoder: ${(e as Error).message}`,
      "network",
    );
  }

  if (resp.status === 429) {
    throw new GeocodeError("Geocoder rate-limited us. Try again in a moment.", "rate-limit");
  }
  if (!resp.ok) {
    throw new GeocodeError(`Geocoder error: HTTP ${resp.status}`, "network");
  }

  let data: Array<{
    lat: string;
    lon: string;
    display_name: string;
  }>;
  try {
    data = await resp.json();
  } catch {
    throw new GeocodeError("Geocoder returned invalid JSON", "network");
  }

  if (!Array.isArray(data) || data.length === 0) {
    throw new GeocodeError(
      `Couldn't find "${q}". Try being more specific, or drop a pin.`,
      "not-found",
    );
  }

  const top = data[0];
  const lat = parseFloat(top.lat);
  const lng = parseFloat(top.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new GeocodeError("Geocoder returned invalid coordinates", "network");
  }

  return { lat, lng, displayName: top.display_name };
}
