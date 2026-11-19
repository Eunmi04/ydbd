import { router } from 'expo-router'
import { useRef, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import {
  AppButton,
  Avatar,
  Card,
  ErrorNotice,
  Header,
  Page,
} from '../../components/ui'
import { useApp } from '../../state/AppContext'
import { ReceivedRideInvites } from '../../components/ReceivedRideInvites'
import { colors, money, shortDate } from '../../theme'
import { authErrorMessage } from '../../services/authService'
import {
  verificationLabel,
} from '../../services/profileService'

export default function MyPage() {
  const { data, user, logout, mode, profile } = useApp()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submitting = useRef(false)
  const settlements = data.settlements.filter(
    (item) => item.userId === user?.id,
  )
  const signOut = async () => {
    if (submitting.current) return
    submitting.current = true
    setBusy(true)
    setError('')
    try {
      await logout()
      if (mode === 'mock') router.replace('/login')
    } catch (cause) {
      setError(authErrorMessage(cause))
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }
  return (
    <Page
      eyebrow="MY PAGE"
      title="마이페이지"
      subtitle="함께한 이동을 한눈에 확인해요."
    >
      {user ? (
        <Card style={styles.profile}>
          <Avatar user={user} size={58} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user.nickname}</Text>
            <Text style={styles.email}>{user.email}</Text>
          </View>
        </Card>
      ) : null}
      <Text style={styles.email}>
        {mode === 'mock'
          ? '로컬 시연 계정 · 본인 인증 미완료'
          : verificationLabel(profile)}
      </Text>
      {profile && profile.account_status !== 'ACTIVE' ? (
        <ErrorNotice message="이용이 제한된 계정입니다. 관리자에게 문의해 주세요." />
      ) : null}
      <View style={styles.stats}>
        <Card style={styles.statCard}>
          <Text style={styles.statLabel}>누적 이용</Text>
          <Text style={styles.statNumber}>
            {settlements.length}
            <Text style={styles.statUnit}> 회</Text>
          </Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statLabel}>절약한 이동</Text>
          <Text style={styles.statNumber}>
            {settlements.length}
            <Text style={styles.statUnit}> 번</Text>
          </Text>
        </Card>
      </View>
      <Header title="이용 내역" />
      <Card style={{ paddingVertical: 3 }}>
        {settlements.length === 0 ? (
          <Text style={styles.emptyText}>아직 이용 내역이 없어요.</Text>
        ) : (
          settlements.map((item, index) => (
            <Pressable
              key={item.id}
              onPress={() =>
                router.push({
                  pathname: '/history/[id]',
                  params: { id: item.id },
                })
              }
              accessibilityRole="button"
              accessibilityLabel={`택시 이용 내역 상세 보기, ${shortDate(item.createdAt)}`}
              style={({ pressed }) => [
                styles.history,
                index < settlements.length - 1 && styles.border,
                pressed && styles.pressed,
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.historyTitle}>
                  함께 탄 택시 · 정산 완료
                </Text>
                <Text style={styles.historyDate}>
                  {shortDate(item.createdAt)} · {item.riderCount}명 탑승
                </Text>
              </View>
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
              >
                <Text style={styles.historyAmount}>{money(item.share)}P</Text>
                <Text style={styles.chevron}>›</Text>
              </View>
            </Pressable>
          ))
        )}
      </Card>
      {mode === 'supabase' && user ? <ReceivedRideInvites key={user.id} userId={user.id} /> : null}
      <Header title="설정" />
      <Card style={{ paddingVertical: 5 }}>
        <Pressable accessibilityRole="button" onPress={() => router.push('/settings')} style={styles.menu}>
          <Text style={styles.menuText}>회원 설정 · 개인정보 수정</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
        <Pressable
          onPress={() =>
            Alert.alert('알림 설정', '시연용 앱에서 알림 기능을 준비 중입니다.')
          }
          style={({ pressed }) => [styles.menu, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.menuText}>알림 설정</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
        <Pressable
          onPress={() =>
            Alert.alert(
              '서비스 안내',
              '같은 방향이면, 같이 타요. 동승과 정산을 간편하게 돕는 서비스입니다.',
            )
          }
          style={({ pressed }) => [styles.menu, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.menuText}>서비스 안내</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      </Card>
      {error ? <ErrorNotice message={error} /> : null}
      <AppButton
        label={busy ? '로그아웃 중…' : '로그아웃'}
        variant="ghost"
        onPress={signOut}
        disabled={busy}
      />
    </Page>
  )
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  name: { color: colors.ink, fontSize: 20, fontWeight: '800' },
  email: { color: colors.muted, fontSize: 12, marginTop: 4 },
  stats: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1 },
  statLabel: { color: colors.muted, fontSize: 12 },
  statNumber: {
    color: colors.green,
    fontSize: 28,
    fontWeight: '900',
    marginTop: 5,
  },
  statUnit: { fontSize: 14 },
  history: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  border: { borderBottomWidth: 1, borderBottomColor: colors.border },
  historyTitle: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  historyDate: { color: colors.muted, fontSize: 10, marginTop: 4 },
  historyAmount: { color: colors.green, fontWeight: '800', fontSize: 13 },
  menu: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
  },
  menuText: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  chevron: { color: colors.muted, fontSize: 24 },
  emptyText: {
    color: colors.muted,
    textAlign: 'center',
    paddingVertical: 20,
    fontSize: 13,
  },
  pressed: { opacity: 0.6 },
})
