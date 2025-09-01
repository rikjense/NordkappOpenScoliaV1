
export type EnvBoardConfig = {
  id: string;
  name?: string;
  serialNumber?: string;
  accessToken?: string;
};

function readEnvBoards(): EnvBoardConfig[] {
  const max = Math.min(Number(process.env.SCOLIA_BOARD_COUNT ?? 8), 8);
  const boards: EnvBoardConfig[] = [];
  for (let i = 1; i <= max; i++) {
    const id = process.env[`BOARD_ID_${i}`] ?? `board-${i}`;
    const name = process.env[`BOARD_NAME_${i}`] ?? `Board ${i}`;
    const serialNumber = process.env[`SCOLIA_SERIAL_${i}`];
    const accessToken = process.env[`SCOLIA_ACCESS_TOKEN_${i}`];

    // Preopprett board dersom noe av dette finnes (eller bare lag en “slot”)
    if (serialNumber || accessToken || process.env[`BOARD_ID_${i}`] || process.env[`BOARD_NAME_${i}`]) {
      boards.push({ id, name, serialNumber, accessToken });
    } else {
      // legg likevel inn en default slot, så 1..N finnes fra start
      boards.push({ id, name });
    }
  }
  return boards;
}

const cfg = {
  port: Number(process.env.PORT ?? 4000),
  adminKey: process.env.ADMIN_API_KEY ?? "dev-admin-key",
  scolia: {
    envBoards: readEnvBoards()
  }
};

export type AppConfig = typeof cfg;
export const config: AppConfig = cfg;
export default cfg;
