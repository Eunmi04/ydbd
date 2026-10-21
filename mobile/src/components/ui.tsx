import React from 'react';
import { router } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View, type KeyboardTypeOptions, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { colors, money, shortDate } from '../theme';
import { calculateReserveAmount } from '../services/creditPolicy';
import type { Room, User } from '../types';
import { SiteHeader } from './SiteHeader';

export function Page({ title, subtitle, children, footer, back = false, eyebrow, wide = false, hideHeading = false }: { title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode; back?: boolean; eyebrow?: string; wide?: boolean; hideHeading?: boolean }) {
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= 850;
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };
  return <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
    <StatusBar style="dark" />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
      <SiteHeader desktop={desktop} />
      <View style={[styles.pageInner, { maxWidth: wide ? 1200 : 780 }, desktop && styles.pageDesktop]}>
        {back ? <Pressable accessibilityRole="button" accessibilityLabel="뒤로 가기" onPress={goBack} style={styles.backLink}><Text style={styles.backLinkText}>‹  뒤로 가기</Text></Pressable> : null}
        {!hideHeading ? <>
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          <Text style={[styles.title, desktop && styles.desktopTitle]}>{title}<Text style={styles.titleDot}>.</Text></Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </> : null}
        <View style={[styles.body, hideHeading && { marginTop: 0 }]}>{children}</View>
        {footer && desktop ? <View style={styles.desktopFooter}>{footer}</View> : null}
        {desktop ? <View style={styles.siteFooter}><Text style={styles.footerBrand}>같이타요.</Text><Text style={styles.footerCopy}>같은 방향의 우리, 더 가벼운 이동.</Text></View> : null}
      </View>
    </ScrollView>
    {footer && !desktop ? <View style={styles.footer}>{footer}</View> : null}
  </SafeAreaView>;
}

export function AppButton({ label, onPress, variant = 'primary', disabled = false, style }: { label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'ghost' | 'orange'; disabled?: boolean; style?: StyleProp<ViewStyle> }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, styles[`button_${variant}`], disabled && styles.buttonDisabled, pressed && styles.pressed, style]}><Text style={[styles.buttonText, variant === 'secondary' && styles.buttonTextSecondary, variant === 'ghost' && styles.buttonTextGhost, variant === 'orange' && { color: colors.ink }]}>{label}</Text></Pressable>;
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Header({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{title}</Text>{action && onAction ? <Pressable onPress={onAction} style={({ pressed }) => pressed ? styles.pressed : null}><Text style={styles.sectionAction}>{action}  ›</Text></Pressable> : null}</View>;
}

export function Avatar({ user, size = 40 }: { user: User; size?: number }) {
  return <View style={[styles.avatar, { backgroundColor: user.color, width: size, height: size, borderRadius: size / 2 }]}><Text style={[styles.avatarText, { fontSize: size * 0.36 }]}>{user.nickname.slice(0, 1)}</Text></View>;
}

export function PointBadge({ amount, light = false }: { amount: number; light?: boolean }) {
  return <View style={[styles.pointBadge, light && styles.pointBadgeLight]}><Text style={[styles.pointBadgeText, light && styles.pointBadgeTextLight]}>● {money(amount)}P</Text></View>;
}

export function TextField({ label, value, onChangeText, placeholder, keyboardType, secureTextEntry, hint, multiline }: { label: string; value: string; onChangeText: (text: string) => void; placeholder: string; keyboardType?: KeyboardTypeOptions; secureTextEntry?: boolean; hint?: string; multiline?: boolean }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput style={[styles.input, multiline && styles.multiline]} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#9BA89C" keyboardType={keyboardType} secureTextEntry={secureTextEntry} multiline={multiline} autoCapitalize="none" />{hint ? <Text style={styles.hint}>{hint}</Text> : null}</View>;
}

export function RoomCard({ room, onPress }: { room: Room; onPress: () => void }) {
  const deposit = calculateReserveAmount(room.estimatedFare, room.maxMembers);
  const known = !room.dbStatus || room.memberCountKnown;
  return <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.card, styles.roomCard, pressed && styles.pressed]}>
    <View style={styles.roomTop}><View style={[styles.statusPill, room.status === 'confirmed' && styles.statusConfirmed, room.status === 'settled' && styles.statusSettled]}><Text style={styles.statusText}>{room.status === 'recruiting' ? '모집 중' : room.status === 'confirmed' ? '출발 확정' : room.status === 'settled' ? '정산 완료' : '진행 중'}</Text></View><Text style={styles.roomTime}>{shortDate(room.departureAt)}</Text></View>
    <Text style={styles.roomRoute}>{room.departure} <Text style={styles.roomArrow}>→</Text> {room.destination}</Text>
    <View style={styles.seats}>{Array.from({ length: room.maxMembers }, (_, index) => <View key={index} style={[styles.seat, known && index < room.members.length && styles.seatFilled]}><Text style={styles.seatFace}>{known && index < room.members.length ? '☺' : '·'}</Text></View>)}</View>
    <View style={styles.roomBottom}><Text style={styles.roomMeta}>함께 타는 사람 {room.dbStatus && !room.memberCountKnown ? '?' : room.members.length}/{room.maxMembers}</Text><Text style={styles.roomDeposit}>{money(deposit)}P {room.dbStatus ? '예치 예상' : '예치'}</Text></View>
  </Pressable>;
}

