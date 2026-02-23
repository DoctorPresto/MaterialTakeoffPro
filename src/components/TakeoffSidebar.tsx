import React, {useMemo, useState} from 'react';
import {useStore} from '../store';
import {
    ChevronDown,
    ChevronRight,
    Edit3,
    FileText,
    Folder,
    GripVertical,
    Layers,
    MessageSquarePlus,
    Plus,
    Settings,
    Star,
    Trash2,
    X
} from 'lucide-react';
import {AssemblyDef, ItemSet, Measurement} from '../types';
import {SearchableSelector} from './SearchableSelector';
import {resolveValue} from '../engine';
import {applyRounding, evaluateFormula} from '../utils/math';

// Input Modal for Renaming
const NameModal = ({ isOpen, title, initialValue, onSave, onCancel }: { isOpen: boolean, title: string, initialValue: string, onSave: (val: string) => void, onCancel: () => void }) => {
    const [val, setVal] = useState(initialValue);
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
            <div className="bg-white p-4 rounded shadow-lg w-80">
                <h3 className="font-bold text-sm mb-2">{title}</h3>
                <input
                    autoFocus
                    className="border p-2 w-full text-sm rounded mb-4"
                    value={val}
                    onChange={e => setVal(e.target.value)}
                    onKeyDown={e => { if(e.key === 'Enter') onSave(val); }}
                />
                <div className="flex justify-end gap-2">
                    <button onClick={onCancel} className="px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200">Cancel</button>
                    <button onClick={() => onSave(val)} className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">Save</button>
                </div>
            </div>
        </div>
    );
};

