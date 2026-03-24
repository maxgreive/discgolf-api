import { getCache, setCache } from '../cache.js';
import env from '../env.js';
import { http } from '../http.js';
import type { TournamentOutput } from '../types.js';

const OPENROUTESERVICE_API_URL = env.OPENROUTESERVICE_API_URL ?? 'https://api.openrouteservice.org';
const LOCATION_CACHE_PREFIX = 'location:normalized';
const LOCATION_CACHE_EXPIRY_SECONDS = 60 * 60 * 24 * 30;

interface ReverseGeocodeFeature {
  properties?: {
    country_a?: string;
    county?: string;
    label?: string;
    locality?: string;
    localadmin?: string;
    macrocounty?: string;
    name?: string;
    region?: string;
  };
}

interface ReverseGeocodeResponse {
  features?: ReverseGeocodeFeature[];
}

export async function normalizeTournamentLocation(
  coords: { lat: number | null; lng: number | null },
  fallbackLocation: string,
): Promise<string> {
  if (coords.lat === null || coords.lng === null) {
    return fallbackLocation.trim();
  }

  const cacheKey = buildLocationCacheKey(coords.lat, coords.lng);
  const cachedLocation = await getCache<string>(cacheKey);
  if (cachedLocation) {
    return cachedLocation;
  }

  try {
    const response = await http.get<ReverseGeocodeResponse>('/geocode/reverse', {
      baseURL: OPENROUTESERVICE_API_URL,
      params: {
        api_key: env.OPENROUTESERVICE_API_KEY,
        'boundary.country': 'DE',
        lang: 'de',
        'point.lat': coords.lat,
        'point.lon': coords.lng,
        size: 1,
      },
      headers: {
        'Accept-Language': 'de',
      },
    });

    const normalizedLocation = buildNormalizedLocation(response.data.features?.[0]?.properties);
    const result = normalizedLocation || fallbackLocation.trim();
    await setCache(cacheKey, result, LOCATION_CACHE_EXPIRY_SECONDS);
    return result;
  } catch {
    return fallbackLocation.trim();
  }
}

export async function normalizeTournamentLocations(
  tournaments: TournamentOutput[],
): Promise<TournamentOutput[]> {
  const normalizedLocations = new Map<string, Promise<string>>();

  return Promise.all(
    tournaments.map(async (tournament) => {
      const { lat, lng } = tournament.coords;
      const cacheKey =
        lat === null || lng === null ? tournament.location : `${lat.toFixed(5)},${lng.toFixed(5)}`;

      if (!normalizedLocations.has(cacheKey)) {
        normalizedLocations.set(
          cacheKey,
          normalizeTournamentLocation(tournament.coords, tournament.location),
        );
      }

      const normalizedLocation =
        normalizedLocations.get(cacheKey) ??
        normalizeTournamentLocation(tournament.coords, tournament.location);

      return {
        ...tournament,
        location: await normalizedLocation,
      };
    }),
  );
}

function buildLocationCacheKey(lat: number, lng: number): string {
  return `${LOCATION_CACHE_PREFIX}:${lat.toFixed(5)},${lng.toFixed(5)}`;
}

function buildNormalizedLocation(properties?: ReverseGeocodeFeature['properties']): string | null {
  if (!properties || (properties.country_a && properties.country_a !== 'DEU')) {
    return null;
  }

  const city = firstNonEmpty(properties.locality, properties.localadmin, properties.name);
  const region = firstNonEmpty(properties.region, properties.county, properties.macrocounty);

  if (!city) {
    return null;
  }

  if (!region || sameLocation(city, region)) {
    return city;
  }

  return `${city}, ${region}`;
}

function firstNonEmpty(...values: Array<string | undefined>): string | null {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return null;
}

function sameLocation(left: string, right: string): boolean {
  return normalizeLocationToken(left) === normalizeLocationToken(right);
}

function normalizeLocationToken(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toLowerCase();
}
