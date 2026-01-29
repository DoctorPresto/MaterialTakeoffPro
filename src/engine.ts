import {AssemblyDef, BomLine, ItemSet, MaterialDef, Measurement, ProjectAssembly, VariableSource} from './types';
import {applyRounding, evaluateFormula, getPathLength, getPolygonArea} from './utils/math';

const resolveValue = (
    source: VariableSource,
    measurements: Measurement[],
    globalScale: number
): number => {
    if (source.type === 'manual') {
        // Handle pitch values (e.g., "5/12")
        if (typeof source.value === 'string') {
            const parts = source.value.split('/');
            if (parts.length === 2) {
                const rise = parseFloat(parts[0]);
                const run = parseFloat(parts[1]);
                if (!isNaN(rise) && !isNaN(run) && run !== 0) {
                    return rise / run;
                }
            }
            // If string but not a valid pitch format, try to parse as number
            const parsed = parseFloat(source.value);
            return isNaN(parsed) ? 0 : parsed;
        }
        return source.value;
    }

    if (source.type === 'measurement') {
        const m = measurements.find(meas => meas.id === source.measurementId);
        if (!m) return 0;

        if (source.property === 'count') return m.points.length;

        if (m.type === 'shape') {

            if (source.property === 'area') return getPolygonArea(m.points) / (globalScale * globalScale);
            if (source.property === 'perimeter') return getPathLength([...m.points, m.points[0]]) / globalScale;
        }

        if (m.type === 'line') {
            if (source.property === 'length') return getPathLength(m.points) / globalScale;
        }
    }

    if (source.type === 'measurementGroup') {
        const groupMeasurements = measurements.filter(m => m.group === source.groupId);
        if (groupMeasurements.length === 0) return 0;

        if (source.property === 'linear') {
            // Sum perimeters of shapes + lengths of lines
            let totalLength = 0;
            groupMeasurements.forEach(m => {
                if (m.type === 'shape') {
                    totalLength += getPathLength([...m.points, m.points[0]]);
                } else if (m.type === 'line') {
                    totalLength += getPathLength(m.points);
                }
            });
            return totalLength / globalScale;
        }
        if (source.property === 'count') {
            return groupMeasurements.reduce((sum, m) => sum + m.points.length, 0);
        }

        if (source.property === 'area') {
            // Sum areas of all shapes
            let totalArea = 0;
            groupMeasurements.forEach(m => {
                if (m.type === 'shape') {
                    totalArea += getPolygonArea(m.points);
                }
            });
            return totalArea / (globalScale * globalScale);
        }
    }

    return 0;
};

const processNodes = (
    currentDef: AssemblyDef,
    context: Record<string, number>,
    allDefs: AssemblyDef[],
    materials: MaterialDef[],
    itemSetName: string,
    breadcrumbs: string[] = []
): BomLine[] => {
    let results: BomLine[] = [];
    const currentPath = [...breadcrumbs, currentDef.name];

    const materialNodes = currentDef.children.filter(n => n.childType === 'material');
    const assemblyNodes = currentDef.children.filter(n => n.childType === 'assembly');

    const enhancedContext = {...context};

    for (const node of materialNodes) {
        const quantity = applyRounding(
            evaluateFormula(node.formula, enhancedContext),
            node.round
        );

        if (quantity > 0) {
            const mat = materials.find(m => m.id === node.childId);
            if (mat) {
                const materialName = node.alias || mat.name;
                results.push({
                    sku: mat.sku,
                    name: materialName,
                    quantity,
                    uom: mat.uom,
                    sourceItemSet: itemSetName
                });

                enhancedContext[materialName] = quantity;
            }
        }
    }

    for (const node of assemblyNodes) {
        const childDef = allDefs.find(a => a.id === node.childId);
        if (childDef && node.variableMapping) {
            const childContext: Record<string, number> = {};
            Object.entries(node.variableMapping).forEach(([childVarName, parentVarName]) => {
                if (enhancedContext[parentVarName] !== undefined) {
                    childContext[childVarName] = enhancedContext[parentVarName];
                }
            });
            results = [
                ...results,
                ...processNodes(childDef, childContext, allDefs, materials, itemSetName, currentPath)
            ];
        }
    }

    return results;
};

export const generateBOM = (
    instance: ProjectAssembly,
    allDefs: AssemblyDef[],
    measurements: Measurement[],
    materials: MaterialDef[],
    scale: number,
    itemSetName: string = "Unknown Set"
): BomLine[] => {
    const def = allDefs.find(a => a.id === instance.assemblyDefId);
    if (!def) return [];

    const context: Record<string, number> = {};
    def.variables.forEach(v => {
        const val = resolveValue(instance.variableValues[v.id], measurements, scale);
        context[v.name] = val;
    });

    return processNodes(def, context, allDefs, materials, itemSetName);
};

export const generateGlobalBOM = (
    itemSets: ItemSet[],
    allDefs: AssemblyDef[],
    measurements: Measurement[],
    materials: MaterialDef[],
    scale: number
): BomLine[] => {
    let fullBOM: BomLine[] = [];

    itemSets.forEach(set => {
        set.assemblies.forEach(instance => {
            const lines = generateBOM(instance, allDefs, measurements, materials, scale, set.name);
            fullBOM = [...fullBOM, ...lines];
        });
    });

    return fullBOM;
};