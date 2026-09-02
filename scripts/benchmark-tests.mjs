const alternatives = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'];
const criteria = [
  { direction: 'benefit', weight: 0.22 },
  { direction: 'benefit', weight: 0.18 },
  { direction: 'cost', weight: 0.12 },
  { direction: 'benefit', weight: 0.16 },
  { direction: 'cost', weight: 0.10 },
  { direction: 'benefit', weight: 0.14 },
  { direction: 'benefit', weight: 0.08 },
];
const matrix = [
  [78, 82, 12, 71, 18, 66, 7],
  [64, 75, 10, 88, 16, 71, 8],
  [91, 87, 8, 83, 12, 84, 9],
  [73, 69, 15, 79, 14, 77, 6],
  [86, 80, 11, 74, 19, 69, 7],
];

const dematelFactors = ['Technology Readiness', 'Cost Pressure', 'Environmental Management', 'Policy Support'];
const dematelDirect = [
  [0, 3, 4, 2],
  [2, 0, 3, 1],
  [4, 2, 0, 3],
  [3, 2, 4, 0],
];

function round(value, digits = 6) {
  return Number(value.toFixed(digits));
}

function rank(scores, names = alternatives, higherIsBetter = true) {
  return scores
    .map((score, index) => ({ name: names[index], score }))
    .sort((a, b) => higherIsBetter ? b.score - a.score : a.score - b.score);
}

function lexicographic(order = criteria.map((_, index) => index)) {
  const transformed = matrix.map((row) => row.map((value, column) => criteria[column].direction === 'benefit' ? value : -value));
  const sorted = alternatives
    .map((name, index) => ({ name, index }))
    .sort((a, b) => {
      for (const column of order) {
        const difference = transformed[b.index][column] - transformed[a.index][column];
        if (Math.abs(difference) > 1e-12) return difference;
      }
      return a.name.localeCompare(b.name);
    });
  const scores = Array.from({ length: alternatives.length }, () => 0);
  sorted.forEach((item, position) => {
    scores[item.index] = alternatives.length - position;
  });
  return scores;
}

function minMaxNormalize(values = matrix) {
  return values.map((row) => row.map((value, column) => {
    const columnValues = values.map((item) => item[column]);
    const min = Math.min(...columnValues);
    const max = Math.max(...columnValues);
    if (max === min) return 1;
    return criteria[column].direction === 'benefit'
      ? (value - min) / (max - min)
      : (max - value) / (max - min);
  }));
}

function appMinMaxNormalize(values = matrix) {
  return values.map((row) => row.map((value, column) => {
    const columnValues = values.map((item) => item[column]);
    const min = Math.min(...columnValues);
    const max = Math.max(...columnValues);
    if (max === min) return 1;
    if (criteria[column].direction === 'cost') {
      if (min <= 0 || value <= 0) return (max - value) / (max - min);
      return min / value;
    }
    if (max <= 0 || value < 0) return (value - min) / (max - min);
    return value / max;
  }));
}

function greyRangeNormalize(values = matrix, criterionSet = criteria) {
  return values.map((row) => row.map((value, column) => {
    const columnValues = values.map((item) => item[column]);
    const min = Math.min(...columnValues);
    const max = Math.max(...columnValues);
    if (max === min) return 1;
    return criterionSet[column].direction === 'cost'
      ? (max - value) / (max - min)
      : (value - min) / (max - min);
  }));
}

function vectorNormalize(values = matrix) {
  const denominators = criteria.map((_, column) => Math.sqrt(values.reduce((sum, row) => sum + row[column] ** 2, 0)) || 1);
  return values.map((row) => row.map((value, column) => value / denominators[column]));
}

function weightedSum() {
  return minMaxNormalize().map((row) => row.reduce((sum, value, column) => sum + value * criteria[column].weight, 0));
}

function rocWeightsForOrder(order) {
  const n = criteria.length;
  const weights = Array.from({ length: n }, () => 0);
  order.forEach((criterionIndex, rankIndex) => {
    let weight = 0;
    for (let k = rankIndex + 1; k <= n; k += 1) weight += 1 / k;
    weights[criterionIndex] = weight / n;
  });
  return weights;
}

function smarter(order = [1, 3, 2, 5, 4, 0, 6]) {
  const weights = rocWeightsForOrder(order);
  return minMaxNormalize().map((row) => row.reduce((sum, value, column) => sum + value * weights[column], 0));
}

function macbethStyle(anchors = [0, 1, 2, 3, 4, 5, 6]) {
  const maxAnchor = Math.max(...anchors, 1);
  const normalizedAnchors = anchors.map((value) => value / maxAnchor);
  return minMaxNormalize().map((row) => row.reduce((sum, value, column) => {
    const category = Math.min(normalizedAnchors.length - 1, Math.max(0, Math.round(value * (normalizedAnchors.length - 1))));
    return sum + normalizedAnchors[category] * criteria[column].weight;
  }, 0));
}

function pugh(baselineIndex = 0) {
  return matrix.map((row, rowIndex) => row.reduce((sum, value, column) => {
    if (rowIndex === baselineIndex) return sum;
    const baseline = matrix[baselineIndex][column];
    const directionalDifference = criteria[column].direction === 'benefit' ? value - baseline : baseline - value;
    const score = Math.abs(directionalDifference) <= 1e-12 ? 0 : directionalDifference > 0 ? 1 : -1;
    return sum + score * criteria[column].weight;
  }, 0));
}

function wpm() {
  return minMaxNormalize().map((row) => row.reduce((product, value, column) => product * Math.max(value, 0.000001) ** criteria[column].weight, 1));
}

