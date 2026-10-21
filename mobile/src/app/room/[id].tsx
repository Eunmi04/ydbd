import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton, Avatar, Card, EmptyState, ErrorNotice, Header, InfoRow, Page, PointBadge } from '../../components/ui';
import KakaoMap from '../../components/KakaoMap.web';
import { useApp } from '../../state/AppContext';
import { calculateReserveAmount } from '../../services/creditPolicy';
import { colors, money, shortDate } from '../../theme';

export default function RoomDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, user, mode, joinRoom, confirmRoom, prepareRoom, cancelRoom,
    expireReadyCheck, settlementRecords, refreshRooms } = useApp();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(mode === 'supabase');
  useEffect(() => { if (mode === 'supabase') void refreshRooms()
    .catch((cause) => setError(cause instanceof Error ? cause.message : '방 조회에 실패했습니다.'))
    .finally(() => setLoading(false)); }, [mode, refreshRooms]);
  const room = data.rooms.find((item) => item.id === id);
  useEffect(() => {
    if (mode !== 'supabase' || room?.dbStatus !== 'READY_CHECK' || !room.readyDeadlineAt) return;
    const deadline = new Date(room.readyDeadlineAt).getTime();
    const timer = setInterval(() => {
      if (Date.now() >= deadline) void expireReadyCheck(room.id).catch((cause) =>
        setError(cause instanceof Error ? cause.message : '준비 기한을 갱신하지 못했습니다.'));
    }, 5000);
    return () => clearInterval(timer);
  }, [mode, room?.id, room?.dbStatus, room?.readyDeadlineAt, expireReadyCheck]);
  if (!room) return <Page back title={loading ? '방을 불러오는 중' : '방을 찾을 수 없어요'}>
    {error ? <ErrorNotice message={error} /> : <EmptyState title={loading ? '잠시만 기다려 주세요' : '방이 없어요'} message={loading ? '서버에서 방 정보를 확인하고 있어요.' : '목록에서 다른 방을 찾아보세요.'} action="방 목록으로" onAction={() => router.replace('/(tabs)/rooms')} />}
  </Page>;
  const member = room.members.find((item) => item.userId === user?.id);
  const isHost = room.hostId === user?.id;
  const recordedDeposit = member?.deposit ?? 0;
  const hasRecordedDeposit = recordedDeposit > 0;
  const deposit = hasRecordedDeposit
    ? recordedDeposit : calculateReserveAmount(room.estimatedFare, room.maxMembers);
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try { await action(); setError(''); } catch (cause) {
      setError(cause instanceof Error ? cause.message : '요청을 처리하지 못했습니다.');
    } finally { setBusy(false); }
  };
  const join = () => run(() => joinRoom(room.id));
  const confirm = () => run(() => confirmRoom(room.id));
  const settlement = settlementRecords.find((record) => record.room_id === room.id);
  const footer = mode === 'supabase'
    ? !member && room.dbStatus === 'OPEN'
      ? <AppButton label="방 참여하기 · 예치는 준비할 때" onPress={join} disabled={busy} />
      : member && room.dbStatus === 'OPEN'
        ? <>{isHost ? <AppButton label="30초 준비 확인 시작" onPress={confirm} disabled={busy} />
          : <AppButton label="방장의 준비 확인을 기다려 주세요" onPress={() => {}} disabled />}
          {isHost ? <AppButton label="방 취소" variant="ghost" onPress={() => run(() => cancelRoom(room.id))} disabled={busy} /> : null}</>
        : member && room.dbStatus === 'READY_CHECK'
          ? <><AppButton label={member.ready ? '준비 완료 · 다른 참여자 대기 중' : `준비 완료 · ${money(deposit)}P 예치`}
              onPress={() => run(() => prepareRoom(room.id))} disabled={busy || member.ready} />
            {isHost ? <AppButton label="방 취소 및 예치 반환" variant="ghost" onPress={() => run(() => cancelRoom(room.id))} disabled={busy} /> : null}</>
          : member && ['FIXED', 'IN_PROGRESS'].includes(room.dbStatus ?? '')
            ? <><AppButton label="탑승 확인하기" onPress={() => router.push({ pathname: '/ride/[id]/boarding', params: { id: room.id } })} />
              {isHost && room.dbStatus === 'FIXED' ? <AppButton label="탑승 전 방 취소" variant="ghost" onPress={() => run(() => cancelRoom(room.id))} disabled={busy} /> : null}</>
            : settlement && member && ['CONFIRMING', 'DISPUTED', 'FARE_SUBMITTED', 'SETTLING'].includes(room.dbStatus ?? '')
              ? <AppButton label="정산 확인하기" onPress={() => router.push({ pathname: '/ride/[id]/settlement', params: { id: room.id } })} />
              : room.dbStatus === 'SETTLED' && settlement
                ? <AppButton label="정산 결과 보기" onPress={() => router.push({ pathname: '/result/[id]', params: { id: settlement.id } })} />
                : <AppButton label="현재 참여할 수 없는 방이에요" onPress={() => {}} disabled />
    : room.status === 'settled' ? <AppButton label="홈으로 돌아가기" onPress={() => router.replace('/(tabs)')} /> : !member ? <AppButton label={`참여하고 ${money(deposit)}P 예치하기`} onPress={join} disabled={room.status !== 'recruiting'} /> : room.status === 'recruiting' ? <><AppButton label="참여 완료 · 포인트 예치됨" onPress={() => {}} disabled />{isHost ? <AppButton label="방 확정하기" onPress={confirm} variant="orange" /> : null}</> : <AppButton label="탑승 확인하기" onPress={() => router.push({ pathname: '/ride/[id]/boarding', params: { id: room.id } })} />;
  return <Page back eyebrow="RIDE DETAIL" title={`${room.departure}에서\n${room.destination}까지`} subtitle={`${shortDate(room.departureAt)} 출발 · ${room.status === 'recruiting' ? '동승자 모집 중' : room.status === 'confirmed' ? '출발 확정' : room.status === 'settled' ? '정산 완료' : '진행 중'}`} footer={footer}>
    <KakaoMap departure={room.departure} destination={room.destination} />
    <Card><InfoRow label="출발지" value={room.departure} /><InfoRow label="목적지" value={room.destination} /><InfoRow label="출발 시간" value={shortDate(room.departureAt)} /><InfoRow label="현재 인원" value={`${room.dbStatus && !room.memberCountKnown ? '?' : room.members.length} / ${room.maxMembers}명`} /></Card>
    <Header title="함께 타는 사람" />
    <Card style={{ paddingVertical: 4 }}>{room.dbStatus && !room.memberCountKnown ? <Text style={styles.memberStatus}>참여 후 동승자 목록을 볼 수 있어요.</Text> : room.members.map((item, index) => { const participant = data.users.find((person) => person.id === item.userId); if (!participant) return null; return <View key={item.userId} style={[styles.member, index < room.members.length - 1 && styles.border]}><Avatar user={participant} size={37} /><Text style={styles.memberName}>{participant.nickname}{participant.id === room.hostId ? <Text style={styles.host}>  방장</Text> : null}</Text><Text style={styles.memberStatus}>{item.boardedStatus === 'NO_SHOW' ? '미탑승' : item.boarded ? '탑승 완료' : item.ready ? '준비 완료' : '참여 중'}</Text></View>; })}</Card>
    <Card style={styles.depositCard}><View><Text style={styles.depositLabel}>{mode === 'supabase' && !hasRecordedDeposit ? '1인 예상 예치 TEST 크레딧' : '1인 예치 테스트 크레딧'}</Text><Text style={styles.depositHint}>{mode === 'supabase' ? hasRecordedDeposit ? '서버에 기록된 내 예치 금액이에요.' : '준비 버튼을 누르면 서버가 금액을 다시 계산해 예치합니다.' : '정산 후 남은 포인트는 자동으로 환불돼요.'}</Text></View><PointBadge amount={deposit} /></Card>
    {room.dbStatus === 'READY_CHECK' ? <Text style={styles.helper}>준비 마감: {room.readyDeadlineAt ? new Date(room.readyDeadlineAt).toLocaleTimeString() : '확인 중'}</Text> : null}
    {error ? <ErrorNotice message={error} /> : null}
    {mode === 'mock' && room.status === 'confirmed' ? <Text style={styles.helper}>탑승을 완료했다면 아래 버튼으로 정산을 시작하세요.</Text> : null}
  </Page>;
}

const styles = StyleSheet.create({ member: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10 }, border: { borderBottomWidth: 1, borderBottomColor: colors.border }, memberName: { color: colors.ink, fontWeight: '800', fontSize: 14, flex: 1 }, host: { color: colors.green, fontSize: 11 }, memberStatus: { color: colors.muted, fontSize: 11 }, depositCard: { backgroundColor: colors.orangePale, borderColor: colors.orangePale, gap: 14 }, depositLabel: { color: colors.ink, fontWeight: '800', fontSize: 15 }, depositHint: { color: colors.muted, fontSize: 11, marginTop: 5 }, helper: { color: colors.muted, fontSize: 12, lineHeight: 19, textAlign: 'center' } });
