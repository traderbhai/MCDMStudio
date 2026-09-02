import type { Criterion, DecisionMatrix, OutputTable, RankingRow } from '../types';

export const round = (value: number, digits = 4) => Number(value.toFixed(digits));

export function normalizeWeights(criteria: Criterion[]): Criterion[] {
  const total = criteria.reduce((sum, criterion) => sum + criterion.weight, 0);
  if (total <= 0) return criteria.map((criterion) => ({ ...criterion, weight: 1 / criteria.length }));
  return criteria.map((criterion) => ({ ...criterion, weight: criterion.weight / total }));
}

export function vectorNormalize(matrix: number[][]): number[][] {
  const divisors = matrix[0].map((_, column) => Math.sqrt(matrix.reduce((sum, row) => sum + row[column] ** 2, 0)));
  return matrix.map((row) => row.map((value, column) => value / (divisors[column] || 1)));
}

export function minMaxNormalize(input: DecisionMatrix): number[][] {
  return input.values.map((row) =>
    row.map((value, column) => {
      const values = input.values.map((item) => item[column]);
      const min = Math.min(...values);
      const max = Math.max(...values);
      if (max === min) return 1;
      if (input.criteria[column].direction === 'cost') {
        if (min <= 0 || value <= 0) return (max - value) / (max - min);
        return min / value;
      }
      if (max <= 0 || value < 0) return (value - min) / (max - min);
      return value / max;
    }),
  );
}

export function weighted(matrix: number[][], criteria: Criterion[]): number[][] {
  const normalizedCriteria = normalizeWeights(criteria);
  return matrix.map((row) => row.map((value, column) => value * normalizedCriteria[column].weight));
}

export function tableFromMatrix(id: string, title: string, matrix: number[][], input: DecisionMatrix): OutputTable {
  return {
    id,
    title,
    columns: ['Alternative', ...input.criteria.map((criterion) => criterion.id)],
    rows: matrix.map((row, index) => [
      input.alternatives[index].name,
      ...row.map((value) => round(value)),
    ]),
  };
}

export function rankScores(scores: number[], input: DecisionMatrix, higherIsBetter = true): RankingRow[] {
  return scores
    .map((score, index) => ({
      alternativeId: input.alternatives[index].id,
      alternative: input.alternatives[index].name,
      score,
    }))
    .sort((a, b) => (higherIsBetter ? b.score - a.score : a.score - b.score))
    .map((row, index) => ({ ...row, rank: index + 1, score: round(row.score) }));
}

export function rankingTable(ranking: RankingRow[]): OutputTable {
  return {
    id: 'ranking',
    title: 'Final Ranking',
    columns: ['Rank', 'Alternative', 'Score'],
    rows: ranking.map((row) => [row.rank, row.alternative, row.score]),
  };
}

export function distance(a: number[], b: number[]): number {
  return Math.sqrt(a.reduce((sum, value, index) => sum + (value - b[index]) ** 2, 0));
}

export function sensitivityTable(input: DecisionMatrix, baseRanking: RankingRow[]): OutputTable {
  const top = baseRanking[0];
  const topScore = top?.score ?? 0;
  return {
    id: 'sensitivity',
    title: 'Sensitivity Analysis',
    columns: ['Criterion', 'Name', 'Base Weight', 'Low Scenario', 'High Scenario', 'Top Alternative', 'Stability Note'],
    rows: input.criteria.map((criterion) => [
      criterion.id,
      criterion.name,
      round(criterion.weight),
      round(Math.max(0, criterion.weight * 0.9)),
      round(criterion.weight * 1.1),
      top.alternative,
      topScore > 0 ? 'Review with +/-10% weight perturbation' : 'Insufficient score spread',
    ]),
  };
}
