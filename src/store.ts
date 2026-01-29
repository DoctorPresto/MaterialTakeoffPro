import {create} from 'zustand';
import {persist} from 'zustand/middleware';
import {v4 as uuidv4} from 'uuid';
import {
    AssemblyDef,
    AssemblyNode,
    AssemblyVariable,
    BuildingData,
    EstimateFile,
    ItemSet,
    MaterialDef,
    Measurement,
    MeasurementType,
    Point,
    ProjectAssembly,
    ProjectInfo,
    RecentFile,
    VariableSource
} from './types';

const generateUniqueName = (baseName: string, existingNames: string[]): string => {
    if (!existingNames.includes(baseName)) {
        return baseName;
    }
    let counter = 1;
    let uniqueName = `${baseName} ${counter}`;
    while (existingNames.includes(uniqueName)) {
        counter++;
        uniqueName = `${baseName} ${counter}`;
    }
    return uniqueName;
};

interface AppState {
    materials: MaterialDef[];
    assemblyDefs: AssemblyDef[];
    recentFiles: RecentFile[];
    estimateName: string | null;
    projectInfo: ProjectInfo;
    buildingData: BuildingData;
    pdfFile: string | null;
    lastModified: number;
    scale: number;
    activePageIndex: number;
    activeTool: 'select' | 'line' | 'shape';
    activeWizardTool: string | null;
    activeMeasurementId: string | null;
    isCalibrating: boolean;
    zoom: number;
    pan: { x: number; y: number };
    measurements: Measurement[];
    itemSets: ItemSet[];
    createEstimate: () => void;
    closeEstimate: () => void;
    saveEstimate: () => void;
    loadEstimateFromFile: (fileData: EstimateFile) => void;
    loadRecent: (id: string) => void;
    updateProjectInfo: (updates: Partial<ProjectInfo>) => void;
    updateBuildingData: (updates: Partial<BuildingData>) => void;
    setScale: (s: number) => void;
    setPageIndex: (index: number) => void;
    setTool: (t: 'select' | 'line' | 'shape') => void;
    setWizardTool: (tag: string | null) => void;
    setActiveMeasurement: (id: string | null) => void;
    setIsCalibrating: (status: boolean) => void;
    setViewport: (zoom: number, pan: { x: number, y: number }) => void;
    addMeasurement: (type: MeasurementType, points: Point[], name: string, tags?: string[]) => void;
    updateMeasurement: (id: string, updates: Partial<Measurement>) => void;
    deleteMeasurement: (id: string) => void;
    deletePoint: (measurementId: string, pointIndex: number) => void;
    // UPDATED: clickPoint is now optional (?) to fix TS2554
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
    addItemSet: (name: string) => void;
    deleteItemSet: (id: string) => void;
    addInstanceToSet: (setId: string, defId: string) => void;
    deleteInstanceFromSet: (setId: string, instanceId: string) => void;
    updateInstanceVariable: (setId: string, instanceId: string, varId: string, source: VariableSource) => void;
}

