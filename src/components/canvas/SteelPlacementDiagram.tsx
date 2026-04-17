import React, { useMemo } from 'react';
import { X, Printer } from 'lucide-react';
import { RoofSteelResult, PlaneSteelResult, formatFeetInches } from '../../utils/steelRoofing';

interface Props {
    result: RoofSteelResult;
    projectName: string;
    onClose: () => void;
}

/** Render a single plane's steel placement as SVG */
const PlaneDiagram: React.FC<{ plane: PlaneSteelResult; maxWidth: number }> = ({ plane, maxWidth }) => {
    const diagram = useMemo(() => {
        if (plane.sheets.length === 0) return null;

        const eaveLengthIn = plane.eaveLengthFt * 12;
        const maxRafterIn = plane.rafterLengthFt * 12;

        // Scale to fit within maxWidth, maintaining aspect ratio
        const padding = 40;
        const availableWidth = maxWidth - padding * 2;
        const scaleFactor = availableWidth / eaveLengthIn;
        const diagramHeight = maxRafterIn * scaleFactor + padding * 2;
        const diagramWidth = maxWidth;

        // Eave is at the bottom, ridge at the top
        const eaveY = diagramHeight - padding;
        const ridgeY = padding;

        return {
            scaleFactor,
            diagramHeight,
            diagramWidth,
            eaveY,
            ridgeY,
            padding,
        };
    }, [plane, maxWidth]);

    if (!diagram) return null;
    const { scaleFactor, diagramHeight, diagramWidth, eaveY, padding } = diagram;

    return (
        <div className="mb-6 print:break-inside-avoid">
            <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-gray-800">{plane.planeName}</h3>
                <span className="text-xs text-gray-500">
                    {plane.pitch}/12 · {plane.totalSheets} sheets · {formatFeetInches(plane.totalLinearFeet)} linear
                </span>
            </div>
            <svg
                width={diagramWidth}
                height={Math.min(diagramHeight, 500)}
                viewBox={`0 0 ${diagramWidth} ${diagramHeight}`}
                className="border border-gray-200 rounded-lg bg-white"
                style={{ maxHeight: '500px' }}
            >
                {/* Background grid */}
                <defs>
                    <pattern id={`grid-${plane.planeId}`} width="20" height="20" patternUnits="userSpaceOnUse">
                        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#f0f0f0" strokeWidth="0.5" />
                    </pattern>
                </defs>
                <rect width={diagramWidth} height={diagramHeight} fill={`url(#grid-${plane.planeId})`} />

                {/* Draw each sheet */}
                {plane.sheets.map((sheet, idx) => {
                    const xLeft = padding + sheet.xStartInches * scaleFactor;
                    const xRight = padding + sheet.xEndInches * scaleFactor;
                    const sheetWidth = xRight - xLeft;

                    // Heights from eave (positive upward)
                    const yBottomLeft = eaveY - sheet.slopeStartLeftFt * 12 * scaleFactor;
                    const yBottomRight = eaveY - sheet.slopeStartRightFt * 12 * scaleFactor;
                    const yTopLeft = eaveY - sheet.slopeEndLeftFt * 12 * scaleFactor;
                    const yTopRight = eaveY - sheet.slopeEndRightFt * 12 * scaleFactor;

                    // Sheet polygon: bottom-left, bottom-right, top-right, top-left
                    const points = `${xLeft},${yBottomLeft} ${xRight},${yBottomRight} ${xRight},${yTopRight} ${xLeft},${yTopLeft}`;

                    const isAngled = sheet.topNeedsAngleCut || sheet.bottomNeedsAngleCut;
                    const isPartial = sheet.actualWidthInches < sheet.coverageWidthInches;

                    let fillColor = '#dbeafe'; // blue-100
                    if (isAngled) fillColor = '#fef3c7'; // amber-100
                    if (isPartial) fillColor = '#fce7f3'; // pink-100

                    const centerY = (yBottomLeft + yBottomRight + yTopLeft + yTopRight) / 4;

                    return (
                        <g key={idx}>
                            {/* Sheet fill */}
                            <polygon
                                points={points}
                                fill={fillColor}
                                stroke="#3b82f6"
                                strokeWidth="1"
                            />

                            {/* Angled cut lines (red) */}
                            {sheet.topNeedsAngleCut && (
                                <line
                                    x1={xLeft} y1={yTopLeft}
                                    x2={xRight} y2={yTopRight}
                                    stroke="#ef4444"
                                    strokeWidth="2"
                                    strokeDasharray="4,2"
                                />
                            )}
                            {sheet.bottomNeedsAngleCut && (
                                <line
                                    x1={xLeft} y1={yBottomLeft}
                                    x2={xRight} y2={yBottomRight}
                                    stroke="#ef4444"
                                    strokeWidth="2"
                                    strokeDasharray="4,2"
                                />
                            )}

                            {/* Sheet number label */}
                            <text
                                x={xLeft + sheetWidth / 2}
                                y={centerY}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                className="text-[10px] font-bold fill-blue-800"
                                style={{ fontSize: Math.min(11, sheetWidth * 0.6) }}
                            >
                                #{sheet.sheetNumber}
                            </text>

                            {/* Length label */}
                            {sheetWidth > 15 && (
                                <text
                                    x={xLeft + sheetWidth / 2}
                                    y={centerY + 12}
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    className="fill-gray-500"
                                    style={{ fontSize: Math.min(8, sheetWidth * 0.4) }}
                                >
                                    {formatFeetInches(sheet.orderLengthFt)}
                                </text>
                            )}

                            {/* Cut angle annotations */}
                            {sheet.topLeftCutAngleDeg !== null && sheetWidth > 20 && (
                                <text x={xLeft + 2} y={yTopLeft + 12} className="fill-red-600 font-bold" style={{ fontSize: 7 }}>
                                    {sheet.topLeftCutAngleDeg}°
                                </text>
                            )}
                            {sheet.topRightCutAngleDeg !== null && sheetWidth > 20 && (
                                <text x={xRight - 2} y={yTopRight + 12} textAnchor="end" className="fill-red-600 font-bold" style={{ fontSize: 7 }}>
                                    {sheet.topRightCutAngleDeg}°
                                </text>
                            )}
                            {sheet.bottomLeftCutAngleDeg !== null && sheetWidth > 20 && (
                                <text x={xLeft + 2} y={yBottomLeft - 6} className="fill-red-600 font-bold" style={{ fontSize: 7 }}>
                                    {sheet.bottomLeftCutAngleDeg}°
                                </text>
                            )}
                            {sheet.bottomRightCutAngleDeg !== null && sheetWidth > 20 && (
                                <text x={xRight - 2} y={yBottomRight - 6} textAnchor="end" className="fill-red-600 font-bold" style={{ fontSize: 7 }}>
                                    {sheet.bottomRightCutAngleDeg}°
                                </text>
                            )}
                        </g>
                    );
                })}

                {/* Labels */}
                <text x={diagramWidth / 2} y={eaveY + 16} textAnchor="middle" className="fill-gray-600 font-bold" style={{ fontSize: 11 }}>
                    ← Eave: {formatFeetInches(plane.eaveLengthFt)} →
                </text>
                <text
                    x={8}
                    y={eaveY / 2 + padding / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    transform={`rotate(-90, 8, ${eaveY / 2 + padding / 2})`}
                    className="fill-gray-600 font-bold"
                    style={{ fontSize: 10 }}
                >
                    Rafter: {formatFeetInches(plane.rafterLengthFt)}
                </text>

                {/* Legend */}
                <g transform={`translate(${diagramWidth - 160}, ${diagramHeight - 50})`}>
                    <rect x="0" y="0" width="10" height="10" fill="#dbeafe" stroke="#3b82f6" strokeWidth="0.5" />
                    <text x="14" y="9" style={{ fontSize: 8 }} className="fill-gray-600">Full sheet</text>
                    <rect x="60" y="0" width="10" height="10" fill="#fef3c7" stroke="#3b82f6" strokeWidth="0.5" />
                    <text x="74" y="9" style={{ fontSize: 8 }} className="fill-gray-600">Angle cut</text>
                    <line x1="0" y1="20" x2="20" y2="20" stroke="#ef4444" strokeWidth="2" strokeDasharray="4,2" />
                    <text x="24" y="24" style={{ fontSize: 8 }} className="fill-gray-600">Cut line</text>
                </g>
            </svg>
        </div>
    );
};

export const SteelPlacementDiagram: React.FC<Props> = ({ result, projectName, onClose }) => {
    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4 print:absolute print:inset-0 print:p-0 print:bg-white print:block">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col print:max-h-none print:shadow-none print:rounded-none print:max-w-none print:w-full print:block">
                {/* Header - hidden in print */}
                <div className="flex items-center justify-between p-4 border-b bg-gray-50 rounded-t-xl print:hidden">
                    <h2 className="text-lg font-bold text-gray-800">Steel Placement Diagram</h2>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handlePrint}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
                        >
                            <Printer size={16} /> Print
                        </button>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Print header */}
                <div className="hidden print:block p-4 border-b">
                    <h1 className="text-xl font-bold">{projectName} — Steel Placement Diagram</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Profile: {result.coverageWidth}" coverage | {result.totalSheets} sheets | Generated: {new Date().toLocaleDateString()}
                    </p>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 print:overflow-visible print:block">
                    {result.planes.length === 0 ? (
                        <div className="text-center py-8 text-gray-400">
                            No roof planes with classified edges found.
                        </div>
                    ) : (
                        result.planes.map(plane => (
                            <PlaneDiagram key={plane.planeId} plane={plane} maxWidth={900} />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
