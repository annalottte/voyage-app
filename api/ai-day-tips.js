// api/ai-day-tips.js
// Vercel serverless function — add ANTHROPIC_API_KEY to your Vercel env vars

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    destination,
    specificLocation,
    date,
    dayNumber,
    preferences,
    weather,
    context,
  } = req.body;

  if (!destination) {
    return res.status(400).json({ error: 'destination is required' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const preferenceDescriptions = {
    chill:       'relaxed and low-key (cafes, parks, slow walks, reading spots)',
    sightseeing: 'iconic landmarks and must-see attractions',
    food:        'local cuisine, food markets, restaurants, tastings',
    adventure:   'active experiences (hiking, water sports, cycling)',
    culture:     'museums, galleries, theatre, local history',
    shopping:    'local markets, boutiques, souvenirs',
    nightlife:   'bars, live music, evening entertainment',
    nature:      'parks, gardens, natural landscapes, scenic spots',
  };

  const selectedPrefs = (preferences || []).map(p => preferenceDescriptions[p]).filter(Boolean);
  const prefsText = selectedPrefs.length > 0
    ? `The traveler is in the mood for: ${selectedPrefs.join('; ')}.`
    : 'The traveler is open to any type of experience.';

  const locationFocus = specificLocation
    ? `The traveler specifically wants to spend time around: ${specificLocation}. Tailor activities to be within easy reach of this area, and include it directly if relevant.`
    : '';

  let weatherText = '';
  if (weather) {
    const parts = [];
    if (weather.description) parts.push(weather.description);
    if (weather.tempMax !== undefined && weather.tempMin !== undefined) {
      parts.push(`temperatures between ${weather.tempMin}°C and ${weather.tempMax}°C`);
    } else if (weather.tempMax !== undefined) {
      parts.push(`high of ${weather.tempMax}°C`);
    }
    if (weather.precipitation !== undefined && weather.precipitation > 0) {
      parts.push(`${weather.precipitation}mm of precipitation expected`);
    }
    if (weather.windSpeed !== undefined && weather.windSpeed > 40) {
      parts.push(`strong winds at ${weather.windSpeed} km/h`);
    }
    if (parts.length > 0) {
      weatherText = `Weather that day: ${parts.join(', ')}. Factor this into your suggestions — recommend indoor alternatives if conditions are poor, or make the most of good weather with outdoor activities. If it's raining heavily or very windy, lean toward indoor options but still suggest one outdoor activity if conditions allow.`;
    }
  }

  const dayText    = dayNumber ? `This is day ${dayNumber} of the trip.` : '';
  const dateText   = date     ? `The date is ${date}.`                    : '';
  const contextText = context ? `Additional context: ${context}`          : '';

  const prompt = `You are an expert local travel guide with deep knowledge of ${destination}. Give personalized day tips for a traveler.

${dateText} ${dayText}
${locationFocus}
${weatherText}
${prefsText}
${contextText}

Respond with a JSON object in this exact format — no extra text, just the JSON:
{
  "headline": "A short, inspiring headline for the day (max 8 words)",
  "intro": "One sentence setting the mood/vibe for the day, referencing the weather if relevant",
  "weatherNote": "One short sentence about how the weather shapes today's plan (omit key entirely if no weather data)",
  "activities": [
    {
      "time": "Morning / Afternoon / Evening",
      "title": "Activity name",
      "description": "2-3 sentence description with specific details, insider tips, and why it's great. Mention if it's a good or bad choice given the weather.",
      "emoji": "A single relevant emoji",
      "type": "one of: chill|sightseeing|food|adventure|culture|shopping|nightlife|nature",
      "weatherSuitable": true
    }
  ],
  "localTip": "One specific insider tip that most tourists miss",
  "bestFor": "Who this day plan is perfect for (one short phrase)"
}

Include 3-5 activities spread across the day. Be specific — use real place names, local spots, and concrete details. If a specific location was given, anchor activities around it. Set weatherSuitable to false for any outdoor activity that would be poor in the given conditions.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1800,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Anthropic API error:', err);
      return res.status(502).json({ error: 'AI request failed' });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(502).json({ error: 'Could not parse AI response' });
    }

    const tips = JSON.parse(jsonMatch[0]);
    return res.status(200).json(tips);
  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