const CollapsibleItemSet = ({
                                itemSet,
                                assemblyDefs,
                                measurements,
                                onDelete,
                                onAddInstance,
                                onDeleteInstance,
                                onUpdateVar,
                                onUpdateSelection,
                                onReorderItems,
                                onDragStart,
                                onDragOver,
                                onDrop,
                                onRename,
                                onSaveFavorite,
                                onAddComment,
                                onUpdateManual,
                                onDeleteManual
                            }: {
    itemSet: ItemSet,
    assemblyDefs: AssemblyDef[],
    measurements: Measurement[],
    onDelete: () => void,
    onAddInstance: (defId: string) => void,
    onDeleteInstance: (instId: string) => void,
    onUpdateVar: (instId: string, varId: string, val: any) => void,
    onUpdateSelection: (instId: string, nodeId: string, selectionId: string) => void,
    onReorderItems: (newOrder: any[]) => void,
    onDragStart: (e: React.DragEvent) => void,
    onDragOver: (e: React.DragEvent) => void,
    onDrop: (e: React.DragEvent) => void,
    onRename: () => void,
    onSaveFavorite: () => void,
    onAddComment: () => void,
    onUpdateManual: (id: string, updates: any) => void,
    onDeleteManual: (id: string) => void
}) => {
    const { materials, scale, pageScales } = useStore();
    const [isOpen, setIsOpen] = useState(true);
    const [editingInstanceId, setEditingInstanceId] = useState<string | null>(null);
    const [selectorKey, setSelectorKey] = useState(0);
    const [draggedItemId, setDraggedItemId] = useState<string | null>(null);

    const sourceItems = useMemo(() => {
        const items: { id: string; name: string; category: string; secondaryText?: string }[] = [
            { id: 'manual', name: 'Manual Input', category: 'General' }
        ];

        measurements.forEach(m => {
            items.push({
                id: m.id,
                name: m.name,
                category: m.group ? `Group: ${m.group}` : 'Ungrouped',
                secondaryText: m.type
            });
        });

        const uniqueGroups = Array.from(new Set(measurements.filter(m => m.group).map(m => m.group)));
        uniqueGroups.forEach(group => {
            if (group) {
                items.push({
                    id: `group-${group}`,
                    name: `All in ${group}`,
                    category: `Group: ${group}`,
                    secondaryText: 'Group Total'
                });
            }
        });

        return items;
    }, [measurements]);

    // MERGE & SORT LISTS (Assemblies + Manual Items)
    const sortedItems = useMemo(() => {
        const order = itemSet.itemOrder || [];
        const asmMap = new Map(itemSet.assemblies.map(a => [a.id, a]));
        const manMap = new Map(itemSet.manualItems.map(m => [m.id, m]));

        const merged: { type: 'assembly' | 'manual', data: any }[] = [];
        const usedIds = new Set<string>();

        // Explicit order
        order.forEach(id => {
            if (asmMap.has(id)) {
                merged.push({ type: 'assembly', data: asmMap.get(id) });
                usedIds.add(id);
            } else if (manMap.has(id)) {
                merged.push({ type: 'manual', data: manMap.get(id) });
                usedIds.add(id);
            }
        });

        // Fallback for unordered
        itemSet.assemblies.forEach(a => { if (!usedIds.has(a.id)) merged.push({ type: 'assembly', data: a }); });
        itemSet.manualItems.forEach(m => { if (!usedIds.has(m.id)) merged.push({ type: 'manual', data: m }); });

        return merged;
    }, [itemSet]);

    // DnD Handlers
    const handleItemDragStart = (e: React.DragEvent, id: string) => {
        e.stopPropagation();
        e.dataTransfer.setData('type', 'mixed-item');
        e.dataTransfer.setData('itemSetId', itemSet.id);
        setDraggedItemId(id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleItemDrop = (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        e.stopPropagation();

        const type = e.dataTransfer.getData('type');
        const srcItemSetId = e.dataTransfer.getData('itemSetId');

        if (type === 'mixed-item' && srcItemSetId === itemSet.id && draggedItemId && draggedItemId !== targetId) {
            const currentIds = sortedItems.map(i => i.data.id);
            const oldIndex = currentIds.indexOf(draggedItemId);
            const newIndex = currentIds.indexOf(targetId);

            if (oldIndex !== -1 && newIndex !== -1) {
                const newOrder = [...currentIds];
                const [removed] = newOrder.splice(oldIndex, 1);
                newOrder.splice(newIndex, 0, removed);
                onReorderItems(newOrder);
            }
        }
        setDraggedItemId(null);
    };

    return (
        <div
            className="border rounded-lg overflow-hidden bg-white shadow-sm mb-4 transition-all"
            draggable
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
        >
            <div className="bg-gray-100 p-2 flex justify-between items-center border-b cursor-move select-none"
                 onClick={() => setIsOpen(!isOpen)}>
                <div className="font-bold text-sm flex items-center gap-2">
                    <GripVertical size={14} className="text-gray-400" />
                    {isOpen ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                    <Folder size={14} className="text-blue-500"/>
                    <span>{itemSet.name}</span>
                </div>
                <div className="flex gap-1">
                    <button onClick={(e) => { e.stopPropagation(); onRename(); }} className="p-1 text-gray-400 hover:text-blue-600 rounded" title="Rename"><Edit3 size={14}/></button>
                    <button onClick={(e) => { e.stopPropagation(); onSaveFavorite(); }} className="p-1 text-gray-400 hover:text-yellow-500 rounded" title="Save as Favorite"><Star size={14}/></button>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1 text-gray-400 hover:text-red-500 rounded" title="Delete"><Trash2 size={14}/></button>
                </div>
            </div>
            {isOpen && (
                <>
                    <div className="p-2 bg-gray-50 border-b space-y-2">
                        <SearchableSelector
                            key={selectorKey}
                            items={assemblyDefs.map(a => ({
                                id: a.id,
                                name: a.name,
                                category: a.category || 'Uncategorized'
                            }))}
                            value=""
                            onChange={(id) => {
                                if (id) {
                                    onAddInstance(id);
                                    setSelectorKey(prev => prev + 1);
                                }
                            }}
                            placeholder="+ Add to itemset..."
                            className="text-xs"
                        />
                        <button onClick={onAddComment} className="w-full text-xs py-1.5 flex items-center justify-center gap-1 bg-white text-gray-400 border border-b rounded hover:bg-gray-50">
                            <MessageSquarePlus size={14} /> Add Comment
                        </button>
                    </div>
                    <div className="divide-y">
                        {sortedItems.map(({type, data}) => {
                            const isDragging = draggedItemId === data.id;

                            // RENDER ASSEMBLY
                            if (type === 'assembly') {
                                const inst = data;
                                const def = assemblyDefs.find(d => d.id === inst.assemblyDefId);
                                const isEditing = editingInstanceId === inst.id;

                                // Context for dynamic filtering
                                const context: Record<string, number> = {};
                                if (def) {
                                    def.variables.forEach(v => {
                                        const source = inst.variableValues[v.id];
                                        if (source) context[v.name] = resolveValue(source, measurements, scale, pageScales);
                                        else context[v.name] = 0;
                                    });
                                }

                                // Identify Dynamic Nodes
                                const dynamicNodes = def?.children.filter((c: any) => {
                                    if (!c.isDynamic || !c.variantIds || c.variantIds.length === 0) return false;
                                    try { const qty = applyRounding(evaluateFormula(c.formula, context), c.round); return qty > 0; } catch (e) { return false; }
                                }) || [];

                                // Identify Variant Nodes (Special Order Materials)
                                const variantNodes = def?.children.filter((c: any) => {
                                    let matId = c.childId;
                                    if (c.isDynamic) matId = (inst.selections && inst.selections[c.id]) || c.defaultVariantId;
                                    const mat = materials.find(m => m.id === matId);
                                    if (mat && mat.variants && mat.variants.length > 0) {
                                        try { const qty = applyRounding(evaluateFormula(c.formula, context), c.round); return qty > 0; } catch (e) { return false; }
                                    }
                                    return false;
                                }) || [];

                                return (
                                    <div
                                        key={inst.id}
                                        className={`p-2 transition-opacity ${isDragging ? 'opacity-40' : 'opacity-100'}`}
                                        draggable
                                        onDragStart={(e) => handleItemDragStart(e, inst.id)}
                                        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                                        onDrop={(e) => handleItemDrop(e, inst.id)}
                                    >
                                        <div className="flex justify-between items-center cursor-move">
                                            <div className="flex items-center gap-2">
                                                <GripVertical size={14} className="text-gray-300" />
                                                <span className="text-sm font-medium">{inst.name}</span>
                                            </div>
                                            <div className="flex gap-1">
                                                <button onClick={() => setEditingInstanceId(isEditing ? null : inst.id)}
                                                        className={`p-1 rounded ${isEditing ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-400'}`}>
                                                    <Settings size={14}/></button>
                                                <button onClick={() => onDeleteInstance(inst.id)}
                                                        className="p-1 hover:bg-gray-100 text-gray-400 hover:text-red-500 rounded">
                                                    <X size={14}/></button>
                                            </div>
                                        </div>
                                        {isEditing && def && (
                                            <div className="mt-2 space-y-2">
                                                <div className="p-2 bg-blue-50/50 rounded border border-blue-100 text-xs space-y-2">
                                                    <div className="font-bold text-gray-400 text-[10px] uppercase">Variables</div>
                                                    {def.variables.map(v => {
                                                        const currentVal = inst.variableValues[v.id];
                                                        const selectorValue = currentVal?.type === 'measurement'
                                                            ? (currentVal as any).measurementId
                                                            : currentVal?.type === 'measurementGroup'
                                                                ? `group-${(currentVal as any).groupId}`
                                                                : 'manual';

                                                        return (
                                                            <div key={v.id}>
                                                                <div className="flex justify-between mb-1 text-gray-600 font-semibold">
                                                                    <span>{v.name}</span>
                                                                    <span className="font-normal text-[10px] opacity-70">({v.type})</span>
                                                                </div>
                                                                {v.type === 'pitch' ? (
                                                                    <input
                                                                        type="text"
                                                                        className="w-full border rounded p-1 font-mono"
                                                                        value={(inst.variableValues[v.id] as any)?.value || ''}
                                                                        onChange={(e) => onUpdateVar(inst.id, v.id, { type: 'manual', value: e.target.value })}
                                                                        placeholder="e.g. 5/12"
                                                                    />
                                                                ) : v.type === 'boolean' ? (
                                                                    <select
                                                                        className="w-full border rounded p-1 bg-white"
                                                                        value={(inst.variableValues[v.id] as any)?.value || 0}
                                                                        onChange={(e) => onUpdateVar(inst.id, v.id, { type: 'manual', value: parseInt(e.target.value) })}
                                                                    >
                                                                        <option value={0}>False</option>
                                                                        <option value={1}>True</option>
                                                                    </select>
                                                                ) : (
                                                                    <div className="flex gap-1">
                                                                        <SearchableSelector
                                                                            items={sourceItems}
                                                                            value={selectorValue}
                                                                            placeholder="Search source..."
                                                                            className="flex-1"
                                                                            onChange={(id) => {
                                                                                if (id === 'manual') {
                                                                                    onUpdateVar(inst.id, v.id, { type: 'manual', value: 0 });
                                                                                } else if (id.startsWith('group-')) {
                                                                                    const groupId = id.replace('group-', '');
                                                                                    const property = v.type === 'area' ? 'area' : v.type === 'count' ? 'count' : 'length';
                                                                                    onUpdateVar(inst.id, v.id, { type: 'measurementGroup', groupId, property });
                                                                                } else {
                                                                                    const property = v.type === 'area' ? 'area' : v.type === 'count' ? 'count' : 'length';
                                                                                    onUpdateVar(inst.id, v.id, { type: 'measurement', measurementId: id, property });
                                                                                }
                                                                            }}
                                                                        />
                                                                        {inst.variableValues[v.id]?.type === 'manual' ? (
                                                                            <input type="number" className="w-16 border rounded p-1"
                                                                                   value={(inst.variableValues[v.id] as any).value}
                                                                                   onChange={(e) => onUpdateVar(inst.id, v.id, { type: 'manual', value: parseFloat(e.target.value) })}/>
                                                                        ) : inst.variableValues[v.id]?.type === 'measurement' ? (
                                                                            v.type !== 'area' && (inst.variableValues[v.id] as any).measurementId && (
                                                                                <select className="w-20 border rounded p-1"
                                                                                        value={(inst.variableValues[v.id] as any).property}
                                                                                        onChange={(e) => onUpdateVar(inst.id, v.id, { ...(inst.variableValues[v.id] as any), property: e.target.value })}>
                                                                                    <option value="length">Length</option>
                                                                                    <option value="area">Area</option>
                                                                                    <option value="count">Count</option>
                                                                                </select>
                                                                            )
                                                                        ) : inst.variableValues[v.id]?.type === 'measurementGroup' ? (
                                                                            <select className="w-20 border rounded p-1"
                                                                                    value={(inst.variableValues[v.id] as any).property}
                                                                                    onChange={(e) => onUpdateVar(inst.id, v.id, { ...(inst.variableValues[v.id] as any), property: e.target.value })}>
                                                                                <option value="length">Length</option>
                                                                                <option value="area">Area</option>
                                                                                <option value="count">Count</option>
                                                                            </select>
                                                                        ) : null}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                {dynamicNodes.length > 0 && (
                                                    <div className="p-2 bg-purple-50/50 rounded border border-purple-100 text-xs space-y-2">
                                                        <div className="font-bold text-purple-700 text-[10px] uppercase flex items-center gap-1"><Layers size={10}/> Dynamic Selections</div>
                                                        {dynamicNodes.map(node => {
                                                            const currentSelection = (inst.selections && inst.selections[node.id]) || node.defaultVariantId || '';
                                                            const defaultMat = materials.find(m => m.id === node.defaultVariantId);
                                                            const label = node.alias || (defaultMat ? `Variant for ${defaultMat.name}` : 'Material Selection');
                                                            return (
                                                                <div key={node.id}>
                                                                    <div className="mb-1 text-gray-600 font-semibold">{label}</div>
                                                                    <select
                                                                        className="w-full border rounded p-1 bg-white"
                                                                        value={currentSelection}
                                                                        onChange={(e) => onUpdateSelection(inst.id, node.id, e.target.value)}
                                                                    >
                                                                        {node.variantIds?.map(vid => {
                                                                            const mat = materials.find(m => m.id === vid);
                                                                            return <option key={vid} value={vid}>{mat ? `${mat.name} (${mat.sku})` : vid}</option>;
                                                                        })}
                                                                    </select>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}

                                                {/* Variant Selections (Special Order) */}
                                                {variantNodes.length > 0 && (
                                                    <div className="p-2 bg-indigo-50/50 rounded border border-indigo-100 text-xs space-y-2">
                                                        {variantNodes.map((node: any) => {
                                                            const matId = (c => c.isDynamic ? ((inst.selections && inst.selections[c.id]) || c.defaultVariantId) : c.childId)(node);
                                                            const mat = materials.find(m => m.id === matId);
                                                            if (!mat || !mat.variants) return null;

                                                            return (
                                                                <div key={node.id}>
                                                                    <div className="mb-1 text-gray-600 font-semibold">{mat.sku} Options</div>
                                                                    <select
                                                                        className="w-full border rounded p-1 bg-white"
                                                                        value={(inst.selections && inst.selections[`${node.id}_variant`]) || ''}
                                                                        onChange={(e) => onUpdateSelection(inst.id, `${node.id}_variant`, e.target.value)}
                                                                    >
                                                                        <option value="">Select Option...</option>
                                                                        {mat.variants.map((v: any) => (
                                                                            <option key={v.id} value={v.id}>{v.name}</option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            } else {
                                // RENDER MANUAL ITEM (COMMENT)
                                const item = data;
                                return (
                                    <div
                                        key={item.id}
                                        className={`p-2 bg-white flex items-start gap-2 group transition-opacity ${isDragging ? 'opacity-40' : 'opacity-100'}`}
                                        draggable
                                        onDragStart={(e) => handleItemDragStart(e, item.id)}
                                        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                                        onDrop={(e) => handleItemDrop(e, item.id)}
                                    >
                                        <GripVertical size={14} className="text-gray-300 mt-1 shrink-0 cursor-move hover:text-gray-500" />
                                        {item.sku === 'COMMENT' ? <div className="text-yellow-600 mt-1 shrink-0" /> : <FileText size={14} className="text-gray-500 mt-1 shrink-0" />}
                                        <div className="flex-1 space-y-1 min-w-0">
                                            {item.sku === 'COMMENT' ? (
                                                <textarea
                                                    className="w-full text-xs bg-transparent border-b border-transparent focus:border-blue-400 outline-none resize-none font-medium text-gray-700"
                                                    rows={2}
                                                    value={item.description}
                                                    placeholder="Type comment..."
                                                    onChange={(e) => onUpdateManual(item.id, { description: e.target.value })}
                                                />
                                            ) : (
                                                <div className="text-xs font-medium">{item.description}</div>
                                            )}
                                            {item.sku !== 'COMMENT' && (
                                                <div className="flex items-center gap-2 text-[10px] text-gray-500">
                                                    <span>Qty:</span>
                                                    <input
                                                        type="number"
                                                        className="w-12 border rounded px-1 bg-white"
                                                        value={item.quantity}
                                                        onChange={(e) => onUpdateManual(item.id, { quantity: parseFloat(e.target.value) })}
                                                    />
                                                    <span>{item.uom}</span>
                                                </div>
                                            )}
                                        </div>
                                        <button onClick={() => onDeleteManual(item.id)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100"><X size={14}/></button>
                                    </div>
                                );
                            }
                        })}
                        {sortedItems.length === 0 && <div className="p-2 text-xs text-gray-400 italic text-center">Empty set</div>}
                    </div>
                </>
            )}
        </div>
    );
};

const TakeoffSidebar = () => {
    const {
        measurements,
        assemblyDefs,
        itemSets,
        favoriteItemSets,
        addItemSet,
        deleteItemSet,
        renameItemSet,
        saveItemSetAsFavorite,
        addItemSetFromFavorite,
        deleteFavoriteItemSet,
        setItemSets,
        addInstanceToSet,
        deleteInstanceFromSet,
        updateInstanceVariable,
        updateInstanceSelection,
        addManualItemToSet,
        updateManualItem,
        deleteManualItem,
        reorderItemsInSet
    } = useStore();
    const [newItemSetName, setNewItemSetName] = useState('');
    const [draggedItemSetId, setDraggedItemSetId] = useState<string | null>(null);
    const [renameModalOpen, setRenameModalOpen] = useState(false);
    const [renameTargetId, setRenameTargetId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [isFavoritesOpen, setIsFavoritesOpen] = useState(true);

    const handleDragStart = (e: React.DragEvent, id: string) => {
        e.dataTransfer.setData('type', 'itemSet');
        setDraggedItemSetId(id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDrop = (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        const type = e.dataTransfer.getData('type');
        if (type === 'itemSet' && draggedItemSetId && draggedItemSetId !== targetId) {
            const newOrder = [...itemSets];
            const oldIndex = newOrder.findIndex(i => i.id === draggedItemSetId);
            const newIndex = newOrder.findIndex(i => i.id === targetId);
            if (oldIndex !== -1 && newIndex !== -1) {
                const [removed] = newOrder.splice(oldIndex, 1);
                newOrder.splice(newIndex, 0, removed);
                setItemSets(newOrder);
            }
        }
        setDraggedItemSetId(null);
    };

    return (
        <div className="w-80 lg:w-96 bg-white border-l h-full flex flex-col z-20 shadow-xl shrink-0">
            <NameModal
                isOpen={renameModalOpen}
                title="Rename Item Set"
                initialValue={renameValue}
                onSave={(val) => { if (renameTargetId) renameItemSet(renameTargetId, val); setRenameModalOpen(false); }}
                onCancel={() => setRenameModalOpen(false)}
            />

            <div className="p-4 border-b bg-gray-50 space-y-3"><h1 className="font-bold text-lg">Item Sets</h1></div>
            <div className="flex-1 overflow-auto p-4">
                <div className="flex gap-2 mb-4">
                    <input className="border p-2 text-sm rounded flex-1" placeholder="New Item Set"
                           value={newItemSetName} onChange={e => setNewItemSetName(e.target.value)}/>
                    <button className="bg-blue-600 text-white p-2 rounded" onClick={() => {
                        if (newItemSetName) {
                            addItemSet(newItemSetName);
                            setNewItemSetName('');
                        }
                    }}>+
                    </button>
                </div>

                {/* FAVORITES SECTION */}
                {favoriteItemSets.length > 0 && (
                    <div className="mb-6">
                        <div
                            className="flex items-center gap-1 mb-2 cursor-pointer text-gray-400 hover:text-gray-600 transition-colors select-none"
                            onClick={() => setIsFavoritesOpen(!isFavoritesOpen)}
                        >
                            {isFavoritesOpen ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                            <h3 className="text-xs font-bold uppercase flex items-center gap-1">
                                <Star size={12}/>Favourites ({favoriteItemSets.length})
                            </h3>
                        </div>

                        {isFavoritesOpen && (
                            <div className="space-y-1 pl-2 border-l-2 border-yellow-100 ml-1">
                                {favoriteItemSets.map(fav => (
                                    <div key={fav.id} className="flex justify-between items-center text-sm p-2 bg-yellow-50 border border-yellow-100 rounded group hover:border-yellow-300 transition-colors cursor-pointer" onClick={() => addItemSetFromFavorite(fav.id)}>
                                        <div className="flex items-center gap-2">
                                            <Plus size={14} className="text-yellow-600"/>
                                            <span className="font-medium text-gray-700">{fav.name}</span>
                                        </div>
                                        <button onClick={(e) => { e.stopPropagation(); deleteFavoriteItemSet(fav.id); }} className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><X size={12}/></button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

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
                            onUpdateSelection={(instId, nodeId, selectionId) => updateInstanceSelection(set.id, instId, nodeId, selectionId)}
                            onReorderItems={(newOrder) => reorderItemsInSet(set.id, newOrder)}
                            onDragStart={(e) => handleDragStart(e, set.id)}
                            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                            onDrop={(e) => handleDrop(e, set.id)}
                            onRename={() => {
                                setRenameTargetId(set.id);
                                setRenameValue(set.name);
                                setRenameModalOpen(true);
                            }}
                            onSaveFavorite={() => saveItemSetAsFavorite(set.id, set.name)}
                            onAddComment={() => addManualItemToSet(set.id, { sku: 'COMMENT', description: "", quantity: 1, uom: 'EACH' })}
                            onUpdateManual={(itemId, updates) => updateManualItem(set.id, itemId, updates)}
                            onDeleteManual={(itemId) => deleteManualItem(set.id, itemId)}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default TakeoffSidebar;