import {useEffect, useMemo, useState} from 'react';
import {ChevronDown, ChevronUp, Move, Palette, Trash2, X} from 'lucide-react';
import {Point} from '../../types';
import {getGroupColor} from './utils';
import {useDraggable} from '../../hooks/useDraggable';

export const FloatingPropertiesPanel = ({
                                            measurement, onUpdate, onDelete, onClose, isOpen, allMeasurements, groupColors, onSetGroupColor
                                        }: {
    measurement: any,
    onUpdate: (updates: any) => void,
    onDelete: () => void,
    onClose: () => void,
    isOpen: boolean,
    allMeasurements: any[],
    groupColors: Record<string, string>,
    onSetGroupColor: (group: string, color: string) => void
}) => {
    const { position, handleMouseDown } = useDraggable(window.innerWidth - 370, 100);
    const [isCollapsed, setIsCollapsed] = useState(false);

    const [name, setName] = useState(measurement.name || '');
    const [group, setGroup] = useState(measurement.group || '');
    const [rotation, setRotation] = useState(measurement.rotation || 0);
    const [pitch, setPitch] = useState(measurement.pitch || 0);

    // Labels State
    const [labels, setLabels] = useState(measurement.labels || {});

    const currentColor = getGroupColor(group, groupColors);

    const existingGroups = useMemo(() => {
        const groups = new Set<string>();
        allMeasurements.forEach(m => {
            if (m.group && m.group.trim()) {
                groups.add(m.group);
            }
        });
        return Array.from(groups).sort();
    }, [allMeasurements]);

    useEffect(() => {
        setName(measurement.name || '');
        setGroup(measurement.group || '');
        setRotation(measurement.rotation || 0);
        setPitch(measurement.pitch || 0);
        setLabels(measurement.labels || {});
    }, [measurement]);

    const handleNameChange = (value: string) => {
        setName(value);
        onUpdate({ name: value });
    };

    const handleGroupChange = (value: string) => {
        setGroup(value);
        onUpdate({ group: value });
    };

    const handlePitchChange = (value: number) => {
        setPitch(value);
        onUpdate({ pitch: value });
    };

    const toggleLabel = (key: keyof typeof labels) => {
        const newLabels = { ...labels, [key]: !labels[key] };
        setLabels(newLabels);
        onUpdate({ labels: newLabels });
    };

    const applyTransformations = (updates: any) => {
        if (!measurement) return;

        const centerX = measurement.points.reduce((sum: number, p: Point) => sum + p.x, 0) / measurement.points.length;
        const centerY = measurement.points.reduce((sum: number, p: Point) => sum + p.y, 0) / measurement.points.length;

        let transformedPoints = [...measurement.points];

        if (updates.rotation !== undefined) {
            const rotationDiff = (updates.rotation - (measurement.rotation || 0)) * Math.PI / 180;
            const cos = Math.cos(rotationDiff);
            const sin = Math.sin(rotationDiff);

            transformedPoints = transformedPoints.map((p: Point) => {
                const dx = p.x - centerX;
                const dy = p.y - centerY;
                return {
                    x: centerX + dx * cos - dy * sin,
                    y: centerY + dx * sin + dy * cos
                };
            });
        }

        onUpdate({ ...updates, points: transformedPoints });
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed z-50 bg-white rounded-lg shadow-xl border-2 border-gray-200 select-none w-80"
            style={{ left: position.x, top: position.y }}
        >
            <div
                className="flex items-center justify-between p-2 bg-gray-50 rounded-t-lg cursor-move border-b"
                onMouseDown={handleMouseDown}
            >
                <div className="flex items-center gap-2">
                    <Move size={14} className="text-gray-400" />
                    <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">Properties</span>
                </div>
                <div className="flex gap-1">
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="p-1 hover:bg-gray-200 rounded text-gray-500"
                    >
                        {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                    </button>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-gray-200 rounded text-gray-500"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>

            {!isCollapsed && (
                <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
                    {/* Basic Info */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => handleNameChange(e.target.value)}
                            className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                            placeholder="Enter name..."
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Group</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={group}
                                onChange={(e) => handleGroupChange(e.target.value)}
                                list="group-suggestions"
                                className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                placeholder="Enter group name..."
                            />
                            {group && (
                                <div className="relative w-10 shrink-0">
                                    <input
                                        type="color"
                                        value={currentColor}
                                        onChange={(e) => onSetGroupColor(group, e.target.value)}
                                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                                        title="Change group color"
                                    />
                                    <div
                                        className="w-full h-full rounded border border-gray-300 shadow-sm flex items-center justify-center"
                                        style={{ backgroundColor: currentColor }}
                                    >
                                        <Palette size={14} className="text-white drop-shadow-md" />
                                    </div>
                                </div>
                            )}
                        </div>
                        <datalist id="group-suggestions">
                            {existingGroups.map(g => (
                                <option key={g} value={g} />
                            ))}
                        </datalist>
                    </div>

                    {/* Geometry & Slope */}
                    {measurement.type === 'shape' && (
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Pitch / Slope (Rise per 12")</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    min="0"
                                    max="24"
                                    value={pitch}
                                    onChange={(e) => handlePitchChange(parseFloat(e.target.value))}
                                    className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                />
                                <span className="text-sm font-bold text-gray-500">/ 12</span>
                            </div>
                            <p className="text-xs text-gray-400 mt-1">Slope Factor: {Math.sqrt(1 + Math.pow(pitch/12, 2)).toFixed(6)}</p>
                        </div>
                    )}

                    {/* Display Options */}
                    <div className="bg-gray-50 p-2 rounded border">
                        <div className="space-y-1">
                            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                                <input type="checkbox" checked={labels.showTotalLength || false} onChange={() => toggleLabel('showTotalLength')} className="rounded text-blue-600"/>
                                Show {measurement.type === 'shape' ? 'Perimeter' : 'Length'}
                            </label>

                            {/* FIX: Moved showEdgeLengths OUTSIDE the type===shape check */}
                            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                                <input type="checkbox" checked={labels.showEdgeLengths || false} onChange={() => toggleLabel('showEdgeLengths')} className="rounded text-blue-600"/>
                                Show Individual Segment Lengths
                            </label>

                            {measurement.type === 'shape' && (
                                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                                    <input type="checkbox" checked={labels.showArea || false} onChange={() => toggleLabel('showArea')} className="rounded text-blue-600"/>
                                    Show Area
                                </label>
                            )}
                        </div>
                    </div>

                    {/* Rotation */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="text-xs font-bold text-gray-500 uppercase">
                                Rotation: {rotation}°
                            </label>
                            <button
                                onClick={() => {
                                    setRotation(0);
                                    applyTransformations({ rotation: 0 });
                                }}
                                className="text-xs text-blue-600 hover:text-blue-800"
                            >
                                Reset
                            </button>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="360"
                            step="15"
                            value={rotation}
                            onChange={(e) => {
                                const newRotation = parseInt(e.target.value);
                                setRotation(newRotation);
                                applyTransformations({ rotation: newRotation });
                            }}
                            className="w-full accent-blue-600"
                        />
                    </div>

                    <div className="pt-4 border-t">
                        <button
                            onClick={() => {
                                if (confirm('Delete this measurement?')) {
                                    onDelete();
                                    onClose();
                                }
                            }}
                            className="w-full flex items-center justify-center gap-2 bg-red-500 text-white p-2 rounded hover:bg-red-600 font-medium"
                        >
                            <Trash2 size={16} /> Delete
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};