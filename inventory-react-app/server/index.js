import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import querystring from 'querystring';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = Number(process.env.PORT) || 8080;
const DIST = path.resolve(__dirname, '../dist');

app.use(express.json({ limit: '1mb' }));

function stripeRequest(method, endpoint, form) {
  return new Promise((resolve, reject) => {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      reject(new Error('STRIPE_SECRET_KEY is not configured.'));
      return;
    }

    const body = form ? querystring.stringify(form) : '';
    const request = https.request({
      hostname: 'api.stripe.com',
      path: endpoint,
      method,
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (stripeRes) => {
      let response = '';
      stripeRes.on('data', (chunk) => { response += chunk; });
      stripeRes.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(response); }
        catch { reject(new Error('Invalid response from Stripe.')); return; }

        if (stripeRes.statusCode < 200 || stripeRes.statusCode >= 300) {
          reject(new Error(parsed.error?.message || 'Stripe request failed.'));
          return;
        }
        resolve(parsed);
      });
    });

    request.on('error', reject);
    if (body) request.write(body);
    request.end();
  });
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'inventory-react' });
});

app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const data = req.body || {};
    const amount = Math.round(Number(data.amount) * 100);
    const quantity = Math.max(1, Number(data.quantity) || 1);

    if (!amount || amount < 1 || !data.name) {
      return res.status(400).json({ error: 'A valid item and amount are required.' });
    }

    const session = await stripeRequest('POST', '/v1/checkout/sessions', {
      mode: 'payment',
      success_url: data.successUrl,
      cancel_url: data.cancelUrl,
      client_reference_id: String(data.paymentId || ''),
      'line_items[0][price_data][currency]': data.currency || 'usd',
      'line_items[0][price_data][product_data][name]': data.name,
      'line_items[0][price_data][product_data][description]': data.description || '',
      'line_items[0][price_data][unit_amount]': amount,
      'line_items[0][quantity]': quantity,
      'metadata[paymentId]': String(data.paymentId || ''),
      'metadata[requestId]': String(data.requestId || ''),
    });

    return res.json({ id: session.id, url: session.url });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/checkout-session/:id', async (req, res) => {
  try {
    const session = await stripeRequest(
      'GET',
      `/v1/checkout/sessions/${encodeURIComponent(req.params.id)}`
    );
    return res.json({
      status: session.payment_status,
      paymentIntentId: session.payment_intent || null,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.use(express.static(DIST));

app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(DIST, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Inventory React server running on port ${PORT}`);
});
