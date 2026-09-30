import { Tabs } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { colors } from '../../theme';

const tabIcon = (glyph: string, focused: boolean) => <Text style={[styles.icon, focused && styles.iconActive]}>{glyph}</Text>;

export default function TabLayout() {
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.greenDark, tabBarInactiveTintColor: colors.muted, tabBarStyle: styles.bar, tabBarLabelStyle: styles.label }}>
    <Tabs.Screen name="index" options={{ title: '홈', tabBarIcon: ({ focused }) => tabIcon('⌂', focused) }} />
    <Tabs.Screen name="rooms" options={{ title: '방 찾기', tabBarIcon: ({ focused }) => tabIcon('⌕', focused) }} />
    <Tabs.Screen name="wallet" options={{ title: '지갑', tabBarIcon: ({ focused }) => tabIcon('◉', focused) }} />
    <Tabs.Screen name="my" options={{ title: '마이', tabBarIcon: ({ focused }) => tabIcon('♙', focused) }} />
  </Tabs>;
}

const styles = StyleSheet.create({ bar: { backgroundColor: colors.paper, borderTopColor: colors.border, height: 64, paddingTop: 6, paddingBottom: 7 }, label: { fontSize: 11, fontWeight: '700' }, icon: { fontSize: 23, color: colors.muted, height: 27 }, iconActive: { color: colors.green, fontWeight: '800' } });