export function EmptyState({ title, message, action, onAction }: { title: string; message: string; action?: string; onAction?: () => void }) {
  return <Card style={styles.empty}><View style={styles.emptyIcon}><Text style={styles.emptyIconText}>⌕</Text></View><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyMessage}>{message}</Text>{action && onAction ? <AppButton label={action} onPress={onAction} variant="secondary" style={{ marginTop: 18 }} /> : null}</Card>;
}

export function ErrorNotice({ message }: { message: string }) {
  return <View style={styles.errorNotice}><Text style={styles.errorText}>{message}</Text></View>;
}

export function MapPreview({ departure, destination }: { departure: string; destination: string }) {
  return <View style={styles.map}><View style={styles.mapRoadOne} /><View style={styles.mapRoadTwo} /><View style={styles.mapPark} /><View style={[styles.mapPin, { left: '17%', top: '61%' }]}><Text style={styles.mapPinText}>A</Text></View><View style={[styles.mapPin, { right: '17%', top: '22%', backgroundColor: colors.orange }]}><Text style={styles.mapPinText}>B</Text></View><View style={styles.mapCaption}><Text style={styles.mapCaptionText}>{departure}  · · ·  {destination}</Text></View><View style={styles.mapLabel}><Text style={styles.mapLabelText}>경로 미리보기</Text></View></View>;
}

