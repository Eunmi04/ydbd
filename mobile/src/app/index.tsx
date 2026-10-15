import { Redirect } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';

export default function Entry() {
  const { access, preview } = useAuth();
  if (preview) return <Redirect href="/(tabs)" />;
  if (access === 'loading') return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator /><Text>로그인 상태를 확인하고 있어요.</Text></View>;
  if (access === 'guest') return <Redirect href="/login" />;
  if (access === 'unverified') return <Redirect href="/verify-school" />;
  if (access === 'suspended' || access === 'error') return <Redirect href="/account-status" />;
  return <Redirect href="/(tabs)" />;
}
