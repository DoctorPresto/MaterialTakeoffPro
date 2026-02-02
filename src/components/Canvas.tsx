import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Document, Page, pdfjs} from 'react-pdf';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {useStore} from '../store';
import {MeasurementType, Point} from '../types';
import {
    Check,
    ChevronLeft,
    ChevronRight,
    FileX,
    Lock,
    Minus,
    Plus,
    RotateCcw,
    Ruler,
    Square,
    Unlock
} from 'lucide-react';

import {InputModal} from './canvas/InputModal';
import {ContextMenu, EdgeContextMenu} from './canvas/ContextMenus';
import {FloatingDrawingPanel} from './canvas/FloatingDrawingPanel';
import {FloatingPropertiesPanel} from './canvas/FloatingPropertiesPanel';
import {PDFPageManager} from './canvas/PDFPageManager';
import {
    generateLinePath,
    getFormattedDistance,
    getGroupColor,
    MAX_ZOOM,
    MIN_ZOOM,
    ZOOM_INCREMENT
} from './canvas/utils';
import {getDistance, getPathLength, getPolygonArea, getPolygonCentroid} from '../utils/math';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

//  CONSTANTS 
const SNAP_THRESHOLD_PX = 5;

//  EXTERNAL HELPERS 
const formatArea = (areaSqFt: number) => `${Math.round(areaSqFt * 100) / 100} sq ft`;

const getGraphCenter = (points: Point[]): Point => {
    let totalLen = 0, weightedX = 0, weightedY = 0, segmentCount = 0;
    const isGraph = points.some(p => p.connectsTo && p.connectsTo.length > 0);

    if (isGraph) {
        points.forEach(p => {
            if (p.connectsTo) {
                p.connectsTo.forEach(targetIdx => {
                    const target = points[targetIdx];
                    if (target) {
                        const len = Math.sqrt(Math.pow(target.x - p.x, 2) + Math.pow(target.y - p.y, 2));
                        const midX = (p.x + target.x) / 2;
                        const midY = (p.y + target.y) / 2;
                        weightedX += midX * len; weightedY += midY * len; totalLen += len; segmentCount++;
                    }
                });
            }
        });
    } else {
        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i], p2 = points[i + 1];
            const len = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
            const midX = (p1.x + p2.x) / 2, midY = (p1.y + p2.y) / 2;
            weightedX += midX * len; weightedY += midY * len; totalLen += len; segmentCount++;
        }
    }
    if (totalLen === 0 || segmentCount === 0) return points[0] || { x: 0, y: 0 };
    return { x: weightedX / totalLen, y: weightedY / totalLen };
};

const getPolylineMidpoint = (points: Point[]): Point => {
    if (!points || points.length < 2) return points[0] || { x: 0, y: 0 };
    let totalLength = 0;
    const segmentLengths = [];
    for(let i = 0; i < points.length - 1; i++) {
        const d = Math.sqrt(Math.pow(points[i+1].x - points[i].x, 2) + Math.pow(points[i+1].y - points[i].y, 2));
        segmentLengths.push(d);
        totalLength += d;
    }
    let target = totalLength / 2;
    for(let i = 0; i < segmentLengths.length; i++) {
        if(target <= segmentLengths[i]) {
            const ratio = target / segmentLengths[i];
            const p1 = points[i], p2 = points[i+1];
            return { x: p1.x + (p2.x - p1.x) * ratio, y: p1.y + (p2.y - p1.y) * ratio };
        }
        target -= segmentLengths[i];
    }
    return points[Math.floor(points.length/2)];
};

