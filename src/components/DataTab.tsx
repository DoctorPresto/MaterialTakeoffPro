import React from 'react';
import { useStore } from '../store';
import { Upload, Calculator } from 'lucide-react';

const DataTab = () => {
    const {
        projectInfo, buildingData, measurements, updateProjectInfo, updateBuildingData, setWizardStep
    } = useStore();

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

    return (
        <div className="flex flex-col h-full w-full bg-gray-50 overflow-hidden relative">
            {/* --- MAIN UI --- */}

            <div className="h-12 bg-white border-b flex items-center px-4 justify-between shadow-sm shrink-0">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Project Basic Data</span>
                <div className="flex gap-2">
                    <button
                        onClick={() => setWizardStep('roof')}
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
                            <span className="text-xs text-gray-400">Use Wizard to trace</span>
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
                            <span className="text-xs text-gray-400">Use Wizard to trace</span>
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