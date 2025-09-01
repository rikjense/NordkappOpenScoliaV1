import fs from "node:fs";
import path from "node:path";

const DB_DIR = path.resolve(process.cwd(), "db", "prisma");
const DB_FILE = path.join(DB_DIR, "dev.db");
const BACKUP_DIR = path.join(DB_DIR, "backups");

export function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

export function makeBackup() {
  ensureBackupDir();
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const out = path.join(BACKUP_DIR, `dev-${ts}.db`);
  fs.copyFileSync(DB_FILE, out);
  return out;
}

/** Enkelt scheduler: kall denne fra index etter boot hvis du vil tidsbestemte backups. */
export function scheduleBackups(intervalMs = 5 * 60 * 1000, keep = 20) {
  ensureBackupDir();
  setInterval(() => {
    const file = makeBackup();
    // Rydd opp, behold kun 'keep' siste backups
    const files = fs.readdirSync(BACKUP_DIR).filter(x => x.endsWith(".db")).sort().reverse();
    for (const [idx, name] of files.entries()) {
      if (idx >= keep) fs.rmSync(path.join(BACKUP_DIR, name));
    }
    console.log("DB backup:", file);
  }, intervalMs);
}
