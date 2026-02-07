const express = require('express');

const app = express();
const PORT = process.env.PORT || 10000;

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/usage', async (req, res) => {
  const { start_date, end_date } = req.query;
  if (!start_date || !end_date) {
    return res.status(400).json({ error: 'start_date and end_date are required (YYYY-MM-DD)' });
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY not set on server' });

  const url = `https://api.openai.com/dashboard/billing/usage?start_date=${start_date}&end_date=${end_date}`;
  try {
    const upstream = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    const text = await upstream.text();
    res.status(upstream.status).set('content-type', upstream.headers.get('content-type') || 'application/json').send(text);
  } catch (err) {
    res.status(500).json({ error: 'Proxy failed', detail: String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`API server listening on ${PORT}`);
});
