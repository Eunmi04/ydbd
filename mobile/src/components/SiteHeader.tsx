import { router, usePathname } from 'expo-router'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { useApp } from '../state/AppContext'
import { colors } from '../theme'

export function SiteHeader({ desktop }: { desktop: boolean }) {
  const { isAuthenticated, user } = useApp()
  const pathname = usePathname()

  const nav = [
    {
      label: '서비스 소개',
      path: '/about' as const,
      active: pathname === '/about',
    },
    {
      label: '동승 찾기',
      path: '/(tabs)/rooms' as const,
      active: pathname === '/rooms',
    },
    {
      label: '방 만들기',
      path: '/room/new' as const,
      active: pathname === '/room/new',
    },
    {
      label: '지갑',
      path: '/(tabs)/wallet' as const,
      active: pathname === '/wallet',
    },
  ]

  return (
    <View style={[styles.header, !desktop && styles.mobile]}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="우르르타 홈"
        onPress={() => router.push('/')}
      >
        <Image
          source={require('../../assets/ururuta-header-logo.png')}
          style={[styles.logoImage, !desktop && styles.logoImageMobile]}
          resizeMode="contain"
        />
      </Pressable>
      {desktop ? (
        <View style={styles.links}>
          {nav.map((item) => (
            <Pressable
              key={item.label}
              accessibilityRole="link"
              onPress={() =>
                router.push(
                  item.path === '/about'
                    ? '/about'
                    : isAuthenticated
                      ? item.path
                      : '/login',
                )
              }
              style={styles.link}
            >
              <Text style={[styles.linkText, item.active && styles.active]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <Pressable
        accessibilityRole="link"
        onPress={() => router.push(isAuthenticated ? '/(tabs)/my' : '/login')}
        style={[styles.account, !isAuthenticated && styles.login]}
      >
        {isAuthenticated ? (
          <View style={styles.face}>
            <Text style={styles.faceText}>☺</Text>
          </View>
        ) : null}
        <Text style={styles.accountText}>
          {isAuthenticated
            ? `${user?.nickname ?? '나'}의 마이페이지`
            : '로그인'}
          {desktop && isAuthenticated ? '  ↗' : ''}
        </Text>
      </Pressable>
    </View>
  )
}
const styles = StyleSheet.create({
  header: {
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    minHeight: 105,
    paddingHorizontal: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 18,
  },
  mobile: { minHeight: 76, paddingHorizontal: 22 },
  logoImage: {
    width: 160,
    height: 64,
  },
  logoImageMobile: {
    width: 120,
    height: 50,
  },
  logo: {
    color: colors.ink,
    fontSize: 29,
    fontWeight: '900',
    letterSpacing: -2,
    transform: [{ rotate: '-4deg' }],
  },
  dot: { color: colors.lime, fontSize: 38 },
  links: { flexDirection: 'row', gap: 30 },
  link: { paddingVertical: 14 },
  linkText: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  active: { color: colors.green, textDecorationLine: 'underline' },
  account: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  login: {
    borderWidth: 1,
    borderColor: colors.ink,
    borderRadius: 9,
    paddingHorizontal: 25,
  },
  accountText: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  face: {
    width: 32,
    height: 32,
    backgroundColor: '#EDE7DA',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceText: { color: colors.ink, fontSize: 26 },
})
