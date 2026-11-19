import { useRef, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useRideQuery } from '../hooks/useRideQuery';
import { getInviteSettings, setInviteBlock, setInvitePreference } from '../services/rideReuseService';
import { colors } from '../theme';
import { AppButton, Card, ErrorNotice } from './ui';

export function RideInviteSettings({ userId }: { userId: string }) {
  const query = useRideQuery(userId, getInviteSettings);
  const submitting = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async (action: () => Promise<unknown>) => {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      await action();
      query.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '초대 설정을 저장하지 못했어요.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  return <Card style={styles.card}>
    <Text style={styles.heading}>동승 초대 설정</Text>
    {query.error || error ? <ErrorNotice message={error || query.error || ''} /> : null}
    {query.error ? <AppButton label="다시 불러오기" variant="ghost" onPress={query.reload} /> : null}
    {query.data ? <>
      <View style={styles.row}>
        <Text style={styles.label}>이전 동승자에게 닉네임 표시 및 초대 받기</Text>
        <Switch accessibilityLabel="이전 동승자에게 닉네임 표시 및 초대 받기" value={query.data.optedIn}
          disabled={busy} onValueChange={(value) => save(() => setInvitePreference(value))} />
      </View>
      {query.data.blocked.length ? <Text style={styles.label}>초대를 차단한 동승자</Text> : null}
      {query.data.blocked.map((person) => <View key={person.blocked_user_id} style={styles.row}>
        <Text style={styles.label}>{person.nickname}</Text>
        <AppButton label="차단 해제" variant="ghost" disabled={busy}
          onPress={() => save(() => setInviteBlock(person.blocked_user_id, false))} />
      </View>)}
    </> : null}
  </Card>;
}

const styles = StyleSheet.create({
  card: { gap: 10 },
  heading: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { flex: 1, color: colors.ink, fontSize: 13 },
});
