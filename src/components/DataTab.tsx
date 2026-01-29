import React from 'react';
import {useStore} from '../store';
import {FileText, Upload} from 'lucide-react';

const DataTab = () => {
    const {
        projectInfo, buildingData, measurements, updateProjectInfo, updateBuildingData
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
        <div className="flex flex-col h-full w-full bg-gray-50 overflow-hidden">
            <div className="h-12 bg-white border-b flex items-center px-4 justify-between shadow-sm shrink-0">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Project Data</span>
                <label
                    className="flex items-center gap-2 cursor-pointer bg-blue-50 text-blue-700 px-3 py-1.5 rounded text-sm hover:bg-blue-100 font-medium">
                    <Upload size={16}/> <span>Load PDF</span>
                    <input type="file" accept="application/pdf" className="hidden" onChange={handlePdfUpload}/>
                </label>
            </div>

            <div className="flex-1 overflow-auto p-4 w-full">
                <div className="max-w-full w-full space-y-6">
                    <div className="bg-white p-6 rounded-lg shadow-sm border">
                        <h2 className="text-lg font-bold mb-4 border-b pb-2">Project Information</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Project Name</label>
                                <input className="w-full border p-2 rounded" value={projectInfo.projectName}
                                       onChange={e => updateProjectInfo({projectName: e.target.value})}/>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Customer Name</label>
                                <input className="w-full border p-2 rounded" value={projectInfo.customerName}
                                       onChange={e => updateProjectInfo({customerName: e.target.value})}/>
                            </div>
                            <div className="col-span-1 md:col-span-2">
                                <label className="block text-xs font-bold text-gray-500 mb-1">Notes</label>
                                <textarea className="w-full border p-2 rounded h-32" value={projectInfo.notes}
                                          onChange={e => updateProjectInfo({notes: e.target.value})}/>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-lg shadow-sm border">
                        <h2 className="text-lg font-bold mb-4 border-b pb-2">Building Data</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <input type="checkbox" checked={buildingData.icfFoundation}
                                           onChange={e => updateBuildingData({icfFoundation: e.target.checked})}/>
                                    <label className="font-medium">ICF Foundation</label>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Foundation
                                        Shape</label>
                                    <select className="w-full border p-2 rounded text-sm"
                                            value={buildingData.foundationAreaId || ""}
                                            onChange={e => updateBuildingData({
                                                foundationAreaId: e.target.value,
                                                foundationPerimeterId: e.target.value
                                            })}>
                                        <option value="">Select Shape...</option>
                                        {measurements.filter(m => m.type === 'shape').map(m => <option key={m.id}
                                                                                                       value={m.id}>{m.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <input type="checkbox" checked={buildingData.hasGarage}
                                           onChange={e => updateBuildingData({hasGarage: e.target.checked})}/>
                                    <label className="font-medium">Garage</label>
                                </div>
                                {buildingData.hasGarage && (
                                    <div className="pl-6 border-l-2 border-gray-200">
                                        <label className="block text-xs font-bold text-gray-500 mb-1">Garage
                                            Shape</label>
                                        <select className="w-full border p-2 rounded text-sm"
                                                value={buildingData.garageShapeId || ""}
                                                onChange={e => updateBuildingData({garageShapeId: e.target.value})}>
                                            <option value="">Select Shape...</option>
                                            {measurements.filter(m => m.type === 'shape').map(m => <option key={m.id}
                                                                                                           value={m.id}>{m.name}</option>)}
                                        </select>
                                    </div>
                                )}
                            </div>

                            <div
                                className="col-span-1 md:col-span-2 grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4 pt-4 border-t">
                                <div><label className="text-xs text-gray-500 block">Flat Roof Area</label><input
                                    type="number" className="border p-1 w-full rounded"
                                    value={buildingData.roofFlatArea}
                                    onChange={e => updateBuildingData({roofFlatArea: parseFloat(e.target.value)})}/>
                                </div>
                                <div><label className="text-xs text-gray-500 block">Num Planes</label><input
                                    type="number" className="border p-1 w-full rounded" value={buildingData.numPlanes}
                                    onChange={e => updateBuildingData({numPlanes: parseFloat(e.target.value)})}/></div>
                                <div><label className="text-xs text-gray-500 block">Num Peaks</label><input
                                    type="number" className="border p-1 w-full rounded" value={buildingData.numPeaks}
                                    onChange={e => updateBuildingData({numPeaks: parseFloat(e.target.value)})}/></div>
                                <div><label className="text-xs text-gray-500 block">Valley Length</label><input
                                    type="number" className="border p-1 w-full rounded"
                                    value={buildingData.valleyLength}
                                    onChange={e => updateBuildingData({valleyLength: parseFloat(e.target.value)})}/>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-lg shadow-sm border">
                        <h2 className="text-lg font-bold mb-4 border-b pb-2">Files</h2>
                        <ul className="space-y-2">
                            {projectInfo.files.length === 0 &&
                                <li className="text-gray-400 italic">No files loaded.</li>}
                            {projectInfo.files.map((f, i) => (
                                <li key={i} className="flex items-center gap-2 text-sm"><FileText size={16}
                                                                                                  className="text-blue-500"/> {f}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DataTab;