import { prisma } from "../db/prisma.js";
import { encrypt, maskToken } from "../utils/crypto.js";

/**
 * Lagre navn/serial/token for et board. Token lagres kryptert.
 * NB: Vi forholder oss kun til felter som finnes i Board-modellen din
 * (id, name, serialNumber, accessTokenEnc, updatedAt – andre felter røres ikke).
 */
export async function saveBoardAll(params: {
  boardId: string;
  name?: string;
  serialNumber?: string;
  accessToken?: string; // plaintext fra UI
}) {
  const { boardId, name, serialNumber, accessToken } = params;

  const accessTokenEnc =
    typeof accessToken === "string" && accessToken.trim().length > 0
      ? encrypt(accessToken.trim())
      : undefined;

  const exists = await prisma.board.findUnique({ where: { id: boardId } });

  if (!exists) {
    await prisma.board.create({
      data: {
        id: boardId,
        name: name ?? boardId,
        serialNumber: serialNumber ?? null,
        ...(accessTokenEnc !== undefined ? { accessTokenEnc } : {}),
      },
    });
  } else {
    await prisma.board.update({
      where: { id: boardId },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(serialNumber !== undefined ? { serialNumber } : {}),
        ...(accessTokenEnc !== undefined ? { accessTokenEnc } : {}),
      },
    });
  }

  const updated = await prisma.board.findUnique({ where: { id: boardId } });

  return {
    id: updated!.id,
    name: (updated as any).name ?? updated!.id,
    serialNumber: (updated as any).serialNumber ?? null,
    accessTokenMasked: (updated as any).accessTokenEnc
      ? maskToken((updated as any).accessTokenEnc)
      : null,
    updatedAt: (updated as any).updatedAt ?? null,
  };
}

/* ---------- Stubs for gamle imports (hindrer TS-feil i index.ts) ---------- */
/** No-op: hvis index.ts importerer denne, lar vi den bare være tom i dev. */
export async function loadBoardsFromDB(): Promise<void> {
  // Du kan implementere faktisk init her senere (seed fra DB -> runtime).
}
/** No-op: hvis index.ts forventer å koble events til DB, ignorer i dev. */
export function attachEventPersistence(_emitter?: any): void {
  // Koble evt. SSE/event-bus til DB her i en senere iterasjon.
}
