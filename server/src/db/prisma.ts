import { PrismaClient } from "@prisma/client";
export const prisma = new PrismaClient();

// Valgfritt: sett WAL for bedre crash-sikkerhet
export async function initPrisma() {
  await prisma.$connect();
  try {
    await prisma.$executeRawUnsafe(`PRAGMA journal_mode = WAL;`);
  } catch {/* ignorer */}
}