function averageRanks(values, higherIsBetter) {
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

function pearson(a, b) {
  const meanA = a.reduce((sum, value) => sum + value, 0) / a.length;
  const meanB = b.reduce((sum, value) => sum + value, 0) / b.length;
  const numerator = a.reduce((sum, value, index) => sum + (value - meanA) * (b[index] - meanB), 0);
  const denominatorA = Math.sqrt(a.reduce((sum, value) => sum + (value - meanA) ** 2, 0));
  const denominatorB = Math.sqrt(b.reduce((sum, value) => sum + (value - meanB) ** 2, 0));
  const denominator = denominatorA * denominatorB;
  return denominator ? numerator / denominator : 0;
}

function srp() {
  const ranksByCriterion = criteria.map((criterion, column) =>
    averageRanks(matrix.map((row) => row[column]), criterion.direction === 'benefit'),
  );
  const weightedRankScore = alternatives.map((_, alternativeIndex) =>
    criteria.reduce((sum, criterion, column) => sum + criterion.weight * ranksByCriterion[column][alternativeIndex], 0),
  );
  return weightedRankScore.map((score) => alternatives.length - score);
}

function fuca() {
  const ranksByCriterion = criteria.map((criterion, column) =>
    averageRanks(matrix.map((row) => row[column]), criterion.direction === 'benefit'),
  );
  return alternatives.map((_, alternativeIndex) =>
    criteria.reduce((sum, criterion, column) => sum + criterion.weight * ranksByCriterion[column][alternativeIndex], 0),
  );
}

function seca(epsilon = 0.001, balance = 0.5) {
  const normalized = matrix.map((row) => row.map((value, column) => {
    const columnValues = matrix.map((item) => Math.max(Math.abs(item[column]), 1e-12));
    const safeValue = Math.max(Math.abs(value), 1e-12);
    return criteria[column].direction === 'cost'
      ? Math.min(...columnValues) / safeValue
      : safeValue / Math.max(...columnValues);
  }));
  const std = criteria.map((_, column) => {
    const values = normalized.map((row) => row[column]);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
  });
  const sigma = std.map((value) => value / (std.reduce((sum, item) => sum + item, 0) || 1));
  const pi = criteria.map((_, column) => {
    const values = normalized.map((row) => row[column]);
    return criteria.reduce((sum, __, otherColumn) => {
      const other = normalized.map((row) => row[otherColumn]);
      return sum + (1 - pearson(values, other));
    }, 0);
  });
  const piNormalized = pi.map((value) => value / (pi.reduce((sum, item) => sum + item, 0) || 1));
  const performance = criteria.map((_, column) => normalized.reduce((sum, row) => sum + row[column], 0) / normalized.length);
  const performanceNormalized = performance.map((value) => value / (performance.reduce((sum, item) => sum + item, 0) || 1));
  const raw = criteria.map((_, index) =>
    Math.max(epsilon, balance * performanceNormalized[index] + ((1 - balance) / 2) * (sigma[index] + piNormalized[index])),
  );
  const total = raw.reduce((sum, value) => sum + value, 0) || 1;
  const weights = raw.map((value) => value / total);
  return normalized.map((row) => row.reduce((sum, value, column) => sum + value * weights[column], 0));
}

function dear() {
  const responseWeights = matrix.map((row) => row.map((value, column) => {
    const columnValues = matrix.map((item) => Math.max(Math.abs(item[column]), 1e-12));
    const safeValue = Math.max(Math.abs(value), 1e-12);
    if (criteria[column].direction === 'cost') {
      const reciprocalSum = columnValues.reduce((sum, item) => sum + 1 / item, 0) || 1;
      return (1 / safeValue) / reciprocalSum;
    }
    const sum = columnValues.reduce((total, item) => total + item, 0) || 1;
    return safeValue / sum;
  }));
  return responseWeights.map((row) => row.reduce((sum, value, column) => sum + value * criteria[column].weight, 0));
}

function eamr(beta = 0.5, lambda = 0.5) {
  const rangeNormalized = matrix.map((row) => row.map((value, column) => {
    const columnValues = matrix.map((item) => item[column]);
    const min = Math.min(...columnValues);
    const max = Math.max(...columnValues);
    if (Math.abs(max - min) <= 1e-12) return 1;
    return criteria[column].direction === 'cost'
      ? (max - value) / (max - min)
      : (value - min) / (max - min);
  }));
  const vectorRaw = vectorNormalize();
  const vectorNormalized = vectorRaw.map((row) => row.map((value, column) => {
    const columnValues = vectorRaw.map((item) => item[column]);
    const min = Math.min(...columnValues);
    const max = Math.max(...columnValues);
    if (Math.abs(max - min) <= 1e-12) return 1;
    return criteria[column].direction === 'cost'
      ? (max - value) / (max - min)
      : (value - min) / (max - min);
  }));
  const blended = rangeNormalized.map((row, rowIndex) =>
    row.map((value, column) => beta * value + (1 - beta) * vectorNormalized[rowIndex][column]),
  );
  const weighted = blended.map((row) => row.map((value, column) => value * criteria[column].weight));
  const benefit = weighted.map((row) => row.reduce((sum, value, column) => sum + (criteria[column].direction === 'benefit' ? value : 0), 0));
  const cost = weighted.map((row) => row.reduce((sum, value, column) => sum + (criteria[column].direction === 'cost' ? value : 0), 0));
  return benefit.map((value, index) => value ** lambda + cost[index] ** (1 - lambda));
}

function rawec() {
  const first = matrix.map((row) => row.map((value, column) => {
    const columnValues = matrix.map((item) => Math.max(Math.abs(item[column]), 1e-12));
    const safeValue = Math.max(Math.abs(value), 1e-12);
    const min = Math.min(...columnValues);
    const max = Math.max(...columnValues);
    return criteria[column].direction === 'cost' ? min / safeValue : safeValue / Math.max(max, 1e-12);
  }));
  const second = matrix.map((row) => row.map((value, column) => {
    const columnValues = matrix.map((item) => Math.max(Math.abs(item[column]), 1e-12));
    const safeValue = Math.max(Math.abs(value), 1e-12);
    const min = Math.min(...columnValues);
    const max = Math.max(...columnValues);
    return criteria[column].direction === 'cost' ? safeValue / Math.max(max, 1e-12) : min / safeValue;
  }));
  const v = first.map((row) => row.reduce((sum, value, column) => sum + criteria[column].weight * (1 - value), 0));
  const vPrime = second.map((row) => row.reduce((sum, value, column) => sum + criteria[column].weight * (1 - value), 0));
  return v.map((value, index) => (vPrime[index] - value) / Math.max(vPrime[index] + value, 1e-12));
}

function comet() {
  const valueSets = criteria.map((_, column) => {
    const values = matrix.map((row) => row[column]).sort((a, b) => a - b);
    const min = values[0];
    const max = values[values.length - 1];
    return [min, (min + max) / 2, max];
  });
  const objects = valueSets.reduce((rows, values) => rows.flatMap((row) => values.map((value) => [...row, value])), [[]]);
  const ranges = valueSets.map((values) => ({ min: Math.min(...values), max: Math.max(...values) }));
  const preferences = objects.map((object) => object.reduce((sum, value, column) => {
    const range = ranges[column];
    const normalized = range.max - range.min <= 1e-12 ? 1 : (value - range.min) / (range.max - range.min);
    const utility = criteria[column].direction === 'cost' ? 1 - normalized : normalized;
    return sum + utility * criteria[column].weight;
  }, 0));
  const membership = (value, points) => {
    if (points.length === 1) return [1];
    if (value <= points[0]) return points.map((_, index) => index === 0 ? 1 : 0);
    if (value >= points[points.length - 1]) return points.map((_, index) => index === points.length - 1 ? 1 : 0);
    const memberships = points.map(() => 0);
    for (let index = 0; index < points.length - 1; index += 1) {
      if (value >= points[index] && value <= points[index + 1]) {
        const span = points[index + 1] - points[index] || 1;
        memberships[index] = (points[index + 1] - value) / span;
        memberships[index + 1] = (value - points[index]) / span;
        break;
      }
    }
    return memberships;
  };
  return matrix.map((row) => {
    const memberships = row.map((value, column) => membership(value, valueSets[column]));
    return objects.reduce((score, object, objectIndex) => {
      const objectMembership = object.reduce((product, objectValue, column) => {
        const pointIndex = valueSets[column].findIndex((point) => Math.abs(point - objectValue) <= 1e-9);
        return product * memberships[column][pointIndex];
      }, 1);
      return score + objectMembership * preferences[objectIndex];
    }, 0);
  });
}

function topsis() {
  const weighted = vectorNormalize().map((row) => row.map((value, column) => value * criteria[column].weight));
  const ideals = criteria.map((criterion, column) => {
    const values = weighted.map((row) => row[column]);
    return criterion.direction === 'benefit' ? Math.max(...values) : Math.min(...values);
  });
  const antiIdeals = criteria.map((criterion, column) => {
    const values = weighted.map((row) => row[column]);
    return criterion.direction === 'benefit' ? Math.min(...values) : Math.max(...values);
  });
  return weighted.map((row) => {
    const positive = Math.sqrt(row.reduce((sum, value, column) => sum + (value - ideals[column]) ** 2, 0));
    const negative = Math.sqrt(row.reduce((sum, value, column) => sum + (value - antiIdeals[column]) ** 2, 0));
    return negative / (positive + negative || 1);
  });
}

function moosra() {
  const normalized = vectorNormalize();
  const weightedMatrix = normalized.map((row) => row.map((value, column) => value * criteria[column].weight));
  return weightedMatrix.map((row) => {
    const benefit = row.reduce((sum, value, column) => sum + (criteria[column].direction === 'benefit' ? value : 0), 0);
    const cost = row.reduce((sum, value, column) => sum + (criteria[column].direction === 'cost' ? value : 0), 0);
    return benefit / Math.max(cost, 1e-12);
  });
}

function arlon(gamma = 0.5) {
  const firstLog = matrix.map((row) => row.map((value, column) => {
    const columnValues = matrix.map((item) => Math.max(Math.abs(item[column]), 1e-12));
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
  const weightedMatrix = firstLog.map((row, rowIndex) =>
    row.map((value, column) => (gamma * value + (1 - gamma) * secondLog[rowIndex][column]) * criteria[column].weight),
  );
  const kappa = criteria.filter((criterion) => criterion.direction === 'benefit').length / criteria.length;
  const performance = weightedMatrix.map((row) => {
    const benefit = row.reduce((sum, value, column) => sum + (criteria[column].direction === 'benefit' ? value : 0), 0);
    const cost = row.reduce((sum, value, column) => sum + (criteria[column].direction === 'cost' ? value : 0), 0);
    return benefit ** kappa + cost ** (1 - kappa);
  });
  const min = Math.min(...performance);
  const max = Math.max(...performance);
  return performance.map((value) => Math.abs(max - min) <= 1e-12 ? 1 : (value - min) / (max - min));
}

function macont(lambda = 1 / 3, mu = 1 / 3, delta = 0.5, theta = 0.5) {
  const sumNormalized = matrix.map((row) => row.map((value, column) => {
    const columnValues = matrix.map((item) => Math.max(Math.abs(item[column]), 1e-12));
    const safeValue = Math.max(Math.abs(value), 1e-12);
    if (criteria[column].direction === 'cost') {
      const reciprocalSum = columnValues.reduce((sum, item) => sum + 1 / item, 0) || 1;
      return (1 / safeValue) / reciprocalSum;
    }
    const sum = columnValues.reduce((total, item) => total + item, 0) || 1;
    return safeValue / sum;
  }));
  const ratioNormalized = matrix.map((row) => row.map((value, column) => {
    const columnValues = matrix.map((item) => Math.max(Math.abs(item[column]), 1e-12));
    const safeValue = Math.max(Math.abs(value), 1e-12);
    return criteria[column].direction === 'cost'
      ? Math.min(...columnValues) / safeValue
      : safeValue / Math.max(...columnValues);
  }));
  const rangeNormalized = matrix.map((row) => row.map((value, column) => {
    const columnValues = matrix.map((item) => item[column]);
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
  const reference = criteria.map((_, column) => integrated.reduce((sum, row) => sum + row[column], 0) / integrated.length);
  const weightedDeviation = integrated.map((row) => row.map((value, column) => criteria[column].weight * (value - reference[column])));
  const rho = weightedDeviation.map((row) => row.reduce((sum, value) => sum + value, 0));
  const q = integrated.map((row) => {
    const below = row.reduce((product, value, column) => product * Math.max(reference[column] - value, 1e-12) ** criteria[column].weight, 1);
    const above = row.reduce((product, value, column) => product * Math.max(value - reference[column], 1e-12) ** criteria[column].weight, 1);
    return below / Math.max(above, 1e-12);
  });
  const rhoNorm = Math.sqrt(rho.reduce((sum, value) => sum + value ** 2, 0)) || 1;
  const qNorm = Math.sqrt(q.reduce((sum, value) => sum + value ** 2, 0)) || 1;
  const s1 = rho.map((value, index) => delta * (value / rhoNorm) + (1 - delta) * (q[index] / qNorm));
  const s2 = weightedDeviation.map((row) => theta * Math.max(...row) + (1 - theta) * Math.min(...row));
  const s2Norm = Math.sqrt(s2.reduce((sum, value) => sum + value ** 2, 0)) || 1;
  return s1.map((value, index) => 0.5 * (value + s2[index] / s2Norm));
}

function vikor(v = 0.5) {
  const regret = matrix.map((row) => row.map((value, column) => {
    const values = matrix.map((item) => item[column]);
    const best = criteria[column].direction === 'benefit' ? Math.max(...values) : Math.min(...values);
    const worst = criteria[column].direction === 'benefit' ? Math.min(...values) : Math.max(...values);
    return criteria[column].weight * Math.abs(best - value) / (Math.abs(best - worst) || 1);
  }));
  const s = regret.map((row) => row.reduce((sum, value) => sum + value, 0));
  const r = regret.map((row) => Math.max(...row));
  const [sMin, sMax] = [Math.min(...s), Math.max(...s)];
  const [rMin, rMax] = [Math.min(...r), Math.max(...r)];
  return s.map((value, index) => v * (value - sMin) / (sMax - sMin || 1) + (1 - v) * (r[index] - rMin) / (rMax - rMin || 1));
}

function edas() {
  const average = criteria.map((_, column) => matrix.reduce((sum, row) => sum + row[column], 0) / matrix.length);
  return matrix.map((row) => row.reduce((sum, value, column) => {
    const distance = criteria[column].direction === 'benefit'
      ? Math.max(0, value - average[column]) / average[column]
      : Math.max(0, average[column] - value) / average[column];
    return sum + distance * criteria[column].weight;
  }, 0));
}

function copras() {
  const columnSums = criteria.map((_, column) => matrix.reduce((sum, row) => sum + Math.abs(row[column]), 0) || 1);
  const normalized = matrix.map((row) => row.map((value, column) => value / columnSums[column]));
  const weightedMatrix = normalized.map((row) => row.map((value, column) => value * criteria[column].weight));
  const beneficial = weightedMatrix.map((row) => row.reduce((sum, value, column) => sum + (criteria[column].direction === 'benefit' ? value : 0), 0));
  const nonBeneficial = weightedMatrix.map((row) => row.reduce((sum, value, column) => sum + (criteria[column].direction === 'cost' ? value : 0), 0));
  const positiveCosts = nonBeneficial.filter((value) => value > 0);
  const minCost = positiveCosts.length ? Math.min(...positiveCosts) : 0;
  const costSum = nonBeneficial.reduce((sum, value) => sum + value, 0);
  const inverseCostSum = nonBeneficial.reduce((sum, value) => sum + (value > 0 ? minCost / value : 0), 0) || 1;
  return beneficial.map((value, index) => value + (nonBeneficial[index] > 0 ? (minCost * costSum) / (nonBeneficial[index] * inverseCostSum) : 0));
}

function moora() {
  const weightedMatrix = vectorNormalize().map((row) => row.map((value, column) => value * criteria[column].weight));
  return weightedMatrix.map((row) => row.reduce((sum, value, column) => sum + (criteria[column].direction === 'benefit' ? value : -value), 0));
}

function aras() {
  const ideal = criteria.map((criterion, column) => {
    const values = matrix.map((row) => row[column]);
    return criterion.direction === 'benefit' ? Math.max(...values) : Math.min(...values);
  });
  const extended = [ideal, ...matrix];
  const columnSums = criteria.map((_, column) => extended.reduce((sum, row) => sum + Math.abs(row[column]), 0) || 1);
  const normalized = extended.map((row) => row.map((value, column) => {
    if (criteria[column].direction === 'cost') {
      const reciprocalSum = extended.reduce((sum, item) => sum + 1 / Math.max(Math.abs(item[column]), 1e-12), 0) || 1;
      return (1 / Math.max(Math.abs(value), 1e-12)) / reciprocalSum;
    }
    return value / columnSums[column];
  }));
  const weightedMatrix = normalized.map((row) => row.map((value, column) => value * criteria[column].weight));
  const optimality = weightedMatrix.map((row) => row.reduce((sum, value) => sum + value, 0));
  return optimality.slice(1).map((value) => value / (optimality[0] || 1));
}

function mabac() {
  const normalized = appMinMaxNormalize();
  const weightedMatrix = normalized.map((row) => row.map((value, column) => value * criteria[column].weight + criteria[column].weight));
  const border = criteria.map((_, column) => {
    const product = weightedMatrix.reduce((acc, row) => acc * Math.max(row[column], 1e-9), 1);
    return product ** (1 / weightedMatrix.length);
  });
  return weightedMatrix.map((row) => row.reduce((sum, value, column) => sum + value - border[column], 0));
}

function codas(tau = 0.02) {
  const normalized = matrix.map((row) => row.map((value, column) => {
    const values = matrix.map((item) => Math.abs(item[column]));
    const max = Math.max(...values, 1e-12);
    const positiveValues = values.filter((item) => item > 0);
    const min = positiveValues.length ? Math.min(...positiveValues) : 1e-12;
    if (criteria[column].direction === 'cost') return min / Math.max(Math.abs(value), 1e-12);
    return Math.abs(value) / max;
  }));
  const weightedMatrix = normalized.map((row) => row.map((value, column) => value * criteria[column].weight));
  const negativeIdeal = criteria.map((_, column) => Math.min(...weightedMatrix.map((row) => row[column])));
  const euclidean = weightedMatrix.map((row) => Math.sqrt(row.reduce((sum, value, column) => sum + (value - negativeIdeal[column]) ** 2, 0)));
  const taxicab = weightedMatrix.map((row) => row.reduce((sum, value, column) => sum + Math.abs(value - negativeIdeal[column]), 0));
  return euclidean.map((_, rowIndex) =>
    euclidean.reduce((sum, __, columnIndex) => {
      const euclideanDifference = euclidean[rowIndex] - euclidean[columnIndex];
      const taxicabDifference = taxicab[rowIndex] - taxicab[columnIndex];
      return sum + euclideanDifference + (Math.abs(euclideanDifference) >= tau ? taxicabDifference : 0);
    }, 0),
  );
}

function cocoso() {
  const normalized = matrix.map((row) => row.map((value, column) => {
    const values = matrix.map((item) => item[column]);
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
  const kC = s.map((value, index) => (0.5 * value + 0.5 * p[index]) / (0.5 * maxS + 0.5 * maxP || 1));
  return kA.map((value, index) => ((value * kB[index] * kC[index]) ** (1 / 3)) + (value + kB[index] + kC[index]) / 3);
}

function marcos() {
  const ideal = criteria.map((criterion, column) => {
    const values = matrix.map((row) => row[column]);
    return criterion.direction === 'benefit' ? Math.max(...values) : Math.min(...values);
  });
  const antiIdeal = criteria.map((criterion, column) => {
    const values = matrix.map((row) => row[column]);
    return criterion.direction === 'benefit' ? Math.min(...values) : Math.max(...values);
  });
  const augmented = [antiIdeal, ...matrix, ideal];
  const normalized = augmented.map((row) => row.map((value, column) =>
    criteria[column].direction === 'benefit' ? value / (ideal[column] || 1) : ideal[column] / (value || 1)));
  const utility = normalized.map((row) => row.reduce((sum, value, column) => sum + value * criteria[column].weight, 0));
  const antiUtility = utility[0] || 1;
  const idealUtility = utility[utility.length - 1] || 1;
  return utility.slice(1, -1).map((value) => {
    const km = value / antiUtility;
    const kp = value / idealUtility;
    const total = km + kp || 1;
    const fKm = kp / total;
    const fKp = km / total;
    return (km + kp) / (1 + ((1 - fKp) / (fKp || 1)) + ((1 - fKm) / (fKm || 1)));
  });
}

function mairca() {
  const normalized = appMinMaxNormalize();
  const theoretical = criteria.map((criterion) => criterion.weight / alternatives.length);
  const gap = normalized.map((row) => row.map((value, column) => Math.abs(theoretical[column] - value * theoretical[column])));
  return gap.map((row) => row.reduce((sum, value) => sum + value, 0));
}

function smart() {
  const utilities = appMinMaxNormalize();
  return utilities.map((row) => row.reduce((sum, value, column) => sum + value * criteria[column].weight, 0));
}

function maut(shape = 'Linear') {
  const utilities = appMinMaxNormalize();
  const shaped = utilities.map((row) => row.map((value) => shape === 'Concave' ? Math.sqrt(Math.max(value, 0)) : shape === 'Convex' ? value ** 2 : value));
  return shaped.map((row) => row.reduce((sum, value, column) => sum + value * criteria[column].weight, 0));
}

function ocra() {
  const columns = criteria.map((_, column) => matrix.map((row) => row[column]));
  const mins = columns.map((values) => Math.min(...values));
  const maxs = columns.map((values) => Math.max(...values));
  const preferenceTerms = matrix.map((row) => row.map((value, column) => {
    const min = Math.max(mins[column], 1e-9);
    const weight = criteria[column].weight;
    return criteria[column].direction === 'cost'
      ? weight * ((maxs[column] - value) / min)
      : weight * ((value - min) / min);
  }));
  const totals = preferenceTerms.map((row) => row.reduce((sum, value) => sum + value, 0));
  const minTotal = Math.min(...totals);
  return totals.map((value) => value - minTotal);
}

function psi() {
  const normalized = appMinMaxNormalize();
  const means = criteria.map((_, column) => normalized.reduce((sum, row) => sum + row[column], 0) / normalized.length);
  const variation = means.map((mean, column) => normalized.reduce((sum, row) => sum + (row[column] - mean) ** 2, 0));
  const deviation = variation.map((value) => 1 - value);
  const totalDeviation = deviation.reduce((sum, value) => sum + Math.max(value, 0), 0) || 1;
  const psiWeights = deviation.map((value) => Math.max(value, 0) / totalDeviation);
  return normalized.map((row) => row.reduce((sum, value, column) => sum + value * psiWeights[column], 0));
}

function piv() {
  const normalized = vectorNormalize();
  const weightedMatrix = normalized.map((row) => row.map((value, column) => value * criteria[column].weight));
  const best = criteria.map((criterion, column) => {
    const values = weightedMatrix.map((row) => row[column]);
    return criterion.direction === 'benefit' ? Math.max(...values) : Math.min(...values);
  });
  return weightedMatrix.map((row) => row.reduce((sum, value, column) => sum + Math.abs(best[column] - value), 0));
}

function rov() {
  const normalized = appMinMaxNormalize();
  const benefitUtility = normalized.map((row) => row.reduce((sum, value, column) => sum + (criteria[column].direction === 'benefit' ? value * criteria[column].weight : 0), 0));
  const costUtility = normalized.map((row) => row.reduce((sum, value, column) => sum + (criteria[column].direction === 'cost' ? value * criteria[column].weight : 0), 0));
  return benefitUtility.map((value, index) => (value + costUtility[index]) / 2);
}

function wisp() {
  const normalized = appMinMaxNormalize();
  const hasBenefit = criteria.some((criterion) => criterion.direction === 'benefit');
  const hasCost = criteria.some((criterion) => criterion.direction === 'cost');
  const sumBenefit = normalized.map((row) => row.reduce((sum, value, column) => sum + (criteria[column].direction === 'benefit' ? value * criteria[column].weight : 0), 0));
  const sumCost = normalized.map((row) => row.reduce((sum, value, column) => sum + (criteria[column].direction === 'cost' ? value * criteria[column].weight : 0), 0));
  const productBenefit = normalized.map((row) => row.reduce((product, value, column) => criteria[column].direction === 'benefit' ? product * Math.max(value, 1e-9) ** criteria[column].weight : product, 1));
  const productCost = normalized.map((row) => row.reduce((product, value, column) => criteria[column].direction === 'cost' ? product * Math.max(value, 1e-9) ** criteria[column].weight : product, 1));
  const sumDifference = sumBenefit.map((value, index) => value - sumCost[index]);
  const productDifference = productBenefit.map((value, index) => value - productCost[index]);
  const sumRatio = sumBenefit.map((value, index) => hasBenefit && hasCost ? value / Math.max(sumCost[index], 1e-9) : hasBenefit ? value : 1 / Math.max(sumCost[index], 1e-9));
  const productRatio = productBenefit.map((value, index) => hasBenefit && hasCost ? value / Math.max(productCost[index], 1e-9) : hasBenefit ? value : 1 / Math.max(productCost[index], 1e-9));
  const recalculatedSumDifference = sumDifference.map((value) => (1 + value) / (1 + Math.max(...sumDifference, 1e-9)));
  const recalculatedProductDifference = productDifference.map((value) => (1 + value) / (1 + Math.max(...productDifference, 1e-9)));
  const recalculatedSumRatio = sumRatio.map((value) => value / (1 + Math.max(...sumRatio, 1e-9)));
  const recalculatedProductRatio = productRatio.map((value) => value / (1 + Math.max(...productRatio, 1e-9)));
  return sumDifference.map((_, index) => (
    recalculatedSumDifference[index]
    + recalculatedProductDifference[index]
    + recalculatedSumRatio[index]
    + recalculatedProductRatio[index]
  ) / 4);
}

function cradis() {
  const weighted = minMaxNormalize().map((row) => row.map((value, column) => value * criteria[column].weight));
  const ideal = criteria.map((_, column) => Math.max(...weighted.map((row) => row[column])));
  const antiIdeal = criteria.map((_, column) => Math.min(...weighted.map((row) => row[column])));
  const idealDeviation = weighted.map((row) => row.reduce((sum, value, column) => sum + Math.abs(ideal[column] - value), 0));
  const antiIdealDeviation = weighted.map((row) => row.reduce((sum, value, column) => sum + Math.abs(value - antiIdeal[column]), 0));
  const minIdealDeviation = Math.min(...idealDeviation);
  const maxAntiIdealDeviation = Math.max(...antiIdealDeviation);
  return idealDeviation.map((value, index) =>
    ((minIdealDeviation || 1e-12) / Math.max(value, 1e-12) + antiIdealDeviation[index] / Math.max(maxAntiIdealDeviation, 1e-12)) / 2,
  );
}

function mara() {
  const normalized = matrix.map((row) => row.map((value, column) => {
    const columnValues = matrix.map((item) => item[column]);
    if (criteria[column].direction === 'cost') {
      const min = Math.min(...columnValues.map((item) => Math.max(Math.abs(item), 1e-12)));
      return min / Math.max(Math.abs(value), 1e-12);
    }
    const max = Math.max(...columnValues.map((item) => Math.abs(item)), 1e-12);
    return Math.abs(value) / max;
  }));
  const weightedMatrix = normalized.map((row) => row.map((value, column) => value * criteria[column].weight));
  const optimal = criteria.map((_, column) => Math.max(...weightedMatrix.map((row) => row[column])));
  const benefitIndexes = criteria.map((criterion, index) => criterion.direction === 'benefit' ? index : -1).filter((index) => index >= 0);
  const costIndexes = criteria.map((criterion, index) => criterion.direction === 'cost' ? index : -1).filter((index) => index >= 0);
  const sumAt = (values, indexes) => indexes.reduce((sum, index) => sum + values[index], 0);
  const optimalBenefit = sumAt(optimal, benefitIndexes);
  const optimalCost = sumAt(optimal, costIndexes);
  const optimalArea = (optimalCost - optimalBenefit) / 2 + optimalBenefit;
  return weightedMatrix.map((row) => {
    const benefit = sumAt(row, benefitIndexes);
    const cost = sumAt(row, costIndexes);
    const area = (cost - benefit) / 2 + benefit;
    return optimalArea - area;
  });
}

function raps() {
  const normalized = matrix.map((row) => row.map((value, column) => {
    const columnValues = matrix.map((item) => item[column]);
    if (criteria[column].direction === 'cost') {
      const min = Math.min(...columnValues.map((item) => Math.max(Math.abs(item), 1e-12)));
      return min / Math.max(Math.abs(value), 1e-12);
    }
    const max = Math.max(...columnValues.map((item) => Math.abs(item)), 1e-12);
    return Math.abs(value) / max;
  }));
  const weightedMatrix = normalized.map((row) => row.map((value, column) => value * criteria[column].weight));
  const optimal = criteria.map((_, column) => Math.max(...weightedMatrix.map((row) => row[column])));
  const benefitIndexes = criteria.map((criterion, index) => criterion.direction === 'benefit' ? index : -1).filter((index) => index >= 0);
  const costIndexes = criteria.map((criterion, index) => criterion.direction === 'cost' ? index : -1).filter((index) => index >= 0);
  const magnitude = (values, indexes) => Math.sqrt(indexes.reduce((sum, index) => sum + values[index] ** 2, 0));
  const qk = magnitude(optimal, benefitIndexes);
  const qh = magnitude(optimal, costIndexes);
  const optimalPerimeter = qk + qh + Math.sqrt(qk ** 2 + qh ** 2);
  return weightedMatrix.map((row) => {
    const uk = magnitude(row, benefitIndexes);
    const uh = magnitude(row, costIndexes);
    return (uk + uh + Math.sqrt(uk ** 2 + uh ** 2)) / Math.max(optimalPerimeter, 1e-12);
  });
}

function oreste() {
  const criterionRanks = averageRanks(criteria.map((criterion) => criterion.weight), true);
  const alternativeRanksByCriterion = criteria.map((criterion, column) =>
    averageRanks(matrix.map((row) => row[column]), criterion.direction === 'benefit'),
  );
  const projectionDistances = alternatives.map((_, alternativeIndex) =>
    criteria.map((__, column) => Math.sqrt((criterionRanks[column] ** 2 + alternativeRanksByCriterion[column][alternativeIndex] ** 2) / 2)),
  );
  const flatRanks = averageRanks(projectionDistances.flatMap((row) => row), false);
  return projectionDistances.map((row, rowIndex) =>
    row.reduce((sum, _, column) => sum + flatRanks[rowIndex * criteria.length + column], 0) / row.length,
  );
}

function permute(values) {
  if (values.length <= 1) return [values];
  return values.flatMap((value, index) =>
    permute(values.filter((_, itemIndex) => itemIndex !== index)).map((rest) => [value, ...rest]),
  );
}

function qualiflex() {
  const pairwise = alternatives.map((_, first) => alternatives.map((__, second) => {
    if (first === second) return 0;
    return criteria.reduce((sum, criterion, column) => {
      const diff = criterion.direction === 'benefit'
        ? matrix[first][column] - matrix[second][column]
        : matrix[second][column] - matrix[first][column];
      if (Math.abs(diff) <= 1e-12) return sum;
      return sum + criterion.weight * (diff > 0 ? 1 : -1);
    }, 0);
  }));
  const scoreOrder = (order) => order.reduce((sum, first, position) =>
    sum + order.slice(position + 1).reduce((inner, second) => inner + pairwise[first][second], 0), 0);
  const best = permute(alternatives.map((_, index) => index))
    .map((order) => ({ order, score: scoreOrder(order) }))
    .sort((a, b) => b.score - a.score)[0];
  const scores = Array.from({ length: alternatives.length }, () => 0);
  best.order.forEach((alternativeIndex, position) => {
    scores[alternativeIndex] = alternatives.length - position;
  });
  return scores;
}

function regime() {
  const dominance = alternatives.map((_, first) => alternatives.map((__, second) => {
    if (first === second) return 0;
    return criteria.reduce((sum, criterion, column) => {
      const difference = criterion.direction === 'benefit'
        ? matrix[first][column] - matrix[second][column]
        : matrix[second][column] - matrix[first][column];
      if (Math.abs(difference) <= 1e-12) return sum;
      return sum + criterion.weight * (difference > 0 ? 1 : -1);
    }, 0);
  }));
  const positiveFlow = dominance.map((row) => row.reduce((sum, value) => sum + Math.max(value, 0), 0) / (alternatives.length - 1));
  const negativeFlow = dominance[0].map((_, column) => dominance.reduce((sum, row) => sum + Math.max(row[column], 0), 0) / (alternatives.length - 1));
  return positiveFlow.map((value, index) => value - negativeFlow[index]);
}

function evamix() {
  const normalized = minMaxNormalize();
  const rawDominance = alternatives.map((_, first) => alternatives.map((__, second) => {
    if (first === second) return 0;
    return criteria.reduce((sum, criterion, column) =>
      sum + criterion.weight * (normalized[first][column] - normalized[second][column]), 0);
  }));
  const values = rawDominance.flat().filter((value) => Math.abs(value) > 1e-12);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const standardized = rawDominance.map((row) => row.map((value) => {
    if (Math.abs(value) <= 1e-12) return 0;
    if (Math.abs(max - min) <= 1e-12) return value > 0 ? 1 : -1;
    return ((value - min) / (max - min)) * 2 - 1;
  }));
  const outgoing = standardized.map((row) => row.reduce((sum, value) => sum + Math.max(value, 0), 0));
  const incoming = standardized[0].map((_, column) => standardized.reduce((sum, row) => sum + Math.max(row[column], 0), 0));
  return outgoing.map((value, index) => value - incoming[index]);
}

function grp(zeta = 0.5) {
  const normalized = greyRangeNormalize();
  const positiveDeviations = normalized.flatMap((row) => row.map((value) => Math.abs(1 - value)));
  const negativeDeviations = normalized.flatMap((row) => row.map((value) => Math.abs(value)));
  const minPositive = Math.min(...positiveDeviations);
  const maxPositive = Math.max(...positiveDeviations);
  const minNegative = Math.min(...negativeDeviations);
  const maxNegative = Math.max(...negativeDeviations);
  const positiveCoefficients = normalized.map((row) => row.map((value) => {
    const deviation = Math.abs(1 - value);
    return (minPositive + zeta * maxPositive) / (deviation + zeta * maxPositive || 1);
  }));
  const negativeCoefficients = normalized.map((row) => row.map((value) => {
    const deviation = Math.abs(value);
    return (minNegative + zeta * maxNegative) / (deviation + zeta * maxNegative || 1);
  }));
  const weightNorm = Math.sqrt(criteria.reduce((sum, criterion) => sum + criterion.weight ** 2, 0)) || 1;
  const positiveProjection = positiveCoefficients.map((row) => row.reduce((sum, value, column) => sum + value * criteria[column].weight, 0) / weightNorm);
  const negativeProjection = negativeCoefficients.map((row) => row.reduce((sum, value, column) => sum + value * criteria[column].weight, 0) / weightNorm);
  return positiveProjection.map((value, index) => value / (value + negativeProjection[index] || 1));
}

function merecWeights() {
  const normalized = matrix.map((row) => row.map((value, column) => {
    const values = matrix.map((item) => Math.max(Math.abs(item[column]), 1e-12));
    const safeValue = Math.max(Math.abs(value), 1e-12);
    return criteria[column].direction === 'benefit'
      ? Math.min(...values) / safeValue
      : safeValue / Math.max(...values);
  }));
  const criteriaCount = criteria.length;
  const performance = normalized.map((row) =>
    Math.log(1 + row.reduce((sum, value) => sum + Math.abs(Math.log(Math.max(value, 1e-12))), 0) / criteriaCount),
  );
  const removalPerformance = normalized.map((row) =>
    row.map((_, removedColumn) =>
      Math.log(1 + row.reduce((sum, value, column) => column === removedColumn ? sum : sum + Math.abs(Math.log(Math.max(value, 1e-12))), 0) / criteriaCount),
    ),
  );
  const effects = criteria.map((_, column) =>
    performance.reduce((sum, value, row) => sum + Math.abs(removalPerformance[row][column] - value), 0),
  );
  const total = effects.reduce((sum, value) => sum + value, 0) || 1;
  return effects.map((value) => value / total);
}

function merecGWeights() {
  const normalized = matrix.map((row) => row.map((value, column) => {
    const values = matrix.map((item) => Math.max(Math.abs(item[column]), 1e-12));
    const safeValue = Math.max(Math.abs(value), 1e-12);
    return criteria[column].direction === 'benefit'
      ? Math.min(...values) / safeValue
      : safeValue / Math.max(...values);
  }));
  const geometricMean = (values) => Math.exp(values.reduce((sum, value) => sum + Math.log(Math.max(value, 1e-12)), 0) / values.length);
  const overall = normalized.map((row) => geometricMean(row));
  const effects = criteria.map((_, removedColumn) =>
    normalized.reduce((sum, row, rowIndex) => {
      const remaining = row.filter((__, column) => column !== removedColumn);
      return sum + Math.abs(geometricMean(remaining) - overall[rowIndex]);
    }, 0),
  );
  const total = effects.reduce((sum, value) => sum + value, 0) || 1;
  return effects.map((value) => value / total);
}

function lopcowWeights() {
  const normalized = minMaxNormalize();
  const contrasts = criteria.map((_, column) => {
    const values = normalized.map((row) => row[column]);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const percentageDeviation = values.reduce((sum, value) => sum + Math.abs(value - mean) / Math.max(mean, 1e-12), 0) / values.length;
    return Math.log(1 + percentageDeviation * 100);
  });
  const total = contrasts.reduce((sum, value) => sum + value, 0) || 1;
  return contrasts.map((value) => value / total);
}

function wensloWeights() {
  const ratios = criteria.map((_, column) => {
    const rawValues = matrix.map((row) => row[column]);
    const minRaw = Math.min(...rawValues);
    const positiveValues = rawValues.map((value) => value + (minRaw <= 0 ? Math.abs(minRaw) + 1e-9 : 0));
    const total = positiveValues.reduce((sum, value) => sum + value, 0);
    const z = positiveValues.map((value) => value / total);
    const range = Math.max(...z) - Math.min(...z);
    if (range <= 1e-12) return 0;
    const classInterval = range / (1 + 3.322 * Math.log10(matrix.length));
    const envelope = z.slice(0, -1).reduce((sum, value, index) =>
      sum + Math.sqrt((z[index + 1] - value) ** 2 + classInterval ** 2), 0);
    const slope = z.reduce((sum, value) => sum + value, 0) / ((matrix.length - 1) * classInterval);
    return slope > 0 ? envelope / slope : 0;
  });
  const total = ratios.reduce((sum, value) => sum + value, 0) || 1;
  return ratios.map((value) => value / total);
}

function angularWeights() {
  const normalized = minMaxNormalize();
  const referenceNorm = Math.sqrt(matrix.length * (1 / matrix.length) ** 2);
  const angles = criteria.map((_, column) => {
    const values = normalized.map((row) => Math.max(row[column], 0));
    const dot = values.reduce((sum, value) => sum + value / matrix.length, 0);
    const norm = Math.sqrt(values.reduce((sum, value) => sum + value ** 2, 0));
    if (norm <= 1e-12 || referenceNorm <= 1e-12) return 0;
    const cosine = Math.max(-1, Math.min(1, dot / (norm * referenceNorm)));
    return Math.acos(cosine);
  });
  const total = angles.reduce((sum, value) => sum + value, 0) || 1;
  return angles.map((value) => value / total);
}

function giniWeights() {
  const normalized = minMaxNormalize();
  const coefficients = criteria.map((_, column) => {
    const values = normalized.map((row) => Math.max(row[column], 0));
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    if (Math.abs(mean) <= 1e-12) return 0;
    const pairwiseDifference = values.reduce((outer, value) =>
      outer + values.reduce((inner, other) => inner + Math.abs(value - other), 0), 0);
    return pairwiseDifference / (2 * values.length ** 2 * mean);
  });
  const total = coefficients.reduce((sum, value) => sum + value, 0) || 1;
  return coefficients.map((value) => value / total);
}

function mpsiWeights() {
  const normalized = matrix.map((row) => row.map((value, column) => {
    const columnValues = matrix.map((item) => item[column]);
    if (criteria[column].direction === 'cost') {
      const min = Math.min(...columnValues.map((item) => Math.max(Math.abs(item), 1e-12)));
      return min / Math.max(Math.abs(value), 1e-12);
    }
    const max = Math.max(...columnValues.map((item) => Math.abs(item)), 1e-12);
    return Math.abs(value) / max;
  }));
  const variations = criteria.map((_, column) => {
    const values = normalized.map((row) => row[column]);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    return values.reduce((sum, value) => sum + (value - mean) ** 2, 0);
  });
  const total = variations.reduce((sum, value) => sum + value, 0) || 1;
  return variations.map((value) => value / total);
}

function cimasWeights() {
  const normalized = minMaxNormalize();
  const distances = criteria.map((_, column) => {
    const values = normalized.map((row) => row[column]);
    return Math.max(...values) - Math.min(...values);
  });
  const total = distances.reduce((sum, value) => sum + value, 0) || 1;
  return distances.map((value) => value / total);
}

function cilosWeights() {
  const normalized = minMaxNormalize();
  const losses = criteria.map((_, column) => {
    const values = normalized.map((row) => row[column]);
    const best = Math.max(...values, 1e-12);
    return values.reduce((sum, value) => sum + (best - value) / best, 0);
  });
  const total = losses.reduce((sum, value) => sum + value, 0) || 1;
  return losses.map((value) => value / total);
}

function entropyWeights() {
  const normalized = criteria.map((_, column) => {
    const total = matrix.reduce((sum, row) => sum + Math.abs(row[column]), 0) || 1;
    return matrix.map((row) => Math.abs(row[column]) / total);
  });
  const k = 1 / Math.log(matrix.length);
  const entropy = normalized.map((column) => -k * column.reduce((sum, value) => sum + (value > 0 ? value * Math.log(value) : 0), 0));
  const diversity = entropy.map((value) => 1 - value);
  const total = diversity.reduce((sum, value) => sum + value, 0) || 1;
  return diversity.map((value) => value / total);
}

function stddevWeights() {
  const normalized = minMaxNormalize();
  const deviations = criteria.map((_, column) => {
    const values = normalized.map((row) => row[column]);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
  });
  const total = deviations.reduce((sum, value) => sum + value, 0) || 1;
  return deviations.map((value) => value / total);
}

function covWeights() {
  const normalized = minMaxNormalize();
  const coefficients = criteria.map((_, column) => {
    const values = normalized.map((row) => row[column]);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const deviation = Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
    return deviation / Math.max(Math.abs(mean), 1e-12);
  });
  const total = coefficients.reduce((sum, value) => sum + value, 0) || 1;
  return coefficients.map((value) => value / total);
}

function idocriwWeights() {
  const entropy = entropyWeights();
  const cilos = cilosWeights();
  const combined = entropy.map((value, index) => value * cilos[index]);
  const total = combined.reduce((sum, value) => sum + value, 0) || 1;
  return combined.map((value) => value / total);
}

function bwmWeights() {
  const bestIndex = 1;
  const worstIndex = 6;
  const bestToOthers = [3, 1, 2, 2, 2, 2, 4];
  const othersToWorst = [3, 4, 3, 3, 2, 2, 1];
  bestToOthers[bestIndex] = 1;
  othersToWorst[worstIndex] = 1;
  const logTargets = criteria.map((_, index) => {
    if (index === bestIndex) return 0;
    if (index === worstIndex) return -Math.log(Math.max(bestToOthers[worstIndex], othersToWorst[bestIndex], 1e-9));
    const fromBest = -Math.log(bestToOthers[index]);
    const fromWorst = Math.log(othersToWorst[index]) - Math.log(Math.max(othersToWorst[bestIndex], 1e-9));
    return (fromBest + fromWorst) / 2;
  });
  let logits = logTargets.map((value) => value - Math.max(...logTargets));
  const objective = (candidate) => {
    const weights = candidate.map(Math.exp);
    return criteria.reduce((maxResidual, _, index) => Math.max(
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
        [-1, 1].forEach((direction) => {
          const candidate = logits.map((value, itemIndex) => itemIndex === index ? value + direction * step : value);
          const score = objective(candidate);
          if (score + 1e-10 < bestScore) {
            logits = candidate;
            bestScore = score;
            improved = true;
          }
        });
      }
    }
  }
  const raw = logits.map(Math.exp);
  const total = raw.reduce((sum, value) => sum + value, 0) || 1;
  return raw.map((value) => value / total);
}

function oldAverageBwmWeights() {
  const bestIndex = 1;
  const worstIndex = 6;
  const bestToOthers = [3, 1, 2, 2, 2, 2, 4];
  const othersToWorst = [3, 4, 3, 3, 2, 2, 1];
  bestToOthers[bestIndex] = 1;
  othersToWorst[worstIndex] = 1;
  const normalize = (values) => {
    const total = values.reduce((sum, value) => sum + value, 0) || 1;
    return values.map((value) => value / total);
  };
  const normalizedBest = normalize(bestToOthers.map((value) => 1 / value));
  const normalizedWorst = normalize(othersToWorst);
  return normalize(normalizedBest.map((value, index) => (value + normalizedWorst[index]) / 2));
}

function bwmMaxLogResidual(weights) {
  const bestIndex = 1;
  const worstIndex = 6;
  const bestToOthers = [3, 1, 2, 2, 2, 2, 4];
  const othersToWorst = [3, 4, 3, 3, 2, 2, 1];
  return criteria.reduce((maxResidual, _, index) => Math.max(
    maxResidual,
    Math.abs(Math.log(weights[bestIndex] / weights[index]) - Math.log(bestToOthers[index])),
    Math.abs(Math.log(weights[index] / weights[worstIndex]) - Math.log(othersToWorst[index])),
  ), 0);
}

function dibrWeights() {
  const order = ['C2', 'C4', 'C3', 'C6', 'C5', 'C1', 'C7'];
  const ratios = [1.15, 1.2, 1.1, 1.15, 1.2, 1.1];
  const provisional = {};
  let denominator = 1;
  order.forEach((criterionId, index) => {
    if (index === 0) {
      provisional[criterionId] = 1;
      return;
    }
    denominator *= ratios[index - 1];
    provisional[criterionId] = 1 / denominator;
  });
  const raw = criteria.map((_, index) => provisional[`C${index + 1}`] ?? 1);
  const total = raw.reduce((sum, value) => sum + value, 0) || 1;
  return raw.map((value) => value / total);
}

function simosWeights() {
  const groups = [['C7'], ['C1', 'C5'], ['C3', 'C6'], ['C4'], ['C2']];
  const gaps = [0, 1, 0, 2];
  const zRatio = 3;
  const positions = [1];
  for (let index = 1; index < groups.length; index += 1) {
    positions[index] = positions[index - 1] + 1 + gaps[index - 1];
  }
  const step = (zRatio - 1) / (positions[positions.length - 1] - positions[0]);
  const rawById = {};
  groups.forEach((group, groupIndex) => {
    group.forEach((criterionId) => {
      rawById[criterionId] = 1 + step * (positions[groupIndex] - positions[0]);
    });
  });
  const raw = criteria.map((_, index) => rawById[`C${index + 1}`] ?? 1);
  const total = raw.reduce((sum, value) => sum + value, 0) || 1;
  return raw.map((value) => value / total);
}

function swaraWeights() {
  const order = ['C2', 'C4', 'C3', 'C6', 'C5', 'C1', 'C7'];
  const comparative = [0, 0.15, 0.2, 0.1, 0.15, 0.2, 0.1];
  const provisional = {};
  order.forEach((criterionId, index) => {
    if (index === 0) {
      provisional[criterionId] = 1;
      return;
    }
    provisional[criterionId] = provisional[order[index - 1]] / (1 + comparative[index]);
  });
  const raw = criteria.map((_, index) => provisional[`C${index + 1}`] ?? 1);
  const total = raw.reduce((sum, value) => sum + value, 0) || 1;
  return raw.map((value) => value / total);
}

function rocWeights() {
  const order = ['C2', 'C4', 'C3', 'C6', 'C5', 'C1', 'C7'];
  const weightsById = {};
  const n = criteria.length;
  order.forEach((criterionId, rankIndex) => {
    let weight = 0;
    for (let k = rankIndex + 1; k <= n; k += 1) weight += 1 / k;
    weightsById[criterionId] = weight / n;
  });
  return criteria.map((_, index) => weightsById[`C${index + 1}`]);
}

function fucomWeights() {
  const order = ['C2', 'C4', 'C3', 'C6', 'C5', 'C1', 'C7'];
  const priorities = [1.15, 1.2, 1.1, 1.15, 1.2, 1.1];
  const provisional = {};
  order.forEach((criterionId, index) => {
    if (index === 0) {
      provisional[criterionId] = 1;
      return;
    }
    provisional[criterionId] = provisional[order[index - 1]] / priorities[index - 1];
  });
  const raw = criteria.map((_, index) => provisional[`C${index + 1}`] ?? 1);
  const total = raw.reduce((sum, value) => sum + value, 0) || 1;
  return raw.map((value) => value / total);
}

function lbwaWeights() {
  const levels = [2, 1, 2, 1, 2, 2, 3];
  const importance = [1, 0, 1, 1, 2, 3, 1];
  const elasticity = 5;
  const raw = levels.map((level, index) => {
    if (level === 1 && importance[index] === 0) return 1;
    return elasticity / (level * elasticity + importance[index]);
  });
  const total = raw.reduce((sum, value) => sum + value, 0) || 1;
  return raw.map((value) => value / total);
}

function pipreciaWeights() {
  const order = ['C2', 'C4', 'C3', 'C6', 'C5', 'C1', 'C7'];
  const significance = [1, 0.95, 0.9, 0.92, 0.88, 0.85, 0.8];
  const qById = {};
  order.forEach((criterionId, index) => {
    if (index === 0) {
      qById[criterionId] = 1;
      return;
    }
    qById[criterionId] = qById[order[index - 1]] / (2 - significance[index]);
  });
  const raw = criteria.map((_, index) => qById[`C${index + 1}`] ?? 1);
  const total = raw.reduce((sum, value) => sum + value, 0) || 1;
  return raw.map((value) => value / total);
}

function rankSumWeights() {
  const order = ['C2', 'C4', 'C3', 'C6', 'C5', 'C1', 'C7'];
  const n = criteria.length;
  const denominator = (n * (n + 1)) / 2 || 1;
  const weightsById = {};
  order.forEach((criterionId, rankIndex) => {
    weightsById[criterionId] = (n - rankIndex) / denominator;
  });
  return criteria.map((_, index) => weightsById[`C${index + 1}`]);
}

function rankReciprocalWeights() {
  const order = ['C2', 'C4', 'C3', 'C6', 'C5', 'C1', 'C7'];
  const reciprocalSum = order.reduce((sum, _, rankIndex) => sum + 1 / (rankIndex + 1), 0) || 1;
  const weightsById = {};
  order.forEach((criterionId, rankIndex) => {
    weightsById[criterionId] = (1 / (rankIndex + 1)) / reciprocalSum;
  });
  return criteria.map((_, index) => weightsById[`C${index + 1}`]);
}

function rancomWeights() {
  const ranks = [6, 1, 3, 2, 5, 4, 7];
  const scores = criteria.map((_, rowIndex) =>
    criteria.reduce((sum, __, columnIndex) => {
      if (ranks[rowIndex] < ranks[columnIndex]) return sum + 1;
      if (ranks[rowIndex] === ranks[columnIndex]) return sum + 0.5;
      return sum;
    }, 0),
  );
  const total = scores.reduce((sum, value) => sum + value, 0) || 1;
  return scores.map((value) => value / total);
}

function gra(zeta = 0.5) {
  const normalized = greyRangeNormalize();
  const deviations = normalized.flatMap((row) => row.map((value) => Math.abs(1 - value)));
  const minDeviation = Math.min(...deviations);
  const maxDeviation = Math.max(...deviations);
  const coefficients = normalized.map((row) => row.map((value) => {
    const deviation = Math.abs(1 - value);
    return (minDeviation + zeta * maxDeviation) / (deviation + zeta * maxDeviation || 1);
  }));
  return coefficients.map((row) => row.reduce((sum, value, column) => sum + value * criteria[column].weight, 0));
}

const hospitalSupplierAlternatives = ['Supplier1', 'Supplier2', 'Supplier3'];
const hospitalSupplierCriteria = [
  { direction: 'benefit', weight: 0.513 },
  { direction: 'benefit', weight: 0.129 },
  { direction: 'cost', weight: 0.262 },
  { direction: 'benefit', weight: 0.063 },
  { direction: 'benefit', weight: 0.033 },
];
const hospitalSupplierMatrix = [
  [0.731, 0.292, 0.193, 0.640, 0.086],
  [0.188, 0.079, 0.203, 0.183, 0.314],
  [0.081, 0.629, 0.605, 0.177, 0.600],
];

function greyGradesFor(values, criterionSet, zeta = 0.5) {
  const normalized = greyRangeNormalize(values, criterionSet);
  const deviations = normalized.flatMap((row) => row.map((value) => Math.abs(1 - value)));
  const minDeviation = Math.min(...deviations);
  const maxDeviation = Math.max(...deviations);
  const coefficients = normalized.map((row) => row.map((value) => {
    const deviation = Math.abs(1 - value);
    return (minDeviation + zeta * maxDeviation) / (deviation + zeta * maxDeviation || 1);
  }));
  return coefficients.map((row) => row.reduce((sum, value, column) => sum + value * criterionSet[column].weight, 0));
}

function greyProjectionClosenessFor(values, criterionSet, zeta = 0.5) {
  const normalized = greyRangeNormalize(values, criterionSet);
  const positiveDeviations = normalized.flatMap((row) => row.map((value) => Math.abs(1 - value)));
  const negativeDeviations = normalized.flatMap((row) => row.map((value) => Math.abs(value)));
  const minPositive = Math.min(...positiveDeviations);
  const maxPositive = Math.max(...positiveDeviations);
  const minNegative = Math.min(...negativeDeviations);
  const maxNegative = Math.max(...negativeDeviations);
  const positiveCoefficients = normalized.map((row) => row.map((value) => {
    const deviation = Math.abs(1 - value);
    return (minPositive + zeta * maxPositive) / (deviation + zeta * maxPositive || 1);
  }));
  const negativeCoefficients = normalized.map((row) => row.map((value) => {
    const deviation = Math.abs(value);
    return (minNegative + zeta * maxNegative) / (deviation + zeta * maxNegative || 1);
  }));
  const weightNorm = Math.sqrt(criterionSet.reduce((sum, criterion) => sum + criterion.weight ** 2, 0)) || 1;
  const positiveProjection = positiveCoefficients.map((row) => row.reduce((sum, value, column) => sum + value * criterionSet[column].weight, 0) / weightNorm);
  const negativeProjection = negativeCoefficients.map((row) => row.reduce((sum, value, column) => sum + value * criterionSet[column].weight, 0) / weightNorm);
  return positiveProjection.map((value, index) => value / (value + negativeProjection[index] || 1));
}

function ram() {
  const normalized = appMinMaxNormalize();
  const weighted = normalized.map((row) => row.map((value, column) => value * criteria[column].weight));
  const benefitUtility = weighted.map((row) =>
    row.reduce((sum, value, column) => sum + (criteria[column].direction === 'benefit' ? value : 0), 0),
  );
  const costUtility = weighted.map((row) =>
    row.reduce((sum, value, column) => sum + (criteria[column].direction === 'cost' ? value : 0), 0),
  );
  return benefitUtility.map((benefit, index) => benefit - costUtility[index]);
}

function spotis() {
  const bounds = criteria.map((_, column) => {
    const values = matrix.map((row) => row[column]);
    return { min: Math.min(...values), max: Math.max(...values) };
  });
  const ideal = bounds.map((bound, column) => criteria[column].direction === 'benefit' ? bound.max : bound.min);
  return matrix.map((row) =>
    row.reduce((sum, value, column) => {
      const range = bounds[column].max - bounds[column].min;
      return sum + Math.abs(value - ideal[column]) / (range || 1) * criteria[column].weight;
    }, 0),
  );
}

function spotisManualBounds() {
  const lower = [50, 60, 5, 60, 10, 50, 5];
  const upper = [100, 100, 20, 100, 25, 100, 10];
  const ideal = criteria.map((criterion, column) => criterion.direction === 'benefit' ? upper[column] : lower[column]);
  return matrix.map((row) =>
    row.reduce((sum, value, column) => sum + Math.abs(value - ideal[column]) / ((upper[column] - lower[column]) || 1) * criteria[column].weight, 0),
  );
}

function espSpotis(point = [70, 85, 100, 88, 75, 80, 28]) {
  const bounds = criteria.map((_, column) => {
    const values = matrix.map((row) => row[column]);
    return { min: Math.min(...values), max: Math.max(...values) };
  });
  const reference = point.map((value, column) => Math.min(bounds[column].max, Math.max(bounds[column].min, value)));
  return matrix.map((row) =>
    row.reduce((sum, value, column) => {
      const range = bounds[column].max - bounds[column].min;
      return sum + Math.abs(value - reference[column]) / (Math.abs(range) || 1) * criteria[column].weight;
    }, 0),
  );
}

function balancedSpotis(point = [70, 85, 100, 88, 75, 80, 28], alpha = 0.5) {
  const bounds = criteria.map((_, column) => {
    const values = matrix.map((row) => row[column]);
    return { min: Math.min(...values), max: Math.max(...values) };
  });
  const ideal = bounds.map((bound, column) => criteria[column].direction === 'benefit' ? bound.max : bound.min);
  const expected = point.map((value, column) => Math.min(bounds[column].max, Math.max(bounds[column].min, value)));
  const idealScores = matrix.map((row) =>
    row.reduce((sum, value, column) => sum + Math.abs(value - ideal[column]) / (Math.abs(bounds[column].max - bounds[column].min) || 1) * criteria[column].weight, 0),
  );
  const expectedScores = matrix.map((row) =>
    row.reduce((sum, value, column) => sum + Math.abs(value - expected[column]) / (Math.abs(bounds[column].max - bounds[column].min) || 1) * criteria[column].weight, 0),
  );
  return idealScores.map((score, index) => alpha * expectedScores[index] + (1 - alpha) * score);
}

function wedba() {
  const normalized = matrix.map((row) => row.map((value, column) => {
    const values = matrix.map((item) => item[column]);
    if (criteria[column].direction === 'benefit') {
      const max = Math.max(...values.map((item) => Math.abs(item)), 1e-12);
      return value / max;
    }
    const min = Math.min(...values.map((item) => Math.max(Math.abs(item), 1e-12)));
    return min / Math.max(Math.abs(value), 1e-12);
  }));
  const means = criteria.map((_, column) => normalized.reduce((sum, row) => sum + row[column], 0) / normalized.length);
  const deviations = criteria.map((_, column) => Math.sqrt(normalized.reduce((sum, row) => sum + (row[column] - means[column]) ** 2, 0) / normalized.length) || 1);
  const standardized = normalized.map((row) => row.map((value, column) => (value - means[column]) / deviations[column]));
  const ideal = criteria.map((_, column) => Math.max(...standardized.map((row) => row[column])));
  const antiIdeal = criteria.map((_, column) => Math.min(...standardized.map((row) => row[column])));
  const positive = standardized.map((row) => Math.sqrt(row.reduce((sum, value, column) => sum + criteria[column].weight * (value - ideal[column]) ** 2, 0)));
  const negative = standardized.map((row) => Math.sqrt(row.reduce((sum, value, column) => sum + criteria[column].weight * (value - antiIdeal[column]) ** 2, 0)));
  return positive.map((value, index) => negative[index] / (value + negative[index] || 1));
}

function lmaw() {
  const standardized = matrix.map((row) => row.map((value, column) => {
    const values = matrix.map((item) => Math.max(Math.abs(item[column]), 1e-12));
    const safeValue = Math.max(Math.abs(value), 1e-12);
    const utility = criteria[column].direction === 'benefit'
      ? safeValue / Math.max(...values)
      : Math.min(...values) / safeValue;
    return 1 + utility;
  }));
  const logNormalized = standardized.map((row) => row.map((value, column) => {
    const denominator = standardized.reduce((sum, item) => sum + Math.log(Math.max(item[column], 1 + 1e-12)), 0) || 1;
    return Math.log(Math.max(value, 1 + 1e-12)) / denominator;
  }));
  return logNormalized.map((row) => row.reduce((sum, value, column) => sum + value * criteria[column].weight, 0));
}

function dnma() {
  const target = criteria.map((criterion, column) => {
    const values = matrix.map((row) => row[column]);
    return criterion.direction === 'benefit' ? Math.max(...values) : Math.min(...values);
  });
  const linear = matrix.map((row) => row.map((value, column) => {
    const values = matrix.map((item) => item[column]);
    const denominator = Math.max(...values, target[column]) - Math.min(...values, target[column]);
    return 1 - Math.abs(value - target[column]) / (denominator || 1);
  }));
  const vectorDenominators = criteria.map((_, column) => Math.sqrt(matrix.reduce((sum, row) => sum + Math.abs(row[column] - target[column]) ** 2, 0)) || 1);
  const vector = matrix.map((row) => row.map((value, column) => 1 - Math.abs(value - target[column]) / vectorDenominators[column]));
  const complete = linear.map((row) => row.reduce((sum, value, column) => sum + value * criteria[column].weight, 0));
  const uncompensatory = linear.map((row) => row.reduce((product, value, column) => product * Math.max(value, 1e-9) ** criteria[column].weight, 1));
  const incomplete = vector.map((row) => 1 - Math.sqrt(row.reduce((sum, value, column) => sum + criteria[column].weight * (1 - value) ** 2, 0)));
  const subordinate = [complete, uncompensatory, incomplete];
  const rankMaps = subordinate.map((scores) => rank(scores).reduce((acc, item, index) => ({ ...acc, [item.name]: index + 1 }), {}));
  const m = alternatives.length || 1;
  return alternatives.map((alternative, index) =>
    subordinate.reduce((sum, values, modelIndex) => {
      const maxValue = Math.max(...values.map((value) => Math.abs(value)), 1e-12);
      const utilityComponent = values[index] / maxValue;
      const rankComponent = (m - rankMaps[modelIndex][alternative] + 1) / m;
      return sum + Math.sqrt(0.5 * (utilityComponent ** 2 + rankComponent ** 2));
    }, 0) / subordinate.length,
  );
}

function probid() {
  const normalized = vectorNormalize();
  const weighted = normalized.map((row) => row.map((value, column) => value * criteria[column].weight));
  const ideal = criteria.map((criterion, column) => {
    const values = weighted.map((row) => row[column]);
    return criterion.direction === 'benefit' ? Math.max(...values) : Math.min(...values);
  });
  const antiIdeal = criteria.map((criterion, column) => {
    const values = weighted.map((row) => row[column]);
    return criterion.direction === 'benefit' ? Math.min(...values) : Math.max(...values);
  });
  const average = criteria.map((_, column) => weighted.reduce((sum, row) => sum + row[column], 0) / weighted.length);
  const euclidean = (a, b) => Math.sqrt(a.reduce((sum, value, index) => sum + (value - b[index]) ** 2, 0));
  const idealDistance = weighted.map((row) => euclidean(row, ideal));
  const averageDistance = weighted.map((row) => euclidean(row, average));
  const antiIdealDistance = weighted.map((row) => euclidean(row, antiIdeal));
  return idealDistance.map((value, index) => (averageDistance[index] + antiIdealDistance[index]) / (value + averageDistance[index] + antiIdealDistance[index] || 1));
}

function sprobid() {
  const normalized = vectorNormalize();
  const weighted = normalized.map((row) => row.map((value, column) => value * criteria[column].weight));
  const references = alternatives.map((_, rankIndex) =>
    criteria.map((criterion, column) => {
      const values = weighted.map((row) => row[column]).sort((a, b) => criterion.direction === 'benefit' ? b - a : a - b);
      return values[rankIndex] ?? values[values.length - 1] ?? 0;
    }),
  );
  const euclidean = (a, b) => Math.sqrt(a.reduce((sum, value, index) => sum + (value - b[index]) ** 2, 0));
  const distances = weighted.map((row) => references.map((reference) => euclidean(row, reference)));
  const count = alternatives.length || 1;
  const quarter = Math.floor(count / 4);
  const positive = distances.map((row) => {
    if (count < 4) return row[0] ?? 0;
    return row.reduce((sum, value, index) => index < quarter ? sum + value / (index + 1) : sum, 0);
  });
  const negative = distances.map((row) => {
    if (count < 4) return row[count - 1] ?? 0;
    return row.reduce((sum, value, index) => index >= count - quarter ? sum + value / (count - index) : sum, 0);
  });
  return negative.map((value, index) => value / Math.max(positive[index], 1e-12));
}

function rim(manual = false) {
  const bounds = criteria.map((_, column) => {
    const values = matrix.map((row) => row[column]);
    return { min: Math.min(...values), max: Math.max(...values) };
  });
  const manualLower = [64, 84, 8, 83, 12, 80, 8];
  const manualUpper = [70, 87, 10, 88, 14, 84, 9];
  const intervals = criteria.map((criterion, column) => {
    if (manual) return { min: manualLower[column], max: manualUpper[column] };
    const ideal = criterion.direction === 'benefit' ? bounds[column].max : bounds[column].min;
    return { min: ideal, max: ideal };
  });
  return matrix.map((row) =>
    row.reduce((sum, value, column) => {
      const interval = intervals[column];
      const distanceToInterval = value < interval.min ? interval.min - value : value > interval.max ? value - interval.max : 0;
      const farthest = Math.max(
        Math.abs(bounds[column].min - interval.min),
        Math.abs(bounds[column].max - interval.max),
        Math.abs(bounds[column].min - interval.max),
        Math.abs(bounds[column].max - interval.min),
        1e-12,
      );
      return sum + (1 - distanceToInterval / farthest) * criteria[column].weight;
    }, 0),
  );
}

function rafsi(lower = 1, upper = 6) {
  const references = criteria.map((criterion, column) => {
    const values = matrix.map((row) => row[column]);
    const observedMin = Math.min(...values);
    const observedMax = Math.max(...values);
    return {
      antiIdeal: criterion.direction === 'benefit' ? observedMin : observedMax,
      ideal: criterion.direction === 'benefit' ? observedMax : observedMin,
    };
  });
  const arithmeticMean = (lower + upper) / 2;
  const harmonicMean = 2 / ((1 / lower) + (1 / upper));
  return matrix.map((row) =>
    row.reduce((sum, value, column) => {
      const reference = references[column];
      const range = Math.abs(reference.ideal - reference.antiIdeal);
      const mapped = range <= 1e-12
        ? upper
        : lower + (
          criteria[column].direction === 'benefit'
            ? (value - reference.antiIdeal) / (reference.ideal - reference.antiIdeal)
            : (value - reference.ideal) / (reference.antiIdeal - reference.ideal)
        ) * (upper - lower);
      const clamped = Math.min(upper, Math.max(lower, mapped));
      const normalized = criteria[column].direction === 'benefit'
        ? clamped / (2 * arithmeticMean)
        : harmonicMean / (2 * Math.max(clamped, 1e-9));
      return sum + normalized * criteria[column].weight;
    }, 0),
  );
}

function lopm() {
  const propertyModel = criteria.map((criterion, column) => {
    const values = matrix.map((row) => row[column]);
    const type = criterion.direction === 'benefit' ? 'lower' : 'upper';
    const limit = type === 'lower' ? Math.max(...values) : Math.min(...values);
    return { type, limit };
  });
  return matrix.map((row) =>
    row.reduce((sum, value, column) => {
      const safeValue = Math.max(Math.abs(value), 1e-12);
      const safeLimit = Math.max(Math.abs(propertyModel[column].limit), 1e-12);
      const component = propertyModel[column].type === 'lower' ? safeLimit / safeValue : safeValue / safeLimit;
      return sum + component * criteria[column].weight;
    }, 0),
  );
}

function aroman(beta = 0.5, lambda = 0.5) {
  const linear = minMaxNormalize();
  const divisors = criteria.map((_, column) => Math.sqrt(matrix.reduce((sum, row) => sum + row[column] ** 2, 0)));
  const vectorRaw = matrix.map((row) => row.map((value, column) => value / (divisors[column] || 1)));
  const vector = vectorRaw.map((row) =>
    row.map((value, column) => {
      if (criteria[column].direction === 'benefit') return value;
      const values = vectorRaw.map((item) => item[column]);
      const max = Math.max(...values);
      const min = Math.min(...values);
      return max === min ? 1 : (max - value) / (max - min);
    }),
  );
  const weightedBlended = matrix.map((_, row) =>
    criteria.map((criterion, column) => (beta * linear[row][column] + (1 - beta) * vector[row][column]) * criterion.weight),
  );
  const benefitScores = weightedBlended.map((row) => row.reduce((sum, value, column) => criteria[column].direction === 'benefit' ? sum + value : sum, 0));
  const costScores = weightedBlended.map((row) => row.reduce((sum, value, column) => criteria[column].direction === 'cost' ? sum + value : sum, 0));
  return weightedBlended.map((_, index) => Math.max(costScores[index], 1e-12) ** lambda * Math.max(benefitScores[index], 1e-12) ** (1 - lambda));
}

function cobra() {
  const normalized = minMaxNormalize();
  const weighted = normalized.map((row) => row.map((value, column) => value * criteria[column].weight));
  const positiveIdeal = criteria.map((_, column) => Math.max(...weighted.map((row) => row[column])));
  const negativeIdeal = criteria.map((_, column) => Math.min(...weighted.map((row) => row[column])));
  const averageSolution = criteria.map((_, column) => weighted.reduce((sum, row) => sum + row[column], 0) / weighted.length);
  const euclidean = (a, b) => Math.sqrt(a.reduce((sum, value, index) => sum + (value - b[index]) ** 2, 0));
  const taxicab = (a, b) => a.reduce((sum, value, index) => sum + Math.abs(value - b[index]), 0);
  return weighted.map((row) => {
    const positiveDistance = (euclidean(row, positiveIdeal) + taxicab(row, positiveIdeal)) / 2;
    const negativeDistance = (euclidean(row, negativeIdeal) + taxicab(row, negativeIdeal)) / 2;
    const averagePositive = row.map((value, column) => Math.max(0, value - averageSolution[column]));
    const averageNegative = row.map((value, column) => Math.max(0, averageSolution[column] - value));
    const averagePositiveDistance = (Math.sqrt(averagePositive.reduce((sum, value) => sum + value ** 2, 0)) + averagePositive.reduce((sum, value) => sum + value, 0)) / 2;
    const averageNegativeDistance = (Math.sqrt(averageNegative.reduce((sum, value) => sum + value ** 2, 0)) + averageNegative.reduce((sum, value) => sum + value, 0)) / 2;
    return (positiveDistance - negativeDistance - averagePositiveDistance + averageNegativeDistance) / 4;
  });
}

function ervd(lambda = 2.25, alpha = 0.88) {
  const ranges = criteria.map((criterion, column) => {
    const values = matrix.map((row) => row[column]);
    return {
      criterion,
      min: Math.min(...values),
      max: Math.max(...values),
      reference: values.reduce((sum, value) => sum + value, 0) / values.length,
    };
  });
  const utilityValue = (value, column) => {
    const range = ranges[column];
    if (range.max === range.min) return 1;
    const clamped = Math.min(range.max, Math.max(range.min, value));
    return range.criterion.direction === 'benefit'
      ? (clamped - range.min) / (range.max - range.min)
      : (range.max - clamped) / (range.max - range.min);
  };
  const referenceUtility = ranges.map((range, column) => utilityValue(range.reference, column));
  return matrix.map((row) =>
    row.reduce((sum, value, column) => {
      const delta = utilityValue(value, column) - referenceUtility[column];
      const relativeValue = delta >= 0 ? delta ** alpha : -lambda * Math.abs(delta) ** alpha;
      return sum + relativeValue * criteria[column].weight;
    }, 0),
  );
}

function invert(matrixToInvert) {
  const n = matrixToInvert.length;
  const augmented = matrixToInvert.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => i === j ? 1 : 0)]);
  for (let i = 0; i < n; i += 1) {
    const pivot = augmented[i][i] || 1;
    augmented[i] = augmented[i].map((value) => value / pivot);
    for (let r = 0; r < n; r += 1) {
      if (r === i) continue;
      const factor = augmented[r][i];
      augmented[r] = augmented[r].map((value, c) => value - factor * augmented[i][c]);
    }
  }
  return augmented.map((row) => row.slice(n));
}

function multiply(a, b) {
  return a.map((row) => b[0].map((_, column) => row.reduce((sum, value, index) => sum + value * b[index][column], 0)));
}

function dematel() {
  const rowSums = dematelDirect.map((row) => row.reduce((sum, value) => sum + Math.abs(value), 0));
  const columnSums = dematelDirect[0].map((_, column) => dematelDirect.reduce((sum, row) => sum + Math.abs(row[column]), 0));
  const normalizationFactor = Math.max(...rowSums, ...columnSums);
  const normalized = dematelDirect.map((row, rowIndex) => row.map((value, columnIndex) => rowIndex === columnIndex ? 0 : value / normalizationFactor));
  const identityMinusN = normalized.map((row, rowIndex) => row.map((value, columnIndex) => (rowIndex === columnIndex ? 1 : 0) - value));
  const total = multiply(normalized, invert(identityMinusN));
  const d = total.map((row) => row.reduce((sum, value) => sum + value, 0));
  const r = total[0].map((_, column) => total.reduce((sum, row) => sum + row[column], 0));
  return d.map((value, index) => value + r[index]);
}

function ahpPriority(pairwise) {
  const size = pairwise.length;
  const columnSums = pairwise[0].map((_, column) => pairwise.reduce((sum, row) => sum + row[column], 0) || 1);
  const normalized = pairwise.map((row) => row.map((value, column) => value / columnSums[column]));
  return normalized.map((row) => row.reduce((sum, value) => sum + value, 0) / size);
}

function ahp() {
  const pairwise = criteria.map((rowCriterion) =>
    criteria.map((columnCriterion) => rowCriterion.weight / columnCriterion.weight),
  );
  const priorities = ahpPriority(pairwise);
  return appMinMaxNormalize().map((row) => row.reduce((sum, value, column) => sum + value * priorities[column], 0));
}

function promethee() {
  const preference = alternatives.map((_, a) => alternatives.map((__, b) => {
    if (a === b) return 0;
    return criteria.reduce((sum, criterion, column) => {
      const diff = criterion.direction === 'benefit'
        ? matrix[a][column] - matrix[b][column]
        : matrix[b][column] - matrix[a][column];
      return sum + criterion.weight * (diff > 0 ? 1 : 0);
    }, 0);
  }));
  const positive = preference.map((row) => row.reduce((sum, value) => sum + value, 0) / Math.max(alternatives.length - 1, 1));
  const negative = preference[0].map((_, column) => preference.reduce((sum, row) => sum + row[column], 0) / Math.max(alternatives.length - 1, 1));
  return positive.map((value, index) => value - negative[index]);
}

function electre(concordanceThreshold = 0.6, discordanceThreshold = 0.4) {
  const ranges = criteria.map((_, column) => {
    const values = matrix.map((row) => row[column]);
    return Math.max(...values) - Math.min(...values) || 1;
  });
  const concordance = alternatives.map((_, a) => alternatives.map((__, b) => {
    if (a === b) return 0;
    return criteria.reduce((sum, criterion, column) => {
      const diff = criterion.direction === 'benefit'
        ? matrix[a][column] - matrix[b][column]
        : matrix[b][column] - matrix[a][column];
      return sum + (diff >= 0 ? criterion.weight : 0);
    }, 0);
  }));
  const discordance = alternatives.map((_, a) => alternatives.map((__, b) => {
    if (a === b) return 0;
    return Math.max(...criteria.map((criterion, column) => {
      const diff = criterion.direction === 'benefit'
        ? matrix[a][column] - matrix[b][column]
        : matrix[b][column] - matrix[a][column];
      return Math.max(0, -diff) / ranges[column];
    }));
  }));
  const outranking = concordance.map((row, a) =>
    row.map((value, b) => a !== b && value >= concordanceThreshold && discordance[a][b] <= discordanceThreshold ? 1 : 0),
  );
  return outranking.map((row, index) => row.reduce((sum, value) => sum + value, 0) - outranking.reduce((sum, otherRow) => sum + otherRow[index], 0));
}

function multimoora() {
  const ratio = vectorNormalize();
  const weightedRatio = ratio.map((row) => row.map((value, column) => value * criteria[column].weight));
  const ratioScores = weightedRatio.map((row) => row.reduce((sum, value, column) => sum + (criteria[column].direction === 'benefit' ? value : -value), 0));
  const reference = criteria.map((criterion, column) =>
    criterion.direction === 'benefit' ? Math.max(...weightedRatio.map((row) => row[column])) : Math.min(...weightedRatio.map((row) => row[column])),
  );
  const referenceScores = weightedRatio.map((row) => Math.max(...row.map((value, column) => Math.abs(reference[column] - value))));
  const multiplicative = appMinMaxNormalize().map((row) => {
    const benefitProduct = row.reduce((productValue, value, column) => criteria[column].direction === 'benefit' ? productValue * Math.max(value, 1e-9) ** criteria[column].weight : productValue, 1);
    const costProduct = row.reduce((productValue, value, column) => criteria[column].direction === 'cost' ? productValue * Math.max(value, 1e-9) ** criteria[column].weight : productValue, 1);
    return benefitProduct / (costProduct || 1);
  });
  const ratioRanks = averageRanks(ratioScores, true);
  const referenceRanks = averageRanks(referenceScores, false);
  const multiplicativeRanks = averageRanks(multiplicative, true);
  return alternatives.map((_, index) => -(ratioRanks[index] + referenceRanks[index] + multiplicativeRanks[index]));
}

function todim(theta = 1) {
  const normalized = appMinMaxNormalize();
  const maxWeight = Math.max(...criteria.map((criterion) => criterion.weight), 1e-9);
  const relativeWeights = criteria.map((criterion) => criterion.weight / maxWeight);
  const relativeWeightTotal = relativeWeights.reduce((sum, value) => sum + value, 0) || 1;
  const dominanceTotals = alternatives.map((_, rowIndex) =>
    alternatives.reduce((total, __, columnIndex) => {
      if (rowIndex === columnIndex) return total;
      return total + criteria.reduce((sum, criterion, criterionIndex) => {
        const diff = normalized[rowIndex][criterionIndex] - normalized[columnIndex][criterionIndex];
        const relativeWeight = relativeWeights[criterionIndex];
        if (diff >= 0) return sum + Math.sqrt((relativeWeight * diff) / relativeWeightTotal);
        return sum - (1 / theta) * Math.sqrt((relativeWeightTotal * Math.abs(diff)) / Math.max(relativeWeight, 1e-9));
      }, 0);
    }, 0),
  );
  const minDominance = Math.min(...dominanceTotals);
  const maxDominance = Math.max(...dominanceTotals);
  return dominanceTotals.map((value) => maxDominance === minDominance ? 1 : (value - minDominance) / (maxDominance - minDominance));
}

const weighted = weightedSum();
const product = wpm();
const ahpScores = ahp();
const srpScores = srp();
const fucaScores = fuca();
const secaScores = seca();
const dearScores = dear();
const eamrScores = eamr();
const rawecScores = rawec();
const cometScores = comet();
const moosraScores = moosra();
const arlonScores = arlon();
const macontScores = macont();
const coprasScores = copras();
const mooraScores = moora();
const arasScores = aras();
const mabacScores = mabac();
const codasScores = codas();
const cocosoScores = cocoso();
const marcosScores = marcos();
const maircaScores = mairca();
const smartScores = smart();
const mautScores = maut();
const ocraScores = ocra();
const psiScores = psi();
const pivScores = piv();
const rovScores = rov();
const wispScores = wisp();
const merec = merecWeights();
const merecG = merecGWeights();
const lopcow = lopcowWeights();
const wenslo = wensloWeights();
const angular = angularWeights();
const gini = giniWeights();
const mpsi = mpsiWeights();
const cilos = cilosWeights();
const idocriw = idocriwWeights();
const stddev = stddevWeights();
const cov = covWeights();
const bwm = bwmWeights();
const oldBwm = oldAverageBwmWeights();
const dibr = dibrWeights();
const simos = simosWeights();
const swara = swaraWeights();
const roc = rocWeights();
const fucom = fucomWeights();
const lbwa = lbwaWeights();
const piprecia = pipreciaWeights();
const rankSumWeightsResult = rankSumWeights();
const rankReciprocalWeightsResult = rankReciprocalWeights();
const rancom = rancomWeights();
const cimas = cimasWeights();
const graScores = gra();
const hospitalGraScores = greyGradesFor(hospitalSupplierMatrix, hospitalSupplierCriteria);
const ramScores = ram();
const cradisScores = cradis();
const maraScores = mara();
const rapsScores = raps();
const oresteScores = oreste();
const qualiflexScores = qualiflex();
const regimeScores = regime();
const evamixScores = evamix();
const grpScores = grp();
const hospitalGrpScores = greyProjectionClosenessFor(hospitalSupplierMatrix, hospitalSupplierCriteria);
const spotisScores = spotis();
const spotisManualScores = spotisManualBounds();
const espSpotisScores = espSpotis();
const balancedSpotisScores = balancedSpotis();
const wedbaScores = wedba();
const lmawScores = lmaw();
const dnmaScores = dnma();
const probidScores = probid();
const sprobidScores = sprobid();
const rimScores = rim();
const rimManualScores = rim(true);
const rafsiScores = rafsi();
const lopmScores = lopm();
const aromanScores = aroman();
const cobraScores = cobra();
const ervdScores = ervd();
const prometheeScores = promethee();
const electreScores = electre();
const multimooraScores = multimoora();
const todimScores = todim();
const checks = [
  ['TOPSIS top alternative', rank(topsis())[0].name, 'Gamma'],
  ['AHP top alternative', rank(ahpScores)[0].name, 'Gamma'],
  ['SAW top alternative', rank(weighted)[0].name, 'Gamma'],
  ['SRP top alternative', rank(srpScores)[0].name, 'Gamma'],
  ['FUCA top alternative', rank(fucaScores, alternatives, false)[0].name, 'Gamma'],
  ['SECA top alternative', rank(secaScores)[0].name, 'Gamma'],
  ['DEAR top alternative', rank(dearScores)[0].name, 'Gamma'],
  ['EAMR top alternative', rank(eamrScores)[0].name, 'Gamma'],
  ['RAWEC top alternative', rank(rawecScores)[0].name, 'Gamma'],
  ['COMET top alternative', rank(cometScores)[0].name, 'Gamma'],
  ['WPM top alternative', rank(product)[0].name, 'Gamma'],
  ['MOOSRA top alternative', rank(moosraScores)[0].name, 'Gamma'],
  ['ARLON top alternative', rank(arlonScores)[0].name, 'Gamma'],
  ['MACONT top alternative', rank(macontScores)[0].name, 'Gamma'],
  ['WASPAS top alternative', rank(weighted.map((value, index) => 0.5 * value + 0.5 * product[index]))[0].name, 'Gamma'],
  ['VIKOR compromise alternative', rank(vikor(), alternatives, false)[0].name, 'Gamma'],
  ['COPRAS top alternative', rank(coprasScores)[0].name, 'Gamma'],
  ['MOORA top alternative', rank(mooraScores)[0].name, 'Gamma'],
  ['MULTIMOORA top alternative', rank(multimooraScores)[0].name, 'Gamma'],
  ['ARAS top alternative', rank(arasScores)[0].name, 'Gamma'],
  ['MABAC top alternative', rank(mabacScores)[0].name, 'Gamma'],
  ['CODAS top alternative', rank(codasScores)[0].name, 'Gamma'],
  ['CoCoSo top alternative', rank(cocosoScores)[0].name, 'Gamma'],
  ['MARCOS top alternative', rank(marcosScores)[0].name, 'Gamma'],
  ['MAIRCA top alternative', rank(maircaScores, alternatives, false)[0].name, 'Gamma'],
  ['SMART top alternative', rank(smartScores)[0].name, 'Gamma'],
  ['MAUT top alternative', rank(mautScores)[0].name, 'Gamma'],
  ['SMARTER top alternative', rank(smarter())[0].name, 'Gamma'],
  ['MACBETH-style top alternative', rank(macbethStyle())[0].name, 'Gamma'],
  ['Pugh Matrix top alternative', rank(pugh())[0].name, 'Gamma'],
  ['OCRA top alternative', rank(ocraScores)[0].name, 'Gamma'],
  ['PSI top alternative', rank(psiScores)[0].name, 'Gamma'],
  ['PIV top alternative', rank(pivScores, alternatives, false)[0].name, 'Gamma'],
  ['ROV top alternative', rank(rovScores)[0].name, 'Gamma'],
  ['WISP top alternative', rank(wispScores)[0].name, 'Epsilon'],
  ['TODIM top alternative', rank(todimScores)[0].name, 'Gamma'],
  ['EDAS top alternative', rank(edas())[0].name, 'Gamma'],
  ['DEMATEL top prominence factor', rank(dematel(), dematelFactors)[0].name, 'Environmental Management'],
  ['PROMETHEE top alternative', rank(prometheeScores)[0].name, 'Gamma'],
  ['ELECTRE top alternative', rank(electreScores)[0].name, 'Gamma'],
  ['MEREC top weighted criterion', rank(merec, criteria.map((_, index) => `C${index + 1}`))[0].name, 'C3'],
  ['MEREC-G top weighted criterion', rank(merecG, criteria.map((_, index) => `C${index + 1}`))[0].name, 'C3'],
  ['LOPCOW top weighted criterion', rank(lopcow, criteria.map((_, index) => `C${index + 1}`))[0].name, 'C6'],
  ['WENSLO top weighted criterion', rank(wenslo, criteria.map((_, index) => `C${index + 1}`))[0].name, 'C3'],
  ['Angular top weighted criterion', rank(angular, criteria.map((_, index) => `C${index + 1}`))[0].name, 'C6'],
  ['Gini top weighted criterion', rank(gini, criteria.map((_, index) => `C${index + 1}`))[0].name, 'C6'],
  ['MPSI top weighted criterion', rank(mpsi, criteria.map((_, index) => `C${index + 1}`))[0].name, 'C3'],
  ['CIMAS top weighted criterion', rank(cimas, criteria.map((_, index) => `C${index + 1}`))[0].name, 'C1'],
  ['CILOS top weighted criterion', rank(cilos, criteria.map((_, index) => `C${index + 1}`))[0].name, 'C6'],
  ['IDOCRIW top weighted criterion', rank(idocriw, criteria.map((_, index) => `C${index + 1}`))[0].name, 'C3'],
  ['Standard deviation top weighted criterion', rank(stddev, criteria.map((_, index) => `C${index + 1}`))[0].name, 'C5'],
  ['Coefficient of variation top weighted criterion', rank(cov, criteria.map((_, index) => `C${index + 1}`))[0].name, 'C6'],
  ['BWM top weighted criterion', rank(bwm, criteria.map((_, index) => `C${index + 1}`))[0].name, 'C2'],
  ['DIBR top weighted criterion', rank(dibr, criteria.map((_, index) => `C${index + 1}`))[0].name, 'C2'],
  ['SRF cards top weighted criterion', rank(simos, criteria.map((_, index) => `C${index + 1}`))[0].name, 'C2'],
  ['SWARA top weighted criterion', rank(swara, criteria.map((_, index) => `C${index + 1}`))[0].name, 'C2'],
  ['ROC top weighted criterion', rank(roc, criteria.map((_, index) => `C${index + 1}`))[0].name, 'C2'],
  ['FUCOM top weighted criterion', rank(fucom, criteria.map((_, index) => `C${index + 1}`))[0].name, 'C2'],
  ['LBWA top weighted criterion', rank(lbwa, criteria.map((_, index) => `C${index + 1}`))[0].name, 'C2'],
  ['PIPRECIA top weighted criterion', rank(piprecia, criteria.map((_, index) => `C${index + 1}`))[0].name, 'C2'],
  ['Rank Sum top weighted criterion', rank(rankSumWeightsResult, criteria.map((_, index) => `C${index + 1}`))[0].name, 'C2'],
  ['Rank Reciprocal top weighted criterion', rank(rankReciprocalWeightsResult, criteria.map((_, index) => `C${index + 1}`))[0].name, 'C2'],
  ['RANCOM top weighted criterion', rank(rancom, criteria.map((_, index) => `C${index + 1}`))[0].name, 'C2'],
  ['GRA top alternative', rank(graScores)[0].name, 'Gamma'],
  ['GRA hospital Supplier1 grey grade', round(hospitalGraScores[0], 3), 0.907],
  ['GRA hospital top alternative', rank(hospitalGraScores, hospitalSupplierAlternatives)[0].name, 'Supplier1'],
  ['RAM top alternative', rank(ramScores)[0].name, 'Gamma'],
  ['CRADIS top alternative', rank(cradisScores)[0].name, 'Gamma'],
  ['MARA top alternative', rank(maraScores, alternatives, false)[0].name, 'Gamma'],
  ['RAPS top alternative', rank(rapsScores)[0].name, 'Gamma'],
  ['ORESTE top alternative', rank(oresteScores, alternatives, false)[0].name, 'Gamma'],
  ['QUALIFLEX top alternative', rank(qualiflexScores)[0].name, 'Gamma'],
  ['REGIME top alternative', rank(regimeScores)[0].name, 'Gamma'],
  ['EVAMIX top alternative', rank(evamixScores)[0].name, 'Gamma'],
  ['Lexicographic top alternative', rank(lexicographic())[0].name, 'Gamma'],
  ['GRP top alternative', rank(grpScores)[0].name, 'Gamma'],
  ['GRP hospital Supplier1 closeness', round(hospitalGrpScores[0], 3), 0.702],
  ['GRP hospital top alternative', rank(hospitalGrpScores, hospitalSupplierAlternatives)[0].name, 'Supplier1'],
  ['SPOTIS top alternative', rank(spotisScores, alternatives, false)[0].name, 'Gamma'],
  ['SPOTIS manual-bounds top alternative', rank(spotisManualScores, alternatives, false)[0].name, 'Gamma'],
  ['ESP-SPOTIS top alternative', rank(espSpotisScores, alternatives, false)[0].name, 'Beta'],
  ['B-SPOTIS top alternative', rank(balancedSpotisScores, alternatives, false)[0].name, 'Gamma'],
  ['WEDBA top alternative', rank(wedbaScores)[0].name, 'Gamma'],
  ['LMAW top alternative', rank(lmawScores)[0].name, 'Gamma'],
  ['DNMA top alternative', rank(dnmaScores)[0].name, 'Gamma'],
  ['PROBID top alternative', rank(probidScores)[0].name, 'Gamma'],
  ['SPROBID top alternative', rank(sprobidScores)[0].name, 'Gamma'],
  ['RIM top alternative', rank(rimScores)[0].name, 'Gamma'],
  ['RIM manual-interval top alternative', rank(rimManualScores)[0].name, 'Gamma'],
  ['RAFSI top alternative', rank(rafsiScores)[0].name, 'Gamma'],
  ['LoPM top alternative', rank(lopmScores, alternatives, false)[0].name, 'Gamma'],
  ['AROMAN top alternative', rank(aromanScores)[0].name, 'Gamma'],
  ['COBRA top alternative', rank(cobraScores, alternatives, false)[0].name, 'Gamma'],
  ['ERVD top alternative', rank(ervdScores)[0].name, 'Gamma'],
];

const failures = checks.filter(([, actual, expected]) => actual !== expected);
if (failures.length) {
  failures.forEach(([name, actual, expected]) => console.error(`${name}: expected ${expected}, received ${actual}`));
  process.exit(1);
}

const tinyCradisAntiIdealDeviation = [0.02, 0.05, 0.08];
const tinyCradisMaxAntiIdealDeviation = Math.max(...tinyCradisAntiIdealDeviation);
const tinyCradisUtility = tinyCradisAntiIdealDeviation[1] / Math.max(tinyCradisMaxAntiIdealDeviation, 1e-12);
if (round(tinyCradisUtility, 4) !== 0.625) {
  console.error(`CRADIS anti-ideal utility denominator: expected 0.625, received ${round(tinyCradisUtility, 4)}`);
  process.exit(1);
}

const merecSum = round(merec.reduce((sum, value) => sum + value, 0));
if (merecSum !== 1) {
  console.error(`MEREC weights: expected sum 1, received ${merecSum}`);
  process.exit(1);
}
const merecGSum = round(merecG.reduce((sum, value) => sum + value, 0));
if (merecGSum !== 1) {
  console.error(`MEREC-G weights: expected sum 1, received ${merecGSum}`);
  process.exit(1);
}
const lopcowSum = round(lopcow.reduce((sum, value) => sum + value, 0));
if (lopcowSum !== 1) {
  console.error(`LOPCOW weights: expected sum 1, received ${lopcowSum}`);
  process.exit(1);
}
const wensloSum = round(wenslo.reduce((sum, value) => sum + value, 0));
if (wensloSum !== 1) {
  console.error(`WENSLO weights: expected sum 1, received ${wensloSum}`);
  process.exit(1);
}
const angularSum = round(angular.reduce((sum, value) => sum + value, 0));
if (angularSum !== 1) {
  console.error(`Angular weights: expected sum 1, received ${angularSum}`);
  process.exit(1);
}
const giniSum = round(gini.reduce((sum, value) => sum + value, 0));
if (giniSum !== 1) {
  console.error(`Gini weights: expected sum 1, received ${giniSum}`);
  process.exit(1);
}
const mpsiSum = round(mpsi.reduce((sum, value) => sum + value, 0));
if (mpsiSum !== 1) {
  console.error(`MPSI weights: expected sum 1, received ${mpsiSum}`);
  process.exit(1);
}
const cimasSum = round(cimas.reduce((sum, value) => sum + value, 0));
if (cimasSum !== 1) {
  console.error(`CIMAS weights: expected sum 1, received ${cimasSum}`);
  process.exit(1);
}
const cilosSum = round(cilos.reduce((sum, value) => sum + value, 0));
if (cilosSum !== 1) {
  console.error(`CILOS weights: expected sum 1, received ${cilosSum}`);
  process.exit(1);
}
const idocriwSum = round(idocriw.reduce((sum, value) => sum + value, 0));
if (idocriwSum !== 1) {
  console.error(`IDOCRIW weights: expected sum 1, received ${idocriwSum}`);
  process.exit(1);
}
const stddevSum = round(stddev.reduce((sum, value) => sum + value, 0));
if (stddevSum !== 1) {
  console.error(`Standard deviation weights: expected sum 1, received ${stddevSum}`);
  process.exit(1);
}
const covSum = round(cov.reduce((sum, value) => sum + value, 0));
if (covSum !== 1) {
  console.error(`Coefficient of variation weights: expected sum 1, received ${covSum}`);
  process.exit(1);
}
const bwmSum = round(bwm.reduce((sum, value) => sum + value, 0));
if (bwmSum !== 1) {
  console.error(`BWM weights: expected sum 1, received ${bwmSum}`);
  process.exit(1);
}
if (bwmMaxLogResidual(bwm) > bwmMaxLogResidual(oldBwm)) {
  console.error('BWM solver: expected min-max ratio residual to improve over averaged-vector estimate.');
  process.exit(1);
}
const dibrSum = round(dibr.reduce((sum, value) => sum + value, 0));
if (dibrSum !== 1) {
  console.error(`DIBR weights: expected sum 1, received ${dibrSum}`);
  process.exit(1);
}
const simosSum = round(simos.reduce((sum, value) => sum + value, 0));
if (simosSum !== 1) {
  console.error(`SRF cards weights: expected sum 1, received ${simosSum}`);
  process.exit(1);
}
const swaraSum = round(swara.reduce((sum, value) => sum + value, 0));
if (swaraSum !== 1) {
  console.error(`SWARA weights: expected sum 1, received ${swaraSum}`);
  process.exit(1);
}
const rocSum = round(roc.reduce((sum, value) => sum + value, 0));
if (rocSum !== 1) {
  console.error(`ROC weights: expected sum 1, received ${rocSum}`);
  process.exit(1);
}
const fucomSum = round(fucom.reduce((sum, value) => sum + value, 0));
if (fucomSum !== 1) {
  console.error(`FUCOM weights: expected sum 1, received ${fucomSum}`);
  process.exit(1);
}
const lbwaSum = round(lbwa.reduce((sum, value) => sum + value, 0));
if (lbwaSum !== 1) {
  console.error(`LBWA weights: expected sum 1, received ${lbwaSum}`);
  process.exit(1);
}
const pipreciaSum = round(piprecia.reduce((sum, value) => sum + value, 0));
if (pipreciaSum !== 1) {
  console.error(`PIPRECIA weights: expected sum 1, received ${pipreciaSum}`);
  process.exit(1);
}
const rankSumTotal = round(rankSumWeightsResult.reduce((sum, value) => sum + value, 0));
if (rankSumTotal !== 1) {
  console.error(`Rank Sum weights: expected sum 1, received ${rankSumTotal}`);
  process.exit(1);
}
const rankReciprocalTotal = round(rankReciprocalWeightsResult.reduce((sum, value) => sum + value, 0));
if (rankReciprocalTotal !== 1) {
  console.error(`Rank Reciprocal weights: expected sum 1, received ${rankReciprocalTotal}`);
  process.exit(1);
}
const rancomTotal = round(rancom.reduce((sum, value) => sum + value, 0));
if (rancomTotal !== 1) {
  console.error(`RANCOM weights: expected sum 1, received ${rancomTotal}`);
  process.exit(1);
}

if (![coprasScores, mooraScores, arasScores, mabacScores, codasScores, cocosoScores, marcosScores, maircaScores, smartScores, mautScores, ocraScores, psiScores, pivScores, rovScores, wispScores].every((scores) => scores.every(Number.isFinite))) {
  console.error('Core benchmark batch scores: expected all finite values.');
  process.exit(1);
}

if (!graScores.every(Number.isFinite)) {
  console.error('GRA scores: expected all finite values.');
  process.exit(1);
}

if (!ramScores.every(Number.isFinite)) {
  console.error('RAM scores: expected all finite values.');
  process.exit(1);
}

if (!spotisScores.every(Number.isFinite)) {
  console.error('SPOTIS scores: expected all finite values.');
  process.exit(1);
}
if (!spotisManualScores.every(Number.isFinite)) {
  console.error('SPOTIS manual-bound scores: expected all finite values.');
  process.exit(1);
}
if (!espSpotisScores.every(Number.isFinite)) {
  console.error('ESP-SPOTIS scores: expected all finite values.');
  process.exit(1);
}
if (!balancedSpotisScores.every(Number.isFinite)) {
  console.error('B-SPOTIS scores: expected all finite values.');
  process.exit(1);
}
if (!wedbaScores.every(Number.isFinite)) {
  console.error('WEDBA scores: expected all finite values.');
  process.exit(1);
}
if (!maraScores.every(Number.isFinite)) {
  console.error('MARA scores: expected all finite values.');
  process.exit(1);
}
if (!rapsScores.every(Number.isFinite)) {
  console.error('RAPS scores: expected all finite values.');
  process.exit(1);
}
if (!oresteScores.every(Number.isFinite)) {
  console.error('ORESTE scores: expected all finite values.');
  process.exit(1);
}
if (!qualiflexScores.every(Number.isFinite)) {
  console.error('QUALIFLEX scores: expected all finite values.');
  process.exit(1);
}
if (!regimeScores.every(Number.isFinite)) {
  console.error('REGIME scores: expected all finite values.');
  process.exit(1);
}
if (!evamixScores.every(Number.isFinite)) {
  console.error('EVAMIX scores: expected all finite values.');
  process.exit(1);
}
if (!grpScores.every(Number.isFinite)) {
  console.error('GRP scores: expected all finite values.');
  process.exit(1);
}
if (!moosraScores.every(Number.isFinite)) {
  console.error('MOOSRA scores: expected all finite values.');
  process.exit(1);
}
if (!arlonScores.every(Number.isFinite)) {
  console.error('ARLON scores: expected all finite values.');
  process.exit(1);
}
if (!macontScores.every(Number.isFinite)) {
  console.error('MACONT scores: expected all finite values.');
  process.exit(1);
}
if (!srpScores.every(Number.isFinite)) {
  console.error('SRP scores: expected all finite values.');
  process.exit(1);
}
if (!fucaScores.every(Number.isFinite)) {
  console.error('FUCA scores: expected all finite values.');
  process.exit(1);
}
if (!secaScores.every(Number.isFinite)) {
  console.error('SECA scores: expected all finite values.');
  process.exit(1);
}
if (!dearScores.every(Number.isFinite)) {
  console.error('DEAR scores: expected all finite values.');
  process.exit(1);
}
if (!eamrScores.every(Number.isFinite)) {
  console.error('EAMR scores: expected all finite values.');
  process.exit(1);
}
if (!rawecScores.every(Number.isFinite)) {
  console.error('RAWEC scores: expected all finite values.');
  process.exit(1);
}
if (!cometScores.every(Number.isFinite)) {
  console.error('COMET scores: expected all finite values.');
  process.exit(1);
}
if (!lmawScores.every(Number.isFinite)) {
  console.error('LMAW scores: expected all finite values.');
  process.exit(1);
}
if (!dnmaScores.every(Number.isFinite)) {
  console.error('DNMA scores: expected all finite values.');
  process.exit(1);
}
if (!probidScores.every(Number.isFinite)) {
  console.error('PROBID scores: expected all finite values.');
  process.exit(1);
}
if (!rimScores.every(Number.isFinite) || !rimManualScores.every(Number.isFinite)) {
  console.error('RIM scores: expected all finite values.');
  process.exit(1);
}
if (!rafsiScores.every(Number.isFinite)) {
  console.error('RAFSI scores: expected all finite values.');
  process.exit(1);
}
if (!lopmScores.every(Number.isFinite)) {
  console.error('LoPM scores: expected all finite values.');
  process.exit(1);
}
if (!aromanScores.every(Number.isFinite)) {
  console.error('AROMAN scores: expected all finite values.');
  process.exit(1);
}
if (!cobraScores.every(Number.isFinite)) {
  console.error('COBRA scores: expected all finite values.');
  process.exit(1);
}
if (!ervdScores.every(Number.isFinite)) {
  console.error('ERVD scores: expected all finite values.');
  process.exit(1);
}

console.log(`Benchmark numerical checks OK: ${checks.length} checks. TOPSIS Gamma score ${round(topsis()[2], 4)}; DEMATEL top ${rank(dematel(), dematelFactors)[0].name}; MEREC top ${rank(merec, criteria.map((_, index) => `C${index + 1}`))[0].name}; MEREC-G top ${rank(merecG, criteria.map((_, index) => `C${index + 1}`))[0].name}; LOPCOW top ${rank(lopcow, criteria.map((_, index) => `C${index + 1}`))[0].name}; WENSLO top ${rank(wenslo, criteria.map((_, index) => `C${index + 1}`))[0].name}; Angular top ${rank(angular, criteria.map((_, index) => `C${index + 1}`))[0].name}; Gini top ${rank(gini, criteria.map((_, index) => `C${index + 1}`))[0].name}; MPSI top ${rank(mpsi, criteria.map((_, index) => `C${index + 1}`))[0].name}; CIMAS top ${rank(cimas, criteria.map((_, index) => `C${index + 1}`))[0].name}; CILOS top ${rank(cilos, criteria.map((_, index) => `C${index + 1}`))[0].name}; IDOCRIW top ${rank(idocriw, criteria.map((_, index) => `C${index + 1}`))[0].name}; STDDEV top ${rank(stddev, criteria.map((_, index) => `C${index + 1}`))[0].name}; COV top ${rank(cov, criteria.map((_, index) => `C${index + 1}`))[0].name}; BWM top ${rank(bwm, criteria.map((_, index) => `C${index + 1}`))[0].name}; DIBR top ${rank(dibr, criteria.map((_, index) => `C${index + 1}`))[0].name}; SRF cards top ${rank(simos, criteria.map((_, index) => `C${index + 1}`))[0].name}; SWARA top ${rank(swara, criteria.map((_, index) => `C${index + 1}`))[0].name}; ROC top ${rank(roc, criteria.map((_, index) => `C${index + 1}`))[0].name}; FUCOM top ${rank(fucom, criteria.map((_, index) => `C${index + 1}`))[0].name}; LBWA top ${rank(lbwa, criteria.map((_, index) => `C${index + 1}`))[0].name}; PIPRECIA top ${rank(piprecia, criteria.map((_, index) => `C${index + 1}`))[0].name}; Rank Sum top ${rank(rankSumWeightsResult, criteria.map((_, index) => `C${index + 1}`))[0].name}; Rank Reciprocal top ${rank(rankReciprocalWeightsResult, criteria.map((_, index) => `C${index + 1}`))[0].name}; RANCOM top ${rank(rancom, criteria.map((_, index) => `C${index + 1}`))[0].name}; SRP top ${rank(srpScores)[0].name}; FUCA top ${rank(fucaScores, alternatives, false)[0].name}; SECA top ${rank(secaScores)[0].name}; DEAR top ${rank(dearScores)[0].name}; EAMR top ${rank(eamrScores)[0].name}; RAWEC top ${rank(rawecScores)[0].name}; COMET top ${rank(cometScores)[0].name}; COPRAS top ${rank(coprasScores)[0].name}; MOORA top ${rank(mooraScores)[0].name}; ARAS top ${rank(arasScores)[0].name}; MABAC top ${rank(mabacScores)[0].name}; CODAS top ${rank(codasScores)[0].name}; CoCoSo top ${rank(cocosoScores)[0].name}; MARCOS top ${rank(marcosScores)[0].name}; MOOSRA top ${rank(moosraScores)[0].name}; ARLON top ${rank(arlonScores)[0].name}; MACONT top ${rank(macontScores)[0].name}; GRA top ${rank(graScores)[0].name}; GRP top ${rank(grpScores)[0].name}; RAM top ${rank(ramScores)[0].name}; CRADIS top ${rank(cradisScores)[0].name}; MARA top ${rank(maraScores, alternatives, false)[0].name}; RAPS top ${rank(rapsScores)[0].name}; ORESTE top ${rank(oresteScores, alternatives, false)[0].name}; QUALIFLEX top ${rank(qualiflexScores)[0].name}; REGIME top ${rank(regimeScores)[0].name}; EVAMIX top ${rank(evamixScores)[0].name}; SPOTIS top ${rank(spotisScores, alternatives, false)[0].name}; SPOTIS manual-bounds top ${rank(spotisManualScores, alternatives, false)[0].name}; ESP-SPOTIS top ${rank(espSpotisScores, alternatives, false)[0].name}; B-SPOTIS top ${rank(balancedSpotisScores, alternatives, false)[0].name}; WEDBA top ${rank(wedbaScores)[0].name}; LMAW top ${rank(lmawScores)[0].name}; DNMA top ${rank(dnmaScores)[0].name}; PROBID top ${rank(probidScores)[0].name}; SPROBID top ${rank(sprobidScores)[0].name}; RIM top ${rank(rimScores)[0].name}; RIM manual-interval top ${rank(rimManualScores)[0].name}; RAFSI top ${rank(rafsiScores)[0].name}; LoPM top ${rank(lopmScores, alternatives, false)[0].name}; AROMAN top ${rank(aromanScores)[0].name}; COBRA top ${rank(cobraScores, alternatives, false)[0].name}; ERVD top ${rank(ervdScores)[0].name}.`);
