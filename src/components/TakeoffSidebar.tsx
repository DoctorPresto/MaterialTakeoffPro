import {useState, useMemo} from 'react';
import {useStore} from '../store';
import {ChevronDown, ChevronRight, Folder, Settings, Trash2, X} from 'lucide-react';
import {AssemblyDef, ItemSet, Measurement} from '../types';
import {SearchableSelector} from './SearchableSelector';

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
    const [selectorKey, setSelectorKey] = useState(0);

    const sourceItems = useMemo(() => {
        // FIX: Explicitly type the array to support the optional 'secondaryText' property
        const items: { id: string; name: string; category: string; secondaryText?: string }[] = [
            { id: 'manual', name: 'Manual Input', category: 'General' }
        ];

        // Add individual measurements grouped by their group name
        measurements.forEach(m => {
            items.push({
                id: m.id,
                name: m.name,
                category: m.group ? `Group: ${m.group}` : 'Ungrouped',
                secondaryText: m.type
            });
        });

        // Add groups themselves as selectable items
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

    return (
        <div className="border rounded-lg overflow-hidden bg-white shadow-sm mb-4">
            <div className="bg-gray-100 p-2 flex justify-between items-center border-b cursor-pointer select-none"
                 onClick={() => setIsOpen(!isOpen)}>
                <div className="font-bold text-sm flex items-center gap-2">{isOpen ? <ChevronDown size={14}/> :
                    <ChevronRight size={14}/>}<Folder size={14} className="text-blue-500"/> {itemSet.name}</div>
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
                            return (
                                <div key={inst.id} className="p-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-medium">{inst.name}</span>
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
                                                                            const property = v.type === 'area' ? 'area' : v.type === 'count' ? 'count' : 'linear';
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
                                                                            <option value="length">Len</option>
                                                                            <option value="perimeter">Perim</option>
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
                                                                        <option value="linear">Len</option>
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
        addInstanceToSet,
        deleteInstanceFromSet,
        updateInstanceVariable
    } = useStore();
    const [newItemSetName, setNewItemSetName] = useState('');

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
                        <CollapsibleItemSet key={set.id} itemSet={set} assemblyDefs={assemblyDefs}
                                            measurements={measurements} onDelete={() => deleteItemSet(set.id)}
                                            onAddInstance={(defId) => addInstanceToSet(set.id, defId)}
                                            onDeleteInstance={(instId) => deleteInstanceFromSet(set.id, instId)}
                                            onUpdateVar={(instId, varId, val) => updateInstanceVariable(set.id, instId, varId, val)}/>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default TakeoffSidebar;