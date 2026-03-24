import env from '../env.js';
import { http } from '../http.js';
import { formatBahnTravelDate } from '../utils.js';
import { type ResolvedStation, resolveNearestStationMatch } from './locationService.js';

const OPENROUTESERVICE_API_URL = env.OPENROUTESERVICE_API_URL ?? 'https://api.openrouteservice.org';

interface GeocodeFeature {
  geometry: {
    coordinates: [number, number];
  };
  properties?: {
    label?: string;
    country_a?: string;
    locality?: string;
    localadmin?: string;
    match_type?: string;
    name?: string;
    postalcode?: string;
    street?: string;
  };
}

interface GeocodeResponse {
  geocoding?: {
    query?: {
      parsed_text?: Record<string, string>;
    };
  };
  features?: GeocodeFeature[];
}

interface DirectionsGeoJsonResponse {
  features?: Array<{
    geometry?: {
      coordinates: Array<[number, number]>;
      type: string;
    };
    properties?: {
      summary?: {
        distance?: number;
        duration?: number;
      };
      way_points?: number[];
    };
  }>;
}

interface AxiosLikeError {
  message?: string;
  response?: {
    status?: number;
    data?: unknown;
  };
}

export interface RoutePlannerRequest {
  origin: string;
  date?: string;
  destination: {
    lat: number;
    lng: number;
    address?: string;
    name?: string;
    station?: string;
  };
}

export interface ResolvedPoint {
  text: string;
  lat: number;
  lng: number;
}

export interface RoutePlannerResponse {
  route: {
    geometry: {
      type: string;
      coordinates: Array<[number, number]>;
    };
    distanceMeters: number;
    durationSeconds: number;
  };
  resolvedPoints: {
    origin: ResolvedPoint;
    destination: ResolvedPoint;
  };
  train: {
    url: string;
  };
}

export class RoutePlannerError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code:
      | 'INVALID_ADDRESS'
      | 'NO_ROUTE_FOUND'
      | 'UPSTREAM_ERROR'
      | 'UPSTREAM_QUOTA_EXCEEDED',
    message: string,
  ) {
    super(message);
    this.name = 'RoutePlannerError';
  }
}

export async function getDrivingRoute(request: RoutePlannerRequest): Promise<RoutePlannerResponse> {
  const destination = resolveDestinationPoint(request);
  const origin = await geocodeOrigin(request.origin, destination);
  const route = await fetchDrivingRoute(origin, destination);
  const [originStation, resolvedDestinationStation] = await Promise.all([
    resolveNearestStationMatch(origin.text),
    resolveNearestStationMatch(destination.text),
  ]);

  return {
    route,
    resolvedPoints: {
      origin,
      destination,
    },
    train: {
      url: buildBahnUrl(
        originStation,
        resolvedDestinationStation,
        origin.text,
        destination.text,
        request.date,
      ),
    },
  };
}

async function geocodeOrigin(origin: string, destination: ResolvedPoint): Promise<ResolvedPoint> {
  try {
    const response = await http.get<GeocodeResponse>('/geocode/search', {
      baseURL: OPENROUTESERVICE_API_URL,
      params: {
        api_key: env.OPENROUTESERVICE_API_KEY,
        'boundary.country': 'DE',
        'focus.point.lat': destination.lat,
        'focus.point.lon': destination.lng,
        lang: 'de',
        text: origin,
        size: 1,
      },
      headers: {
        'Accept-Language': 'de',
      },
    });

    const match = response.data.features?.[0];

    if (!match?.geometry?.coordinates) {
      throw new RoutePlannerError(400, 'INVALID_ADDRESS', 'Origin address could not be resolved');
    }

    assertValidOriginMatch(origin, response.data, match);

    return {
      text: match.properties?.label || match.properties?.name || origin,
      lng: match.geometry.coordinates[0],
      lat: match.geometry.coordinates[1],
    };
  } catch (error) {
    throw mapOpenRouteServiceError(error, {
      invalidAddressFallback: 'Origin address could not be resolved',
    });
  }
}

function resolveDestinationPoint(request: RoutePlannerRequest): ResolvedPoint {
  const destinationText =
    request.destination.address || request.destination.station || request.destination.name;

  return {
    text: destinationText || `${request.destination.lat},${request.destination.lng}`,
    lat: request.destination.lat,
    lng: request.destination.lng,
  };
}

