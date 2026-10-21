import { useEffect, useState } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'

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

  const {
    data,
    user,
    mode,
    settleRoom,
    settlementRecords,
    settlementItems,
    refreshSettlements,
    confirmSettlement,
    disputeSettlement,
    reviseFare,
    finalizeSettlement,
  } = useApp()

  const [fare, setFare] = useState('')
  const [evidence, setEvidence] = useState('개인정보를 가린 시연용 증빙')
  const [receiptUri, setReceiptUri] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (mode === 'supabase') {
      void refreshSettlements().catch(console.warn)
    }
  }, [mode, refreshSettlements])

  const room = data.rooms.find((item) => item.id === id)

  const pickReceipt = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      })

      if (!result.canceled && result.assets.length > 0) {
        setReceiptUri(result.assets[0].uri)
        setError('')
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : '영수증 사진을 선택하지 못했습니다.',
      )
    }
  }

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

  const riders = room.members.filter((member) => member.boarded)

  const deposit =
    room.members.find((member) => member.userId === user?.id)?.deposit ?? 0

  const numericFare = Number(fare.replace(/,/g, '')) || 0

  const riderIndex = riders.findIndex((member) => member.userId === user?.id)

  const share =
    numericFare > 0 && riders.length > 0 && riderIndex >= 0
      ? mockService.shareFor(numericFare, riders.length, riderIndex)
      : 0

  const refund = numericFare > 0 ? Math.max(0, deposit - share) : 0

  const record = settlementRecords.find((item) => item.room_id === room.id)

  const myItem = settlementItems.find(
    (item) => item.settlement_id === record?.id && item.user_id === user?.id,
  )

  const isHost = room.hostId === user?.id

  const perform = async (action: () => Promise<void>) => {
    if (busy) return

    setBusy(true)

    try {
      await action()
      setError('')
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : '정산 요청에 실패했습니다.',
      )
    } finally {
      setBusy(false)
    }
  }

  const submit = () =>
    void perform(async () => {
      const settlementId = await settleRoom(
        room.id,
        numericFare,
        evidence.trim(),
      )

      if (mode === 'mock') {
        router.replace({
          pathname: '/result/[id]',
          params: { id: settlementId },
        })
      }
    })

  const receiptSection = (
    <Card style={styles.receiptCard}>
      <Text style={styles.cardTitle}>택시 영수증</Text>

      <Text style={styles.receiptDescription}>
        실제 택시 요금을 확인할 수 있는 영수증 사진을 첨부해 주세요.
      </Text>

      {receiptUri ? (
        <View style={styles.previewContainer}>
          <Image
            source={{ uri: receiptUri }}
            style={styles.receiptImage}
            resizeMode="contain"
          />

          <Pressable
            onPress={() => setReceiptUri(null)}
            style={styles.removeButton}
            accessibilityRole="button"
          >
            <Text style={styles.removeButtonText}>사진 삭제</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.emptyReceipt}>
          <Text style={styles.receiptPlaceholder}>
            아직 선택한 영수증이 없어요.
          </Text>
        </View>
      )}

      <AppButton
        label={receiptUri ? '영수증 사진 변경' : '영수증 사진 선택'}
        variant="ghost"
        onPress={() => void pickReceipt()}
        disabled={busy}
      />

      <Text style={styles.note}>
        현재는 사진 선택 및 미리보기 단계입니다. 사진 업로드와 회원 간 공유는
        별도 연결이 필요합니다.
      </Text>
    </Card>
  )

  if (mode === 'supabase') {
    return (
      <Page
        back
        eyebrow="SETTLEMENT"
        title="테스트 크레딧 정산"
        subtitle="방장이 요금을 제출하고 참여자 모두 확인해야 차감됩니다."
      >
        <Card style={styles.routeCard}>
          <Text style={styles.route}>
            {room.departure} → {room.destination}
          </Text>

          <Text style={styles.routeMeta}>
            현재 상태: {record?.status ?? '요금 입력 대기'} · 탑승 확인{' '}
            {riders.length}명
          </Text>
        </Card>

        {record?.status === 'COMPLETED' ? (
          <AppButton
            label="정산 결과 보기"
            onPress={() =>
              router.replace({
                pathname: '/result/[id]',
                params: { id: record.id },
              })
            }
          />
        ) : null}

        {isHost && (!record || record.status === 'DISPUTED') ? (
          <>
            <TextField
              label={record ? '수정할 실제 택시 요금' : '실제 택시 요금'}
              value={fare}
              onChangeText={setFare}
              placeholder="예: 12000"
              keyboardType="number-pad"
              hint="방장이 기사님께 직접 지불한 요금입니다. 앱에서는 TEST 크레딧만 계산합니다."
            />

            <TextField
              label="샘플·가림 처리된 증빙 설명"
              value={evidence}
              onChangeText={setEvidence}
              placeholder="예: 개인정보 가린 영수증"
            />

            {receiptSection}

            <AppButton
              label={
                record ? '요금 수정 후 확인 다시 받기' : '요금과 증빙 제출'
              }
              disabled={
                busy ||
                !Number.isSafeInteger(numericFare) ||
                numericFare <= 0 ||
                !evidence.trim()
              }
              onPress={
                record
                  ? () =>
                      void perform(() =>
                        reviseFare(record.id, numericFare, evidence.trim()),
                      )
                  : submit
              }
            />
          </>
        ) : null}

        {record && myItem ? (
          <Card style={styles.calculation}>
            <Text style={styles.cardTitle}>
              내 정산 내역 · 버전 {record.settlement_version}
            </Text>

            <View style={styles.divider} />

            <InfoRow
              label="실제 요금"
              value={`${money(record.actual_fare)}원`}
            />

            <InfoRow
              label="탑승 여부"
              value={myItem.boarded ? '탑승' : '미탑승 · 전액 반환'}
            />

            <InfoRow
              label="예치 크레딧"
              value={`${money(myItem.deposit_amount)}P`}
            />

            <InfoRow
              label="내 분담금"
              value={`${money(myItem.share_amount)}P`}
            />

            <InfoRow
              label="반환 크레딧"
              value={`${money(myItem.refund_amount)}P`}
              strong
            />

            <Text style={styles.note}>
              내 확인 상태: {myItem.confirmation_status}
            </Text>
          </Card>
        ) : null}

        {record?.status === 'CONFIRMING' &&
        myItem?.confirmation_status === 'PENDING' ? (
          <>
            <AppButton
              label="요금·탑승 정보 확인"
              disabled={busy}
              onPress={() =>
                void perform(() =>
                  confirmSettlement(record.id, record.settlement_version),
                )
              }
            />

            <TextField
              label="이의 사유"
              value={reason}
              onChangeText={setReason}
              placeholder="확인이 필요한 내용을 적어주세요"
            />

            <AppButton
              label="이의 제기 · 정산 보류"
              variant="ghost"
              disabled={busy || !reason.trim()}
              onPress={() =>
                void perform(() =>
                  disputeSettlement(
                    record.id,
                    record.settlement_version,
                    reason.trim(),
                  ),
                )
              }
            />
          </>
        ) : null}

        {record?.status === 'CONFIRMING' && isHost ? (
          <AppButton
            label="모든 참여자 확인 후 정산 확정"
            disabled={busy}
            onPress={() =>
              void perform(() =>
                finalizeSettlement(record.id, record.settlement_version),
              )
            }
          />
        ) : null}

        {record?.status === 'DISPUTED' ? (
          <ErrorNotice message="이의 제기로 정산이 보류되었습니다. 방장이 요금·증빙을 수정하면 모두 다시 확인합니다." />
        ) : null}

        {!record && !isHost ? (
          <Text style={styles.note}>방장의 요금 입력을 기다리는 중입니다.</Text>
        ) : null}

        {error ? <ErrorNotice message={error} /> : null}

        <Text style={styles.note}>실제 결제·송금은 일어나지 않습니다.</Text>
      </Page>
    )
  }

  return (
    <Page
      back
      eyebrow="SETTLEMENT"
      title="이제 정산해 볼까요?"
      subtitle="실제 택시 요금을 입력하면 자동으로 나눠요."
      footer={
        <AppButton
          label="정산 완료"
          onPress={submit}
          disabled={
            !isHost ||
            !room.members.some(
              (member) => member.userId === user?.id && member.boarded,
            ) ||
            !Number.isSafeInteger(numericFare) ||
            numericFare <= 0 ||
            riders.length === 0 ||
            share > deposit
          }
        />
      }
    >
      <Card style={styles.routeCard}>
        <Text style={styles.route}>
          {room.departure} → {room.destination}
        </Text>

        <Text style={styles.routeMeta}>
          탑승 완료 {riders.length}명 · 예치 포인트 {money(deposit)}P
        </Text>
      </Card>

      <TextField
        label="실제 택시 요금"
        value={fare}
        onChangeText={setFare}
        placeholder="예: 12000"
        keyboardType="number-pad"
        hint="기사님께 지불한 총 택시 요금을 입력해 주세요."
      />

      {isHost ? receiptSection : null}

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

      {share > deposit ? (
        <ErrorNotice message="1인 부담액이 예치 포인트보다 큽니다. 다른 요금을 입력해 주세요." />
      ) : null}

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
  receiptCard: {
    gap: 12,
  },
  receiptDescription: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  emptyReceipt: {
    minHeight: 100,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: 10,
    padding: 16,
  },
  receiptPlaceholder: {
    color: colors.muted,
    fontSize: 13,
  },
  previewContainer: {
    alignItems: 'center',
    gap: 8,
  },
  receiptImage: {
    width: '100%',
    height: 280,
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
  },
  removeButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  removeButtonText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  note: {
    color: colors.muted,
    fontSize: 11,
    textAlign: 'center',
  },
})
