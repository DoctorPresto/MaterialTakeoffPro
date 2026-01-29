export type Point = { x: number; y: number };

export type MeasurementType = 'line' | 'shape';

export interface Measurement {
    id: string;
    name: string;
    type: MeasurementType;
    points: Point[];
    pageIndex: number;
    tags: string[];
    group?: string;
    rotation?: number;
    hidden?: boolean;
}

export interface MaterialDef {
    id: string;
    sku: string;
    name: string;
    uom: string;
    category: string;
}

export type VariableType = 'linear' | 'area' | 'count' | 'number' | 'pitch' | 'boolean';

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

export type VariableSource =
    | { type: 'manual'; value: number | string  }
    | { type: 'measurement'; measurementId: string; property: 'length' | 'area' | 'count' }
    | { type: 'measurementGroup'; groupId: string; property: 'length' | 'area' | 'count' };

export interface ProjectAssembly {
    id: string;
    assemblyDefId: string;
    name: string;
    variableValues: Record<string, VariableSource>;
}

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

export interface ProjectInfo {
    projectName: string;
    customerName: string;
    notes: string;
    files: string[];
}

export interface BuildingData {
    icfFoundation: boolean;
    foundationPerimeterId: string | null;
    foundationAreaId: string | null;
    hasGarage: boolean;
    garageShapeId: string | null;
    roofFlatArea: number;
    numPlanes: number;
    numPeaks: number;
    valleyLength: number;
}

export interface EstimateFile {
    version: string;
    meta: {
        name: string;
        created: number;
        lastModified: number;
    };
    data: {
        projectInfo: ProjectInfo;
        buildingData: BuildingData;
        scale: number;
        measurements: Measurement[];
        itemSets: ItemSet[];
        pdfBase64: string | null;
    };
}

export interface RecentFile {
    id: string;
    name: string;
    lastOpened: number;
    data: EstimateFile;
}