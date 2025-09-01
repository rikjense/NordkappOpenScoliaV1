/**
 * Her kommer Scolia WebSocket-klienten.
 * - Autentisering via query params: serialNumber & accessToken
 * - Meldingsformat med type/id/payload (jamfør Scolia Social API v1.2)
 * - Reconnect-policy: eksponentiell backoff med jitter
 *
 * I Steg 2 kobler vi dette mot en "BoardManager" og simulatoren.
 */
export type ScoliaMessage = {
  type: string;
  id: string;
  payload?: unknown;
};

// foreløpig tomt – implementeres i neste steg
