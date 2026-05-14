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
    const { lat, lon } = await req.json();
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

    const weatherRes = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${owmKey}&units=metric`
    );
    if (!weatherRes.ok) {
      return new Response(JSON.stringify({ error: 'Weather API error' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const weather = await weatherRes.json();

    const temp = Math.round(weather.main.temp);
    const feelsLike = Math.round(weather.main.feels_like);
    const description = weather.weather[0].description;
    const city = weather.name;
    const iconEmoji = mapIconToEmoji(weather.weather[0].icon);
    const humidity = weather.main.humidity;
    const windSpeed = Math.round(weather.wind?.speed ?? 0);

    let recommendation = '';
    if (geminiKey) {
      try {
        const prompt = `Aktuelles Wetter in ${city}: ${description}, ${temp}°C (gefühlt ${feelsLike}°C), Luftfeuchtigkeit ${humidity}%, Wind ${windSpeed} m/s. Gib eine kurze, praktische Alltagsempfehlung (max. 12 Wörter, kein Emoji am Anfang, direkt ansprechend).`;
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
        // Gemini failure is non-fatal
      }
    }

    return new Response(
      JSON.stringify({ temp, feelsLike, description, city, iconEmoji, humidity, windSpeed, recommendation }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
