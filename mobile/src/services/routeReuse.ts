import type { Coordinates, Room } from '../types';

const normalizePlace = (value: string) => value.trim().toLowerCase();

export function distinctRecentRoutes<T extends Pick<Room, 'departure' | 'destination'>>(newestFirst: T[]): T[] {
  const byRoute = new Map<string, T>();
  for (const route of newestFirst) {
    const key = JSON.stringify([normalizePlace(route.departure), normalizePlace(route.destination)]);
    if (!byRoute.has(key)) byRoute.set(key, route);
    if (byRoute.size === 3) break;
  }
  return [...byRoute.values()];
}

export function coordinates(latitude: number | null, longitude: number | null): Coordinates | undefined {
  if (latitude === null || longitude === null || !Number.isFinite(latitude) || !Number.isFinite(longitude)
    || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return undefined;
  return { latitude, longitude };
}

export function matchesRecruitingRoute(
  room: Pick<Room, 'departure' | 'destination' | 'departureAt' | 'status'>,
  departure: string,
  destination: string,
  now: number,
): boolean {
  return room.status === 'recruiting' && Date.parse(room.departureAt) > now
    && normalizePlace(room.departure) === normalizePlace(departure)
    && normalizePlace(room.destination) === normalizePlace(destination);
}
