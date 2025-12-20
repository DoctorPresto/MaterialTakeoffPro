import { 
  AssemblyDef, MaterialDef, BomLine, ProjectAssembly, 
  Measurement, VariableSource, ItemSet 
} from './types';
import { getPathLength, getPolygonArea, evaluateFormula, applyRounding } from './utils/math';

const resolveValue = (
  source: VariableSource, 
  measurements: Measurement[], 
  scale: number
): number => {
  if (source.type === 'manual') return source.value;
  
  if (source.type === 'measurement') {
    const m = measurements.find(meas => meas.id === source.measurementId);
    if (!m) return 0;
    
    // Logic for Shapes acting as both Area and Perimeter
    if (m.type === 'shape') {
      if (source.property === 'area') return getPolygonArea(m.points) / (scale * scale);
      if (source.property === 'perimeter') return getPathLength([...m.points, m.points[0]]) / scale; 
    }

    if (m.type === 'line') {
      if (source.property === 'length') return getPathLength(m.points) / scale;
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

  for (const node of currentDef.children) {
    const quantity = applyRounding(
      evaluateFormula(node.formula, context), 
      node.round
    );

    if (quantity <= 0) continue;

    if (node.childType === 'material') {
      const mat = materials.find(m => m.id === node.childId);
      if (mat) {
        results.push({
          sku: mat.sku,
          name: node.alias || mat.name,
          quantity,
          uom: mat.uom,
          sourceItemSet: itemSetName
        });
      }
    } else {
      const childDef = allDefs.find(a => a.id === node.childId);
      if (childDef && node.variableMapping) {
        const childContext: Record<string, number> = {};
        Object.entries(node.variableMapping).forEach(([childVarName, parentVarName]) => {
          if (context[parentVarName] !== undefined) {
            childContext[childVarName] = context[parentVarName];
          }
        });
        results = [
          ...results,
          ...processNodes(childDef, childContext, allDefs, materials, itemSetName, currentPath)
        ];
      }
    }
  }
  return results;
};

// --- EXPORT 1: Single Instance BOM (Used internally or for previews) ---
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

// --- EXPORT 2: Global BOM (Used for the Material List Tab) ---
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
      // Reuse the single instance generator
      const lines = generateBOM(instance, allDefs, measurements, materials, scale, set.name);
      fullBOM = [...fullBOM, ...lines];
    });
  });

  return fullBOM;
};