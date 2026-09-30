import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton, Avatar, Card, EmptyState, ErrorNotice, Header, InfoRow, MapPreview, Page, PointBadge } from '../../components/ui';
import { useApp } from '../../state/AppContext';
import { mockService } from '../../services/mockService';
import { colors, money, shortDate } from '../../theme';

export default function RoomDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, user, joinRoom, confirmRoom } = useApp();
  const [error, setError] = useState('');
  const room = data.rooms.find((item) => item.id === id);
  if (!room) return <Page back title="방을 찾을 수 없어요"><EmptyState title="방이 없어요" message="목록에서 다른 방을 찾아보세요." action="방 목록으로" onAction={() => router.replace('/(tabs)/rooms')} /></Page>;
  const member = room.members.find((item) => item.userId === user?.id);
  const isHost = room.hostId === user?.id;
  const deposit = member?.deposit ?? mockService.depositFor(room);
  const join = () => { try { joinRoom(room.id); setError(''); } catch (cause) { setError(cause instanceof Error ? cause.message : '참여에 실패했습니다.'); } };
  const confirm = () => { try { confirmRoom(room.id); setError(''); } catch (cause) { setError(cause instanceof Error ? cause.message : '방을 확정하지 못했습니다.'); } };
  const footer = room.status === 'settled' ? <AppButton label="홈으로 돌아가기" onPress={() => router.replace('/(tabs)')} /> : !member ? <AppButton label={`참여하고 ${money(deposit)}P 예치하기`} onPress={join} disabled={room.status !== 'recruiting'} /> : room.status === 'recruiting' ? <><AppButton label="참여 완료 · 포인트 예치됨" onPress={() => {}} disabled />{isHost ? <AppButton label="방 확정하기" onPress={confirm} variant="orange" /> : null}</> : <AppButton label="탑승 확인하기" onPress={() => router.push({ pathname: '/ride/[id]/boarding', params: { id: room.id } })} />;
  return <Page back eyebrow="RIDE DETAIL" title={`${room.departure}에서\n${room.destination}까지`} subtitle={`${shortDate(room.departureAt)} 출발 · ${room.status === 'recruiting' ? '동승자 모집 중' : room.status === 'confirmed' ? '출발 확정' : '정산 완료'}`} footer={footer}>
    <MapPreview departure={room.departure} destination={room.destination} />
    <Card><InfoRow label="출발지" value={room.departure} /><InfoRow label="목적지" value={room.destination} /><InfoRow label="출발 시간" value={shortDate(room.departureAt)} /><InfoRow label="현재 인원" value={`${room.members.length} / ${room.maxMembers}명`} /></Card>
    <Header title="함께 타는 사람" />
    <Card style={{ paddingVertical: 4 }}>{room.members.map((item, index) => { const participant = data.users.find((person) => person.id === item.userId); if (!participant) return null; return <View key={item.userId} style={[styles.member, index < room.members.length - 1 && styles.border]}><Avatar user={participant} size={37} /><Text style={styles.memberName}>{participant.nickname}{participant.id === room.hostId ? <Text style={styles.host}>  방장</Text> : null}</Text><Text style={styles.memberStatus}>{item.boarded ? '탑승 완료' : '참여 중'}</Text></View>; })}</Card>
    <Card style={styles.depositCard}><View><Text style={styles.depositLabel}>예상 1인 예치 포인트</Text><Text style={styles.depositHint}>정산 후 남은 포인트는 자동으로 환불돼요.</Text></View><PointBadge amount={deposit} /></Card>
    {error ? <ErrorNotice message={error} /> : null}
    {room.status === 'confirmed' ? <Text style={styles.helper}>탑승을 완료했다면 아래 버튼으로 정산을 시작하세요.</Text> : null}
  </Page>;
}

const styles = StyleSheet.create({ member: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10 }, border: { borderBottomWidth: 1, borderBottomColor: colors.border }, memberName: { color: colors.ink, fontWeight: '800', fontSize: 14, flex: 1 }, host: { color: colors.green, fontSize: 11 }, memberStatus: { color: colors.muted, fontSize: 11 }, depositCard: { backgroundColor: colors.orangePale, borderColor: colors.orangePale, gap: 14 }, depositLabel: { color: colors.ink, fontWeight: '800', fontSize: 15 }, depositHint: { color: colors.muted, fontSize: 11, marginTop: 5 }, helper: { color: colors.muted, fontSize: 12, lineHeight: 19, textAlign: 'center' } });
