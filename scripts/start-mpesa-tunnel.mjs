/**
 * Expose CMS port 3002 over HTTPS for M-Pesa Daraja callbacks (local dev).
 *
 *   node scripts/start-mpesa-tunnel.mjs
 *   npm run tunnel:mpesa
 *
 * Prefers cloudflared (stable for webhooks), then localtunnel.
 * Copy the printed MPESA_CALLBACK_URL into CMS `.env`, restart CMS, register URL in Daraja.
 */
import { spawn } from 'child_process';

const PORT = process.env.CMS_PORT ?? '3002';
const target = `http://localhost:${PORT}`;

function printInstructions(publicUrl) {
  const callback = `${publicUrl.replace(/\/$/, '')}/api/v1/payments/mpesa/callback`;
  console.log('\n--- M-Pesa callback URL ---');
  console.log(`MPESA_CALLBACK_URL=${callback}`);
  console.log('\n1. Paste into Ticketing and Payment CMS/.env');
  console.log('2. Restart CMS: npm run dev');
  console.log('3. Register the same URL in Safaricom Daraja (Lipa Na M-Pesa Online)');
  console.log('4. Set MPESA_TEST_PHONE=2547XXXXXXXX to your Safaricom handset');
  console.log('5. Run: npm run test:stk\n');
  console.log('Keep this terminal open while testing STK.\n');
}

function runCloudflared() {
  return new Promise((resolve, reject) => {
    console.log(`Trying cloudflared tunnel → ${target}\n`);
    const child = spawn(
      'npx',
      ['--yes', 'cloudflared', 'tunnel', '--url', target, '--no-autoupdate'],
      { shell: true, stdio: ['ignore', 'pipe', 'pipe'] }
    );

    let resolved = false;
    const onData = (chunk) => {
      const text = chunk.toString();
      process.stdout.write(text);
      const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
      if (match && !resolved) {
        resolved = true;
        printInstructions(match[0]);
        resolve(child);
      }
    };

    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', reject);
    child.on('exit', (code) => {
      if (!resolved) reject(new Error(`cloudflared exited (${code})`));
    });

    setTimeout(() => {
      if (!resolved) {
        child.kill();
        reject(new Error('cloudflared timeout'));
      }
    }, 45_000);
  });
}

function runLocaltunnel() {
  return new Promise((resolve, reject) => {
    console.log(`Trying localtunnel → ${target}\n`);
    const child = spawn('npx', ['--yes', 'localtunnel', '--port', PORT], {
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let resolved = false;
    const onData = (chunk) => {
      const text = chunk.toString();
      process.stdout.write(text);
      const match = text.match(/https:\/\/[^\s]+\.loca\.lt/i);
      if (match && !resolved) {
        resolved = true;
        printInstructions(match[0]);
        console.warn(
          'Note: localtunnel may drop connections. Prefer cloudflared for STK callbacks.\n'
        );
        resolve(child);
      }
    };

    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', reject);
    child.on('exit', (code) => {
      if (!resolved) reject(new Error(`localtunnel exited (${code})`));
    });

    setTimeout(() => {
      if (!resolved) {
        child.kill();
        reject(new Error('localtunnel timeout'));
      }
    }, 45_000);
  });
}

async function main() {
  let child;
  try {
    child = await runCloudflared();
  } catch (e) {
    console.warn(String(e.message));
    child = await runLocaltunnel();
  }

  process.on('SIGINT', () => {
    child.kill();
    process.exit(0);
  });
}

main().catch((e) => {
  console.error('Could not start tunnel:', e.message);
  process.exit(1);
});
