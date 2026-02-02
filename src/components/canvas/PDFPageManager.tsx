import {useState} from 'react';
import {FileX, X} from 'lucide-react';

export const PDFPageManager = ({
                                   numPages, activePageIndex, onPageChange, onRemovePage
                               }: {
    numPages: number,
    activePageIndex: number,
    onPageChange: (index: number) => void,
    onRemovePage: (index: number) => void
}) => {
    const [showManager, setShowManager] = useState(false);

    if (numPages <= 1) return null;

    return (
        <div className="relative">
            <button
                onClick={() => setShowManager(!showManager)}
                className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-blue-600"
                title="Manage Pages"
            >
                <FileX size={16} />
            </button>

            {showManager && (
                <div className="absolute top-full right-0 mt-1 bg-white border rounded-lg shadow-lg z-50 w-64 p-3">
                    <h3 className="font-bold text-sm mb-2">PDF Pages</h3>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                        {Array.from({ length: numPages }, (_, i) => (
                            <div key={i}
                                 className={`flex items-center justify-between p-2 rounded ${i === activePageIndex ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50'}`}>
                                <button
                                    onClick={() => onPageChange(i)}
                                    className="flex-1 text-left text-sm"
                                >
                                    Page {i + 1} {i === activePageIndex && '(Current)'}
                                </button>
                                <button
                                    onClick={() => onRemovePage(i)}
                                    className="p-1 text-red-500 hover:bg-red-50 rounded"
                                    title="Remove from takeoff"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={() => setShowManager(false)}
                        className="w-full mt-2 p-1 text-xs text-gray-500 hover:bg-gray-100 rounded"
                    >
                        Close
                    </button>
                </div>
            )}
        </div>
    );
};