export const useStore = create<AppState>()(
    persist(
        (set, get) => ({
            materials: [],
            assemblyDefs: [],
            recentFiles: [],
            estimateName: null,
            pdfFile: null,
            lastModified: 0,
            projectInfo: {projectName: "New Project", customerName: "", notes: "", files: []},
            buildingData: {
                icfFoundation: false,
                foundationPerimeterId: null,
                foundationAreaId: null,
                hasGarage: false,
                garageShapeId: null,
                roofFlatArea: 0,
                numPlanes: 0,
                numPeaks: 0,
                valleyLength: 0
            },
            scale: 1,
            activePageIndex: 0,
            activeTool: 'select',
            activeWizardTool: null,
            activeMeasurementId: null,
            isCalibrating: false,
            zoom: 1,
            pan: {x: 0, y: 0},
            measurements: [],
            itemSets: [],

            createEstimate: () => set({
                estimateName: "Untitled",
                pdfFile: null,
                lastModified: Date.now(),
                projectInfo: {projectName: "New Project", customerName: "", notes: "", files: []},
                buildingData: {
                    icfFoundation: false,
                    foundationPerimeterId: null,
                    foundationAreaId: null,
                    hasGarage: false,
                    garageShapeId: null,
                    roofFlatArea: 0,
                    numPlanes: 0,
                    numPeaks: 0,
                    valleyLength: 0
                },
                scale: 1, activePageIndex: 0, activeMeasurementId: null, measurements: [], itemSets: [], zoom: 1, pan: {x: 0, y: 0}
            }),

            closeEstimate: () => set({estimateName: null}),

            loadEstimateFromFile: (file) => {
                const newRecent = {id: uuidv4(), name: file.meta.name, lastOpened: Date.now(), data: file};
                set(state => ({
                    estimateName: file.meta.name,
                    projectInfo: file.data.projectInfo,
                    buildingData: file.data.buildingData,
                    lastModified: file.meta.lastModified,
                    scale: file.data.scale,
                    measurements: file.data.measurements,
                    itemSets: file.data.itemSets,
                    pdfFile: file.data.pdfBase64,
                    recentFiles: [newRecent, ...state.recentFiles.filter(f => f.name !== file.meta.name)].slice(0, 5),
                    activePageIndex: 0, activeMeasurementId: null, zoom: 1, pan: {x: 0, y: 0}
                }));
            },

            loadRecent: (id) => {
                const file = get().recentFiles.find(f => f.id === id);
                if (file) get().loadEstimateFromFile(file.data);
            },

            saveEstimate: () => {
                const s = get();
                const exportData: EstimateFile = {
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
                        measurements: s.measurements,
                        itemSets: s.itemSets,
                        pdfBase64: s.pdfFile
                    }
                };
                const blob = new Blob([JSON.stringify(exportData)], {type: "application/json"});
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `${s.projectInfo.projectName.replace(/\s+/g, '_')}.takeoff`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            },

            updateProjectInfo: (updates) => set(s => ({projectInfo: {...s.projectInfo, ...updates}})),
            updateBuildingData: (updates) => set(s => ({buildingData: {...s.buildingData, ...updates}})),
            setScale: (scale) => set({scale}),
            setPageIndex: (index) => set({activePageIndex: Math.max(0, index)}),
            setTool: (activeTool) => set({activeTool, activeWizardTool: null, isCalibrating: false}),
            setWizardTool: (tag) => set({
                activeWizardTool: tag,
                activeTool: tag ? (tag.includes('shape') || tag.includes('plane') || tag.includes('area') || tag.includes('foundation') ? 'shape' : 'line') : 'select'
            }),
            setActiveMeasurement: (activeMeasurementId) => set({activeMeasurementId}),
            setIsCalibrating: (isCalibrating) => set({isCalibrating, activeTool: 'select'}),
            setViewport: (zoom, pan) => set({zoom, pan}),

            addMeasurement: (type, points, name, tags = []) => {
                const {activePageIndex, measurements, activeWizardTool} = get();
                const existingNames = measurements.map(m => m.name);
                const uniqueName = generateUniqueName(name, existingNames);
                const finalTags = activeWizardTool ? [...tags, activeWizardTool] : tags;
                const newMeasurement: Measurement = {
                    id: uuidv4(),
                    name: uniqueName,
                    type,
                    points,
                    pageIndex: activePageIndex,
                    tags: finalTags
                };
                set({measurements: [...measurements, newMeasurement]});
            },

            updateMeasurement: (id, updates) => set((s) => {
                const processedUpdates = {...updates};
                if (processedUpdates.name !== undefined) {
                    const existingNames = s.measurements.filter(m => m.id !== id).map(m => m.name);
                    processedUpdates.name = generateUniqueName(processedUpdates.name, existingNames);
                }
                if (processedUpdates.group !== undefined) {
                    if (processedUpdates.group === '') {
                        processedUpdates.group = undefined;
                    } else {
                        processedUpdates.group = processedUpdates.group.trim();
                    }
                }
                return {measurements: s.measurements.map(m => m.id === id ? {...m, ...processedUpdates} : m)};
            }),

            deleteMeasurement: (id) => set((s) => ({
                measurements: s.measurements.filter(m => m.id !== id),
                activeMeasurementId: s.activeMeasurementId === id ? null : s.activeMeasurementId
            })),
            deletePoint: (mId, idx) => set((s) => ({
                measurements: s.measurements.map(m => {
                    if (m.id !== mId || m.points.length <= 2) return m;
                    return {...m, points: m.points.filter((_, i) => i !== idx)};
                })
            })),

            // UPDATED IMPLEMENTATION
            insertPointAfter: (mId, idx, clickPoint?: Point) => set((s) => ({
                measurements: s.measurements.map(m => {
                    if (m.id !== mId) return m;

                    // Use exact click location if provided, otherwise midpoint fallback
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
            })),

            addMaterial: (mat) => set((s) => ({materials: [...s.materials, {...mat, id: mat.sku || uuidv4()}]})),
            importMaterials: (incomingMaterials) => set((s) => {
                const materialsMap = new Map<string, MaterialDef>();
                s.materials.forEach(m => { materialsMap.set(m.sku, { ...m, id: m.sku }); });
                incomingMaterials.forEach(incomingMat => {
                    const processedMat: MaterialDef = { ...incomingMat, id: incomingMat.sku };
                    materialsMap.set(processedMat.sku, processedMat);
                });
                return { materials: Array.from(materialsMap.values()) };
            }),
            updateMaterial: (id, updates) => set((s) => ({materials: s.materials.map(m => m.id === id ? {...m, ...updates} : m)})),
            deleteMaterial: (id) => set((s) => ({materials: s.materials.filter(m => m.id !== id)})),
            cloneMaterial: (id) => set((s) => {
                const orig = s.materials.find(m => m.id === id);
                return orig ? {materials: [...s.materials, {...orig, id: uuidv4(), name: `${orig.name} (Copy)`}]} : s;
            }),

            addAssemblyDef: (name, category) => set((s) => {
                const newId = uuidv4();
                return {
                    assemblyDefs: [...s.assemblyDefs, {
                        id: newId,
                        name,
                        category,
                        variables: [],
                        children: []
                    }]
                };
            }),
            updateAssemblyDef: (id, updates) => set((s) => ({assemblyDefs: s.assemblyDefs.map(d => d.id === id ? {...d, ...updates} : d)})),
            deleteAssemblyDef: (id) => set((s) => ({assemblyDefs: s.assemblyDefs.filter(d => d.id !== id)})),
            cloneAssemblyDef: (id) => set((s) => {
                const orig = s.assemblyDefs.find(a => a.id === id);
                return orig ? {
                    assemblyDefs: [...s.assemblyDefs, {
                        ...orig,
                        id: uuidv4(),
                        name: `${orig.name} (Copy)`,
                        variables: orig.variables.map(v => ({...v, id: uuidv4()})),
                        children: orig.children.map(c => ({...c, id: uuidv4()}))
                    }]
                } : s;
            }),

            importAssemblyDefs: (incomingDefs) => set((s) => {
                const assemblyDefsMap = new Map<string, AssemblyDef>();
                s.assemblyDefs.forEach(def => { assemblyDefsMap.set(def.id, def); });

                incomingDefs.forEach(incomingDef => {
                    const defId = incomingDef.id || uuidv4();
                    const processedDef: AssemblyDef = {
                        ...incomingDef,
                        id: defId,
                        variables: (incomingDef.variables || []).map(v => ({
                            ...v,
                            id: v.id || uuidv4()
                        })),
                        children: (incomingDef.children || []).map(c => {
                            let resolvedChildId = c.childId;
                            if (c.childType === 'material') {
                                const childSku = (c as any).childSku || c.childId;
                                const material = s.materials.find(m => m.sku === childSku);
                                if (material) {
                                    resolvedChildId = material.id;
                                }
                            }
                            return {
                                ...c,
                                id: c.id || uuidv4(),
                                childId: resolvedChildId,
                                formula: c.formula || '0',
                                round: c.round || 'up',
                                variableMapping: c.variableMapping || undefined
                            };
                        })
                    };
                    assemblyDefsMap.set(defId, processedDef);
                });
                return { assemblyDefs: Array.from(assemblyDefsMap.values()) };
            }),

            addVariableToDef: (defId, name, type) => set((s) => ({
                assemblyDefs: s.assemblyDefs.map(d => d.id !== defId ? d : {
                    ...d,
                    variables: [...d.variables, {id: uuidv4(), name, type}]
                })
            })),
            deleteVariableFromDef: (defId, varId) => set((s) => ({
                assemblyDefs: s.assemblyDefs.map(d => d.id !== defId ? d : {
                    ...d,
                    variables: d.variables.filter(v => v.id !== varId)
                })
            })),
            addNodeToDef: (defId, node) => set((s) => ({
                assemblyDefs: s.assemblyDefs.map(d => d.id !== defId ? d : {
                    ...d,
                    children: [...d.children, {...node, id: uuidv4()}]
                })
            })),
            updateNodeInDef: (defId, nodeId, updates) => set((s) => ({
                assemblyDefs: s.assemblyDefs.map(d => d.id !== defId ? d : {
                    ...d,
                    children: d.children.map(c => c.id === nodeId ? {...c, ...updates} : c)
                })
            })),
            removeNodeFromDef: (defId, nodeId) => set((s) => ({
                assemblyDefs: s.assemblyDefs.map(d => d.id !== defId ? d : {
                    ...d,
                    children: d.children.filter(c => c.id !== nodeId)
                })
            })),

            addItemSet: (name) => set(s => ({itemSets: [...s.itemSets, {id: uuidv4(), name, assemblies: []}]})),
            deleteItemSet: (id) => set(s => ({itemSets: s.itemSets.filter(i => i.id !== id)})),
            addInstanceToSet: (setId, defId) => set(s => {
                const def = s.assemblyDefs.find(d => d.id === defId);
                if (!def) return s;
                const initialVars: Record<string, VariableSource> = {};
                def.variables.forEach(v => {
                    let defaultValue: number | string = 0;
                    if (v.type === 'pitch') defaultValue = ''; else if (v.type === 'boolean') defaultValue = 0; else if (v.type === 'count') {
                        defaultValue = 1;}
                    initialVars[v.id] = {type: 'manual', value: defaultValue};
                });
                const newInstance: ProjectAssembly = {
                    id: uuidv4(),
                    assemblyDefId: defId,
                    name: def.name,
                    variableValues: initialVars
                };
                return {
                    itemSets: s.itemSets.map(set => set.id !== setId ? set : {
                        ...set,
                        assemblies: [...set.assemblies, newInstance]
                    })
                };
            }),
            deleteInstanceFromSet: (setId, instanceId) => set(s => ({
                itemSets: s.itemSets.map(set => set.id !== setId ? set : {
                    ...set,
                    assemblies: set.assemblies.filter(a => a.id !== instanceId)
                })
            })),
            updateInstanceVariable: (setId, instanceId, varId, source) => set(s => ({
                itemSets: s.itemSets.map(set => set.id !== setId ? set : {
                    ...set,
                    assemblies: set.assemblies.map(inst => inst.id !== instanceId ? inst : {
                        ...inst,
                        variableValues: {...inst.variableValues, [varId]: source}
                    })
                })
            }))
        }),
        {
            name: 'takeoff-pro-db',
            partialize: (state) => ({
                materials: state.materials,
                assemblyDefs: state.assemblyDefs,
                recentFiles: state.recentFiles
            })
        }
    )
);