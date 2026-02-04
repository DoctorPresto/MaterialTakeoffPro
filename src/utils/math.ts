import {Point} from '../types';
import {all, create} from 'mathjs';

// Create a mathjs instance
const math = create(all);

export const getDistance = (p1: Point, p2: Point) =>
    Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));

// Calculate length of a quadratic bezier curve (Gaussian Quadrature)
const getBezierLength = (p0: Point, p1: Point, p2: Point) => {
    const a = { x: p0.x - 2 * p1.x + p2.x, y: p0.y - 2 * p1.y + p2.y };
    const b = { x: 2 * p1.x - 2 * p0.x, y: 2 * p1.y - 2 * p0.y };

    // Gaussian Quadrature - 3 point
    const tValues = [0.1127016654, 0.5000000000, 0.8872983346];
    const weights = [0.2777777778, 0.4444444444, 0.2777777778];

    let length = 0;
    for (let i = 0; i < 3; i++) {
        const t = tValues[i];
        const vx = 2 * a.x * t + b.x;
        const vy = 2 * a.y * t + b.y;
        length += weights[i] * Math.sqrt(vx * vx + vy * vy);
    }
    return length;
};

export const getPathLength = (points: Point[]) => {
    const isGraph = points.some(p => p.connectsTo && p.connectsTo.length > 0);

    if (isGraph) {
        let totalLength = 0;
        points.forEach(p => {
            if (p.connectsTo) {
                p.connectsTo.forEach(targetIdx => {
                    const target = points[targetIdx];
                    if (target) {
                        if (target.controlPoint) {
                            totalLength += getBezierLength(p, target.controlPoint as Point, target);
                        } else {
                            totalLength += getDistance(p, target);
                        }
                    }
                });
            }
        });
        return totalLength;
    }

    // Fallback: Sequential
    return points.reduce((acc, point, i) => {
        if (i === 0) return 0;
        const prev = points[i - 1];
        if (point.controlPoint) {
            return acc + getBezierLength(prev, point.controlPoint as Point, point);
        }
        return acc + getDistance(prev, point);
    }, 0);
};

// Signed area term for curve segment
const getBezierAreaTerm = (p0: Point, cp: Point, p1: Point) => {
    const midT = 0.5;
    const midX = (1 - midT) * (1 - midT) * p0.x + 2 * (1 - midT) * midT * cp.x + midT * midT * p1.x;
    const midY = (1 - midT) * (1 - midT) * p0.y + 2 * (1 - midT) * midT * cp.y + midT * midT * p1.y;

    let area = 0;
    area += (p0.x * midY - midX * p0.y);
    area += (midX * p1.y - p1.x * midY);
    return area;
};

export const getPolygonArea = (points: Point[]) => {
    let area = 0;
    const n = points.length;
    for (let i = 0; i < n; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % n];

        if (p2.controlPoint) {
            area += getBezierAreaTerm(p1, p2.controlPoint as Point, p2);
        } else {
            area += p1.x * p2.y;
            area -= p2.x * p1.y;
        }
    }
    return Math.abs(area) / 2;
};

export const getPolygonCentroid = (points: Point[]): Point => {
    let x = 0, y = 0, area = 0;
    const n = points.length;

    if (n < 3) {
        if (n === 0) return { x: 0, y: 0 };
        return points.reduce((acc, p) => ({x: acc.x + p.x/n, y: acc.y + p.y/n}), {x:0, y:0});
    }

    for (let i = 0; i < n; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % n];
        const f = p1.x * p2.y - p2.x * p1.y;
        area += f;
        x += (p1.x + p2.x) * f;
        y += (p1.y + p2.y) * f;
    }

    area *= 3;
    return { x: x / area, y: y / area };
};

// Evaluate a formula using MathJS with custom syntax support
export const evaluateFormula = (formula: string, context: Record<string, number>): number => {
    try {
        const scope = { ...context };

        // 1. Sanitize Scope: Default missing variables to 0
        const potentialVars = formula.match(/[a-zA-Z_]\w*/g) || [];
        potentialVars.forEach(v => {
            if (scope[v] === undefined && typeof (math as any)[v] === 'undefined' && v.toLowerCase() !== 'if') {
                scope[v] = 0;
            }
        });

        const ifMatch = formula.match(/^if\s+(.+?)\s*\((.+)\)\s*$/i);

        if (ifMatch) {
            const conditionStr = ifMatch[1];
            const resultStr = ifMatch[2];

            try {
                // Evaluate the condition (Boolean or Number)
                const conditionMet = math.evaluate(conditionStr, scope);

                // If truthy (1, true, >0), evaluate the result part
                if (conditionMet) {
                    const result = math.evaluate(resultStr, scope);
                    return Number(result) || 0;
                } else {
                    return 0;
                }
            } catch (err) {
                console.warn(`Error evaluating IF parts: ${formula}`, err);
                return 0;
            }
        }

        const cleanFormula = formula.replace(/^if\s+/i, '');
        const result = math.evaluate(cleanFormula, scope);
        return Number(result) || 0;

    } catch (e) {
        // console.error(`Formula evaluation error: ${formula}`, e);
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