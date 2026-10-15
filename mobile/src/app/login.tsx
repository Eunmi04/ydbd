import { useState } from 'react';
import { router } from 'expo-router';
import { Text } from 'react-native';
import { AppButton, ErrorNotice, Page, TextField } from '../components/ui';
import { useAuth } from '../auth/AuthContext';
import { AUTH_UNAVAILABLE } from '../auth/client';

export default function Login() {
  const { login, configured, previewAvailable, startPreview } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async () => {
    if (busy) return;
    if (!email.trim() || !password) { setError('이메일과 비밀번호를 입력해 주세요.'); return; }
    setBusy(true); setError('');
    try { await login(email, password); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '로그인에 실패했습니다.'); }
    finally { setPassword(''); setBusy(false); }
  };
  return <Page eyebrow="WELCOME" title={'같은 방향이면,\n같이 타요'} subtitle="중부대학교 학생을 위한 택시 동승 서비스" footer={<>
    <AppButton label={busy ? '로그인 중…' : '로그인'} disabled={busy || !configured} onPress={() => void submit()} />
    <AppButton label="처음이신가요? 회원가입" onPress={() => router.push('/signup')} variant="ghost" />
    {previewAvailable && <AppButton label="개발용 둘러보기" onPress={startPreview} variant="secondary" />}
  </>}>
    {!configured && <Text>{AUTH_UNAVAILABLE}</Text>}
    {previewAvailable && <Text>개발용 둘러보기로 시연 계정의 방·지갑·정산 화면을 확인할 수 있어요. 실제 회원가입이나 학교 인증은 진행되지 않습니다.</Text>}
    <TextField label="학교 이메일" value={email} onChangeText={setEmail} placeholder="학교 계정@jmail.ac.kr" keyboardType="email-address" />
    <TextField label="비밀번호" value={password} onChangeText={setPassword} placeholder="비밀번호" secureTextEntry />
    {error ? <ErrorNotice message={error} /> : null}
  </Page>;
}
