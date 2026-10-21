import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton, Avatar, Card, EmptyState, ErrorNotice, Header, Page } from '../../../components/ui';
import { useApp } from '../../../state/AppContext';
import { colors, shortDate } from '../../../theme';
import { useServiceSync } from '../../../hooks/useServiceSync';

export default function Boarding() {
  const syncError = useServiceSync();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, user, mode, boardRoom, reportNoShow } = useApp();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const room = data.rooms.find((item) => item.id === id);
  if (!room) return <Page back title="탑승할 방이 없어요"><EmptyState title="방을 찾을 수 없어요" message="방 목록으로 돌아가 확인해 주세요." /></Page>;
  const me = room.members.find((item) => item.userId === user?.id);
  const next = async (noShow = false) => {
    if (busy) return;
    setBusy(true);
    try {
      if (mode === 'supabase') {
        if (me?.boardedStatus === 'UNKNOWN') await (noShow ? reportNoShow(room.id) : boardRoom(room.id));
      } else if (!me?.boarded) await boardRoom(room.id);
      router.push({ pathname: '/ride/[id]/settlement', params: { id: room.id } });
    } catch (cause) { setError(cause instanceof Error ? cause.message : '탑승을 확인하지 못했습니다.'); }
    finally { setBusy(false); }
  };
  return <Page back eyebrow="ON THE WAY" title="탑승을 확인해 주세요" subtitle="함께 탔다면 탑승 완료를 눌러주세요." footer={<>
    <AppButton label={me?.boarded || me?.boardedStatus === 'NO_SHOW' ? '정산 화면으로' : '탑승 완료'} onPress={() => void next()} disabled={busy} />
    {mode === 'supabase' && me?.boardedStatus === 'UNKNOWN' ? <AppButton label="미탑승 신고 (전액 반환 대상)" variant="ghost" onPress={() => void next(true)} disabled={busy} /> : null}
  </>}>
    <Card style={styles.routeCard}><Text style={styles.route}>{room.departure} <Text style={styles.arrow}>→</Text> {room.destination}</Text><Text style={styles.time}>{shortDate(room.departureAt)} 출발</Text></Card>
    <Header title="탑승 상태" />
    <Card style={{ paddingVertical: 4 }}>{room.members.map((item, index) => { const participant = data.users.find((person) => person.id === item.userId); if (!participant) return null; return <View key={item.userId} style={[styles.member, index < room.members.length - 1 && styles.border]}><Avatar user={participant} size={39} /><Text style={styles.name}>{participant.nickname}{participant.id === user?.id ? ' (나)' : ''}</Text><View style={[styles.status, item.boarded && styles.statusDone]}><Text style={[styles.statusText, item.boarded && styles.statusTextDone]}>{item.boarded ? '탑승 완료' : item.boardedStatus === 'NO_SHOW' ? '미탑승' : '확인 전'}</Text></View></View>; })}</Card>
    <Card style={styles.note}><Text style={styles.noteTitle}>안전하게 탑승하셨나요?</Text><Text style={styles.noteText}>탑승 상태를 확정한 뒤 방장이 요금과 샘플 증빙을 입력하고, 동승자가 확인해야 정산됩니다.</Text></Card>
    {error || syncError ? <ErrorNotice message={error || syncError} /> : null}
  </Page>;
}

const styles = StyleSheet.create({ routeCard: { backgroundColor: colors.greenPale, borderColor: colors.greenPale }, route: { color: colors.ink, fontSize: 20, fontWeight: '800' }, arrow: { color: colors.orange }, time: { color: colors.muted, fontSize: 12, marginTop: 9 }, member: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 11 }, border: { borderBottomWidth: 1, borderBottomColor: colors.border }, name: { color: colors.ink, fontSize: 14, fontWeight: '800', flex: 1 }, status: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 20, backgroundColor: colors.orangePale }, statusDone: { backgroundColor: colors.greenPale }, statusText: { color: '#A26722', fontSize: 11, fontWeight: '800' }, statusTextDone: { color: colors.greenDark }, note: { backgroundColor: colors.orangePale, borderColor: colors.orangePale }, noteTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' }, noteText: { color: colors.muted, fontSize: 12, lineHeight: 19, marginTop: 6 } });
