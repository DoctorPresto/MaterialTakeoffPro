import React, { useState } from 'react';
import { useStore } from '../store';
import { Upload, Calculator, ArrowRight, SkipForward, PenTool, Activity, Minus, ArrowUpRight } from 'lucide-react';

const WizardStep = ({
                        title,
                        description,
                        isActive,
                        onNext,
                        onSkip,
                        children
                    }: {
    title: string,
    description: string,
    isActive: boolean,
    onNext: () => void,
    onSkip: () => void,
    children: React.ReactNode
}) => {
    if (!isActive) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="bg-blue-600 p-4 text-white">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        <Calculator size={20} /> Project Math Wizard: {title}
                    </h3>
                    <p className="text-blue-100 text-sm mt-1">{description}</p>
                </div>
                <div className="p-6 space-y-5">
                    {children}
                </div>
                <div className="bg-gray-50 p-4 border-t flex justify-between items-center">
                    <button onClick={onSkip} className="text-gray-500 text-sm hover:text-gray-700 font-medium flex items-center gap-1">
                        <SkipForward size={14} /> Skip Step
                    </button>
                    <button
                        onClick={onNext}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded font-bold shadow-sm flex items-center gap-2 transition-colors"
                    >
                        Next Step <ArrowRight size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};

const DataTab = () => {
    const {
        projectInfo, buildingData, measurements, updateProjectInfo, updateBuildingData, setWizardTool
    } = useStore();

    const [wizardStep, setWizardStep] = useState<'none' | 'profile' | 'foundation' | 'framing' | 'roof'>('none');

    const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                useStore.setState({pdfFile: reader.result as string});
                updateProjectInfo({files: [...projectInfo.files, file.name]});
            };
        }
    };

    const nextStep = () => {
        if (wizardStep === 'profile') setWizardStep('foundation');
        else if (wizardStep === 'foundation') setWizardStep('framing');
        else if (wizardStep === 'framing') setWizardStep('roof');
        else if (wizardStep === 'roof') setWizardStep('none');
    };

    const activateMeasure = (tool: string) => {
        setWizardTool(tool);
    };

    return (
        <div className="flex flex-col h-full w-full bg-gray-50 overflow-hidden relative">

            {/* --- WIZARD OVERLAYS --- */}

            <WizardStep
                title="Estimating Profile"
                description="Set the project baseline. This affects waste factors for lumber and siding."
                isActive={wizardStep === 'profile'}
                onNext={nextStep}
                onSkip={nextStep}
            >
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Builder Waste Profile</label>
                    <select
                        className="w-full border p-3 rounded text-sm bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none"
                        value={buildingData.wasteFactorProfile}
                        onChange={e => updateBuildingData({wasteFactorProfile: e.target.value as any})}
                    >
                        <option value="pro">Professional (Standard Waste)</option>
                        <option value="diy">DIY / High Waste (+5-10%)</option>
                    </select>
                </div>
            </WizardStep>

            <WizardStep
                title="Foundation Details"
                description="Link your drawing to the foundation calculations."
                isActive={wizardStep === 'foundation'}
                onNext={nextStep}
                onSkip={nextStep}
            >
                <div className="space-y-4">
                    <div className="p-4 border border-blue-200 bg-blue-50 rounded-lg flex items-center justify-between">
                        <div>
                            <span className="block text-sm font-bold text-blue-900">Define Foundation</span>
                            <span className="text-xs text-blue-700">Traces foundation line for perimeter/area</span>
                        </div>
                        <button
                            onClick={() => { activateMeasure('foundation'); }}
                            className="bg-white text-blue-600 border border-blue-200 hover:bg-blue-50 px-3 py-1.5 rounded text-sm font-bold shadow-sm flex items-center gap-2"
                        >
                            <PenTool size={14}/> Trace on Plan
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Wall Height (ft)</label>
                            <input type="number" className="w-full border p-2 rounded"
                                   value={buildingData.foundationWallHeight}
                                   onChange={e => updateBuildingData({foundationWallHeight: parseFloat(e.target.value) || 0})}/>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Corners (Count)</label>
                            <input type="number" className="w-full border p-2 rounded bg-gray-50"
                                   value={buildingData.foundationCorners}
                                   onChange={e => updateBuildingData({foundationCorners: parseFloat(e.target.value) || 0})}/>
                            <p className="text-[10px] text-gray-400">Auto-counted from points</p>
                        </div>
                    </div>
                </div>
            </WizardStep>

            <WizardStep
                title="Roof System Breakdown"
                description="Categorize lines by type to apply correct slope and hip factors."
                isActive={wizardStep === 'roof'}
                onNext={nextStep}
                onSkip={nextStep}
            >
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 mb-2">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Project Pitch</label>
                            <div className="flex items-center gap-1">
                                <input type="number" className="w-full border p-2 rounded font-bold"
                                       value={buildingData.roofPitch}
                                       onChange={e => updateBuildingData({roofPitch: parseFloat(e.target.value) || 0})}/>
                                <span className="text-gray-500 font-serif italic">/12</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => activateMeasure('roof-hip')} className="flex flex-col items-center justify-center p-3 border rounded bg-orange-50 hover:bg-orange-100 border-orange-200 text-orange-800 gap-1 transition-colors">
                            <Activity size={20}/>
                            <span className="text-xs font-bold">Trace Hip</span>
                        </button>
                        <button onClick={() => activateMeasure('roof-valley')} className="flex flex-col items-center justify-center p-3 border rounded bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-800 gap-1 transition-colors">
                            <Activity size={20} className="rotate-180"/>
                            <span className="text-xs font-bold">Trace Valley</span>
                        </button>
                        <button onClick={() => activateMeasure('roof-ridge')} className="flex flex-col items-center justify-center p-3 border rounded bg-green-50 hover:bg-green-100 border-green-200 text-green-800 gap-1 transition-colors">
                            <Minus size={20}/>
                            <span className="text-xs font-bold">Trace Ridge</span>
                        </button>
                        <button onClick={() => activateMeasure('roof-gable')} className="flex flex-col items-center justify-center p-3 border rounded bg-purple-50 hover:bg-purple-100 border-purple-200 text-purple-800 gap-1 transition-colors">
                            <ArrowUpRight size={20}/>
                            <span className="text-xs font-bold">Trace Gable</span>
                        </button>
                        <button onClick={() => activateMeasure('roof-eave')} className="flex flex-col items-center justify-center p-3 border rounded bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-800 gap-1 transition-colors">
                            <Minus size={20}/>
                            <span className="text-xs font-bold">Trace Eave</span>
                        </button>
                    </div>

                    <div className="bg-gray-50 p-2 rounded border text-xs text-gray-500 mt-2">
                        <ul className="space-y-1">
                            <li className="flex justify-between"><span>Hip Length:</span> <span className="font-mono font-bold text-gray-800">{Math.round(buildingData.roofHipLength)} ft</span></li>
                            <li className="flex justify-between"><span>Valley Length:</span> <span className="font-mono font-bold text-gray-800">{Math.round(buildingData.valleyLength)} ft</span></li>
                            <li className="flex justify-between"><span>Ridge Length:</span> <span className="font-mono font-bold text-gray-800">{Math.round(buildingData.roofRidgeLength)} ft</span></li>
                        </ul>
                    </div>
                </div>
            </WizardStep>


            {/* --- MAIN UI --- */}

            <div className="h-12 bg-white border-b flex items-center px-4 justify-between shadow-sm shrink-0">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Project Basic Data</span>
                <div className="flex gap-2">
                    <button
                        onClick={() => setWizardStep('profile')}
                        className="flex items-center gap-2 bg-green-600 text-white px-3 py-1.5 rounded text-sm hover:bg-green-700 font-bold shadow-sm transition-all"
                    >
                        <Calculator size={16}/> Start Wizard
                    </button>
                    <label className="flex items-center gap-2 cursor-pointer bg-blue-50 text-blue-700 px-3 py-1.5 rounded text-sm hover:bg-blue-100 font-medium transition-all">
                        <Upload size={16}/> <span>Load PDF</span>
                        <input type="file" accept="application/pdf" className="hidden" onChange={handlePdfUpload}/>
                    </label>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-4 w-full">
                <div className="max-w-4xl mx-auto space-y-6">

                    {/* Project Header */}
                    <div className="bg-white p-6 rounded-lg shadow-sm border">
                        <h2 className="text-lg font-bold mb-4 border-b pb-2">Project Information</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Project Name</label>
                                <input className="w-full border p-2 rounded" value={projectInfo.projectName} onChange={e => updateProjectInfo({projectName: e.target.value})}/>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Customer Name</label>
                                <input className="w-full border p-2 rounded" value={projectInfo.customerName} onChange={e => updateProjectInfo({customerName: e.target.value})}/>
                            </div>
                            <div className="col-span-1 md:col-span-2">
                                <label className="block text-xs font-bold text-gray-500 mb-1">Notes</label>
                                <textarea className="w-full border p-2 rounded h-20" value={projectInfo.notes} onChange={e => updateProjectInfo({notes: e.target.value})}/>
                            </div>
                        </div>
                    </div>

                    {/* BASIC DATA: FOUNDATION */}
                    <div className="bg-white p-6 rounded-lg shadow-sm border group hover:border-blue-300 transition-colors">
                        <div className="flex justify-between items-center border-b pb-2 mb-4">
                            <h2 className="text-lg font-bold text-gray-700">1. Foundation Data</h2>
                            <button onClick={() => activateMeasure('foundation')} className="text-blue-600 text-xs font-bold hover:underline flex items-center gap-1">
                                <PenTool size={12}/> Trace Now
                            </button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="col-span-2 md:col-span-2">
                                <label className="block text-xs font-bold text-gray-500 mb-1">Foundation Measurement</label>
                                <select className="w-full border p-2 rounded text-sm bg-gray-50"
                                        value={buildingData.foundationAreaId || ""}
                                        onChange={e => updateBuildingData({
                                            foundationAreaId: e.target.value,
                                            foundationPerimeterId: e.target.value
                                        })}>
                                    <option value="">(None)</option>
                                    {measurements.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Wall Height (ft)</label>
                                <input type="number" className="w-full border p-2 rounded text-sm"
                                       value={buildingData.foundationWallHeight}
                                       onChange={e => updateBuildingData({foundationWallHeight: parseFloat(e.target.value) || 0})}/>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Corners (Count)</label>
                                <input type="number" className="w-full border p-2 rounded text-sm"
                                       value={buildingData.foundationCorners}
                                       onChange={e => updateBuildingData({foundationCorners: parseFloat(e.target.value) || 0})}/>
                            </div>
                        </div>
                    </div>

                    {/* BASIC DATA: FRAMING */}
                    <div className="bg-white p-6 rounded-lg shadow-sm border group hover:border-blue-300 transition-colors">
                        <h2 className="text-lg font-bold mb-4 border-b pb-2 text-gray-700">2. Main Floor & Framing</h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Perimeter (LF)</label>
                                <input type="number" className="w-full border p-2 rounded text-sm bg-gray-50"
                                       value={buildingData.mainFloorPerimeter}
                                       onChange={e => updateBuildingData({mainFloorPerimeter: parseFloat(e.target.value) || 0})}/>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Gross Wall Area (SF)</label>
                                <input type="number" className="w-full border p-2 rounded text-sm bg-gray-50"
                                       value={buildingData.mainFloorGrossWallArea}
                                       onChange={e => updateBuildingData({mainFloorGrossWallArea: parseFloat(e.target.value) || 0})}/>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Net Wall Area (SF)</label>
                                <input type="number" className="w-full border p-2 rounded text-sm"
                                       value={buildingData.mainFloorNetWallArea}
                                       onChange={e => updateBuildingData({mainFloorNetWallArea: parseFloat(e.target.value) || 0})}/>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border-t pt-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Ext. Corners</label>
                                <input type="number" className="w-full border p-2 rounded text-sm"
                                       value={buildingData.mainFloorCorners}
                                       onChange={e => updateBuildingData({mainFloorCorners: parseFloat(e.target.value) || 0})}/>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Wall Intersections</label>
                                <input type="number" className="w-full border p-2 rounded text-sm"
                                       value={buildingData.mainFloorIntersections}
                                       onChange={e => updateBuildingData({mainFloorIntersections: parseFloat(e.target.value) || 0})}/>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Int. Wall (2x4) LF</label>
                                <input type="number" className="w-full border p-2 rounded text-sm"
                                       value={buildingData.mainFloorIntWallLength4}
                                       onChange={e => updateBuildingData({mainFloorIntWallLength4: parseFloat(e.target.value) || 0})}/>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Int. Wall (2x6) LF</label>
                                <input type="number" className="w-full border p-2 rounded text-sm"
                                       value={buildingData.mainFloorIntWallLength6}
                                       onChange={e => updateBuildingData({mainFloorIntWallLength6: parseFloat(e.target.value) || 0})}/>
                            </div>
                        </div>
                    </div>

                    {/* BASIC DATA: ROOF */}
                    <div className="bg-white p-6 rounded-lg shadow-sm border group hover:border-blue-300 transition-colors">
                        <div className="flex justify-between items-center border-b pb-2 mb-4">
                            <h2 className="text-lg font-bold text-gray-700">3. Roof System (Line Method)</h2>
                            <div className="flex gap-2">
                                <button onClick={() => activateMeasure('roof-hip')} className="text-orange-600 text-xs font-bold hover:underline flex items-center gap-1"><Activity size={12}/> Hip</button>
                                <button onClick={() => activateMeasure('roof-valley')} className="text-blue-600 text-xs font-bold hover:underline flex items-center gap-1"><Activity size={12}/> Valley</button>
                                <button onClick={() => activateMeasure('roof-ridge')} className="text-green-600 text-xs font-bold hover:underline flex items-center gap-1"><Minus size={12}/> Ridge</button>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Primary Pitch (x/12)</label>
                                <input type="number" className="w-full border p-2 rounded text-sm font-bold text-blue-600"
                                       value={buildingData.roofPitch}
                                       onChange={e => updateBuildingData({roofPitch: parseFloat(e.target.value) || 0})}/>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Number of Pitches</label>
                                <input type="number" className="w-full border p-2 rounded text-sm"
                                       value={buildingData.numPitches}
                                       onChange={e => updateBuildingData({numPitches: parseFloat(e.target.value) || 0})}/>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Ridge Length (LF)</label>
                                <input type="number" className="w-full border p-2 rounded text-sm"
                                       value={Math.round(buildingData.roofRidgeLength * 10) / 10}
                                       onChange={e => updateBuildingData({roofRidgeLength: parseFloat(e.target.value) || 0})}/>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Hip Length (LF)</label>
                                <input type="number" className="w-full border p-2 rounded text-sm"
                                       value={Math.round(buildingData.roofHipLength * 10) / 10}
                                       onChange={e => updateBuildingData({roofHipLength: parseFloat(e.target.value) || 0})}/>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Valley Length (LF)</label>
                                <input type="number" className="w-full border p-2 rounded text-sm"
                                       value={Math.round(buildingData.valleyLength * 10) / 10}
                                       onChange={e => updateBuildingData({valleyLength: parseFloat(e.target.value) || 0})}/>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Eave Length (LF)</label>
                                <input type="number" className="w-full border p-2 rounded text-sm"
                                       value={Math.round(buildingData.roofEaveLength * 10) / 10}
                                       onChange={e => updateBuildingData({roofEaveLength: parseFloat(e.target.value) || 0})}/>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Gable/Rake (LF)</label>
                                <input type="number" className="w-full border p-2 rounded text-sm"
                                       value={Math.round(buildingData.roofGableLength * 10) / 10}
                                       onChange={e => updateBuildingData({roofGableLength: parseFloat(e.target.value) || 0})}/>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DataTab;