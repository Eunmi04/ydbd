import { useCallback, useMemo, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Platform, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { AppButton, EmptyState, ErrorNotice, Header, Page, RoomCard } from '../../components/ui';
import { useServiceSync } from '../../hooks/useServiceSync';
import { useApp } from '../../state/AppContext';
import { colors } from '../../theme';
import { matchesRecruitingRoute } from '../../services/routeReuse';

export default function Rooms() {
  const { q, from, to } = useLocalSearchParams<{ q?: string; from?: string; to?: string }>();
  const route = typeof from === 'string' && typeof to === 'string' && from && to ? { from, to } : undefined;
  return <RoomResults key={JSON.stringify([q, from, to])} initialQuery={route ? `${route.from} ${route.to}` : q ?? ''} route={route} />;
}

function RoomResults({ initialQuery, route }: { initialQuery: string; route?: { from: string; to: string } }) {
  const syncError = useServiceSync();
  const { data } = useApp();
  const [query, setQuery] = useState(initialQuery);
  const [now, setNow] = useState(Date.now);
  const routeSearch = Boolean(route);
  useFocusEffect(useCallback(() => {
    if (!routeSearch) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 3000);
    return () => clearInterval(timer);
  }, [routeSearch]));
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= 850;
  const filtered = useMemo(() => {
    if (route && query === initialQuery) {
      return data.rooms.filter((room) => matchesRecruitingRoute(room, route.from, route.to, now));
    }
    return data.rooms.filter((room) => room.status !== 'settled' && room.dbStatus !== 'CANCELLED' && query.trim().toLowerCase().split(/\s+/).every(word => `${room.departure} ${room.destination}`.toLowerCase().includes(word)));
  }, [data.rooms, initialQuery, now, query, route]);
  return <Page wide eyebrow="FIND YOUR RIDE" title="같이 갈 방을 찾아요" subtitle="최대 4명, 방장을 포함해 2명부터 함께 출발해요.">
    <View style={styles.search}><Text style={styles.searchIcon}>⌕</Text><TextInput value={query} onChangeText={setQuery} placeholder="예: 삼송역, 화정역" placeholderTextColor="#9BA89C" style={styles.searchInput} returnKeyType="search" /></View>
    {syncError ? <ErrorNotice message={syncError} /> : null}
    <Header title={`동승 방 ${filtered.length}개`} action="방 만들기" onAction={() => router.push('/room/new')} />
    {filtered.length ? <View style={{ flexDirection: desktop ? 'row' : 'column', flexWrap: 'wrap', gap: 18 }}>{filtered.map((room) => <View key={room.id} style={desktop ? { width: '31.8%' } : { width: '100%' }}><RoomCard room={room} onPress={() => router.push({ pathname: '/room/[id]', params: { id: room.id } })} /></View>)}</View> : <EmptyState title="검색 결과가 없어요" message="다른 장소로 검색하거나 직접 방을 만들어 보세요." action="방 만들기" onAction={() => router.push('/room/new')} />}
    <AppButton label="＋  동승 방 만들기" variant="secondary" onPress={() => router.push('/room/new')} />
  </Page>;
}

const styles = StyleSheet.create({ search: { minHeight: 56, borderRadius: 18, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, gap: 9 }, searchIcon: { color: colors.green, fontSize: 28, marginTop: -3 }, searchInput: { flex: 1, color: colors.ink, fontSize: 15 } });
