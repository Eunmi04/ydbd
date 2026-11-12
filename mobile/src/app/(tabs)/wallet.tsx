import { useEffect, useState } from 'react'
import { router } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { AppButton, Card, Header, Page } from '../../components/ui'
import { useApp } from '../../state/AppContext'
import { colors, money, shortDate } from '../../theme'
import type { Settlement } from '../../types'

const options = [5000, 10000, 20000, 30000]
const typeLabel = {
  charge: '충전',
  deposit: '예치',
  use: '사용',
  refund: '환불',
}

function MonthlyRideSummary({ settlements, userId }: { settlements: Settlement[]; userId?: string }) {
  const [monthsBack, setMonthsBack] = useState(0)
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1)
  const nextMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1)
  const rides = settlements.filter((item) => {
    const date = new Date(item.createdAt)
    return item.userId === userId && item.share > 0 && date >= monthStart && date < nextMonth
  })
  const spent = rides.reduce((total, item) => total + item.share, 0)
  const estimable = rides.filter((item) => item.riderCount >= 2)
  const saved = estimable.reduce((total, item) => total + Math.max(0, item.actualFare - item.share), 0)

  return <Card style={styles.monthlyCard}>
    <View style={styles.monthHeading}>
      <Text style={styles.monthTitle}>월간 동승 기록</Text>
      <View style={styles.monthControls}>
        <Pressable accessibilityRole="button" accessibilityLabel="이전 달" onPress={() => setMonthsBack((value) => value + 1)} style={styles.monthControl}><Text style={styles.monthControlText}>‹</Text></Pressable>
        <Text style={styles.monthText}>{monthStart.getFullYear()}년 {monthStart.getMonth() + 1}월</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="다음 달" disabled={monthsBack === 0} onPress={() => setMonthsBack((value) => Math.max(0, value - 1))} style={[styles.monthControl, monthsBack === 0 && styles.monthControlDisabled]}><Text style={styles.monthControlText}>›</Text></Pressable>
      </View>
    </View>
    <View style={styles.monthStats}>
      <View style={styles.monthStat}><Text style={styles.monthLabel}>동승 횟수</Text><Text style={styles.monthValue}>{rides.length}회</Text></View>
      <View style={styles.monthStat}><Text style={styles.monthLabel}>분담액</Text><Text style={styles.monthValue}>{money(spent)}P</Text></View>
    </View>
    <Text style={styles.savings}>추정 절약액 {estimable.length ? `${money(saved)}원 상당` : '계산할 내역 없음'}</Text>
    <Text style={styles.monthNote}>같은 요금의 택시를 혼자 탔다고 가정한 추정치예요. 분담액은 실제 결제가 아닌 TEST 크레딧 정산 기록입니다.</Text>
    <AppButton label="건별 내역 더보기  ↗" variant="ghost" onPress={() => router.push('/(tabs)/my')} />
  </Card>
}

