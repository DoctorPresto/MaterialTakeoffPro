import React, { useState, useMemo } from 'react';
import { useStore } from '../../store';
import {
    Calculator, PenTool, X, MousePointer, Trash2
} from 'lucide-react';
import { computeShapeArea, computeTrueArea, getSlopeFactor } from '../../utils/roofOutline';
import { getPolygonArea } from '../../utils/math';
import { Measurement } from '../../types';

type PlaneShape = 'rectangle' | 'triangle' | 'trapezoid' | 'custom';

export const ProjectWizard = () => {
    const {
        activeWizardStep,
        setWizardStep,
        buildingData,
        updateBuildingData,
        setWizardTool,
        activeWizardTool,
        measurements,
        updateMeasurement,
        addRoofPlaneFromDimensions,
        deleteMeasurement,
        scale,
        pageScales,
        selectedRoofPlaneId,
        selectedRoofEdgeIndex,
        setSelectedRoofPlaneId,
        setSelectedRoofEdgeIndex,
    } = useStore();



    // ─── Dimension form fallback state ──────────────────────────
    const [showDimForm, setShowDimForm] = useState(false);
    const [dimShape, setDimShape] = useState<PlaneShape>('rectangle');
    const [dimWidth, setDimWidth] = useState(24);
    const [dimHeight, setDimHeight] = useState(12);
    const [dimTopBase, setDimTopBase] = useState(8);
    const [dimBottomBase, setDimBottomBase] = useState(16);
    const [dimCustomArea, setDimCustomArea] = useState(400);
    const [dimPitch, setDimPitch] = useState(buildingData.roofPitch || 0);



    // ─── Roof planes ────────────────────────────────────────────
    const roofPlanes = useMemo(() => {
        return measurements
            .filter((m: Measurement) => m.roofPlaneIndex && m.type === 'shape')
            .map((m: Measurement) => {
                const effectiveScale = pageScales[m.pageIndex] || scale;
                const planArea = getPolygonArea(m.points) / (effectiveScale * effectiveScale);
                const pitch = m.pitch || 4;
                return {
                    id: m.id,
                    name: m.name || `Plane ${m.roofPlaneIndex}`,
                    index: m.roofPlaneIndex!,
                    planArea,
                    trueArea: computeTrueArea(planArea, pitch),
                    pitch,
                };
            })
            .sort((a: { index: number }, b: { index: number }) => a.index - b.index);
    }, [measurements, scale, pageScales]);

    const totalPlanArea = roofPlanes.reduce((s: number, p: { planArea: number }) => s + p.planArea, 0);
    const totalTrueArea = roofPlanes.reduce((s: number, p: { trueArea: number }) => s + p.trueArea, 0);

    // ─── Deduplicated Edge Lengths Summary ──────────────────────
    // buildingData already has the deduped totals calculated by store.ts

    // ─── Handlers ───────────────────────────────────────────────
    const handleSetEdgeType = (type: 'hip' | 'valley' | 'ridge' | 'eave' | 'gable' | 'none') => {
        if (!selectedRoofPlaneId || selectedRoofEdgeIndex === null) return;
        const plane = measurements.find((m: Measurement) => m.id === selectedRoofPlaneId);
        if (!plane) return;

        const newEdgeTypes = [...(plane.edgeTypes || new Array(plane.points.length).fill('none'))];
        newEdgeTypes[selectedRoofEdgeIndex] = type;

        updateMeasurement(plane.id, { edgeTypes: newEdgeTypes });
    };

    const handleClearSelection = () => {
        setSelectedRoofPlaneId(null);
        setSelectedRoofEdgeIndex(null);
    };

    // ─── Dimension form ─────────────────────────────────────────
    const previewArea = computeShapeArea(dimShape, {
        width: dimWidth, height: dimHeight,
        topBase: dimTopBase, bottomBase: dimBottomBase,
        customArea: dimCustomArea,
    });
    const previewTrueArea = computeTrueArea(previewArea, dimPitch);

    const handleCreateFromDims = () => {
        addRoofPlaneFromDimensions(dimShape, {
            width: dimWidth, height: dimHeight,
            topBase: dimTopBase, bottomBase: dimBottomBase,
            customArea: dimCustomArea,
        }, dimPitch);
        setShowDimForm(false);
    };

    const activateMeasure = (tool: string) => {
        setWizardTool(tool);
    };

    // --- Dragging State ---
    const [position, setPosition] = useState({ x: window.innerWidth - 340, y: 80 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    const handlePointerDown = (e: React.PointerEvent) => {
        setIsDragging(true);
        setDragOffset({
            x: e.clientX - position.x,
            y: e.clientY - position.y
        });
        e.currentTarget.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (isDragging) {
            setPosition({
                x: e.clientX - dragOffset.x,
                y: e.clientY - dragOffset.y
            });
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        setIsDragging(false);
        e.currentTarget.releasePointerCapture(e.pointerId);
    };

    // ─── Early exits ────────────────────────────────────────────
    if (activeWizardStep === 'none') return null;

    const isMeasuring = !!activeWizardTool;

    // Tracing Mode Banner
    const renderTracingBanner = () => {
        if (isMeasuring && activeWizardTool === 'roof-plane') {
            return (
                <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-6 py-3 rounded-full shadow-lg z-50 flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
                    <span className="font-bold flex items-center gap-2">
                        <PenTool size={18} />
                        Tracing Roof Plane...
                    </span>
                    <div className="h-4 w-px bg-blue-400"></div>
                    <button
                        onClick={() => setWizardTool(null)}
                        className="bg-white text-blue-600 hover:bg-blue-50 rounded-full px-3 py-1 text-xs font-bold transition-colors"
                    >
                        Done Tracing
                    </button>
                </div>
            );
        }
        return null;
    };

    return (
        <>
            {renderTracingBanner()}
            <div 
                className="fixed w-80 bg-white rounded-xl shadow-2xl z-50 border border-gray-200 overflow-hidden flex flex-col max-h-[calc(100vh-2rem)]"
                style={{ left: position.x, top: position.y }}
            >
            {/* Header */}
            <div 
                className="bg-blue-600 p-4 text-white flex justify-between items-start select-none"
                style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
            >
                <div>
                    <h3 className="font-bold flex items-center gap-2">
                        <Calculator size={18} /> Roof Wizard
                    </h3>
                    <p className="text-blue-100 text-xs mt-1">Define roof lines and planes</p>
                </div>
                <button onClick={() => { handleClearSelection(); setWizardStep('none'); } } className="text-blue-200 hover:text-white">
                    <X size={18} />
                </button>
            </div>

            {/* Content Body */}
            <div className="p-4 overflow-y-auto flex-1 space-y-4">

                {/* Project Pitch */}
                <div className="mb-2">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Project Pitch</label>
                    <div className="flex items-center gap-2">
                        <input type="number" className="flex-1 border p-2 rounded font-bold text-center"
                            value={buildingData.roofPitch || 4}
                            onChange={e => updateBuildingData({ roofPitch: parseFloat(e.target.value) || 0 })} />
                        <span className="text-gray-500 font-serif italic text-lg">/12</span>
                    </div>
                </div>

                {/* Phase 1: Draw Roof Planes */}
                <div className="mb-4">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">1. Draw Planes</p>
                    <button
                        onClick={() => activateMeasure('roof-plane')}
                        className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 py-2 rounded text-sm font-bold flex items-center justify-center gap-2 border border-blue-200 transition-colors"
                    >
                        <PenTool size={16} /> Trace Roof Plane
                    </button>
                    <p className="text-[10px] text-gray-500 mt-1 italic">Click corners to draw planes. Points will automatically snap to connect shared edges.</p>
                </div>

                {/* Phase 2: Classify Edges */}
                <div className="mb-4 bg-gray-50 border rounded-lg p-3">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">2. Classify Edges</p>

                    {!selectedRoofPlaneId || selectedRoofEdgeIndex === null ? (
                        <div className="text-center py-4 bg-white border border-dashed rounded text-gray-400 text-xs flex flex-col items-center">
                            <MousePointer size={20} className="mb-1 opacity-50" />
                            Click an edge of a roof plane<br />on the canvas to classify it
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="flex justify-between items-center text-xs bg-indigo-50 text-indigo-800 p-2 rounded font-bold border border-indigo-100">
                                <span>Edge Selected</span>
                                <button onClick={handleClearSelection} className="text-indigo-500 hover:text-indigo-700"><X size={14} /></button>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <button onClick={() => handleSetEdgeType('hip')} className="flex items-center justify-center p-2 border rounded bg-orange-50 hover:bg-orange-100 text-orange-800 text-sm font-bold transition-colors">
                                    <span className="w-1 h-1 rounded-full bg-orange-500 mr-2"></span> Hip
                                </button>
                                <button onClick={() => handleSetEdgeType('valley')} className="flex items-center justify-center p-2 border rounded bg-blue-50 hover:bg-blue-100 text-blue-800 text-sm font-bold transition-colors">
                                    <span className="1 h-1 rounded-full bg-blue-500 mr-2"></span> Valley
                                </button>
                                <button onClick={() => handleSetEdgeType('ridge')} className="flex items-center justify-center p-2 border rounded bg-green-50 hover:bg-green-100 text-green-800 text-sm font-bold transition-colors">
                                    <span className="w-1 h-1 rounded-full bg-green-500 mr-2"></span> Ridge
                                </button>
                                <button onClick={() => handleSetEdgeType('eave')} className="flex items-center justify-center p-2 border rounded bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm font-bold transition-colors">
                                    <span className="w-1 h-1 rounded-full bg-gray-600 mr-2"></span> Eave
                                </button>
                                <button onClick={() => handleSetEdgeType('gable')} className="flex items-center justify-center p-2 border rounded bg-purple-50 hover:bg-purple-100 text-purple-800 text-sm font-bold transition-colors col-span-2">
                                    <span className="w-1 h-1 rounded-full bg-purple-500 mr-2"></span> Gable
                                </button>
                                <button onClick={() => handleSetEdgeType('none')} className="flex items-center justify-center p-1.5 border border-dashed rounded hover:bg-gray-100 text-gray-500 text-xs transition-colors col-span-2 mt-1">
                                    Clear Classification
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Roof Totals */}
                <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Calculated Edge Totals</p>
                    <div className="bg-white p-2 rounded border text-xs space-y-1">
                        {[
                            { type: 'hip', label: 'True Hips', value: buildingData.roofHipLength, color: 'text-orange-600' },
                            { type: 'valley', label: 'True Valleys', value: buildingData.valleyLength, color: 'text-blue-600' },
                            { type: 'ridge', label: 'True Ridges', value: buildingData.roofRidgeLength, color: 'text-green-600' },
                            { type: 'eave', label: 'True Eaves', value: buildingData.roofEaveLength, color: 'text-gray-700' },
                            { type: 'gable', label: 'True Gables', value: buildingData.roofGableLength, color: 'text-purple-600' },
                        ].map(({ type, label, value, color }) => (
                            <div key={type} className="flex justify-between items-center py-0.5">
                                <span className={color}>{label}</span>
                                <b className="font-mono">{Math.round(value || 0)}'</b>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Dimension Form (fallback) */}
                {showDimForm && (
                    <div className="bg-gray-50 border border-gray-200 rounded p-3 space-y-2 mb-2">
                        <p className="text-[10px] text-gray-500 italic">Fallback: enter dimensions when no plan is available</p>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase">Plane Type</label>
                            <select value={dimShape} onChange={e => setDimShape(e.target.value as PlaneShape)}
                                className="w-full border p-1.5 rounded text-sm">
                                <option value="rectangle">Gable Plane (Eave = Ridge)</option>
                                <option value="triangle">Hip End (Triangle)</option>
                                <option value="trapezoid">Hip Side (Trapezoid)</option>
                                <option value="custom">Custom Area</option>
                            </select>
                        </div>

                        {dimShape === 'rectangle' && (
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[10px] text-gray-500">Eave Length (ft)</label>
                                    <input type="number" value={dimWidth} onChange={e => setDimWidth(parseFloat(e.target.value) || 0)}
                                        className="w-full border p-1.5 rounded text-sm" />
                                </div>
                                <div>
                                    <label className="block text-[10px] text-gray-500">Rafter Length (ft)</label>
                                    <input type="number" value={dimHeight} onChange={e => setDimHeight(parseFloat(e.target.value) || 0)}
                                        className="w-full border p-1.5 rounded text-sm" />
                                </div>
                            </div>
                        )}

                        {dimShape === 'triangle' && (
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[10px] text-gray-500">Eave Length (ft)</label>
                                    <input type="number" value={dimWidth} onChange={e => setDimWidth(parseFloat(e.target.value) || 0)}
                                        className="w-full border p-1.5 rounded text-sm" />
                                </div>
                                <div>
                                    <label className="block text-[10px] text-gray-500">Rafter Length (ft)</label>
                                    <input type="number" value={dimHeight} onChange={e => setDimHeight(parseFloat(e.target.value) || 0)}
                                        className="w-full border p-1.5 rounded text-sm" />
                                </div>
                            </div>
                        )}

                        {dimShape === 'trapezoid' && (
                            <div className="space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-[10px] text-gray-500">Ridge Length (ft)</label>
                                        <input type="number" value={dimTopBase} onChange={e => setDimTopBase(parseFloat(e.target.value) || 0)}
                                            className="w-full border p-1.5 rounded text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-gray-500">Eave Length (ft)</label>
                                        <input type="number" value={dimBottomBase} onChange={e => setDimBottomBase(parseFloat(e.target.value) || 0)}
                                            className="w-full border p-1.5 rounded text-sm" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] text-gray-500">Rafter Length (ft)</label>
                                    <input type="number" value={dimHeight} onChange={e => setDimHeight(parseFloat(e.target.value) || 0)}
                                        className="w-full border p-1.5 rounded text-sm" />
                                </div>
                            </div>
                        )}

                        {dimShape === 'custom' && (
                            <div>
                                <label className="block text-[10px] text-gray-500">Plan Area (sq ft)</label>
                                <input type="number" value={dimCustomArea} onChange={e => setDimCustomArea(parseFloat(e.target.value) || 0)}
                                    className="w-full border p-1.5 rounded text-sm" />
                            </div>
                        )}

                        <div>
                            <label className="block text-[10px] text-gray-500">Pitch</label>
                            <div className="flex items-center gap-1">
                                <input type="number" value={dimPitch} onChange={e => setDimPitch(parseFloat(e.target.value) || 0)}
                                    className="w-20 border p-1.5 rounded text-sm" />
                                <span className="text-xs text-gray-500">/12</span>
                            </div>
                        </div>

                        <div className="bg-white rounded p-2 text-[10px] border">
                            <div className="flex justify-between"><span>Plan Area:</span> <b>{Math.round(previewArea)} sf</b></div>
                            <div className="flex justify-between"><span>True Area:</span> <b>{Math.round(previewTrueArea)} sf</b></div>
                            <div className="flex justify-between text-gray-400"><span>Slope Factor:</span> <span>{getSlopeFactor(dimPitch).toFixed(4)}</span></div>
                        </div>

                        <div className="flex gap-2">
                            <button onClick={() => setShowDimForm(false)}
                                className="flex-1 text-gray-500 hover:text-gray-700 text-xs py-1.5 border rounded transition-colors">
                                Cancel
                            </button>
                            <button onClick={handleCreateFromDims}
                                className="flex-1 bg-teal-600 hover:bg-teal-700 text-white text-xs py-1.5 rounded font-bold transition-colors">
                                Create Plane
                            </button>
                        </div>
                    </div>
                )}

                {/* Plane List */}
                {roofPlanes.length > 0 && (
                    <div className="space-y-1">
                        {roofPlanes.map((plane: any) => (
                            <div key={plane.id} className="bg-indigo-50 border border-indigo-200 rounded p-2 flex items-center justify-between">
                                <div className="text-[10px]">
                                    <div className="font-bold text-indigo-800">{plane.name} <span className="text-gray-400 font-normal">{plane.pitch}/12</span></div>
                                    <div className="text-gray-500">Plan: {Math.round(plane.planArea)} sf &middot; True: {Math.round(plane.trueArea)} sf</div>
                                </div>
                                <button onClick={() => deleteMeasurement(plane.id)} className="text-red-400 hover:text-red-600 p-1">
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        ))}
                        <div className="bg-gray-100 rounded p-2 text-[10px] font-bold flex justify-between border">
                            <span>Total Plan: {Math.round(totalPlanArea)} sf</span>
                            <span>True: {Math.round(totalTrueArea)} sf</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-gray-50 border-t flex justify-end">
                <button
                    onClick={() => { handleClearSelection(); setWizardStep('none'); } }
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-bold shadow-sm"
                >
                    Close Wizard
                </button>
            </div>
        </div>
        </>
    );
};