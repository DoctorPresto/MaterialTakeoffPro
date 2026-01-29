import {useStore} from '../store';
import {generateGlobalBOM} from '../engine';
import TakeoffSidebar from './TakeoffSidebar';
import {Download} from 'lucide-react';

const MaterialsTab = () => {
    const {itemSets, assemblyDefs, measurements, materials, scale} = useStore();
    const bom = generateGlobalBOM(itemSets, assemblyDefs, measurements, materials, scale);

    const handleExportCSV = () => {
        const headers = ["Item Set", "SKU", "Name", "Quantity", "UOM"];
        const rows = bom.map(l => [l.sourceItemSet, l.sku, l.name, l.quantity, l.uom]);
        const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].map(e => e.join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.href = encodedUri;
        link.download = "takeoff_bom.csv";
        document.body.appendChild(link);
        link.click();
    };

    return (
        <div className="flex h-full w-full bg-gray-100 overflow-hidden">
            <TakeoffSidebar/>
            <div className="flex-1 flex flex-col overflow-hidden">
                <div className="h-12 bg-white border-b flex items-center px-4 justify-between shrink-0">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Materials</span>
                    <button onClick={handleExportCSV}
                            className="flex items-center gap-2 bg-green-50 text-green-700 px-3 py-1.5 rounded text-sm hover:bg-green-100 border border-green-200 font-medium">
                        <Download size={16}/> Export Excel
                    </button>
                </div>
                <div className="flex-1 overflow-auto p-4 w-full">
                    <div className="w-full bg-white shadow rounded-lg p-6 min-h-full">
                        {itemSets.map(set => {
                            const setLines = bom.filter(l => l.sourceItemSet === set.name);
                            if (setLines.length === 0) return null;
                            return (
                                <div key={set.id} className="mb-8">
                                    <h3 className="font-bold text-lg border-b pb-2 mb-2 bg-gray-50 p-2">{set.name}</h3>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm min-w-[600px]">
                                            <thead>
                                            <tr className="text-left text-gray-500">
                                                <th className="pb-2 w-32">SKU</th>
                                                <th className="pb-2">Material Name</th>
                                                <th className="pb-2 w-20 text-center">UOM</th>
                                                <th className="pb-2 text-right">Qty</th>
                                            </tr>
                                            </thead>
                                            <tbody className="divide-y">{setLines.map((line, idx) => <tr key={idx}>
                                                <td className="py-2 text-gray-500">{line.sku}</td>
                                                <td className="py-2 font-medium">{line.name}</td>
                                                <td className="py-2 text-center text-gray-500">{line.uom}</td>
                                                <td className="py-2 text-right font-mono font-bold">{line.quantity}</td>
                                            </tr>)}</tbody>
                                        </table>
                                    </div>
                                </div>
                            );
                        })}
                        {bom.length === 0 &&
                            <div className="text-center text-gray-400 py-10">No materials generated yet.</div>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MaterialsTab;