export default function Wallet() {
  const {
    data,
    user,
    balance,
    heldCredit,
    creditLoading,
    refreshCredits,
    charge,
    mode,
  } = useApp()
  const [showCharge, setShowCharge] = useState(false)
  const [amount, setAmount] = useState(10000)
  const [message, setMessage] = useState('')
  useEffect(() => {
    if (mode === 'supabase')
      void refreshCredits().catch((error) =>
        setMessage(
          error instanceof Error ? error.message : '지갑 조회에 실패했습니다.',
        ),
      )
  }, [mode, refreshCredits])
  const submit = () => {
    charge(amount)
    setShowCharge(false)
    setMessage(`${money(amount)}P 충전이 완료됐어요.`)
  }
  const transactions = data.transactions.filter(
    (item) => item.userId === user?.id,
  )
  if (mode === 'supabase')
    return (
      <Page
        eyebrow="MY WALLET"
        title="예치금"
        subtitle="실제 돈이 아닌 시연용 TEST 크레딧입니다."
      >
        <Card style={styles.balance}>
          <Text style={styles.balanceLabel}>사용 가능</Text>
          <Text style={styles.balanceNumber}>
            {creditLoading ? '조회 중' : money(balance)}
            <Text style={styles.balanceUnit}> P</Text>
          </Text>
          <Text style={styles.balanceHelp}>
            예치 중 {money(heldCredit)}P · 총 {money(balance + heldCredit)}P
          </Text>
          <Text style={styles.balanceHelp}>
            TEST 크레딧은 개발용 seed로만 지급합니다. 실제 충전·환급은 없습니다.
          </Text>
        </Card>
        <MonthlyRideSummary settlements={data.settlements} userId={user?.id} />
        {message ? (
          <Card style={styles.success}>
            <Text style={styles.successText}>{message}</Text>
          </Card>
        ) : null}
        <Header title="최근 원장 거래" />
        <Card style={{ paddingVertical: 4 }}>
          {transactions.length ? (
            transactions.map((item, index) => (
              <View
                key={item.id}
                style={[
                  styles.transaction,
                  index < transactions.length - 1 && styles.border,
                ]}
              >
                <View
                  style={[
                    styles.transactionIcon,
                    item.amount < 0 && styles.transactionIconMinus,
                  ]}
                >
                  <Text style={styles.transactionIconText}>
                    {item.amount > 0 ? '＋' : '−'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.transactionTitle}>{item.title}</Text>
                  <Text style={styles.transactionDate}>
                    {shortDate(item.createdAt)}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.transactionAmount,
                    item.amount > 0 && styles.positive,
                  ]}
                >
                  {item.amount > 0 ? '+' : ''}
                  {money(item.amount)}P
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.chargeSub}>아직 원장 거래가 없습니다.</Text>
          )}
        </Card>
      </Page>
    )
  return (
    <Page
      eyebrow="MY WALLET"
      title="포인트 지갑"
      subtitle="동승에 필요한 포인트를 관리해요."
    >
      <Card style={styles.balance}>
        <Text style={styles.balanceLabel}>사용 가능한 포인트</Text>
        <Text style={styles.balanceNumber}>
          {money(balance)}
          <Text style={styles.balanceUnit}> P</Text>
        </Text>
        <Text style={styles.balanceHelp}>
          참여할 때 예치하고 남은 금액은 돌려받아요.
        </Text>
        <AppButton
          label="＋ 포인트 충전하기"
          onPress={() => setShowCharge(!showCharge)}
          variant="orange"
          style={{ marginTop: 20 }}
        />
      </Card>
      <MonthlyRideSummary settlements={data.settlements} userId={user?.id} />
      {message ? (
        <Card style={styles.success}>
          <Text style={styles.successText}>✓ {message}</Text>
        </Card>
      ) : null}
      {showCharge ? (
        <Card>
          <Text style={styles.chargeTitle}>충전할 포인트 선택</Text>
          <Text style={styles.chargeSub}>
            시연용 포인트로 실제 결제는 진행되지 않아요.
          </Text>
          <View style={styles.options}>
            {options.map((option) => (
              <Pressable
                key={option}
                onPress={() => setAmount(option)}
                style={({ pressed }) => [
                  styles.option,
                  amount === option && styles.optionSelected,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text
                  style={[
                    styles.optionText,
                    amount === option && styles.optionTextSelected,
                  ]}
                >
                  {money(option)}P
                </Text>
              </Pressable>
            ))}
          </View>
          <AppButton label={`${money(amount)}P 충전하기`} onPress={submit} />
        </Card>
      ) : null}
      <Header title="최근 거래 내역" />
      <Card style={{ paddingVertical: 4 }}>
        {transactions.map((item, index) => (
          <View
            key={item.id}
            style={[
              styles.transaction,
              index < transactions.length - 1 && styles.border,
            ]}
          >
            <View
              style={[
                styles.transactionIcon,
                item.amount < 0 && styles.transactionIconMinus,
              ]}
            >
              <Text style={styles.transactionIconText}>
                {item.amount > 0 ? '＋' : '−'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.transactionTitle}>{item.title}</Text>
              <Text style={styles.transactionDate}>
                {typeLabel[item.type]} · {shortDate(item.createdAt)}
              </Text>
            </View>
            <Text
              style={[
                styles.transactionAmount,
                item.amount > 0 && styles.positive,
              ]}
            >
              {item.amount > 0 ? '+' : ''}
              {money(item.amount)}P
            </Text>
          </View>
        ))}
      </Card>
    </Page>
  )
}

const styles = StyleSheet.create({
  monthlyCard: { gap: 14 },
  monthHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  monthTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  monthControls: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  monthControl: { width: 28, height: 28, borderRadius: 10, backgroundColor: colors.greenPale, alignItems: 'center', justifyContent: 'center' },
  monthControlDisabled: { opacity: 0.35 },
  monthControlText: { color: colors.greenDark, fontSize: 22, lineHeight: 25 },
  monthText: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  monthStats: { flexDirection: 'row', gap: 10 },
  monthStat: { flex: 1, minWidth: 0, backgroundColor: colors.greenPale, padding: 13, borderRadius: 15, gap: 7 },
  monthLabel: { color: colors.muted, fontSize: 12 },
  monthValue: { color: colors.ink, fontSize: 20, fontWeight: '800' },
  savings: { color: colors.greenDark, fontSize: 14, fontWeight: '800' },
  monthNote: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  balance: {
    backgroundColor: colors.green,
    borderColor: colors.green,
    padding: 23,
  },
  balanceLabel: { color: '#E5F3E7', fontSize: 13, fontWeight: '700' },
  balanceNumber: {
    color: 'white',
    fontSize: 38,
    fontWeight: '900',
    marginTop: 7,
  },
  balanceUnit: { fontSize: 21 },
  balanceHelp: { color: '#E5F3E7', fontSize: 12, marginTop: 9 },
  success: {
    backgroundColor: colors.greenPale,
    borderColor: colors.greenPale,
    padding: 14,
  },
  successText: { color: colors.greenDark, fontWeight: '800', fontSize: 13 },
  chargeTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  chargeSub: { color: colors.muted, fontSize: 12, marginTop: 5 },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
    marginTop: 18,
    marginBottom: 18,
  },
  option: {
    width: '48%',
    minHeight: 47,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionSelected: {
    backgroundColor: colors.greenPale,
    borderColor: colors.green,
  },
  optionText: { color: colors.ink, fontWeight: '700' },
  optionTextSelected: { color: colors.greenDark },
  transaction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    gap: 10,
  },
  border: { borderBottomWidth: 1, borderBottomColor: colors.border },
  transactionIcon: {
    width: 35,
    height: 35,
    backgroundColor: colors.greenPale,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionIconMinus: { backgroundColor: colors.orangePale },
  transactionIconText: { color: colors.green, fontSize: 20, fontWeight: '800' },
  transactionTitle: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  transactionDate: { color: colors.muted, fontSize: 10, marginTop: 4 },
  transactionAmount: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  positive: { color: colors.green },
})
