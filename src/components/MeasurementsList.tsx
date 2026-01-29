import React from 'react';
import { useStore } from '../store';
import { Settings, Eye, EyeOff, Trash2 } from 'lucide-react';
import { Measurement } from '../types';

interface MeasurementItemProps {
    measurement: Measurement;
    isActive: boolean;
}

const MeasurementItem: React.FC<MeasurementItemProps> = ({ measurement, isActive }) => {
    const { setActiveMeasurement, updateMeasurement, deleteMeasurement } = useStore();

    const handleItemClick = (e: React.MouseEvent) => {
        // Don't trigger if clicking on action buttons
        if ((e.target as HTMLElement).closest('button')) {
            console.log('Clicked a button, preventing item selection.', e.target);
            return;
        }
        console.log('Setting active measurement to:', measurement.id, 'Event target:', e.target);
        setActiveMeasurement(measurement.id);
    };

    const handleToggleVisibility = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent parent click handler
        updateMeasurement(measurement.id, { hidden: !measurement.hidden });
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent parent click handler
        deleteMeasurement(measurement.id);
    };

    const handleSettingsClick = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent parent click handler
        setActiveMeasurement(measurement.id);
    };

    return (
        <div
            className={`flex items-center justify-between p-3 border rounded cursor-pointer transition-colors ${
                isActive 
                    ? 'bg-blue-50 border-blue-200 shadow-sm' 
                    : 'bg-white hover:bg-gray-50 border-gray-200'
            }`}
            onClick={handleItemClick}
        >
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium truncate ${
                        isActive ? 'text-blue-700' : 'text-gray-800'
                    }`}>
                        {measurement.name}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                        measurement.type === 'shape' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-blue-100 text-blue-700'
                    }`}>
                        {measurement.type}
                    </span>
                </div>
                {measurement.group && (
                    <div className="text-xs text-gray-500 mt-1">
                        Group: {measurement.group}
                    </div>
                )}
                {measurement.tags.length > 0 && (
                    <div className="flex gap-1 mt-1">
                        {measurement.tags.map((tag, index) => (
                            <span key={index} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                                {tag}
                            </span>
                        ))}
                    </div>
                )}
            </div>
            
            <div className="flex items-center gap-1 ml-2">
                <button
                    onClick={handleToggleVisibility}
                    className={`p-1.5 rounded hover:bg-gray-100 transition-colors ${
                        measurement.hidden ? 'text-gray-400' : 'text-gray-600'
                    }`}
                    title={measurement.hidden ? 'Show measurement' : 'Hide measurement'}
                >
                    {measurement.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                
                <button
                    onClick={handleSettingsClick}
                    className={`p-1.5 rounded transition-colors ${
                        isActive 
                            ? 'bg-blue-100 text-blue-600' 
                            : 'hover:bg-gray-100 text-gray-600'
                    }`}
                    title="Edit properties"
                >
                    <Settings size={14} />
                </button>
                
                <button
                    onClick={handleDelete}
                    className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                    title="Delete measurement"
                >
                    <Trash2 size={14} />
                </button>
            </div>
        </div>
    );
};

const MeasurementsList: React.FC = () => {
    const { measurements, activeMeasurementId, activePageIndex } = useStore();
    
    // Filter measurements for current page
    const currentPageMeasurements = measurements.filter(m => m.pageIndex === activePageIndex);
    
    if (currentPageMeasurements.length === 0) {
        return (
            <div className="p-4 text-center text-gray-400 text-sm">
                No measurements on this page
            </div>
        );
    }

    return (
        <div className="space-y-2 p-2">
            {currentPageMeasurements.map(measurement => (
                <MeasurementItem
                    key={measurement.id}
                    measurement={measurement}
                    isActive={activeMeasurementId === measurement.id}
                />
            ))}
        </div>
    );
};

export default MeasurementsList;