import {Point} from '../../types';

export const ZOOM_INCREMENT = 0.05;
export const MAX_ZOOM = 5;
export const MIN_ZOOM = 0.1;
export const RENDER_THROTTLE = 60;

export const GROUP_COLORS = [
    '#ef4444', // red
    '#10b981', // green
    '#8b5cf6', // purple
    '#f97316', // orange
    '#0ea5e9', // sky
    '#ec4899', // pink
    '#84cc16', // lime
    '#f59e0b', // amber
];

export const getGroupColor = (group: string | undefined, overrideColors: Record<string, string>): string => {
    if (!group) return '#2563eb'; // default blue for ungrouped
    if (overrideColors[group]) return overrideColors[group];

    let hash = 0;
    for (let i = 0; i < group.length; i++) {
        hash = group.charCodeAt(i) + ((hash << 5) - hash);
    }
    return GROUP_COLORS[Math.abs(hash) % GROUP_COLORS.length];
};

export const getFormattedDistance = (p1: Point, p2: Point, scale: number) => {
    const px = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    const feetDecimal = px / scale;
    const feet = Math.floor(feetDecimal);
    const inches = Math.round((feetDecimal - feet) * 12);
    return `${feet}' ${inches}"`;
};

// Generates an SVG path string from points using graph connections and CURVES
export const generateLinePath = (points: Point[]) => {
    if (points.length === 0) return '';

    // Check if graph mode
    const isGraph = points.some(p => p.connectsTo && p.connectsTo.length > 0);

    if (isGraph) {
        let d = '';
        points.forEach(p => {
            if (p.connectsTo) {
                p.connectsTo.forEach(targetIdx => {
                    const target = points[targetIdx];
                    if (target) {
                        d += `M ${p.x},${p.y} `;
                        if (target.controlPoint) {
                            d += `Q ${target.controlPoint.x},${target.controlPoint.y} ${target.x},${target.y} `;
                        } else {
                            d += `L ${target.x},${target.y} `;
                        }
                    }
                });
            }
        });
        return d;
    }

    // Fallback to sequential path for simple shapes
    let d = `M ${points[0].x},${points[0].y}`;
    for(let i = 1; i < points.length; i++) {
        const p = points[i];
        if (p.controlPoint) {
            d += ` Q ${p.controlPoint.x},${p.controlPoint.y} ${p.x},${p.y}`;
        } else {
            d += ` L ${p.x},${p.y}`;
        }
    }
    return d;
};