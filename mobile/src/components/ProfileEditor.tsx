import { useRef, useState } from 'react';
import { Text } from 'react-native';
import { AppButton, Card, ErrorNotice, TextField } from './ui';
import { serviceErrorMessage } from '../services/profileService';
import { colors } from '../theme';

export function ProfileEditor({
  nickname,
  school,
  onSave,
}: {
  nickname: string
  school: string
  onSave: (nickname: string, school: string) => Promise<void>
}) {
  const [name, setName] = useState(nickname)
  const [schoolName, setSchoolName] = useState(school)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const saving = useRef(false)
  const submit = async () => {
    if (saving.current) return
    saving.current = true
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await onSave(name, schoolName)
      setNotice('회원 정보를 저장했습니다.')
    } catch (cause) {
      setError(serviceErrorMessage(cause))
    } finally {
      saving.current = false
      setBusy(false)
    }
  }
  return (
    <Card style={{ gap: 18 }}>
      <TextField
        label="닉네임"
        value={name}
        onChangeText={(value) => {
          setName(value)
          setNotice('')
        }}
        placeholder="1~40자"
      />
      <TextField
        label="학교명"
        value={schoolName}
        onChangeText={(value) => {
          setSchoolName(value)
          setNotice('')
        }}
        placeholder="학교명 (선택)"
      />
      {error ? <ErrorNotice message={error} /> : null}
      {notice ? (
        <Text accessibilityRole="alert" style={{ color: colors.green, marginVertical: 12 }}>
          {notice}
        </Text>
      ) : null}
      <AppButton
        label={busy ? '저장 중…' : '내 정보 저장'}
        onPress={submit}
        disabled={busy}
      />
    </Card>
  )
}

