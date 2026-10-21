export const colors = {
  cream: '#F7F4EC',
  paper: '#FFFEFA',
  green: '#315D21',
  greenDark: '#243F19',
  greenPale: '#E8F6D8',
  lime: '#85E648',
  orange: '#B8ED83',
  orangePale: '#EFF3E5',
  ink: '#171816',
  muted: '#777973',
  border: '#E6E3DA',
  danger: '#B84D43',
  shadow: '#37372D',
};

export const money = (value: number) => Math.round(value).toLocaleString('ko-KR');

export const shortDate = (iso: string) => {
  const date = new Date(iso);
  return `${date.getMonth() + 1}월 ${date.getDate()}일 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};
