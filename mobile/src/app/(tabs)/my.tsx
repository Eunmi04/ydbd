import { router } from 'expo-router'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { AppButton, Avatar, Card, Header, Page } from '../../components/ui'
import { useApp } from '../../state/AppContext'
import { colors, money, shortDate } from '../../theme'

export default function MyPage() {
  const { data, user, logout, mode } = useApp()

  const settlements = data.settlements.filter(
    (item) => item.userId === user?.id,
  )

  const signOut = async () => {
    try {
      await logout()
      if (mode === 'mock') router.replace('/login')
    } catch (error) {
      Alert.alert(
        '로그아웃 실패',
        error instanceof Error ? error.message : '다시 시도해 주세요.',
      )
    }
  }

  const openSettlement = (id: string) => {
    router.push({
      pathname: '/history/[id]',
      params: { id },
    })
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
              onPress={() => openSettlement(item.id)}
              accessibilityRole="button"
              accessibilityLabel={`택시 이용 내역 상세 보기, ${shortDate(item.createdAt)}`}
              style={({ pressed }) => [
                styles.history,
                index < settlements.length - 1 && styles.border,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.historyInfo}>
                <Text style={styles.historyTitle}>
                  함께 탄 택시 · 정산 완료
                </Text>

                <Text style={styles.historyDate}>
                  {shortDate(item.createdAt)} · {item.riderCount}명 탑승
                </Text>
              </View>

              <View style={styles.amountContainer}>
                <Text style={styles.historyAmount}>{money(item.share)}P</Text>
                <Text style={styles.chevron}>›</Text>
              </View>
            </Pressable>
          ))
        )}
      </Card>

      <Header title="설정" />

      <Card style={{ paddingVertical: 5 }}>
        <Pressable
          onPress={() =>
            Alert.alert('알림 설정', '시연용 앱에서 알림 기능을 준비 중입니다.')
          }
          style={({ pressed }) => [styles.menu, pressed && styles.pressed]}
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
          style={({ pressed }) => [styles.menu, pressed && styles.pressed]}
        >
          <Text style={styles.menuText}>서비스 안내</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      </Card>

      <AppButton label="로그아웃" variant="ghost" onPress={signOut} />
    </Page>
  )
}

const styles = StyleSheet.create({
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  name: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '800',
  },
  email: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
  },
  stats: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
  },
  statLabel: {
    color: colors.muted,
    fontSize: 12,
  },
  statNumber: {
    color: colors.green,
    fontSize: 28,
    fontWeight: '900',
    marginTop: 5,
  },
  statUnit: {
    fontSize: 14,
  },
  history: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  historyInfo: {
    flex: 1,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  border: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  historyTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  historyDate: {
    color: colors.muted,
    fontSize: 10,
    marginTop: 4,
  },
  historyAmount: {
    color: colors.green,
    fontWeight: '800',
    fontSize: 13,
  },
  emptyText: {
    color: colors.muted,
    textAlign: 'center',
    paddingVertical: 20,
    fontSize: 13,
  },
  menu: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
  },
  menuText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  chevron: {
    color: colors.muted,
    fontSize: 24,
  },
  pressed: {
    opacity: 0.6,
  },
})
