import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Document, Page, pdfjs} from 'react-pdf';
// FIX: Import worker directly from node_modules using Vite's ?url suffix
// This ensures the correct path in both Dev and Electron Production
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

import {useStore} from '../store';
import {MeasurementType, Point} from '../types';
import {
    Check,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    CreditCard as Edit3,
    Eye,
    EyeOff,
    FileX,
    List,
    Minus,
    MousePointer2,
    Move,
    Plus,
    PlusCircle,
    RotateCcw,
    Ruler,
    Settings,
    Spline,
    Square,
    Trash2,
    X
}
    from 'lucide-react';

// Performance optimization constants
const ZOOM_INCREMENT = 0.05; // 1% zoom increment
const MAX_ZOOM = 5;
const MIN_ZOOM = 0.1;
const RENDER_THROTTLE = 60; // 60fps

// --- Custom Hook for Draggable Panels ---
const useDraggable = (initialX: number, initialY: number) => {
    const [position, setPosition] = useState({ x: initialX, y: initialY });
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        setDragOffset({
            x: e.clientX - position.x,
            y: e.clientY - position.y
        });
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isDragging) {
                setPosition({
                    x: e.clientX - dragOffset.x,
                    y: e.clientY - dragOffset.y
                });
            }
        };
        const handleMouseUp = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            return () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging, dragOffset]);

    return { position, handleMouseDown };
};

