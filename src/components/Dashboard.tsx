import React, {useEffect, useState} from 'react';
import {useStore} from '../store';
import {Clock, FilePlus, FolderOpen} from 'lucide-react';

// --- New Project Modal ---
const NewProjectModal = ({
                             isOpen, onClose, onCreate
                         }: { isOpen: boolean, onClose: () => void, onCreate: (name: string) => void }) => {
    const [name, setName] = useState('');

    // Reset input when modal opens
    useEffect(() => {
        if (isOpen) setName('');
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center">
            <div className="bg-white p-6 rounded-lg shadow-xl w-96 animate-in fade-in zoom-in-95 duration-200">
                <h3 className="font-bold mb-4 text-xl text-gray-800">Start New Project</h3>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Project Name</label>
                <input
                    autoFocus
                    className="w-full border p-2 rounded mb-6 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="e.g. Smith Residence"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter' && name) onCreate(name);
                    }}
                />
                <div className="flex gap-2 justify-end">
                    <button onClick={onClose}
                            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded font-medium">Cancel
                    </button>
                    <button
                        onClick={() => {
                            if (name) onCreate(name);
                        }}
                        disabled={!name}
                        className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded font-bold shadow-sm disabled:opacity-50"
                    >
                        Create
                    </button>
                </div>
            </div>
        </div>
    );
};

const Dashboard = () => {
    const {createEstimate, recentFiles, loadRecent, loadEstimateFromFile} = useStore();
    const [showModal, setShowModal] = useState(false);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const text = await file.text();
        try {
            const data = JSON.parse(text);
            if (data.version) loadEstimateFromFile(data);
        } catch (err) {
            alert("Invalid File");
        }
    };

    const handleCreate = (_name: string) => {
        createEstimate();
        setShowModal(false);
    };

    return (
        <div className="h-screen w-screen bg-gray-50 flex items-center justify-center p-8">

            {/* Modal Overlay */}
            <NewProjectModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                onCreate={handleCreate}
            />

            <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-2 gap-12">
                {/* LEFT: Actions */}
                <div className="flex flex-col justify-center space-y-8">
                    <div>
                        <h1 className="text-5xl font-bold text-gray-900 mb-2">Takeoff<span
                            className="text-blue-600">PRO</span></h1>
                        <p className="text-xl text-gray-500">Estimation Suite</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={() => setShowModal(true)}
                            className="flex flex-col items-center justify-center p-8 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg transition-transform hover:-translate-y-1"
                        >
                            <FilePlus size={48} className="mb-4"/>
                            <span className="font-bold text-lg">New Project</span>
                        </button>
                        <label
                            className="flex flex-col items-center justify-center p-8 bg-white hover:bg-gray-100 text-gray-700 rounded-xl shadow-md border cursor-pointer transition-transform hover:-translate-y-1">
                            <FolderOpen size={48} className="mb-4 text-green-600"/>
                            <span className="font-bold text-lg">Load File</span>
                            <input type="file" accept=".takeoff" className="hidden" onChange={handleFileSelect}/>
                        </label>
                    </div>
                </div>

                {/* RIGHT: Recent Files */}
                <div className="bg-white rounded-xl shadow-lg border overflow-hidden flex flex-col h-[500px]">
                    <div className="p-4 border-b bg-gray-50 font-bold text-gray-600 flex items-center gap-2">
                        <Clock size={18}/> Recent Projects
                    </div>
                    <div className="flex-1 overflow-auto p-2 space-y-1">
                        {recentFiles.length === 0 &&
                            <div className="text-center text-gray-400 mt-20">No recent files found.</div>}
                        {recentFiles.map(file => (
                            <div
                                key={file.id}
                                onDoubleClick={() => loadRecent(file.id)}
                                className="group p-4 rounded-lg hover:bg-blue-50 cursor-pointer border border-transparent hover:border-blue-100 transition-colors"
                            >
                                <div className="font-bold text-gray-800 group-hover:text-blue-700">{file.name}</div>
                                <div className="text-xs text-gray-400 mt-1">Last
                                    opened: {new Date(file.lastOpened).toLocaleString()}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;