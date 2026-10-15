import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

declare global {
  interface Window {
    kakao?: any;
  }
}

type KakaoMapProps = { departure: string; destination: string };

export default function KakaoMap({ departure, destination }: KakaoMapProps) {
  const mapElement = useRef<HTMLDivElement | null>(null);
  const [message, setMessage] = useState('카카오맵을 불러오는 중...');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let map: any;
    const markers: any[] = [];
    const loadMap = async () => {
      const key = process.env.EXPO_PUBLIC_KAKAO_MAP_KEY;
      if (!key) {
        setMessage('카카오맵 키를 찾을 수 없어요. .env 파일을 확인해 주세요.');
        return;
      }

      try {
        if (!window.kakao?.maps?.services) {
          await new Promise<void>((resolve, reject) => {
            const existing = document.querySelector<HTMLScriptElement>('script[data-kakao-map-sdk]');
            if (existing && window.kakao?.maps) { resolve(); return; }
            const script = existing ?? document.createElement('script');
            script.addEventListener('load', () => resolve(), { once: true });
            script.addEventListener('error', () => reject(new Error('SDK load failed')), { once: true });
            if (!existing) {
              script.dataset.kakaoMapSdk = 'true';
              script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&autoload=false&libraries=services`;
              document.head.appendChild(script);
            }
          });
        }

        window.kakao.maps.load(() => {
          if (cancelled || !mapElement.current) return;
          const kakao = window.kakao;
          map = new kakao.maps.Map(mapElement.current, {
            center: new kakao.maps.LatLng(37.5665, 126.978), level: 7,
          });
          const places = new kakao.maps.services.Places();
          const bounds = new kakao.maps.LatLngBounds();
          const searches = [
            { keyword: departure.trim(), label: '출발지' },
            { keyword: destination.trim(), label: '도착지' },
          ].filter((item) => item.keyword.length > 0);

          if (searches.length === 0) {
            setMessage('출발지와 목적지를 입력하면 지도에 표시할게요.');
            setReady(true);
            return;
          }

          let completed = 0;
          let found = 0;
          const finishSearch = () => {
            completed += 1;
            if (completed !== searches.length || cancelled) return;
            if (found > 0) {
              if (found > 1) map.setBounds(bounds);
              else { map.setCenter(bounds.getSouthWest()); map.setLevel(5); }
              setMessage(found === searches.length
                ? '출발지와 도착지를 지도에 표시했어요!'
                : '일부 장소만 찾았어요. 입력한 장소명을 확인해 주세요.');
            } else {
              setMessage('장소를 찾지 못했어요. 검색어를 조금 더 구체적으로 입력해 주세요.');
            }
            setReady(true);
          };

          searches.forEach(({ keyword, label }) => {
            places.keywordSearch(keyword, (result: any[], status: string) => {
              if (cancelled) return;
              if (status === kakao.maps.services.Status.OK && result.length > 0) {
                const place = result[0];
                const position = new kakao.maps.LatLng(Number(place.y), Number(place.x));
                markers.push(new kakao.maps.Marker({ map, position, title: `${label}: ${place.place_name}` }));
                bounds.extend(position);
                found += 1;
              }
              finishSearch();
            });
          });
        });
      } catch {
        if (!cancelled) setMessage('지도를 불러오지 못했어요. 카카오맵 키와 등록 도메인을 확인해 주세요.');
      }
    };

    void loadMap();
    return () => {
      cancelled = true;
      markers.forEach((marker) => marker.setMap(null));
      map = undefined;
    };
  }, [departure, destination]);

  return <View style={styles.container}>
    <View ref={mapElement as any} style={styles.map} collapsable={false} />
    <Text style={styles.message}>{ready ? '📍 ' : 'ℹ️ '}{message}</Text>
  </View>;
}

const styles = StyleSheet.create({
  container: { width: '100%', gap: 8 },
  map: { width: '100%', height: 280, borderRadius: 16, overflow: 'hidden' },
  message: { color: '#52705A', fontSize: 12, lineHeight: 18 },
});
