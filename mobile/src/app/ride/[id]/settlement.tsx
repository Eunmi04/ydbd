import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton, Card, EmptyState, ErrorNotice, InfoRow, Page, TextField } from '../../../components/ui';
import { useApp } from '../../../state/AppContext';
import { mockService } from '../../../services/mockService';
import { colors, money } from '../../../theme';

export default function SettlementScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, user, settleRoom } = useApp();
  const [fare, setFare] = useState('');
  const [error, setError] = useState('');
  const room = data.rooms.find((item) => item.id === id);
  if (!room) return <Page back title="정산할 방이 없어요"><EmptyState title="방을 찾을 수 없어요" message="방 목록으로 돌아가 확인해 주세요." /></Page>;
  const riders = room.members.filter((member) => member.boarded);
  const deposit = room.members.find((member) => member.userId === user?.id)?.deposit ?? 0;
  const numericFare = Number(fare.replace(/,/g, '')) || 0;
  const riderIndex = riders.findIndex((member) => member.userId === user?.id);
  const share = numericFare > 0 && riders.length > 0 && riderIndex >= 0 ? mockService.shareFor(numericFare, riders.length, riderIndex) : 0;
  const refund = numericFare > 0 ? Math.max(0, deposit - share) : 0;
  const submit = () => { try { const settlementId = settleRoom(room.id, numericFare); router.replace({ pathname: '/result/[id]', params: { id: settlementId } }); } catch (cause) { setError(cause instanceof Error ? cause.message : '정산에 실패했습니다.'); } };
  return <Page back eyebrow="SETTLEMENT" title="이제 정산해 볼까요?" subtitle="실제 택시 요금을 입력하면 자동으로 나눠요." footer={<AppButton label="정산 완료" onPress={submit} />}>
    <Card style={styles.routeCard}><Text style={styles.route}>{room.departure} → {room.destination}</Text><Text style={styles.routeMeta}>탑승 완료 {riders.length}명 · 예치 포인트 {money(deposit)}P</Text></Card>
    <TextField label="실제 택시 요금" value={fare} onChangeText={setFare} placeholder="예: 12000" keyboardType="number-pad" hint="기사님께 지불한 총 택시 요금을 입력해 주세요." />
    <Card style={styles.calculation}><Text style={styles.cardTitle}>정산 미리보기</Text><View style={styles.divider} /><InfoRow label="실제 택시 요금" value={`${money(numericFare)}원`} /><InfoRow label="탑승 인원" value={`${riders.length}명`} /><InfoRow label="1인 부담 금액" value={`${money(share)}P`} /><InfoRow label="예치 포인트" value={`${money(deposit)}P`} /><View style={styles.divider} /><InfoRow label="환불 예정 포인트" value={`${money(refund)}P`} strong /></Card>
    {share > deposit ? <ErrorNotice message="1인 부담액이 예치 포인트보다 큽니다. 다른 요금을 입력해 주세요." /> : null}
    {error ? <ErrorNotice message={error} /> : null}
    <Text style={styles.note}>포인트 정산은 시연용 mock 데이터로 처리됩니다.</Text>
  </Page>;
}

const styles = StyleSheet.create({ routeCard: { backgroundColor: colors.greenPale, borderColor: colors.greenPale }, route: { color: colors.ink, fontSize: 18, fontWeight: '800' }, routeMeta: { color: colors.muted, fontSize: 12, marginTop: 7 }, calculation: { gap: 9 }, cardTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' }, divider: { height: 1, backgroundColor: colors.border, marginVertical: 5 }, note: { color: colors.muted, fontSize: 11, textAlign: 'center' } });
