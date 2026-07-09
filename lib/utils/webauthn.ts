/**
 * WebAuthn browser utility helpers.
 * Handles the base64url ↔ ArrayBuffer conversions required by the
 * browser's navigator.credentials API.
 */

export function base64urlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + padding);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  return buf.buffer;
}

export function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/** Convert server registration options (base64url strings) → browser-ready PublicKeyCredentialCreationOptions */
export function prepareRegistrationOptions(opts: Record<string, unknown>): PublicKeyCredentialCreationOptions {
  const o = opts as Record<string, unknown>;
  return {
    ...o,
    challenge: base64urlToBuffer(o.challenge as string),
    user: {
      ...(o.user as object),
      id: base64urlToBuffer((o.user as Record<string, string>).id),
    },
    excludeCredentials: ((o.excludeCredentials as Array<Record<string, string>>) ?? []).map((c) => ({
      ...c,
      id: base64urlToBuffer(c.id),
    })),
  } as unknown as PublicKeyCredentialCreationOptions;
}

/** Convert server authentication options (base64url strings) → browser-ready PublicKeyCredentialRequestOptions */
export function prepareAuthenticationOptions(opts: Record<string, unknown>): PublicKeyCredentialRequestOptions {
  const o = opts as Record<string, unknown>;
  return {
    ...o,
    challenge: base64urlToBuffer(o.challenge as string),
    allowCredentials: ((o.allowCredentials as Array<Record<string, string>>) ?? []).map((c) => ({
      ...c,
      id: base64urlToBuffer(c.id),
    })),
  } as unknown as PublicKeyCredentialRequestOptions;
}

/** Serialize a registration PublicKeyCredential to a plain object for the backend */
export function serializeRegistrationCredential(cred: PublicKeyCredential): Record<string, unknown> {
  const response = cred.response as AuthenticatorAttestationResponse;
  return {
    id:    cred.id,
    rawId: bufferToBase64url(cred.rawId),
    response: {
      clientDataJSON:    bufferToBase64url(response.clientDataJSON),
      attestationObject: bufferToBase64url(response.attestationObject),
    },
    type: cred.type,
  };
}

/** Serialize an authentication PublicKeyCredential to a plain object for the backend */
export function serializeAuthenticationCredential(cred: PublicKeyCredential): Record<string, unknown> {
  const response = cred.response as AuthenticatorAssertionResponse;
  return {
    id:    cred.id,
    rawId: bufferToBase64url(cred.rawId),
    response: {
      clientDataJSON:    bufferToBase64url(response.clientDataJSON),
      authenticatorData: bufferToBase64url(response.authenticatorData),
      signature:         bufferToBase64url(response.signature),
      userHandle: response.userHandle ? bufferToBase64url(response.userHandle) : null,
    },
    type: cred.type,
  };
}

/** Returns true if this browser supports WebAuthn platform authenticators (fingerprint, Face ID, Windows Hello) */
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!window.PublicKeyCredential) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}
