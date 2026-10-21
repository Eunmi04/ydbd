import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
  const [maxMembers, setMaxMembers] = useState(4);
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
        maxMembers,
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
  return (
    <Page
      back
      eyebrow="CREATE A ROOM"
      title="동승 방 만들기"
      subtitle="이동 일정과 경로를 알려주세요."
      footer={
        <AppButton
          label={busy ? '방 만드는 중…' : '방 만들기'}
          onPress={submit}
          disabled={busy || numericFare === null}
        />
      }
    >
      <TextField
        label="출발지"
        value={departure}
        onChangeText={setDeparture}
        placeholder="예: 삼송역"
      />
      <TextField
        label="목적지"
        value={destination}
        onChangeText={setDestination}
        placeholder="예: 중부대학교"
      />
      <KakaoMap
        departure={departure || '출발지'}
        destination={destination || '목적지'}
      />
      <View style={styles.group}>
        <Text style={styles.label}>출발 날짜</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dayList}
        >
          {days.map((day, index) => (
            <Pressable
              key={index}
              accessibilityRole="button"
              accessibilityState={{ selected: selectedDay === index }}
              onPress={() => setSelectedDay(index)}
              style={({ pressed }) => [
                styles.chip,
                selectedDay === index && styles.chipSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  selectedDay === index && styles.chipTextSelected,
                ]}
              >
                {index === 0
                  ? '오늘'
                  : index === 1
                    ? '내일'
                    : `${day.getMonth() + 1}/${day.getDate()}`}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <View style={styles.timeRow}>
        <View style={{ flex: 1 }}>
          <TextField
            label="시"
            value={hour}
            onChangeText={setHour}
            placeholder="18"
            keyboardType="number-pad"
          />
        </View>
        <Text style={styles.colon}>:</Text>
        <View style={{ flex: 1 }}>
          <TextField
            label="분"
            value={minute}
            onChangeText={setMinute}
            placeholder="30"
            keyboardType="number-pad"
          />
        </View>
      </View>
      <View style={styles.group}>
        <Text style={styles.label}>최대 인원</Text>
        <View style={styles.memberList}>
          {[2, 3, 4].map((count) => (
            <Pressable
              key={count}
              accessibilityRole="button"
              accessibilityState={{ selected: maxMembers === count }}
              onPress={() => setMaxMembers(count)}
              style={({ pressed }) => [
                styles.memberChip,
                maxMembers === count && styles.memberSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.memberText,
                  maxMembers === count && styles.memberTextSelected,
                ]}
              >
                {count}명
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <TextField
        label="예상 택시 요금"
        value={fare}
        onChangeText={(value) => { setFare(value); setError(''); }}
        placeholder="예: 12000"
        keyboardType="number-pad"
        hint="실제 요금은 탑승 후 정산 화면에서 입력해요."
      />
      {fareResult.error ? <ErrorNotice message={fareResult.error} /> : null}
      {numericFare !== null && deposit !== null ? <Card style={styles.estimate}>
        <InfoRow label="예상 택시 요금" value={`${money(numericFare)}원`} />
        <InfoRow label="최대 참여 인원" value={`${maxMembers}명`} />
        <View style={styles.divider} />
        <InfoRow label="1인 예치 테스트 크레딧" value={`${money(deposit)}P`} strong />
        <Text style={styles.estimateHint}>
          예상 요금을 최대 인원으로 나눈 뒤 1,000P 단위로 올려요. 최소 예치액은 5,000P예요.
          {mode === 'supabase' ? ' 방 생성 때는 예치하지 않고, 준비 버튼을 누르면 서버가 실제 예치액을 계산해요.' : ''}
        </Text>
      </Card> : null}
      {error ? <ErrorNotice message={error} /> : null}
    </Page>
  );
}

const styles = StyleSheet.create({
  group: { gap: 10 },
  label: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  dayList: { gap: 8, paddingRight: 10 },
  chip: {
    minWidth: 65,
    minHeight: 42,
    borderRadius: 13,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  chipSelected: { backgroundColor: colors.green, borderColor: colors.green },
  chipText: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  chipTextSelected: { color: 'white' },
  timeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  colon: {
    color: colors.green,
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 12,
  },
  memberList: { flexDirection: 'row', gap: 8 },
  memberChip: {
    flex: 1,
    height: 45,
    borderRadius: 13,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberSelected: {
    borderColor: colors.green,
    backgroundColor: colors.greenPale,
  },
  memberText: { color: colors.ink, fontWeight: '700' },
  memberTextSelected: { color: colors.greenDark },
  estimate: {
    backgroundColor: colors.greenPale,
    borderColor: colors.greenPale,
    gap: 5,
  },
  divider: { height: 1, backgroundColor: '#C8DDC9', marginVertical: 6 },
  estimateHint: { color: colors.muted, fontSize: 11, marginTop: 6 },
  pressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
});
