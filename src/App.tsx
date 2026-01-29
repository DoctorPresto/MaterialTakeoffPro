import {useState} from 'react';
import Dashboard from './components/Dashboard';
import DataTab from './components/DataTab';
import Canvas from './components/Canvas';
import MaterialsTab from './components/MaterialsTab';
import AssemblyBuilder from './components/AssemblyBuilder';
import {LogOut, Save} from 'lucide-react';
import {useStore} from './store';

const App = () => {
    const [activeTab, setActiveTab] = useState<'data' | 'measure' | 'materials' | 'setup'>('data');
    const {estimateName, closeEstimate, saveEstimate} = useStore();

    if (!estimateName) return <Dashboard/>;

    return (
        <div className="h-screen w-screen flex flex-col overflow-hidden font-sans text-gray-800 bg-gray-100 max-w-full">
            <div className="h-14 bg-gray-900 text-white flex items-center px-4 justify-between shrink-0 shadow-md z-50">
                <div className="flex items-center gap-6">
                    <div className="font-bold text-xl tracking-tight">Takeoff<span className="text-blue-400">PRO</span>
                    </div>
                    <div className="flex bg-gray-800 rounded p-1">
                        <button onClick={() => setActiveTab('data')}
                                className={`px-4 py-1 text-sm font-medium rounded transition-colors ${activeTab === 'data' ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'}`}>Project Info
                        </button>
                        <button onClick={() => setActiveTab('measure')}
                                className={`px-4 py-1 text-sm font-medium rounded transition-colors ${activeTab === 'measure' ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'}`}>Measurements
                        </button>
                        <button onClick={() => setActiveTab('materials')}
                                className={`px-4 py-1 text-sm font-medium rounded transition-colors ${activeTab === 'materials' ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'}`}>Materials
                        </button>
                        <button onClick={() => setActiveTab('setup')}
                                className={`px-4 py-1 text-sm font-medium rounded transition-colors ${activeTab === 'setup' ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'}`}>Database
                        </button>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={saveEstimate}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded text-sm font-medium border border-blue-500">
                        <Save size={16}/> Save
                    </button>
                    <button onClick={closeEstimate}
                            className="flex items-center gap-2 text-gray-400 px-3 py-1.5 rounded text-sm hover:bg-gray-800 hover:text-white">
                        <LogOut size={16}/> Exit
                    </button>
                </div>
            </div>
            <div className="flex-1 flex overflow-hidden relative w-full">
                {activeTab === 'data' && <DataTab/>}
                {activeTab === 'measure' && <Canvas/>}
                {activeTab === 'materials' && <MaterialsTab/>}
                {activeTab === 'setup' && <AssemblyBuilder/>}
            </div>
        </div>
    );
};

export default App;