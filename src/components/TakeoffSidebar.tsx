import React, { useState } from 'react';
import { useStore } from '../store';
import { Ruler, MousePointer2, PenTool, Spline, Plus, Trash2, Folder, Settings, X, ChevronRight, ChevronDown } from 'lucide-react';
import { ItemSet, ProjectAssembly, AssemblyDef, Measurement } from '../types';

// Helper Component for Collapsible Item Sets
const CollapsibleItemSet = ({ 
  itemSet, 
  assemblyDefs, 
  measurements,
  onDelete, 
  onAddInstance, 
  onDeleteInstance, 
  onUpdateVar 
}: { 
  itemSet: ItemSet, 
  assemblyDefs: AssemblyDef[], 
  measurements: Measurement[],
  onDelete: () => void,
  onAddInstance: (defId: string) => void,
  onDeleteInstance: (instId: string) => void,
  onUpdateVar: (instId: string, varId: string, val: any) => void
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [editingInstanceId, setEditingInstanceId] = useState<string | null>(null);

  return (
    <div className="border rounded-lg overflow-hidden bg-white shadow-sm mb-4">
      <div 
        className="bg-gray-100 p-2 flex justify-between items-center border-b cursor-pointer select-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="font-bold text-sm flex items-center gap-2">
          {isOpen ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
          <Folder size={14} className="text-blue-500"/> 
          {itemSet.name}
        </div>
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-gray-400 hover:text-red-500"><Trash2 size={14}/></button>
      </div>

      {isOpen && (
        <>
          {/* Add Assembly to this Set */}
          <div className="p-2 bg-gray-50 border-b">
             <select 
               className="w-full text-xs border p-1 rounded" 
               onChange={(e) => { if(e.target.value) onAddInstance(e.target.value); }} 
               value=""
             >
               <option value="">+ Add Assembly / Material...</option>
               {assemblyDefs.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
             </select>
          </div>

          {/* Assemblies in Set */}
          <div className="divide-y">
            {itemSet.assemblies.map(inst => {
               const def = assemblyDefs.find(d => d.id === inst.assemblyDefId);
               const isEditing = editingInstanceId === inst.id;
               
               return (
                 <div key={inst.id} className="p-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">{inst.name}</span>
                      <div className="flex gap-1">
                        <button onClick={() => setEditingInstanceId(isEditing ? null : inst.id)} className={`p-1 rounded ${isEditing ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-400'}`}><Settings size={14}/></button>
                        <button onClick={() => onDeleteInstance(inst.id)} className="p-1 hover:bg-gray-100 text-gray-400 hover:text-red-500 rounded"><X size={14}/></button>
                      </div>
                    </div>

                    {/* CONFIGURATION PANEL (Only visible if Editing) */}
                    {isEditing && def && (
                      <div className="mt-2 p-2 bg-blue-50/50 rounded border border-blue-100 text-xs space-y-2">
                         {def.variables.map(v => (
                           <div key={v.id}>
                              <div className="flex justify-between mb-1 text-gray-600 font-semibold">
                                 <span>{v.name}</span>
                                 <span className="font-normal text-[10px] opacity-70">({v.type})</span>
                              </div>
                              <div className="flex gap-1">
                                 <select 
                                    className="border rounded p-1 flex-1"
                                    value={inst.variableValues[v.id]?.type === 'measurement' ? (inst.variableValues[v.id] as any).measurementId : 'manual'}
                                    onChange={(e) => {
                                       if (e.target.value === 'manual') {
                                         onUpdateVar(inst.id, v.id, { type: 'manual', value: 0 });
                                       } else {
                                         const property = v.type === 'area' ? 'area' : 'length'; 
                                         onUpdateVar(inst.id, v.id, { type: 'measurement', measurementId: e.target.value, property });
                                       }
                                    }}
                                 >
                                    <option value="manual">Manual Input</option>
                                    {measurements.map(m => <option key={m.id} value={m.id}>{m.name} ({m.type})</option>)}
                                 </select>
                                 
                                 {inst.variableValues[v.id]?.type === 'manual' ? (
                                    <input type="number" className="w-16 border rounded p-1" value={(inst.variableValues[v.id] as any).value} onChange={(e) => onUpdateVar(inst.id, v.id, { type: 'manual', value: parseFloat(e.target.value) })} />
                                 ) : (
                                    v.type !== 'area' && (inst.variableValues[v.id] as any).measurementId && (
                                      <select 
                                        className="w-20 border rounded p-1"
                                        value={(inst.variableValues[v.id] as any).property}
                                        onChange={(e) => onUpdateVar(inst.id, v.id, { ...(inst.variableValues[v.id] as any), property: e.target.value })}
                                      >
                                        <option value="length">Len</option>
                                        <option value="perimeter">Perim</option>
                                        <option value="area">Area</option>
                                      </select>
                                    )
                                 )}
                              </div>
                           </div>
                         ))}
                      </div>
                    )}
                 </div>
               );
            })}
            {itemSet.assemblies.length === 0 && <div className="p-2 text-xs text-gray-400 italic text-center">Empty set</div>}
          </div>
        </>
      )}
    </div>
  );
};

const TakeoffSidebar = () => {
  const { 
    measurements, activeTool, setTool, assemblyDefs, itemSets,
    addItemSet, deleteItemSet, addInstanceToSet, deleteInstanceFromSet, updateInstanceVariable,
    scale, isCalibrating, setIsCalibrating
  } = useStore();

  const [newItemSetName, setNewItemSetName] = useState('');

  return (
    <div className="w-96 bg-white border-l h-screen flex flex-col z-20 shadow-xl">
      {/* HEADER */}
      <div className="p-4 border-b bg-gray-50 space-y-3">
        <h1 className="font-bold text-lg">Takeoff Tools</h1>
        
        {/* Drawing Tools */}
        <div className="grid grid-cols-3 gap-2">
          <button className={`flex flex-col items-center justify-center p-2 rounded border text-xs font-medium transition-colors ${activeTool === 'select' && !isCalibrating ? 'bg-blue-100 border-blue-500 text-blue-700' : 'bg-white hover:bg-gray-50'}`} onClick={() => setTool('select')}><MousePointer2 size={18} className="mb-1" /> Select</button>
          <button className={`flex flex-col items-center justify-center p-2 rounded border text-xs font-medium transition-colors ${activeTool === 'line' ? 'bg-blue-100 border-blue-500 text-blue-700' : 'bg-white hover:bg-gray-50'}`} onClick={() => setTool('line')}><Spline size={18} className="mb-1" /> Line</button>
          <button className={`flex flex-col items-center justify-center p-2 rounded border text-xs font-medium transition-colors ${activeTool === 'shape' ? 'bg-blue-100 border-blue-500 text-blue-700' : 'bg-white hover:bg-gray-50'}`} onClick={() => setTool('shape')}><PenTool size={18} className="mb-1" /> Shape</button>
        </div>

        {/* Calibration */}
        <div className="flex items-center justify-between bg-yellow-50 border border-yellow-200 p-2 rounded">
          <div className="text-xs">
            <div className="font-bold text-yellow-800">Scale</div>
            <div className="text-yellow-600">{scale === 1 ? "Not Calibrated" : `1 unit = ${(1/scale).toFixed(2)} px`}</div>
          </div>
          <button onClick={() => setIsCalibrating(!isCalibrating)} className={`px-3 py-1 text-xs font-bold rounded border flex items-center gap-1 ${isCalibrating ? 'bg-yellow-500 text-white border-yellow-600' : 'bg-white text-yellow-700 border-yellow-300 hover:bg-yellow-100'}`}><Ruler size={14} /> {isCalibrating ? 'Cancel' : 'Calibrate'}</button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {/* CREATE ITEM SET */}
        <div className="flex gap-2 mb-4">
          <input className="border p-2 text-sm rounded flex-1" placeholder="New Item Set (e.g. Garage Walls)" value={newItemSetName} onChange={e => setNewItemSetName(e.target.value)} />
          <button className="bg-blue-600 text-white p-2 rounded" onClick={() => { if(newItemSetName) { addItemSet(newItemSetName); setNewItemSetName(''); } }}><Plus size={18}/></button>
        </div>

        {/* ITEM SETS LIST */}
        <div className="space-y-4">
          {itemSets.map(set => (
             <CollapsibleItemSet 
               key={set.id}
               itemSet={set}
               assemblyDefs={assemblyDefs}
               measurements={measurements}
               onDelete={() => deleteItemSet(set.id)}
               onAddInstance={(defId) => addInstanceToSet(set.id, defId)}
               onDeleteInstance={(instId) => deleteInstanceFromSet(set.id, instId)}
               onUpdateVar={(instId, varId, val) => updateInstanceVariable(set.id, instId, varId, val)}
             />
          ))}
          {itemSets.length === 0 && (
             <div className="text-sm text-gray-400 italic text-center py-4 border-2 border-dashed rounded">
               No Item Sets. Create one above to start.
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TakeoffSidebar;