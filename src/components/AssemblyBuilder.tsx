import React, {useEffect, useMemo, useState} from 'react';
import {v4 as uuidv4} from 'uuid';
import {useStore} from '../store';
import {
    AlertCircle,
    CheckCircle,
    ChevronDown,
    ChevronRight,
    Copy,
    Cuboid,
    Download,
    GripVertical,
    Layers,
    Package,
    Pencil,
    Plus,
    Search,
    Trash2,
    Upload,
    X,
    List
} from 'lucide-react';
import {AssemblyNode, MaterialDef, MaterialVariant} from '../types';
import {SearchableSelector} from './SearchableSelector';

const CategoryGroup = ({title, children}: { title: string, children: React.ReactNode }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="mb-2 border rounded bg-white overflow-hidden shadow-sm shrink-0">
            <div
                className="p-2 bg-gray-50 font-bold text-xs uppercase text-gray-600 flex items-center cursor-pointer select-none hover:bg-gray-100 transition-colors"
                onClick={() => setIsOpen(!isOpen)}
            >
                {isOpen ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                <span className="ml-2">{title || "Uncategorized"}</span>
            </div>
            {isOpen && <div className="bg-white">{children}</div>}
        </div>
    );
};

const CategorySelector = ({
                              current, existing, onChange, placeholder
                          }: {
    current: string,
    existing: string[],
    onChange: (val: string) => void,
    placeholder: string
}) => {
    const [isCreating, setIsCreating] = useState(false);
    const options = useMemo(() => {
        const opts = new Set(existing);
        if (current) opts.add(current);
        return Array.from(opts).sort();
    }, [existing, current]);

    if (isCreating) {
        return (
            <div className="flex gap-1 w-full">
                <input
                    autoFocus
                    className="border p-2 text-sm rounded w-full bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Type new category..."
                    value={current}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') setIsCreating(false); }}
                    onBlur={() => { if (!current) setIsCreating(false); }}
                />
                <button onClick={() => setIsCreating(false)} className="p-2 text-gray-500 hover:bg-gray-200 rounded bg-gray-100"><X size={14}/></button>
            </div>
        );
    }

    return (
        <select
            className="border p-2 text-sm rounded w-full bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            value={current}
            onChange={(e) => {
                if (e.target.value === '___NEW___') {
                    setIsCreating(true);
                    onChange('');
                } else {
                    onChange(e.target.value);
                }
            }}
        >
            <option value="">{placeholder}</option>
            {options.map(c => <option key={c} value={c}>{c}</option>)}
            <option disabled>──────────</option>
            <option value="___NEW___">+ Create New Category</option>
        </select>
    );
};

const StatusMessage = ({msg, type}: { msg: string, type: 'error' | 'success' | null }) => {
    if (!msg || !type) return null;
    const color = type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200';
    const Icon = type === 'error' ? AlertCircle : CheckCircle;
    return (
        <div className={`p-2 rounded border text-xs flex items-center gap-2 mb-4 animate-in fade-in slide-in-from-top-2 ${color}`}>
            <Icon size={14}/> {msg}
        </div>
    );
};

