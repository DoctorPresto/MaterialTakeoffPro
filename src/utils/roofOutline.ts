import { Point, Measurement } from '../types';
import { getPolygonArea, getPathLength, getSlopeMultiplier } from './math';

// ─── Types ───────────────────────────────────────────────────────

export interface RoofPlaneSummary {
    measurementId: string;
    name: string;
    planArea: number;     // flat/plan area in sq ft
    trueArea: number;     // slope-adjusted area
    pitch: number;
}

export interface RoofSummary {
    planes: RoofPlaneSummary[];
    totalTrueArea: number;
    totalPlanArea: number;
    ridgeLength: number;
    hipLength: number;
    valleyLength: number;
    eaveLength: number;
    gableLength: number;
}

// ─── Core Math ───────────────────────────────────────────────────

/** True (slope-adjusted) area from plan area and pitch */
export const computeTrueArea = (planArea: number, pitch: number): number =>
    planArea * getSlopeMultiplier(pitch);

/** Compute plan area for a shape defined by dimensions (in feet) */
export const computeShapeArea = (
    shape: 'rectangle' | 'triangle' | 'trapezoid' | 'custom',
    dims: { width?: number; height?: number; topBase?: number; bottomBase?: number; customArea?: number }
): number => {
    switch (shape) {
        case 'rectangle':
            return (dims.width || 0) * (dims.height || 0);
        case 'triangle':
            return ((dims.width || 0) * (dims.height || 0)) / 2;
        case 'trapezoid':
            return (((dims.topBase || 0) + (dims.bottomBase || 0)) / 2) * (dims.height || 0);
        case 'custom':
            return dims.customArea || 0;
        default:
            return 0;
    }
};

export const generatePlanePolygon = (
    shape: 'rectangle' | 'triangle' | 'trapezoid' | 'custom',
    dims: { width?: number; height?: number; topBase?: number; bottomBase?: number; customArea?: number },
    scale: number,
    cx: number,
    cy: number
): Point[] => {
    const toPixels = (feet: number) => feet * scale;

    switch (shape) {
        case 'rectangle': {
            const w = toPixels(dims.width || 10);
            const h = toPixels(dims.height || 10);
            return [
                { x: cx - w / 2, y: cy - h / 2 },
                { x: cx + w / 2, y: cy - h / 2 },
                { x: cx + w / 2, y: cy + h / 2 },
                { x: cx - w / 2, y: cy + h / 2 },
            ];
        }
        case 'triangle': {
            const b = toPixels(dims.width || 10);
            const h = toPixels(dims.height || 10);
            return [
                { x: cx - b / 2, y: cy + h / 3 },      // bottom left
                { x: cx + b / 2, y: cy + h / 3 },      // bottom right
                { x: cx, y: cy - 2 * h / 3 },            // apex
            ];
        }
        case 'trapezoid': {
            const topW = toPixels(dims.topBase || 5);
            const botW = toPixels(dims.bottomBase || 10);
            const h = toPixels(dims.height || 10);
            return [
                { x: cx - botW / 2, y: cy + h / 2 },   // bottom left
                { x: cx + botW / 2, y: cy + h / 2 },   // bottom right
                { x: cx + topW / 2, y: cy - h / 2 },   // top right
                { x: cx - topW / 2, y: cy - h / 2 },   // top left
            ];
        }
        case 'custom': {
            // Generate a square with matching area
            const areaFt = dims.customArea || 100;
            const side = toPixels(Math.sqrt(areaFt));
            return [
                { x: cx - side / 2, y: cy - side / 2 },
                { x: cx + side / 2, y: cy - side / 2 },
                { x: cx + side / 2, y: cy + side / 2 },
                { x: cx - side / 2, y: cy + side / 2 },
            ];
        }
        default:
            return [];
    }
};

// ─── Roof Summary ───────────────────────────────────────────────

/** Compute a full roof summary from all roof-tagged measurements */
export const computeRoofSummary = (
    measurements: Measurement[],
    scale: number,
    pageScales: Record<number, number>
): RoofSummary => {
    let ridgeLength = 0, hipLength = 0, valleyLength = 0, eaveLength = 0, gableLength = 0;
    const planes: RoofPlaneSummary[] = [];

    measurements.forEach(m => {
        const effectiveScale = pageScales[m.pageIndex] || scale;

        // Roof line lengths
        if (m.roofLineType && m.type === 'line') {
            const rawLength = getPathLength(m.points) / effectiveScale;
            switch (m.roofLineType) {
                case 'ridge': ridgeLength += rawLength; break;
                case 'eave': eaveLength += rawLength; break;
                case 'gable': gableLength += rawLength; break;
                case 'hip': hipLength += rawLength; break;
                case 'valley': valleyLength += rawLength; break;
            }
        }

        // Roof plane areas
        if (m.roofPlaneIndex && m.type === 'shape') {
            const planArea = getPolygonArea(m.points) / (effectiveScale * effectiveScale);
            const pitch = m.pitch || 4;
            planes.push({
                measurementId: m.id,
                name: m.name || `Plane ${m.roofPlaneIndex}`,
                planArea,
                trueArea: computeTrueArea(planArea, pitch),
                pitch
            });
        }
    });

    return {
        planes,
        totalPlanArea: planes.reduce((sum, p) => sum + p.planArea, 0),
        totalTrueArea: planes.reduce((sum, p) => sum + p.trueArea, 0),
        ridgeLength,
        hipLength,
        valleyLength,
        eaveLength,
        gableLength
    };
};

