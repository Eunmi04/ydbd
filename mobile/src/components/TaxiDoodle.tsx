import { Image, StyleSheet, View } from 'react-native';

export function TaxiDoodle({ compact = false }: { compact?: boolean }) {
  return <View style={compact ? styles.compact : styles.wrapper}>
    <Image source={require('../../assets/images/taxi-doodle.png')} resizeMode="contain"
      accessibilityLabel="함께 택시를 타는 두 친구의 검정 손그림" style={styles.image} />
  </View>;
}
const styles = StyleSheet.create({ wrapper: { width: '100%', aspectRatio: 1.9 },
  compact: { width: '100%', height: 150 }, image: { width: '100%', height: '100%' } });
