import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import KakaoMap from '../../components/KakaoMap.web';
import {
  AppButton,
  Card,
  ErrorNotice,
  InfoRow,
  Page,
  TextField,
} from '../../components/ui';
import { calculateReserveAmount, parseFareInput } from '../../services/creditPolicy';
import { useApp } from '../../state/AppContext';
import { colors, money } from '../../theme';
import { TaxiDoodle } from '../../components/TaxiDoodle';
import { ROOM_CAPACITY } from '../../services/roomPolicy';
import { serviceErrorMessage } from '../../services/profileService';

function departureDefaults() {
  const next = new Date(Date.now() + 60 * 60 * 1000);
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, index) => {
  const date = new Date();
  date.setDate(date.getDate() + index);
  date.setHours(0, 0, 0, 0);
  return date;
  });
  return { days, day: next.toDateString() === today.toDateString() ? 0 : 1,
    hour: String(next.getHours()).padStart(2, '0'), minute: String(next.getMinutes()).padStart(2, '0') };
}

function isFutureDeparture(date: Date): boolean {
  return date.getTime() > Date.now();
}

export default function NewRoom() {
  const { createRoom, mode } = useApp();
  const [defaults] = useState(departureDefaults);
  const days = defaults.days;
  const [departure, setDeparture] = useState('');
  const [destination, setDestination] = useState('');
  const [selectedDay, setSelectedDay] = useState(defaults.day);
  const [hour, setHour] = useState(defaults.hour);
  const [minute, setMinute] = useState(defaults.minute);
  const maxMembers = ROOM_CAPACITY;
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= 850;
  const [fare, setFare] = useState('12000');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const fareResult = parseFareInput(fare);
  const numericFare = fareResult.value;
  const deposit = numericFare === null ? null : calculateReserveAmount(numericFare, maxMembers);
  const submit = async () => {
    if (submitting.current) return;
    setError('');
    if (numericFare === null) {
      setError(fareResult.error);
      return;
    }
    const h = Number(hour);
    const m = Number(minute);
    if (
      !/^\d{1,2}$/.test(hour) || !/^\d{1,2}$/.test(minute) || !Number.isInteger(h) ||
      h < 0 ||
      h > 23 ||
      !Number.isInteger(m) ||
      m < 0 ||
      m > 59
    ) {
      setError('시간은 00~23시, 분은 00~59로 입력해 주세요.');
      return;
    }
    const date = new Date(days[selectedDay]);
    date.setHours(h, m, 0, 0);
    if (!isFutureDeparture(date)) {
      setError('현재 시간 이후로 출발 시간을 선택해 주세요.');
      return;
    }
    submitting.current = true;
    setBusy(true);
    try {
      const id = await createRoom({
        departure,
        destination,
        departureAt: date.toISOString(),
        estimatedFare: numericFare,
      });
      router.replace({ pathname: '/room/[id]', params: { id } });
    } catch (cause) {
      setError(serviceErrorMessage(cause));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  return <Page wide back eyebrow="LET'S RIDE TOGETHER" title="방 만들기" subtitle="함께 가는 길이, 더 가볍고 즐거워져요.">
    <View style={[styles.columns, desktop && styles.desktopColumns]}>
      <Card style={[styles.form, desktop && styles.desktopForm]}>
        <TextField label="출발지" value={departure} onChangeText={setDeparture} placeholder="예: 삼송역" />
        <TextField label="도착지" value={destination} onChangeText={setDestination} placeholder="예: 중부대학교" />
        <View style={styles.group}>
          <Text style={styles.label}>출발 날짜</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayList}>
            {days.map((day, index) => <Pressable key={index} accessibilityRole="button" accessibilityState={{ selected: selectedDay === index }}
              onPress={() => setSelectedDay(index)} style={[styles.chip, selectedDay === index && styles.chipSelected]}>
              <Text style={[styles.chipText, selectedDay === index && styles.chipTextSelected]}>{index === 0 ? '오늘' : index === 1 ? '내일' : `${day.getMonth()+1}/${day.getDate()}`}</Text>
            </Pressable>)}
          </ScrollView>
        </View>
        <View style={styles.timeRow}>
          <View style={{ flex: 1 }}><TextField label="출발 시" value={hour} onChangeText={setHour} placeholder="시" keyboardType="number-pad" /></View>
          <Text style={styles.colon}>:</Text>
          <View style={{ flex: 1 }}><TextField label="출발 분" value={minute} onChangeText={setMinute} placeholder="분" keyboardType="number-pad" /></View>
        </View>
        <View style={styles.capacity}><Text style={styles.capacityTitle}>☺  최대 4명, 가볍게 함께</Text><Text style={styles.capacityText}>방장을 포함해 2명부터 확정할 수 있어요.{"\n"}인원 선택 없이 최대 4명까지 참여해요.</Text></View>
        <TextField label="예상 택시 요금" value={fare} onChangeText={(value) => { setFare(value); setError(''); }} placeholder="예: 12000" keyboardType="number-pad" />
        {fareResult.error ? <ErrorNotice message={fareResult.error} /> : null}
        {deposit !== null ? <View style={styles.estimate}><InfoRow label="1인 예치 예상" value={`${money(deposit)}P`} /><Text style={styles.hint}>{mode === 'supabase' ? '방을 만들 때는 예치하지 않아요. 준비할 때 서버가 예치해요.' : '시연용 포인트가 예치돼요.'}</Text></View> : null}
        {error ? <ErrorNotice message={error} /> : null}
        <AppButton label={busy ? '방 만드는 중…' : '방 만들기  ↗'} onPress={submit} disabled={busy || numericFare === null} />
      </Card>
      <View style={[styles.aside, desktop && { flex: 1 }]}>
        <Card style={styles.mapCard}><KakaoMap departure={departure || '출발지'} destination={destination || '목적지'} /></Card>
        <Card style={styles.tips}><Text style={styles.tipTitle}>이런 방은 어때요?</Text>{['비슷한 시간대의 사람들과 함께해요.', '정확한 만나는 장소를 정해 주세요.', '서로를 배려하는 따뜻한 매너로 출발해요.'].map(text => <Text key={text} style={styles.tip}><Text style={styles.check}>✓</Text>  {text}</Text>)}</Card>
        <TaxiDoodle compact />
      </View>
    </View>
  </Page>;
}
const styles = StyleSheet.create({
  columns: { gap: 25 }, desktopColumns: { flexDirection: 'row', alignItems: 'flex-start', gap: 38 },
  form: { gap: 20 }, desktopForm: { flexGrow: 0, flexShrink: 0, flexBasis: 455, width: 455 }, aside: { gap: 22, minWidth: 0 },
  group: { gap: 10 }, label: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  dayList: { gap: 8 }, chip: { minWidth: 52, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  chipSelected: { backgroundColor: colors.ink, borderColor: colors.ink }, chipText: { color: colors.muted, fontSize: 12, fontWeight: '600' }, chipTextSelected: { color: 'white' },
  timeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 }, colon: { fontSize: 24, marginBottom: 15, color: colors.ink },
  capacity: { padding: 16, borderRadius: 12, backgroundColor: colors.greenPale, gap: 7 }, capacityTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  capacityText: { color: colors.greenDark, fontSize: 12, lineHeight: 20 }, estimate: { gap: 8 }, hint: { color: colors.muted, fontSize: 11, lineHeight: 18 },
  mapCard: { padding: 10, overflow: 'hidden' }, tips: { gap: 14, backgroundColor: '#F0EEE5' }, tipTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  tip: { color: colors.muted, fontSize: 13, lineHeight: 21 }, check: { color: colors.green, fontWeight: '900' },
});
