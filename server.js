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

  // Convert dates to unix seconds and call Costs API (server-side key supported)
  const startTs = Math.floor(new Date(`${start_date}T00:00:00Z`).getTime() / 1000);
  const endTs = Math.floor(new Date(`${end_date}T23:59:59Z`).getTime() / 1000);
  const days = Math.max(1, Math.ceil((endTs - startTs) / 86400));
  const url = `https://api.openai.com/v1/organization/costs?start_time=${startTs}&end_time=${endTs}&bucket_width=1d&limit=${days}`;
  try {
    const upstream = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    const data = await upstream.json();
    if (!upstream.ok) {
      return res.status(upstream.status).json(data);
    }
    const buckets = data.data || data.results || [];
    const daily_costs = buckets.map(b => {
      const ts = b.start_time || b.bucket_start || b.time_start || b.timestamp || 0;
      const cost =
        b.amount?.value ??
        b.cost?.value ??
        b.results?.[0]?.amount?.value ??
        b.results?.[0]?.cost?.value ??
        0;
      return { timestamp: ts, total_cost: cost, num_requests: 0, num_tokens: 0 };
    });
    res.json({ daily_costs });
  } catch (err) {
    res.status(500).json({ error: 'Proxy failed', detail: String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`API server listening on ${PORT}`);
});
