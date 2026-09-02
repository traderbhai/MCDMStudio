import type { WeightingId } from '../types';

export interface WeightingMetadata {
  id: WeightingId;
  name: string;
  description: string;
  category: 'manual' | 'objective' | 'pairwise' | 'rank-order';
}

export const weightingMetadata: Record<WeightingId, WeightingMetadata> = {
  manual: { id: 'manual', name: 'Manual', description: 'Use researcher-supplied normalized criterion weights.', category: 'manual' },
  equal: { id: 'equal', name: 'Equal', description: 'Assign every criterion the same weight.', category: 'objective' },
  stddev: { id: 'stddev', name: 'Standard deviation', description: 'Derive weights from criterion dispersion.', category: 'objective' },
  cov: { id: 'cov', name: 'Coefficient of variation', description: 'Derive weights from relative criterion dispersion.', category: 'objective' },
  entropy: { id: 'entropy', name: 'Entropy', description: 'Derive weights from information diversity.', category: 'objective' },
  critic: { id: 'critic', name: 'CRITIC', description: 'Derive weights from contrast intensity and criterion conflict.', category: 'objective' },
  merec: { id: 'merec', name: 'MEREC', description: 'Derive weights from removal-effect changes.', category: 'objective' },
  merecG: { id: 'merecG', name: 'MEREC-G', description: 'Geometric removal-effect objective weighting.', category: 'objective' },
  lopcow: { id: 'lopcow', name: 'LOPCOW', description: 'Logarithmic percentage-change objective weighting.', category: 'objective' },
  wenslo: { id: 'wenslo', name: 'WENSLO', description: 'Objective weighting from envelope-to-slope criterion behavior.', category: 'objective' },
  angular: { id: 'angular', name: 'Angular', description: 'Objective weights from angular separation against a reference vector.', category: 'objective' },
  gini: { id: 'gini', name: 'Gini coefficient', description: 'Objective weights from criterion inequality and dispersion.', category: 'objective' },
  mpsi: { id: 'mpsi', name: 'MPSI', description: 'Modified preference-selection index objective weighting.', category: 'objective' },
  cilos: { id: 'cilos', name: 'CILOS', description: 'Objective loss-of-utility weighting.', category: 'objective' },
  idocriw: { id: 'idocriw', name: 'IDOCRIW', description: 'Integrated entropy and CILOS objective weighting.', category: 'objective' },
  cimas: { id: 'cimas', name: 'CIMAS', description: 'Objective weights from linear normalization and max-min criterion distance.', category: 'objective' },
  ahp: { id: 'ahp', name: 'AHP', description: 'Pairwise comparison priorities with consistency checks.', category: 'pairwise' },
  bwm: { id: 'bwm', name: 'BWM', description: 'Best-worst pairwise comparison weighting.', category: 'pairwise' },
  dibr: { id: 'dibr', name: 'DIBR', description: 'Ranked-criteria interrelationship weighting.', category: 'rank-order' },
  simos: { id: 'simos', name: 'Revised Simos / SRF cards', description: 'Card-based rank-order weighting with blank-card gaps and Z ratio.', category: 'rank-order' },
  swara: { id: 'swara', name: 'SWARA', description: 'Stepwise ratio assessment from ordered criteria.', category: 'rank-order' },
  roc: { id: 'roc', name: 'ROC rank-order', description: 'Rank-order centroid weighting.', category: 'rank-order' },
  fucom: { id: 'fucom', name: 'FUCOM', description: 'Full-consistency rank-order weighting.', category: 'rank-order' },
  lbwa: { id: 'lbwa', name: 'LBWA', description: 'Level-based weighting assessment.', category: 'rank-order' },
  piprecia: { id: 'piprecia', name: 'PIPRECIA', description: 'Pivot pairwise relative criteria importance assessment.', category: 'rank-order' },
  rankSum: { id: 'rankSum', name: 'Rank Sum', description: 'Simple rank-sum weights.', category: 'rank-order' },
  rankReciprocal: { id: 'rankReciprocal', name: 'Rank Reciprocal', description: 'Reciprocal-rank weights.', category: 'rank-order' },
  rancom: { id: 'rancom', name: 'RANCOM', description: 'Rank comparison weighting with ties.', category: 'rank-order' },
};

export function weightingDisplayName(weightingId: WeightingId): string {
  return weightingMetadata[weightingId]?.name ?? weightingId;
}
