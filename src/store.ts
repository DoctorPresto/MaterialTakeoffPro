import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { 
  Measurement, MeasurementType, Point, 
  AssemblyDef, MaterialDef, ProjectAssembly, 
  VariableSource, AssemblyNode, AssemblyVariable, ItemSet
} from './types';

interface AppState {
  // --- Config ---
  scale: number;
  activePageIndex: number;
  activeTool: 'select' | 'line' | 'shape';
  isCalibrating: boolean;
  
  // --- Viewport ---
  zoom: number;
  pan: { x: number; y: number };

  // --- Data ---
  measurements: Measurement[];
  materials: MaterialDef[];
  assemblyDefs: AssemblyDef[];
  itemSets: ItemSet[];
  
  // --- Actions ---
  setScale: (s: number) => void;
  setPageIndex: (index: number) => void;
  setTool: (t: 'select' | 'line' | 'shape') => void;
  setIsCalibrating: (status: boolean) => void;
  setViewport: (zoom: number, pan: { x: number, y: number }) => void;
  
  addMeasurement: (type: MeasurementType, points: Point[]) => void;
  deleteMeasurement: (id: string) => void;

  // Material Actions
  addMaterial: (mat: Omit<MaterialDef, 'id'>) => void;
  updateMaterial: (id: string, updates: Partial<MaterialDef>) => void;
  deleteMaterial: (id: string) => void;
  cloneMaterial: (id: string) => void;

  // Assembly Definition Actions
  addAssemblyDef: (name: string, category: string) => void;
  updateAssemblyDef: (id: string, updates: Partial<AssemblyDef>) => void;
  deleteAssemblyDef: (id: string) => void;
  cloneAssemblyDef: (id: string) => void;

  addVariableToDef: (defId: string, name: string, type: AssemblyVariable['type']) => void;
  deleteVariableFromDef: (defId: string, varId: string) => void; // NEW

  addNodeToDef: (defId: string, node: Omit<AssemblyNode, 'id'>) => void;
  updateNodeInDef: (defId: string, nodeId: string, updates: Partial<AssemblyNode>) => void; // NEW
  removeNodeFromDef: (defId: string, nodeId: string) => void;

  // Item Set & Instance Actions
  addItemSet: (name: string) => void;
  deleteItemSet: (id: string) => void;
  
  addInstanceToSet: (setId: string, defId: string) => void;
  deleteInstanceFromSet: (setId: string, instanceId: string) => void;
  updateInstanceVariable: (setId: string, instanceId: string, varId: string, source: VariableSource) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      scale: 1, 
      activePageIndex: 0,
      activeTool: 'select',
      isCalibrating: false,
      zoom: 1,
      pan: { x: 0, y: 0 },
      
      measurements: [],
      materials: [],
      assemblyDefs: [],
      itemSets: [],

      setScale: (scale) => set({ scale }),
      setPageIndex: (index) => set({ activePageIndex: Math.max(0, index) }),
      setTool: (activeTool) => set({ activeTool, isCalibrating: false }),
      setIsCalibrating: (isCalibrating) => set({ isCalibrating, activeTool: 'select' }),
      setViewport: (zoom, pan) => set({ zoom, pan }),

      addMeasurement: (type, points) => {
        const { activePageIndex, measurements } = get();
        const newMeasurement: Measurement = {
          id: uuidv4(),
          name: `${type === 'line' ? 'Line' : 'Shape'} ${measurements.length + 1}`,
          type,
          points,
          pageIndex: activePageIndex
        };
        set({ measurements: [...measurements, newMeasurement] });
      },

      deleteMeasurement: (id) => set((state) => ({
        measurements: state.measurements.filter(m => m.id !== id)
      })),

      // --- Material CRUD ---
      addMaterial: (mat) => set((state) => ({
        materials: [...state.materials, { ...mat, id: uuidv4() }]
      })),

      updateMaterial: (id, updates) => set((state) => ({
        materials: state.materials.map(m => m.id === id ? { ...m, ...updates } : m)
      })),

      deleteMaterial: (id) => set((state) => ({
        materials: state.materials.filter(m => m.id !== id)
      })),

      cloneMaterial: (id) => set((state) => {
        const original = state.materials.find(m => m.id === id);
        if (!original) return state;
        return {
          materials: [...state.materials, { ...original, id: uuidv4(), name: `${original.name} (Copy)` }]
        };
      }),

