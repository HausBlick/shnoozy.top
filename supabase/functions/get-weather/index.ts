const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function mapIconToEmoji(icon: string): string {
  if (icon.startsWith('01')) return '☀️';
  if (icon.startsWith('02')) return '🌤️';
  if (icon.startsWith('03')) return '⛅';
  if (icon.startsWith('04')) return '☁️';
  if (icon.startsWith('09')) return '🌧️';
  if (icon.startsWith('10')) return '🌦️';
  if (icon.startsWith('11')) return '⛈️';
  if (icon.startsWith('13')) return '❄️';
  if (icon.startsWith('50')) return '🌫️';
  return '🌡️';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { lat, lon, lang = 'de' } = await req.json();
    if (typeof lat !== 'number' || typeof lon !== 'number') {
      return new Response(JSON.stringify({ error: 'lat and lon required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const owmKey = Deno.env.get('OPENWEATHER_API_KEY');
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!owmKey) {
      return new Response(JSON.stringify({ error: 'OPENWEATHER_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parallel: weather + air pollution
    const [weatherRes, airRes] = await Promise.all([
      fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${owmKey}&units=metric`),
      fetch(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${owmKey}`),
    ]);

    if (!weatherRes.ok) {
      return new Response(JSON.stringify({ error: 'Weather API error' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const [weather, air] = await Promise.all([weatherRes.json(), airRes.json()]);

    const temp = Math.round(weather.main.temp);
    const feelsLike = Math.round(weather.main.feels_like);
    const description = weather.weather[0].description;
    const city = weather.name;
    const iconEmoji = mapIconToEmoji(weather.weather[0].icon);
    const humidity = weather.main.humidity;
    const windSpeed = Math.round(weather.wind?.speed ?? 0);

    const aqi: number = air?.list?.[0]?.main?.aqi ?? 0;
    const components = air?.list?.[0]?.components ?? {};
    const pm25 = Math.round((components.pm2_5 ?? 0) * 10) / 10;
    const pm10 = Math.round((components.pm10 ?? 0) * 10) / 10;
    const o3 = Math.round((components.o3 ?? 0) * 10) / 10;
    const no2 = Math.round((components.no2 ?? 0) * 10) / 10;

    let recommendation = '';
    if (geminiKey) {
      try {
        const isDE = lang === 'de';
        const aqiLabels = isDE
          ? ['', 'Gut', 'Mäßig gut', 'Mäßig', 'Schlecht', 'Sehr schlecht']
          : ['', 'Good', 'Fair', 'Moderate', 'Poor', 'Very Poor'];

        const prompt = isDE
          ? `Aktuelles Wetter in ${city}: ${description}, ${temp}°C (gefühlt ${feelsLike}°C), Luftfeuchtigkeit ${humidity}%, Wind ${windSpeed} m/s. Luftqualität: AQI ${aqiLabels[aqi] ?? aqi}, PM2.5 ${pm25} µg/m³. Gib eine kurze, praktische Alltagsempfehlung auf Deutsch (max. 15 Wörter, kein Emoji am Anfang, direkt ansprechend).`
          : `Current weather in ${city}: ${description}, ${temp}°C (feels like ${feelsLike}°C), humidity ${humidity}%, wind ${windSpeed} m/s. Air quality: AQI ${aqiLabels[aqi] ?? aqi}, PM2.5 ${pm25} µg/m³. Give a short, practical everyday tip in English (max 15 words, no emoji at start, direct tone).`;

        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
          }
        );
        const geminiData = await geminiRes.json();
        recommendation = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
      } catch {
        // non-fatal
      }
    }

    return new Response(
      JSON.stringify({ temp, feelsLike, description, city, iconEmoji, humidity, windSpeed, recommendation, aqi, pm25, pm10, o3, no2 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
