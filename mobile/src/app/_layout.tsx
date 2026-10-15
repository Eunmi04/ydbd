import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider } from '../state/AppContext';
import { AuthProvider, useAuth } from '../auth/AuthContext';
import { colors } from '../theme';

function Routes() {
  const { access, preview, logout } = useAuth();
  return <View style={{ flex: 1 }}>
    {preview && <View style={{ padding: 12, backgroundColor: colors.greenPale, flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
      <Text style={{ flex: 1 }}>개발용 시연 · 실제 로그인/학교 인증 아님</Text>
      <Pressable accessibilityRole="button" onPress={() => void logout()}><Text>둘러보기 종료</Text></Pressable>
    </View>}
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.cream }, animation: 'slide_from_right' }}>
    <Stack.Screen name="index" />
    <Stack.Protected guard={access === 'guest' && !preview}>
      <Stack.Screen name="login" /><Stack.Screen name="signup" />
    </Stack.Protected>
    <Stack.Protected guard={access === 'unverified'}><Stack.Screen name="verify-school" /></Stack.Protected>
    <Stack.Protected guard={access === 'suspended' || access === 'error'}><Stack.Screen name="account-status" /></Stack.Protected>
    <Stack.Protected guard={access === 'allowed' || preview}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="room/new" /><Stack.Screen name="room/[id]" />
      <Stack.Screen name="ride/[id]/boarding" /><Stack.Screen name="ride/[id]/settlement" />
      <Stack.Screen name="result/[id]" />
    </Stack.Protected>
  </Stack></View>;
}
export default function RootLayout() {
  return <SafeAreaProvider><AuthProvider><AppProvider><Routes /></AppProvider></AuthProvider></SafeAreaProvider>;
}
