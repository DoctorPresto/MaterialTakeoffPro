import React, { useState } from 'react';
import { useStore } from '../store';
import { Cuboid, Package, Trash2, Copy, Pencil, ChevronRight, ChevronDown, X, Save } from 'lucide-react';
import { AssemblyNode } from '../types';

// Helper Component for Collapsible Categories
const CategoryGroup = ({ title, children }: { title: string, children: React.ReactNode }) => {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <div className="mb-2 border rounded bg-white">
      <div 
        className="p-2 bg-gray-100 font-bold text-xs uppercase text-gray-600 flex items-center cursor-pointer select-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
        <span className="ml-2">{title || "Uncategorized"}</span>
      </div>
      {isOpen && <div className="p-2">{children}</div>}
    </div>
  );
};

const AssemblyBuilder = () => {
  const { 
    materials, assemblyDefs, addMaterial, updateMaterial, deleteMaterial, cloneMaterial,
    addAssemblyDef, updateAssemblyDef, deleteAssemblyDef, cloneAssemblyDef,
    addVariableToDef, deleteVariableFromDef, addNodeToDef, updateNodeInDef, removeNodeFromDef
  } = useStore();

  const [activeDefId, setActiveDefId] = useState<string | null>(null);
  
  // Forms
  const [editingMatId, setEditingMatId] = useState<string | null>(null);
  const [matName, setMatName] = useState('');
  const [matSku, setMatSku] = useState('');
  const [matUom, setMatUom] = useState('EA');
  const [matCategory, setMatCategory] = useState('');
  
  const [newDefName, setNewDefName] = useState('');
  const [newDefCategory, setNewDefCategory] = useState('');

  // Logic Builder
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [newVarName, setNewVarName] = useState('');
  const [newVarType, setNewVarType] = useState('linear');
  const [nodeFormula, setNodeFormula] = useState('');
  const [nodeChildId, setNodeChildId] = useState('');
  const [nodeType, setNodeType] = useState<'material' | 'assembly'>('material');
  const [nodeMapping, setNodeMapping] = useState<Record<string, string>>({});

  const activeDef = assemblyDefs.find(d => d.id === activeDefId);

  // Material Handlers
  const handleSaveMaterial = () => {
    if (editingMatId) {
      updateMaterial(editingMatId, { name: matName, sku: matSku, uom: matUom, category: matCategory });
      setEditingMatId(null);
    } else {
      addMaterial({ name: matName, sku: matSku, uom: matUom, category: matCategory });
    }
    setMatName(''); setMatSku(''); setMatUom('EA'); setMatCategory('');
  };

  const handleEditMaterial = (m: any) => {
    setEditingMatId(m.id);
    setMatName(m.name);
    setMatSku(m.sku);
    setMatUom(m.uom);
    setMatCategory(m.category);
  };

  // Node/Logic Handlers
  const handleEditNode = (node: AssemblyNode) => {
    setEditingNodeId(node.id);
    setNodeFormula(node.formula);
    setNodeChildId(node.childId);
    setNodeType(node.childType);
    if (node.variableMapping) setNodeMapping(node.variableMapping);
  };

  const handleSaveNode = () => {
    if (!activeDefId || !nodeChildId) return;

    const nodeData = {
      childType: nodeType,
      childId: nodeChildId,
      formula: nodeFormula,
      round: 'up' as const,
      variableMapping: nodeType === 'assembly' ? nodeMapping : undefined
    };

    if (editingNodeId) {
      updateNodeInDef(activeDefId, editingNodeId, nodeData);
      setEditingNodeId(null);
    } else {
      addNodeToDef(activeDefId, nodeData);
    }
    
    // Reset Form
    setNodeFormula('');
    setNodeMapping({});
    setEditingNodeId(null);
  };

  const handleCancelNodeEdit = () => {
    setEditingNodeId(null);
    setNodeFormula('');
    setNodeMapping({});
  };

  // Grouping Helpers
  const groupedMaterials = materials.reduce((acc, m) => {
    const cat = m.category || "Uncategorized";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(m);
    return acc;
  }, {} as Record<string, typeof materials>);

  const groupedAssemblies = assemblyDefs.reduce((acc, a) => {
    const cat = a.category || "Uncategorized";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(a);
    return acc;
  }, {} as Record<string, typeof assemblyDefs>);

  return (
    <div className="h-full flex flex-col p-4 bg-gray-50 overflow-auto">
      <h2 className="text-xl font-bold mb-4">Setup Database</h2>

      {/* MATERIAL LIBRARY */}
      <div className="bg-white p-4 rounded shadow mb-6 border">
        <h3 className="font-semibold mb-2 flex items-center gap-2"><Package size={18} /> Material Library</h3>
        
        {/* Material Form */}
        <div className="flex gap-2 mb-4 items-end bg-gray-50 p-2 rounded">
          <div className="flex-[2]"><label className="text-xs font-bold text-gray-500">Name</label><input className="border p-1 text-sm rounded w-full" value={matName} onChange={e => setMatName(e.target.value)} /></div>
          <div className="flex-1"><label className="text-xs font-bold text-gray-500">SKU</label><input className="border p-1 text-sm rounded w-full" value={matSku} onChange={e => setMatSku(e.target.value)} /></div>
          <div className="flex-1"><label className="text-xs font-bold text-gray-500">Category</label><input className="border p-1 text-sm rounded w-full" value={matCategory} onChange={e => setMatCategory(e.target.value)} placeholder="e.g. Lumber" /></div>
          <div className="w-20"><label className="text-xs font-bold text-gray-500">UOM</label><select className="border p-1 text-sm rounded w-full" value={matUom} onChange={e => setMatUom(e.target.value)}><option value="EA">EA</option><option value="LNFT">LNFT</option><option value="SQFT">SQFT</option></select></div>
          <button className={`px-3 py-1 rounded text-sm text-white ${editingMatId ? 'bg-orange-500' : 'bg-blue-600'}`} onClick={handleSaveMaterial}>{editingMatId ? 'Update' : 'Add'}</button>
          {editingMatId && <button onClick={() => { setEditingMatId(null); setMatName(''); setMatSku(''); }} className="p-1 hover:bg-gray-200 rounded"><X size={16}/></button>}
        </div>

        {/* Material List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(groupedMaterials).map(([category, items]) => (
            <div key={category} className="col-span-1">
              <CategoryGroup title={category}>
                {items.map(m => (
                  <div key={m.id} className={`border-b last:border-0 py-2 flex justify-between items-center ${editingMatId === m.id ? 'bg-orange-50' : ''}`}>
                    <div><div className="font-bold text-sm">{m.name}</div><div className="text-xs text-gray-500">{m.sku} • {m.uom}</div></div>
                    <div className="flex gap-1">
                      <button onClick={() => handleEditMaterial(m)} className="p-1 hover:bg-gray-100 rounded text-blue-600"><Pencil size={14}/></button>
                      <button onClick={() => cloneMaterial(m.id)} className="p-1 hover:bg-gray-100 rounded text-green-600"><Copy size={14}/></button>
                      <button onClick={() => deleteMaterial(m.id)} className="p-1 hover:bg-gray-100 rounded text-red-600"><Trash2 size={14}/></button>
                    </div>
                  </div>
                ))}
              </CategoryGroup>
            </div>
          ))}
        </div>
      </div>

      {/* ASSEMBLY DEFINITIONS */}
      <div className="bg-white p-4 rounded shadow mb-6 border flex-1 flex flex-col min-h-0">
        <h3 className="font-semibold mb-2 flex items-center gap-2"><Cuboid size={18} /> Assembly Definitions</h3>
        
        {/* Create Assembly Form */}
        <div className="flex gap-2 mb-4">
          <input className="border p-1 text-sm rounded flex-[2]" placeholder="New Assembly Name" value={newDefName} onChange={e => setNewDefName(e.target.value)} />
          <input className="border p-1 text-sm rounded flex-1" placeholder="Category (e.g. Walls)" value={newDefCategory} onChange={e => setNewDefCategory(e.target.value)} />
          <button className="bg-green-600 text-white px-3 py-1 rounded text-sm" onClick={() => { addAssemblyDef(newDefName, newDefCategory); setNewDefName(''); }}>Create New</button>
        </div>
        
        <div className="flex gap-4 flex-1 min-h-0">
          <div className="w-1/3 border rounded overflow-y-auto bg-gray-50 p-2">
             {Object.entries(groupedAssemblies).map(([category, items]) => (
               <CategoryGroup key={category} title={category}>
                 {items.map(d => (
                   <div key={d.id} className={`p-2 border-b flex justify-between items-center group cursor-pointer ${activeDefId === d.id ? 'bg-blue-100 font-bold' : 'hover:bg-gray-50'}`} onClick={() => setActiveDefId(d.id)}>
                     <span className="truncate text-sm">{d.name}</span>
                     <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                       <button onClick={(e) => { e.stopPropagation(); cloneAssemblyDef(d.id); }} className="p-1 text-green-600"><Copy size={12}/></button>
                       <button onClick={(e) => { e.stopPropagation(); deleteAssemblyDef(d.id); }} className="p-1 text-red-600"><Trash2 size={12}/></button>
                     </div>
                   </div>
                 ))}
               </CategoryGroup>
             ))}
          </div>

          <div className="w-2/3 border rounded p-4 overflow-y-auto bg-gray-50">
            {activeDef ? (
              <>
                {/* EDIT ASSEMBLY HEADER */}
                <div className="flex gap-2 mb-6 border-b pb-4">
                   <div className="flex-[2]">
                     <label className="text-xs font-bold text-gray-500 block mb-1">Assembly Name</label>
                     <input 
                       className="border p-2 text-lg font-bold rounded w-full" 
                       value={activeDef.name} 
                       onChange={(e) => updateAssemblyDef(activeDef.id, { name: e.target.value })} 
                     />
                   </div>
                   <div className="flex-1">
                     <label className="text-xs font-bold text-gray-500 block mb-1">Category</label>
                     <input 
                       className="border p-2 text-sm rounded w-full" 
                       value={activeDef.category} 
                       onChange={(e) => updateAssemblyDef(activeDef.id, { category: e.target.value })} 
                     />
                   </div>
                </div>
                
                {/* Variable Config */}
                <div className="mb-6 bg-white p-3 rounded border">
                  <h5 className="text-xs font-bold uppercase text-gray-400 mb-2">1. Variables</h5>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {activeDef.variables.map(v => (
                      <span key={v.id} className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-800 text-xs pl-2 pr-1 py-1 rounded border border-yellow-200">
                        {v.name} <span className="opacity-50 text-[10px]">({v.type})</span>
                        {/* DELETE VARIABLE BUTTON */}
                        <button onClick={() => deleteVariableFromDef(activeDef.id, v.id)} className="ml-1 p-0.5 hover:bg-yellow-200 rounded text-yellow-900"><X size={12}/></button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input className="border p-1 text-xs rounded" placeholder="Var Name" value={newVarName} onChange={e => setNewVarName(e.target.value)} />
                    <select className="border p-1 text-xs rounded" onChange={e => setNewVarType(e.target.value as any)}><option value="linear">Linear (ft)</option><option value="area">Area (sq ft)</option><option value="count">Count</option></select>
                    <button className="bg-gray-200 px-2 py-1 rounded text-xs font-medium" onClick={() => { addVariableToDef(activeDef.id, newVarName, newVarType as any); setNewVarName(''); }}>+ Add</button>
                  </div>
                </div>

                {/* Logic Config */}
                <div className="bg-white p-3 rounded border">
                  <h5 className="text-xs font-bold uppercase text-gray-400 mb-2">2. Logic</h5>
                  <div className="space-y-2 mb-4">
                    {activeDef.children.map(c => (
                       <div key={c.id} className={`text-sm border p-2 rounded flex justify-between items-center ${editingNodeId === c.id ? 'bg-blue-50 border-blue-300' : 'bg-gray-50'}`}>
                          <div className="flex items-center gap-2">
                             <span className="font-mono bg-white px-1 border rounded text-blue-600 font-bold">{c.formula}</span> 
                             <span>&rarr;</span> 
                             <span className="font-medium">{c.childType === 'material' ? materials.find(m => m.id === c.childId)?.name : assemblyDefs.find(a => a.id === c.childId)?.name}</span>
                          </div>
                          <div className="flex gap-1">
                             <button onClick={() => handleEditNode(c)} className="text-blue-500 hover:text-blue-700 p-1"><Pencil size={14}/></button>
                             <button onClick={() => removeNodeFromDef(activeDef.id, c.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={14}/></button>
                          </div>
                       </div>
                    ))}
                  </div>

                  {/* Logic Form */}
                  <div className={`border p-3 rounded space-y-3 transition-colors ${editingNodeId ? 'bg-orange-50 border-orange-200' : 'bg-blue-50/50'}`}>
                    {editingNodeId && <div className="text-xs font-bold text-orange-600">Editing Component...</div>}
                    <div className="flex gap-2">
                      <select className="border p-1 text-xs rounded" value={nodeType} onChange={e => setNodeType(e.target.value as any)}><option value="material">Add Material</option><option value="assembly">Add Sub-Assembly</option></select>
                      <select className="border p-1 text-xs rounded flex-1" value={nodeChildId} onChange={e => setNodeChildId(e.target.value)}><option value="">Select Item...</option>{nodeType === 'material' ? materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>) : assemblyDefs.filter(a => a.id !== activeDefId).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
                    </div>
                    {nodeType === 'assembly' && nodeChildId && <div className="text-xs bg-white p-2 border rounded"><p className="font-bold mb-1">Map Variables</p>{assemblyDefs.find(a => a.id === nodeChildId)?.variables.map(childVar => <div key={childVar.id} className="flex justify-between mb-1"><span>{childVar.name} &larr;</span><select className="border rounded p-0.5 w-32" value={nodeMapping[childVar.name] || ''} onChange={(e) => setNodeMapping(prev => ({ ...prev, [childVar.name]: e.target.value }))}><option value="">Select...</option>{activeDef.variables.map(pv => <option key={pv.id} value={pv.name}>{pv.name}</option>)}</select></div>)}</div>}
                    <div className="flex gap-2">
                       <input className="border p-1.5 text-xs rounded flex-1" placeholder="Formula" value={nodeFormula} onChange={e => setNodeFormula(e.target.value)} />
                       <button className={`text-white px-3 py-1 text-xs rounded font-medium ${editingNodeId ? 'bg-orange-500' : 'bg-blue-600'}`} onClick={handleSaveNode}>{editingNodeId ? 'Update' : 'Add'}</button>
                       {editingNodeId && <button onClick={handleCancelNodeEdit} className="p-1 text-gray-500 hover:bg-gray-200 rounded"><X size={16}/></button>}
                    </div>
                  </div>
                </div>
              </>
            ) : <div className="text-gray-400 text-center py-10">Select an Assembly</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssemblyBuilder;