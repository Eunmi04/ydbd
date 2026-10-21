import { Redirect, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '../components/ui';
import { useApp } from '../state/AppContext';
import { colors } from '../theme';

const steps = [
  { number: '1', title: '동승 방 찾기', description: '출발지·목적지가 맞는 방을 찾거나 만들어요.' },
  { number: '2', title: '함께 준비하기', description: '함께 탈 사람과 준비를 확인하고 인원을 확정해요.' },
  { number: '3', title: '분담 내역 확인', description: '탑승 후 실제 요금을 기준으로 분담 내역을 확인해요.' },
];

export default function Welcome() {
  const { isAuthenticated } = useApp();
  if (isAuthenticated) return <Redirect href="/(tabs)" />;

  return <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
    <StatusBar style="dark" />
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.content}>
        <View style={styles.brandRow}>
          <View style={styles.brandMark}><Text style={styles.brandArrow}>↗</Text></View>
          <Text style={styles.brandName}>같이타요</Text>
          <View style={styles.brandDivider} />
          <Text style={styles.brandDescriptor}>택시 동승</Text>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroTag}><View style={styles.heroTagDot} /><Text style={styles.heroTagText}>택시 동승 매칭</Text></View>
          <Text style={styles.heroTitle}>같은 방향이면,{"\n"}<Text style={styles.heroAccent}>같이 타요.</Text></Text>
          <Text style={styles.valueProposition}>가는 길이 비슷한 사람과 함께 타고, 요금 나눔까지 한 곳에서 확인해요.</Text>
          <View style={styles.routePanel} accessibilityLabel="출발지에서 동승자를 만나 목적지까지 함께 이동하는 경로">
            <View style={styles.routeHeading}>
              <Text style={styles.routeHeadingText}>우리의 이동 경로</Text>
              <Text style={styles.routeHeadingArrow}>함께 이동</Text>
            </View>
            <View style={styles.routePath}>
              <View style={styles.routeStops}>
                <View style={styles.routePoint}><View style={styles.routePointCenter} /></View>
                <View style={styles.routeLine} />
                <View style={styles.routePointEnd} />
              </View>
              <View style={styles.routeLabels}><Text style={styles.routeLabel}>출발지</Text><Text style={styles.routeLabel}>같은 목적지</Text></View>
            </View>
          </View>
        </View>

        <View style={styles.flowSection}>
          <Text style={styles.sectionOverline}>간단한 세 단계</Text>
          <Text style={styles.sectionTitle}>출발부터 정산까지</Text>
          <View style={styles.timeline}>
            {steps.map((step, index) => <View key={step.number} style={styles.stepRow}>
              <View style={styles.rail}>
                <View style={styles.stepNumber}><Text style={styles.stepNumberText}>{step.number}</Text></View>
                {index < steps.length - 1 ? <View style={styles.railLine} /> : null}
              </View>
              <View style={styles.stepCopy}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepDescription}>{step.description}</Text>
              </View>
            </View>)}
          </View>
        </View>

        <View style={styles.paymentNotice}>
          <View style={styles.noticeIcon}><Text style={styles.noticeIconText}>₩</Text></View>
          <View style={styles.noticeCopy}>
            <Text style={styles.noticeTitle}>실제 택시비는 앱 밖에서 결제해요</Text>
            <Text style={styles.noticeText}>TEST 크레딧은 시연용이에요. 실제 충전·송금·환급은 지원하지 않아요.</Text>
          </View>
        </View>
      </View>
    </ScrollView>
    <View style={styles.actionDock}>
      <View style={styles.actions}>
        <AppButton label="로그인하고 시작하기" onPress={() => router.push('/login')} />
        <AppButton label="처음이신가요? 회원가입" onPress={() => router.push('/signup')} variant="ghost" style={styles.secondaryButton} />
      </View>
    </View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 14, paddingBottom: 24 },
  content: { width: '100%', maxWidth: 440 },
  brandRow: { flexDirection: 'row', alignItems: 'center', minHeight: 38 },
  brandMark: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  brandArrow: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', marginTop: -2 },
  brandName: { color: colors.greenDark, fontSize: 18, fontWeight: '800', letterSpacing: -0.8, marginLeft: 9 },
  brandDivider: { width: 1, height: 16, backgroundColor: colors.border, marginHorizontal: 12 },
  brandDescriptor: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  hero: { marginTop: 25, backgroundColor: colors.greenDark, borderRadius: 26, padding: 21, overflow: 'hidden' },
  heroTag: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 6, gap: 7, marginBottom: 14 },
  heroTagDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#B8D99C' },
  heroTagText: { color: '#E5F0E3', fontSize: 11, fontWeight: '700' },
  heroTitle: { color: '#FFFFFF', fontSize: 32, lineHeight: 40, fontWeight: '800', letterSpacing: -1.5 },
  heroAccent: { color: '#C7E3AE' },
  valueProposition: { color: '#E3EDE4', fontSize: 14, lineHeight: 21, marginTop: 10 },
  routePanel: { backgroundColor: colors.paper, borderRadius: 18, paddingHorizontal: 15, paddingTop: 14, paddingBottom: 12, marginTop: 19 },
  routeHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  routeHeadingText: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  routeHeadingArrow: { color: colors.green, fontSize: 11, fontWeight: '800' },
  routePath: { marginTop: 13 },
  routeStops: { flexDirection: 'row', alignItems: 'center' },
  routePoint: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.greenPale, alignItems: 'center', justifyContent: 'center' },
  routePointCenter: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.green },
  routePointEnd: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.orange, borderWidth: 3, borderColor: colors.orangePale },
  routeLine: { flex: 1, height: 3, backgroundColor: '#C9DCC7', marginHorizontal: 5 },
  routeLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 },
  routeLabel: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  flowSection: { marginTop: 27 },
  sectionOverline: { color: colors.green, fontSize: 11, fontWeight: '800', letterSpacing: 0.2 },
  sectionTitle: { color: colors.ink, fontSize: 22, fontWeight: '800', letterSpacing: -0.8, marginTop: 5 },
  timeline: { marginTop: 18 },
  stepRow: { flexDirection: 'row', minHeight: 75, gap: 15 },
  rail: { width: 28, alignItems: 'center' },
  stepNumber: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.paper, borderWidth: 1, borderColor: '#B8D2B7', alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { color: colors.greenDark, fontSize: 12, fontWeight: '800' },
  railLine: { width: 1, flex: 1, backgroundColor: '#B8D2B7', marginVertical: 4 },
  stepCopy: { flex: 1, paddingBottom: 17 },
  stepTitle: { color: colors.ink, fontSize: 15, fontWeight: '800', lineHeight: 22 },
  stepDescription: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 3 },
  paymentNotice: { backgroundColor: '#FFF1DC', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 13, flexDirection: 'row', alignItems: 'flex-start', gap: 11, marginTop: 4 },
  noticeIcon: { width: 27, height: 27, borderRadius: 10, backgroundColor: '#F8DFB8', alignItems: 'center', justifyContent: 'center' },
  noticeIconText: { color: '#875622', fontSize: 14, fontWeight: '800' },
  noticeCopy: { flex: 1, gap: 4 },
  noticeTitle: { color: colors.ink, fontSize: 12, lineHeight: 17, fontWeight: '800' },
  noticeText: { color: '#685A47', fontSize: 11, lineHeight: 17 },
  actionDock: { width: '100%', alignItems: 'center', paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.cream },
  actions: { width: '100%', maxWidth: 440, gap: 8 },
  secondaryButton: { minHeight: 46 },
});
