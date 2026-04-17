import {create} from 'zustand';
import {persist} from 'zustand/middleware';
import { createJSONStorage } from 'zustand/middleware';
import { get, set as setIDB, del } from 'idb-keyval';
import JSZip from 'jszip';
import {v4 as uuidv4} from 'uuid';
import {
    AssemblyDef, AssemblyNode, AssemblyVariable, BuildingData, EstimateFile, ItemSet, ManualItem, MaterialDef, Measurement,
    MeasurementType, Point, ProjectAssembly, ProjectInfo, RecentFile, VariableSource, RoofLineType
} from './types';
import { getPathLength, getSlopeMultiplier, getPlanHipToTrueHipMultiplier } from './utils/math';
import { generatePlanePolygon } from './utils/roofOutline';

const generateUniqueName = (baseName: string, existingNames: string[]): string => {
    if (!existingNames.includes(baseName)) return baseName;
    let counter = 1;
    let uniqueName = `${baseName} ${counter}`;
    while (existingNames.includes(uniqueName)) {
        counter++;
        uniqueName = `${baseName} ${counter}`;
    }
    return uniqueName;
};

const recalculateRoofData = (measurements: Measurement[], scale: number, pageScales: Record<number, number>): Partial<BuildingData> => {
    let roofRidgeLength = 0, roofHipLength = 0, roofEaveLength = 0, roofGableLength = 0, valleyLength = 0, roofWallLength = 0, roofTransitionLength = 0;

    // ─── Pass 1: Collect all edges ─────────────────────────────────
    // For shared edges (hip/valley/ridge), we track them by nodeId pair
    // and resolve to the max pitch of the two adjacent planes.
    interface EdgeEntry { type: string; rawLength: number; pitch: number; }
    const sharedEdges = new Map<string, EdgeEntry>();  // edgeKey → entry (max pitch wins)
    const soloEdges: EdgeEntry[] = [];                 // eaves, gables, and edges without nodeIds

    measurements.forEach(m => {
        // Legacy standalone lines
        if (m.type === 'line' && m.roofLineType) {
            const effectiveScale = pageScales[m.pageIndex] || scale;
            const rawLength = getPathLength(m.points) / effectiveScale;
            const pitch = m.pitch || 4;
            soloEdges.push({ type: m.roofLineType, rawLength, pitch });
        }
        
        // Shape-first planes with classified edges
        if (m.type === 'shape' && m.edgeTypes) {
            const effectiveScale = pageScales[m.pageIndex] || scale;
            const pitch = m.pitch || 4;
            
            for (let i = 0; i < m.points.length; i++) {
                const type = m.edgeTypes[i];
                if (!type || type === 'none') continue;

                const p1 = m.points[i];
                const p2 = m.points[(i + 1) % m.points.length];
                
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const rawLength = Math.sqrt(dx * dx + dy * dy) / effectiveScale;

                // Shared edges (hip/valley/ridge) with nodeIds → deduplicate with max pitch
                if ((type === 'hip' || type === 'valley' || type === 'ridge') && p1.nodeId && p2.nodeId) {
                    const edgeKey = [p1.nodeId, p2.nodeId].sort().join('_');
                    const existing = sharedEdges.get(edgeKey);
                    if (existing) {
                        // Second encounter: upgrade to max pitch
                        existing.pitch = Math.max(existing.pitch, pitch);
                    } else {
                        sharedEdges.set(edgeKey, { type, rawLength, pitch });
                    }
                } else {
                    // Eaves, gables, or edges without nodeIds go straight through
                    soloEdges.push({ type, rawLength, pitch });
                }
            }
        }
    });

    // ─── Pass 2: Apply multipliers ─────────────────────────────────
    const applyEdge = (edge: EdgeEntry) => {
        switch (edge.type) {
            case 'ridge': roofRidgeLength += edge.rawLength; break;
            case 'eave':  roofEaveLength  += edge.rawLength; break;
            case 'gable': roofGableLength += edge.rawLength * getSlopeMultiplier(edge.pitch); break;
            case 'hip':   roofHipLength   += edge.rawLength * getPlanHipToTrueHipMultiplier(edge.pitch); break;
            case 'valley': valleyLength   += edge.rawLength * getPlanHipToTrueHipMultiplier(edge.pitch); break;
            case 'wall':   roofWallLength += edge.rawLength * getSlopeMultiplier(edge.pitch); break; // Apply slope multiplier to be safe
            case 'transition': roofTransitionLength += edge.rawLength; break; // usually horizontal, but could be sloped
        }
    };

    sharedEdges.forEach(edge => applyEdge(edge));
    soloEdges.forEach(edge => applyEdge(edge));
    
    return { roofRidgeLength, roofHipLength, roofEaveLength, roofGableLength, valleyLength, roofWallLength, roofTransitionLength };
};

export const recalculateFoundationData = (
    measurements: Measurement[],
    scale: number,
    pageScales: Record<number, number>
): Partial<BuildingData> => {
    let foundationPerimeter = 0;
    const nodeConnections = new Map<string, number>();
    const seenEdges = new Set<string>();

    // Per-section data: length and wallHeight
    const sections: { length: number; wallHeight: number }[] = [];

    measurements.forEach(m => {
        if (!m.isFoundation || m.points.length < 2) return;
        const effectiveScale = pageScales[m.pageIndex] || scale;
        const wallHeight = m.foundationWallHeight || 8; // default 8ft
        let sectionLength = 0;
        
        for (let i = 0; i < m.points.length; i++) {
            const p1 = m.points[i];
            const p2 = m.points[i + 1] || (m.type === 'shape' ? m.points[0] : null);
            
            if (!p2) break; // End of an open line
            
            const id1 = p1.nodeId || `${Math.round(p1.x*100)},${Math.round(p1.y*100)}`;
            const id2 = p2.nodeId || `${Math.round(p2.x*100)},${Math.round(p2.y*100)}`;
            if (id1 === id2) continue; // safety check
            
            const edgeSig = [id1, id2].sort().join('::');
            
            if (!seenEdges.has(edgeSig)) {
                seenEdges.add(edgeSig);
                const rawLength = Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2)) / effectiveScale;
                sectionLength += rawLength;
                
                nodeConnections.set(id1, (nodeConnections.get(id1) || 0) + 1);
                nodeConnections.set(id2, (nodeConnections.get(id2) || 0) + 1);
            }
        }

        foundationPerimeter += sectionLength;
        sections.push({ length: sectionLength, wallHeight });
    });

    let foundationCorners = 0;
    let foundationTees = 0;

    nodeConnections.forEach(connections => {
        if (connections === 2) foundationCorners++;
        if (connections === 3) foundationTees++;
        if (connections >= 4) foundationTees += Math.max(1, connections - 2);
    });

    // Per-course block calculation (flat, single course)
    const foundationStraightBlocksPerCourse = Math.max(0, (foundationPerimeter - (6 * foundationCorners) - (4.66 * foundationTees)) / 4);

    // Total blocks across all courses — use a weighted average wall height
    // For simplicity when sections have different heights, we compute a global average
    const totalLength = sections.reduce((sum, s) => sum + s.length, 0);
    const avgWallHeight = totalLength > 0
        ? sections.reduce((sum, s) => sum + s.length * s.wallHeight, 0) / totalLength
        : 8;
    const coursesPerBlock = 16 / 12; // 16 inches per course (exact fraction)
    const totalCourses = Math.ceil(avgWallHeight / coursesPerBlock);
    const totalStraightBlocks = foundationStraightBlocksPerCourse * totalCourses;
    const totalCornerBlocks = foundationCorners * totalCourses;
    const totalTeeBlocks = foundationTees * totalCourses;
    const totalBlocks = totalStraightBlocks + totalCornerBlocks + totalTeeBlocks;

    // HV Clips: 1 box per 150 blocks
    const foundationHVClips = Math.ceil(totalBlocks / 150);

    return { 
        foundationPerimeter, 
        foundationCorners, 
        foundationTees,
        foundationStraightBlocksPerCourse,
        foundationHVClips,
        foundationWallHeight: avgWallHeight
    };
};

