import { useEffect } from 'react';
import { CreditCard as Edit3, PlusCircle, Trash2, X, GitFork } from 'lucide-react';

export const ContextMenu = ({
                                x, y, onClose, measurement, actions
                            }: {
    x: number, y: number, onClose: () => void, measurement: any,
    actions: {
        deletePoint: () => void,
        addPoint: () => void,
        rename: () => void,
        deleteShape: () => void,
        branch: () => void
    }
}) => {
    useEffect(() => {
        const handleOutside = () => onClose();
        document.addEventListener('click', handleOutside);
        return () => document.removeEventListener('click', handleOutside);
    }, []);

    return (
        <div
            className="fixed bg-white shadow-xl border rounded z-[100] w-56 py-1 text-gray-700"
            style={{ top: y, left: x }}
            onClick={e => e.stopPropagation()}
        >
            <div className="px-4 py-2 border-b bg-gray-50 text-xs font-bold text-gray-500 truncate">
                {measurement.name}
            </div>

            <button onClick={() => {
                actions.rename();
                onClose();
            }} className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm flex gap-2 items-center"><Edit3
                size={14} /> Rename
            </button>

            <div className="h-[1px] bg-gray-100 my-1"></div>

            {/* This is the Branch Line option */}
            <button onClick={() => {
                actions.branch();
                onClose();
            }} className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm flex gap-2 items-center text-purple-600">
                <GitFork size={14} /> Branch Line
            </button>

            <button onClick={() => {
                actions.addPoint();
                onClose();
            }} className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm flex gap-2 items-center text-blue-600">
                <PlusCircle size={14} /> Add Vertex After (Midpoint)
            </button>
            <button onClick={() => {
                actions.deletePoint();
                onClose();
            }} className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm flex gap-2 items-center text-red-600">
                <Trash2 size={14} /> Delete Vertex
            </button>

            <div className="h-[1px] bg-gray-100 my-1"></div>
            <button onClick={() => {
                actions.deleteShape();
                onClose();
            }}
                    className="w-full text-left px-4 py-2 hover:bg-red-50 text-sm flex gap-2 items-center text-red-700 font-bold">
                <X size={14} /> Delete Shape
            </button>
        </div>
    );
};

export const EdgeContextMenu = ({
                                    x, y, onClose, onAddVertex
                                }: {
    x: number, y: number, onClose: () => void, onAddVertex: () => void
}) => {
    useEffect(() => {
        const handleOutside = () => onClose();
        document.addEventListener('click', handleOutside);
        return () => document.removeEventListener('click', handleOutside);
    }, []);

    return (
        <div
            className="fixed bg-white shadow-xl border rounded z-[100] w-48 py-1 text-gray-700"
            style={{ top: y, left: x }}
            onClick={e => e.stopPropagation()}
        >
            <button onClick={() => {
                onAddVertex();
                onClose();
            }} className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm flex gap-2 items-center text-blue-600">
                <PlusCircle size={14} /> Add Vertex Here
            </button>
        </div>
    );
};