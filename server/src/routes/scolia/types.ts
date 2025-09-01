/**
 * Utdrag av Scolia Social API v1.2 meldingsformat – brukt for simulatoren.
 */

export type Sector =
  | "25" | "Bull" | "None"
  | `S${number}` | `s${number}` | `D${number}` | `T${number}`; // S/s: singel, D: dobbel, T: trippel

export type ThrowDetectedPayload = {
  sector: Sector;
  coordinates?: [number, number]; // mm, -250..+250
  angle?: { vertical: number; horizontal: number }; // -90..+90 (deg)
  bounceout?: boolean;
  sectorSuggestions?: Sector[];
  detectionTime?: string; // ISO
};

export type TakeoutStartedPayload = { time?: string };
export type TakeoutFinishedPayload = { falseTakeout?: boolean; time?: string };
