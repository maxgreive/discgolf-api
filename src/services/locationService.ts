import { getCache, setCache } from '../cache.js';
import env from '../env.js';
import { getJson, http } from '../http.js';
import type { TournamentOutput } from '../types.js';

const OPENROUTESERVICE_API_URL = env.OPENROUTESERVICE_API_URL ?? 'https://api.openrouteservice.org';
const BAHN_STATION_API_URL = env.BAHN_STATION_API_URL;
const LOCATION_CACHE_PREFIX = 'location:normalized';
const STATION_CACHE_PREFIX = 'location:station';
const LOCATION_CACHE_EXPIRY_SECONDS = 60 * 60 * 24 * 30;
const STATION_CACHE_EXPIRY_SECONDS = 60 * 60 * 24 * 30;
const EMPTY_STATION_CACHE_VALUE = '__none__';

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

interface BahnStationResult {
  id?: string;
  name?: string;
  products?: string[];
  type?: string;
}

export interface ResolvedStation {
  id?: string;
  name: string;
  type?: string;
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
  const resolvedStations = new Map<string, Promise<string | undefined>>();

  return Promise.all(
    tournaments.map(async (tournament) => {
      const { lat, lng } = tournament.coords;
      const locationKey =
        lat === null || lng === null ? tournament.location : `${lat.toFixed(5)},${lng.toFixed(5)}`;

      if (!normalizedLocations.has(locationKey)) {
        normalizedLocations.set(
          locationKey,
          normalizeTournamentLocation(tournament.coords, tournament.location),
        );
      }

      const normalizedLocation =
        normalizedLocations.get(locationKey) ??
        normalizeTournamentLocation(tournament.coords, tournament.location);

      const stationQuery = await normalizedLocation;
      const stationKey = normalizeLocationToken(stationQuery);

      if (stationKey && !resolvedStations.has(stationKey)) {
        resolvedStations.set(stationKey, resolveNearestStation(stationQuery));
      }

      return {
        ...tournament,
        location: stationQuery,
        station: stationKey ? await resolvedStations.get(stationKey) : undefined,
      };
    }),
  );
}

function buildLocationCacheKey(lat: number, lng: number): string {
  return `${LOCATION_CACHE_PREFIX}:${lat.toFixed(5)},${lng.toFixed(5)}`;
}

function buildStationCacheKey(query: string): string {
  return `${STATION_CACHE_PREFIX}:${normalizeLocationToken(query)}`;
}

export async function resolveNearestStation(query: string): Promise<string | undefined> {
  const station = await resolveNearestStationMatch(query);
  return station?.name;
}

export async function resolveNearestStationMatch(
  query: string,
): Promise<ResolvedStation | undefined> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery || !BAHN_STATION_API_URL) {
    return undefined;
  }

  const cacheKey = buildStationCacheKey(trimmedQuery);
  const cachedStation = await getCache<ResolvedStation | typeof EMPTY_STATION_CACHE_VALUE>(
    cacheKey,
  );
  if (cachedStation) {
    return cachedStation === EMPTY_STATION_CACHE_VALUE ? undefined : cachedStation;
  }

  try {
    const stations = await getJson<BahnStationResult[]>(BAHN_STATION_API_URL, {
      params: {
        suchbegriff: trimmedQuery,
        typ: 'ALL',
        limit: 10,
      },
    });

    const station = selectPreferredStation(stations);
    await setCache(cacheKey, station || EMPTY_STATION_CACHE_VALUE, STATION_CACHE_EXPIRY_SECONDS);
    return station;
  } catch {
    return undefined;
  }
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

function selectPreferredStation(
  stations: BahnStationResult[] | undefined,
): ResolvedStation | undefined {
  if (!stations?.length) {
    return undefined;
  }

  const stationStop = stations.find((station) => station.type === 'ST');
  if (stationStop) {
    return buildResolvedStation(stationStop);
  }

  const railStation = stations.find(hasRailProducts);
  return buildResolvedStation(railStation) || buildResolvedStation(stations[0]);
}

function hasRailProducts(station: BahnStationResult): boolean {
  return station.products?.some((product) => product !== 'BUS') ?? false;
}

function buildResolvedStation(station?: BahnStationResult): ResolvedStation | undefined {
  const name = station?.name?.trim();
  if (!name) {
    return undefined;
  }

  return {
    id: station?.id?.trim() || undefined,
    name,
    type: station?.type?.trim() || undefined,
  };
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
