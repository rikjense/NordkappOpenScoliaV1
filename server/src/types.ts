/**
 * Utdrag av Scolia Social API v1.2 meldingsformat – brukt for simulator og server.
 * Holder oss nær dokumentet: sektor-strenger, throw payloads, takeout, osv.
 */

export type Sector =
  | "25" | "Bull" | "None"
  | `S${1|2|3|4|5|6|7|8|9|10|11|12|13|14|15|16|17|18|19|20}`
  | `s${1|2|3|4|5|6|7|8|9|10|11|12|13|14|15|16|17|18|19|20}`
  | `D${1|2|3|4|5|6|7|8|9|10|11|12|13|14|15|16|17|18|19|20}`
  | `T${1|2|3|4|5|6|7|8|9|10|11|12|13|14|15|16|17|18|19|20}`;

export type ThrowDetectedPayload = {
  sector: Sector;
  coordinates?: [number, number]; // mm, -250..+250
  angle?: { vertical: number; horizontal: number }; // -90..+90 (deg)
  bounceout?: boolean;
  sectorSuggestions?: Sector[];
  detectionTime?: string; // ISO 8601
};

export type TakeoutStartedPayload = {
  time?: string; // ISO 8601
};

export type TakeoutFinishedPayload = {
  falseTakeout?: boolean;
  time?: string; // ISO 8601
};
