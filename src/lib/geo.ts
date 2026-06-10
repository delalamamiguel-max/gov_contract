// Lightweight geo utilities for distance-based opportunity matching.
//
// We avoid a geocoding dependency by estimating distance between U.S. states
// using state centroids. This is coarse (state-to-state), but gives the radius
// slider a real, monotonic number to act on. Same-state and same-city are
// special-cased to ~0 miles. Remote-eligible work bypasses distance entirely.

interface LatLng { lat: number; lng: number }

// Centroids (approx) for 50 states + DC, keyed by USPS code.
const STATE_CENTROIDS: Record<string, LatLng> = {
  AL: { lat: 32.806, lng: -86.791 }, AK: { lat: 61.370, lng: -152.404 },
  AZ: { lat: 33.729, lng: -111.431 }, AR: { lat: 34.970, lng: -92.373 },
  CA: { lat: 36.116, lng: -119.682 }, CO: { lat: 39.059, lng: -105.311 },
  CT: { lat: 41.598, lng: -72.755 }, DE: { lat: 39.319, lng: -75.507 },
  DC: { lat: 38.897, lng: -77.026 }, FL: { lat: 27.766, lng: -81.687 },
  GA: { lat: 33.040, lng: -83.643 }, HI: { lat: 21.094, lng: -157.498 },
  ID: { lat: 44.240, lng: -114.478 }, IL: { lat: 40.349, lng: -88.986 },
  IN: { lat: 39.849, lng: -86.258 }, IA: { lat: 42.011, lng: -93.210 },
  KS: { lat: 38.526, lng: -96.726 }, KY: { lat: 37.668, lng: -84.670 },
  LA: { lat: 31.169, lng: -91.867 }, ME: { lat: 44.693, lng: -69.381 },
  MD: { lat: 39.064, lng: -76.802 }, MA: { lat: 42.230, lng: -71.530 },
  MI: { lat: 43.326, lng: -84.536 }, MN: { lat: 45.694, lng: -93.900 },
  MS: { lat: 32.741, lng: -89.678 }, MO: { lat: 38.456, lng: -92.288 },
  MT: { lat: 46.921, lng: -110.454 }, NE: { lat: 41.125, lng: -98.268 },
  NV: { lat: 38.313, lng: -117.055 }, NH: { lat: 43.452, lng: -71.564 },
  NJ: { lat: 40.298, lng: -74.521 }, NM: { lat: 34.840, lng: -106.248 },
  NY: { lat: 42.166, lng: -74.948 }, NC: { lat: 35.630, lng: -79.806 },
  ND: { lat: 47.528, lng: -99.784 }, OH: { lat: 40.388, lng: -82.764 },
  OK: { lat: 35.565, lng: -96.928 }, OR: { lat: 44.572, lng: -122.071 },
  PA: { lat: 40.590, lng: -77.209 }, RI: { lat: 41.680, lng: -71.511 },
  SC: { lat: 33.856, lng: -80.945 }, SD: { lat: 44.299, lng: -99.438 },
  TN: { lat: 35.747, lng: -86.692 }, TX: { lat: 31.054, lng: -97.563 },
  UT: { lat: 40.150, lng: -111.862 }, VT: { lat: 44.045, lng: -72.710 },
  VA: { lat: 37.769, lng: -78.170 }, WA: { lat: 47.400, lng: -121.490 },
  WV: { lat: 38.491, lng: -80.954 }, WI: { lat: 44.268, lng: -89.616 },
  WY: { lat: 42.756, lng: -107.302 },
};

const STATE_NAME_TO_CODE: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
  colorado: 'CO', connecticut: 'CT', delaware: 'DE', 'district of columbia': 'DC',
  florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID', illinois: 'IL',
  indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY', louisiana: 'LA',
  maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI', minnesota: 'MN',
  mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK',
  oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT',
  virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY',
};

/** Extract a USPS state code + city from a free-text location like "Austin, TX". */
export function parseLocation(loc?: string | null): { state: string | null; city: string | null } {
  if (!loc) return { state: null, city: null };
  const text = loc.trim();
  // Try "City, ST" or "City, State Name"
  const parts = text.split(',').map((s) => s.trim()).filter(Boolean);
  let state: string | null = null;
  let city: string | null = null;
  if (parts.length >= 2) {
    city = parts[0];
    const tail = parts[parts.length - 1].toUpperCase();
    if (STATE_CENTROIDS[tail]) state = tail;
    else state = STATE_NAME_TO_CODE[parts[parts.length - 1].toLowerCase()] || null;
  } else {
    // Single token — maybe a bare state code or name
    const up = text.toUpperCase();
    if (STATE_CENTROIDS[up]) state = up;
    else state = STATE_NAME_TO_CODE[text.toLowerCase()] || null;
    if (!state) city = text;
  }
  return { state, city };
}

function haversineMiles(a: LatLng, b: LatLng): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/**
 * Estimate distance (miles) between an agency location and an opportunity's
 * place of performance. Returns null when it can't be determined.
 * Same state → small nominal distance; same city → ~0.
 */
export function estimateDistanceMiles(
  agencyLocation?: string | null,
  oppPlaceOfPerformance?: string | null
): number | null {
  const a = parseLocation(agencyLocation);
  const o = parseLocation(oppPlaceOfPerformance);
  if (!a.state || !o.state) return null;
  if (a.state === o.state) {
    if (a.city && o.city && a.city.toLowerCase() === o.city.toLowerCase()) return 0;
    return 40; // same-state nominal — typically reachable
  }
  const ca = STATE_CENTROIDS[a.state];
  const co = STATE_CENTROIDS[o.state];
  if (!ca || !co) return null;
  return haversineMiles(ca, co);
}

const NATIONWIDE_HINTS = ['nationwide', 'various', 'multiple', 'united states', 'remote', 'n/a', 'tbd'];

/**
 * Whether an opportunity is effectively remote-eligible: either its place of
 * performance is nationwide/unspecified, or its scope is digital marketing work
 * that can be delivered remotely.
 */
export function isRemoteEligible(text: string, placeOfPerformance?: string | null): boolean {
  const pop = (placeOfPerformance || '').toLowerCase();
  // A blank place-of-performance is UNKNOWN, not remote. Assuming remote here was
  // the root cause of out-of-area contracts (e.g. a Sacramento on-site job with no
  // POP field) scoring as high matches for a faraway agency. Let the distance
  // check decide instead.
  if (!pop) return false;
  if (NATIONWIDE_HINTS.some((h) => pop.includes(h))) return true;
  const t = text.toLowerCase();
  // Only SPECIFIC digital-delivery terms bypass distance. Generic single words
  // like 'strategy', 'content', 'digital', 'analytics', 'branding', 'video'
  // appear in nearly every marketing solicitation (including on-site ones) and
  // were incorrectly flipping local work to remote-eligible.
  const digital = [
    'website', 'web design', 'web development', 'web application',
    'seo', 'social media', 'email marketing', 'digital marketing',
    'graphic design', 'video production', 'copywriting',
  ];
  return digital.some((d) => t.includes(d));
}
