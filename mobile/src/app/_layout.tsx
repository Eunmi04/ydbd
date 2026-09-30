import React from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider } from '../state/AppContext';
import { colors } from '../theme';

export default function RootLayout() {
  return <SafeAreaProvider><AppProvider><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.cream }, animation: 'slide_from_right' }} /></AppProvider></SafeAreaProvider>;
}
