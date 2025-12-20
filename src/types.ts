export type Point = { x: number; y: number };

// --- Measurement / Geometry ---
export type MeasurementType = 'line' | 'shape'; 

export interface Measurement {
  id: string;
  name: string;
  type: MeasurementType;
  points: Point[];
  pageIndex: number;
}

// --- Materials ---
export interface MaterialDef {
  id: string;
  sku: string;
  name: string;
  uom: string; 
  category: string;
}

// --- Assembly Definitions  ---
export type VariableType = 'linear' | 'area' | 'count' | 'number';

export interface AssemblyVariable {
  id: string;
  name: string; 
  type: VariableType;
}

export interface AssemblyNode {
  id: string;
  childType: 'material' | 'assembly';
  childId: string; 
  alias?: string;
  formula: string; 
  round: 'up' | 'down' | 'nearest' | 'none';
  variableMapping?: Record<string, string>;
}

export interface AssemblyDef {
  id: string;
  name: string;
  category: string; 
  variables: AssemblyVariable[];
  children: AssemblyNode[];
}

// --- Project Instances ---
export type VariableSource = 
  | { type: 'manual'; value: number }
  | { type: 'measurement'; measurementId: string; property: 'length' | 'area' | 'perimeter' }; 

export interface ProjectAssembly {
  id: string;
  assemblyDefId: string;
  name: string;
  variableValues: Record<string, VariableSource>; 
}

//Item Set Container
export interface ItemSet {
  id: string;
  name: string;
  assemblies: ProjectAssembly[];
}

export interface BomLine {
  sku: string;
  name: string;
  quantity: number;
  uom: string;
  sourceItemSet: string; 
}