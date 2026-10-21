import React from 'react';
import { Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useApp } from '../state/AppContext';
import { colors } from '../theme';
import { AppButton, ErrorNotice, Page } from '../components/ui';
import { authErrorMessage } from '../services/authService';

function ProfileRecovery() {
  const { profileError, retryProfile, logout } = useApp();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const signOut = async () => {
    if (busy) return;
    setBusy(true);
    try { await logout(); } catch (cause) { setError(authErrorMessage(cause)); }
    finally { setBusy(false); }
  };
  return <Page title={profileError ? '프로필 확인이 필요해요' : '내 정보를 불러오는 중…'} subtitle="로그인한 계정의 프로필을 확인하고 있습니다.">
    {profileError ? <><ErrorNotice message={profileError} /><AppButton label="프로필 다시 불러오기" onPress={retryProfile} disabled={busy} /></> : <ActivityIndicator color={colors.green} />}
    {error ? <ErrorNotice message={error} /> : null}
    <AppButton label={busy ? '로그아웃 중…' : '로그아웃하고 로그인 화면으로'} onPress={signOut} disabled={busy} variant="ghost" />
  </Page>;
}

function Navigation() {
  const { isAuthenticated, isLoading, mode, user } = useApp();
  if (isLoading) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator color={colors.green} /></View>;
  if (mode === 'supabase' && isAuthenticated && !user) return <ProfileRecovery />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.cream }, animation: 'slide_from_right' }}>
    <Stack.Screen name="index" />
    <Stack.Protected guard={!isAuthenticated}>
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
    </Stack.Protected>
    <Stack.Protected guard={isAuthenticated}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="room/new" />
      <Stack.Screen name="room/[id]" />
      <Stack.Screen name="ride/[id]/boarding" />
      <Stack.Screen name="ride/[id]/settlement" />
      <Stack.Screen name="result/[id]" />
    </Stack.Protected>
  </Stack>;
}

export default function RootLayout() {
  return <SafeAreaProvider><AppProvider><Navigation /></AppProvider></SafeAreaProvider>;
}
