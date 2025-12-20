import { Point, Measurement } from '../types';

export const getDistance = (p1: Point, p2: Point) => 
  Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));

export const getPathLength = (points: Point[]) => {
  return points.reduce((acc, point, i) => {
    if (i === 0) return 0;
    return acc + getDistance(points[i - 1], point);
  }, 0);
};

export const getPolygonArea = (points: Point[]) => {
  let area = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(area) / 2;
};

// Safe Formula Evaluator
export const evaluateFormula = (formula: string, context: Record<string, number>): number => {
  // 1. Sort keys by length desc to avoid replacing "Height" inside "WallHeight"
  const sortedKeys = Object.keys(context).sort((a, b) => b.length - a.length);

  let parsed = formula;
  
  // 2. Replace variable names with values
  sortedKeys.forEach(key => {
    const value = context[key];
    // Global replace with word boundary check
    const regex = new RegExp(`\\b${key}\\b`, 'g');
    parsed = parsed.replace(regex, value.toString());
  });

  try {
    // 3. Safe-ish evaluation
    // Remove anything that isn't a number, operator, parenthesis, or decimal
    const sanitized = parsed.replace(/[^0-9+\-*/(). ]/g, '');
    return new Function(`return ${sanitized}`)();
  } catch (e) {
    console.error(`Formula Error: "${formula}" parsed to "${parsed}"`, e);
    return 0;
  }
};

export const applyRounding = (val: number, type: 'up' | 'down' | 'nearest' | 'none') => {
  switch (type) {
    case 'up': return Math.ceil(val);
    case 'down': return Math.floor(val);
    case 'nearest': return Math.round(val);
    default: return val;
  }
};