/**
 * Edge-compatible session token signing and verification using Web Crypto HMAC-SHA256
 */
export const SESSION_COOKIE_NAME = 'roster_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days
function getSecret() {
    return process.env.AUTH_SECRET || 'roster-cpsat-dev-fallback-secret-2026';
}
function base64UrlEncode(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function base64UrlDecode(str) {
    const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}
async function getHmacKey(secret) {
    const enc = new TextEncoder();
    return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
export async function signSessionToken(user) {
    const payload = {
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
    };
    const enc = new TextEncoder();
    const payloadPart = base64UrlEncode(enc.encode(JSON.stringify(payload)));
    const key = await getHmacKey(getSecret());
    const sigBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(payloadPart));
    const sigPart = base64UrlEncode(new Uint8Array(sigBuffer));
    return `${payloadPart}.${sigPart}`;
}
export async function verifySessionToken(token) {
    if (!token)
        return null;
    const parts = token.split('.');
    if (parts.length !== 2)
        return null;
    const [payloadPart, sigPart] = parts;
    try {
        const enc = new TextEncoder();
        const key = await getHmacKey(getSecret());
        const sigBytes = base64UrlDecode(sigPart);
        const sigCopy = new Uint8Array(sigBytes.length);
        sigCopy.set(sigBytes);
        const valid = await crypto.subtle.verify('HMAC', key, sigCopy.buffer, enc.encode(payloadPart));
        if (!valid)
            return null;
        const payloadBytes = base64UrlDecode(payloadPart);
        const payload = JSON.parse(new TextDecoder().decode(payloadBytes));
        if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
            return null;
        }
        return payload;
    }
    catch {
        return null;
    }
}
export function getSessionCookieOptions() {
    return {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: SESSION_MAX_AGE_SECONDS,
        secure: process.env.COOKIE_SECURE === 'true',
    };
}
