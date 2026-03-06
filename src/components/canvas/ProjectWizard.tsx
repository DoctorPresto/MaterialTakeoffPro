import { useState, useMemo } from 'react';
import { useStore } from '../../store';
import {
    Calculator, PenTool, Activity, Minus,
    ArrowUpRight, X, Plus, Trash2, MousePointer, AlertCircle, Check,
    ChevronDown, ChevronUp,
} from 'lucide-react';
import { computeShapeArea, computeTrueArea, getSlopeFactor } from '../../utils/roofOutline';
import { getPolygonArea, getPathLength } from '../../utils/math';

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
        createPlaneFromLines,
        addRoofPlaneFromDimensions,
        deleteMeasurement,
        scale,
        pageScales,
        activePageIndex,
        planeBuilderActive,
        planeBuilderSelectedIds,
        togglePlaneBuilderLine,
        clearPlaneBuilder,
        setPlaneBuilderActive,
    } = useStore();

    const hasRoofType = (type: string) => measurements.some(m => m.roofLineType === type);

    const [buildError, setBuildError] = useState<string | null>(null);

    // ─── Dimension form fallback state ──────────────────────────
    const [showDimForm, setShowDimForm] = useState(false);
    const [dimShape, setDimShape] = useState<PlaneShape>('rectangle');
    const [dimWidth, setDimWidth] = useState(24);
    const [dimHeight, setDimHeight] = useState(12);
    const [dimTopBase, setDimTopBase] = useState(8);
    const [dimBottomBase, setDimBottomBase] = useState(16);
    const [dimCustomArea, setDimCustomArea] = useState(400);
    const [dimPitch, setDimPitch] = useState(buildingData.roofPitch || 4);

    // ─── All roof lines (across ALL pages) ──────────────────────
    const roofLines = useMemo(() =>
        measurements.filter(m => m.roofLineType && m.type === 'line'),
        [measurements]
    );

    // ─── Roof planes ────────────────────────────────────────────
    const roofPlanes = useMemo(() => {
        return measurements
            .filter(m => m.roofPlaneIndex && m.type === 'shape')
            .map(m => {
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
            .sort((a, b) => a.index - b.index);
    }, [measurements, scale, pageScales]);

    const totalPlanArea = roofPlanes.reduce((s, p) => s + p.planArea, 0);
    const totalTrueArea = roofPlanes.reduce((s, p) => s + p.trueArea, 0);

    // ─── Selected lines summary ─────────────────────────────────
    const selectedSummary = useMemo(() => {
        let eaveFt = 0, ridgeFt = 0, rafterFt = 0, rafterCount = 0;
        planeBuilderSelectedIds.forEach(id => {
            const m = measurements.find(m => m.id === id);
            if (!m) return;
            const effectiveScale = pageScales[m.pageIndex] || scale;
            const len = getPathLength(m.points) / effectiveScale;
            const type = m.roofLineType || 'eave';
            if (type === 'eave') eaveFt += len;
            else if (type === 'ridge') ridgeFt += len;
            else { rafterFt += len; rafterCount++; }
        });
        const avgRafter = rafterCount > 0 ? rafterFt / rafterCount : 0;
        let shapeLabel = '';
        let area = 0;
        if (ridgeFt > 0 && eaveFt > 0 && Math.abs(ridgeFt - eaveFt) < 1) {
            shapeLabel = 'Gable Plane';
            area = eaveFt * avgRafter;
        } else if (ridgeFt > 0 && eaveFt > 0) {
            shapeLabel = 'Hip Side';
            area = ((ridgeFt + eaveFt) / 2) * avgRafter;
        } else if (eaveFt > 0 && ridgeFt === 0) {
            shapeLabel = 'Hip End';
            area = (eaveFt * avgRafter) / 2;
        }
        return { eaveFt, ridgeFt, avgRafter, shapeLabel, area };
    }, [planeBuilderSelectedIds, measurements, scale, pageScales]);

    // ─── Handlers ───────────────────────────────────────────────
    const handleStartSelectLines = () => {
        setPlaneBuilderActive(true);
        setBuildError(null);
        setShowDimForm(false);
    };

    const handleCancelSelectLines = () => {
        clearPlaneBuilder();
        setBuildError(null);
    };

    const handleBuildPlane = () => {
        if (planeBuilderSelectedIds.length < 3) {
            setBuildError('Select at least 3 roof lines.');
            return;
        }
        const success = createPlaneFromLines(planeBuilderSelectedIds);
        if (success) {
            setPlaneBuilderActive(true);
            setBuildError(null);
        } else {
            setBuildError('Could not compute plane area. Make sure you have eave + ridge/rafter lines.');
        }
    };

    const handleToggleLine = (id: string) => {
        togglePlaneBuilderLine(id);
        setBuildError(null);
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
        handleCancelSelectLines();
        setWizardTool(tool);
    };

    // ─── Early exits ────────────────────────────────────────────
    if (activeWizardStep === 'none') return null;

    const isMeasuring = !!activeWizardTool;

    // Tracing Mode Banner
    if (isMeasuring) {
        return (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-6 py-3 rounded-full shadow-lg z-50 flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
                <span className="font-bold flex items-center gap-2">
                    <PenTool size={18} />
                    {activeWizardTool === 'roof-hip' && "Tracing Hip Line..."}
                    {activeWizardTool === 'roof-valley' && "Tracing Valley Line..."}
                    {activeWizardTool === 'roof-ridge' && "Tracing Ridge Line..."}
                    {activeWizardTool === 'roof-eave' && "Tracing Eave Line..."}
                    {activeWizardTool === 'roof-gable' && "Tracing Gable Line..."}
                </span>
                <div className="h-4 w-px bg-blue-400"></div>
                <button
                    onClick={() => setWizardTool(null)}
                    className="bg-white text-blue-600 hover:bg-blue-50 rounded-full px-3 py-1 text-xs font-bold transition-colors"
                >
                    Done
                </button>
            </div>
        );
    }

    return (
        <div className="absolute top-4 right-4 w-80 bg-white rounded-xl shadow-2xl z-50 border border-gray-200 overflow-hidden flex flex-col max-h-[calc(100vh-2rem)] animate-in slide-in-from-right-4">
            {/* Header */}
            <div className="bg-blue-600 p-4 text-white flex justify-between items-start">
                <div>
                    <h3 className="font-bold flex items-center gap-2">
                        <Calculator size={18} /> Roof Wizard
                    </h3>
                    <p className="text-blue-100 text-xs mt-1">Define roof lines and planes</p>
                </div>
                <button onClick={() => { handleCancelSelectLines(); setWizardStep('none'); }} className="text-blue-200 hover:text-white">
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
                               onChange={e => updateBuildingData({roofPitch: parseFloat(e.target.value) || 0})}/>
                        <span className="text-gray-500 font-serif italic text-lg">/12</span>
                    </div>
                </div>

                {/* Phase 1: Trace Lines */}
                <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Phase 1 — Trace Lines</p>
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => activateMeasure('roof-hip')} className="flex flex-col items-center p-2 border rounded bg-orange-50 hover:bg-orange-100 text-orange-800 text-xs font-bold transition-colors">
                            <Activity size={16} className="mb-1"/> Hip
                        </button>
                        <button onClick={() => activateMeasure('roof-valley')} className="flex flex-col items-center p-2 border rounded bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-bold transition-colors">
                            <Activity size={16} className="rotate-180 mb-1"/> Valley
                        </button>
                        <button onClick={() => activateMeasure('roof-ridge')} className="flex flex-col items-center p-2 border rounded bg-green-50 hover:bg-green-100 text-green-800 text-xs font-bold transition-colors">
                            <Minus size={16} className="mb-1"/> Ridge
                        </button>
                        <button onClick={() => activateMeasure('roof-eave')} className="flex flex-col items-center p-2 border rounded bg-gray-50 hover:bg-gray-100 text-gray-800 text-xs font-bold transition-colors">
                            <Minus size={16} className="mb-1"/> Eave
                        </button>
                        <button onClick={() => activateMeasure('roof-gable')} className="flex flex-col items-center p-2 border rounded bg-purple-50 hover:bg-purple-100 text-purple-800 text-xs font-bold transition-colors">
                            <ArrowUpRight size={16} className="mb-1"/> Gable
                        </button>
                    </div>

                    {/* Line totals */}
                    <div className="bg-gray-50 p-2 rounded border text-[10px] space-y-1 mt-2">
                        {[
                            { type: 'hip', label: 'Hip', value: buildingData.roofHipLength, activeColor: 'bg-orange-500' },
                            { type: 'valley', label: 'Valley', value: buildingData.valleyLength, activeColor: 'bg-blue-500' },
                            { type: 'ridge', label: 'Ridge', value: buildingData.roofRidgeLength, activeColor: 'bg-green-500' },
                            { type: 'eave', label: 'Eave', value: buildingData.roofEaveLength, activeColor: 'bg-gray-600' },
                            { type: 'gable', label: 'Gable', value: buildingData.roofGableLength, activeColor: 'bg-purple-500' },
                        ].map(({ type, label, value, activeColor }) => (
                            <div key={type} className="flex justify-between items-center">
                                <span className="flex items-center gap-1">
                                    <span className={`w-2 h-2 rounded-full ${hasRoofType(type) ? activeColor : 'bg-gray-300'}`}></span>
                                    {label}:
                                </span>
                                <b>{Math.round(value || 0)}'</b>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Phase 2: Define Planes */}
                <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Phase 2 — Define Planes</p>

                    {!planeBuilderActive ? (
                        <div className="flex gap-2 mb-2">
                            <button
                                onClick={handleStartSelectLines}
                                disabled={roofLines.length < 3}
                                className="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 py-2 rounded text-xs font-bold flex items-center justify-center gap-1 border border-indigo-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <MousePointer size={12}/> Create Plane
                            </button>
                            <button
                                onClick={() => { setShowDimForm(!showDimForm); setDimPitch(buildingData.roofPitch || 4); }}
                                className="bg-gray-50 hover:bg-gray-100 text-gray-600 py-2 px-2 rounded text-xs flex items-center justify-center gap-1 border border-gray-200 transition-colors"
                                title="Add from dimensions (no plan)"
                            >
                                {showDimForm ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                                <Plus size={10}/>
                            </button>
                        </div>
                    ) : (
                        <div className="bg-indigo-50 border border-indigo-200 rounded p-3 space-y-2 mb-2">
                            <p className="text-[10px] text-indigo-700 font-bold">
                                <MousePointer size={10} className="inline mr-1"/>
                                Select the roof lines that bound this plane
                            </p>

                            {roofLines.length > 0 && (
                                <div className="space-y-1 max-h-40 overflow-y-auto">
                                    {roofLines.map(m => {
                                        const isSelected = planeBuilderSelectedIds.includes(m.id);
                                        const effectiveScale = pageScales[m.pageIndex] || scale;
                                        const lengthFt = Math.round(getPathLength(m.points) / effectiveScale);
                                        return (
                                            <button
                                                key={m.id}
                                                onClick={() => handleToggleLine(m.id)}
                                                className={`w-full text-left text-[10px] px-2 py-1.5 rounded border transition-colors flex items-center gap-1 ${
                                                    isSelected
                                                        ? 'bg-indigo-100 border-indigo-300 text-indigo-800 font-bold'
                                                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                                }`}
                                            >
                                                {isSelected && <Check size={10} className="text-indigo-600 flex-shrink-0"/>}
                                                <span className="truncate">{m.name || m.id.slice(0, 8)}</span>
                                                <span className="ml-auto text-gray-400 flex-shrink-0 flex items-center gap-1">
                                                    <span>{m.roofLineType}</span>
                                                    <span className="font-mono">{lengthFt}'</span>
                                                    {m.pageIndex !== activePageIndex && <span className="text-[8px] text-orange-500">p{m.pageIndex + 1}</span>}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {planeBuilderSelectedIds.length >= 3 && selectedSummary.area > 0 && (
                                <div className="bg-white rounded p-2 text-[10px] border space-y-0.5">
                                    <div className="font-bold text-indigo-700">{selectedSummary.shapeLabel || 'Plane'}</div>
                                    <div className="flex justify-between"><span>Eave:</span> <b>{Math.round(selectedSummary.eaveFt)}'</b></div>
                                    {selectedSummary.ridgeFt > 0 && <div className="flex justify-between"><span>Ridge:</span> <b>{Math.round(selectedSummary.ridgeFt)}'</b></div>}
                                    <div className="flex justify-between"><span>Avg Rafter:</span> <b>{Math.round(selectedSummary.avgRafter)}'</b></div>
                                    <div className="flex justify-between border-t pt-0.5 mt-0.5"><span>Plan Area:</span> <b>{Math.round(selectedSummary.area)} sf</b></div>
                                </div>
                            )}

                            {buildError && (
                                <div className="text-[10px] text-red-600 bg-red-50 rounded p-1.5 flex items-start gap-1 border border-red-200">
                                    <AlertCircle size={10} className="mt-0.5 flex-shrink-0"/>
                                    {buildError}
                                </div>
                            )}

                            <div className="flex gap-2">
                                <button onClick={handleCancelSelectLines} className="flex-1 text-gray-500 hover:text-gray-700 text-xs py-1.5 border rounded transition-colors">
                                    Done
                                </button>
                                <button
                                    onClick={handleBuildPlane}
                                    disabled={planeBuilderSelectedIds.length < 3}
                                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs py-1.5 rounded font-bold transition-colors flex items-center justify-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <Check size={10}/> Build Plane
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Dimension Form (fallback) */}
                    {showDimForm && !planeBuilderActive && (
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
                                               className="w-full border p-1.5 rounded text-sm"/>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-gray-500">Rafter Length (ft)</label>
                                        <input type="number" value={dimHeight} onChange={e => setDimHeight(parseFloat(e.target.value) || 0)}
                                               className="w-full border p-1.5 rounded text-sm"/>
                                    </div>
                                </div>
                            )}

                            {dimShape === 'triangle' && (
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-[10px] text-gray-500">Eave Length (ft)</label>
                                        <input type="number" value={dimWidth} onChange={e => setDimWidth(parseFloat(e.target.value) || 0)}
                                               className="w-full border p-1.5 rounded text-sm"/>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-gray-500">Rafter Length (ft)</label>
                                        <input type="number" value={dimHeight} onChange={e => setDimHeight(parseFloat(e.target.value) || 0)}
                                               className="w-full border p-1.5 rounded text-sm"/>
                                    </div>
                                </div>
                            )}

                            {dimShape === 'trapezoid' && (
                                <div className="space-y-2">
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-[10px] text-gray-500">Ridge Length (ft)</label>
                                            <input type="number" value={dimTopBase} onChange={e => setDimTopBase(parseFloat(e.target.value) || 0)}
                                                   className="w-full border p-1.5 rounded text-sm"/>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] text-gray-500">Eave Length (ft)</label>
                                            <input type="number" value={dimBottomBase} onChange={e => setDimBottomBase(parseFloat(e.target.value) || 0)}
                                                   className="w-full border p-1.5 rounded text-sm"/>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-gray-500">Rafter Length (ft)</label>
                                        <input type="number" value={dimHeight} onChange={e => setDimHeight(parseFloat(e.target.value) || 0)}
                                               className="w-full border p-1.5 rounded text-sm"/>
                                    </div>
                                </div>
                            )}

                            {dimShape === 'custom' && (
                                <div>
                                    <label className="block text-[10px] text-gray-500">Plan Area (sq ft)</label>
                                    <input type="number" value={dimCustomArea} onChange={e => setDimCustomArea(parseFloat(e.target.value) || 0)}
                                           className="w-full border p-1.5 rounded text-sm"/>
                                </div>
                            )}

                            <div>
                                <label className="block text-[10px] text-gray-500">Pitch</label>
                                <div className="flex items-center gap-1">
                                    <input type="number" value={dimPitch} onChange={e => setDimPitch(parseFloat(e.target.value) || 0)}
                                           className="w-20 border p-1.5 rounded text-sm"/>
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
                            {roofPlanes.map(plane => (
                                <div key={plane.id} className="bg-indigo-50 border border-indigo-200 rounded p-2 flex items-center justify-between">
                                    <div className="text-[10px]">
                                        <div className="font-bold text-indigo-800">{plane.name} <span className="text-gray-400 font-normal">{plane.pitch}/12</span></div>
                                        <div className="text-gray-500">Plan: {Math.round(plane.planArea)} sf &middot; True: {Math.round(plane.trueArea)} sf</div>
                                    </div>
                                    <button onClick={() => deleteMeasurement(plane.id)} className="text-red-400 hover:text-red-600 p-1">
                                        <Trash2 size={12}/>
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

            </div>

            {/* Footer — just a close button */}
            <div className="p-4 bg-gray-50 border-t flex justify-end">
                <button
                    onClick={() => { handleCancelSelectLines(); setWizardStep('none'); }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-bold shadow-sm"
                >
                    Close Wizard
                </button>
            </div>
        </div>
    );
};