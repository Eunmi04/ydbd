import { useState } from 'react';
import { Text } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { AppButton, Card, ErrorNotice, Page, TextField } from '../components/ui';

export default function VerifySchool() {
  const { state, sendCode, verifyCode, logout, configured } = useAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const perform = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try { await action(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '요청에 실패했습니다.'); }
    finally { setBusy(false); }
  };
  return <Page eyebrow="SCHOOL VERIFICATION" title="학교 이메일을 인증해 주세요" subtitle="중부대학교 학생 인증 후 서비스를 이용할 수 있습니다.">
    <Card><Text>중부대학교 · @jmail.ac.kr</Text><Text>{state.user?.email}</Text><Text>인증 대기</Text></Card>
    <AppButton label="인증 메일 보내기 / 다시 보내기" disabled={busy || !configured} onPress={() => void perform(async () => { await sendCode(); setNotice('인증 메일을 보냈습니다. 메일의 숫자 코드를 입력해 주세요.'); })} />
    <TextField label="인증 코드" value={code} onChangeText={setCode} placeholder="메일의 숫자 코드" keyboardType="number-pad" />
    <AppButton label="인증 확인" disabled={busy || !configured || !code.trim()} onPress={() => void perform(async () => { try { await verifyCode(code); } finally { setCode(''); } })} />
    {notice ? <Text>{notice}</Text> : null}
    {error ? <ErrorNotice message={error} /> : null}
    <AppButton label="로그아웃" variant="ghost" disabled={busy} onPress={() => void perform(logout)} />
  </Page>;
}
