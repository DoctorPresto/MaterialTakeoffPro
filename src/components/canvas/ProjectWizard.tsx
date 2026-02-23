import React from 'react';
import { useStore } from '../../store';
import { Calculator, ArrowRight, SkipForward, PenTool, Activity, Minus, ArrowUpRight, X } from 'lucide-react';

export const ProjectWizard = () => {
    const {
        activeWizardStep,
        setWizardStep,
        buildingData,
        updateBuildingData,
        setWizardTool,
        activeWizardTool
    } = useStore();

    if (activeWizardStep === 'none') return null;

    const nextStep = () => {
        if (activeWizardStep === 'profile') setWizardStep('foundation');
        else if (activeWizardStep === 'foundation') setWizardStep('framing');
        else if (activeWizardStep === 'framing') setWizardStep('roof');
        else if (activeWizardStep === 'roof') setWizardStep('none');
    };

    const activateMeasure = (tool: string) => {
        setWizardTool(tool);
    };

    const isMeasuring = !!activeWizardTool;

    if (isMeasuring) {
        return (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-6 py-3 rounded-full shadow-lg z-50 flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
                <span className="font-bold flex items-center gap-2">
                    <PenTool size={18} />
                    {activeWizardTool === 'foundation' && "Tracing Foundation..."}
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
                        <Calculator size={18} /> Project Wizard
                    </h3>
                    <p className="text-blue-100 text-xs mt-1">
                        {activeWizardStep === 'profile' && "Step 1: Setup Profile"}
                        {activeWizardStep === 'foundation' && "Step 2: Foundation"}
                        {activeWizardStep === 'framing' && "Step 3: Framing"}
                        {activeWizardStep === 'roof' && "Step 4: Roof System"}
                    </p>
                </div>
                <button onClick={() => setWizardStep('none')} className="text-blue-200 hover:text-white">
                    <X size={18} />
                </button>
            </div>

            {/* Content Body */}
            <div className="p-4 overflow-y-auto flex-1 space-y-4">

                {/* PROFILE STEP */}
                {activeWizardStep === 'profile' && (
                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">Builder Waste Profile</label>
                            <select
                                className="w-full border p-2 rounded text-sm"
                                value={buildingData.wasteFactorProfile || 'pro'}
                                onChange={e => updateBuildingData({wasteFactorProfile: e.target.value as any})}
                            >
                                <option value="pro">Professional (Standard Waste)</option>
                                <option value="diy">DIY / High Waste (+5-10%)</option>
                            </select>
                            <p className="text-xs text-gray-400 mt-1">Adjusts waste factors for lumber.</p>
                        </div>
                    </div>
                )}

                {/* FOUNDATION STEP */}
                {activeWizardStep === 'foundation' && (
                    <div className="space-y-4">
                        <div className="bg-blue-50 border border-blue-200 rounded p-3 text-center">
                            <button
                                onClick={() => activateMeasure('foundation')}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded text-sm font-bold flex items-center justify-center gap-2 transition-colors"
                            >
                                <PenTool size={14}/> Trace Foundation
                            </button>
                            <p className="text-[10px] text-blue-600 mt-2">Draw the perimeter on the plan.</p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase">Wall Height</label>
                                <input type="number" className="w-full border p-1.5 rounded text-sm"
                                       value={buildingData.foundationWallHeight || 0}
                                       onChange={e => updateBuildingData({foundationWallHeight: parseFloat(e.target.value) || 0})}/>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase">Corners</label>
                                <input type="number" className="w-full border p-1.5 rounded text-sm bg-gray-50"
                                       value={buildingData.foundationCorners || 0}
                                       readOnly/>
                            </div>
                        </div>
                    </div>
                )}

                {/* FRAMING STEP */}
                {activeWizardStep === 'framing' && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-3">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase">Gross Wall Area (SF)</label>
                                <input type="number" className="w-full border p-2 rounded text-sm"
                                       value={buildingData.mainFloorGrossWallArea || 0}
                                       onChange={e => updateBuildingData({mainFloorGrossWallArea: parseFloat(e.target.value) || 0})}/>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase">Ext. Corners</label>
                                    <input type="number" className="w-full border p-1.5 rounded text-sm"
                                           value={buildingData.mainFloorCorners || 0}
                                           onChange={e => updateBuildingData({mainFloorCorners: parseFloat(e.target.value) || 0})}/>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase">Intersections</label>
                                    <input type="number" className="w-full border p-1.5 rounded text-sm"
                                           value={buildingData.mainFloorIntersections || 0}
                                           onChange={e => updateBuildingData({mainFloorIntersections: parseFloat(e.target.value) || 0})}/>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ROOF STEP */}
                {activeWizardStep === 'roof' && (
                    <div className="space-y-4">
                        <div className="mb-2">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Project Pitch</label>
                            <div className="flex items-center gap-2">
                                <input type="number" className="flex-1 border p-2 rounded font-bold text-center"
                                       value={buildingData.roofPitch || 4}
                                       onChange={e => updateBuildingData({roofPitch: parseFloat(e.target.value) || 0})}/>
                                <span className="text-gray-500 font-serif italic text-lg">/12</span>
                            </div>
                        </div>

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

                        <div className="bg-gray-50 p-2 rounded border text-[10px] space-y-1">
                            <div className="flex justify-between"><span>Hip:</span> <b>{Math.round(buildingData.roofHipLength || 0)}'</b></div>
                            <div className="flex justify-between"><span>Valley:</span> <b>{Math.round(buildingData.valleyLength || 0)}'</b></div>
                            <div className="flex justify-between"><span>Ridge:</span> <b>{Math.round(buildingData.roofRidgeLength || 0)}'</b></div>
                        </div>
                    </div>
                )}

            </div>

            {/* Footer */}
            <div className="p-4 bg-gray-50 border-t flex justify-between">
                <button onClick={nextStep} className="text-gray-500 text-sm hover:text-gray-700 flex items-center gap-1">
                    <SkipForward size={14} /> Skip
                </button>
                <button
                    onClick={nextStep}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-bold shadow-sm flex items-center gap-2"
                >
                    {activeWizardStep === 'roof' ? 'Finish' : 'Next Step'} <ArrowRight size={14} />
                </button>
            </div>
        </div>
    );
};