const DEFAULT_SUMMARY_MODEL = process.env.ANTHROPIC_SUMMARY_MODEL || process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-latest';

function getAnthropicError(rawError, status) {
  let parsed = null;
  try { parsed = JSON.parse(rawError); } catch {}

  const errorType = parsed?.error?.type || parsed?.type || null;
  const errorMessage = parsed?.error?.message || '';
  if (errorType === 'not_found_error' && /model/i.test(errorMessage)) {
    return { error: 'AI model is currently unavailable', code: 'anthropic_model_not_found' };
  }
  if (status === 401 || status === 403) {
    return { error: 'AI service authentication failed', code: 'anthropic_auth_error' };
  }
  return { error: 'AI service is currently unavailable. Please try again soon.', code: 'anthropic_request_failed' };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'AI service is not configured', code: 'anthropic_key_missing' });
  }

  const messages = req.body?.messages;
  if (!Array.isArray(messages) || !messages.length) {
    return res.status(400).json({ error: 'messages are required', code: 'invalid_request' });
  }

  const requestedMaxTokens = Number(req.body?.max_tokens);
  const maxTokens = Number.isFinite(requestedMaxTokens)
    ? Math.min(Math.max(Math.floor(requestedMaxTokens), 1), 2000)
    : 1000;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: DEFAULT_SUMMARY_MODEL,
        max_tokens: maxTokens,
        messages,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Anthropic error (summary):', {
        status: response.status,
        model: DEFAULT_SUMMARY_MODEL,
        error: err,
      });
      const safeError = getAnthropicError(err, response.status);
      return res.status(502).json(safeError);
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error('Summary handler error:', error);
    return res.status(500).json({ error: 'Failed to reach AI service', code: 'anthropic_unreachable' });
  }
}
