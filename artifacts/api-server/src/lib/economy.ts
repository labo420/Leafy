export const XP_TO_LEA_RATE = 0.01;
export const LEA_TO_EUR_RATE = 1.0;

export function xpToLea(xp: number): number {
  return Math.round(xp * XP_TO_LEA_RATE * 100) / 100;
}

export function leaToEur(lea: number): number {
  return Math.round(lea * LEA_TO_EUR_RATE * 100) / 100;
}
