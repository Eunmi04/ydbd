import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton, Card, EmptyState, InfoRow, Page } from '../../components/ui';
import { useApp } from '../../state/AppContext';
import { supabase } from '../../services/supabaseClient';
import { colors, money } from '../../theme';

export default function Result() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, mode, refreshSettlements } = useApp();
  const [hash, setHash] = useState('');
  const [loading, setLoading] = useState(mode === 'supabase');
  useEffect(() => {
    if (mode !== 'supabase' || !id || !supabase) return;
    void refreshSettlements().catch(console.warn).finally(() => setLoading(false));
    void supabase.from('settlement_test_hashes').select('payload_hash')
      .eq('settlement_id', id).maybeSingle().then(({ data: row }) => setHash(row?.payload_hash ?? ''));
  }, [id, mode, refreshSettlements]);
  const item = data.settlements.find((settlement) => settlement.id === id);
  if (!item) return <Page title={loading ? '정산 결과를 불러오는 중' : '정산 내역을 찾을 수 없어요'}><EmptyState title={loading ? '잠시만 기다려 주세요' : '내역이 없어요'} message={loading ? '완료된 정산을 확인하고 있어요.' : '홈에서 다시 확인해 주세요.'} action="홈으로" onAction={() => router.replace('/(tabs)')} /></Page>;
  return <Page eyebrow="ALL DONE" title="정산이 완료됐어요!" subtitle="함께 이동하고, 남은 포인트는 지갑으로 돌아왔어요." footer={<><AppButton label="내역 확인하기" onPress={() => router.replace('/(tabs)/my')} /><AppButton label="홈으로 돌아가기" onPress={() => router.replace('/(tabs)')} variant="ghost" /></>}>
    <View style={styles.celebration}><View style={styles.check}><Text style={styles.checkText}>✓</Text></View><Text style={styles.celebrationTitle}>함께 타서 더 가벼운 이동</Text><Text style={styles.celebrationText}>다음 이동도 같이타요와 함께해요.</Text></View>
    <Card style={styles.summary}><Text style={styles.summaryTitle}>정산 결과</Text><View style={styles.divider} /><InfoRow label="총 택시 요금" value={`${money(item.actualFare)}원`} /><InfoRow label="탑승 인원" value={`${item.riderCount}명`} /><InfoRow label="1인 부담 금액" value={`${money(item.share)}P`} /><View style={styles.divider} /><InfoRow label="환불된 포인트" value={`+${money(item.refund)}P`} strong /></Card>
    <Card style={styles.note}><Text style={styles.noteText}>정산 내역은 마이페이지에서 언제든 다시 볼 수 있어요.</Text></Card>
    {mode === 'supabase' ? <Card><Text style={styles.noteText}>블록체인 연결 전 테스트 해시 기록</Text><Text selectable style={styles.noteText}>{hash || '기록 조회 중'}</Text></Card> : null}
  </Page>;
}

const styles = StyleSheet.create({ celebration: { alignItems: 'center', paddingVertical: 20 }, check: { width: 80, height: 80, borderRadius: 28, backgroundColor: colors.greenPale, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }, checkText: { color: colors.green, fontSize: 48, fontWeight: '800' }, celebrationTitle: { color: colors.ink, fontSize: 19, fontWeight: '800' }, celebrationText: { color: colors.muted, fontSize: 13, marginTop: 7 }, summary: { gap: 9 }, summaryTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' }, divider: { height: 1, backgroundColor: colors.border, marginVertical: 5 }, note: { backgroundColor: colors.orangePale, borderColor: colors.orangePale, alignItems: 'center' }, noteText: { color: colors.ink, fontSize: 12, lineHeight: 19, textAlign: 'center' } });
