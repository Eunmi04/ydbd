import { useEffect } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../theme';

export default function Splash() {
  useEffect(() => { const timeout = setTimeout(() => router.replace('/login'), 1300); return () => clearTimeout(timeout); }, []);
  return <SafeAreaView style={styles.page}><StatusBar style="dark" /><View style={styles.center}><View style={styles.logo}><Text style={styles.logoText}>↗</Text></View><Text style={styles.name}>같이타요</Text><Text style={styles.tagline}>같은 방향이면, 같이 타요</Text><ActivityIndicator color={colors.orange} style={{ marginTop: 30 }} /></View><Text style={styles.caption}>함께 가는 길이 더 가벼워지도록</Text></SafeAreaView>;
}

const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' }, center: { alignItems: 'center', marginTop: -45 }, logo: { width: 88, height: 88, backgroundColor: colors.green, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 24 }, logoText: { color: 'white', fontSize: 59, fontWeight: '800', marginTop: -8 }, name: { color: colors.greenDark, fontSize: 38, fontWeight: '900', letterSpacing: -2 }, tagline: { color: colors.ink, fontSize: 17, fontWeight: '700', marginTop: 12 }, caption: { color: colors.muted, position: 'absolute', bottom: 38, fontSize: 13 } });
