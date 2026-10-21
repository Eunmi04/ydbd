import { useRef, useState } from 'react';
import { router } from 'expo-router';
import { AppButton, ErrorNotice, Page, TextField } from '../components/ui';
import { useApp } from '../state/AppContext';
import { authErrorMessage, authSetupMessage, validateSignup } from '../services/authService';

export default function Signup() {
  const { register, mode, mockAuthEnabled } = useApp();
  const configured = mode === 'supabase' || mockAuthEnabled;
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const submit = async () => {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true); setError(''); setNotice('');
    try {
      validateSignup(nickname, email, password, confirmation);
      const signedIn = await register(nickname, email, password);
      setPassword(''); setConfirmation('');
      if (signedIn && mode === 'mock') router.replace('/(tabs)');
      else if (!signedIn) setNotice('가입 요청을 접수했습니다. 현재 프로젝트는 이메일 확인이 필요합니다. 확인 메일을 확인한 뒤 로그인해 주세요. 이메일 확인 없는 시연은 관리자가 Confirm email 설정을 꺼야 합니다.');
    } catch (cause) { setError(authErrorMessage(cause)); }
    finally { submitting.current = false; setBusy(false); }
  };
  return <Page back eyebrow="JOIN US" title="함께할 준비가 됐나요?" subtitle="몇 가지만 입력하면 바로 시작할 수 있어요." footer={<><AppButton label={busy ? '가입 처리 중…' : '회원가입 완료'} onPress={submit} disabled={busy || !configured || Boolean(notice)} /><AppButton label="로그인 화면으로" onPress={() => router.replace('/login')} disabled={busy} variant="ghost" /></>}>
    <TextField label="닉네임" value={nickname} onChangeText={setNickname} placeholder="어떻게 불러드릴까요?" />
    <TextField label="이메일" value={email} onChangeText={setEmail} placeholder="이메일 주소" keyboardType="email-address" />
    <TextField label="비밀번호" value={password} onChangeText={setPassword} placeholder="6자 이상 입력해 주세요" secureTextEntry />
    <TextField label="비밀번호 확인" value={confirmation} onChangeText={setConfirmation} placeholder="비밀번호를 다시 입력해 주세요" secureTextEntry />
    {!configured ? <ErrorNotice message={authSetupMessage} /> : null}
    {notice ? <ErrorNotice message={notice} /> : null}
    {error ? <ErrorNotice message={error} /> : null}
  </Page>;
}
