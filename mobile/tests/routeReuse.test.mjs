import assert from 'node:assert/strict';
import test from 'node:test';
import { coordinates, distinctRecentRoutes, matchesRecruitingRoute } from '../src/services/routeReuse.ts';

test('fallback history keeps the newest distinct routes, capped at three', () => {
  const route = (id, departure, destination) => ({ id, departure, destination });
  const firstPage = [route(6, ' Station', 'Campus'), route(5, 'station', 'campus ')];
  const nextPage = [route(4, 'STATION', 'CAMPUS'), route(3, 'Campus', 'Station'),
    route(2, 'Mall', 'Campus'), route(1, 'Park', 'Campus')];
  assert.deepEqual(distinctRecentRoutes(firstPage).map(({ id }) => id), [6]);
  assert.deepEqual(distinctRecentRoutes([...distinctRecentRoutes(firstPage), ...nextPage]).map(({ id }) => id), [6, 3, 2]);
});

test('restored locations keep their stored coordinates and reject missing or invalid pairs', () => {
  assert.deepEqual(coordinates(37.5665, 126.978), { latitude: 37.5665, longitude: 126.978 });
  assert.deepEqual(coordinates(0, 0), { latitude: 0, longitude: 0 });
  assert.equal(coordinates(null, 126.978), undefined);
  assert.equal(coordinates(37.5665, null), undefined);
  assert.equal(coordinates(91, 126.978), undefined);
  assert.equal(coordinates(37.5665, NaN), undefined);
});

test('a route search matches the direction and only future recruiting rooms', () => {
  const now = Date.parse('2026-11-19T00:00:00Z');
  const room = { departure: '삼송역', destination: '중부대학교', status: 'recruiting', departureAt: '2026-11-19T01:00:00Z' };
  assert.equal(matchesRecruitingRoute(room, ' 삼송역 ', '중부대학교', now), true);
  assert.equal(matchesRecruitingRoute(room, '중부대학교', '삼송역', now), false);
  assert.equal(matchesRecruitingRoute({ ...room, status: 'confirmed' }, '삼송역', '중부대학교', now), false);
  assert.equal(matchesRecruitingRoute({ ...room, departureAt: '2026-11-19T00:00:00Z' }, '삼송역', '중부대학교', now), false);
});
