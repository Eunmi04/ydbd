import { Text, StyleSheet } from 'react-native';
import { Card, InfoRow, Page } from '../components/ui';
import { ProfileEditor } from '../components/ProfileEditor';
import { RideInviteSettings } from '../components/RideInviteSettings';
import { useApp } from '../state/AppContext';
import { verificationLabel } from '../services/profileService';
import { colors } from '../theme';

export default function Settings() {
  const { user, profile, updateProfile, mode } = useApp();
  return <Page back eyebrow="ACCOUNT SETTINGS" title="회원 설정" subtitle="함께 타는 사람들에게 보여줄 내 정보를 관리해요.">
    <Card><Text style={styles.heading}>계정 정보</Text>
      <InfoRow label="이메일" value={user?.email ?? ''} />
      <InfoRow label="인증 상태" value={mode === 'mock' ? '로컬 시연 계정' : verificationLabel(profile)} />
      <Text style={styles.note}>이메일과 인증 상태는 이 화면에서 변경할 수 없어요.</Text>
    </Card>
    {user ? <ProfileEditor key={user.id} nickname={profile?.nickname ?? user.nickname}
      school={profile?.school_name ?? ''} onSave={updateProfile} /> : null}
    {mode === 'supabase' && user ? <RideInviteSettings key={user.id} userId={user.id} /> : null}
  </Page>;
}
const styles = StyleSheet.create({ heading: { color: colors.ink, fontSize: 18, fontWeight: '800', marginBottom: 14 },
  note: { color: colors.muted, fontSize: 12, lineHeight: 19, marginTop: 14 } });
