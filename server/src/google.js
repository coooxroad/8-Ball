/* A Google sign-in, checked here: the ID token the app gets from Google (its 'credential') is a JWT signed with one of
   Google's keys. Its signature is checked against Google's published keys (fetched, kept an hour), and it must be for
   this app (aud = the OAuth client ID the owner sets as GOOGLE_CLIENT_ID), from Google (iss), and not expired. What comes
   back is who it is: { sub, email } - sub is the account's lasting id. Nothing of Google's is stored but sub (link.js).
   Not set up (no GOOGLE_CLIENT_ID): there is no Google sign-in. How to set it up: docs/google-signin.md. */
const CERTS = 'https://www.googleapis.com/oauth2/v3/certs', ISS = ['accounts.google.com', 'https://accounts.google.com'];
let keys = null, keysAt = 0;
const b64u = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };
const text = u8 => new TextDecoder().decode(u8);

// token: the JWT; clientId: GOOGLE_CLIENT_ID; get(url): a fetch (tests give their own); now: ms
export async function googleWho(token, clientId, get, now) {
  if (!clientId) return { why: 'google not set up' };
  const parts = String(token || '').split('.'); if (parts.length !== 3) return { why: 'bad token' };
  let head, body; try { head = JSON.parse(text(b64u(parts[0]))); body = JSON.parse(text(b64u(parts[1]))); } catch (e) { return { why: 'bad token' }; }
  if (head.alg !== 'RS256' || !head.kid) return { why: 'bad token' };
  const t = now != null ? now : Date.now();
  if (!keys || t - keysAt > 3600000 || !keys.some(k => k.kid === head.kid)) {
    const r = await (get || fetch)(CERTS); if (!r.ok) return { why: 'google keys unavailable' };
    keys = (await r.json()).keys || []; keysAt = t;
  }
  const jwk = keys.find(k => k.kid === head.kid); if (!jwk) return { why: 'unknown key' };
  const key = await crypto.subtle.importKey('jwk', { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64u(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]));
  if (!ok) return { why: 'bad signature' };
  const aud = Array.isArray(body.aud) ? body.aud : [body.aud];
  if (!ISS.includes(body.iss) || !aud.includes(clientId) || !(body.exp * 1000 > t) || !body.sub) return { why: 'not for this app' };
  return { sub: String(body.sub), email: body.email && body.email_verified !== false ? body.email : null };   // (an address Google has not checked is no address)
}
export const forgetGoogleKeys = () => { keys = null; keysAt = 0; seen.clear(); };   // (tests)

/* The other way in: an access token (OAuth 2.0, 'openid email'), which the web gets from Google's account chooser with
   prompt=select_account. The ID-token button keeps showing the Google account it last used, and with one signed in there
   was no way to another (owner 11-10: in the admin console as in the game, only a private window got round it). Google
   says whose it is and for which app (tokeninfo); it must be for this app, unexpired, its address checked. Asked once per
   token, then kept a few minutes (the admin console sends it with every request). */
const INFO = 'https://oauth2.googleapis.com/tokeninfo?access_token=', seen = new Map();
export async function googleWhoAccess(token, clientId, get, now) {
  if (!clientId) return { why: 'google not set up' };
  const t = now != null ? now : Date.now(), tok = String(token || '');
  if (!/^[\w.~+\/-]{20,4096}$/.test(tok)) return { why: 'bad token' };
  const hit = seen.get(tok); if (hit && hit.until > t) return hit.who;
  const r = await (get || fetch)(INFO + encodeURIComponent(tok)); if (!r.ok) return { why: 'bad token' };
  const b = await r.json().catch(() => ({}));
  if (b.aud !== clientId && b.azp !== clientId) return { why: 'not for this app' };
  if (!(+b.exp * 1000 > t) || !b.sub) return { why: 'not for this app' };
  let email = b.email && String(b.email_verified) === 'true' ? b.email : null;
  // (tokeninfo leaves the address out for some tokens; the userinfo endpoint, asked with the token itself, gives it)
  if (!email) {
    const u = await (get || fetch)('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: 'Bearer ' + tok } }).catch(() => null);
    const v = u && u.ok ? await u.json().catch(() => ({})) : {};
    if (v.sub === String(b.sub) && v.email && String(v.email_verified) === 'true') email = v.email;
  }
  const who = { sub: String(b.sub), email };
  if (seen.size > 500) seen.clear(); seen.set(tok, { who, until: Math.min(+b.exp * 1000, t + 300000) });
  return who;
}
// either kind: an ID token is a JWT - its header, base64 of '{"', starts "eyJ"; anything else is taken as an access token.
// (Counting dots was wrong: an access token can have two dots too - 'ya29.c.…' - and was then refused as a bad JWT, the
// owner's 'bad token' on 11-10.)
export const googleWhoAny = (token, clientId, get, now) => /^eyJ[\w-]*\.[\w-]+\.[\w-]*$/.test(String(token || '')) ? googleWho(token, clientId, get, now) : googleWhoAccess(token, clientId, get, now);
