import { useState } from 'react';
import { router } from 'expo-router';
import { AppButton, ErrorNotice, Page, TextField } from '../components/ui';
import { useApp } from '../state/AppContext';

export default function Signup() {
  const { register } = useApp();
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const submit = () => { try { register(nickname, email, password); router.replace('/(tabs)'); } catch (cause) { setError(cause instanceof Error ? cause.message : '회원가입에 실패했습니다.'); } };
  return <Page back eyebrow="JOIN US" title="함께할 준비가 됐나요?" subtitle="몇 가지만 입력하면 바로 시작할 수 있어요." footer={<AppButton label="회원가입 완료" onPress={submit} />}>
    <TextField label="닉네임" value={nickname} onChangeText={setNickname} placeholder="어떻게 불러드릴까요?" />
    <TextField label="이메일" value={email} onChangeText={setEmail} placeholder="이메일 주소" keyboardType="email-address" />
    <TextField label="비밀번호" value={password} onChangeText={setPassword} placeholder="4자 이상 입력해 주세요" secureTextEntry />
    {error ? <ErrorNotice message={error} /> : null}
  </Page>;
}
