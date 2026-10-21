import { Redirect } from 'expo-router';
import { useApp } from '../state/AppContext';

export default function Entry() {
  const { isAuthenticated } = useApp();
  return <Redirect href={isAuthenticated ? '/(tabs)' : '/login'} />;
}
