import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppButton, Avatar, Card, ErrorNotice, Header, Page, TextField } from '../../components/ui';
import { useApp } from '../../state/AppContext';
import { colors, money, shortDate } from '../../theme';
import { authErrorMessage } from '../../services/authService';
import { serviceErrorMessage, verificationLabel } from '../../services/profileService';

function ProfileEditor({ nickname, school, onSave }: { nickname: string; school: string; onSave: (nickname: string, school: string) => Promise<void> }) {
  const [name, setName] = useState(nickname);
  const [schoolName, setSchoolName] = useState(school);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const saving = useRef(false);
  const submit = async () => {
    if (saving.current) return;
    saving.current = true; setBusy(true); setError(''); setNotice('');
    try { await onSave(name, schoolName); setNotice('회원 정보를 저장했습니다.'); }
    catch (cause) { setError(serviceErrorMessage(cause)); }
    finally { saving.current = false; setBusy(false); }
  };
  return <Card>
    <TextField label="닉네임" value={name} onChangeText={(value) => { setName(value); setNotice(''); }} placeholder="1~40자" />
    <TextField label="학교명" value={schoolName} onChangeText={(value) => { setSchoolName(value); setNotice(''); }} placeholder="학교명 (선택)" />
    {error ? <ErrorNotice message={error} /> : null}
    {notice ? <Text accessibilityRole="alert" style={styles.email}>{notice}</Text> : null}
    <AppButton label={busy ? '저장 중…' : '내 정보 저장'} onPress={submit} disabled={busy} />
  </Card>;
}

export default function MyPage() {
  const { data, user, logout, mode, profile, updateProfile } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const settlements = data.settlements.filter((item) => item.userId === user?.id);
  const signOut = async () => {
    if (submitting.current) return;
    submitting.current = true; setBusy(true); setError('');
    try { await logout(); if (mode === 'mock') router.replace('/login'); }
    catch (cause) { setError(authErrorMessage(cause)); }
    finally { submitting.current = false; setBusy(false); }
  };
  return <Page eyebrow="MY PAGE" title="마이페이지" subtitle="함께한 이동을 한눈에 확인해요.">
    {user ? <Card style={styles.profile}><Avatar user={user} size={58} /><View style={{ flex: 1 }}><Text style={styles.name}>{user.nickname}</Text><Text style={styles.email}>{user.email}</Text></View></Card> : null}
    <Text style={styles.email}>{mode === 'mock' ? '로컬 시연 계정 · 본인 인증 미완료' : verificationLabel(profile)}</Text>
    {mode === 'supabase' && user ? <>
      <Header title="내 정보 수정" />
      <Text style={styles.email}>이메일과 인증 상태는 조회만 가능합니다.</Text>
      <ProfileEditor key={user.id} nickname={profile?.nickname ?? user.nickname} school={profile?.school_name ?? ''} onSave={updateProfile} />
    </> : null}
    {profile && profile.account_status !== 'ACTIVE' ? <ErrorNotice message="이용이 제한된 계정입니다. 관리자에게 문의해 주세요." /> : null}
    <View style={styles.stats}><Card style={styles.statCard}><Text style={styles.statLabel}>누적 이용</Text><Text style={styles.statNumber}>{settlements.length}<Text style={styles.statUnit}> 회</Text></Text></Card><Card style={styles.statCard}><Text style={styles.statLabel}>절약한 이동</Text><Text style={styles.statNumber}>{settlements.length}<Text style={styles.statUnit}> 번</Text></Text></Card></View>
    <Header title="이용 내역" />
    <Card style={{ paddingVertical: 3 }}>{settlements.map((item, index) => <View key={item.id} style={[styles.history, index < settlements.length - 1 && styles.border]}><View><Text style={styles.historyTitle}>함께 탄 택시 · 정산 완료</Text><Text style={styles.historyDate}>{shortDate(item.createdAt)} · {item.riderCount}명 탑승</Text></View><Text style={styles.historyAmount}>{money(item.share)}P</Text></View>)}</Card>
    <Header title="설정" />
    <Card style={{ paddingVertical: 5 }}><Pressable onPress={() => Alert.alert('알림 설정', '시연용 앱에서 알림 기능을 준비 중입니다.')} style={({ pressed }) => [styles.menu, pressed && { opacity: 0.6 }]}><Text style={styles.menuText}>알림 설정</Text><Text style={styles.chevron}>›</Text></Pressable><Pressable onPress={() => Alert.alert('서비스 안내', '같은 방향이면, 같이 타요. 동승과 정산을 간편하게 돕는 서비스입니다.')} style={({ pressed }) => [styles.menu, pressed && { opacity: 0.6 }]}><Text style={styles.menuText}>서비스 안내</Text><Text style={styles.chevron}>›</Text></Pressable></Card>
    {error ? <ErrorNotice message={error} /> : null}
    <AppButton label={busy ? '로그아웃 중…' : '로그아웃'} variant="ghost" onPress={signOut} disabled={busy} />
  </Page>;
}

const styles = StyleSheet.create({ profile: { flexDirection: 'row', alignItems: 'center', gap: 15 }, name: { color: colors.ink, fontSize: 20, fontWeight: '800' }, email: { color: colors.muted, fontSize: 12, marginTop: 4 }, stats: { flexDirection: 'row', gap: 10 }, statCard: { flex: 1 }, statLabel: { color: colors.muted, fontSize: 12 }, statNumber: { color: colors.green, fontSize: 28, fontWeight: '900', marginTop: 5 }, statUnit: { fontSize: 14 }, history: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, paddingVertical: 16 }, border: { borderBottomWidth: 1, borderBottomColor: colors.border }, historyTitle: { color: colors.ink, fontSize: 13, fontWeight: '700' }, historyDate: { color: colors.muted, fontSize: 10, marginTop: 4 }, historyAmount: { color: colors.green, fontWeight: '800', fontSize: 13 }, menu: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15 }, menuText: { color: colors.ink, fontSize: 14, fontWeight: '700' }, chevron: { color: colors.muted, fontSize: 24 } });