      // --- Assembly Def CRUD ---
      addAssemblyDef: (name, category) => set((state) => ({
        assemblyDefs: [...state.assemblyDefs, {
          id: uuidv4(),
          name,
          category,
          variables: [],
          children: []
        }]
      })),

      updateAssemblyDef: (id, updates) => set((state) => ({
        assemblyDefs: state.assemblyDefs.map(d => d.id === id ? { ...d, ...updates } : d)
      })),

      deleteAssemblyDef: (id) => set((state) => ({
        assemblyDefs: state.assemblyDefs.filter(d => d.id !== id)
      })),

      cloneAssemblyDef: (id) => set((state) => {
        const original = state.assemblyDefs.find(a => a.id === id);
        if (!original) return state;
        
        const newVars = original.variables.map(v => ({ ...v, id: uuidv4() }));
        const newChildren = original.children.map(c => ({ ...c, id: uuidv4() }));

        return {
          assemblyDefs: [...state.assemblyDefs, {
            ...original,
            id: uuidv4(),
            name: `${original.name} (Copy)`,
            variables: newVars,
            children: newChildren
          }]
        };
      }),

      addVariableToDef: (defId, name, type) => set((state) => ({
        assemblyDefs: state.assemblyDefs.map(def => {
          if (def.id !== defId) return def;
          return {
            ...def,
            variables: [...def.variables, { id: uuidv4(), name, type }]
          };
        })
      })),

      deleteVariableFromDef: (defId, varId) => set((state) => ({
        assemblyDefs: state.assemblyDefs.map(def => {
          if (def.id !== defId) return def;
          return {
            ...def,
            variables: def.variables.filter(v => v.id !== varId)
          };
        })
      })),

      addNodeToDef: (defId, node) => set((state) => ({
        assemblyDefs: state.assemblyDefs.map(def => {
          if (def.id !== defId) return def;
          return {
            ...def,
            children: [...def.children, { ...node, id: uuidv4() }]
          };
        })
      })),

      updateNodeInDef: (defId, nodeId, updates) => set((state) => ({
        assemblyDefs: state.assemblyDefs.map(def => {
          if (def.id !== defId) return def;
          return {
            ...def,
            children: def.children.map(c => c.id === nodeId ? { ...c, ...updates } : c)
          };
        })
      })),

      removeNodeFromDef: (defId, nodeId) => set((state) => ({
        assemblyDefs: state.assemblyDefs.map(def => {
          if (def.id !== defId) return def;
          return {
            ...def,
            children: def.children.filter(c => c.id !== nodeId)
          };
        })
      })),

      // --- Item Sets--
      addItemSet: (name) => set(state => ({
        itemSets: [...state.itemSets, { id: uuidv4(), name, assemblies: [] }]
      })),

      deleteItemSet: (id) => set(state => ({
        itemSets: state.itemSets.filter(s => s.id !== id)
      })),

      addInstanceToSet: (setId, defId) => set(state => {
        const def = state.assemblyDefs.find(d => d.id === defId);
        if (!def) return state;
        
        const initialVars: Record<string, VariableSource> = {};
        def.variables.forEach(v => {
          initialVars[v.id] = { type: 'manual', value: 0 };
        });

        const newInstance: ProjectAssembly = {
          id: uuidv4(),
          assemblyDefId: defId,
          name: def.name,
          variableValues: initialVars
        };

        return {
          itemSets: state.itemSets.map(set => {
            if (set.id !== setId) return set;
            return { ...set, assemblies: [...set.assemblies, newInstance] };
          })
        };
      }),

      deleteInstanceFromSet: (setId, instanceId) => set(state => ({
        itemSets: state.itemSets.map(set => {
          if (set.id !== setId) return set;
          return { ...set, assemblies: set.assemblies.filter(a => a.id !== instanceId) };
        })
      })),

      updateInstanceVariable: (setId, instanceId, varId, source) => set(state => ({
        itemSets: state.itemSets.map(set => {
          if (set.id !== setId) return set;
          return {
            ...set,
            assemblies: set.assemblies.map(inst => {
              if (inst.id !== instanceId) return inst;
              return {
                ...inst,
                variableValues: { ...inst.variableValues, [varId]: source }
              };
            })
          };
        })
      }))
    }),
    {
      name: 'takeoff-storage',
      partialize: (state) => ({
        measurements: state.measurements,
        materials: state.materials,
        assemblyDefs: state.assemblyDefs,
        itemSets: state.itemSets,
        scale: state.scale
      }),
    }
  )
);