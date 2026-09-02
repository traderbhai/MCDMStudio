import type { AnalysisResult, Criterion, DecisionMatrix, Diagnostic, MethodDefinition, StudyConfig } from '../types';
import { distance, minMaxNormalize, normalizeWeights, rankScores, rankingTable, round, sensitivityTable, tableFromMatrix, vectorNormalize, weighted } from './math';
import { createMethodTemplate } from './templates';
import { validateDecisionInput } from './validation';
import { crispFuzzy, defuzzify, divideFuzzyByScalar, fuzzyDistance, fuzzyLabel, geometricMeanFuzzy, reciprocalFuzzy, scaleFuzzy, type FuzzyNumber } from './fuzzy';

function resolveCriteria(input: DecisionMatrix, config: StudyConfig) {
  if (config.weightingId === 'ahp') {
    const pairwise = ahpPairwiseMatrix(config, input.criteria.length);
    const priority = ahpPriority(pairwise);
    return input.criteria.map((criterion, index) => ({ ...criterion, weight: priority.weights[index] }));
  }
  if (config.weightingId === 'equal') {
    return input.criteria.map((criterion) => ({ ...criterion, weight: 1 / input.criteria.length }));
  }
  if (config.weightingId === 'stddev') {
    const normalized = minMaxNormalize(input);
    const deviations = input.criteria.map((_, column) => {
      const values = normalized.map((row) => row[column]);
      const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
      return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
    });
    const total = deviations.reduce((sum, value) => sum + value, 0) || 1;
    return input.criteria.map((criterion, index) => ({ ...criterion, weight: deviations[index] / total }));
  }
  if (config.weightingId === 'cov') {
    const normalized = minMaxNormalize(input);
    const coefficients = input.criteria.map((_, column) => {
      const values = normalized.map((row) => row[column]);
      const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
      const deviation = Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
      return deviation / Math.max(Math.abs(mean), 1e-12);
    });
    const total = coefficients.reduce((sum, value) => sum + value, 0) || 1;
    return input.criteria.map((criterion, index) => ({ ...criterion, weight: coefficients[index] / total }));
  }
  if (config.weightingId === 'entropy') {
    const weights = entropyWeights(input);
    return input.criteria.map((criterion, index) => ({ ...criterion, weight: weights[index] }));
  }
  if (config.weightingId === 'critic') {
    const normalized = minMaxNormalize(input);
    const std = normalized[0].map((_, column) => {
      const values = normalized.map((row) => row[column]);
      const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
      return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
    });
    const contrast = std.map((value, column) => {
      const columnValues = normalized.map((row) => row[column]);
      const correlations = std.map((_, otherColumn) => pearson(columnValues, normalized.map((row) => row[otherColumn])));
      return value * correlations.reduce((sum, correlation) => sum + (1 - correlation), 0);
    });
    const total = contrast.reduce((sum, value) => sum + value, 0) || 1;
    return input.criteria.map((criterion, index) => ({ ...criterion, weight: contrast[index] / total }));
  }
  if (config.weightingId === 'merec') {
    const normalized = merecNormalize(input);
    const criteriaCount = input.criteria.length || 1;
    const performance = normalized.map((row) =>
      Math.log(1 + row.reduce((sum, value) => sum + Math.abs(Math.log(Math.max(value, 1e-12))), 0) / criteriaCount),
    );
    const removalPerformance = normalized.map((row) =>
      row.map((_, removedColumn) =>
        Math.log(1 + row.reduce((sum, value, column) => column === removedColumn ? sum : sum + Math.abs(Math.log(Math.max(value, 1e-12))), 0) / criteriaCount),
      ),
    );
    const effects = input.criteria.map((_, column) =>
      performance.reduce((sum, value, row) => sum + Math.abs(removalPerformance[row][column] - value), 0),
    );
    const total = effects.reduce((sum, value) => sum + value, 0) || 1;
    return input.criteria.map((criterion, index) => ({ ...criterion, weight: effects[index] / total }));
  }
  if (config.weightingId === 'merecG') {
    const weights = merecGeometricWeights(input);
    return input.criteria.map((criterion, index) => ({ ...criterion, weight: weights[index] }));
  }
  if (config.weightingId === 'lopcow') {
    const normalized = minMaxNormalize(input);
    const contrasts = input.criteria.map((_, column) => {
      const values = normalized.map((row) => row[column]);
      const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
      const percentageDeviation = values.reduce((sum, value) => sum + Math.abs(value - mean) / Math.max(mean, 1e-12), 0) / values.length;
      return Math.log(1 + percentageDeviation * 100);
    });
    const total = contrasts.reduce((sum, value) => sum + value, 0) || 1;
    return input.criteria.map((criterion, index) => ({ ...criterion, weight: contrasts[index] / total }));
  }
  if (config.weightingId === 'wenslo') {
    const weights = wensloWeights(input);
    return input.criteria.map((criterion, index) => ({ ...criterion, weight: weights[index] }));
  }
  if (config.weightingId === 'angular') {
    const weights = angularWeights(input);
    return input.criteria.map((criterion, index) => ({ ...criterion, weight: weights[index] }));
  }
  if (config.weightingId === 'gini') {
    const weights = giniWeights(input);
    return input.criteria.map((criterion, index) => ({ ...criterion, weight: weights[index] }));
  }
  if (config.weightingId === 'mpsi') {
    const weights = mpsiWeights(input);
    return input.criteria.map((criterion, index) => ({ ...criterion, weight: weights[index] }));
  }
  if (config.weightingId === 'cilos') {
    const weights = cilosWeights(input);
    return input.criteria.map((criterion, index) => ({ ...criterion, weight: weights[index] }));
  }
  if (config.weightingId === 'idocriw') {
    const entropy = entropyWeights(input);
    const cilos = cilosWeights(input);
    const combined = entropy.map((value, index) => value * cilos[index]);
    const total = combined.reduce((sum, value) => sum + value, 0) || 1;
    return input.criteria.map((criterion, index) => ({ ...criterion, weight: combined[index] / total }));
  }
  if (config.weightingId === 'cimas') {
    const weights = cimasWeights(input);
    return input.criteria.map((criterion, index) => ({ ...criterion, weight: weights[index] }));
  }
  if (config.weightingId === 'bwm') {
    const weights = bwmWeights(input, config);
    return input.criteria.map((criterion, index) => ({ ...criterion, weight: weights[index] }));
  }
  if (config.weightingId === 'dibr') {
    const weights = dibrWeights(input, config);
    return input.criteria.map((criterion, index) => ({ ...criterion, weight: weights[index] }));
  }
  if (config.weightingId === 'simos') {
    const weights = simosWeights(input, config);
    return input.criteria.map((criterion, index) => ({ ...criterion, weight: weights[index] }));
  }
  if (config.weightingId === 'swara') {
    const weights = swaraWeights(input, config);
    return input.criteria.map((criterion, index) => ({ ...criterion, weight: weights[index] }));
  }
  if (config.weightingId === 'roc') {
    const weights = rocWeights(input, config);
    return input.criteria.map((criterion, index) => ({ ...criterion, weight: weights[index] }));
  }
  if (config.weightingId === 'fucom') {
    const weights = fucomWeights(input, config);
    return input.criteria.map((criterion, index) => ({ ...criterion, weight: weights[index] }));
  }
  if (config.weightingId === 'lbwa') {
    const weights = lbwaWeights(input, config);
    return input.criteria.map((criterion, index) => ({ ...criterion, weight: weights[index] }));
  }
  if (config.weightingId === 'piprecia') {
    const weights = pipreciaWeights(input, config);
    return input.criteria.map((criterion, index) => ({ ...criterion, weight: weights[index] }));
  }
  if (config.weightingId === 'rankSum') {
    const weights = rankSumWeights(input, config);
    return input.criteria.map((criterion, index) => ({ ...criterion, weight: weights[index] }));
  }
  if (config.weightingId === 'rankReciprocal') {
    const weights = rankReciprocalWeights(input, config);
    return input.criteria.map((criterion, index) => ({ ...criterion, weight: weights[index] }));
  }
  if (config.weightingId === 'rancom') {
    const weights = rancomWeights(input, config);
    return input.criteria.map((criterion, index) => ({ ...criterion, weight: weights[index] }));
  }
  return normalizeWeights(input.criteria);
}

function parseNumberList(value: unknown, fallbackLength: number, fallbackValue: number): number[] {
  if (Array.isArray(value)) return value.map((item) => Number(item));
  return String(value ?? '')
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item))
    .concat(Array.from({ length: fallbackLength }, () => fallbackValue))
    .slice(0, fallbackLength);
}

function parseCriterionOrder(value: unknown, input: DecisionMatrix): string[] {
  const known = new Set(input.criteria.map((criterion) => criterion.id));
  const parsed = String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => known.has(item));
  const missing = input.criteria.map((criterion) => criterion.id).filter((id) => !parsed.includes(id));
  return [...parsed, ...missing];
}

function parseSimosGroups(value: unknown, input: DecisionMatrix): string[][] {
  const known = new Set(input.criteria.map((criterion) => criterion.id));
  const groups = String(value ?? '')
    .split('|')
    .map((group) => group.split(',').map((item) => item.trim()).filter((item) => known.has(item)))
    .filter((group) => group.length);
  const used = new Set(groups.flat());
  const missing = input.criteria.map((criterion) => criterion.id).filter((id) => !used.has(id));
  return missing.length ? [...groups, missing] : groups;
}

function simosWeights(input: DecisionMatrix, config: StudyConfig): number[] {
  const groups = parseSimosGroups(config.methodParams.simosGroups, input);
  const gaps = parseNumberList(config.methodParams.simosBlankCards, Math.max(groups.length - 1, 0), 0).map((value) => Math.max(0, Math.round(value)));
  const zRatio = Math.max(1, Number(config.methodParams.simosZRatio) || 1);
  if (!groups.length) return input.criteria.map(() => 1 / Math.max(input.criteria.length, 1));
  const positions = [1];
  for (let index = 1; index < groups.length; index += 1) {
    positions[index] = positions[index - 1] + 1 + (gaps[index - 1] ?? 0);
  }
  const minPosition = positions[0];
  const maxPosition = positions[positions.length - 1];
  const unitStep = maxPosition === minPosition ? 0 : (zRatio - 1) / (maxPosition - minPosition);
  const groupWeights = positions.map((position) => 1 + unitStep * (position - minPosition));
  const rawById: Record<string, number> = {};
  groups.forEach((group, groupIndex) => {
    group.forEach((criterionId) => {
      rawById[criterionId] = groupWeights[groupIndex];
    });
  });
  const raw = input.criteria.map((criterion) => rawById[criterion.id] ?? 1);
  const total = raw.reduce((sum, value) => sum + value, 0) || 1;
  return raw.map((value) => value / total);
}

function bwmWeights(input: DecisionMatrix, config: StudyConfig): number[] {
  const criteriaCount = input.criteria.length;
  const bestId = String(config.methodParams.bwmBestCriterion ?? input.criteria[0]?.id ?? '');
  const worstId = String(config.methodParams.bwmWorstCriterion ?? input.criteria[criteriaCount - 1]?.id ?? '');
  const bestIndex = Math.max(0, input.criteria.findIndex((criterion) => criterion.id === bestId));
  const worstIndex = Math.max(0, input.criteria.findIndex((criterion) => criterion.id === worstId));
  const bestToOthers = parseNumberList(config.methodParams.bwmBestToOthers, criteriaCount, 1).map((value) => Math.max(value, 1e-9));
  const othersToWorst = parseNumberList(config.methodParams.bwmOthersToWorst, criteriaCount, 1).map((value) => Math.max(value, 1e-9));
  bestToOthers[bestIndex] = 1;
  othersToWorst[worstIndex] = 1;

  const logTargets = input.criteria.map((_, index) => {
    if (index === bestIndex) return 0;
    if (index === worstIndex) return -Math.log(Math.max(bestToOthers[worstIndex], othersToWorst[bestIndex], 1e-9));
    const fromBest = -Math.log(bestToOthers[index]);
    const fromWorst = Math.log(othersToWorst[index]) - Math.log(Math.max(othersToWorst[bestIndex], 1e-9));
    return (fromBest + fromWorst) / 2;
  });
  let logits = logTargets.map((value) => value - Math.max(...logTargets));
  const objective = (candidate: number[]) => {
    const weights = candidate.map(Math.exp);
    return input.criteria.reduce((maxResidual, _, index) => Math.max(
      maxResidual,
      Math.abs(Math.log(weights[bestIndex] / weights[index]) - Math.log(bestToOthers[index])),
      Math.abs(Math.log(weights[index] / weights[worstIndex]) - Math.log(othersToWorst[index])),
    ), 0);
  };
  let bestScore = objective(logits);
  for (let step = 0.5; step > 0.0005; step *= 0.55) {
    let improved = true;
    while (improved) {
      improved = false;
      for (let index = 0; index < logits.length; index += 1) {
        if (index === bestIndex) continue;
        for (const direction of [-1, 1]) {
          const candidate = logits.map((value, itemIndex) => itemIndex === index ? value + direction * step : value);
          const score = objective(candidate);
          if (score + 1e-10 < bestScore) {
            logits = candidate;
            bestScore = score;
            improved = true;
          }
        }
      }
    }
  }
  const raw = logits.map(Math.exp);
  const total = raw.reduce((sum, value) => sum + value, 0) || 1;
  return raw.map((value) => value / total);
}

function dibrWeights(input: DecisionMatrix, config: StudyConfig): number[] {
  const order = parseCriterionOrder(config.methodParams.dibrOrder, input);
  const ratios = parseNumberList(config.methodParams.dibrAdjacentRatios, Math.max(input.criteria.length - 1, 0), 1).map((value) => Math.max(value, 1e-9));
  const provisionalById: Record<string, number> = {};
  let denominator = 1;
  order.forEach((criterionId, index) => {
    if (index === 0) {
      provisionalById[criterionId] = 1;
      return;
    }
    denominator *= ratios[index - 1] ?? 1;
    provisionalById[criterionId] = 1 / Math.max(denominator, 1e-12);
  });
  const raw = input.criteria.map((criterion) => provisionalById[criterion.id] ?? 1);
  const total = raw.reduce((sum, value) => sum + value, 0) || 1;
  return raw.map((value) => value / total);
}

function swaraWeights(input: DecisionMatrix, config: StudyConfig): number[] {
  const order = parseCriterionOrder(config.methodParams.swaraOrder, input);
  const comparative = parseNumberList(config.methodParams.swaraComparativeImportance, input.criteria.length, 0).map((value) => Math.max(value, 0));
  const provisional: Record<string, number> = {};
  order.forEach((criterionId, index) => {
    if (index === 0) {
      provisional[criterionId] = 1;
      return;
    }
    const previous = provisional[order[index - 1]] ?? 1;
    provisional[criterionId] = previous / (1 + comparative[index]);
  });
  const raw = input.criteria.map((criterion) => provisional[criterion.id] ?? 1);
  const total = raw.reduce((sum, value) => sum + value, 0) || 1;
  return raw.map((value) => value / total);
}

function rocWeights(input: DecisionMatrix, config: StudyConfig): number[] {
  const order = parseCriterionOrder(config.methodParams.rocOrder, input);
  const n = input.criteria.length || 1;
  const weightsById: Record<string, number> = {};
  order.forEach((criterionId, rankIndex) => {
    let weight = 0;
    for (let k = rankIndex + 1; k <= n; k += 1) weight += 1 / k;
    weightsById[criterionId] = weight / n;
  });
  return input.criteria.map((criterion) => weightsById[criterion.id] ?? 1 / n);
}

function smarterRocWeights(input: DecisionMatrix, config: StudyConfig): number[] {
  return rocWeights(input, { ...config, methodParams: { ...config.methodParams, rocOrder: config.methodParams.smarterOrder ?? config.methodParams.rocOrder } });
}

function fucomWeights(input: DecisionMatrix, config: StudyConfig): number[] {
  const order = parseCriterionOrder(config.methodParams.fucomOrder, input);
  const priorities = parseNumberList(config.methodParams.fucomComparativePriorities, Math.max(input.criteria.length - 1, 0), 1).map((value) => Math.max(value, 1e-9));
  const provisional: Record<string, number> = {};
  order.forEach((criterionId, index) => {
    if (index === 0) {
      provisional[criterionId] = 1;
      return;
    }
    const previous = provisional[order[index - 1]] ?? 1;
    provisional[criterionId] = previous / priorities[index - 1];
  });
  const raw = input.criteria.map((criterion) => provisional[criterion.id] ?? 1);
  const total = raw.reduce((sum, value) => sum + value, 0) || 1;
  return raw.map((value) => value / total);
}

function lbwaWeights(input: DecisionMatrix, config: StudyConfig): number[] {
  const levels = parseNumberList(config.methodParams.lbwaLevels, input.criteria.length, 1).map((value) => Math.max(1, Math.round(value)));
  const importance = parseNumberList(config.methodParams.lbwaImportance, input.criteria.length, 0).map((value) => Math.max(0, value));
  const elasticity = Math.max(1, Number(config.methodParams.lbwaElasticity ?? 5) || 5);
  const raw = levels.map((level, index) => {
    const position = importance[index] ?? 0;
    if (level === 1 && position === 0) return 1;
    return elasticity / (level * elasticity + position);
  });
  const total = raw.reduce((sum, value) => sum + value, 0) || 1;
  return raw.map((value) => value / total);
}

function pipreciaWeights(input: DecisionMatrix, config: StudyConfig): number[] {
  const order = parseCriterionOrder(config.methodParams.pipreciaOrder, input);
  const significance = parseNumberList(config.methodParams.pipreciaRelativeSignificance, input.criteria.length, 1).map((value) => Math.max(0.0001, Math.min(1.9999, value)));
  const qById: Record<string, number> = {};
  order.forEach((criterionId, index) => {
    if (index === 0) {
      qById[criterionId] = 1;
      return;
    }
    const k = Math.max(0.0001, 2 - significance[index]);
    qById[criterionId] = (qById[order[index - 1]] ?? 1) / k;
  });
  const raw = input.criteria.map((criterion) => qById[criterion.id] ?? 1);
  const total = raw.reduce((sum, value) => sum + value, 0) || 1;
  return raw.map((value) => value / total);
}

function rankSumWeights(input: DecisionMatrix, config: StudyConfig): number[] {
  const order = parseCriterionOrder(config.methodParams.rankSumOrder, input);
  const n = input.criteria.length || 1;
  const denominator = (n * (n + 1)) / 2 || 1;
  const weightsById: Record<string, number> = {};
  order.forEach((criterionId, rankIndex) => {
    weightsById[criterionId] = (n - rankIndex) / denominator;
  });
  return input.criteria.map((criterion) => weightsById[criterion.id] ?? 1 / n);
}

function rankReciprocalWeights(input: DecisionMatrix, config: StudyConfig): number[] {
  const order = parseCriterionOrder(config.methodParams.rankReciprocalOrder, input);
  const reciprocalSum = order.reduce((sum, _, rankIndex) => sum + 1 / (rankIndex + 1), 0) || 1;
  const weightsById: Record<string, number> = {};
  order.forEach((criterionId, rankIndex) => {
    weightsById[criterionId] = (1 / (rankIndex + 1)) / reciprocalSum;
  });
  return input.criteria.map((criterion) => weightsById[criterion.id] ?? 1 / input.criteria.length);
}

function rancomWeights(input: DecisionMatrix, config: StudyConfig): number[] {
  const ranks = parseNumberList(config.methodParams.rancomRanks, input.criteria.length, 1).map((value) => Math.max(1, value));
  const scores = input.criteria.map((_, rowIndex) =>
    input.criteria.reduce((sum, __, columnIndex) => {
      if (ranks[rowIndex] < ranks[columnIndex]) return sum + 1;
      if (ranks[rowIndex] === ranks[columnIndex]) return sum + 0.5;
      return sum;
    }, 0),
  );
  const total = scores.reduce((sum, value) => sum + value, 0) || 1;
  return scores.map((value) => value / total);
}

function entropyWeights(input: DecisionMatrix): number[] {
  const normalized = input.values[0].map((_, column) => {
    const total = input.values.reduce((sum, row) => sum + Math.abs(row[column]), 0) || 1;
    return input.values.map((row) => Math.abs(row[column]) / total);
  });
  const k = 1 / Math.log(input.values.length);
  const entropy = normalized.map((column) => -k * column.reduce((sum, value) => sum + (value > 0 ? value * Math.log(value) : 0), 0));
  const diversity = entropy.map((value) => 1 - value);
  const total = diversity.reduce((sum, value) => sum + value, 0) || 1;
  return diversity.map((value) => value / total);
}

function cilosWeights(input: DecisionMatrix): number[] {
  const normalized = minMaxNormalize(input);
  const losses = input.criteria.map((_, column) => {
    const columnValues = normalized.map((row) => row[column]);
    const best = Math.max(...columnValues, 1e-12);
    return columnValues.reduce((sum, value) => sum + (best - value) / best, 0);
  });
  const total = losses.reduce((sum, value) => sum + value, 0) || 1;
  return losses.map((value) => value / total);
}

function merecNormalize(input: DecisionMatrix): number[][] {
  return input.values.map((row) =>
    row.map((value, column) => {
      const values = input.values.map((item) => Math.max(Math.abs(item[column]), 1e-12));
      const safeValue = Math.max(Math.abs(value), 1e-12);
      if (input.criteria[column].direction === 'benefit') return Math.min(...values) / safeValue;
      return safeValue / Math.max(...values);
    }),
  );
}

function geometricMean(values: number[]): number {
  if (!values.length) return 0;
  return Math.exp(values.reduce((sum, value) => sum + Math.log(Math.max(value, 1e-12)), 0) / values.length);
}

function merecGeometricWeights(input: DecisionMatrix): number[] {
  const normalized = merecNormalize(input);
  const overall = normalized.map((row) => geometricMean(row));
  const effects = input.criteria.map((_, removedColumn) =>
    normalized.reduce((sum, row, rowIndex) => {
      const remaining = row.filter((__, column) => column !== removedColumn);
      const removedPerformance = geometricMean(remaining);
      return sum + Math.abs(removedPerformance - overall[rowIndex]);
    }, 0),
  );
  const total = effects.reduce((sum, value) => sum + value, 0) || 1;
  return effects.map((value) => value / total);
}

function wensloWeights(input: DecisionMatrix): number[] {
  const alternativesCount = input.alternatives.length;
  if (!alternativesCount || !input.criteria.length) return [];
  const ratios = input.criteria.map((_, column) => {
    const rawValues = input.values.map((row) => Number(row[column])).filter(Number.isFinite);
    if (rawValues.length !== alternativesCount) return 0;
    const minRaw = Math.min(...rawValues);
    const positiveValues = rawValues.map((value) => value + (minRaw <= 0 ? Math.abs(minRaw) + 1e-9 : 0));
    const total = positiveValues.reduce((sum, value) => sum + value, 0);
    if (!Number.isFinite(total) || total <= 0) return 0;
    const z = positiveValues.map((value) => value / total);
    const range = Math.max(...z) - Math.min(...z);
    if (range <= 1e-12 || alternativesCount <= 1) return 0;
    const classInterval = range / (1 + 3.322 * Math.log10(alternativesCount));
    if (!Number.isFinite(classInterval) || classInterval <= 1e-12) return 0;
    const envelope = z.slice(0, -1).reduce((sum, value, index) =>
      sum + Math.sqrt((z[index + 1] - value) ** 2 + classInterval ** 2), 0);
    const slope = z.reduce((sum, value) => sum + value, 0) / ((alternativesCount - 1) * classInterval);
    return slope > 0 ? envelope / slope : 0;
  });
  const totalRatio = ratios.reduce((sum, value) => sum + value, 0);
  if (!Number.isFinite(totalRatio) || totalRatio <= 0) return input.criteria.map(() => 1 / input.criteria.length);
  return ratios.map((value) => value / totalRatio);
}

function angularWeights(input: DecisionMatrix): number[] {
  const normalized = minMaxNormalize(input);
  const alternativesCount = normalized.length;
  if (!alternativesCount || !input.criteria.length) return [];
  const referenceNorm = Math.sqrt(alternativesCount * (1 / alternativesCount) ** 2);
  const angles = input.criteria.map((_, column) => {
    const values = normalized.map((row) => Math.max(row[column], 0));
    const dot = values.reduce((sum, value) => sum + value / alternativesCount, 0);
    const norm = Math.sqrt(values.reduce((sum, value) => sum + value ** 2, 0));
    if (!Number.isFinite(norm) || norm <= 1e-12 || referenceNorm <= 1e-12) return 0;
    const cosine = Math.max(-1, Math.min(1, dot / (norm * referenceNorm)));
    return Math.acos(cosine);
  });
  const total = angles.reduce((sum, value) => sum + value, 0);
  if (!Number.isFinite(total) || total <= 1e-12) return input.criteria.map(() => 1 / input.criteria.length);
  return angles.map((value) => value / total);
}

function giniWeights(input: DecisionMatrix): number[] {
  const normalized = minMaxNormalize(input);
  if (!normalized.length || !input.criteria.length) return [];
  const coefficients = input.criteria.map((_, column) => {
    const values = normalized.map((row) => Math.max(row[column], 0));
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    if (!Number.isFinite(mean) || Math.abs(mean) <= 1e-12) return 0;
    const pairwiseDifference = values.reduce((outer, value) =>
      outer + values.reduce((inner, other) => inner + Math.abs(value - other), 0), 0);
    return pairwiseDifference / (2 * values.length ** 2 * mean);
  });
  const total = coefficients.reduce((sum, value) => sum + value, 0);
  if (!Number.isFinite(total) || total <= 1e-12) return input.criteria.map(() => 1 / input.criteria.length);
  return coefficients.map((value) => value / total);
}

function mpsiWeights(input: DecisionMatrix): number[] {
  const normalized = input.values.map((row) => row.map((value, column) => {
    const columnValues = input.values.map((item) => item[column]).filter(Number.isFinite);
    const safeValue = Math.max(Math.abs(value), 1e-12);
    if (!columnValues.length) return 0;
    if (input.criteria[column].direction === 'cost') {
      const min = Math.min(...columnValues.map((item) => Math.max(Math.abs(item), 1e-12)));
      return min / safeValue;
    }
    const max = Math.max(...columnValues.map((item) => Math.abs(item)), 1e-12);
    return Math.abs(value) / max;
  }));
  const variations = input.criteria.map((_, column) => {
    const values = normalized.map((row) => row[column]);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    return values.reduce((sum, value) => sum + (value - mean) ** 2, 0);
  });
  const total = variations.reduce((sum, value) => sum + value, 0);
  if (!Number.isFinite(total) || total <= 1e-12) return input.criteria.map(() => 1 / input.criteria.length);
  return variations.map((value) => value / total);
}

function cimasWeights(input: DecisionMatrix): number[] {
  const normalized = minMaxNormalize(input);
  if (!normalized.length || !input.criteria.length) return [];
  const distances = input.criteria.map((_, column) => {
    const values = normalized.map((row) => row[column]);
    return Math.max(...values) - Math.min(...values);
  });
  const total = distances.reduce((sum, value) => sum + value, 0);
  if (!Number.isFinite(total) || total <= 1e-12) return input.criteria.map(() => 1 / input.criteria.length);
  return distances.map((value) => value / total);
}

function pearson(a: number[], b: number[]): number {
  const meanA = a.reduce((sum, value) => sum + value, 0) / a.length;
  const meanB = b.reduce((sum, value) => sum + value, 0) / b.length;
  const numerator = a.reduce((sum, value, index) => sum + (value - meanA) * (b[index] - meanB), 0);
  const denominatorA = Math.sqrt(a.reduce((sum, value) => sum + (value - meanA) ** 2, 0));
  const denominatorB = Math.sqrt(b.reduce((sum, value) => sum + (value - meanB) ** 2, 0));
  const denominator = denominatorA * denominatorB;
  return denominator ? numerator / denominator : 0;
}

function fuzzyDiagnosticValue(method: MethodDefinition, input: DecisionMatrix): string {
  const count = input.fuzzyCellCount ?? 0;
  if (!count) return '';
  const countLabel = `${count} fuzzy cell${count === 1 ? '' : 's'}`;
  if (method.fuzzySupport.mode === 'native-fuzzy') {
    return `${countLabel} handled by the selected fuzzy workflow; native fuzzy runs preserve triangular/trapezoidal values through method-specific fuzzy tables.`;
  }
  return `${countLabel} converted to crisp values by centroid before analysis.`;
}

function respondentDisagreement(matrices: number[][][], aggregated: number[][]) {
  let total = 0;
  let max = 0;
  let count = 0;
  matrices.forEach((matrix) => {
    matrix.forEach((row, rowIndex) => {
      row.forEach((value, columnIndex) => {
        const reference = aggregated[rowIndex]?.[columnIndex];
        if (Number.isFinite(value) && Number.isFinite(reference)) {
          const disagreement = Math.abs(value - reference);
          total += disagreement;
          max = Math.max(max, disagreement);
          count += 1;
        }
      });
    });
  });
  return { mean: count ? total / count : 0, max };
}

function relativeDisagreement(meanDisagreement: number, values: number[][]) {
  const flat = values.flat().filter(Number.isFinite);
  if (!flat.length) return 0;
  const span = Math.max(...flat) - Math.min(...flat);
  const meanMagnitude = flat.reduce((sum, value) => sum + Math.abs(value), 0) / flat.length;
  return meanDisagreement / Math.max(span, meanMagnitude, 1e-12);
}

function consensusLevel(relative: number) {
  if (relative <= 0.05) return 'Strong consensus';
  if (relative <= 0.15) return 'Moderate consensus';
  return 'Review respondent disagreement';
}

function matrixHeatmapVisualization(input: DecisionMatrix, tables: AnalysisResult['tables']): AnalysisResult['visualizations'][number] {
  const sourceTable = tables.find((table) =>
    /normalized|weighted|transformed|utility|assessment|coefficient|matrix/i.test(table.title)
      && table.rows.some((row) => row.slice(1).some((cell) => Number.isFinite(Number(cell)))),
  );
  const criteriaIds = input.criteria.map((criterion) => criterion.id);
  const data = sourceTable
    ? sourceTable.rows.flatMap((row) => {
      const alternative = String(row[0] ?? '');
      return criteriaIds.map((criterion, index) => ({
        alternative,
        criterion,
        value: round(Number(row[index + 1])),
      })).filter((item) => item.alternative && Number.isFinite(item.value));
    })
    : input.values.flatMap((row, rowIndex) =>
      row.map((value, columnIndex) => ({
        alternative: input.alternatives[rowIndex]?.name ?? input.alternatives[rowIndex]?.id ?? `A${rowIndex + 1}`,
        criterion: input.criteria[columnIndex]?.id ?? `C${columnIndex + 1}`,
        value: round(value),
      })).filter((item) => Number.isFinite(item.value)),
    );
  return {
    id: 'matrix-heatmap',
    title: sourceTable ? `${sourceTable.title} Heatmap` : 'Decision Matrix Heatmap',
    type: 'matrix-heatmap',
    data,
  };
}

function result(method: MethodDefinition, input: DecisionMatrix, tables: AnalysisResult['tables'], scores: number[], narrative: string, higherIsBetter = true): AnalysisResult {
  const ranking = rankScores(scores, input, higherIsBetter);
  const appliedWeights = normalizeWeights(input.criteria);
  const weightTable = {
    id: 'applied-criteria-weights',
    title: 'Applied Criteria Weights',
    columns: ['Criterion', 'Name', 'Direction', 'Applied Weight'],
    rows: appliedWeights.map((criterion) => [criterion.id, criterion.name, criterion.direction, round(criterion.weight)]),
  };
  const diagnostics: Diagnostic[] = [
    { label: 'Data completeness', value: '100%', status: 'pass' },
    { label: 'Weight handling', value: `Applied ${appliedWeights.length} normalized criteria weights`, status: 'pass' },
    { label: 'Ranking', value: `${ranking.length} alternatives ranked`, status: 'pass' },
    ...(input.groupAggregation ? [{ label: 'Respondent aggregation', value: `${input.groupAggregation.sourceCount} matrix${input.groupAggregation.sourceCount === 1 ? '' : 'es'} aggregated by ${input.groupAggregation.aggregation}; ${input.groupAggregation.consensusLevel}; mean absolute disagreement ${round(input.groupAggregation.meanAbsoluteDisagreement)}`, status: input.groupAggregation.consensusLevel.startsWith('Review') ? 'warn' as const : 'pass' as const }] : []),
    ...(input.fuzzyCellCount ? [{ label: 'Fuzzy input handling', value: fuzzyDiagnosticValue(method, input), status: 'pass' as const }] : []),
  ];
  const respondentTables: AnalysisResult['tables'] = input.groupAggregation ? [{
    id: 'respondent-aggregation',
    title: 'Respondent Aggregation Summary',
    columns: ['Respondent matrices', 'Aggregation', 'Applied data', 'Mean absolute disagreement', 'Max absolute disagreement', 'Relative disagreement', 'Consensus level', 'Fuzzy tuple handling'],
    rows: [[
      input.groupAggregation.sourceCount,
      input.groupAggregation.aggregation,
      input.groupAggregation.appliedData,
      round(input.groupAggregation.meanAbsoluteDisagreement),
      round(input.groupAggregation.maxAbsoluteDisagreement),
      round(input.groupAggregation.relativeDisagreement),
      input.groupAggregation.consensusLevel,
      input.groupAggregation.fuzzyTupleAggregation ?? 'Not used',
    ]],
  }] : [];
  const analysis: AnalysisResult = {
    methodId: method.id,
    methodName: method.name,
    input,
    tables: [...respondentTables, ...tables, weightTable, rankingTable(ranking)],
    ranking,
    diagnostics,
    narrative,
    reproducibility: {
      method: method.id,
      alternatives: input.alternatives.length,
      criteria: input.criteria.length,
      respondentMatrices: input.groupAggregation?.sourceCount ?? input.respondentMatrices?.length ?? 0,
      respondentAggregation: input.groupAggregation?.aggregation ?? 'Not used',
      respondentMeanAbsoluteDisagreement: input.groupAggregation ? round(input.groupAggregation.meanAbsoluteDisagreement) : 0,
      respondentMaxAbsoluteDisagreement: input.groupAggregation ? round(input.groupAggregation.maxAbsoluteDisagreement) : 0,
      respondentRelativeDisagreement: input.groupAggregation ? round(input.groupAggregation.relativeDisagreement) : 0,
      respondentConsensusLevel: input.groupAggregation?.consensusLevel ?? 'Not used',
      fuzzyCellCount: input.fuzzyCellCount ?? 0,
      fuzzyTypes: input.fuzzyTypes ?? [],
      fuzzyMode: method.fuzzySupport.mode,
      declaredParameters: method.specificationFields.reduce<Record<string, string | number>>((params, field) => {
        params[field.key] = field.defaultValue;
        return params;
      }, {}),
      generatedAt: new Date().toISOString(),
    },
    visualizations: [
      { id: 'ranking-bar', title: 'Ranking Bar Chart', type: 'ranking-bar', data: ranking.map((row) => ({ alternative: row.alternative, score: row.score, rank: row.rank })) },
      { id: 'weight-bar', title: 'Criteria Weights', type: 'weight-bar', data: appliedWeights.map((criterion) => ({ criterion: criterion.id, weight: round(criterion.weight) })) },
      matrixHeatmapVisualization(input, tables),
    ],
  };
  const sensitivity = sensitivityTable(input, ranking);
  analysis.tables.push(sensitivity);
  analysis.visualizations.push({
    id: 'sensitivity-band',
    title: 'Weight Perturbation Band',
    type: 'sensitivity-band',
    data: sensitivity.rows.map((row) => ({
      criterion: String(row[0]),
      name: String(row[1]),
      baseWeight: Number(row[2]),
      lowScenario: Number(row[3]),
      highScenario: Number(row[4]),
      topAlternative: String(row[5]),
    })),
  });
  return analysis;
}

const nativeFuzzyExtensionLabels: Record<string, { label: string; note: string }> = {
  srp: { label: 'Native fuzzy SRP', note: 'SRP can run centroid-defuzzified crisp ranking or native fuzzy SRP using fuzzy criterion-wise ordering and weighted rank aggregation.' },
  fuca: { label: 'Native fuzzy FUCA', note: 'FUCA can run centroid-defuzzified crisp ranking or native fuzzy FUCA using fuzzy criterion-wise ordering and lower-is-better weighted rank scores.' },
  seca: { label: 'Native fuzzy SECA', note: 'SECA can run centroid-defuzzified crisp weighting or native fuzzy SECA with fuzzy normalization and centroid-projected objective weight references.' },
  dear: { label: 'Native fuzzy DEAR', note: 'DEAR can run centroid-defuzzified crisp response scoring or native fuzzy DEAR with fuzzy response weights and weighted fuzzy MRPI tables.' },
  eamr: { label: 'Native fuzzy EAMR', note: 'EAMR can run centroid-defuzzified crisp appraisal or native fuzzy EAMR with fuzzy blended normalization and benefit-cost appraisal.' },
  rawec: { label: 'Native fuzzy RAWEC', note: 'RAWEC can run centroid-defuzzified crisp deviation scoring or native fuzzy RAWEC with fuzzy dual normalization and weighted deviation tables.' },
  arlon: { label: 'Native fuzzy ARLON', note: 'ARLON can run centroid-defuzzified crisp log normalization or native fuzzy ARLON with component-wise fuzzy logarithmic normalization.' },
  macont: { label: 'Native fuzzy MACONT', note: 'MACONT can run centroid-defuzzified crisp mixed aggregation or native fuzzy MACONT with fuzzy comprehensive normalization and reference-deviation tables.' },
  mara: { label: 'Native fuzzy MARA', note: 'MARA can run centroid-defuzzified crisp area-gap scoring or native fuzzy MARA with fuzzy normalized, weighted, and optimal-area evidence.' },
  raps: { label: 'Native fuzzy RAPS', note: 'RAPS can run centroid-defuzzified crisp perimeter scoring or native fuzzy RAPS with fuzzy normalized, weighted, and perimeter-similarity evidence.' },
  oreste: { label: 'Native fuzzy ORESTE', note: 'ORESTE can run centroid-defuzzified crisp rank projection or native fuzzy ORESTE using fuzzy criterion-wise alternative ranks.' },
  qualiflex: { label: 'Native fuzzy QUALIFLEX', note: 'QUALIFLEX can run centroid-defuzzified crisp outranking or native fuzzy QUALIFLEX with fuzzy pairwise concordance and discordance evidence.' },
  regime: { label: 'Native fuzzy REGIME', note: 'REGIME can run centroid-defuzzified crisp dominance or native fuzzy REGIME with fuzzy weighted sign-dominance flows.' },
  evamix: { label: 'Native fuzzy EVAMIX', note: 'EVAMIX can run centroid-defuzzified crisp mixed-data appraisal or native fuzzy EVAMIX with fuzzy normalized dominance evidence.' },
  lexicographic: { label: 'Native fuzzy Lexicographic', note: 'Lexicographic ranking can run centroid-defuzzified crisp priority comparison or native fuzzy sequential comparison using fuzzy ordering.' },
  macbeth: { label: 'Native fuzzy MACBETH-style', note: 'MACBETH-style scoring can run centroid-defuzzified categorical value scoring or native fuzzy categorical value assignment from fuzzy normalized values.' },
  espSpotis: { label: 'Native fuzzy ESP-SPOTIS', note: 'ESP-SPOTIS can run centroid-defuzzified target-distance scoring or native fuzzy ESP-SPOTIS using fuzzy distance from the expected solution point.' },
};

function withBase(definition: Omit<MethodDefinition, 'getTemplateSchema' | 'validateWorkbook' | 'fuzzySupport'>): MethodDefinition {
  const fuzzyExtension = nativeFuzzyExtensionLabels[definition.id];
  return {
    ...definition,
    fuzzySupport: fuzzyExtension ? {
      enabled: true,
      mode: 'native-fuzzy',
      nativeModeLabel: fuzzyExtension.label,
      note: fuzzyExtension.note,
    } : definition.id === 'topsis' ? {
      enabled: true,
      mode: 'native-fuzzy',
      nativeModeLabel: 'Native fuzzy TOPSIS',
      note: 'TOPSIS can run either centroid-defuzzified crisp TOPSIS or native fuzzy TOPSIS using triangular/trapezoidal uploaded values.',
    } : definition.id === 'ahp' ? {
      enabled: true,
      mode: 'native-fuzzy',
      nativeModeLabel: 'Native fuzzy AHP',
      note: 'AHP can run centroid-defuzzified pairwise priorities or native fuzzy AHP using fuzzy pairwise geometric means and defuzzified priorities.',
    } : definition.id === 'dematel' ? {
      enabled: true,
      mode: 'native-fuzzy',
      nativeModeLabel: 'Native fuzzy DEMATEL',
      note: 'DEMATEL can run centroid-defuzzified influence analysis or native fuzzy DEMATEL using component-wise fuzzy direct, normalized, and total relation matrices.',
    } : definition.id === 'vikor' ? {
      enabled: true,
      mode: 'native-fuzzy',
      nativeModeLabel: 'Native fuzzy VIKOR',
      note: 'VIKOR can run centroid-defuzzified crisp VIKOR or native fuzzy VIKOR using fuzzy best/worst references and fuzzy-distance regret measures.',
    } : definition.id === 'waspas' ? {
      enabled: true,
      mode: 'native-fuzzy',
      nativeModeLabel: 'Native fuzzy WASPAS',
      note: 'WASPAS can run centroid-defuzzified crisp WASPAS or native fuzzy WASPAS with fuzzy normalized inputs and additive/product utility components.',
    } : definition.id === 'copras' ? {
      enabled: true,
      mode: 'native-fuzzy',
      nativeModeLabel: 'Native fuzzy COPRAS',
      note: 'COPRAS can run centroid-defuzzified crisp COPRAS or native fuzzy COPRAS using fuzzy normalized and weighted benefit/cost components.',
    } : definition.id === 'edas' ? {
      enabled: true,
      mode: 'native-fuzzy',
      nativeModeLabel: 'Native fuzzy EDAS',
      note: 'EDAS can run centroid-defuzzified crisp EDAS or native fuzzy EDAS using fuzzy average solutions and fuzzy-distance appraisal measures.',
    } : definition.id === 'saw' ? {
      enabled: true,
      mode: 'native-fuzzy',
      nativeModeLabel: 'Native fuzzy SAW',
      note: 'SAW/WSM can run centroid-defuzzified crisp scoring or native fuzzy SAW with fuzzy normalized and weighted additive utility.',
    } : definition.id === 'wpm' ? {
      enabled: true,
      mode: 'native-fuzzy',
      nativeModeLabel: 'Native fuzzy WPM',
      note: 'WPM can run centroid-defuzzified crisp scoring or native fuzzy WPM with fuzzy normalized inputs and multiplicative utility.',
    } : definition.id === 'moora' ? {
      enabled: true,
      mode: 'native-fuzzy',
      nativeModeLabel: 'Native fuzzy MOORA',
      note: 'MOORA can run centroid-defuzzified crisp scoring or native fuzzy MOORA with fuzzy ratio normalization and benefit-cost net assessment.',
    } : definition.id === 'aras' ? {
      enabled: true,
      mode: 'native-fuzzy',
      nativeModeLabel: 'Native fuzzy ARAS',
      note: 'ARAS can run centroid-defuzzified crisp scoring or native fuzzy ARAS with fuzzy optimal reference, normalization, weighting, and utility degree.',
    } : definition.id === 'mabac' ? {
      enabled: true,
      mode: 'native-fuzzy',
      nativeModeLabel: 'Native fuzzy MABAC',
      note: 'MABAC can run centroid-defuzzified crisp scoring or native fuzzy MABAC with fuzzy weighted border approximation and distance assessment.',
    } : definition.id === 'marcos' ? {
      enabled: true,
      mode: 'native-fuzzy',
      nativeModeLabel: 'Native fuzzy MARCOS',
      note: 'MARCOS can run centroid-defuzzified crisp scoring or native fuzzy MARCOS with fuzzy ideal/anti-ideal references and utility degrees.',
    } : definition.id === 'cocoso' ? {
      enabled: true,
      mode: 'native-fuzzy',
      nativeModeLabel: 'Native fuzzy CoCoSo',
      note: 'CoCoSo can run centroid-defuzzified crisp scoring or native fuzzy CoCoSo with fuzzy additive/product appraisal and compromise scoring.',
    } : definition.id === 'mairca' ? {
      enabled: true,
      mode: 'native-fuzzy',
      nativeModeLabel: 'Native fuzzy MAIRCA',
      note: 'MAIRCA can run centroid-defuzzified crisp scoring or native fuzzy MAIRCA with fuzzy real assessment and gap scoring.',
    } : definition.id === 'comet' ? {
      enabled: true,
      mode: 'native-fuzzy',
      nativeModeLabel: 'Native fuzzy COMET',
      note: 'COMET can run centroid-defuzzified crisp scoring or native fuzzy COMET with fuzzy uploaded alternatives and centroid characteristic-object interpolation.',
    } : definition.id === 'moosra' ? {
      enabled: true,
      mode: 'native-fuzzy',
      nativeModeLabel: 'Native fuzzy MOOSRA',
      note: 'MOOSRA can run centroid-defuzzified crisp scoring or native fuzzy MOOSRA with fuzzy vector normalization and benefit-cost ratio scoring.',
    } : definition.id === 'ocra' ? {
      enabled: true,
      mode: 'native-fuzzy',
      nativeModeLabel: 'Native fuzzy OCRA',
      note: 'OCRA can run centroid-defuzzified crisp scoring or native fuzzy OCRA with fuzzy weighted benefit/cost preference components.',
    } : definition.id === 'piv' ? {
      enabled: true,
      mode: 'native-fuzzy',
      nativeModeLabel: 'Native fuzzy PIV',
      note: 'PIV can run centroid-defuzzified crisp scoring or native fuzzy PIV with fuzzy weighted normalized values and proximity indices.',
    } : definition.id === 'rov' ? {
      enabled: true,
      mode: 'native-fuzzy',
      nativeModeLabel: 'Native fuzzy ROV',
      note: 'ROV can run centroid-defuzzified crisp scoring or native fuzzy ROV with fuzzy normalized best/worst utility values.',
    } : definition.id === 'wisp' ? {
      enabled: true,
      mode: 'native-fuzzy',
      nativeModeLabel: 'Native fuzzy WISP',
      note: 'WISP can run centroid-defuzzified crisp scoring or native fuzzy WISP with fuzzy weighted sum/product difference and ratio utility components.',
    } : definition.id === 'codas' ? {
      enabled: true,
      mode: 'native-fuzzy',
      nativeModeLabel: 'Native fuzzy CODAS',
      note: 'CODAS can run centroid-defuzzified crisp scoring or native fuzzy CODAS with fuzzy weighted distance and relative assessment from the negative ideal solution.',
    } : definition.id === 'cradis' ? {
      enabled: true,
      mode: 'native-fuzzy',
      nativeModeLabel: 'Native fuzzy CRADIS',
      note: 'CRADIS can run centroid-defuzzified crisp scoring or native fuzzy CRADIS with fuzzy ideal/anti-ideal deviation appraisal.',
    } : definition.id === 'gra' ? {
      enabled: true,
      mode: 'native-fuzzy',
      nativeModeLabel: 'Native fuzzy GRA',
      note: 'GRA can run centroid-defuzzified crisp scoring or native fuzzy GRA with fuzzy-distance grey relational coefficients.',
    } : definition.id === 'grp' ? {
      enabled: true,
      mode: 'native-fuzzy',
      nativeModeLabel: 'Native fuzzy GRP',
      note: 'GRP can run centroid-defuzzified crisp scoring or native fuzzy GRP with fuzzy-distance positive and negative grey relational projections.',
    } : definition.id === 'todim' ? {
      enabled: true,
      mode: 'native-fuzzy',
      nativeModeLabel: 'Native fuzzy TODIM',
      note: 'TODIM can run centroid-defuzzified crisp dominance or native fuzzy TODIM with fuzzy normalized pairwise gain/loss dominance.',
    } : definition.id === 'ram' ? {
      enabled: true,
      mode: 'native-fuzzy',
      nativeModeLabel: 'Native fuzzy RAM',
      note: 'RAM can run centroid-defuzzified crisp scoring or native fuzzy RAM with fuzzy weighted benefit-cost utility components.',
    } : definition.id === 'promethee' ? {
      enabled: true,
      mode: 'native-fuzzy',
      nativeModeLabel: 'Native fuzzy PROMETHEE',
      note: 'PROMETHEE II can run centroid-defuzzified usual preference or native fuzzy PROMETHEE with fuzzy pairwise preference flows.',
    } : definition.id === 'electre' ? {
      enabled: true,
      mode: 'native-fuzzy',
      nativeModeLabel: 'Native fuzzy ELECTRE',
      note: 'ELECTRE I can run centroid-defuzzified crisp outranking or native fuzzy ELECTRE with fuzzy concordance and discordance evidence.',
    } : definition.id === 'smart' ? {
      enabled: true,
      mode: 'native-fuzzy',
      nativeModeLabel: 'Native fuzzy SMART',
      note: 'SMART can run centroid-defuzzified crisp scoring or native fuzzy SMART with fuzzy single-attribute utilities and weighted utility aggregation.',
    } : definition.id === 'multimoora' ? {
      enabled: true,
      mode: 'native-fuzzy',
      nativeModeLabel: 'Native fuzzy MULTIMOORA',
      note: 'MULTIMOORA can run centroid-defuzzified crisp scoring or native fuzzy MULTIMOORA across ratio, reference point, and multiplicative components.',
    } : definition.id === 'psi' ? {
      enabled: true,
      mode: 'native-fuzzy',
      nativeModeLabel: 'Native fuzzy PSI',
      note: 'PSI can run centroid-defuzzified crisp scoring or native fuzzy PSI with fuzzy normalization and objective preference weights from fuzzy variation.',
    } : definition.id === 'maut' ? {
      enabled: true,
      mode: 'native-fuzzy',
      nativeModeLabel: 'Native fuzzy MAUT',
      note: 'MAUT can run centroid-defuzzified crisp scoring or native fuzzy MAUT with fuzzy utility functions and weighted multi-attribute utility aggregation.',
    } : definition.id === 'smarter' ? {
      enabled: true,
      mode: 'native-fuzzy',
      nativeModeLabel: 'Native fuzzy SMARTER',
      note: 'SMARTER can run centroid-defuzzified crisp scoring or native fuzzy SMARTER with fuzzy utilities and ROC-weighted centroid scoring.',
    } : definition.id === 'pugh' ? {
      enabled: true,
      mode: 'native-fuzzy',
      nativeModeLabel: 'Native fuzzy Pugh Matrix',
      note: 'Pugh Matrix can run centroid-defuzzified crisp scoring or native fuzzy Pugh scoring using fuzzy uploaded scores or fuzzy baseline comparisons.',
    } : definition.id === 'spotis' ? {
      enabled: true,
      mode: 'native-fuzzy',
      nativeModeLabel: 'Native fuzzy SPOTIS',
      note: 'SPOTIS can run centroid-defuzzified crisp scoring or native fuzzy SPOTIS with fuzzy distance from observed or manual ideal bounds.',
    } : definition.id === 'balancedSpotis' ? {
      enabled: true,
      mode: 'native-fuzzy',
      nativeModeLabel: 'Native fuzzy B-SPOTIS',
      note: 'B-SPOTIS can run centroid-defuzzified crisp scoring or native fuzzy B-SPOTIS with fuzzy distances from ideal and expected solution points.',
    } : definition.id === 'wedba' ? {
      enabled: true,
      mode: 'native-fuzzy',
      nativeModeLabel: 'Native fuzzy WEDBA',
      note: 'WEDBA can run centroid-defuzzified crisp scoring or native fuzzy WEDBA with fuzzy normalization, standardization, and ideal/anti-ideal distances.',
    } : definition.id === 'lmaw' ? {
      enabled: true,
      mode: 'native-fuzzy',
      nativeModeLabel: 'Native fuzzy LMAW',
      note: 'LMAW can run centroid-defuzzified crisp scoring or native fuzzy LMAW with fuzzy positive standardization and logarithmic additive scoring.',
    } : definition.id === 'dnma' ? {
      enabled: true,
      mode: 'native-fuzzy',
      nativeModeLabel: 'Native fuzzy DNMA',
      note: 'DNMA can run centroid-defuzzified crisp scoring or native fuzzy DNMA with fuzzy target references and double-normalization aggregation.',
    } : definition.id === 'probid' ? {
      enabled: true,
      mode: 'native-fuzzy',
      nativeModeLabel: 'Native fuzzy PROBID',
      note: 'PROBID can run centroid-defuzzified crisp scoring or native fuzzy PROBID with fuzzy ideal, average, and anti-ideal reference distances.',
    } : definition.id === 'sprobid' ? {
      enabled: true,
      mode: 'native-fuzzy',
      nativeModeLabel: 'Native fuzzy SPROBID',
      note: 'SPROBID can run centroid-defuzzified crisp scoring or native fuzzy SPROBID with fuzzy ordered quarter-reference distance aggregation.',
    } : definition.id === 'rim' ? {
      enabled: true,
      mode: 'native-fuzzy',
      nativeModeLabel: 'Native fuzzy RIM',
      note: 'RIM can run centroid-defuzzified crisp scoring or native fuzzy RIM with fuzzy closeness to observed or manual reference ideal intervals.',
    } : definition.id === 'rafsi' ? {
      enabled: true,
      mode: 'native-fuzzy',
      nativeModeLabel: 'Native fuzzy RAFSI',
      note: 'RAFSI can run centroid-defuzzified crisp scoring or native fuzzy RAFSI with fuzzy functional mapping into a common interval.',
    } : definition.id === 'lopm' ? {
      enabled: true,
      mode: 'native-fuzzy',
      nativeModeLabel: 'Native fuzzy LoPM',
      note: 'LoPM can run centroid-defuzzified crisp scoring or native fuzzy LoPM with fuzzy merit penalties against property limits.',
    } : definition.id === 'aroman' ? {
      enabled: true,
      mode: 'native-fuzzy',
      nativeModeLabel: 'Native fuzzy AROMAN',
      note: 'AROMAN can run centroid-defuzzified crisp scoring or native fuzzy AROMAN with fuzzy blended linear and vector normalization.',
    } : definition.id === 'cobra' ? {
      enabled: true,
      mode: 'native-fuzzy',
      nativeModeLabel: 'Native fuzzy COBRA',
      note: 'COBRA can run centroid-defuzzified crisp scoring or native fuzzy COBRA with fuzzy positive ideal, average, and negative ideal distance components.',
    } : definition.id === 'ervd' ? {
      enabled: true,
      mode: 'native-fuzzy',
      nativeModeLabel: 'Native fuzzy ERVD',
      note: 'ERVD can run centroid-defuzzified crisp scoring or native fuzzy ERVD with fuzzy reference utilities and gain/loss distances.',
    } : {
      enabled: true,
      mode: 'defuzzified-input',
      note: 'Triangular and trapezoidal fuzzy values can be entered in upload templates and are defuzzified by centroid before the crisp method run.',
    },
    runAnalysis: (input, config) => definition.runAnalysis(aggregateRespondentInput(input, config), config),
    getTemplateSchema: (config) => createMethodTemplate(definition.id, definition.name, config, definition.parameters),
    validateWorkbook: validateDecisionInput,
  };
}

function aggregateRespondentInput(input: DecisionMatrix, config: StudyConfig): DecisionMatrix {
  if (config.methodId === 'dematel' || !input.respondentMatrices?.length) return input;
  const matrices = input.respondentMatrices.filter((matrix) =>
    matrix.length === input.alternatives.length && matrix.every((row) => row.length === input.criteria.length),
  );
  if (!matrices.length) return input;
  const useGeometric = config.methodParams.respondentAggregation === 'Geometric mean';
  const values = input.alternatives.map((_, rowIndex) =>
    input.criteria.map((__, columnIndex) => {
      const cells = matrices
        .map((matrix) => matrix[rowIndex]?.[columnIndex])
        .filter((value) => Number.isFinite(value));
      if (!cells.length) return Number.NaN;
      if (useGeometric && cells.every((value) => value > 0)) {
        return Math.exp(cells.reduce((sum, value) => sum + Math.log(value), 0) / cells.length);
      }
      return cells.reduce((sum, value) => sum + value, 0) / cells.length;
    }),
  );
  const fuzzyMatrices = input.respondentFuzzyMatrices?.filter((matrix) =>
    matrix.length === input.alternatives.length && matrix.every((row) => row.length === input.criteria.length),
  );
  const fuzzyValues = fuzzyMatrices?.length ? input.alternatives.map((_, rowIndex) =>
    input.criteria.map((__, columnIndex) => {
      const cells = fuzzyMatrices
        .map((matrix) => matrix[rowIndex]?.[columnIndex])
        .filter((value): value is FuzzyNumber => Boolean(value));
      if (!cells.length) return crispFuzzy(values[rowIndex][columnIndex]);
      if (useGeometric && cells.every((cell) => cell.values.every((value) => value > 0))) return geometricMeanFuzzy(cells);
      const size = Math.max(...cells.map((cell) => cell.values.length));
      const aggregated = Array.from({ length: size }, (_, component) =>
        cells.reduce((sum, cell) => {
          const expanded = cell.values.length === size
            ? cell.values
            : cell.values.length === 3 && size === 4
              ? [cell.values[0], cell.values[1], cell.values[1], cell.values[2]]
              : cell.values.length === 4 && size === 3
                ? [cell.values[0], (cell.values[1] + cell.values[2]) / 2, cell.values[3]]
                : Array.from({ length: size }, (___, index) => cell.values[Math.min(index, cell.values.length - 1)] ?? 0);
          return sum + expanded[component];
        }, 0) / cells.length,
      );
      return { values: aggregated, type: size === 4 ? 'trapezoidal' as const : 'triangular' as const };
    }),
  ) : input.fuzzyValues;
  const disagreement = respondentDisagreement(matrices, values);
  const relative = relativeDisagreement(disagreement.mean, values);
  return {
    ...input,
    values,
    fuzzyValues,
    groupAggregation: {
      sourceCount: matrices.length,
      aggregation: useGeometric ? 'Geometric mean' : 'Arithmetic mean',
      appliedData: 'Decision matrix',
      meanAbsoluteDisagreement: disagreement.mean,
      maxAbsoluteDisagreement: disagreement.max,
      relativeDisagreement: relative,
      consensusLevel: consensusLevel(relative),
      fuzzyTupleAggregation: fuzzyMatrices?.length
        ? useGeometric ? 'Fuzzy tuples aggregated by geometric mean where all components are positive' : 'Fuzzy tuple components aggregated by arithmetic mean'
        : 'Not used',
    },
  };
}

function invert(matrix: number[][]): number[][] {
  const n = matrix.length;
  const augmented = matrix.map((row, index) => [...row, ...Array.from({ length: n }, (_, column) => index === column ? 1 : 0)]);
  for (let pivot = 0; pivot < n; pivot += 1) {
    const pivotValue = augmented[pivot][pivot] || 1e-12;
    for (let column = 0; column < 2 * n; column += 1) augmented[pivot][column] /= pivotValue;
    for (let row = 0; row < n; row += 1) {
      if (row === pivot) continue;
      const factor = augmented[row][pivot];
      for (let column = 0; column < 2 * n; column += 1) augmented[row][column] -= factor * augmented[pivot][column];
    }
  }
  return augmented.map((row) => row.slice(n));
}

function multiply(a: number[][], b: number[][]): number[][] {
  return a.map((row) => b[0].map((_, column) => row.reduce((sum, value, index) => sum + value * b[index][column], 0)));
}

function ahpPairwiseMatrix(config: StudyConfig, size: number): number[][] {
  const groupSource = config.ahpCriteriaRespondentPairwise;
  if (groupSource?.length) return aggregatePairwiseMatrices(groupSource, size);
  const source = config.ahpCriteriaPairwise ?? [];
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, column) => {
      if (row === column) return 1;
      const value = Number(source[row]?.[column]);
      const reciprocal = Number(source[column]?.[row]);
      if (Number.isFinite(value) && value > 0) return value;
      if (Number.isFinite(reciprocal) && reciprocal > 0) return 1 / reciprocal;
      return 1;
    }),
  );
}

function aggregatePairwiseMatrices(matrices: number[][][], size: number): number[][] {
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, column) => {
      if (row === column) return 1;
      if (row > column) return 0;
      const values = matrices
        .map((matrix) => Number(matrix[row]?.[column]))
        .filter((value) => Number.isFinite(value) && value > 0);
      const aggregated = values.length
        ? Math.exp(values.reduce((sum, value) => sum + Math.log(value), 0) / values.length)
        : 1;
      return aggregated;
    }),
  ).map((row, rowIndex, matrix) =>
    row.map((value, columnIndex) => {
      if (rowIndex === columnIndex) return 1;
      if (rowIndex < columnIndex) return value;
      const reciprocal = matrix[columnIndex][rowIndex];
      return reciprocal > 0 ? 1 / reciprocal : 1;
    }),
  );
}

function pairwiseToFuzzy(matrix: number[][], size: number): FuzzyNumber[][] {
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, column) => {
      if (row === column) return crispFuzzy(1);
      const value = Number(matrix[row]?.[column]);
      const reciprocal = Number(matrix[column]?.[row]);
      if (Number.isFinite(value) && value > 0) return crispFuzzy(value);
      if (Number.isFinite(reciprocal) && reciprocal > 0) return reciprocalFuzzy(crispFuzzy(reciprocal));
      return crispFuzzy(1);
    }),
  );
}

function aggregateFuzzyPairwiseMatrices(matrices: FuzzyNumber[][][], size: number): FuzzyNumber[][] {
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, column) => {
      if (row === column) return crispFuzzy(1);
      if (row > column) return crispFuzzy(0);
      const values = matrices.map((matrix) => matrix[row]?.[column]).filter((value): value is FuzzyNumber => Boolean(value));
      return geometricMeanFuzzy(values);
    }),
  ).map((row, rowIndex, matrix) =>
    row.map((value, columnIndex) => {
      if (rowIndex === columnIndex) return crispFuzzy(1);
      if (rowIndex < columnIndex) return value;
      return reciprocalFuzzy(matrix[columnIndex][rowIndex]);
    }),
  );
}

function ahpPriority(matrix: number[][]) {
  const size = matrix.length;
  const columnSums = matrix[0].map((_, column) => matrix.reduce((sum, row) => sum + row[column], 0) || 1);
  const normalized = matrix.map((row) => row.map((value, column) => value / columnSums[column]));
  const weights = normalized.map((row) => row.reduce((sum, value) => sum + value, 0) / size);
  const weightedSum = matrix.map((row) => row.reduce((sum, value, column) => sum + value * weights[column], 0));
  const lambdaMax = weightedSum.reduce((sum, value, index) => sum + value / (weights[index] || 1), 0) / size;
  const ci = size <= 2 ? 0 : (lambdaMax - size) / (size - 1);
  const randomIndex: Record<number, number> = { 1: 0, 2: 0, 3: 0.58, 4: 0.9, 5: 1.12, 6: 1.24, 7: 1.32, 8: 1.41, 9: 1.45, 10: 1.49 };
  const cr = size <= 2 ? 0 : ci / (randomIndex[size] ?? 1.49);
  return { normalized, weights, lambdaMax, ci, cr };
}

function fuzzyAhpPairwiseMatrix(config: StudyConfig, size: number): FuzzyNumber[][] {
  if (config.ahpCriteriaRespondentFuzzyPairwise?.length) return aggregateFuzzyPairwiseMatrices(config.ahpCriteriaRespondentFuzzyPairwise, size);
  if (config.ahpCriteriaFuzzyPairwise?.length) return config.ahpCriteriaFuzzyPairwise;
  return pairwiseToFuzzy(ahpPairwiseMatrix(config, size), size);
}

function fuzzyAhpPriority(matrix: FuzzyNumber[][]) {
  const rowGeometricMeans = matrix.map((row) => geometricMeanFuzzy(row));
  const crispMeans = rowGeometricMeans.map(defuzzify);
  const total = crispMeans.reduce((sum, value) => sum + value, 0) || 1;
  const weights = crispMeans.map((value) => value / total);
  const fuzzyPriorities = rowGeometricMeans.map((value) => divideFuzzyByScalar(value, total));
  const crispMatrix = matrix.map((row) => row.map(defuzzify));
  const consistency = ahpPriority(crispMatrix);
  return { rowGeometricMeans, fuzzyPriorities, weights, consistency };
}

function pairwiseFromPerformance(input: DecisionMatrix, criterionIndex: number): number[][] {
  const values = input.values.map((row) => Math.max(Math.abs(row[criterionIndex]), 1e-9));
  return values.map((rowValue, rowIndex) =>
    values.map((columnValue, columnIndex) => {
      if (rowIndex === columnIndex) return 1;
      const ratio = input.criteria[criterionIndex].direction === 'benefit' ? rowValue / columnValue : columnValue / rowValue;
      return Math.min(9, Math.max(1 / 9, ratio));
    }),
  );
}

function alternativePairwise(config: StudyConfig, input: DecisionMatrix, criterionId: string, criterionIndex: number): number[][] {
  const groupSource = config.ahpAlternativeRespondentPairwise?.[criterionId];
  if (groupSource?.length) return aggregatePairwiseMatrices(groupSource, input.alternatives.length);
  const source = config.ahpAlternativePairwise?.[criterionId];
  if (source?.length === input.alternatives.length) return source;
  return pairwiseFromPerformance(input, criterionIndex);
}

function fuzzyAlternativePairwise(config: StudyConfig, input: DecisionMatrix, criterionId: string, criterionIndex: number): FuzzyNumber[][] {
  const groupSource = config.ahpAlternativeRespondentFuzzyPairwise?.[criterionId];
  if (groupSource?.length) return aggregateFuzzyPairwiseMatrices(groupSource, input.alternatives.length);
  const source = config.ahpAlternativeFuzzyPairwise?.[criterionId];
  if (source?.length === input.alternatives.length) return source;
  return pairwiseToFuzzy(alternativePairwise(config, input, criterionId, criterionIndex), input.alternatives.length);
}

function runDematel(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  if (config.methodParams.fuzzyInputMode === 'Native fuzzy DEMATEL') {
    return runFuzzyDematel(input, config, method);
  }
  const sourceMatrices = input.expertMatrices?.length ? input.expertMatrices : [input.values];
  const direct = input.values.map((row, rowIndex) => row.map((_, columnIndex) => {
    if (rowIndex === columnIndex) return 0;
    return sourceMatrices.reduce((sum, matrix) => sum + Number(matrix[rowIndex]?.[columnIndex] ?? 0), 0) / sourceMatrices.length;
  }));
  const expertDisagreement = respondentDisagreement(sourceMatrices, direct);
  const expertRelativeDisagreement = relativeDisagreement(expertDisagreement.mean, direct);
  const expertConsensusLevel = consensusLevel(expertRelativeDisagreement);
  const rowSums = direct.map((row) => row.reduce((sum, value) => sum + Math.abs(value), 0));
  const columnSums = direct[0].map((_, column) => direct.reduce((sum, row) => sum + Math.abs(row[column]), 0));
  const normalizationFactor = Math.max(...rowSums, ...columnSums, 1);
  const normalized = direct.map((row) => row.map((value) => value / normalizationFactor));
  const identity = normalized.map((row, rowIndex) => row.map((_, columnIndex) => rowIndex === columnIndex ? 1 : 0));
  const iMinusN = identity.map((row, rowIndex) => row.map((value, columnIndex) => value - normalized[rowIndex][columnIndex]));
  const total = multiply(normalized, invert(iMinusN));
  const d = total.map((row) => row.reduce((sum, value) => sum + value, 0));
  const r = total[0].map((_, column) => total.reduce((sum, row) => sum + row[column], 0));
  const offDiagonalValues = total.flatMap((row, rowIndex) => row.filter((_, columnIndex) => rowIndex !== columnIndex));
  const meanThreshold = offDiagonalValues.reduce((sum, value) => sum + Math.abs(value), 0) / (offDiagonalValues.length || 1);
  const thresholdMode = String(config.methodParams.dematelThreshold ?? 'Mean threshold');
  const thresholdValue = thresholdMode === 'Manual threshold'
    ? Math.max(0, Number(config.methodParams.dematelManualThreshold ?? meanThreshold) || 0)
    : meanThreshold;
  const thresholded = total.map((row, rowIndex) => row.map((value, columnIndex) => rowIndex === columnIndex ? 0 : Math.abs(value) >= thresholdValue ? value : 0));
  const rows = input.criteria.map((factor, index) => {
    const relation = d[index] - r[index];
    return [factor.id, factor.name, round(d[index]), round(r[index]), round(d[index] + r[index]), round(relation), relation >= 0 ? 'Cause' : 'Effect'];
  });
  const ranking = rows
    .map((row, index) => ({ rank: 0, alternativeId: input.criteria[index].id, alternative: String(row[1]), score: Number(row[4]) }))
    .sort((a, b) => b.score - a.score)
    .map((row, index) => ({ ...row, rank: index + 1, score: round(row.score) }));
  return {
    methodId: method.id,
    methodName: method.name,
    input,
    tables: [
      tableFromMatrix('direct', 'Direct Relation Matrix', direct, input),
      ...(sourceMatrices.length > 1 ? [{
        id: 'expert-aggregation',
        title: 'Expert Aggregation Summary',
        columns: ['Expert matrices', 'Aggregation', 'Mean absolute disagreement', 'Max absolute disagreement', 'Relative disagreement', 'Consensus level'],
        rows: [[sourceMatrices.length, String(config.methodParams.dematelAggregation ?? 'Arithmetic mean'), round(expertDisagreement.mean), round(expertDisagreement.max), round(expertRelativeDisagreement), expertConsensusLevel]],
      }] : []),
      tableFromMatrix('normalized-direct', 'Normalized Direct Relation Matrix', normalized, input),
      tableFromMatrix('total-relation', 'Total Relation Matrix', total, input),
      tableFromMatrix('thresholded-total-relation', 'Thresholded Total Relation Matrix', thresholded, input),
      { id: 'cause-effect', title: 'DEMATEL Cause-Effect Table', columns: ['Factor', 'Name', 'D', 'R', 'D+R', 'D-R', 'Group'], rows },
    ],
    ranking,
    diagnostics: [
      { label: 'Diagonal check', value: 'Zero diagonal enforced', status: 'pass' },
      { label: 'Normalization', value: `Max row/column sum ${round(normalizationFactor)}`, status: 'pass' },
      { label: 'Threshold method', value: `${thresholdMode}: ${round(thresholdValue)}`, status: 'pass' },
      { label: 'Expert aggregation', value: `${sourceMatrices.length} matrix${sourceMatrices.length === 1 ? '' : 'es'} aggregated; ${expertConsensusLevel}; mean absolute disagreement ${round(expertDisagreement.mean)}`, status: expertConsensusLevel.startsWith('Review') ? 'warn' : 'pass' },
    ],
    narrative: 'DEMATEL models causal influence among factors using a direct relation matrix, normalized relation matrix, total relation matrix, and D/R prominence-relation indicators.',
    reproducibility: { method: method.id, factors: input.criteria.length, expertMatrices: sourceMatrices.length, expertMeanAbsoluteDisagreement: round(expertDisagreement.mean), expertMaxAbsoluteDisagreement: round(expertDisagreement.max), expertRelativeDisagreement: round(expertRelativeDisagreement), expertConsensusLevel, dematelNormalizationFactor: round(normalizationFactor), dematelThresholdValue: round(thresholdValue), generatedAt: new Date().toISOString(), params: config.methodParams },
    visualizations: [
      { id: 'dematel-cause-effect', title: 'Cause-Effect Scatter', type: 'dematel-cause-effect', data: rows.map((row) => ({ factor: String(row[0]), prominence: Number(row[4]), relation: Number(row[5]), group: String(row[6]) })) },
      { id: 'matrix-heatmap', title: 'Total Relation Heatmap', type: 'matrix-heatmap', data: total.flatMap((row, rowIndex) => row.map((value, columnIndex) => ({ source: input.criteria[rowIndex].id, target: input.criteria[columnIndex].id, value: round(value) }))) },
    ],
  };
}

function runFuzzyDematel(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  const crispSourceMatrices = input.expertMatrices?.length ? input.expertMatrices : [input.values];
  const sourceFuzzyMatrices = input.expertFuzzyMatrices?.length
    ? input.expertFuzzyMatrices
    : input.fuzzyValues?.length
      ? [input.fuzzyValues]
      : crispSourceMatrices.map((matrix) => matrix.map((row) => row.map((value) => crispFuzzy(value))));
  const directFuzzy = input.criteria.map((_, rowIndex) =>
    input.criteria.map((__, columnIndex) => {
      if (rowIndex === columnIndex) return crispFuzzy(0);
      return averageFuzzy(sourceFuzzyMatrices.map((matrix) => matrix[rowIndex]?.[columnIndex]).filter((value): value is FuzzyNumber => Boolean(value)));
    }),
  );
  const direct = directFuzzy.map((row) => row.map(defuzzify));
  const expertDisagreement = respondentDisagreement(crispSourceMatrices, direct);
  const expertRelativeDisagreement = relativeDisagreement(expertDisagreement.mean, direct);
  const expertConsensusLevel = consensusLevel(expertRelativeDisagreement);
  const fuzzyCalculation = String(config.methodParams.dematelFuzzyCalculation ?? 'Component-wise fuzzy total relation');
  if (fuzzyCalculation === 'Defuzzify before total relation') {
    const centroidInput = { ...input, values: direct, expertMatrices: undefined, expertFuzzyMatrices: undefined, fuzzyValues: directFuzzy };
    const centroidConfig = { ...config, methodParams: { ...config.methodParams, fuzzyInputMode: 'Defuzzify on upload' } };
    const analysis = runDematel(centroidInput, centroidConfig, method);
    analysis.tables = [
      fuzzyDecisionMatrixRows('Fuzzy Direct Relation Matrix', 'fuzzy-dematel-direct', directFuzzy, input, 'Factor'),
      {
        id: 'fuzzy-dematel-defuzzification',
        title: 'Fuzzy DEMATEL Defuzzification Convention',
        columns: ['Setting', 'Value'],
        rows: [
          ['Fuzzy calculation', fuzzyCalculation],
          ['Centroid matrix', 'Triangular/trapezoidal judgments are converted to centroid values before DEMATEL normalization and total-relation calculation.'],
          ['Expert matrices', sourceFuzzyMatrices.length],
          ['Fuzzy tuple aggregation', 'Fuzzy tuple components aggregated by arithmetic mean before centroid conversion'],
        ],
      },
      ...analysis.tables,
    ];
    analysis.diagnostics.unshift({
      label: 'Native fuzzy DEMATEL',
      value: `${sourceFuzzyMatrices.length} fuzzy direct-relation matrix${sourceFuzzyMatrices.length === 1 ? '' : 'es'} preserved, then defuzzified by centroid before total-relation calculation`,
      status: 'pass',
    });
    analysis.reproducibility = {
      ...analysis.reproducibility,
      fuzzyMode: 'Native fuzzy DEMATEL',
      dematelFuzzyCalculation: fuzzyCalculation,
      expertMatrices: sourceFuzzyMatrices.length,
      expertMeanAbsoluteDisagreement: round(expertDisagreement.mean),
      expertMaxAbsoluteDisagreement: round(expertDisagreement.max),
      expertRelativeDisagreement: round(expertRelativeDisagreement),
      expertConsensusLevel,
      fuzzyCellCount: input.fuzzyCellCount ?? 0,
      fuzzyTypes: input.fuzzyTypes ?? [],
    };
    analysis.narrative = 'Native fuzzy DEMATEL preserved triangular/trapezoidal expert judgments, converted them to centroid values, and then calculated the normalized direct matrix, total-relation matrix, D/R indicators, and cause-effect groups. This convention matches applied papers that defuzzify before the final DEMATEL causal matrix.';
    return analysis;
  }
  const componentCount = Math.max(...directFuzzy.flat().map((value) => value.values.length), 3);
  const componentDirectMatrices = Array.from({ length: componentCount }, (_, component) =>
    directFuzzy.map((row) => row.map((value) => fuzzyComponentAt(value, component, componentCount))),
  );
  const upperComponent = componentDirectMatrices[componentCount - 1];
  const upperRowSums = upperComponent.map((row) => row.reduce((sum, value) => sum + Math.abs(value), 0));
  const upperColumnSums = upperComponent[0].map((_, column) => upperComponent.reduce((sum, row) => sum + Math.abs(row[column]), 0));
  const fuzzyNormalizationFactor = Math.max(...upperRowSums, ...upperColumnSums, 1);
  const componentNormalizedMatrices = componentDirectMatrices.map((matrix) =>
    matrix.map((row) => row.map((value) => value / fuzzyNormalizationFactor)),
  );
  const fuzzyNormalized = componentMatricesToFuzzy(componentNormalizedMatrices);
  const componentTotalMatrices = componentNormalizedMatrices.map((matrix) => {
    const identity = matrix.map((row, rowIndex) => row.map((_, columnIndex) => rowIndex === columnIndex ? 1 : 0));
    const iMinusN = identity.map((row, rowIndex) => row.map((value, columnIndex) => value - matrix[rowIndex][columnIndex]));
    return multiply(matrix, invert(iMinusN));
  });
  const fuzzyTotal = componentMatricesToFuzzy(componentTotalMatrices);
  const total = fuzzyTotal.map((row) => row.map(defuzzify));
  const dFuzzy = fuzzyTotal.map((row) => sumFuzzyRow(row));
  const rFuzzy = input.criteria.map((_, column) => sumFuzzyRow(fuzzyTotal.map((row) => row[column])));
  const d = dFuzzy.map(defuzzify);
  const r = rFuzzy.map(defuzzify);
  const offDiagonalValues = total.flatMap((row, rowIndex) => row.filter((_, columnIndex) => rowIndex !== columnIndex));
  const meanThreshold = offDiagonalValues.reduce((sum, value) => sum + Math.abs(value), 0) / (offDiagonalValues.length || 1);
  const thresholdMode = String(config.methodParams.dematelThreshold ?? 'Mean threshold');
  const thresholdValue = thresholdMode === 'Manual threshold'
    ? Math.max(0, Number(config.methodParams.dematelManualThreshold ?? meanThreshold) || 0)
    : meanThreshold;
  const thresholded = total.map((row, rowIndex) => row.map((value, columnIndex) => rowIndex === columnIndex ? 0 : Math.abs(value) >= thresholdValue ? value : 0));
  const rows = input.criteria.map((factor, index) => {
    const relation = d[index] - r[index];
    return [factor.id, factor.name, fuzzyLabel(dFuzzy[index]), fuzzyLabel(rFuzzy[index]), round(d[index] + r[index]), round(relation), relation >= 0 ? 'Cause' : 'Effect'];
  });
  const ranking = rows
    .map((row, index) => ({ rank: 0, alternativeId: input.criteria[index].id, alternative: String(row[1]), score: Number(row[4]) }))
    .sort((a, b) => b.score - a.score)
    .map((row, index) => ({ ...row, rank: index + 1, score: round(row.score) }));
  return {
    methodId: method.id,
    methodName: method.name,
    input: { ...input, fuzzyValues: directFuzzy },
    tables: [
      fuzzyDecisionMatrixRows('Fuzzy Direct Relation Matrix', 'fuzzy-dematel-direct', directFuzzy, input, 'Factor'),
      ...(sourceFuzzyMatrices.length > 1 ? [{
        id: 'fuzzy-expert-aggregation',
        title: 'Fuzzy Expert Aggregation Summary',
        columns: ['Expert matrices', 'Aggregation', 'Mean absolute disagreement', 'Max absolute disagreement', 'Relative disagreement', 'Consensus level', 'Fuzzy tuple aggregation'],
        rows: [[sourceFuzzyMatrices.length, String(config.methodParams.dematelAggregation ?? 'Arithmetic mean'), round(expertDisagreement.mean), round(expertDisagreement.max), round(expertRelativeDisagreement), expertConsensusLevel, 'Fuzzy tuple components aggregated by arithmetic mean']],
      }] : []),
      fuzzyDecisionMatrixRows('Fuzzy Normalized Direct Relation Matrix', 'fuzzy-dematel-normalized-direct', fuzzyNormalized, input, 'Factor'),
      fuzzyDecisionMatrixRows('Fuzzy Total Relation Matrix', 'fuzzy-dematel-total-relation', fuzzyTotal, input, 'Factor'),
      tableFromMatrix('fuzzy-dematel-thresholded-total-relation', 'Fuzzy DEMATEL Thresholded Total Relation Matrix', thresholded, input),
      { id: 'cause-effect', title: 'Fuzzy DEMATEL Cause-Effect Table', columns: ['Factor', 'Name', 'Fuzzy D', 'Fuzzy R', 'D+R centroid', 'D-R centroid', 'Group'], rows },
    ],
    ranking,
    diagnostics: [
      { label: 'Native fuzzy DEMATEL', value: `${sourceFuzzyMatrices.length} fuzzy direct-relation matrix${sourceFuzzyMatrices.length === 1 ? '' : 'es'} normalized by maximum upper-bound row/column sum ${round(fuzzyNormalizationFactor)}`, status: 'pass' },
      { label: 'Diagonal check', value: 'Zero diagonal enforced in fuzzy direct-relation matrix', status: 'pass' },
      { label: 'Threshold method', value: `${thresholdMode}: ${round(thresholdValue)} on centroid total-relation values`, status: 'pass' },
      { label: 'Expert aggregation', value: `${sourceFuzzyMatrices.length} matrix${sourceFuzzyMatrices.length === 1 ? '' : 'es'} aggregated; ${expertConsensusLevel}; mean absolute disagreement ${round(expertDisagreement.mean)}`, status: expertConsensusLevel.startsWith('Review') ? 'warn' : 'pass' },
    ],
    narrative: 'Native fuzzy DEMATEL preserves triangular/trapezoidal expert judgments through component-wise direct, normalized, and total-relation matrices, then defuzzifies D/R indicators for cause-effect grouping.',
    reproducibility: { method: method.id, fuzzyMode: 'Native fuzzy DEMATEL', factors: input.criteria.length, expertMatrices: sourceFuzzyMatrices.length, expertMeanAbsoluteDisagreement: round(expertDisagreement.mean), expertMaxAbsoluteDisagreement: round(expertDisagreement.max), expertRelativeDisagreement: round(expertRelativeDisagreement), expertConsensusLevel, dematelNormalizationFactor: round(fuzzyNormalizationFactor), dematelThresholdValue: round(thresholdValue), generatedAt: new Date().toISOString(), params: config.methodParams },
    visualizations: [
      { id: 'dematel-cause-effect', title: 'Fuzzy Cause-Effect Scatter', type: 'dematel-cause-effect', data: rows.map((row) => ({ factor: String(row[0]), prominence: Number(row[4]), relation: Number(row[5]), group: String(row[6]) })) },
      { id: 'matrix-heatmap', title: 'Fuzzy Total Relation Centroid Heatmap', type: 'matrix-heatmap', data: total.flatMap((row, rowIndex) => row.map((value, columnIndex) => ({ source: input.criteria[rowIndex].id, target: input.criteria[columnIndex].id, value: round(value) }))) },
    ],
  };
}

function runTopsis(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  if (config.methodParams.fuzzyInputMode === 'Native fuzzy TOPSIS') {
    return runFuzzyTopsis(input, config, method);
  }
  const criteria = resolveCriteria(input, config);
  const normalized = config.methodParams.normalization === 'Linear normalization' ? minMaxNormalize({ ...input, criteria }) : vectorNormalize(input.values);
  const weightedMatrix = weighted(normalized, criteria);
  const idealBest = weightedMatrix[0].map((_, column) => {
    const values = weightedMatrix.map((row) => row[column]);
    return criteria[column].direction === 'benefit' ? Math.max(...values) : Math.min(...values);
  });
  const idealWorst = weightedMatrix[0].map((_, column) => {
    const values = weightedMatrix.map((row) => row[column]);
    return criteria[column].direction === 'benefit' ? Math.min(...values) : Math.max(...values);
  });
  const scores = weightedMatrix.map((row) => {
    const positive = distance(row, idealBest);
    const negative = distance(row, idealWorst);
    return negative / (positive + negative);
  });
  return result(method, { ...input, criteria }, [
    tableFromMatrix('normalized', 'Normalized Decision Matrix', normalized, input),
    tableFromMatrix('weighted', 'Weighted Normalized Matrix', weightedMatrix, input),
    { id: 'ideal', title: 'Ideal Best and Worst', columns: ['Type', ...criteria.map((item) => item.id)], rows: [['Ideal Best', ...idealBest.map((value) => round(value))], ['Ideal Worst', ...idealWorst.map((value) => round(value))]] },
    {
      id: 'topsis-distances',
      title: 'TOPSIS Separation Distances and Closeness',
      columns: ['Alternative', 'D+', 'D-', 'Closeness'],
      rows: weightedMatrix.map((row, index) => {
        const positive = distance(row, idealBest);
        const negative = distance(row, idealWorst);
        return [input.alternatives[index].name, round(positive), round(negative), round(scores[index])];
      }),
    },
  ], scores, 'TOPSIS ranks alternatives by closeness to the positive ideal solution and distance from the negative ideal solution.');
}

function runFuzzyTopsis(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  const criteria = resolveCriteria(input, config);
  const fuzzyMatrix = input.fuzzyValues?.length
    ? input.fuzzyValues
    : input.values.map((row) => row.map((value) => crispFuzzy(value)));
  const normalizedCriteria = normalizeWeights(criteria);
  const normalized = fuzzyMatrix.map((row) => row.map((value, column) => {
    const columnValues = fuzzyMatrix.map((item) => item[column]);
    if (criteria[column].direction === 'cost') {
      const minLower = Math.min(...columnValues.map((item) => item.values[0]).filter(Number.isFinite));
      const reciprocalValues = value.values.map((cell) => minLower / Math.max(cell, 1e-9)).reverse();
      return { values: reciprocalValues, type: value.type } as FuzzyNumber;
    }
    const maxUpper = Math.max(...columnValues.map((item) => item.values[item.values.length - 1]).filter(Number.isFinite), 1e-9);
    return { values: value.values.map((cell) => cell / maxUpper), type: value.type };
  }));
  const weightedMatrix = normalized.map((row) => row.map((value, column) => scaleFuzzy(value, normalizedCriteria[column].weight)));
  const idealBest = criteria.map((criterion, column) => {
    const values = weightedMatrix.map((row) => row[column]);
    const best = criterion.direction === 'benefit'
      ? Math.max(...values.map((item) => item.values[item.values.length - 1]))
      : Math.min(...values.map((item) => item.values[0]));
    return crispFuzzy(best);
  });
  const idealWorst = criteria.map((criterion, column) => {
    const values = weightedMatrix.map((row) => row[column]);
    const worst = criterion.direction === 'benefit'
      ? Math.min(...values.map((item) => item.values[0]))
      : Math.max(...values.map((item) => item.values[item.values.length - 1]));
    return crispFuzzy(worst);
  });
  const distances = weightedMatrix.map((row) => {
    const positive = row.reduce((sum, value, column) => sum + fuzzyDistance(value, idealBest[column]), 0);
    const negative = row.reduce((sum, value, column) => sum + fuzzyDistance(value, idealWorst[column]), 0);
    return { positive, negative, closeness: negative / (positive + negative || 1) };
  });
  const scores = distances.map((item) => item.closeness);
  const analysis = result(method, { ...input, criteria, fuzzyValues: fuzzyMatrix }, [
    {
      id: 'fuzzy-normalized',
      title: 'Fuzzy Normalized Matrix',
      columns: ['Alternative', ...criteria.map((criterion) => criterion.id)],
      rows: normalized.map((row, index) => [input.alternatives[index].name, ...row.map((value) => fuzzyLabel(value))]),
    },
    {
      id: 'fuzzy-weighted',
      title: 'Fuzzy Weighted Normalized Matrix',
      columns: ['Alternative', ...criteria.map((criterion) => criterion.id)],
      rows: weightedMatrix.map((row, index) => [input.alternatives[index].name, ...row.map((value) => fuzzyLabel(value))]),
    },
    {
      id: 'fuzzy-ideal',
      title: 'Fuzzy Ideal Best and Worst',
      columns: ['Type', ...criteria.map((criterion) => criterion.id)],
      rows: [['Fuzzy ideal best', ...idealBest.map((value) => fuzzyLabel(value))], ['Fuzzy ideal worst', ...idealWorst.map((value) => fuzzyLabel(value))]],
    },
    {
      id: 'fuzzy-topsis-distances',
      title: 'Fuzzy TOPSIS Distances and Closeness',
      columns: ['Alternative', 'D+', 'D-', 'Closeness'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, round(distances[index].positive), round(distances[index].negative), round(distances[index].closeness)]),
    },
  ], scores, 'Fuzzy TOPSIS preserves triangular/trapezoidal uploaded values through normalization, weighting, fuzzy ideal distances, and closeness coefficients.');
  analysis.diagnostics.push({ label: 'Native fuzzy TOPSIS', value: `${input.fuzzyCellCount ?? 0} uploaded fuzzy cells preserved for fuzzy distance calculation`, status: 'pass' });
  analysis.reproducibility = { ...analysis.reproducibility, fuzzyMode: 'Native fuzzy TOPSIS', fuzzyDistance: 'Vertex distance over fuzzy number components' };
  return analysis;
}

function runAHP(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  if (config.methodParams.fuzzyInputMode === 'Native fuzzy AHP') {
    return runFuzzyAHP(input, config, method);
  }
  const pairwise = ahpPairwiseMatrix(config, input.criteria.length);
  const priority = ahpPriority(pairwise);
  const criteria = input.criteria.map((criterion, index) => ({ ...criterion, weight: priority.weights[index] }));
  const usesAlternativePairwise = config.methodParams.ahpPairwiseMode === 'Criteria and alternatives';
  const normalized = minMaxNormalize(input);
  const alternativePriorityRows = input.alternatives.map((alternative) => [alternative.name] as Array<string | number>);
  const alternativePriorityByCriterion = criteria.map((criterion, criterionIndex) => {
    const matrix = alternativePairwise(config, input, criterion.id, criterionIndex);
    const priorityResult = ahpPriority(matrix);
    priorityResult.weights.forEach((weight, alternativeIndex) => alternativePriorityRows[alternativeIndex].push(round(weight)));
    return priorityResult.weights;
  });
  const weightedMatrix = usesAlternativePairwise
    ? input.alternatives.map((_, alternativeIndex) => criteria.map((criterion, criterionIndex) => alternativePriorityByCriterion[criterionIndex][alternativeIndex] * criterion.weight))
    : weighted(normalized, criteria);
  const scores = weightedMatrix.map((row) => row.reduce((sum, value) => sum + value, 0));
  const threshold = Number(config.methodParams.ahpConsistencyThreshold ?? 0.1);
  const groupCriteriaCount = config.ahpCriteriaRespondentPairwise?.length ?? 0;
  const groupAlternativeCount = Object.values(config.ahpAlternativeRespondentPairwise ?? {}).reduce((sum, matrices) => sum + matrices.length, 0);
  const analysis = result(method, { ...input, criteria }, [
    ...(groupCriteriaCount || groupAlternativeCount ? [{ id: 'ahp-group-aggregation', title: 'AHP Group Pairwise Aggregation Summary', columns: ['Judgment type', 'Respondent matrices', 'Aggregation'], rows: [['Criteria pairwise', groupCriteriaCount, groupCriteriaCount ? 'Geometric mean' : 'Not used'], ['Alternative pairwise', groupAlternativeCount, groupAlternativeCount ? 'Geometric mean by criterion' : 'Not used']] }] : []),
    tableFromMatrix('criteria-pairwise', 'Criteria Pairwise Matrix', pairwise, { ...input, alternatives: input.criteria.map((criterion) => ({ id: criterion.id, name: criterion.name })) }),
    { id: 'criteria-priority', title: 'AHP Criteria Priorities', columns: ['Criterion', 'Name', 'Priority'], rows: criteria.map((criterion) => [criterion.id, criterion.name, round(criterion.weight)]) },
    ...(usesAlternativePairwise ? [{ id: 'alternative-priorities', title: 'AHP Alternative Priorities By Criterion', columns: ['Alternative', ...criteria.map((criterion) => criterion.id)], rows: alternativePriorityRows }] : []),
    tableFromMatrix('normalized', 'Priority-Compatible Normalized Matrix', normalized, input),
    tableFromMatrix('weighted', 'Weighted Priority Matrix', weightedMatrix, input),
    { id: 'consistency', title: 'AHP Consistency Summary', columns: ['Metric', 'Value'], rows: [['Lambda max', round(priority.lambdaMax)], ['CI', round(priority.ci)], ['CR', round(priority.cr)], ['Threshold', threshold], ['Status', priority.cr <= threshold ? 'Accepted' : 'Review required']] },
  ], scores, 'AHP derives criteria priorities from pairwise comparisons, checks consistency ratio, and combines those priorities with normalized alternative performance.');
  analysis.diagnostics.push({ label: 'AHP consistency ratio', value: `CR = ${round(priority.cr)} / threshold ${threshold}`, status: priority.cr <= threshold ? 'pass' : 'warn' });
  if (groupCriteriaCount || groupAlternativeCount) analysis.diagnostics.push({ label: 'AHP group aggregation', value: 'Pairwise respondent matrices aggregated by geometric mean', status: 'pass' });
  analysis.reproducibility = { ...analysis.reproducibility, ahpConsistencyRatio: round(priority.cr), ahpConsistencyThreshold: threshold, ahpPairwiseMode: String(config.methodParams.ahpPairwiseMode ?? 'Criteria only'), ahpCriteriaRespondents: groupCriteriaCount, ahpAlternativeRespondentMatrices: groupAlternativeCount };
  return analysis;
}

function runFuzzyAHP(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  const pairwise = fuzzyAhpPairwiseMatrix(config, input.criteria.length);
  const priority = fuzzyAhpPriority(pairwise);
  const criteria = input.criteria.map((criterion, index) => ({ ...criterion, weight: priority.weights[index] }));
  const usesAlternativePairwise = config.methodParams.ahpPairwiseMode === 'Criteria and alternatives';
  const normalized = minMaxNormalize(input);
  const alternativePriorityRows = input.alternatives.map((alternative) => [alternative.name] as Array<string | number>);
  const alternativePriorityByCriterion = criteria.map((criterion, criterionIndex) => {
    if (!usesAlternativePairwise) return normalized.map((row) => row[criterionIndex]);
    const matrix = fuzzyAlternativePairwise(config, input, criterion.id, criterionIndex);
    const priorityResult = fuzzyAhpPriority(matrix);
    priorityResult.weights.forEach((weight, alternativeIndex) => alternativePriorityRows[alternativeIndex].push(round(weight)));
    return priorityResult.weights;
  });
  const weightedMatrix = usesAlternativePairwise
    ? input.alternatives.map((_, alternativeIndex) => criteria.map((criterion, criterionIndex) => alternativePriorityByCriterion[criterionIndex][alternativeIndex] * criterion.weight))
    : weighted(normalized, criteria);
  const scores = weightedMatrix.map((row) => row.reduce((sum, value) => sum + value, 0));
  const threshold = Number(config.methodParams.ahpConsistencyThreshold ?? 0.1);
  const fuzzyCriteriaCount = config.ahpCriteriaRespondentFuzzyPairwise?.length ?? (config.ahpCriteriaFuzzyPairwise?.length ? 1 : 0);
  const fuzzyAlternativeCount = Object.values(config.ahpAlternativeRespondentFuzzyPairwise ?? {}).reduce((sum, matrices) => sum + matrices.length, 0)
    + Object.keys(config.ahpAlternativeFuzzyPairwise ?? {}).length;
  const analysis = result(method, { ...input, criteria }, [
    { id: 'fuzzy-ahp-mode', title: 'Fuzzy AHP Aggregation Summary', columns: ['Judgment type', 'Fuzzy matrices', 'Priority method'], rows: [['Criteria pairwise', fuzzyCriteriaCount, 'Fuzzy geometric mean with centroid priority'], ['Alternative pairwise', usesAlternativePairwise ? fuzzyAlternativeCount : 0, usesAlternativePairwise ? 'Fuzzy geometric mean by criterion' : 'Not used']] },
    { id: 'fuzzy-criteria-pairwise', title: 'Fuzzy Criteria Pairwise Matrix', columns: ['Criterion', ...criteria.map((criterion) => criterion.id)], rows: pairwise.map((row, index) => [criteria[index].id, ...row.map((value) => fuzzyLabel(value))]) },
    { id: 'fuzzy-criteria-geomean', title: 'Fuzzy Criteria Geometric Means', columns: ['Criterion', 'Fuzzy geometric mean', 'Defuzzified priority'], rows: criteria.map((criterion, index) => [criterion.id, fuzzyLabel(priority.rowGeometricMeans[index]), round(priority.weights[index])]) },
    { id: 'criteria-priority', title: 'Fuzzy AHP Criteria Priorities', columns: ['Criterion', 'Name', 'Priority'], rows: criteria.map((criterion) => [criterion.id, criterion.name, round(criterion.weight)]) },
    ...(usesAlternativePairwise ? [{ id: 'alternative-priorities', title: 'Fuzzy AHP Alternative Priorities By Criterion', columns: ['Alternative', ...criteria.map((criterion) => criterion.id)], rows: alternativePriorityRows }] : []),
    tableFromMatrix('normalized', 'Priority-Compatible Normalized Matrix', normalized, input),
    tableFromMatrix('weighted', 'Weighted Priority Matrix', weightedMatrix, input),
    { id: 'consistency', title: 'Fuzzy AHP Defuzzified Consistency Summary', columns: ['Metric', 'Value'], rows: [['Lambda max', round(priority.consistency.lambdaMax)], ['CI', round(priority.consistency.ci)], ['CR', round(priority.consistency.cr)], ['Threshold', threshold], ['Status', priority.consistency.cr <= threshold ? 'Accepted' : 'Review required']] },
  ], scores, 'Native fuzzy AHP preserves triangular/trapezoidal pairwise judgments, derives fuzzy geometric means, defuzzifies priority weights, checks consistency on the defuzzified comparison matrix, and combines priorities with alternative performance.');
  analysis.diagnostics.push({ label: 'Native fuzzy AHP', value: 'Fuzzy pairwise priorities calculated with fuzzy geometric means', status: 'pass' });
  analysis.diagnostics.push({ label: 'AHP consistency ratio', value: `CR = ${round(priority.consistency.cr)} / threshold ${threshold}`, status: priority.consistency.cr <= threshold ? 'pass' : 'warn' });
  analysis.reproducibility = { ...analysis.reproducibility, fuzzyMode: 'Native fuzzy AHP', fuzzyAhpPriority: 'Fuzzy geometric mean, centroid defuzzification', ahpConsistencyRatio: round(priority.consistency.cr), ahpConsistencyThreshold: threshold };
  return analysis;
}

function runCopras(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  if (config.methodParams.fuzzyInputMode === 'Native fuzzy COPRAS') {
    return runFuzzyCopras(input, config, method);
  }
  const criteria = resolveCriteria(input, config);
  const columnSums = input.values[0].map((_, column) => input.values.reduce((sum, row) => sum + Math.abs(row[column]), 0) || 1);
  const normalized = input.values.map((row) => row.map((value, column) => value / columnSums[column]));
  const weightedMatrix = weighted(normalized, criteria);
  const beneficial = weightedMatrix.map((row) => row.reduce((sum, value, column) => sum + (criteria[column].direction === 'benefit' ? value : 0), 0));
  const nonBeneficial = weightedMatrix.map((row) => row.reduce((sum, value, column) => sum + (criteria[column].direction === 'cost' ? value : 0), 0));
  const positiveCosts = nonBeneficial.filter((value) => value > 0);
  const minCost = positiveCosts.length ? Math.min(...positiveCosts) : 0;
  const costSum = nonBeneficial.reduce((sum, value) => sum + value, 0);
  const inverseCostSum = nonBeneficial.reduce((sum, value) => sum + (value > 0 ? minCost / value : 0), 0) || 1;
  const scores = beneficial.map((value, index) => value + (nonBeneficial[index] > 0 ? (minCost * costSum) / (nonBeneficial[index] * inverseCostSum) : 0));
  const maxScore = Math.max(...scores, 1e-12);
  return result(method, { ...input, criteria }, [
    tableFromMatrix('normalized', 'COPRAS Normalized Matrix', normalized, input),
    tableFromMatrix('weighted', 'COPRAS Weighted Matrix', weightedMatrix, input),
    { id: 'copras-components', title: 'COPRAS Beneficial/Cost Components', columns: ['Alternative', 'S+', 'S-', 'Q', 'Utility %'], rows: input.alternatives.map((alternative, index) => [alternative.name, round(beneficial[index]), round(nonBeneficial[index]), round(scores[index]), round((scores[index] / maxScore) * 100)]) },
  ], scores, 'COPRAS separates beneficial and non-beneficial weighted sums, then derives relative significance and utility degree.');
}

function runFuzzyCopras(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  const criteria = resolveCriteria(input, config);
  const fuzzyMatrix = input.fuzzyValues?.length
    ? input.fuzzyValues
    : input.values.map((row) => row.map((value) => crispFuzzy(value)));
  const normalizedCriteria = normalizeWeights(criteria);
  const normalized = fuzzyMatrix.map((row) => row.map((value, column) => {
    const columnValues = fuzzyMatrix.map((item) => item[column]);
    const columnSum = columnValues.reduce((sum, item) => sum + Math.abs(defuzzify(item)), 0) || 1;
    if (criteria[column].direction === 'cost') {
      const reciprocalValues = value.values.map((cell) => 1 / Math.max(cell, 1e-9)).reverse();
      const reciprocalSum = columnValues.reduce((sum, item) => sum + 1 / Math.max(defuzzify(item), 1e-9), 0) || 1;
      return { values: reciprocalValues.map((cell) => cell / reciprocalSum), type: value.type } as FuzzyNumber;
    }
    return { values: value.values.map((cell) => cell / columnSum), type: value.type };
  }));
  const weightedFuzzy = normalized.map((row) => row.map((value, column) => scaleFuzzy(value, normalizedCriteria[column].weight)));
  const weightedCrisp = weightedFuzzy.map((row) => row.map(defuzzify));
  const beneficial = weightedCrisp.map((row) => row.reduce((sum, value, column) => sum + (criteria[column].direction === 'benefit' ? value : 0), 0));
  const nonBeneficial = weightedCrisp.map((row) => row.reduce((sum, value, column) => sum + (criteria[column].direction === 'cost' ? value : 0), 0));
  const positiveCosts = nonBeneficial.filter((value) => value > 0);
  const minCost = positiveCosts.length ? Math.min(...positiveCosts) : 0;
  const costSum = nonBeneficial.reduce((sum, value) => sum + value, 0);
  const inverseCostSum = nonBeneficial.reduce((sum, value) => sum + (value > 0 ? minCost / value : 0), 0) || 1;
  const scores = beneficial.map((value, index) => value + (nonBeneficial[index] > 0 ? (minCost * costSum) / (nonBeneficial[index] * inverseCostSum) : 0));
  const maxScore = Math.max(...scores, 1e-12);
  const analysis = result(method, { ...input, criteria, fuzzyValues: fuzzyMatrix }, [
    {
      id: 'fuzzy-copras-normalized',
      title: 'Fuzzy COPRAS Normalized Matrix',
      columns: ['Alternative', ...criteria.map((criterion) => criterion.id)],
      rows: normalized.map((row, index) => [input.alternatives[index].name, ...row.map((value) => fuzzyLabel(value))]),
    },
    {
      id: 'fuzzy-copras-weighted',
      title: 'Fuzzy COPRAS Weighted Matrix',
      columns: ['Alternative', ...criteria.map((criterion) => criterion.id)],
      rows: weightedFuzzy.map((row, index) => [input.alternatives[index].name, ...row.map((value) => fuzzyLabel(value))]),
    },
    {
      id: 'fuzzy-copras-components',
      title: 'Fuzzy COPRAS Beneficial/Cost Components',
      columns: ['Alternative', 'S+', 'S-', 'Q', 'Utility %'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, round(beneficial[index]), round(nonBeneficial[index]), round(scores[index]), round((scores[index] / maxScore) * 100)]),
    },
  ], scores, 'Native fuzzy COPRAS preserves triangular/trapezoidal uploaded values through fuzzy normalization and weighting, then derives beneficial, cost, relative significance, and utility components from centroid values.');
  analysis.diagnostics.push({ label: 'Native fuzzy COPRAS', value: 'Fuzzy normalized benefit/cost components converted through centroid scoring', status: 'pass' });
  analysis.reproducibility = { ...analysis.reproducibility, fuzzyMode: 'Native fuzzy COPRAS', fuzzyCopras: 'Fuzzy normalization/weighting with centroid benefit-cost utility components' };
  return analysis;
}

function runMoora(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  if (config.methodParams.fuzzyInputMode === 'Native fuzzy MOORA') {
    return runFuzzyMoora(input, config, method);
  }
  const criteria = resolveCriteria(input, config);
  const normalized = vectorNormalize(input.values);
  const weightedMatrix = weighted(normalized, criteria);
  const scores = weightedMatrix.map((row) => row.reduce((sum, value, column) => sum + (criteria[column].direction === 'benefit' ? value : -value), 0));
  return result(method, { ...input, criteria }, [
    tableFromMatrix('ratio', 'MOORA Ratio Matrix', normalized, input),
    tableFromMatrix('weighted-ratio', 'MOORA Weighted Ratio Matrix', weightedMatrix, input),
    { id: 'moora-net', title: 'MOORA Net Assessment', columns: ['Alternative', 'Benefit Sum', 'Cost Sum', 'Net Score'], rows: input.alternatives.map((alternative, index) => {
      const benefit = weightedMatrix[index].reduce((sum, value, column) => sum + (criteria[column].direction === 'benefit' ? value : 0), 0);
      const cost = weightedMatrix[index].reduce((sum, value, column) => sum + (criteria[column].direction === 'cost' ? value : 0), 0);
      return [alternative.name, round(benefit), round(cost), round(scores[index])];
    }) },
  ], scores, 'MOORA uses vector ratio normalization and ranks alternatives by beneficial criteria minus non-beneficial criteria.');
}

function runMoosra(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  if (config.methodParams.fuzzyInputMode === 'Native fuzzy MOOSRA') {
    return runFuzzyMoosra(input, config, method);
  }
  const criteria = resolveCriteria(input, config);
  const normalized = vectorNormalize(input.values);
  const weightedMatrix = weighted(normalized, criteria);
  const benefit = weightedMatrix.map((row) => row.reduce((sum, value, column) => sum + (criteria[column].direction === 'benefit' ? value : 0), 0));
  const cost = weightedMatrix.map((row) => row.reduce((sum, value, column) => sum + (criteria[column].direction === 'cost' ? value : 0), 0));
  const scores = benefit.map((value, index) => value / Math.max(cost[index], 1e-12));
  return result(method, { ...input, criteria }, [
    tableFromMatrix('moosra-ratio', 'MOOSRA Ratio Normalized Matrix', normalized, input),
    tableFromMatrix('moosra-weighted-ratio', 'MOOSRA Weighted Ratio Matrix', weightedMatrix, input),
    {
      id: 'moosra-score',
      title: 'MOOSRA Benefit-Cost Ratio Scores',
      columns: ['Alternative', 'Benefit objective sum', 'Cost objective sum', 'MOOSRA ratio'],
      rows: input.alternatives.map((alternative, index) => [
        alternative.name,
        round(benefit[index]),
        round(cost[index]),
        round(scores[index]),
      ]),
    },
  ], scores, 'MOOSRA uses vector normalization and ranks alternatives by the ratio of weighted benefit-objective sums to weighted cost-objective sums.');
}

function runFuzzyMoosra(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  const criteria = normalizeWeights(resolveCriteria(input, config));
  const fuzzyMatrix = activeFuzzyMatrix(input);
  const normalized = fuzzyVectorNormalizeMatrix(fuzzyMatrix);
  const weightedFuzzy = normalized.map((row) => row.map((value, column) => scaleFuzzy(value, criteria[column].weight)));
  const weightedCrisp = weightedFuzzy.map((row) => row.map(defuzzify));
  const benefit = weightedCrisp.map((row) => row.reduce((sum, value, column) => sum + (criteria[column].direction === 'benefit' ? value : 0), 0));
  const cost = weightedCrisp.map((row) => row.reduce((sum, value, column) => sum + (criteria[column].direction === 'cost' ? value : 0), 0));
  const scores = benefit.map((value, index) => value / Math.max(cost[index], 1e-12));
  const analysis = result(method, { ...input, criteria, fuzzyValues: fuzzyMatrix }, [
    fuzzyDecisionMatrixRows('Fuzzy MOOSRA Ratio Normalized Matrix', 'fuzzy-moosra-ratio', normalized, input),
    fuzzyDecisionMatrixRows('Fuzzy MOOSRA Weighted Ratio Matrix', 'fuzzy-moosra-weighted-ratio', weightedFuzzy, input),
    {
      id: 'fuzzy-moosra-score',
      title: 'Fuzzy MOOSRA Benefit-Cost Ratio Scores',
      columns: ['Alternative', 'Benefit objective sum', 'Cost objective sum', 'MOOSRA ratio'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, round(benefit[index]), round(cost[index]), round(scores[index])]),
    },
  ], scores, 'Native fuzzy MOOSRA preserves triangular/trapezoidal values through fuzzy vector normalization and fuzzy weighting, then ranks alternatives by centroid benefit-to-cost ratio.');
  analysis.diagnostics.push({ label: 'Native fuzzy MOOSRA', value: 'Fuzzy vector normalization with centroid benefit-cost ratio scoring', status: 'pass' });
  analysis.reproducibility = { ...analysis.reproducibility, fuzzyMode: 'Native fuzzy MOOSRA', fuzzyMoosra: 'Component-wise fuzzy vector normalization, fuzzy weighting, centroid benefit/cost ratio' };
  return analysis;
}

function runArlon(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  if (config.methodParams.fuzzyInputMode === 'Native fuzzy ARLON') return runFuzzyArlon(input, config, method);
  const criteria = resolveCriteria(input, config);
  const gamma = Math.min(1, Math.max(0, Number(config.methodParams.arlonGamma ?? 0.5)));
  const benefitCriteria = criteria.filter((criterion) => criterion.direction === 'benefit').length;
  const kappa = benefitCriteria / Math.max(criteria.length, 1);
  const safeColumnValues = (column: number) => input.values.map((row) => Math.max(Math.abs(row[column]), 1e-12));
  const firstLog = input.values.map((row) => row.map((value, column) => {
    const columnValues = safeColumnValues(column);
    const safeValue = Math.max(Math.abs(value), 1e-12);
    if (criteria[column].direction === 'cost') {
      const min = Math.min(...columnValues);
      return Math.log1p(min) / Math.max(Math.log1p(safeValue), 1e-12);
    }
    const max = Math.max(...columnValues);
    return Math.log1p(safeValue) / Math.max(Math.log1p(max), 1e-12);
  }));
  const secondLog = firstLog.map((row) => row.map((value, column) => {
    const columnValues = firstLog.map((item) => Math.max(item[column], 1e-12));
    const safeValue = Math.max(value, 1e-12);
    if (criteria[column].direction === 'cost') {
      const min = Math.min(...columnValues);
      return Math.log1p(min) / Math.max(Math.log1p(safeValue), 1e-12);
    }
    const max = Math.max(...columnValues);
    return Math.log1p(safeValue) / Math.max(Math.log1p(max), 1e-12);
  }));
  const aggregated = firstLog.map((row, rowIndex) =>
    row.map((value, column) => gamma * value + (1 - gamma) * secondLog[rowIndex][column]),
  );
  const weightedMatrix = weighted(aggregated, criteria);
  const benefit = weightedMatrix.map((row) => row.reduce((sum, value, column) => sum + (criteria[column].direction === 'benefit' ? value : 0), 0));
  const cost = weightedMatrix.map((row) => row.reduce((sum, value, column) => sum + (criteria[column].direction === 'cost' ? value : 0), 0));
  const performance = benefit.map((value, index) => value ** kappa + cost[index] ** (1 - kappa));
  const minPerformance = Math.min(...performance);
  const maxPerformance = Math.max(...performance);
  const scores = performance.map((value) => Math.abs(maxPerformance - minPerformance) <= 1e-12 ? 1 : (value - minPerformance) / (maxPerformance - minPerformance));
  return result(method, { ...input, criteria }, [
    tableFromMatrix('arlon-first-log-normalized', 'ARLON First Log-Normalized Matrix', firstLog, input),
    tableFromMatrix('arlon-second-log-normalized', 'ARLON Second Log-Normalized Matrix', secondLog, input),
    tableFromMatrix('arlon-aggregated-normalized', 'ARLON Aggregated Normalized Matrix', aggregated, input),
    tableFromMatrix('arlon-weighted', 'ARLON Weighted Matrix', weightedMatrix, input),
    {
      id: 'arlon-components',
      title: 'ARLON Benefit/Cost Components',
      columns: ['Alternative', 'Benefit sum', 'Cost sum', 'Kappa', 'Performance G', 'Final R'],
      rows: input.alternatives.map((alternative, index) => [
        alternative.name,
        round(benefit[index]),
        round(cost[index]),
        round(kappa),
        round(performance[index]),
        round(scores[index]),
      ]),
    },
  ], scores, 'ARLON applies two-step logarithmic normalization and ranks alternatives using weighted benefit/cost performance components.');
}

function runMacont(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  if (config.methodParams.fuzzyInputMode === 'Native fuzzy MACONT') return runFuzzyMacont(input, config, method);
  const criteria = resolveCriteria(input, config);
  const lambdaRaw = Number(config.methodParams.macontLambda ?? 1 / 3);
  const muRaw = Number(config.methodParams.macontMu ?? 1 / 3);
  const lambda = Math.min(1, Math.max(0, Number.isFinite(lambdaRaw) ? lambdaRaw : 1 / 3));
  const mu = Math.min(1 - lambda, Math.max(0, Number.isFinite(muRaw) ? muRaw : 1 / 3));
  const delta = Math.min(1, Math.max(0, Number(config.methodParams.macontDelta ?? 0.5)));
  const theta = Math.min(1, Math.max(0, Number(config.methodParams.macontTheta ?? 0.5)));
  const sumNormalized = input.values.map((row) => row.map((value, column) => {
    const columnValues = input.values.map((item) => Math.max(Math.abs(item[column]), 1e-12));
    const safeValue = Math.max(Math.abs(value), 1e-12);
    if (criteria[column].direction === 'cost') {
      const reciprocalSum = columnValues.reduce((sum, item) => sum + 1 / item, 0) || 1;
      return (1 / safeValue) / reciprocalSum;
    }
    const sum = columnValues.reduce((total, item) => total + item, 0) || 1;
    return safeValue / sum;
  }));
  const ratioNormalized = input.values.map((row) => row.map((value, column) => {
    const columnValues = input.values.map((item) => Math.max(Math.abs(item[column]), 1e-12));
    const safeValue = Math.max(Math.abs(value), 1e-12);
    return criteria[column].direction === 'cost'
      ? Math.min(...columnValues) / safeValue
      : safeValue / Math.max(...columnValues);
  }));
  const rangeNormalized = input.values.map((row) => row.map((value, column) => {
    const columnValues = input.values.map((item) => item[column]);
    const min = Math.min(...columnValues);
    const max = Math.max(...columnValues);
    if (Math.abs(max - min) <= 1e-12) return 1;
    return criteria[column].direction === 'cost'
      ? (value - max) / (min - max)
      : (value - min) / (max - min);
  }));
  const integrated = sumNormalized.map((row, rowIndex) =>
    row.map((value, column) => lambda * value + mu * ratioNormalized[rowIndex][column] + (1 - lambda - mu) * rangeNormalized[rowIndex][column]),
  );
  const reference = criteria.map((_, column) => integrated.reduce((sum, row) => sum + row[column], 0) / Math.max(integrated.length, 1));
  const weightedDeviation = integrated.map((row) => row.map((value, column) => criteria[column].weight * (value - reference[column])));
  const rho = weightedDeviation.map((row) => row.reduce((sum, value) => sum + value, 0));
  const q = integrated.map((row) => {
    const below = row.reduce((product, value, column) => {
      const distance = Math.max(reference[column] - value, 1e-12);
      return product * distance ** criteria[column].weight;
    }, 1);
    const above = row.reduce((product, value, column) => {
      const distance = Math.max(value - reference[column], 1e-12);
      return product * distance ** criteria[column].weight;
    }, 1);
    return below / Math.max(above, 1e-12);
  });
  const rhoNorm = Math.sqrt(rho.reduce((sum, value) => sum + value ** 2, 0)) || 1;
  const qNorm = Math.sqrt(q.reduce((sum, value) => sum + value ** 2, 0)) || 1;
  const s1 = rho.map((value, index) => delta * (value / rhoNorm) + (1 - delta) * (q[index] / qNorm));
  const s2 = weightedDeviation.map((row) => theta * Math.max(...row) + (1 - theta) * Math.min(...row));
  const s2Norm = Math.sqrt(s2.reduce((sum, value) => sum + value ** 2, 0)) || 1;
  const scores = s1.map((value, index) => 0.5 * (value + s2[index] / s2Norm));
  return result(method, { ...input, criteria }, [
    tableFromMatrix('macont-sum-normalized', 'MACONT Sum-Based Normalized Matrix', sumNormalized, input),
    tableFromMatrix('macont-ratio-normalized', 'MACONT Ratio-Based Normalized Matrix', ratioNormalized, input),
    tableFromMatrix('macont-range-normalized', 'MACONT Range-Based Normalized Matrix', rangeNormalized, input),
    tableFromMatrix('macont-integrated-normalized', 'MACONT Comprehensive Normalized Matrix', integrated, input),
    {
      id: 'macont-reference',
      title: 'MACONT Virtual Reference Alternative',
      columns: ['Reference', ...criteria.map((criterion) => criterion.id)],
      rows: [['Average reference', ...reference.map(round)]],
    },
    tableFromMatrix('macont-weighted-deviation', 'MACONT Weighted Distance From Reference', weightedDeviation, input),
    {
      id: 'macont-scores',
      title: 'MACONT Mixed Aggregation Scores',
      columns: ['Alternative', 'rho', 'Q', 'S1', 'S2', 'Final S'],
      rows: input.alternatives.map((alternative, index) => [
        alternative.name,
        round(rho[index]),
        round(q[index]),
        round(s1[index]),
        round(s2[index]),
        round(scores[index]),
      ]),
    },
  ], scores, 'MACONT combines three normalization techniques, builds a virtual reference alternative, and ranks alternatives by mixed compensatory and non-compensatory aggregation scores.');
}

function fuzzyComponentAt(number: FuzzyNumber, index: number, size: number): number {
  if (number.values.length === size) return number.values[index] ?? number.values[number.values.length - 1] ?? 0;
  if (number.values.length === 3 && size === 4) {
    return [number.values[0], number.values[1], number.values[1], number.values[2]][index] ?? 0;
  }
  if (number.values.length === 4 && size === 3) {
    return [number.values[0], (number.values[1] + number.values[2]) / 2, number.values[3]][index] ?? 0;
  }
  return number.values[Math.min(index, number.values.length - 1)] ?? 0;
}

function activeFuzzyMatrix(input: DecisionMatrix): FuzzyNumber[][] {
  return input.fuzzyValues?.length
    ? input.fuzzyValues
    : input.values.map((row) => row.map((value) => crispFuzzy(value)));
}

function averageFuzzy(numbers: FuzzyNumber[], fallback = 0): FuzzyNumber {
  if (!numbers.length) return crispFuzzy(fallback);
  const size = Math.max(...numbers.map((number) => number.values.length));
  const values = Array.from({ length: size }, (_, component) =>
    numbers.reduce((sum, number) => sum + fuzzyComponentAt(number, component, size), 0) / numbers.length,
  );
  return { values, type: size === 4 ? 'trapezoidal' : 'triangular' };
}

function sumFuzzyRow(row: FuzzyNumber[]): FuzzyNumber {
  if (!row.length) return crispFuzzy(0);
  const size = Math.max(...row.map((number) => number.values.length));
  const values = Array.from({ length: size }, (_, component) =>
    row.reduce((sum, number) => sum + fuzzyComponentAt(number, component, size), 0),
  );
  return { values, type: size === 4 ? 'trapezoidal' : 'triangular' };
}

function fuzzyDecisionMatrixRows(title: string, id: string, matrix: FuzzyNumber[][], input: DecisionMatrix, rowLabel = 'Alternative') {
  return {
    id,
    title,
    columns: [rowLabel, ...input.criteria.map((criterion) => criterion.id)],
    rows: matrix.map((row, index) => [
      rowLabel === 'Factor' ? input.criteria[index]?.name ?? input.criteria[index]?.id ?? `F${index + 1}` : input.alternatives[index]?.name ?? input.alternatives[index]?.id ?? `A${index + 1}`,
      ...row.map((value) => fuzzyLabel(value)),
    ]),
  };
}

function componentMatricesToFuzzy(matrices: number[][][]): FuzzyNumber[][] {
  const componentCount = matrices.length;
  const rowCount = matrices[0]?.length ?? 0;
  const columnCount = matrices[0]?.[0]?.length ?? 0;
  return Array.from({ length: rowCount }, (_, row) =>
    Array.from({ length: columnCount }, (_, column) => ({
      values: Array.from({ length: componentCount }, (_, component) => matrices[component]?.[row]?.[column] ?? 0),
      type: componentCount === 4 ? 'trapezoidal' as const : 'triangular' as const,
    })),
  );
}

function fuzzyVectorNormalizeMatrix(fuzzyMatrix: FuzzyNumber[][]): FuzzyNumber[][] {
  return fuzzyMatrix.map((row) => row.map((value, column) => {
    const columnValues = fuzzyMatrix.map((item) => item[column]);
    const componentCount = Math.max(...columnValues.map((item) => item.values.length), value.values.length);
    const denominators = Array.from({ length: componentCount }, (_, component) =>
      Math.sqrt(columnValues.reduce((sum, item) => sum + fuzzyComponentAt(item, component, componentCount) ** 2, 0)) || 1,
    );
    return {
      values: Array.from({ length: componentCount }, (_, component) => fuzzyComponentAt(value, component, componentCount) / denominators[component]),
      type: componentCount === 4 ? 'trapezoidal' : value.type === 'crisp' ? 'crisp' : 'triangular',
    } as FuzzyNumber;
  }));
}

const FUZZY_RANKING_CONVENTION = 'Centroid score, narrower spread tie-break, endpoint tie-break by criterion direction';

function fuzzySpread(number: FuzzyNumber): number {
  const values = number.values;
  return Math.max(...values) - Math.min(...values);
}

function compareFuzzy(a: FuzzyNumber, b: FuzzyNumber, higherIsBetter = true): number {
  const centroidDifference = defuzzify(a) - defuzzify(b);
  if (Math.abs(centroidDifference) > 1e-12) return higherIsBetter ? centroidDifference : -centroidDifference;
  const spreadDifference = fuzzySpread(b) - fuzzySpread(a);
  if (Math.abs(spreadDifference) > 1e-12) return spreadDifference;
  const aEndpoint = higherIsBetter ? Math.max(...a.values) : -Math.min(...a.values);
  const bEndpoint = higherIsBetter ? Math.max(...b.values) : -Math.min(...b.values);
  return aEndpoint - bEndpoint;
}

function addFuzzy(a: FuzzyNumber, b: FuzzyNumber): FuzzyNumber {
  const size = Math.max(a.values.length, b.values.length);
  return {
    values: Array.from({ length: size }, (_, index) => fuzzyComponentAt(a, index, size) + fuzzyComponentAt(b, index, size)),
    type: size === 4 ? 'trapezoidal' : a.type === 'crisp' && b.type === 'crisp' ? 'crisp' : 'triangular',
  };
}

function subtractFuzzy(a: FuzzyNumber, b: FuzzyNumber): FuzzyNumber {
  return addFuzzy(a, scaleFuzzy(b, -1));
}

function blendFuzzy(a: FuzzyNumber, b: FuzzyNumber, weight: number): FuzzyNumber {
  return addFuzzy(scaleFuzzy(a, weight), scaleFuzzy(b, 1 - weight));
}

function fuzzyWeightedMatrix(matrix: FuzzyNumber[][], criteria: Criterion[]): FuzzyNumber[][] {
  return matrix.map((row) => row.map((value, column) => scaleFuzzy(value, criteria[column].weight)));
}

function fuzzyToCrispMatrix(matrix: FuzzyNumber[][]): number[][] {
  return matrix.map((row) => row.map(defuzzify));
}

function fuzzyColumnValues(matrix: FuzzyNumber[][], column: number): FuzzyNumber[] {
  return matrix.map((row) => row[column]);
}

function fuzzyRankByCriterion(matrix: FuzzyNumber[][], criteria: Criterion[]): number[][] {
  const ranksByCriterion = criteria.map((criterion, column) => {
    const values = fuzzyColumnValues(matrix, column);
    const sorted = values
      .map((value, index) => ({ value, index }))
      .sort((a, b) => -compareFuzzy(a.value, b.value, criterion.direction === 'benefit'));
    const ranks = Array.from({ length: values.length }, () => 0);
    sorted.forEach((item, index) => {
      ranks[item.index] = index + 1;
    });
    return ranks;
  });
  return matrix.map((_, alternative) => criteria.map((__, column) => ranksByCriterion[column][alternative]));
}

function fuzzyRatioNormalizeMatrix(matrix: FuzzyNumber[][], criteria: Criterion[], inverse = false): FuzzyNumber[][] {
  return matrix.map((row) => row.map((value, column) => {
    const centroids = fuzzyColumnValues(matrix, column).map((item) => Math.max(Math.abs(defuzzify(item)), 1e-12));
    const min = Math.min(...centroids);
    const max = Math.max(...centroids);
    const benefitMode = criteria[column].direction === 'benefit';
    const useForward = inverse ? !benefitMode : benefitMode;
    return useForward ? divideFuzzyByScalar(value, max || 1) : scaleFuzzy(reciprocalFuzzy(value), min);
  }));
}

function fuzzyRangeNormalizeMatrix(matrix: FuzzyNumber[][], criteria: Criterion[]): FuzzyNumber[][] {
  return matrix.map((row) => row.map((value, column) => {
    const values = fuzzyColumnValues(matrix, column).map(defuzzify);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min;
    if (Math.abs(span) <= 1e-12) return crispFuzzy(1);
    const shifted = criteria[column].direction === 'cost'
      ? subtractFuzzy(crispFuzzy(max), value)
      : subtractFuzzy(value, crispFuzzy(min));
    return divideFuzzyByScalar(shifted, span);
  }));
}

function fuzzySumNormalizeMatrix(matrix: FuzzyNumber[][], criteria: Criterion[]): FuzzyNumber[][] {
  return matrix.map((row) => row.map((value, column) => {
    const columnValues = fuzzyColumnValues(matrix, column);
    if (criteria[column].direction === 'cost') {
      const reciprocalValues = columnValues.map(reciprocalFuzzy);
      const denominator = sumFuzzyRow(reciprocalValues);
      return divideFuzzyByScalar(reciprocalFuzzy(value), Math.max(defuzzify(denominator), 1e-12));
    }
    const denominator = sumFuzzyRow(columnValues);
    return divideFuzzyByScalar(value, Math.max(defuzzify(denominator), 1e-12));
  }));
}

function fuzzyLogNormalizeMatrix(matrix: FuzzyNumber[][], criteria: Criterion[]): FuzzyNumber[][] {
  return matrix.map((row) => row.map((value, column) => {
    const centroids = fuzzyColumnValues(matrix, column).map((item) => Math.max(Math.abs(defuzzify(item)), 1e-12));
    const min = Math.min(...centroids);
    const max = Math.max(...centroids);
    const values = value.values.map((component) => Math.log1p(Math.max(Math.abs(component), 1e-12)));
    const denominator = criteria[column].direction === 'cost'
      ? Math.max(...values)
      : Math.log1p(max);
    const numerator = criteria[column].direction === 'cost'
      ? Math.log1p(min)
      : undefined;
    return {
      values: values.map((component) => criteria[column].direction === 'cost'
        ? (numerator ?? 0) / Math.max(component, 1e-12)
        : component / Math.max(denominator, 1e-12)),
      type: value.type,
    };
  }));
}

function fuzzyDistanceToReference(matrix: FuzzyNumber[][], references: FuzzyNumber[], bounds: { min: number; max: number }[]): number[][] {
  return matrix.map((row) => row.map((value, column) => fuzzyDistance(value, references[column]) / (Math.abs(bounds[column].max - bounds[column].min) || 1)));
}

function fuzzySignedDominance(first: FuzzyNumber, second: FuzzyNumber, criterion: Criterion): number {
  const comparison = compareFuzzy(first, second, criterion.direction === 'benefit');
  if (Math.abs(comparison) <= 1e-12) return 0;
  return comparison > 0 ? 1 : -1;
}

function fuzzyStandardDiagnostic(method: MethodDefinition, analysis: AnalysisResult, detail: string): AnalysisResult {
  const label = method.fuzzySupport.nativeModeLabel ?? `Native fuzzy ${method.name}`;
  analysis.diagnostics.push({ label, value: detail, status: 'pass' });
  analysis.reproducibility = {
    ...analysis.reproducibility,
    fuzzyMode: label,
    fuzzyRankingConvention: FUZZY_RANKING_CONVENTION,
    fuzzyValidationStatus: 'Native fuzzy implemented; external fuzzy fixture pending unless separately listed in validation evidence.',
  };
  return analysis;
}

function runFuzzyMoora(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  const criteria = resolveCriteria(input, config);
  const fuzzyMatrix = input.fuzzyValues?.length
    ? input.fuzzyValues
    : input.values.map((row) => row.map((value) => crispFuzzy(value)));
  const normalizedCriteria = normalizeWeights(criteria);
  const normalized = fuzzyMatrix.map((row) => row.map((value, column) => {
    const columnValues = fuzzyMatrix.map((item) => item[column]);
    const componentCount = Math.max(...columnValues.map((item) => item.values.length), value.values.length);
    const denominators = Array.from({ length: componentCount }, (_, component) =>
      Math.sqrt(columnValues.reduce((sum, item) => sum + fuzzyComponentAt(item, component, componentCount) ** 2, 0)) || 1,
    );
    return {
      values: Array.from({ length: componentCount }, (_, component) => fuzzyComponentAt(value, component, componentCount) / denominators[component]),
      type: componentCount === 4 ? 'trapezoidal' : value.type === 'crisp' ? 'crisp' : 'triangular',
    } as FuzzyNumber;
  }));
  const weightedFuzzy = normalized.map((row) => row.map((value, column) => scaleFuzzy(value, normalizedCriteria[column].weight)));
  const weightedCrisp = weightedFuzzy.map((row) => row.map(defuzzify));
  const benefit = weightedCrisp.map((row) => row.reduce((sum, value, column) => sum + (normalizedCriteria[column].direction === 'benefit' ? value : 0), 0));
  const cost = weightedCrisp.map((row) => row.reduce((sum, value, column) => sum + (normalizedCriteria[column].direction === 'cost' ? value : 0), 0));
  const scores = benefit.map((value, index) => value - cost[index]);
  const analysis = result(method, { ...input, criteria: normalizedCriteria, fuzzyValues: fuzzyMatrix }, [
    {
      id: 'fuzzy-moora-ratio',
      title: 'Fuzzy MOORA Ratio Matrix',
      columns: ['Alternative', ...criteria.map((criterion) => criterion.id)],
      rows: normalized.map((row, index) => [input.alternatives[index].name, ...row.map((value) => fuzzyLabel(value))]),
    },
    {
      id: 'fuzzy-moora-weighted-ratio',
      title: 'Fuzzy MOORA Weighted Ratio Matrix',
      columns: ['Alternative', ...criteria.map((criterion) => criterion.id)],
      rows: weightedFuzzy.map((row, index) => [input.alternatives[index].name, ...row.map((value) => fuzzyLabel(value))]),
    },
    {
      id: 'fuzzy-moora-net',
      title: 'Fuzzy MOORA Net Assessment',
      columns: ['Alternative', 'Benefit Sum', 'Cost Sum', 'Net Score'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, round(benefit[index]), round(cost[index]), round(scores[index])]),
    },
  ], scores, 'Native fuzzy MOORA preserves triangular/trapezoidal uploaded values through fuzzy vector ratio normalization and fuzzy weighting, then ranks alternatives by centroid benefit-minus-cost net assessment.');
  analysis.diagnostics.push({ label: 'Native fuzzy MOORA', value: 'Fuzzy ratio normalization with centroid net assessment', status: 'pass' });
  analysis.reproducibility = { ...analysis.reproducibility, fuzzyMode: 'Native fuzzy MOORA', fuzzyMoora: 'Component-wise fuzzy vector normalization, fuzzy weighting, centroid benefit-cost net score' };
  return analysis;
}

function runAras(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  if (config.methodParams.fuzzyInputMode === 'Native fuzzy ARAS') {
    return runFuzzyAras(input, config, method);
  }
  const criteria = resolveCriteria(input, config);
  const optimal = input.values[0].map((_, column) => criteria[column].direction === 'benefit' ? Math.max(...input.values.map((row) => row[column])) : Math.min(...input.values.map((row) => row[column])));
  const augmented = [optimal, ...input.values];
  const sums = augmented[0].map((_, column) => augmented.reduce((sum, row) => sum + Math.abs(row[column]), 0) || 1);
  const normalizedAugmented = augmented.map((row) => row.map((value, column) => criteria[column].direction === 'cost' ? (1 / Math.max(value, 1e-9)) / augmented.reduce((sum, item) => sum + 1 / Math.max(item[column], 1e-9), 0) : value / sums[column]));
  const weightedAugmented = weighted(normalizedAugmented, criteria);
  const optimality = weightedAugmented.map((row) => row.reduce((sum, value) => sum + value, 0));
  const scores = optimality.slice(1).map((value) => value / (optimality[0] || 1));
  return result(method, { ...input, criteria }, [
    tableFromMatrix('aras-normalized', 'ARAS Normalized Matrix', normalizedAugmented.slice(1), input),
    tableFromMatrix('aras-weighted', 'ARAS Weighted Matrix', weightedAugmented.slice(1), input),
    { id: 'aras-utility', title: 'ARAS Optimality and Utility Degree', columns: ['Alternative', 'S', 'K'], rows: input.alternatives.map((alternative, index) => [alternative.name, round(optimality[index + 1]), round(scores[index])]) },
  ], scores, 'ARAS compares each alternative against an optimal reference alternative and ranks by utility degree.');
}

function runFuzzyAras(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  const criteria = resolveCriteria(input, config);
  const fuzzyMatrix = input.fuzzyValues?.length
    ? input.fuzzyValues
    : input.values.map((row) => row.map((value) => crispFuzzy(value)));
  const normalizedCriteria = normalizeWeights(criteria);
  const optimal = fuzzyMatrix[0].map((_, column) => {
    const columnValues = fuzzyMatrix.map((row) => row[column]);
    return columnValues.reduce((best, value) => {
      const better = criteria[column].direction === 'benefit'
        ? defuzzify(value) > defuzzify(best)
        : defuzzify(value) < defuzzify(best);
      return better ? value : best;
    }, columnValues[0]);
  });
  const augmented = [optimal, ...fuzzyMatrix];
  const normalizedAugmented = augmented.map((row) => row.map((value, column) => {
    if (criteria[column].direction === 'cost') {
      const reciprocalValues = augmented.map((item) => reciprocalFuzzy(item[column]));
      const denominator = reciprocalValues.reduce((sum, item) => sum + Math.max(defuzzify(item), 1e-9), 0) || 1;
      return divideFuzzyByScalar(reciprocalFuzzy(value), denominator);
    }
    const denominator = augmented.reduce((sum, item) => sum + Math.max(defuzzify(item[column]), 1e-9), 0) || 1;
    return divideFuzzyByScalar(value, denominator);
  }));
  const weightedAugmented = normalizedAugmented.map((row) => row.map((value, column) => scaleFuzzy(value, normalizedCriteria[column].weight)));
  const optimality = weightedAugmented.map((row) => row.reduce((sum, value) => sum + defuzzify(value), 0));
  const scores = optimality.slice(1).map((value) => value / (optimality[0] || 1));
  const analysis = result(method, { ...input, criteria: normalizedCriteria, fuzzyValues: fuzzyMatrix }, [
    {
      id: 'fuzzy-aras-optimal',
      title: 'Fuzzy ARAS Optimal Reference',
      columns: ['Reference', ...criteria.map((criterion) => criterion.id)],
      rows: [['Optimal', ...optimal.map((value) => fuzzyLabel(value))]],
    },
    {
      id: 'fuzzy-aras-normalized',
      title: 'Fuzzy ARAS Normalized Matrix',
      columns: ['Alternative', ...criteria.map((criterion) => criterion.id)],
      rows: normalizedAugmented.slice(1).map((row, index) => [input.alternatives[index].name, ...row.map((value) => fuzzyLabel(value))]),
    },
    {
      id: 'fuzzy-aras-weighted',
      title: 'Fuzzy ARAS Weighted Matrix',
      columns: ['Alternative', ...criteria.map((criterion) => criterion.id)],
      rows: weightedAugmented.slice(1).map((row, index) => [input.alternatives[index].name, ...row.map((value) => fuzzyLabel(value))]),
    },
    {
      id: 'fuzzy-aras-utility',
      title: 'Fuzzy ARAS Optimality and Utility Degree',
      columns: ['Alternative', 'S', 'K'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, round(optimality[index + 1]), round(scores[index])]),
    },
  ], scores, 'Native fuzzy ARAS preserves triangular/trapezoidal uploaded values, constructs a fuzzy optimal reference, normalizes and weights fuzzy values, and ranks alternatives by centroid utility degree.');
  analysis.diagnostics.push({ label: 'Native fuzzy ARAS', value: 'Fuzzy optimal reference with centroid utility degree', status: 'pass' });
  analysis.reproducibility = { ...analysis.reproducibility, fuzzyMode: 'Native fuzzy ARAS', fuzzyAras: 'Fuzzy optimal reference, fuzzy normalization/weighting, centroid utility degree K' };
  return analysis;
}

function runVikor(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  if (config.methodParams.fuzzyInputMode === 'Native fuzzy VIKOR') {
    return runFuzzyVikor(input, config, method);
  }
  const criteria = resolveCriteria(input, config);
  const best = input.values[0].map((_, column) => criteria[column].direction === 'benefit' ? Math.max(...input.values.map((row) => row[column])) : Math.min(...input.values.map((row) => row[column])));
  const worst = input.values[0].map((_, column) => criteria[column].direction === 'benefit' ? Math.min(...input.values.map((row) => row[column])) : Math.max(...input.values.map((row) => row[column])));
  const regret = input.values.map((row) => row.map((value, column) => criteria[column].weight * Math.abs(best[column] - value) / (Math.abs(best[column] - worst[column]) || 1)));
  const s = regret.map((row) => row.reduce((sum, value) => sum + value, 0));
  const r = regret.map((row) => Math.max(...row));
  const sMin = Math.min(...s), sMax = Math.max(...s), rMin = Math.min(...r), rMax = Math.max(...r);
  const v = Number(config.methodParams.vikorV ?? config.vikorV);
  const q = s.map((value, index) => v * (value - sMin) / (sMax - sMin || 1) + (1 - v) * (r[index] - rMin) / (rMax - rMin || 1));
  const rankedIndexes = q.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
  const topIndex = rankedIndexes[0]?.index ?? 0;
  const secondIndex = rankedIndexes[1]?.index ?? topIndex;
  const advantageMode = String(config.methodParams.vikorAcceptableAdvantageMode ?? 'Auto DQ = 1/(m-1)');
  const dq = advantageMode === 'Manual DQ' ? Number(config.methodParams.vikorAcceptableAdvantageDQ ?? 0) : 1 / Math.max(input.alternatives.length - 1, 1);
  const sLeader = s.indexOf(Math.min(...s));
  const rLeader = r.indexOf(Math.min(...r));
  const advantageGap = q[secondIndex] - q[topIndex];
  const acceptableAdvantage = advantageGap >= dq;
  const stable = topIndex === sLeader || topIndex === rLeader;
  const stabilityRule = String(config.methodParams.vikorStabilityRule ?? 'Q winner must also lead S or R');
  const analysis = result(method, { ...input, criteria }, [
    { id: 'vikor', title: 'VIKOR Measures', columns: ['Alternative', 'S', 'R', 'Q'], rows: input.alternatives.map((alternative, index) => [alternative.name, round(s[index]), round(r[index]), round(q[index])]) },
    { id: 'vikor-acceptable-solution', title: 'VIKOR Acceptable Solution Checks', columns: ['Check', 'Value', 'Rule', 'Status'], rows: [
      ['Acceptable advantage', round(advantageGap), `DQ = ${round(dq)}`, acceptableAdvantage ? 'Accepted' : 'Not satisfied'],
      ['Acceptable stability', input.alternatives[topIndex]?.name ?? '', stabilityRule, stable ? 'Accepted' : 'Review compromise set'],
    ] },
  ], q, 'VIKOR identifies a compromise solution using group utility S, individual regret R, and compromise index Q.', false);
  analysis.diagnostics.push(
    { label: 'VIKOR acceptable advantage', value: `Q(2) - Q(1) = ${round(advantageGap)} / DQ ${round(dq)}`, status: acceptableAdvantage ? 'pass' : 'warn' },
    { label: 'VIKOR acceptable stability', value: `${input.alternatives[topIndex]?.name ?? 'Top Q result'} ${stable ? 'also leads S or R' : 'does not lead S or R'}`, status: stable || stabilityRule === 'Diagnostic only' ? 'pass' : 'warn' },
  );
  analysis.reproducibility = { ...analysis.reproducibility, v: round(v), vikorAcceptableAdvantageMode: advantageMode, vikorDQ: round(dq), vikorAdvantageGap: round(advantageGap), vikorStabilityRule: stabilityRule, vikorStable: stable };
  return analysis;
}

function runFuzzyVikor(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  const criteria = resolveCriteria(input, config);
  const fuzzyMatrix = input.fuzzyValues?.length
    ? input.fuzzyValues
    : input.values.map((row) => row.map((value) => crispFuzzy(value)));
  const normalizedCriteria = normalizeWeights(criteria);
  const idealBest = criteria.map((criterion, column) => {
    const values = fuzzyMatrix.map((row) => row[column]);
    const selected = criterion.direction === 'benefit'
      ? values.reduce((best, value) => defuzzify(value) > defuzzify(best) ? value : best, values[0])
      : values.reduce((best, value) => defuzzify(value) < defuzzify(best) ? value : best, values[0]);
    return selected;
  });
  const idealWorst = criteria.map((criterion, column) => {
    const values = fuzzyMatrix.map((row) => row[column]);
    const selected = criterion.direction === 'benefit'
      ? values.reduce((worst, value) => defuzzify(value) < defuzzify(worst) ? value : worst, values[0])
      : values.reduce((worst, value) => defuzzify(value) > defuzzify(worst) ? value : worst, values[0]);
    return selected;
  });
  const regret = fuzzyMatrix.map((row) => row.map((value, column) => {
    const denominator = fuzzyDistance(idealBest[column], idealWorst[column]) || 1;
    return normalizedCriteria[column].weight * fuzzyDistance(value, idealBest[column]) / denominator;
  }));
  const s = regret.map((row) => row.reduce((sum, value) => sum + value, 0));
  const r = regret.map((row) => Math.max(...row));
  const sMin = Math.min(...s), sMax = Math.max(...s), rMin = Math.min(...r), rMax = Math.max(...r);
  const v = Number(config.methodParams.vikorV ?? config.vikorV);
  const q = s.map((value, index) => v * (value - sMin) / (sMax - sMin || 1) + (1 - v) * (r[index] - rMin) / (rMax - rMin || 1));
  const rankedIndexes = q.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
  const topIndex = rankedIndexes[0]?.index ?? 0;
  const secondIndex = rankedIndexes[1]?.index ?? topIndex;
  const advantageMode = String(config.methodParams.vikorAcceptableAdvantageMode ?? 'Auto DQ = 1/(m-1)');
  const dq = advantageMode === 'Manual DQ' ? Number(config.methodParams.vikorAcceptableAdvantageDQ ?? 0) : 1 / Math.max(input.alternatives.length - 1, 1);
  const sLeader = s.indexOf(Math.min(...s));
  const rLeader = r.indexOf(Math.min(...r));
  const advantageGap = q[secondIndex] - q[topIndex];
  const acceptableAdvantage = advantageGap >= dq;
  const stable = topIndex === sLeader || topIndex === rLeader;
  const stabilityRule = String(config.methodParams.vikorStabilityRule ?? 'Q winner must also lead S or R');
  const analysis = result(method, { ...input, criteria, fuzzyValues: fuzzyMatrix }, [
    {
      id: 'fuzzy-vikor-input',
      title: 'Fuzzy VIKOR Input Matrix',
      columns: ['Alternative', ...criteria.map((criterion) => criterion.id)],
      rows: fuzzyMatrix.map((row, index) => [input.alternatives[index].name, ...row.map((value) => fuzzyLabel(value))]),
    },
    {
      id: 'fuzzy-vikor-ideal',
      title: 'Fuzzy VIKOR Best and Worst References',
      columns: ['Type', ...criteria.map((criterion) => criterion.id)],
      rows: [['Fuzzy best', ...idealBest.map((value) => fuzzyLabel(value))], ['Fuzzy worst', ...idealWorst.map((value) => fuzzyLabel(value))]],
    },
    tableFromMatrix('fuzzy-vikor-regret', 'Fuzzy VIKOR Weighted Regret Matrix', regret, input),
    {
      id: 'fuzzy-vikor-measures',
      title: 'Fuzzy VIKOR S, R, and Q Measures',
      columns: ['Alternative', 'S', 'R', 'Q'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, round(s[index]), round(r[index]), round(q[index])]),
    },
    { id: 'fuzzy-vikor-acceptable-solution', title: 'Fuzzy VIKOR Acceptable Solution Checks', columns: ['Check', 'Value', 'Rule', 'Status'], rows: [
      ['Acceptable advantage', round(advantageGap), `DQ = ${round(dq)}`, acceptableAdvantage ? 'Accepted' : 'Not satisfied'],
      ['Acceptable stability', input.alternatives[topIndex]?.name ?? '', stabilityRule, stable ? 'Accepted' : 'Review compromise set'],
    ] },
  ], q, 'Native fuzzy VIKOR preserves triangular/trapezoidal uploaded values, identifies fuzzy best and worst references, computes fuzzy-distance regret by criterion, and ranks by the VIKOR Q compromise index.', false);
  analysis.diagnostics.push({ label: 'Native fuzzy VIKOR', value: `v = ${round(v)} with fuzzy-distance regret measures`, status: 'pass' });
  analysis.diagnostics.push(
    { label: 'VIKOR acceptable advantage', value: `Q(2) - Q(1) = ${round(advantageGap)} / DQ ${round(dq)}`, status: acceptableAdvantage ? 'pass' : 'warn' },
    { label: 'VIKOR acceptable stability', value: `${input.alternatives[topIndex]?.name ?? 'Top Q result'} ${stable ? 'also leads S or R' : 'does not lead S or R'}`, status: stable || stabilityRule === 'Diagnostic only' ? 'pass' : 'warn' },
  );
  analysis.reproducibility = { ...analysis.reproducibility, fuzzyMode: 'Native fuzzy VIKOR', fuzzyVikor: 'Fuzzy best/worst references, vertex-distance regret, S/R/Q compromise index', v: round(v), vikorAcceptableAdvantageMode: advantageMode, vikorDQ: round(dq), vikorAdvantageGap: round(advantageGap), vikorStabilityRule: stabilityRule, vikorStable: stable };
  return analysis;
}

function runWeightedSum(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition, name: string): AnalysisResult {
  if (method.id === 'saw' && config.methodParams.fuzzyInputMode === 'Native fuzzy SAW') {
    return runFuzzySaw(input, config, method);
  }
  const criteria = resolveCriteria(input, config);
  const normalized = minMaxNormalize(input);
  const weightedMatrix = weighted(normalized, criteria);
  const scores = weightedMatrix.map((row) => row.reduce((sum, value) => sum + value, 0));
  return result(method, { ...input, criteria }, [tableFromMatrix('normalized', 'Normalized Matrix', normalized, input), tableFromMatrix('weighted', `${name} Weighted Matrix`, weightedMatrix, input)], scores, `${name} aggregates normalized criterion performance into a composite utility score.`);
}

function runSrp(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  if (config.methodParams.fuzzyInputMode === 'Native fuzzy SRP') return runFuzzySrp(input, config, method);
  const criteria = resolveCriteria(input, config);
  const rankMatrixByCriterion = criteria.map((criterion, column) =>
    averageRanks(input.values.map((row) => row[column]), criterion.direction === 'benefit'),
  );
  const rankMatrix = input.alternatives.map((_, alternativeIndex) =>
    criteria.map((__, column) => rankMatrixByCriterion[column][alternativeIndex]),
  );
  const weightedRankMatrix = rankMatrix.map((row) => row.map((rankValue, column) => rankValue * criteria[column].weight));
  const rankingScore = weightedRankMatrix.map((row) => row.reduce((sum, value) => sum + value, 0));
  const scores = rankingScore.map((value) => input.alternatives.length - value);
  return result(method, { ...input, criteria }, [
    tableFromMatrix('srp-rank-matrix', 'SRP Criterion-Wise Rank Matrix', rankMatrix, input),
    tableFromMatrix('srp-weighted-rank-matrix', 'SRP Weighted Rank Matrix', weightedRankMatrix, input),
    {
      id: 'srp-final-score',
      title: 'SRP Final Preference Scores',
      columns: ['Alternative', 'Weighted rank score', 'Preference score'],
      rows: input.alternatives.map((alternative, index) => [
        alternative.name,
        round(rankingScore[index]),
        round(scores[index]),
      ]),
    },
  ], scores, 'SRP avoids normalization by ranking alternatives within each criterion, multiplying those ranks by criterion weights, and prioritizing the highest final preference score.');
}

function runFuca(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  if (config.methodParams.fuzzyInputMode === 'Native fuzzy FUCA') return runFuzzyFuca(input, config, method);
  const criteria = resolveCriteria(input, config);
  const rankMatrixByCriterion = criteria.map((criterion, column) =>
    averageRanks(input.values.map((row) => row[column]), criterion.direction === 'benefit'),
  );
  const rankMatrix = input.alternatives.map((_, alternativeIndex) =>
    criteria.map((__, column) => rankMatrixByCriterion[column][alternativeIndex]),
  );
  const weightedRankMatrix = rankMatrix.map((row) => row.map((rankValue, column) => rankValue * criteria[column].weight));
  const scores = weightedRankMatrix.map((row) => row.reduce((sum, value) => sum + value, 0));
  return result(method, { ...input, criteria }, [
    tableFromMatrix('fuca-rank-matrix', 'FUCA Criterion-Wise Rank Matrix', rankMatrix, input),
    tableFromMatrix('fuca-weighted-rank-matrix', 'FUCA Weighted Rank Matrix', weightedRankMatrix, input),
    {
      id: 'fuca-final-score',
      title: 'FUCA Final Scores',
      columns: ['Alternative', 'Weighted rank score', 'Ranking rule'],
      rows: input.alternatives.map((alternative, index) => [
        alternative.name,
        round(scores[index]),
        'Lower score is better',
      ]),
    },
  ], scores, 'FUCA ranks alternatives within each criterion, multiplies criterion ranks by weights, and selects the alternative with the smallest weighted rank score.', false);
}

function runSeca(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  if (config.methodParams.fuzzyInputMode === 'Native fuzzy SECA') return runFuzzySeca(input, config, method);
  const normalized = input.values.map((row) => row.map((value, column) => {
    const columnValues = input.values.map((item) => Math.max(Math.abs(item[column]), 1e-12));
    const safeValue = Math.max(Math.abs(value), 1e-12);
    if (input.criteria[column].direction === 'cost') return Math.min(...columnValues) / safeValue;
    return safeValue / Math.max(...columnValues);
  }));
  const std = input.criteria.map((_, column) => {
    const values = normalized.map((row) => row[column]);
    const mean = values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
    return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(values.length, 1));
  });
  const stdTotal = std.reduce((sum, value) => sum + value, 0) || 1;
  const sigmaReference = std.map((value) => value / stdTotal);
  const correlationUniqueness = input.criteria.map((_, column) => {
    const values = normalized.map((row) => row[column]);
    return input.criteria.reduce((sum, __, otherColumn) => {
      const other = normalized.map((row) => row[otherColumn]);
      return sum + (1 - pearson(values, other));
    }, 0);
  });
  const uniquenessTotal = correlationUniqueness.reduce((sum, value) => sum + value, 0) || 1;
  const piReference = correlationUniqueness.map((value) => value / uniquenessTotal);
  const performancePressure = input.criteria.map((_, column) =>
    normalized.reduce((sum, row) => sum + row[column], 0) / Math.max(normalized.length, 1),
  );
  const performanceTotal = performancePressure.reduce((sum, value) => sum + value, 0) || 1;
  const performanceReference = performancePressure.map((value) => value / performanceTotal);
  const epsilon = Math.max(0, Math.min(1 / Math.max(input.criteria.length, 1), Number(config.methodParams.secaEpsilon ?? 0.001)));
  const balance = Math.min(1, Math.max(0, Number(config.methodParams.secaReferenceBalance ?? 0.5)));
  const rawWeights = input.criteria.map((_, index) =>
    Math.max(epsilon, balance * performanceReference[index] + ((1 - balance) / 2) * (sigmaReference[index] + piReference[index])),
  );
  const rawTotal = rawWeights.reduce((sum, value) => sum + value, 0) || 1;
  const weights = rawWeights.map((value) => value / rawTotal);
  const secaCriteria = input.criteria.map((criterion, index) => ({ ...criterion, weight: weights[index] }));
  const weightedMatrix = weighted(normalized, secaCriteria);
  const scores = weightedMatrix.map((row) => row.reduce((sum, value) => sum + value, 0));
  const lambdaB = weights.reduce((sum, value, index) => sum + (value - sigmaReference[index]) ** 2, 0);
  const lambdaC = weights.reduce((sum, value, index) => sum + (value - piReference[index]) ** 2, 0);
  return result(method, { ...input, criteria: secaCriteria }, [
    tableFromMatrix('seca-normalized', 'SECA Normalized Decision Matrix', normalized, input),
    {
      id: 'seca-reference-weights',
      title: 'SECA Criteria Reference Points and Derived Weights',
      columns: ['Criterion', 'Std reference sigmaN', 'Correlation reference piN', 'Performance reference', 'SECA weight'],
      rows: input.criteria.map((criterion, index) => [
        criterion.id,
        round(sigmaReference[index]),
        round(piReference[index]),
        round(performanceReference[index]),
        round(weights[index]),
      ]),
    },
    tableFromMatrix('seca-weighted', 'SECA Weighted Normalized Matrix', weightedMatrix, { ...input, criteria: secaCriteria }),
    {
      id: 'seca-objectives',
      title: 'SECA Objective Summary',
      columns: ['Objective', 'Value'],
      rows: [
        ['lambda_b weight deviation from sigmaN', round(lambdaB)],
        ['lambda_c weight deviation from piN', round(lambdaC)],
        ['reference balance', round(balance)],
        ['minimum weight epsilon', round(epsilon)],
      ],
    },
  ], scores, 'SECA simultaneously estimates objective criterion weights and alternative performance from the normalized decision matrix using standard-deviation and correlation-based reference points.');
}

function runDear(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  if (config.methodParams.fuzzyInputMode === 'Native fuzzy DEAR') return runFuzzyDear(input, config, method);
  const responseWeights = input.values.map((row) => row.map((value, column) => {
    const columnValues = input.values.map((item) => Math.max(Math.abs(item[column]), 1e-12));
    const safeValue = Math.max(Math.abs(value), 1e-12);
    if (input.criteria[column].direction === 'cost') {
      const reciprocalSum = columnValues.reduce((sum, item) => sum + 1 / item, 0) || 1;
      return (1 / safeValue) / reciprocalSum;
    }
    const sum = columnValues.reduce((total, item) => total + item, 0) || 1;
    return safeValue / sum;
  }));
  const criteria = normalizeWeights(input.criteria);
  const weightedResponseWeights = responseWeights.map((row) => row.map((value, column) => value * criteria[column].weight));
  const unweightedMrpi = responseWeights.map((row) => row.reduce((sum, value) => sum + value, 0) / Math.max(row.length, 1));
  const scores = weightedResponseWeights.map((row) => row.reduce((sum, value) => sum + value, 0));
  return result(method, { ...input, criteria }, [
    tableFromMatrix('dear-response-weights', 'DEAR Response Weights', responseWeights, input),
    tableFromMatrix('dear-weighted-response-weights', 'DEAR Weighted Response Weights', weightedResponseWeights, { ...input, criteria }),
    {
      id: 'dear-mrpi',
      title: 'DEAR Multi-Response Performance Index',
      columns: ['Alternative', 'Unweighted MRPI', 'Weighted MRPI', 'Ranking rule'],
      rows: input.alternatives.map((alternative, index) => [
        alternative.name,
        round(unweightedMrpi[index]),
        round(scores[index]),
        'Higher is better',
      ]),
    },
  ], scores, 'DEAR converts each criterion response into a benefit/cost-aware desirability weight across alternatives and ranks alternatives by the weighted multi-response performance index.');
}

function runEamr(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  if (config.methodParams.fuzzyInputMode === 'Native fuzzy EAMR') return runFuzzyEamr(input, config, method);
  const criteria = normalizeWeights(resolveCriteria(input, config));
  const beta = Number(config.methodParams.eamrBeta ?? 0.5);
  const lambda = Number(config.methodParams.eamrLambda ?? 0.5);
  const blend = Number.isFinite(beta) ? Math.min(1, Math.max(0, beta)) : 0.5;
  const coefficient = Number.isFinite(lambda) ? Math.min(1, Math.max(0, lambda)) : 0.5;
  const rangeNormalized = input.values.map((row) => row.map((value, column) => {
    const columnValues = input.values.map((item) => item[column]).filter(Number.isFinite);
    const min = Math.min(...columnValues);
    const max = Math.max(...columnValues);
    if (Math.abs(max - min) <= 1e-12) return 1;
    return criteria[column].direction === 'cost'
      ? (max - value) / (max - min)
      : (value - min) / (max - min);
  }));
  const vectorRaw = vectorNormalize(input.values);
  const vectorNormalized = vectorRaw.map((row) => row.map((value, column) => {
    const columnValues = vectorRaw.map((item) => item[column]).filter(Number.isFinite);
    const min = Math.min(...columnValues);
    const max = Math.max(...columnValues);
    if (Math.abs(max - min) <= 1e-12) return 1;
    return criteria[column].direction === 'cost'
      ? (max - value) / (max - min)
      : (value - min) / (max - min);
  }));
  const blended = rangeNormalized.map((row, rowIndex) =>
    row.map((value, column) => blend * value + (1 - blend) * vectorNormalized[rowIndex][column]),
  );
  const weightedMatrix = weighted(blended, criteria);
  const benefitSums = weightedMatrix.map((row) => row.reduce((sum, value, column) => sum + (criteria[column].direction === 'benefit' ? value : 0), 0));
  const costControlSums = weightedMatrix.map((row) => row.reduce((sum, value, column) => sum + (criteria[column].direction === 'cost' ? value : 0), 0));
  const scores = benefitSums.map((benefit, index) => benefit ** coefficient + costControlSums[index] ** (1 - coefficient));
  return result(method, { ...input, criteria }, [
    tableFromMatrix('eamr-range-normalized', 'EAMR Range-Normalized Matrix', rangeNormalized, input),
    tableFromMatrix('eamr-vector-normalized', 'EAMR Vector-Normalized Matrix', vectorNormalized, input),
    tableFromMatrix('eamr-blended-normalized', 'EAMR Blended Normalized Matrix', blended, input),
    tableFromMatrix('eamr-weighted', 'EAMR Weighted Matrix', weightedMatrix, { ...input, criteria }),
    {
      id: 'eamr-appraisal',
      title: 'EAMR Benefit-Cost Appraisal',
      columns: ['Alternative', 'Benefit sum', 'Cost-control sum', 'Beta', 'Lambda', 'EAMR score'],
      rows: input.alternatives.map((alternative, index) => [
        alternative.name,
        round(benefitSums[index]),
        round(costControlSums[index]),
        round(blend),
        round(coefficient),
        round(scores[index]),
      ]),
    },
  ], scores, 'EAMR blends range and vector normalization, applies criterion weights, and ranks alternatives by a benefit-cost appraisal score.');
}

function runRawec(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  if (config.methodParams.fuzzyInputMode === 'Native fuzzy RAWEC') return runFuzzyRawec(input, config, method);
  const criteria = normalizeWeights(resolveCriteria(input, config));
  const firstNormalization = input.values.map((row) => row.map((value, column) => {
    const columnValues = input.values.map((item) => Math.max(Math.abs(item[column]), 1e-12));
    const safeValue = Math.max(Math.abs(value), 1e-12);
    const min = Math.min(...columnValues);
    const max = Math.max(...columnValues);
    return criteria[column].direction === 'cost' ? min / safeValue : safeValue / Math.max(max, 1e-12);
  }));
  const secondNormalization = input.values.map((row) => row.map((value, column) => {
    const columnValues = input.values.map((item) => Math.max(Math.abs(item[column]), 1e-12));
    const safeValue = Math.max(Math.abs(value), 1e-12);
    const min = Math.min(...columnValues);
    const max = Math.max(...columnValues);
    return criteria[column].direction === 'cost' ? safeValue / Math.max(max, 1e-12) : min / safeValue;
  }));
  const firstDeviation = firstNormalization.map((row) => row.map((value, column) => criteria[column].weight * (1 - value)));
  const secondDeviation = secondNormalization.map((row) => row.map((value, column) => criteria[column].weight * (1 - value)));
  const v = firstDeviation.map((row) => row.reduce((sum, value) => sum + value, 0));
  const vPrime = secondDeviation.map((row) => row.reduce((sum, value) => sum + value, 0));
  const scores = v.map((value, index) => (vPrime[index] - value) / Math.max(vPrime[index] + value, 1e-12));
  return result(method, { ...input, criteria }, [
    tableFromMatrix('rawec-first-normalized', 'RAWEC First Normalized Matrix', firstNormalization, input),
    tableFromMatrix('rawec-second-normalized', 'RAWEC Second Normalized Matrix', secondNormalization, input),
    tableFromMatrix('rawec-first-deviation', 'RAWEC Weighted Deviation from First Normalization', firstDeviation, { ...input, criteria }),
    tableFromMatrix('rawec-second-deviation', 'RAWEC Weighted Deviation from Second Normalization', secondDeviation, { ...input, criteria }),
    {
      id: 'rawec-index',
      title: 'RAWEC Deviation Index',
      columns: ['Alternative', 'v', "v'", 'Q', 'Ranking rule'],
      rows: input.alternatives.map((alternative, index) => [
        alternative.name,
        round(v[index]),
        round(vPrime[index]),
        round(scores[index]),
        'Higher Q is better',
      ]),
    },
  ], scores, 'RAWEC applies dual benefit/cost normalization, compares weighted deviations from criterion weights, and ranks alternatives by the Q deviation index.');
}

function runFuzzySrp(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  const criteria = normalizeWeights(resolveCriteria(input, config));
  const fuzzyMatrix = activeFuzzyMatrix(input);
  const rankMatrix = fuzzyRankByCriterion(fuzzyMatrix, criteria);
  const weightedRankMatrix = weighted(rankMatrix, criteria);
  const rankingScore = weightedRankMatrix.map((row) => row.reduce((sum, value) => sum + value, 0));
  const scores = rankingScore.map((value) => input.alternatives.length - value);
  const analysis = result(method, { ...input, criteria, fuzzyValues: fuzzyMatrix }, [
    fuzzyDecisionMatrixRows('Fuzzy SRP Input Matrix', 'fuzzy-srp-input', fuzzyMatrix, input),
    tableFromMatrix('fuzzy-srp-rank-matrix', 'Fuzzy SRP Criterion-Wise Rank Matrix', rankMatrix, input),
    tableFromMatrix('fuzzy-srp-weighted-rank-matrix', 'Fuzzy SRP Weighted Rank Matrix', weightedRankMatrix, { ...input, criteria }),
    { id: 'fuzzy-srp-final-score', title: 'Fuzzy SRP Final Preference Scores', columns: ['Alternative', 'Weighted rank score', 'Preference score'], rows: input.alternatives.map((alternative, index) => [alternative.name, round(rankingScore[index]), round(scores[index])]) },
  ], scores, 'Native fuzzy SRP ranks alternatives within each criterion using fuzzy ordering, weights those ranks, and prioritizes the highest preference score.');
  return fuzzyStandardDiagnostic(method, analysis, 'Fuzzy criterion-wise ranks generated with centroid/spread/endpoint ordering.');
}

function runFuzzyFuca(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  const criteria = normalizeWeights(resolveCriteria(input, config));
  const fuzzyMatrix = activeFuzzyMatrix(input);
  const rankMatrix = fuzzyRankByCriterion(fuzzyMatrix, criteria);
  const weightedRankMatrix = weighted(rankMatrix, criteria);
  const scores = weightedRankMatrix.map((row) => row.reduce((sum, value) => sum + value, 0));
  const analysis = result(method, { ...input, criteria, fuzzyValues: fuzzyMatrix }, [
    fuzzyDecisionMatrixRows('Fuzzy FUCA Input Matrix', 'fuzzy-fuca-input', fuzzyMatrix, input),
    tableFromMatrix('fuzzy-fuca-rank-matrix', 'Fuzzy FUCA Criterion-Wise Rank Matrix', rankMatrix, input),
    tableFromMatrix('fuzzy-fuca-weighted-rank-matrix', 'Fuzzy FUCA Weighted Rank Matrix', weightedRankMatrix, { ...input, criteria }),
    { id: 'fuzzy-fuca-final-score', title: 'Fuzzy FUCA Final Scores', columns: ['Alternative', 'Weighted rank score', 'Ranking rule'], rows: input.alternatives.map((alternative, index) => [alternative.name, round(scores[index]), 'Lower score is better']) },
  ], scores, 'Native fuzzy FUCA ranks alternatives within each criterion using fuzzy ordering, multiplies those ranks by weights, and selects the smallest weighted rank score.', false);
  return fuzzyStandardDiagnostic(method, analysis, 'Fuzzy criterion-wise ranks generated; lower weighted rank score is preferred.');
}

function runFuzzySeca(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  const fuzzyMatrix = activeFuzzyMatrix(input);
  const normalized = fuzzyRatioNormalizeMatrix(fuzzyMatrix, input.criteria);
  const centroidNormalized = fuzzyToCrispMatrix(normalized);
  const std = input.criteria.map((_, column) => {
    const values = centroidNormalized.map((row) => row[column]);
    const mean = values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
    return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(values.length, 1));
  });
  const stdTotal = std.reduce((sum, value) => sum + value, 0) || 1;
  const sigmaReference = std.map((value) => value / stdTotal);
  const correlationUniqueness = input.criteria.map((_, column) => {
    const values = centroidNormalized.map((row) => row[column]);
    return input.criteria.reduce((sum, __, otherColumn) => sum + (1 - pearson(values, centroidNormalized.map((row) => row[otherColumn]))), 0);
  });
  const uniquenessTotal = correlationUniqueness.reduce((sum, value) => sum + value, 0) || 1;
  const piReference = correlationUniqueness.map((value) => value / uniquenessTotal);
  const performancePressure = input.criteria.map((_, column) => centroidNormalized.reduce((sum, row) => sum + row[column], 0) / Math.max(centroidNormalized.length, 1));
  const performanceTotal = performancePressure.reduce((sum, value) => sum + value, 0) || 1;
  const performanceReference = performancePressure.map((value) => value / performanceTotal);
  const epsilon = Math.max(0, Math.min(1 / Math.max(input.criteria.length, 1), Number(config.methodParams.secaEpsilon ?? 0.001)));
  const balance = Math.min(1, Math.max(0, Number(config.methodParams.secaReferenceBalance ?? 0.5)));
  const rawWeights = input.criteria.map((_, index) => Math.max(epsilon, balance * performanceReference[index] + ((1 - balance) / 2) * (sigmaReference[index] + piReference[index])));
  const rawTotal = rawWeights.reduce((sum, value) => sum + value, 0) || 1;
  const weights = rawWeights.map((value) => value / rawTotal);
  const criteria = input.criteria.map((criterion, index) => ({ ...criterion, weight: weights[index] }));
  const weightedMatrix = fuzzyWeightedMatrix(normalized, criteria);
  const scores = fuzzyToCrispMatrix(weightedMatrix).map((row) => row.reduce((sum, value) => sum + value, 0));
  const lambdaB = weights.reduce((sum, value, index) => sum + (value - sigmaReference[index]) ** 2, 0);
  const lambdaC = weights.reduce((sum, value, index) => sum + (value - piReference[index]) ** 2, 0);
  const analysis = result(method, { ...input, criteria, fuzzyValues: fuzzyMatrix }, [
    fuzzyDecisionMatrixRows('Fuzzy SECA Normalized Decision Matrix', 'fuzzy-seca-normalized', normalized, input),
    { id: 'fuzzy-seca-reference-weights', title: 'Fuzzy SECA Criteria Reference Points and Derived Weights', columns: ['Criterion', 'Std reference sigmaN', 'Correlation reference piN', 'Performance reference', 'SECA weight'], rows: input.criteria.map((criterion, index) => [criterion.id, round(sigmaReference[index]), round(piReference[index]), round(performanceReference[index]), round(weights[index])]) },
    fuzzyDecisionMatrixRows('Fuzzy SECA Weighted Normalized Matrix', 'fuzzy-seca-weighted', weightedMatrix, { ...input, criteria }),
    { id: 'fuzzy-seca-objectives', title: 'Fuzzy SECA Objective Summary', columns: ['Objective', 'Value'], rows: [['lambda_b weight deviation from sigmaN', round(lambdaB)], ['lambda_c weight deviation from piN', round(lambdaC)], ['reference balance', round(balance)], ['minimum weight epsilon', round(epsilon)]] },
  ], scores, 'Native fuzzy SECA preserves fuzzy normalized and weighted matrices, then derives objective references from centroid projections for standard-deviation, correlation, and performance pressure.');
  return fuzzyStandardDiagnostic(method, analysis, 'Fuzzy ratio normalization preserved; objective weight references are computed from centroid-projected fuzzy normalized values.');
}

function runFuzzyDear(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  const fuzzyMatrix = activeFuzzyMatrix(input);
  const criteria = normalizeWeights(resolveCriteria(input, config));
  const responseWeights = fuzzySumNormalizeMatrix(fuzzyMatrix, criteria);
  const weightedResponseWeights = fuzzyWeightedMatrix(responseWeights, criteria);
  const responseCrisp = fuzzyToCrispMatrix(responseWeights);
  const weightedCrisp = fuzzyToCrispMatrix(weightedResponseWeights);
  const unweightedMrpi = responseCrisp.map((row) => row.reduce((sum, value) => sum + value, 0) / Math.max(row.length, 1));
  const scores = weightedCrisp.map((row) => row.reduce((sum, value) => sum + value, 0));
  const analysis = result(method, { ...input, criteria, fuzzyValues: fuzzyMatrix }, [
    fuzzyDecisionMatrixRows('Fuzzy DEAR Response Weights', 'fuzzy-dear-response-weights', responseWeights, input),
    fuzzyDecisionMatrixRows('Fuzzy DEAR Weighted Response Weights', 'fuzzy-dear-weighted-response-weights', weightedResponseWeights, { ...input, criteria }),
    { id: 'fuzzy-dear-mrpi', title: 'Fuzzy DEAR Multi-Response Performance Index', columns: ['Alternative', 'Unweighted MRPI', 'Weighted MRPI', 'Ranking rule'], rows: input.alternatives.map((alternative, index) => [alternative.name, round(unweightedMrpi[index]), round(scores[index]), 'Higher is better']) },
  ], scores, 'Native fuzzy DEAR converts fuzzy criterion responses into benefit/cost-aware fuzzy response weights and ranks alternatives by centroid weighted MRPI.');
  return fuzzyStandardDiagnostic(method, analysis, 'Fuzzy response weights and weighted MRPI tables generated.');
}

function runFuzzyEamr(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  const criteria = normalizeWeights(resolveCriteria(input, config));
  const fuzzyMatrix = activeFuzzyMatrix(input);
  const blend = Math.min(1, Math.max(0, Number(config.methodParams.eamrBeta ?? 0.5)));
  const coefficient = Math.min(1, Math.max(0, Number(config.methodParams.eamrLambda ?? 0.5)));
  const rangeNormalized = fuzzyRangeNormalizeMatrix(fuzzyMatrix, criteria);
  const vectorRaw = fuzzyVectorNormalizeMatrix(fuzzyMatrix);
  const vectorNormalized = fuzzyRangeNormalizeMatrix(vectorRaw, criteria);
  const blended = rangeNormalized.map((row, rowIndex) => row.map((value, column) => blendFuzzy(value, vectorNormalized[rowIndex][column], blend)));
  const weightedMatrix = fuzzyWeightedMatrix(blended, criteria);
  const crispWeighted = fuzzyToCrispMatrix(weightedMatrix);
  const benefitSums = crispWeighted.map((row) => row.reduce((sum, value, column) => sum + (criteria[column].direction === 'benefit' ? value : 0), 0));
  const costControlSums = crispWeighted.map((row) => row.reduce((sum, value, column) => sum + (criteria[column].direction === 'cost' ? value : 0), 0));
  const scores = benefitSums.map((benefit, index) => benefit ** coefficient + costControlSums[index] ** (1 - coefficient));
  const analysis = result(method, { ...input, criteria, fuzzyValues: fuzzyMatrix }, [
    fuzzyDecisionMatrixRows('Fuzzy EAMR Range-Normalized Matrix', 'fuzzy-eamr-range-normalized', rangeNormalized, input),
    fuzzyDecisionMatrixRows('Fuzzy EAMR Vector-Normalized Matrix', 'fuzzy-eamr-vector-normalized', vectorNormalized, input),
    fuzzyDecisionMatrixRows('Fuzzy EAMR Blended Normalized Matrix', 'fuzzy-eamr-blended-normalized', blended, input),
    fuzzyDecisionMatrixRows('Fuzzy EAMR Weighted Matrix', 'fuzzy-eamr-weighted', weightedMatrix, { ...input, criteria }),
    { id: 'fuzzy-eamr-appraisal', title: 'Fuzzy EAMR Benefit-Cost Appraisal', columns: ['Alternative', 'Benefit sum', 'Cost-control sum', 'Beta', 'Lambda', 'EAMR score'], rows: input.alternatives.map((alternative, index) => [alternative.name, round(benefitSums[index]), round(costControlSums[index]), round(blend), round(coefficient), round(scores[index])]) },
  ], scores, 'Native fuzzy EAMR preserves fuzzy range and vector normalization, blends them component-wise, and ranks by centroid benefit-cost appraisal.');
  return fuzzyStandardDiagnostic(method, analysis, `beta = ${round(blend)}, lambda = ${round(coefficient)} with fuzzy blended normalization.`);
}

function runFuzzyRawec(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  const criteria = normalizeWeights(resolveCriteria(input, config));
  const fuzzyMatrix = activeFuzzyMatrix(input);
  const firstNormalization = fuzzyRatioNormalizeMatrix(fuzzyMatrix, criteria);
  const secondNormalization = fuzzyRatioNormalizeMatrix(fuzzyMatrix, criteria, true);
  const firstDeviation = firstNormalization.map((row) => row.map((value, column) => scaleFuzzy(subtractFuzzy(crispFuzzy(1), value), criteria[column].weight)));
  const secondDeviation = secondNormalization.map((row) => row.map((value, column) => scaleFuzzy(subtractFuzzy(crispFuzzy(1), value), criteria[column].weight)));
  const v = fuzzyToCrispMatrix(firstDeviation).map((row) => row.reduce((sum, value) => sum + value, 0));
  const vPrime = fuzzyToCrispMatrix(secondDeviation).map((row) => row.reduce((sum, value) => sum + value, 0));
  const scores = v.map((value, index) => (vPrime[index] - value) / Math.max(vPrime[index] + value, 1e-12));
  const analysis = result(method, { ...input, criteria, fuzzyValues: fuzzyMatrix }, [
    fuzzyDecisionMatrixRows('Fuzzy RAWEC First Normalized Matrix', 'fuzzy-rawec-first-normalized', firstNormalization, input),
    fuzzyDecisionMatrixRows('Fuzzy RAWEC Second Normalized Matrix', 'fuzzy-rawec-second-normalized', secondNormalization, input),
    fuzzyDecisionMatrixRows('Fuzzy RAWEC Weighted Deviation from First Normalization', 'fuzzy-rawec-first-deviation', firstDeviation, { ...input, criteria }),
    fuzzyDecisionMatrixRows('Fuzzy RAWEC Weighted Deviation from Second Normalization', 'fuzzy-rawec-second-deviation', secondDeviation, { ...input, criteria }),
    { id: 'fuzzy-rawec-index', title: 'Fuzzy RAWEC Deviation Index', columns: ['Alternative', 'v', "v'", 'Q', 'Ranking rule'], rows: input.alternatives.map((alternative, index) => [alternative.name, round(v[index]), round(vPrime[index]), round(scores[index]), 'Higher Q is better']) },
  ], scores, 'Native fuzzy RAWEC preserves fuzzy dual normalization and weighted deviation matrices, then ranks by centroid-projected Q deviation index.');
  return fuzzyStandardDiagnostic(method, analysis, 'Fuzzy first/second normalization and deviation tables generated.');
}

function runFuzzyArlon(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  const criteria = normalizeWeights(resolveCriteria(input, config));
  const fuzzyMatrix = activeFuzzyMatrix(input);
  const gamma = Math.min(1, Math.max(0, Number(config.methodParams.arlonGamma ?? 0.5)));
  const benefitCriteria = criteria.filter((criterion) => criterion.direction === 'benefit').length;
  const kappa = benefitCriteria / Math.max(criteria.length, 1);
  const firstLog = fuzzyLogNormalizeMatrix(fuzzyMatrix, criteria);
  const secondLog = fuzzyLogNormalizeMatrix(firstLog, criteria);
  const aggregated = firstLog.map((row, rowIndex) => row.map((value, column) => blendFuzzy(value, secondLog[rowIndex][column], gamma)));
  const weightedMatrix = fuzzyWeightedMatrix(aggregated, criteria);
  const crispWeighted = fuzzyToCrispMatrix(weightedMatrix);
  const benefit = crispWeighted.map((row) => row.reduce((sum, value, column) => sum + (criteria[column].direction === 'benefit' ? value : 0), 0));
  const cost = crispWeighted.map((row) => row.reduce((sum, value, column) => sum + (criteria[column].direction === 'cost' ? value : 0), 0));
  const performance = benefit.map((value, index) => value ** kappa + cost[index] ** (1 - kappa));
  const minPerformance = Math.min(...performance);
  const maxPerformance = Math.max(...performance);
  const scores = performance.map((value) => Math.abs(maxPerformance - minPerformance) <= 1e-12 ? 1 : (value - minPerformance) / (maxPerformance - minPerformance));
  const analysis = result(method, { ...input, criteria, fuzzyValues: fuzzyMatrix }, [
    fuzzyDecisionMatrixRows('Fuzzy ARLON First Log-Normalized Matrix', 'fuzzy-arlon-first-log-normalized', firstLog, input),
    fuzzyDecisionMatrixRows('Fuzzy ARLON Second Log-Normalized Matrix', 'fuzzy-arlon-second-log-normalized', secondLog, input),
    fuzzyDecisionMatrixRows('Fuzzy ARLON Aggregated Normalized Matrix', 'fuzzy-arlon-aggregated-normalized', aggregated, input),
    fuzzyDecisionMatrixRows('Fuzzy ARLON Weighted Matrix', 'fuzzy-arlon-weighted', weightedMatrix, { ...input, criteria }),
    { id: 'fuzzy-arlon-components', title: 'Fuzzy ARLON Benefit/Cost Components', columns: ['Alternative', 'Benefit sum', 'Cost sum', 'Kappa', 'Performance G', 'Final R'], rows: input.alternatives.map((alternative, index) => [alternative.name, round(benefit[index]), round(cost[index]), round(kappa), round(performance[index]), round(scores[index])]) },
  ], scores, 'Native fuzzy ARLON applies component-wise logarithmic normalization twice, blends the fuzzy normalized matrices, and ranks by centroid benefit/cost performance.');
  return fuzzyStandardDiagnostic(method, analysis, `gamma = ${round(gamma)} with component-wise fuzzy log normalization.`);
}

function runFuzzyMacont(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  const criteria = normalizeWeights(resolveCriteria(input, config));
  const fuzzyMatrix = activeFuzzyMatrix(input);
  const lambdaRaw = Number(config.methodParams.macontLambda ?? 1 / 3);
  const muRaw = Number(config.methodParams.macontMu ?? 1 / 3);
  const lambda = Math.min(1, Math.max(0, Number.isFinite(lambdaRaw) ? lambdaRaw : 1 / 3));
  const mu = Math.min(1 - lambda, Math.max(0, Number.isFinite(muRaw) ? muRaw : 1 / 3));
  const delta = Math.min(1, Math.max(0, Number(config.methodParams.macontDelta ?? 0.5)));
  const theta = Math.min(1, Math.max(0, Number(config.methodParams.macontTheta ?? 0.5)));
  const sumNormalized = fuzzySumNormalizeMatrix(fuzzyMatrix, criteria);
  const ratioNormalized = fuzzyRatioNormalizeMatrix(fuzzyMatrix, criteria);
  const rangeNormalized = fuzzyRangeNormalizeMatrix(fuzzyMatrix, criteria);
  const integrated = sumNormalized.map((row, rowIndex) => row.map((value, column) =>
    addFuzzy(addFuzzy(scaleFuzzy(value, lambda), scaleFuzzy(ratioNormalized[rowIndex][column], mu)), scaleFuzzy(rangeNormalized[rowIndex][column], 1 - lambda - mu)),
  ));
  const reference = criteria.map((_, column) => averageFuzzy(integrated.map((row) => row[column])));
  const weightedDeviation = integrated.map((row) => row.map((value, column) => scaleFuzzy(subtractFuzzy(value, reference[column]), criteria[column].weight)));
  const deviationCrisp = fuzzyToCrispMatrix(weightedDeviation);
  const integratedCrisp = fuzzyToCrispMatrix(integrated);
  const referenceCrisp = reference.map(defuzzify);
  const rho = deviationCrisp.map((row) => row.reduce((sum, value) => sum + value, 0));
  const q = integratedCrisp.map((row) => {
    const below = row.reduce((product, value, column) => product * Math.max(referenceCrisp[column] - value, 1e-12) ** criteria[column].weight, 1);
    const above = row.reduce((product, value, column) => product * Math.max(value - referenceCrisp[column], 1e-12) ** criteria[column].weight, 1);
    return below / Math.max(above, 1e-12);
  });
  const rhoNorm = Math.sqrt(rho.reduce((sum, value) => sum + value ** 2, 0)) || 1;
  const qNorm = Math.sqrt(q.reduce((sum, value) => sum + value ** 2, 0)) || 1;
  const s1 = rho.map((value, index) => delta * (value / rhoNorm) + (1 - delta) * (q[index] / qNorm));
  const s2 = deviationCrisp.map((row) => theta * Math.max(...row) + (1 - theta) * Math.min(...row));
  const s2Norm = Math.sqrt(s2.reduce((sum, value) => sum + value ** 2, 0)) || 1;
  const scores = s1.map((value, index) => 0.5 * (value + s2[index] / s2Norm));
  const analysis = result(method, { ...input, criteria, fuzzyValues: fuzzyMatrix }, [
    fuzzyDecisionMatrixRows('Fuzzy MACONT Sum-Based Normalized Matrix', 'fuzzy-macont-sum-normalized', sumNormalized, input),
    fuzzyDecisionMatrixRows('Fuzzy MACONT Ratio-Based Normalized Matrix', 'fuzzy-macont-ratio-normalized', ratioNormalized, input),
    fuzzyDecisionMatrixRows('Fuzzy MACONT Range-Based Normalized Matrix', 'fuzzy-macont-range-normalized', rangeNormalized, input),
    fuzzyDecisionMatrixRows('Fuzzy MACONT Comprehensive Normalized Matrix', 'fuzzy-macont-integrated-normalized', integrated, input),
    { id: 'fuzzy-macont-reference', title: 'Fuzzy MACONT Virtual Reference Alternative', columns: ['Reference', ...criteria.map((criterion) => criterion.id)], rows: [['Average reference', ...reference.map((value) => fuzzyLabel(value))]] },
    fuzzyDecisionMatrixRows('Fuzzy MACONT Weighted Distance From Reference', 'fuzzy-macont-weighted-deviation', weightedDeviation, input),
    { id: 'fuzzy-macont-scores', title: 'Fuzzy MACONT Mixed Aggregation Scores', columns: ['Alternative', 'rho', 'Q', 'S1', 'S2', 'Final S'], rows: input.alternatives.map((alternative, index) => [alternative.name, round(rho[index]), round(q[index]), round(s1[index]), round(s2[index]), round(scores[index])]) },
  ], scores, 'Native fuzzy MACONT preserves three fuzzy normalized matrices, blends them into a comprehensive fuzzy matrix, and ranks alternatives by centroid-projected mixed aggregation scores.');
  return fuzzyStandardDiagnostic(method, analysis, `lambda = ${round(lambda)}, mu = ${round(mu)}, delta = ${round(delta)}, theta = ${round(theta)}.`);
}

function parseCharacteristicValueMode(config: StudyConfig): 'min,max' | 'min,mid,max' | 'quartiles' {
  const mode = String(config.methodParams.cometCharacteristicValues ?? 'min,mid,max').toLowerCase();
  if (mode.includes('quartile')) return 'quartiles';
  if (mode.includes('mid')) return 'min,mid,max';
  return 'min,max';
}

function characteristicValues(input: DecisionMatrix, config: StudyConfig): number[][] {
  const mode = parseCharacteristicValueMode(config);
  return input.criteria.map((_, column) => {
    const values = input.values.map((row) => row[column]).filter(Number.isFinite).sort((a, b) => a - b);
    const min = values[0] ?? 0;
    const max = values[values.length - 1] ?? min;
    const mid = (min + max) / 2;
    if (Math.abs(max - min) <= 1e-12) return [min];
    if (mode === 'min,max') return [min, max];
    if (mode === 'quartiles') return [min, min + (max - min) * 0.25, mid, min + (max - min) * 0.75, max];
    return [min, mid, max];
  });
}

function cartesianProduct(columns: number[][]): number[][] {
  return columns.reduce<number[][]>((rows, values) =>
    rows.flatMap((row) => values.map((value) => [...row, value])),
  [[]]);
}

function interpolateMembership(value: number, points: number[]): number[] {
  if (points.length === 1) return [1];
  if (value <= points[0]) return points.map((_, index) => index === 0 ? 1 : 0);
  if (value >= points[points.length - 1]) return points.map((_, index) => index === points.length - 1 ? 1 : 0);
  const memberships = points.map(() => 0);
  for (let index = 0; index < points.length - 1; index += 1) {
    const left = points[index];
    const right = points[index + 1];
    if (value >= left && value <= right) {
      const span = Math.max(right - left, 1e-12);
      memberships[index] = (right - value) / span;
      memberships[index + 1] = (value - left) / span;
      break;
    }
  }
  return memberships;
}

function triangularCharacteristicMembership(value: number, points: number[]): number[] {
  if (points.length === 1) return [1];
  return points.map((point, index) => {
    const left = index === 0 ? points[0] : points[index - 1];
    const center = point;
    const right = index === points.length - 1 ? points[points.length - 1] : points[index + 1];
    if (index === 0) {
      if (value <= center) return 1;
      if (value >= right) return 0;
      return (right - value) / Math.max(right - center, 1e-12);
    }
    if (index === points.length - 1) {
      if (value >= center) return 1;
      if (value <= left) return 0;
      return (value - left) / Math.max(center - left, 1e-12);
    }
    if (value <= left || value >= right) return 0;
    if (value === center) return 1;
    if (value < center) return (value - left) / Math.max(center - left, 1e-12);
    return (right - value) / Math.max(right - center, 1e-12);
  });
}

function cometTopsisPreferences(characteristicObjects: number[][], criteria: Criterion[]): number[] {
  const normalized = characteristicObjects.map((row) => row.map((value, column) => {
    const values = characteristicObjects.map((item) => item[column]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (max === min) return 1;
    return criteria[column].direction === 'cost'
      ? (max - value) / (max - min)
      : (value - min) / (max - min);
  }));
  const weightedObjects = weighted(normalized, criteria);
  const idealBest = criteria.map((_, column) => Math.max(...weightedObjects.map((row) => row[column])));
  const idealWorst = criteria.map((_, column) => Math.min(...weightedObjects.map((row) => row[column])));
  return weightedObjects.map((row) => {
    const positive = distance(row, idealBest);
    const negative = distance(row, idealWorst);
    return negative / Math.max(positive + negative, 1e-12);
  });
}

function cometRankPreferenceLevels(rawPreferences: number[]): number[] {
  const descending = [...rawPreferences].sort((a, b) => b - a);
  const ranks = rawPreferences.map((value) => descending.findIndex((candidate) => Math.abs(candidate - value) <= 1e-12) + 1);
  const sj = ranks.map((rank) => ranks.length - rank);
  const unique = Array.from(new Set(sj)).sort((a, b) => a - b);
  const denominator = Math.max(unique.length - 1, 1);
  return sj.map((value) => unique.findIndex((candidate) => candidate === value) / denominator);
}

function runComet(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  if (config.methodParams.fuzzyInputMode === 'Native fuzzy COMET') {
    return runFuzzyComet(input, config, method);
  }
  const criteria = normalizeWeights(resolveCriteria(input, config));
  const valueSets = characteristicValues(input, config);
  const characteristicObjects = cartesianProduct(valueSets);
  const ranges = valueSets.map((values) => ({ min: Math.min(...values), max: Math.max(...values) }));
  const preferenceModel = String(config.methodParams.cometPreferenceModel ?? 'Weight-directed preference');
  const objectPreferences = preferenceModel === 'TOPSIS expert'
    ? cometRankPreferenceLevels(cometTopsisPreferences(characteristicObjects, criteria))
    : characteristicObjects.map((object) => object.reduce((sum, value, column) => {
    const range = ranges[column];
    const normalized = range.max - range.min <= 1e-12 ? 1 : (value - range.min) / (range.max - range.min);
    const utility = criteria[column].direction === 'cost' ? 1 - normalized : normalized;
    return sum + utility * criteria[column].weight;
  }, 0));
  const scores = input.values.map((row) => {
    const columnMemberships = row.map((value, column) => preferenceModel === 'TOPSIS expert'
      ? triangularCharacteristicMembership(value, valueSets[column])
      : interpolateMembership(value, valueSets[column]));
    return characteristicObjects.reduce((score, object, objectIndex) => {
      const membership = object.reduce((product, objectValue, column) => {
        const pointIndex = valueSets[column].findIndex((point) => Math.abs(point - objectValue) <= 1e-9);
        return product * (columnMemberships[column][pointIndex] ?? 0);
      }, 1);
      return score + membership * objectPreferences[objectIndex];
    }, 0);
  });
  const previewLimit = Math.max(1, Number(config.methodParams.cometPreviewLimit) || 60);
  const maxCharacteristicCount = Math.max(...valueSets.map((values) => values.length));
  return result(method, { ...input, criteria }, [
    {
      id: 'comet-characteristic-values',
      title: 'COMET Characteristic Values',
      columns: ['Criterion', 'Name', 'Direction', ...Array.from({ length: maxCharacteristicCount }, (_, index) => `Value ${index + 1}`)],
      rows: criteria.map((criterion, column) => [
        criterion.id,
        criterion.name,
        criterion.direction,
        ...Array.from({ length: maxCharacteristicCount }, (_, index) => valueSets[column][index] === undefined ? '' : round(valueSets[column][index])),
      ]),
    },
    {
      id: 'comet-characteristic-objects',
      title: 'COMET Characteristic Objects',
      columns: ['Object', ...criteria.map((criterion) => criterion.id), 'Preference value'],
      rows: characteristicObjects.slice(0, previewLimit).map((object, index) => [`CO${index + 1}`, ...object.map((value) => round(value)), round(objectPreferences[index])]),
    },
    {
      id: 'comet-preference-function',
      title: 'COMET Alternative Preference Function',
      columns: ['Alternative', 'Preference value', 'Interpolation model'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, round(scores[index]), preferenceModel === 'TOPSIS expert' ? 'TOPSIS expert over characteristic objects' : 'Linear membership over characteristic objects']),
    },
  ], scores, preferenceModel === 'TOPSIS expert'
    ? 'COMET builds characteristic values, uses TOPSIS as the method expert to evaluate characteristic objects, and interpolates alternatives through fuzzy membership to produce preference scores.'
    : 'COMET builds characteristic values, generates characteristic objects, evaluates their preference values, and interpolates alternatives through fuzzy membership to produce rank-reversal-resistant preference scores.');
}

function runFuzzyComet(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  const fuzzyMatrix = activeFuzzyMatrix(input);
  const centroidInput = { ...input, values: fuzzyMatrix.map((row) => row.map(defuzzify)), fuzzyValues: fuzzyMatrix };
  const criteria = normalizeWeights(resolveCriteria(centroidInput, config));
  const valueSets = characteristicValues(centroidInput, config);
  const characteristicObjects = cartesianProduct(valueSets);
  const ranges = valueSets.map((values) => ({ min: Math.min(...values), max: Math.max(...values) }));
  const preferenceModel = String(config.methodParams.cometPreferenceModel ?? 'Weight-directed preference');
  const objectPreferences = preferenceModel === 'TOPSIS expert'
    ? cometRankPreferenceLevels(cometTopsisPreferences(characteristicObjects, criteria))
    : characteristicObjects.map((object) => object.reduce((sum, value, column) => {
      const range = ranges[column];
      const normalized = range.max - range.min <= 1e-12 ? 1 : (value - range.min) / (range.max - range.min);
      const utility = criteria[column].direction === 'cost' ? 1 - normalized : normalized;
      return sum + utility * criteria[column].weight;
    }, 0));
  const scores = fuzzyMatrix.map((row) => {
    const columnMemberships = row.map((value, column) => preferenceModel === 'TOPSIS expert'
      ? triangularCharacteristicMembership(defuzzify(value), valueSets[column])
      : interpolateMembership(defuzzify(value), valueSets[column]));
    return characteristicObjects.reduce((score, object, objectIndex) => {
      const membership = object.reduce((product, objectValue, column) => {
        const pointIndex = valueSets[column].findIndex((point) => Math.abs(point - objectValue) <= 1e-9);
        return product * (columnMemberships[column][pointIndex] ?? 0);
      }, 1);
      return score + membership * objectPreferences[objectIndex];
    }, 0);
  });
  const previewLimit = Math.max(1, Number(config.methodParams.cometPreviewLimit) || 60);
  const maxCharacteristicCount = Math.max(...valueSets.map((values) => values.length));
  const analysis = result(method, { ...centroidInput, criteria }, [
    fuzzyDecisionMatrixRows('Fuzzy COMET Uploaded Alternatives', 'fuzzy-comet-input', fuzzyMatrix, input),
    {
      id: 'fuzzy-comet-characteristic-values',
      title: 'Fuzzy COMET Characteristic Values',
      columns: ['Criterion', 'Name', 'Direction', ...Array.from({ length: maxCharacteristicCount }, (_, index) => `Value ${index + 1}`)],
      rows: criteria.map((criterion, column) => [criterion.id, criterion.name, criterion.direction, ...Array.from({ length: maxCharacteristicCount }, (_, index) => valueSets[column][index] === undefined ? '' : round(valueSets[column][index]))]),
    },
    {
      id: 'fuzzy-comet-characteristic-objects',
      title: 'Fuzzy COMET Characteristic Objects',
      columns: ['Object', ...criteria.map((criterion) => criterion.id), 'Preference value'],
      rows: characteristicObjects.slice(0, previewLimit).map((object, index) => [`CO${index + 1}`, ...object.map((value) => round(value)), round(objectPreferences[index])]),
    },
    {
      id: 'fuzzy-comet-preference-function',
      title: 'Fuzzy COMET Alternative Preference Function',
      columns: ['Alternative', 'Centroid preference value', 'Interpolation model'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, round(scores[index]), preferenceModel === 'TOPSIS expert' ? 'TOPSIS expert over characteristic objects' : 'Linear membership over fuzzy-value centroids']),
    },
  ], scores, 'Native fuzzy COMET preserves triangular/trapezoidal uploaded alternatives, derives characteristic objects from fuzzy centroids, and interpolates preference through the configured COMET method-expert model.');
  analysis.diagnostics.push({ label: 'Native fuzzy COMET', value: 'Fuzzy inputs preserved; COMET membership interpolation evaluated on fuzzy centroids', status: 'pass' });
  analysis.reproducibility = { ...analysis.reproducibility, fuzzyMode: 'Native fuzzy COMET', fuzzyComet: 'Fuzzy uploaded values with centroid characteristic-object membership interpolation', preferenceModel };
  return analysis;
}

function runFuzzySaw(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  const criteria = resolveCriteria(input, config);
  const fuzzyMatrix = input.fuzzyValues?.length
    ? input.fuzzyValues
    : input.values.map((row) => row.map((value) => crispFuzzy(value)));
  const normalizedCriteria = normalizeWeights(criteria);
  const normalized = fuzzyMatrix.map((row) => row.map((value, column) => {
    const columnValues = fuzzyMatrix.map((item) => item[column]);
    if (criteria[column].direction === 'cost') {
      const minLower = Math.min(...columnValues.map((item) => item.values[0]).filter(Number.isFinite));
      return { values: value.values.map((cell) => minLower / Math.max(cell, 1e-9)).reverse(), type: value.type } as FuzzyNumber;
    }
    const maxUpper = Math.max(...columnValues.map((item) => item.values[item.values.length - 1]).filter(Number.isFinite), 1e-9);
    return { values: value.values.map((cell) => cell / maxUpper), type: value.type };
  }));
  const weightedFuzzy = normalized.map((row) => row.map((value, column) => scaleFuzzy(value, normalizedCriteria[column].weight)));
  const scores = weightedFuzzy.map((row) => row.reduce((sum, value) => sum + defuzzify(value), 0));
  const analysis = result(method, { ...input, criteria, fuzzyValues: fuzzyMatrix }, [
    {
      id: 'fuzzy-saw-normalized',
      title: 'Fuzzy SAW Normalized Matrix',
      columns: ['Alternative', ...criteria.map((criterion) => criterion.id)],
      rows: normalized.map((row, index) => [input.alternatives[index].name, ...row.map((value) => fuzzyLabel(value))]),
    },
    {
      id: 'fuzzy-saw-weighted',
      title: 'Fuzzy SAW Weighted Matrix',
      columns: ['Alternative', ...criteria.map((criterion) => criterion.id)],
      rows: weightedFuzzy.map((row, index) => [input.alternatives[index].name, ...row.map((value) => fuzzyLabel(value))]),
    },
    {
      id: 'fuzzy-saw-scores',
      title: 'Fuzzy SAW Additive Utility Scores',
      columns: ['Alternative', 'Utility Score'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, round(scores[index])]),
    },
  ], scores, 'Native fuzzy SAW preserves triangular/trapezoidal uploaded values through fuzzy normalization and weighting, then ranks alternatives by centroid additive utility.');
  analysis.diagnostics.push({ label: 'Native fuzzy SAW', value: 'Fuzzy normalized weighted additive utility', status: 'pass' });
  analysis.reproducibility = { ...analysis.reproducibility, fuzzyMode: 'Native fuzzy SAW', fuzzySaw: 'Fuzzy normalization/weighting with centroid additive utility score' };
  return analysis;
}

function runWpm(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  if (config.methodParams.fuzzyInputMode === 'Native fuzzy WPM') {
    return runFuzzyWpm(input, config, method);
  }
  const normalized = minMaxNormalize(input);
  const criteria = resolveCriteria(input, config);
  const scores = normalized.map((row) => row.reduce((product, value, column) => product * Math.max(value, 0.000001) ** criteria[column].weight, 1));
  return result(method, { ...input, criteria }, [
    tableFromMatrix('normalized', 'Normalized Matrix', normalized, input),
    {
      id: 'wpm-utility',
      title: 'WPM Multiplicative Utility Scores',
      columns: ['Alternative', 'WPM'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, round(scores[index])]),
    },
  ], scores, 'WPM multiplies normalized criterion values after applying criterion weights as exponents.');
}

function runFuzzyWpm(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  const criteria = resolveCriteria(input, config);
  const fuzzyMatrix = input.fuzzyValues?.length
    ? input.fuzzyValues
    : input.values.map((row) => row.map((value) => crispFuzzy(value)));
  const normalizedCriteria = normalizeWeights(criteria);
  const normalized = fuzzyMatrix.map((row) => row.map((value, column) => {
    const columnValues = fuzzyMatrix.map((item) => item[column]);
    if (criteria[column].direction === 'cost') {
      const minLower = Math.min(...columnValues.map((item) => item.values[0]).filter(Number.isFinite));
      return { values: value.values.map((cell) => minLower / Math.max(cell, 1e-9)).reverse(), type: value.type } as FuzzyNumber;
    }
    const maxUpper = Math.max(...columnValues.map((item) => item.values[item.values.length - 1]).filter(Number.isFinite), 1e-9);
    return { values: value.values.map((cell) => cell / maxUpper), type: value.type };
  }));
  const normalizedCrisp = normalized.map((row) => row.map(defuzzify));
  const scores = normalizedCrisp.map((row) => row.reduce((product, value, column) => product * Math.max(value, 1e-9) ** normalizedCriteria[column].weight, 1));
  const analysis = result(method, { ...input, criteria, fuzzyValues: fuzzyMatrix }, [
    {
      id: 'fuzzy-wpm-normalized',
      title: 'Fuzzy WPM Normalized Matrix',
      columns: ['Alternative', ...criteria.map((criterion) => criterion.id)],
      rows: normalized.map((row, index) => [input.alternatives[index].name, ...row.map((value) => fuzzyLabel(value))]),
    },
    {
      id: 'fuzzy-wpm-components',
      title: 'Fuzzy WPM Multiplicative Utility Scores',
      columns: ['Alternative', ...criteria.map((criterion) => criterion.id), 'Product Utility'],
      rows: input.alternatives.map((alternative, index) => [
        alternative.name,
        ...normalizedCrisp[index].map((value, column) => round(Math.max(value, 1e-9) ** normalizedCriteria[column].weight)),
        round(scores[index]),
      ]),
    },
  ], scores, 'Native fuzzy WPM preserves triangular/trapezoidal uploaded values through fuzzy normalization, then ranks alternatives by weighted multiplicative centroid utility.');
  analysis.diagnostics.push({ label: 'Native fuzzy WPM', value: 'Fuzzy normalized multiplicative utility', status: 'pass' });
  analysis.reproducibility = { ...analysis.reproducibility, fuzzyMode: 'Native fuzzy WPM', fuzzyWpm: 'Fuzzy normalization with centroid weighted product utility score' };
  return analysis;
}

function runWaspas(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  if (config.methodParams.fuzzyInputMode === 'Native fuzzy WASPAS') {
    return runFuzzyWaspas(input, config, method);
  }
  const criteria = resolveCriteria(input, config);
  const normalized = minMaxNormalize({ ...input, criteria });
  const saw = normalized.map((row) => row.reduce((sum, value, column) => sum + value * criteria[column].weight, 0));
  const wpm = normalized.map((row) => row.reduce((product, value, column) => product * Math.max(value, 0.000001) ** criteria[column].weight, 1));
  const lambda = Number(config.methodParams.waspasLambda ?? config.waspasLambda);
  const scores = saw.map((value, index) => lambda * value + (1 - lambda) * wpm[index]);
  return result(method, { ...input, criteria }, [{ id: 'waspas', title: 'WASPAS Components', columns: ['Alternative', 'WSM', 'WPM', 'WASPAS'], rows: input.alternatives.map((alternative, index) => [alternative.name, round(saw[index]), round(wpm[index]), round(scores[index])]) }], scores, 'WASPAS combines additive and multiplicative utility with a configurable lambda coefficient.');
}

function runFuzzyWaspas(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  const criteria = resolveCriteria(input, config);
  const fuzzyMatrix = input.fuzzyValues?.length
    ? input.fuzzyValues
    : input.values.map((row) => row.map((value) => crispFuzzy(value)));
  const normalizedCriteria = normalizeWeights(criteria);
  const normalized = fuzzyMatrix.map((row) => row.map((value, column) => {
    const columnValues = fuzzyMatrix.map((item) => item[column]);
    if (criteria[column].direction === 'cost') {
      const minLower = Math.min(...columnValues.map((item) => item.values[0]).filter(Number.isFinite));
      return { values: value.values.map((cell) => minLower / Math.max(cell, 1e-9)).reverse(), type: value.type } as FuzzyNumber;
    }
    const maxUpper = Math.max(...columnValues.map((item) => item.values[item.values.length - 1]).filter(Number.isFinite), 1e-9);
    return { values: value.values.map((cell) => cell / maxUpper), type: value.type };
  }));
  const weightedFuzzy = normalized.map((row) => row.map((value, column) => scaleFuzzy(value, normalizedCriteria[column].weight)));
  const normalizedCrisp = normalized.map((row) => row.map(defuzzify));
  const wsm = weightedFuzzy.map((row) => row.reduce((sum, value) => sum + defuzzify(value), 0));
  const wpm = normalizedCrisp.map((row) => row.reduce((product, value, column) => product * Math.max(value, 1e-9) ** normalizedCriteria[column].weight, 1));
  const lambda = Number(config.methodParams.waspasLambda ?? config.waspasLambda);
  const scores = wsm.map((value, index) => lambda * value + (1 - lambda) * wpm[index]);
  const analysis = result(method, { ...input, criteria, fuzzyValues: fuzzyMatrix }, [
    {
      id: 'fuzzy-waspas-normalized',
      title: 'Fuzzy WASPAS Normalized Matrix',
      columns: ['Alternative', ...criteria.map((criterion) => criterion.id)],
      rows: normalized.map((row, index) => [input.alternatives[index].name, ...row.map((value) => fuzzyLabel(value))]),
    },
    {
      id: 'fuzzy-waspas-weighted',
      title: 'Fuzzy WASPAS Weighted Matrix',
      columns: ['Alternative', ...criteria.map((criterion) => criterion.id)],
      rows: weightedFuzzy.map((row, index) => [input.alternatives[index].name, ...row.map((value) => fuzzyLabel(value))]),
    },
    {
      id: 'fuzzy-waspas-components',
      title: 'Fuzzy WASPAS Components',
      columns: ['Alternative', 'WSM', 'WPM', 'Lambda', 'WASPAS'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, round(wsm[index]), round(wpm[index]), round(lambda), round(scores[index])]),
    },
  ], scores, 'Native fuzzy WASPAS preserves triangular/trapezoidal uploaded values through fuzzy normalization and weighting, then combines defuzzified additive and multiplicative utility components with lambda.');
  analysis.diagnostics.push({ label: 'Native fuzzy WASPAS', value: `lambda = ${round(lambda)} with fuzzy normalized utility components`, status: 'pass' });
  analysis.reproducibility = { ...analysis.reproducibility, fuzzyMode: 'Native fuzzy WASPAS', fuzzyWaspas: 'Fuzzy normalization/weighting, centroid WSM/WPM utility blend', lambda: round(lambda) };
  return analysis;
}

function runEdas(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  if (config.methodParams.fuzzyInputMode === 'Native fuzzy EDAS') {
    return runFuzzyEdas(input, config, method);
  }
  const criteria = resolveCriteria(input, config);
  const averages = input.values[0].map((_, column) => input.values.reduce((sum, row) => sum + row[column], 0) / input.values.length);
  const denominators = averages.map((average) => Math.max(Math.abs(average), 1e-9));
  const pda = input.values.map((row) => row.map((value, column) => criteria[column].direction === 'benefit' ? Math.max(0, value - averages[column]) / denominators[column] : Math.max(0, averages[column] - value) / denominators[column]));
  const nda = input.values.map((row) => row.map((value, column) => criteria[column].direction === 'benefit' ? Math.max(0, averages[column] - value) / denominators[column] : Math.max(0, value - averages[column]) / denominators[column]));
  const sp = pda.map((row) => row.reduce((sum, value, column) => sum + value * criteria[column].weight, 0));
  const sn = nda.map((row) => row.reduce((sum, value, column) => sum + value * criteria[column].weight, 0));
  const maxSp = Math.max(...sp), maxSn = Math.max(...sn);
  const nsp = sp.map((value) => value / (maxSp || 1));
  const nsn = sn.map((value) => 1 - value / (maxSn || 1));
  const scores = sp.map((_, index) => 0.5 * (nsp[index] + nsn[index]));
  const analysis = result(method, { ...input, criteria }, [
    {
      id: 'edas-average-solution',
      title: 'EDAS Average Solution',
      columns: ['Reference', ...criteria.map((criterion) => criterion.id)],
      rows: [['Average solution', ...averages.map((value) => round(value))]],
    },
    tableFromMatrix('edas-pda', 'EDAS Positive Distance from Average', pda, input),
    tableFromMatrix('edas-nda', 'EDAS Negative Distance from Average', nda, input),
    {
      id: 'edas',
      title: 'EDAS Appraisal Scores',
      columns: ['Alternative', 'SP', 'SN', 'NSP', 'NSN', 'AS'],
      rows: input.alternatives.map((alternative, index) => [
        alternative.name,
        round(sp[index]),
        round(sn[index]),
        round(nsp[index]),
        round(nsn[index]),
        round(scores[index]),
      ]),
    },
  ], scores, 'EDAS evaluates alternatives by positive and negative distance from the average solution, normalizes SP/SN appraisal sums, and ranks by the final appraisal score.');
  if (averages.some((average) => Math.abs(average) < 1e-9)) {
    analysis.diagnostics.push({ label: 'EDAS zero average guard', value: 'One or more criterion averages were zero or near zero; a small stable denominator was used for PDA/NDA calculation.', status: 'warn' });
  }
  return analysis;
}

function runFuzzyEdas(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  const criteria = resolveCriteria(input, config);
  const fuzzyMatrix = input.fuzzyValues?.length
    ? input.fuzzyValues
    : input.values.map((row) => row.map((value) => crispFuzzy(value)));
  const normalizedCriteria = normalizeWeights(criteria);
  const fuzzyAverage = criteria.map((_, column) => {
    const columnValues = fuzzyMatrix.map((row) => row[column]);
    const size = Math.max(...columnValues.map((value) => value.values.length));
    const values = Array.from({ length: size }, (_, component) =>
      columnValues.reduce((sum, value) => {
        const expanded = value.values.length === size
          ? value.values
          : value.values.length === 3 && size === 4
            ? [value.values[0], value.values[1], value.values[1], value.values[2]]
            : [value.values[0], (value.values[1] + value.values[2]) / 2, value.values[value.values.length - 1]];
        return sum + (expanded[component] ?? 0);
      }, 0) / columnValues.length,
    );
    return { values, type: size === 4 ? 'trapezoidal' as const : 'triangular' as const };
  });
  const pda = fuzzyMatrix.map((row) => row.map((value, column) => {
    const average = fuzzyAverage[column];
    const denominator = Math.max(Math.abs(defuzzify(average)), 1e-9);
    const diff = defuzzify(value) - defuzzify(average);
    const distance = fuzzyDistance(value, average) / denominator;
    return criteria[column].direction === 'benefit'
      ? (diff > 0 ? distance : 0)
      : (diff < 0 ? distance : 0);
  }));
  const nda = fuzzyMatrix.map((row) => row.map((value, column) => {
    const average = fuzzyAverage[column];
    const denominator = Math.max(Math.abs(defuzzify(average)), 1e-9);
    const diff = defuzzify(value) - defuzzify(average);
    const distance = fuzzyDistance(value, average) / denominator;
    return criteria[column].direction === 'benefit'
      ? (diff < 0 ? distance : 0)
      : (diff > 0 ? distance : 0);
  }));
  const sp = pda.map((row) => row.reduce((sum, value, column) => sum + value * normalizedCriteria[column].weight, 0));
  const sn = nda.map((row) => row.reduce((sum, value, column) => sum + value * normalizedCriteria[column].weight, 0));
  const maxSp = Math.max(...sp), maxSn = Math.max(...sn);
  const nsp = sp.map((value) => value / (maxSp || 1));
  const nsn = sn.map((value) => 1 - value / (maxSn || 1));
  const scores = sp.map((_, index) => 0.5 * (nsp[index] + nsn[index]));
  const analysis = result(method, { ...input, criteria, fuzzyValues: fuzzyMatrix }, [
    {
      id: 'fuzzy-edas-input',
      title: 'Fuzzy EDAS Input Matrix',
      columns: ['Alternative', ...criteria.map((criterion) => criterion.id)],
      rows: fuzzyMatrix.map((row, index) => [input.alternatives[index].name, ...row.map((value) => fuzzyLabel(value))]),
    },
    {
      id: 'fuzzy-edas-average',
      title: 'Fuzzy EDAS Average Solution',
      columns: ['Reference', ...criteria.map((criterion) => criterion.id)],
      rows: [['Fuzzy average', ...fuzzyAverage.map((value) => fuzzyLabel(value))]],
    },
    tableFromMatrix('fuzzy-edas-pda', 'Fuzzy EDAS Positive Distance Matrix', pda, input),
    tableFromMatrix('fuzzy-edas-nda', 'Fuzzy EDAS Negative Distance Matrix', nda, input),
    {
      id: 'fuzzy-edas-appraisal',
      title: 'Fuzzy EDAS Appraisal Scores',
      columns: ['Alternative', 'SP', 'SN', 'NSP', 'NSN', 'AS'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, round(sp[index]), round(sn[index]), round(nsp[index]), round(nsn[index]), round(scores[index])]),
    },
  ], scores, 'Native fuzzy EDAS preserves triangular/trapezoidal uploaded values, builds a fuzzy average solution, computes fuzzy-distance positive and negative deviations, and derives appraisal scores.');
  analysis.diagnostics.push({ label: 'Native fuzzy EDAS', value: 'Fuzzy average solution with fuzzy-distance PDA/NDA appraisal', status: 'pass' });
  if (fuzzyAverage.some((average) => Math.abs(defuzzify(average)) < 1e-9)) {
    analysis.diagnostics.push({ label: 'EDAS zero average guard', value: 'One or more fuzzy average solutions defuzzified to zero or near zero; a small stable denominator was used for PDA/NDA calculation.', status: 'warn' });
  }
  analysis.reproducibility = { ...analysis.reproducibility, fuzzyMode: 'Native fuzzy EDAS', fuzzyEdas: 'Fuzzy average solution, vertex-distance PDA/NDA, weighted appraisal score' };
  return analysis;
}

function runMabac(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  if (config.methodParams.fuzzyInputMode === 'Native fuzzy MABAC') {
    return runFuzzyMabac(input, config, method);
  }
  const criteria = resolveCriteria(input, config);
  const normalized = input.values.map((row) => row.map((value, column) => {
    const values = input.values.map((item) => item[column]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (max === min) return 1;
    return criteria[column].direction === 'cost'
      ? (max - value) / (max - min)
      : (value - min) / (max - min);
  }));
  const weightedMatrix = normalized.map((row) => row.map((value, column) => value * criteria[column].weight + criteria[column].weight));
  const border = criteria.map((_, column) => {
    const product = weightedMatrix.reduce((acc, row) => acc * Math.max(row[column], 1e-9), 1);
    return product ** (1 / weightedMatrix.length);
  });
  const distanceMatrix = weightedMatrix.map((row) => row.map((value, column) => value - border[column]));
  const scores = distanceMatrix.map((row) => row.reduce((sum, value) => sum + value, 0));
  return result(method, { ...input, criteria }, [
    tableFromMatrix('normalized', 'MABAC Normalized Matrix', normalized, input),
    tableFromMatrix('weighted', 'MABAC Weighted Matrix', weightedMatrix, input),
    { id: 'border-area', title: 'Border Approximation Area', columns: ['Criterion', ...criteria.map((criterion) => criterion.id)], rows: [['G', ...border.map((value) => round(value))]] },
    tableFromMatrix('distance-border', 'Distance From Border Area', distanceMatrix, input),
  ], scores, 'MABAC ranks alternatives by their total distance from the border approximation area.');
}

function fuzzyGeometricBorder(values: FuzzyNumber[]): FuzzyNumber {
  if (!values.length) return crispFuzzy(1);
  const size = Math.max(...values.map((value) => value.values.length));
  const components = Array.from({ length: size }, (_, component) => {
    const product = values.reduce((acc, value) => acc * Math.max(fuzzyComponentAt(value, component, size), 1e-9), 1);
    return product ** (1 / values.length);
  });
  return { values: components, type: size === 4 ? 'trapezoidal' : 'triangular' };
}

function runFuzzyMabac(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  const criteria = resolveCriteria(input, config);
  const fuzzyMatrix = input.fuzzyValues?.length
    ? input.fuzzyValues
    : input.values.map((row) => row.map((value) => crispFuzzy(value)));
  const normalizedCriteria = normalizeWeights(criteria);
  const normalized = fuzzyMatrix.map((row) => row.map((value, column) => {
    const columnValues = fuzzyMatrix.map((item) => item[column]);
    if (criteria[column].direction === 'cost') {
      const minLower = Math.min(...columnValues.map((item) => item.values[0]).filter(Number.isFinite));
      return { values: value.values.map((cell) => minLower / Math.max(cell, 1e-9)).reverse(), type: value.type } as FuzzyNumber;
    }
    const maxUpper = Math.max(...columnValues.map((item) => item.values[item.values.length - 1]).filter(Number.isFinite), 1e-9);
    return { values: value.values.map((cell) => cell / maxUpper), type: value.type };
  }));
  const weightedFuzzy = normalized.map((row) => row.map((value, column) => {
    const shifted = scaleFuzzy(value, normalizedCriteria[column].weight);
    return { values: shifted.values.map((cell) => cell + normalizedCriteria[column].weight), type: shifted.type };
  }));
  const border = normalizedCriteria.map((_, column) => fuzzyGeometricBorder(weightedFuzzy.map((row) => row[column])));
  const distanceMatrix = weightedFuzzy.map((row) => row.map((value, column) => defuzzify(value) - defuzzify(border[column])));
  const scores = distanceMatrix.map((row) => row.reduce((sum, value) => sum + value, 0));
  const analysis = result(method, { ...input, criteria: normalizedCriteria, fuzzyValues: fuzzyMatrix }, [
    {
      id: 'fuzzy-mabac-normalized',
      title: 'Fuzzy MABAC Normalized Matrix',
      columns: ['Alternative', ...criteria.map((criterion) => criterion.id)],
      rows: normalized.map((row, index) => [input.alternatives[index].name, ...row.map((value) => fuzzyLabel(value))]),
    },
    {
      id: 'fuzzy-mabac-weighted',
      title: 'Fuzzy MABAC Weighted Matrix',
      columns: ['Alternative', ...criteria.map((criterion) => criterion.id)],
      rows: weightedFuzzy.map((row, index) => [input.alternatives[index].name, ...row.map((value) => fuzzyLabel(value))]),
    },
    {
      id: 'fuzzy-mabac-border-area',
      title: 'Fuzzy MABAC Border Approximation Area',
      columns: ['Criterion', ...criteria.map((criterion) => criterion.id)],
      rows: [['G', ...border.map((value) => fuzzyLabel(value))]],
    },
    tableFromMatrix('fuzzy-mabac-distance-border', 'Fuzzy MABAC Distance From Border Area', distanceMatrix, input),
  ], scores, 'Native fuzzy MABAC preserves triangular/trapezoidal uploaded values through fuzzy normalization and weighted border approximation, then ranks alternatives by centroid distance from the fuzzy border area.');
  analysis.diagnostics.push({ label: 'Native fuzzy MABAC', value: 'Fuzzy weighted border approximation with centroid distance scoring', status: 'pass' });
  analysis.reproducibility = { ...analysis.reproducibility, fuzzyMode: 'Native fuzzy MABAC', fuzzyMabac: 'Fuzzy normalization, weighted border approximation area, centroid distance matrix' };
  return analysis;
}

function runCodas(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  if (config.methodParams.fuzzyInputMode === 'Native fuzzy CODAS') {
    return runFuzzyCodas(input, config, method);
  }
  const criteria = resolveCriteria(input, config);
  const normalized = input.values.map((row) => row.map((value, column) => {
    const values = input.values.map((item) => item[column]);
    const max = Math.max(...values.map((item) => Math.abs(item)), 1e-12);
    const positiveValues = values.map((item) => Math.abs(item)).filter((item) => item > 0);
    const min = positiveValues.length ? Math.min(...positiveValues) : 1e-12;
    if (criteria[column].direction === 'cost') {
      return min / Math.max(Math.abs(value), 1e-12);
    }
    return Math.abs(value) / max;
  }));
  const weightedMatrix = weighted(normalized, criteria);
  const negativeIdeal = criteria.map((_, column) => Math.min(...weightedMatrix.map((row) => row[column])));
  const euclidean = weightedMatrix.map((row) => distance(row, negativeIdeal));
  const taxicab = weightedMatrix.map((row) => row.reduce((sum, value, column) => sum + Math.abs(value - negativeIdeal[column]), 0));
  const tau = Number(config.methodParams.codasTau ?? 0.02);
  const relativeAssessment = input.alternatives.map((_, rowIndex) =>
    input.alternatives.map((__, columnIndex) => {
      const euclideanDifference = euclidean[rowIndex] - euclidean[columnIndex];
      const taxicabDifference = taxicab[rowIndex] - taxicab[columnIndex];
      return euclideanDifference + (Math.abs(euclideanDifference) >= tau ? taxicabDifference : 0);
    }),
  );
  const scores = relativeAssessment.map((row) => row.reduce((sum, value) => sum + value, 0));
  return result(method, { ...input, criteria }, [
    tableFromMatrix('normalized', 'CODAS Normalized Matrix', normalized, input),
    tableFromMatrix('weighted', 'CODAS Weighted Matrix', weightedMatrix, input),
    { id: 'codas-negative-ideal', title: 'CODAS Negative Ideal', columns: ['Type', ...criteria.map((criterion) => criterion.id)], rows: [['Negative ideal', ...negativeIdeal.map((value) => round(value))]] },
    { id: 'codas-distances', title: 'CODAS Distance Measures', columns: ['Alternative', 'Euclidean', 'Taxicab'], rows: input.alternatives.map((alternative, index) => [alternative.name, round(euclidean[index]), round(taxicab[index])]) },
    { id: 'codas-relative-assessment', title: 'CODAS Relative Assessment Matrix', columns: ['Alternative', ...input.alternatives.map((alternative) => alternative.id), 'Assessment'], rows: input.alternatives.map((alternative, index) => [alternative.name, ...relativeAssessment[index].map((value) => round(value)), round(scores[index])]) },
  ], scores, 'CODAS ranks alternatives by the thresholded pairwise relative assessment matrix built from Euclidean and taxicab distances to the negative ideal solution.');
}

function runFuzzyCodas(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  const criteria = resolveCriteria(input, config);
  const fuzzyMatrix = input.fuzzyValues?.length
    ? input.fuzzyValues
    : input.values.map((row) => row.map((value) => crispFuzzy(value)));
  const normalizedCriteria = normalizeWeights(criteria);
  const normalized = fuzzyMatrix.map((row) => row.map((value, column) => {
    const denominator = Math.sqrt(fuzzyMatrix.reduce((sum, item) => sum + defuzzify(item[column]) ** 2, 0)) || 1;
    const ratioValues = value.values.map((cell) => cell / denominator);
    if (criteria[column].direction === 'cost') {
      return { values: ratioValues.map((cell) => 1 - cell).reverse(), type: value.type } as FuzzyNumber;
    }
    return { values: ratioValues, type: value.type };
  }));
  const weightedFuzzy = normalized.map((row) => row.map((value, column) => scaleFuzzy(value, normalizedCriteria[column].weight)));
  const negativeIdeal = normalizedCriteria.map((_, column) => {
    const values = weightedFuzzy.map((row) => row[column]);
    return values.reduce((worst, value) => defuzzify(value) < defuzzify(worst) ? value : worst, values[0]);
  });
  const euclidean = weightedFuzzy.map((row) =>
    Math.sqrt(row.reduce((sum, value, column) => sum + fuzzyDistance(value, negativeIdeal[column]) ** 2, 0)),
  );
  const taxicab = weightedFuzzy.map((row) => row.reduce((sum, value, column) => sum + fuzzyDistance(value, negativeIdeal[column]), 0));
  const tau = Number(config.methodParams.codasTau ?? 0.02);
  const relativeAssessment = input.alternatives.map((_, rowIndex) =>
    input.alternatives.map((__, columnIndex) => {
      const euclideanDifference = euclidean[rowIndex] - euclidean[columnIndex];
      const taxicabDifference = taxicab[rowIndex] - taxicab[columnIndex];
      return euclideanDifference + (Math.abs(euclideanDifference) >= tau ? taxicabDifference : 0);
    }),
  );
  const scores = relativeAssessment.map((row) => row.reduce((sum, value) => sum + value, 0));
  const analysis = result(method, { ...input, criteria: normalizedCriteria, fuzzyValues: fuzzyMatrix }, [
    {
      id: 'fuzzy-codas-normalized',
      title: 'Fuzzy CODAS Normalized Matrix',
      columns: ['Alternative', ...criteria.map((criterion) => criterion.id)],
      rows: normalized.map((row, index) => [input.alternatives[index].name, ...row.map((value) => fuzzyLabel(value))]),
    },
    {
      id: 'fuzzy-codas-weighted',
      title: 'Fuzzy CODAS Weighted Matrix',
      columns: ['Alternative', ...criteria.map((criterion) => criterion.id)],
      rows: weightedFuzzy.map((row, index) => [input.alternatives[index].name, ...row.map((value) => fuzzyLabel(value))]),
    },
    {
      id: 'fuzzy-codas-negative-ideal',
      title: 'Fuzzy CODAS Negative Ideal',
      columns: ['Type', ...criteria.map((criterion) => criterion.id)],
      rows: [['Negative ideal', ...negativeIdeal.map((value) => fuzzyLabel(value))]],
    },
    {
      id: 'fuzzy-codas-distances',
      title: 'Fuzzy CODAS Distance Measures',
      columns: ['Alternative', 'Euclidean distance', 'Taxicab distance', 'Tau'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, round(euclidean[index]), round(taxicab[index]), round(tau)]),
    },
    {
      id: 'fuzzy-codas-relative-assessment',
      title: 'Fuzzy CODAS Relative Assessment Matrix',
      columns: ['Alternative', ...input.alternatives.map((alternative) => alternative.id), 'Assessment'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, ...relativeAssessment[index].map((value) => round(value)), round(scores[index])]),
    },
  ], scores, 'Native fuzzy CODAS preserves triangular/trapezoidal uploaded values through fuzzy normalization and weighting, then ranks alternatives by the thresholded fuzzy-distance relative assessment matrix.');
  analysis.diagnostics.push({ label: 'Native fuzzy CODAS', value: 'Fuzzy weighted Euclidean and taxicab distance relative assessment generated', status: 'pass' });
  analysis.reproducibility = { ...analysis.reproducibility, fuzzyMode: 'Native fuzzy CODAS', fuzzyCodas: 'Fuzzy normalization/weighting with vertex-distance Euclidean and taxicab relative assessment', tau: round(tau) };
  return analysis;
}

function runCocoso(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  if (config.methodParams.fuzzyInputMode === 'Native fuzzy CoCoSo') {
    return runFuzzyCocoso(input, config, method);
  }
  const criteria = resolveCriteria(input, config);
  const normalized = input.values.map((row) => row.map((value, column) => {
    const values = input.values.map((item) => item[column]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (max === min) return 1;
    return criteria[column].direction === 'cost'
      ? (max - value) / (max - min)
      : (value - min) / (max - min);
  }));
  const s = normalized.map((row) => row.reduce((sum, value, column) => sum + value * criteria[column].weight, 0));
  const p = normalized.map((row) => row.reduce((sum, value, column) => sum + Math.max(value, 1e-9) ** criteria[column].weight, 0));
  const sumS = s.reduce((sum, value) => sum + value, 0) || 1;
  const sumP = p.reduce((sum, value) => sum + value, 0) || 1;
  const minS = Math.min(...s), minP = Math.min(...p);
  const maxS = Math.max(...s), maxP = Math.max(...p);
  const kA = s.map((value, index) => (value + p[index]) / (sumS + sumP));
  const kB = s.map((value, index) => (value / (minS || 1)) + (p[index] / (minP || 1)));
  const lambda = Number(config.methodParams.cocosoLambda ?? 0.5);
  const kC = s.map((value, index) => (lambda * value + (1 - lambda) * p[index]) / (lambda * maxS + (1 - lambda) * maxP || 1));
  const scores = kA.map((value, index) => ((value * kB[index] * kC[index]) ** (1 / 3)) + (value + kB[index] + kC[index]) / 3);
  return result(method, { ...input, criteria }, [
    tableFromMatrix('normalized', 'CoCoSo Normalized Matrix', normalized, input),
    tableFromMatrix('weighted', 'CoCoSo Weighted Matrix', normalized.map((row) => row.map((value, column) => value * criteria[column].weight)), input),
    { id: 'cocoso-components', title: 'CoCoSo Appraisal Components', columns: ['Alternative', 'S', 'P', 'S + P', 'Ka', 'Kb', 'Kc', 'K'], rows: input.alternatives.map((alternative, index) => [alternative.name, round(s[index]), round(p[index]), round(s[index] + p[index]), round(kA[index]), round(kB[index]), round(kC[index]), round(scores[index])]) },
  ], scores, 'CoCoSo combines additive and multiplicative appraisal strategies into a compromise score.');
}

function runFuzzyCocoso(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  const criteria = resolveCriteria(input, config);
  const fuzzyMatrix = input.fuzzyValues?.length
    ? input.fuzzyValues
    : input.values.map((row) => row.map((value) => crispFuzzy(value)));
  const normalizedCriteria = normalizeWeights(criteria);
  const normalized = fuzzyMatrix.map((row) => row.map((value, column) => {
    const columnValues = fuzzyMatrix.map((item) => item[column]);
    if (criteria[column].direction === 'cost') {
      const minLower = Math.min(...columnValues.map((item) => item.values[0]).filter(Number.isFinite));
      return { values: value.values.map((cell) => minLower / Math.max(cell, 1e-9)).reverse(), type: value.type } as FuzzyNumber;
    }
    const maxUpper = Math.max(...columnValues.map((item) => item.values[item.values.length - 1]).filter(Number.isFinite), 1e-9);
    return { values: value.values.map((cell) => cell / maxUpper), type: value.type };
  }));
  const weightedFuzzy = normalized.map((row) => row.map((value, column) => scaleFuzzy(value, normalizedCriteria[column].weight)));
  const normalizedCrisp = normalized.map((row) => row.map(defuzzify));
  const s = weightedFuzzy.map((row) => row.reduce((sum, value) => sum + defuzzify(value), 0));
  const p = normalizedCrisp.map((row) => row.reduce((sum, value, column) => sum + Math.max(value, 1e-9) ** normalizedCriteria[column].weight, 0));
  const sumS = s.reduce((sum, value) => sum + value, 0) || 1;
  const sumP = p.reduce((sum, value) => sum + value, 0) || 1;
  const minS = Math.min(...s), minP = Math.min(...p);
  const maxS = Math.max(...s), maxP = Math.max(...p);
  const kA = s.map((value, index) => (value + p[index]) / (sumS + sumP));
  const kB = s.map((value, index) => (value / (minS || 1)) + (p[index] / (minP || 1)));
  const lambda = Number(config.methodParams.cocosoLambda ?? 0.5);
  const kC = s.map((value, index) => (lambda * value + (1 - lambda) * p[index]) / (lambda * maxS + (1 - lambda) * maxP || 1));
  const scores = kA.map((value, index) => ((value * kB[index] * kC[index]) ** (1 / 3)) + (value + kB[index] + kC[index]) / 3);
  const analysis = result(method, { ...input, criteria: normalizedCriteria, fuzzyValues: fuzzyMatrix }, [
    {
      id: 'fuzzy-cocoso-normalized',
      title: 'Fuzzy CoCoSo Normalized Matrix',
      columns: ['Alternative', ...criteria.map((criterion) => criterion.id)],
      rows: normalized.map((row, index) => [input.alternatives[index].name, ...row.map((value) => fuzzyLabel(value))]),
    },
    {
      id: 'fuzzy-cocoso-weighted',
      title: 'Fuzzy CoCoSo Weighted Matrix',
      columns: ['Alternative', ...criteria.map((criterion) => criterion.id)],
      rows: weightedFuzzy.map((row, index) => [input.alternatives[index].name, ...row.map((value) => fuzzyLabel(value))]),
    },
    {
      id: 'fuzzy-cocoso-components',
      title: 'Fuzzy CoCoSo Appraisal Components',
      columns: ['Alternative', 'S', 'P', 'S + P', 'Ka', 'Kb', 'Kc', 'K'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, round(s[index]), round(p[index]), round(s[index] + p[index]), round(kA[index]), round(kB[index]), round(kC[index]), round(scores[index])]),
    },
  ], scores, 'Native fuzzy CoCoSo preserves triangular/trapezoidal uploaded values through fuzzy normalization and weighting, then combines centroid additive and multiplicative appraisal strategies into a compromise score.');
  analysis.diagnostics.push({ label: 'Native fuzzy CoCoSo', value: 'Fuzzy additive/product appraisal with compromise scoring', status: 'pass' });
  analysis.reproducibility = { ...analysis.reproducibility, fuzzyMode: 'Native fuzzy CoCoSo', fuzzyCocoso: 'Fuzzy normalization/weighting with centroid S, P, Ka, Kb, Kc, and K score', lambda: round(lambda) };
  return analysis;
}

function runCradis(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  if (config.methodParams.fuzzyInputMode === 'Native fuzzy CRADIS') {
    return runFuzzyCradis(input, config, method);
  }
  const criteria = resolveCriteria(input, config);
  const normalized = minMaxNormalize({ ...input, criteria });
  const weightedMatrix = weighted(normalized, criteria);
  const ideal = criteria.map((_, column) => Math.max(...weightedMatrix.map((row) => row[column])));
  const antiIdeal = criteria.map((_, column) => Math.min(...weightedMatrix.map((row) => row[column])));
  const deviationFromIdeal = weightedMatrix.map((row) => row.map((value, column) => Math.abs(ideal[column] - value)));
  const deviationFromAntiIdeal = weightedMatrix.map((row) => row.map((value, column) => Math.abs(value - antiIdeal[column])));
  const idealDeviationSum = deviationFromIdeal.map((row) => row.reduce((sum, value) => sum + value, 0));
  const antiIdealDeviationSum = deviationFromAntiIdeal.map((row) => row.reduce((sum, value) => sum + value, 0));
  const minIdealDeviation = Math.min(...idealDeviationSum.filter(Number.isFinite));
  const maxAntiIdealDeviation = Math.max(...antiIdealDeviationSum.filter(Number.isFinite));
  const idealUtility = idealDeviationSum.map((value) => (minIdealDeviation || 1e-12) / Math.max(value, 1e-12));
  const antiIdealUtility = antiIdealDeviationSum.map((value) => value / Math.max(maxAntiIdealDeviation, 1e-12));
  const scores = idealUtility.map((value, index) => (value + antiIdealUtility[index]) / 2);
  return result(method, { ...input, criteria }, [
    tableFromMatrix('cradis-normalized', 'CRADIS Normalized Matrix', normalized, input),
    tableFromMatrix('cradis-weighted', 'CRADIS Weighted Normalized Matrix', weightedMatrix, input),
    {
      id: 'cradis-reference-solutions',
      title: 'CRADIS Ideal and Anti-Ideal References',
      columns: ['Reference', ...criteria.map((criterion) => criterion.id)],
      rows: [
        ['Ideal', ...ideal.map(round)],
        ['Anti-ideal', ...antiIdeal.map(round)],
      ],
    },
    tableFromMatrix('cradis-ideal-deviation', 'CRADIS Deviation from Ideal Matrix', deviationFromIdeal, input),
    tableFromMatrix('cradis-anti-ideal-deviation', 'CRADIS Deviation from Anti-Ideal Matrix', deviationFromAntiIdeal, input),
    {
      id: 'cradis-appraisal',
      title: 'CRADIS Appraisal Coefficients',
      columns: ['Alternative', 'Ideal deviation sum', 'Anti-ideal deviation sum', 'Ideal utility', 'Anti-ideal utility', 'CRADIS score'],
      rows: input.alternatives.map((alternative, index) => [
        alternative.name,
        round(idealDeviationSum[index]),
        round(antiIdealDeviationSum[index]),
        round(idealUtility[index]),
        round(antiIdealUtility[index]),
        round(scores[index]),
      ]),
    },
  ], scores, 'CRADIS ranks alternatives by normalized weighted deviations from ideal and anti-ideal solutions, rewarding low ideal deviation and high anti-ideal separation.');
}

function runFuzzyCradis(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  const criteria = normalizeWeights(resolveCriteria(input, config));
  const fuzzyMatrix = activeFuzzyMatrix(input);
  const normalized = fuzzyMatrix.map((row) => row.map((value, column) => {
    const columnValues = fuzzyMatrix.map((item) => item[column]);
    const min = Math.min(...columnValues.map(defuzzify));
    const max = Math.max(...columnValues.map(defuzzify));
    const range = Math.max(max - min, 1e-12);
    if (criteria[column].direction === 'cost') {
      return { values: value.values.map((cell) => (max - cell) / range).reverse(), type: value.type } as FuzzyNumber;
    }
    return { values: value.values.map((cell) => (cell - min) / range), type: value.type };
  }));
  const weightedFuzzy = normalized.map((row) => row.map((value, column) => scaleFuzzy(value, criteria[column].weight)));
  const ideal = criteria.map((_, column) => weightedFuzzy.map((row) => row[column]).reduce((best, value) => defuzzify(value) > defuzzify(best) ? value : best));
  const antiIdeal = criteria.map((_, column) => weightedFuzzy.map((row) => row[column]).reduce((worst, value) => defuzzify(value) < defuzzify(worst) ? value : worst));
  const deviationFromIdeal = weightedFuzzy.map((row) => row.map((value, column) => fuzzyDistance(value, ideal[column])));
  const deviationFromAntiIdeal = weightedFuzzy.map((row) => row.map((value, column) => fuzzyDistance(value, antiIdeal[column])));
  const idealDeviationSum = deviationFromIdeal.map((row) => row.reduce((sum, value) => sum + value, 0));
  const antiIdealDeviationSum = deviationFromAntiIdeal.map((row) => row.reduce((sum, value) => sum + value, 0));
  const minIdealDeviation = Math.min(...idealDeviationSum.filter(Number.isFinite));
  const maxAntiIdealDeviation = Math.max(...antiIdealDeviationSum.filter(Number.isFinite));
  const idealUtility = idealDeviationSum.map((value) => (minIdealDeviation || 1e-12) / Math.max(value, 1e-12));
  const antiIdealUtility = antiIdealDeviationSum.map((value) => value / Math.max(maxAntiIdealDeviation, 1e-12));
  const scores = idealUtility.map((value, index) => (value + antiIdealUtility[index]) / 2);
  const analysis = result(method, { ...input, criteria, fuzzyValues: fuzzyMatrix }, [
    fuzzyDecisionMatrixRows('Fuzzy CRADIS Normalized Matrix', 'fuzzy-cradis-normalized', normalized, input),
    fuzzyDecisionMatrixRows('Fuzzy CRADIS Weighted Normalized Matrix', 'fuzzy-cradis-weighted', weightedFuzzy, input),
    {
      id: 'fuzzy-cradis-reference-solutions',
      title: 'Fuzzy CRADIS Ideal and Anti-Ideal References',
      columns: ['Reference', ...criteria.map((criterion) => criterion.id)],
      rows: [
        ['Fuzzy ideal', ...ideal.map((value) => fuzzyLabel(value))],
        ['Fuzzy anti-ideal', ...antiIdeal.map((value) => fuzzyLabel(value))],
      ],
    },
    tableFromMatrix('fuzzy-cradis-ideal-deviation', 'Fuzzy CRADIS Distance from Ideal Matrix', deviationFromIdeal, input),
    tableFromMatrix('fuzzy-cradis-anti-ideal-deviation', 'Fuzzy CRADIS Distance from Anti-Ideal Matrix', deviationFromAntiIdeal, input),
    {
      id: 'fuzzy-cradis-appraisal',
      title: 'Fuzzy CRADIS Appraisal Coefficients',
      columns: ['Alternative', 'Ideal deviation sum', 'Anti-ideal deviation sum', 'Ideal utility', 'Anti-ideal utility', 'CRADIS score'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, round(idealDeviationSum[index]), round(antiIdealDeviationSum[index]), round(idealUtility[index]), round(antiIdealUtility[index]), round(scores[index])]),
    },
  ], scores, 'Native fuzzy CRADIS preserves triangular/trapezoidal uploaded values through fuzzy normalization and weighting, compares fuzzy-distance deviations from ideal and anti-ideal references, and ranks alternatives by centroid appraisal coefficients.');
  analysis.diagnostics.push({ label: 'Native fuzzy CRADIS', value: 'Fuzzy ideal/anti-ideal deviations with centroid appraisal coefficients', status: 'pass' });
  analysis.reproducibility = { ...analysis.reproducibility, fuzzyMode: 'Native fuzzy CRADIS', fuzzyCradis: 'Fuzzy min-max normalization, fuzzy weighting, vertex-distance ideal/anti-ideal deviations, centroid appraisal score' };
  return analysis;
}

function runMara(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  if (config.methodParams.fuzzyInputMode === 'Native fuzzy MARA') return runFuzzyMara(input, config, method);
  const criteria = resolveCriteria(input, config);
  const normalized = input.values.map((row) => row.map((value, column) => {
    const columnValues = input.values.map((item) => item[column]).filter(Number.isFinite);
    if (!columnValues.length) return 0;
    if (criteria[column].direction === 'cost') {
      const min = Math.min(...columnValues.map((item) => Math.max(Math.abs(item), 1e-12)));
      return min / Math.max(Math.abs(value), 1e-12);
    }
    const max = Math.max(...columnValues.map((item) => Math.abs(item)), 1e-12);
    return Math.abs(value) / max;
  }));
  const weightedMatrix = weighted(normalized, criteria);
  const optimal = criteria.map((_, column) => Math.max(...weightedMatrix.map((row) => row[column])));
  const benefitIndexes = criteria.map((criterion, index) => criterion.direction === 'benefit' ? index : -1).filter((index) => index >= 0);
  const costIndexes = criteria.map((criterion, index) => criterion.direction === 'cost' ? index : -1).filter((index) => index >= 0);
  const sumAt = (values: number[], indexes: number[]) => indexes.reduce((sum, index) => sum + values[index], 0);
  const optimalBenefitIntensity = sumAt(optimal, benefitIndexes);
  const optimalCostIntensity = sumAt(optimal, costIndexes);
  const optimalArea = (optimalCostIntensity - optimalBenefitIntensity) / 2 + optimalBenefitIntensity;
  const benefitIntensity = weightedMatrix.map((row) => sumAt(row, benefitIndexes));
  const costIntensity = weightedMatrix.map((row) => sumAt(row, costIndexes));
  const alternativeArea = benefitIntensity.map((value, index) => (costIntensity[index] - value) / 2 + value);
  const scores = alternativeArea.map((area) => optimalArea - area);
  return result(method, { ...input, criteria }, [
    tableFromMatrix('mara-normalized', 'MARA Normalized Matrix', normalized, input),
    tableFromMatrix('mara-weighted', 'MARA Weighted Normalized Matrix', weightedMatrix, input),
    {
      id: 'mara-optimal-alternative',
      title: 'MARA Optimal Alternative',
      columns: ['Reference', ...criteria.map((criterion) => criterion.id)],
      rows: [['Optimal', ...optimal.map(round)]],
    },
    {
      id: 'mara-intensity',
      title: 'MARA Benefit and Cost Intensities',
      columns: ['Alternative', 'Benefit intensity', 'Cost intensity', 'Area', 'Optimal area', 'MARA gap'],
      rows: input.alternatives.map((alternative, index) => [
        alternative.name,
        round(benefitIntensity[index]),
        round(costIntensity[index]),
        round(alternativeArea[index]),
        round(optimalArea),
        round(scores[index]),
      ]),
    },
  ], scores, 'MARA ranks alternatives by the magnitude of the area gap between each alternative and the optimal alternative; smaller gap values indicate closer performance.', false);
}

function runRaps(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  if (config.methodParams.fuzzyInputMode === 'Native fuzzy RAPS') return runFuzzyRaps(input, config, method);
  const criteria = resolveCriteria(input, config);
  const normalized = input.values.map((row) => row.map((value, column) => {
    const columnValues = input.values.map((item) => item[column]).filter(Number.isFinite);
    if (!columnValues.length) return 0;
    if (criteria[column].direction === 'cost') {
      const min = Math.min(...columnValues.map((item) => Math.max(Math.abs(item), 1e-12)));
      return min / Math.max(Math.abs(value), 1e-12);
    }
    const max = Math.max(...columnValues.map((item) => Math.abs(item)), 1e-12);
    return Math.abs(value) / max;
  }));
  const weightedMatrix = weighted(normalized, criteria);
  const optimal = criteria.map((_, column) => Math.max(...weightedMatrix.map((row) => row[column])));
  const benefitIndexes = criteria.map((criterion, index) => criterion.direction === 'benefit' ? index : -1).filter((index) => index >= 0);
  const costIndexes = criteria.map((criterion, index) => criterion.direction === 'cost' ? index : -1).filter((index) => index >= 0);
  const magnitude = (values: number[], indexes: number[]) => Math.sqrt(indexes.reduce((sum, index) => sum + values[index] ** 2, 0));
  const qk = magnitude(optimal, benefitIndexes);
  const qh = magnitude(optimal, costIndexes);
  const optimalPerimeter = qk + qh + Math.sqrt(qk ** 2 + qh ** 2);
  const benefitMagnitude = weightedMatrix.map((row) => magnitude(row, benefitIndexes));
  const costMagnitude = weightedMatrix.map((row) => magnitude(row, costIndexes));
  const perimeter = benefitMagnitude.map((value, index) => value + costMagnitude[index] + Math.sqrt(value ** 2 + costMagnitude[index] ** 2));
  const scores = perimeter.map((value) => value / Math.max(optimalPerimeter, 1e-12));
  return result(method, { ...input, criteria }, [
    tableFromMatrix('raps-normalized', 'RAPS Normalized Matrix', normalized, input),
    tableFromMatrix('raps-weighted', 'RAPS Weighted Normalized Matrix', weightedMatrix, input),
    {
      id: 'raps-optimal-components',
      title: 'RAPS Optimal Alternative Components',
      columns: ['Component', 'Value'],
      rows: [['Qk benefit magnitude', round(qk)], ['Qh cost magnitude', round(qh)], ['Optimal perimeter', round(optimalPerimeter)]],
    },
    {
      id: 'raps-perimeter-similarity',
      title: 'RAPS Perimeter Similarity',
      columns: ['Alternative', 'Uk benefit magnitude', 'Uh cost magnitude', 'Perimeter', 'Perimeter similarity'],
      rows: input.alternatives.map((alternative, index) => [
        alternative.name,
        round(benefitMagnitude[index]),
        round(costMagnitude[index]),
        round(perimeter[index]),
        round(scores[index]),
      ]),
    },
  ], scores, 'RAPS ranks alternatives by comparing each alternative perimeter with the optimal alternative perimeter; higher perimeter similarity indicates closer performance to the optimal alternative.');
}

function averageRanks(values: number[], higherIsBetter: boolean): number[] {
  const sorted = values
    .map((value, index) => ({ value, index }))
    .sort((a, b) => higherIsBetter ? b.value - a.value : a.value - b.value);
  const ranks = Array.from({ length: values.length }, () => 0);
  let cursor = 0;
  while (cursor < sorted.length) {
    let end = cursor + 1;
    while (end < sorted.length && Math.abs(sorted[end].value - sorted[cursor].value) <= 1e-12) end += 1;
    const averageRank = (cursor + 1 + end) / 2;
    sorted.slice(cursor, end).forEach((item) => {
      ranks[item.index] = averageRank;
    });
    cursor = end;
  }
  return ranks;
}

function runOreste(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  if (config.methodParams.fuzzyInputMode === 'Native fuzzy ORESTE') return runFuzzyOreste(input, config, method);
  const criteria = resolveCriteria(input, config);
  const criterionRanks = averageRanks(criteria.map((criterion) => criterion.weight), true);
  const alternativeRanksByCriterion = criteria.map((criterion, column) =>
    averageRanks(input.values.map((row) => row[column]), criterion.direction === 'benefit'),
  );
  const projectionDistances = input.alternatives.map((_, alternativeIndex) =>
    criteria.map((__, column) => Math.sqrt((criterionRanks[column] ** 2 + alternativeRanksByCriterion[column][alternativeIndex] ** 2) / 2)),
  );
  const projectionRankValues = projectionDistances.flatMap((row) => row);
  const projectionRanksFlat = averageRanks(projectionRankValues, false);
  const projectionRanks = projectionDistances.map((row, rowIndex) =>
    row.map((_, column) => projectionRanksFlat[rowIndex * criteria.length + column]),
  );
  const scores = projectionRanks.map((row) => row.reduce((sum, value) => sum + value, 0) / Math.max(criteria.length, 1));
  return result(method, { ...input, criteria }, [
    {
      id: 'oreste-criterion-ranks',
      title: 'ORESTE Criterion Preference Ranks',
      columns: ['Criterion', 'Name', 'Weight', 'Preference rank'],
      rows: criteria.map((criterion, index) => [criterion.id, criterion.name, round(criterion.weight), round(criterionRanks[index])]),
    },
    {
      id: 'oreste-alternative-ranks',
      title: 'ORESTE Alternative Ranks By Criterion',
      columns: ['Alternative', ...criteria.map((criterion) => criterion.id)],
      rows: input.alternatives.map((alternative, index) => [
        alternative.name,
        ...criteria.map((_, column) => round(alternativeRanksByCriterion[column][index])),
      ]),
    },
    tableFromMatrix('oreste-projection-distances', 'ORESTE Projection Distances', projectionDistances, input),
    tableFromMatrix('oreste-global-projection-ranks', 'ORESTE Global Projection Ranks', projectionRanks, input),
    {
      id: 'oreste-score',
      title: 'ORESTE Final Rank Scores',
      columns: ['Alternative', 'Average global projection rank'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, round(scores[index])]),
    },
  ], scores, 'ORESTE ranks alternatives from criterion preference ranks and within-criterion alternative ranks; lower average global projection rank indicates stronger preference.', false);
}

function permutations(values: number[], limit: number): number[][] {
  const output: number[][] = [];
  const used = Array.from({ length: values.length }, () => false);
  const current: number[] = [];
  const visit = () => {
    if (output.length >= limit) return;
    if (current.length === values.length) {
      output.push([...current]);
      return;
    }
    values.forEach((value, index) => {
      if (used[index] || output.length >= limit) return;
      used[index] = true;
      current.push(value);
      visit();
      current.pop();
      used[index] = false;
    });
  };
  visit();
  return output;
}

function runQualiflex(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  if (config.methodParams.fuzzyInputMode === 'Native fuzzy QUALIFLEX') return runFuzzyQualiflex(input, config, method);
  const criteria = resolveCriteria(input, config);
  const alternativeCount = input.alternatives.length;
  const exactLimit = Math.max(3, Math.min(8, Number(config.methodParams.qualiflexExactLimit ?? 7) || 7));
  const pairwise = input.alternatives.map((_, first) => input.alternatives.map((__, second) => {
    if (first === second) return 0;
    return criteria.reduce((sum, criterion, column) => {
      const firstValue = input.values[first][column];
      const secondValue = input.values[second][column];
      const diff = criterion.direction === 'benefit' ? firstValue - secondValue : secondValue - firstValue;
      if (Math.abs(diff) <= 1e-12) return sum;
      return sum + criterion.weight * (diff > 0 ? 1 : -1);
    }, 0);
  }));
  const scoreOrder = (order: number[]) => order.reduce((sum, first, position) =>
    sum + order.slice(position + 1).reduce((inner, second) => inner + pairwise[first][second], 0), 0);
  const exact = alternativeCount <= exactLimit;
  const candidateOrders = exact
    ? permutations(input.alternatives.map((_, index) => index), 50000)
    : [input.alternatives.map((_, index) => index).sort((a, b) => {
      const aNet = pairwise[a].reduce((sum, value) => sum + value, 0);
      const bNet = pairwise[b].reduce((sum, value) => sum + value, 0);
      return bNet - aNet;
    })];
  const scoredOrders = candidateOrders.map((order) => ({ order, score: scoreOrder(order) })).sort((a, b) => b.score - a.score);
  const best = scoredOrders[0] ?? { order: input.alternatives.map((_, index) => index), score: 0 };
  const rankingPosition = Array.from({ length: alternativeCount }, () => 0);
  best.order.forEach((alternativeIndex, position) => {
    rankingPosition[alternativeIndex] = position + 1;
  });
  const scores = rankingPosition.map((position) => alternativeCount - position + 1);
  const analysis = result(method, { ...input, criteria }, [
    {
      id: 'qualiflex-pairwise',
      title: 'QUALIFLEX Weighted Concordance/Discordance Matrix',
      columns: ['Alternative', ...input.alternatives.map((alternative) => alternative.id)],
      rows: input.alternatives.map((alternative, index) => [alternative.name, ...pairwise[index].map(round)]),
    },
    {
      id: 'qualiflex-permutation-summary',
      title: 'QUALIFLEX Permutation Summary',
      columns: ['Mode', 'Evaluated rankings', 'Best comprehensive index', 'Selected order'],
      rows: [[exact ? 'Exact enumeration' : 'Pairwise net fallback', scoredOrders.length, round(best.score), best.order.map((index) => input.alternatives[index].name).join(' > ')]],
    },
    {
      id: 'qualiflex-final-order',
      title: 'QUALIFLEX Final Order',
      columns: ['Rank', 'Alternative', 'Position score'],
      rows: best.order.map((alternativeIndex, position) => [position + 1, input.alternatives[alternativeIndex].name, scores[alternativeIndex]]),
    },
  ], scores, 'QUALIFLEX evaluates ranking orders using weighted pairwise concordance/discordance evidence; the selected order maximizes the comprehensive index.');
  analysis.diagnostics.push({ label: 'QUALIFLEX ranking search', value: exact ? `Exact enumeration across ${scoredOrders.length} permutations` : `Large-study fallback used because alternatives exceed ${exactLimit}`, status: exact ? 'pass' : 'warn' });
  analysis.reproducibility = { ...analysis.reproducibility, qualiflexExact: exact, qualiflexEvaluatedRankings: scoredOrders.length, qualiflexExactLimit: exactLimit };
  return analysis;
}

function runRegime(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  if (config.methodParams.fuzzyInputMode === 'Native fuzzy REGIME') return runFuzzyRegime(input, config, method);
  const criteria = resolveCriteria(input, config);
  const dominance = input.alternatives.map((_, first) => input.alternatives.map((__, second) => {
    if (first === second) return 0;
    return criteria.reduce((sum, criterion, column) => {
      const firstValue = input.values[first][column];
      const secondValue = input.values[second][column];
      const difference = criterion.direction === 'benefit' ? firstValue - secondValue : secondValue - firstValue;
      if (Math.abs(difference) <= 1e-12) return sum;
      return sum + criterion.weight * (difference > 0 ? 1 : -1);
    }, 0);
  }));
  const positiveFlow = dominance.map((row) => row.reduce((sum, value) => sum + Math.max(value, 0), 0) / Math.max(input.alternatives.length - 1, 1));
  const negativeFlow = dominance[0].map((_, column) => dominance.reduce((sum, row) => sum + Math.max(row[column], 0), 0) / Math.max(input.alternatives.length - 1, 1));
  const scores = positiveFlow.map((value, index) => value - negativeFlow[index]);
  return result(method, { ...input, criteria }, [
    {
      id: 'regime-dominance',
      title: 'REGIME Weighted Dominance Matrix',
      columns: ['Alternative', ...input.alternatives.map((alternative) => alternative.id)],
      rows: input.alternatives.map((alternative, index) => [alternative.name, ...dominance[index].map(round)]),
    },
    {
      id: 'regime-flows',
      title: 'REGIME Net Dominance Flows',
      columns: ['Alternative', 'Positive dominance flow', 'Negative dominance flow', 'Net dominance'],
      rows: input.alternatives.map((alternative, index) => [
        alternative.name,
        round(positiveFlow[index]),
        round(negativeFlow[index]),
        round(scores[index]),
      ]),
    },
  ], scores, 'REGIME ranks alternatives by weighted pairwise dominance relations across criteria; higher net dominance indicates stronger overall preference.');
}

function runEvamix(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  if (config.methodParams.fuzzyInputMode === 'Native fuzzy EVAMIX') return runFuzzyEvamix(input, config, method);
  const criteria = resolveCriteria(input, config);
  const normalized = minMaxNormalize({ ...input, criteria });
  const rawDominance = input.alternatives.map((_, first) => input.alternatives.map((__, second) => {
    if (first === second) return 0;
    return criteria.reduce((sum, criterion, column) =>
      sum + criterion.weight * (normalized[first][column] - normalized[second][column]), 0);
  }));
  const dominanceValues = rawDominance.flat().filter((value) => Math.abs(value) > 1e-12);
  const minDominance = Math.min(...dominanceValues, 0);
  const maxDominance = Math.max(...dominanceValues, 0);
  const standardized = rawDominance.map((row) => row.map((value) => {
    if (Math.abs(value) <= 1e-12) return 0;
    if (Math.abs(maxDominance - minDominance) <= 1e-12) return value > 0 ? 1 : -1;
    return ((value - minDominance) / (maxDominance - minDominance)) * 2 - 1;
  }));
  const positiveDominance = standardized.map((row) => row.reduce((sum, value) => sum + Math.max(value, 0), 0));
  const negativeDominance = standardized[0].map((_, column) => standardized.reduce((sum, row) => sum + Math.max(row[column], 0), 0));
  const scores = positiveDominance.map((value, index) => value - negativeDominance[index]);
  return result(method, { ...input, criteria }, [
    tableFromMatrix('evamix-normalized', 'EVAMIX Normalized Matrix', normalized, input),
    {
      id: 'evamix-raw-dominance',
      title: 'EVAMIX Weighted Cardinal Dominance Matrix',
      columns: ['Alternative', ...input.alternatives.map((alternative) => alternative.id)],
      rows: input.alternatives.map((alternative, index) => [alternative.name, ...rawDominance[index].map(round)]),
    },
    {
      id: 'evamix-standardized-dominance',
      title: 'EVAMIX Standardized Dominance Matrix',
      columns: ['Alternative', ...input.alternatives.map((alternative) => alternative.id)],
      rows: input.alternatives.map((alternative, index) => [alternative.name, ...standardized[index].map(round)]),
    },
    {
      id: 'evamix-appraisal',
      title: 'EVAMIX Appraisal Scores',
      columns: ['Alternative', 'Outgoing dominance', 'Incoming dominance', 'Net appraisal'],
      rows: input.alternatives.map((alternative, index) => [
        alternative.name,
        round(positiveDominance[index]),
        round(negativeDominance[index]),
        round(scores[index]),
      ]),
    },
  ], scores, 'EVAMIX evaluates alternatives through pairwise dominance after benefit/cost-aware normalization; this cardinal-data implementation reports standardized dominance and net appraisal scores.');
}

function runLexicographic(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  if (config.methodParams.fuzzyInputMode === 'Native fuzzy Lexicographic') return runFuzzyLexicographic(input, config, method);
  const orderIds = String(config.methodParams.lexicographicOrder ?? input.criteria.map((criterion) => criterion.id).join(','))
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const criteriaIds = input.criteria.map((criterion) => criterion.id);
  const orderedCriteria = [...orderIds.filter((id, index, list) => criteriaIds.includes(id) && list.indexOf(id) === index), ...criteriaIds.filter((id) => !orderIds.includes(id))];
  const orderedIndexes = orderedCriteria.map((id) => criteriaIds.indexOf(id)).filter((index) => index >= 0);
  const transformed = input.values.map((row) => row.map((value, column) => input.criteria[column].direction === 'benefit' ? value : -value));
  const sorted = input.alternatives
    .map((alternative, index) => ({ alternative, index }))
    .sort((a, b) => {
      for (const column of orderedIndexes) {
        const difference = transformed[b.index][column] - transformed[a.index][column];
        if (Math.abs(difference) > 1e-12) return difference;
      }
      return a.alternative.name.localeCompare(b.alternative.name);
    });
  const scores = Array.from({ length: input.alternatives.length }, () => 0);
  sorted.forEach((item, position) => {
    scores[item.index] = input.alternatives.length - position;
  });
  const comparisonRows = sorted.map((item, position) => {
    const next = sorted[position + 1];
    const decisiveIndex = next
      ? orderedIndexes.find((column) => Math.abs(transformed[item.index][column] - transformed[next.index][column]) > 1e-12)
      : undefined;
    return [
      position + 1,
      item.alternative.name,
      decisiveIndex === undefined ? 'Tie or final alternative' : input.criteria[decisiveIndex].id,
      decisiveIndex === undefined ? 'No further comparison needed' : `${item.alternative.name} outranks ${next.alternative.name} on ${input.criteria[decisiveIndex].name}`,
    ];
  });
  return result(method, input, [
    {
      id: 'lexicographic-order',
      title: 'Lexicographic Criterion Priority',
      columns: ['Priority', 'Criterion', 'Name', 'Direction'],
      rows: orderedIndexes.map((column, index) => [index + 1, input.criteria[column].id, input.criteria[column].name, input.criteria[column].direction]),
    },
    tableFromMatrix('lexicographic-transformed', 'Lexicographic Direction-Adjusted Matrix', transformed, input),
    {
      id: 'lexicographic-comparisons',
      title: 'Lexicographic Sequential Comparison',
      columns: ['Rank', 'Alternative', 'Decisive criterion', 'Explanation'],
      rows: comparisonRows,
    },
  ], scores, 'Lexicographic ranking applies a strict criterion-priority order: alternatives are compared on the most important criterion first, and lower-priority criteria are used only to break ties. No compensatory trade-off is applied.');
}

function fuzzyMpsiNormalizedWeighted(input: DecisionMatrix, config: StudyConfig) {
  const criteria = normalizeWeights(resolveCriteria(input, config));
  const fuzzyMatrix = activeFuzzyMatrix(input);
  const normalized = fuzzyRatioNormalizeMatrix(fuzzyMatrix, criteria);
  const weightedMatrix = fuzzyWeightedMatrix(normalized, criteria);
  return { criteria, fuzzyMatrix, normalized, weightedMatrix, weightedCrisp: fuzzyToCrispMatrix(weightedMatrix) };
}

function runFuzzyMara(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  const { criteria, fuzzyMatrix, normalized, weightedMatrix, weightedCrisp } = fuzzyMpsiNormalizedWeighted(input, config);
  const optimal = criteria.map((_, column) => weightedMatrix.map((row) => row[column]).reduce((best, value) => compareFuzzy(value, best, true) > 0 ? value : best));
  const optimalCrisp = optimal.map(defuzzify);
  const benefitIndexes = criteria.map((criterion, index) => criterion.direction === 'benefit' ? index : -1).filter((index) => index >= 0);
  const costIndexes = criteria.map((criterion, index) => criterion.direction === 'cost' ? index : -1).filter((index) => index >= 0);
  const sumAt = (values: number[], indexes: number[]) => indexes.reduce((sum, index) => sum + values[index], 0);
  const optimalBenefitIntensity = sumAt(optimalCrisp, benefitIndexes);
  const optimalCostIntensity = sumAt(optimalCrisp, costIndexes);
  const optimalArea = (optimalCostIntensity - optimalBenefitIntensity) / 2 + optimalBenefitIntensity;
  const benefitIntensity = weightedCrisp.map((row) => sumAt(row, benefitIndexes));
  const costIntensity = weightedCrisp.map((row) => sumAt(row, costIndexes));
  const alternativeArea = benefitIntensity.map((value, index) => (costIntensity[index] - value) / 2 + value);
  const scores = alternativeArea.map((area) => optimalArea - area);
  const analysis = result(method, { ...input, criteria, fuzzyValues: fuzzyMatrix }, [
    fuzzyDecisionMatrixRows('Fuzzy MARA Normalized Matrix', 'fuzzy-mara-normalized', normalized, input),
    fuzzyDecisionMatrixRows('Fuzzy MARA Weighted Normalized Matrix', 'fuzzy-mara-weighted', weightedMatrix, { ...input, criteria }),
    { id: 'fuzzy-mara-optimal-alternative', title: 'Fuzzy MARA Optimal Alternative', columns: ['Reference', ...criteria.map((criterion) => criterion.id)], rows: [['Optimal', ...optimal.map((value) => fuzzyLabel(value))]] },
    { id: 'fuzzy-mara-intensity', title: 'Fuzzy MARA Benefit and Cost Intensities', columns: ['Alternative', 'Benefit intensity', 'Cost intensity', 'Area', 'Optimal area', 'MARA gap'], rows: input.alternatives.map((alternative, index) => [alternative.name, round(benefitIntensity[index]), round(costIntensity[index]), round(alternativeArea[index]), round(optimalArea), round(scores[index])]) },
  ], scores, 'Native fuzzy MARA preserves fuzzy normalized and weighted matrices, derives a fuzzy optimal alternative, and ranks by centroid area-gap values.', false);
  return fuzzyStandardDiagnostic(method, analysis, 'Fuzzy MPSI-style normalization with centroid area-gap scoring.');
}

function runFuzzyRaps(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  const { criteria, fuzzyMatrix, normalized, weightedMatrix, weightedCrisp } = fuzzyMpsiNormalizedWeighted(input, config);
  const optimal = criteria.map((_, column) => weightedMatrix.map((row) => row[column]).reduce((best, value) => compareFuzzy(value, best, true) > 0 ? value : best));
  const optimalCrisp = optimal.map(defuzzify);
  const benefitIndexes = criteria.map((criterion, index) => criterion.direction === 'benefit' ? index : -1).filter((index) => index >= 0);
  const costIndexes = criteria.map((criterion, index) => criterion.direction === 'cost' ? index : -1).filter((index) => index >= 0);
  const magnitude = (values: number[], indexes: number[]) => Math.sqrt(indexes.reduce((sum, index) => sum + values[index] ** 2, 0));
  const qk = magnitude(optimalCrisp, benefitIndexes);
  const qh = magnitude(optimalCrisp, costIndexes);
  const optimalPerimeter = qk + qh + Math.sqrt(qk ** 2 + qh ** 2);
  const benefitMagnitude = weightedCrisp.map((row) => magnitude(row, benefitIndexes));
  const costMagnitude = weightedCrisp.map((row) => magnitude(row, costIndexes));
  const perimeter = benefitMagnitude.map((value, index) => value + costMagnitude[index] + Math.sqrt(value ** 2 + costMagnitude[index] ** 2));
  const scores = perimeter.map((value) => value / Math.max(optimalPerimeter, 1e-12));
  const analysis = result(method, { ...input, criteria, fuzzyValues: fuzzyMatrix }, [
    fuzzyDecisionMatrixRows('Fuzzy RAPS Normalized Matrix', 'fuzzy-raps-normalized', normalized, input),
    fuzzyDecisionMatrixRows('Fuzzy RAPS Weighted Normalized Matrix', 'fuzzy-raps-weighted', weightedMatrix, { ...input, criteria }),
    { id: 'fuzzy-raps-optimal-components', title: 'Fuzzy RAPS Optimal Alternative Components', columns: ['Component', 'Value'], rows: [['Qk benefit magnitude', round(qk)], ['Qh cost magnitude', round(qh)], ['Optimal perimeter', round(optimalPerimeter)]] },
    { id: 'fuzzy-raps-perimeter-similarity', title: 'Fuzzy RAPS Perimeter Similarity', columns: ['Alternative', 'Uk benefit magnitude', 'Uh cost magnitude', 'Perimeter', 'Perimeter similarity'], rows: input.alternatives.map((alternative, index) => [alternative.name, round(benefitMagnitude[index]), round(costMagnitude[index]), round(perimeter[index]), round(scores[index])]) },
  ], scores, 'Native fuzzy RAPS preserves fuzzy normalized and weighted matrices, derives fuzzy optimal components, and ranks by centroid perimeter similarity.');
  return fuzzyStandardDiagnostic(method, analysis, 'Fuzzy MPSI-style normalization with centroid perimeter-similarity scoring.');
}

function runFuzzyOreste(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  const criteria = normalizeWeights(resolveCriteria(input, config));
  const fuzzyMatrix = activeFuzzyMatrix(input);
  const criterionRanks = averageRanks(criteria.map((criterion) => criterion.weight), true);
  const alternativeRankMatrix = fuzzyRankByCriterion(fuzzyMatrix, criteria);
  const projectionDistances = input.alternatives.map((_, alternativeIndex) =>
    criteria.map((__, column) => Math.sqrt((criterionRanks[column] ** 2 + alternativeRankMatrix[alternativeIndex][column] ** 2) / 2)),
  );
  const projectionRanksFlat = averageRanks(projectionDistances.flatMap((row) => row), false);
  const projectionRanks = projectionDistances.map((row, rowIndex) => row.map((_, column) => projectionRanksFlat[rowIndex * criteria.length + column]));
  const scores = projectionRanks.map((row) => row.reduce((sum, value) => sum + value, 0) / Math.max(criteria.length, 1));
  const analysis = result(method, { ...input, criteria, fuzzyValues: fuzzyMatrix }, [
    { id: 'fuzzy-oreste-criterion-ranks', title: 'Fuzzy ORESTE Criterion Preference Ranks', columns: ['Criterion', 'Name', 'Weight', 'Preference rank'], rows: criteria.map((criterion, index) => [criterion.id, criterion.name, round(criterion.weight), round(criterionRanks[index])]) },
    tableFromMatrix('fuzzy-oreste-alternative-ranks', 'Fuzzy ORESTE Alternative Ranks By Criterion', alternativeRankMatrix, input),
    tableFromMatrix('fuzzy-oreste-projection-distances', 'Fuzzy ORESTE Projection Distances', projectionDistances, input),
    tableFromMatrix('fuzzy-oreste-global-projection-ranks', 'Fuzzy ORESTE Global Projection Ranks', projectionRanks, input),
    { id: 'fuzzy-oreste-score', title: 'Fuzzy ORESTE Final Rank Scores', columns: ['Alternative', 'Average global projection rank'], rows: input.alternatives.map((alternative, index) => [alternative.name, round(scores[index])]) },
  ], scores, 'Native fuzzy ORESTE ranks fuzzy alternatives within criteria, combines those ranks with criterion preference ranks, and reports lower average projection rank as better.', false);
  return fuzzyStandardDiagnostic(method, analysis, 'Fuzzy criterion-wise ranks projected with ORESTE distance scoring.');
}

function runFuzzyQualiflex(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  const criteria = normalizeWeights(resolveCriteria(input, config));
  const fuzzyMatrix = activeFuzzyMatrix(input);
  const alternativeCount = input.alternatives.length;
  const exactLimit = Math.max(3, Math.min(8, Number(config.methodParams.qualiflexExactLimit ?? 7) || 7));
  const pairwise = input.alternatives.map((_, first) => input.alternatives.map((__, second) => {
    if (first === second) return 0;
    return criteria.reduce((sum, criterion, column) => sum + criterion.weight * fuzzySignedDominance(fuzzyMatrix[first][column], fuzzyMatrix[second][column], criterion), 0);
  }));
  const scoreOrder = (order: number[]) => order.reduce((sum, first, position) => sum + order.slice(position + 1).reduce((inner, second) => inner + pairwise[first][second], 0), 0);
  const exact = alternativeCount <= exactLimit;
  const candidateOrders = exact
    ? permutations(input.alternatives.map((_, index) => index), 50000)
    : [input.alternatives.map((_, index) => index).sort((a, b) => pairwise[b].reduce((sum, value) => sum + value, 0) - pairwise[a].reduce((sum, value) => sum + value, 0))];
  const scoredOrders = candidateOrders.map((order) => ({ order, score: scoreOrder(order) })).sort((a, b) => b.score - a.score);
  const best = scoredOrders[0] ?? { order: input.alternatives.map((_, index) => index), score: 0 };
  const rankingPosition = Array.from({ length: alternativeCount }, () => 0);
  best.order.forEach((alternativeIndex, position) => {
    rankingPosition[alternativeIndex] = position + 1;
  });
  const scores = rankingPosition.map((position) => alternativeCount - position + 1);
  const analysis = result(method, { ...input, criteria, fuzzyValues: fuzzyMatrix }, [
    fuzzyDecisionMatrixRows('Fuzzy QUALIFLEX Input Matrix', 'fuzzy-qualiflex-input', fuzzyMatrix, input),
    { id: 'fuzzy-qualiflex-pairwise', title: 'Fuzzy QUALIFLEX Weighted Concordance/Discordance Matrix', columns: ['Alternative', ...input.alternatives.map((alternative) => alternative.id)], rows: input.alternatives.map((alternative, index) => [alternative.name, ...pairwise[index].map(round)]) },
    { id: 'fuzzy-qualiflex-permutation-summary', title: 'Fuzzy QUALIFLEX Permutation Summary', columns: ['Mode', 'Evaluated rankings', 'Best comprehensive index', 'Selected order'], rows: [[exact ? 'Exact enumeration' : 'Pairwise net fallback', scoredOrders.length, round(best.score), best.order.map((index) => input.alternatives[index].name).join(' > ')]] },
    { id: 'fuzzy-qualiflex-final-order', title: 'Fuzzy QUALIFLEX Final Order', columns: ['Rank', 'Alternative', 'Position score'], rows: best.order.map((alternativeIndex, position) => [position + 1, input.alternatives[alternativeIndex].name, scores[alternativeIndex]]) },
  ], scores, 'Native fuzzy QUALIFLEX evaluates ranking orders using weighted fuzzy pairwise concordance/discordance evidence.');
  analysis.diagnostics.push({ label: 'QUALIFLEX ranking search', value: exact ? `Exact enumeration across ${scoredOrders.length} permutations` : `Large-study fallback used because alternatives exceed ${exactLimit}`, status: exact ? 'pass' : 'warn' });
  analysis.reproducibility = { ...analysis.reproducibility, qualiflexExact: exact, qualiflexEvaluatedRankings: scoredOrders.length, qualiflexExactLimit: exactLimit };
  return fuzzyStandardDiagnostic(method, analysis, 'Fuzzy pairwise concordance/discordance generated from fuzzy ordering.');
}

function runFuzzyRegime(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  const criteria = normalizeWeights(resolveCriteria(input, config));
  const fuzzyMatrix = activeFuzzyMatrix(input);
  const dominance = input.alternatives.map((_, first) => input.alternatives.map((__, second) => {
    if (first === second) return 0;
    return criteria.reduce((sum, criterion, column) => sum + criterion.weight * fuzzySignedDominance(fuzzyMatrix[first][column], fuzzyMatrix[second][column], criterion), 0);
  }));
  const positiveFlow = dominance.map((row) => row.reduce((sum, value) => sum + Math.max(value, 0), 0) / Math.max(input.alternatives.length - 1, 1));
  const negativeFlow = dominance[0].map((_, column) => dominance.reduce((sum, row) => sum + Math.max(row[column], 0), 0) / Math.max(input.alternatives.length - 1, 1));
  const scores = positiveFlow.map((value, index) => value - negativeFlow[index]);
  const analysis = result(method, { ...input, criteria, fuzzyValues: fuzzyMatrix }, [
    fuzzyDecisionMatrixRows('Fuzzy REGIME Input Matrix', 'fuzzy-regime-input', fuzzyMatrix, input),
    { id: 'fuzzy-regime-dominance', title: 'Fuzzy REGIME Weighted Dominance Matrix', columns: ['Alternative', ...input.alternatives.map((alternative) => alternative.id)], rows: input.alternatives.map((alternative, index) => [alternative.name, ...dominance[index].map(round)]) },
    { id: 'fuzzy-regime-flows', title: 'Fuzzy REGIME Net Dominance Flows', columns: ['Alternative', 'Positive dominance flow', 'Negative dominance flow', 'Net dominance'], rows: input.alternatives.map((alternative, index) => [alternative.name, round(positiveFlow[index]), round(negativeFlow[index]), round(scores[index])]) },
  ], scores, 'Native fuzzy REGIME ranks alternatives by weighted fuzzy sign-dominance flows across criteria.');
  return fuzzyStandardDiagnostic(method, analysis, 'Fuzzy weighted sign-dominance flows generated.');
}

function runFuzzyEvamix(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  const criteria = normalizeWeights(resolveCriteria(input, config));
  const fuzzyMatrix = activeFuzzyMatrix(input);
  const normalized = fuzzyRangeNormalizeMatrix(fuzzyMatrix, criteria);
  const normalizedCrisp = fuzzyToCrispMatrix(normalized);
  const rawDominance = input.alternatives.map((_, first) => input.alternatives.map((__, second) => {
    if (first === second) return 0;
    return criteria.reduce((sum, criterion, column) => {
      const centroidDifference = normalizedCrisp[first][column] - normalizedCrisp[second][column];
      const tieMagnitude = Math.abs(centroidDifference) <= 1e-12 ? fuzzyDistance(normalized[first][column], normalized[second][column]) * fuzzySignedDominance(normalized[first][column], normalized[second][column], criterion) : 0;
      return sum + criterion.weight * (Math.abs(centroidDifference) > 1e-12 ? centroidDifference : tieMagnitude);
    }, 0);
  }));
  const dominanceValues = rawDominance.flat().filter((value) => Math.abs(value) > 1e-12);
  const minDominance = Math.min(...dominanceValues, 0);
  const maxDominance = Math.max(...dominanceValues, 0);
  const standardized = rawDominance.map((row) => row.map((value) => {
    if (Math.abs(value) <= 1e-12) return 0;
    if (Math.abs(maxDominance - minDominance) <= 1e-12) return value > 0 ? 1 : -1;
    return ((value - minDominance) / (maxDominance - minDominance)) * 2 - 1;
  }));
  const positiveDominance = standardized.map((row) => row.reduce((sum, value) => sum + Math.max(value, 0), 0));
  const negativeDominance = standardized[0].map((_, column) => standardized.reduce((sum, row) => sum + Math.max(row[column], 0), 0));
  const scores = positiveDominance.map((value, index) => value - negativeDominance[index]);
  const analysis = result(method, { ...input, criteria, fuzzyValues: fuzzyMatrix }, [
    fuzzyDecisionMatrixRows('Fuzzy EVAMIX Normalized Matrix', 'fuzzy-evamix-normalized', normalized, input),
    { id: 'fuzzy-evamix-raw-dominance', title: 'Fuzzy EVAMIX Weighted Cardinal Dominance Matrix', columns: ['Alternative', ...input.alternatives.map((alternative) => alternative.id)], rows: input.alternatives.map((alternative, index) => [alternative.name, ...rawDominance[index].map(round)]) },
    { id: 'fuzzy-evamix-standardized-dominance', title: 'Fuzzy EVAMIX Standardized Dominance Matrix', columns: ['Alternative', ...input.alternatives.map((alternative) => alternative.id)], rows: input.alternatives.map((alternative, index) => [alternative.name, ...standardized[index].map(round)]) },
    { id: 'fuzzy-evamix-appraisal', title: 'Fuzzy EVAMIX Appraisal Scores', columns: ['Alternative', 'Outgoing dominance', 'Incoming dominance', 'Net appraisal'], rows: input.alternatives.map((alternative, index) => [alternative.name, round(positiveDominance[index]), round(negativeDominance[index]), round(scores[index])]) },
  ], scores, 'Native fuzzy EVAMIX evaluates alternatives through fuzzy normalized pairwise dominance, then reports standardized dominance and net appraisal scores.');
  return fuzzyStandardDiagnostic(method, analysis, 'Fuzzy normalized cardinal dominance matrix generated.');
}

function runFuzzyLexicographic(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  const fuzzyMatrix = activeFuzzyMatrix(input);
  const orderIds = String(config.methodParams.lexicographicOrder ?? input.criteria.map((criterion) => criterion.id).join(','))
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const criteriaIds = input.criteria.map((criterion) => criterion.id);
  const orderedCriteria = [...orderIds.filter((id, index, list) => criteriaIds.includes(id) && list.indexOf(id) === index), ...criteriaIds.filter((id) => !orderIds.includes(id))];
  const orderedIndexes = orderedCriteria.map((id) => criteriaIds.indexOf(id)).filter((index) => index >= 0);
  const sorted = input.alternatives
    .map((alternative, index) => ({ alternative, index }))
    .sort((a, b) => {
      for (const column of orderedIndexes) {
        const comparison = compareFuzzy(fuzzyMatrix[a.index][column], fuzzyMatrix[b.index][column], input.criteria[column].direction === 'benefit');
        if (Math.abs(comparison) > 1e-12) return -comparison;
      }
      return a.alternative.name.localeCompare(b.alternative.name);
    });
  const scores = Array.from({ length: input.alternatives.length }, () => 0);
  sorted.forEach((item, position) => {
    scores[item.index] = input.alternatives.length - position;
  });
  const comparisonRows = sorted.map((item, position) => {
    const next = sorted[position + 1];
    const decisiveIndex = next
      ? orderedIndexes.find((column) => Math.abs(compareFuzzy(fuzzyMatrix[item.index][column], fuzzyMatrix[next.index][column], input.criteria[column].direction === 'benefit')) > 1e-12)
      : undefined;
    return [position + 1, item.alternative.name, decisiveIndex === undefined ? 'Tie or final alternative' : input.criteria[decisiveIndex].id, decisiveIndex === undefined ? 'No further comparison needed' : `${item.alternative.name} outranks ${next.alternative.name} on ${input.criteria[decisiveIndex].name}`];
  });
  const analysis = result(method, { ...input, fuzzyValues: fuzzyMatrix }, [
    { id: 'fuzzy-lexicographic-order', title: 'Fuzzy Lexicographic Criterion Priority', columns: ['Priority', 'Criterion', 'Name', 'Direction'], rows: orderedIndexes.map((column, index) => [index + 1, input.criteria[column].id, input.criteria[column].name, input.criteria[column].direction]) },
    fuzzyDecisionMatrixRows('Fuzzy Lexicographic Input Matrix', 'fuzzy-lexicographic-input', fuzzyMatrix, input),
    { id: 'fuzzy-lexicographic-comparisons', title: 'Fuzzy Lexicographic Sequential Comparison', columns: ['Rank', 'Alternative', 'Decisive criterion', 'Explanation'], rows: comparisonRows },
  ], scores, 'Native fuzzy Lexicographic ranking compares alternatives in strict criterion-priority order using fuzzy ordering. No compensatory trade-off is applied.');
  return fuzzyStandardDiagnostic(method, analysis, 'Fuzzy sequential priority comparison generated.');
}

function runMarcos(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  if (config.methodParams.fuzzyInputMode === 'Native fuzzy MARCOS') {
    return runFuzzyMarcos(input, config, method);
  }
  const criteria = resolveCriteria(input, config);
  const ideal = input.values[0].map((_, column) => criteria[column].direction === 'benefit' ? Math.max(...input.values.map((row) => row[column])) : Math.min(...input.values.map((row) => row[column])));
  const antiIdeal = input.values[0].map((_, column) => criteria[column].direction === 'benefit' ? Math.min(...input.values.map((row) => row[column])) : Math.max(...input.values.map((row) => row[column])));
  const augmented = [antiIdeal, ...input.values, ideal];
  const normalizedAugmented = augmented.map((row) => row.map((value, column) => criteria[column].direction === 'benefit' ? value / (ideal[column] || 1) : ideal[column] / (value || 1)));
  const weightedAugmented = weighted(normalizedAugmented, criteria);
  const utility = weightedAugmented.map((row) => row.reduce((sum, value) => sum + value, 0));
  const antiUtility = utility[0] || 1;
  const idealUtility = utility[utility.length - 1] || 1;
  const utilityRange = idealUtility - antiUtility || 1;
  const degrees = utility.slice(1, -1).map((value) => {
    const rangeKm = (value - antiUtility) / utilityRange;
    const km = value / antiUtility;
    const kp = value / idealUtility;
    const total = km + kp || 1;
    const fKm = kp / total;
    const fKp = km / total;
    const publishedTotal = rangeKm + kp || 1;
    const publishedFKm = rangeKm / publishedTotal;
    const publishedFKp = kp / publishedTotal;
    const score = (km + kp) / (1 + ((1 - fKp) / (fKp || 1)) + ((1 - fKm) / (fKm || 1)));
    return { km, rangeKm, kp, fKm, fKp, publishedFKm, publishedFKp, score };
  });
  const scoreMode = String(config.methodParams.marcosScoreMode ?? 'Standard utility function f(K)');
  const usesPublishedConvention = scoreMode === 'Published range-scaled f(K+) convention';
  const scores = degrees.map((item) => usesPublishedConvention ? item.publishedFKp : item.score);
  return result(method, { ...input, criteria }, [
    tableFromMatrix('marcos-normalized', 'MARCOS Normalized Matrix', normalizedAugmented.slice(1, -1), input),
    tableFromMatrix('marcos-weighted', 'MARCOS Weighted Matrix', weightedAugmented.slice(1, -1), input),
    { id: 'marcos-utility', title: 'MARCOS Utility Degrees', columns: ['Alternative', 'S', 'K-', 'K+', 'f(K-)', 'f(K+)', 'f(K)', 'Selected score'], rows: input.alternatives.map((alternative, index) => [alternative.name, round(utility[index + 1]), round(usesPublishedConvention ? degrees[index].rangeKm : degrees[index].km), round(degrees[index].kp), round(usesPublishedConvention ? degrees[index].publishedFKm : degrees[index].fKm), round(usesPublishedConvention ? degrees[index].publishedFKp : degrees[index].fKp), round(usesPublishedConvention ? degrees[index].publishedFKp : degrees[index].score), round(scores[index])]) },
  ], scores, usesPublishedConvention
    ? 'MARCOS ranks alternatives by the published range-scaled f(K+) convention selected for this study.'
    : 'MARCOS ranks alternatives by utility relative to anti-ideal and ideal reference alternatives.');
}

function runFuzzyMarcos(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  const criteria = resolveCriteria(input, config);
  const fuzzyMatrix = input.fuzzyValues?.length
    ? input.fuzzyValues
    : input.values.map((row) => row.map((value) => crispFuzzy(value)));
  const normalizedCriteria = normalizeWeights(criteria);
  const ideal = criteria.map((criterion, column) => {
    const columnValues = fuzzyMatrix.map((row) => row[column]);
    return columnValues.reduce((best, value) => {
      const better = criterion.direction === 'benefit'
        ? defuzzify(value) > defuzzify(best)
        : defuzzify(value) < defuzzify(best);
      return better ? value : best;
    }, columnValues[0]);
  });
  const antiIdeal = criteria.map((criterion, column) => {
    const columnValues = fuzzyMatrix.map((row) => row[column]);
    return columnValues.reduce((worst, value) => {
      const worse = criterion.direction === 'benefit'
        ? defuzzify(value) < defuzzify(worst)
        : defuzzify(value) > defuzzify(worst);
      return worse ? value : worst;
    }, columnValues[0]);
  });
  const augmented = [antiIdeal, ...fuzzyMatrix, ideal];
  const normalizedAugmented = augmented.map((row) => row.map((value, column) => {
    if (criteria[column].direction === 'benefit') {
      return divideFuzzyByScalar(value, Math.max(defuzzify(ideal[column]), 1e-9));
    }
    return scaleFuzzy(reciprocalFuzzy(value), Math.max(defuzzify(ideal[column]), 1e-9));
  }));
  const weightedAugmented = normalizedAugmented.map((row) => row.map((value, column) => scaleFuzzy(value, normalizedCriteria[column].weight)));
  const utility = weightedAugmented.map((row) => row.reduce((sum, value) => sum + defuzzify(value), 0));
  const antiUtility = utility[0] || 1;
  const idealUtility = utility[utility.length - 1] || 1;
  const degrees = utility.slice(1, -1).map((value) => {
    const km = value / antiUtility;
    const kp = value / idealUtility;
    const total = km + kp || 1;
    const fKm = kp / total;
    const fKp = km / total;
    const score = (km + kp) / (1 + ((1 - fKp) / (fKp || 1)) + ((1 - fKm) / (fKm || 1)));
    return { km, kp, fKm, fKp, score };
  });
  const scores = degrees.map((item) => item.score);
  const analysis = result(method, { ...input, criteria: normalizedCriteria, fuzzyValues: fuzzyMatrix }, [
    {
      id: 'fuzzy-marcos-references',
      title: 'Fuzzy MARCOS Reference Alternatives',
      columns: ['Reference', ...criteria.map((criterion) => criterion.id)],
      rows: [
        ['Anti-ideal', ...antiIdeal.map((value) => fuzzyLabel(value))],
        ['Ideal', ...ideal.map((value) => fuzzyLabel(value))],
      ],
    },
    {
      id: 'fuzzy-marcos-normalized',
      title: 'Fuzzy MARCOS Normalized Matrix',
      columns: ['Alternative', ...criteria.map((criterion) => criterion.id)],
      rows: normalizedAugmented.slice(1, -1).map((row, index) => [input.alternatives[index].name, ...row.map((value) => fuzzyLabel(value))]),
    },
    {
      id: 'fuzzy-marcos-weighted',
      title: 'Fuzzy MARCOS Weighted Matrix',
      columns: ['Alternative', ...criteria.map((criterion) => criterion.id)],
      rows: weightedAugmented.slice(1, -1).map((row, index) => [input.alternatives[index].name, ...row.map((value) => fuzzyLabel(value))]),
    },
    {
      id: 'fuzzy-marcos-utility',
      title: 'Fuzzy MARCOS Utility Degrees',
      columns: ['Alternative', 'S', 'K-', 'K+', 'f(K-)', 'f(K+)', 'f(K)'],
      rows: input.alternatives.map((alternative, index) => [
        alternative.name,
        round(utility[index + 1]),
        round(degrees[index].km),
        round(degrees[index].kp),
        round(degrees[index].fKm),
        round(degrees[index].fKp),
        round(scores[index]),
      ]),
    },
  ], scores, 'Native fuzzy MARCOS preserves triangular/trapezoidal uploaded values, builds fuzzy anti-ideal and ideal references, normalizes and weights fuzzy values, and ranks alternatives by centroid utility degree.');
  analysis.diagnostics.push({ label: 'Native fuzzy MARCOS', value: 'Fuzzy ideal/anti-ideal references with centroid utility degrees', status: 'pass' });
  analysis.reproducibility = { ...analysis.reproducibility, fuzzyMode: 'Native fuzzy MARCOS', fuzzyMarcos: 'Fuzzy references, fuzzy normalization/weighting, centroid K- and K+ utility degrees' };
  return analysis;
}

function runMairca(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  if (config.methodParams.fuzzyInputMode === 'Native fuzzy MAIRCA') {
    return runFuzzyMairca(input, config, method);
  }
  const criteria = resolveCriteria(input, config);
  const normalized = input.values.map((row) => row.map((value, column) => {
    const values = input.values.map((item) => item[column]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (Math.abs(max - min) <= 1e-12) return 1;
    return criteria[column].direction === 'cost'
      ? (max - value) / (max - min)
      : (value - min) / (max - min);
  }));
  const theoretical = criteria.map((criterion) => criterion.weight / input.alternatives.length);
  const theoreticalMatrix = input.alternatives.map(() => theoretical);
  const real = normalized.map((row) => row.map((value, column) => value * theoretical[column]));
  const gap = real.map((row) => row.map((value, column) => Math.abs(theoretical[column] - value)));
  const scores = gap.map((row) => row.reduce((sum, value) => sum + value, 0));
  return result(method, { ...input, criteria }, [
    tableFromMatrix('normalized', 'MAIRCA Normalized Matrix', normalized, input),
    tableFromMatrix('theoretical-assessment', 'MAIRCA Theoretical Assessment Matrix', theoreticalMatrix, input),
    tableFromMatrix('real-assessment', 'MAIRCA Real Assessment Matrix', real, input),
    tableFromMatrix('gap', 'MAIRCA Gap Matrix', gap, input),
    { id: 'mairca-total-gap', title: 'MAIRCA Total Gap', columns: ['Alternative', 'Total Gap'], rows: input.alternatives.map((alternative, index) => [alternative.name, round(scores[index])]) },
  ], scores, 'MAIRCA ranks alternatives by the smallest gap between theoretical and real assessment matrices.', false);
}

function runFuzzyMairca(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  const criteria = resolveCriteria(input, config);
  const fuzzyMatrix = input.fuzzyValues?.length
    ? input.fuzzyValues
    : input.values.map((row) => row.map((value) => crispFuzzy(value)));
  const normalizedCriteria = normalizeWeights(criteria);
  const normalized = fuzzyMatrix.map((row) => row.map((value, column) => {
    const columnValues = fuzzyMatrix.map((item) => item[column]);
    const minLower = Math.min(...columnValues.map((item) => item.values[0]).filter(Number.isFinite));
    const maxUpper = Math.max(...columnValues.map((item) => item.values[item.values.length - 1]).filter(Number.isFinite));
    const range = maxUpper - minLower;
    if (range <= 1e-12) return crispFuzzy(1);
    const mapped = value.values.map((cell) => criteria[column].direction === 'cost'
      ? (maxUpper - cell) / range
      : (cell - minLower) / range);
    return { values: mapped.slice().sort((a, b) => a - b), type: value.type };
  }));
  const theoretical = normalizedCriteria.map((criterion) => criterion.weight / input.alternatives.length);
  const theoreticalMatrix = input.alternatives.map(() => theoretical);
  const real = normalized.map((row) => row.map((value, column) => scaleFuzzy(value, theoretical[column])));
  const gap = real.map((row) => row.map((value, column) => Math.abs(theoretical[column] - defuzzify(value))));
  const scores = gap.map((row) => row.reduce((sum, value) => sum + value, 0));
  const analysis = result(method, { ...input, criteria: normalizedCriteria, fuzzyValues: fuzzyMatrix }, [
    {
      id: 'fuzzy-mairca-normalized',
      title: 'Fuzzy MAIRCA Normalized Matrix',
      columns: ['Alternative', ...criteria.map((criterion) => criterion.id)],
      rows: normalized.map((row, index) => [input.alternatives[index].name, ...row.map((value) => fuzzyLabel(value))]),
    },
    tableFromMatrix('fuzzy-mairca-theoretical-assessment', 'Fuzzy MAIRCA Theoretical Assessment Matrix', theoreticalMatrix, input),
    {
      id: 'fuzzy-mairca-real-assessment',
      title: 'Fuzzy MAIRCA Real Assessment Matrix',
      columns: ['Alternative', ...criteria.map((criterion) => criterion.id)],
      rows: real.map((row, index) => [input.alternatives[index].name, ...row.map((value) => fuzzyLabel(value))]),
    },
    tableFromMatrix('fuzzy-mairca-gap', 'Fuzzy MAIRCA Gap Matrix', gap, input),
    {
      id: 'fuzzy-mairca-total-gap',
      title: 'Fuzzy MAIRCA Total Gap',
      columns: ['Alternative', 'Total Gap'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, round(scores[index])]),
    },
  ], scores, 'Native fuzzy MAIRCA preserves triangular/trapezoidal uploaded values through fuzzy normalization and real assessment, then ranks alternatives by the smallest centroid gap from the theoretical assessment matrix.', false);
  analysis.diagnostics.push({ label: 'Native fuzzy MAIRCA', value: 'Fuzzy real assessment with centroid gap scoring', status: 'pass' });
  analysis.reproducibility = { ...analysis.reproducibility, fuzzyMode: 'Native fuzzy MAIRCA', fuzzyMairca: 'Fuzzy normalization, theoretical assessment, fuzzy real assessment, centroid gap matrix' };
  return analysis;
}

function criterionDifference(input: DecisionMatrix, a: number, b: number, criterion: number): number {
  const diff = input.values[a][criterion] - input.values[b][criterion];
  return input.criteria[criterion].direction === 'benefit' ? diff : -diff;
}

function prometheePreferenceValue(diff: number, config: StudyConfig): number {
  const preferenceFunction = String(config.methodParams.preferenceFunction ?? 'Usual');
  const q = Math.max(0, Number(config.methodParams.prometheeIndifferenceThreshold ?? 0) || 0);
  const p = Math.max(q, Number(config.methodParams.prometheePreferenceThreshold ?? 1) || 1);
  const sigma = Math.max(1e-9, Number(config.methodParams.prometheeGaussianSigma ?? p) || p || 1);
  if (diff <= 0) return 0;
  if (preferenceFunction === 'U-shape') return diff > q ? 1 : 0;
  if (preferenceFunction === 'V-shape') return diff >= p ? 1 : diff / p;
  if (preferenceFunction === 'Level') {
    if (diff <= q) return 0;
    return diff <= p ? 0.5 : 1;
  }
  if (preferenceFunction === 'Linear') {
    if (diff <= q) return 0;
    if (diff >= p) return 1;
    return (diff - q) / (p - q || 1);
  }
  if (preferenceFunction === 'Gaussian') return 1 - Math.exp(-(diff ** 2) / (2 * sigma ** 2));
  return 1;
}

function runPromethee(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  if (config.methodParams.fuzzyInputMode === 'Native fuzzy PROMETHEE') {
    return runFuzzyPromethee(input, config, method);
  }
  const criteria = resolveCriteria(input, config);
  const n = input.alternatives.length;
  const preference = Array.from({ length: n }, (_, a) => Array.from({ length: n }, (_, b) => {
    if (a === b) return 0;
    return criteria.reduce((sum, criterion, column) => sum + criterion.weight * prometheePreferenceValue(criterionDifference({ ...input, criteria }, a, b, column), config), 0);
  }));
  const positive = preference.map((row) => row.reduce((sum, value) => sum + value, 0) / Math.max(n - 1, 1));
  const negative = preference[0].map((_, column) => preference.reduce((sum, row) => sum + row[column], 0) / Math.max(n - 1, 1));
  const scores = positive.map((value, index) => value - negative[index]);
  const analysis = result(method, { ...input, criteria }, [
    tableFromMatrix('preference-index', 'PROMETHEE Preference Index Matrix', preference, input),
    { id: 'flows', title: 'PROMETHEE II Preference Flows', columns: ['Alternative', 'Positive flow', 'Negative flow', 'Net flow'], rows: input.alternatives.map((alternative, index) => [alternative.name, round(positive[index]), round(negative[index]), round(scores[index])]) },
  ], scores, 'PROMETHEE II ranks alternatives by net outranking flow from pairwise preference indices.');
  analysis.reproducibility = { ...analysis.reproducibility, preferenceFunction: String(config.methodParams.preferenceFunction ?? 'Usual'), prometheeIndifferenceThreshold: Number(config.methodParams.prometheeIndifferenceThreshold ?? 0), prometheePreferenceThreshold: Number(config.methodParams.prometheePreferenceThreshold ?? 1), prometheeGaussianSigma: Number(config.methodParams.prometheeGaussianSigma ?? config.methodParams.prometheePreferenceThreshold ?? 1) };
  return analysis;
}

function runFuzzyPromethee(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  const criteria = resolveCriteria(input, config);
  const fuzzyMatrix = input.fuzzyValues?.length
    ? input.fuzzyValues
    : input.values.map((row) => row.map((value) => crispFuzzy(value)));
  const n = input.alternatives.length;
  const maxDistances = criteria.map((_, column) =>
    Math.max(...fuzzyMatrix.flatMap((row, rowIndex) => fuzzyMatrix.map((other, otherIndex) =>
      rowIndex === otherIndex ? 0 : fuzzyDistance(row[column], other[column]),
    )), 1e-9),
  );
  const preference = Array.from({ length: n }, (_, a) => Array.from({ length: n }, (_, b) => {
    if (a === b) return 0;
    return criteria.reduce((sum, criterion, column) => {
      const first = fuzzyMatrix[a][column];
      const second = fuzzyMatrix[b][column];
      const direction = criterion.direction === 'benefit'
        ? defuzzify(first) - defuzzify(second)
        : defuzzify(second) - defuzzify(first);
      if (direction <= 0) return sum;
      const strength = fuzzyDistance(first, second) / maxDistances[column];
      return sum + criterion.weight * Math.min(1, Math.max(0, strength));
    }, 0);
  }));
  const positive = preference.map((row) => row.reduce((sum, value) => sum + value, 0) / Math.max(n - 1, 1));
  const negative = preference[0].map((_, column) => preference.reduce((sum, row) => sum + row[column], 0) / Math.max(n - 1, 1));
  const scores = positive.map((value, index) => value - negative[index]);
  const analysis = result(method, { ...input, criteria, fuzzyValues: fuzzyMatrix }, [
    tableFromMatrix('fuzzy-promethee-preference-index', 'Fuzzy PROMETHEE Preference Index Matrix', preference, input),
    {
      id: 'fuzzy-promethee-flows',
      title: 'Fuzzy PROMETHEE II Preference Flows',
      columns: ['Alternative', 'Positive flow', 'Negative flow', 'Net flow'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, round(positive[index]), round(negative[index]), round(scores[index])]),
    },
  ], scores, 'Native fuzzy PROMETHEE preserves triangular/trapezoidal uploaded values and derives pairwise preference indices from fuzzy-distance preference strength before calculating positive, negative, and net outranking flows.');
  analysis.diagnostics.push({ label: 'Native fuzzy PROMETHEE', value: 'Fuzzy pairwise preference indices and net flows generated', status: 'pass' });
  analysis.reproducibility = { ...analysis.reproducibility, fuzzyMode: 'Native fuzzy PROMETHEE', fuzzyPromethee: 'Centroid preference direction with vertex-distance preference strength and PROMETHEE II net flow' };
  return analysis;
}

function runElectre(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  if (config.methodParams.fuzzyInputMode === 'Native fuzzy ELECTRE') {
    return runFuzzyElectre(input, config, method);
  }
  const criteria = resolveCriteria(input, config);
  const n = input.alternatives.length;
  const ranges = criteria.map((_, column) => {
    const values = input.values.map((row) => row[column]);
    return Math.max(...values) - Math.min(...values) || 1;
  });
  const concordanceThreshold = Number(config.methodParams.electreConcordance ?? 0.6);
  const discordanceThreshold = Number(config.methodParams.electreDiscordance ?? 0.4);
  const concordance = Array.from({ length: n }, (_, a) => Array.from({ length: n }, (_, b) => {
    if (a === b) return 0;
    return criteria.reduce((sum, criterion, column) => sum + (criterionDifference({ ...input, criteria }, a, b, column) >= 0 ? criterion.weight : 0), 0);
  }));
  const discordance = Array.from({ length: n }, (_, a) => Array.from({ length: n }, (_, b) => {
    if (a === b) return 0;
    return Math.max(...criteria.map((_, column) => Math.max(0, -criterionDifference({ ...input, criteria }, a, b, column)) / ranges[column]));
  }));
  const outranking: number[][] = concordance.map((row, a) => row.map((value, b) => a !== b && value >= concordanceThreshold && discordance[a][b] <= discordanceThreshold ? 1 : 0));
  const scores = outranking.map((row, index) => row.reduce((sum, value) => sum + value, 0) - outranking.reduce((sum, otherRow) => sum + otherRow[index], 0));
  return result(method, { ...input, criteria }, [
    tableFromMatrix('concordance', 'ELECTRE Concordance Matrix', concordance, input),
    tableFromMatrix('discordance', 'ELECTRE Discordance Matrix', discordance, input),
    tableFromMatrix('outranking', 'ELECTRE Outranking Matrix', outranking, input),
    { id: 'electre-score', title: 'ELECTRE Net Outranking Score', columns: ['Alternative', 'Outranks', 'Outranked by', 'Net score'], rows: input.alternatives.map((alternative, index) => [alternative.name, outranking[index].reduce((sum, value) => sum + value, 0), outranking.reduce((sum, row) => sum + row[index], 0), scores[index]]) },
  ], scores, 'ELECTRE I builds concordance and discordance matrices, then ranks alternatives by net outranking dominance.');
}

function runFuzzyElectre(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  const criteria = resolveCriteria(input, config);
  const fuzzyMatrix = input.fuzzyValues?.length
    ? input.fuzzyValues
    : input.values.map((row) => row.map((value) => crispFuzzy(value)));
  const n = input.alternatives.length;
  const maxDistances = criteria.map((_, column) =>
    Math.max(...fuzzyMatrix.flatMap((row, rowIndex) => fuzzyMatrix.map((other, otherIndex) =>
      rowIndex === otherIndex ? 0 : fuzzyDistance(row[column], other[column]),
    )), 1e-9),
  );
  const concordanceThreshold = Number(config.methodParams.electreConcordance ?? 0.6);
  const discordanceThreshold = Number(config.methodParams.electreDiscordance ?? 0.4);
  const concordance = Array.from({ length: n }, (_, a) => Array.from({ length: n }, (_, b) => {
    if (a === b) return 0;
    return criteria.reduce((sum, criterion, column) => {
      const first = fuzzyMatrix[a][column];
      const second = fuzzyMatrix[b][column];
      const direction = criterion.direction === 'benefit'
        ? defuzzify(first) - defuzzify(second)
        : defuzzify(second) - defuzzify(first);
      return sum + (direction >= 0 ? criterion.weight : 0);
    }, 0);
  }));
  const discordance = Array.from({ length: n }, (_, a) => Array.from({ length: n }, (_, b) => {
    if (a === b) return 0;
    return Math.max(...criteria.map((criterion, column) => {
      const first = fuzzyMatrix[a][column];
      const second = fuzzyMatrix[b][column];
      const direction = criterion.direction === 'benefit'
        ? defuzzify(first) - defuzzify(second)
        : defuzzify(second) - defuzzify(first);
      return direction < 0 ? fuzzyDistance(first, second) / maxDistances[column] : 0;
    }));
  }));
  const outranking: number[][] = concordance.map((row, a) => row.map((value, b) => a !== b && value >= concordanceThreshold && discordance[a][b] <= discordanceThreshold ? 1 : 0));
  const scores = outranking.map((row, index) => row.reduce((sum, value) => sum + value, 0) - outranking.reduce((sum, otherRow) => sum + otherRow[index], 0));
  const analysis = result(method, { ...input, criteria, fuzzyValues: fuzzyMatrix }, [
    tableFromMatrix('fuzzy-electre-concordance', 'Fuzzy ELECTRE Concordance Matrix', concordance, input),
    tableFromMatrix('fuzzy-electre-discordance', 'Fuzzy ELECTRE Discordance Matrix', discordance, input),
    tableFromMatrix('fuzzy-electre-outranking', 'Fuzzy ELECTRE Outranking Matrix', outranking, input),
    {
      id: 'fuzzy-electre-score',
      title: 'Fuzzy ELECTRE Net Outranking Score',
      columns: ['Alternative', 'Outranks', 'Outranked by', 'Net score'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, outranking[index].reduce((sum, value) => sum + value, 0), outranking.reduce((sum, row) => sum + row[index], 0), scores[index]]),
    },
  ], scores, 'Native fuzzy ELECTRE preserves triangular/trapezoidal uploaded values, builds concordance from centroid outranking evidence, builds discordance from normalized fuzzy distances, and ranks alternatives by net outranking dominance.');
  analysis.diagnostics.push({ label: 'Native fuzzy ELECTRE', value: `c >= ${round(concordanceThreshold)}, d <= ${round(discordanceThreshold)} with fuzzy discordance`, status: 'pass' });
  analysis.reproducibility = { ...analysis.reproducibility, fuzzyMode: 'Native fuzzy ELECTRE', fuzzyElectre: 'Centroid concordance evidence, vertex-distance discordance, thresholded outranking relation', concordanceThreshold: round(concordanceThreshold), discordanceThreshold: round(discordanceThreshold) };
  return analysis;
}

function runSmart(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  if (config.methodParams.fuzzyInputMode === 'Native fuzzy SMART') {
    return runFuzzySmart(input, config, method);
  }
  const criteria = resolveCriteria(input, config);
  const utilities = minMaxNormalize({ ...input, criteria });
  const weightedUtilities = weighted(utilities, criteria);
  const scores = weightedUtilities.map((row) => row.reduce((sum, value) => sum + value, 0));
  return result(method, { ...input, criteria }, [
    tableFromMatrix('utilities', 'SMART Single-Attribute Utilities', utilities, input),
    tableFromMatrix('weighted-utilities', 'SMART Weighted Utilities', weightedUtilities, input),
  ], scores, 'SMART converts criterion performances to normalized utilities and aggregates them using swing-style weights.');
}

function runSmarter(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  if (config.methodParams.fuzzyInputMode === 'Native fuzzy SMARTER') {
    return runFuzzySmarter(input, config, method);
  }
  const weights = smarterRocWeights(input, config);
  const criteria = input.criteria.map((criterion, index) => ({ ...criterion, weight: weights[index] }));
  const utilityMode = String(config.methodParams.smarterUtilityMode ?? 'Normalize performances');
  const scoreMode = String(config.methodParams.smarterScoreMode ?? 'Raw additive utility');
  const utilities = utilityMode === 'Input values are utilities'
    ? input.values.map((row) => row.map((value) => value / 100))
    : minMaxNormalize({ ...input, criteria });
  const weightedUtilities = weighted(utilities, criteria);
  const rawScores = weightedUtilities.map((row) => row.reduce((sum, value) => sum + value, 0));
  const scoreTotal = rawScores.reduce((sum, value) => sum + value, 0) || 1;
  const scores = scoreMode === 'Normalize total scores'
    ? rawScores.map((value) => value / scoreTotal)
    : rawScores;
  const order = parseCriterionOrder(config.methodParams.smarterOrder, input);
  return result(method, { ...input, criteria }, [
    {
      id: 'smarter-rank-order',
      title: 'SMARTER Ranked Swing Weights',
      columns: ['Rank', 'Criterion', 'Name', 'ROC Weight'],
      rows: order.map((criterionId, index) => {
        const criterionIndex = input.criteria.findIndex((criterion) => criterion.id === criterionId);
        return [index + 1, criterionId, input.criteria[criterionIndex]?.name ?? criterionId, round(criteria[criterionIndex]?.weight ?? 0)];
      }),
    },
    tableFromMatrix('smarter-utilities', 'SMARTER Single-Attribute Utilities', utilities, input),
    tableFromMatrix('smarter-weighted-utilities', 'SMARTER ROC-Weighted Utilities', weightedUtilities, input),
    {
      id: 'smarter-scores',
      title: 'SMARTER Utility Scores',
      columns: ['Alternative', 'Raw additive utility', 'Reported score'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, round(rawScores[index]), round(scores[index])]),
    },
  ], scores, scoreMode === 'Normalize total scores'
    ? 'SMARTER converts ranked swing-weight information into rank-order centroid weights, aggregates single-attribute utilities, and reports total scores normalized across alternatives.'
    : 'SMARTER converts ranked swing-weight information into rank-order centroid weights, normalizes criterion performance into single-attribute utilities, and ranks alternatives by additive utility.');
}

function runFuzzySmarter(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  const fuzzyMatrix = activeFuzzyMatrix(input);
  const centroidInput = { ...input, values: fuzzyMatrix.map((row) => row.map(defuzzify)), fuzzyValues: fuzzyMatrix };
  const weights = smarterRocWeights(centroidInput, config);
  const criteria = centroidInput.criteria.map((criterion, index) => ({ ...criterion, weight: weights[index] }));
  const utilityMode = String(config.methodParams.smarterUtilityMode ?? 'Normalize performances');
  const scoreMode = String(config.methodParams.smarterScoreMode ?? 'Raw additive utility');
  const utilities = utilityMode === 'Input values are utilities'
    ? fuzzyMatrix.map((row) => row.map((value) => scaleFuzzy(value, 1 / 100)))
    : fuzzyMatrix.map((row) => row.map((value, column) => {
      const columnValues = fuzzyMatrix.map((item) => item[column]);
      const min = Math.min(...columnValues.map(defuzzify));
      const max = Math.max(...columnValues.map(defuzzify));
      const range = Math.max(max - min, 1e-12);
      const mapped = value.values.map((cell) => criteria[column].direction === 'cost' ? (max - cell) / range : (cell - min) / range).sort((a, b) => a - b);
      return { values: mapped, type: value.type } as FuzzyNumber;
    }));
  const weightedUtilities = utilities.map((row) => row.map((value, column) => scaleFuzzy(value, criteria[column].weight)));
  const rawScores = weightedUtilities.map((row) => row.reduce((sum, value) => sum + defuzzify(value), 0));
  const scoreTotal = rawScores.reduce((sum, value) => sum + value, 0) || 1;
  const scores = scoreMode === 'Normalize total scores' ? rawScores.map((value) => value / scoreTotal) : rawScores;
  const order = parseCriterionOrder(config.methodParams.smarterOrder, centroidInput);
  const analysis = result(method, { ...centroidInput, criteria }, [
    {
      id: 'fuzzy-smarter-rank-order',
      title: 'Fuzzy SMARTER Ranked Swing Weights',
      columns: ['Rank', 'Criterion', 'Name', 'ROC Weight'],
      rows: order.map((criterionId, index) => {
        const criterionIndex = criteria.findIndex((criterion) => criterion.id === criterionId);
        return [index + 1, criterionId, criteria[criterionIndex]?.name ?? criterionId, round(criteria[criterionIndex]?.weight ?? 0)];
      }),
    },
    fuzzyDecisionMatrixRows('Fuzzy SMARTER Single-Attribute Utilities', 'fuzzy-smarter-utilities', utilities, input),
    fuzzyDecisionMatrixRows('Fuzzy SMARTER ROC-Weighted Utilities', 'fuzzy-smarter-weighted-utilities', weightedUtilities, input),
    {
      id: 'fuzzy-smarter-scores',
      title: 'Fuzzy SMARTER Utility Scores',
      columns: ['Alternative', 'Raw additive utility', 'Reported score'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, round(rawScores[index]), round(scores[index])]),
    },
  ], scores, 'Native fuzzy SMARTER preserves triangular/trapezoidal utilities, applies ROC weights, and ranks alternatives by centroid additive utility scores.');
  analysis.diagnostics.push({ label: 'Native fuzzy SMARTER', value: 'Fuzzy utilities weighted by ROC weights and scored by centroid additive utility', status: 'pass' });
  analysis.reproducibility = { ...analysis.reproducibility, fuzzyMode: 'Native fuzzy SMARTER', fuzzySmarter: 'Fuzzy utility values, ROC weighting, centroid reported scores', utilityMode, scoreMode };
  return analysis;
}

function runMacbeth(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  if (config.methodParams.fuzzyInputMode === 'Native fuzzy MACBETH-style') return runFuzzyMacbeth(input, config, method);
  const criteria = resolveCriteria(input, config);
  const scale = parseNumberList(config.methodParams.macbethCategoryScale, 7, 0)
    .map((value) => Math.max(0, value));
  const monotoneScale = scale.map((value, index) => Math.max(value, index ? scale[index - 1] : 0));
  const maxScale = Math.max(...monotoneScale, 1);
  const normalizedScale = monotoneScale.map((value) => value / maxScale);
  const normalized = minMaxNormalize({ ...input, criteria });
  const categoryIndexes = normalized.map((row) => row.map((value) => Math.min(normalizedScale.length - 1, Math.max(0, Math.round(value * (normalizedScale.length - 1))))));
  const valueMatrix = categoryIndexes.map((row) => row.map((categoryIndex) => normalizedScale[categoryIndex]));
  const weightedValueMatrix = weighted(valueMatrix, criteria);
  const scores = weightedValueMatrix.map((row) => row.reduce((sum, value) => sum + value, 0));
  return result(method, { ...input, criteria }, [
    {
      id: 'macbeth-category-scale',
      title: 'MACBETH Categorical Value Anchors',
      columns: ['Category', 'Qualitative difference', 'Configured anchor', 'Normalized value'],
      rows: ['No', 'Very weak', 'Weak', 'Moderate', 'Strong', 'Very strong', 'Extreme'].map((label, index) => [index, label, round(monotoneScale[index] ?? index), round(normalizedScale[index] ?? 0)]),
    },
    tableFromMatrix('macbeth-normalized-performance', 'MACBETH Normalized Performance', normalized, input),
    {
      id: 'macbeth-category-index',
      title: 'MACBETH Assigned Attractiveness Categories',
      columns: ['Alternative', ...criteria.map((criterion) => criterion.id)],
      rows: categoryIndexes.map((row, index) => [input.alternatives[index].name, ...row]),
    },
    tableFromMatrix('macbeth-value-matrix', 'MACBETH Value Matrix', valueMatrix, input),
    tableFromMatrix('macbeth-weighted-values', 'MACBETH Weighted Value Matrix', weightedValueMatrix, input),
    {
      id: 'macbeth-scores',
      title: 'MACBETH Overall Value Scores',
      columns: ['Alternative', 'Overall additive value'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, round(scores[index])]),
    },
  ], scores, 'MACBETH-style scoring converts qualitative difference-of-attractiveness anchors into a normalized value scale, assigns each criterion performance to a categorical value level, and aggregates additive value scores. This implementation is transparent categorical value scoring; full interactive MACBETH linear-programming elicitation remains a future extension.');
}

function runFuzzyMacbeth(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  const criteria = normalizeWeights(resolveCriteria(input, config));
  const fuzzyMatrix = activeFuzzyMatrix(input);
  const scale = parseNumberList(config.methodParams.macbethCategoryScale, 7, 0).map((value) => Math.max(0, value));
  const monotoneScale = scale.map((value, index) => Math.max(value, index ? scale[index - 1] : 0));
  const maxScale = Math.max(...monotoneScale, 1);
  const normalizedScale = monotoneScale.map((value) => value / maxScale);
  const normalized = fuzzyRangeNormalizeMatrix(fuzzyMatrix, criteria);
  const categoryIndexes = normalized.map((row) => row.map((value) => Math.min(normalizedScale.length - 1, Math.max(0, Math.round(defuzzify(value) * (normalizedScale.length - 1))))));
  const valueMatrix = categoryIndexes.map((row) => row.map((categoryIndex) => normalizedScale[categoryIndex]));
  const weightedValueMatrix = weighted(valueMatrix, criteria);
  const scores = weightedValueMatrix.map((row) => row.reduce((sum, value) => sum + value, 0));
  const analysis = result(method, { ...input, criteria, fuzzyValues: fuzzyMatrix }, [
    { id: 'fuzzy-macbeth-category-scale', title: 'Fuzzy MACBETH Categorical Value Anchors', columns: ['Category', 'Qualitative difference', 'Configured anchor', 'Normalized value'], rows: ['No', 'Very weak', 'Weak', 'Moderate', 'Strong', 'Very strong', 'Extreme'].map((label, index) => [index, label, round(monotoneScale[index] ?? index), round(normalizedScale[index] ?? 0)]) },
    fuzzyDecisionMatrixRows('Fuzzy MACBETH Normalized Performance', 'fuzzy-macbeth-normalized-performance', normalized, input),
    { id: 'fuzzy-macbeth-category-index', title: 'Fuzzy MACBETH Assigned Attractiveness Categories', columns: ['Alternative', ...criteria.map((criterion) => criterion.id)], rows: categoryIndexes.map((row, index) => [input.alternatives[index].name, ...row]) },
    tableFromMatrix('fuzzy-macbeth-value-matrix', 'Fuzzy MACBETH Value Matrix', valueMatrix, input),
    tableFromMatrix('fuzzy-macbeth-weighted-values', 'Fuzzy MACBETH Weighted Value Matrix', weightedValueMatrix, { ...input, criteria }),
    { id: 'fuzzy-macbeth-scores', title: 'Fuzzy MACBETH Overall Value Scores', columns: ['Alternative', 'Overall additive value'], rows: input.alternatives.map((alternative, index) => [alternative.name, round(scores[index])]) },
  ], scores, 'Native fuzzy MACBETH-style scoring preserves fuzzy normalized values, assigns categories from centroid-projected attractiveness, and aggregates additive value scores. Full interactive MACBETH elicitation remains a future extension.');
  return fuzzyStandardDiagnostic(method, analysis, 'Fuzzy normalized values mapped to monotone categorical attractiveness anchors.');
}

function runPugh(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  if (config.methodParams.fuzzyInputMode === 'Native fuzzy Pugh Matrix') {
    return runFuzzyPugh(input, config, method);
  }
  const criteria = resolveCriteria(input, config);
  const baselineId = String(config.methodParams.pughBaselineAlternative ?? input.alternatives[0]?.id ?? '');
  const baselineIndex = Math.max(0, input.alternatives.findIndex((alternative) => alternative.id === baselineId));
  const tolerance = Math.max(0, Number(config.methodParams.pughIndifferenceTolerance ?? 0) || 0);
  const scoringMode = String(config.methodParams.pughScoringMode ?? 'Compare performance to baseline');
  const scoreTransform = String(config.methodParams.pughScoreTransform ?? 'Raw uploaded scores');
  const usesUploadedScores = scoringMode === 'Use uploaded Pugh scores';
  const pughScores = usesUploadedScores
    ? input.values.map((row) => row.map((value) => Number.isFinite(value) ? value : 0))
    : input.values.map((row, rowIndex) => row.map((value, column) => {
      if (rowIndex === baselineIndex) return 0;
      const baseline = input.values[baselineIndex][column];
      const directionalDifference = criteria[column].direction === 'benefit' ? value - baseline : baseline - value;
      if (Math.abs(directionalDifference) <= tolerance) return 0;
      return directionalDifference > 0 ? 1 : -1;
    }));
  const flatScores = pughScores.flat().filter(Number.isFinite);
  const globalMin = Math.min(...flatScores, 0);
  const globalMax = Math.max(...flatScores, 0);
  const transformedScores = usesUploadedScores && scoreTransform === 'Global 0-1 rescale'
    ? pughScores.map((row) => row.map((value) => globalMax === globalMin ? 1 : (value - globalMin) / (globalMax - globalMin)))
    : pughScores;
  const weightedScores = weighted(transformedScores, criteria);
  const scores = weightedScores.map((row) => row.reduce((sum, value) => sum + value, 0));
  const plusMinusRows = input.alternatives.map((alternative, index) => [
    alternative.name,
    pughScores[index].filter((value) => value > 0).length,
    pughScores[index].filter((value) => value === 0).length,
    pughScores[index].filter((value) => value < 0).length,
    round(scores[index]),
    usesUploadedScores ? 'Uploaded Pugh score' : (index === baselineIndex ? 'Baseline/datum' : 'Compared against baseline'),
  ]);
  const tables = [
    {
      id: 'pugh-baseline',
      title: usesUploadedScores ? 'Pugh Uploaded Score Settings' : 'Pugh Baseline Concept',
      columns: ['Setting', 'Value'],
      rows: usesUploadedScores
        ? [['Scoring mode', scoringMode], ['Score transform', scoreTransform], ['Scoring rule', 'Uploaded values are treated as criterion-level Pugh scores']]
        : [['Baseline alternative', input.alternatives[baselineIndex]?.name ?? 'N/A'], ['Indifference tolerance', round(tolerance)], ['Scoring rule', 'Better = +1, Same = 0, Worse = -1']],
    },
    tableFromMatrix('pugh-relative-scores', 'Pugh Relative Scores', pughScores, input),
  ];
  if (usesUploadedScores && scoreTransform === 'Global 0-1 rescale') {
    tables.push({
      id: 'pugh-rescale-settings',
      title: 'Pugh Global Rescale Settings',
      columns: ['Setting', 'Value'],
      rows: [['Global minimum uploaded score', round(globalMin)], ['Global maximum uploaded score', round(globalMax)]],
    });
    tables.push(tableFromMatrix('pugh-transformed-scores', 'Pugh Globally Rescaled Scores', transformedScores, input));
  }
  tables.push(
    tableFromMatrix('pugh-weighted-scores', usesUploadedScores && scoreTransform === 'Global 0-1 rescale' ? 'Pugh Weighted Rescaled Scores' : 'Pugh Weighted Relative Scores', weightedScores, input),
    {
      id: 'pugh-summary',
      title: 'Pugh Plus/Minus Summary',
      columns: ['Alternative', 'Better count', 'Same count', 'Worse count', 'Weighted net score', 'Role'],
      rows: plusMinusRows,
    },
  );
  return result(method, { ...input, criteria }, [
    ...tables,
  ], scores, usesUploadedScores
    ? 'Pugh concept selection aggregates uploaded criterion-level Pugh scores. When global 0-1 rescaling is selected, the full uploaded score range is mapped to a common value scale before weighted aggregation.'
    : 'Pugh concept selection compares each alternative against a selected baseline concept criterion by criterion. Scores are +1 for better, 0 for same, and -1 for worse, then weighted and summed to identify concepts that improve on the datum.');
}

function runFuzzyPugh(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  const fuzzyMatrix = activeFuzzyMatrix(input);
  const centroidInput = { ...input, values: fuzzyMatrix.map((row) => row.map(defuzzify)), fuzzyValues: fuzzyMatrix };
  const criteria = normalizeWeights(resolveCriteria(centroidInput, config));
  const baselineId = String(config.methodParams.pughBaselineAlternative ?? input.alternatives[0]?.id ?? '');
  const baselineIndex = Math.max(0, input.alternatives.findIndex((alternative) => alternative.id === baselineId));
  const tolerance = Math.max(0, Number(config.methodParams.pughIndifferenceTolerance ?? 0) || 0);
  const scoringMode = String(config.methodParams.pughScoringMode ?? 'Compare performance to baseline');
  const scoreTransform = String(config.methodParams.pughScoreTransform ?? 'Raw uploaded scores');
  const usesUploadedScores = scoringMode === 'Use uploaded Pugh scores';
  const fuzzyScores = usesUploadedScores
    ? fuzzyMatrix
    : fuzzyMatrix.map((row, rowIndex) => row.map((value, column) => {
      if (rowIndex === baselineIndex) return crispFuzzy(0);
      const baseline = fuzzyMatrix[baselineIndex][column];
      const directionalDifference = criteria[column].direction === 'benefit'
        ? defuzzify(value) - defuzzify(baseline)
        : defuzzify(baseline) - defuzzify(value);
      if (Math.abs(directionalDifference) <= tolerance) return crispFuzzy(0);
      return crispFuzzy(directionalDifference > 0 ? 1 : -1);
    }));
  const flatScores = fuzzyScores.flat().map(defuzzify).filter(Number.isFinite);
  const globalMin = Math.min(...flatScores, 0);
  const globalMax = Math.max(...flatScores, 0);
  const transformedScores = usesUploadedScores && scoreTransform === 'Global 0-1 rescale'
    ? fuzzyScores.map((row) => row.map((value) => {
      if (globalMax === globalMin) return crispFuzzy(1);
      const mapped = value.values.map((cell) => (cell - globalMin) / (globalMax - globalMin)).sort((a, b) => a - b);
      return { values: mapped, type: value.type } as FuzzyNumber;
    }))
    : fuzzyScores;
  const weightedScores = transformedScores.map((row) => row.map((value, column) => scaleFuzzy(value, criteria[column].weight)));
  const scores = weightedScores.map((row) => row.reduce((sum, value) => sum + defuzzify(value), 0));
  const plusMinusRows = input.alternatives.map((alternative, index) => [
    alternative.name,
    fuzzyScores[index].filter((value) => defuzzify(value) > 0).length,
    fuzzyScores[index].filter((value) => defuzzify(value) === 0).length,
    fuzzyScores[index].filter((value) => defuzzify(value) < 0).length,
    round(scores[index]),
    usesUploadedScores ? 'Uploaded fuzzy Pugh score' : (index === baselineIndex ? 'Baseline/datum' : 'Compared against baseline'),
  ]);
  const analysis = result(method, { ...centroidInput, criteria }, [
    {
      id: 'fuzzy-pugh-baseline',
      title: usesUploadedScores ? 'Fuzzy Pugh Uploaded Score Settings' : 'Fuzzy Pugh Baseline Concept',
      columns: ['Setting', 'Value'],
      rows: usesUploadedScores
        ? [['Scoring mode', scoringMode], ['Score transform', scoreTransform], ['Scoring rule', 'Uploaded fuzzy values are treated as criterion-level Pugh scores']]
        : [['Baseline alternative', input.alternatives[baselineIndex]?.name ?? 'N/A'], ['Indifference tolerance', round(tolerance)], ['Scoring rule', 'Centroid better = +1, same = 0, worse = -1']],
    },
    fuzzyDecisionMatrixRows('Fuzzy Pugh Relative Scores', 'fuzzy-pugh-relative-scores', fuzzyScores, input),
    fuzzyDecisionMatrixRows('Fuzzy Pugh Transformed Scores', 'fuzzy-pugh-transformed-scores', transformedScores, input),
    fuzzyDecisionMatrixRows('Fuzzy Pugh Weighted Scores', 'fuzzy-pugh-weighted-scores', weightedScores, input),
    {
      id: 'fuzzy-pugh-plus-minus',
      title: 'Fuzzy Pugh Plus/Minus Summary',
      columns: ['Alternative', 'Plus criteria', 'Same criteria', 'Minus criteria', 'Weighted total', 'Role'],
      rows: plusMinusRows,
    },
  ], scores, usesUploadedScores
    ? 'Native fuzzy Pugh Matrix preserves uploaded fuzzy criterion scores, optionally rescales them, applies weights, and ranks concepts by centroid weighted total.'
    : 'Native fuzzy Pugh Matrix compares fuzzy concept values to the baseline by centroid, assigns plus/same/minus scores, applies weights, and ranks by weighted advantage.');
  analysis.diagnostics.push({ label: 'Native fuzzy Pugh Matrix', value: 'Fuzzy score matrix preserved with centroid qualitative comparison/scoring', status: 'pass' });
  analysis.reproducibility = { ...analysis.reproducibility, fuzzyMode: 'Native fuzzy Pugh Matrix', fuzzyPugh: 'Fuzzy uploaded or baseline-derived score matrix, weighted centroid total', scoringMode, scoreTransform };
  return analysis;
}

function runFuzzySmart(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  const criteria = resolveCriteria(input, config);
  const fuzzyMatrix = input.fuzzyValues?.length
    ? input.fuzzyValues
    : input.values.map((row) => row.map((value) => crispFuzzy(value)));
  const normalizedCriteria = normalizeWeights(criteria);
  const utilities = fuzzyMatrix.map((row) => row.map((value, column) => {
    const columnValues = fuzzyMatrix.map((item) => item[column]);
    if (criteria[column].direction === 'cost') {
      const minLower = Math.min(...columnValues.map((item) => item.values[0]).filter(Number.isFinite));
      return { values: value.values.map((cell) => minLower / Math.max(cell, 1e-9)).reverse(), type: value.type } as FuzzyNumber;
    }
    const maxUpper = Math.max(...columnValues.map((item) => item.values[item.values.length - 1]).filter(Number.isFinite), 1e-9);
    return { values: value.values.map((cell) => cell / maxUpper), type: value.type };
  }));
  const weightedFuzzy = utilities.map((row) => row.map((value, column) => scaleFuzzy(value, normalizedCriteria[column].weight)));
  const scores = weightedFuzzy.map((row) => row.reduce((sum, value) => sum + defuzzify(value), 0));
  const analysis = result(method, { ...input, criteria: normalizedCriteria, fuzzyValues: fuzzyMatrix }, [
    {
      id: 'fuzzy-smart-utilities',
      title: 'Fuzzy SMART Single-Attribute Utilities',
      columns: ['Alternative', ...criteria.map((criterion) => criterion.id)],
      rows: utilities.map((row, index) => [input.alternatives[index].name, ...row.map((value) => fuzzyLabel(value))]),
    },
    {
      id: 'fuzzy-smart-weighted-utilities',
      title: 'Fuzzy SMART Weighted Utilities',
      columns: ['Alternative', ...criteria.map((criterion) => criterion.id)],
      rows: weightedFuzzy.map((row, index) => [input.alternatives[index].name, ...row.map((value) => fuzzyLabel(value))]),
    },
    {
      id: 'fuzzy-smart-scores',
      title: 'Fuzzy SMART Utility Scores',
      columns: ['Alternative', 'Total utility score'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, round(scores[index])]),
    },
  ], scores, 'Native fuzzy SMART preserves triangular/trapezoidal uploaded values through fuzzy utility normalization and weighting, then ranks alternatives by centroid total utility.');
  analysis.diagnostics.push({ label: 'Native fuzzy SMART', value: 'Fuzzy single-attribute utilities with centroid total utility scoring', status: 'pass' });
  analysis.reproducibility = { ...analysis.reproducibility, fuzzyMode: 'Native fuzzy SMART', fuzzySmart: 'Fuzzy utility normalization/weighting with centroid additive utility score' };
  return analysis;
}

function runMaut(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  if (config.methodParams.fuzzyInputMode === 'Native fuzzy MAUT') {
    return runFuzzyMaut(input, config, method);
  }
  const criteria = resolveCriteria(input, config);
  const normalization = String(config.methodParams.normalization ?? config.methodParams.mautUtilityScaling ?? 'Linear utility');
  const utilities = normalization === 'Input values are utilities'
    ? input.values
    : minMaxNormalize({ ...input, criteria });
  const riskAttitude = String(config.methodParams.mautUtilityShape ?? 'Linear');
  const shapedUtilities = utilities.map((row) => row.map((value) => riskAttitude === 'Concave' ? Math.sqrt(Math.max(value, 0)) : riskAttitude === 'Convex' ? value ** 2 : value));
  const weightedUtilities = weighted(shapedUtilities, criteria);
  const scores = weightedUtilities.map((row) => row.reduce((sum, value) => sum + value, 0));
  return result(method, { ...input, criteria }, [
    tableFromMatrix('utilities', 'MAUT Utility Matrix', shapedUtilities, input),
    tableFromMatrix('weighted-utilities', 'MAUT Weighted Utility Matrix', weightedUtilities, input),
  ], scores, 'MAUT aggregates single-attribute utility functions into a total multi-attribute utility score.');
}

function runFuzzyMaut(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  const criteria = resolveCriteria(input, config);
  const fuzzyMatrix = input.fuzzyValues?.length
    ? input.fuzzyValues
    : input.values.map((row) => row.map((value) => crispFuzzy(value)));
  const normalizedCriteria = normalizeWeights(criteria);
  const riskAttitude = String(config.methodParams.mautUtilityShape ?? 'Linear');
  const utilities = fuzzyMatrix.map((row) => row.map((value, column) => {
    const columnValues = fuzzyMatrix.map((item) => item[column]);
    if (criteria[column].direction === 'cost') {
      const minLower = Math.min(...columnValues.map((item) => item.values[0]).filter(Number.isFinite));
      return { values: value.values.map((cell) => minLower / Math.max(cell, 1e-9)).reverse(), type: value.type } as FuzzyNumber;
    }
    const maxUpper = Math.max(...columnValues.map((item) => item.values[item.values.length - 1]).filter(Number.isFinite), 1e-9);
    return { values: value.values.map((cell) => cell / maxUpper), type: value.type };
  }));
  const shapedUtilities = utilities.map((row) => row.map((value) => ({
    values: value.values.map((cell) => riskAttitude === 'Concave' ? Math.sqrt(Math.max(cell, 0)) : riskAttitude === 'Convex' ? cell ** 2 : cell),
    type: value.type,
  } as FuzzyNumber)));
  const weightedFuzzy = shapedUtilities.map((row) => row.map((value, column) => scaleFuzzy(value, normalizedCriteria[column].weight)));
  const scores = weightedFuzzy.map((row) => row.reduce((sum, value) => sum + defuzzify(value), 0));
  const analysis = result(method, { ...input, criteria: normalizedCriteria, fuzzyValues: fuzzyMatrix }, [
    {
      id: 'fuzzy-maut-utilities',
      title: 'Fuzzy MAUT Utility Matrix',
      columns: ['Alternative', ...criteria.map((criterion) => criterion.id)],
      rows: utilities.map((row, index) => [input.alternatives[index].name, ...row.map((value) => fuzzyLabel(value))]),
    },
    {
      id: 'fuzzy-maut-shaped-utilities',
      title: 'Fuzzy MAUT Shaped Utility Matrix',
      columns: ['Alternative', ...criteria.map((criterion) => criterion.id)],
      rows: shapedUtilities.map((row, index) => [input.alternatives[index].name, ...row.map((value) => fuzzyLabel(value))]),
    },
    {
      id: 'fuzzy-maut-weighted-utilities',
      title: 'Fuzzy MAUT Weighted Utility Matrix',
      columns: ['Alternative', ...criteria.map((criterion) => criterion.id)],
      rows: weightedFuzzy.map((row, index) => [input.alternatives[index].name, ...row.map((value) => fuzzyLabel(value))]),
    },
    {
      id: 'fuzzy-maut-scores',
      title: 'Fuzzy MAUT Total Utility Scores',
      columns: ['Alternative', 'Utility shape', 'Total utility score'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, riskAttitude, round(scores[index])]),
    },
  ], scores, 'Native fuzzy MAUT preserves triangular/trapezoidal uploaded values through fuzzy utility normalization, applies the selected utility shape component-wise, and ranks alternatives by centroid total multi-attribute utility.');
  analysis.diagnostics.push({ label: 'Native fuzzy MAUT', value: `${riskAttitude} fuzzy utility shape with centroid total utility scoring`, status: 'pass' });
  analysis.reproducibility = { ...analysis.reproducibility, fuzzyMode: 'Native fuzzy MAUT', fuzzyMaut: 'Fuzzy utility normalization, component-wise utility shaping, fuzzy weighting, centroid total utility', utilityShape: riskAttitude };
  return analysis;
}

function runOcra(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  if (config.methodParams.fuzzyInputMode === 'Native fuzzy OCRA') {
    return runFuzzyOcra(input, config, method);
  }
  const criteria = resolveCriteria(input, config);
  const normalizedCriteria = normalizeWeights(criteria);
  const columns = normalizedCriteria.map((_, column) => input.values.map((row) => row[column]));
  const minValues = columns.map((values) => Math.min(...values));
  const maxValues = columns.map((values) => Math.max(...values));
  const preferenceTerms = input.values.map((row) => row.map((value, column) => {
    const min = Math.max(minValues[column], 1e-9);
    const max = maxValues[column];
    const weight = normalizedCriteria[column].weight;
    return normalizedCriteria[column].direction === 'cost'
      ? weight * ((max - value) / min)
      : weight * ((value - min) / min);
  }));
  const beneficial = preferenceTerms.map((row) => row.reduce((sum, value, column) => sum + (normalizedCriteria[column].direction === 'benefit' ? value : 0), 0));
  const nonBeneficial = preferenceTerms.map((row) => row.reduce((sum, value, column) => sum + (normalizedCriteria[column].direction === 'cost' ? value : 0), 0));
  const totalPreference = beneficial.map((value, index) => value + nonBeneficial[index]);
  const minTotal = Math.min(...totalPreference);
  const preference = totalPreference.map((value) => value - minTotal);
  return result(method, { ...input, criteria }, [
    tableFromMatrix('weighted', 'OCRA Weighted Preference-Term Matrix', preferenceTerms, input),
    { id: 'ocra-components', title: 'OCRA Preference Components', columns: ['Alternative', 'Benefit preference', 'Cost preference', 'Total preference', 'Shifted OCRA score'], rows: input.alternatives.map((alternative, index) => [alternative.name, round(beneficial[index]), round(nonBeneficial[index]), round(totalPreference[index]), round(preference[index])]) },
  ], preference, 'OCRA evaluates operational competitiveness through separated benefit and cost relative-distance preference ratings.');
}

function runFuzzyOcra(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  const criteria = resolveCriteria(input, config);
  const fuzzyMatrix = input.fuzzyValues?.length
    ? input.fuzzyValues
    : input.values.map((row) => row.map((value) => crispFuzzy(value)));
  const normalizedCriteria = normalizeWeights(criteria);
  const normalized = fuzzyMatrix.map((row) => row.map((value, column) => {
    const columnValues = fuzzyMatrix.map((item) => item[column]);
    if (criteria[column].direction === 'cost') {
      const minLower = Math.min(...columnValues.map((item) => item.values[0]).filter(Number.isFinite));
      return { values: value.values.map((cell) => minLower / Math.max(cell, 1e-9)).reverse(), type: value.type } as FuzzyNumber;
    }
    const maxUpper = Math.max(...columnValues.map((item) => item.values[item.values.length - 1]).filter(Number.isFinite), 1e-9);
    return { values: value.values.map((cell) => cell / maxUpper), type: value.type };
  }));
  const weightedFuzzy = normalized.map((row) => row.map((value, column) => scaleFuzzy(value, normalizedCriteria[column].weight)));
  const weightedCrisp = weightedFuzzy.map((row) => row.map(defuzzify));
  const beneficial = weightedCrisp.map((row) => row.reduce((sum, value, column) => sum + (normalizedCriteria[column].direction === 'benefit' ? value : 0), 0));
  const nonBeneficial = weightedCrisp.map((row) => row.reduce((sum, value, column) => sum + (normalizedCriteria[column].direction === 'cost' ? value : 0), 0));
  const minBenefit = Math.min(...beneficial);
  const minCost = Math.min(...nonBeneficial);
  const preference = beneficial.map((value, index) => (value - minBenefit) + (nonBeneficial[index] - minCost));
  const analysis = result(method, { ...input, criteria: normalizedCriteria, fuzzyValues: fuzzyMatrix }, [
    {
      id: 'fuzzy-ocra-normalized',
      title: 'Fuzzy OCRA Normalized Matrix',
      columns: ['Alternative', ...criteria.map((criterion) => criterion.id)],
      rows: normalized.map((row, index) => [input.alternatives[index].name, ...row.map((value) => fuzzyLabel(value))]),
    },
    {
      id: 'fuzzy-ocra-weighted',
      title: 'Fuzzy OCRA Weighted Performance Matrix',
      columns: ['Alternative', ...criteria.map((criterion) => criterion.id)],
      rows: weightedFuzzy.map((row, index) => [input.alternatives[index].name, ...row.map((value) => fuzzyLabel(value))]),
    },
    {
      id: 'fuzzy-ocra-components',
      title: 'Fuzzy OCRA Preference Components',
      columns: ['Alternative', 'Benefit preference', 'Cost preference', 'Overall preference'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, round(beneficial[index] - minBenefit), round(nonBeneficial[index] - minCost), round(preference[index])]),
    },
  ], preference, 'Native fuzzy OCRA preserves triangular/trapezoidal uploaded values through fuzzy normalization and weighting, then evaluates operational competitiveness through centroid benefit and cost preference components.');
  analysis.diagnostics.push({ label: 'Native fuzzy OCRA', value: 'Fuzzy weighted benefit/cost preference components', status: 'pass' });
  analysis.reproducibility = { ...analysis.reproducibility, fuzzyMode: 'Native fuzzy OCRA', fuzzyOcra: 'Fuzzy normalization/weighting with centroid benefit and cost preference ratings' };
  return analysis;
}

function runMultimoora(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  if (config.methodParams.fuzzyInputMode === 'Native fuzzy MULTIMOORA') {
    return runFuzzyMultimoora(input, config, method);
  }
  const criteria = resolveCriteria(input, config);
  const ratio = vectorNormalize(input.values);
  const weightedRatio = weighted(ratio, criteria);
  const ratioScores = weightedRatio.map((row) => row.reduce((sum, value, column) => sum + (criteria[column].direction === 'benefit' ? value : -value), 0));
  const reference = criteria.map((criterion, column) => criterion.direction === 'benefit' ? Math.max(...weightedRatio.map((row) => row[column])) : Math.min(...weightedRatio.map((row) => row[column])));
  const referenceScores = weightedRatio.map((row) => Math.max(...row.map((value, column) => Math.abs(reference[column] - value))));
  const multiplicative = minMaxNormalize({ ...input, criteria }).map((row) => {
    const benefitProduct = row.reduce((product, value, column) => criteria[column].direction === 'benefit' ? product * Math.max(value, 1e-9) ** criteria[column].weight : product, 1);
    const costProduct = row.reduce((product, value, column) => criteria[column].direction === 'cost' ? product * Math.max(value, 1e-9) ** criteria[column].weight : product, 1);
    return benefitProduct / (costProduct || 1);
  });
  const ratioRanks = rankScores(ratioScores, { ...input, criteria });
  const referenceRanks = rankScores(referenceScores, { ...input, criteria }, false);
  const multiplicativeRanks = rankScores(multiplicative, { ...input, criteria });
  const componentRanks = input.alternatives.map((alternative) => {
    const ratioRank = ratioRanks.find((row) => row.alternativeId === alternative.id)?.rank ?? input.alternatives.length;
    const referenceRank = referenceRanks.find((row) => row.alternativeId === alternative.id)?.rank ?? input.alternatives.length;
    const multiplicativeRank = multiplicativeRanks.find((row) => row.alternativeId === alternative.id)?.rank ?? input.alternatives.length;
    return { ratioRank, referenceRank, multiplicativeRank };
  });
  const rankSumScores = componentRanks.map(({ ratioRank, referenceRank, multiplicativeRank }) => -(ratioRank + referenceRank + multiplicativeRank));
  const aggregationMode = String(config.methodParams.multimooraAggregation ?? '').trim() || 'Dominance theory';
  const usesDominance = aggregationMode === 'Dominance theory';
  const dominanceScores = componentRanks.map((ranks, rowIndex) => componentRanks.reduce((score, otherRanks, otherIndex) => {
    if (rowIndex === otherIndex) return score;
    const wins = [
      ranks.ratioRank < otherRanks.ratioRank,
      ranks.referenceRank < otherRanks.referenceRank,
      ranks.multiplicativeRank < otherRanks.multiplicativeRank,
    ].filter(Boolean).length;
    const losses = [
      ranks.ratioRank > otherRanks.ratioRank,
      ranks.referenceRank > otherRanks.referenceRank,
      ranks.multiplicativeRank > otherRanks.multiplicativeRank,
    ].filter(Boolean).length;
    if (wins > losses) return score + 1;
    if (losses > wins) return score - 1;
    return score;
  }, 0));
  const scores = usesDominance ? dominanceScores : rankSumScores;
  const rankSums = componentRanks.map(({ ratioRank, referenceRank, multiplicativeRank }) =>
    ratioRank + referenceRank + multiplicativeRank,
  );
  const analysis = result(method, { ...input, criteria }, [
    tableFromMatrix('ratio', 'MULTIMOORA Ratio Matrix', ratio, input),
    {
      id: 'multimoora-components',
      title: 'MULTIMOORA Component Scores',
      columns: ['Alternative', 'Ratio score', 'Reference distance', 'Multiplicative score', 'Ratio rank', 'Reference rank', 'Multiplicative rank', 'Rank sum', 'Dominance score'],
      rows: input.alternatives.map((alternative, index) => [
        alternative.name,
        round(ratioScores[index]),
        round(referenceScores[index]),
        round(multiplicative[index]),
        componentRanks[index].ratioRank,
        componentRanks[index].referenceRank,
        componentRanks[index].multiplicativeRank,
        rankSums[index],
        dominanceScores[index],
      ]),
    },
  ], scores, usesDominance
    ? 'MULTIMOORA combines ratio system, reference point, and full multiplicative form rankings using pairwise dominance theory.'
    : 'MULTIMOORA combines ratio system, reference point, and full multiplicative form rankings using rank-sum aggregation.');
  analysis.diagnostics.push({ label: 'MULTIMOORA aggregation', value: usesDominance ? 'Dominance theory' : 'Rank sum', status: 'pass' });
  analysis.reproducibility = { ...analysis.reproducibility, multimooraAggregation: usesDominance ? 'Dominance theory' : 'Rank sum' };
  return analysis;
}

function runFuzzyMultimoora(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  const criteria = resolveCriteria(input, config);
  const fuzzyMatrix = input.fuzzyValues?.length
    ? input.fuzzyValues
    : input.values.map((row) => row.map((value) => crispFuzzy(value)));
  const denominators = criteria.map((_, column) =>
    Math.sqrt(fuzzyMatrix.reduce((sum, row) => sum + defuzzify(row[column]) ** 2, 0)) || 1,
  );
  const fuzzyRatio = fuzzyMatrix.map((row) => row.map((value, column) => divideFuzzyByScalar(value, denominators[column])));
  const weightedRatio = fuzzyRatio.map((row) => row.map((value, column) => scaleFuzzy(value, criteria[column].weight)));
  const ratioScores = weightedRatio.map((row) => row.reduce((sum, value, column) => sum + (criteria[column].direction === 'benefit' ? defuzzify(value) : -defuzzify(value)), 0));
  const reference = criteria.map((criterion, column) => {
    const columnValues = weightedRatio.map((row) => row[column]);
    return columnValues.reduce((best, value) => {
      const current = defuzzify(value);
      const selected = defuzzify(best);
      return criterion.direction === 'benefit'
        ? (current > selected ? value : best)
        : (current < selected ? value : best);
    }, columnValues[0]);
  });
  const referenceScores = weightedRatio.map((row) => Math.max(...row.map((value, column) => fuzzyDistance(reference[column], value))));
  const normalized = fuzzyMatrix.map((row) => row.map((value, column) => {
    const crispValues = fuzzyMatrix.map((matrixRow) => defuzzify(matrixRow[column]));
    const min = Math.min(...crispValues);
    const max = Math.max(...crispValues);
    if (max === min) return crispFuzzy(1);
    const mapped = value.values.map((component) => {
      const clamped = Math.min(max, Math.max(min, component));
      return criteria[column].direction === 'benefit'
        ? clamped / (max || 1)
        : min / Math.max(clamped, 1e-9);
    }).sort((a, b) => a - b);
    return { values: mapped, type: value.type };
  }));
  const multiplicative = normalized.map((row) => {
    const benefitProduct = row.reduce((product, value, column) => criteria[column].direction === 'benefit' ? product * Math.max(defuzzify(value), 1e-9) ** criteria[column].weight : product, 1);
    const costProduct = row.reduce((product, value, column) => criteria[column].direction === 'cost' ? product * Math.max(defuzzify(value), 1e-9) ** criteria[column].weight : product, 1);
    return benefitProduct / (costProduct || 1);
  });
  const ratioRanks = rankScores(ratioScores, { ...input, criteria });
  const referenceRanks = rankScores(referenceScores, { ...input, criteria }, false);
  const multiplicativeRanks = rankScores(multiplicative, { ...input, criteria });
  const scores = input.alternatives.map((alternative) => {
    const r1 = ratioRanks.find((row) => row.alternativeId === alternative.id)?.rank ?? input.alternatives.length;
    const r2 = referenceRanks.find((row) => row.alternativeId === alternative.id)?.rank ?? input.alternatives.length;
    const r3 = multiplicativeRanks.find((row) => row.alternativeId === alternative.id)?.rank ?? input.alternatives.length;
    return -(r1 + r2 + r3);
  });
  const analysis = result(method, { ...input, criteria, fuzzyValues: fuzzyMatrix }, [
    {
      id: 'fuzzy-multimoora-ratio',
      title: 'Fuzzy MULTIMOORA Ratio Matrix',
      columns: ['Alternative', ...criteria.map((criterion) => criterion.id)],
      rows: fuzzyRatio.map((row, index) => [input.alternatives[index].name, ...row.map((value) => fuzzyLabel(value))]),
    },
    {
      id: 'fuzzy-multimoora-weighted-ratio',
      title: 'Fuzzy MULTIMOORA Weighted Ratio Matrix',
      columns: ['Alternative', ...criteria.map((criterion) => criterion.id)],
      rows: weightedRatio.map((row, index) => [input.alternatives[index].name, ...row.map((value) => fuzzyLabel(value))]),
    },
    {
      id: 'fuzzy-multimoora-reference',
      title: 'Fuzzy MULTIMOORA Reference Point',
      columns: ['Reference', ...criteria.map((criterion) => criterion.id)],
      rows: [['Reference point', ...reference.map((value) => fuzzyLabel(value))]],
    },
    {
      id: 'fuzzy-multimoora-components',
      title: 'Fuzzy MULTIMOORA Component Scores',
      columns: ['Alternative', 'Ratio score', 'Reference distance', 'Multiplicative score', 'Rank sum'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, round(ratioScores[index]), round(referenceScores[index]), round(multiplicative[index]), -scores[index]]),
    },
  ], scores, 'Native fuzzy MULTIMOORA preserves triangular/trapezoidal uploaded values through fuzzy ratio normalization, fuzzy reference-point distance, and defuzzified multiplicative utility before combining component ranks.');
  analysis.diagnostics.push({ label: 'Native fuzzy MULTIMOORA', value: 'Fuzzy ratio, reference point, and multiplicative components generated', status: 'pass' });
  analysis.reproducibility = { ...analysis.reproducibility, fuzzyMode: 'Native fuzzy MULTIMOORA', fuzzyMultimoora: 'Fuzzy ratio normalization/weighting, vertex-distance reference point, centroid multiplicative form, rank-sum aggregation' };
  return analysis;
}

function runPsi(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  if (config.methodParams.fuzzyInputMode === 'Native fuzzy PSI') {
    return runFuzzyPsi(input, config, method);
  }
  const normalized = minMaxNormalize(input);
  const psiMode = String(config.methodParams.psiScoreMode ?? 'Criterion objective weights');
  if (psiMode === 'Alternative preference index') {
    const preferenceVariation = normalized.map((row) => {
      const mean = row.reduce((sum, value) => sum + value, 0) / row.length;
      return row.reduce((sum, value) => sum + (value - mean) ** 2, 0);
    });
    const preferenceValues = preferenceVariation.map((value) => 1 - value);
    const totalPreference = preferenceValues.reduce((sum, value) => sum + value, 0) || 1;
    const preferenceIndexes = preferenceValues.map((value) => value / totalPreference);
    const scores = normalized.map((row, index) => preferenceIndexes[index] * row.reduce((sum, value) => sum + value, 0));
    return result(method, input, [
      tableFromMatrix('normalized', 'PSI Normalized Matrix', normalized, input),
      { id: 'psi-preference-indexes', title: 'PSI Alternative Preference Indexes', columns: ['Alternative', 'Preference variation', 'Preference value', 'Preference index', 'Score'], rows: input.alternatives.map((alternative, index) => [alternative.name, round(preferenceVariation[index]), round(preferenceValues[index]), round(preferenceIndexes[index]), round(scores[index])]) },
    ], scores, 'PSI ranks alternatives by normalized alternative preference values and the resulting preference-selection score.');
  }
  const means = normalized[0].map((_, column) => normalized.reduce((sum, row) => sum + row[column], 0) / normalized.length);
  const variation = means.map((mean, column) => normalized.reduce((sum, row) => sum + (row[column] - mean) ** 2, 0));
  const deviation = variation.map((value) => 1 - value);
  const totalDeviation = deviation.reduce((sum, value) => sum + Math.max(value, 0), 0) || 1;
  const criteria = input.criteria.map((criterion, index) => ({ ...criterion, weight: Math.max(deviation[index], 0) / totalDeviation }));
  const weightedMatrix = weighted(normalized, criteria);
  const scores = weightedMatrix.map((row) => row.reduce((sum, value) => sum + value, 0));
  return result(method, { ...input, criteria }, [
    tableFromMatrix('normalized', 'PSI Normalized Matrix', normalized, input),
    { id: 'psi-weights', title: 'PSI Objective Weights', columns: ['Criterion', 'Mean', 'Variation', 'Preference value', 'Weight'], rows: criteria.map((criterion, index) => [criterion.id, round(means[index]), round(variation[index]), round(deviation[index]), round(criterion.weight)]) },
    tableFromMatrix('weighted', 'PSI Weighted Matrix', weightedMatrix, input),
  ], scores, 'PSI calculates objective preference-selection weights from normalized criterion variation and ranks alternatives by weighted preference score.');
}

function runFuzzyPsi(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  const criteria = resolveCriteria(input, config);
  const fuzzyMatrix = input.fuzzyValues?.length
    ? input.fuzzyValues
    : input.values.map((row) => row.map((value) => crispFuzzy(value)));
  const normalized = fuzzyMatrix.map((row) => row.map((value, column) => {
    const crispValues = fuzzyMatrix.map((matrixRow) => defuzzify(matrixRow[column]));
    const min = Math.min(...crispValues);
    const max = Math.max(...crispValues);
    if (max === min) return crispFuzzy(1);
    const mapped = value.values.map((component) => {
      const clamped = Math.min(max, Math.max(min, component));
      return criteria[column].direction === 'benefit'
        ? (clamped - min) / (max - min)
        : (max - clamped) / (max - min);
    }).sort((a, b) => a - b);
    return { values: mapped, type: value.type };
  }));
  const centroidNormalized = normalized.map((row) => row.map(defuzzify));
  const means = centroidNormalized[0].map((_, column) => centroidNormalized.reduce((sum, row) => sum + row[column], 0) / centroidNormalized.length);
  const variation = means.map((mean, column) => centroidNormalized.reduce((sum, row) => sum + (row[column] - mean) ** 2, 0));
  const deviation = variation.map((value) => 1 - value);
  const totalDeviation = deviation.reduce((sum, value) => sum + Math.max(value, 0), 0) || 1;
  const weightedCriteria = criteria.map((criterion, index) => ({ ...criterion, weight: Math.max(deviation[index], 0) / totalDeviation }));
  const weightedFuzzy = normalized.map((row) => row.map((value, column) => scaleFuzzy(value, weightedCriteria[column].weight)));
  const scores = weightedFuzzy.map((row) => row.reduce((sum, value) => sum + defuzzify(value), 0));
  const analysis = result(method, { ...input, criteria: weightedCriteria, fuzzyValues: fuzzyMatrix }, [
    {
      id: 'fuzzy-psi-normalized',
      title: 'Fuzzy PSI Normalized Matrix',
      columns: ['Alternative', ...weightedCriteria.map((criterion) => criterion.id)],
      rows: normalized.map((row, index) => [input.alternatives[index].name, ...row.map((value) => fuzzyLabel(value))]),
    },
    {
      id: 'fuzzy-psi-weights',
      title: 'Fuzzy PSI Objective Weights',
      columns: ['Criterion', 'Mean', 'Variation', 'Preference value', 'Weight'],
      rows: weightedCriteria.map((criterion, index) => [criterion.id, round(means[index]), round(variation[index]), round(deviation[index]), round(criterion.weight)]),
    },
    {
      id: 'fuzzy-psi-weighted',
      title: 'Fuzzy PSI Weighted Matrix',
      columns: ['Alternative', ...weightedCriteria.map((criterion) => criterion.id)],
      rows: weightedFuzzy.map((row, index) => [input.alternatives[index].name, ...row.map((value) => fuzzyLabel(value))]),
    },
    {
      id: 'fuzzy-psi-scores',
      title: 'Fuzzy PSI Final Scores',
      columns: ['Alternative', 'PSI score', 'Ranking rule'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, round(scores[index]), 'Higher is better']),
    },
  ], scores, 'Native fuzzy PSI preserves triangular/trapezoidal uploaded values through fuzzy normalization, derives objective weights from centroid variation, and ranks alternatives by centroid weighted preference score.');
  analysis.diagnostics.push({ label: 'Native fuzzy PSI', value: 'Fuzzy normalized matrix with objective PSI weights from centroid variation', status: 'pass' });
  analysis.reproducibility = { ...analysis.reproducibility, fuzzyMode: 'Native fuzzy PSI', fuzzyPsi: 'Fuzzy min-max normalization, centroid variation objective weights, fuzzy weighted preference score' };
  return analysis;
}

function runPiv(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  if (config.methodParams.fuzzyInputMode === 'Native fuzzy PIV') {
    return runFuzzyPiv(input, config, method);
  }
  const criteria = resolveCriteria(input, config);
  const normalized = vectorNormalize(input.values);
  const weightedMatrix = weighted(normalized, criteria);
  const best = criteria.map((criterion, column) => {
    const values = weightedMatrix.map((row) => row[column]);
    return criterion.direction === 'benefit' ? Math.max(...values) : Math.min(...values);
  });
  const proximityMatrix = weightedMatrix.map((row) => row.map((value, column) => Math.abs(best[column] - value)));
  const proximity = proximityMatrix.map((row) => row.reduce((sum, value) => sum + value, 0));
  return result(method, { ...input, criteria }, [
    tableFromMatrix('normalized', 'PIV Vector Normalized Matrix', normalized, input),
    tableFromMatrix('weighted', 'PIV Weighted Normalized Matrix', weightedMatrix, input),
    tableFromMatrix('piv-weighted-proximity', 'PIV Weighted Proximity Matrix', proximityMatrix, input),
    { id: 'piv-proximity', title: 'PIV Proximity Index Values', columns: ['Alternative', 'Proximity index'], rows: input.alternatives.map((alternative, index) => [alternative.name, round(proximity[index])]) },
  ], proximity, 'PIV ranks alternatives by the smallest proximity index from best weighted normalized criterion values.', false);
}

function runFuzzyPiv(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  const criteria = resolveCriteria(input, config);
  const fuzzyMatrix = input.fuzzyValues?.length
    ? input.fuzzyValues
    : input.values.map((row) => row.map((value) => crispFuzzy(value)));
  const normalizedCriteria = normalizeWeights(criteria);
  const normalized = fuzzyMatrix.map((row) => row.map((value, column) => {
    const columnValues = fuzzyMatrix.map((item) => item[column]);
    const componentCount = Math.max(...columnValues.map((item) => item.values.length), value.values.length);
    const denominators = Array.from({ length: componentCount }, (_, component) =>
      Math.sqrt(columnValues.reduce((sum, item) => sum + fuzzyComponentAt(item, component, componentCount) ** 2, 0)) || 1,
    );
    const ratioValues = Array.from({ length: componentCount }, (_, component) => fuzzyComponentAt(value, component, componentCount) / denominators[component]);
    return { values: ratioValues, type: componentCount === 4 ? 'trapezoidal' : value.type === 'crisp' ? 'crisp' : 'triangular' } as FuzzyNumber;
  }));
  const weightedFuzzy = normalized.map((row) => row.map((value, column) => scaleFuzzy(value, normalizedCriteria[column].weight)));
  const best = normalizedCriteria.map((criterion, column) => weightedFuzzy.map((row) => row[column]).reduce((currentBest, value) =>
    criterion.direction === 'benefit'
      ? defuzzify(value) > defuzzify(currentBest) ? value : currentBest
      : defuzzify(value) < defuzzify(currentBest) ? value : currentBest,
  ));
  const proximityMatrix = weightedFuzzy.map((row) => row.map((value, column) => fuzzyDistance(best[column], value)));
  const proximity = proximityMatrix.map((row) => row.reduce((sum, value) => sum + value, 0));
  const analysis = result(method, { ...input, criteria: normalizedCriteria, fuzzyValues: fuzzyMatrix }, [
    {
      id: 'fuzzy-piv-normalized',
      title: 'Fuzzy PIV Normalized Matrix',
      columns: ['Alternative', ...criteria.map((criterion) => criterion.id)],
      rows: normalized.map((row, index) => [input.alternatives[index].name, ...row.map((value) => fuzzyLabel(value))]),
    },
    {
      id: 'fuzzy-piv-weighted',
      title: 'Fuzzy PIV Weighted Normalized Matrix',
      columns: ['Alternative', ...criteria.map((criterion) => criterion.id)],
      rows: weightedFuzzy.map((row, index) => [input.alternatives[index].name, ...row.map((value) => fuzzyLabel(value))]),
    },
    {
      id: 'fuzzy-piv-best',
      title: 'Fuzzy PIV Best Weighted Values',
      columns: ['Reference', ...criteria.map((criterion) => criterion.id)],
      rows: [['Best', ...best.map((value) => fuzzyLabel(value))]],
    },
    tableFromMatrix('fuzzy-piv-weighted-proximity', 'Fuzzy PIV Weighted Proximity Matrix', proximityMatrix, input),
    {
      id: 'fuzzy-piv-proximity',
      title: 'Fuzzy PIV Proximity Index Values',
      columns: ['Alternative', 'Proximity index'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, round(proximity[index])]),
    },
  ], proximity, 'Native fuzzy PIV preserves triangular/trapezoidal uploaded values through fuzzy vector normalization and weighting, then ranks alternatives by the smallest fuzzy-distance proximity index from best weighted criterion values.', false);
  analysis.diagnostics.push({ label: 'Native fuzzy PIV', value: 'Fuzzy weighted proximity indices calculated from best weighted values', status: 'pass' });
  analysis.reproducibility = { ...analysis.reproducibility, fuzzyMode: 'Native fuzzy PIV', fuzzyPiv: 'Fuzzy vector normalization, fuzzy weighted best values, vertex-distance proximity index' };
  return analysis;
}

function runRov(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  if (config.methodParams.fuzzyInputMode === 'Native fuzzy ROV') {
    return runFuzzyRov(input, config, method);
  }
  const criteria = resolveCriteria(input, config);
  const normalized = input.values.map((row) => row.map((value, column) => {
    const values = input.values.map((item) => item[column]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (max === min) return 1;
    return criteria[column].direction === 'cost'
      ? (max - value) / (max - min)
      : (value - min) / (max - min);
  }));
  const benefitUtility = normalized.map((row) => row.reduce((sum, value, column) => sum + (criteria[column].direction === 'benefit' ? value * criteria[column].weight : 0), 0));
  const costUtility = normalized.map((row) => row.reduce((sum, value, column) => sum + (criteria[column].direction === 'cost' ? value * criteria[column].weight : 0), 0));
  const scores = benefitUtility.map((value, index) => (value + costUtility[index]) / 2);
  return result(method, { ...input, criteria }, [
    tableFromMatrix('normalized', 'ROV Normalized Matrix', normalized, input),
    { id: 'rov-utilities', title: 'ROV Best/Worst Utility Values', columns: ['Alternative', 'Best utility', 'Worst utility', 'Average utility'], rows: input.alternatives.map((alternative, index) => [alternative.name, round(benefitUtility[index]), round(costUtility[index]), round(scores[index])]) },
  ], scores, 'ROV evaluates alternatives using best and worst utility functions and ranks by average utility.');
}

function runFuzzyRov(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  const criteria = resolveCriteria(input, config);
  const fuzzyMatrix = input.fuzzyValues?.length
    ? input.fuzzyValues
    : input.values.map((row) => row.map((value) => crispFuzzy(value)));
  const normalizedCriteria = normalizeWeights(criteria);
  const normalized = fuzzyMatrix.map((row) => row.map((value, column) => {
    const columnValues = fuzzyMatrix.map((item) => item[column]);
    if (criteria[column].direction === 'cost') {
      const minLower = Math.min(...columnValues.map((item) => item.values[0]).filter(Number.isFinite));
      return { values: value.values.map((cell) => minLower / Math.max(cell, 1e-9)).reverse(), type: value.type } as FuzzyNumber;
    }
    const maxUpper = Math.max(...columnValues.map((item) => item.values[item.values.length - 1]).filter(Number.isFinite), 1e-9);
    return { values: value.values.map((cell) => cell / maxUpper), type: value.type };
  }));
  const weightedFuzzy = normalized.map((row) => row.map((value, column) => scaleFuzzy(value, normalizedCriteria[column].weight)));
  const benefitUtility = weightedFuzzy.map((row) => row.reduce((sum, value, column) => sum + (normalizedCriteria[column].direction === 'benefit' ? defuzzify(value) : 0), 0));
  const costUtility = weightedFuzzy.map((row) => row.reduce((sum, value, column) => sum + (normalizedCriteria[column].direction === 'cost' ? defuzzify(value) : 0), 0));
  const scores = benefitUtility.map((value, index) => (value + costUtility[index]) / 2);
  const analysis = result(method, { ...input, criteria: normalizedCriteria, fuzzyValues: fuzzyMatrix }, [
    {
      id: 'fuzzy-rov-normalized',
      title: 'Fuzzy ROV Normalized Matrix',
      columns: ['Alternative', ...criteria.map((criterion) => criterion.id)],
      rows: normalized.map((row, index) => [input.alternatives[index].name, ...row.map((value) => fuzzyLabel(value))]),
    },
    {
      id: 'fuzzy-rov-weighted',
      title: 'Fuzzy ROV Weighted Utility Matrix',
      columns: ['Alternative', ...criteria.map((criterion) => criterion.id)],
      rows: weightedFuzzy.map((row, index) => [input.alternatives[index].name, ...row.map((value) => fuzzyLabel(value))]),
    },
    {
      id: 'fuzzy-rov-utilities',
      title: 'Fuzzy ROV Best/Worst Utility Values',
      columns: ['Alternative', 'Best utility', 'Worst utility', 'Average utility'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, round(benefitUtility[index]), round(costUtility[index]), round(scores[index])]),
    },
  ], scores, 'Native fuzzy ROV preserves triangular/trapezoidal uploaded values through fuzzy normalization and weighting, then ranks alternatives by centroid best/worst average utility.');
  analysis.diagnostics.push({ label: 'Native fuzzy ROV', value: 'Fuzzy normalized best/worst utility scoring', status: 'pass' });
  analysis.reproducibility = { ...analysis.reproducibility, fuzzyMode: 'Native fuzzy ROV', fuzzyRov: 'Fuzzy normalization/weighting with centroid best and worst utility values' };
  return analysis;
}

function runWisp(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  if (config.methodParams.fuzzyInputMode === 'Native fuzzy WISP') {
    return runFuzzyWisp(input, config, method);
  }
  const criteria = resolveCriteria(input, config);
  const normalized = input.values.map((row) => row.map((value, column) => {
    const best = Math.max(...input.values.map((item) => item[column]).filter(Number.isFinite), 1e-9);
    return value / best;
  }));
  const weightedMatrix = weighted(normalized, criteria);
  const hasBenefit = criteria.some((criterion) => criterion.direction === 'benefit');
  const hasCost = criteria.some((criterion) => criterion.direction === 'cost');
  const sumBenefit = weightedMatrix.map((row) => row.reduce((sum, value, column) => sum + (criteria[column].direction === 'benefit' ? value : 0), 0));
  const sumCost = weightedMatrix.map((row) => row.reduce((sum, value, column) => sum + (criteria[column].direction === 'cost' ? value : 0), 0));
  const productBenefit = weightedMatrix.map((row) => row.reduce((product, value, column) => criteria[column].direction === 'benefit' ? product * Math.max(value, 1e-16) : product, 1));
  const productCost = weightedMatrix.map((row) => row.reduce((product, value, column) => criteria[column].direction === 'cost' ? product * Math.max(value, 1e-16) : product, 1));
  const sumDifference = sumBenefit.map((value, index) => value - sumCost[index]);
  const productDifference = productBenefit.map((value, index) => value - productCost[index]);
  const sumRatio = sumBenefit.map((value, index) => hasBenefit && hasCost ? value / Math.max(sumCost[index], 1e-9) : hasBenefit ? value : 1 / Math.max(sumCost[index], 1e-9));
  const productRatio = productBenefit.map((value, index) => hasBenefit && hasCost ? value / Math.max(productCost[index], 1e-9) : hasBenefit ? value : 1 / Math.max(productCost[index], 1e-9));
  const maxSumDifference = Math.max(...sumDifference, 1e-9);
  const maxProductDifference = Math.max(...productDifference, 1e-9);
  const maxSumRatio = Math.max(...sumRatio, 1e-9);
  const maxProductRatio = Math.max(...productRatio, 1e-9);
  const recalculatedSumDifference = sumDifference.map((value) => (1 + value) / (1 + maxSumDifference));
  const recalculatedProductDifference = productDifference.map((value) => (1 + value) / (1 + maxProductDifference));
  const recalculatedSumRatio = sumRatio.map((value) => (1 + value) / (1 + maxSumRatio));
  const recalculatedProductRatio = productRatio.map((value) => (1 + value) / (1 + maxProductRatio));
  const scores = sumDifference.map((_, index) => (
    recalculatedSumDifference[index]
    + recalculatedProductDifference[index]
    + recalculatedSumRatio[index]
    + recalculatedProductRatio[index]
  ) / 4);
  return result(method, { ...input, criteria }, [
    tableFromMatrix('normalized', 'WISP Normalized Matrix', normalized, input),
    tableFromMatrix('weighted', 'WISP Weighted Normalized Matrix', weightedMatrix, input),
    { id: 'wisp-components', title: 'WISP Utility Components', columns: ['Alternative', 'Sum difference', 'Product difference', 'Sum ratio', 'Product ratio', 'Recalculated sum difference', 'Recalculated product difference', 'Recalculated sum ratio', 'Recalculated product ratio', 'WISP utility'], rows: input.alternatives.map((alternative, index) => [alternative.name, round(sumDifference[index]), round(productDifference[index]), round(sumRatio[index]), round(productRatio[index]), round(recalculatedSumDifference[index]), round(recalculatedProductDifference[index]), round(recalculatedSumRatio[index]), round(recalculatedProductRatio[index]), round(scores[index])]) },
  ], scores, 'WISP integrates weighted-sum difference, weighted-product difference, weighted-sum ratio, and weighted-product ratio measures from max-normalized weighted criteria into a recalculated final utility score.');
}

function runFuzzyWisp(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  const criteria = resolveCriteria(input, config);
  const fuzzyMatrix = input.fuzzyValues?.length
    ? input.fuzzyValues
    : input.values.map((row) => row.map((value) => crispFuzzy(value)));
  const normalizedCriteria = normalizeWeights(criteria);
  const normalized = fuzzyMatrix.map((row) => row.map((value, column) => {
    const columnValues = fuzzyMatrix.map((item) => item[column]);
    const maxUpper = Math.max(...columnValues.map((item) => item.values[item.values.length - 1]).filter(Number.isFinite), 1e-9);
    return { values: value.values.map((cell) => cell / maxUpper), type: value.type };
  }));
  const weightedFuzzy = normalized.map((row) => row.map((value, column) => scaleFuzzy(value, normalizedCriteria[column].weight)));
  const hasBenefit = normalizedCriteria.some((criterion) => criterion.direction === 'benefit');
  const hasCost = normalizedCriteria.some((criterion) => criterion.direction === 'cost');
  const sumBenefit = weightedFuzzy.map((row) => row.reduce((sum, value, column) => sum + (normalizedCriteria[column].direction === 'benefit' ? defuzzify(value) : 0), 0));
  const sumCost = weightedFuzzy.map((row) => row.reduce((sum, value, column) => sum + (normalizedCriteria[column].direction === 'cost' ? defuzzify(value) : 0), 0));
  const productBenefit = weightedFuzzy.map((row) => row.reduce((product, value, column) => normalizedCriteria[column].direction === 'benefit' ? product * Math.max(defuzzify(value), 1e-16) : product, 1));
  const productCost = weightedFuzzy.map((row) => row.reduce((product, value, column) => normalizedCriteria[column].direction === 'cost' ? product * Math.max(defuzzify(value), 1e-16) : product, 1));
  const sumDifference = sumBenefit.map((value, index) => value - sumCost[index]);
  const productDifference = productBenefit.map((value, index) => value - productCost[index]);
  const sumRatio = sumBenefit.map((value, index) => hasBenefit && hasCost ? value / Math.max(sumCost[index], 1e-9) : hasBenefit ? value : 1 / Math.max(sumCost[index], 1e-9));
  const productRatio = productBenefit.map((value, index) => hasBenefit && hasCost ? value / Math.max(productCost[index], 1e-9) : hasBenefit ? value : 1 / Math.max(productCost[index], 1e-9));
  const recalculatedSumDifference = sumDifference.map((value) => (1 + value) / (1 + Math.max(...sumDifference, 1e-9)));
  const recalculatedProductDifference = productDifference.map((value) => (1 + value) / (1 + Math.max(...productDifference, 1e-9)));
  const recalculatedSumRatio = sumRatio.map((value) => (1 + value) / (1 + Math.max(...sumRatio, 1e-9)));
  const recalculatedProductRatio = productRatio.map((value) => (1 + value) / (1 + Math.max(...productRatio, 1e-9)));
  const scores = sumDifference.map((_, index) => (
    recalculatedSumDifference[index]
    + recalculatedProductDifference[index]
    + recalculatedSumRatio[index]
    + recalculatedProductRatio[index]
  ) / 4);
  const analysis = result(method, { ...input, criteria: normalizedCriteria, fuzzyValues: fuzzyMatrix }, [
    {
      id: 'fuzzy-wisp-normalized',
      title: 'Fuzzy WISP Normalized Matrix',
      columns: ['Alternative', ...criteria.map((criterion) => criterion.id)],
      rows: normalized.map((row, index) => [input.alternatives[index].name, ...row.map((value) => fuzzyLabel(value))]),
    },
    {
      id: 'fuzzy-wisp-weighted',
      title: 'Fuzzy WISP Weighted Matrix',
      columns: ['Alternative', ...criteria.map((criterion) => criterion.id)],
      rows: weightedFuzzy.map((row, index) => [input.alternatives[index].name, ...row.map((value) => fuzzyLabel(value))]),
    },
    {
      id: 'fuzzy-wisp-components',
      title: 'Fuzzy WISP Utility Components',
      columns: ['Alternative', 'Sum difference', 'Product difference', 'Sum ratio', 'Product ratio', 'Recalculated sum difference', 'Recalculated product difference', 'Recalculated sum ratio', 'Recalculated product ratio', 'WISP utility'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, round(sumDifference[index]), round(productDifference[index]), round(sumRatio[index]), round(productRatio[index]), round(recalculatedSumDifference[index]), round(recalculatedProductDifference[index]), round(recalculatedSumRatio[index]), round(recalculatedProductRatio[index]), round(scores[index])]),
    },
  ], scores, 'Native fuzzy WISP preserves triangular/trapezoidal uploaded values through fuzzy normalization and weighting, then integrates centroid weighted sum/product difference and ratio utility components.');
  analysis.diagnostics.push({ label: 'Native fuzzy WISP', value: 'Fuzzy weighted sum/product difference and ratio utility components', status: 'pass' });
  analysis.reproducibility = { ...analysis.reproducibility, fuzzyMode: 'Native fuzzy WISP', fuzzyWisp: 'Fuzzy normalization/weighting with centroid sum/product difference and ratio utility components' };
  return analysis;
}

function runTodim(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  if (config.methodParams.fuzzyInputMode === 'Native fuzzy TODIM') {
    return runFuzzyTodim(input, config, method);
  }
  const criteria = resolveCriteria(input, config);
  const normalized = minMaxNormalize({ ...input, criteria });
  const maxWeight = Math.max(...criteria.map((criterion) => criterion.weight), 1e-9);
  const relativeWeights = criteria.map((criterion) => criterion.weight / maxWeight);
  const relativeWeightTotal = relativeWeights.reduce((sum, value) => sum + value, 0) || 1;
  const theta = Math.max(Number(config.methodParams.todimTheta ?? 1), 1e-9);
  const dominanceMatrix = input.alternatives.map((_, rowIndex) =>
    input.alternatives.map((__, columnIndex) => {
      if (rowIndex === columnIndex) return 0;
      return criteria.reduce((sum, criterion, criterionIndex) => {
        const diff = normalized[rowIndex][criterionIndex] - normalized[columnIndex][criterionIndex];
        const relativeWeight = relativeWeights[criterionIndex];
        if (diff >= 0) return sum + Math.sqrt((relativeWeight * diff) / relativeWeightTotal);
        return sum - (1 / theta) * Math.sqrt((relativeWeightTotal * Math.abs(diff)) / Math.max(relativeWeight, 1e-9));
      }, 0);
    }),
  );
  const dominanceTotals = dominanceMatrix.map((row) => row.reduce((sum, value) => sum + value, 0));
  const minDominance = Math.min(...dominanceTotals);
  const maxDominance = Math.max(...dominanceTotals);
  const dominance = dominanceTotals.map((value) => maxDominance === minDominance ? 1 : (value - minDominance) / (maxDominance - minDominance));
  return result(method, { ...input, criteria }, [
    tableFromMatrix('normalized', 'TODIM Normalized Matrix', normalized, input),
    {
      id: 'todim-dominance-matrix',
      title: 'TODIM Pairwise Dominance Matrix',
      columns: ['Alternative', ...input.alternatives.map((alternative) => alternative.id)],
      rows: dominanceMatrix.map((row, index) => [input.alternatives[index].name, ...row.map((value) => round(value))]),
    },
    {
      id: 'todim-dominance-score',
      title: 'TODIM Dominance Scores',
      columns: ['Alternative', 'Raw dominance sum', 'Normalized dominance score', 'Loss attenuation theta'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, round(dominanceTotals[index]), round(dominance[index]), theta]),
    },
  ], dominance, 'TODIM ranks alternatives by normalized prospect-theory pairwise dominance, rewarding criterion gains and attenuating losses using theta and reference-criterion relative weights.');
}

function runFuzzyTodim(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  const criteria = resolveCriteria(input, config);
  const fuzzyMatrix = input.fuzzyValues?.length
    ? input.fuzzyValues
    : input.values.map((row) => row.map((value) => crispFuzzy(value)));
  const normalized = fuzzyMatrix.map((row) => row.map((value, column) => {
    const columnValues = fuzzyMatrix.map((item) => item[column]);
    const crispValues = columnValues.map(defuzzify);
    const min = Math.min(...crispValues);
    const max = Math.max(...crispValues);
    if (max === min) return crispFuzzy(1);
    const mapped = value.values.map((component) => {
      const clamped = Math.min(max, Math.max(min, component));
      return criteria[column].direction === 'benefit'
        ? (clamped - min) / (max - min)
        : (max - clamped) / (max - min);
    }).sort((a, b) => a - b);
    return { values: mapped, type: value.type };
  }));
  const maxWeight = Math.max(...criteria.map((criterion) => criterion.weight), 1e-9);
  const relativeWeights = criteria.map((criterion) => criterion.weight / maxWeight);
  const relativeWeightTotal = relativeWeights.reduce((sum, value) => sum + value, 0) || 1;
  const theta = Math.max(Number(config.methodParams.todimTheta ?? 1), 1e-9);
  const dominanceMatrix = input.alternatives.map((_, rowIndex) =>
    input.alternatives.map((__, columnIndex) => {
      if (rowIndex === columnIndex) return 0;
      return criteria.reduce((sum, criterion, criterionIndex) => {
        const first = normalized[rowIndex][criterionIndex];
        const second = normalized[columnIndex][criterionIndex];
        const direction = defuzzify(first) - defuzzify(second);
        const distance = fuzzyDistance(first, second);
        const relativeWeight = relativeWeights[criterionIndex];
        if (direction >= 0) return sum + Math.sqrt((relativeWeight * distance) / relativeWeightTotal);
        return sum - (1 / theta) * Math.sqrt((relativeWeightTotal * distance) / Math.max(relativeWeight, 1e-9));
      }, 0);
    }),
  );
  const dominanceTotals = dominanceMatrix.map((row) => row.reduce((sum, value) => sum + value, 0));
  const minDominance = Math.min(...dominanceTotals);
  const maxDominance = Math.max(...dominanceTotals);
  const dominance = dominanceTotals.map((value) => maxDominance === minDominance ? 1 : (value - minDominance) / (maxDominance - minDominance));
  const analysis = result(method, { ...input, criteria, fuzzyValues: fuzzyMatrix }, [
    {
      id: 'fuzzy-todim-normalized',
      title: 'Fuzzy TODIM Normalized Matrix',
      columns: ['Alternative', ...criteria.map((criterion) => criterion.id)],
      rows: normalized.map((row, index) => [input.alternatives[index].name, ...row.map((value) => fuzzyLabel(value))]),
    },
    {
      id: 'fuzzy-todim-dominance-matrix',
      title: 'Fuzzy TODIM Pairwise Dominance Matrix',
      columns: ['Alternative', ...input.alternatives.map((alternative) => alternative.id)],
      rows: dominanceMatrix.map((row, index) => [input.alternatives[index].name, ...row.map((value) => round(value))]),
    },
    {
      id: 'fuzzy-todim-dominance-score',
      title: 'Fuzzy TODIM Dominance Scores',
      columns: ['Alternative', 'Raw dominance sum', 'Normalized dominance score', 'Loss attenuation theta'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, round(dominanceTotals[index]), round(dominance[index]), theta]),
    },
  ], dominance, 'Native fuzzy TODIM preserves triangular/trapezoidal uploaded values through fuzzy normalization and normalized prospect-theory pairwise dominance based on fuzzy-distance gains and losses.');
  analysis.diagnostics.push({ label: 'Native fuzzy TODIM', value: `theta = ${round(theta)} with normalized fuzzy pairwise dominance`, status: 'pass' });
  analysis.reproducibility = { ...analysis.reproducibility, fuzzyMode: 'Native fuzzy TODIM', fuzzyTodim: 'Fuzzy min-max normalization, centroid gain/loss direction, vertex-distance dominance magnitude, and normalized dominance score', theta: round(theta) };
  return analysis;
}

function runRam(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  if (config.methodParams.fuzzyInputMode === 'Native fuzzy RAM') {
    return runFuzzyRam(input, config, method);
  }
  const criteria = resolveCriteria(input, config);
  const columnSums = criteria.map((_, column) => input.values.reduce((sum, row) => sum + row[column], 0));
  const normalized = input.values.map((row) => row.map((value, column) => value / (columnSums[column] || 1)));
  const weightedMatrix = weighted(normalized, criteria);
  const benefitUtility = weightedMatrix.map((row) => row.reduce((sum, value, column) => sum + (criteria[column].direction === 'benefit' ? value : 0), 0));
  const costUtility = weightedMatrix.map((row) => row.reduce((sum, value, column) => sum + (criteria[column].direction === 'cost' ? value : 0), 0));
  const scores = benefitUtility.map((benefit, index) => (2 + benefit) ** (1 / (2 + costUtility[index])));
  return result(method, { ...input, criteria }, [
    tableFromMatrix('normalized', 'RAM Normalized Matrix', normalized, input),
    tableFromMatrix('weighted', 'RAM Weighted Normalized Matrix', weightedMatrix, input),
    {
      id: 'ram-components',
      title: 'RAM Benefit and Cost Utility Components',
      columns: ['Alternative', 'S+ benefit sum', 'S- cost sum', 'RAM RI score'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, round(benefitUtility[index]), round(costUtility[index]), round(scores[index])]),
    },
  ], scores, 'RAM ranks alternatives with a root assessment index: the weighted benefit sum is the radicand component and the weighted cost sum is the root-index component.');
}

function runFuzzyRam(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  const criteria = resolveCriteria(input, config);
  const fuzzyMatrix = input.fuzzyValues?.length
    ? input.fuzzyValues
    : input.values.map((row) => row.map((value) => crispFuzzy(value)));
  const normalizedCriteria = normalizeWeights(criteria);
  const normalized = fuzzyMatrix.map((row) => row.map((value, column) => {
    const columnValues = fuzzyMatrix.map((item) => item[column]);
    const sum = columnValues.reduce((total, item) => total + defuzzify(item), 0) || 1;
    return { values: value.values.map((cell) => cell / sum), type: value.type };
  }));
  const weightedFuzzy = normalized.map((row) => row.map((value, column) => scaleFuzzy(value, normalizedCriteria[column].weight)));
  const benefitUtility = weightedFuzzy.map((row) => row.reduce((sum, value, column) => sum + (normalizedCriteria[column].direction === 'benefit' ? defuzzify(value) : 0), 0));
  const costUtility = weightedFuzzy.map((row) => row.reduce((sum, value, column) => sum + (normalizedCriteria[column].direction === 'cost' ? defuzzify(value) : 0), 0));
  const scores = benefitUtility.map((benefit, index) => (2 + benefit) ** (1 / (2 + costUtility[index])));
  const analysis = result(method, { ...input, criteria: normalizedCriteria, fuzzyValues: fuzzyMatrix }, [
    {
      id: 'fuzzy-ram-normalized',
      title: 'Fuzzy RAM Normalized Matrix',
      columns: ['Alternative', ...criteria.map((criterion) => criterion.id)],
      rows: normalized.map((row, index) => [input.alternatives[index].name, ...row.map((value) => fuzzyLabel(value))]),
    },
    {
      id: 'fuzzy-ram-weighted',
      title: 'Fuzzy RAM Weighted Normalized Matrix',
      columns: ['Alternative', ...criteria.map((criterion) => criterion.id)],
      rows: weightedFuzzy.map((row, index) => [input.alternatives[index].name, ...row.map((value) => fuzzyLabel(value))]),
    },
    {
      id: 'fuzzy-ram-components',
      title: 'Fuzzy RAM Benefit and Cost Utility Components',
      columns: ['Alternative', 'S+ benefit sum', 'S- cost sum', 'RAM RI score'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, round(benefitUtility[index]), round(costUtility[index]), round(scores[index])]),
    },
  ], scores, 'Native fuzzy RAM preserves triangular/trapezoidal uploaded values through fuzzy column-sum normalization and weighting, then ranks alternatives by the centroid RAM root assessment index.');
  analysis.diagnostics.push({ label: 'Native fuzzy RAM', value: 'Fuzzy weighted S+/S- components with RAM root assessment index', status: 'pass' });
  analysis.reproducibility = { ...analysis.reproducibility, fuzzyMode: 'Native fuzzy RAM', fuzzyRam: 'Fuzzy column-sum normalization/weighting with centroid S+/S- root assessment index' };
  return analysis;
}

function runGra(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  if (config.methodParams.fuzzyInputMode === 'Native fuzzy GRA') {
    return runFuzzyGra(input, config, method);
  }
  const criteria = resolveCriteria(input, config);
  const normalized = greyRangeNormalize({ ...input, criteria });
  const deviations = normalized.flatMap((row) => row.map((value) => Math.abs(1 - value)));
  const minDeviation = Math.min(...deviations);
  const maxDeviation = Math.max(...deviations);
  const zeta = Number(config.methodParams.graZeta ?? 0.5);
  const coefficientMatrix = normalized.map((row) =>
    row.map((value) => {
      const deviation = Math.abs(1 - value);
      return (minDeviation + zeta * maxDeviation) / (deviation + zeta * maxDeviation || 1);
    }),
  );
  const weightedCoefficients = weighted(coefficientMatrix, criteria);
  const scores = weightedCoefficients.map((row) => row.reduce((sum, value) => sum + value, 0));
  return result(method, { ...input, criteria }, [
    tableFromMatrix('normalized', 'GRA Normalized Matrix', normalized, input),
    tableFromMatrix('grey-coefficients', 'Grey Relational Coefficient Matrix', coefficientMatrix, input),
    tableFromMatrix('weighted-grey-coefficients', 'Weighted Grey Relational Coefficients', weightedCoefficients, input),
    {
      id: 'gra-grades',
      title: 'Grey Relational Grades',
      columns: ['Alternative', 'Grey relational grade', 'Zeta', 'Min deviation', 'Max deviation'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, round(scores[index]), zeta, round(minDeviation), round(maxDeviation)]),
    },
  ], scores, 'GRA ranks alternatives by grey relational coefficients against an ideal reference sequence and weighted grey relational grade.');
}

function greyRangeNormalize(input: DecisionMatrix): number[][] {
  return input.values.map((row) =>
    row.map((value, column) => {
      const values = input.values.map((item) => item[column]);
      const min = Math.min(...values);
      const max = Math.max(...values);
      if (max === min) return 1;
      return input.criteria[column].direction === 'cost'
        ? (max - value) / (max - min)
        : (value - min) / (max - min);
    }),
  );
}

function fuzzyGreyRangeNormalize(fuzzyMatrix: FuzzyNumber[][], criteria: DecisionMatrix['criteria']): FuzzyNumber[][] {
  return fuzzyMatrix.map((row) =>
    row.map((value, column) => {
      const crispColumnValues = fuzzyMatrix.map((item) => defuzzify(item[column]));
      const min = Math.min(...crispColumnValues);
      const max = Math.max(...crispColumnValues);
      const range = max - min;
      if (Math.abs(range) <= 1e-12) return crispFuzzy(1);
      if (criteria[column].direction === 'cost') {
        return { values: value.values.map((cell) => (max - cell) / range).reverse(), type: value.type };
      }
      return { values: value.values.map((cell) => (cell - min) / range), type: value.type };
    }),
  );
}

function runGrp(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  if (config.methodParams.fuzzyInputMode === 'Native fuzzy GRP') {
    return runFuzzyGrp(input, config, method);
  }
  const criteria = resolveCriteria(input, config);
  const normalized = greyRangeNormalize({ ...input, criteria });
  const positiveIdeal = criteria.map(() => 1);
  const negativeIdeal = criteria.map(() => 0);
  const zeta = Number(config.methodParams.graZeta ?? 0.5);
  const positiveDeviations = normalized.flatMap((row) => row.map((value, column) => Math.abs(positiveIdeal[column] - value)));
  const negativeDeviations = normalized.flatMap((row) => row.map((value, column) => Math.abs(value - negativeIdeal[column])));
  const minPositive = Math.min(...positiveDeviations);
  const maxPositive = Math.max(...positiveDeviations);
  const minNegative = Math.min(...negativeDeviations);
  const maxNegative = Math.max(...negativeDeviations);
  const positiveCoefficients = normalized.map((row) => row.map((value, column) => {
    const deviation = Math.abs(positiveIdeal[column] - value);
    return (minPositive + zeta * maxPositive) / (deviation + zeta * maxPositive || 1);
  }));
  const negativeCoefficients = normalized.map((row) => row.map((value, column) => {
    const deviation = Math.abs(value - negativeIdeal[column]);
    return (minNegative + zeta * maxNegative) / (deviation + zeta * maxNegative || 1);
  }));
  const weightNorm = Math.sqrt(criteria.reduce((sum, criterion) => sum + criterion.weight ** 2, 0)) || 1;
  const positiveProjection = positiveCoefficients.map((row) => row.reduce((sum, value, column) => sum + value * criteria[column].weight, 0) / weightNorm);
  const negativeProjection = negativeCoefficients.map((row) => row.reduce((sum, value, column) => sum + value * criteria[column].weight, 0) / weightNorm);
  const scores = positiveProjection.map((value, index) => value / (value + negativeProjection[index] || 1));
  return result(method, { ...input, criteria }, [
    tableFromMatrix('grp-normalized', 'GRP Normalized Matrix', normalized, input),
    tableFromMatrix('grp-positive-coefficients', 'GRP Positive-Ideal Grey Coefficients', positiveCoefficients, input),
    tableFromMatrix('grp-negative-coefficients', 'GRP Negative-Ideal Grey Coefficients', negativeCoefficients, input),
    {
      id: 'grp-projection',
      title: 'GRP Projection and Closeness Scores',
      columns: ['Alternative', 'Positive projection', 'Negative projection', 'Relative closeness', 'Zeta'],
      rows: input.alternatives.map((alternative, index) => [
        alternative.name,
        round(positiveProjection[index]),
        round(negativeProjection[index]),
        round(scores[index]),
        zeta,
      ]),
    },
  ], scores, 'GRP ranks alternatives by projecting grey relational coefficients toward positive and negative ideal reference sequences; higher relative closeness ranks higher.');
}

function runFuzzyGrp(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  const criteria = resolveCriteria(input, config);
  const normalizedCriteria = normalizeWeights(criteria);
  const fuzzyMatrix = input.fuzzyValues?.length
    ? input.fuzzyValues
    : input.values.map((row) => row.map((value) => crispFuzzy(value)));
  const normalized = fuzzyGreyRangeNormalize(fuzzyMatrix, normalizedCriteria);
  const positiveIdeal = normalizedCriteria.map(() => crispFuzzy(1));
  const negativeIdeal = normalizedCriteria.map(() => crispFuzzy(0));
  const positiveDeviationMatrix = normalized.map((row) => row.map((value, column) => fuzzyDistance(value, positiveIdeal[column])));
  const negativeDeviationMatrix = normalized.map((row) => row.map((value, column) => fuzzyDistance(value, negativeIdeal[column])));
  const positiveDeviations = positiveDeviationMatrix.flat();
  const negativeDeviations = negativeDeviationMatrix.flat();
  const minPositive = Math.min(...positiveDeviations);
  const maxPositive = Math.max(...positiveDeviations);
  const minNegative = Math.min(...negativeDeviations);
  const maxNegative = Math.max(...negativeDeviations);
  const zeta = Number(config.methodParams.graZeta ?? 0.5);
  const positiveCoefficients = positiveDeviationMatrix.map((row) =>
    row.map((deviation) => (minPositive + zeta * maxPositive) / (deviation + zeta * maxPositive || 1)),
  );
  const negativeCoefficients = negativeDeviationMatrix.map((row) =>
    row.map((deviation) => (minNegative + zeta * maxNegative) / (deviation + zeta * maxNegative || 1)),
  );
  const weightNorm = Math.sqrt(normalizedCriteria.reduce((sum, criterion) => sum + criterion.weight ** 2, 0)) || 1;
  const positiveProjection = positiveCoefficients.map((row) => row.reduce((sum, value, column) => sum + value * normalizedCriteria[column].weight, 0) / weightNorm);
  const negativeProjection = negativeCoefficients.map((row) => row.reduce((sum, value, column) => sum + value * normalizedCriteria[column].weight, 0) / weightNorm);
  const scores = positiveProjection.map((value, index) => value / (value + negativeProjection[index] || 1));
  const analysis = result(method, { ...input, criteria: normalizedCriteria, fuzzyValues: fuzzyMatrix }, [
    {
      id: 'fuzzy-grp-normalized',
      title: 'Fuzzy GRP Normalized Matrix',
      columns: ['Alternative', ...criteria.map((criterion) => criterion.id)],
      rows: normalized.map((row, index) => [input.alternatives[index].name, ...row.map((value) => fuzzyLabel(value))]),
    },
    tableFromMatrix('fuzzy-grp-positive-deviation', 'Fuzzy GRP Distance From Positive Ideal', positiveDeviationMatrix, input),
    tableFromMatrix('fuzzy-grp-negative-deviation', 'Fuzzy GRP Distance From Negative Ideal', negativeDeviationMatrix, input),
    tableFromMatrix('fuzzy-grp-positive-coefficients', 'Fuzzy GRP Positive-Ideal Grey Coefficients', positiveCoefficients, input),
    tableFromMatrix('fuzzy-grp-negative-coefficients', 'Fuzzy GRP Negative-Ideal Grey Coefficients', negativeCoefficients, input),
    {
      id: 'fuzzy-grp-projection',
      title: 'Fuzzy GRP Projection and Closeness Scores',
      columns: ['Alternative', 'Positive projection', 'Negative projection', 'Relative closeness', 'Zeta'],
      rows: input.alternatives.map((alternative, index) => [
        alternative.name,
        round(positiveProjection[index]),
        round(negativeProjection[index]),
        round(scores[index]),
        zeta,
      ]),
    },
  ], scores, 'Native fuzzy GRP preserves triangular/trapezoidal uploaded values through fuzzy grey range normalization, calculates fuzzy-distance grey coefficients against positive and negative ideals, and ranks alternatives by relative projection closeness.');
  analysis.diagnostics.push({ label: 'Native fuzzy GRP', value: `zeta = ${round(zeta)} with fuzzy-distance positive/negative grey projections`, status: 'pass' });
  analysis.reproducibility = { ...analysis.reproducibility, fuzzyMode: 'Native fuzzy GRP', fuzzyGrp: 'Fuzzy grey range normalization, vertex-distance grey coefficients, relative projection closeness', zeta: round(zeta) };
  return analysis;
}

function runFuzzyGra(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  const criteria = resolveCriteria(input, config);
  const fuzzyMatrix = input.fuzzyValues?.length
    ? input.fuzzyValues
    : input.values.map((row) => row.map((value) => crispFuzzy(value)));
  const normalizedCriteria = normalizeWeights(criteria);
  const normalized = fuzzyMatrix.map((row) => row.map((value, column) => {
    const columnValues = fuzzyMatrix.map((item) => item[column]);
    if (criteria[column].direction === 'cost') {
      const minLower = Math.min(...columnValues.map((item) => item.values[0]).filter(Number.isFinite));
      return { values: value.values.map((cell) => minLower / Math.max(cell, 1e-9)).reverse(), type: value.type } as FuzzyNumber;
    }
    const maxUpper = Math.max(...columnValues.map((item) => item.values[item.values.length - 1]).filter(Number.isFinite), 1e-9);
    return { values: value.values.map((cell) => cell / maxUpper), type: value.type };
  }));
  const ideal = normalizedCriteria.map(() => crispFuzzy(1));
  const deviationMatrix = normalized.map((row) => row.map((value, column) => fuzzyDistance(value, ideal[column])));
  const deviations = deviationMatrix.flat();
  const minDeviation = Math.min(...deviations);
  const maxDeviation = Math.max(...deviations);
  const zeta = Number(config.methodParams.graZeta ?? 0.5);
  const coefficientMatrix = deviationMatrix.map((row) =>
    row.map((deviation) => (minDeviation + zeta * maxDeviation) / (deviation + zeta * maxDeviation || 1)),
  );
  const weightedCoefficients = weighted(coefficientMatrix, normalizedCriteria);
  const scores = weightedCoefficients.map((row) => row.reduce((sum, value) => sum + value, 0));
  const analysis = result(method, { ...input, criteria: normalizedCriteria, fuzzyValues: fuzzyMatrix }, [
    {
      id: 'fuzzy-gra-normalized',
      title: 'Fuzzy GRA Normalized Matrix',
      columns: ['Alternative', ...criteria.map((criterion) => criterion.id)],
      rows: normalized.map((row, index) => [input.alternatives[index].name, ...row.map((value) => fuzzyLabel(value))]),
    },
    {
      id: 'fuzzy-gra-ideal',
      title: 'Fuzzy GRA Ideal Reference Sequence',
      columns: ['Type', ...criteria.map((criterion) => criterion.id)],
      rows: [['Ideal sequence', ...ideal.map((value) => fuzzyLabel(value))]],
    },
    tableFromMatrix('fuzzy-gra-deviation', 'Fuzzy GRA Distance From Ideal', deviationMatrix, input),
    tableFromMatrix('fuzzy-gra-coefficients', 'Fuzzy Grey Relational Coefficient Matrix', coefficientMatrix, input),
    tableFromMatrix('fuzzy-gra-weighted-coefficients', 'Weighted Fuzzy Grey Relational Coefficients', weightedCoefficients, input),
    {
      id: 'fuzzy-gra-grades',
      title: 'Fuzzy Grey Relational Grades',
      columns: ['Alternative', 'Grey relational grade', 'Zeta', 'Min deviation', 'Max deviation'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, round(scores[index]), zeta, round(minDeviation), round(maxDeviation)]),
    },
  ], scores, 'Native fuzzy GRA preserves triangular/trapezoidal uploaded values through fuzzy normalization, calculates fuzzy-distance deviations from the ideal reference sequence, and ranks alternatives by weighted grey relational grade.');
  analysis.diagnostics.push({ label: 'Native fuzzy GRA', value: `zeta = ${round(zeta)} with fuzzy-distance grey relational coefficients`, status: 'pass' });
  analysis.reproducibility = { ...analysis.reproducibility, fuzzyMode: 'Native fuzzy GRA', fuzzyGra: 'Fuzzy normalization, fuzzy ideal sequence, vertex-distance grey relational coefficients', zeta: round(zeta) };
  return analysis;
}

function runSpotis(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  if (config.methodParams.fuzzyInputMode === 'Native fuzzy SPOTIS') {
    return runFuzzySpotis(input, config, method);
  }
  const criteria = resolveCriteria(input, config);
  const observedBounds = criteria.map((_, column) => {
    const values = input.values.map((row) => row[column]);
    return { min: Math.min(...values), max: Math.max(...values) };
  });
  const usesManualBounds = config.methodParams.spotisBounds === 'Manual bounds';
  const manualLower = parseNumberList(config.methodParams.spotisLowerBounds, criteria.length, 0);
  const manualUpper = parseNumberList(config.methodParams.spotisUpperBounds, criteria.length, 1);
  const bounds = usesManualBounds
    ? criteria.map((_, index) => ({ min: manualLower[index], max: manualUpper[index] }))
    : observedBounds;
  const ideal = bounds.map((bound, column) => criteria[column].direction === 'benefit' ? bound.max : bound.min);
  const normalizedDistance = input.values.map((row) =>
    row.map((value, column) => {
      const range = bounds[column].max - bounds[column].min;
      return Math.abs(value - ideal[column]) / (range || 1);
    }),
  );
  const weightedDistance = weighted(normalizedDistance, criteria);
  const scores = weightedDistance.map((row) => row.reduce((sum, value) => sum + value, 0));
  return result(method, { ...input, criteria }, [
    {
      id: 'spotis-bounds',
      title: 'SPOTIS Criterion Bounds and Ideal Point',
      columns: ['Criterion', 'Name', 'Direction', 'Bounds mode', 'Lower bound', 'Upper bound', 'Ideal point'],
      rows: criteria.map((criterion, index) => [criterion.id, criterion.name, criterion.direction, usesManualBounds ? 'Manual bounds' : 'Observed data range', round(bounds[index].min), round(bounds[index].max), round(ideal[index])]),
    },
    tableFromMatrix('normalized-distance', 'SPOTIS Normalized Distance Matrix', normalizedDistance, input),
    tableFromMatrix('weighted-distance', 'SPOTIS Weighted Distance Matrix', weightedDistance, input),
    {
      id: 'spotis-score',
      title: 'SPOTIS Distance Scores',
      columns: ['Alternative', 'Weighted distance from ideal', 'Ranking rule'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, round(scores[index]), 'Lower is better']),
    },
  ], scores, 'SPOTIS ranks alternatives by weighted normalized distance from an ideal solution point defined within criterion bounds. Lower distance indicates a better alternative.', false);
}

function runFuzzySpotis(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  const criteria = resolveCriteria(input, config);
  const fuzzyMatrix = input.fuzzyValues?.length
    ? input.fuzzyValues
    : input.values.map((row) => row.map((value) => crispFuzzy(value)));
  const observedBounds = criteria.map((_, column) => {
    const values = fuzzyMatrix.map((row) => defuzzify(row[column]));
    return { min: Math.min(...values), max: Math.max(...values) };
  });
  const usesManualBounds = config.methodParams.spotisBounds === 'Manual bounds';
  const manualLower = parseNumberList(config.methodParams.spotisLowerBounds, criteria.length, 0);
  const manualUpper = parseNumberList(config.methodParams.spotisUpperBounds, criteria.length, 1);
  const bounds = usesManualBounds
    ? criteria.map((_, index) => ({ min: manualLower[index], max: manualUpper[index] }))
    : observedBounds;
  const ideal = bounds.map((bound, column) => crispFuzzy(criteria[column].direction === 'benefit' ? bound.max : bound.min));
  const normalizedDistance = fuzzyMatrix.map((row) =>
    row.map((value, column) => {
      const range = bounds[column].max - bounds[column].min;
      return fuzzyDistance(value, ideal[column]) / (Math.abs(range) || 1);
    }),
  );
  const weightedDistance = weighted(normalizedDistance, criteria);
  const scores = weightedDistance.map((row) => row.reduce((sum, value) => sum + value, 0));
  const analysis = result(method, { ...input, criteria, fuzzyValues: fuzzyMatrix }, [
    {
      id: 'fuzzy-spotis-bounds',
      title: 'Fuzzy SPOTIS Criterion Bounds and Ideal Point',
      columns: ['Criterion', 'Name', 'Direction', 'Bounds mode', 'Lower bound', 'Upper bound', 'Ideal point'],
      rows: criteria.map((criterion, index) => [criterion.id, criterion.name, criterion.direction, usesManualBounds ? 'Manual bounds' : 'Observed data range', round(bounds[index].min), round(bounds[index].max), fuzzyLabel(ideal[index])]),
    },
    tableFromMatrix('fuzzy-spotis-normalized-distance', 'Fuzzy SPOTIS Normalized Distance Matrix', normalizedDistance, input),
    tableFromMatrix('fuzzy-spotis-weighted-distance', 'Fuzzy SPOTIS Weighted Distance Matrix', weightedDistance, input),
    {
      id: 'fuzzy-spotis-score',
      title: 'Fuzzy SPOTIS Distance Scores',
      columns: ['Alternative', 'Weighted fuzzy distance from ideal', 'Ranking rule'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, round(scores[index]), 'Lower is better']),
    },
  ], scores, 'Native fuzzy SPOTIS preserves triangular/trapezoidal uploaded values, measures fuzzy distance from the ideal criterion bound, and ranks alternatives by the lowest weighted normalized distance.', false);
  analysis.diagnostics.push({ label: 'Native fuzzy SPOTIS', value: `${usesManualBounds ? 'Manual' : 'Observed'} bounds with fuzzy ideal-distance scoring`, status: 'pass' });
  analysis.reproducibility = { ...analysis.reproducibility, fuzzyMode: 'Native fuzzy SPOTIS', fuzzySpotis: 'Fuzzy distance from ideal bounds normalized by criterion range; lower score preferred', boundsMode: usesManualBounds ? 'Manual bounds' : 'Observed data range' };
  return analysis;
}

function runEspSpotis(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  if (config.methodParams.fuzzyInputMode === 'Native fuzzy ESP-SPOTIS') return runFuzzyEspSpotis(input, config, method);
  const criteria = resolveCriteria(input, config);
  const observedBounds = criteria.map((_, column) => {
    const values = input.values.map((row) => row[column]);
    return { min: Math.min(...values), max: Math.max(...values) };
  });
  const usesManualBounds = config.methodParams.espSpotisBounds === 'Manual bounds';
  const manualLower = parseNumberList(config.methodParams.spotisLowerBounds, criteria.length, 0);
  const manualUpper = parseNumberList(config.methodParams.spotisUpperBounds, criteria.length, 1);
  const expectedPoint = parseNumberList(config.methodParams.espSpotisPoint, criteria.length, 0);
  const bounds = usesManualBounds
    ? criteria.map((_, index) => ({ min: manualLower[index], max: manualUpper[index] }))
    : observedBounds;
  const reference = criteria.map((_, index) => {
    const fallback = (bounds[index].min + bounds[index].max) / 2;
    const value = Number.isFinite(expectedPoint[index]) ? expectedPoint[index] : fallback;
    return Math.min(bounds[index].max, Math.max(bounds[index].min, value));
  });
  const normalizedDistance = input.values.map((row) =>
    row.map((value, column) => {
      const range = bounds[column].max - bounds[column].min;
      return Math.abs(value - reference[column]) / (Math.abs(range) || 1);
    }),
  );
  const weightedDistance = weighted(normalizedDistance, criteria);
  const scores = weightedDistance.map((row) => row.reduce((sum, value) => sum + value, 0));
  return result(method, { ...input, criteria }, [
    {
      id: 'esp-spotis-bounds',
      title: 'ESP-SPOTIS Bounds and Expected Solution Point',
      columns: ['Criterion', 'Name', 'Bounds mode', 'Lower bound', 'Upper bound', 'Expected point'],
      rows: criteria.map((criterion, index) => [criterion.id, criterion.name, usesManualBounds ? 'Manual bounds' : 'Observed data range', round(bounds[index].min), round(bounds[index].max), round(reference[index])]),
    },
    tableFromMatrix('esp-spotis-normalized-distance', 'ESP-SPOTIS Normalized Distance Matrix', normalizedDistance, input),
    tableFromMatrix('esp-spotis-weighted-distance', 'ESP-SPOTIS Weighted Distance Matrix', weightedDistance, input),
    {
      id: 'esp-spotis-score',
      title: 'ESP-SPOTIS Distance Scores',
      columns: ['Alternative', 'Weighted distance from expected solution point', 'Ranking rule'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, round(scores[index]), 'Lower is better']),
    },
  ], scores, 'ESP-SPOTIS ranks alternatives by weighted normalized distance from a researcher-defined expected solution point within criterion bounds. Lower distance indicates better fit to the target.', false);
}

function runFuzzyEspSpotis(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  const criteria = normalizeWeights(resolveCriteria(input, config));
  const fuzzyMatrix = activeFuzzyMatrix(input);
  const observedBounds = criteria.map((_, column) => {
    const values = fuzzyMatrix.flatMap((row) => row[column].values);
    return { min: Math.min(...values), max: Math.max(...values) };
  });
  const usesManualBounds = config.methodParams.espSpotisBounds === 'Manual bounds';
  const manualLower = parseNumberList(config.methodParams.spotisLowerBounds, criteria.length, 0);
  const manualUpper = parseNumberList(config.methodParams.spotisUpperBounds, criteria.length, 1);
  const expectedPoint = parseNumberList(config.methodParams.espSpotisPoint, criteria.length, 0);
  const bounds = usesManualBounds ? criteria.map((_, index) => ({ min: manualLower[index], max: manualUpper[index] })) : observedBounds;
  const reference = criteria.map((_, index) => {
    const fallback = (bounds[index].min + bounds[index].max) / 2;
    const value = Number.isFinite(expectedPoint[index]) ? expectedPoint[index] : fallback;
    return crispFuzzy(Math.min(bounds[index].max, Math.max(bounds[index].min, value)));
  });
  const normalizedDistance = fuzzyDistanceToReference(fuzzyMatrix, reference, bounds);
  const weightedDistance = weighted(normalizedDistance, criteria);
  const scores = weightedDistance.map((row) => row.reduce((sum, value) => sum + value, 0));
  const analysis = result(method, { ...input, criteria, fuzzyValues: fuzzyMatrix }, [
    {
      id: 'fuzzy-esp-spotis-bounds',
      title: 'Fuzzy ESP-SPOTIS Bounds and Expected Solution Point',
      columns: ['Criterion', 'Name', 'Bounds mode', 'Lower bound', 'Upper bound', 'Expected point'],
      rows: criteria.map((criterion, index) => [criterion.id, criterion.name, usesManualBounds ? 'Manual bounds' : 'Observed fuzzy data range', round(bounds[index].min), round(bounds[index].max), fuzzyLabel(reference[index])]),
    },
    tableFromMatrix('fuzzy-esp-spotis-normalized-distance', 'Fuzzy ESP-SPOTIS Normalized Distance Matrix', normalizedDistance, input),
    tableFromMatrix('fuzzy-esp-spotis-weighted-distance', 'Fuzzy ESP-SPOTIS Weighted Distance Matrix', weightedDistance, { ...input, criteria }),
    { id: 'fuzzy-esp-spotis-score', title: 'Fuzzy ESP-SPOTIS Distance Scores', columns: ['Alternative', 'Weighted fuzzy distance from expected solution point', 'Ranking rule'], rows: input.alternatives.map((alternative, index) => [alternative.name, round(scores[index]), 'Lower is better']) },
  ], scores, 'Native fuzzy ESP-SPOTIS preserves fuzzy uploaded values, measures vertex distance from the expected solution point within criterion bounds, and ranks by the lowest weighted distance.', false);
  return fuzzyStandardDiagnostic(method, analysis, `${usesManualBounds ? 'Manual' : 'Observed fuzzy'} bounds with fuzzy target-distance scoring.`);
}

function runBalancedSpotis(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  if (config.methodParams.fuzzyInputMode === 'Native fuzzy B-SPOTIS') {
    return runFuzzyBalancedSpotis(input, config, method);
  }
  const criteria = resolveCriteria(input, config);
  const observedBounds = criteria.map((_, column) => {
    const values = input.values.map((row) => row[column]);
    return { min: Math.min(...values), max: Math.max(...values) };
  });
  const usesManualBounds = config.methodParams.balancedSpotisBounds === 'Manual bounds';
  const manualLower = parseNumberList(config.methodParams.spotisLowerBounds, criteria.length, 0);
  const manualUpper = parseNumberList(config.methodParams.spotisUpperBounds, criteria.length, 1);
  const expectedPoint = parseNumberList(config.methodParams.espSpotisPoint, criteria.length, 0);
  const alpha = Math.min(1, Math.max(0, Number(config.methodParams.balancedSpotisAlpha ?? 0.5)));
  const bounds = usesManualBounds
    ? criteria.map((_, index) => ({ min: manualLower[index], max: manualUpper[index] }))
    : observedBounds;
  const ideal = bounds.map((bound, column) => criteria[column].direction === 'benefit' ? bound.max : bound.min);
  const expected = criteria.map((_, index) => {
    const fallback = (bounds[index].min + bounds[index].max) / 2;
    const value = Number.isFinite(expectedPoint[index]) ? expectedPoint[index] : fallback;
    return Math.min(bounds[index].max, Math.max(bounds[index].min, value));
  });
  const distanceToIdeal = input.values.map((row) =>
    row.map((value, column) => Math.abs(value - ideal[column]) / (Math.abs(bounds[column].max - bounds[column].min) || 1)),
  );
  const distanceToExpected = input.values.map((row) =>
    row.map((value, column) => Math.abs(value - expected[column]) / (Math.abs(bounds[column].max - bounds[column].min) || 1)),
  );
  const weightedIdeal = weighted(distanceToIdeal, criteria);
  const weightedExpected = weighted(distanceToExpected, criteria);
  const idealScores = weightedIdeal.map((row) => row.reduce((sum, value) => sum + value, 0));
  const expectedScores = weightedExpected.map((row) => row.reduce((sum, value) => sum + value, 0));
  const scores = idealScores.map((score, index) => alpha * expectedScores[index] + (1 - alpha) * score);
  return result(method, { ...input, criteria }, [
    {
      id: 'balanced-spotis-bounds',
      title: 'B-SPOTIS Bounds, ISP, and ESP',
      columns: ['Criterion', 'Name', 'Direction', 'Bounds mode', 'Lower bound', 'Upper bound', 'Ideal point', 'Expected point'],
      rows: criteria.map((criterion, index) => [criterion.id, criterion.name, criterion.direction, usesManualBounds ? 'Manual bounds' : 'Observed data range', round(bounds[index].min), round(bounds[index].max), round(ideal[index]), round(expected[index])]),
    },
    tableFromMatrix('balanced-spotis-ideal-distance', 'B-SPOTIS Normalized Distance from ISP', distanceToIdeal, input),
    tableFromMatrix('balanced-spotis-expected-distance', 'B-SPOTIS Normalized Distance from ESP', distanceToExpected, input),
    {
      id: 'balanced-spotis-score',
      title: 'B-SPOTIS Balanced Distance Scores',
      columns: ['Alternative', 'Distance from ISP', 'Distance from ESP', 'Alpha', 'Balanced distance', 'Ranking rule'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, round(idealScores[index]), round(expectedScores[index]), round(alpha), round(scores[index]), 'Lower is better']),
    },
  ], scores, 'Balanced SPOTIS ranks alternatives by alpha-weighted distance from the expected solution point and the ideal solution point. Lower balanced distance indicates a better alternative.', false);
}

function runFuzzyBalancedSpotis(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  const criteria = normalizeWeights(resolveCriteria(input, config));
  const fuzzyMatrix = activeFuzzyMatrix(input);
  const observedBounds = criteria.map((_, column) => {
    const values = fuzzyMatrix.map((row) => defuzzify(row[column]));
    return { min: Math.min(...values), max: Math.max(...values) };
  });
  const usesManualBounds = config.methodParams.balancedSpotisBounds === 'Manual bounds';
  const manualLower = parseNumberList(config.methodParams.spotisLowerBounds, criteria.length, 0);
  const manualUpper = parseNumberList(config.methodParams.spotisUpperBounds, criteria.length, 1);
  const expectedPoint = parseNumberList(config.methodParams.espSpotisPoint, criteria.length, 0);
  const alpha = Math.min(1, Math.max(0, Number(config.methodParams.balancedSpotisAlpha ?? 0.5)));
  const bounds = usesManualBounds
    ? criteria.map((_, index) => ({ min: manualLower[index], max: manualUpper[index] }))
    : observedBounds;
  const ideal = bounds.map((bound, column) => crispFuzzy(criteria[column].direction === 'benefit' ? bound.max : bound.min));
  const expected = criteria.map((_, index) => {
    const fallback = (bounds[index].min + bounds[index].max) / 2;
    const value = Number.isFinite(expectedPoint[index]) ? expectedPoint[index] : fallback;
    return crispFuzzy(Math.min(bounds[index].max, Math.max(bounds[index].min, value)));
  });
  const distanceToIdeal = fuzzyMatrix.map((row) =>
    row.map((value, column) => fuzzyDistance(value, ideal[column]) / (Math.abs(bounds[column].max - bounds[column].min) || 1)),
  );
  const distanceToExpected = fuzzyMatrix.map((row) =>
    row.map((value, column) => fuzzyDistance(value, expected[column]) / (Math.abs(bounds[column].max - bounds[column].min) || 1)),
  );
  const weightedIdeal = weighted(distanceToIdeal, criteria);
  const weightedExpected = weighted(distanceToExpected, criteria);
  const idealScores = weightedIdeal.map((row) => row.reduce((sum, value) => sum + value, 0));
  const expectedScores = weightedExpected.map((row) => row.reduce((sum, value) => sum + value, 0));
  const scores = idealScores.map((score, index) => alpha * expectedScores[index] + (1 - alpha) * score);
  const analysis = result(method, { ...input, criteria, fuzzyValues: fuzzyMatrix }, [
    {
      id: 'fuzzy-balanced-spotis-bounds',
      title: 'Fuzzy B-SPOTIS Bounds, ISP, and ESP',
      columns: ['Criterion', 'Name', 'Direction', 'Bounds mode', 'Lower bound', 'Upper bound', 'Ideal point', 'Expected point'],
      rows: criteria.map((criterion, index) => [criterion.id, criterion.name, criterion.direction, usesManualBounds ? 'Manual bounds' : 'Observed data range', round(bounds[index].min), round(bounds[index].max), fuzzyLabel(ideal[index]), fuzzyLabel(expected[index])]),
    },
    tableFromMatrix('fuzzy-balanced-spotis-ideal-distance', 'Fuzzy B-SPOTIS Normalized Distance from ISP', distanceToIdeal, input),
    tableFromMatrix('fuzzy-balanced-spotis-expected-distance', 'Fuzzy B-SPOTIS Normalized Distance from ESP', distanceToExpected, input),
    {
      id: 'fuzzy-balanced-spotis-score',
      title: 'Fuzzy B-SPOTIS Balanced Distance Scores',
      columns: ['Alternative', 'Distance from ISP', 'Distance from ESP', 'Alpha', 'Balanced distance', 'Ranking rule'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, round(idealScores[index]), round(expectedScores[index]), round(alpha), round(scores[index]), 'Lower is better']),
    },
  ], scores, 'Native fuzzy B-SPOTIS preserves triangular/trapezoidal values and ranks alternatives by alpha-weighted fuzzy distance from the ideal and expected solution points.', false);
  analysis.diagnostics.push({ label: 'Native fuzzy B-SPOTIS', value: `${usesManualBounds ? 'Manual' : 'Observed'} bounds with fuzzy ISP/ESP distance blending`, status: 'pass' });
  analysis.reproducibility = { ...analysis.reproducibility, fuzzyMode: 'Native fuzzy B-SPOTIS', fuzzyBalancedSpotis: 'Fuzzy distance from ISP and ESP, alpha-blended lower-is-better score', alpha: round(alpha) };
  return analysis;
}

function runWedba(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  if (config.methodParams.fuzzyInputMode === 'Native fuzzy WEDBA') {
    return runFuzzyWedba(input, config, method);
  }
  const criteria = resolveCriteria(input, config);
  const normalized = input.values.map((row) =>
    row.map((value, column) => {
      const values = input.values.map((item) => item[column]);
      if (criteria[column].direction === 'benefit') {
        const max = Math.max(...values.map((item) => Math.abs(item)), 1e-12);
        return value / max;
      }
      const min = Math.min(...values.map((item) => Math.max(Math.abs(item), 1e-12)));
      return min / Math.max(Math.abs(value), 1e-12);
    }),
  );
  const means = criteria.map((_, column) => normalized.reduce((sum, row) => sum + row[column], 0) / normalized.length);
  const deviations = criteria.map((_, column) => {
    const variance = normalized.reduce((sum, row) => sum + (row[column] - means[column]) ** 2, 0) / normalized.length;
    return Math.sqrt(variance) || 1;
  });
  const standardized = normalized.map((row) => row.map((value, column) => (value - means[column]) / deviations[column]));
  const ideal = criteria.map((_, column) => Math.max(...standardized.map((row) => row[column])));
  const antiIdeal = criteria.map((_, column) => Math.min(...standardized.map((row) => row[column])));
  const distanceToIdeal = standardized.map((row) =>
    Math.sqrt(row.reduce((sum, value, column) => sum + criteria[column].weight * (value - ideal[column]) ** 2, 0)),
  );
  const distanceToAntiIdeal = standardized.map((row) =>
    Math.sqrt(row.reduce((sum, value, column) => sum + criteria[column].weight * (value - antiIdeal[column]) ** 2, 0)),
  );
  const scores = distanceToIdeal.map((positive, index) => distanceToAntiIdeal[index] / (positive + distanceToAntiIdeal[index] || 1));
  return result(method, { ...input, criteria }, [
    tableFromMatrix('normalized', 'WEDBA Normalized Matrix', normalized, input),
    tableFromMatrix('standardized', 'WEDBA Standardized Matrix', standardized, input),
    {
      id: 'wedba-reference-points',
      title: 'WEDBA Ideal and Anti-Ideal Points',
      columns: ['Reference', ...criteria.map((criterion) => criterion.id)],
      rows: [
        ['Ideal', ...ideal.map((value) => round(value))],
        ['Anti-ideal', ...antiIdeal.map((value) => round(value))],
      ],
    },
    {
      id: 'wedba-distances',
      title: 'WEDBA Distance and Performance Index',
      columns: ['Alternative', 'Distance to ideal', 'Distance to anti-ideal', 'Performance index'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, round(distanceToIdeal[index]), round(distanceToAntiIdeal[index]), round(scores[index])]),
    },
  ], scores, 'WEDBA ranks alternatives using weighted Euclidean distances to ideal and anti-ideal reference points after benefit/cost normalization and standardization.');
}

function runFuzzyWedba(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  const criteria = resolveCriteria(input, config);
  const fuzzyMatrix = input.fuzzyValues?.length
    ? input.fuzzyValues
    : input.values.map((row) => row.map((value) => crispFuzzy(value)));
  const normalized = fuzzyMatrix.map((row) => row.map((value, column) => {
    const columnValues = fuzzyMatrix.map((item) => item[column]);
    if (criteria[column].direction === 'benefit') {
      const maxUpper = Math.max(...columnValues.map((item) => Math.max(...item.values.map(Math.abs))), 1e-12);
      return divideFuzzyByScalar(value, maxUpper);
    }
    const minLower = Math.min(...columnValues.flatMap((item) => item.values.map((cell) => Math.max(Math.abs(cell), 1e-12))));
    return { values: value.values.map((cell) => minLower / Math.max(Math.abs(cell), 1e-12)).sort((a, b) => a - b), type: value.type };
  }));
  const centroidNormalized = normalized.map((row) => row.map(defuzzify));
  const means = criteria.map((_, column) => centroidNormalized.reduce((sum, row) => sum + row[column], 0) / centroidNormalized.length);
  const deviations = criteria.map((_, column) => {
    const variance = centroidNormalized.reduce((sum, row) => sum + (row[column] - means[column]) ** 2, 0) / centroidNormalized.length;
    return Math.sqrt(variance) || 1;
  });
  const standardized = normalized.map((row) => row.map((value, column) => {
    const shifted = value.values.map((component) => (component - means[column]) / deviations[column]).sort((a, b) => a - b);
    return { values: shifted, type: value.type };
  }));
  const ideal = criteria.map((_, column) => {
    const columnValues = standardized.map((row) => row[column]);
    return columnValues.reduce((best, value) => defuzzify(value) > defuzzify(best) ? value : best, columnValues[0]);
  });
  const antiIdeal = criteria.map((_, column) => {
    const columnValues = standardized.map((row) => row[column]);
    return columnValues.reduce((best, value) => defuzzify(value) < defuzzify(best) ? value : best, columnValues[0]);
  });
  const distanceToIdeal = standardized.map((row) =>
    Math.sqrt(row.reduce((sum, value, column) => sum + criteria[column].weight * fuzzyDistance(value, ideal[column]) ** 2, 0)),
  );
  const distanceToAntiIdeal = standardized.map((row) =>
    Math.sqrt(row.reduce((sum, value, column) => sum + criteria[column].weight * fuzzyDistance(value, antiIdeal[column]) ** 2, 0)),
  );
  const scores = distanceToIdeal.map((positive, index) => distanceToAntiIdeal[index] / (positive + distanceToAntiIdeal[index] || 1));
  const analysis = result(method, { ...input, criteria, fuzzyValues: fuzzyMatrix }, [
    {
      id: 'fuzzy-wedba-normalized',
      title: 'Fuzzy WEDBA Normalized Matrix',
      columns: ['Alternative', ...criteria.map((criterion) => criterion.id)],
      rows: normalized.map((row, index) => [input.alternatives[index].name, ...row.map((value) => fuzzyLabel(value))]),
    },
    {
      id: 'fuzzy-wedba-standardized',
      title: 'Fuzzy WEDBA Standardized Matrix',
      columns: ['Alternative', ...criteria.map((criterion) => criterion.id)],
      rows: standardized.map((row, index) => [input.alternatives[index].name, ...row.map((value) => fuzzyLabel(value))]),
    },
    {
      id: 'fuzzy-wedba-reference-points',
      title: 'Fuzzy WEDBA Ideal and Anti-Ideal Points',
      columns: ['Reference', ...criteria.map((criterion) => criterion.id)],
      rows: [
        ['Ideal', ...ideal.map((value) => fuzzyLabel(value))],
        ['Anti-ideal', ...antiIdeal.map((value) => fuzzyLabel(value))],
      ],
    },
    {
      id: 'fuzzy-wedba-distances',
      title: 'Fuzzy WEDBA Distance and Performance Index',
      columns: ['Alternative', 'Distance to ideal', 'Distance to anti-ideal', 'Performance index'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, round(distanceToIdeal[index]), round(distanceToAntiIdeal[index]), round(scores[index])]),
    },
  ], scores, 'Native fuzzy WEDBA preserves triangular/trapezoidal uploaded values through fuzzy benefit/cost normalization, centroid-based standardization, and fuzzy-distance ideal/anti-ideal performance scoring.');
  analysis.diagnostics.push({ label: 'Native fuzzy WEDBA', value: 'Fuzzy standardized matrix with ideal and anti-ideal distance scoring', status: 'pass' });
  analysis.reproducibility = { ...analysis.reproducibility, fuzzyMode: 'Native fuzzy WEDBA', fuzzyWedba: 'Fuzzy benefit/cost normalization, centroid standardization, vertex-distance ideal and anti-ideal performance index' };
  return analysis;
}

function runLmaw(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  if (config.methodParams.fuzzyInputMode === 'Native fuzzy LMAW') {
    return runFuzzyLmaw(input, config, method);
  }
  const criteria = resolveCriteria(input, config);
  const standardized = input.values.map((row) =>
    row.map((value, column) => {
      const values = input.values.map((item) => Math.max(Math.abs(item[column]), 1e-12));
      const safeValue = Math.max(Math.abs(value), 1e-12);
      const utility = criteria[column].direction === 'benefit'
        ? safeValue / Math.max(...values)
        : Math.min(...values) / safeValue;
      return 1 + utility;
    }),
  );
  const logNormalized = standardized.map((row) =>
    row.map((value, column) => {
      const denominator = standardized.reduce((sum, item) => sum + Math.log(Math.max(item[column], 1 + 1e-12)), 0) || 1;
      return Math.log(Math.max(value, 1 + 1e-12)) / denominator;
    }),
  );
  const lmawScoreMode = String(config.methodParams.lmawScoreMode ?? 'Nonlinear Q utility');
  const normalizedCriteria = normalizeWeights(criteria);
  const utilityMatrix = lmawScoreMode === 'Weighted log sum'
    ? weighted(logNormalized, criteria)
    : logNormalized.map((row) => row.map((value, column) => {
      const numerator = 2 * Math.max(value, 1e-12) ** normalizedCriteria[column].weight;
      const denominator = Math.max(2 - value, 1e-12) ** normalizedCriteria[column].weight + Math.max(value, 1e-12) ** normalizedCriteria[column].weight;
      return numerator / denominator;
    }));
  const scores = utilityMatrix.map((row) => row.reduce((sum, value) => sum + value, 0));
  return result(method, { ...input, criteria }, [
    tableFromMatrix('standardized', 'LMAW Positive Standardized Matrix', standardized, input),
    tableFromMatrix('log-normalized', 'LMAW Logarithmic Additive Matrix', logNormalized, input),
    tableFromMatrix('weighted', lmawScoreMode === 'Weighted log sum' ? 'LMAW Weighted Matrix' : 'LMAW Nonlinear Utility Matrix', utilityMatrix, input),
    {
      id: 'lmaw-index',
      title: 'LMAW Final Index',
      columns: ['Alternative', 'LMAW index', 'Ranking rule'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, round(scores[index]), 'Higher is better']),
    },
  ], scores, lmawScoreMode === 'Weighted log sum'
    ? 'LMAW ranks alternatives using logarithmic additive normalization of positive standardized criterion values and weighted aggregation.'
    : 'LMAW ranks alternatives using logarithmic normalization followed by the nonlinear Q utility transform from the original LMAW formulation.');
}

function runFuzzyLmaw(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  const criteria = resolveCriteria(input, config);
  const fuzzyMatrix = input.fuzzyValues?.length
    ? input.fuzzyValues
    : input.values.map((row) => row.map((value) => crispFuzzy(value)));
  const normalizedCriteria = normalizeWeights(criteria);
  const standardized = fuzzyMatrix.map((row) =>
    row.map((value, column) => {
      const columnValues = fuzzyMatrix.map((item) => item[column]);
      if (criteria[column].direction === 'cost') {
        const minLower = Math.min(...columnValues.map((item) => Math.max(Math.abs(item.values[0]), 1e-12)).filter(Number.isFinite));
        return { values: value.values.map((cell) => 1 + minLower / Math.max(Math.abs(cell), 1e-12)).reverse(), type: value.type } as FuzzyNumber;
      }
      const maxUpper = Math.max(...columnValues.map((item) => Math.max(Math.abs(item.values[item.values.length - 1]), 1e-12)).filter(Number.isFinite), 1e-12);
      return { values: value.values.map((cell) => 1 + Math.max(Math.abs(cell), 1e-12) / maxUpper), type: value.type };
    }),
  );
  const logNormalized = standardized.map((row) =>
    row.map((value, column) => {
      const denominator = standardized.reduce((sum, item) => sum + Math.log(Math.max(defuzzify(item[column]), 1 + 1e-12)), 0) || 1;
      return Math.log(Math.max(defuzzify(value), 1 + 1e-12)) / denominator;
    }),
  );
  const weightedMatrix = weighted(logNormalized, normalizedCriteria);
  const scores = weightedMatrix.map((row) => row.reduce((sum, value) => sum + value, 0));
  const analysis = result(method, { ...input, criteria: normalizedCriteria, fuzzyValues: fuzzyMatrix }, [
    {
      id: 'fuzzy-lmaw-standardized',
      title: 'Fuzzy LMAW Positive Standardized Matrix',
      columns: ['Alternative', ...criteria.map((criterion) => criterion.id)],
      rows: standardized.map((row, index) => [input.alternatives[index].name, ...row.map((value) => fuzzyLabel(value))]),
    },
    tableFromMatrix('fuzzy-lmaw-log-normalized', 'Fuzzy LMAW Logarithmic Additive Matrix', logNormalized, input),
    tableFromMatrix('fuzzy-lmaw-weighted', 'Fuzzy LMAW Weighted Matrix', weightedMatrix, input),
    {
      id: 'fuzzy-lmaw-index',
      title: 'Fuzzy LMAW Final Index',
      columns: ['Alternative', 'LMAW index', 'Ranking rule'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, round(scores[index]), 'Higher is better']),
    },
  ], scores, 'Native fuzzy LMAW preserves triangular/trapezoidal uploaded values through fuzzy positive standardization, derives centroid logarithmic additive values, and ranks alternatives by weighted LMAW index.');
  analysis.diagnostics.push({ label: 'Native fuzzy LMAW', value: 'Fuzzy positive standardization with centroid logarithmic additive scoring', status: 'pass' });
  analysis.reproducibility = { ...analysis.reproducibility, fuzzyMode: 'Native fuzzy LMAW', fuzzyLmaw: 'Fuzzy positive standardization, centroid logarithmic additive normalization, weighted LMAW index' };
  return analysis;
}

function runDnma(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  if (config.methodParams.fuzzyInputMode === 'Native fuzzy DNMA') {
    return runFuzzyDnma(input, config, method);
  }
  const criteria = resolveCriteria(input, config);
  const target = criteria.map((criterion, column) => {
    const values = input.values.map((row) => row[column]);
    return criterion.direction === 'benefit' ? Math.max(...values) : Math.min(...values);
  });
  const linear = input.values.map((row) =>
    row.map((value, column) => {
      const values = input.values.map((item) => item[column]);
      const denominator = Math.max(...values, target[column]) - Math.min(...values, target[column]);
      return 1 - Math.abs(value - target[column]) / (denominator || 1);
    }),
  );
  const vectorDenominators = criteria.map((_, column) =>
    Math.sqrt(input.values.reduce((sum, row) => sum + Math.abs(row[column] - target[column]) ** 2, 0)) || 1,
  );
  const vector = input.values.map((row) =>
    row.map((value, column) => 1 - Math.abs(value - target[column]) / vectorDenominators[column]),
  );
  const completeCompensatory = linear.map((row) => row.reduce((sum, value, column) => sum + value * criteria[column].weight, 0));
  const uncompensatory = linear.map((row) => row.reduce((product, value, column) => product * Math.max(value, 1e-9) ** criteria[column].weight, 1));
  const incompleteCompensatory = vector.map((row) => 1 - Math.sqrt(row.reduce((sum, value, column) => sum + criteria[column].weight * (1 - value) ** 2, 0)));
  const subordinate = [completeCompensatory, uncompensatory, incompleteCompensatory];
  const ranks = subordinate.map((scores) => rankScores(scores, input).reduce<Record<string, number>>((acc, row) => {
    acc[row.alternativeId] = row.rank;
    return acc;
  }, {}));
  const m = input.alternatives.length || 1;
  const scores = input.alternatives.map((alternative, index) =>
    subordinate.reduce((sum, values, modelIndex) => {
      const maxValue = Math.max(...values.map((value) => Math.abs(value)), 1e-12);
      const utilityComponent = values[index] / maxValue;
      const rankComponent = (m - (ranks[modelIndex][alternative.id] ?? m) + 1) / m;
      return sum + Math.sqrt(0.5 * (utilityComponent ** 2 + rankComponent ** 2));
    }, 0) / subordinate.length,
  );
  return result(method, { ...input, criteria }, [
    {
      id: 'dnma-targets',
      title: 'DNMA Target Values',
      columns: ['Criterion', 'Name', 'Direction', 'Target value'],
      rows: criteria.map((criterion, index) => [criterion.id, criterion.name, criterion.direction, round(target[index])]),
    },
    tableFromMatrix('linear-normalized', 'DNMA Target-Based Linear Normalization', linear, input),
    tableFromMatrix('vector-normalized', 'DNMA Target-Based Vector Normalization', vector, input),
    {
      id: 'dnma-subordinate-utilities',
      title: 'DNMA Subordinate Aggregation Utilities',
      columns: ['Alternative', 'Complete compensatory', 'Uncompensatory', 'Incomplete compensatory', 'Integrated DNMA score'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, round(completeCompensatory[index]), round(uncompensatory[index]), round(incompleteCompensatory[index]), round(scores[index])]),
    },
  ], scores, 'DNMA ranks alternatives by combining target-based linear and vector normalization with complete, uncompensatory, and incomplete compensatory aggregation utilities.');
}

function runFuzzyDnma(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  const criteria = resolveCriteria(input, config);
  const fuzzyMatrix = input.fuzzyValues?.length
    ? input.fuzzyValues
    : input.values.map((row) => row.map((value) => crispFuzzy(value)));
  const normalizedCriteria = normalizeWeights(criteria);
  const target = normalizedCriteria.map((criterion, column) => {
    const values = fuzzyMatrix.map((row) => row[column]);
    return criterion.direction === 'benefit'
      ? values.reduce((best, value) => defuzzify(value) > defuzzify(best) ? value : best, values[0])
      : values.reduce((best, value) => defuzzify(value) < defuzzify(best) ? value : best, values[0]);
  });
  const maxDistance = normalizedCriteria.map((_, column) =>
    Math.max(...fuzzyMatrix.map((row) => fuzzyDistance(row[column], target[column])), 1e-9),
  );
  const linear = fuzzyMatrix.map((row) => row.map((value, column) => 1 - fuzzyDistance(value, target[column]) / maxDistance[column]));
  const vectorDenominators = normalizedCriteria.map((_, column) =>
    Math.sqrt(fuzzyMatrix.reduce((sum, row) => sum + fuzzyDistance(row[column], target[column]) ** 2, 0)) || 1,
  );
  const vector = fuzzyMatrix.map((row) => row.map((value, column) => 1 - fuzzyDistance(value, target[column]) / vectorDenominators[column]));
  const completeCompensatory = linear.map((row) => row.reduce((sum, value, column) => sum + value * normalizedCriteria[column].weight, 0));
  const uncompensatory = linear.map((row) => row.reduce((product, value, column) => product * Math.max(value, 1e-9) ** normalizedCriteria[column].weight, 1));
  const incompleteCompensatory = vector.map((row) => 1 - Math.sqrt(row.reduce((sum, value, column) => sum + normalizedCriteria[column].weight * (1 - value) ** 2, 0)));
  const subordinate = [completeCompensatory, uncompensatory, incompleteCompensatory];
  const rankedInput = { ...input, criteria: normalizedCriteria };
  const ranks = subordinate.map((scores) => rankScores(scores, rankedInput).reduce<Record<string, number>>((acc, row) => {
    acc[row.alternativeId] = row.rank;
    return acc;
  }, {}));
  const m = input.alternatives.length || 1;
  const scores = input.alternatives.map((alternative, index) =>
    subordinate.reduce((sum, values, modelIndex) => {
      const maxValue = Math.max(...values.map((value) => Math.abs(value)), 1e-12);
      const utilityComponent = values[index] / maxValue;
      const rankComponent = (m - (ranks[modelIndex][alternative.id] ?? m) + 1) / m;
      return sum + Math.sqrt(0.5 * (utilityComponent ** 2 + rankComponent ** 2));
    }, 0) / subordinate.length,
  );
  const analysis = result(method, { ...input, criteria: normalizedCriteria, fuzzyValues: fuzzyMatrix }, [
    {
      id: 'fuzzy-dnma-targets',
      title: 'Fuzzy DNMA Target Values',
      columns: ['Criterion', 'Name', 'Direction', 'Fuzzy target'],
      rows: normalizedCriteria.map((criterion, index) => [criterion.id, criterion.name, criterion.direction, fuzzyLabel(target[index])]),
    },
    tableFromMatrix('fuzzy-dnma-linear-normalized', 'Fuzzy DNMA Target-Based Linear Normalization', linear, input),
    tableFromMatrix('fuzzy-dnma-vector-normalized', 'Fuzzy DNMA Target-Based Vector Normalization', vector, input),
    {
      id: 'fuzzy-dnma-subordinate-utilities',
      title: 'Fuzzy DNMA Subordinate Aggregation Utilities',
      columns: ['Alternative', 'Complete compensatory', 'Uncompensatory', 'Incomplete compensatory', 'Integrated DNMA score'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, round(completeCompensatory[index]), round(uncompensatory[index]), round(incompleteCompensatory[index]), round(scores[index])]),
    },
  ], scores, 'Native fuzzy DNMA preserves triangular/trapezoidal uploaded values, selects fuzzy target references, applies fuzzy-distance linear and vector normalization, and integrates compensatory utility and rank components.');
  analysis.diagnostics.push({ label: 'Native fuzzy DNMA', value: 'Fuzzy target references with double-normalization aggregation', status: 'pass' });
  analysis.reproducibility = { ...analysis.reproducibility, fuzzyMode: 'Native fuzzy DNMA', fuzzyDnma: 'Fuzzy target references, vertex-distance linear/vector normalization, integrated utility-rank aggregation' };
  return analysis;
}

function runProbid(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  if (config.methodParams.fuzzyInputMode === 'Native fuzzy PROBID') {
    return runFuzzyProbid(input, config, method);
  }
  const criteria = resolveCriteria(input, config);
  const normalized = vectorNormalize(input.values);
  const weightedMatrix = weighted(normalized, criteria);
  const orderedReferenceSolutions = input.alternatives.map((_, rankIndex) =>
    criteria.map((criterion, column) => {
      const values = weightedMatrix.map((row) => row[column]).sort((a, b) => criterion.direction === 'benefit' ? b - a : a - b);
      return values[rankIndex] ?? values[values.length - 1] ?? 0;
    }),
  );
  const average = criteria.map((_, column) => weightedMatrix.reduce((sum, row) => sum + row[column], 0) / weightedMatrix.length);
  const distanceToReferences = weightedMatrix.map((row) => orderedReferenceSolutions.map((reference) => distance(row, reference)));
  const distanceToAverage = weightedMatrix.map((row) => distance(row, average));
  const alternativeCount = Math.max(input.alternatives.length, 1);
  const positiveLimit = alternativeCount % 2 === 0 ? alternativeCount / 2 : (alternativeCount + 1) / 2;
  const negativeStart = alternativeCount % 2 === 0 ? alternativeCount / 2 + 1 : (alternativeCount + 1) / 2;
  const positiveDistances = distanceToReferences.map((row) =>
    row.reduce((sum, value, index) => index + 1 <= positiveLimit ? sum + value / (index + 1) : sum, 0),
  );
  const negativeDistances = distanceToReferences.map((row) =>
    row.reduce((sum, value, index) => index + 1 >= negativeStart ? sum + value / (alternativeCount - index) : sum, 0),
  );
  const ratios = positiveDistances.map((value, index) => value / Math.max(negativeDistances[index], 1e-12));
  const scores = ratios.map((ratio, index) => 1 / (1 + ratio ** 2) + distanceToAverage[index]);
  return result(method, { ...input, criteria }, [
    tableFromMatrix('normalized', 'PROBID Vector Normalized Matrix', normalized, input),
    tableFromMatrix('weighted', 'PROBID Weighted Normalized Matrix', weightedMatrix, input),
    {
      id: 'probid-reference-points',
      title: 'PROBID Reference Solutions',
      columns: ['Reference', ...criteria.map((criterion) => criterion.id)],
      rows: [
        ['1st positive ideal', ...orderedReferenceSolutions[0].map((value) => round(value))],
        ['Average', ...average.map((value) => round(value))],
        ['Last negative ideal', ...orderedReferenceSolutions[orderedReferenceSolutions.length - 1].map((value) => round(value))],
      ],
    },
    {
      id: 'probid-distances',
      title: 'PROBID Distances and Preference Index',
      columns: ['Alternative', 'Positive ideal distance', 'Negative ideal distance', 'Average distance', 'Positive/negative ratio', 'Preference index'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, round(positiveDistances[index]), round(negativeDistances[index]), round(distanceToAverage[index]), round(ratios[index]), round(scores[index])]),
    },
  ], scores, 'PROBID ranks alternatives using ordered positive ideal solutions, average distance, and weighted positive/negative ideal distance aggregation.');
}

function runSprobid(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  if (config.methodParams.fuzzyInputMode === 'Native fuzzy SPROBID') {
    return runFuzzySprobid(input, config, method);
  }
  const criteria = resolveCriteria(input, config);
  const normalized = vectorNormalize(input.values);
  const weightedMatrix = weighted(normalized, criteria);
  const orderedReferenceSolutions = input.alternatives.map((_, rankIndex) =>
    criteria.map((criterion, column) => {
      const values = weightedMatrix.map((row) => row[column]).sort((a, b) => criterion.direction === 'benefit' ? b - a : a - b);
      return values[rankIndex] ?? values[values.length - 1] ?? 0;
    }),
  );
  const distanceToReferences = weightedMatrix.map((row) => orderedReferenceSolutions.map((reference) => distance(row, reference)));
  const alternativeCount = Math.max(input.alternatives.length, 1);
  let positiveDistances: number[];
  let negativeDistances: number[];
  if (alternativeCount >= 4) {
    const quarter = Math.floor(alternativeCount / 4);
    positiveDistances = distanceToReferences.map((row) =>
      row.reduce((sum, value, index) => index < quarter ? sum + value / (index + 1) : sum, 0),
    );
    negativeDistances = distanceToReferences.map((row) =>
      row.reduce((sum, value, index) => index >= alternativeCount - quarter ? sum + value / (alternativeCount - index) : sum, 0),
    );
  } else {
    positiveDistances = distanceToReferences.map((row) => row[0] ?? 0);
    negativeDistances = distanceToReferences.map((row) => row[alternativeCount - 1] ?? 0);
  }
  const scores = negativeDistances.map((value, index) => value / Math.max(positiveDistances[index], 1e-12));
  const positiveBoundaryIndex = Math.max(0, Math.floor(alternativeCount / 4) - 1);
  const negativeBoundaryIndex = Math.min(orderedReferenceSolutions.length - 1, Math.max(0, alternativeCount - Math.floor(alternativeCount / 4)));
  return result(method, { ...input, criteria }, [
    tableFromMatrix('normalized', 'SPROBID Vector Normalized Matrix', normalized, input),
    tableFromMatrix('weighted', 'SPROBID Weighted Normalized Matrix', weightedMatrix, input),
    {
      id: 'sprobid-reference-points',
      title: 'SPROBID Reference Solutions',
      columns: ['Reference', ...criteria.map((criterion) => criterion.id)],
      rows: [
        ['1st positive ideal', ...orderedReferenceSolutions[0].map((value) => round(value))],
        ['Quarter positive boundary', ...orderedReferenceSolutions[positiveBoundaryIndex].map((value) => round(value))],
        ['Quarter negative boundary', ...orderedReferenceSolutions[negativeBoundaryIndex].map((value) => round(value))],
        ['Last negative ideal', ...orderedReferenceSolutions[orderedReferenceSolutions.length - 1].map((value) => round(value))],
      ],
    },
    {
      id: 'sprobid-distances',
      title: 'SPROBID Distances and Preference Index',
      columns: ['Alternative', 'Overall positive-ideal distance', 'Overall negative-ideal distance', 'Preference index'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, round(positiveDistances[index]), round(negativeDistances[index]), round(scores[index])]),
    },
  ], scores, 'SPROBID is the simplified PROBID variant that ranks alternatives using weighted vector-normalized distances to the first and last quarters of ordered ideal reference solutions.');
}

function runFuzzySprobid(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  const criteria = normalizeWeights(resolveCriteria(input, config));
  const fuzzyMatrix = activeFuzzyMatrix(input);
  const normalized = fuzzyVectorNormalizeMatrix(fuzzyMatrix);
  const weightedFuzzy = normalized.map((row) => row.map((value, column) => scaleFuzzy(value, criteria[column].weight)));
  const orderedReferenceSolutions = input.alternatives.map((_, rankIndex) =>
    criteria.map((criterion, column) => {
      const values = weightedFuzzy.map((row) => row[column]).sort((a, b) => criterion.direction === 'benefit' ? defuzzify(b) - defuzzify(a) : defuzzify(a) - defuzzify(b));
      return values[rankIndex] ?? values[values.length - 1] ?? crispFuzzy(0);
    }),
  );
  const distanceToReferences = weightedFuzzy.map((row) => orderedReferenceSolutions.map((reference) =>
    Math.sqrt(row.reduce((sum, value, column) => sum + fuzzyDistance(value, reference[column]) ** 2, 0)),
  ));
  const alternativeCount = Math.max(input.alternatives.length, 1);
  let positiveDistances: number[];
  let negativeDistances: number[];
  if (alternativeCount >= 4) {
    const quarter = Math.floor(alternativeCount / 4);
    positiveDistances = distanceToReferences.map((row) =>
      row.reduce((sum, value, index) => index < quarter ? sum + value / (index + 1) : sum, 0),
    );
    negativeDistances = distanceToReferences.map((row) =>
      row.reduce((sum, value, index) => index >= alternativeCount - quarter ? sum + value / (alternativeCount - index) : sum, 0),
    );
  } else {
    positiveDistances = distanceToReferences.map((row) => row[0] ?? 0);
    negativeDistances = distanceToReferences.map((row) => row[alternativeCount - 1] ?? 0);
  }
  const scores = negativeDistances.map((value, index) => value / Math.max(positiveDistances[index], 1e-12));
  const positiveBoundaryIndex = Math.max(0, Math.floor(alternativeCount / 4) - 1);
  const negativeBoundaryIndex = Math.min(orderedReferenceSolutions.length - 1, Math.max(0, alternativeCount - Math.floor(alternativeCount / 4)));
  const analysis = result(method, { ...input, criteria, fuzzyValues: fuzzyMatrix }, [
    fuzzyDecisionMatrixRows('Fuzzy SPROBID Vector Normalized Matrix', 'fuzzy-sprobid-normalized', normalized, input),
    fuzzyDecisionMatrixRows('Fuzzy SPROBID Weighted Normalized Matrix', 'fuzzy-sprobid-weighted', weightedFuzzy, input),
    {
      id: 'fuzzy-sprobid-reference-points',
      title: 'Fuzzy SPROBID Reference Solutions',
      columns: ['Reference', ...criteria.map((criterion) => criterion.id)],
      rows: [
        ['1st positive ideal', ...orderedReferenceSolutions[0].map((value) => fuzzyLabel(value))],
        ['Quarter positive boundary', ...orderedReferenceSolutions[positiveBoundaryIndex].map((value) => fuzzyLabel(value))],
        ['Quarter negative boundary', ...orderedReferenceSolutions[negativeBoundaryIndex].map((value) => fuzzyLabel(value))],
        ['Last negative ideal', ...orderedReferenceSolutions[orderedReferenceSolutions.length - 1].map((value) => fuzzyLabel(value))],
      ],
    },
    {
      id: 'fuzzy-sprobid-distances',
      title: 'Fuzzy SPROBID Distances and Preference Index',
      columns: ['Alternative', 'Overall positive-ideal distance', 'Overall negative-ideal distance', 'Preference index'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, round(positiveDistances[index]), round(negativeDistances[index]), round(scores[index])]),
    },
  ], scores, 'Native fuzzy SPROBID preserves triangular/trapezoidal uploaded values through fuzzy vector normalization, fuzzy weighting, ordered fuzzy reference solutions, and simplified quarter-distance aggregation.');
  analysis.diagnostics.push({ label: 'Native fuzzy SPROBID', value: 'Fuzzy ordered quarter-reference distance preference index', status: 'pass' });
  analysis.reproducibility = { ...analysis.reproducibility, fuzzyMode: 'Native fuzzy SPROBID', fuzzySprobid: 'Fuzzy vector normalization/weighting with ordered quarter-reference distance aggregation' };
  return analysis;
}

function runFuzzyProbid(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  const criteria = resolveCriteria(input, config);
  const fuzzyMatrix = input.fuzzyValues?.length
    ? input.fuzzyValues
    : input.values.map((row) => row.map((value) => crispFuzzy(value)));
  const normalizedCriteria = normalizeWeights(criteria);
  const normalized = fuzzyMatrix.map((row) => row.map((value, column) => {
    const denominator = Math.sqrt(fuzzyMatrix.reduce((sum, item) => sum + defuzzify(item[column]) ** 2, 0)) || 1;
    return { values: value.values.map((cell) => cell / denominator), type: value.type };
  }));
  const weightedFuzzy = normalized.map((row) => row.map((value, column) => scaleFuzzy(value, normalizedCriteria[column].weight)));
  const orderedReferenceSolutions = input.alternatives.map((_, rankIndex) =>
    normalizedCriteria.map((criterion, column) => {
      const values = weightedFuzzy.map((row) => row[column]).sort((a, b) => criterion.direction === 'benefit' ? defuzzify(b) - defuzzify(a) : defuzzify(a) - defuzzify(b));
      return values[rankIndex] ?? values[values.length - 1] ?? crispFuzzy(0);
    }),
  );
  const average = normalizedCriteria.map((_, column) => {
    const values = weightedFuzzy.map((row) => row[column]);
    const size = Math.max(...values.map((value) => value.values.length));
    const averaged = Array.from({ length: size }, (_, component) =>
      values.reduce((sum, value) => {
        const expanded = value.values.length === size
          ? value.values
          : value.values.length === 3 && size === 4
            ? [value.values[0], value.values[1], value.values[1], value.values[2]]
            : value.values.length === 4 && size === 3
              ? [value.values[0], (value.values[1] + value.values[2]) / 2, value.values[3]]
              : value.values;
        return sum + (expanded[component] ?? expanded[expanded.length - 1] ?? 0);
      }, 0) / values.length,
    );
    return { values: averaged, type: size === 4 ? 'trapezoidal' : 'triangular' } as FuzzyNumber;
  });
  const distanceToReferences = weightedFuzzy.map((row) => orderedReferenceSolutions.map((reference) =>
    Math.sqrt(row.reduce((sum, value, column) => sum + fuzzyDistance(value, reference[column]) ** 2, 0)),
  ));
  const distanceToAverage = weightedFuzzy.map((row) => Math.sqrt(row.reduce((sum, value, column) => sum + fuzzyDistance(value, average[column]) ** 2, 0)));
  const alternativeCount = Math.max(input.alternatives.length, 1);
  const positiveLimit = alternativeCount % 2 === 0 ? alternativeCount / 2 : (alternativeCount + 1) / 2;
  const negativeStart = alternativeCount % 2 === 0 ? alternativeCount / 2 + 1 : (alternativeCount + 1) / 2;
  const positiveDistances = distanceToReferences.map((row) =>
    row.reduce((sum, value, index) => index + 1 <= positiveLimit ? sum + value / (index + 1) : sum, 0),
  );
  const negativeDistances = distanceToReferences.map((row) =>
    row.reduce((sum, value, index) => index + 1 >= negativeStart ? sum + value / (alternativeCount - index) : sum, 0),
  );
  const ratios = positiveDistances.map((value, index) => value / Math.max(negativeDistances[index], 1e-12));
  const scores = ratios.map((ratio, index) => 1 / (1 + ratio ** 2) + distanceToAverage[index]);
  const analysis = result(method, { ...input, criteria: normalizedCriteria, fuzzyValues: fuzzyMatrix }, [
    {
      id: 'fuzzy-probid-normalized',
      title: 'Fuzzy PROBID Vector Normalized Matrix',
      columns: ['Alternative', ...criteria.map((criterion) => criterion.id)],
      rows: normalized.map((row, index) => [input.alternatives[index].name, ...row.map((value) => fuzzyLabel(value))]),
    },
    {
      id: 'fuzzy-probid-weighted',
      title: 'Fuzzy PROBID Weighted Normalized Matrix',
      columns: ['Alternative', ...criteria.map((criterion) => criterion.id)],
      rows: weightedFuzzy.map((row, index) => [input.alternatives[index].name, ...row.map((value) => fuzzyLabel(value))]),
    },
    {
      id: 'fuzzy-probid-reference-points',
      title: 'Fuzzy PROBID Reference Solutions',
      columns: ['Reference', ...criteria.map((criterion) => criterion.id)],
      rows: [
        ['1st positive ideal', ...orderedReferenceSolutions[0].map((value) => fuzzyLabel(value))],
        ['Average', ...average.map((value) => fuzzyLabel(value))],
        ['Last negative ideal', ...orderedReferenceSolutions[orderedReferenceSolutions.length - 1].map((value) => fuzzyLabel(value))],
      ],
    },
    {
      id: 'fuzzy-probid-distances',
      title: 'Fuzzy PROBID Distances and Preference Index',
      columns: ['Alternative', 'Positive ideal distance', 'Negative ideal distance', 'Average distance', 'Positive/negative ratio', 'Preference index'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, round(positiveDistances[index]), round(negativeDistances[index]), round(distanceToAverage[index]), round(ratios[index]), round(scores[index])]),
    },
  ], scores, 'Native fuzzy PROBID preserves triangular/trapezoidal uploaded values through fuzzy vector normalization and weighting, then ranks alternatives using ordered fuzzy positive ideal solutions, average distance, and fuzzy positive/negative distance aggregation.');
  analysis.diagnostics.push({ label: 'Native fuzzy PROBID', value: 'Fuzzy ideal-average-anti-ideal distance preference index', status: 'pass' });
  analysis.reproducibility = { ...analysis.reproducibility, fuzzyMode: 'Native fuzzy PROBID', fuzzyProbid: 'Fuzzy vector normalization/weighting with ordered vertex-distance positive and negative ideal aggregation' };
  return analysis;
}

function runRim(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  if (config.methodParams.fuzzyInputMode === 'Native fuzzy RIM') {
    return runFuzzyRim(input, config, method);
  }
  const criteria = resolveCriteria(input, config);
  const usesManualInterval = config.methodParams.rimReference === 'Manual ideal interval';
  const manualDomainLower = parseNumberList(config.methodParams.rimDomainLower, criteria.length, Number.NaN);
  const manualDomainUpper = parseNumberList(config.methodParams.rimDomainUpper, criteria.length, Number.NaN);
  const bounds = criteria.map((_, column) => {
    const values = input.values.map((row) => row[column]);
    const observedMin = Math.min(...values);
    const observedMax = Math.max(...values);
    const domainLower = manualDomainLower[column];
    const domainUpper = manualDomainUpper[column];
    return {
      min: usesManualInterval && Number.isFinite(domainLower) ? domainLower : observedMin,
      max: usesManualInterval && Number.isFinite(domainUpper) ? domainUpper : observedMax,
    };
  });
  const manualLower = parseNumberList(config.methodParams.rimIdealLower, criteria.length, 0);
  const manualUpper = parseNumberList(config.methodParams.rimIdealUpper, criteria.length, 1);
  const idealIntervals = criteria.map((criterion, index) => {
    if (usesManualInterval) return { min: manualLower[index], max: manualUpper[index] };
    const ideal = criterion.direction === 'benefit' ? bounds[index].max : bounds[index].min;
    return { min: ideal, max: ideal };
  });
  const normalizedCloseness = input.values.map((row) =>
    row.map((value, column) => {
      const interval = idealIntervals[column];
      if (value >= interval.min && value <= interval.max) return 1;
      if (value < interval.min) {
        const span = interval.min - bounds[column].min;
        return span <= 1e-12 ? 0 : (value - bounds[column].min) / span;
      }
      const span = bounds[column].max - interval.max;
      return span <= 1e-12 ? 0 : (bounds[column].max - value) / span;
    }),
  );
  const weightedCloseness = weighted(normalizedCloseness, criteria);
  const weights = criteria.map((criterion) => criterion.weight);
  const rimDistances = weightedCloseness.map((row) => {
    const positiveDistance = Math.sqrt(row.reduce((sum, value, index) => sum + (value - weights[index]) ** 2, 0));
    const negativeDistance = Math.sqrt(row.reduce((sum, value) => sum + value ** 2, 0));
    const score = negativeDistance + positiveDistance <= 1e-12 ? 0 : negativeDistance / (negativeDistance + positiveDistance);
    return { positiveDistance, negativeDistance, score };
  });
  const scores = rimDistances.map((row) => row.score);
  return result(method, { ...input, criteria }, [
    {
      id: 'rim-intervals',
      title: 'RIM Bounds and Reference Ideal Intervals',
      columns: ['Criterion', 'Name', 'Direction', 'Observed lower', 'Observed upper', 'Ideal lower', 'Ideal upper', 'Reference mode'],
      rows: criteria.map((criterion, index) => [criterion.id, criterion.name, criterion.direction, round(bounds[index].min), round(bounds[index].max), round(idealIntervals[index].min), round(idealIntervals[index].max), usesManualInterval ? 'Manual ideal interval' : 'Observed ideal point']),
    },
    tableFromMatrix('rim-closeness', 'RIM Normalized Closeness Matrix', normalizedCloseness, input),
    tableFromMatrix('weighted-rim-closeness', 'RIM Weighted Closeness Matrix', weightedCloseness, input),
    {
      id: 'rim-distance-index',
      title: 'RIM Distance and Reference-Ideal Index',
      columns: ['Alternative', 'Distance to reference ideal', 'Distance to anti-ideal', 'RIM R index', 'Ranking rule'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, round(rimDistances[index].positiveDistance), round(rimDistances[index].negativeDistance), round(scores[index]), 'Higher is better']),
    },
  ], scores, 'RIM ranks alternatives by normalizing each criterion against a declared domain and reference ideal interval, then calculating the reference-ideal R index from weighted distance to the ideal and anti-ideal vectors.');
}

function runFuzzyRim(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  const criteria = resolveCriteria(input, config);
  const fuzzyMatrix = input.fuzzyValues?.length
    ? input.fuzzyValues
    : input.values.map((row) => row.map((value) => crispFuzzy(value)));
  const normalizedCriteria = normalizeWeights(criteria);
  const usesManualInterval = config.methodParams.rimReference === 'Manual ideal interval';
  const manualDomainLower = parseNumberList(config.methodParams.rimDomainLower, normalizedCriteria.length, Number.NaN);
  const manualDomainUpper = parseNumberList(config.methodParams.rimDomainUpper, normalizedCriteria.length, Number.NaN);
  const bounds = normalizedCriteria.map((_, column) => {
    const values = fuzzyMatrix.map((row) => row[column]);
    const observedMin = Math.min(...values.map((value) => value.values[0]).filter(Number.isFinite));
    const observedMax = Math.max(...values.map((value) => value.values[value.values.length - 1]).filter(Number.isFinite));
    return {
      min: usesManualInterval && Number.isFinite(manualDomainLower[column]) ? manualDomainLower[column] : observedMin,
      max: usesManualInterval && Number.isFinite(manualDomainUpper[column]) ? manualDomainUpper[column] : observedMax,
    };
  });
  const manualLower = parseNumberList(config.methodParams.rimIdealLower, normalizedCriteria.length, 0);
  const manualUpper = parseNumberList(config.methodParams.rimIdealUpper, normalizedCriteria.length, 1);
  const idealIntervals = normalizedCriteria.map((criterion, index) => {
    if (usesManualInterval) return { min: manualLower[index], max: manualUpper[index] };
    const ideal = criterion.direction === 'benefit' ? bounds[index].max : bounds[index].min;
    return { min: ideal, max: ideal };
  });
  const normalizedCloseness = fuzzyMatrix.map((row) =>
    row.map((value, column) => {
      const center = defuzzify(value);
      const interval = idealIntervals[column];
      if (center >= interval.min && center <= interval.max) return 1;
      if (center < interval.min) {
        const span = interval.min - bounds[column].min;
        return span <= 1e-12 ? 0 : (center - bounds[column].min) / span;
      }
      const span = bounds[column].max - interval.max;
      return span <= 1e-12 ? 0 : (bounds[column].max - center) / span;
    }),
  );
  const weightedCloseness = weighted(normalizedCloseness, normalizedCriteria);
  const weights = normalizedCriteria.map((criterion) => criterion.weight);
  const rimDistances = weightedCloseness.map((row) => {
    const positiveDistance = Math.sqrt(row.reduce((sum, value, index) => sum + (value - weights[index]) ** 2, 0));
    const negativeDistance = Math.sqrt(row.reduce((sum, value) => sum + value ** 2, 0));
    const score = negativeDistance + positiveDistance <= 1e-12 ? 0 : negativeDistance / (negativeDistance + positiveDistance);
    return { positiveDistance, negativeDistance, score };
  });
  const scores = rimDistances.map((row) => row.score);
  const analysis = result(method, { ...input, criteria: normalizedCriteria, fuzzyValues: fuzzyMatrix }, [
    {
      id: 'fuzzy-rim-intervals',
      title: 'Fuzzy RIM Bounds and Reference Ideal Intervals',
      columns: ['Criterion', 'Name', 'Direction', 'Observed lower', 'Observed upper', 'Ideal lower', 'Ideal upper', 'Reference mode'],
      rows: normalizedCriteria.map((criterion, index) => [criterion.id, criterion.name, criterion.direction, round(bounds[index].min), round(bounds[index].max), round(idealIntervals[index].min), round(idealIntervals[index].max), usesManualInterval ? 'Manual ideal interval' : 'Observed ideal point']),
    },
    tableFromMatrix('fuzzy-rim-closeness', 'Fuzzy RIM Normalized Closeness Matrix', normalizedCloseness, input),
    tableFromMatrix('fuzzy-rim-weighted-closeness', 'Fuzzy RIM Weighted Closeness Matrix', weightedCloseness, input),
    {
      id: 'fuzzy-rim-distance-index',
      title: 'Fuzzy RIM Distance and Reference-Ideal Index',
      columns: ['Alternative', 'Distance to reference ideal', 'Distance to anti-ideal', 'RIM R index', 'Ranking rule'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, round(rimDistances[index].positiveDistance), round(rimDistances[index].negativeDistance), round(scores[index]), 'Higher is better']),
    },
  ], scores, 'Native fuzzy RIM preserves triangular/trapezoidal uploaded values, derives fuzzy observed bounds or manual reference intervals, and ranks alternatives by a centroid-based reference-ideal R index.');
  analysis.diagnostics.push({ label: 'Native fuzzy RIM', value: `${usesManualInterval ? 'Manual' : 'Observed'} ideal interval closeness from fuzzy values`, status: 'pass' });
  analysis.reproducibility = { ...analysis.reproducibility, fuzzyMode: 'Native fuzzy RIM', fuzzyRim: 'Fuzzy observed bounds/manual ideal intervals with defuzzified piecewise closeness scoring', rimReference: usesManualInterval ? 'Manual ideal interval' : 'Observed ideal point' };
  return analysis;
}

function runRafsi(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  if (config.methodParams.fuzzyInputMode === 'Native fuzzy RAFSI') {
    return runFuzzyRafsi(input, config, method);
  }
  const criteria = resolveCriteria(input, config);
  const lower = Number(config.methodParams.rafsiIntervalLower ?? 1);
  const upper = Number(config.methodParams.rafsiIntervalUpper ?? 6);
  const intervalLower = Number.isFinite(lower) && lower > 0 ? lower : 1;
  const intervalUpper = Number.isFinite(upper) && upper > intervalLower ? upper : 6;
  const usesManualReferences = config.methodParams.rafsiReferenceMode === 'Manual reference values';
  const manualIdealValues = parseNumberList(config.methodParams.rafsiIdealValues, criteria.length, Number.NaN);
  const manualAntiIdealValues = parseNumberList(config.methodParams.rafsiAntiIdealValues, criteria.length, Number.NaN);
  const references = criteria.map((criterion, column) => {
    const values = input.values.map((row) => row[column]);
    const observedMin = Math.min(...values);
    const observedMax = Math.max(...values);
    const manualIdeal = manualIdealValues[column];
    const manualAntiIdeal = manualAntiIdealValues[column];
    return {
      antiIdeal: usesManualReferences && Number.isFinite(manualAntiIdeal) ? manualAntiIdeal : criterion.direction === 'benefit' ? observedMin : observedMax,
      ideal: usesManualReferences && Number.isFinite(manualIdeal) ? manualIdeal : criterion.direction === 'benefit' ? observedMax : observedMin,
      observedMin,
      observedMax,
    };
  });
  const mapped = input.values.map((row) =>
    row.map((value, column) => {
      const reference = references[column];
      const range = Math.abs(reference.ideal - reference.antiIdeal);
      if (range <= 1e-12) return intervalUpper;
      const ratio = criteria[column].direction === 'benefit'
        ? (value - reference.antiIdeal) / (reference.ideal - reference.antiIdeal)
        : (value - reference.ideal) / (reference.antiIdeal - reference.ideal);
      return Math.min(intervalUpper, Math.max(intervalLower, intervalLower + ratio * (intervalUpper - intervalLower)));
    }),
  );
  const arithmeticMean = (intervalLower + intervalUpper) / 2;
  const harmonicMean = 2 / ((1 / intervalLower) + (1 / intervalUpper));
  const normalized = mapped.map((row) => row.map((value, column) =>
    criteria[column].direction === 'benefit'
      ? value / (2 * arithmeticMean)
      : harmonicMean / (2 * Math.max(value, 1e-9)),
  ));
  const weightedMapped = weighted(normalized, criteria);
  const scores = weightedMapped.map((row) => row.reduce((sum, value) => sum + value, 0));
  return result(method, { ...input, criteria }, [
    {
      id: 'rafsi-reference-values',
      title: 'RAFSI Reference Values and Mapping Interval',
      columns: ['Criterion', 'Name', 'Direction', 'Observed lower', 'Observed upper', 'Anti-ideal', 'Ideal', 'Interval lower', 'Interval upper'],
      rows: criteria.map((criterion, index) => [criterion.id, criterion.name, criterion.direction, round(references[index].observedMin), round(references[index].observedMax), round(references[index].antiIdeal), round(references[index].ideal), round(intervalLower), round(intervalUpper)]),
    },
    tableFromMatrix('rafsi-mapped', 'RAFSI Functional Mapping Matrix', mapped, input),
    tableFromMatrix('rafsi-normalized', 'RAFSI Normalized Matrix', normalized, input),
    tableFromMatrix('rafsi-weighted', 'RAFSI Weighted Matrix', weightedMapped, input),
    {
      id: 'rafsi-score',
      title: 'RAFSI Final Scores',
      columns: ['Alternative', 'RAFSI score', 'Ranking rule'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, round(scores[index]), 'Higher is better']),
    },
  ], scores, 'RAFSI ranks alternatives by functionally mapping benefit and cost criteria into a common interval from observed or manual ideal and anti-ideal references, applying arithmetic/harmonic interval normalization, and aggregating weighted utilities.');
}

function runFuzzyRafsi(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  const criteria = resolveCriteria(input, config);
  const fuzzyMatrix = input.fuzzyValues?.length
    ? input.fuzzyValues
    : input.values.map((row) => row.map((value) => crispFuzzy(value)));
  const normalizedCriteria = normalizeWeights(criteria);
  const lower = Number(config.methodParams.rafsiIntervalLower ?? 1);
  const upper = Number(config.methodParams.rafsiIntervalUpper ?? 6);
  const intervalLower = Number.isFinite(lower) && lower > 0 ? lower : 1;
  const intervalUpper = Number.isFinite(upper) && upper > intervalLower ? upper : 6;
  const usesManualReferences = config.methodParams.rafsiReferenceMode === 'Manual reference values';
  const manualIdealValues = parseNumberList(config.methodParams.rafsiIdealValues, normalizedCriteria.length, Number.NaN);
  const manualAntiIdealValues = parseNumberList(config.methodParams.rafsiAntiIdealValues, normalizedCriteria.length, Number.NaN);
  const references = normalizedCriteria.map((criterion, column) => {
    const values = fuzzyMatrix.map((row) => row[column]);
    const observedMin = Math.min(...values.map((value) => value.values[0]).filter(Number.isFinite));
    const observedMax = Math.max(...values.map((value) => value.values[value.values.length - 1]).filter(Number.isFinite));
    const manualIdeal = manualIdealValues[column];
    const manualAntiIdeal = manualAntiIdealValues[column];
    return {
      antiIdeal: usesManualReferences && Number.isFinite(manualAntiIdeal) ? manualAntiIdeal : criterion.direction === 'benefit' ? observedMin : observedMax,
      ideal: usesManualReferences && Number.isFinite(manualIdeal) ? manualIdeal : criterion.direction === 'benefit' ? observedMax : observedMin,
      observedMin,
      observedMax,
    };
  });
  const mapped = fuzzyMatrix.map((row) =>
    row.map((value, column) => {
      const reference = references[column];
      const range = Math.abs(reference.ideal - reference.antiIdeal);
      if (range <= 1e-12) return crispFuzzy(intervalUpper);
      const mappedValues = value.values.map((cell) => {
        const ratio = normalizedCriteria[column].direction === 'benefit'
          ? (cell - reference.antiIdeal) / (reference.ideal - reference.antiIdeal)
          : (cell - reference.ideal) / (reference.antiIdeal - reference.ideal);
        return Math.min(intervalUpper, Math.max(intervalLower, intervalLower + ratio * (intervalUpper - intervalLower)));
      });
      const ordered = mappedValues.slice().sort((a, b) => a - b);
      return { values: ordered, type: value.type } as FuzzyNumber;
    }),
  );
  const arithmeticMean = (intervalLower + intervalUpper) / 2;
  const harmonicMean = 2 / ((1 / intervalLower) + (1 / intervalUpper));
  const normalized = mapped.map((row) => row.map((value, column) =>
    normalizedCriteria[column].direction === 'benefit'
      ? divideFuzzyByScalar(value, 2 * arithmeticMean)
      : {
          values: value.values.map((cell) => harmonicMean / (2 * Math.max(cell, 1e-9))).sort((a, b) => a - b),
          type: value.type,
        } as FuzzyNumber,
  ));
  const weightedFuzzy = normalized.map((row) => row.map((value, column) => scaleFuzzy(value, normalizedCriteria[column].weight)));
  const scores = weightedFuzzy.map((row) => row.reduce((sum, value) => sum + defuzzify(value), 0));
  const analysis = result(method, { ...input, criteria: normalizedCriteria, fuzzyValues: fuzzyMatrix }, [
    {
      id: 'fuzzy-rafsi-reference-values',
      title: 'Fuzzy RAFSI Reference Values and Mapping Interval',
      columns: ['Criterion', 'Name', 'Direction', 'Observed lower', 'Observed upper', 'Anti-ideal', 'Ideal', 'Interval lower', 'Interval upper'],
      rows: normalizedCriteria.map((criterion, index) => [criterion.id, criterion.name, criterion.direction, round(references[index].observedMin), round(references[index].observedMax), round(references[index].antiIdeal), round(references[index].ideal), round(intervalLower), round(intervalUpper)]),
    },
    {
      id: 'fuzzy-rafsi-mapped',
      title: 'Fuzzy RAFSI Functional Mapping Matrix',
      columns: ['Alternative', ...normalizedCriteria.map((criterion) => criterion.id)],
      rows: mapped.map((row, index) => [input.alternatives[index].name, ...row.map((value) => fuzzyLabel(value))]),
    },
    {
      id: 'fuzzy-rafsi-normalized',
      title: 'Fuzzy RAFSI Normalized Matrix',
      columns: ['Alternative', ...normalizedCriteria.map((criterion) => criterion.id)],
      rows: normalized.map((row, index) => [input.alternatives[index].name, ...row.map((value) => fuzzyLabel(value))]),
    },
    {
      id: 'fuzzy-rafsi-weighted',
      title: 'Fuzzy RAFSI Weighted Matrix',
      columns: ['Alternative', ...normalizedCriteria.map((criterion) => criterion.id)],
      rows: weightedFuzzy.map((row, index) => [input.alternatives[index].name, ...row.map((value) => fuzzyLabel(value))]),
    },
    {
      id: 'fuzzy-rafsi-score',
      title: 'Fuzzy RAFSI Final Scores',
      columns: ['Alternative', 'RAFSI score', 'Ranking rule'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, round(scores[index]), 'Higher is better']),
    },
  ], scores, 'Native fuzzy RAFSI preserves triangular/trapezoidal uploaded values, maps fuzzy benefit and cost values into the selected common interval, applies arithmetic/harmonic interval normalization, and ranks by centroid weighted utility.');
  analysis.diagnostics.push({ label: 'Native fuzzy RAFSI', value: `Fuzzy functional mapping into [${round(intervalLower)}, ${round(intervalUpper)}]`, status: 'pass' });
  analysis.reproducibility = { ...analysis.reproducibility, fuzzyMode: 'Native fuzzy RAFSI', fuzzyRafsi: 'Fuzzy functional mapping, arithmetic/harmonic interval normalization, fuzzy weighting, centroid score', intervalLower, intervalUpper };
  return analysis;
}

function runLopm(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  if (config.methodParams.fuzzyInputMode === 'Native fuzzy LoPM') {
    return runFuzzyLopm(input, config, method);
  }
  const criteria = resolveCriteria(input, config);
  const usesManualLimits = config.methodParams.lopmLimitsMode === 'Manual property limits';
  const targetTolerance = Math.max(0, Number(config.methodParams.lopmTargetTolerance ?? 0) || 0);
  const manualTypes = String(config.methodParams.lopmPropertyTypes ?? '')
    .split(',')
    .map((item) => item.trim().toLowerCase());
  const manualLimits = parseNumberList(config.methodParams.lopmPropertyLimits, criteria.length, 1);
  const propertyModel = criteria.map((criterion, column) => {
    const values = input.values.map((row) => row[column]);
    const fallbackType = criterion.direction === 'benefit' ? 'lower' : 'upper';
    const type = usesManualLimits && ['lower', 'upper', 'target'].includes(manualTypes[column]) ? manualTypes[column] : fallbackType;
    const observedLimit = type === 'lower' ? Math.max(...values) : type === 'upper' ? Math.min(...values) : values.reduce((sum, value) => sum + value, 0) / values.length;
    const limit = usesManualLimits && Number.isFinite(manualLimits[column]) && manualLimits[column] !== 0 ? manualLimits[column] : observedLimit || 1;
    return { type, limit };
  });
  const meritMatrix = input.values.map((row) =>
    row.map((value, column) => {
      const model = propertyModel[column];
      const safeValue = Math.max(Math.abs(value), 1e-12);
      const safeLimit = Math.max(Math.abs(model.limit), 1e-12);
      if (model.type === 'lower') return safeLimit / safeValue;
      if (model.type === 'upper') return safeValue / safeLimit;
      return Math.abs(safeValue / safeLimit - 1);
    }),
  );
  const weightedMerit = weighted(meritMatrix, criteria);
  const meritScores = weightedMerit.map((row) => row.reduce((sum, value) => sum + value, 0));
  const screeningRows = input.alternatives.map((alternative, rowIndex) => {
    const checks = criteria.map((criterion, column) => {
      const model = propertyModel[column];
      const value = input.values[rowIndex][column];
      const passed = model.type === 'lower'
        ? value >= model.limit
        : model.type === 'upper'
          ? value <= model.limit
          : Math.abs(value - model.limit) <= Math.abs(model.limit) * targetTolerance;
      return `${criterion.id}:${passed ? 'pass' : 'fail'}`;
    });
    const failed = checks.filter((item) => item.endsWith('fail')).length;
    return [alternative.name, failed === 0 ? 'Feasible' : 'Review', failed, ...checks];
  });
  return result(method, { ...input, criteria }, [
    {
      id: 'lopm-property-limits',
      title: 'LoPM Property Limits',
      columns: ['Criterion', 'Name', 'Direction', 'Property type', 'Property limit', 'Mode'],
      rows: criteria.map((criterion, index) => [criterion.id, criterion.name, criterion.direction, propertyModel[index].type, round(propertyModel[index].limit), usesManualLimits ? 'Manual property limits' : 'Observed limits']),
    },
    {
      id: 'lopm-feasibility-screen',
      title: 'LoPM Property-Limit Feasibility Screen',
      columns: ['Alternative', 'Status', 'Failed limits', ...criteria.map((criterion) => criterion.id)],
      rows: screeningRows,
    },
    tableFromMatrix('lopm-merit-components', 'LoPM Merit Components', meritMatrix, input),
    tableFromMatrix('lopm-weighted-merit', 'LoPM Weighted Merit Matrix', weightedMerit, input),
    {
      id: 'lopm-score',
      title: 'LoPM Merit Scores',
      columns: ['Alternative', 'Merit value', 'Ranking rule'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, round(meritScores[index]), 'Lower is better']),
    },
  ], meritScores, 'LoPM ranks alternatives by calculating weighted merit penalties against lower-limit, upper-limit, and target property requirements.', false);
}

function runFuzzyLopm(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  const criteria = resolveCriteria(input, config);
  const fuzzyMatrix = input.fuzzyValues?.length
    ? input.fuzzyValues
    : input.values.map((row) => row.map((value) => crispFuzzy(value)));
  const normalizedCriteria = normalizeWeights(criteria);
  const usesManualLimits = config.methodParams.lopmLimitsMode === 'Manual property limits';
  const targetTolerance = Math.max(0, Number(config.methodParams.lopmTargetTolerance ?? 0) || 0);
  const manualTypes = String(config.methodParams.lopmPropertyTypes ?? '')
    .split(',')
    .map((item) => item.trim().toLowerCase());
  const manualLimits = parseNumberList(config.methodParams.lopmPropertyLimits, normalizedCriteria.length, 1);
  const propertyModel = normalizedCriteria.map((criterion, column) => {
    const values = fuzzyMatrix.map((row) => row[column]);
    const fallbackType = criterion.direction === 'benefit' ? 'lower' : 'upper';
    const type = usesManualLimits && ['lower', 'upper', 'target'].includes(manualTypes[column]) ? manualTypes[column] : fallbackType;
    const observedLimit = type === 'lower'
      ? Math.max(...values.map(defuzzify))
      : type === 'upper'
        ? Math.min(...values.map(defuzzify))
        : values.reduce((sum, value) => sum + defuzzify(value), 0) / values.length;
    const limit = usesManualLimits && Number.isFinite(manualLimits[column]) && manualLimits[column] !== 0 ? manualLimits[column] : observedLimit || 1;
    return { type, limit };
  });
  const meritFuzzy = fuzzyMatrix.map((row) =>
    row.map((value, column) => {
      const model = propertyModel[column];
      const safeLimit = Math.max(Math.abs(model.limit), 1e-12);
      const values = value.values.map((cell) => {
        const safeValue = Math.max(Math.abs(cell), 1e-12);
        if (model.type === 'lower') return safeLimit / safeValue;
        if (model.type === 'upper') return safeValue / safeLimit;
        return Math.abs(safeValue / safeLimit - 1);
      });
      return { values: values.slice().sort((a, b) => a - b), type: value.type } as FuzzyNumber;
    }),
  );
  const meritMatrix = meritFuzzy.map((row) => row.map(defuzzify));
  const weightedMerit = weighted(meritMatrix, normalizedCriteria);
  const meritScores = weightedMerit.map((row) => row.reduce((sum, value) => sum + value, 0));
  const screeningRows = input.alternatives.map((alternative, rowIndex) => {
    const checks = normalizedCriteria.map((criterion, column) => {
      const model = propertyModel[column];
      const value = defuzzify(fuzzyMatrix[rowIndex][column]);
      const passed = model.type === 'lower'
        ? value >= model.limit
        : model.type === 'upper'
          ? value <= model.limit
          : Math.abs(value - model.limit) <= Math.abs(model.limit) * targetTolerance;
      return `${criterion.id}:${passed ? 'pass' : 'fail'}`;
    });
    const failed = checks.filter((item) => item.endsWith('fail')).length;
    return [alternative.name, failed === 0 ? 'Feasible' : 'Review', failed, ...checks];
  });
  const analysis = result(method, { ...input, criteria: normalizedCriteria, fuzzyValues: fuzzyMatrix }, [
    {
      id: 'fuzzy-lopm-property-limits',
      title: 'Fuzzy LoPM Property Limits',
      columns: ['Criterion', 'Name', 'Direction', 'Property type', 'Property limit', 'Mode'],
      rows: normalizedCriteria.map((criterion, index) => [criterion.id, criterion.name, criterion.direction, propertyModel[index].type, round(propertyModel[index].limit), usesManualLimits ? 'Manual property limits' : 'Observed limits']),
    },
    {
      id: 'fuzzy-lopm-feasibility-screen',
      title: 'Fuzzy LoPM Property-Limit Feasibility Screen',
      columns: ['Alternative', 'Status', 'Failed limits', ...normalizedCriteria.map((criterion) => criterion.id)],
      rows: screeningRows,
    },
    {
      id: 'fuzzy-lopm-merit-components',
      title: 'Fuzzy LoPM Merit Components',
      columns: ['Alternative', ...normalizedCriteria.map((criterion) => criterion.id)],
      rows: meritFuzzy.map((row, index) => [input.alternatives[index].name, ...row.map((value) => fuzzyLabel(value))]),
    },
    tableFromMatrix('fuzzy-lopm-weighted-merit', 'Fuzzy LoPM Weighted Merit Matrix', weightedMerit, input),
    {
      id: 'fuzzy-lopm-score',
      title: 'Fuzzy LoPM Merit Scores',
      columns: ['Alternative', 'Merit value', 'Ranking rule'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, round(meritScores[index]), 'Lower is better']),
    },
  ], meritScores, 'Native fuzzy LoPM preserves triangular/trapezoidal uploaded values, evaluates fuzzy merit penalties against lower, upper, or target property limits, and ranks by the lowest weighted centroid merit penalty.', false);
  analysis.diagnostics.push({ label: 'Native fuzzy LoPM', value: `${usesManualLimits ? 'Manual' : 'Observed'} fuzzy property-limit merit penalties`, status: 'pass' });
  analysis.reproducibility = { ...analysis.reproducibility, fuzzyMode: 'Native fuzzy LoPM', fuzzyLopm: 'Fuzzy merit components, centroid weighted penalties, lower score preferred', lopmLimitsMode: usesManualLimits ? 'Manual property limits' : 'Observed limits' };
  return analysis;
}

function runAroman(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  if (config.methodParams.fuzzyInputMode === 'Native fuzzy AROMAN') {
    return runFuzzyAroman(input, config, method);
  }
  const criteria = resolveCriteria(input, config);
  const beta = Number(config.methodParams.aromanBeta ?? 0.5);
  const lambda = Number(config.methodParams.aromanLambda ?? 0.5);
  const blend = Number.isFinite(beta) ? Math.min(1, Math.max(0, beta)) : 0.5;
  const costBenefitBalance = Number.isFinite(lambda) ? Math.min(1, Math.max(0, lambda)) : 0.5;
  const linear = input.values.map((row) =>
    row.map((value, column) => {
      const values = input.values.map((item) => item[column]);
      const min = Math.min(...values);
      const max = Math.max(...values);
      if (max === min) return 1;
      return (value - min) / (max - min);
    }),
  );
  const vectorRaw = vectorNormalize(input.values);
  const blended = linear.map((row, rowIndex) =>
    row.map((value, column) => (blend * value + (1 - blend) * vectorRaw[rowIndex][column]) / 2),
  );
  const weightedBlended = weighted(blended, criteria);
  const benefitScores = weightedBlended.map((row) => row.reduce((sum, value, column) => criteria[column].direction === 'benefit' ? sum + value : sum, 0));
  const costScores = weightedBlended.map((row) => row.reduce((sum, value, column) => criteria[column].direction === 'cost' ? sum + value : sum, 0));
  const finalScores = weightedBlended.map((_, index) => {
    const benefit = Math.max(benefitScores[index], 0);
    const cost = Math.max(costScores[index], 0);
    return cost ** costBenefitBalance + benefit ** (1 - costBenefitBalance);
  });
  return result(method, { ...input, criteria }, [
    tableFromMatrix('aroman-linear-normalized', 'AROMAN Linear Normalized Matrix', linear, input),
    tableFromMatrix('aroman-vector-normalized', 'AROMAN Vector Normalized Matrix', vectorRaw, input),
    tableFromMatrix('aroman-blended-normalized', 'AROMAN Blended Normalized Matrix', blended, input),
    tableFromMatrix('aroman-weighted', 'AROMAN Weighted Blended Matrix', weightedBlended, input),
    {
      id: 'aroman-score',
      title: 'AROMAN Final Scores',
      columns: ['Alternative', 'Benefit sum A', 'Cost sum L', 'AROMAN score', 'Beta', 'Lambda', 'Ranking rule'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, round(benefitScores[index]), round(costScores[index]), round(finalScores[index]), round(blend), round(costBenefitBalance), 'Higher is better']),
    },
  ], finalScores, 'AROMAN ranks alternatives by blending min-max and vector normalized matrices using beta, then summing lambda-powered cost and benefit weighted components.');
}

function runFuzzyAroman(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  const criteria = resolveCriteria(input, config);
  const fuzzyMatrix = input.fuzzyValues?.length
    ? input.fuzzyValues
    : input.values.map((row) => row.map((value) => crispFuzzy(value)));
  const normalizedCriteria = normalizeWeights(criteria);
  const beta = Number(config.methodParams.aromanBeta ?? 0.5);
  const lambda = Number(config.methodParams.aromanLambda ?? 0.5);
  const blend = Number.isFinite(beta) ? Math.min(1, Math.max(0, beta)) : 0.5;
  const costBenefitBalance = Number.isFinite(lambda) ? Math.min(1, Math.max(0, lambda)) : 0.5;
  const linear = fuzzyMatrix.map((row) => row.map((value, column) => {
    const columnValues = fuzzyMatrix.map((item) => item[column]);
    const minLower = Math.min(...columnValues.map((item) => item.values[0]).filter(Number.isFinite));
    const maxUpper = Math.max(...columnValues.map((item) => item.values[item.values.length - 1]).filter(Number.isFinite), 1e-9);
    const range = Math.max(maxUpper - minLower, 1e-9);
    return { values: value.values.map((cell) => (cell - minLower) / range), type: value.type };
  }));
  const vector = fuzzyMatrix.map((row) => row.map((value, column) => {
    const denominator = Math.sqrt(fuzzyMatrix.reduce((sum, item) => sum + defuzzify(item[column]) ** 2, 0)) || 1;
    return { values: value.values.map((cell) => cell / denominator), type: value.type };
  }));
  const blended = linear.map((row, rowIndex) => row.map((value, column) => {
    const size = Math.max(value.values.length, vector[rowIndex][column].values.length);
    const linearValues = value.values.length === size ? value.values : value.values.length === 3 && size === 4 ? [value.values[0], value.values[1], value.values[1], value.values[2]] : value.values;
    const vectorValues = vector[rowIndex][column].values.length === size
      ? vector[rowIndex][column].values
      : vector[rowIndex][column].values.length === 3 && size === 4
        ? [vector[rowIndex][column].values[0], vector[rowIndex][column].values[1], vector[rowIndex][column].values[1], vector[rowIndex][column].values[2]]
        : vector[rowIndex][column].values;
    return {
      values: Array.from({ length: size }, (_, index) => (blend * (linearValues[index] ?? linearValues[linearValues.length - 1] ?? 0) + (1 - blend) * (vectorValues[index] ?? vectorValues[vectorValues.length - 1] ?? 0)) / 2),
      type: size === 4 ? 'trapezoidal' : value.type,
    } as FuzzyNumber;
  }));
  const weightedFuzzy = blended.map((row) => row.map((value, column) => scaleFuzzy(value, normalizedCriteria[column].weight)));
  const benefitScores = weightedFuzzy.map((row) => row.reduce((sum, value, column) => criteria[column].direction === 'benefit' ? sum + defuzzify(value) : sum, 0));
  const costScores = weightedFuzzy.map((row) => row.reduce((sum, value, column) => criteria[column].direction === 'cost' ? sum + defuzzify(value) : sum, 0));
  const scores = weightedFuzzy.map((_, index) => {
    const benefit = Math.max(benefitScores[index], 0);
    const cost = Math.max(costScores[index], 0);
    return cost ** costBenefitBalance + benefit ** (1 - costBenefitBalance);
  });
  const analysis = result(method, { ...input, criteria: normalizedCriteria, fuzzyValues: fuzzyMatrix }, [
    {
      id: 'fuzzy-aroman-linear-normalized',
      title: 'Fuzzy AROMAN Linear Normalized Matrix',
      columns: ['Alternative', ...normalizedCriteria.map((criterion) => criterion.id)],
      rows: linear.map((row, index) => [input.alternatives[index].name, ...row.map((value) => fuzzyLabel(value))]),
    },
    {
      id: 'fuzzy-aroman-vector-normalized',
      title: 'Fuzzy AROMAN Vector Normalized Matrix',
      columns: ['Alternative', ...normalizedCriteria.map((criterion) => criterion.id)],
      rows: vector.map((row, index) => [input.alternatives[index].name, ...row.map((value) => fuzzyLabel(value))]),
    },
    {
      id: 'fuzzy-aroman-blended-normalized',
      title: 'Fuzzy AROMAN Blended Normalized Matrix',
      columns: ['Alternative', ...normalizedCriteria.map((criterion) => criterion.id)],
      rows: blended.map((row, index) => [input.alternatives[index].name, ...row.map((value) => fuzzyLabel(value))]),
    },
    {
      id: 'fuzzy-aroman-weighted',
      title: 'Fuzzy AROMAN Weighted Blended Matrix',
      columns: ['Alternative', ...normalizedCriteria.map((criterion) => criterion.id)],
      rows: weightedFuzzy.map((row, index) => [input.alternatives[index].name, ...row.map((value) => fuzzyLabel(value))]),
    },
    {
      id: 'fuzzy-aroman-score',
      title: 'Fuzzy AROMAN Final Scores',
      columns: ['Alternative', 'Benefit sum A', 'Cost sum L', 'AROMAN score', 'Beta', 'Lambda', 'Ranking rule'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, round(benefitScores[index]), round(costScores[index]), round(scores[index]), round(blend), round(costBenefitBalance), 'Higher is better']),
    },
  ], scores, 'Native fuzzy AROMAN preserves triangular/trapezoidal uploaded values through fuzzy min-max and vector normalization, blends both normalized matrices by beta, and ranks by lambda-powered benefit/cost centroid components.');
  analysis.diagnostics.push({ label: 'Native fuzzy AROMAN', value: `beta = ${round(blend)}, lambda = ${round(costBenefitBalance)} with fuzzy blended normalization`, status: 'pass' });
  analysis.reproducibility = { ...analysis.reproducibility, fuzzyMode: 'Native fuzzy AROMAN', fuzzyAroman: 'Fuzzy min-max normalization, fuzzy vector normalization, beta blend, lambda-powered benefit/cost components', beta: round(blend), lambda: round(costBenefitBalance) };
  return analysis;
}

function runCobra(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  if (config.methodParams.fuzzyInputMode === 'Native fuzzy COBRA') {
    return runFuzzyCobra(input, config, method);
  }
  const criteria = resolveCriteria(input, config);
  const normalized = minMaxNormalize({ ...input, criteria });
  const weightedMatrix = weighted(normalized, criteria);
  const positiveIdeal = criteria.map((_, column) => Math.max(...weightedMatrix.map((row) => row[column])));
  const negativeIdeal = criteria.map((_, column) => Math.min(...weightedMatrix.map((row) => row[column])));
  const averageSolution = criteria.map((_, column) => weightedMatrix.reduce((sum, row) => sum + row[column], 0) / weightedMatrix.length);
  const euclideanPositive = weightedMatrix.map((row) => distance(row, positiveIdeal));
  const taxicabPositive = weightedMatrix.map((row) => row.reduce((sum, value, column) => sum + Math.abs(positiveIdeal[column] - value), 0));
  const euclideanNegative = weightedMatrix.map((row) => distance(row, negativeIdeal));
  const taxicabNegative = weightedMatrix.map((row) => row.reduce((sum, value, column) => sum + Math.abs(value - negativeIdeal[column]), 0));
  const averagePositiveEuclidean = weightedMatrix.map((row) =>
    Math.sqrt(row.reduce((sum, value, column) => value > averageSolution[column] ? sum + (value - averageSolution[column]) ** 2 : sum, 0)),
  );
  const averagePositiveTaxicab = weightedMatrix.map((row) =>
    row.reduce((sum, value, column) => value > averageSolution[column] ? sum + Math.abs(value - averageSolution[column]) : sum, 0),
  );
  const averageNegativeEuclidean = weightedMatrix.map((row) =>
    Math.sqrt(row.reduce((sum, value, column) => value < averageSolution[column] ? sum + (averageSolution[column] - value) ** 2 : sum, 0)),
  );
  const averageNegativeTaxicab = weightedMatrix.map((row) =>
    row.reduce((sum, value, column) => value < averageSolution[column] ? sum + Math.abs(averageSolution[column] - value) : sum, 0),
  );
  const positiveDistance = euclideanPositive.map((value, index) => (value + taxicabPositive[index]) / 2);
  const negativeDistance = euclideanNegative.map((value, index) => (value + taxicabNegative[index]) / 2);
  const averagePositiveDistance = averagePositiveEuclidean.map((value, index) => (value + averagePositiveTaxicab[index]) / 2);
  const averageNegativeDistance = averageNegativeEuclidean.map((value, index) => (value + averageNegativeTaxicab[index]) / 2);
  const scores = positiveDistance.map((value, index) =>
    (value - negativeDistance[index] - averagePositiveDistance[index] + averageNegativeDistance[index]) / 4,
  );
  return result(method, { ...input, criteria }, [
    tableFromMatrix('cobra-normalized', 'COBRA Normalized Matrix', normalized, input),
    tableFromMatrix('cobra-weighted', 'COBRA Weighted Normalized Matrix', weightedMatrix, input),
    {
      id: 'cobra-reference-solutions',
      title: 'COBRA Reference Solutions',
      columns: ['Reference', ...criteria.map((criterion) => criterion.id)],
      rows: [
        ['Positive ideal', ...positiveIdeal.map((value) => round(value))],
        ['Average solution', ...averageSolution.map((value) => round(value))],
        ['Negative ideal', ...negativeIdeal.map((value) => round(value))],
      ],
    },
    {
      id: 'cobra-distances',
      title: 'COBRA Distance Components',
      columns: ['Alternative', 'd(PIS)', 'd(NIS)', 'd(AS)+', 'd(AS)-', 'Comprehensive distance'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, round(positiveDistance[index]), round(negativeDistance[index]), round(averagePositiveDistance[index]), round(averageNegativeDistance[index]), round(scores[index])]),
    },
    {
      id: 'cobra-final',
      title: 'COBRA Comprehensive Distance Ranking',
      columns: ['Alternative', 'Comprehensive distance', 'Ranking rule'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, round(scores[index]), 'Lower is better']),
    },
  ], scores, 'COBRA ranks alternatives by combining Euclidean and taxicab distances from positive ideal, negative ideal, and average reference solutions.', false);
}

function runFuzzyCobra(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  const criteria = resolveCriteria(input, config);
  const fuzzyMatrix = input.fuzzyValues?.length
    ? input.fuzzyValues
    : input.values.map((row) => row.map((value) => crispFuzzy(value)));
  const normalizedCriteria = normalizeWeights(criteria);
  const normalized = fuzzyMatrix.map((row) => row.map((value, column) => {
    const columnValues = fuzzyMatrix.map((item) => item[column]);
    if (criteria[column].direction === 'cost') {
      const minLower = Math.min(...columnValues.map((item) => item.values[0]).filter(Number.isFinite));
      return { values: value.values.map((cell) => minLower / Math.max(cell, 1e-9)).reverse(), type: value.type } as FuzzyNumber;
    }
    const maxUpper = Math.max(...columnValues.map((item) => item.values[item.values.length - 1]).filter(Number.isFinite), 1e-9);
    return { values: value.values.map((cell) => cell / maxUpper), type: value.type };
  }));
  const weightedFuzzy = normalized.map((row) => row.map((value, column) => scaleFuzzy(value, normalizedCriteria[column].weight)));
  const positiveIdeal = normalizedCriteria.map((_, column) => {
    const values = weightedFuzzy.map((row) => row[column]);
    return values.reduce((best, value) => defuzzify(value) > defuzzify(best) ? value : best, values[0]);
  });
  const negativeIdeal = normalizedCriteria.map((_, column) => {
    const values = weightedFuzzy.map((row) => row[column]);
    return values.reduce((worst, value) => defuzzify(value) < defuzzify(worst) ? value : worst, values[0]);
  });
  const averageSolution = normalizedCriteria.map((_, column) => {
    const values = weightedFuzzy.map((row) => row[column]);
    const size = Math.max(...values.map((value) => value.values.length));
    const averaged = Array.from({ length: size }, (_, component) => values.reduce((sum, value) => {
      const expanded = value.values.length === size ? value.values : value.values.length === 3 && size === 4 ? [value.values[0], value.values[1], value.values[1], value.values[2]] : value.values;
      return sum + (expanded[component] ?? expanded[expanded.length - 1] ?? 0);
    }, 0) / values.length);
    return { values: averaged, type: size === 4 ? 'trapezoidal' : 'triangular' } as FuzzyNumber;
  });
  const euclideanPositive = weightedFuzzy.map((row) => Math.sqrt(row.reduce((sum, value, column) => sum + fuzzyDistance(value, positiveIdeal[column]) ** 2, 0)));
  const taxicabPositive = weightedFuzzy.map((row) => row.reduce((sum, value, column) => sum + fuzzyDistance(value, positiveIdeal[column]), 0));
  const euclideanNegative = weightedFuzzy.map((row) => Math.sqrt(row.reduce((sum, value, column) => sum + fuzzyDistance(value, negativeIdeal[column]) ** 2, 0)));
  const taxicabNegative = weightedFuzzy.map((row) => row.reduce((sum, value, column) => sum + fuzzyDistance(value, negativeIdeal[column]), 0));
  const averagePositiveEuclidean = weightedFuzzy.map((row) => Math.sqrt(row.reduce((sum, value, column) => {
    const diff = defuzzify(value) - defuzzify(averageSolution[column]);
    return diff > 0 ? sum + fuzzyDistance(value, averageSolution[column]) ** 2 : sum;
  }, 0)));
  const averagePositiveTaxicab = weightedFuzzy.map((row) => row.reduce((sum, value, column) => defuzzify(value) > defuzzify(averageSolution[column]) ? sum + fuzzyDistance(value, averageSolution[column]) : sum, 0));
  const averageNegativeEuclidean = weightedFuzzy.map((row) => Math.sqrt(row.reduce((sum, value, column) => {
    const diff = defuzzify(value) - defuzzify(averageSolution[column]);
    return diff < 0 ? sum + fuzzyDistance(value, averageSolution[column]) ** 2 : sum;
  }, 0)));
  const averageNegativeTaxicab = weightedFuzzy.map((row) => row.reduce((sum, value, column) => defuzzify(value) < defuzzify(averageSolution[column]) ? sum + fuzzyDistance(value, averageSolution[column]) : sum, 0));
  const positiveDistance = euclideanPositive.map((value, index) => (value + taxicabPositive[index]) / 2);
  const negativeDistance = euclideanNegative.map((value, index) => (value + taxicabNegative[index]) / 2);
  const averagePositiveDistance = averagePositiveEuclidean.map((value, index) => (value + averagePositiveTaxicab[index]) / 2);
  const averageNegativeDistance = averageNegativeEuclidean.map((value, index) => (value + averageNegativeTaxicab[index]) / 2);
  const scores = positiveDistance.map((value, index) => (value - negativeDistance[index] - averagePositiveDistance[index] + averageNegativeDistance[index]) / 4);
  const analysis = result(method, { ...input, criteria: normalizedCriteria, fuzzyValues: fuzzyMatrix }, [
    {
      id: 'fuzzy-cobra-normalized',
      title: 'Fuzzy COBRA Normalized Matrix',
      columns: ['Alternative', ...normalizedCriteria.map((criterion) => criterion.id)],
      rows: normalized.map((row, index) => [input.alternatives[index].name, ...row.map((value) => fuzzyLabel(value))]),
    },
    {
      id: 'fuzzy-cobra-weighted',
      title: 'Fuzzy COBRA Weighted Normalized Matrix',
      columns: ['Alternative', ...normalizedCriteria.map((criterion) => criterion.id)],
      rows: weightedFuzzy.map((row, index) => [input.alternatives[index].name, ...row.map((value) => fuzzyLabel(value))]),
    },
    {
      id: 'fuzzy-cobra-reference-solutions',
      title: 'Fuzzy COBRA Reference Solutions',
      columns: ['Reference', ...normalizedCriteria.map((criterion) => criterion.id)],
      rows: [
        ['Positive ideal', ...positiveIdeal.map((value) => fuzzyLabel(value))],
        ['Average solution', ...averageSolution.map((value) => fuzzyLabel(value))],
        ['Negative ideal', ...negativeIdeal.map((value) => fuzzyLabel(value))],
      ],
    },
    {
      id: 'fuzzy-cobra-distances',
      title: 'Fuzzy COBRA Distance Components',
      columns: ['Alternative', 'd(PIS)', 'd(NIS)', 'd(AS)+', 'd(AS)-', 'Comprehensive distance'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, round(positiveDistance[index]), round(negativeDistance[index]), round(averagePositiveDistance[index]), round(averageNegativeDistance[index]), round(scores[index])]),
    },
    {
      id: 'fuzzy-cobra-final',
      title: 'Fuzzy COBRA Comprehensive Distance Ranking',
      columns: ['Alternative', 'Comprehensive distance', 'Ranking rule'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, round(scores[index]), 'Lower is better']),
    },
  ], scores, 'Native fuzzy COBRA preserves triangular/trapezoidal uploaded values through fuzzy normalization and weighting, then combines fuzzy-distance components from positive ideal, negative ideal, and average reference solutions.', false);
  analysis.diagnostics.push({ label: 'Native fuzzy COBRA', value: 'Fuzzy ideal-average-negative distance components', status: 'pass' });
  analysis.reproducibility = { ...analysis.reproducibility, fuzzyMode: 'Native fuzzy COBRA', fuzzyCobra: 'Fuzzy normalization/weighting with vertex-distance positive ideal, average solution, and negative ideal components' };
  return analysis;
}

function runErvd(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  if (config.methodParams.fuzzyInputMode === 'Native fuzzy ERVD') {
    return runFuzzyErvd(input, config, method);
  }
  const criteria = resolveCriteria(input, config);
  const usesManualReference = config.methodParams.ervdReferenceMode === 'Manual reference point';
  const manualReference = parseNumberList(config.methodParams.ervdReferencePoint, criteria.length, 0);
  const lambda = Number(config.methodParams.ervdLambda ?? 2.25);
  const alpha = Number(config.methodParams.ervdAlpha ?? 0.88);
  const lossAversion = Number.isFinite(lambda) && lambda > 0 ? lambda : 2.25;
  const sensitivity = Number.isFinite(alpha) && alpha > 0 ? alpha : 0.88;
  const ranges = criteria.map((criterion, column) => {
    const values = input.values.map((row) => row[column]);
    return { criterion, min: Math.min(...values), max: Math.max(...values), mean: values.reduce((sum, value) => sum + value, 0) / values.length, sum: values.reduce((sum, value) => sum + value, 0) };
  });
  const reference = ranges.map((range, column) => usesManualReference && Number.isFinite(manualReference[column]) ? manualReference[column] : range.mean);
  const normalized = input.values.map((row) => row.map((value, column) => value / Math.max(Math.abs(ranges[column].sum), 1e-12)));
  const normalizedReference = reference.map((value, column) => {
    return value / Math.max(Math.abs(ranges[column].sum), 1e-12);
  });
  const relativePerformance = normalized.map((row) =>
    row.map((value, column) => {
      const delta = value - normalizedReference[column];
      if (criteria[column].direction === 'benefit') {
        return delta > 0 ? delta ** sensitivity : -lossAversion * Math.abs(delta) ** sensitivity;
      }
      return delta < 0 ? Math.abs(delta) ** sensitivity : -lossAversion * delta ** sensitivity;
    }),
  );
  const weightedRelativePerformance = weighted(relativePerformance, criteria);
  const positiveIdeal = criteria.map((_, column) => Math.max(...relativePerformance.map((row) => row[column])));
  const negativeIdeal = criteria.map((_, column) => Math.min(...relativePerformance.map((row) => row[column])));
  const distanceToPositive = relativePerformance.map((row) => row.reduce((sum, value, column) => sum + criteria[column].weight * Math.abs(value - positiveIdeal[column]), 0));
  const distanceToNegative = relativePerformance.map((row) => row.reduce((sum, value, column) => sum + criteria[column].weight * Math.abs(value - negativeIdeal[column]), 0));
  const scores = distanceToPositive.map((positiveDistance, index) => {
    const negativeDistance = distanceToNegative[index];
    return negativeDistance / Math.max(positiveDistance + negativeDistance, 1e-12);
  });
  return result(method, { ...input, criteria }, [
    {
      id: 'ervd-reference-point',
      title: 'ERVD Normalized Reference Point',
      columns: ['Criterion', 'Name', 'Direction', 'Observed lower', 'Observed upper', 'Reference value', 'Normalized reference', 'Mode'],
      rows: criteria.map((criterion, index) => [criterion.id, criterion.name, criterion.direction, round(ranges[index].min), round(ranges[index].max), round(reference[index]), round(normalizedReference[index]), usesManualReference ? 'Manual reference point' : 'Observed mean']),
    },
    tableFromMatrix('ervd-normalized', 'ERVD Normalized Matrix', normalized, input),
    tableFromMatrix('ervd-relative-performance', 'ERVD Relative Performance Matrix', relativePerformance, input),
    tableFromMatrix('ervd-weighted-relative-performance', 'ERVD Weighted Relative Performance Matrix', weightedRelativePerformance, input),
    {
      id: 'ervd-score',
      title: 'ERVD Final Scores',
      columns: ['Alternative', 'Distance to positive ideal', 'Distance to negative ideal', 'ERVD score', 'Lambda', 'Alpha', 'Ranking rule'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, round(distanceToPositive[index]), round(distanceToNegative[index]), round(scores[index]), round(lossAversion), round(sensitivity), 'Higher is better']),
    },
  ], scores, 'ERVD ranks alternatives by calculating normalized relative performance from a selected reference point, then converting distances to positive and negative ideal relative-value solutions into closeness scores.');
}

function runFuzzyErvd(input: DecisionMatrix, config: StudyConfig, method: MethodDefinition): AnalysisResult {
  const criteria = resolveCriteria(input, config);
  const fuzzyMatrix = input.fuzzyValues?.length
    ? input.fuzzyValues
    : input.values.map((row) => row.map((value) => crispFuzzy(value)));
  const usesManualReference = config.methodParams.ervdReferenceMode === 'Manual reference point';
  const manualReference = parseNumberList(config.methodParams.ervdReferencePoint, criteria.length, 0);
  const lambda = Number(config.methodParams.ervdLambda ?? 2.25);
  const alpha = Number(config.methodParams.ervdAlpha ?? 0.88);
  const lossAversion = Number.isFinite(lambda) && lambda > 0 ? lambda : 2.25;
  const sensitivity = Number.isFinite(alpha) && alpha > 0 ? alpha : 0.88;
  const ranges = criteria.map((criterion, column) => {
    const values = fuzzyMatrix.map((row) => defuzzify(row[column]));
    return { criterion, min: Math.min(...values), max: Math.max(...values), mean: values.reduce((sum, value) => sum + value, 0) / values.length };
  });
  const reference = ranges.map((range, column) => usesManualReference && Number.isFinite(manualReference[column]) ? crispFuzzy(manualReference[column]) : crispFuzzy(range.mean));
  const utilityFuzzy = (value: FuzzyNumber, column: number): FuzzyNumber => {
    const range = ranges[column];
    if (range.max === range.min) return crispFuzzy(1);
    const mapped = value.values.map((component) => {
      const clamped = Math.min(range.max, Math.max(range.min, component));
      return range.criterion.direction === 'benefit'
        ? (clamped - range.min) / (range.max - range.min)
        : (range.max - clamped) / (range.max - range.min);
    }).sort((a, b) => a - b);
    return { values: mapped, type: value.type };
  };
  const utilityMatrix = fuzzyMatrix.map((row) => row.map((value, column) => utilityFuzzy(value, column)));
  const referenceUtility = reference.map((value, column) => utilityFuzzy(value, column));
  const relativeValueMatrix = utilityMatrix.map((row) =>
    row.map((value, column) => {
      const delta = defuzzify(value) - defuzzify(referenceUtility[column]);
      const distance = fuzzyDistance(value, referenceUtility[column]);
      return delta >= 0 ? distance ** sensitivity : -lossAversion * distance ** sensitivity;
    }),
  );
  const weightedRelativeValue = weighted(relativeValueMatrix, criteria);
  const scores = weightedRelativeValue.map((row) => row.reduce((sum, value) => sum + value, 0));
  const analysis = result(method, { ...input, criteria, fuzzyValues: fuzzyMatrix }, [
    {
      id: 'fuzzy-ervd-reference-point',
      title: 'Fuzzy ERVD Reference Utilities',
      columns: ['Criterion', 'Name', 'Direction', 'Observed lower', 'Observed upper', 'Reference value', 'Reference utility', 'Mode'],
      rows: criteria.map((criterion, index) => [criterion.id, criterion.name, criterion.direction, round(ranges[index].min), round(ranges[index].max), fuzzyLabel(reference[index]), fuzzyLabel(referenceUtility[index]), usesManualReference ? 'Manual reference point' : 'Observed mean']),
    },
    {
      id: 'fuzzy-ervd-utility',
      title: 'Fuzzy ERVD Benefit-Cost Utility Matrix',
      columns: ['Alternative', ...criteria.map((criterion) => criterion.id)],
      rows: utilityMatrix.map((row, index) => [input.alternatives[index].name, ...row.map((value) => fuzzyLabel(value))]),
    },
    tableFromMatrix('fuzzy-ervd-relative-values', 'Fuzzy ERVD Relative Value Distance Matrix', relativeValueMatrix, input),
    tableFromMatrix('fuzzy-ervd-weighted-relative-values', 'Fuzzy ERVD Weighted Relative Value Matrix', weightedRelativeValue, input),
    {
      id: 'fuzzy-ervd-score',
      title: 'Fuzzy ERVD Final Scores',
      columns: ['Alternative', 'ERVD score', 'Lambda', 'Alpha', 'Ranking rule'],
      rows: input.alternatives.map((alternative, index) => [alternative.name, round(scores[index]), round(lossAversion), round(sensitivity), 'Higher is better']),
    },
  ], scores, 'Native fuzzy ERVD preserves triangular/trapezoidal uploaded values through benefit/cost-aware fuzzy utility mapping, then scores fuzzy-distance gains and losses from the selected reference utility.');
  analysis.diagnostics.push({ label: 'Native fuzzy ERVD', value: `${usesManualReference ? 'Manual' : 'Observed mean'} fuzzy reference utilities with gain/loss distance scoring`, status: 'pass' });
  analysis.reproducibility = { ...analysis.reproducibility, fuzzyMode: 'Native fuzzy ERVD', fuzzyErvd: 'Fuzzy utility mapping, vertex-distance gains/losses from reference utility, weighted relative value scoring', lambda: round(lossAversion), alpha: round(sensitivity), referenceMode: usesManualReference ? 'Manual reference point' : 'Observed mean' };
  return analysis;
}

export const methodRegistry: MethodDefinition[] = [
  withBase({ id: 'topsis', name: 'TOPSIS', fullName: 'Technique for Order Preference by Similarity to Ideal Solution', description: 'Ideal-solution distance ranking.', parameters: ['normalization', 'distanceMetric', 'idealSolution'], specificationFields: [{ key: 'normalization', label: 'Normalization', type: 'select', defaultValue: 'Vector normalization', options: ['Vector normalization', 'Linear normalization'] }, { key: 'distanceMetric', label: 'Distance metric', type: 'select', defaultValue: 'Euclidean', options: ['Euclidean'] }, { key: 'idealSolution', label: 'Ideal solution handling', type: 'select', defaultValue: 'Benefit/cost aware', options: ['Benefit/cost aware'] }], outputs: ['Normalized matrix', 'Weighted matrix', 'Ideal solutions', 'Distances', 'Closeness rank'], supportsWeights: true, runAnalysis: (input, config) => runTopsis(input, config, getMethod('topsis')) }),
  withBase({ id: 'ahp', name: 'AHP', fullName: 'Analytic Hierarchy Process', description: 'Pairwise-priority decision modeling.', parameters: ['ahpPairwiseMode', 'ahpConsistencyThreshold'], specificationFields: [{ key: 'ahpPairwiseMode', label: 'Pairwise mode', type: 'select', defaultValue: 'Criteria only', options: ['Criteria only', 'Criteria and alternatives'] }, { key: 'ahpConsistencyThreshold', label: 'Consistency threshold', type: 'number', defaultValue: 0.1 }], outputs: ['Priority matrix', 'Consistency report', 'Global rank'], supportsWeights: true, runAnalysis: (input, config) => runAHP(input, config, getMethod('ahp')) }),
  withBase({ id: 'dematel', name: 'DEMATEL', fullName: 'Decision-Making Trial and Evaluation Laboratory', description: 'Causal influence modeling among factors.', parameters: ['dematelExpertCount', 'dematelAggregation', 'dematelThreshold', 'dematelManualThreshold', 'dematelFuzzyCalculation'], specificationFields: [{ key: 'dematelExpertCount', label: 'Expert count', type: 'number', defaultValue: 1 }, { key: 'dematelAggregation', label: 'Aggregation', type: 'select', defaultValue: 'Arithmetic mean', options: ['Arithmetic mean'] }, { key: 'dematelThreshold', label: 'Threshold method', type: 'select', defaultValue: 'Mean threshold', options: ['Mean threshold', 'Manual threshold'] }, { key: 'dematelManualThreshold', label: 'Manual threshold value', type: 'number', defaultValue: 0.1 }, { key: 'dematelFuzzyCalculation', label: 'Fuzzy DEMATEL calculation', type: 'select', defaultValue: 'Component-wise fuzzy total relation', options: ['Component-wise fuzzy total relation', 'Defuzzify before total relation'] }], outputs: ['Direct relation matrix', 'Total relation matrix', 'Thresholded relation matrix', 'D/R indicators', 'Cause-effect grouping'], supportsWeights: false, runAnalysis: (input, config) => runDematel(input, config, getMethod('dematel')) }),
  withBase({ id: 'vikor', name: 'VIKOR', fullName: 'VIseKriterijumska Optimizacija I Kompromisno Resenje', description: 'Compromise ranking by utility and regret.', parameters: ['vikorV', 'vikorAcceptableAdvantageMode', 'vikorAcceptableAdvantageDQ', 'vikorStabilityRule'], specificationFields: [{ key: 'vikorV', label: 'Strategy coefficient v', type: 'number', defaultValue: 0.5 }, { key: 'vikorAcceptableAdvantageMode', label: 'Acceptable advantage', type: 'select', defaultValue: 'Auto DQ = 1/(m-1)', options: ['Auto DQ = 1/(m-1)', 'Manual DQ'] }, { key: 'vikorAcceptableAdvantageDQ', label: 'Manual DQ', type: 'number', defaultValue: 0.25 }, { key: 'vikorStabilityRule', label: 'Stability rule', type: 'select', defaultValue: 'Q winner must also lead S or R', options: ['Q winner must also lead S or R', 'Diagnostic only'] }], outputs: ['S measure', 'R measure', 'Q compromise rank', 'Acceptable solution checks'], supportsWeights: true, runAnalysis: (input, config) => runVikor(input, config, getMethod('vikor')) }),
  withBase({ id: 'copras', name: 'COPRAS', fullName: 'Complex Proportional Assessment', description: 'Proportional assessment of beneficial and non-beneficial criteria.', parameters: ['normalization'], specificationFields: [{ key: 'normalization', label: 'Normalization', type: 'select', defaultValue: 'Linear normalization', options: ['Linear normalization'] }], outputs: ['Normalized matrix', 'Weighted sums', 'Utility rank'], supportsWeights: true, runAnalysis: (input, config) => runCopras(input, config, getMethod('copras')) }),
  withBase({ id: 'saw', name: 'SAW / WSM', fullName: 'Simple Additive Weighting / Weighted Sum Model', description: 'Weighted additive utility model.', parameters: ['normalization'], specificationFields: [{ key: 'normalization', label: 'Normalization', type: 'select', defaultValue: 'Linear normalization', options: ['Linear normalization'] }], outputs: ['Normalized matrix', 'Weighted matrix', 'Utility rank'], supportsWeights: true, runAnalysis: (input, config) => runWeightedSum(input, config, getMethod('saw'), 'SAW') }),
  withBase({ id: 'srp', name: 'SRP', fullName: 'Simple Ranking Process', description: 'Rank-based method using weighted criterion-wise alternative ranks.', parameters: ['srpRankMode'], specificationFields: [{ key: 'srpRankMode', label: 'Rank mode', type: 'select', defaultValue: 'Criterion-wise rank aggregation', options: ['Criterion-wise rank aggregation'] }], outputs: ['Criterion-wise rank matrix', 'Weighted rank matrix', 'Final preference score'], supportsWeights: true, runAnalysis: (input, config) => runSrp(input, config, getMethod('srp')) }),
  withBase({ id: 'fuca', name: 'FUCA', fullName: 'Faire Un Choix Adequat', description: 'Rank-based method using the smallest weighted criterion-wise rank score.', parameters: ['fucaRankMode'], specificationFields: [{ key: 'fucaRankMode', label: 'Rank mode', type: 'select', defaultValue: 'Weighted criterion-wise ranks', options: ['Weighted criterion-wise ranks'] }], outputs: ['Criterion-wise rank matrix', 'Weighted rank matrix', 'Final weighted rank score'], supportsWeights: true, runAnalysis: (input, config) => runFuca(input, config, getMethod('fuca')) }),
  withBase({ id: 'seca', name: 'SECA', fullName: 'Simultaneous Evaluation of Criteria and Alternatives', description: 'Self-weighting method using performance, standard-deviation, and correlation reference points.', parameters: ['secaEpsilon', 'secaReferenceBalance'], specificationFields: [{ key: 'secaEpsilon', label: 'Minimum weight epsilon', type: 'number', defaultValue: 0.001 }, { key: 'secaReferenceBalance', label: 'Performance-reference balance', type: 'number', defaultValue: 0.5 }], outputs: ['Normalized matrix', 'Reference-point weights', 'Weighted matrix', 'Alternative scores'], supportsWeights: false, runAnalysis: (input, config) => runSeca(input, config, getMethod('seca')) }),
  withBase({ id: 'dear', name: 'DEAR', fullName: 'Data Envelopment Analysis-based Ranking', description: 'Response desirability weighting for multi-response ranking.', parameters: ['dearAggregation'], specificationFields: [{ key: 'dearAggregation', label: 'Aggregation', type: 'select', defaultValue: 'Mean response performance index', options: ['Mean response performance index'] }], outputs: ['Response weights', 'Weighted response weights', 'Multi-response performance index'], supportsWeights: true, runAnalysis: (input, config) => runDear(input, config, getMethod('dear')) }),
  withBase({ id: 'eamr', name: 'EAMR', fullName: 'Evaluation by an Area-based Method of Ranking', description: 'Blended normalization and benefit-cost appraisal ranking.', parameters: ['eamrBeta', 'eamrLambda'], specificationFields: [{ key: 'eamrBeta', label: 'Normalization blend beta', type: 'number', defaultValue: 0.5 }, { key: 'eamrLambda', label: 'Benefit-cost score lambda', type: 'number', defaultValue: 0.5 }], outputs: ['Range-normalized matrix', 'Vector-normalized matrix', 'Blended weighted matrix', 'Benefit-cost appraisal', 'Final rank'], supportsWeights: true, runAnalysis: (input, config) => runEamr(input, config, getMethod('eamr')) }),
  withBase({ id: 'rawec', name: 'RAWEC', fullName: 'Ranking Alternatives with Weights of Criterion', description: 'Double-normalization deviation-index ranking.', parameters: [], specificationFields: [], outputs: ['First normalized matrix', 'Second normalized matrix', 'Weighted deviations', 'Q deviation index', 'Final rank'], supportsWeights: true, runAnalysis: (input, config) => runRawec(input, config, getMethod('rawec')) }),
  withBase({ id: 'comet', name: 'COMET', fullName: 'Characteristic Objects Method', description: 'Fuzzy characteristic-object preference interpolation.', parameters: ['cometCharacteristicValues', 'cometPreferenceModel'], specificationFields: [{ key: 'cometCharacteristicValues', label: 'Characteristic values', type: 'select', defaultValue: 'min,mid,max', options: ['min,max', 'min,mid,max', 'quartiles'] }, { key: 'cometPreferenceModel', label: 'Preference model', type: 'select', defaultValue: 'Weight-directed preference', options: ['Weight-directed preference', 'TOPSIS expert'] }], outputs: ['Characteristic values', 'Characteristic objects', 'Preference function', 'Final rank'], supportsWeights: true, runAnalysis: (input, config) => runComet(input, config, getMethod('comet')) }),
  withBase({ id: 'wpm', name: 'WPM', fullName: 'Weighted Product Model', description: 'Multiplicative weighted utility model.', parameters: ['normalization'], specificationFields: [{ key: 'normalization', label: 'Normalization', type: 'select', defaultValue: 'Linear normalization', options: ['Linear normalization'] }], outputs: ['Normalized matrix', 'Product utility', 'Final rank'], supportsWeights: true, runAnalysis: (input, config) => runWpm(input, config, getMethod('wpm')) }),
  withBase({ id: 'waspas', name: 'WASPAS', fullName: 'Weighted Aggregated Sum Product Assessment', description: 'Hybrid additive and multiplicative utility model.', parameters: ['waspasLambda'], specificationFields: [{ key: 'waspasLambda', label: 'Lambda', type: 'number', defaultValue: 0.5 }], outputs: ['WSM score', 'WPM score', 'WASPAS score'], supportsWeights: true, runAnalysis: (input, config) => runWaspas(input, config, getMethod('waspas')) }),
  withBase({ id: 'moora', name: 'MOORA', fullName: 'Multi-Objective Optimization by Ratio Analysis', description: 'Ratio-based beneficial minus non-beneficial optimization.', parameters: ['normalization'], specificationFields: [{ key: 'normalization', label: 'Normalization', type: 'select', defaultValue: 'Ratio normalization', options: ['Ratio normalization'] }], outputs: ['Ratio matrix', 'Net score', 'Final rank'], supportsWeights: true, runAnalysis: (input, config) => runMoora(input, config, getMethod('moora')) }),
  withBase({ id: 'moosra', name: 'MOOSRA', fullName: 'Multi-Objective Optimization on the basis of Simple Ratio Analysis', description: 'Benefit-to-cost ratio analysis for conflicting objectives.', parameters: ['normalization'], specificationFields: [{ key: 'normalization', label: 'Normalization', type: 'select', defaultValue: 'Vector normalization', options: ['Vector normalization'] }], outputs: ['Ratio matrix', 'Weighted ratio matrix', 'Benefit/cost ratio', 'Final rank'], supportsWeights: true, runAnalysis: (input, config) => runMoosra(input, config, getMethod('moosra')) }),
  withBase({ id: 'arlon', name: 'ARLON', fullName: 'Alternative Ranking using two-step LOgarithmic Normalization', description: 'Two-step logarithmic normalization and benefit-cost performance ranking.', parameters: ['arlonGamma'], specificationFields: [{ key: 'arlonGamma', label: 'Log-normalization blend gamma', type: 'number', defaultValue: 0.5 }], outputs: ['First log-normalized matrix', 'Second log-normalized matrix', 'Weighted benefit/cost components', 'Final rank'], supportsWeights: true, runAnalysis: (input, config) => runArlon(input, config, getMethod('arlon')) }),
  withBase({ id: 'macont', name: 'MACONT', fullName: 'Mixed Aggregation by Comprehensive Normalization Technique', description: 'Comprehensive normalization with mixed compensatory and non-compensatory aggregation.', parameters: ['macontLambda', 'macontMu', 'macontDelta', 'macontTheta'], specificationFields: [{ key: 'macontLambda', label: 'Normalization balance lambda', type: 'number', defaultValue: 0.3333 }, { key: 'macontMu', label: 'Normalization balance mu', type: 'number', defaultValue: 0.3333 }, { key: 'macontDelta', label: 'Compensatory balance delta', type: 'number', defaultValue: 0.5 }, { key: 'macontTheta', label: 'Best-worst balance theta', type: 'number', defaultValue: 0.5 }], outputs: ['Three normalized matrices', 'Virtual reference alternative', 'Mixed aggregation scores', 'Final rank'], supportsWeights: true, runAnalysis: (input, config) => runMacont(input, config, getMethod('macont')) }),
  withBase({ id: 'aras', name: 'ARAS', fullName: 'Additive Ratio Assessment', description: 'Additive ratio utility assessment.', parameters: ['normalization'], specificationFields: [{ key: 'normalization', label: 'Normalization', type: 'select', defaultValue: 'Linear normalization', options: ['Linear normalization'] }], outputs: ['Normalized matrix', 'Optimality function', 'Utility degree'], supportsWeights: true, runAnalysis: (input, config) => runAras(input, config, getMethod('aras')) }),
  withBase({ id: 'edas', name: 'EDAS', fullName: 'Evaluation based on Distance from Average Solution', description: 'Average-solution distance appraisal.', parameters: ['normalization'], specificationFields: [{ key: 'normalization', label: 'Reference', type: 'select', defaultValue: 'Average solution', options: ['Average solution'] }], outputs: ['Positive distance', 'Negative distance', 'Appraisal score'], supportsWeights: true, runAnalysis: (input, config) => runEdas(input, config, getMethod('edas')) }),
  withBase({ id: 'mabac', name: 'MABAC', fullName: 'Multi-Attributive Border Approximation Area Comparison', description: 'Border approximation distance ranking.', parameters: ['normalization'], specificationFields: [{ key: 'normalization', label: 'Normalization', type: 'select', defaultValue: 'Linear normalization', options: ['Linear normalization'] }], outputs: ['Weighted matrix', 'Border area', 'Distance matrix', 'Final rank'], supportsWeights: true, runAnalysis: (input, config) => runMabac(input, config, getMethod('mabac')) }),
  withBase({ id: 'codas', name: 'CODAS', fullName: 'Combinative Distance-Based Assessment', description: 'Distance from negative ideal ranking.', parameters: ['normalization', 'codasTau'], specificationFields: [{ key: 'normalization', label: 'Normalization', type: 'select', defaultValue: 'Linear normalization', options: ['Linear normalization'] }, { key: 'codasTau', label: 'Tau threshold', type: 'number', defaultValue: 0.02 }], outputs: ['Weighted matrix', 'Euclidean distance', 'Taxicab distance', 'Relative assessment matrix', 'Final rank'], supportsWeights: true, runAnalysis: (input, config) => runCodas(input, config, getMethod('codas')) }),
  withBase({ id: 'cocoso', name: 'CoCoSo', fullName: 'Combined Compromise Solution', description: 'Combined compromise appraisal model.', parameters: ['normalization', 'cocosoLambda'], specificationFields: [{ key: 'normalization', label: 'Normalization', type: 'select', defaultValue: 'Linear normalization', options: ['Linear normalization'] }, { key: 'cocosoLambda', label: 'Lambda', type: 'number', defaultValue: 0.5 }], outputs: ['S score', 'P score', 'Compromise score', 'Final rank'], supportsWeights: true, runAnalysis: (input, config) => runCocoso(input, config, getMethod('cocoso')) }),
  withBase({ id: 'cradis', name: 'CRADIS', fullName: 'Compromise Ranking of Alternatives from Distance to Ideal Solution', description: 'Deviation from ideal and anti-ideal solution ranking.', parameters: ['normalization'], specificationFields: [{ key: 'normalization', label: 'Normalization', type: 'select', defaultValue: 'Ratio normalization', options: ['Ratio normalization'] }], outputs: ['Normalized matrix', 'Weighted matrix', 'Ideal/anti-ideal deviations', 'Appraisal coefficients', 'Final rank'], supportsWeights: true, runAnalysis: (input, config) => runCradis(input, config, getMethod('cradis')) }),
  withBase({ id: 'mara', name: 'MARA', fullName: 'Magnitude of the Area for the Ranking of Alternatives', description: 'Area-gap ranking against an optimal alternative.', parameters: ['normalization'], specificationFields: [{ key: 'normalization', label: 'Normalization', type: 'select', defaultValue: 'MPSI-style normalization', options: ['MPSI-style normalization'] }], outputs: ['Normalized matrix', 'Weighted matrix', 'Optimal alternative', 'Area gap', 'Final rank'], supportsWeights: true, runAnalysis: (input, config) => runMara(input, config, getMethod('mara')) }),
  withBase({ id: 'raps', name: 'RAPS', fullName: 'Ranking Alternatives by Perimeter Similarity', description: 'Perimeter similarity ranking against an optimal alternative.', parameters: ['normalization'], specificationFields: [{ key: 'normalization', label: 'Normalization', type: 'select', defaultValue: 'MPSI-style normalization', options: ['MPSI-style normalization'] }], outputs: ['Normalized matrix', 'Weighted matrix', 'Optimal components', 'Perimeter similarity', 'Final rank'], supportsWeights: true, runAnalysis: (input, config) => runRaps(input, config, getMethod('raps')) }),
  withBase({ id: 'oreste', name: 'ORESTE', fullName: 'Organisation, Rangement Et Synthese De Donnees Relationnelles', description: 'Rank-preference method using criterion and alternative orders.', parameters: ['oresteRankModel'], specificationFields: [{ key: 'oresteRankModel', label: 'Rank model', type: 'select', defaultValue: 'Besson projection ranks', options: ['Besson projection ranks'] }], outputs: ['Criterion ranks', 'Alternative ranks', 'Projection distances', 'Global projection ranks', 'Final rank'], supportsWeights: true, runAnalysis: (input, config) => runOreste(input, config, getMethod('oreste')) }),
  withBase({ id: 'qualiflex', name: 'QUALIFLEX', fullName: 'Qualitative Flexible Multiple Criteria Method', description: 'Permutation outranking method based on concordance and discordance.', parameters: ['qualiflexExactLimit'], specificationFields: [{ key: 'qualiflexExactLimit', label: 'Exact permutation limit', type: 'number', defaultValue: 7 }], outputs: ['Pairwise concordance/discordance', 'Permutation summary', 'Best ranking order'], supportsWeights: true, runAnalysis: (input, config) => runQualiflex(input, config, getMethod('qualiflex')) }),
  withBase({ id: 'regime', name: 'REGIME', fullName: 'REGIME Analysis', description: 'Pairwise dominance ranking using weighted criterion signs.', parameters: ['regimePreferenceModel'], specificationFields: [{ key: 'regimePreferenceModel', label: 'Preference model', type: 'select', defaultValue: 'Weighted sign dominance', options: ['Weighted sign dominance'] }], outputs: ['Dominance matrix', 'Positive flow', 'Negative flow', 'Net dominance rank'], supportsWeights: true, runAnalysis: (input, config) => runRegime(input, config, getMethod('regime')) }),
  withBase({ id: 'evamix', name: 'EVAMIX', fullName: 'Evaluation of Mixed Data', description: 'Pairwise dominance appraisal for mixed-data decision problems.', parameters: ['evamixDataMode'], specificationFields: [{ key: 'evamixDataMode', label: 'Data mode', type: 'select', defaultValue: 'Cardinal numeric criteria', options: ['Cardinal numeric criteria'] }], outputs: ['Normalized matrix', 'Cardinal dominance matrix', 'Standardized dominance matrix', 'Net appraisal rank'], supportsWeights: true, runAnalysis: (input, config) => runEvamix(input, config, getMethod('evamix')) }),
  withBase({ id: 'lexicographic', name: 'Lexicographic', fullName: 'Lexicographic Decision Rule', description: 'Strict priority-order ranking without compensatory trade-offs.', parameters: ['lexicographicOrder'], specificationFields: [{ key: 'lexicographicOrder', label: 'Criterion priority order', type: 'text', defaultValue: 'C1,C2,C3,C4,C5,C6,C7' }], outputs: ['Criterion priority order', 'Direction-adjusted matrix', 'Sequential comparison evidence', 'Final rank'], supportsWeights: false, runAnalysis: (input, config) => runLexicographic(input, config, getMethod('lexicographic')) }),
  withBase({ id: 'marcos', name: 'MARCOS', fullName: 'Measurement of Alternatives and Ranking according to Compromise Solution', description: 'Ideal and anti-ideal utility ranking.', parameters: ['normalization', 'marcosScoreMode'], specificationFields: [{ key: 'normalization', label: 'Normalization', type: 'select', defaultValue: 'Utility normalization', options: ['Utility normalization'] }, { key: 'marcosScoreMode', label: 'Ranking convention', type: 'select', defaultValue: 'Standard utility function f(K)', options: ['Standard utility function f(K)', 'Published range-scaled f(K+) convention'] }], outputs: ['Extended matrix', 'Utility degrees', 'Final rank'], supportsWeights: true, runAnalysis: (input, config) => runMarcos(input, config, getMethod('marcos')) }),
  withBase({ id: 'mairca', name: 'MAIRCA', fullName: 'Multi-Attributive Ideal-Real Comparative Analysis', description: 'Ideal-real assessment gap ranking.', parameters: ['normalization'], specificationFields: [{ key: 'normalization', label: 'Normalization', type: 'select', defaultValue: 'Linear normalization', options: ['Linear normalization'] }], outputs: ['Normalized matrix', 'Theoretical assessment matrix', 'Real assessment matrix', 'Gap matrix', 'Final rank'], supportsWeights: true, runAnalysis: (input, config) => runMairca(input, config, getMethod('mairca')) }),
  withBase({ id: 'promethee', name: 'PROMETHEE II', fullName: 'Preference Ranking Organization Method for Enrichment Evaluations', description: 'Outranking by positive, negative, and net preference flows.', parameters: ['preferenceFunction', 'prometheeIndifferenceThreshold', 'prometheePreferenceThreshold', 'prometheeGaussianSigma'], specificationFields: [{ key: 'preferenceFunction', label: 'Preference function', type: 'select', defaultValue: 'Usual', options: ['Usual', 'U-shape', 'V-shape', 'Level', 'Linear', 'Gaussian'] }, { key: 'prometheeIndifferenceThreshold', label: 'Indifference threshold q', type: 'number', defaultValue: 0 }, { key: 'prometheePreferenceThreshold', label: 'Preference threshold p', type: 'number', defaultValue: 1 }, { key: 'prometheeGaussianSigma', label: 'Gaussian sigma', type: 'number', defaultValue: 1 }], outputs: ['Preference index matrix', 'Positive flow', 'Negative flow', 'Net flow'], supportsWeights: true, runAnalysis: (input, config) => runPromethee(input, config, getMethod('promethee')) }),
  withBase({ id: 'electre', name: 'ELECTRE I', fullName: 'Elimination and Choice Expressing Reality', description: 'Concordance-discordance outranking model.', parameters: ['electreConcordance', 'electreDiscordance'], specificationFields: [{ key: 'electreConcordance', label: 'Concordance threshold', type: 'number', defaultValue: 0.6 }, { key: 'electreDiscordance', label: 'Discordance threshold', type: 'number', defaultValue: 0.4 }], outputs: ['Concordance matrix', 'Discordance matrix', 'Outranking relation', 'Net score'], supportsWeights: true, runAnalysis: (input, config) => runElectre(input, config, getMethod('electre')) }),
  withBase({ id: 'smart', name: 'SMART', fullName: 'Simple Multi-Attribute Rating Technique', description: 'Normalized utility and swing-weight aggregation.', parameters: ['normalization'], specificationFields: [{ key: 'normalization', label: 'Utility scaling', type: 'select', defaultValue: 'Linear utility', options: ['Linear utility'] }], outputs: ['Utility matrix', 'Weighted utilities', 'Final rank'], supportsWeights: true, runAnalysis: (input, config) => runSmart(input, config, getMethod('smart')) }),
  withBase({ id: 'maut', name: 'MAUT', fullName: 'Multi-Attribute Utility Theory', description: 'Single-attribute utility aggregation.', parameters: ['normalization', 'mautUtilityShape'], specificationFields: [{ key: 'normalization', label: 'Utility scaling', type: 'select', defaultValue: 'Linear utility', options: ['Linear utility', 'Input values are utilities'] }, { key: 'mautUtilityShape', label: 'Utility shape', type: 'select', defaultValue: 'Linear', options: ['Linear', 'Concave', 'Convex'] }], outputs: ['Utility matrix', 'Weighted utility matrix', 'Final rank'], supportsWeights: true, runAnalysis: (input, config) => runMaut(input, config, getMethod('maut')) }),
  withBase({ id: 'smarter', name: 'SMARTER', fullName: 'Simple Multi-Attribute Rating Technique Exploiting Ranks', description: 'Ranked swing-weight utility scoring using rank-order centroid weights.', parameters: ['smarterOrder', 'smarterUtilityMode', 'smarterScoreMode'], specificationFields: [{ key: 'smarterOrder', label: 'Ranked swing-weight order', type: 'text', defaultValue: 'C1,C2,C3,C4,C5,C6,C7' }, { key: 'smarterUtilityMode', label: 'Utility input', type: 'select', defaultValue: 'Normalize performances', options: ['Normalize performances', 'Input values are utilities'] }, { key: 'smarterScoreMode', label: 'Reported score', type: 'select', defaultValue: 'Raw additive utility', options: ['Raw additive utility', 'Normalize total scores'] }], outputs: ['Rank-order centroid weights', 'Single-attribute utilities', 'ROC-weighted utilities', 'Final rank'], supportsWeights: false, runAnalysis: (input, config) => runSmarter(input, config, getMethod('smarter')) }),
  withBase({ id: 'macbeth', name: 'MACBETH-style', fullName: 'Measuring Attractiveness by a Categorical Based Evaluation Technique', description: 'Categorical value-anchor scoring for additive attractiveness models.', parameters: ['macbethCategoryScale'], specificationFields: [{ key: 'macbethCategoryScale', label: 'Category value anchors', type: 'text', defaultValue: '0,1,2,3,4,5,6' }], outputs: ['Categorical value anchors', 'Assigned attractiveness categories', 'Value matrix', 'Weighted value matrix', 'Final rank'], supportsWeights: true, runAnalysis: (input, config) => runMacbeth(input, config, getMethod('macbeth')) }),
  withBase({ id: 'pugh', name: 'Pugh Matrix', fullName: 'Pugh Concept Selection Matrix', description: 'Baseline concept comparison or uploaded score aggregation for design selection.', parameters: ['pughScoringMode', 'pughBaselineAlternative', 'pughIndifferenceTolerance', 'pughScoreTransform'], specificationFields: [{ key: 'pughScoringMode', label: 'Scoring mode', type: 'select', defaultValue: 'Compare performance to baseline', options: ['Compare performance to baseline', 'Use uploaded Pugh scores'] }, { key: 'pughBaselineAlternative', label: 'Baseline alternative ID', type: 'text', defaultValue: 'S1' }, { key: 'pughIndifferenceTolerance', label: 'Same-as-baseline tolerance', type: 'number', defaultValue: 0 }, { key: 'pughScoreTransform', label: 'Uploaded score transform', type: 'select', defaultValue: 'Raw uploaded scores', options: ['Raw uploaded scores', 'Global 0-1 rescale'] }], outputs: ['Baseline or uploaded score settings', 'Relative score matrix', 'Transformed score matrix', 'Weighted score matrix', 'Plus/minus summary', 'Final rank'], supportsWeights: true, runAnalysis: (input, config) => runPugh(input, config, getMethod('pugh')) }),
  withBase({ id: 'ocra', name: 'OCRA', fullName: 'Operational Competitiveness Rating Analysis', description: 'Benefit and cost competitiveness rating.', parameters: ['normalization'], specificationFields: [{ key: 'normalization', label: 'Normalization', type: 'select', defaultValue: 'Linear normalization', options: ['Linear normalization'] }], outputs: ['Weighted matrix', 'Preference components', 'Final rank'], supportsWeights: true, runAnalysis: (input, config) => runOcra(input, config, getMethod('ocra')) }),
  withBase({ id: 'multimoora', name: 'MULTIMOORA', fullName: 'Multi-Objective Optimization by Ratio Analysis plus Multiplicative Form', description: 'Ratio, reference point, and multiplicative aggregation.', parameters: ['normalization', 'multimooraAggregation'], specificationFields: [{ key: 'normalization', label: 'Normalization', type: 'select', defaultValue: 'Ratio normalization', options: ['Ratio normalization'] }, { key: 'multimooraAggregation', label: 'Aggregation', type: 'select', defaultValue: 'Dominance theory', options: ['Dominance theory', 'Rank sum'] }], outputs: ['Ratio system', 'Reference point', 'Multiplicative form', 'Dominance rank'], supportsWeights: true, runAnalysis: (input, config) => runMultimoora(input, config, getMethod('multimoora')) }),
  withBase({ id: 'psi', name: 'PSI', fullName: 'Preference Selection Index', description: 'Objective preference-selection weighting and ranking.', parameters: ['normalization', 'psiScoreMode'], specificationFields: [{ key: 'normalization', label: 'Normalization', type: 'select', defaultValue: 'Linear normalization', options: ['Linear normalization'] }, { key: 'psiScoreMode', label: 'Scoring convention', type: 'select', defaultValue: 'Criterion objective weights', options: ['Criterion objective weights', 'Alternative preference index'] }], outputs: ['Normalized matrix', 'Objective PSI weights', 'Final rank'], supportsWeights: true, runAnalysis: (input, config) => runPsi(input, config, getMethod('psi')) }),
  withBase({ id: 'piv', name: 'PIV', fullName: 'Proximity Indexed Value', description: 'Proximity from best weighted normalized values.', parameters: ['normalization'], specificationFields: [{ key: 'normalization', label: 'Normalization', type: 'select', defaultValue: 'Vector normalization', options: ['Vector normalization'] }], outputs: ['Weighted matrix', 'Proximity index', 'Final rank'], supportsWeights: true, runAnalysis: (input, config) => runPiv(input, config, getMethod('piv')) }),
  withBase({ id: 'rov', name: 'ROV', fullName: 'Range of Value Method', description: 'Best and worst utility aggregation.', parameters: ['normalization'], specificationFields: [{ key: 'normalization', label: 'Normalization', type: 'select', defaultValue: 'Linear normalization', options: ['Linear normalization'] }], outputs: ['Normalized matrix', 'Best utility', 'Worst utility', 'Final rank'], supportsWeights: true, runAnalysis: (input, config) => runRov(input, config, getMethod('rov')) }),
  withBase({ id: 'wisp', name: 'WISP', fullName: 'Weighted Integrated Sum Product', description: 'Integrated weighted sum/product difference and ratio utility appraisal.', parameters: ['normalization'], specificationFields: [{ key: 'normalization', label: 'Normalization', type: 'select', defaultValue: 'Linear normalization', options: ['Linear normalization'] }], outputs: ['Normalized matrix', 'Utility components', 'Final rank'], supportsWeights: true, runAnalysis: (input, config) => runWisp(input, config, getMethod('wisp')) }),
  withBase({ id: 'todim', name: 'TODIM', fullName: 'Interactive and Multi-Criteria Decision Making', description: 'Prospect-theory pairwise dominance ranking.', parameters: ['todimTheta'], specificationFields: [{ key: 'todimTheta', label: 'Loss attenuation theta', type: 'number', defaultValue: 1 }], outputs: ['Normalized matrix', 'Pairwise dominance matrix', 'Dominance score', 'Final rank'], supportsWeights: true, runAnalysis: (input, config) => runTodim(input, config, getMethod('todim')) }),
  withBase({ id: 'ram', name: 'RAM', fullName: 'Root Assessment Method', description: 'Benefit-cost utility assessment ranking.', parameters: ['normalization'], specificationFields: [{ key: 'normalization', label: 'Normalization', type: 'select', defaultValue: 'Column-sum normalization', options: ['Column-sum normalization'] }], outputs: ['Normalized matrix', 'Weighted matrix', 'Benefit/cost utility', 'Final rank'], supportsWeights: true, runAnalysis: (input, config) => runRam(input, config, getMethod('ram')) }),
  withBase({ id: 'gra', name: 'GRA', fullName: 'Grey Relational Analysis', description: 'Grey relational grade ranking against an ideal sequence.', parameters: ['graZeta'], specificationFields: [{ key: 'graZeta', label: 'Distinguishing coefficient zeta', type: 'number', defaultValue: 0.5 }], outputs: ['Normalized matrix', 'Grey relational coefficients', 'Weighted coefficients', 'Final rank'], supportsWeights: true, runAnalysis: (input, config) => runGra(input, config, getMethod('gra')) }),
  withBase({ id: 'grp', name: 'GRP', fullName: 'Grey Relational Projection', description: 'Grey projection ranking against positive and negative ideals.', parameters: ['graZeta'], specificationFields: [{ key: 'graZeta', label: 'Distinguishing coefficient zeta', type: 'number', defaultValue: 0.5 }], outputs: ['Normalized matrix', 'Positive grey coefficients', 'Negative grey coefficients', 'Projection closeness rank'], supportsWeights: true, runAnalysis: (input, config) => runGrp(input, config, getMethod('grp')) }),
  withBase({ id: 'spotis', name: 'SPOTIS', fullName: 'Stable Preference Ordering Towards Ideal Solution', description: 'Rank-reversal-resistant ideal-bound distance ranking.', parameters: ['spotisBounds', 'spotisLowerBounds', 'spotisUpperBounds'], specificationFields: [{ key: 'spotisBounds', label: 'Criterion bounds', type: 'select', defaultValue: 'Observed data range', options: ['Observed data range', 'Manual bounds'] }, { key: 'spotisLowerBounds', label: 'Manual lower bounds', type: 'text', defaultValue: '50,60,5,60,10,50,5' }, { key: 'spotisUpperBounds', label: 'Manual upper bounds', type: 'text', defaultValue: '100,100,20,100,25,100,10' }], outputs: ['Criterion bounds', 'Ideal point', 'Normalized distances', 'Weighted distances', 'Final rank'], supportsWeights: true, runAnalysis: (input, config) => runSpotis(input, config, getMethod('spotis')) }),
  withBase({ id: 'espSpotis', name: 'ESP-SPOTIS', fullName: 'Expected Solution Point SPOTIS', description: 'Target-distance SPOTIS variant using a researcher-defined expected solution point.', parameters: ['espSpotisPoint', 'espSpotisBounds', 'spotisLowerBounds', 'spotisUpperBounds'], specificationFields: [{ key: 'espSpotisPoint', label: 'Expected solution point', type: 'text', defaultValue: '70,85,100,88,75,80,28' }, { key: 'espSpotisBounds', label: 'Criterion bounds', type: 'select', defaultValue: 'Observed data range', options: ['Observed data range', 'Manual bounds'] }, { key: 'spotisLowerBounds', label: 'Manual lower bounds', type: 'text', defaultValue: '50,60,5,60,10,50,5' }, { key: 'spotisUpperBounds', label: 'Manual upper bounds', type: 'text', defaultValue: '100,100,20,100,25,100,10' }], outputs: ['Criterion bounds', 'Expected solution point', 'Normalized distances', 'Weighted distances', 'Final rank'], supportsWeights: true, runAnalysis: (input, config) => runEspSpotis(input, config, getMethod('espSpotis')) }),
  withBase({ id: 'balancedSpotis', name: 'B-SPOTIS', fullName: 'Balanced Stable Preference Ordering Towards Ideal Solution', description: 'Balanced distance ranking from ideal and expected solution points.', parameters: ['balancedSpotisAlpha', 'espSpotisPoint', 'balancedSpotisBounds', 'spotisLowerBounds', 'spotisUpperBounds'], specificationFields: [{ key: 'balancedSpotisAlpha', label: 'ESP confidence alpha', type: 'number', defaultValue: 0.5 }, { key: 'espSpotisPoint', label: 'Expected solution point', type: 'text', defaultValue: '70,85,100,88,75,80,28' }, { key: 'balancedSpotisBounds', label: 'Criterion bounds', type: 'select', defaultValue: 'Observed data range', options: ['Observed data range', 'Manual bounds'] }, { key: 'spotisLowerBounds', label: 'Manual lower bounds', type: 'text', defaultValue: '50,60,5,60,10,50,5' }, { key: 'spotisUpperBounds', label: 'Manual upper bounds', type: 'text', defaultValue: '100,100,20,100,25,100,10' }], outputs: ['Criterion bounds', 'Ideal and expected points', 'Distance from ISP', 'Distance from ESP', 'Balanced distance rank'], supportsWeights: true, runAnalysis: (input, config) => runBalancedSpotis(input, config, getMethod('balancedSpotis')) }),
  withBase({ id: 'wedba', name: 'WEDBA', fullName: 'Weighted Euclidean Distance-Based Approach', description: 'Weighted Euclidean distance ranking from ideal and anti-ideal reference points.', parameters: ['wedbaNormalization'], specificationFields: [{ key: 'wedbaNormalization', label: 'Normalization', type: 'select', defaultValue: 'Ratio normalization', options: ['Ratio normalization'] }], outputs: ['Normalized matrix', 'Standardized matrix', 'Ideal and anti-ideal points', 'Distance index', 'Final rank'], supportsWeights: true, runAnalysis: (input, config) => runWedba(input, config, getMethod('wedba')) }),
  withBase({ id: 'lmaw', name: 'LMAW', fullName: 'Logarithm Methodology of Additive Weights', description: 'Logarithmic additive weighting and alternative ranking.', parameters: ['lmawScaling', 'lmawScoreMode'], specificationFields: [{ key: 'lmawScaling', label: 'Scaling', type: 'select', defaultValue: 'Log additive scaling', options: ['Log additive scaling'] }, { key: 'lmawScoreMode', label: 'Scoring convention', type: 'select', defaultValue: 'Nonlinear Q utility', options: ['Nonlinear Q utility', 'Weighted log sum'] }], outputs: ['Positive standardized matrix', 'Logarithmic additive matrix', 'Weighted matrix', 'Final rank'], supportsWeights: true, runAnalysis: (input, config) => runLmaw(input, config, getMethod('lmaw')) }),
  withBase({ id: 'dnma', name: 'DNMA', fullName: 'Double Normalization-Based Multiple Aggregation', description: 'Double-normalization ranking with multiple aggregation utilities.', parameters: ['dnmaIntegration'], specificationFields: [{ key: 'dnmaIntegration', label: 'Integration', type: 'select', defaultValue: 'Utility and rank integration', options: ['Utility and rank integration'] }], outputs: ['Target values', 'Linear normalized matrix', 'Vector normalized matrix', 'Subordinate utilities', 'Final rank'], supportsWeights: true, runAnalysis: (input, config) => runDnma(input, config, getMethod('dnma')) }),
  withBase({ id: 'probid', name: 'PROBID', fullName: 'Preference Ranking on the Basis of Ideal-Average Distance', description: 'Ideal-average distance ranking with weighted reference solutions.', parameters: ['probidReference'], specificationFields: [{ key: 'probidReference', label: 'Reference model', type: 'select', defaultValue: 'Ideal-average distance', options: ['Ideal-average distance'] }], outputs: ['Vector normalized matrix', 'Weighted matrix', 'Reference solutions', 'Distance measures', 'Final rank'], supportsWeights: true, runAnalysis: (input, config) => runProbid(input, config, getMethod('probid')) }),
  withBase({ id: 'sprobid', name: 'SPROBID', fullName: 'Simplified Preference Ranking on the Basis of Ideal-Average Distance', description: 'Simplified PROBID ranking using first and last quarters of ideal reference solutions.', parameters: ['sprobidReference'], specificationFields: [{ key: 'sprobidReference', label: 'Reference model', type: 'select', defaultValue: 'First/last-quarter ideal distance', options: ['First/last-quarter ideal distance'] }], outputs: ['Vector normalized matrix', 'Weighted matrix', 'Quarter ideal reference distances', 'Final rank'], supportsWeights: true, runAnalysis: (input, config) => runSprobid(input, config, getMethod('sprobid')) }),
  withBase({ id: 'rim', name: 'RIM', fullName: 'Reference Ideal Method', description: 'Reference ideal interval ranking for target-based decisions.', parameters: ['rimReference', 'rimDomainLower', 'rimDomainUpper', 'rimIdealLower', 'rimIdealUpper'], specificationFields: [{ key: 'rimReference', label: 'Reference ideal', type: 'select', defaultValue: 'Observed ideal point', options: ['Observed ideal point', 'Manual ideal interval'] }, { key: 'rimDomainLower', label: 'Manual domain lower bounds', type: 'text', defaultValue: '50,70,80,70,60,65,15' }, { key: 'rimDomainUpper', label: 'Manual domain upper bounds', type: 'text', defaultValue: '90,100,140,100,90,95,40' }, { key: 'rimIdealLower', label: 'Manual ideal lower interval', type: 'text', defaultValue: '60,90,95,90,80,85,25' }, { key: 'rimIdealUpper', label: 'Manual ideal upper interval', type: 'text', defaultValue: '65,90,100,90,80,85,28' }], outputs: ['Criterion ranges', 'Reference ideal intervals', 'Closeness matrix', 'Weighted closeness matrix', 'Final rank'], supportsWeights: true, runAnalysis: (input, config) => runRim(input, config, getMethod('rim')) }),
  withBase({ id: 'rafsi', name: 'RAFSI', fullName: 'Ranking of Alternatives through Functional Mapping of Criterion Sub-Intervals into a Single Interval', description: 'Functional mapping into common criterion intervals.', parameters: ['rafsiReferenceMode', 'rafsiIntervalLower', 'rafsiIntervalUpper', 'rafsiIdealValues', 'rafsiAntiIdealValues'], specificationFields: [{ key: 'rafsiReferenceMode', label: 'Reference values', type: 'select', defaultValue: 'Observed extremes', options: ['Observed extremes', 'Manual reference values'] }, { key: 'rafsiIntervalLower', label: 'Interval lower bound', type: 'number', defaultValue: 1 }, { key: 'rafsiIntervalUpper', label: 'Interval upper bound', type: 'number', defaultValue: 6 }, { key: 'rafsiIdealValues', label: 'Manual ideal values', type: 'text', defaultValue: '50,100,80,100,90,95,15' }, { key: 'rafsiAntiIdealValues', label: 'Manual anti-ideal values', type: 'text', defaultValue: '90,70,140,70,60,65,40' }], outputs: ['Reference values', 'Functional mapping matrix', 'Normalized matrix', 'Weighted matrix', 'Final rank'], supportsWeights: true, runAnalysis: (input, config) => runRafsi(input, config, getMethod('rafsi')) }),
  withBase({ id: 'lopm', name: 'LoPM', fullName: 'Limits on Property Method', description: 'Property-limit merit scoring for lower, upper, and target requirements.', parameters: ['lopmLimitsMode', 'lopmTargetTolerance', 'lopmPropertyTypes', 'lopmPropertyLimits'], specificationFields: [{ key: 'lopmLimitsMode', label: 'Property limits', type: 'select', defaultValue: 'Observed limits', options: ['Observed limits', 'Manual property limits'] }, { key: 'lopmTargetTolerance', label: 'Target tolerance ratio', type: 'number', defaultValue: 0 }, { key: 'lopmPropertyTypes', label: 'Manual property types', type: 'text', defaultValue: 'upper,lower,upper,lower,lower,lower,upper' }, { key: 'lopmPropertyLimits', label: 'Manual property limits', type: 'text', defaultValue: '60,90,95,90,80,85,25' }], outputs: ['Property limits', 'Feasibility screen', 'Merit components', 'Weighted merit matrix', 'Final rank'], supportsWeights: true, runAnalysis: (input, config) => runLopm(input, config, getMethod('lopm')) }),
  withBase({ id: 'aroman', name: 'AROMAN', fullName: 'Alternative Ranking Order Method Accounting for Two-Step Normalization', description: 'Aggregated ranking using blended linear and vector normalization.', parameters: ['aromanBeta', 'aromanLambda'], specificationFields: [{ key: 'aromanBeta', label: 'Normalization blend beta', type: 'number', defaultValue: 0.5 }, { key: 'aromanLambda', label: 'Benefit/cost balance lambda', type: 'number', defaultValue: 0.5 }], outputs: ['Linear normalized matrix', 'Vector normalized matrix', 'Blended normalized matrix', 'Benefit/cost sums', 'Final rank'], supportsWeights: true, runAnalysis: (input, config) => runAroman(input, config, getMethod('aroman')) }),
  withBase({ id: 'cobra', name: 'COBRA', fullName: 'Comprehensive Distance-Based Ranking', description: 'Comprehensive ranking from ideal, anti-ideal, and average distances.', parameters: ['cobraDistanceMode'], specificationFields: [{ key: 'cobraDistanceMode', label: 'Distance model', type: 'select', defaultValue: 'Euclidean and taxicab', options: ['Euclidean and taxicab'] }], outputs: ['Normalized matrix', 'Weighted matrix', 'Reference solutions', 'Distance components', 'Final rank'], supportsWeights: true, runAnalysis: (input, config) => runCobra(input, config, getMethod('cobra')) }),
  withBase({ id: 'ervd', name: 'ERVD', fullName: 'Election Based on Relative Value Distances', description: 'Reference-point ranking by weighted relative gains and losses.', parameters: ['ervdReferenceMode', 'ervdReferencePoint', 'ervdLambda', 'ervdAlpha'], specificationFields: [{ key: 'ervdReferenceMode', label: 'Reference point', type: 'select', defaultValue: 'Observed mean', options: ['Observed mean', 'Manual reference point'] }, { key: 'ervdReferencePoint', label: 'Manual reference point', type: 'text', defaultValue: '72,80,111,85,70,75,30' }, { key: 'ervdLambda', label: 'Loss-aversion lambda', type: 'number', defaultValue: 2.25 }, { key: 'ervdAlpha', label: 'Sensitivity alpha', type: 'number', defaultValue: 0.88 }], outputs: ['Reference point', 'Utility matrix', 'Relative value matrix', 'Weighted relative values', 'Final rank'], supportsWeights: true, runAnalysis: (input, config) => runErvd(input, config, getMethod('ervd')) }),
];

export const getMethod = (id: string): MethodDefinition => methodRegistry.find((method) => method.id === id) ?? methodRegistry.find((method) => method.id === 'topsis')!;