async function fetchDrivingRoute(
  origin: ResolvedPoint,
  destination: ResolvedPoint,
): Promise<RoutePlannerResponse['route']> {
  try {
    const response = await http.post<DirectionsGeoJsonResponse>(
      '/v2/directions/driving-car/geojson',
      {
        coordinates: [
          [origin.lng, origin.lat],
          [destination.lng, destination.lat],
        ],
      },
      {
        baseURL: OPENROUTESERVICE_API_URL,
        headers: {
          Authorization: env.OPENROUTESERVICE_API_KEY,
        },
      },
    );

    const feature = response.data.features?.[0];
    const coordinates = feature?.geometry?.coordinates;
    const summary = feature?.properties?.summary;

    if (!coordinates?.length || !summary) {
      throw new RoutePlannerError(404, 'NO_ROUTE_FOUND', 'No driving route found');
    }

    return {
      geometry: {
        type: feature.geometry?.type || 'LineString',
        coordinates,
      },
      distanceMeters: summary.distance ?? 0,
      durationSeconds: summary.duration ?? 0,
    };
  } catch (error) {
    throw mapOpenRouteServiceError(error, {
      noRouteFallback: 'No driving route found',
    });
  }
}

function mapOpenRouteServiceError(
  error: unknown,
  options: {
    invalidAddressFallback?: string;
    noRouteFallback?: string;
  } = {},
): RoutePlannerError {
  if (error instanceof RoutePlannerError) {
    return error;
  }

  if (isAxiosLikeError(error)) {
    const status = error.response?.status;
    const upstreamMessage =
      readUpstreamMessage(error.response?.data) ||
      error.message ||
      'Upstream routing request failed';

    if (status === 400 && options.invalidAddressFallback) {
      return new RoutePlannerError(400, 'INVALID_ADDRESS', options.invalidAddressFallback);
    }

    if (status === 404) {
      return new RoutePlannerError(
        404,
        'NO_ROUTE_FOUND',
        options.noRouteFallback || 'No driving route found',
      );
    }

    if (status === 429 || status === 403) {
      return new RoutePlannerError(
        502,
        'UPSTREAM_QUOTA_EXCEEDED',
        'Routing provider quota exceeded',
      );
    }

    return new RoutePlannerError(502, 'UPSTREAM_ERROR', upstreamMessage);
  }

  return new RoutePlannerError(502, 'UPSTREAM_ERROR', 'Routing provider request failed');
}

function assertValidOriginMatch(
  origin: string,
  response: GeocodeResponse,
  feature: GeocodeFeature,
): void {
  const properties = feature.properties;
  if (!properties) {
    throw new RoutePlannerError(400, 'INVALID_ADDRESS', 'Origin address could not be resolved');
  }

  if (properties.country_a && properties.country_a !== 'DEU') {
    throw new RoutePlannerError(400, 'INVALID_ADDRESS', 'Origin address could not be resolved');
  }

  if (properties.match_type !== 'fallback') {
    return;
  }

  const featureTokens = buildFeatureTokens(properties);
  const originTokens = tokenize(origin);
  const matchedOriginTokens = originTokens.filter((token) => featureTokens.has(token));
  const locationTokens = buildExpectedLocationTokens(response.geocoding?.query?.parsed_text);
  const matchedLocationTokens = locationTokens.filter((token) => featureTokens.has(token));

  const isAcceptableFallback =
    matchedLocationTokens.length > 0 ||
    matchedOriginTokens.length >= Math.min(2, originTokens.length);

  if (!isAcceptableFallback) {
    throw new RoutePlannerError(400, 'INVALID_ADDRESS', 'Origin address could not be resolved');
  }
}

function isAxiosLikeError(error: unknown): error is AxiosLikeError {
  return typeof error === 'object' && error !== null && ('response' in error || 'message' in error);
}

function readUpstreamMessage(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;

  if ('error' in data && typeof data.error === 'string') {
    return data.error;
  }

  if ('message' in data && typeof data.message === 'string') {
    return data.message;
  }

  return null;
}

function buildBahnUrl(
  origin: ResolvedStation | undefined,
  destination: ResolvedStation | undefined,
  originText: string,
  destinationText: string,
  date?: string,
): string {
  const params = new URLSearchParams();

  params.set('so', origin?.name || originText);
  params.set('zo', destination?.name || destinationText);
  params.set('soid', origin?.id || `O=${originText}`);
  params.set('zoid', destination?.id || `O=${destinationText}`);

  if (origin?.type) {
    params.set('sot', origin.type);
  }

  if (destination?.type) {
    params.set('zot', destination.type);
  }

  const formattedTravelDate = formatBahnTravelDate(date);
  if (formattedTravelDate) {
    params.set('hd', formattedTravelDate);
  }

  return `https://www.bahn.de/buchung/fahrplan/suche#${params.toString()}`;
}

function buildFeatureTokens(properties: NonNullable<GeocodeFeature['properties']>): Set<string> {
  return new Set(
    tokenize(
      [
        properties.label,
        properties.name,
        properties.street,
        properties.locality,
        properties.localadmin,
        properties.postalcode,
      ]
        .filter(Boolean)
        .join(' '),
    ),
  );
}

function buildExpectedLocationTokens(parsedText?: Record<string, string>): string[] {
  if (!parsedText) return [];

  return tokenize([parsedText.city, parsedText.locality, parsedText.postalcode].join(' '));
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(/\s+/)
    .filter((token) => token.length >= 3 || /^\d{4,}$/.test(token));
}

function normalizeText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
