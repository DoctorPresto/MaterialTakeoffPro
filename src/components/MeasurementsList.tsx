import React, {useMemo, useState} from 'react';
import {useStore} from '../store';
import {ChevronDown, ChevronRight, Eye, EyeOff, GripVertical, Settings, Trash2} from 'lucide-react';
import {Measurement} from '../types';

interface MeasurementItemProps {
    measurement: Measurement;
    isActive: boolean;
}

const MeasurementItem: React.FC<MeasurementItemProps> = ({ measurement, isActive }) => {
    const { setActiveMeasurement, updateMeasurement, deleteMeasurement } = useStore();

    const handleItemClick = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('button')) {
            return;
        }
        setActiveMeasurement(measurement.id);
    };

    const handleToggleVisibility = (e: React.MouseEvent) => {
        e.stopPropagation();
        updateMeasurement(measurement.id, { hidden: !measurement.hidden });
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        deleteMeasurement(measurement.id);
    };

    const handleSettingsClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setActiveMeasurement(measurement.id);
    };

    return (
        <div
            className={`flex items-center justify-between p-2.5 border rounded cursor-pointer transition-colors mb-2 ${
                isActive
                    ? 'bg-blue-50 border-blue-200 shadow-sm'
                    : 'bg-white hover:bg-gray-50 border-gray-200'
            }`}
            onClick={handleItemClick}
        >
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium truncate ${
                        isActive ? 'text-blue-700' : 'text-gray-800'
                    }`}>
                        {measurement.name}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full uppercase font-bold tracking-wider ${
                        measurement.type === 'shape'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-blue-100 text-blue-700'
                    }`}>
                        {measurement.type}
                    </span>
                </div>
                {measurement.tags.length > 0 && (
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                        {measurement.tags.map((tag, index) => (
                            <span key={index} className="text-xs bg-gray-100 text-gray-500 border border-gray-200 px-1.5 py-0.5 rounded">
                                {tag}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex items-center gap-1 ml-2">
                <button
                    onClick={handleToggleVisibility}
                    className={`p-1.5 rounded hover:bg-gray-100 transition-colors ${
                        measurement.hidden ? 'text-gray-400' : 'text-gray-600'
                    }`}
                    title={measurement.hidden ? 'Show measurement' : 'Hide measurement'}
                >
                    {measurement.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>

                <button
                    onClick={handleSettingsClick}
                    className={`p-1.5 rounded transition-colors ${
                        isActive
                            ? 'bg-blue-100 text-blue-600'
                            : 'hover:bg-gray-100 text-gray-600'
                    }`}
                    title="Edit properties"
                >
                    <Settings size={14} />
                </button>

                <button
                    onClick={handleDelete}
                    className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                    title="Delete measurement"
                >
                    <Trash2 size={14} />
                </button>
            </div>
        </div>
    );
};

const MeasurementsList: React.FC = () => {
    const { measurements, activeMeasurementId, activePageIndex, setMeasurements } = useStore();
    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
    const [draggedGroup, setDraggedGroup] = useState<string | null>(null);

    // Filter measurements for current page
    const currentPageMeasurements = useMemo(() =>
            measurements.filter(m => m.pageIndex === activePageIndex),
        [measurements, activePageIndex]);

    const groups = useMemo(() => {
        const uniqueGroups = new Set<string>();
        currentPageMeasurements.forEach(m => {
            uniqueGroups.add(m.group || 'Ungrouped');
        });
        return Array.from(uniqueGroups);
    }, [currentPageMeasurements]);

    if (currentPageMeasurements.length === 0) {
        return (
            <div className="p-4 text-center text-gray-400 text-sm">
                No measurements on this page
            </div>
        );
    }

    const toggleGroup = (groupName: string) => {
        setCollapsedGroups(prev => ({
            ...prev,
            [groupName]: !prev[groupName]
        }));
    };

    const handleDragStart = (e: React.DragEvent, group: string) => {
        setDraggedGroup(group);
        e.dataTransfer.effectAllowed = 'move';
        // Transparent drag image
        const img = new Image();
        img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        e.dataTransfer.setDragImage(img, 0, 0);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: React.DragEvent, targetGroup: string) => {
        e.preventDefault();
        if (!draggedGroup || draggedGroup === targetGroup) {
            setDraggedGroup(null);
            return;
        }

        const newGroups = [...groups];
        const oldIndex = newGroups.indexOf(draggedGroup);
        const newIndex = newGroups.indexOf(targetGroup);

        newGroups.splice(oldIndex, 1);
        newGroups.splice(newIndex, 0, draggedGroup);

        const reorderedPageItems: Measurement[] = [];
        newGroups.forEach(groupName => {
            const items = currentPageMeasurements.filter(m => (m.group || 'Ungrouped') === groupName);
            reorderedPageItems.push(...items);
        });

        const otherPageItems = measurements.filter(m => m.pageIndex !== activePageIndex);


        setMeasurements([...otherPageItems, ...reorderedPageItems]);
        setDraggedGroup(null);
    };

    return (
        <div className="space-y-4 p-2 pb-20">
            {groups.map(groupName => {
                const groupItems = currentPageMeasurements.filter(m => (m.group || 'Ungrouped') === groupName);
                const isCollapsed = collapsedGroups[groupName];
                const isDragging = draggedGroup === groupName;

                return (
                    <div
                        key={groupName}
                        draggable
                        onDragStart={(e) => handleDragStart(e, groupName)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, groupName)}
                        className={`transition-opacity ${isDragging ? 'opacity-40' : 'opacity-100'}`}
                    >
                        <div
                            className="flex items-center gap-2 mb-2 p-2 bg-gray-50 border-b border-gray-200 cursor-move hover:bg-gray-100 rounded-t select-none group"
                            onClick={() => toggleGroup(groupName)}
                        >
                            <GripVertical size={14} className="text-gray-400 group-hover:text-gray-600" />
                            <button className="text-gray-500 hover:text-gray-700">
                                {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                            </button>
                            <span className="font-bold text-sm text-gray-700 uppercase tracking-wide flex-1">
                                {groupName}
                            </span>
                            <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full font-mono">
                                {groupItems.length}
                            </span>
                        </div>

                        {!isCollapsed && (
                            <div className="pl-2 border-l-2 border-gray-100 ml-3 space-y-1">
                                {groupItems.map(measurement => (
                                    <MeasurementItem
                                        key={measurement.id}
                                        measurement={measurement}
                                        isActive={activeMeasurementId === measurement.id}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default MeasurementsList;