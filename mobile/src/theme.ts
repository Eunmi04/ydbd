export const colors = {
  cream: '#F8F5EB',
  paper: '#FFFEFA',
  green: '#28734F',
  greenDark: '#18573B',
  greenPale: '#E8F3E7',
  orange: '#F4A340',
  orangePale: '#FFF0D9',
  ink: '#1E3328',
  muted: '#738277',
  border: '#E2E8DC',
  danger: '#B84D43',
  shadow: '#254934',
};

export const money = (value: number) => Math.round(value).toLocaleString('ko-KR');

export const shortDate = (iso: string) => {
  const date = new Date(iso);
  return `${date.getMonth() + 1}월 ${date.getDate()}일 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};
