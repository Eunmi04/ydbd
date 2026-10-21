import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { AppButton, Card, EmptyState, ErrorNotice, Header, Page, RoomCard } from '../../components/ui';
import { TaxiDoodle } from '../../components/TaxiDoodle';
import { useServiceSync } from '../../hooks/useServiceSync';
import { useApp } from '../../state/AppContext';
import { colors, money, shortDate } from '../../theme';

export default function Home() {
  const syncError = useServiceSync();
  const { data, user, balance, mode } = useApp();
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= 850;
  const [departure, setDeparture] = useState('');
  const [destination, setDestination] = useState('');
  const joined = data.rooms.find(room => room.status !== 'settled' && room.dbStatus !== 'CANCELLED' && room.members.some(member => member.userId === user?.id));
  const rooms = data.rooms.filter(room => room.status === 'recruiting').slice(0, 3);
  const latest = data.settlements.filter(item => item.userId === user?.id).slice(0, 2);
  const search = () => router.push({ pathname: '/(tabs)/rooms', params: { q: `${departure.trim()} ${destination.trim()}`.trim() } });
  return <Page wide hideHeading title="같은 방향이면, 같이 타요">
    <View style={[styles.hero, desktop && styles.heroDesktop]}>
      <View style={[styles.heroCopy, desktop && { flex: 1 }]}>
        <Text style={styles.welcome}>{user?.nickname ?? '친구'}님, 오늘은 어디로 가세요?</Text>
        <Text style={[styles.heroTitle, desktop && styles.heroTitleDesktop]}>같은 방향이면,{"\n"}같이 타요<Text style={styles.dot}>.</Text></Text>
        <Text style={styles.heroDescription}>같은 길로 가는 사람을 찾아{"\n"}택시를 함께 타고, 요금은 나눠요.</Text>
        <View style={styles.heroActions}><View style={{ flex: 1 }}><AppButton label="동승 찾기" onPress={() => router.push('/(tabs)/rooms')} /></View><View style={{ flex: 1 }}><AppButton label="방 만들기" variant="ghost" onPress={() => router.push('/room/new')} /></View></View>
      </View>
      <View style={[styles.heroArt, desktop && { flex: 1.1, width: 'auto' }]}><TaxiDoodle /></View>
    </View>
    <Card style={[styles.search, desktop && styles.searchDesktop]}>
      <View style={styles.searchField}><Text style={styles.searchLabel}>◎  출발지</Text><TextInput accessibilityLabel="찾을 출발지" value={departure} onChangeText={setDeparture} placeholder="어디에서 출발하나요?" placeholderTextColor="#989A94" style={styles.searchInput} /></View>
      <View style={styles.searchField}><Text style={styles.searchLabel}>♧  도착지</Text><TextInput accessibilityLabel="찾을 도착지" value={destination} onChangeText={setDestination} placeholder="어디로 가시나요?" placeholderTextColor="#989A94" style={styles.searchInput} /></View>
      <View style={styles.capacity}><Text style={styles.searchLabel}>☺  함께 타는 인원</Text><Text style={styles.searchHint}>최대 4명 · 2명부터 출발</Text></View>
      <AppButton label="같이 탈 방 찾기  ↗" onPress={search} />
    </Card>
    <View style={styles.section}><Header title="지금 모집 중인 방" action="더보기" onAction={() => router.push('/(tabs)/rooms')} />
      {rooms.length ? <View style={[styles.roomGrid, desktop && styles.roomGridDesktop]}>{rooms.map(room => <View key={room.id} style={styles.roomCell}><RoomCard room={room} onPress={() => router.push({ pathname: '/room/[id]', params: { id: room.id } })} /></View>)}</View>
        : <EmptyState title="첫 번째 동승을 시작해 볼까요?" message="같은 방향으로 갈 사람을 기다리는 방을 만들어 보세요." action="방 만들기" onAction={() => router.push('/room/new')} />}
    </View>
    <View style={[styles.overview, desktop && { flexDirection: 'row' }]}>
      <Card style={styles.wallet}><Text style={styles.smallTitle}>{mode === 'supabase' ? '사용 가능 TEST 크레딧' : '내 포인트'}</Text><Text style={styles.walletAmount}>{money(balance)}<Text style={styles.unit}> P</Text></Text><Text style={styles.helper}>함께 타는 이동을 준비해요.</Text><AppButton label="내 지갑 보기  ↗" variant="ghost" onPress={() => router.push('/(tabs)/wallet')} /></Card>
      <View style={styles.joined}><Header title="참여 중인 방" />{joined ? <RoomCard room={joined} onPress={() => router.push({ pathname: '/room/[id]', params: { id: joined.id } })} /> : <Card><Text style={styles.helper}>아직 참여 중인 방이 없어요. 마음에 드는 방을 찾아보세요.</Text></Card>}</View>
    </View>
    <Card style={styles.banner}><View style={styles.bannerCopy}><Text style={styles.bannerTitle}>처음이신가요?</Text><Text style={styles.helper}>방을 찾고, 함께 준비하고, 이동 후 요금을 나눠요.</Text></View><AppButton label="내 이용 내역  ›" variant="secondary" onPress={() => router.push('/(tabs)/my')} /></Card>
    {latest.length ? <View style={styles.section}><Header title="최근 정산" />{latest.map(item => <Card key={item.id} style={styles.history}><View><Text style={styles.smallTitle}>함께 탄 택시 · 정산 완료</Text><Text style={styles.helper}>{shortDate(item.createdAt)}</Text></View><AppButton label={`${money(item.share)}P  ↗`} variant="ghost" onPress={() => router.push({ pathname: '/history/[id]', params: { id: item.id } })} /></Card>)}</View> : null}
    {syncError ? <ErrorNotice message={syncError} /> : null}
  </Page>;
}
const styles = StyleSheet.create({
  hero: { paddingVertical: 22, gap: 16 }, heroDesktop: { flexDirection: 'row', alignItems: 'center', paddingTop: 35, paddingBottom: 50 },
  heroCopy: { minWidth: 0 }, welcome: { color: colors.muted, fontSize: 13, marginBottom: 22 },
  heroTitle: { color: colors.ink, fontSize: 42, lineHeight: 56, fontWeight: '900', letterSpacing: -2.8 }, heroTitleDesktop: { fontSize: 67, lineHeight: 81, letterSpacing: -4 },
  dot: { color: colors.lime }, heroDescription: { color: colors.ink, fontSize: 18, lineHeight: 30, marginTop: 20 },
  heroActions: { flexDirection: 'row', maxWidth: 385, gap: 12, marginTop: 30 }, heroArt: { width: '100%', minWidth: 0 },
  search: { gap: 20, padding: 25, marginTop: 5, borderWidth: 0 }, searchDesktop: { flexDirection: 'row', alignItems: 'center' },
  searchField: { flex: 1, gap: 10 }, searchLabel: { fontSize: 13, fontWeight: '800', color: colors.ink }, searchInput: { fontSize: 13, color: colors.ink, paddingVertical: 5, minHeight: 32 },
  capacity: { gap: 14, paddingRight: 12 }, searchHint: { color: colors.muted, fontSize: 12 },
  section: { gap: 18, marginTop: 27 }, roomGrid: { gap: 16 }, roomGridDesktop: { flexDirection: 'row' }, roomCell: { flex: 1, minWidth: 0 },
  overview: { gap: 22, marginTop: 22 }, wallet: { flex: 1, backgroundColor: colors.greenPale, gap: 14 }, joined: { flex: 1.6, gap: 12 },
  smallTitle: { fontSize: 14, color: colors.ink, fontWeight: '800' }, walletAmount: { color: colors.ink, fontSize: 36, fontWeight: '900' }, unit: { fontSize: 20 },
  helper: { fontSize: 12, color: colors.muted, lineHeight: 21 }, banner: { backgroundColor: '#EDEBE2', flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 20, marginTop: 18 },
  bannerCopy: { flex: 1, minWidth: 170, gap: 8 }, bannerTitle: { fontSize: 21, fontWeight: '800', color: colors.ink }, history: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