export function InfoRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <View style={styles.infoRow}><Text style={styles.infoLabel}>{label}</Text><Text style={[styles.infoValue, strong && styles.infoStrong]}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream }, pageContent: { flexGrow: 1, paddingBottom: 24 },
  pageInner: { width: '100%', alignSelf: 'center', paddingHorizontal: 22, paddingTop: 18 },
  pageDesktop: { paddingHorizontal: 28, paddingTop: 30 }, desktopTitle: { fontSize: 42, lineHeight: 52, letterSpacing: -2 },
  titleDot: { color: colors.lime },
  backLink: { alignSelf: 'flex-start', paddingVertical: 8, marginBottom: 16 }, backLinkText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  desktopFooter: { marginTop: 24, gap: 10 }, siteFooter: { marginTop: 65, paddingVertical: 25, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', justifyContent: 'space-between' },
  footerBrand: { color: colors.ink, fontSize: 15, fontWeight: '900' }, footerCopy: { color: colors.muted, fontSize: 12 },
  seats: { flexDirection: 'row', gap: 7, marginVertical: 4 }, seat: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: '#D6D4CB', alignItems: 'center', justifyContent: 'center' },
  seatFilled: { backgroundColor: colors.greenPale, borderColor: '#A4C58A', borderStyle: 'solid' }, seatFace: { fontSize: 23, color: colors.ink },
  topLine: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, marginBottom: 26 }, brandMark: { width: 30, height: 30, borderRadius: 10, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' }, brandMarkText: { color: 'white', fontSize: 20, fontWeight: '800', marginTop: -2 }, brandName: { color: colors.greenDark, fontSize: 18, fontWeight: '800', letterSpacing: -0.7 }, back: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.greenPale }, backText: { color: colors.greenDark, fontSize: 30, lineHeight: 31, marginTop: -4 },
  eyebrow: { color: colors.green, fontSize: 12, fontWeight: '800', letterSpacing: 1.8, marginBottom: 8 }, title: { color: colors.ink, fontSize: 29, fontWeight: '800', lineHeight: 38, letterSpacing: -1.3 }, subtitle: { color: colors.muted, fontSize: 14, lineHeight: 22, marginTop: 7 }, body: { marginTop: 26, gap: 16, flex: 1 },
  footer: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 18, backgroundColor: colors.cream, borderTopWidth: 1, borderTopColor: colors.border, gap: 9 },
  button: { minHeight: 50, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 }, button_primary: { backgroundColor: colors.ink }, button_secondary: { backgroundColor: colors.greenPale }, button_ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#5E605B' }, button_orange: { backgroundColor: colors.orange }, buttonDisabled: { opacity: 0.45 }, buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', letterSpacing: -0.3 }, buttonTextSecondary: { color: colors.greenDark }, buttonTextGhost: { color: colors.ink }, pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
  card: { backgroundColor: colors.paper, borderRadius: 18, padding: 22, borderWidth: 1, borderColor: colors.border },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 5, marginBottom: 2 }, sectionTitle: { color: colors.ink, fontSize: 19, fontWeight: '800', letterSpacing: -0.6 }, sectionAction: { color: colors.green, fontSize: 13, fontWeight: '700' },
  avatar: { alignItems: 'center', justifyContent: 'center' }, avatarText: { color: colors.ink, fontWeight: '800' }, pointBadge: { backgroundColor: colors.greenPale, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 100, alignSelf: 'flex-start' }, pointBadgeLight: { backgroundColor: 'rgba(255,255,255,0.18)' }, pointBadgeText: { color: colors.greenDark, fontSize: 13, fontWeight: '800' }, pointBadgeTextLight: { color: '#FFFFFF' },
  field: { gap: 8 }, fieldLabel: { color: colors.ink, fontSize: 14, fontWeight: '800' }, input: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, minHeight: 54, borderRadius: 16, paddingHorizontal: 16, color: colors.ink, fontSize: 16 }, multiline: { minHeight: 100, textAlignVertical: 'top', paddingTop: 15 }, hint: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  roomCard: { gap: 15 }, roomTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, statusPill: { backgroundColor: colors.greenPale, borderRadius: 100, paddingHorizontal: 10, paddingVertical: 6 }, statusConfirmed: { backgroundColor: colors.orangePale }, statusSettled: { backgroundColor: '#ECEFEA' }, statusText: { color: colors.greenDark, fontSize: 11, fontWeight: '800' }, roomTime: { color: colors.muted, fontSize: 12, fontWeight: '600' }, roomRoute: { color: colors.ink, fontSize: 19, fontWeight: '800', letterSpacing: -0.8 }, roomArrow: { color: colors.orange }, roomBottom: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, alignItems: 'center' }, roomMeta: { color: colors.muted, fontSize: 12 }, roomDeposit: { color: colors.green, fontSize: 13, fontWeight: '800' },
  empty: { alignItems: 'center', paddingVertical: 33, paddingHorizontal: 26 }, emptyIcon: { width: 58, height: 58, borderRadius: 20, backgroundColor: colors.greenPale, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }, emptyIconText: { color: colors.green, fontSize: 36 }, emptyTitle: { color: colors.ink, fontSize: 18, fontWeight: '800' }, emptyMessage: { color: colors.muted, fontSize: 13, textAlign: 'center', lineHeight: 21, marginTop: 8 },
  errorNotice: { backgroundColor: '#FCEAE7', borderRadius: 14, padding: 14 }, errorText: { color: colors.danger, fontSize: 13, lineHeight: 20, fontWeight: '700' },
  map: { height: 188, backgroundColor: '#E9EFE5', borderRadius: 20, overflow: 'hidden', position: 'relative' }, mapRoadOne: { position: 'absolute', width: '125%', height: 28, backgroundColor: '#FCFAF0', top: '44%', left: '-10%', transform: [{ rotate: '-24deg' }] }, mapRoadTwo: { position: 'absolute', width: '110%', height: 20, backgroundColor: '#FCFAF0', top: '42%', left: '-5%', transform: [{ rotate: '31deg' }] }, mapPark: { position: 'absolute', width: 95, height: 95, borderRadius: 35, backgroundColor: '#D2E3C6', right: 4, bottom: -24 }, mapPin: { position: 'absolute', width: 30, height: 30, borderRadius: 15, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'white' }, mapPinText: { color: 'white', fontSize: 12, fontWeight: '800' }, mapCaption: { position: 'absolute', bottom: 12, left: 12, right: 12, borderRadius: 11, backgroundColor: colors.paper, padding: 10 }, mapCaptionText: { color: colors.ink, fontSize: 12, fontWeight: '700', textAlign: 'center' }, mapLabel: { position: 'absolute', left: 12, top: 12, backgroundColor: colors.paper, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 10 }, mapLabelText: { color: colors.green, fontSize: 11, fontWeight: '800' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 33, gap: 12 }, infoLabel: { color: colors.muted, fontSize: 14 }, infoValue: { color: colors.ink, fontSize: 14, fontWeight: '700', textAlign: 'right', flexShrink: 1 }, infoStrong: { color: colors.green, fontSize: 18, fontWeight: '800' },
});