const Canvas = () => {
    const {
        pdfFile, measurements, activeTool, activePageIndex, isCalibrating, activeWizardTool, isScaleLocked,
        addMeasurement, updateMeasurement, updateMeasurementTransient, deleteMeasurement, deletePoint, insertPointAfter,
        setScale, setIsCalibrating, setPageIndex, zoom, pan, setViewport, setTool, scale,
        commitHistory, undo, redo, groupColors, setGroupColor, setGroupVisibility,
        pageScales, setPageScale, setMeasurements, toggleScaleLock
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
    const [currentMousePos, setCurrentMousePos] = useState<Point | null>(null);
    const [snapPoint, setSnapPoint] = useState<Point | null>(null);
    const [branchingFrom, setBranchingFrom] = useState<{ id: string, pIdx: number } | null>(null);

    // Double Click Detection
    const [lastClickTime, setLastClickTime] = useState(0);
    const [lastClickId, setLastClickId] = useState<string | null>(null);
    const [lastClickIndex, setLastClickIndex] = useState<number | null>(null);
    const [lastClickTarget, setLastClickTarget] = useState<number | null>(null);

    // UI State
    const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
    const [isPropertiesPanelOpen, setIsPropertiesPanelOpen] = useState(false);
    const [modalType, setModalType] = useState<'name' | 'calibration' | null>(null);
    const [pendingShape, setPendingShape] = useState<{ type: MeasurementType, points: Point[] } | null>(null);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [contextMenu, setContextMenu] = useState<any>(null);
    const [edgeContextMenu, setEdgeContextMenu] = useState<any>(null);
    const [isIndependentScale, setIsIndependentScale] = useState(false);

    // Render Loop
    const [isRendering, setIsRendering] = useState(false);
    const requestRef = useRef<number>();

    const effectiveScale = pageScales[activePageIndex] || scale;
    const isCurrentPageIndependent = pageScales[activePageIndex] !== undefined;

    const selectedMeasurementData = useMemo(() =>
            measurements.find(m => m.id === selectedShape),
        [measurements, selectedShape]
    );

    //  HELPERS

    const screenToPdf = (screenX: number, screenY: number) => {
        if (!viewportRef.current) return { x: 0, y: 0 };
        const rect = viewportRef.current.getBoundingClientRect();
        return {
            x: (screenX - rect.left - pan.x) / zoom,
            y: (screenY - rect.top - pan.y) / zoom
        };
    };

    const updateViewportSafe = (newZoom: number, newPan: { x: number, y: number }) => {
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
        requestRef.current = requestAnimationFrame(() => {
            setViewport(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom)), newPan);
            requestRef.current = undefined;
        });
    };

    const findSnapTarget = (x: number, y: number): Point | null => {
        const threshold = SNAP_THRESHOLD_PX / zoom;
        let closest: Point | null = null;
        let minDistance = threshold;

        measurements.forEach(m => {
            if (m.pageIndex !== activePageIndex || m.hidden) return;
            m.points.forEach(p => {
                const dist = Math.sqrt(Math.pow(p.x - x, 2) + Math.pow(p.y - y, 2));
                if (dist < minDistance) {
                    minDistance = dist;
                    closest = { x: p.x, y: p.y };
                }
            });
        });
        return closest;
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

    const createDefaultSquare = (center: Point) => {
        const size = 100 / zoom;
        return [
            { x: center.x - size / 2, y: center.y - size / 2 },
            { x: center.x + size / 2, y: center.y - size / 2 },
            { x: center.x + size / 2, y: center.y + size / 2 },
            { x: center.x - size / 2, y: center.y + size / 2 }
        ];
    };

    //  HANDLERS 

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

    const handleRemovePage = (pageIndex: number) => {
        setRemovedPages(prev => new Set([...prev, pageIndex]));
        if (pageIndex === activePageIndex) {
            let nextPage = pageIndex + 1;
            while (nextPage < numPages && removedPages.has(nextPage)) nextPage++;
            if (nextPage >= numPages) {
                nextPage = pageIndex - 1;
                while (nextPage >= 0 && removedPages.has(nextPage)) nextPage--;
            }
            if (nextPage >= 0) setPageIndex(nextPage);
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
                if (isIndependentScale) setPageScale(activePageIndex, newScale);
                else setScale(newScale);
            }
            setPoints([]);
            setIsCalibrating(false);
        } else if (modalType === 'name') {
            const finalName = val || (activeWizardTool ? activeWizardTool : "Untitled");
            if (pendingShape) {
                addMeasurement(pendingShape.type, pendingShape.points, finalName);
                setPendingShape(null);
            } else if (activeId) updateMeasurement(activeId, { name: finalName });
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
        if (enabled) setPageScale(activePageIndex, scale);
        else setPageScale(activePageIndex, undefined);
    };

    const handleBranchFromPoint = (mId: string, pIdx: number) => {
        setBranchingFrom({ id: mId, pIdx });
    };

    //  GRAPH OPS 
    const handleGraphDeletePoint = (mId: string, pIdx: number) => {
        const m = measurements.find(meas => meas.id === mId);
        if(!m) return;
        const isGraph = m.points.some(p => p.connectsTo && p.connectsTo.length > 0);
        if (!isGraph) { deletePoint(mId, pIdx); return; }
        const newPoints = m.points.filter((_, idx) => idx !== pIdx).map(p => {
            const newConnectsTo = (p.connectsTo || []).filter(targetIdx => targetIdx !== pIdx).map(targetIdx => targetIdx > pIdx ? targetIdx - 1 : targetIdx);
            return { ...p, connectsTo: newConnectsTo };
        });
        updateMeasurement(mId, { points: newPoints });
    };

    const handleGraphSplitEdge = (mId: string, sourceIdx: number, targetIdx: number, clickPoint: Point) => {
        const m = measurements.find(meas => meas.id === mId);
        if (!m) return;
        const newPointIdx = m.points.length;
        const newPoint: Point = { ...clickPoint, connectsTo: [targetIdx] };
        const updatedPoints = [...m.points, newPoint];
        const sourcePoint = updatedPoints[sourceIdx];
        updatedPoints[sourceIdx] = { ...sourcePoint, connectsTo: (sourcePoint.connectsTo || []).map(idx => idx === targetIdx ? newPointIdx : idx) };
        updateMeasurement(mId, { points: updatedPoints });
    };

    const handleConvertToCurve = (mId: string, sourceIdx: number, targetIdx: number) => {
        const m = measurements.find(meas => meas.id === mId);
        if (!m) return;
        const newPoints = [...m.points];
        const targetPoint = newPoints[targetIdx];
        const sourcePoint = newPoints[sourceIdx];
        const cp = { x: (sourcePoint.x + targetPoint.x) / 2, y: (sourcePoint.y + targetPoint.y) / 2 - 20/zoom };
        newPoints[targetIdx] = { ...targetPoint, controlPoint: cp };
        updateMeasurement(mId, { points: newPoints });
        commitHistory();
    };

    //  MOUSE & KEY HANDLERS 

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            if (e.ctrlKey || e.metaKey) {
                if (e.key.toLowerCase() === 'z') {
                    e.preventDefault();
                    if (e.shiftKey) redo(); else undo();
                } else if (e.key.toLowerCase() === 'y') {
                    e.preventDefault();
                    redo();
                }
            } else {
                switch(e.key.toLowerCase()) {
                    case 'l': setTool('line'); break;
                    case 's': setTool('shape'); break;
                    case 'm': setTool('measure'); break;
                    case 'v': case 'escape':
                        setTool('select'); setPoints([]); setBranchingFrom(null); setSelectedShape(null);
                        break;
                    case 'delete': case 'backspace':
                        if (selectedShape) { deleteMeasurement(selectedShape); setSelectedShape(null); }
                        break;
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [undo, redo, selectedShape, deleteMeasurement, setTool]);

    const handleEdgeMouseDown = (e: React.MouseEvent, mId: string, sourceIdx: number, targetIdx?: number) => {
        e.preventDefault(); e.stopPropagation();
        const now = Date.now();
        const sameTarget = targetIdx !== undefined ? lastClickTarget === targetIdx : true;
        if (lastClickId === mId && lastClickIndex === sourceIdx && sameTarget && now - lastClickTime < 300) {
            const clickPoint = screenToPdf(e.clientX, e.clientY);
            if (targetIdx !== undefined) handleGraphSplitEdge(mId, sourceIdx, targetIdx, clickPoint);
            else insertPointAfter(mId, sourceIdx, clickPoint);
            setLastClickTime(0); setLastClickId(null); setLastClickTarget(null);
        } else {
            setLastClickTime(now); setLastClickId(mId); setLastClickIndex(sourceIdx); setLastClickTarget(targetIdx !== undefined ? targetIdx : null);
        }
    };

    const handleEdgeRightClick = (e: React.MouseEvent, mId: string, sourceIdx: number, targetIdx?: number) => {
        e.preventDefault(); e.stopPropagation();
        const clickPoint = screenToPdf(e.clientX, e.clientY);
        setEdgeContextMenu({
            x: e.clientX, y: e.clientY,
            onAddVertex: () => { if (targetIdx !== undefined) handleGraphSplitEdge(mId, sourceIdx, targetIdx, clickPoint); else insertPointAfter(mId, sourceIdx, clickPoint); },
            onConvertToCurve: targetIdx !== undefined ? () => handleConvertToCurve(mId, sourceIdx, targetIdx) : undefined
        });
    };

    const handlePointRightClick = (e: React.MouseEvent, mId: string, pIdx: number) => {
        e.preventDefault(); e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY, mId, pIdx });
    };

    const handleRightClickCanvas = (e: React.MouseEvent) => {
        e.preventDefault();
        if (branchingFrom) { setBranchingFrom(null); return; }
        if (isCalibrating) { setIsCalibrating(false); setPoints([]); return; }
        if (points.length >= 2 && activeTool === 'line') {
            const finalName = activeWizardTool || "Line";
            addMeasurement('line', points, finalName);
            setPoints([]);
            setTimeout(() => {
                const newShape = measurements.find(m => m.name === finalName && m.points.length === points.length);
                if (newShape) { setSelectedShape(newShape.id); setIsPropertiesPanelOpen(true); }
            }, 0);
        } else if (activeTool === 'measure') {
            setPoints([]);
        }
    };

    const handleMouseUp = () => {
        if (draggedVertex) commitHistory();
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
            updateViewportSafe(newZoom, pan);
        } else {
            updateViewportSafe(zoom, { x: pan.x - e.deltaX, y: pan.y - e.deltaY });
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        let { x, y } = screenToPdf(e.clientX, e.clientY);
        let snapped = false;

        if ((activeTool === 'line' || activeTool === 'shape' || activeTool === 'measure' || draggedVertex || branchingFrom) && !e.ctrlKey) {
            const target = findSnapTarget(x, y);
            if (target) {
                if (!snapPoint || snapPoint.x !== target.x || snapPoint.y !== target.y) setSnapPoint(target);
                x = target.x; y = target.y; snapped = true;
            } else {
                if (snapPoint) setSnapPoint(null);
            }
        } else {
            if (snapPoint) setSnapPoint(null);
        }

        if (e.shiftKey && points.length > 0 && !snapped) {
            const last = points[points.length - 1];
            const dx = Math.abs(x - last.x);
            const dy = Math.abs(y - last.y);
            if (dx > dy) y = last.y; else x = last.x;
        }

        if (activeTool === 'measure' || activeTool === 'line' || branchingFrom) setCurrentMousePos({ x, y });

        if (draggedVertex) {
            const m = measurements.find(m => m.id === draggedVertex.mId);
            if (m) {
                const sourcePoint = m.points[draggedVertex.pIdx];
                const coincidentIndices = m.points.map((p, i) => (Math.abs(p.x - sourcePoint.x) < 0.01 && Math.abs(p.y - sourcePoint.y) < 0.01) ? i : -1).filter(i => i !== -1);
                const indicesToUpdate = coincidentIndices.length > 0 ? coincidentIndices : [draggedVertex.pIdx];
                const newPoints = [...m.points];
                indicesToUpdate.forEach(i => { newPoints[i] = { ...newPoints[i], x, y }; });
                updateMeasurementTransient(m.id, { points: newPoints });
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
            updateViewportSafe(zoom, { x: pan.x + dx, y: pan.y + dy });
            setLastMouse({ x: e.clientX, y: e.clientY });
        }
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button === 1 || (e.button === 0 && e.shiftKey && !points.length)) {
            e.preventDefault();
            setIsPanning(true);
            setLastMouse({ x: e.clientX, y: e.clientY });
            return;
        }

        if (e.button === 0 && !contextMenu && !draggedVertex && !edgeContextMenu) {
            let { x, y } = screenToPdf(e.clientX, e.clientY);
            if (snapPoint && !e.ctrlKey) { x = snapPoint.x; y = snapPoint.y; }
            else if (e.shiftKey && points.length > 0) {
                const last = points[points.length - 1];
                const dx = Math.abs(x - last.x); const dy = Math.abs(y - last.y);
                if (dx > dy) y = last.y; else x = last.x;
            }

            if (branchingFrom) {
                const m = measurements.find(meas => meas.id === branchingFrom.id);
                if (m) {
                    const newPointIndex = m.points.length;
                    const newPoint: Point = { x, y, connectsTo: [] };
                    const newPoints = [...m.points, newPoint];
                    const parentPoint = newPoints[branchingFrom.pIdx];
                    const existingConnections = parentPoint.connectsTo || [];
                    newPoints[branchingFrom.pIdx] = { ...parentPoint, connectsTo: [...existingConnections, newPointIndex] };
                    updateMeasurement(m.id, { points: newPoints });
                    setBranchingFrom({ id: m.id, pIdx: newPointIndex });
                }
                return;
            }

            if (activeTool === 'select' && !isCalibrating) {
                const clickedShape = measurements.find(m => m.pageIndex === activePageIndex && m.type === 'shape' && isPointInShape({ x, y }, m.points));
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
                    if (newShape) { setSelectedShape(newShape.id); setIsPropertiesPanelOpen(true); }
                }, 0);
                return;
            }

            if (activeTool === 'measure') {
                if (points.length >= 1) setPoints([{ x, y }]);
                else setPoints([{ x, y }]);
                return;
            }

            if (activeTool === 'line' && points.length >= 3) {
                const firstPoint = points[0];
                const distance = Math.sqrt(Math.pow(x - firstPoint.x, 2) + Math.pow(y - firstPoint.y, 2));
                const threshold = 15 / zoom;
                if (distance < threshold) {
                    const finalName = activeWizardTool || 'Shape';
                    addMeasurement('shape', points, finalName);
                    setPoints([]);
                    setTimeout(() => {
                        const newShape = measurements[measurements.length - 1];
                        if (newShape) { setSelectedShape(newShape.id); setIsPropertiesPanelOpen(true); }
                    }, 0);
                    return;
                }
            }

            const newPoint: Point = { x, y, connectsTo: [] };
            let updatedPoints = [...points, newPoint];
            if (points.length > 0) {
                const lastIndex = points.length - 1;
                const newIndex = points.length;
                updatedPoints[lastIndex] = { ...updatedPoints[lastIndex], connectsTo: [...(updatedPoints[lastIndex].connectsTo || []), newIndex] };
            }
            setPoints(updatedPoints);
            if (isCalibrating && updatedPoints.length === 2) setModalType('calibration');
        }
    };

    //  RENDER START 
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
                    onConvertToCurve={edgeContextMenu.onConvertToCurve}
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
                onSetGroupVisibility={setGroupVisibility}
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
                        onClick={isScaleLocked ? undefined : handleCalibrate}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${isScaleLocked
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed border border-gray-300'
                            : (isCalibrating ? 'bg-yellow-100 text-yellow-700 border border-yellow-200 animate-pulse' : 'bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-200')
                        }`}
                    >
                        <Ruler size={14} />
                        {isCalibrating ? 'Calibrating...' : 'Calibrate'}
                    </button>

                    <button
                        onClick={toggleScaleLock}
                        className={`p-1.5 rounded hover:bg-gray-200 ${isScaleLocked ? 'text-red-500' : 'text-gray-400'}`}
                        title={isScaleLocked ? "Unlock Scale" : "Lock Scale"}
                    >
                        {isScaleLocked ? <Lock size={14} /> : <Unlock size={14} />}
                    </button>

                    <div className="flex items-center gap-2">
                        {isCurrentPageIndependent ? (
                            <div className="flex items-center gap-1 bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs font-bold cursor-pointer hover:bg-purple-200" onClick={() => !isScaleLocked && toggleIndependentScale(false)} title="Click to use Global Scale">
                                <Check size={10} /> Pg Scale
                            </div>
                        ) : (
                            <div className="flex items-center gap-1 bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-bold cursor-pointer hover:bg-green-200" onClick={() => !isScaleLocked && toggleIndependentScale(true)} title="Click to make Page Scale Independent">
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
                            onClick={() => updateViewportSafe(zoom - ZOOM_INCREMENT, pan)}
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
                                onChange={(e) => updateViewportSafe(parseFloat(e.target.value), pan)}
                                className="w-20 h-1 bg-gray-300 rounded-lg appearance-none cursor-pointer slider"
                                title="Zoom Slider"
                            />
                            <span className="w-12 text-center text-xs font-mono font-bold text-gray-600">
                                {Math.round(zoom * 100)}%
                            </span>
                        </div>

                        <button
                            onClick={() => updateViewportSafe(zoom + ZOOM_INCREMENT, pan)}
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

                                updateViewportSafe(fitZoom, { x: centerX, y: centerY });
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
                                    const showLabels = m.labels && (m.labels.showTotalLength || m.labels.showArea || m.labels.showEdgeLengths);
                                    const fontSize = Math.max(10, 14 / zoom);

                                    // LABEL POSITIONING
                                    let labelPos = { x: 0, y: 0 };
                                    if (m.type === 'shape') {
                                        labelPos = getPolygonCentroid(m.points);
                                        if (isNaN(labelPos.x) || isNaN(labelPos.y)) {
                                            const sum = m.points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
                                            labelPos = { x: sum.x / m.points.length, y: sum.y / m.points.length };
                                        }
                                    } else {
                                        const isGraph = m.points.some(p => p.connectsTo && p.connectsTo.length > 0);
                                        if (isGraph) labelPos = getGraphCenter(m.points);
                                        else labelPos = getPolylineMidpoint(m.points);
                                    }

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

                                                    {m.points.some(p => p.connectsTo && p.connectsTo.length > 0) ?
                                                        m.points.map((p, sourceIdx) => {
                                                            if (!p.connectsTo) return null;
                                                            return p.connectsTo.map(targetIdx => {
                                                                const targetP = m.points[targetIdx];
                                                                if (!targetP) return null;
                                                                return (
                                                                    <line
                                                                        key={`edge-${sourceIdx}-${targetIdx}`}
                                                                        x1={p.x} y1={p.y}
                                                                        x2={targetP.x} y2={targetP.y}
                                                                        stroke="transparent"
                                                                        strokeWidth={Math.max(8, 12 / zoom)}
                                                                        className="cursor-pointer"
                                                                        onMouseDown={(e) => handleEdgeMouseDown(e, m.id, sourceIdx, targetIdx)}
                                                                        onContextMenu={(e) => handleEdgeRightClick(e, m.id, sourceIdx, targetIdx)}
                                                                        vectorEffect="non-scaling-stroke"
                                                                        style={{ pointerEvents: 'all' }}
                                                                    />
                                                                );
                                                            });
                                                        })
                                                        :
                                                        m.points.map((p, idx) => {
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
                                                        })
                                                    }
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

                                            {/* LABELS */}
                                            {showLabels && (
                                                <g pointerEvents="none" className="select-none font-sans font-bold" style={{ textShadow: '0px 0px 2px white, 0px 0px 4px white' }}>
                                                    {m.type === 'shape' && m.labels?.showArea && (
                                                        <text x={labelPos.x} y={m.labels.showTotalLength ? labelPos.y + (fontSize * 0.7) : labelPos.y} textAnchor="middle" dominantBaseline="middle" fill="black" fontSize={fontSize}>
                                                            {(() => {
                                                                let area = getPolygonArea(m.points) / (effectiveScale * effectiveScale);
                                                                if (m.pitch) area *= Math.sqrt(1 + Math.pow(m.pitch / 12, 2));
                                                                return formatArea(area);
                                                            })()}
                                                        </text>
                                                    )}
                                                    {m.labels?.showTotalLength && (
                                                        <text x={labelPos.x} y={m.type === 'shape' && m.labels.showArea ? labelPos.y - (fontSize * 0.7) : labelPos.y - (m.type === 'line' ? 10/zoom : 0)} textAnchor="middle" dominantBaseline="middle" fill="blue" fontSize={fontSize * 1.1} fontWeight="bold">
                                                            {(() => {
                                                                const len = getPathLength([...m.points, (m.type === 'shape' ? m.points[0] : null)].filter(Boolean) as Point[]) / effectiveScale;
                                                                const feet = Math.floor(len);
                                                                const inches = Math.round((len - feet) * 12);
                                                                return `${feet}' ${inches}"`;
                                                            })()}
                                                        </text>
                                                    )}
                                                    {m.labels?.showEdgeLengths && (() => {
                                                        const renderEdgeText = (p1: Point, p2: Point, key: string) => {
                                                            const midX = (p1.x + p2.x) / 2;
                                                            const midY = (p1.y + p2.y) / 2;
                                                            const edgeLen = getDistance(p1, p2) / effectiveScale;
                                                            const ft = Math.floor(edgeLen);
                                                            const inc = Math.round((edgeLen - ft) * 12);
                                                            return <text key={key} x={midX} y={midY} textAnchor="middle" dominantBaseline="middle" fill="#4b5563" fontSize={fontSize * 0.8}>{ft}'{inc}"</text>;
                                                        };

                                                        if (m.type === 'shape') {
                                                            return m.points.map((p, i) => {
                                                                const nextP = m.points[(i + 1) % m.points.length];
                                                                return renderEdgeText(p, nextP, `edge-${i}`);
                                                            });
                                                        }

                                                        const isGraph = m.points.some(p => p.connectsTo && p.connectsTo.length > 0);
                                                        if (isGraph) {
                                                            const graphLabels: React.ReactNode[] = [];
                                                            m.points.forEach((p, sourceIdx) => {
                                                                if (p.connectsTo) {
                                                                    p.connectsTo.forEach(targetIdx => {
                                                                        const nextP = m.points[targetIdx];
                                                                        if (nextP) {
                                                                            graphLabels.push(renderEdgeText(p, nextP, `edge-${sourceIdx}-${targetIdx}`));
                                                                        }
                                                                    });
                                                                }
                                                            });
                                                            return graphLabels;
                                                        } else {
                                                            return m.points.map((p, i) => {
                                                                if (i === m.points.length - 1) return null;
                                                                const nextP = m.points[i + 1];
                                                                return renderEdgeText(p, nextP, `edge-${i}`);
                                                            });
                                                        }
                                                    })()}
                                                </g>
                                            )}
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

                                {(activeTool === 'measure' || activeTool === 'line' || branchingFrom) && currentMousePos && (
                                    <g pointerEvents="none">
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