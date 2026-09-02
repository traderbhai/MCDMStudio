export interface ParsedDecisionValue {
  value: number;
  fuzzyType?: 'triangular' | 'trapezoidal';
  fuzzy?: FuzzyNumber;
}

export interface FuzzyNumber {
  values: number[];
  type: 'triangular' | 'trapezoidal' | 'crisp';
}

const FUZZY_NUMBER_PATTERN = /^\(?\s*(-?\d+(?:\.\d+)?)\s*[,;]\s*(-?\d+(?:\.\d+)?)\s*[,;]\s*(-?\d+(?:\.\d+)?)(?:\s*[,;]\s*(-?\d+(?:\.\d+)?))?\s*\)?$/;

function isNondecreasing(values: number[]): boolean {
  return values.every((value, index) => index === 0 || value >= values[index - 1]);
}

export function parseDecisionValue(value: unknown): ParsedDecisionValue {
  if (typeof value === 'number') return { value };
  const text = String(value ?? '').trim();
  const fuzzy = text.match(FUZZY_NUMBER_PATTERN);
  if (fuzzy) {
    const numbers = fuzzy.slice(1).filter((item): item is string => Boolean(item)).map(Number);
    if (numbers.length === 3 && isNondecreasing(numbers)) {
      return { value: defuzzify({ values: numbers, type: 'triangular' }), fuzzyType: 'triangular', fuzzy: { values: numbers, type: 'triangular' } };
    }
    if (numbers.length === 4 && isNondecreasing(numbers)) {
      return { value: defuzzify({ values: numbers, type: 'trapezoidal' }), fuzzyType: 'trapezoidal', fuzzy: { values: numbers, type: 'trapezoidal' } };
    }
    return { value: Number.NaN };
  }
  const crisp = Number(text);
  return { value: crisp, fuzzy: Number.isFinite(crisp) ? crispFuzzy(crisp) : undefined };
}

export function crispFuzzy(value: number): FuzzyNumber {
  return { values: [value, value, value], type: 'crisp' };
}

export function defuzzify(number: FuzzyNumber): number {
  return number.values.reduce((sum, value) => sum + value, 0) / number.values.length;
}

export function scaleFuzzy(number: FuzzyNumber, scalar: number): FuzzyNumber {
  const values = number.values.map((value) => value * scalar);
  return { values: scalar >= 0 ? values : values.reverse(), type: number.type };
}

export function reciprocalFuzzy(number: FuzzyNumber): FuzzyNumber {
  const values = number.values.map((value) => 1 / Math.max(value, 1e-9)).reverse();
  return { values, type: number.type };
}

export function geometricMeanFuzzy(numbers: FuzzyNumber[]): FuzzyNumber {
  if (!numbers.length) return crispFuzzy(1);
  const size = Math.max(...numbers.map((number) => number.values.length));
  const values = Array.from({ length: size }, (_, component) => {
    const componentValues = numbers.map((number) => expandFuzzyValues(number, size)[component]).filter((value) => Number.isFinite(value) && value > 0);
    return componentValues.length ? Math.exp(componentValues.reduce((sum, value) => sum + Math.log(value), 0) / componentValues.length) : 1;
  });
  return { values, type: size === 4 ? 'trapezoidal' : 'triangular' };
}

export function divideFuzzyByScalar(number: FuzzyNumber, scalar: number): FuzzyNumber {
  return scaleFuzzy(number, 1 / Math.max(scalar, 1e-9));
}

export function fuzzyDistance(a: FuzzyNumber, b: FuzzyNumber): number {
  const size = Math.max(a.values.length, b.values.length);
  const av = expandFuzzyValues(a, size);
  const bv = expandFuzzyValues(b, size);
  return Math.sqrt(av.reduce((sum, value, index) => sum + (value - bv[index]) ** 2, 0) / size);
}

export function fuzzyLabel(number: FuzzyNumber, digits = 4): string {
  return `(${number.values.map((value) => Number(value.toFixed(digits))).join(', ')})`;
}

function expandFuzzyValues(number: FuzzyNumber, size: number): number[] {
  if (number.values.length === size) return number.values;
  if (number.values.length === 3 && size === 4) return [number.values[0], number.values[1], number.values[1], number.values[2]];
  if (number.values.length === 4 && size === 3) return [number.values[0], (number.values[1] + number.values[2]) / 2, number.values[3]];
  return Array.from({ length: size }, (_, index) => number.values[Math.min(index, number.values.length - 1)] ?? 0);
}
