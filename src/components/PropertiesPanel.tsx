import React from 'react';
import { useStore } from '../store';
import { X, Tag, Folder } from 'lucide-react';

const PropertiesPanel: React.FC = () => {
    const { 
        measurements, 
        activeMeasurementId, 
        updateMeasurement, 
        setActiveMeasurement 
    } = useStore();

    console.log('PropertiesPanel: activeMeasurementId =', activeMeasurementId);
    const activeMeasurement = measurements.find(m => m.id === activeMeasurementId);
    console.log('PropertiesPanel: activeMeasurement found =', !!activeMeasurement);

    if (!activeMeasurement) {
        return (
            <div className="p-4 text-center text-gray-400">
                <div className="mb-2">
                    <Tag size={32} className="mx-auto opacity-20" />
                </div>
                <p className="text-sm">Select a measurement to edit its properties</p>
            </div>
        );
    }

    const handleNameChange = (name: string) => {
        updateMeasurement(activeMeasurement.id, { name });
    };

    const handleGroupChange = (group: string) => {
        updateMeasurement(activeMeasurement.id, { 
            group: group.trim() || undefined 
        });
    };

    const handleTagsChange = (tagsString: string) => {
        const tags = tagsString
            .split(',')
            .map(tag => tag.trim())
            .filter(tag => tag.length > 0);
        updateMeasurement(activeMeasurement.id, { tags });
    };

    const handleRotationChange = (rotation: number) => {
        updateMeasurement(activeMeasurement.id, { rotation });
    };

    const handleClose = () => {
        setActiveMeasurement(null);
    };

    return (
        <div className="bg-white border-l border-gray-200 w-80 flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="font-semibold text-gray-800">Properties</h3>
                <button
                    onClick={handleClose}
                    className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
                >
                    <X size={16} />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Basic Info */}
                <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">
                        Measurement Info
                    </label>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Name
                            </label>
                            <input
                                type="text"
                                value={activeMeasurement.name}
                                onChange={(e) => handleNameChange(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                placeholder="Enter measurement name"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Type
                            </label>
                            <div className={`inline-flex items-center px-3 py-2 rounded-md text-sm font-medium ${
                                activeMeasurement.type === 'shape'
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-blue-100 text-blue-700'
                            }`}>
                                {activeMeasurement.type === 'shape' ? 'Shape' : 'Line'}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Points
                            </label>
                            <div className="text-sm text-gray-600">
                                {activeMeasurement.points.length} points
                            </div>
                        </div>
                    </div>
                </div>

                {/* Grouping */}
                <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">
                        <Folder size={12} className="inline mr-1" />
                        Grouping
                    </label>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Group Name
                        </label>
                        <input
                            type="text"
                            value={activeMeasurement.group || ''}
                            onChange={(e) => handleGroupChange(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                            placeholder="Enter group name (optional)"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Group measurements together for combined calculations
                        </p>
                    </div>
                </div>

                {/* Tags */}
                <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">
                        <Tag size={12} className="inline mr-1" />
                        Tags
                    </label>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Tags (comma-separated)
                        </label>
                        <input
                            type="text"
                            value={activeMeasurement.tags.join(', ')}
                            onChange={(e) => handleTagsChange(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                            placeholder="foundation, exterior, etc."
                        />
                        {activeMeasurement.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                                {activeMeasurement.tags.map((tag, index) => (
                                    <span
                                        key={index}
                                        className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700"
                                    >
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Rotation (for shapes) */}
                {activeMeasurement.type === 'shape' && (
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">
                            Transform
                        </label>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Rotation (degrees)
                            </label>
                            <input
                                type="number"
                                value={activeMeasurement.rotation || 0}
                                onChange={(e) => handleRotationChange(parseFloat(e.target.value) || 0)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                placeholder="0"
                                step="1"
                                min="-360"
                                max="360"
                            />
                        </div>
                    </div>
                )}

                {/* Visibility */}
                <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">
                        Display
                    </label>
                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            id="visible"
                            checked={!activeMeasurement.hidden}
                            onChange={(e) => updateMeasurement(activeMeasurement.id, { 
                                hidden: !e.target.checked 
                            })}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="visible" className="ml-2 text-sm text-gray-700">
                            Visible on canvas
                        </label>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PropertiesPanel;