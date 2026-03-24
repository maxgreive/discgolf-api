import env from '../env.js';
import { http } from '../http.js';

const OPENROUTESERVICE_API_URL = env.OPENROUTESERVICE_API_URL ?? 'https://api.openrouteservice.org';

interface GeocodeFeature {
  geometry: {
    coordinates: [number, number];
  };
  properties?: {
    label?: string;
    name?: string;
  };
}

interface GeocodeResponse {
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
  const origin = await geocodeOrigin(request.origin);
  const destination = resolveDestinationPoint(request);
  const route = await fetchDrivingRoute(origin, destination);

  return {
    route,
    resolvedPoints: {
      origin,
      destination,
    },
    train: {
      url: buildBahnUrl(request.origin, request.destination),
    },
  };
}

async function geocodeOrigin(origin: string): Promise<ResolvedPoint> {
  try {
    const response = await http.get<GeocodeResponse>('/geocode/search', {
      baseURL: OPENROUTESERVICE_API_URL,
      params: {
        api_key: env.OPENROUTESERVICE_API_KEY,
        text: origin,
        size: 1,
      },
    });

    const match = response.data.features?.[0];

    if (!match?.geometry?.coordinates) {
      throw new RoutePlannerError(400, 'INVALID_ADDRESS', 'Origin address could not be resolved');
    }

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

function buildBahnUrl(origin: string, destination: RoutePlannerRequest['destination']): string {
  const destinationText = destination.station || destination.address || destination.name || '';
  const params = new URLSearchParams({
    so: origin,
    zo: destinationText,
  });

  return `https://www.bahn.de/buchung/fahrplan/suche#${params.toString()}`;
}
