import {useState, useMemo} from 'react';
import {useStore} from '../store';
import {ChevronDown, ChevronRight, Folder, Settings, Trash2, X, GripVertical} from 'lucide-react';
import {AssemblyDef, ItemSet, Measurement} from '../types';
import {SearchableSelector} from './SearchableSelector';

const CollapsibleItemSet = ({
                                itemSet,
                                assemblyDefs,
                                measurements,
                                onDelete,
                                onAddInstance,
                                onDeleteInstance,
                                onUpdateVar,
                                onReorderAssemblies,
                                onDragStart,
                                onDragOver,
                                onDrop
                            }: {
    itemSet: ItemSet,
    assemblyDefs: AssemblyDef[],
    measurements: Measurement[],
    onDelete: () => void,
    onAddInstance: (defId: string) => void,
    onDeleteInstance: (instId: string) => void,
    onUpdateVar: (instId: string, varId: string, val: any) => void,
    onReorderAssemblies: (newOrder: any[]) => void,
    onDragStart: (e: React.DragEvent) => void,
    onDragOver: (e: React.DragEvent) => void,
    onDrop: (e: React.DragEvent) => void
}) => {
    const [isOpen, setIsOpen] = useState(true);
    const [editingInstanceId, setEditingInstanceId] = useState<string | null>(null);
    const [selectorKey, setSelectorKey] = useState(0);
    const [draggedAssemblyId, setDraggedAssemblyId] = useState<string | null>(null);

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

    // Assembly DnD Handlers
    const handleAssemblyDragStart = (e: React.DragEvent, id: string) => {
        e.stopPropagation(); // Prevent item set drag
        e.dataTransfer.setData('type', 'assembly');
        e.dataTransfer.setData('itemSetId', itemSet.id);
        setDraggedAssemblyId(id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleAssemblyDrop = (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        e.stopPropagation();

        const type = e.dataTransfer.getData('type');
        const srcItemSetId = e.dataTransfer.getData('itemSetId');

        if (type === 'assembly' && srcItemSetId === itemSet.id && draggedAssemblyId && draggedAssemblyId !== targetId) {
            const newOrder = [...itemSet.assemblies];
            const oldIndex = newOrder.findIndex(a => a.id === draggedAssemblyId);
            const newIndex = newOrder.findIndex(a => a.id === targetId);

            if (oldIndex !== -1 && newIndex !== -1) {
                const [removed] = newOrder.splice(oldIndex, 1);
                newOrder.splice(newIndex, 0, removed);
                onReorderAssemblies(newOrder);
            }
        }
        setDraggedAssemblyId(null);
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
                    <Folder size={14} className="text-blue-500"/> {itemSet.name}
                </div>
                <button onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                }} className="text-gray-400 hover:text-red-500"><Trash2 size={14}/></button>
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
                    </div>
                    <div className="divide-y">
                        {itemSet.assemblies.map(inst => {
                            const def = assemblyDefs.find(d => d.id === inst.assemblyDefId);
                            const isEditing = editingInstanceId === inst.id;
                            const isDragging = draggedAssemblyId === inst.id;

                            return (
                                <div
                                    key={inst.id}
                                    className={`p-2 transition-opacity ${isDragging ? 'opacity-40' : 'opacity-100'}`}
                                    draggable
                                    onDragStart={(e) => handleAssemblyDragStart(e, inst.id)}
                                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                                    onDrop={(e) => handleAssemblyDrop(e, inst.id)}
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
                                        <div
                                            className="mt-2 p-2 bg-blue-50/50 rounded border border-blue-100 text-xs space-y-2">
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
                                                                onChange={(e) => onUpdateVar(inst.id, v.id, {
                                                                    type: 'manual',
                                                                    value: e.target.value
                                                                })}
                                                                placeholder="e.g. 5/12"
                                                            />
                                                        ) : v.type === 'boolean' ? (
                                                            <select
                                                                className="w-full border rounded p-1 bg-white"
                                                                value={(inst.variableValues[v.id] as any)?.value || 0}
                                                                onChange={(e) => onUpdateVar(inst.id, v.id, {
                                                                    type: 'manual',
                                                                    value: parseInt(e.target.value)
                                                                })}
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
                                                                           onChange={(e) => onUpdateVar(inst.id, v.id, {
                                                                               type: 'manual',
                                                                               value: parseFloat(e.target.value)
                                                                           })}/>
                                                                ) : inst.variableValues[v.id]?.type === 'measurement' ? (
                                                                    v.type !== 'area' && (inst.variableValues[v.id] as any).measurementId && (
                                                                        <select className="w-20 border rounded p-1"
                                                                                value={(inst.variableValues[v.id] as any).property}
                                                                                onChange={(e) => onUpdateVar(inst.id, v.id, {
                                                                                    ...(inst.variableValues[v.id] as any),
                                                                                    property: e.target.value
                                                                                })}>
                                                                            {/* UPDATED: Removed Perimeter, Length handles both */}
                                                                            <option value="length">Length</option>
                                                                            <option value="area">Area</option>
                                                                            <option value="count">Count</option>
                                                                        </select>
                                                                    )
                                                                ) : inst.variableValues[v.id]?.type === 'measurementGroup' ? (
                                                                    <select className="w-20 border rounded p-1"
                                                                            value={(inst.variableValues[v.id] as any).property}
                                                                            onChange={(e) => onUpdateVar(inst.id, v.id, {
                                                                                ...(inst.variableValues[v.id] as any),
                                                                                property: e.target.value
                                                                            })}>
                                                                        {/* UPDATED: Removed Linear, use Length */}
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
                                    )}
                                </div>
                            );
                        })}
                        {itemSet.assemblies.length === 0 &&
                            <div className="p-2 text-xs text-gray-400 italic text-center">Empty set</div>}
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
        addItemSet,
        deleteItemSet,
        setItemSets,
        updateItemSet,
        addInstanceToSet,
        deleteInstanceFromSet,
        updateInstanceVariable
    } = useStore();
    const [newItemSetName, setNewItemSetName] = useState('');
    const [draggedItemSetId, setDraggedItemSetId] = useState<string | null>(null);

    // ItemSet DnD Handlers
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
                            onReorderAssemblies={(newAssemblies) => updateItemSet(set.id, { assemblies: newAssemblies })}
                            onDragStart={(e) => handleDragStart(e, set.id)}
                            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                            onDrop={(e) => handleDrop(e, set.id)}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default TakeoffSidebar;