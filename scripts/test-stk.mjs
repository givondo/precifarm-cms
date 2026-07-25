/**
 * M-Pesa Express STK smoke test — CMS must be running (default port 3002).
 *
 *   node scripts/test-stk.mjs
 *   MPESA_TEST_PHONE=2547XXXXXXXX node scripts/test-stk.mjs
 *
 * Uses CMS .env for Daraja credentials. Set MPESA_TEST_PHONE in CMS .env to the
 * Safaricom number that should receive the STK prompt (production/live testing).
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = resolve(root, '.env');

function loadEnv() {
  try {
    const text = readFileSync(envPath, 'utf8');
    for (const line of text.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i === -1) continue;
      const key = t.slice(0, i).trim();
      const val = t.slice(i + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    /* optional — env may already be set */
  }
}

loadEnv();

const BASE = process.env.CMS_API_URL ?? process.env.API_URL ?? 'http://localhost:3002/api';
const TEST_PHONE = process.env.MPESA_TEST_PHONE ?? '254708374149';

function tomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

async function api(path, init) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json.error?.message ?? json.error ?? res.statusText;
    throw new Error(`${res.status}: ${msg}`);
  }
  return json.data ?? json;
}

async function main() {
  console.log(`Precifarm STK test → ${BASE}`);
  console.log(`Test phone: ${TEST_PHONE}\n`);

  const health = await api('/v1/health');
  console.log(`CMS payment mode: ${health.paymentMode ?? health.data?.paymentMode ?? 'unknown'}`);
  if (health.callbackHost) console.log(`Callback host: ${health.callbackHost}`);
  console.log('');

  const date = tomorrow();
  const tripPayload = await api(`/v1/routes/nairobi-kisumu/trips?date=${date}`);
  const trip = tripPayload.trips[0];
  const seats = await api(
    `/v1/routes/nairobi-kisumu/seats?date=${date}&time=${encodeURIComponent(trip.departureTime)}`
  );
  const booked = new Set(seats.bookedSeats ?? []);
  const seat = ['1A', '1B', '2A', '2B', '3A', '4A', '5A', '6A'].find((s) => !booked.has(s)) ?? '8A';

  const booking = await api('/v1/bookings', {
    method: 'POST',
    body: JSON.stringify({
      routeId: 'nairobi-kisumu',
      date,
      time: trip.departureTime,
      passengers: 1,
      seats: [seat],
      name: 'STK Test',
      phone: TEST_PHONE,
      idNumber: '12345678',
      channel: 'web',
    }),
  });

  console.log(`Booking ${booking.reference} (${booking.bookingId}) · seat ${seat}`);

  const t0 = Date.now();
  const stk = await api('/v1/payments/stk', {
    method: 'POST',
    body: JSON.stringify({ bookingId: booking.bookingId }),
  });
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  console.log(`STK response (${elapsed}s):`);
  console.log(`  status:   ${stk.status}`);
  console.log(`  demo:     ${stk.demo ?? false}`);
  if (stk.message) console.log(`  message:  ${stk.message}`);
  if (stk.mpesaReceipt) console.log(`  receipt:  ${stk.mpesaReceipt}`);
  if (stk.checkoutRequestId) console.log(`  checkout: ${stk.checkoutRequestId}`);

  if (stk.status === 'pending') {
    console.log('\n→ Enter M-Pesa PIN on your phone. Polling payment status…');
    const started = Date.now();
    while (Date.now() - started < 120_000) {
      await new Promise((r) => setTimeout(r, 3000));
      const payStatus = await api(`/v1/payments/${booking.bookingId}/status`);
      if (payStatus.bookingStatus === 'paid') {
        console.log('\n✓ Live STK completed.');
        console.log(`  receipt: ${payStatus.mpesaReceipt ?? '(pending receipt)'}`);
        process.exit(0);
      }
      if (payStatus.paymentStatus === 'failed') {
        console.error('\n✗ M-Pesa payment failed.');
        process.exit(1);
      }
      process.stdout.write('.');
    }
    console.error('\n✗ Timed out waiting for callback. Check MPESA_CALLBACK_URL tunnel.');
    process.exit(1);
  }

  const payStatus = await api(`/v1/payments/${booking.bookingId}/status`);
  console.log(`\nPayment status:`);
  console.log(`  booking:  ${payStatus.bookingStatus}`);
  console.log(`  payment:  ${payStatus.paymentStatus}`);
  if (payStatus.mpesaReceipt) console.log(`  receipt:  ${payStatus.mpesaReceipt}`);

  if (stk.status === 'success' && stk.demo) {
    console.log('\n✓ Demo STK OK — set DEMO_PAYMENT=false + Daraja creds for live STK.');
    process.exit(0);
  }
  if (stk.status === 'success' && !stk.demo) {
    console.log('\n✓ Live STK completed immediately.');
    process.exit(0);
  }

  console.error('\n✗ Unexpected STK response');
  process.exit(1);
}

main().catch((e) => {
  console.error('✗ STK test failed:', e.message);
  console.error('  Is CMS running? npm run dev');
  console.error('  Live mode: node scripts/start-mpesa-tunnel.mjs + update MPESA_CALLBACK_URL');
  process.exit(1);
});
