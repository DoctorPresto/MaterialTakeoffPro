import {Measurement, Point} from '../types';

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

export const evaluateFormula = (formula: string, context: Record<string, number>): number => {
    const sortedKeys = Object.keys(context).sort((a, b) => b.length - a.length);
    let parsed = formula.trim();

    // Replace variable names with their values
    sortedKeys.forEach(key => {
        const value = context[key];
        const regex = new RegExp(`\\b${key}\\b`, 'g');
        parsed = parsed.replace(regex, value.toString());
    });

    try {
        // Check if this is an IF statement
        const ifMatch = parsed.match(/^if\s+(.+?)\s*\((.+)\)\s*$/i);
        if (ifMatch) {
            const condition = ifMatch[1].trim();
            const resultExpr = ifMatch[2].trim();

            // Evaluate the condition
            if (evaluateCondition(condition)) {
                // If condition is true, evaluate and return the result expression
                const sanitized = resultExpr.replace(/[^0-9+\-*/(). ]/g, '');
                return new Function(`return ${sanitized}`)();
            } else {
                // If condition is false, return 0 (material not used)
                return 0;
            }
        }

        // Regular expression (no IF statement)
        const sanitized = parsed.replace(/[^0-9+\-*/(). ]/g, '');
        return new Function(`return ${sanitized}`)();
    } catch (e) {
        console.error(`Formula evaluation error: ${formula}`, e);
        return 0;
    }
};

const evaluateCondition = (condition: string): boolean => {
    try {
        let parsed = condition
            .replace(/\bOR\b/gi, '||')
            .replace(/\bAND\b/gi, '&&');

        parsed = parsed
            .replace(/<==/g, '<=')
            .replace(/>==/g, '>=')
            .replace(/===/g, '===')
            .replace(/==(?!=)/g, '===')
            .replace(/!=(?!=)/g, '!==');

        const sanitized = parsed.replace(/[^0-9+\-*/().&|!<>=\s]/g, '');

        const result = new Function(`return ${sanitized}`)();
        return Boolean(result);
    } catch (e) {
        console.error(`Condition evaluation error for: "${condition}"`, e);
        return false;
    }
};

export const applyRounding = (val: number, type: 'up' | 'down' | 'nearest' | 'none') => {
    switch (type) {
        case 'up':
            return Math.ceil(val);
        case 'down':
            return Math.floor(val);
        case 'nearest':
            return Math.round(val);
        default:
            return val;
    }
};

export const calculateCommonEdge = (shape1: Measurement, shape2: Measurement, scale: number): number => {
    if (!shape1 || !shape2 || shape1.points.length < 2 || shape2.points.length < 2) return 0;

    const edges1 = getEdges(shape1.points);
    const edges2 = getEdges(shape2.points);
    let commonLength = 0;

    // Tolerance for "touching" (in pixels)
    const EPSILON = 5;

    edges1.forEach(e1 => {
        edges2.forEach(e2 => {
            if (isOverlapping(e1, e2, EPSILON)) {
                commonLength += Math.min(getDistance(e1.p1, e1.p2), getDistance(e2.p1, e2.p2));
            }
        });
    });

    return commonLength / scale;
};

const getEdges = (points: Point[]) => {
    const edges = [];
    for (let i = 0; i < points.length; i++) {
        edges.push({p1: points[i], p2: points[(i + 1) % points.length]});
    }
    return edges;
};

const isOverlapping = (e1: { p1: Point, p2: Point }, e2: { p1: Point, p2: Point }, tol: number) => {
    const match1 = (getDistance(e1.p1, e2.p1) < tol && getDistance(e1.p2, e2.p2) < tol);
    const match2 = (getDistance(e1.p1, e2.p2) < tol && getDistance(e1.p2, e2.p1) < tol);
    return match1 || match2;
};