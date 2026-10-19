export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'GET 요청만 허용됩니다.' });
  }

  const apiKey = process.env.KAKAO_REST_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: '서버에 카카오 REST API 키가 설정되지 않았습니다.',
    });
  }

  const { origin, destination } = req.query;

  if (typeof origin !== 'string' || typeof destination !== 'string') {
    return res.status(400).json({
      error: '출발지와 도착지 좌표가 필요합니다.',
    });
  }

  try {
    const url = new URL('https://apis-navi.kakaomobility.com/v1/directions');

    url.searchParams.set('origin', origin);
    url.searchParams.set('destination', destination);
    url.searchParams.set('priority', 'RECOMMEND');
    url.searchParams.set('summary', 'false');

    const response = await fetch(url, {
      headers: {
        Authorization: `KakaoAK ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    return res.status(response.ok ? 200 : response.status).json(data);
  } catch {
    return res.status(500).json({
      error: '자동차 경로를 가져오지 못했습니다.',
    });
  }
}
