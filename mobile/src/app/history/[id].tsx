import { useEffect } from 'react'
import { useLocalSearchParams } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'

import { Card, EmptyState, InfoRow, Page } from '../../components/ui'
import { useApp } from '../../state/AppContext'
import { colors, money, shortDate } from '../../theme'

export default function HistoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()

  const {
    data,
    user,
    mode,
    settlementRecords,
    settlementItems,
    refreshSettlements,
  } = useApp()

  useEffect(() => {
    if (mode === 'supabase') {
      void refreshSettlements().catch(console.warn)
    }
  }, [mode, refreshSettlements])

  const history = data.settlements.find(
    (item) => item.id === id && item.userId === user?.id,
  )

  const record = settlementRecords.find((item) => item.id === id)

  const roomId = history?.roomId ?? record?.room_id

  const room = data.rooms.find((item) => item.id === roomId)

  const myItem = settlementItems.find(
    (item) => item.settlement_id === id && item.user_id === user?.id,
  )

  const actualFare = record?.actual_fare ?? history?.actualFare
  const share = myItem?.share_amount ?? history?.share
  const refund = myItem?.refund_amount ?? history?.refund

  const riders = room?.members.filter((member) => member.boarded) ?? []

  if (!history && !record) {
    return (
      <Page back eyebrow="TRIP HISTORY" title="이용 내역 상세">
        <EmptyState
          title="이용 내역을 찾을 수 없어요"
          message="정산이 완료된 이용 내역인지 확인해 주세요."
        />
      </Page>
    )
  }

  const date = history?.createdAt ?? record?.completed_at ?? record?.created_at

  return (
    <Page
      back
      eyebrow="TRIP HISTORY"
      title="이용 내역 상세"
      subtitle="함께한 택시 이용 및 정산 정보를 확인해요."
    >
      <Card style={styles.routeCard}>
        <Text style={styles.label}>이동 경로</Text>

        <Text style={styles.route}>
          {room ? `${room.departure} → ${room.destination}` : '경로 정보 없음'}
        </Text>

        {date ? <Text style={styles.date}>{shortDate(date)}</Text> : null}
      </Card>

      <Card style={styles.card}>
        <Text style={styles.heading}>요금 정산</Text>
        <View style={styles.divider} />

        <InfoRow
          label="전체 택시 요금"
          value={actualFare != null ? `${money(actualFare)}원` : '정보 없음'}
        />

        <InfoRow
          label="탑승 인원"
          value={history ? `${history.riderCount}명` : `${riders.length}명`}
        />

        <InfoRow
          label="내 분담금"
          value={share != null ? `${money(share)}P` : '정보 없음'}
        />

        <InfoRow
          label="환불 금액"
          value={refund != null ? `${money(refund)}P` : '정보 없음'}
          strong
        />

        <InfoRow
          label="정산 상태"
          value={
            record?.status === 'COMPLETED' || history
              ? '정산 완료'
              : (record?.status ?? '확인 중')
          }
        />
      </Card>

      <Card style={styles.card}>
        <Text style={styles.heading}>탑승자</Text>
        <View style={styles.divider} />

        {riders.length > 0 ? (
          riders.map((member, index) => {
            const rider = data.users.find((item) => item.id === member.userId)

            return (
              <InfoRow
                key={member.userId}
                label={rider?.nickname ?? `탑승자 ${index + 1}`}
                value="탑승 완료"
              />
            )
          })
        ) : (
          <Text style={styles.muted}>확인할 수 있는 탑승자 정보가 없어요.</Text>
        )}
      </Card>

      <Text style={styles.note}>
        실제 결제·송금이 아닌 앱의 정산 기록입니다.
      </Text>
    </Page>
  )
}

const styles = StyleSheet.create({
  routeCard: {
    backgroundColor: colors.greenPale,
    borderColor: colors.greenPale,
    gap: 8,
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  route: {
    color: colors.ink,
    fontSize: 19,
    fontWeight: '800',
  },
  date: {
    color: colors.muted,
    fontSize: 12,
  },
  card: {
    gap: 10,
  },
  heading: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '800',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
  muted: {
    color: colors.muted,
    fontSize: 13,
  },
  note: {
    color: colors.muted,
    fontSize: 11,
    textAlign: 'center',
  },
})