// --- Generic Input Modal ---
const InputModal = ({
                        isOpen, title, label, initialValue, onSave, onCancel
                    }: {
    isOpen: boolean,
    title: string,
    label: string,
    initialValue: string,
    onSave: (val: string) => void,
    onCancel: () => void
}) => {
    const [val, setVal] = useState(initialValue);
    useEffect(() => {
        if (isOpen) setVal(initialValue)
    }, [isOpen, initialValue]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center">
            <div className="bg-white p-6 rounded-lg shadow-xl w-80 transform transition-all">
                <h3 className="font-bold mb-4 text-lg text-gray-800">{title}</h3>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">{label}</label>
                <input
                    autoFocus
                    className="w-full border p-2 rounded mb-6 focus:ring-2 focus:ring-blue-500 outline-none"
                    value={val}
                    onChange={e => setVal(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter') onSave(val);
                    }}
                />
                <div className="flex gap-2 justify-end">
                    <button onClick={onCancel}
                            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded font-medium">Cancel
                    </button>
                    <button onClick={() => onSave(val)}
                            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded font-bold shadow-sm">Confirm
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Context Menu ---
const ContextMenu = ({
                         x, y, onClose, measurement, actions
                     }: {
    x: number, y: number, onClose: () => void, measurement: any,
    actions: {
        deletePoint: () => void,
        addPoint: () => void,
        rename: () => void,
        deleteShape: () => void
    }
}) => {
    useEffect(() => {
        const handleOutside = () => onClose();
        document.addEventListener('click', handleOutside);
        return () => document.removeEventListener('click', handleOutside);
    }, []);

    return (
        <div
            className="fixed bg-white shadow-xl border rounded z-[100] w-56 py-1 text-gray-700"
            style={{top: y, left: x}}
            onClick={e => e.stopPropagation()}
        >
            <div className="px-4 py-2 border-b bg-gray-50 text-xs font-bold text-gray-500 truncate">
                {measurement.name}
            </div>

            <button onClick={() => {
                actions.rename();
                onClose();
            }} className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm flex gap-2 items-center"><Edit3
                size={14}/> Rename
            </button>

            <div className="h-[1px] bg-gray-100 my-1"></div>

            <button onClick={() => {
                actions.addPoint();
                onClose();
            }} className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm flex gap-2 items-center text-blue-600">
                <PlusCircle size={14}/> Add Vertex After (Midpoint)
            </button>
            <button onClick={() => {
                actions.deletePoint();
                onClose();
            }} className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm flex gap-2 items-center text-red-600">
                <Trash2 size={14}/> Delete Vertex
            </button>

            <div className="h-[1px] bg-gray-100 my-1"></div>
            <button onClick={() => {
                actions.deleteShape();
                onClose();
            }}
                    className="w-full text-left px-4 py-2 hover:bg-red-50 text-sm flex gap-2 items-center text-red-700 font-bold">
                <X size={14}/> Delete Shape
            </button>
        </div>
    );
};

// --- Edge Context Menu ---
const EdgeContextMenu = ({
                             x, y, onClose, onAddVertex
                         }: {
    x: number, y: number, onClose: () => void, onAddVertex: () => void
}) => {
    useEffect(() => {
        const handleOutside = () => onClose();
        document.addEventListener('click', handleOutside);
        return () => document.removeEventListener('click', handleOutside);
    }, []);

    return (
        <div
            className="fixed bg-white shadow-xl border rounded z-[100] w-48 py-1 text-gray-700"
            style={{top: y, left: x}}
            onClick={e => e.stopPropagation()}
        >
            <button onClick={() => {
                onAddVertex();
                onClose();
            }} className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm flex gap-2 items-center text-blue-600">
                <PlusCircle size={14}/> Add Vertex Here
            </button>
        </div>
    );
};

// --- Floating Drawing Panel ---
const FloatingDrawingPanel = ({
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
                                  onUpdateMeasurement
                              }: {
    activeTool: string, onToolChange: (tool: 'select' | 'line' | 'shape') => void,
    isCollapsed: boolean, onToggleCollapse: () => void, measurements: any[], activePageIndex: number,
    onSelectMeasurement: (id: string) => void, selectedMeasurement: string | null,
    onToggleMeasurementVisibility: (id: string) => void,
    onOpenProperties: (id: string) => void,
    onUpdateMeasurement: (id: string, updates: any) => void
}) => {
    const { position, handleMouseDown } = useDraggable(20, 100);
    const [showGroupsList, setShowGroupsList] = useState(true);
    const [draggedMeasurementId, setDraggedMeasurementId] = useState<string | null>(null);
    const [dropTargetGroup, setDropTargetGroup] = useState<string | null>(null);

    const currentPageMeasurements = measurements.filter(m => m.pageIndex === activePageIndex);

    // Group measurements
    const groupedMeasurements = currentPageMeasurements.reduce((acc, m) => {
        const group = m.group || 'Ungrouped';
        if (!acc[group]) acc[group] = [];
        acc[group].push(m);
        return acc;
    }, {} as Record<string, any[]>);

    return (
        <div
            className="fixed z-50 bg-white rounded-lg shadow-xl border-2 border-gray-200 select-none"
            style={{left: position.x, top: position.y}}
        >
            {/* Header */}
            <div
                className="flex items-center justify-between p-2 bg-gray-50 rounded-t-lg cursor-move border-b"
                onMouseDown={handleMouseDown}
            >
                <div className="flex items-center gap-2">
                    <Move size={14} className="text-gray-400"/>
                    <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">Measures</span>
                </div>
                <button
                    onClick={onToggleCollapse}
                    className="p-1 hover:bg-gray-200 rounded text-gray-500"
                >
                    {isCollapsed ? <ChevronDown size={14}/> : <ChevronUp size={14}/>}
                </button>
            </div>

            {/* Content */}
            {!isCollapsed && (
                <div className="p-3 space-y-3">
                    {/* Tool Buttons */}
                    <div className="flex flex-col gap-2">
                        <button
                            onClick={() => onToolChange('select')}
                            className={`flex items-center gap-2 p-2 rounded text-sm font-medium transition-colors ${
                                activeTool === 'select'
                                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                    : 'hover:bg-gray-100 text-gray-600 border border-transparent'
                            }`}
                        >
                            <MousePointer2 size={16}/> Select & Edit
                        </button>

                        <button
                            onClick={() => onToolChange('line')}
                            className={`flex items-center gap-2 p-2 rounded text-sm font-medium transition-colors ${
                                activeTool === 'line'
                                    ? 'bg-red-100 text-red-700 border border-red-200'
                                    : 'hover:bg-gray-100 text-gray-600 border border-transparent'
                            }`}
                        >
                            <Spline size={16}/> Draw Line
                        </button>

                        <button
                            onClick={() => onToolChange('shape')}
                            className={`flex items-center gap-2 p-2 rounded text-sm font-medium transition-colors ${
                                activeTool === 'shape'
                                    ? 'bg-purple-100 text-purple-700 border border-purple-200'
                                    : 'hover:bg-gray-100 text-gray-600 border border-transparent'
                            }`}
                        >
                            <Square size={16}/> Draw Shape
                        </button>
                    </div>

                    <div className="h-[1px] bg-gray-200"></div>

                    {/* Instructions */}
                    <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                        <div className="font-medium mb-1">Tips:</div>
                        <div>• Right-click to finish drawing</div>
                        <div>• Double-click edges to add vertices</div>
                        <div>• Drag shapes to move them</div>
                    </div>

                    <div className="h-[1px] bg-gray-200"></div>

                    {/* Groups List */}
                    <div>
                        <button
                            onClick={() => setShowGroupsList(!showGroupsList)}
                            className="w-full flex items-center justify-between p-2 hover:bg-gray-100 rounded text-sm font-medium text-gray-600"
                        >
                            <div className="flex items-center gap-2">
                                <List size={16}/>
                                <span>Groups & Shapes</span>
                                <span
                                    className="text-xs bg-gray-200 px-1.5 py-0.5 rounded">{currentPageMeasurements.length}</span>
                            </div>
                            {showGroupsList ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                        </button>

                        {showGroupsList && (
                            <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
                                {Object.keys(groupedMeasurements).length === 0 && (
                                    <div className="text-xs text-gray-400 italic text-center py-4">
                                        No Measurements Taken Yet
                                    </div>
                                )}
                                {Object.entries(groupedMeasurements).map(([groupName, groupMeasurements]) => {
                                    const typedGroupMeasurements = groupMeasurements as any[];
                                    const isDropTarget = dropTargetGroup === groupName;
                                    return (
                                        <div key={groupName} className="mb-2">
                                            <div
                                                className={`flex items-center gap-2 p-1 bg-gray-50 rounded text-xs font-medium text-gray-600 transition-colors ${
                                                    isDropTarget ? 'bg-blue-100 border-2 border-blue-400' : ''
                                                }`}
                                                onDragOver={(e) => {
                                                    e.preventDefault();
                                                    setDropTargetGroup(groupName);
                                                }}
                                                onDragLeave={() => {
                                                    setDropTargetGroup(null);
                                                }}
                                                onDrop={(e) => {
                                                    e.preventDefault();
                                                    if (draggedMeasurementId) {
                                                        const targetGroup = groupName === 'Ungrouped' ? '' : groupName;
                                                        onUpdateMeasurement(draggedMeasurementId, {group: targetGroup});
                                                    }
                                                    setDraggedMeasurementId(null);
                                                    setDropTargetGroup(null);
                                                }}
                                            >
                                                <div
                                                    className="w-3 h-3 rounded border border-gray-300"
                                                    style={{backgroundColor: getGroupColor(groupName === 'Ungrouped' ? undefined : groupName)}}
                                                />
                                                <span>{groupName}</span>
                                                <span
                                                    className="text-xs bg-gray-200 px-1 py-0.5 rounded">{typedGroupMeasurements.length}</span>
                                            </div>
                                            <div className="ml-4 space-y-1 mt-1">
                                                {typedGroupMeasurements.map((m: any) => (
                                                    <div
                                                        key={m.id}
                                                        draggable
                                                        onDragStart={(e) => {
                                                            setDraggedMeasurementId(m.id);
                                                            e.dataTransfer.effectAllowed = 'move';
                                                        }}
                                                        onDragEnd={() => {
                                                            setDraggedMeasurementId(null);
                                                            setDropTargetGroup(null);
                                                        }}
                                                        className={`flex items-center justify-between p-2 rounded text-xs transition-colors cursor-move ${
                                                            selectedMeasurement === m.id
                                                                ? 'bg-blue-100 border border-blue-200'
                                                                : 'hover:bg-gray-100 border border-transparent'
                                                        } ${draggedMeasurementId === m.id ? 'opacity-50' : ''}`}
                                                        onClick={() => onSelectMeasurement(m.id)}
                                                    >
                                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                                            {m.type === 'shape' ? <Square size={12}/> :
                                                                <Spline size={12}/>}
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
                                                                <Settings size={12}/>
                                                            </button>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    onToggleMeasurementVisibility(m.id);
                                                                }}
                                                                className="p-1 hover:bg-gray-200 rounded text-gray-400"
                                                            >
                                                                {m.hidden ? <EyeOff size={12}/> : <Eye size={12}/>}
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
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

// --- Properties Panel ---
const FloatingPropertiesPanel = ({
                                     measurement, onUpdate, onDelete, onClose, isOpen, allMeasurements
                                 }: {
    measurement: any,
    onUpdate: (updates: any) => void,
    onDelete: () => void,
    onClose: () => void,
    isOpen: boolean,
    allMeasurements: any[]
}) => {
    const { position, handleMouseDown } = useDraggable(window.innerWidth - 370, 100);
    const [isCollapsed, setIsCollapsed] = useState(false);

    const [name, setName] = useState(measurement.name || '');
    const [group, setGroup] = useState(measurement.group || '');
    const [rotation, setRotation] = useState(measurement.rotation || 0);

    // Get unique group names from all measurements
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
    }, [measurement]);

    const handleNameChange = (value: string) => {
        setName(value);
        onUpdate({name: value});
    };

    const handleGroupChange = (value: string) => {
        setGroup(value);
        onUpdate({group: value});
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

            transformedPoints = transformedPoints.map(p => {
                const dx = p.x - centerX;
                const dy = p.y - centerY;
                return {
                    x: centerX + dx * cos - dy * sin,
                    y: centerY + dx * sin + dy * cos
                };
            });
        }

        onUpdate({...updates, points: transformedPoints});
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed z-50 bg-white rounded-lg shadow-xl border-2 border-gray-200 select-none w-80"
            style={{left: position.x, top: position.y}}
        >
            {/* Header */}
            <div
                className="flex items-center justify-between p-2 bg-gray-50 rounded-t-lg cursor-move border-b"
                onMouseDown={handleMouseDown}
            >
                <div className="flex items-center gap-2">
                    <Move size={14} className="text-gray-400"/>
                    <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">Properties</span>
                </div>
                <div className="flex gap-1">
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="p-1 hover:bg-gray-200 rounded text-gray-500"
                    >
                        {isCollapsed ? <ChevronDown size={14}/> : <ChevronUp size={14}/>}
                    </button>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-gray-200 rounded text-gray-500"
                    >
                        <X size={14}/>
                    </button>
                </div>
            </div>

            {/* Content */}
            {!isCollapsed && (
                <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
                    {/* Name */}
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

                    {/* Group */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Group</label>
                        <input
                            type="text"
                            value={group}
                            onChange={(e) => handleGroupChange(e.target.value)}
                            list="group-suggestions"
                            className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                            placeholder="Enter group name..."
                        />
                        <datalist id="group-suggestions">
                            {existingGroups.map(g => (
                                <option key={g} value={g}/>
                            ))}
                        </datalist>
                        <p className="text-xs text-gray-400 mt-1">Shapes in the same group get the same color</p>
                        {group && (
                            <div className="mt-2 flex items-center gap-2">
                                <div
                                    className="w-4 h-4 rounded border border-gray-300"
                                    style={{backgroundColor: getGroupColor(group)}}
                                />
                                <span className="text-xs text-gray-600">Group color</span>
                            </div>
                        )}
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
                                    applyTransformations({rotation: 0});
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
                                applyTransformations({rotation: newRotation});
                            }}
                            className="w-full accent-blue-600"
                        />
                        <div className="flex justify-between text-xs text-gray-400 mt-1">
                            <span>0°</span>
                            <span>360°</span>
                        </div>
                    </div>

                    {/* Delete Button */}
                    <div className="pt-4 border-t">
                        <button
                            onClick={() => {
                                if (confirm('Delete this shape?')) {
                                    onDelete();
                                    onClose();
                                }
                            }}
                            className="w-full flex items-center justify-center gap-2 bg-red-500 text-white p-2 rounded hover:bg-red-600 font-medium"
                        >
                            <Trash2 size={16}/> Delete Shape
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- PDF Page Manager ---
const PDFPageManager = ({
                            numPages, activePageIndex, onPageChange, onRemovePage
                        }: {
    numPages: number,
    activePageIndex: number,
    onPageChange: (index: number) => void,
    onRemovePage: (index: number) => void
}) => {
    const [showManager, setShowManager] = useState(false);

    if (numPages <= 1) return null;

    return (
        <div className="relative">
            <button
                onClick={() => setShowManager(!showManager)}
                className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-blue-600"
                title="Manage Pages"
            >
                <FileX size={16}/>
            </button>

            {showManager && (
                <div className="absolute top-full right-0 mt-1 bg-white border rounded-lg shadow-lg z-50 w-64 p-3">
                    <h3 className="font-bold text-sm mb-2">PDF Pages</h3>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                        {Array.from({length: numPages}, (_, i) => (
                            <div key={i}
                                 className={`flex items-center justify-between p-2 rounded ${i === activePageIndex ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50'}`}>
                                <button
                                    onClick={() => onPageChange(i)}
                                    className="flex-1 text-left text-sm"
                                >
                                    Page {i + 1} {i === activePageIndex && '(Current)'}
                                </button>
                                <button
                                    onClick={() => onRemovePage(i)}
                                    className="p-1 text-red-500 hover:bg-red-50 rounded"
                                    title="Remove from takeoff"
                                >
                                    <X size={12}/>
                                </button>
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={() => setShowManager(false)}
                        className="w-full mt-2 p-1 text-xs text-gray-500 hover:bg-gray-100 rounded"
                    >
                        Close
                    </button>
                </div>
            )}
        </div>
    );
};

// Group colours
const GROUP_COLORS = [
    '#ef4444', // red
    '#10b981', // green
    '#8b5cf6', // purple
    '#f97316', // orange
    '#0ea5e9', // sky
    '#ec4899', // pink
    '#84cc16', // lime
    '#f59e0b', // amber
];

const getGroupColor = (group: string | undefined): string => {
    if (!group) return '#2563eb'; // default blue
    // Simple hash function for consistent colors
    let hash = 0;
    for (let i = 0; i < group.length; i++) {
        hash = group.charCodeAt(i) + ((hash << 5) - hash);
    }
    return GROUP_COLORS[Math.abs(hash) % GROUP_COLORS.length];
};

const Canvas = () => {
    const {
        pdfFile, measurements, activeTool, activePageIndex, isCalibrating, activeWizardTool,
        addMeasurement, updateMeasurement, deleteMeasurement, deletePoint, insertPointAfter,
        setScale, setIsCalibrating, setPageIndex, zoom, pan, setViewport, setTool, scale
    } = useStore();

    const [points, setPoints] = useState<Point[]>([]);
    const viewportRef = useRef<HTMLDivElement>(null);
    const [numPages, setNumPages] = useState<number>(0);
    const [removedPages, setRemovedPages] = useState<Set<number>>(new Set());

    // Interaction State
    const [isPanning, setIsPanning] = useState(false);
    const [lastMouse, setLastMouse] = useState<{ x: number, y: number } | null>(null);
    const [draggedVertex, setDraggedVertex] = useState<{ mId: string, pIdx: number } | null>(null);
    const [selectedShape, setSelectedShape] = useState<string | null>(null);
    const [isDraggingShape, setIsDraggingShape] = useState(false);
    const [shapeStartPos, setShapeStartPos] = useState<Point | null>(null);

    // Double Click Detection State
    const [lastClickTime, setLastClickTime] = useState(0);
    const [lastClickId, setLastClickId] = useState<string | null>(null);
    const [lastClickIndex, setLastClickIndex] = useState<number | null>(null);

    // UI State
    const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
    const [isPropertiesPanelOpen, setIsPropertiesPanelOpen] = useState(false);
    const [propertiesPanelMeasurement, setPropertiesPanelMeasurement] = useState<any>(null);

    // Modal State
    const [modalType, setModalType] = useState<'name' | 'calibration' | null>(null);
    const [pendingShape, setPendingShape] = useState<{ type: MeasurementType, points: Point[] } | null>(null);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [contextMenu, setContextMenu] = useState<any>(null);
    const [edgeContextMenu, setEdgeContextMenu] = useState<any>(null);

    // Performance optimization state
    const [isRendering, setIsRendering] = useState(false);
    const [lastRenderTime, setLastRenderTime] = useState(0);
    const renderTimeoutRef = useRef<NodeJS.Timeout>();

    const handleToolChange = (tool: 'select' | 'line' | 'shape') => {
        setTool(tool);
        setPoints([]);
        setSelectedShape(null);
        setIsPropertiesPanelOpen(false);
    };

    const handleCalibrate = () => {
        setIsCalibrating(!isCalibrating);
        setPoints([]);
    };

    const handleOpenProperties = (measurementId: string) => {
        const measurement = measurements.find(m => m.id === measurementId);
        if (measurement) {
            setPropertiesPanelMeasurement(measurement);
            setIsPropertiesPanelOpen(true);
            setSelectedShape(measurementId);
        }
    };

    const handleToggleMeasurementVisibility = (measurementId: string) => {
        const measurement = measurements.find(m => m.id === measurementId);
        if (measurement) {
            updateMeasurement(measurementId, {hidden: !measurement.hidden});
        }
    };

    const screenToPdf = (screenX: number, screenY: number) => {
        if (!viewportRef.current) return {x: 0, y: 0};
        const rect = viewportRef.current.getBoundingClientRect();
        return {
            x: (screenX - rect.left - pan.x) / zoom,
            y: (screenY - rect.top - pan.y) / zoom
        };
    };

    // Throttled viewport update for performance
    const throttledViewportUpdate = (newZoom: number, newPan: { x: number, y: number }) => {
        const now = Date.now();
        if (now - lastRenderTime < RENDER_THROTTLE) {
            if (renderTimeoutRef.current) clearTimeout(renderTimeoutRef.current);
            renderTimeoutRef.current = setTimeout(() => {
                setViewport(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom)), newPan);
                setLastRenderTime(Date.now());
            }, RENDER_THROTTLE);
        } else {
            setViewport(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom)), newPan);
            setLastRenderTime(now);
        }
    };

    useEffect(() => {
        return () => renderTimeoutRef.current && clearTimeout(renderTimeoutRef.current);
    }, []);

    // Create default square for shape tool
    const createDefaultSquare = (center: Point) => {
        const size = 100 / zoom; // Adjust size based on zoom
        return [
            {x: center.x - size / 2, y: center.y - size / 2},
            {x: center.x + size / 2, y: center.y - size / 2},
            {x: center.x + size / 2, y: center.y + size / 2},
            {x: center.x - size / 2, y: center.y + size / 2}
        ];
    };


    // Check if point is inside shape
    const isPointInShape = (point: Point, shapePoints: Point[]) => {
        let inside = false;
        for (let i = 0, j = shapePoints.length - 1; i < shapePoints.length; j = i++) {
            if (((shapePoints[i].y > point.y) !== (shapePoints[j].y > point.y)) &&
                (point.x < (shapePoints[j].x - shapePoints[i].x) * (point.y - shapePoints[i].y) / (shapePoints[j].y - shapePoints[i].y) + shapePoints[i].x)) {
                inside = !inside;
            }
        }
        return inside;
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
            e.preventDefault();
            setIsPanning(true);
            setLastMouse({x: e.clientX, y: e.clientY});
            return;
        }

        if (e.button === 0 && !contextMenu && !draggedVertex && !edgeContextMenu) {
            const {x, y} = screenToPdf(e.clientX, e.clientY);

            if (activeTool === 'select' && !isCalibrating) {
                // Check if clicking on a shape
                const clickedShape = measurements.find(m =>
                    m.pageIndex === activePageIndex &&
                    m.type === 'shape' &&
                    isPointInShape({x, y}, m.points)
                );

                if (clickedShape) {
                    setSelectedShape(clickedShape.id);
                    setIsDraggingShape(true);
                    setShapeStartPos({x, y});
                } else {
                    setSelectedShape(null);
                }
                return;
            }

            if (activeTool === 'shape') {
                // Create default square and select immediately
                const squarePoints = createDefaultSquare({x, y});
                const finalName = activeWizardTool || 'Shape';
                addMeasurement('shape', squarePoints, finalName);
                // Find the newly created shape and open properties panel
                setTimeout(() => {
                    const newShape = measurements[measurements.length - 1];
                    if (newShape) {
                        setSelectedShape(newShape.id);
                        setPropertiesPanelMeasurement(newShape);
                        setIsPropertiesPanelOpen(true);
                    }
                }, 0);
                return;
            }

            // Line tool or calibration
            if (activeTool === 'line' && points.length >= 3) {
                // Check if clicking near the first point to close the shape
                const firstPoint = points[0];
                const distance = Math.sqrt(Math.pow(x - firstPoint.x, 2) + Math.pow(y - firstPoint.y, 2));
                const threshold = 15 / zoom; // Click threshold scales with zoom

                if (distance < threshold) {
                    // Close the shape
                    const finalName = activeWizardTool || 'Shape';
                    addMeasurement('shape', points, finalName);
                    setPoints([]);
                    // Find the newly created shape and open properties panel
                    setTimeout(() => {
                        const newShape = measurements[measurements.length - 1];
                        if (newShape) {
                            setSelectedShape(newShape.id);
                            setPropertiesPanelMeasurement(newShape);
                            setIsPropertiesPanelOpen(true);
                        }
                    }, 0);
                    return;
                }
            }

            const newPoints = [...points, {x, y}];
            setPoints(newPoints);

            if (isCalibrating && newPoints.length === 2) {
                setModalType('calibration');
            }
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (draggedVertex) {
            const {x, y} = screenToPdf(e.clientX, e.clientY);
            const m = measurements.find(m => m.id === draggedVertex.mId);
            if (m) {
                const newPoints = [...m.points];
                newPoints[draggedVertex.pIdx] = {x, y};
                updateMeasurement(m.id, {points: newPoints});
            }
            return;
        }

        if (isDraggingShape && selectedShape && shapeStartPos) {
            const {x, y} = screenToPdf(e.clientX, e.clientY);
            const dx = x - shapeStartPos.x;
            const dy = y - shapeStartPos.y;

            const shape = measurements.find(m => m.id === selectedShape);
            if (shape) {
                const newPoints = shape.points.map(p => ({x: p.x + dx, y: p.y + dy}));
                updateMeasurement(selectedShape, {points: newPoints});
                setShapeStartPos({x, y});
            }
            return;
        }

        if (isPanning && lastMouse) {
            const dx = e.clientX - lastMouse.x;
            const dy = e.clientY - lastMouse.y;
            throttledViewportUpdate(zoom, {x: pan.x + dx, y: pan.y + dy});
            setLastMouse({x: e.clientX, y: e.clientY});
        }
    };

    const handleMouseUp = () => {
        setIsPanning(false);
        setLastMouse(null);
        setDraggedVertex(null);
        setIsDraggingShape(false);
        setShapeStartPos(null);
    };

    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey) {
            e.preventDefault();
            const zoomFactor = -e.deltaY * 0.001;
            const newZoom = zoom + zoomFactor;
            throttledViewportUpdate(newZoom, pan);
        } else {
            throttledViewportUpdate(zoom, {x: pan.x - e.deltaX, y: pan.y - e.deltaY});
        }
    };

    const handleRightClickCanvas = (e: React.MouseEvent) => {
        e.preventDefault();
        if (isCalibrating) {
            setIsCalibrating(false);
            setPoints([]);
            return;
        }
        if (points.length >= 2) {
            const finalName = activeWizardTool || "Line";
            addMeasurement('line', points, finalName);
            setPoints([]);
            // Open properties panel for the newly created line
            setTimeout(() => {
                const newShape = measurements.find(m => m.name === finalName && m.points.length === points.length);
                if (newShape) {
                    setPropertiesPanelMeasurement(newShape);
                    setIsPropertiesPanelOpen(true);
                    setSelectedShape(newShape.id);
                }
            }, 0);
        }
    };

    const handlePointRightClick = (e: React.MouseEvent, mId: string, pIdx: number) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({x: e.clientX, y: e.clientY, mId, pIdx});
    };

    // --- MANUAL DOUBLE CLICK HANDLER ---
    // Replaces onDoubleClick to avoid issues with event bubbling and tool conflicts
    const handleEdgeMouseDown = (e: React.MouseEvent, mId: string, idx: number) => {
        e.preventDefault(); // Prevent text selection
        e.stopPropagation(); // Prevent canvas drag/selection

        const now = Date.now();
        // Check for double click (within 300ms on same edge)
        if (lastClickId === mId && lastClickIndex === idx && now - lastClickTime < 300) {
            const clickPoint = screenToPdf(e.clientX, e.clientY);
            insertPointAfter(mId, idx, clickPoint);

            // Reset to prevent triple-click triggering multiple times immediately
            setLastClickTime(0);
            setLastClickId(null);
        } else {
            // First click of a potential double click
            setLastClickTime(now);
            setLastClickId(mId);
            setLastClickIndex(idx);
        }
    };

    const handleEdgeRightClick = (e: React.MouseEvent, mId: string, edgeIndex: number) => {
        e.preventDefault();
        e.stopPropagation();
        const clickPoint = screenToPdf(e.clientX, e.clientY);
        setEdgeContextMenu({
            x: e.clientX,
            y: e.clientY,
            onAddVertex: () => insertPointAfter(mId, edgeIndex, clickPoint)
        });
    };

    const handleRemovePage = (pageIndex: number) => {
        setRemovedPages(prev => new Set([...prev, pageIndex]));
        if (pageIndex === activePageIndex) {
            // Move to next available page
            let nextPage = pageIndex + 1;
            while (nextPage < numPages && removedPages.has(nextPage)) {
                nextPage++;
            }
            if (nextPage >= numPages) {
                nextPage = pageIndex - 1;
                while (nextPage >= 0 && removedPages.has(nextPage)) {
                    nextPage--;
                }
            }
            if (nextPage >= 0) {
                setPageIndex(nextPage);
            }
        }
    };

    // --- Modal Logic ---
    const handleModalSave = (val: string) => {
        if (modalType === 'calibration') {
            const p1 = points[0];
            const p2 = points[1];
            const pixelDist = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
            const realDist = parseFloat(val);
            if (realDist > 0) {
                setScale(pixelDist / realDist);
            }
            setPoints([]);
            setIsCalibrating(false);
        } else if (modalType === 'name') {
            const finalName = val || (activeWizardTool ? activeWizardTool : "Untitled");
            if (pendingShape) {
                addMeasurement(pendingShape.type, pendingShape.points, finalName);
                setPendingShape(null);
            } else if (activeId) {
                updateMeasurement(activeId, {name: finalName});
            }
        }
        setModalType(null);
        setActiveId(null);
    };

    const handleModalCancel = () => {
        setModalType(null);
        setPendingShape(null);
        setActiveId(null);
        if (modalType === 'calibration') {
            setPoints([]);
            setIsCalibrating(false);
        }
    };

    const availablePages = Array.from({length: numPages}, (_, i) => i).filter(i => !removedPages.has(i));

    return (
        <div className="flex-1 relative bg-gray-900 overflow-hidden flex flex-col">
            <InputModal
                isOpen={!!modalType}
                title={modalType === 'name' ? "Name Measurement" : "Calibrate Scale"}
                label={modalType === 'name' ? "Name" : "Real World Distance (ft)"}
                initialValue={modalType === 'name' && activeId ? measurements.find(m => m.id === activeId)?.name || "" : ""}
                onSave={handleModalSave}
                onCancel={handleModalCancel}
            />

            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    onClose={() => setContextMenu(null)}
                    measurement={measurements.find(m => m.id === contextMenu.mId)}
                    actions={{
                        deletePoint: () => deletePoint(contextMenu.mId, contextMenu.pIdx),
                        addPoint: () => {
                            // Explicitly pass undefined to use default midpoint logic
                            insertPointAfter(contextMenu.mId, contextMenu.pIdx, undefined);
                        },
                        rename: () => {
                            setActiveId(contextMenu.mId);
                            setModalType('name');
                        },
                        deleteShape: () => deleteMeasurement(contextMenu.mId)
                    }}
                />
            )}

            {edgeContextMenu && (
                <EdgeContextMenu
                    x={edgeContextMenu.x}
                    y={edgeContextMenu.y}
                    onClose={() => setEdgeContextMenu(null)}
                    onAddVertex={edgeContextMenu.onAddVertex}
                />
            )}

            {/* Floating Drawing Panel */}
            <FloatingDrawingPanel
                activeTool={activeTool}
                onToolChange={handleToolChange}
                isCollapsed={isPanelCollapsed}
                onToggleCollapse={() => setIsPanelCollapsed(!isPanelCollapsed)}
                measurements={measurements}
                activePageIndex={activePageIndex}
                onSelectMeasurement={setSelectedShape}
                selectedMeasurement={selectedShape}
                onToggleMeasurementVisibility={handleToggleMeasurementVisibility}
                onOpenProperties={handleOpenProperties}
                onUpdateMeasurement={updateMeasurement}
            />

            {/* Floating Properties Panel */}
            {isPropertiesPanelOpen && propertiesPanelMeasurement && (
                <FloatingPropertiesPanel
                    measurement={propertiesPanelMeasurement}
                    onUpdate={(updates) => {
                        updateMeasurement(propertiesPanelMeasurement.id, updates);
                        // Update the local state to reflect changes
                        setPropertiesPanelMeasurement((prev: any) => ({...prev, ...updates}));
                    }}
                    onDelete={() => {
                        deleteMeasurement(propertiesPanelMeasurement.id);
                        setIsPropertiesPanelOpen(false);
                        setSelectedShape(null);
                    }}
                    onClose={() => {
                        setIsPropertiesPanelOpen(false);
                        setPropertiesPanelMeasurement(null);
                    }}
                    isOpen={isPropertiesPanelOpen}
                    allMeasurements={measurements}
                />
            )}

            <div
                className="absolute top-0 left-0 w-full h-12 bg-white/90 backdrop-blur border-b flex items-center px-4 justify-between z-40 shadow-sm">
                <div className="flex items-center gap-4 w-1/4">
                    <span className="font-bold text-gray-500 text-xs uppercase tracking-wider">Measurements</span>

                    {/* Calibrate Tool - Moved to top bar */}
                    <button
                        onClick={handleCalibrate}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                            isCalibrating
                                ? 'bg-yellow-100 text-yellow-700 border border-yellow-200 animate-pulse'
                                : 'bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-200'
                        }`}
                    >
                        <Ruler size={14}/>
                        {isCalibrating ? 'Calibrating...' : 'Calibrate'}
                    </button>

                    {scale > 1 && (
                        <div
                            className="flex items-center gap-1 bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-bold">
                            <Check size={10}/> Scaled
                        </div>
                    )}

                    {selectedShape && (
                        <div
                            className="flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold">
                            <Square size={10}/> Shape Selected
                        </div>
                    )}
                </div>

                <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 bg-gray-100 rounded-md p-1">
                    <button
                        onClick={() => {
                            const currentIndex = availablePages.indexOf(activePageIndex);
                            if (currentIndex > 0) setPageIndex(availablePages[currentIndex - 1]);
                        }}
                        disabled={availablePages.indexOf(activePageIndex) <= 0}
                        className="p-1 hover:bg-white rounded shadow-sm disabled:opacity-30 disabled:shadow-none transition-all"
                    >
                        <ChevronLeft size={18}/>
                    </button>
                    <span className="text-sm font-mono font-medium min-w-[80px] text-center">
              Pg {activePageIndex + 1} / {numPages || '-'}
            </span>
                    <button
                        onClick={() => {
                            const currentIndex = availablePages.indexOf(activePageIndex);
                            if (currentIndex < availablePages.length - 1) setPageIndex(availablePages[currentIndex + 1]);
                        }}
                        disabled={availablePages.indexOf(activePageIndex) >= availablePages.length - 1}
                        className="p-1 hover:bg-white rounded shadow-sm disabled:opacity-30 disabled:shadow-none transition-all"
                    >
                        <ChevronRight size={18}/>
                    </button>
                </div>

                <div className="flex items-center gap-2 w-1/4 justify-end">
                    <div className="flex items-center bg-gray-100 rounded-md p-1 gap-1">
                        <button
                            onClick={() => throttledViewportUpdate(zoom - ZOOM_INCREMENT, pan)}
                            className="p-1 hover:bg-white rounded shadow-sm transition-all"
                            title="Zoom Out"
                        >
                            <Minus size={16}/>
                        </button>

                        {/* Zoom Slider */}
                        <div className="flex items-center gap-1 px-2">
                            <input
                                type="range"
                                min={MIN_ZOOM}
                                max={MAX_ZOOM}
                                step={0.1}
                                value={zoom}
                                onChange={(e) => throttledViewportUpdate(parseFloat(e.target.value), pan)}
                                className="w-20 h-1 bg-gray-300 rounded-lg appearance-none cursor-pointer slider"
                                title="Zoom Slider"
                            />
                            <span className="w-12 text-center text-xs font-mono font-bold text-gray-600">
                  {Math.round(zoom * 100)}%
                </span>
                        </div>

                        <button
                            onClick={() => throttledViewportUpdate(zoom + ZOOM_INCREMENT, pan)}
                            className="p-1 hover:bg-white rounded shadow-sm transition-all"
                            title="Zoom In"
                        >
                            <Plus size={16}/>
                        </button>
                    </div>

                    <button
                        onClick={() => {
                            // Fit to page logic
                            if (viewportRef.current) {
                                const container = viewportRef.current;
                                const containerWidth = container.clientWidth;
                                const containerHeight = container.clientHeight;
                                const pageWidth = 800 * 1.5; // PDF page width * scale
                                const pageHeight = 1000 * 1.5; // PDF page height * scale

                                const scaleX = containerWidth / pageWidth;
                                const scaleY = containerHeight / pageHeight;
                                const fitZoom = Math.min(scaleX, scaleY) * 0.9; // 90% to add some padding

                                const centerX = (containerWidth - pageWidth * fitZoom) / 2;
                                const centerY = (containerHeight - pageHeight * fitZoom) / 2;

                                throttledViewportUpdate(fitZoom, {x: centerX, y: centerY});
                            }
                        }}
                        className="p-1.5 hover:bg-gray-100 rounded text-gray-500 hover:text-blue-600"
                        title="Fit to Page"
                    >
                        <RotateCcw size={18}/>
                    </button>

                    <PDFPageManager
                        numPages={numPages}
                        activePageIndex={activePageIndex}
                        onPageChange={setPageIndex}
                        onRemovePage={handleRemovePage}
                    />
                </div>
            </div>

            <div
                ref={viewportRef}
                className="flex-1 mt-12 overflow-hidden cursor-default touch-none"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onContextMenu={handleRightClickCanvas}
                onWheel={handleWheel}
                style={{cursor: isPanning ? 'grabbing' : (activeTool !== 'select' ? 'crosshair' : 'default')}}
            >
                <div
                    className="origin-top-left will-change-transform"
                    style={{
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                        transition: isRendering ? 'none' : 'transform 0.1s ease-out'
                    }}
                >
                    {pdfFile && !removedPages.has(activePageIndex) && (
                        <div className="relative inline-block bg-white shadow-2xl">
                            <Document
                                file={pdfFile}
                                onLoadSuccess={({numPages}) => setNumPages(numPages)}
                                loading={<div
                                    className="w-[800px] h-[1000px] flex items-center justify-center text-gray-400">Loading
                                    PDF...</div>}
                                onLoadError={(error) => console.error('PDF load error:', error)}
                            >
                                <Page
                                    pageNumber={activePageIndex + 1}
                                    renderTextLayer={false}
                                    renderAnnotationLayer={false}
                                    scale={1.5}
                                    onRenderSuccess={() => setIsRendering(false)}
                                    onRenderError={(error) => console.error('PDF render error:', error)}
                                />
                            </Document>

                            <svg className="absolute inset-0 w-full h-full">
                                {measurements.filter(m => m.pageIndex === activePageIndex && !m.hidden).map(m => (
                                    <g key={m.id}>
                                        {m.type === 'shape' ? (
                                            <>
                                                <polygon
                                                    points={m.points.map(p => `${p.x},${p.y}`).join(' ')}
                                                    fill={(() => {
                                                        const color = getGroupColor(m.group);
                                                        const opacity = selectedShape === m.id ? '0.4' : '0.3';
                                                        // Convert hex to rgba
                                                        const r = parseInt(color.slice(1, 3), 16);
                                                        const g = parseInt(color.slice(3, 5), 16);
                                                        const b = parseInt(color.slice(5, 7), 16);
                                                        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
                                                    })()}
                                                    stroke={selectedShape === m.id ? "#3b82f6" : getGroupColor(m.group)}
                                                    strokeWidth={Math.max(1, (selectedShape === m.id ? 3 : 2) / zoom)}
                                                    vectorEffect="non-scaling-stroke"
                                                    className="cursor-pointer"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (activeTool === 'select') setSelectedShape(m.id);
                                                    }}
                                                />

                                                {/* Interactive Edges */}
                                                {m.points.map((p, idx) => {
                                                    const nextP = m.points[(idx + 1) % m.points.length];
                                                    return (
                                                        <line
                                                            key={`edge-${idx}`}
                                                            x1={p.x} y1={p.y}
                                                            x2={nextP.x} y2={nextP.y}
                                                            stroke="transparent"
                                                            strokeWidth={Math.max(8, 12 / zoom)}
                                                            className="cursor-pointer"
                                                            onMouseDown={(e) => handleEdgeMouseDown(e, m.id, idx)}
                                                            onContextMenu={(e) => handleEdgeRightClick(e, m.id, idx)}
                                                            vectorEffect="non-scaling-stroke"
                                                            style={{ pointerEvents: 'all' }}
                                                        />
                                                    );
                                                })}
                                            </>
                                        ) : (
                                            <polyline
                                                points={m.points.map(p => `${p.x},${p.y}`).join(' ')}
                                                fill="none"
                                                stroke="#ef4444"
                                                strokeWidth={Math.max(1, 3 / zoom)}
                                                vectorEffect="non-scaling-stroke"
                                            />
                                        )}

                                        {/* Vertices */}
                                        {m.points.map((p, idx) => (
                                            <circle
                                                key={idx}
                                                cx={p.x}
                                                cy={p.y}
                                                r={Math.max(1.5, 2.5 / zoom)}
                                                fill="white"
                                                stroke="black"
                                                strokeWidth={Math.max(0.25, 0.5 / zoom)}
                                                className="cursor-move hover:fill-yellow-400"
                                                onContextMenu={(e) => handlePointRightClick(e, m.id, idx)}
                                                onMouseDown={(e) => {
                                                    e.stopPropagation();
                                                    e.preventDefault();
                                                    setDraggedVertex({mId: m.id, pIdx: idx});
                                                }}
                                                vectorEffect="non-scaling-stroke"
                                            />
                                        ))}
                                    </g>
                                ))}

                                {/* Drawing preview */}
                                {points.length > 0 && (
                                    <g>
                                        <polyline
                                            points={points.map(p => `${p.x},${p.y}`).join(' ')}
                                            fill="none"
                                            stroke={isCalibrating ? "#facc15" : "#000"}
                                            strokeDasharray="5,5"
                                            strokeWidth={Math.max(1, 2 / zoom)}
                                            vectorEffect="non-scaling-stroke"
                                        />
                                        {points.map((p, i) => (
                                            <circle
                                                key={i}
                                                cx={p.x}
                                                cy={p.y}
                                                r={Math.max(1.5, (i === 0 && points.length >= 3 && activeTool === 'line' ? 5 : 2.5) / zoom)}
                                                fill={i === 0 && points.length >= 3 && activeTool === 'line' ? "#10b981" : "white"}
                                                stroke={i === 0 && points.length >= 3 && activeTool === 'line' ? "#10b981" : "black"}
                                                strokeWidth={Math.max(0.25, 0.5 / zoom)}
                                                className={`cursor-pointer ${i === 0 && points.length >= 3 && activeTool === 'line' ? 'animate-pulse' : 'hover:fill-blue-400'}`}
                                                vectorEffect="non-scaling-stroke"
                                            />
                                        ))}
                                    </g>
                                )}
                            </svg>
                        </div>
                    )}

                    {pdfFile && removedPages.has(activePageIndex) && (
                        <div
                            className="w-[800px] h-[1000px] flex items-center justify-center text-gray-400 bg-gray-100 border-2 border-dashed border-gray-300">
                            <div className="text-center">
                                <FileX size={48} className="mx-auto mb-2 opacity-50"/>
                                <div>Page {activePageIndex + 1} removed from takeoff</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Custom CSS for slider */}
            <style>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 12px;
          width: 12px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        }
        .slider::-moz-range-thumb {
          height: 12px;
          width: 12px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        }
      `}</style>
        </div>
    );
};

export default Canvas;