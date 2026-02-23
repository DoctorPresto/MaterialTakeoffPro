import {AssemblyDef, BomLine, ItemSet, MaterialDef, Measurement, ProjectAssembly, VariableSource} from './types';
import {applyRounding, evaluateFormula, getPathLength, getPolygonArea} from './utils/math';

export const resolveValue = (
    source: VariableSource | undefined, // Allow undefined
    measurements: Measurement[],
    globalScale: number,
    pageScales: Record<number, number> = {}
): number => {
    if (!source) return 0;

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

    const getScale = (m: Measurement) => pageScales[m.pageIndex] || globalScale;

    if (source.type === 'measurement') {
        const m = measurements.find(meas => meas.id === source.measurementId);
        if (!m) return 0;

        const effectiveScale = getScale(m);

        if (source.property === 'count') return m.points.length;

        if (m.type === 'shape') {
            if (source.property === 'area') {
                let area = getPolygonArea(m.points) / (effectiveScale * effectiveScale);
                if (m.pitch && m.pitch > 0) {
                    const slopeFactor = Math.sqrt(1 + Math.pow(m.pitch / 12, 2));
                    area *= slopeFactor;
                }
                return area;
            }
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
                const effectiveScale = getScale(m);
                if (m.type === 'shape') {
                    totalLength += getPathLength([...m.points, m.points[0]]) / effectiveScale;
                } else if (m.type === 'line') {
                    totalLength += getPathLength(m.points) / effectiveScale;
                }
            });
            return totalLength;
        }
        if (source.property === 'count') {
            return groupMeasurements.reduce((sum, m) => sum + m.points.length, 0);
        }

        if (source.property === 'area') {
            let totalArea = 0;
            groupMeasurements.forEach(m => {
                const effectiveScale = getScale(m);
                let area = 0;
                if (m.type === 'shape') {
                    area = getPolygonArea(m.points) / (effectiveScale * effectiveScale);
                    if (m.pitch && m.pitch > 0) {
                        area *= Math.sqrt(1 + Math.pow(m.pitch / 12, 2));
                    }
                }
                totalArea += area;
            });
            return totalArea;
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
            // 1. Resolve Target Material First
            let targetMaterialId = node.childId;
            if (node.isDynamic) {
                if (selections[node.id]) {
                    targetMaterialId = selections[node.id];
                } else if (node.defaultVariantId) {
                    targetMaterialId = node.defaultVariantId;
                }
            }

            const mat = materials.find(m => m.id === targetMaterialId);
            const formulaContext = { ...enhancedContext };

            // 2. Resolve Variant Selection (for Special Order items)
            let selectedVariant = null;
            if (mat && mat.variants && mat.variants.length > 0) {
                let variantId = selections[`${node.id}_variant`];
                if (!variantId && mat.defaultVariantId) {
                    variantId = mat.defaultVariantId;
                }
                if (variantId) {
                    selectedVariant = mat.variants.find(v => v.id === variantId);
                    if (selectedVariant && selectedVariant.properties) {
                        Object.assign(formulaContext, selectedVariant.properties);
                    }
                }
            } else if (mat && mat.properties) {
                Object.assign(formulaContext, mat.properties);
            }

            // 3. Evaluate Formula
            const quantity = applyRounding(
                evaluateFormula(node.formula, formulaContext),
                node.round
            );

            // 4. Generate BOM Line
            if (quantity > 0 && mat) {
                const materialName = node.alias || mat.name;
                // Use Report SKU if provided (Special Order), otherwise internal SKU
                const displaySku = (mat.isSpecialOrder && mat.reportSku) ? mat.reportSku : mat.sku;
                // use variant name if applicable
                const displayName = selectedVariant ? `${selectedVariant.name}` : materialName;

                results.push({
                    sku: displaySku,
                    name: displayName,
                    quantity,
                    uom: mat.uom,
                    sourceItemSet: itemSetName
                });

                enhancedContext[materialName] = (enhancedContext[materialName] || 0) + quantity;
                enhancedContext[displaySku] = (enhancedContext[displaySku] || 0) + quantity;
                if (node.alias) {
                    enhancedContext[node.alias] = (enhancedContext[node.alias] || 0) + quantity;
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
    pageScales: Record<number, number> = {}
): BomLine[] => {
    const def = allDefs.find(a => a.id === instance.assemblyDefId);
    if (!def) return [];

    const context: Record<string, number> = {};
    def.variables.forEach(v => {
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
    pageScales: Record<number, number> = {}
): BomLine[] => {
    let fullBOM: BomLine[] = [];

    itemSets.forEach(set => {
        const order = set.itemOrder || [];
        const assemblyMap = new Map(set.assemblies.map(a => [a.id, a]));
        const manualMap = new Map((set.manualItems || []).map(m => [m.id, m]));
        const processedIds = new Set<string>();

        // 1. Process Ordered Items
        order.forEach(id => {
            if (assemblyMap.has(id)) {
                const instance = assemblyMap.get(id)!;
                const lines = generateBOM(instance, allDefs, measurements, materials, scale, set.name, pageScales);
                fullBOM.push(...lines);
                processedIds.add(id);
            } else if (manualMap.has(id)) {
                const item = manualMap.get(id)!;
                fullBOM.push({
                    sku: item.sku,
                    name: item.description,
                    quantity: item.quantity,
                    uom: item.uom,
                    sourceItemSet: set.name
                });
                processedIds.add(id);
            }
        });


        if (set.assemblies) {
            set.assemblies.forEach(instance => {
                if (!processedIds.has(instance.id)) {
                    const lines = generateBOM(instance, allDefs, measurements, materials, scale, set.name, pageScales);
                    fullBOM.push(...lines);
                }
            });
        }
        if (set.manualItems) {
            set.manualItems.forEach(item => {
                if (!processedIds.has(item.id)) {
                    fullBOM.push({
                        sku: item.sku,
                        name: item.description,
                        quantity: item.quantity,
                        uom: item.uom,
                        sourceItemSet: set.name
                    });
                }
            });
        }
    });

    return fullBOM;
};