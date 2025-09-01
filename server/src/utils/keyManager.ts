// server/src/utils/keyManager.ts
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ENV_VAR = "SECRET_KEY_HEX";
const SECRET_DIR = resolve(process.cwd(), ".secrets");
const SECRET_FILE = resolve(SECRET_DIR, "secret_key_hex");

let cachedKey: Buffer | null = null;

function isHex64(s: string) {
  return /^[0-9a-fA-F]{64}$/.test(s);
}

/** Finn nøkkel i ENV, i fil – eller generér og persistér. */
export function ensureSecretKey(): Buffer {
  const envHex = process.env[ENV_VAR];
  if (envHex && isHex64(envHex)) {
    cachedKey = Buffer.from(envHex, "hex");
    return cachedKey;
  }

  if (existsSync(SECRET_FILE)) {
    const hex = readFileSync(SECRET_FILE, "utf8").trim();
    if (isHex64(hex)) {
      cachedKey = Buffer.from(hex, "hex");
      return cachedKey;
    }
  }

  const hex = randomBytes(32).toString("hex");
  if (!existsSync(SECRET_DIR)) mkdirSync(SECRET_DIR, { recursive: true });
  writeFileSync(SECRET_FILE, hex, { encoding: "utf8", flag: "w" });
  cachedKey = Buffer.from(hex, "hex");
  return cachedKey;
}

export function getKey(): Buffer | null {
  if (cachedKey) return cachedKey;
  try { return ensureSecretKey(); } catch { return null; }
}

export const secretKeyPath = SECRET_FILE;
