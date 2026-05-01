// Generates VAPID keys for Web Push using Node.js built-in crypto (no dependencies).
// Run once: node generate_vapid_keys.js
const { webcrypto } = require('crypto');

async function main() {
  const keyPair = await webcrypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey']
  );

  const pub = await webcrypto.subtle.exportKey('raw', keyPair.publicKey);
  const priv = await webcrypto.subtle.exportKey('pkcs8', keyPair.privateKey);

  const b64url = buf =>
    Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  const publicKey = b64url(pub);
  const privateKey = b64url(priv);

  console.log('\n=== VAPID Keys ===\n');
  console.log('Add to app/.env:');
  console.log(`VITE_VAPID_PUBLIC_KEY=${publicKey}\n`);
  console.log('Add as Supabase secrets (Dashboard → Edge Functions → Secrets):');
  console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
  console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
  console.log(`VAPID_EMAIL=info@hausblick-fn.de`);
}

main();
