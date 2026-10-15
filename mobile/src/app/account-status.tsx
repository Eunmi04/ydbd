import { useState } from 'react';
import { Text } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { suspensionMessage } from '../auth/policy';
import { AppButton, ErrorNotice, Page } from '../components/ui';

export default function AccountStatus() {
  const { state, access, refresh, logout } = useAuth();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const perform = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setError('');
    try { await action(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '요청에 실패했습니다.'); }
    finally { setBusy(false); }
  };
  return <Page title={access === 'suspended' ? '서비스 이용이 중지되었습니다' : '회원 상태를 확인하지 못했습니다'}>
    <Text>{access === 'suspended' ? suspensionMessage(state.user?.suspendedUntil ?? null) : '연결 상태를 확인한 뒤 다시 시도해 주세요. 확인 전에는 서비스를 이용할 수 없습니다.'}</Text>
    <AppButton label="상태 다시 확인" disabled={busy} onPress={() => void perform(refresh)} />
    <AppButton label="로그아웃" variant="ghost" disabled={busy} onPress={() => void perform(logout)} />
    {error ? <ErrorNotice message={error} /> : null}
  </Page>;
}
