import { createServer } from 'node:http';

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:8081');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  if (url.pathname !== '/api/directions' || req.method !== 'GET') {
    res.writeHead(404);
    return res.end(JSON.stringify({ error: '요청 주소를 확인해 주세요.' }));
  }

  const apiKey = process.env.KAKAO_REST_API_KEY;
  const origin = url.searchParams.get('origin');
  const destination = url.searchParams.get('destination');

  if (!apiKey) {
    res.writeHead(500);
    return res.end(
      JSON.stringify({ error: 'REST API 키가 설정되지 않았습니다.' }),
    );
  }

  if (!origin || !destination) {
    res.writeHead(400);
    return res.end(
      JSON.stringify({ error: '출발지와 도착지 좌표가 필요합니다.' }),
    );
  }

  try {
    const apiUrl = new URL('https://apis-navi.kakaomobility.com/v1/directions');
    apiUrl.searchParams.set('origin', origin);
    apiUrl.searchParams.set('destination', destination);
    apiUrl.searchParams.set('priority', 'RECOMMEND');
    apiUrl.searchParams.set('summary', 'false');

    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `KakaoAK ${apiKey}`,
      },
    });

    const data = await response.json();

    res.writeHead(response.status);
    return res.end(JSON.stringify(data));
  } catch {
    res.writeHead(500);
    return res.end(
      JSON.stringify({ error: '자동차 경로를 가져오지 못했습니다.' }),
    );
  }
});

server.listen(3000, () => {
  console.log('경로 API 실행 중: http://localhost:3000');
});
