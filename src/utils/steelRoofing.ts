import { Point, Measurement } from '../types';
import { getSlopeMultiplier } from './math';

// ─── Types ───────────────────────────────────────────────────────

export type SteelCoverageWidth = 36 | 31 | 29 | 16;

export interface SteelSheet {
    sheetNumber: number;
    planeId: string;
    planeName: string;
    // Position along eave from left end (inches)
    xStartInches: number;
    xEndInches: number;
    coverageWidthInches: number;
    actualWidthInches: number; // may be partial for last sheet
    
    // Plan-view heights at bottom and top for left and right edges (feet)
    planHeightBottomLeftFt: number;
    planHeightBottomRightFt: number;
    planHeightTopLeftFt: number;
    planHeightTopRightFt: number;

    // Slope distances from eave (negative if overhang)
    slopeStartLeftFt: number;
    slopeStartRightFt: number;
    slopeEndLeftFt: number;
    slopeEndRightFt: number;

    // Slope-adjusted lengths
    slopeLengthLeftFt: number;
    slopeLengthRightFt: number;
    
    // Sheet length to order — max of left/right, rounded up to nearest 1/4"
    orderLengthFt: number;
    
    // Angle cuts
    topNeedsAngleCut: boolean;
    bottomNeedsAngleCut: boolean;
    topLeftCutAngleDeg: number | null;
    topRightCutAngleDeg: number | null;
    bottomLeftCutAngleDeg: number | null;
    bottomRightCutAngleDeg: number | null;
    
    // Edge types
    topEdgeType: string | null;
    bottomEdgeType: string | null;
}

export interface PlaneSteelResult {
    planeId: string;
    planeName: string;
    pitch: number;
    eaveLengthFt: number;
    rafterLengthFt: number; // max plan height * slope multiplier
    sheets: SteelSheet[];
    totalSheets: number;
    totalLinearFeet: number;
}

export interface RoofSteelResult {
    planes: PlaneSteelResult[];
    totalSheets: number;
    totalLinearFeet: number;
    coverageWidth: SteelCoverageWidth;
}

// ─── Helpers ─────────────────────────────────────────────────────

const EAVE_OVERHANG_FT = 2 / 12; // 2 inches in feet

const roundToHalfInchDown = (feet: number): number => {
    const inches = feet * 12;
    const rounded = Math.floor(inches * 2) / 2;
    return rounded / 12;
};

export const formatFeetInches = (feet: number): string => {
    const totalInches = Math.floor(feet * 12 * 2) / 2;
    const ft = Math.floor(totalInches / 12);
    const inches = totalInches - ft * 12;
    const wholeInches = Math.floor(inches);
    const frac = inches - wholeInches;

    let fracStr = '';
    if (Math.abs(frac - 0.5) < 0.01) fracStr = ' 1/2';

    if (wholeInches === 0 && fracStr === '') return `${ft}'`;
    return `${ft}' ${wholeInches}${fracStr}"`;
};

// ─── Coordinate Transform & Intersections ─────────────────────────

interface LocalPoint { x: number; y: number; }

interface EaveCoordSystem {
    localPoints: LocalPoint[];
    eaveLengthPx: number;
    eaveEdgeIndex: number;
    edgeTypes: (string | undefined)[];
}

