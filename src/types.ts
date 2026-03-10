export type Point = {
    x: number;
    y: number;
    nodeId?: string;
    connectsTo?: number[];
    controlPoint?: { x: number; y: number };
};

export type MeasurementType = 'line' | 'shape';

// NEW: Specific roof line types for BMCC math logic
export type RoofLineType = 'hip' | 'valley' | 'ridge' | 'eave' | 'gable' | null;

export interface LabelSettings {
    showEdgeLengths?: boolean;
    showTotalLength?: boolean;
    showArea?: boolean;
    fontSize?: number;
    color?: string;
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

    // NEW: Property for Roof Wizard logic
    roofLineType?: RoofLineType;

    // Roof Plane properties
    roofPlaneIndex?: number;  // 1-based index for roof plane shapes
    roofPlaneShape?: 'rectangle' | 'triangle' | 'trapezoid' | 'custom';  // original shape type
    edgeTypes?: string[];     // Array of assigned line types for edges ('hip', 'valley', 'ridge', 'eave', 'gable')
    slopeDirection?: Point[]; // Two points defining the UP direction arrow (e.g. from eave to ridge)
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
    | { type: 'measurement'; measurementId: string; property: 'length' | 'area' | 'count' | 'perimeter' }
    | { type: 'measurementGroup'; groupId: string; property: 'length' | 'area' | 'count' | 'linear' }
    | { type: 'buildingData'; field: string };

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

// UPDATED: Extended to match BMCC Basic Data Sheet requirements
export interface BuildingData {
    // Original Fields
    icfFoundation: boolean;
    foundationPerimeterId: string | null;
    foundationAreaId: string | null;
    hasGarage: boolean;
    garageShapeId: string | null;
    roofFlatArea: number;
    numPlanes: number;
    numPeaks: number;
    valleyLength: number; // Keep for backward compatibility

    // NEW Fields for Manual Implementation
    wasteFactorProfile: 'pro' | 'diy';

    // Foundation Extras
    foundationWallHeight: number;
    foundationCorners: number;

    // Framing / Main Floor
    mainFloorPerimeter: number;
    mainFloorGrossWallArea: number;
    mainFloorNetWallArea: number;
    mainFloorCorners: number;
    mainFloorIntersections: number;
    mainFloorIntWallLength4: number; // 2x4 walls
    mainFloorIntWallLength6: number; // 2x6 walls

    // Roof Extras (Box Method / Line Method support)
    roofPitch: number;
    numPitches: number;
    roofRidgeLength: number;
    roofHipLength: number;
    roofEaveLength: number;
    roofGableLength: number;
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