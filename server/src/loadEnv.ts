import { config as dotenv } from "dotenv";
import { resolve } from "node:path";
import { existsSync } from "node:fs";

/**
 * Laster .env fra server/ hvis den finnes, ellers fra ../.env (prosjektrot).
 * Kjør denne så tidlig som mulig (før andre imports som bruker process.env).
 */
function loadEnv(): string {
  const serverEnv = resolve(process.cwd(), ".env");
  const rootEnv = resolve(process.cwd(), "../.env");
  if (existsSync(serverEnv)) { dotenv({ path: serverEnv }); return serverEnv; }
  if (existsSync(rootEnv))  { dotenv({ path: rootEnv  }); return rootEnv;  }
  dotenv(); // fallback (standard søk)
  return "(default search path)";
}

export const envFileUsed = loadEnv();
