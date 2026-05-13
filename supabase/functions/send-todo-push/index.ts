import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function b64uDec(s: string): Uint8Array {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}

function b64uEnc(buf: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function hkdfExtract(salt: Uint8Array, ikm: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', salt, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, ikm));
}

async function hkdfExpand(prk: Uint8Array, info: Uint8Array, len: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', prk, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const t1 = new Uint8Array(await crypto.subtle.sign('HMAC', key, new Uint8Array([...info, 1])));
  return t1.slice(0, len);
}

async function encryptPayload(message: string, p256dh: string, auth: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const uaPublicRaw = b64uDec(p256dh);
  const authSecret = b64uDec(auth);

  const uaPublicKey = await crypto.subtle.importKey(
    'raw', uaPublicRaw, { name: 'ECDH', namedCurve: 'P-256' }, true, [],
  );
  const ephemeral = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'],
  );
  const asPublicRaw = new Uint8Array(await crypto.subtle.exportKey('raw', ephemeral.publicKey));
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'ECDH', public: uaPublicKey }, ephemeral.privateKey, 256,
  ));
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const prk  = await hkdfExtract(authSecret, ecdhSecret);
  const ikm2 = await hkdfExpand(prk,  new Uint8Array([...enc.encode('WebPush: info\0'), ...uaPublicRaw, ...asPublicRaw]), 32);
  const prk2 = await hkdfExtract(salt, ikm2);
  const cek   = await hkdfExpand(prk2, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdfExpand(prk2, enc.encode('Content-Encoding: nonce\0'), 12);

  const plaintext = new Uint8Array([...enc.encode(message), 2]);
  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, plaintext));

  const header = new Uint8Array(16 + 4 + 1 + asPublicRaw.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096, false);
  header[20] = asPublicRaw.length;
  header.set(asPublicRaw, 21);

  return new Uint8Array([...header, ...ciphertext]);
}

async function buildVapidJwt(
  audience: string, email: string, vapidPublicKey: string, vapidPrivateKey: string,
): Promise<string> {
  const enc = new TextEncoder();
  const pubRaw = b64uDec(vapidPublicKey);
  const x = b64uEnc(pubRaw.slice(1, 33));
  const y = b64uEnc(pubRaw.slice(33, 65));

  const signingKey = await crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', d: vapidPrivateKey, x, y, key_ops: ['sign'] },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, ['sign'],
  );

  const headerB64  = b64uEnc(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const payloadB64 = b64uEnc(enc.encode(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 43200,
    sub: `mailto:${email}`,
  })));
  const sig = new Uint8Array(await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    signingKey,
    enc.encode(`${headerB64}.${payloadB64}`),
  ));
  return `${headerB64}.${payloadB64}.${b64uEnc(sig)}`;
}

async function sendPush(
  endpoint: string, p256dh: string, auth_key: string, message: string,
  vapidEmail: string, vapidPublicKey: string, vapidPrivateKey: string,
): Promise<void> {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const [jwt, body] = await Promise.all([
    buildVapidJwt(audience, vapidEmail, vapidPublicKey, vapidPrivateKey),
    encryptPayload(message, p256dh, auth_key),
  ]);
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `vapid t=${jwt},k=${vapidPublicKey}`,
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      'TTL': '86400',
    },
    body,
  });
  if (res.status !== 200 && res.status !== 201 && res.status !== 202) {
    const text = await res.text();
    throw new Error(`FCM ${res.status}: ${text}`);
  }
}

interface RequestBody {
  item_id: string;
  assigned_to: string;
  title: string;
  home_id: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  try {
    // .trim() guards against accidental whitespace in Supabase secrets
    const vapidEmail      = Deno.env.get('VAPID_EMAIL')?.trim();
    const vapidPublicKey  = Deno.env.get('VAPID_PUBLIC_KEY')?.trim();
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')?.trim();

    if (!vapidEmail || !vapidPublicKey || !vapidPrivateKey) {
      return new Response(JSON.stringify({ error: 'Missing VAPID secrets' }), {
        status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const body: RequestBody = await req.json();
    const { assigned_to, title } = body;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: subs, error: subsError } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth_key')
      .eq('user_id', assigned_to);

    if (subsError) {
      return new Response(JSON.stringify({ error: subsError.message }), {
        status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    let sent = 0;
    for (const sub of subs) {
      try {
        await sendPush(
          sub.endpoint, sub.p256dh, sub.auth_key,
          JSON.stringify({ title: '✅ New task assigned', body: title, tag: 'todo-assignment' }),
          vapidEmail, vapidPublicKey, vapidPrivateKey,
        );
        sent++;
      } catch (e) {
        console.error('Push failed:', String(e));
      }
    }

    return new Response(JSON.stringify({ sent }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Handler error:', String(err));
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
