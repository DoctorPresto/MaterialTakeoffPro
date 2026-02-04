export type Point = {
    x: number;
    y: number;
    connectsTo?: number[];
    controlPoint?: { x: number; y: number };
};

export type MeasurementType = 'line' | 'shape';

export interface LabelSettings {
    showEdgeLengths?: boolean;
    showTotalLength?: boolean;
    showArea?: boolean;
}

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
    pitch?: number;
    labels?: LabelSettings;
}

export interface MaterialVariant {
    id: string;
    name: string;
    properties: Record<string, number>;
}

export interface MaterialDef {
    id: string;
    sku: string;
    name: string;
    uom: string;
    category: string;

    isSpecialOrder?: boolean;
    reportSku?: string;

    variants?: MaterialVariant[];
    defaultVariantId?: string;

    properties?: Record<string, number>;
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
    isDynamic?: boolean;
    variantIds?: string[];
    defaultVariantId?: string;
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
    selections?: Record<string, string>;
}

export interface ManualItem {
    id: string;
    sku: string;
    description: string;
    quantity: number;
    uom: string;
}

export interface ItemSet {
    id: string;
    name: string;
    assemblies: ProjectAssembly[];
    manualItems: ManualItem[];
    itemOrder?: string[];
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
        pageScales?: Record<number, number>;
        measurements: Measurement[];
        itemSets: ItemSet[];
        pdfBase64: string | null;
        groupColors?: Record<string, string>;
    };
}

export interface RecentFile {
    id: string;
    name: string;
    lastOpened: number;
    data: EstimateFile;
}