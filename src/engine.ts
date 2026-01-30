import {AssemblyDef, BomLine, ItemSet, MaterialDef, Measurement, ProjectAssembly, VariableSource} from './types';
import {applyRounding, evaluateFormula, getPathLength, getPolygonArea} from './utils/math';

// UPDATED: resolveValue now takes pageScales
const resolveValue = (
    source: VariableSource,
    measurements: Measurement[],
    globalScale: number,
    pageScales: Record<number, number> = {} // New parameter
): number => {
    if (source.type === 'manual') {
        if (typeof source.value === 'string') {
            const parts = source.value.split('/');
            if (parts.length === 2) {
                const rise = parseFloat(parts[0]);
                const run = parseFloat(parts[1]);
                if (!isNaN(rise) && !isNaN(run) && run !== 0) {
                    return rise / run;
                }
            }
            const parsed = parseFloat(source.value);
            return isNaN(parsed) ? 0 : parsed;
        }
        return source.value;
    }

    // Helper to get correct scale for a measurement
    const getScale = (m: Measurement) => {
        // If the page has a specific scale, use it. Otherwise use global.
        return pageScales[m.pageIndex] || globalScale;
    };

    if (source.type === 'measurement') {
        const m = measurements.find(meas => meas.id === source.measurementId);
        if (!m) return 0;

        const effectiveScale = getScale(m); // Use helper

        if (source.property === 'count') return m.points.length;

        if (m.type === 'shape') {
            if (source.property === 'area') return getPolygonArea(m.points) / (effectiveScale * effectiveScale);
            if (source.property === 'length') {
                return getPathLength([...m.points, m.points[0]]) / effectiveScale;
            }
        }

        if (m.type === 'line') {
            if (source.property === 'length') return getPathLength(m.points) / effectiveScale;
        }
    }

    if (source.type === 'measurementGroup') {
        const groupMeasurements = measurements.filter(m => m.group === source.groupId);
        if (groupMeasurements.length === 0) return 0;

        if (source.property === 'length') {
            let totalLength = 0;
            groupMeasurements.forEach(m => {
                const effectiveScale = getScale(m); // Resolve scale PER measurement
                if (m.type === 'shape') {
                    totalLength += getPathLength([...m.points, m.points[0]]) / effectiveScale;
                } else if (m.type === 'line') {
                    totalLength += getPathLength(m.points) / effectiveScale;
                }
            });
            return totalLength; // Already scaled
        }
        if (source.property === 'count') {
            return groupMeasurements.reduce((sum, m) => sum + m.points.length, 0);
        }

        if (source.property === 'area') {
            let totalArea = 0;
            groupMeasurements.forEach(m => {
                const effectiveScale = getScale(m); // Resolve scale PER measurement
                if (m.type === 'shape') {
                    totalArea += getPolygonArea(m.points) / (effectiveScale * effectiveScale);
                }
            });
            return totalArea; // Already scaled
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
    selections: Record<string, string> = {},
    breadcrumbs: string[] = []
): BomLine[] => {
    let results: BomLine[] = [];
    const enhancedContext = {...context};

    for (const node of currentDef.children) {
        if (node.childType === 'material') {
            const quantity = applyRounding(
                evaluateFormula(node.formula, enhancedContext),
                node.round
            );

            if (quantity > 0) {
                let targetMaterialId = node.childId;
                if (node.isDynamic) {
                    if (selections[node.id]) {
                        targetMaterialId = selections[node.id];
                    } else if (node.defaultVariantId) {
                        targetMaterialId = node.defaultVariantId;
                    }
                }

                const mat = materials.find(m => m.id === targetMaterialId);
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
                    enhancedContext[mat.sku] = quantity;
                    if (node.alias) enhancedContext[node.alias] = quantity;
                }
            }
        } else if (node.childType === 'assembly') {
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
                    ...processNodes(childDef, childContext, allDefs, materials, itemSetName, {}, [...breadcrumbs, currentDef.name])
                ];
            }
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
    itemSetName: string = "Unknown Set",
    pageScales: Record<number, number> = {} // New parameter
): BomLine[] => {
    const def = allDefs.find(a => a.id === instance.assemblyDefId);
    if (!def) return [];

    const context: Record<string, number> = {};
    def.variables.forEach(v => {
        // Pass pageScales to resolveValue
        const val = resolveValue(instance.variableValues[v.id], measurements, scale, pageScales);
        context[v.name] = val;
    });

    return processNodes(def, context, allDefs, materials, itemSetName, instance.selections || {});
};

export const generateGlobalBOM = (
    itemSets: ItemSet[],
    allDefs: AssemblyDef[],
    measurements: Measurement[],
    materials: MaterialDef[],
    scale: number,
    pageScales: Record<number, number> = {} // New parameter
): BomLine[] => {
    let fullBOM: BomLine[] = [];

    itemSets.forEach(set => {
        set.assemblies.forEach(instance => {
            // Pass pageScales
            const lines = generateBOM(instance, allDefs, measurements, materials, scale, set.name, pageScales);
            fullBOM = [...fullBOM, ...lines];
        });
    });

    return fullBOM;
};