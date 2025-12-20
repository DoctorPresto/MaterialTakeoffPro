import React, { useState } from 'react';
import Canvas from './components/Canvas';
import TakeoffSidebar from './components/TakeoffSidebar';
import AssemblyBuilder from './components/AssemblyBuilder';
import { Upload } from 'lucide-react';
import { useStore } from './store';
import { generateGlobalBOM } from './engine';

const App = () => {
  const [file, setFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState<'takeoff' | 'setup' | 'bom'>('takeoff');
  
  const { itemSets, assemblyDefs, measurements, materials, scale } = useStore();

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setFile(e.target.files[0]);
  };

  const bom = generateGlobalBOM(itemSets, assemblyDefs, measurements, materials, scale);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden font-sans text-gray-800 bg-gray-100">
      {/* Top Bar */}
      <div className="h-12 border-b bg-white flex items-center px-4 justify-between shrink-0 shadow-sm z-30">
        <div className="font-bold text-blue-600">MaterialTakeoff<span className="text-gray-400">Pro</span></div>
        
        <div className="flex gap-1 bg-gray-100 p-1 rounded">
          <button className={`px-4 py-1 text-sm font-medium rounded ${activeTab === 'takeoff' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`} onClick={() => setActiveTab('takeoff')}>Takeoff</button>
          <button className={`px-4 py-1 text-sm font-medium rounded ${activeTab === 'bom' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`} onClick={() => setActiveTab('bom')}>Material Estimate</button>
          <button className={`px-4 py-1 text-sm font-medium rounded ${activeTab === 'setup' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`} onClick={() => setActiveTab('setup')}>Assembly Builder</button>
        </div>

        <label className="flex items-center gap-2 cursor-pointer bg-blue-50 text-blue-600 px-3 py-1.5 rounded text-sm hover:bg-blue-100 border border-blue-100">
          <Upload size={16} /> <span>Upload PDF</span>
          <input type="file" accept="application/pdf" className="hidden" onChange={onFileChange} />
        </label>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {activeTab === 'takeoff' && (
          <>
            <Canvas file={file} />
            <TakeoffSidebar />
          </>
        )}
        
        {activeTab === 'setup' && (
          <div className="w-full h-full">
            <AssemblyBuilder />
          </div>
        )}

        {activeTab === 'bom' && (
          <div className="w-full h-full p-8 overflow-auto">
             <div className="max-w-4xl mx-auto bg-white shadow rounded-lg p-6">
                <h2 className="text-2xl font-bold mb-6">Material List</h2>
                
                {itemSets.map(set => {
                   // Filter BOM for just this set
                   const setLines = bom.filter(l => l.sourceItemSet === set.name);
                   if (setLines.length === 0) return null;

                   return (
                     <div key={set.id} className="mb-8">
                        <h3 className="font-bold text-lg border-b pb-2 mb-2 bg-gray-50 p-2">{set.name}</h3>
                        <table className="w-full text-sm">
                           <thead>
                              <tr className="text-left text-gray-500">
                                 {/* UPDATED COLUMN ORDER */}
                                 <th className="pb-2 w-32">SKU</th>
                                 <th className="pb-2">Material Name</th>
                                 <th className="pb-2 w-20 text-center">UOM</th>
                                 <th className="pb-2 text-right">Qty</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y">
                              {setLines.map((line, idx) => (
                                 <tr key={idx}>
                                    {/* UPDATED CELL ORDER */}
                                    <td className="py-2 text-gray-500">{line.sku}</td>
                                    <td className="py-2 font-medium">{line.name}</td>
                                    <td className="py-2 text-center text-gray-500">{line.uom}</td>
                                    <td className="py-2 text-right font-mono font-bold">{line.quantity}</td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                     </div>
                   );
                })}

                {bom.length === 0 && <div className="text-center text-gray-400 py-10">No materials generated yet.</div>}
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;