const idbStorage = {
    getItem: async (name: string): Promise<string | null> => {
        return (await get(name)) || null;
    },
    setItem: async (name: string, value: string): Promise<void> => {
        await setIDB(name, value);
    },
    removeItem: async (name: string): Promise<void> => {
        await del(name);
    },
};

interface HistoryState {
    materials: MaterialDef[];
    assemblyDefs: AssemblyDef[];
    projectInfo: ProjectInfo;
    buildingData: BuildingData;
    measurements: Measurement[];
    itemSets: ItemSet[];
    groupColors: Record<string, string>;
    pageScales: Record<number, number>;
}

// DEFINING WIZARD STEP TYPE
export type WizardStepType = 'none' | 'roof' | 'foundation';

interface AppState {
    past: HistoryState[];
    future: HistoryState[];
    undo: () => void;
    redo: () => void;
    commitHistory: () => void;

    materials: MaterialDef[];
    assemblyDefs: AssemblyDef[];
    recentFiles: RecentFile[];
    estimateName: string | null;
    projectInfo: ProjectInfo;
    buildingData: BuildingData;
    pdfFile: string | null;
    lastModified: number;
    scale: number;
    pageScales: Record<number, number>;
    isScaleLocked: boolean;
    activePageIndex: number;
    activeTool: 'select' | 'line' | 'shape' | 'measure';
    activeWizardTool: string | null;
    activeMeasurementId: string | null;
    isCalibrating: boolean;
    zoom: number;
    pan: { x: number; y: number };
    measurements: Measurement[];
    itemSets: ItemSet[];
    favoriteItemSets: ItemSet[];
    groupColors: Record<string, string>;

    activeWizardStep: WizardStepType;
    setWizardStep: (step: WizardStepType) => void;

    activeRoofMode: 'none' | 'trace' | 'slope' | 'classify';
    setRoofMode: (mode: 'none' | 'trace' | 'slope' | 'classify') => void;
    
    selectedRoofPlaneId: string | null;
    setSelectedRoofPlaneId: (id: string | null) => void;
    
    selectedRoofEdgeIndex: number | null;
    setSelectedRoofEdgeIndex: (index: number | null) => void;

    subtractTargetPlaneId: string | null;
    setSubtractTargetPlaneId: (id: string | null) => void;
    addSubtractionToPlane: (planeId: string, polygon: Point[]) => void;
    
    classifySelectedEdge: (type: RoofLineType) => void;

    createEstimate: () => void;
    closeEstimate: () => void;
    saveEstimate: () => void;
    loadEstimateFromFile: (fileData: EstimateFile) => void;
    loadRecent: (id: string) => void;

    updateProjectInfo: (updates: Partial<ProjectInfo>) => void;
    updateBuildingData: (updates: Partial<BuildingData>) => void;
    setScale: (s: number) => void;
    setPageScale: (pageIndex: number, scale: number | undefined) => void;
    toggleScaleLock: () => void;
    setPageIndex: (index: number) => void;
    setTool: (t: 'select' | 'line' | 'shape' | 'measure') => void;
    setWizardTool: (tag: string | null) => void;
    setActiveMeasurement: (id: string | null) => void;
    setIsCalibrating: (status: boolean) => void;
    setViewport: (zoom: number, pan: { x: number, y: number }) => void;

    addMeasurement: (type: MeasurementType, points: Point[], name: string, tags?: string[], extraProps?: Partial<Measurement>) => void;
    updateMeasurementTransient: (id: string, updates: Partial<Measurement>) => void;
    updateMeasurement: (id: string, updates: Partial<Measurement>) => void;
    deleteMeasurement: (id: string) => void;
    setMeasurements: (measurements: Measurement[]) => void;
    setGroupColor: (group: string, color: string) => void;
    setGroupVisibility: (group: string | undefined, hidden: boolean) => void;
    addRoofPlaneFromDimensions: (shape: 'rectangle' | 'triangle' | 'trapezoid' | 'custom', dims: { width?: number; height?: number; topBase?: number; bottomBase?: number; customArea?: number }, pitch: number) => void;
    deletePoint: (measurementId: string, pointIndex: number) => void;
    insertPointAfter: (measurementId: string, pointIndex: number, clickPoint?: Point) => void;

    addMaterial: (mat: Omit<MaterialDef, 'id'>) => void;
    importMaterials: (mats: MaterialDef[]) => void;
    updateMaterial: (id: string, updates: Partial<MaterialDef>) => void;
    deleteMaterial: (id: string) => void;
    cloneMaterial: (id: string) => void;

    addAssemblyDef: (name: string, category: string) => void;
    updateAssemblyDef: (id: string, updates: Partial<AssemblyDef>) => void;
    deleteAssemblyDef: (id: string) => void;
    cloneAssemblyDef: (id: string) => void;
    importAssemblyDefs: (defs: AssemblyDef[]) => void;

    addVariableToDef: (defId: string, name: string, type: AssemblyVariable['type']) => void;
    deleteVariableFromDef: (defId: string, varId: string) => void;
    addNodeToDef: (defId: string, node: Omit<AssemblyNode, 'id'>) => void;
    updateNodeInDef: (defId: string, nodeId: string, updates: Partial<AssemblyNode>) => void;
    removeNodeFromDef: (defId: string, nodeId: string) => void;
    reorderNodeInDef: (defId: string, nodeId: string, direction: 'up' | 'down') => void;