// ─── Snap Points ────────────────────────────────────────────────

/** Get all roof line endpoints for snap targeting during plane definition */
export const getRoofSnapPoints = (
    measurements: Measurement[],
    pageIndex: number
): Point[] => {
    const points: Point[] = [];
    measurements.forEach(m => {
        if (m.roofLineType && m.pageIndex === pageIndex) {
            m.points.forEach(p => {
                // Avoid exact duplicates
                if (!points.some(existing => 
                    Math.abs(existing.x - p.x) < 1 && Math.abs(existing.y - p.y) < 1
                )) {
                    points.push({ x: p.x, y: p.y });
                }
            });
        }
    });
    return points;
};

// ─── Polygon Builder from Lines ─────────────────────────────────

const ENDPOINT_TOLERANCE = 5; // px tolerance for matching endpoints

/** Check if two points are within tolerance */
const pointsMatch = (a: Point, b: Point, tol = ENDPOINT_TOLERANCE): boolean =>
    Math.abs(a.x - b.x) < tol && Math.abs(a.y - b.y) < tol;

/** Average of two matched points (for cleaner polygon) */
const avgPoint = (a: Point, b: Point): Point => ({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
});

interface LineSegment {
    id: string;
    start: Point;
    end: Point;
}

/**
 * Build a closed polygon from selected roof line measurements.
 * 
 * Each line measurement contributes a segment from its first point to its last point.
 * Uses backtracking search to find a valid closed cycle through all segments,
 * trying each segment in both directions at each step.
 * 
 * Returns ordered Point[] for the polygon, or null if lines don't connect.
 */
export const buildPolygonFromLines = (
    selectedIds: string[],
    allMeasurements: Measurement[],
    tolerance = ENDPOINT_TOLERANCE
): Point[] | null => {
    // 1. Extract line segments
    const segments: LineSegment[] = [];
    selectedIds.forEach(id => {
        const m = allMeasurements.find(meas => meas.id === id);
        if (m && m.points.length >= 2) {
            segments.push({
                id: m.id,
                start: m.points[0],
                end: m.points[m.points.length - 1],
            });
        }
    });

    if (segments.length < 3) return null;

    const getExit = (seg: LineSegment, reversed: boolean): Point =>
        reversed ? seg.start : seg.end;

    const getEntry = (seg: LineSegment, reversed: boolean): Point =>
        reversed ? seg.end : seg.start;

    type ChainEntry = { seg: LineSegment; reversed: boolean };

    // 2. Backtracking search: try all valid orderings
    const solve = (
        chain: ChainEntry[],
        used: Set<string>,
        currentExit: Point
    ): ChainEntry[] | null => {
        // All segments used — check if chain closes
        if (used.size === segments.length) {
            const firstEntry = getEntry(chain[0].seg, chain[0].reversed);
            if (pointsMatch(currentExit, firstEntry, tolerance)) {
                return chain;
            }
            return null;
        }

        // Try each unused segment in both directions
        for (const seg of segments) {
            if (used.has(seg.id)) continue;

            // Try forward: does seg.start match currentExit?
            if (pointsMatch(currentExit, seg.start, tolerance)) {
                chain.push({ seg, reversed: false });
                used.add(seg.id);
                const result = solve(chain, used, seg.end);
                if (result) return result;
                chain.pop();
                used.delete(seg.id);
            }

            // Try reversed: does seg.end match currentExit?
            if (pointsMatch(currentExit, seg.end, tolerance)) {
                chain.push({ seg, reversed: true });
                used.add(seg.id);
                const result = solve(chain, used, seg.start);
                if (result) return result;
                chain.pop();
                used.delete(seg.id);
            }
        }

        return null; // No valid continuation found
    };

    // 3. Try starting with each segment in both directions
    for (const startSeg of segments) {
        for (const startReversed of [false, true]) {
            const chain: ChainEntry[] = [{ seg: startSeg, reversed: startReversed }];
            const used = new Set([startSeg.id]);
            const exit = getExit(startSeg, startReversed);

            const result = solve(chain, used, exit);
            if (result) {
                // 4. Build polygon vertices by averaging junction points
                const vertices: Point[] = [];
                for (let i = 0; i < result.length; i++) {
                    const curr = result[i];
                    const next = result[(i + 1) % result.length];
                    const exitPt = getExit(curr.seg, curr.reversed);
                    const nextEntryPt = getEntry(next.seg, next.reversed);
                    vertices.push(avgPoint(exitPt, nextEntryPt));
                }
                return vertices;
            }
        }
    }

    return null; // No valid closed loop found
};