const AssemblyBuilder = () => {
    const {
        materials, assemblyDefs, addMaterial, importMaterials, updateMaterial, deleteMaterial, cloneMaterial,
        addAssemblyDef, updateAssemblyDef, deleteAssemblyDef, cloneAssemblyDef, importAssemblyDefs,
        addVariableToDef, deleteVariableFromDef, addNodeToDef, updateNodeInDef, removeNodeFromDef
    } = useStore();

    const [activeSubTab, setActiveSubTab] = useState<'materials' | 'assemblies'>('assemblies');
    const [status, setStatus] = useState<{ msg: string, type: 'error' | 'success' | null }>({msg: '', type: null});

    useEffect(() => {
        if (status.msg) {
            const timer = setTimeout(() => setStatus({msg: '', type: null}), 3000);
            return () => clearTimeout(timer);
        }
    }, [status]);

    const allMatCategories = useMemo(() => Array.from(new Set(materials.map(m => m.category).filter(Boolean))).sort(), [materials]);
    const allAsmCategories = useMemo(() => Array.from(new Set(assemblyDefs.map(a => a.category).filter(Boolean))).sort(), [assemblyDefs]);

    // Material Form State
    const [editingMatId, setEditingMatId] = useState<string | null>(null);
    const [matName, setMatName] = useState('');
    const [matSku, setMatSku] = useState('');
    const [matUom, setMatUom] = useState('EA');
    const [matCategory, setMatCategory] = useState('');
    const [matIsSpecialOrder, setMatIsSpecialOrder] = useState(false);
    const [matReportSku, setMatReportSku] = useState('');

    // Variant State
    const [matVariants, setMatVariants] = useState<MaterialVariant[]>([]);
    const [matDefaultVariantId, setMatDefaultVariantId] = useState('');
    const [newVariantName, setNewVariantName] = useState('');
    const [newVariantProps, setNewVariantProps] = useState<{key: string, value: string}[]>([]);
    const [newVarPropKey, setNewVarPropKey] = useState('');
    const [newVarPropVal, setNewVarPropVal] = useState('');

    const [matSearch, setMatSearch] = useState('');

    // Assembly Form State
    const [activeDefId, setActiveDefId] = useState<string | null>(null);
    const [newDefName, setNewDefName] = useState('');
    const [newDefCategory, setNewDefCategory] = useState('');
    const [asmSearch, setAsmSearch] = useState('');

    // Node State
    const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
    const [newVarName, setNewVarName] = useState('');
    const [newVarType, setNewVarType] = useState('linear');
    const [nodeFormula, setNodeFormula] = useState('');
    const [nodeAlias, setNodeAlias] = useState('');
    const [nodeChildId, setNodeChildId] = useState('');
    const [nodeType, setNodeType] = useState<'material' | 'assembly'>('material');
    const [nodeMapping, setNodeMapping] = useState<Record<string, string>>({});

    // Dynamic Node State
    const [isDynamicNode, setIsDynamicNode] = useState(false);
    const [variantIds, setVariantIds] = useState<string[]>([]);
    const [defaultVariantId, setDefaultVariantId] = useState<string>('');

    // Drag State
    const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);

    const activeDef = assemblyDefs.find(d => d.id === activeDefId);

    // Variant Helpers
    const handleAddVariantProp = () => {
        if (!newVarPropKey || !newVarPropVal) return;
        setNewVariantProps([...newVariantProps, {key: newVarPropKey, value: newVarPropVal}]);
        setNewVarPropKey(''); setNewVarPropVal('');
    };

    const handleAddVariant = () => {
        if (!newVariantName) return;
        const props: Record<string, number> = {};
        newVariantProps.forEach(p => {
            const v = parseFloat(p.value);
            if (!isNaN(v)) props[p.key] = v;
        });

        const newVariant: MaterialVariant = {
            id: uuidv4(),
            name: newVariantName,
            properties: props
        };

        // If this is the first variant, make it default automatically
        if (matVariants.length === 0) setMatDefaultVariantId(newVariant.id);

        setMatVariants([...matVariants, newVariant]);
        setNewVariantName('');
        setNewVariantProps([]);
    };

    const handleDeleteVariant = (id: string) => {
        setMatVariants(matVariants.filter(v => v.id !== id));
        if (matDefaultVariantId === id) setMatDefaultVariantId('');
    };

    const handleSaveMaterial = () => {
        if (!matSku) return setStatus({msg: "SKU is required", type: 'error'});
        const isDuplicate = materials.some(m => m.sku.toLowerCase() === matSku.toLowerCase() && m.id !== editingMatId);
        if (isDuplicate) return setStatus({msg: `SKU "${matSku}" already exists.`, type: 'error'});

        // Ensure default is set if variants exist
        if (matIsSpecialOrder && matVariants.length > 0 && !matDefaultVariantId) {
            // Fallback: set the first one as default if user forgot
            setMatDefaultVariantId(matVariants[0].id);
        }

        const matData = {
            name: matName,
            sku: matSku,
            uom: matUom,
            category: matCategory,
            isSpecialOrder: matIsSpecialOrder,
            reportSku: matIsSpecialOrder ? (matReportSku || undefined) : undefined,
            variants: matIsSpecialOrder ? matVariants : undefined,
            defaultVariantId: matIsSpecialOrder ? matDefaultVariantId : undefined
        };

        if (editingMatId) {
            updateMaterial(editingMatId, matData);
            setStatus({msg: "Material updated", type: 'success'});
            setEditingMatId(null);
        } else {
            addMaterial(matData);
            setStatus({msg: "Material created", type: 'success'});
        }

        // Reset Form
        setMatName(''); setMatSku(''); setMatUom('EA'); setMatCategory('');
        setMatIsSpecialOrder(false); setMatReportSku(''); setMatVariants([]);
        setMatDefaultVariantId(''); setNewVariantName(''); setNewVariantProps([]);
    };

    const handleEditMaterial = (m: MaterialDef) => {
        setEditingMatId(m.id);
        setMatName(m.name);
        setMatSku(m.sku);
        setMatUom(m.uom);
        setMatCategory(m.category);
        setMatIsSpecialOrder(!!m.isSpecialOrder);
        setMatReportSku(m.reportSku || '');
        setMatVariants(m.variants || []);
        setMatDefaultVariantId(m.defaultVariantId || '');
    };

    const handleClearMaterialForm = () => {
        setEditingMatId(null);
        setMatName('');
        setMatSku('');
        setMatUom('EA');
        setMatCategory('');
        setMatIsSpecialOrder(false);
        setMatReportSku('');
        setMatVariants([]);
        setMatDefaultVariantId('');
    }
    const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            const text = evt.target?.result as string;
            const lines = text.split('\n');
            const newMats: any[] = [];
            const existingSkus = new Set(materials.map(m => m.sku.toLowerCase()));
            for (let i = 1; i < lines.length; i++) {
                const [sku, name, uom, category] = lines[i].split(',').map(s => s.trim());
                if (name && sku && !existingSkus.has(sku.toLowerCase())) {
                    newMats.push({sku, name, uom: uom || 'EA', category: category || 'Imported'});
                    existingSkus.add(sku.toLowerCase());
                }
            }
            if (newMats.length > 0) {
                importMaterials(newMats);
                setStatus({msg: `Imported ${newMats.length} items`, type: 'success'});
            } else {
                setStatus({msg: "No new materials to import", type: 'error'});
            }
        };
        reader.readAsText(file);
    };

    const handleExportMaterialsCSV = () => {
        const headers = ["SKU", "Name", "UOM", "Category"];
        const rows = materials.map(m => [m.sku, m.name, m.uom, m.category]);
        const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].map(e => e.join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.href = encodedUri; link.download = "materials_export.csv";
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    };

    const handleImportAssembliesJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = JSON.parse(evt.target?.result as string);
                if (Array.isArray(data)) {
                    importAssemblyDefs(data);
                    setStatus({msg: `Imported ${data.length} assemblies`, type: 'success'});
                } else {
                    setStatus({msg: "Invalid JSON format", type: 'error'});
                }
            } catch (err) { setStatus({msg: "Invalid JSON file", type: 'error'}); }
        };
        reader.readAsText(file);
    };

    const handleExportAssembliesJSON = () => {
        const exportData = assemblyDefs.map(def => ({
            id: def.id,
            name: def.name,
            category: def.category,
            variables: def.variables,
            children: def.children.map(c => {
                const material = c.childType === 'material' ? materials.find(m => m.id === c.childId) : null;
                return { ...c, childSku: material?.sku || undefined };
            })
        }));
        const jsonContent = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
        const link = document.createElement("a");
        link.href = jsonContent; link.download = "assemblies_export.json";
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    };

    // Node Editing
    const handleSaveNode = () => {
        if (!activeDefId) return;

        if (isDynamicNode && nodeType === 'material') {
            if (variantIds.length === 0) return setStatus({msg: "Select at least one variant", type: 'error'});
            if (!defaultVariantId) return setStatus({msg: "Select a default variant", type: 'error'});
        } else if (!nodeChildId) {
            return setStatus({msg: "Select a material/assembly", type: 'error'});
        }

        const nodeData = {
            childType: nodeType,
            childId: isDynamicNode ? defaultVariantId : nodeChildId,
            formula: nodeFormula,
            alias: nodeAlias || undefined,
            round: 'up' as const,
            variableMapping: nodeType === 'assembly' ? nodeMapping : undefined,
            isDynamic: isDynamicNode && nodeType === 'material',
            variantIds: isDynamicNode && nodeType === 'material' ? variantIds : undefined,
            defaultVariantId: isDynamicNode && nodeType === 'material' ? defaultVariantId : undefined
        };

        if (editingNodeId) {
            updateNodeInDef(activeDefId, editingNodeId, nodeData);
        } else {
            addNodeToDef(activeDefId, nodeData);
        }

        setNodeFormula('');
        setNodeAlias('');
        setNodeMapping({});
        setEditingNodeId(null);
        setNodeChildId('');
        setIsDynamicNode(false);
        setVariantIds([]);
        setDefaultVariantId('');
    };

    const handleEditNode = (node: AssemblyNode) => {
        setEditingNodeId(node.id);
        setNodeFormula(node.formula);
        setNodeAlias(node.alias || '');
        setNodeChildId(node.childId);
        setNodeType(node.childType);
        if (node.variableMapping) setNodeMapping(node.variableMapping);

        if (node.isDynamic) {
            setIsDynamicNode(true);
            setVariantIds(node.variantIds || []);
            setDefaultVariantId(node.defaultVariantId || node.childId);
        } else {
            setIsDynamicNode(false);
            setVariantIds([]);
            setDefaultVariantId('');
        }
    };

    // Drag and Drop
    const handleNodeDragStart = (e: React.DragEvent, id: string) => {
        setDraggedNodeId(id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleNodeDrop = (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        if (!activeDef || !draggedNodeId || draggedNodeId === targetId) {
            setDraggedNodeId(null);
            return;
        }

        const newChildren = [...activeDef.children];
        const oldIndex = newChildren.findIndex(c => c.id === draggedNodeId);
        const newIndex = newChildren.findIndex(c => c.id === targetId);

        if (oldIndex !== -1 && newIndex !== -1) {
            const [removed] = newChildren.splice(oldIndex, 1);
            newChildren.splice(newIndex, 0, removed);
            updateAssemblyDef(activeDef.id, { children: newChildren });
        }
        setDraggedNodeId(null);
    };
    // Filter Logic
    const filteredMaterials = useMemo(() => { if (!matSearch) return materials; const low = matSearch.toLowerCase(); return materials.filter(m => m.name.toLowerCase().includes(low) || m.sku.toLowerCase().includes(low) || m.category.toLowerCase().includes(low)); }, [materials, matSearch]);
    const filteredAssemblies = useMemo(() => { if (!asmSearch) return assemblyDefs; const low = asmSearch.toLowerCase(); return assemblyDefs.filter(a => a.name.toLowerCase().includes(low) || a.category.toLowerCase().includes(low)); }, [assemblyDefs, asmSearch]);
    const groupedMaterials = materials.reduce((acc, m) => { const cat = m.category || "Uncategorized"; if (!acc[cat]) acc[cat] = []; acc[cat].push(m); return acc; }, {} as Record<string, typeof materials>);
    const groupedAssemblies = assemblyDefs.reduce((acc, a) => { const cat = a.category || "Uncategorized"; if (!acc[cat]) acc[cat] = []; acc[cat].push(a); return acc; }, {} as Record<string, typeof assemblyDefs>);
    const handleAddVariantToDynamic = (id: string) => { if (id && !variantIds.includes(id)) { const newIds = [...variantIds, id]; setVariantIds(newIds); if (!defaultVariantId) setDefaultVariantId(id); } };

    return (
        <div className="flex flex-col h-full w-full bg-gray-100 overflow-hidden">
            <div className="bg-white border-b px-4 flex gap-6 shrink-0 shadow-sm z-10">
                <button className={`py-3 text-sm font-medium border-b-2 transition-colors ${activeSubTab === 'assemblies' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`} onClick={() => setActiveSubTab('assemblies')}>AssemblyDB</button>
                <button className={`py-3 text-sm font-medium border-b-2 transition-colors ${activeSubTab === 'materials' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`} onClick={() => setActiveSubTab('materials')}>MaterialDB</button>
            </div>
            <div className="flex-1 overflow-hidden p-4 w-full">
                <StatusMessage msg={status.msg} type={status.type}/>

                {activeSubTab === 'materials' && (
                    <div className="h-full flex flex-col w-full gap-4">
                        <div className="bg-white p-3 rounded-lg shadow-sm border shrink-0">
                            {/* Material Form UI */}
                            <div className="flex justify-between items-center mb-3 border-b pb-2">
                                <h3 className="font-bold flex items-center gap-2 text-gray-700"><Package size={16}/> Material Database</h3>
                                <div className="flex gap-2">
                                    <button onClick={handleExportMaterialsCSV} className="flex items-center gap-1 bg-green-50 px-3 py-1.5 rounded text-xs hover:bg-green-100 text-green-600 border border-green-100 font-medium transition-colors"><Download size={14}/> Export CSV</button>
                                    <label className="flex items-center gap-1 cursor-pointer bg-gray-50 px-3 py-1.5 rounded text-xs hover:bg-gray-100 text-blue-600 border border-blue-100 font-medium transition-colors"><Upload size={14}/> Import CSV<input type="file" accept=".csv" className="hidden" onChange={handleImportCSV}/></label>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <div className="flex-1 grid grid-cols-12 gap-3 items-start content-start">
                                    <div className="col-span-3">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase">SKU</label>
                                        <input className="border p-2 text-sm rounded w-full bg-gray-50 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none" value={matSku} onChange={e => setMatSku(e.target.value)} placeholder="S248"/>
                                    </div>
                                    <div className="col-span-5">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase">Description</label>
                                        <input className="border p-2 text-sm rounded w-full bg-gray-50 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none" value={matName} onChange={e => setMatName(e.target.value)} placeholder="HardiePlank"/>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase">Category</label>
                                        <CategorySelector current={matCategory} existing={allMatCategories} onChange={setMatCategory} placeholder="Select..."/>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase">UOM</label>
                                        <select className="border p-2 text-sm rounded w-full bg-white" value={matUom} onChange={e => setMatUom(e.target.value)}>
                                            <option value="EA">EA</option>
                                            <option value="LNFT">LNFT</option>
                                            <option value="SQFT">SQFT</option>
                                        </select>
                                    </div>

                                    <div className="col-span-12">
                                        <div className="flex items-center gap-2 mb-2">
                                            <input type="checkbox" id="specialOrderCheck" checked={matIsSpecialOrder} onChange={e => setMatIsSpecialOrder(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500"/>
                                            <label htmlFor="specialOrderCheck" className="text-xs font-bold text-gray-700 select-none cursor-pointer">Special Order Item?</label>
                                        </div>

                                        {matIsSpecialOrder && (
                                            <div className="p-3 bg-blue-50/50 border border-blue-100 rounded animate-in fade-in slide-in-from-top-2">
                                                <div className="grid grid-cols-2 gap-4 mb-3">
                                                    <div>
                                                        <label className="text-[10px] font-bold text-blue-700 uppercase">Default Variant</label>
                                                        <select
                                                            className="border p-2 text-sm rounded w-full bg-white"
                                                            value={matDefaultVariantId}
                                                            onChange={e => setMatDefaultVariantId(e.target.value)}
                                                        >
                                                            <option value="">-- Select Default --</option>
                                                            {matVariants.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                                        </select>
                                                    </div>
                                                </div>

                                                <div className="bg-white rounded border p-2">
                                                    <h5 className="text-[10px] font-bold text-gray-500 uppercase mb-2 flex items-center gap-1"><List size={12}/> Options</h5>

                                                    {/* Variant Creator */}
                                                    <div className="bg-gray-50 p-2 rounded mb-2 border border-dashed border-gray-300">
                                                        <input className="w-full border p-1.5 text-xs rounded mb-2" placeholder="Option" value={newVariantName} onChange={e => setNewVariantName(e.target.value)} />

                                                        <div className="flex gap-2 mb-2">
                                                            <input className="flex-1 border p-1.5 text-xs rounded" placeholder="Prop Key (e.g. coverage)" value={newVarPropKey} onChange={e => setNewVarPropKey(e.target.value)} />
                                                            <input className="w-24 border p-1.5 text-xs rounded" placeholder="Value" type="number" value={newVarPropVal} onChange={e => setNewVarPropVal(e.target.value)} />
                                                            <button onClick={handleAddVariantProp} className="bg-gray-200 px-2 rounded text-xs">+</button>
                                                        </div>

                                                        {newVariantProps.length > 0 && (
                                                            <div className="flex flex-wrap gap-1 mb-2">
                                                                {newVariantProps.map((p, idx) => (
                                                                    <span key={idx} className="bg-white border px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1">
                                                                        <b>{p.key}:</b> {p.value}
                                                                        <button onClick={() => setNewVariantProps(prev => prev.filter((_, i) => i !== idx))}><X size={10}/></button>
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}

                                                        <button onClick={handleAddVariant} className="w-full bg-blue-600 text-white text-xs py-1.5 rounded hover:bg-blue-700">Add Variant</button>
                                                    </div>

                                                    {/* Variant List */}
                                                    <div className="space-y-1 max-h-40 overflow-y-auto">
                                                        {matVariants.map(v => (
                                                            <div key={v.id} className="flex justify-between items-center p-2 border rounded text-xs hover:bg-gray-50">
                                                                <div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="font-bold">{v.name}</span>
                                                                        {v.id === matDefaultVariantId && <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[10px] font-bold">DEFAULT</span>}
                                                                    </div>
                                                                    <div className="text-[10px] text-gray-500">{JSON.stringify(v.properties)}</div>
                                                                </div>
                                                                <button onClick={() => handleDeleteVariant(v.id)} className="text-gray-400 hover:text-red-500"><X size={14}/></button>
                                                            </div>
                                                        ))}
                                                        {matVariants.length === 0 && <div className="text-center text-gray-400 italic text-[10px] py-2">No Options defined.</div>}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="w-32 flex flex-col gap-2 shrink-0">
                                    <button className={`w-full py-2 rounded text-sm text-white font-medium shadow-sm transition-all ${editingMatId ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-600 hover:bg-blue-700'}`} onClick={handleSaveMaterial}>{editingMatId ? 'Update' : 'Add New'}</button>
                                    {editingMatId && <button onClick={handleClearMaterialForm} className="px-2 py-2 bg-gray-200 hover:bg-gray-300 rounded text-gray-600 text-sm">Cancel Edit</button>}
                                </div>
                            </div>
                        </div>
                        {/* Material List */}
                        <div className="bg-white rounded-lg shadow-sm border flex-1 flex flex-col overflow-hidden min-h-0">
                            <div className="p-3 border-b bg-gray-50 flex items-center gap-2 shrink-0">
                                <Search size={16} className="text-gray-400"/><input className="w-full bg-transparent text-sm outline-none placeholder-gray-400" placeholder="Search materials..." value={matSearch} onChange={e => setMatSearch(e.target.value)}/>
                            </div>
                            <div className="flex-1 overflow-y-auto p-2 bg-gray-50">
                                {matSearch ? (
                                    <div className="space-y-1">
                                        {filteredMaterials.map(m => (
                                            <div key={m.id} className="flex justify-between items-center p-3 border rounded bg-white shadow-sm hover:shadow-md transition-shadow">
                                                <div><div className="flex items-center gap-2"><span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 font-bold">{m.sku}</span><span className="font-medium text-sm text-gray-800">{m.name}</span></div>
                                                    <div className="text-xs text-gray-400 mt-0.5">{m.category} • {m.uom} {m.isSpecialOrder && <span className="text-blue-500 font-bold">• Special Order ({m.variants?.length} vars)</span>}</div></div>
                                                <div className="flex gap-1 opacity-60 hover:opacity-100"><button onClick={() => handleEditMaterial(m)} className="p-1.5 hover:bg-blue-50 rounded text-blue-600"><Pencil size={14}/></button><button onClick={() => cloneMaterial(m.id)} className="p-1.5 hover:bg-green-50 rounded text-green-600"><Copy size={14}/></button><button onClick={() => deleteMaterial(m.id)} className="p-1.5 hover:bg-red-50 rounded text-red-600"><Trash2 size={14}/></button></div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    Object.entries(groupedMaterials).sort(([a], [b]) => a.localeCompare(b)).map(([category, items]) => (
                                        <CategoryGroup key={category} title={category}>
                                            <div className="max-h-60 overflow-y-auto">
                                                {items.map(m => (
                                                    <div key={m.id} className={`border-b last:border-0 p-3 flex justify-between items-center bg-white hover:bg-gray-50 ${editingMatId === m.id ? 'bg-orange-50 border-orange-200' : ''}`}>
                                                        <div><div className="flex items-center gap-2"><span className="font-mono text-xs font-bold text-gray-500 w-24 truncate block" title={m.sku}>{m.sku}</span><span className="text-sm font-medium">{m.name}</span></div>
                                                            <div className="text-[10px] text-gray-400 pl-26">{m.uom} {m.isSpecialOrder && <span className="text-blue-500 font-semibold ml-2">→ {m.reportSku} ({m.variants?.length} Options)</span>}</div></div>
                                                        <div className="flex gap-1"><button onClick={() => handleEditMaterial(m)} className="p-1 text-gray-400 hover:text-blue-600"><Pencil size={14}/></button><button onClick={() => cloneMaterial(m.id)} className="p-1 text-gray-400 hover:text-green-600"><Copy size={14}/></button><button onClick={() => deleteMaterial(m.id)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={14}/></button></div>
                                                    </div>
                                                ))}
                                            </div>
                                        </CategoryGroup>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}
                {/* ... (Assemblies Tab remains consistent) ... */}
                {activeSubTab === 'assemblies' && (
                    <div className="h-full flex flex-col w-full gap-4">
                        {/* ... (Header UI) ... */}
                        <div className="bg-white p-3 rounded-lg shadow-sm border shrink-0">
                            <div className="flex justify-between items-center mb-3 border-b pb-2">
                                <h3 className="font-bold flex items-center gap-2 text-gray-700"><Cuboid size={16}/> Assembly Database</h3>
                                <div className="flex gap-2">
                                    <button onClick={handleExportAssembliesJSON} className="flex items-center gap-1 bg-green-50 px-3 py-1.5 rounded text-xs hover:bg-green-100 text-green-600 border border-green-100 font-medium transition-colors"><Download size={14}/> Export JSON</button>
                                    <label className="flex items-center gap-1 cursor-pointer bg-gray-50 px-3 py-1.5 rounded text-xs hover:bg-gray-100 text-blue-600 border border-blue-100 font-medium transition-colors"><Upload size={14}/> Import JSON<input type="file" accept=".json" className="hidden" onChange={handleImportAssembliesJSON}/></label>
                                </div>
                            </div>
                            <div className="grid grid-cols-12 gap-3 items-end">
                                <div className="col-span-4"><label className="text-[10px] font-bold text-gray-400 uppercase">Assembly Name</label><input className="border p-2 text-sm rounded w-full bg-gray-50 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none" value={newDefName} onChange={e => setNewDefName(e.target.value)} placeholder="e.g. Wall Framing Assembly"/></div>
                                <div className="col-span-3 lg:col-span-3"><label className="text-[10px] font-bold text-gray-400 uppercase">Category</label><CategorySelector current={newDefCategory} existing={allAsmCategories} onChange={setNewDefCategory} placeholder="Select Category..."/></div>
                                <div className="col-span-5 flex gap-1"><button className="w-full py-2 rounded text-sm bg-green-600 hover:bg-green-700 text-white font-medium shadow-sm transition-all" onClick={() => { if (newDefName) { addAssemblyDef(newDefName, newDefCategory); setNewDefName(''); setNewDefCategory(''); } }}>Add New Assembly</button></div>
                            </div>
                        </div>
                        {/* ... (Main Content) ... */}
                        <div className="bg-white rounded-lg shadow-sm border flex-1 flex overflow-hidden min-h-0">
                            {/* ... (Sidebar) ... */}
                            <div className="w-64 lg:w-80 border-r flex flex-col overflow-hidden shrink-0">
                                <div className="p-3 border-b bg-gray-50 flex items-center gap-2 shrink-0"><Search size={16} className="text-gray-400"/><input className="w-full bg-transparent text-sm outline-none placeholder-gray-400" placeholder="Search assemblies..." value={asmSearch} onChange={e => setAsmSearch(e.target.value)}/></div>
                                <div className="flex-1 overflow-y-auto p-2 bg-gray-50 min-h-0">
                                    {asmSearch ? (
                                        <div className="space-y-1">{filteredAssemblies.map(d => (<div key={d.id} className={`p-2 border-b rounded bg-white shadow-sm flex justify-between items-center group cursor-pointer hover:bg-gray-50 ${activeDefId === d.id ? 'bg-blue-50 border border-blue-200' : ''}`} onClick={() => setActiveDefId(d.id)}><div><div className="truncate text-sm font-medium text-gray-700">{d.name}</div><div className="text-xs text-gray-400">{d.category}</div></div><div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={(e) => { e.stopPropagation(); cloneAssemblyDef(d.id); }} className="p-1 text-green-600 hover:bg-white rounded"><Copy size={12}/></button><button onClick={(e) => { e.stopPropagation(); deleteAssemblyDef(d.id); }} className="p-1 text-red-600 hover:bg-white rounded"><Trash2 size={12}/></button></div></div>))}</div>
                                    ) : (
                                        Object.entries(groupedAssemblies).sort(([a], [b]) => a.localeCompare(b)).map(([category, items]) => (<CategoryGroup key={category} title={category}><div className="max-h-48 overflow-y-auto">{items.map(d => (<div key={d.id} className={`p-2 border-b last:border-0 flex justify-between items-center group cursor-pointer hover:bg-gray-50 ${activeDefId === d.id ? 'bg-blue-50 border-l-4 border-l-blue-500 pl-1' : ''}`} onClick={() => setActiveDefId(d.id)}><span className="truncate text-sm font-medium text-gray-700">{d.name}</span><div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={(e) => { e.stopPropagation(); cloneAssemblyDef(d.id); }} className="p-1 text-green-600 hover:bg-white rounded"><Copy size={12}/></button><button onClick={(e) => { e.stopPropagation(); deleteAssemblyDef(d.id); }} className="p-1 text-red-600 hover:bg-white rounded"><Trash2 size={12}/></button></div></div>))}</div></CategoryGroup>))
                                    )}
                                </div>
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
                                {activeDef ? (
                                    <div className="flex flex-col h-full">
                                        <div className="p-4 border-b bg-gray-50 flex gap-4 items-end shrink-0">
                                            <div className="flex-[2]"><label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Assembly Name</label><input className="border p-2 text-lg font-bold rounded w-full bg-white focus:ring-1 focus:ring-blue-500 outline-none" value={activeDef.name} onChange={(e) => updateAssemblyDef(activeDef.id, {name: e.target.value})}/></div>
                                            <div className="flex-1"><label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Category</label><CategorySelector current={activeDef.category} existing={allAsmCategories} onChange={(val) => updateAssemblyDef(activeDef.id, {category: val})} placeholder="Select..."/></div>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-6 space-y-6 min-h-0">
                                            {/* Variables */}
                                            <div className="p-4 rounded border border-yellow-200 bg-yellow-50/50">
                                                <h5 className="text-xs font-bold uppercase text-yellow-700 mb-3 flex items-center gap-2">1. Input Variables</h5>
                                                <div className="flex flex-wrap gap-2 mb-4">{activeDef.variables.map(v => (<span key={v.id} className="inline-flex items-center gap-1 bg-white text-gray-700 text-xs pl-2 pr-1 py-1 rounded border shadow-sm"><span className="font-bold">{v.name}</span> <span className="text-gray-400">({v.type})</span><button onClick={() => deleteVariableFromDef(activeDef.id, v.id)} className="ml-1 p-0.5 hover:bg-red-100 hover:text-red-600 rounded"><X size={12}/></button></span>))}</div>
                                                <div className="flex gap-2"><input className="border p-1.5 text-xs rounded focus:ring-1 focus:ring-yellow-400 outline-none" placeholder="Name" value={newVarName} onChange={e => setNewVarName(e.target.value)}/><select className="border p-1.5 text-xs rounded focus:ring-1 focus:ring-yellow-400 outline-none" value={newVarType} onChange={e => setNewVarType(e.target.value as any)}><option value="linear">Linear</option><option value="area">Area</option><option value="count">Count</option><option value="number">Number</option></select><button className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1.5 rounded text-xs font-bold transition-colors" onClick={() => { if (newVarName) { addVariableToDef(activeDef.id, newVarName, newVarType as any); setNewVarName(''); } }}><Plus size={14}/></button></div>
                                            </div>
                                            {/* Logic Nodes */}
                                            <div className="p-4 rounded border border-blue-200 bg-blue-50/30">
                                                <h5 className="text-xs font-bold uppercase text-blue-700 mb-3">2. Calculation Logic</h5>
                                                <div className="space-y-2 mb-4">
                                                    {activeDef.children.map((c) => (
                                                        <div key={c.id} className={`text-sm border p-3 rounded flex flex-col gap-2 bg-white shadow-sm transition-opacity ${editingNodeId === c.id ? 'ring-2 ring-blue-400 border-transparent' : ''} ${draggedNodeId === c.id ? 'opacity-40' : 'opacity-100'}`} draggable onDragStart={(e) => handleNodeDragStart(e, c.id)} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }} onDrop={(e) => handleNodeDrop(e, c.id)}>
                                                            <div className="flex justify-between items-center"><div className="flex items-center gap-3"><GripVertical size={14} className="text-gray-300 cursor-move" /><span className="font-mono bg-gray-100 px-2 py-0.5 border rounded text-blue-700 font-bold text-xs">{c.formula}</span><span className="text-gray-400 text-xs">&rarr;</span>{c.isDynamic ? (<span className="font-medium text-purple-700 flex items-center gap-1"><Layers size={14}/>{c.variantIds?.length || 0} Dynamic Mats</span>) : (<span className="font-medium text-gray-800">{c.childType === 'material' ? materials.find(m => m.id === c.childId)?.name : assemblyDefs.find(a => a.id === c.childId)?.name}</span>)}{c.alias && (<span className="text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded border border-yellow-200">As: {c.alias}</span>)}</div><div className="flex gap-1"><button onClick={() => handleEditNode(c)} className="text-gray-400 hover:text-blue-600 p-1"><Pencil size={14}/></button><button onClick={() => removeNodeFromDef(activeDef.id, c.id)} className="text-gray-400 hover:text-red-600 p-1"><Trash2 size={14}/></button></div></div>
                                                            {c.childType === 'material' && (<div className="text-[10px] text-gray-400 pl-6 flex gap-3"><span>Ref SKU: <code className="bg-gray-100 px-1 rounded">{materials.find(m => m.id === (c.isDynamic ? c.defaultVariantId : c.childId))?.sku || "N/A"}</code></span>{!c.isDynamic && materials.find(m => m.id === c.childId)?.isSpecialOrder && (<span className="text-blue-500 font-bold"> Special Order ({materials.find(m => m.id === c.childId)?.variants?.length} Options)</span>)}</div>)}
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className={`border p-4 rounded-lg space-y-3 transition-all overflow-x-auto ${editingNodeId ? 'bg-orange-50 border-orange-300 ring-1 ring-orange-200' : 'bg-white'}`}>
                                                    <div className="flex gap-2 min-w-[500px] flex-col lg:flex-row">
                                                        <div className="flex gap-2 flex-1">
                                                            <select className="border p-2 text-xs rounded bg-white" value={nodeType} onChange={e => { setNodeType(e.target.value as any); setNodeChildId(''); setIsDynamicNode(false); }}><option value="material">Add Material</option><option value="assembly">Add Sub-Assembly</option></select>
                                                            {!isDynamicNode ? (
                                                                <SearchableSelector items={nodeType === 'material' ? materials.map(m => ({ id: m.id, name: m.name, category: m.category || 'Uncategorized', secondaryText: m.sku })) : assemblyDefs.filter(a => a.id !== activeDefId).map(a => ({ id: a.id, name: a.name, category: a.category || 'Uncategorized' }))} value={nodeChildId} onChange={setNodeChildId} placeholder="Search..." className="flex-1"/>
                                                            ) : (<div className="flex-1 p-2 border rounded bg-purple-50 border-purple-200 flex items-center justify-center text-xs text-purple-700 font-bold">Dynamic Mode Active</div>)}
                                                        </div>
                                                        {nodeType === 'material' && (<div className="flex items-center gap-2"><input type="checkbox" id="dynamicCheck" checked={isDynamicNode} onChange={e => setIsDynamicNode(e.target.checked)} className="rounded text-purple-600 focus:ring-purple-500"/><label htmlFor="dynamicCheck" className="text-xs font-bold text-gray-600 select-none cursor-pointer">Dynamic?</label></div>)}
                                                    </div>
                                                    {isDynamicNode && nodeType === 'material' && (
                                                        <div className="bg-purple-50 p-3 rounded border border-purple-100">
                                                            <label className="block text-[10px] font-bold text-purple-700 uppercase mb-2">Select Variant SKUs</label>
                                                            <div className="flex gap-2 mb-2"><SearchableSelector items={materials.map(m => ({ id: m.id, name: m.name, category: m.category || 'Uncategorized', secondaryText: m.sku }))} value="" onChange={handleAddVariantToDynamic} placeholder="Search to add variant..." className="flex-1"/></div>
                                                            <div className="space-y-1 max-h-32 overflow-y-auto mb-2 bg-white border rounded p-2">{variantIds.length === 0 && <div className="text-xs text-gray-400 italic">No variants selected</div>}{variantIds.map(vid => { const mat = materials.find(m => m.id === vid); return (<div key={vid} className="flex justify-between items-center text-xs p-1 hover:bg-gray-50 rounded"><span>{mat?.name || vid}</span><button onClick={() => setVariantIds(ids => ids.filter(id => id !== vid))} className="text-red-500 hover:bg-red-50 p-1 rounded"><X size={12}/></button></div>); })}</div>
                                                            <div className="flex items-center gap-2"><label className="text-[10px] font-bold text-gray-500">Default:</label><select className="border p-1 text-xs rounded flex-1" value={defaultVariantId} onChange={e => setDefaultVariantId(e.target.value)}><option value="">Select Default...</option>{variantIds.map(vid => { const mat = materials.find(m => m.id === vid); return <option key={vid} value={vid}>{mat?.name || vid}</option>; })}</select></div>
                                                        </div>
                                                    )}
                                                    <div className="flex gap-2 min-w-[500px]"><div className="flex-1 flex gap-2"><input className="border p-2 text-xs rounded flex-1 bg-white font-mono" placeholder="Formula (e.g. Area / coverage_per_piece)" value={nodeFormula} onChange={e => setNodeFormula(e.target.value)}/><input className="border p-2 text-xs rounded w-32 bg-white" placeholder="Optional Alias" value={nodeAlias} onChange={e => setNodeAlias(e.target.value)}/></div><button className={`text-white px-4 py-1.5 text-xs rounded font-bold transition-colors ${editingNodeId ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-600 hover:bg-blue-700'}`} onClick={handleSaveNode}>{editingNodeId ? 'Update' : 'Add'}</button></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center h-full text-gray-400 flex-col gap-2"><Cuboid size={48} className="opacity-20"/><span>Select an Assembly to edit</span></div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AssemblyBuilder;