function transformToEaveCoords(
    points: Point[],
    edgeTypes: string[]
): EaveCoordSystem | null {
    const n = points.length;
    if (n < 3) return null;

    let eaveIdx = -1;
    let longestEave = 0;
    for (let i = 0; i < n; i++) {
        if (edgeTypes[i] === 'eave') {
            const p1 = points[i];
            const p2 = points[(i + 1) % n];
            const len = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
            if (len > longestEave) {
                longestEave = len;
                eaveIdx = i;
            }
        }
    }
    if (eaveIdx === -1) return null;

    const eaveStart = points[eaveIdx];
    const eaveEnd = points[(eaveIdx + 1) % n];

    const dx = eaveEnd.x - eaveStart.x;
    const dy = eaveEnd.y - eaveStart.y;
    const eaveLengthPx = Math.sqrt(dx * dx + dy * dy);
    const ux = dx / eaveLengthPx;
    const uy = dy / eaveLengthPx;

    const cx = points.reduce((s, p) => s + p.x, 0) / n;
    const cy = points.reduce((s, p) => s + p.y, 0) / n;
    let px = -uy, py = ux;
    const toCenter = { x: cx - eaveStart.x, y: cy - eaveStart.y };
    if (toCenter.x * px + toCenter.y * py < 0) {
        px = -px;
        py = -py;
    }

    const transform = (p: Point) => ({
        x: (p.x - eaveStart.x) * ux + (p.y - eaveStart.y) * uy,
        y: (p.x - eaveStart.x) * px + (p.y - eaveStart.y) * py,
    });

    const localPoints = points.map(transform);

    return { localPoints, eaveLengthPx, eaveEdgeIndex: eaveIdx, edgeTypes };
}

interface EdgeInfo {
    p1: LocalPoint;
    p2: LocalPoint;
    edgeType: string | null;
    isEave: boolean;
}

interface Intersection {
    y: number;
    edge: EdgeInfo;
}

function getIntersectionsAtX(
    x: number,
    localPoints: LocalPoint[],
    eaveEdgeIndex: number,
    edgeTypes: (string | undefined)[]
): Intersection[] {
    const intersections: Intersection[] = [];

    const n = localPoints.length;
    for (let i = 0; i < n; i++) {
        // Skip slit edges as they are invisible connectors for cutouts
        if (edgeTypes[i] === 'slit') continue;

        const p1 = localPoints[i];
        const p2 = localPoints[(i + 1) % n];

        if ((p1.x <= x && x < p2.x) || (p2.x <= x && x < p1.x)) {
            let y: number;
            if (Math.abs(p2.x - p1.x) < 0.01) {
                y = Math.max(p1.y, p2.y);
            } else {
                const t = (x - p1.x) / (p2.x - p1.x);
                y = p1.y + t * (p2.y - p1.y);
            }

            const isEave = i === eaveEdgeIndex;
            intersections.push({
                y,
                edge: { p1, p2, edgeType: edgeTypes[i] || null, isEave }
            });
        }
    }

    return intersections.sort((a, b) => a.y - b.y);
}

function evaluateEdgeAtX(edge: EdgeInfo, x: number): number {
    if (Math.abs(edge.p2.x - edge.p1.x) < 0.01) {
        return Math.max(edge.p1.y, edge.p2.y);
    }
    const t = (x - edge.p1.x) / (edge.p2.x - edge.p1.x);
    return edge.p1.y + t * (edge.p2.y - edge.p1.y);
}

// ─── Steel Calculation for a Single Plane ────────────────────────

