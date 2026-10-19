import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

declare global {
  interface Window {
    kakao?: any;
  }
}

type KakaoMapProps = {
  departure: string;
  destination: string;
};

export default function KakaoMap({ departure, destination }: KakaoMapProps) {
  const mapElement = useRef<HTMLDivElement | null>(null);
  const [message, setMessage] = useState('카카오맵을 불러오는 중...');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let map: any;
    let markers: any[] = [];
    let polylines: any[] = [];

    setReady(false);

    const loadMap = async () => {
      const key = process.env.EXPO_PUBLIC_KAKAO_MAP_KEY;

      if (!key) {
        setMessage('카카오맵 키를 찾을 수 없어요. .env 파일을 확인해 주세요.');
        return;
      }

      try {
        if (!window.kakao?.maps?.services) {
          await new Promise<void>((resolve, reject) => {
            const existing = document.querySelector<HTMLScriptElement>(
              'script[data-kakao-map-sdk]',
            );

            if (existing && window.kakao?.maps?.services) {
              resolve();
              return;
            }

            const script = existing ?? document.createElement('script');

            script.addEventListener('load', () => resolve(), { once: true });
            script.addEventListener(
              'error',
              () => reject(new Error('SDK load failed')),
              { once: true },
            );

            if (!existing) {
              script.dataset.kakaoMapSdk = 'true';
              script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&autoload=false&libraries=services`;
              document.head.appendChild(script);
            }
          });
        }

        window.kakao.maps.load(async () => {
          if (cancelled || !mapElement.current) return;

          const kakao = window.kakao;

          map = new kakao.maps.Map(mapElement.current, {
            center: new kakao.maps.LatLng(37.5665, 126.978),
            level: 7,
          });

          const places = new kakao.maps.services.Places();
          const bounds = new kakao.maps.LatLngBounds();

          const searches = [
            { keyword: departure.trim(), label: '출발지' },
            { keyword: destination.trim(), label: '도착지' },
          ];

          if (!searches[0].keyword || !searches[1].keyword) {
            setMessage('출발지와 도착지를 모두 입력해 주세요.');
            setReady(true);
            return;
          }

          const searchPlace = (keyword: string) =>
            new Promise<any>((resolve, reject) => {
              places.keywordSearch(keyword, (result: any[], status: string) => {
                if (
                  status === kakao.maps.services.Status.OK &&
                  result.length > 0
                ) {
                  resolve(result[0]);
                } else {
                  reject(new Error(`장소를 찾지 못했습니다: ${keyword}`));
                }
              });
            });

          try {
            const [startPlace, endPlace] = await Promise.all([
              searchPlace(searches[0].keyword),
              searchPlace(searches[1].keyword),
            ]);

            if (cancelled) return;

            const start = {
              x: Number(startPlace.x),
              y: Number(startPlace.y),
            };
            const end = {
              x: Number(endPlace.x),
              y: Number(endPlace.y),
            };

            const startPosition = new kakao.maps.LatLng(start.y, start.x);
            const endPosition = new kakao.maps.LatLng(end.y, end.x);

            markers.push(
              new kakao.maps.Marker({
                map,
                position: startPosition,
                title: `출발지: ${startPlace.place_name}`,
              }),
              new kakao.maps.Marker({
                map,
                position: endPosition,
                title: `도착지: ${endPlace.place_name}`,
              }),
            );

            bounds.extend(startPosition);
            bounds.extend(endPosition);

            setMessage('자동차 경로를 불러오는 중...');

            const params = new URLSearchParams({
              origin: `${start.x},${start.y}`,
              destination: `${end.x},${end.y}`,
            });

            const response = await fetch(
              `http://localhost:3000/api/directions?${params.toString()}`,
            );

            const data = await response.json();

            if (!response.ok) {
              throw new Error(data.error || '자동차 경로 요청에 실패했습니다.');
            }

            if (cancelled) return;

            const roads =
              data.routes?.[0]?.sections?.flatMap(
                (section: any) => section.roads ?? [],
              ) ?? [];

            const path: any[] = [];

            roads.forEach((road: any) => {
              const vertexes = road.vertexes ?? [];

              for (let i = 0; i + 1 < vertexes.length; i += 2) {
                const longitude = Number(vertexes[i]);
                const latitude = Number(vertexes[i + 1]);

                if (Number.isFinite(longitude) && Number.isFinite(latitude)) {
                  path.push(new kakao.maps.LatLng(latitude, longitude));
                }
              }
            });

            if (path.length < 2) {
              throw new Error(
                '자동차 경로가 없어요. 출발지와 도착지를 확인해 주세요.',
              );
            }

            const polyline = new kakao.maps.Polyline({
              path,
              strokeWeight: 5,
              strokeColor: '#2878FF',
              strokeOpacity: 0.9,
              strokeStyle: 'solid',
            });

            polyline.setMap(map);
            polylines.push(polyline);

            path.forEach((point) => bounds.extend(point));
            map.setBounds(bounds);

            setMessage('출발지부터 도착지까지 택시 경로를 표시했어요!');
          } catch (error) {
            if (cancelled) return;

            setMessage(
              error instanceof Error
                ? error.message
                : '자동차 경로를 불러오지 못했어요.',
            );

            map.setBounds(bounds);
          } finally {
            if (!cancelled) setReady(true);
          }
        });
      } catch {
        if (!cancelled) {
          setMessage(
            '지도를 불러오지 못했어요. 카카오맵 키와 등록 도메인을 확인해 주세요.',
          );
          setReady(true);
        }
      }
    };

    loadMap();

    return () => {
      cancelled = true;
      markers.forEach((marker) => marker.setMap(null));
      polylines.forEach((polyline) => polyline.setMap(null));
    };
  }, [departure, destination]);

  return (
    <View style={styles.container}>
      <View
        ref={mapElement as any}
        style={styles.map}
        // @ts-ignore 웹 지도 컨테이너
        collapsable={false}
      />
      <Text style={styles.message}>
        {ready ? '📍 ' : 'ℹ️ '}
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: 8,
  },
  map: {
    width: '100%',
    height: 280,
    borderRadius: 16,
    overflow: 'hidden',
  },
  message: {
    color: '#52705A',
    fontSize: 12,
    lineHeight: 18,
  },
});
