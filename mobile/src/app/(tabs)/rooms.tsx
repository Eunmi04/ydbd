import { useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { AppButton, EmptyState, Header, Page, RoomCard } from '../../components/ui';
import { useApp } from '../../state/AppContext';
import { colors } from '../../theme';

export default function Rooms() {
  const { data, mode, refreshRooms } = useApp();
  const [query, setQuery] = useState('');
  useEffect(() => { if (mode === 'supabase') void refreshRooms().catch(console.warn); }, [mode, refreshRooms]);
  const filtered = useMemo(() => data.rooms.filter((room) => room.status !== 'settled' && room.dbStatus !== 'CANCELLED' && `${room.departure} ${room.destination}`.toLowerCase().includes(query.trim().toLowerCase())), [data.rooms, query]);
  return <Page eyebrow="FIND YOUR RIDE" title="같이 갈 방을 찾아요" subtitle="출발지나 목적지를 검색해 보세요.">
    <View style={styles.search}><Text style={styles.searchIcon}>⌕</Text><TextInput value={query} onChangeText={setQuery} placeholder="예: 삼송역, 화정역" placeholderTextColor="#9BA89C" style={styles.searchInput} returnKeyType="search" /></View>
    <Header title={`동승 방 ${filtered.length}개`} action="방 만들기" onAction={() => router.push('/room/new')} />
    {filtered.length ? filtered.map((room) => <RoomCard key={room.id} room={room} onPress={() => router.push({ pathname: '/room/[id]', params: { id: room.id } })} />) : <EmptyState title="검색 결과가 없어요" message="다른 장소로 검색하거나 직접 방을 만들어 보세요." action="방 만들기" onAction={() => router.push('/room/new')} />}
    <AppButton label="＋  동승 방 만들기" variant="secondary" onPress={() => router.push('/room/new')} />
  </Page>;
}

const styles = StyleSheet.create({ search: { minHeight: 56, borderRadius: 18, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, gap: 9 }, searchIcon: { color: colors.green, fontSize: 28, marginTop: -3 }, searchInput: { flex: 1, color: colors.ink, fontSize: 15 } });
