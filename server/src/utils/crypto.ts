import crypto from "crypto";

/**
 * Sikker kryptering i prod: sett SECRET_KEY_HEX i .env til 64 hex-tegn (32 bytes).
 * Uten nøkkel lagrer vi "PLAINTEXT:..." i dev (funksjonelt, ikke sikkert).
 */
const KEY = (() => {
  try {
    const raw = (process.env.SECRET_KEY_HEX || "").trim();
    const buf = Buffer.from(raw, "hex");
    return buf.length === 32 ? buf : null;
  } catch {
    return null;
  }
})();

export function encrypt(plaintext: string): string {
  if (!KEY) {
    // Utviklings-fallback (ikke sikkert)
    return `PLAINTEXT:${plaintext}`;
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // format: v1|iv(12)|tag(16)|ciphertext  (base64)
  return Buffer.concat([Buffer.from("v1|"), iv, tag, enc]).toString("base64");
}

export function decrypt(payload: string): string | null {
  try {
    if (payload.startsWith("PLAINTEXT:")) return payload.slice("PLAINTEXT:".length);
    if (!KEY) return null;
    const raw = Buffer.from(payload, "base64");
    if (raw.slice(0, 3).toString() !== "v1|") return null;
    const iv = raw.slice(3, 15);
    const tag = raw.slice(15, 31);
    const enc = raw.slice(31);
    const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
    return dec.toString("utf8");
  } catch {
    return null;
  }
}

/** Viser aldri plaintext i UI. Du kan gjøre denne smartere (vise siste 4, osv.). */
export function maskToken(_enc: string | null): string | null {
  if (!_enc) return null;
  return "********";
}
