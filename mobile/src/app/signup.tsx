import { useState } from 'react';
import { Text } from 'react-native';
import { AppButton, ErrorNotice, Page, TextField } from '../components/ui';
import { useAuth } from '../auth/AuthContext';
import { AUTH_UNAVAILABLE } from '../auth/client';
import { validateSignup } from '../auth/policy';

export default function Signup() {
  const { register, configured } = useAuth();
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async () => {
    if (busy) return;
    const input = { nickname, email, phone, password };
    const invalid = validateSignup(input);
    if (invalid) { setError(invalid); return; }
    if (password !== confirmation) { setError('비밀번호가 일치하지 않습니다.'); return; }
    setBusy(true); setError('');
    try { await register(input); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '회원가입에 실패했습니다.'); }
    finally { setPassword(''); setConfirmation(''); setBusy(false); }
  };
  return <Page back eyebrow="JOIN US" title="함께할 준비가 됐나요?" subtitle="모든 항목은 필수입니다. 가입 후 학교 이메일 인증이 필요합니다." footer={<AppButton label={busy ? '가입 중…' : '회원가입'} disabled={busy || !configured} onPress={() => void submit()} />}>
    {!configured && <Text>{AUTH_UNAVAILABLE}</Text>}
    <TextField label="닉네임" value={nickname} onChangeText={setNickname} placeholder="닉네임" />
    <TextField label="중부대학교 이메일" value={email} onChangeText={setEmail} placeholder="학교 계정@jmail.ac.kr" keyboardType="email-address" />
    <TextField label="전화번호" value={phone} onChangeText={setPhone} placeholder="전화번호" keyboardType="phone-pad" />
    <Text>전화번호 입력만으로 휴대전화 본인 인증이 완료되지는 않습니다.</Text>
    <TextField label="비밀번호" value={password} onChangeText={setPassword} placeholder="비밀번호" secureTextEntry />
    <TextField label="비밀번호 확인" value={confirmation} onChangeText={setConfirmation} placeholder="비밀번호 다시 입력" secureTextEntry />
    {error ? <ErrorNotice message={error} /> : null}
  </Page>;
}
