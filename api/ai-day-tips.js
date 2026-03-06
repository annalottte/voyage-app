// api/ai-day-tips.js
// Vercel serverless function — handles both day tips AND packing list requests
// Set ANTHROPIC_API_KEY in your Vercel environment variables

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  // ── Packing planner passes a raw prompt ──────────────────────────────────
  if (req.body?._packingRequest) {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'prompt required' });

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
          max_tokens: 2000,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        console.error('Anthropic error (packing):', err);
        return res.status(502).json({ error: 'AI request failed' });
      }

      const data   = await response.json();
      const text   = data.content?.[0]?.text || '';
      const clean  = text.replace(/```json|```/g, '').trim();

      // Try to extract JSON (array or object)
      const match = clean.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
      if (!match) return res.status(502).json({ error: 'Could not parse AI response', rawText: text });

      return res.status(200).json(JSON.parse(match[0]));
    } catch (err) {
      console.error('Packing handler error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // ── Day tips request ─────────────────────────────────────────────────────
  const {
    destination,
    specificLocation,
    date,
    dayNumber,
    preferences,
    userRequest,    // free-text: "I want to drink a local beer", "find a beach", etc.
    weather,
    context,
  } = req.body;

  if (!destination) return res.status(400).json({ error: 'destination is required' });

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

  const selectedPrefs  = (preferences || []).map(p => preferenceDescriptions[p]).filter(Boolean);
  const prefsText      = selectedPrefs.length
    ? `The traveler is in the mood for: ${selectedPrefs.join('; ')}.`
    : 'The traveler is open to any type of experience.';

  // Free-text user request — highest priority in the prompt
  const userRequestText = userRequest
    ? `IMPORTANT — The traveler has a specific request: "${userRequest}". This must be directly reflected in at least one activity. Build the day around this wherever possible.`
    : '';

  const locationFocus = specificLocation
    ? `The traveler specifically wants to spend time around: ${specificLocation}. Tailor activities to be within easy reach of this area.`
    : '';

  let weatherText = '';
  if (weather) {
    const parts = [];
    if (weather.description) parts.push(weather.description);
    if (weather.tempMax !== undefined && weather.tempMin !== undefined)
      parts.push(`temperatures between ${weather.tempMin}°C and ${weather.tempMax}°C`);
    else if (weather.tempMax !== undefined)
      parts.push(`high of ${weather.tempMax}°C`);
    if (weather.precipitation > 0)  parts.push(`${weather.precipitation}mm precipitation`);
    if (weather.windSpeed > 40)     parts.push(`strong winds at ${weather.windSpeed} km/h`);
    if (parts.length)
      weatherText = `Weather that day: ${parts.join(', ')}. Factor this in — recommend indoor alternatives if poor, lean outdoor if great. Set weatherSuitable to false for activities that would be poor in these conditions.`;
  }

  const dayText     = dayNumber ? `This is day ${dayNumber} of the trip.`  : '';
  const dateText    = date      ? `The date is ${date}.`                    : '';
  const contextText = context   ? `Additional context: ${context}`          : '';

  const prompt = `You are an expert local travel guide with deep knowledge of ${destination}. Give personalized day tips for a traveler.

${dateText} ${dayText}
${userRequestText}
${locationFocus}
${weatherText}
${prefsText}
${contextText}

Respond with a JSON object in this EXACT format — no extra text, no markdown, just JSON:
{
  "headline": "A short, inspiring headline for the day (max 8 words)",
  "intro": "One sentence setting the mood/vibe, referencing weather if relevant",
  "weatherNote": "One short sentence about how weather shapes today's plan (omit key entirely if no weather data)",
  "activities": [
    {
      "time": "Morning / Afternoon / Evening",
      "title": "Activity name",
      "description": "2-3 sentences with specific details, insider tips, and why it's great",
      "emoji": "Single relevant emoji",
      "type": "chill|sightseeing|food|adventure|culture|shopping|nightlife|nature",
      "weatherSuitable": true
    }
  ],
  "localTip": "One specific insider tip most tourists miss",
  "bestFor": "Who this plan is perfect for (one short phrase)"
}

Include 3-5 activities across the day. Use real place names and concrete details.${userRequest ? ` Remember: the traveler wants "${userRequest}" — prominently feature this.` : ''}`;

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
      console.error('Anthropic error (day tips):', err);
      return res.status(502).json({ error: 'AI request failed' });
    }

    const data  = await response.json();
    const text  = data.content?.[0]?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return res.status(502).json({ error: 'Could not parse AI response' });

    return res.status(200).json(JSON.parse(match[0]));
  } catch (err) {
    console.error('Day tips handler error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
