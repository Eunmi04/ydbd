import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRideQuery } from '../hooks/useRideQuery';
import { getReceivedInvites, respondToRideInvite, setInviteBlock, type ReceivedInvite } from '../services/rideReuseService';
import { useApp } from '../state/AppContext';
import { colors, shortDate } from '../theme';
import { AppButton, Card, ErrorNotice, Header } from './ui';

const statusText: Record<ReceivedInvite['status'], string> = {
  PENDING: '응답 대기', ACCEPTED: '수락함', DECLINED: '거절함',
  EXPIRED: '초대 만료', CLOSED: '모집 마감', FULL: '정원 마감', JOINED: '이미 참여한 방',
};

export function ReceivedRideInvites({ userId }: { userId: string }) {
  const { refreshRooms } = useApp();
  const query = useRideQuery(userId, getReceivedInvites);
  const submitting = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async (action: () => Promise<void>) => {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '초대를 처리하지 못했어요.');
    } finally {
      query.reload();
      submitting.current = false;
      setBusy(false);
    }
  };
  const respond = (invite: ReceivedInvite, accept: boolean) => run(async () => {
    const roomId = await respondToRideInvite(invite.id, accept);
    if (accept) {
      await refreshRooms().catch(() => {});
      router.push({ pathname: '/room/[id]', params: { id: roomId } });
    }
  });
  return <View style={styles.section}>
    <Header title="받은 동승 초대" action="새로고침" onAction={() => { if (!busy) query.reload(); }} />
    {query.error || error ? <ErrorNotice message={error || query.error || ''} /> : null}
    {query.data?.length === 0 ? <Text style={styles.note}>받은 초대가 없어요.</Text> : null}
    {query.data?.map((invite) => <Card key={invite.id} style={styles.section}>
      <Text style={styles.route}>{invite.departure} → {invite.destination}</Text>
      <Text style={styles.note}>{invite.sender_name}님의 초대 · {shortDate(invite.departure_at)} 출발</Text>
      <Text style={styles.note}>{statusText[invite.status]}{invite.status === 'PENDING' ? ` · ${shortDate(invite.expires_at)}까지` : ''}</Text>
      {invite.status === 'PENDING' ? <View style={styles.actions}>
        <AppButton label="수락" disabled={busy} onPress={() => respond(invite, true)} />
        <AppButton label="거절" variant="ghost" disabled={busy} onPress={() => respond(invite, false)} />
      </View> : null}
      <AppButton label={`${invite.sender_name}님 초대 차단`} variant="ghost" disabled={busy}
        onPress={() => run(async () => { await setInviteBlock(invite.sender_id, true); })} />
    </Card>)}
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  route: { color: colors.ink, fontWeight: '800', fontSize: 15 },
  note: { color: colors.muted, fontSize: 13 },
});