export function calculateSteelForPlane(
    plane: Measurement,
    coverageWidth: SteelCoverageWidth,
    scale: number,
    globalSheetCounter: { count: number }
): PlaneSteelResult | null {
    if (!plane.edgeTypes || plane.points.length < 3) return null;

    const coordSystem = transformToEaveCoords(plane.points, plane.edgeTypes);
    if (!coordSystem) return null;

    const { localPoints, eaveLengthPx, eaveEdgeIndex, edgeTypes } = coordSystem;
    const pitch = plane.pitch || 4;
    const slopeMultiplier = getSlopeMultiplier(pitch);
    const eaveLengthFt = eaveLengthPx / scale;
    const eaveLengthInches = eaveLengthFt * 12;

    const numSheets = Math.ceil(eaveLengthInches / coverageWidth);
    const sheets: SteelSheet[] = [];
    let maxPlanHeight = 0;

    for (let i = 0; i < numSheets; i++) {
        const xStartInches = i * coverageWidth;
        const xEndInches = Math.min((i + 1) * coverageWidth, eaveLengthInches);
        const actualWidth = xEndInches - xStartInches;
        if (actualWidth < 1) continue;

        const xLeftPx = (xStartInches / 12) * scale;
        const xRightPx = (xEndInches / 12) * scale;
        const xMidPx = (xLeftPx + xRightPx) / 2;

        const intersections = getIntersectionsAtX(xMidPx, localPoints, eaveEdgeIndex, edgeTypes);

        for (let j = 0; j < intersections.length; j += 2) {
            const bottom = intersections[j];
            const top = intersections[j + 1];
            if (!top) break;

            globalSheetCounter.count++;

            const planHeightBottomLeftFt = evaluateEdgeAtX(bottom.edge, xLeftPx) / scale;
            const planHeightBottomRightFt = evaluateEdgeAtX(bottom.edge, xRightPx) / scale;
            const planHeightTopLeftFt = evaluateEdgeAtX(top.edge, xLeftPx) / scale;
            const planHeightTopRightFt = evaluateEdgeAtX(top.edge, xRightPx) / scale;

            if (planHeightTopLeftFt > maxPlanHeight) maxPlanHeight = planHeightTopLeftFt;
            if (planHeightTopRightFt > maxPlanHeight) maxPlanHeight = planHeightTopRightFt;

            const overhangBottomLeftFt = bottom.edge.isEave ? EAVE_OVERHANG_FT : 0;
            const overhangBottomRightFt = bottom.edge.isEave ? EAVE_OVERHANG_FT : 0;

            const slopeStartLeftFt = planHeightBottomLeftFt * slopeMultiplier - overhangBottomLeftFt;
            const slopeStartRightFt = planHeightBottomRightFt * slopeMultiplier - overhangBottomRightFt;
            const slopeEndLeftFt = planHeightTopLeftFt * slopeMultiplier;
            const slopeEndRightFt = planHeightTopRightFt * slopeMultiplier;

            const slopeLengthLeftFt = Math.max(0, slopeEndLeftFt - slopeStartLeftFt);
            const slopeLengthRightFt = Math.max(0, slopeEndRightFt - slopeStartRightFt);

            const orderLengthFt = roundToHalfInchDown(Math.max(slopeLengthLeftFt, slopeLengthRightFt));

            // Angles
            const topHeightDiff = Math.abs(planHeightTopLeftFt - planHeightTopRightFt);
            const topNeedsAngleCut = topHeightDiff > 0.05;
            let topLeftCutAngleDeg: number | null = null;
            let topRightCutAngleDeg: number | null = null;

            if (topNeedsAngleCut) {
                const angleDeg = Math.round(Math.atan2(topHeightDiff * slopeMultiplier * 12, actualWidth) * (180 / Math.PI) * 10) / 10;
                if (planHeightTopLeftFt < planHeightTopRightFt) {
                    topLeftCutAngleDeg = angleDeg; // left side is shorter
                } else {
                    topRightCutAngleDeg = angleDeg;
                }
            }

            const bottomHeightDiff = Math.abs(planHeightBottomLeftFt - planHeightBottomRightFt);
            const bottomNeedsAngleCut = bottomHeightDiff > 0.05;
            let bottomLeftCutAngleDeg: number | null = null;
            let bottomRightCutAngleDeg: number | null = null;

            if (bottomNeedsAngleCut) {
                const angleDeg = Math.round(Math.atan2(bottomHeightDiff * slopeMultiplier * 12, actualWidth) * (180 / Math.PI) * 10) / 10;
                if (planHeightBottomLeftFt > planHeightBottomRightFt) {
                    bottomLeftCutAngleDeg = angleDeg; // left side starts higher, cut goes up to left
                } else {
                    bottomRightCutAngleDeg = angleDeg;
                }
            }

            sheets.push({
                sheetNumber: globalSheetCounter.count,
                planeId: plane.id,
                planeName: plane.name || `Plane ${plane.roofPlaneIndex}`,
                xStartInches,
                xEndInches,
                coverageWidthInches: coverageWidth,
                actualWidthInches: Math.round(actualWidth * 4) / 4,
                planHeightBottomLeftFt,
                planHeightBottomRightFt,
                planHeightTopLeftFt,
                planHeightTopRightFt,
                slopeStartLeftFt,
                slopeStartRightFt,
                slopeEndLeftFt,
                slopeEndRightFt,
                slopeLengthLeftFt,
                slopeLengthRightFt,
                orderLengthFt,
                topNeedsAngleCut,
                bottomNeedsAngleCut,
                topLeftCutAngleDeg,
                topRightCutAngleDeg,
                bottomLeftCutAngleDeg,
                bottomRightCutAngleDeg,
                topEdgeType: top.edge.edgeType,
                bottomEdgeType: bottom.edge.edgeType,
            });
        }
    }

    const totalLinearFeet = sheets.reduce((sum, s) => sum + s.orderLengthFt, 0);
    const rafterLengthFt = maxPlanHeight * slopeMultiplier;

    return {
        planeId: plane.id,
        planeName: plane.name || `Plane ${plane.roofPlaneIndex}`,
        pitch,
        eaveLengthFt,
        rafterLengthFt,
        sheets,
        totalSheets: sheets.length,
        totalLinearFeet,
    };
}

