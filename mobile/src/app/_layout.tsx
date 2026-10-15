import React from 'react';
import { Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useApp } from '../state/AppContext';
import { colors } from '../theme';

function Navigation() {
  const { isAuthenticated, isLoading } = useApp();
  if (isLoading) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator color={colors.green} /></View>;
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
