import {create} from 'zustand';
import {persist} from 'zustand/middleware';
import {v4 as uuidv4} from 'uuid';
import {
    AssemblyDef, AssemblyNode, AssemblyVariable, BuildingData, EstimateFile, ItemSet, ManualItem, MaterialDef, Measurement,
    MeasurementType, Point, ProjectAssembly, ProjectInfo, RecentFile, VariableSource
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
    let roofRidgeLength = 0, roofHipLength = 0, roofEaveLength = 0, roofGableLength = 0, valleyLength = 0;
    measurements.forEach(m => {
        if (!m.roofLineType) return;
        const effectiveScale = pageScales[m.pageIndex] || scale;
        const rawLength = getPathLength(m.points) / effectiveScale;
        const pitch = m.pitch || 4;
        switch (m.roofLineType) {
            case 'ridge': roofRidgeLength += rawLength; break;
            case 'eave': roofEaveLength += rawLength; break;
            case 'gable': roofGableLength += rawLength * getSlopeMultiplier(pitch); break;
            case 'hip': roofHipLength += rawLength * getPlanHipToTrueHipMultiplier(pitch); break;
            case 'valley': valleyLength += rawLength * getPlanHipToTrueHipMultiplier(pitch); break;
        }
    });
    return { roofRidgeLength, roofHipLength, roofEaveLength, roofGableLength, valleyLength };
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
export type WizardStepType = 'none' | 'roof';

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

    // Plane builder state (for line-selection-based plane creation)
    planeBuilderActive: boolean;
    planeBuilderSelectedIds: string[];

    // NEW: Global Wizard Step State
    activeWizardStep: WizardStepType;
    setWizardStep: (step: WizardStepType) => void;

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
    createPlaneFromLines: (lineIds: string[]) => boolean;
    togglePlaneBuilderLine: (id: string) => void;
    clearPlaneBuilder: () => void;
    setPlaneBuilderActive: (active: boolean) => void;
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
                foundationWallHeight: 8, foundationCorners: 4,
                mainFloorPerimeter: 0, mainFloorGrossWallArea: 0, mainFloorNetWallArea: 0,
                mainFloorCorners: 4, mainFloorIntersections: 0, mainFloorIntWallLength4: 0, mainFloorIntWallLength6: 0,
                roofPitch: 4, numPitches: 1, roofRidgeLength: 0, roofHipLength: 0, roofEaveLength: 0, roofGableLength: 0
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

            planeBuilderActive: false,
            planeBuilderSelectedIds: [],

            activeWizardStep: 'none',

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
                    wasteFactorProfile: 'pro', foundationWallHeight: 8, foundationCorners: 4,
                    mainFloorPerimeter: 0, mainFloorGrossWallArea: 0, mainFloorNetWallArea: 0,
                    mainFloorCorners: 4, mainFloorIntersections: 0, mainFloorIntWallLength4: 0, mainFloorIntWallLength6: 0,
                    roofPitch: 4, numPitches: 1, roofRidgeLength: 0, roofHipLength: 0, roofEaveLength: 0, roofGableLength: 0
                },
                scale: 1, pageScales: {}, isScaleLocked: false, activePageIndex: 0, activeMeasurementId: null, measurements: [], itemSets: [], groupColors: {}, zoom: 1, pan: {x: 0, y: 0}, past: [], future: [], activeWizardStep: 'none'
            }),
            closeEstimate: () => set({estimateName: null, past: [], future: [], activeWizardStep: 'none'}),

            loadEstimateFromFile: (file) => {
                const newRecent = {id: uuidv4(), name: file.meta.name, lastOpened: Date.now(), data: file};
                const loadedSets = file.data.itemSets.map(s => {
                    const manualItems = s.manualItems || [];
                    const assemblies = s.assemblies || [];
                    let itemOrder = s.itemOrder || [];
                    if (itemOrder.length === 0) {
                        itemOrder = [...assemblies.map(a => a.id), ...manualItems.map(m => m.id)];
                    }
                    return { ...s, manualItems, itemOrder };
                });
                set(state => ({
                    estimateName: file.meta.name, projectInfo: file.data.projectInfo, buildingData: file.data.buildingData, lastModified: file.meta.lastModified, scale: file.data.scale, pageScales: file.data.pageScales || {}, measurements: file.data.measurements, itemSets: loadedSets, groupColors: (file.data as any).groupColors || {}, pdfFile: file.data.pdfBase64,
                    recentFiles: [newRecent, ...state.recentFiles.filter(f => f.name !== file.meta.name)].slice(0, 5), activePageIndex: 0, activeMeasurementId: null, zoom: 1, pan: {x: 0, y: 0}, past: [], future: [], activeWizardStep: 'none'
                }));
            },

            loadRecent: (id) => { const file = get().recentFiles.find(f => f.id === id); if (file) get().loadEstimateFromFile(file.data); },
            saveEstimate: () => {
                const s = get();
                const exportData = { version: "2.0", meta: { name: s.projectInfo.projectName || "Untitled", created: Date.now(), lastModified: Date.now() }, data: { projectInfo: s.projectInfo, buildingData: s.buildingData, scale: s.scale, pageScales: s.pageScales, measurements: s.measurements, itemSets: s.itemSets, groupColors: s.groupColors, pdfBase64: s.pdfFile } };
                const blob = new Blob([JSON.stringify(exportData)], {type: "application/json"});
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a'); link.href = url; link.download = `${s.projectInfo.projectName.replace(/\s+/g, '_')}.takeoff`;
                document.body.appendChild(link); link.click(); document.body.removeChild(link);
            },

            updateProjectInfo: (updates) => { get().commitHistory(); set(s => ({projectInfo: {...s.projectInfo, ...updates}})); },
            updateBuildingData: (updates) => { get().commitHistory(); set(s => ({buildingData: {...s.buildingData, ...updates}})); },
            setScale: (scale) => {
                set({ scale });
                // Recalculate roof data with new scale
                const { measurements, pageScales } = get();
                const roofUpdates = recalculateRoofData(measurements, scale, pageScales);
                set(s => ({ buildingData: { ...s.buildingData, ...roofUpdates } }));
            },
            setPageScale: (pageIndex, scaleVal) => {
                get().commitHistory();
                set(s => {
                    const newPageScales = {...s.pageScales};
                    if (scaleVal === undefined) delete newPageScales[pageIndex]; else newPageScales[pageIndex] = scaleVal;
                    // Recalculate roof data with updated page scales
                    const roofUpdates = recalculateRoofData(s.measurements, s.scale, newPageScales);
                    return { pageScales: newPageScales, buildingData: { ...s.buildingData, ...roofUpdates } };
                });
            },
            toggleScaleLock: () => set(s => ({ isScaleLocked: !s.isScaleLocked })),
            setPageIndex: (index) => set({activePageIndex: Math.max(0, index)}),
            setTool: (activeTool) => set({activeTool, activeWizardTool: null, isCalibrating: false}),

            // Set Wizard Step (Global UI State)
            setWizardStep: (step) => set({ activeWizardStep: step }),

            setWizardTool: (tag) => set({
                activeWizardTool: tag,
                activeTool: tag ? (tag === 'roof-plane' ? 'shape' : 'line') : 'select'
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

            createPlaneFromLines: (lineIds) => {
                const { measurements, buildingData, scale, pageScales, activePageIndex, zoom, pan } = get();

                // Gather selected lines and compute their real-world lengths
                const selectedLines = lineIds.map(id => measurements.find(m => m.id === id)).filter(Boolean) as Measurement[];
                if (selectedLines.length < 3) return false;

                // Categorize lines by type and compute lengths in feet
                let eaveLengthFt = 0;
                let ridgeLengthFt = 0;
                let rafterLengthFt = 0;
                let rafterCount = 0;

                selectedLines.forEach(m => {
                    const effectiveScale = pageScales[m.pageIndex] || scale;
                    const lengthFt = getPathLength(m.points) / effectiveScale;
                    const type = m.roofLineType || 'eave';

                    if (type === 'eave') {
                        eaveLengthFt += lengthFt;
                    } else if (type === 'ridge') {
                        ridgeLengthFt += lengthFt;
                    } else {
                        // hip, valley, gable → all contribute to rafter/slope dimension
                        rafterLengthFt += lengthFt;
                        rafterCount++;
                    }
                });

                // Average rafter length if multiple rafter-type lines selected
                const avgRafterFt = rafterCount > 0 ? rafterLengthFt / rafterCount : 0;

                // Determine shape type from line types present
                let shape: 'rectangle' | 'triangle' | 'trapezoid';
                let planAreaFt: number;

                if (ridgeLengthFt > 0 && eaveLengthFt > 0) {
                    if (Math.abs(ridgeLengthFt - eaveLengthFt) < 1) {
                        // Ridge ≈ Eave → rectangle (gable plane)
                        shape = 'rectangle';
                        planAreaFt = eaveLengthFt * avgRafterFt;
                    } else {
                        // Ridge ≠ Eave → trapezoid (hip side)
                        shape = 'trapezoid';
                        planAreaFt = ((ridgeLengthFt + eaveLengthFt) / 2) * avgRafterFt;
                    }
                } else if (eaveLengthFt > 0 && ridgeLengthFt === 0) {
                    // No ridge → triangle (hip end)
                    shape = 'triangle';
                    planAreaFt = (eaveLengthFt * avgRafterFt) / 2;
                } else {
                    // Fallback: use all selected line lengths for a rough rectangle
                    shape = 'rectangle';
                    const totalLength = selectedLines.reduce((sum, m) => {
                        const effectiveScale = pageScales[m.pageIndex] || scale;
                        return sum + getPathLength(m.points) / effectiveScale;
                    }, 0);
                    planAreaFt = (totalLength / 4) * (totalLength / 4); // Rough square
                }

                if (planAreaFt <= 0) return false;

                get().commitHistory();

                // Generate polygon at center of current viewport
                const effectiveScale = pageScales[activePageIndex] || scale;
                const cx = (-pan.x + window.innerWidth / 2) / zoom;
                const cy = (-pan.y + window.innerHeight / 2) / zoom;

                const existingPlanes = measurements.filter(m => m.roofPlaneIndex);
                const nextIndex = existingPlanes.length > 0
                    ? Math.max(...existingPlanes.map(m => m.roofPlaneIndex!)) + 1
                    : 1;

                const planePitch = buildingData.roofPitch || 4;

                // Generate appropriately-sized polygon from real dimensions
                const points = generatePlanePolygon(
                    shape,
                    shape === 'rectangle'
                        ? { width: eaveLengthFt, height: avgRafterFt }
                        : shape === 'triangle'
                            ? { width: eaveLengthFt, height: avgRafterFt }
                            : { topBase: ridgeLengthFt, bottomBase: eaveLengthFt, height: avgRafterFt },
                    effectiveScale,
                    cx,
                    cy
                );

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
                    labels: { showArea: true },
                };

                set({ measurements: [...measurements, newMeasurement] });
                return true;
            },

            togglePlaneBuilderLine: (id) => {
                set(s => {
                    const ids = s.planeBuilderSelectedIds;
                    const idx = ids.indexOf(id);
                    if (idx >= 0) {
                        return { planeBuilderSelectedIds: ids.filter(i => i !== id) };
                    }
                    return { planeBuilderSelectedIds: [...ids, id] };
                });
            },

            clearPlaneBuilder: () => set({ planeBuilderSelectedIds: [], planeBuilderActive: false }),

            setPlaneBuilderActive: (active) => set({
                planeBuilderActive: active,
                planeBuilderSelectedIds: active ? [] : [],
            }),

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
                    pitch: extraProps.pitch || get().buildingData.roofPitch,
                    labels,
                    ...extraProps
                };

                const allMeasurements = [...measurements, newMeasurement];
                const updates: any = { measurements: allMeasurements };

                if (activeWizardTool === 'foundation') {
                    updates.buildingData = {
                        ...get().buildingData,
                        foundationAreaId: newMeasurement.id,
                        foundationPerimeterId: newMeasurement.id,
                        foundationCorners: points.length
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
                set((s) => ({
                    measurements: s.measurements.map(m => m.id === id ? {...m, ...updates} : m)
                }));
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
                    const newMeasurements = s.measurements.map(m => m.id === id ? {...m, ...processedUpdates} : m);
                    const target = s.measurements.find(m => m.id === id);
                    const roofChanged = target?.roofLineType || processedUpdates.roofLineType !== undefined || processedUpdates.points || processedUpdates.pitch !== undefined;
                    if (roofChanged) {
                        return {
                            measurements: newMeasurements,
                            buildingData: { ...s.buildingData, ...recalculateRoofData(newMeasurements, s.scale, s.pageScales) }
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
                        return { ...m, points: newPoints };
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
            partialize: (state) => ({
                materials: state.materials,
                assemblyDefs: state.assemblyDefs,
                recentFiles: state.recentFiles,
                favoriteItemSets: state.favoriteItemSets
            })
        }
    )
);