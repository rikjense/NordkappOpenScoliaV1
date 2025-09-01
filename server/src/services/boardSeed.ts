// server/src/services/boardSeed.ts
import { prisma } from "../db/prisma";
import { encryptToken } from "./crypto";

type Seeded = { id: string; name?: string };

export async function seedBoardsFromEnv(): Promise<Seeded[]> {
  const updated: Seeded[] = [];
  for (let i = 1; i <= 8; i++) {
    const name = process.env[`BOARD_${i}_NAME` as const];
    const serial = process.env[`BOARD_${i}_SERIAL` as const];
    const token = process.env[`BOARD_${i}_TOKEN` as const];

    if (!name && !serial && !token) continue;

    const id = `board-${i}`;
    await prisma.board.upsert({
      where: { id },
      create: {
        id,
        name: name || `Board ${i}`,
        serialNumber: serial || null,
        accessTokenEnc: token ? encryptToken(token) : null,
      },
      update: {
        name: name ?? undefined,
        serialNumber: serial ?? undefined,
        accessTokenEnc: token ? encryptToken(token) : undefined,
      },
    });
    updated.push({ id, name: name || undefined });
  }
  return updated;
}
