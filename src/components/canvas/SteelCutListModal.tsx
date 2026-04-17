import React from 'react';
import { X, Printer } from 'lucide-react';
import { RoofSteelResult, generateCutList, formatFeetInches } from '../../utils/steelRoofing';

interface Props {
    result: RoofSteelResult;
    projectName: string;
    onClose: () => void;
}

export const SteelCutListModal: React.FC<Props> = ({ result, projectName, onClose }) => {
    const cutList = generateCutList(result);

    const handlePrint = () => {
        window.print();
    };

    // Group entries by plane
    const grouped = new Map<string, typeof cutList>();
    cutList.forEach(entry => {
        if (!grouped.has(entry.planeName)) grouped.set(entry.planeName, []);
        grouped.get(entry.planeName)!.push(entry);
    });

    // Group all sheets by order length for the consolidated list
    const consolidatedList = new Map<number, { count: number; formattedLength: string }>();
    cutList.forEach(entry => {
        const key = entry.orderLengthFt;
        if (!consolidatedList.has(key)) {
            consolidatedList.set(key, { count: 0, formattedLength: entry.orderLength });
        }
        consolidatedList.get(key)!.count += 1;
    });

    // Sort by length descending
    const sortedConsolidated = Array.from(consolidatedList.entries())
        .sort((a, b) => b[0] - a[0])
        .map(e => e[1]);

    return (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4 print:absolute print:inset-0 print:p-0 print:bg-white print:block">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col print:max-h-none print:shadow-none print:rounded-none print:max-w-none print:w-full print:block">
                {/* Header - hidden in print */}
                <div className="flex items-center justify-between p-4 border-b bg-gray-50 rounded-t-xl print:hidden">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <Printer size={20} />
                        Steel Roofing Cut List
                    </h2>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handlePrint}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
                        >
                            <Printer size={16} /> Print
                        </button>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Print header */}
                <div className="hidden print:block p-4 border-b">
                    <h1 className="text-xl font-bold">{projectName} — Steel Roofing Cut List</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Profile: {result.coverageWidth}" coverage | Generated: {new Date().toLocaleDateString()}
                    </p>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 print:overflow-visible print:block">
                    {/* Summary box */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 grid grid-cols-3 gap-4 text-center">
                        <div>
                            <div className="text-2xl font-bold text-blue-800">{result.totalSheets}</div>
                            <div className="text-xs text-blue-600 font-bold uppercase">Total Sheets</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-blue-800">{formatFeetInches(result.totalLinearFeet)}</div>
                            <div className="text-xs text-blue-600 font-bold uppercase">Total Linear Feet</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-blue-800">{result.coverageWidth}"</div>
                            <div className="text-xs text-blue-600 font-bold uppercase">Coverage Width</div>
                        </div>
                    </div>

                    {/* Consolidated Order List */}
                    <div className="mb-6 print:break-inside-avoid">
                        <h3 className="font-bold text-gray-800 mb-2 border-b pb-1">Consolidated Order List</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {sortedConsolidated.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center bg-gray-50 border border-gray-200 rounded px-3 py-2">
                                    <span className="font-mono font-bold">{item.formattedLength}</span>
                                    <span className="bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded text-sm">× {item.count}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Per-plane tables */}
                    {Array.from(grouped.entries()).map(([planeName, entries]) => {
                        const planeResult = result.planes.find(p => p.planeName === planeName);
                        return (
                            <div key={planeName} className="mb-6 print:break-inside-avoid">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="font-bold text-gray-800">{planeName}</h3>
                                    {planeResult && (
                                        <span className="text-xs text-gray-500">
                                            {planeResult.pitch}/12 pitch · Eave: {formatFeetInches(planeResult.eaveLengthFt)} · Rafter: {formatFeetInches(planeResult.rafterLengthFt)}
                                        </span>
                                    )}
                                </div>
                                <table className="w-full text-sm border-collapse">
                                    <thead>
                                        <tr className="bg-gray-100 text-left">
                                            <th className="border border-gray-300 px-2 py-1.5 font-bold text-gray-600 w-12">#</th>
                                            <th className="border border-gray-300 px-2 py-1.5 font-bold text-gray-600">Length</th>
                                            <th className="border border-gray-300 px-2 py-1.5 font-bold text-gray-600 w-20">Width</th>
                                            <th className="border border-gray-300 px-2 py-1.5 font-bold text-gray-600">Cut Type</th>
                                            <th className="border border-gray-300 px-2 py-1.5 font-bold text-gray-600 w-24">Angles</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {entries.map(entry => (
                                            <tr key={entry.sheetNumber} className={entry.cutDescription !== 'Full Sheet' ? 'bg-yellow-50' : ''}>
                                                <td className="border border-gray-300 px-2 py-1 text-center font-mono font-bold">{entry.sheetNumber}</td>
                                                <td className="border border-gray-300 px-2 py-1 font-mono font-bold">{entry.orderLength}</td>
                                                <td className="border border-gray-300 px-2 py-1 text-center">
                                                    {entry.actualWidth < entry.coverageWidth ? (
                                                        <span className="text-orange-600 font-bold">{entry.actualWidth}"</span>
                                                    ) : (
                                                        <span>{entry.coverageWidth}"</span>
                                                    )}
                                                </td>
                                                <td className="border border-gray-300 px-2 py-1 text-xs">{entry.cutDescription}</td>
                                                <td className="border border-gray-300 px-2 py-1 text-center text-xs font-mono">{entry.cutAngles}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {planeResult && (
                                    <div className="text-right text-xs text-gray-500 mt-1 font-bold">
                                        Plane total: {planeResult.totalSheets} sheets · {formatFeetInches(planeResult.totalLinearFeet)} linear
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
