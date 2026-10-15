import { useState } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'

import {
  AppButton,
  Card,
  EmptyState,
  ErrorNotice,
  InfoRow,
  Page,
  TextField,
} from '../../../components/ui'

import { useApp } from '../../../state/AppContext'
import { mockService } from '../../../services/mockService'
import { colors, money } from '../../../theme'

export default function SettlementScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()

  const { data, user, settleRoom } = useApp()

  const [fare, setFare] = useState('')
  const [error, setError] = useState('')

  const room = data.rooms.find((item) => item.id === id)

  // 방을 찾을 수 없는 경우
  if (!room) {
    return (
      <Page back title="정산할 방이 없어요">
        <EmptyState
          title="방을 찾을 수 없어요"
          message="방 목록으로 돌아가 확인해 주세요."
        />
      </Page>
    )
  }

  // 현재 사용자가 방장인지 확인
  const isHost = room.hostId === user?.id

  // 현재 사용자의 방 참여 정보
  const currentMember = room.members.find(
    (member) => member.userId === user?.id,
  )

  // 실제 탑승 완료한 사람만 정산 대상
  const riders = room.members.filter((member) => member.boarded)

  // 현재 사용자의 예치 포인트
  const deposit = currentMember?.deposit ?? 0

  // 입력한 요금을 숫자로 변환
  const numericFare = Number(fare.replace(/,/g, '')) || 0

  // 현재 사용자가 탑승자 목록에서 몇 번째인지 확인
  const riderIndex = riders.findIndex((member) => member.userId === user?.id)

  // 1인 부담 금액 계산
  const share =
    numericFare > 0 && riders.length > 0 && riderIndex >= 0
      ? mockService.shareFor(numericFare, riders.length, riderIndex)
      : 0

  // 환불 금액 계산
  const refund = numericFare > 0 ? Math.max(0, deposit - share) : 0

  // 정산 가능한 상태인지 확인
  const canSettle =
    isHost &&
    currentMember?.boarded === true &&
    numericFare > 0 &&
    riders.length > 0 &&
    share <= deposit

  // 택시 요금 입력
  const handleFareChange = (value: string) => {
    // 숫자 이외의 문자는 제거
    const numbersOnly = value.replace(/[^0-9]/g, '')

    if (!numbersOnly) {
      setFare('')
      setError('')
      return
    }

    const numberValue = Number(numbersOnly)

    // 12,000 형태로 표시
    setFare(numberValue.toLocaleString('ko-KR'))

    setError('')
  }

  // 정산 완료
  const submit = () => {
    setError('')

    // 방장 여부 확인
    if (!isHost) {
      setError('방장만 최종 정산을 진행할 수 있습니다.')
      return
    }

    // 탑승 여부 확인
    if (!currentMember?.boarded) {
      setError('방장님의 탑승 완료 확인이 필요합니다.')
      return
    }

    // 실제 요금 확인
    if (numericFare <= 0) {
      setError('실제 택시 요금을 입력해 주세요.')
      return
    }

    // 탑승자 확인
    if (riders.length === 0) {
      setError('탑승 완료한 동승자가 없습니다.')
      return
    }

    // 예치금보다 분담금이 큰 경우
    if (share > deposit) {
      setError(
        '1인 부담액이 예치 포인트보다 큽니다. 다른 요금을 입력해 주세요.',
      )
      return
    }

    try {
      const settlementId = settleRoom(room.id, numericFare)

      router.replace({
        pathname: '/result/[id]',
        params: {
          id: settlementId,
        },
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '정산에 실패했습니다.')
    }
  }

  // ------------------------------------------------
  // 일반 동승자 화면
  // ------------------------------------------------

  if (!isHost) {
    return (
      <Page
        back
        eyebrow="SETTLEMENT"
        title="정산을 기다려 주세요"
        subtitle="방장이 실제 택시 요금을 입력하면 정산이 완료됩니다."
      >
        <Card style={styles.routeCard}>
          <Text style={styles.route}>
            {room.departure} → {room.destination}
          </Text>

          <Text style={styles.routeMeta}>현재 탑승 완료 {riders.length}명</Text>
        </Card>

        <Card style={styles.waitingCard}>
          <Text style={styles.waitingTitle}>방장 정산 대기 중</Text>

          <Text style={styles.waitingText}>
            실제 택시 요금은 방장이 입력합니다.
          </Text>

          <Text style={styles.waitingText}>
            요금이 입력되면 자동으로 1인 부담 금액과 환불 포인트가 계산됩니다.
          </Text>
        </Card>

        <Card style={styles.calculation}>
          <Text style={styles.cardTitle}>현재 탑승 현황</Text>

          <View style={styles.divider} />

          {room.members.map((member) => {
            const memberUser = data.users.find(
              (item) => item.id === member.userId,
            )

            return (
              <InfoRow
                key={member.userId}
                label={
                  member.userId === room.hostId
                    ? `${memberUser?.nickname ?? '방장'} (방장)`
                    : (memberUser?.nickname ?? '동승자')
                }
                value={member.boarded ? '탑승 완료' : '탑승 대기'}
              />
            )
          })}
        </Card>

        <Text style={styles.note}>
          방장이 정산을 완료하면 정산 결과를 확인할 수 있습니다.
        </Text>
      </Page>
    )
  }

  // ------------------------------------------------
  // 방장 화면
  // ------------------------------------------------

  return (
    <Page
      back
      eyebrow="SETTLEMENT"
      title="이제 정산해 볼까요?"
      subtitle="실제 택시 요금을 입력하면 자동으로 나눠요."
      footer={
        <AppButton label="정산 완료" onPress={submit} disabled={!canSettle} />
      }
    >
      {/* 이동 경로 */}
      <Card style={styles.routeCard}>
        <Text style={styles.route}>
          {room.departure} → {room.destination}
        </Text>

        <Text style={styles.routeMeta}>
          탑승 완료 {riders.length}명 · 예치 포인트 {money(deposit)}P
        </Text>
      </Card>

      {/* 실제 택시 요금 입력 */}
      <TextField
        label="실제 택시 요금"
        value={fare}
        onChangeText={handleFareChange}
        placeholder="예: 12000"
        keyboardType="number-pad"
        hint="기사님께 지불한 총 택시 요금을 입력해 주세요."
      />

      {/* 정산 미리보기 */}
      <Card style={styles.calculation}>
        <Text style={styles.cardTitle}>정산 미리보기</Text>

        <View style={styles.divider} />

        <InfoRow label="실제 택시 요금" value={`${money(numericFare)}원`} />

        <InfoRow label="탑승 인원" value={`${riders.length}명`} />

        <InfoRow label="1인 부담 금액" value={`${money(share)}P`} />

        <InfoRow label="예치 포인트" value={`${money(deposit)}P`} />

        <View style={styles.divider} />

        <InfoRow label="환불 예정 포인트" value={`${money(refund)}P`} strong />
      </Card>

      {/* 예치금보다 분담금이 큰 경우 */}
      {share > deposit ? (
        <ErrorNotice message="1인 부담액이 예치 포인트보다 큽니다. 다른 요금을 입력해 주세요." />
      ) : null}

      {/* 오류 메시지 */}
      {error ? <ErrorNotice message={error} /> : null}

      <Text style={styles.note}>
        포인트 정산은 시연용 mock 데이터로 처리됩니다.
      </Text>
    </Page>
  )
}

const styles = StyleSheet.create({
  routeCard: {
    backgroundColor: colors.greenPale,
    borderColor: colors.greenPale,
  },

  route: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '800',
  },

  routeMeta: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 7,
  },

  calculation: {
    gap: 9,
  },

  cardTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '800',
  },

  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 5,
  },

  note: {
    color: colors.muted,
    fontSize: 11,
    textAlign: 'center',
  },

  waitingCard: {
    backgroundColor: colors.greenPale,
    borderColor: colors.greenPale,
    alignItems: 'center',
  },

  waitingTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },

  waitingText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 4,
  },
})
