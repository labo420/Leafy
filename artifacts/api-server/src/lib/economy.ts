export const XP_TO_LEA_RATE = 0.01;

export function xpToLea(xp: number): number {
  return Math.round(xp * XP_TO_LEA_RATE * 100) / 100;
}

export function leaToEur(lea: number): number {
  return lea;
}
