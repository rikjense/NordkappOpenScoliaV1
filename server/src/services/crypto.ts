// server/src/services/crypto.ts
import crypto from "crypto";

function getKey() {
  const hex = process.env.SECRET_KEY_HEX || "";
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("SECRET_KEY_HEX må være 64 hex-tegn (32 bytes).");
  }
  return Buffer.from(hex, "hex");
}

export function encryptToken(plain: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12); // GCM IV = 96 bits
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // format: v1:<ivHex>:<ctHex>:<tagHex>
  return `v1:${iv.toString("hex")}:${enc.toString("hex")}:${tag.toString("hex")}`;
}

export function decryptToken(encString: string): string {
  const [v, ivHex, ctHex, tagHex] = encString.split(":");
  if (v !== "v1") throw new Error("Ukjent tokenformat");
  const key = getKey();
  const iv = Buffer.from(ivHex, "hex");
  const ct = Buffer.from(ctHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(ct), decipher.final()]);
  return dec.toString("utf8");
}

export function maskToken(encString?: string | null): string | null {
  if (!encString) return null;
  try {
    const plain = decryptToken(encString);
    const tail = plain.slice(-4);
    return `••••••••••••${tail}`;
  } catch {
    // Faller tilbake på en generisk maskering dersom decrypt feiler
    return "••••••••••••";
  }
}
