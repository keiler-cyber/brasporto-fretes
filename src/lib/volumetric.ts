'use client';

// Fator de cubagem aéreo padrão internacional: 1 m³ = 166.67 kg
export const AIR_CUBAGE_FACTOR = 166.67;

/**
 * Calcula o peso cubado (peso taxado) a partir das dimensões em metros.
 * Formula: peso_cubado_kg = comprimento_m * largura_m * altura_m * 166.67
 */
export function volumetricWeightFromDimensions(
  lengthMeters: number,
  widthMeters: number,
  heightMeters: number
): number {
  if (!lengthMeters || !widthMeters || !heightMeters) return 0;
  const volume = lengthMeters * widthMeters * heightMeters; // m³
  return volume * AIR_CUBAGE_FACTOR;
}

/**
 * Calcula o peso cubado a partir do volume em metros cúbicos.
 */
export function volumetricWeightFromVolume(volumeM3: number): number {
  if (!volumeM3 || volumeM3 <= 0) return 0;
  return volumeM3 * AIR_CUBAGE_FACTOR;
}

/**
 * Retorna o peso taxado considerando peso bruto e peso cubado (prevalece o maior).
 */
export function billedWeight(grossWeightKg: number | undefined, volumeM3: number | undefined) {
  const gross = grossWeightKg || 0;
  const cubed = volumetricWeightFromVolume(volumeM3 || 0);
  return Math.max(gross, cubed);
}
