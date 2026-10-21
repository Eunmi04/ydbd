import { router } from 'expo-router'
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native'
import { SiteHeader } from '../components/SiteHeader'

const BG = '#F8F6EF'
const INK = '#181818'
const LIME = '#8CE52F'

const features = [
  {
    icon: '⌖',
    title: '동승 찾기',
    description: '같은 방향으로 이동하는 사람들과 함께해요.',
  },
  {
    icon: '☺',
    title: '함께 탑승',
    description: '방을 만들고 동승자와 탑승을 확인해요.',
  },
  {
    icon: '₩',
    title: '간편 정산',
    description: '각자의 택시비를 확인하고 정산해요.',
  },
]

export default function AboutPage() {
  const { width } = useWindowDimensions()
  const mobile = width < 768

  return (
    <View style={styles.page}>
      <SiteHeader desktop={!mobile} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        <View style={[styles.hero, mobile && styles.heroMobile]}>
          <View style={styles.heroText}>
            <Text style={styles.label}>ABOUT URURUTA</Text>

            <Text style={[styles.title, mobile && styles.mobileTitle]}>
              같은 방향이라면,{'\n'}
              함께 가는 게 더 좋아요
              <Text style={styles.lime}>.</Text>
            </Text>

            <Text style={styles.description}>
              우르르타는 같은 방향으로 이동하는 사람들을 연결하고,
              {'\n'}택시 요금을 나눌 수 있도록 돕는 동승 매칭 서비스입니다.
            </Text>

            <Pressable
              style={styles.button}
              onPress={() => router.push('/(tabs)/rooms')}
            >
              <Text style={styles.buttonText}>동승 찾으러 가기 ↗</Text>
            </Pressable>
          </View>

          <View style={styles.heroVisual}>
            <Image
              source={require('../../assets/ghost-taxi.png')}
              style={styles.heroImage}
              resizeMode="contain"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>WHY URURUTA?</Text>
          <Text style={styles.sectionTitle}>
            혼자보다 함께, 이동을 더 가볍게.
          </Text>

          <View style={[styles.cards, mobile && styles.mobileCards]}>
            {features.map((feature) => (
              <View key={feature.title} style={styles.card}>
                <Text style={styles.icon}>{feature.icon}</Text>
                <Text style={styles.cardTitle}>{feature.title}</Text>
                <Text style={styles.cardDescription}>
                  {feature.description}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>오늘은 함께 타볼까요?</Text>
          <Text style={styles.bannerDescription}>
            같은 길을 가는 사람들과 더 가볍게 이동해 보세요.
          </Text>

          <Pressable
            style={styles.button}
            onPress={() => router.push('/room/new')}
          >
            <Text style={styles.buttonText}>방 만들기 ↗</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: BG,
  },
  content: {
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingBottom: 80,
  },
  hero: {
    paddingTop: 85,
    paddingBottom: 110,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 30,
  },
  heroMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
    paddingTop: 50,
    paddingBottom: 70,
  },

  heroText: {
    flex: 1.1,
    alignItems: 'flex-start',
  },

  heroVisual: {
    flex: 0.9,
    width: '100%',
    minHeight: 320,
    alignItems: 'center',
    justifyContent: 'center',
  },

  heroImage: {
    width: '100%',
    height: 420,
  },
  label: {
    color: '#70A83F',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 2,
    marginBottom: 24,
  },
  title: {
    color: INK,
    fontWeight: '900',
    fontSize: 52,
    lineHeight: 70,
    letterSpacing: -2,
  },
  mobileTitle: {
    fontSize: 32,
    lineHeight: 45,
  },
  lime: {
    color: LIME,
  },
  description: {
    marginTop: 26,
    marginBottom: 32,
    color: '#666666',
    fontSize: 16,
    lineHeight: 28,
  },
  button: {
    backgroundColor: INK,
    paddingHorizontal: 28,
    paddingVertical: 17,
    borderRadius: 12,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  section: {
    marginBottom: 100,
  },
  sectionTitle: {
    color: INK,
    fontSize: 28,
    fontWeight: '900',
    marginBottom: 30,
  },
  cards: {
    flexDirection: 'row',
    gap: 16,
  },
  mobileCards: {
    flexDirection: 'column',
  },
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 28,
    minHeight: 190,
  },
  icon: {
    fontSize: 34,
    color: '#70C735',
    marginBottom: 20,
  },
  cardTitle: {
    color: INK,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },
  cardDescription: {
    color: '#777777',
    fontSize: 14,
    lineHeight: 23,
  },
  banner: {
    backgroundColor: '#E9F5DC',
    borderRadius: 24,
    alignItems: 'center',
    paddingVertical: 55,
    paddingHorizontal: 20,
    gap: 18,
  },
  bannerTitle: {
    color: INK,
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
  },
  bannerDescription: {
    color: '#666666',
    fontSize: 14,
    textAlign: 'center',
  },
})
