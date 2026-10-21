import { useRef, useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton, Card, ErrorNotice, Page, TextField } from '../components/ui';
import { useApp } from '../state/AppContext';
import { testAccount } from '../services/mockService';
import { colors } from '../theme';
import { authErrorMessage, authSetupMessage } from '../services/authService';

export default function Login() {
  const { login, mode, mockAuthEnabled } = useApp();
  const demo = mode === 'mock' && mockAuthEnabled;
  const configured = mode === 'supabase' || demo;
  const [email, setEmail] = useState(demo ? testAccount.email : '');
  const [password, setPassword] = useState(demo ? testAccount.password : '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const submit = async () => {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true); setError('');
    try { await login(email, password); if (demo) router.replace('/(tabs)'); }
    catch (cause) { setError(authErrorMessage(cause)); }
    finally { submitting.current = false; setBusy(false); }
  };
  return <Page eyebrow="WELCOME" title={'같은 방향이면,\n같이 타요'} subtitle="동승부터 포인트 정산까지 한 번에." footer={<><AppButton label={busy ? '로그인 중…' : '로그인'} onPress={submit} disabled={busy || !configured} /><AppButton label="처음이신가요? 회원가입" onPress={() => router.push('/signup')} disabled={busy} variant="ghost" /></>}>
    <Card style={styles.intro}><Text style={styles.introIcon}>↗</Text><View style={{ flex: 1 }}><Text style={styles.introTitle}>가볍게 함께 가는 길</Text><Text style={styles.introText}>방을 찾고, 예치하고, 정산까지 깔끔하게.</Text></View></Card>
    <TextField label="이메일" value={email} onChangeText={setEmail} placeholder="이메일을 입력해 주세요" keyboardType="email-address" />
    <TextField label="비밀번호" value={password} onChangeText={setPassword} placeholder="비밀번호를 입력해 주세요" secureTextEntry />
    {error ? <ErrorNotice message={error} /> : null}
    {!configured ? <ErrorNotice message={authSetupMessage} /> : null}
    <Text style={styles.demo}>{demo ? `로컬 시연 계정  ${testAccount.email} / ${testAccount.password}` : configured ? 'Supabase 계정으로 로그인합니다.' : '실제 계정 로그인을 위한 설정을 기다리고 있습니다.'}</Text>
  </Page>;
}

const styles = StyleSheet.create({ intro: { backgroundColor: colors.greenPale, borderColor: colors.greenPale, flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 4 }, introIcon: { color: colors.green, fontSize: 30, fontWeight: '800' }, introTitle: { color: colors.greenDark, fontSize: 16, fontWeight: '800' }, introText: { color: colors.greenDark, fontSize: 12, marginTop: 5, lineHeight: 18 }, demo: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 8 } });
