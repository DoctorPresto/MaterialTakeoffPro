import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
// FIX: Import worker directly from node_modules using Vite's ?url suffix
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

import { useStore } from '../store';
import { MeasurementType, Point } from '../types';
import {
    Check, ChevronLeft, ChevronRight, FileX, Minus, Plus, RotateCcw, Ruler, Square
} from 'lucide-react';

import { InputModal } from './canvas/InputModal';
import { ContextMenu, EdgeContextMenu } from './canvas/ContextMenus';
import { FloatingDrawingPanel } from './canvas/FloatingDrawingPanel';
import { FloatingPropertiesPanel } from './canvas/FloatingPropertiesPanel';
import { PDFPageManager } from './canvas/PDFPageManager';
import {
    getFormattedDistance, getGroupColor, MAX_ZOOM, MIN_ZOOM, RENDER_THROTTLE, ZOOM_INCREMENT, generateLinePath
} from './canvas/utils';

const Canvas = () => {
    const {
        pdfFile, measurements, activeTool, activePageIndex, isCalibrating, activeWizardTool,
        addMeasurement, updateMeasurement, deleteMeasurement, deletePoint: storeDeletePoint, insertPointAfter,
        setScale, setIsCalibrating, setPageIndex, zoom, pan, setViewport, setTool, scale,
        setMeasurements, undo, redo, groupColors, setGroupColor,
        pageScales, setPageScale
    } = useStore();

    // Local points state for the currently being drawn NEW measurement
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
    const [currentMousePos, setCurrentMousePos] = useState<Point | null>(null);

    // Branching State - tracks which point of which measurement we are actively extending
    const [branchingFrom, setBranchingFrom] = useState<{ id: string, pIdx: number } | null>(null);

    // Double Click Detection State
    const [lastClickTime, setLastClickTime] = useState(0);
    const [lastClickId, setLastClickId] = useState<string | null>(null);
    const [lastClickIndex, setLastClickIndex] = useState<number | null>(null);

    // UI State
    const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
    const [isPropertiesPanelOpen, setIsPropertiesPanelOpen] = useState(false);

    // Derived active measurement for properties panel
    const selectedMeasurementData = useMemo(() =>
            measurements.find(m => m.id === selectedShape),
        [measurements, selectedShape]
    );

    // Modal State
    const [modalType, setModalType] = useState<'name' | 'calibration' | null>(null);
    const [pendingShape, setPendingShape] = useState<{ type: MeasurementType, points: Point[] } | null>(null);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [contextMenu, setContextMenu] = useState<any>(null);
    const [edgeContextMenu, setEdgeContextMenu] = useState<any>(null);

    const [isIndependentScale, setIsIndependentScale] = useState(false);

    // Performance optimization state
    const [isRendering, setIsRendering] = useState(false);
    const [lastRenderTime, setLastRenderTime] = useState(0);
    const renderTimeoutRef = useRef<NodeJS.Timeout>();

    const effectiveScale = pageScales[activePageIndex] || scale;
    const isCurrentPageIndependent = pageScales[activePageIndex] !== undefined;

    //  Undo/Redo Key Listener
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key.toLowerCase() === 'z') {
                    e.preventDefault();
                    if (e.shiftKey) {
                        redo();
                    } else {
                        undo();
                    }
                } else if (e.key.toLowerCase() === 'y') {
                    e.preventDefault();
                    redo();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [undo, redo]);

    const handleToolChange = (tool: 'select' | 'line' | 'shape' | 'measure') => {
        setTool(tool);
        setPoints([]);
        setSelectedShape(null);
        setIsPropertiesPanelOpen(false);
        setCurrentMousePos(null);
        setBranchingFrom(null);
    };

    const handleCalibrate = () => {
        setIsCalibrating(!isCalibrating);
        setPoints([]);
        setBranchingFrom(null);
    };

    const handleOpenProperties = (measurementId: string) => {
        setSelectedShape(measurementId);
        setIsPropertiesPanelOpen(true);
    };

    const handleToggleMeasurementVisibility = (measurementId: string) => {
        const measurement = measurements.find(m => m.id === measurementId);
        if (measurement) {
            updateMeasurement(measurementId, { hidden: !measurement.hidden });
        }
    };

    const handleReorderMeasurements = (newGroupOrder: string[]) => {
        const currentPageItems: any[] = [];
        newGroupOrder.forEach(groupName => {
            const items = measurements.filter(m =>
                m.pageIndex === activePageIndex && (m.group || 'Ungrouped') === groupName
            );
            currentPageItems.push(...items);
        });

        const otherPageItems = measurements.filter(m => m.pageIndex !== activePageIndex);
        setMeasurements([...otherPageItems, ...currentPageItems]);
    };

    // Custom delete point that handles graph topology
    const handleGraphDeletePoint = (mId: string, pIdx: number) => {
        const m = measurements.find(meas => meas.id === mId);
        if(!m) return;

        // If it's a simple shape/line without connections, use store default
        const isGraph = m.points.some(p => p.connectsTo && p.connectsTo.length > 0);
        if (!isGraph) {
            storeDeletePoint(mId, pIdx);
            return;
        }

        // Logic for removing a node in the graph:
        // 1. Remove the point from array
        // 2. Shift all references > pIdx down by 1
        // 3. Remove any connections pointing TO pIdx

        const newPoints = m.points
            .filter((_, idx) => idx !== pIdx) // Remove the point
            .map(p => {
                const newConnectsTo = (p.connectsTo || [])
                    .filter(targetIdx => targetIdx !== pIdx) // Remove connection to deleted point
                    .map(targetIdx => targetIdx > pIdx ? targetIdx - 1 : targetIdx); // Shift indices
                return { ...p, connectsTo: newConnectsTo };
            });

        updateMeasurement(mId, { points: newPoints });
    };

    const screenToPdf = (screenX: number, screenY: number) => {
        if (!viewportRef.current) return { x: 0, y: 0 };
        const rect = viewportRef.current.getBoundingClientRect();
        return {
            x: (screenX - rect.left - pan.x) / zoom,
            y: (screenY - rect.top - pan.y) / zoom
        };
    };

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

    const createDefaultSquare = (center: Point) => {
        const size = 100 / zoom;
        return [
            { x: center.x - size / 2, y: center.y - size / 2 },
            { x: center.x + size / 2, y: center.y - size / 2 },
            { x: center.x + size / 2, y: center.y + size / 2 },
            { x: center.x - size / 2, y: center.y + size / 2 }
        ];
    };

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

    const handleBranchFromPoint = (mId: string, pIdx: number) => {
        setBranchingFrom({ id: mId, pIdx });
        // We do NOT set tool to 'line' or clear points.
        // We stay in 'select' mode but utilize the click handler to inject points.
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
            e.preventDefault();
            setIsPanning(true);
            setLastMouse({ x: e.clientX, y: e.clientY });
            return;
        }

        if (e.button === 0 && !contextMenu && !draggedVertex && !edgeContextMenu) {
            const { x, y } = screenToPdf(e.clientX, e.clientY);

            // HANDLE BRANCHING CLICK
            if (branchingFrom) {
                const m = measurements.find(meas => meas.id === branchingFrom.id);
                if (m) {
                    const newPointIndex = m.points.length;
                    const newPoint: Point = { x, y, connectsTo: [] };

                    // Create copy of points
                    const newPoints = [...m.points, newPoint];

                    // Link the 'branchingFrom' point to this new point
                    const parentPoint = newPoints[branchingFrom.pIdx];
                    const existingConnections = parentPoint.connectsTo || [];
                    newPoints[branchingFrom.pIdx] = {
                        ...parentPoint,
                        connectsTo: [...existingConnections, newPointIndex]
                    };

                    updateMeasurement(m.id, { points: newPoints });
                    // Update state to extend from the newly created point
                    setBranchingFrom({ id: m.id, pIdx: newPointIndex });
                }
                return;
            }

            if (activeTool === 'select' && !isCalibrating) {
                const clickedShape = measurements.find(m =>
                    m.pageIndex === activePageIndex &&
                    m.type === 'shape' &&
                    isPointInShape({ x, y }, m.points)
                );

                if (clickedShape) {
                    setSelectedShape(clickedShape.id);
                    setIsDraggingShape(true);
                    setShapeStartPos({ x, y });
                } else {
                    setSelectedShape(null);
                }
                return;
            }

            if (activeTool === 'shape') {
                const squarePoints = createDefaultSquare({ x, y });
                const finalName = activeWizardTool || 'Shape';
                addMeasurement('shape', squarePoints, finalName);
                setTimeout(() => {
                    const newShape = measurements[measurements.length - 1];
                    if (newShape) {
                        setSelectedShape(newShape.id);
                        setIsPropertiesPanelOpen(true);
                    }
                }, 0);
                return;
            }

            if (activeTool === 'measure') {
                if (points.length >= 1) {
                    setPoints([{ x, y }]);
                } else {
                    setPoints([{ x, y }]);
                }
                return;
            }

            if (activeTool === 'line' && points.length >= 3) {
                // If creating a new closed loop shape automatically
                const firstPoint = points[0];
                const distance = Math.sqrt(Math.pow(x - firstPoint.x, 2) + Math.pow(y - firstPoint.y, 2));
                const threshold = 15 / zoom;

                if (distance < threshold) {
                    const finalName = activeWizardTool || 'Shape';
                    addMeasurement('shape', points, finalName);
                    setPoints([]);
                    setTimeout(() => {
                        const newShape = measurements[measurements.length - 1];
                        if (newShape) {
                            setSelectedShape(newShape.id);
                            setIsPropertiesPanelOpen(true);
                        }
                    }, 0);
                    return;
                }
            }

            // ADD POINT TO NEW LINE BEING DRAWN
            const newPoint: Point = { x, y, connectsTo: [] };

            // If we have previous points, link the last one to this new one
            let updatedPoints = [...points, newPoint];
            if (points.length > 0) {
                const lastIndex = points.length - 1;
                const newIndex = points.length;

                // Copy the previous point and add connection
                updatedPoints[lastIndex] = {
                    ...updatedPoints[lastIndex],
                    connectsTo: [...(updatedPoints[lastIndex].connectsTo || []), newIndex]
                };
            }

            setPoints(updatedPoints);

            if (isCalibrating && updatedPoints.length === 2) {
                setModalType('calibration');
            }
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        const { x, y } = screenToPdf(e.clientX, e.clientY);

        if (activeTool === 'measure' || activeTool === 'line' || branchingFrom) {
            setCurrentMousePos({ x, y });
        }

        if (draggedVertex) {
            const m = measurements.find(m => m.id === draggedVertex.mId);
            if (m) {
                const newPoints = [...m.points];
                newPoints[draggedVertex.pIdx] = { ...newPoints[draggedVertex.pIdx], x, y };
                updateMeasurement(m.id, { points: newPoints });
            }
            return;
        }

        if (isDraggingShape && selectedShape && shapeStartPos) {
            const dx = x - shapeStartPos.x;
            const dy = y - shapeStartPos.y;

            const shape = measurements.find(m => m.id === selectedShape);
            if (shape) {
                const newPoints = shape.points.map(p => ({ ...p, x: p.x + dx, y: p.y + dy }));
                updateMeasurement(selectedShape, { points: newPoints });
                setShapeStartPos({ x, y });
            }
            return;
        }

        if (isPanning && lastMouse) {
            const dx = e.clientX - lastMouse.x;
            const dy = e.clientY - lastMouse.y;
            throttledViewportUpdate(zoom, { x: pan.x + dx, y: pan.y + dy });
            setLastMouse({ x: e.clientX, y: e.clientY });
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
            throttledViewportUpdate(zoom, { x: pan.x - e.deltaX, y: pan.y - e.deltaY });
        }
    };

    const handleRightClickCanvas = (e: React.MouseEvent) => {
        e.preventDefault();

        // Stop Branching
        if (branchingFrom) {
            setBranchingFrom(null);
            return;
        }

        if (isCalibrating) {
            setIsCalibrating(false);
            setPoints([]);
            return;
        }

        // Finish drawing Line
        if (points.length >= 2 && activeTool === 'line') {
            const finalName = activeWizardTool || "Line";
            addMeasurement('line', points, finalName);
            setPoints([]);
            setTimeout(() => {
                const newShape = measurements.find(m => m.name === finalName && m.points.length === points.length);
                if (newShape) {
                    setSelectedShape(newShape.id);
                    setIsPropertiesPanelOpen(true);
                }
            }, 0);
        } else if (activeTool === 'measure') {
            setPoints([]);
        }
    };

    const handlePointRightClick = (e: React.MouseEvent, mId: string, pIdx: number) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY, mId, pIdx });
    };

    const handleEdgeMouseDown = (e: React.MouseEvent, mId: string, idx: number) => {
        e.preventDefault();
        e.stopPropagation();
        // Graph edge selection is complex, for now we disable split-on-click for graph lines to keep it manageable
        // Or we implement basic splitting if needed, but 'insertPointAfter' needs graph awareness.
        // For simplicity, we fallback to standard behavior but check connectivity logic would need updates.
        // Assuming simple behavior for now:
        const now = Date.now();
        if (lastClickId === mId && lastClickIndex === idx && now - lastClickTime < 300) {
            // Double click behavior - maybe disabled for graph lines for now to ensure stability
        } else {
            setLastClickTime(now);
            setLastClickId(mId);
            setLastClickIndex(idx);
        }
    };

    const handleEdgeRightClick = (e: React.MouseEvent, mId: string, edgeIndex: number) => {
        e.preventDefault();
        e.stopPropagation();
        // Graph edges are drawn per connection. edgeIndex here is ambiguous in a graph.
        // For now, suppress context menu on edges if graph to avoid index confusion.
        const m = measurements.find(me => me.id === mId);
        const isGraph = m?.points.some(p => p.connectsTo && p.connectsTo.length > 0);

        if (!isGraph) {
            const clickPoint = screenToPdf(e.clientX, e.clientY);
            setEdgeContextMenu({
                x: e.clientX,
                y: e.clientY,
                onAddVertex: () => insertPointAfter(mId, edgeIndex, clickPoint)
            });
        }
    };

    const handleRemovePage = (pageIndex: number) => {
        setRemovedPages(prev => new Set([...prev, pageIndex]));
        if (pageIndex === activePageIndex) {
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

    const handleModalSave = (val: string) => {
        if (modalType === 'calibration') {
            const p1 = points[0];
            const p2 = points[1];
            const pixelDist = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
            const realDist = parseFloat(val);
            if (realDist > 0) {
                const newScale = pixelDist / realDist;
                if (isIndependentScale) {
                    setPageScale(activePageIndex, newScale);
                } else {
                    setScale(newScale);
                }
            }
            setPoints([]);
            setIsCalibrating(false);
        } else if (modalType === 'name') {
            const finalName = val || (activeWizardTool ? activeWizardTool : "Untitled");
            if (pendingShape) {
                addMeasurement(pendingShape.type, pendingShape.points, finalName);
                setPendingShape(null);
            } else if (activeId) {
                updateMeasurement(activeId, { name: finalName });
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

    const toggleIndependentScale = (enabled: boolean) => {
        if (enabled) {
            setPageScale(activePageIndex, scale);
        } else {
            setPageScale(activePageIndex, undefined);
        }
    };

    const availablePages = Array.from({ length: numPages }, (_, i) => i).filter(i => !removedPages.has(i));

    return (
        <div className="flex-1 relative bg-gray-900 overflow-hidden flex flex-col">
            <InputModal
                isOpen={!!modalType}
                title={modalType === 'name' ? "Name Measurement" : "Calibrate Scale"}
                label={modalType === 'name' ? "Name" : "Real World Distance (ft)"}
                initialValue={modalType === 'name' && activeId ? measurements.find(m => m.id === activeId)?.name || "" : ""}
                onSave={handleModalSave}
                onCancel={handleModalCancel}
                showCheckbox={modalType === 'calibration'}
                checkboxLabel="This Page Only"
                checkboxValue={isIndependentScale}
                onCheckboxChange={setIsIndependentScale}
            />

            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    onClose={() => setContextMenu(null)}
                    measurement={measurements.find(m => m.id === contextMenu.mId)}
                    actions={{
                        deletePoint: () => handleGraphDeletePoint(contextMenu.mId, contextMenu.pIdx),
                        addPoint: () => {
                            insertPointAfter(contextMenu.mId, contextMenu.pIdx, undefined);
                        },
                        rename: () => {
                            setActiveId(contextMenu.mId);
                            setModalType('name');
                        },
                        deleteShape: () => deleteMeasurement(contextMenu.mId),
                        branch: () => handleBranchFromPoint(contextMenu.mId, contextMenu.pIdx)
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
                onReorderMeasurements={handleReorderMeasurements}
                groupColors={groupColors}
            />

            {isPropertiesPanelOpen && selectedMeasurementData && (
                <FloatingPropertiesPanel
                    measurement={selectedMeasurementData}
                    onUpdate={(updates) => {
                        updateMeasurement(selectedMeasurementData.id, updates);
                    }}
                    onDelete={() => {
                        deleteMeasurement(selectedMeasurementData.id);
                        setIsPropertiesPanelOpen(false);
                        setSelectedShape(null);
                    }}
                    onClose={() => {
                        setIsPropertiesPanelOpen(false);
                    }}
                    isOpen={isPropertiesPanelOpen}
                    allMeasurements={measurements}
                    groupColors={groupColors}
                    onSetGroupColor={setGroupColor}
                />
            )}

            <div
                className="absolute top-0 left-0 w-full h-12 bg-white/90 backdrop-blur border-b flex items-center px-4 justify-between z-40 shadow-sm">
                <div className="flex items-center gap-4 w-1/4">
                    <span className="font-bold text-gray-500 text-xs uppercase tracking-wider">Measurements</span>

                    <button
                        onClick={handleCalibrate}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${isCalibrating
                            ? 'bg-yellow-100 text-yellow-700 border border-yellow-200 animate-pulse'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-200'
                        }`}
                    >
                        <Ruler size={14} />
                        {isCalibrating ? 'Calibrating...' : 'Calibrate'}
                    </button>

                    <div className="flex items-center gap-2">
                        {isCurrentPageIndependent ? (
                            <div className="flex items-center gap-1 bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs font-bold cursor-pointer hover:bg-purple-200" onClick={() => toggleIndependentScale(false)} title="Click to use Global Scale">
                                <Check size={10} /> Pg Scale
                            </div>
                        ) : (
                            <div className="flex items-center gap-1 bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-bold cursor-pointer hover:bg-green-200" onClick={() => toggleIndependentScale(true)} title="Click to make Page Scale Independent">
                                <Check size={10} /> Global
                            </div>
                        )}
                    </div>
                    {branchingFrom && (
                        <div className="flex items-center gap-1 bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs font-bold animate-pulse">
                            Branching Active - Click to Extend
                        </div>
                    )}

                    {selectedShape && !branchingFrom && (
                        <div
                            className="flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold">
                            <Square size={10} /> Shape Selected
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
                        <ChevronLeft size={18} />
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
                        <ChevronRight size={18} />
                    </button>
                </div>

                <div className="flex items-center gap-2 w-1/4 justify-end">
                    <div className="flex items-center bg-gray-100 rounded-md p-1 gap-1">
                        <button
                            onClick={() => throttledViewportUpdate(zoom - ZOOM_INCREMENT, pan)}
                            className="p-1 hover:bg-white rounded shadow-sm transition-all"
                            title="Zoom Out"
                        >
                            <Minus size={16} />
                        </button>

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
                            <Plus size={16} />
                        </button>
                    </div>

                    <button
                        onClick={() => {
                            if (viewportRef.current) {
                                const container = viewportRef.current;
                                const containerWidth = container.clientWidth;
                                const containerHeight = container.clientHeight;
                                const pageWidth = 800 * 1.5;
                                const pageHeight = 1000 * 1.5;

                                const scaleX = containerWidth / pageWidth;
                                const scaleY = containerHeight / pageHeight;
                                const fitZoom = Math.min(scaleX, scaleY) * 0.9;

                                const centerX = (containerWidth - pageWidth * fitZoom) / 2;
                                const centerY = (containerHeight - pageHeight * fitZoom) / 2;

                                throttledViewportUpdate(fitZoom, { x: centerX, y: centerY });
                            }
                        }}
                        className="p-1.5 hover:bg-gray-100 rounded text-gray-500 hover:text-blue-600"
                        title="Fit to Page"
                    >
                        <RotateCcw size={18} />
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
                style={{ cursor: isPanning ? 'grabbing' : (activeTool !== 'select' ? 'crosshair' : 'default') }}
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
                                onLoadSuccess={({ numPages }) => setNumPages(numPages)}
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
                                {measurements.filter(m => m.pageIndex === activePageIndex && !m.hidden).map(m => {
                                    const color = getGroupColor(m.group, groupColors);
                                    // Check if this measurement uses graph logic
                                    const isGraph = m.points.some(p => p.connectsTo && p.connectsTo.length > 0);

                                    return (
                                        <g key={m.id}>
                                            {m.type === 'shape' ? (
                                                <>
                                                    <polygon
                                                        points={m.points.map(p => `${p.x},${p.y}`).join(' ')}
                                                        fill={(() => {
                                                            const opacity = selectedShape === m.id ? '0.4' : '0.3';
                                                            const r = parseInt(color.slice(1, 3), 16);
                                                            const g = parseInt(color.slice(3, 5), 16);
                                                            const b = parseInt(color.slice(5, 7), 16);
                                                            return `rgba(${r}, ${g}, ${b}, ${opacity})`;
                                                        })()}
                                                        stroke={selectedShape === m.id ? "#3b82f6" : color}
                                                        strokeWidth={Math.max(1, (selectedShape === m.id ? 3 : 2) / zoom)}
                                                        vectorEffect="non-scaling-stroke"
                                                        className="cursor-pointer"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (activeTool === 'select') setSelectedShape(m.id);
                                                        }}
                                                    />

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
                                                <>
                                                    <path
                                                        d={generateLinePath(m.points)}
                                                        fill="none"
                                                        stroke={selectedShape === m.id ? "#3b82f6" : "#ef4444"}
                                                        strokeWidth={Math.max(1, (selectedShape === m.id ? 4 : 3) / zoom)}
                                                        vectorEffect="non-scaling-stroke"
                                                        className="cursor-pointer"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (activeTool === 'select') setSelectedShape(m.id);
                                                        }}
                                                    />

                                                    {/* If it's a legacy linear line, draw edge handles. If Graph, skip for now. */}
                                                    {!isGraph && m.points.map((p, idx) => {
                                                        if (idx === m.points.length - 1) return null;
                                                        const nextP = m.points[idx + 1];
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
                                            )}

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
                                                        setDraggedVertex({ mId: m.id, pIdx: idx });
                                                    }}
                                                    vectorEffect="non-scaling-stroke"
                                                />
                                            ))}
                                        </g>
                                    );
                                })}

                                {points.length > 0 && (
                                    <g>
                                        <path
                                            d={generateLinePath(points)}
                                            fill="none"
                                            stroke={isCalibrating ? "#facc15" : (activeTool === 'measure' ? "#f97316" : "#000")}
                                            strokeDasharray={activeTool === 'measure' ? "4,4" : "5,5"}
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
                                                stroke={i === 0 && points.length >= 3 && activeTool === 'line' ? "#10b981" : (activeTool === 'measure' ? "#f97316" : "black")}
                                                strokeWidth={Math.max(0.25, 0.5 / zoom)}
                                                className={`cursor-pointer ${i === 0 && points.length >= 3 && activeTool === 'line' ? 'animate-pulse' : 'hover:fill-blue-400'}`}
                                                vectorEffect="non-scaling-stroke"
                                            />
                                        ))}
                                    </g>
                                )}

                                {/* Floating Ghost Line for Drawing */}
                                {(activeTool === 'measure' || activeTool === 'line' || branchingFrom) && currentMousePos && (
                                    <g pointerEvents="none">
                                        {/* If branching, show line from the active branch point */}
                                        {branchingFrom && (
                                            (() => {
                                                const m = measurements.find(meas => meas.id === branchingFrom.id);
                                                const startP = m?.points[branchingFrom.pIdx];
                                                if (startP) return (
                                                    <line
                                                        x1={startP.x} y1={startP.y}
                                                        x2={currentMousePos.x} y2={currentMousePos.y}
                                                        stroke="#000"
                                                        strokeDasharray="5,5"
                                                        strokeWidth={Math.max(1, 2 / zoom)}
                                                        vectorEffect="non-scaling-stroke"
                                                    />
                                                );
                                            })()
                                        )}
                                        {/* If normal drawing, show line from last point */}
                                        {!branchingFrom && points.length > 0 && (
                                            <line
                                                x1={points[points.length - 1].x} y1={points[points.length - 1].y}
                                                x2={currentMousePos.x} y2={currentMousePos.y}
                                                stroke={activeTool === 'measure' ? "#f97316" : "#000"}
                                                strokeDasharray="4,4"
                                                strokeWidth={Math.max(1.5, 2 / zoom)}
                                                vectorEffect="non-scaling-stroke"
                                            />
                                        )}

                                        {/* Text Label Logic */}
                                        {(() => {
                                            let startP = null;
                                            if (branchingFrom) {
                                                const m = measurements.find(meas => meas.id === branchingFrom.id);
                                                startP = m?.points[branchingFrom.pIdx];
                                            } else if (points.length > 0) {
                                                startP = points[points.length - 1];
                                            }

                                            if (startP) {
                                                return (
                                                    <foreignObject
                                                        x={(startP.x + currentMousePos.x) / 2 - 40 / zoom}
                                                        y={(startP.y + currentMousePos.y) / 2 - 12 / zoom}
                                                        width={80 / zoom}
                                                        height={24 / zoom}
                                                    >
                                                        <div className="flex items-center justify-center h-full">
                                                            <span className="bg-orange-500 text-white px-2 py-0.5 rounded shadow text-xs font-bold whitespace-nowrap" style={{ fontSize: `${12 / zoom}px` }}>
                                                                {getFormattedDistance(startP, currentMousePos, effectiveScale)}
                                                            </span>
                                                        </div>
                                                    </foreignObject>
                                                );
                                            }
                                        })()}
                                    </g>
                                )}
                            </svg>
                        </div>
                    )}

                    {pdfFile && removedPages.has(activePageIndex) && (
                        <div
                            className="w-[800px] h-[1000px] flex items-center justify-center text-gray-400 bg-gray-100 border-2 border-dashed border-gray-300">
                            <div className="text-center">
                                <FileX size={48} className="mx-auto mb-2 opacity-50" />
                                <div>Page {activePageIndex + 1} removed from takeoff</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

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