// ─── Full Roof Calculation ───────────────────────────────────────

export function calculateSteelForRoof(
    measurements: Measurement[],
    coverageWidth: SteelCoverageWidth,
    scale: number,
    pageScales: Record<number, number>
): RoofSteelResult {
    const roofPlanes = measurements.filter(m => m.roofPlaneIndex && m.type === 'shape');
    const globalSheetCounter = { count: 0 };

    const planes: PlaneSteelResult[] = [];
    for (const plane of roofPlanes) {
        const effectiveScale = pageScales[plane.pageIndex] || scale;
        const result = calculateSteelForPlane(plane, coverageWidth, effectiveScale, globalSheetCounter);
        if (result) planes.push(result);
    }

    return {
        planes,
        totalSheets: planes.reduce((s, p) => s + p.totalSheets, 0),
        totalLinearFeet: planes.reduce((s, p) => s + p.totalLinearFeet, 0),
        coverageWidth,
    };
}

// ─── Cut List Generation ─────────────────────────────────────────

export interface CutListEntry {
    sheetNumber: number;
    planeName: string;
    orderLength: string; // formatted ft-in
    orderLengthFt: number;
    coverageWidth: number;
    actualWidth: number;
    cutDescription: string;
    cutAngles: string;
}

export function generateCutList(result: RoofSteelResult): CutListEntry[] {
    const entries: CutListEntry[] = [];

    for (const plane of result.planes) {
        for (const sheet of plane.sheets) {
            let cutDesc = 'Full rectangle';
            if (sheet.topNeedsAngleCut || sheet.bottomNeedsAngleCut) {
                const parts = [];
                if (sheet.topNeedsAngleCut) parts.push('Top angle');
                if (sheet.bottomNeedsAngleCut) parts.push('Bottom angle');
                cutDesc = parts.join(', ');
            }
            if (sheet.actualWidthInches < sheet.coverageWidthInches) {
                cutDesc += ' (partial)';
            }

            let cutAngles = '—';
            const angles: string[] = [];
            if (sheet.topLeftCutAngleDeg !== null) angles.push(`TL: ${sheet.topLeftCutAngleDeg}°`);
            if (sheet.topRightCutAngleDeg !== null) angles.push(`TR: ${sheet.topRightCutAngleDeg}°`);
            if (sheet.bottomLeftCutAngleDeg !== null) angles.push(`BL: ${sheet.bottomLeftCutAngleDeg}°`);
            if (sheet.bottomRightCutAngleDeg !== null) angles.push(`BR: ${sheet.bottomRightCutAngleDeg}°`);
            if (angles.length > 0) cutAngles = angles.join(', ');

            entries.push({
                sheetNumber: sheet.sheetNumber,
                planeName: sheet.planeName,
                orderLength: formatFeetInches(sheet.orderLengthFt),
                orderLengthFt: sheet.orderLengthFt,
                coverageWidth: sheet.coverageWidthInches,
                actualWidth: sheet.actualWidthInches,
                cutDescription: cutDesc,
                cutAngles,
            });
        }
    }

    return entries;
}