    addItemSet: (name: string) => void;
    renameItemSet: (id: string, newName: string) => void;
    setItemSets: (itemSets: ItemSet[]) => void;
    updateItemSet: (id: string, updates: Partial<ItemSet>) => void;
    deleteItemSet: (id: string) => void;
    reorderItemsInSet: (setId: string, newOrder: string[]) => void;

    saveItemSetAsFavorite: (id: string, name: string) => void;
    addItemSetFromFavorite: (favoriteId: string) => void;
    deleteFavoriteItemSet: (favoriteId: string) => void;

    addInstanceToSet: (setId: string, defId: string) => void;
    deleteInstanceFromSet: (setId: string, instanceId: string) => void;
    updateInstanceVariable: (setId: string, instId: string, varId: string, source: VariableSource) => void;
    updateInstanceSelection: (setId: string, instId: string, nodeId: string, selectionId: string) => void;

    addManualItemToSet: (setId: string, item: Omit<ManualItem, 'id'>) => void;
    updateManualItem: (setId: string, itemId: string, updates: Partial<ManualItem>) => void;
    deleteManualItem: (setId: string, itemId: string) => void;
}

export const useStore = create<AppState>()(
    persist(
        (set, get) => ({
            past: [],
            future: [],
            materials: [],
            assemblyDefs: [],
            recentFiles: [],
            estimateName: null,
            pdfFile: null,
            lastModified: 0,
            projectInfo: {projectName: "New Project", customerName: "", notes: "", files: []},
            buildingData: {
                icfFoundation: false, foundationPerimeterId: null, foundationAreaId: null, hasGarage: false, garageShapeId: null,
                roofFlatArea: 0, numPlanes: 0, numPeaks: 0, valleyLength: 0,
                wasteFactorProfile: 'pro',
                foundationWallHeight: 8, foundationCorners: 0, foundationPerimeter: 0, foundationTees: 0, foundationStraightBlocksPerCourse: 0, foundationHVClips: 0, foundationRebar: 0,
                mainFloorPerimeter: 0, mainFloorGrossWallArea: 0, mainFloorNetWallArea: 0,
                mainFloorCorners: 4, mainFloorIntersections: 0, mainFloorIntWallLength4: 0, mainFloorIntWallLength6: 0,
                roofPitch: 4, numPitches: 1, roofRidgeLength: 0, roofHipLength: 0, roofEaveLength: 0, roofGableLength: 0,
                steelCoverageWidth: 36
            },
            scale: 1,
            pageScales: {},
            isScaleLocked: false,
            activePageIndex: 0,
            activeTool: 'select',
            activeWizardTool: null,
            activeMeasurementId: null,
            isCalibrating: false,
            zoom: 1,
            pan: {x: 0, y: 0},
            measurements: [],
            itemSets: [],
            favoriteItemSets: [],
            groupColors: {},

            planeBuilderSelectedIds: [],

            activeWizardStep: 'none',

            activeRoofMode: 'none',
            selectedRoofPlaneId: null,
            selectedRoofEdgeIndex: null,
            subtractTargetPlaneId: null,

            commitHistory: () => set((state) => {
                const current: HistoryState = {
                    materials: state.materials,
                    assemblyDefs: state.assemblyDefs,
                    projectInfo: state.projectInfo,
                    buildingData: state.buildingData,
                    measurements: state.measurements,
                    itemSets: state.itemSets,
                    groupColors: state.groupColors,
                    pageScales: state.pageScales
                };
                const newPast = [...state.past, current].slice(-50);
                return { past: newPast, future: [] };
            }),

            undo: () => set((state) => {
                if (state.past.length === 0) return state;
                const previous = state.past[state.past.length - 1];
                const newPast = state.past.slice(0, -1);
                const current: HistoryState = {
                    materials: state.materials,
                    assemblyDefs: state.assemblyDefs,
                    projectInfo: state.projectInfo,
                    buildingData: state.buildingData,
                    measurements: state.measurements,
                    itemSets: state.itemSets,
                    groupColors: state.groupColors,
                    pageScales: state.pageScales
                };
                return {
                    past: newPast,
                    future: [current, ...state.future],
                    ...previous
                };
            }),

            redo: () => set((state) => {
                if (state.future.length === 0) return state;
                const next = state.future[0];
                const newFuture = state.future.slice(1);
                const current: HistoryState = {
                    materials: state.materials,
                    assemblyDefs: state.assemblyDefs,
                    projectInfo: state.projectInfo,
                    buildingData: state.buildingData,
                    measurements: state.measurements,
                    itemSets: state.itemSets,
                    groupColors: state.groupColors,
                    pageScales: state.pageScales
                };
                return {
                    past: [...state.past, current],
                    future: newFuture,
                    ...next
                };
            }),

            createEstimate: () => set({
                estimateName: "Untitled", pdfFile: null, lastModified: Date.now(),
                projectInfo: {projectName: "New Project", customerName: "", notes: "", files: []},
                buildingData: {
                    icfFoundation: false, foundationPerimeterId: null, foundationAreaId: null, hasGarage: false, garageShapeId: null,
                    roofFlatArea: 0, numPlanes: 0, numPeaks: 0, valleyLength: 0,
                    wasteFactorProfile: 'pro', foundationWallHeight: 8, foundationCorners: 0, foundationPerimeter: 0, foundationTees: 0, foundationStraightBlocksPerCourse: 0, foundationHVClips: 0, foundationRebar: 0,
                    mainFloorPerimeter: 0, mainFloorGrossWallArea: 0, mainFloorNetWallArea: 0,
                    mainFloorCorners: 4, mainFloorIntersections: 0, mainFloorIntWallLength4: 0, mainFloorIntWallLength6: 0,
                    roofPitch: 4, numPitches: 1, roofRidgeLength: 0, roofHipLength: 0, roofEaveLength: 0, roofGableLength: 0,
                    steelCoverageWidth: 36
                },
                scale: 1, pageScales: {}, isScaleLocked: false, activePageIndex: 0, activeMeasurementId: null, measurements: [], itemSets: [], groupColors: {}, zoom: 1, pan: {x: 0, y: 0}, past: [], future: [], activeWizardStep: 'none'
            }),
            closeEstimate: () => set({estimateName: null, past: [], future: [], activeWizardStep: 'none'}),

            loadEstimateFromFile: (file) => {
                const meta = file.meta || {};
                const metaName = meta.name || "Untitled";
                const lastModified = meta.lastModified || Date.now();
                const fileData = file.data || {};

                const newRecent = {id: uuidv4(), name: metaName, lastOpened: Date.now(), data: file};

                const rawItemSets = fileData.itemSets || [];
                const loadedSets = rawItemSets.map(s => {
                    const manualItems = s.manualItems || [];
                    const assemblies = s.assemblies || [];
                    let itemOrder = s.itemOrder || [];
                    if (itemOrder.length === 0) {
                        itemOrder = [...assemblies.map(a => a.id), ...manualItems.map(m => m.id)];
                    }
                    return { ...s, manualItems, itemOrder };
                });

                const defaultBuildingData = { icfFoundation: false, foundationPerimeterId: null, foundationAreaId: null, hasGarage: false, garageShapeId: null, roofFlatArea: 0, numPlanes: 0, numPeaks: 0, valleyLength: 0, wasteFactorProfile: 'pro', foundationWallHeight: 8, foundationCorners: 0, foundationPerimeter: 0, foundationTees: 0, foundationStraightBlocksPerCourse: 0, foundationHVClips: 0, foundationRebar: 0, mainFloorPerimeter: 0, mainFloorGrossWallArea: 0, mainFloorNetWallArea: 0, mainFloorCorners: 4, mainFloorIntersections: 0, mainFloorIntWallLength4: 0, mainFloorIntWallLength6: 0, roofPitch: 4, numPitches: 1, roofRidgeLength: 0, roofHipLength: 0, roofEaveLength: 0, roofGableLength: 0, steelCoverageWidth: 36 } as BuildingData;
                const loadedBuildingData = { ...defaultBuildingData, ...(fileData.buildingData || {}) };

                set(state => ({
                    estimateName: metaName,
                    projectInfo: fileData.projectInfo || {projectName: "New Project", customerName: "", notes: "", files: []},
                    buildingData: loadedBuildingData,
                    lastModified: lastModified,
                    scale: fileData.scale || 1,
                    pageScales: fileData.pageScales || {},
                    measurements: fileData.measurements || [],
                    itemSets: loadedSets,
                    groupColors: (fileData as any).groupColors || {},
                    pdfFile: fileData.pdfBase64 || null,
                    recentFiles: [newRecent, ...state.recentFiles.filter(f => f.name !== metaName)].slice(0, 5),
                    activePageIndex: 0,
                    activeMeasurementId: null,
                    zoom: 1,
                    pan: {x: 0, y: 0},
                    past: [],
                    future: [],
                    activeWizardStep: 'none'
                }));
            },

            loadRecent: (id) => { const file = get().recentFiles.find(f => f.id === id); if (file) get().loadEstimateFromFile(file.data); },
            saveEstimate: async () => {
                const s = get();
                const zip = new JSZip();

                const exportData = {
                    version: "2.0",
                    meta: {
                        name: s.projectInfo.projectName || "Untitled",
                        created: Date.now(),
                        lastModified: Date.now()
                    },
                    data: {
                        projectInfo: s.projectInfo,
                        buildingData: s.buildingData,
                        scale: s.scale,
                        pageScales: s.pageScales,
                        measurements: s.measurements,
                        itemSets: s.itemSets,
                        groupColors: s.groupColors
                    }
                };

                zip.file("data.json", JSON.stringify(exportData));

                if (s.pdfFile) {
                    const base64Data = s.pdfFile.includes(',') ? s.pdfFile.split(',')[1] : s.pdfFile;
                    zip.file("blueprint.pdf", base64Data, { base64: true });
                }

                const content = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
                const url = URL.createObjectURL(content);
                const link = document.createElement('a');

                link.href = url;
                link.download = `${s.projectInfo.projectName.replace(/\s+/g, '_')}.takeoff`;
                document.body.appendChild(link);
                link.click();

                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            },

            updateProjectInfo: (updates) => { get().commitHistory(); set(s => ({projectInfo: {...s.projectInfo, ...updates}})); },
            updateBuildingData: (updates) => { get().commitHistory(); set(s => ({buildingData: {...s.buildingData, ...updates}})); },
            setScale: (scale) => {
                set({ scale });
                const { measurements, pageScales } = get();
                const roofUpdates = recalculateRoofData(measurements, scale, pageScales);
                const foundationUpdates = recalculateFoundationData(measurements, scale, pageScales);
                set(s => ({ buildingData: { ...s.buildingData, ...roofUpdates, ...foundationUpdates } }));
            },
            setPageScale: (pageIndex, scaleVal) => {
                get().commitHistory();
                set(s => {
                    const newPageScales = {...s.pageScales};
                    if (scaleVal === undefined) delete newPageScales[pageIndex]; else newPageScales[pageIndex] = scaleVal;
                    // Recalculate roof and foundation data with updated page scales
                    const roofUpdates = recalculateRoofData(s.measurements, s.scale, newPageScales);
                    const foundationUpdates = recalculateFoundationData(s.measurements, s.scale, newPageScales);
                    return { pageScales: newPageScales, buildingData: { ...s.buildingData, ...roofUpdates, ...foundationUpdates } };
                });
            },
            toggleScaleLock: () => set(s => ({ isScaleLocked: !s.isScaleLocked })),
            setPageIndex: (index) => set({activePageIndex: Math.max(0, index)}),
            setTool: (activeTool) => set({activeTool, activeWizardTool: null, isCalibrating: false}),

            setWizardStep: (step) => set({ activeWizardStep: step }),

            setRoofMode: (mode) => set({ activeRoofMode: mode }),
            setSelectedRoofPlaneId: (id) => set({ selectedRoofPlaneId: id }),
            setSelectedRoofEdgeIndex: (index) => set({ selectedRoofEdgeIndex: index }),
            
            classifySelectedEdge: (type: RoofLineType) => {
                get().commitHistory();
                set(s => {
                    const planeId = s.selectedRoofPlaneId;
                    const edgeIdx = s.selectedRoofEdgeIndex;
                    if (!planeId || edgeIdx === null) return s;
                    
                    const newMeasurements = s.measurements.map(m => {
                        if (m.id === planeId && m.type === 'shape') {
                            const edgeTypes = m.edgeTypes ? [...m.edgeTypes] : new Array(m.points.length).fill('none');
                            edgeTypes[edgeIdx] = type || 'none';
                            return { ...m, edgeTypes };
                        }
                        return m;
                    });
                    
                    return { measurements: newMeasurements };
                });
                // After updating edge type, recalculate globals
                const s = get();
                const newData = recalculateRoofData(s.measurements, s.scale, s.pageScales);
                s.updateBuildingData(newData);
            },

            setSubtractTargetPlaneId: (id) => set({ subtractTargetPlaneId: id }),

            addSubtractionToPlane: (planeId, polygon) => {
                get().commitHistory();
                set(s => {
                    const newMeasurements = s.measurements.map(m => {
                        if (m.id !== planeId) return m;

                        // 1. Calculate signed area
                        const getSignedArea = (pts: Point[]) => {
                            let area = 0;
                            for (let i = 0; i < pts.length; i++) {
                                const p1 = pts[i];
                                const p2 = pts[(i + 1) % pts.length];
                                area += p1.x * p2.y - p2.x * p1.y;
                            }
                            return area;
                        };

                        const outerArea = getSignedArea(m.points);
                        let holePts = [...polygon];
                        const holeArea = getSignedArea(holePts);

                        // If same sign, reverse hole so Shoelace correctly subtracts area
                        // and SVG evenodd rendering works properly regardless of engine strictness
                        if ((outerArea > 0 && holeArea > 0) || (outerArea < 0 && holeArea < 0)) {
                            holePts.reverse();
                        }

                        // 2. Find closest vertices for the slit
                        let minSq = Infinity;
                        let bestOuter = 0;
                        let bestHole = 0;
                        for (let i = 0; i < m.points.length; i++) {
                            for (let j = 0; j < holePts.length; j++) {
                                const dx = m.points[i].x - holePts[j].x;
                                const dy = m.points[i].y - holePts[j].y;
                                const dSq = dx * dx + dy * dy;
                                if (dSq < minSq) {
                                    minSq = dSq;
                                    bestOuter = i;
                                    bestHole = j;
                                }
                            }
                        }

                        const newPoints: Point[] = [];
                        const newEdges: string[] = [];
                        const outerEdges = m.edgeTypes || new Array(m.points.length).fill('none');

                        // 3. Splice!
                        for (let i = 0; i <= bestOuter; i++) {
                            newPoints.push(m.points[i]);
                            if (i < bestOuter) newEdges.push(outerEdges[i]);
                        }

                        newEdges.push('slit');

                        for (let j = 0; j < holePts.length; j++) {
                            const idx = (bestHole + j) % holePts.length;
                            newPoints.push(holePts[idx]);
                            newEdges.push('cutout');
                        }

                        newPoints.push(holePts[bestHole]);
                        newEdges.push('slit');

                        newPoints.push(m.points[bestOuter]);
                        newEdges.push(outerEdges[bestOuter]);

                        for (let i = bestOuter + 1; i < m.points.length; i++) {
                            newPoints.push(m.points[i]);
                            newEdges.push(outerEdges[i]);
                        }

                        return { ...m, points: newPoints, edgeTypes: newEdges };
                    });
                    
                    return { measurements: newMeasurements, subtractTargetPlaneId: null };
                });
                
                // Recalculate areas and dependencies
                const s = get();
                const newData = recalculateRoofData(s.measurements, s.scale, s.pageScales);
                s.updateBuildingData(newData);
            },

            setWizardTool: (tag) => set({
                activeWizardTool: tag,
                activeTool: tag ? ((tag === 'roof-plane' || tag === 'foundation-line' || tag === 'roof-subtract') ? 'shape' : 'line') : 'select'
            }),

            addRoofPlaneFromDimensions: (shape, dims, pitch) => {
                get().commitHistory();
                const { measurements, activePageIndex, zoom, pan, buildingData } = get();
                const effectiveScale = get().pageScales[activePageIndex] || get().scale;

                // Determine next plane index
                const existingPlanes = measurements.filter(m => m.roofPlaneIndex);
                const nextIndex = existingPlanes.length > 0
                    ? Math.max(...existingPlanes.map(m => m.roofPlaneIndex!)) + 1
                    : 1;

                // Center of current viewport
                const cx = (-pan.x + window.innerWidth / 2) / zoom;
                const cy = (-pan.y + window.innerHeight / 2) / zoom;

                const points = generatePlanePolygon(shape, dims, effectiveScale, cx, cy);
                const planePitch = pitch || buildingData.roofPitch || 4;

                const newMeasurement: Measurement = {
                    id: uuidv4(),
                    name: `Plane ${nextIndex}`,
                    type: 'shape',
                    points,
                    pageIndex: activePageIndex,
                    tags: ['roof-plane'],
                    group: 'Roof Planes',
                    pitch: planePitch,
                    roofPlaneIndex: nextIndex,
                    roofPlaneShape: shape,
                    labels: { showArea: true }
                };

                set({ measurements: [...measurements, newMeasurement] });
            },

            setActiveMeasurement: (activeMeasurementId) => set({activeMeasurementId}),
            setIsCalibrating: (isCalibrating) => set({isCalibrating, activeTool: 'select'}),
            setViewport: (zoom, pan) => set({zoom, pan}),

            addMeasurement: (type, points, name, tags = [], extraProps = {}) => {
                get().commitHistory();
                const {activePageIndex, measurements, activeWizardTool} = get();
                const existingNames = measurements.map(m => m.name);
                const uniqueName = generateUniqueName(name, existingNames);
                const finalTags = activeWizardTool ? [...tags, activeWizardTool] : tags;

                let group = extraProps.group;
                let roofType = extraProps.roofLineType;
                let roofPlaneIndex = extraProps.roofPlaneIndex;
                let roofPlaneShape = extraProps.roofPlaneShape;
                let labels = extraProps.labels;

                if (!group && activeWizardTool) {
                    if (activeWizardTool === 'roof-plane') group = 'Roof Planes';
                    else if (activeWizardTool.startsWith('roof-')) group = 'Roof';
                    else if (activeWizardTool.includes('foundation')) group = 'Foundation';
                    else if (activeWizardTool.includes('garage')) group = 'Garage';
                }

                if (!roofType && activeWizardTool?.startsWith('roof-') && activeWizardTool !== 'roof-plane') {
                    if (activeWizardTool === 'roof-hip') roofType = 'hip';
                    else if (activeWizardTool === 'roof-valley') roofType = 'valley';
                    else if (activeWizardTool === 'roof-ridge') roofType = 'ridge';
                    else if (activeWizardTool === 'roof-eave') roofType = 'eave';
                    else if (activeWizardTool === 'roof-gable') roofType = 'gable';
                }

                // Mode A: auto-assign roof plane properties
                if (activeWizardTool === 'roof-plane' && !roofPlaneIndex) {
                    const existingPlanes = measurements.filter(m => m.roofPlaneIndex);
                    roofPlaneIndex = existingPlanes.length > 0
                        ? Math.max(...existingPlanes.map(m => m.roofPlaneIndex!)) + 1
                        : 1;
                    labels = { showArea: true, ...(labels || {}) };
                }

                const newMeasurement: Measurement = {
                    id: uuidv4(),
                    name: activeWizardTool === 'roof-plane' ? `Plane ${roofPlaneIndex || 1}` : uniqueName,
                    type,
                    points,
                    pageIndex: activePageIndex,
                    tags: finalTags,
                    group,
                    roofLineType: roofType as any,
                    roofPlaneIndex,
                    roofPlaneShape,
                    isFoundation: activeWizardTool?.startsWith('foundation-') || false,
                    pitch: extraProps.pitch || get().buildingData.roofPitch,
                    labels,
                    ...extraProps
                };

                const allMeasurements = [...measurements, newMeasurement];
                const updates: any = { measurements: allMeasurements };

                if (activeWizardTool?.startsWith('foundation-')) {
                    const { scale: s, pageScales } = get();
                    updates.buildingData = {
                        ...get().buildingData,
                        ...recalculateFoundationData(allMeasurements, s, pageScales)
                    };
                } else if (activeWizardTool && activeWizardTool.startsWith('roof-') && activeWizardTool !== 'roof-plane') {
                    const { scale: s, pageScales } = get();
                    updates.buildingData = {
                        ...get().buildingData,
                        ...recalculateRoofData(allMeasurements, s, pageScales)
                    };
                }

                set(updates);
            },

            updateMeasurementTransient: (id, updates) => {
                set((s) => {
                    let newMeasurements = s.measurements.map(m => m.id === id ? {...m, ...updates} : m);
                    
                    // Global Node Dragging
                    if (updates.points) {
                        const activeMeas = newMeasurements.find(m => m.id === id);
                        if (activeMeas) {
                            const nodeUpdates = new Map<string, {x: number, y: number}>();
                            activeMeas.points.forEach(p => {
                                if (p.nodeId) nodeUpdates.set(p.nodeId, {x: p.x, y: p.y});
                            });
                            
                            if (nodeUpdates.size > 0) {
                                newMeasurements = newMeasurements.map(m => {
                                    if (m.id === id) return m; // Already updated
                                    let changed = false;
                                    const newPoints = m.points.map(p => {
                                        if (p.nodeId && nodeUpdates.has(p.nodeId)) {
                                            changed = true;
                                            const update = nodeUpdates.get(p.nodeId)!;
                                            return { ...p, x: update.x, y: update.y };
                                        }
                                        return p;
                                    });
                                    if (changed) return { ...m, points: newPoints };
                                    return m;
                                });
                            }
                        }
                    }

                    // Recalculate buildingData live during drag for foundation/roof measurements
                    const target = newMeasurements.find(m => m.id === id);
                    if (updates.points && target) {
                        const needsFoundation = target.isFoundation || newMeasurements.some(m => m.isFoundation && m.points.some(p => p.nodeId && target.points.some(tp => tp.nodeId === p.nodeId)));
                        const needsRoof = !!target.roofPlaneIndex || !!target.roofLineType || newMeasurements.some(m => (m.roofPlaneIndex || m.roofLineType) && m.points.some(p => p.nodeId && target.points.some(tp => tp.nodeId === p.nodeId)));
                        
                        if (needsFoundation || needsRoof) {
                            let newBuildingData = s.buildingData;
                            if (needsFoundation) {
                                newBuildingData = { ...newBuildingData, ...recalculateFoundationData(newMeasurements, s.scale, s.pageScales) };
                            }
                            if (needsRoof) {
                                newBuildingData = { ...newBuildingData, ...recalculateRoofData(newMeasurements, s.scale, s.pageScales) };
                            }
                            return { measurements: newMeasurements, buildingData: newBuildingData };
                        }
                    }

                    return { measurements: newMeasurements };
                });
            },

            updateMeasurement: (id, updates) => {
                get().commitHistory();
                set((s) => {
                    const processedUpdates = {...updates};
                    if (processedUpdates.name !== undefined) {
                        const existingNames = s.measurements.filter(m => m.id !== id).map(m => m.name);
                        processedUpdates.name = generateUniqueName(processedUpdates.name, existingNames);
                    }
                    if (processedUpdates.group !== undefined) {
                        if (processedUpdates.group === '') processedUpdates.group = undefined;
                        else processedUpdates.group = processedUpdates.group.trim();
                    }
                    
                    let newMeasurements = s.measurements.map(m => m.id === id ? {...m, ...processedUpdates} : m);
                    
                    // Global Node Dragging hook
                    if (processedUpdates.points) {
                        const activeMeas = newMeasurements.find(m => m.id === id);
                        if (activeMeas) {
                            const nodeUpdates = new Map<string, {x: number, y: number}>();
                            activeMeas.points.forEach(p => {
                                if (p.nodeId) nodeUpdates.set(p.nodeId, {x: p.x, y: p.y});
                            });
                            
                            if (nodeUpdates.size > 0) {
                                newMeasurements = newMeasurements.map(m => {
                                    if (m.id === id) return m; 
                                    let changed = false;
                                    const newPoints = m.points.map(p => {
                                        if (p.nodeId && nodeUpdates.has(p.nodeId)) {
                                            changed = true;
                                            const update = nodeUpdates.get(p.nodeId)!;
                                            return { ...p, x: update.x, y: update.y };
                                        }
                                        return p;
                                    });
                                    if (changed) return { ...m, points: newPoints };
                                    return m;
                                });
                            }
                        }
                    }

                    const target = s.measurements.find(m => m.id === id);
                    const roofChanged = target?.roofLineType || target?.roofPlaneIndex || processedUpdates.roofLineType !== undefined || processedUpdates.points || processedUpdates.pitch !== undefined;
                    const foundationChanged = target?.isFoundation || processedUpdates.isFoundation !== undefined || (target?.isFoundation && (processedUpdates.points || processedUpdates.foundationWallHeight !== undefined));
                    
                    if (roofChanged || foundationChanged) {
                        let newBuildingData = s.buildingData;
                        if (roofChanged) {
                            newBuildingData = { ...newBuildingData, ...recalculateRoofData(newMeasurements, s.scale, s.pageScales) };
                        }
                        if (foundationChanged) {
                            newBuildingData = { ...newBuildingData, ...recalculateFoundationData(newMeasurements, s.scale, s.pageScales) };
                        }
                        return {
                            measurements: newMeasurements,
                            buildingData: newBuildingData
                        };
                    }
                    return { measurements: newMeasurements };
                });
            },

            deleteMeasurement: (id) => {
                get().commitHistory();
                set((s) => {
                    const deleted = s.measurements.find(m => m.id === id);
                    const remaining = s.measurements.filter(m => m.id !== id);
                    const result: any = {
                        measurements: remaining,
                        activeMeasurementId: s.activeMeasurementId === id ? null : s.activeMeasurementId
                    };
                    if (deleted?.roofLineType) {
                        result.buildingData = { ...s.buildingData, ...recalculateRoofData(remaining, s.scale, s.pageScales) };
                    } else if (deleted?.isFoundation) {
                        result.buildingData = { ...s.buildingData, ...recalculateFoundationData(remaining, s.scale, s.pageScales) };
                    }
                    return result;
                });
            },
            setMeasurements: (measurements) => { get().commitHistory(); set({ measurements }); },
            setGroupColor: (group, color) => { get().commitHistory(); set(s => ({ groupColors: { ...s.groupColors, [group]: color } })); },
            setGroupVisibility: (group, hidden) => {
                get().commitHistory();
                set(s => ({
                    measurements: s.measurements.map(m => (m.group || 'Ungrouped') === (group || 'Ungrouped') ? {...m, hidden} : m)
                }));
            },
            deletePoint: (mId, idx) => {
                get().commitHistory();
                set((s) => ({
                    measurements: s.measurements.map(m => {
                        if (m.id !== mId || m.points.length <= 2) return m;
                        return {...m, points: m.points.filter((_, i) => i !== idx)};
                    })
                }));
            },
            insertPointAfter: (mId, idx, clickPoint?: Point) => {
                get().commitHistory();
                set((s) => ({
                    measurements: s.measurements.map(m => {
                        if (m.id !== mId) return m;
                        const newPoint = clickPoint || (() => {
                            const p1 = m.points[idx];
                            const nextIdx = (idx + 1) % m.points.length;
                            if (m.type === 'line' && idx === m.points.length - 1) return null;
                            const p2 = m.points[nextIdx];
                            return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
                        })();
                        if (!newPoint) return m;
                        const newPoints = [...m.points];
                        newPoints.splice(idx + 1, 0, newPoint);
                        
                        let newEdgeTypes = m.edgeTypes;
                        if (newEdgeTypes) {
                            newEdgeTypes = [...newEdgeTypes];
                            newEdgeTypes.splice(idx + 1, 0, newEdgeTypes[idx] || 'none');
                        }
                        
                        return { ...m, points: newPoints, edgeTypes: newEdgeTypes };
                    })
                }));
            },

            addMaterial: (mat) => { get().commitHistory(); set((s) => ({materials: [...s.materials, {...mat, id: mat.sku || uuidv4()}]})); },
            importMaterials: (incoming) => { get().commitHistory(); set((s) => { const materialsMap = new Map<string, MaterialDef>(); s.materials.forEach(m => { materialsMap.set(m.sku, { ...m, id: m.sku }); }); incoming.forEach(incomingMat => { const processedMat: MaterialDef = { ...incomingMat, id: incomingMat.sku }; materialsMap.set(processedMat.sku, processedMat); }); return { materials: Array.from(materialsMap.values()) }; }); },
            updateMaterial: (id, updates) => { get().commitHistory(); set((s) => ({materials: s.materials.map(m => m.id === id ? {...m, ...updates} : m)})); },
            deleteMaterial: (id) => { get().commitHistory(); set((s) => ({materials: s.materials.filter(m => m.id !== id)})); },
            cloneMaterial: (id) => { get().commitHistory(); set((s) => { const orig = s.materials.find(m => m.id === id); return orig ? {materials: [...s.materials, {...orig, id: uuidv4(), name: `${orig.name} (Copy)`}]} : s; }); },

            addAssemblyDef: (name, category) => { get().commitHistory(); set((s) => { const newId = uuidv4(); return { assemblyDefs: [...s.assemblyDefs, { id: newId, name, category, variables: [], children: [] }] }; }); },
            updateAssemblyDef: (id, updates) => { get().commitHistory(); set((s) => ({assemblyDefs: s.assemblyDefs.map(d => d.id === id ? {...d, ...updates} : d)})); },
            deleteAssemblyDef: (id) => { get().commitHistory(); set((s) => ({assemblyDefs: s.assemblyDefs.filter(d => d.id !== id)})); },
            cloneAssemblyDef: (id) => { get().commitHistory(); set((s) => { const orig = s.assemblyDefs.find(a => a.id === id); return orig ? { assemblyDefs: [...s.assemblyDefs, { ...orig, id: uuidv4(), name: `${orig.name} (Copy)`, variables: orig.variables.map(v => ({...v, id: uuidv4()})), children: orig.children.map(c => ({...c, id: uuidv4()})) }] } : s; }); },
            importAssemblyDefs: (incoming) => { get().commitHistory(); set((s) => { const assemblyDefsMap = new Map<string, AssemblyDef>(); s.assemblyDefs.forEach(def => { assemblyDefsMap.set(def.id, def); }); incoming.forEach(incomingDef => { const defId = incomingDef.id || uuidv4(); assemblyDefsMap.set(defId, { ...incomingDef, id: defId, variables: (incomingDef.variables || []).map(v => ({ ...v, id: v.id || uuidv4() })), children: (incomingDef.children || []).map(c => { let resolvedChildId = c.childId; if (c.childType === 'material') { const childSku = (c as any).childSku || c.childId; const material = s.materials.find(m => m.sku === childSku); if (material) resolvedChildId = material.id; } return { ...c, id: c.id || uuidv4(), childId: resolvedChildId, formula: c.formula || '0', round: c.round || 'up', variableMapping: c.variableMapping, isDynamic: c.isDynamic, variantIds: c.variantIds || [], defaultVariantId: c.defaultVariantId }; }) }); }); return { assemblyDefs: Array.from(assemblyDefsMap.values()) }; }); },

            addVariableToDef: (defId, name, type) => { get().commitHistory(); set((s) => ({ assemblyDefs: s.assemblyDefs.map(d => d.id !== defId ? d : { ...d, variables: [...d.variables, {id: uuidv4(), name, type}] }) })); },
            deleteVariableFromDef: (defId, varId) => { get().commitHistory(); set((s) => ({ assemblyDefs: s.assemblyDefs.map(d => d.id !== defId ? d : { ...d, variables: d.variables.filter(v => v.id !== varId) }) })); },
            addNodeToDef: (defId, node) => { get().commitHistory(); set((s) => ({ assemblyDefs: s.assemblyDefs.map(d => d.id !== defId ? d : { ...d, children: [...d.children, {...node, id: uuidv4()}] }) })); },
            updateNodeInDef: (defId, nodeId, updates) => { get().commitHistory(); set((s) => ({ assemblyDefs: s.assemblyDefs.map(d => d.id !== defId ? d : { ...d, children: d.children.map(c => c.id === nodeId ? {...c, ...updates} : c) }) })); },
            removeNodeFromDef: (defId, nodeId) => { get().commitHistory(); set((s) => ({ assemblyDefs: s.assemblyDefs.map(d => d.id !== defId ? d : { ...d, children: d.children.filter(c => c.id !== nodeId) }) })); },
            reorderNodeInDef: (defId, nodeId, direction) => { get().commitHistory(); set(s => { const def = s.assemblyDefs.find(d => d.id === defId); if (!def) return s; const index = def.children.findIndex(c => c.id === nodeId); if (index === -1) return s; const newChildren = [...def.children]; const targetIndex = direction === 'up' ? index - 1 : index + 1; if (targetIndex >= 0 && targetIndex < newChildren.length) { const [removed] = newChildren.splice(index, 1); newChildren.splice(targetIndex, 0, removed); return { assemblyDefs: s.assemblyDefs.map(d => d.id !== defId ? d : { ...d, children: newChildren }) }; } return s; }); },

            addItemSet: (name) => { get().commitHistory(); set(s => ({itemSets: [...s.itemSets, {id: uuidv4(), name, assemblies: [], manualItems: [], itemOrder: []}]})); },
            renameItemSet: (id, newName) => { get().commitHistory(); set(s => ({itemSets: s.itemSets.map(i => i.id === id ? {...i, name: newName} : i)})); },
            setItemSets: (sets) => { get().commitHistory(); set({ itemSets: sets }); },
            updateItemSet: (id, updates) => { get().commitHistory(); set(s => ({itemSets: s.itemSets.map(i => i.id === id ? {...i, ...updates} : i)})); },
            deleteItemSet: (id) => { get().commitHistory(); set(s => ({itemSets: s.itemSets.filter(i => i.id !== id)})); },
            reorderItemsInSet: (setId, newOrder) => {
                get().commitHistory();
                set(s => ({
                    itemSets: s.itemSets.map(set => set.id === setId ? { ...set, itemOrder: newOrder } : set)
                }));
            },

            saveItemSetAsFavorite: (id, name) => { set(s => { const original = s.itemSets.find(i => i.id === id); if (!original) return s; const favorite: ItemSet = { ...original, id: uuidv4(), name: name || original.name, assemblies: original.assemblies.map(a => ({...a, id: uuidv4()})), manualItems: (original.manualItems || []).map(m => ({...m, id: uuidv4()})), itemOrder: [] }; return { favoriteItemSets: [...s.favoriteItemSets, favorite] }; }); },
            addItemSetFromFavorite: (favId) => { get().commitHistory(); set(s => { const template = s.favoriteItemSets.find(f => f.id === favId); if (!template) return s; const newSet: ItemSet = { ...template, id: uuidv4(), name: template.name, assemblies: template.assemblies.map(a => ({...a, id: uuidv4()})), manualItems: (template.manualItems || []).map(m => ({...m, id: uuidv4()})), itemOrder: [] };
                if (!newSet.itemOrder || newSet.itemOrder.length === 0) {
                    newSet.itemOrder = [...newSet.assemblies.map(a => a.id), ...newSet.manualItems.map(m => m.id)];
                }
                return { itemSets: [...s.itemSets, newSet] };
            }); },
            deleteFavoriteItemSet: (favId) => { set(s => ({favoriteItemSets: s.favoriteItemSets.filter(f => f.id !== favId)})); },

            addInstanceToSet: (setId, defId) => { get().commitHistory(); set(s => { const def = s.assemblyDefs.find(d => d.id === defId); if (!def) return s; const initialVars: Record<string, VariableSource> = {}; def.variables.forEach(v => { let defaultValue: number | string = 0; if (v.type === 'pitch') defaultValue = ''; else if (v.type === 'boolean') defaultValue = 0; else if (v.type === 'count') { defaultValue = 1;} initialVars[v.id] = {type: 'manual', value: defaultValue}; }); const newInstance: ProjectAssembly = { id: uuidv4(), assemblyDefId: defId, name: def.name, variableValues: initialVars, selections: {} };
                return { itemSets: s.itemSets.map(set => set.id !== setId ? set : { ...set, assemblies: [...set.assemblies, newInstance], itemOrder: [...(set.itemOrder || []), newInstance.id] }) };
            }); },
            deleteInstanceFromSet: (setId, instId) => { get().commitHistory(); set(s => ({ itemSets: s.itemSets.map(set => set.id !== setId ? set : { ...set, assemblies: set.assemblies.filter(a => a.id !== instId), itemOrder: (set.itemOrder || []).filter(id => id !== instId) }) })); },
            updateInstanceVariable: (setId, instId, varId, src) => { get().commitHistory(); set(s => ({ itemSets: s.itemSets.map(set => set.id !== setId ? set : { ...set, assemblies: set.assemblies.map(inst => inst.id !== instId ? inst : { ...inst, variableValues: {...inst.variableValues, [varId]: src} }) }) })); },
            updateInstanceSelection: (setId, instId, nodeId, selId) => { get().commitHistory(); set(s => ({ itemSets: s.itemSets.map(set => set.id !== setId ? set : { ...set, assemblies: set.assemblies.map(inst => inst.id !== instId ? inst : { ...inst, selections: { ...(inst.selections || {}), [nodeId]: selId } }) }) })); },

            addManualItemToSet: (setId, item) => {
                get().commitHistory();
                set(s => {
                    const newItem = { ...item, id: uuidv4() };
                    return { itemSets: s.itemSets.map(set => set.id !== setId ? set : { ...set, manualItems: [...(set.manualItems || []), newItem], itemOrder: [...(set.itemOrder || []), newItem.id] }) };
                });
            },
            updateManualItem: (setId, itemId, updates) => {
                get().commitHistory();
                set(s => ({
                    itemSets: s.itemSets.map(set => set.id !== setId ? set : { ...set, manualItems: (set.manualItems || []).map(m => m.id === itemId ? { ...m, ...updates } : m) })
                }));
            },
            deleteManualItem: (setId, itemId) => {
                get().commitHistory();
                set(s => ({
                    itemSets: s.itemSets.map(set => set.id !== setId ? set : { ...set, manualItems: (set.manualItems || []).filter(m => m.id !== itemId), itemOrder: (set.itemOrder || []).filter(id => id !== itemId) })
                }));
            }
        }),
        {
            name: 'takeoff-pro-db',
            storage: createJSONStorage(() => idbStorage), // <-- ADD THIS LINE
            partialize: (state) => ({
                materials: state.materials,
                assemblyDefs: state.assemblyDefs,
                recentFiles: state.recentFiles,
                favoriteItemSets: state.favoriteItemSets
            })
        }
    )
);