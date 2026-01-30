import React, { useMemo, useState } from 'react';
import {
    ChevronDown, ChevronRight, ChevronUp, GripVertical, List, MousePointer2, Move, Ruler, Settings, Spline, Square, Eye, EyeOff
} from 'lucide-react';
import { Measurement } from '../../types';
import { getGroupColor } from './utils';
import { useDraggable } from '../../hooks/useDraggable';

export const FloatingDrawingPanel = ({
                                         activeTool,
                                         onToolChange,
                                         isCollapsed,
                                         onToggleCollapse,
                                         measurements,
                                         activePageIndex,
                                         onSelectMeasurement,
                                         selectedMeasurement,
                                         onToggleMeasurementVisibility,
                                         onOpenProperties,
                                         onUpdateMeasurement,
                                         onReorderMeasurements,
                                         groupColors
                                     }: {
    activeTool: string,
    onToolChange: (tool: 'select' | 'line' | 'shape' | 'measure') => void,
    isCollapsed: boolean, onToggleCollapse: () => void, measurements: Measurement[], activePageIndex: number,
    onSelectMeasurement: (id: string) => void, selectedMeasurement: string | null,
    onToggleMeasurementVisibility: (id: string) => void,
    onOpenProperties: (id: string) => void,
    onUpdateMeasurement: (id: string, updates: any) => void,
    onReorderMeasurements: (newGroupOrder: string[]) => void,
    groupColors: Record<string, string>
}) => {
    const { position, handleMouseDown } = useDraggable(20, 100);
    const [showGroupsList, setShowGroupsList] = useState(true);
    const [draggedMeasurementId, setDraggedMeasurementId] = useState<string | null>(null);
    const [dropTargetGroup, setDropTargetGroup] = useState<string | null>(null);

    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
    const [draggedGroup, setDraggedGroup] = useState<string | null>(null);

    const currentPageMeasurements = useMemo(() =>
            measurements.filter(m => m.pageIndex === activePageIndex),
        [measurements, activePageIndex]);

    const groupOrder = useMemo(() => {
        const groups = new Set<string>();
        currentPageMeasurements.forEach(m => {
            groups.add(m.group || 'Ungrouped');
        });
        return Array.from(groups);
    }, [currentPageMeasurements]);

    const toggleGroupCollapse = (group: string) => {
        setCollapsedGroups(prev => ({ ...prev, [group]: !prev[group] }));
    };

    const handleGroupDragStart = (e: React.DragEvent, group: string) => {
        e.dataTransfer.setData('type', 'group');
        setDraggedGroup(group);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleGroupDrop = (e: React.DragEvent, targetGroup: string) => {
        e.preventDefault();
        const type = e.dataTransfer.getData('type');

        if (type === 'group' && draggedGroup && draggedGroup !== targetGroup) {
            const newOrder = [...groupOrder];
            const oldIndex = newOrder.indexOf(draggedGroup);
            const newIndex = newOrder.indexOf(targetGroup);
            newOrder.splice(oldIndex, 1);
            newOrder.splice(newIndex, 0, draggedGroup);
            onReorderMeasurements(newOrder);
        }

        if (!type && draggedMeasurementId) {
            const targetGroupName = targetGroup === 'Ungrouped' ? '' : targetGroup;
            onUpdateMeasurement(draggedMeasurementId, { group: targetGroupName });
        }

        setDraggedGroup(null);
        setDraggedMeasurementId(null);
        setDropTargetGroup(null);
    };

    return (
        <div
            className="fixed z-50 bg-white rounded-lg shadow-xl border-2 border-gray-200 select-none w-64"
            style={{ left: position.x, top: position.y }}
        >
            <div
                className="flex items-center justify-between p-2 bg-gray-50 rounded-t-lg cursor-move border-b"
                onMouseDown={handleMouseDown}
            >
                <div className="flex items-center gap-2">
                    <Move size={14} className="text-gray-400" />
                    <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">Measuring Tools</span>
                </div>
                <button
                    onClick={onToggleCollapse}
                    className="p-1 hover:bg-gray-200 rounded text-gray-500"
                >
                    {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                </button>
            </div>

            {!isCollapsed && (
                <div className="p-3 space-y-3">
                    <div className="flex flex-col gap-2">
                        <button
                            onClick={() => onToolChange('select')}
                            className={`flex items-center gap-2 p-2 rounded text-sm font-medium transition-colors ${activeTool === 'select'
                                ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                : 'hover:bg-gray-100 text-gray-600 border border-transparent'
                            }`}
                        >
                            <MousePointer2 size={16} /> Select & Edit
                        </button>

                        <button
                            onClick={() => onToolChange('line')}
                            className={`flex items-center gap-2 p-2 rounded text-sm font-medium transition-colors ${activeTool === 'line'
                                ? 'bg-red-100 text-red-700 border border-red-200'
                                : 'hover:bg-gray-100 text-gray-600 border border-transparent'
                            }`}
                        >
                            <Spline size={16} /> Draw Line
                        </button>

                        <button
                            onClick={() => onToolChange('shape')}
                            className={`flex items-center gap-2 p-2 rounded text-sm font-medium transition-colors ${activeTool === 'shape'
                                ? 'bg-purple-100 text-purple-700 border border-purple-200'
                                : 'hover:bg-gray-100 text-gray-600 border border-transparent'
                            }`}
                        >
                            <Square size={16} /> Draw Shape
                        </button>

                        <button
                            onClick={() => onToolChange('measure')}
                            className={`flex items-center gap-2 p-2 rounded text-sm font-medium transition-colors ${activeTool === 'measure'
                                ? 'bg-orange-100 text-orange-700 border border-orange-200'
                                : 'hover:bg-gray-100 text-gray-600 border border-transparent'
                            }`}
                        >
                            <Ruler size={16} /> Quick Measure
                        </button>
                    </div>

                    <div className="h-[1px] bg-gray-200"></div>

                    <div>
                        <button
                            onClick={() => setShowGroupsList(!showGroupsList)}
                            className="w-full flex items-center justify-between p-2 hover:bg-gray-100 rounded text-sm font-medium text-gray-600"
                        >
                            <div className="flex items-center gap-2">
                                <List size={16} />
                                <span>Measurements</span>
                                <span className="text-xs bg-gray-200 px-1.5 py-0.5 rounded">{currentPageMeasurements.length}</span>
                            </div>
                            {showGroupsList ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>

                        {showGroupsList && (
                            <div className="mt-2 max-h-64 overflow-y-auto space-y-1">
                                {currentPageMeasurements.length === 0 && (
                                    <div className="text-xs text-gray-400 italic text-center py-4">
                                        No Measurements Taken Yet
                                    </div>
                                )}
                                {groupOrder.map((groupName) => {
                                    const items = currentPageMeasurements.filter(m => (m.group || 'Ungrouped') === groupName);
                                    const isDropTarget = dropTargetGroup === groupName;
                                    const isGroupCollapsed = collapsedGroups[groupName];
                                    const isDraggingGroup = draggedGroup === groupName;
                                    const groupColor = getGroupColor(groupName === 'Ungrouped' ? undefined : groupName, groupColors);

                                    return (
                                        <div
                                            key={groupName}
                                            className={`mb-2 transition-opacity ${isDraggingGroup ? 'opacity-40' : 'opacity-100'}`}
                                            draggable
                                            onDragStart={(e) => handleGroupDragStart(e, groupName)}
                                            onDragOver={(e) => {
                                                e.preventDefault();
                                                e.dataTransfer.dropEffect = 'move';
                                                setDropTargetGroup(groupName);
                                            }}
                                            onDragLeave={() => setDropTargetGroup(null)}
                                            onDrop={(e) => handleGroupDrop(e, groupName)}
                                        >
                                            <div
                                                className={`flex items-center gap-2 p-1.5 bg-gray-50 rounded text-xs font-medium text-gray-600 transition-colors cursor-move border border-transparent ${isDropTarget ? 'bg-blue-100 border-blue-400' : 'hover:bg-gray-100'
                                                }`}
                                            >
                                                <GripVertical size={12} className="text-gray-400" />
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); toggleGroupCollapse(groupName); }}
                                                    className="hover:bg-gray-200 rounded p-0.5"
                                                >
                                                    {isGroupCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                                                </button>

                                                <div
                                                    className="w-2.5 h-2.5 rounded border border-gray-300"
                                                    style={{ backgroundColor: groupColor }}
                                                />
                                                <span className="flex-1 truncate select-none">{groupName}</span>
                                                <span className="text-[10px] bg-gray-200 px-1.5 py-0.5 rounded-full">{items.length}</span>
                                            </div>

                                            {!isGroupCollapsed && (
                                                <div className="ml-4 space-y-1 mt-1 pl-2 border-l border-gray-200">
                                                    {items.map((m) => (
                                                        <div
                                                            key={m.id}
                                                            draggable
                                                            onDragStart={(e) => {
                                                                e.stopPropagation();
                                                                setDraggedMeasurementId(m.id);
                                                                e.dataTransfer.effectAllowed = 'move';
                                                            }}
                                                            onDragEnd={() => {
                                                                setDraggedMeasurementId(null);
                                                                setDropTargetGroup(null);
                                                            }}
                                                            className={`flex items-center justify-between p-1.5 rounded text-xs transition-colors cursor-move ${selectedMeasurement === m.id
                                                                ? 'bg-blue-100 border border-blue-200'
                                                                : 'hover:bg-gray-100 border border-transparent'
                                                            } ${draggedMeasurementId === m.id ? 'opacity-50' : ''}`}
                                                            onClick={() => onSelectMeasurement(m.id)}
                                                        >
                                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                                                {m.type === 'shape' ? <Square size={12} /> : <Spline size={12} />}
                                                                <span className="truncate font-medium">{m.name}</span>
                                                            </div>
                                                            <div className="flex gap-1">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        onOpenProperties(m.id);
                                                                    }}
                                                                    className="p-1 hover:bg-gray-200 rounded text-gray-400"
                                                                    title="Properties"
                                                                >
                                                                    <Settings size={12} />
                                                                </button>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        onToggleMeasurementVisibility(m.id);
                                                                    }}
                                                                    className="p-1 hover:bg-gray-200 rounded text-gray-400"
                                                                >
                                                                    {m.hidden ? <EyeOff size={12} /> : <Eye size={12} />}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};