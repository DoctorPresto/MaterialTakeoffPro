import React, {useEffect, useRef, useState} from 'react';
import {Filter, Search, X} from 'lucide-react';
import {FilterCriteria} from '../utils/search';

interface AdvancedSearchBarProps {
    query: string;
    onQueryChange: (query: string) => void;
    filters: FilterCriteria[];
    onAddFilter: (filter: FilterCriteria) => void;
    onRemoveFilter: (index: number) => void;
    onClearFilters: () => void;
    suggestions: (query: string) => any[];
    placeholder?: string;
    filterFields: Array<{
        key: string;
        label: string;
        type: 'text' | 'number' | 'select';
        options?: Array<{ value: string; label: string }>;
    }>;
}

const AdvancedSearchBar: React.FC<AdvancedSearchBarProps> = ({
                                                                 query,
                                                                 onQueryChange,
                                                                 filters,
                                                                 onAddFilter,
                                                                 onRemoveFilter,
                                                                 onClearFilters,
                                                                 suggestions,
                                                                 placeholder = "Search...",
                                                                 filterFields
                                                             }) => {
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [showFilterMenu, setShowFilterMenu] = useState(false);
    const [currentSuggestions, setCurrentSuggestions] = useState<any[]>([]);
    const searchRef = useRef<HTMLInputElement>(null);
    const suggestionsRef = useRef<HTMLDivElement>(null);

    // Filter form state
    const [filterField, setFilterField] = useState('');
    const [filterOperator, setFilterOperator] = useState('contains');
    const [filterValue, setFilterValue] = useState('');

    useEffect(() => {
        if (query.length > 1) {
            const newSuggestions = suggestions(query);
            setCurrentSuggestions(newSuggestions);
            setShowSuggestions(newSuggestions.length > 0);
        } else {
            setShowSuggestions(false);
        }
    }, [query, suggestions]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleAddFilter = () => {
        if (filterField && filterValue) {
            const field = filterFields.find(f => f.key === filterField);
            if (field) {
                onAddFilter({
                    field: filterField,
                    operator: filterOperator as any,
                    value: field.type === 'number' ? parseFloat(filterValue) : filterValue
                });
                setFilterField('');
                setFilterValue('');
                setShowFilterMenu(false);
            }
        }
    };

    const getOperatorOptions = (fieldType: string) => {
        switch (fieldType) {
            case 'number':
                return [
                    {value: 'equals', label: 'Equals'},
                    {value: 'range', label: 'Range'}
                ];
            case 'select':
                return [
                    {value: 'equals', label: 'Equals'}
                ];
            default:
                return [
                    {value: 'contains', label: 'Contains'},
                    {value: 'equals', label: 'Equals'},
                    {value: 'startsWith', label: 'Starts with'},
                    {value: 'endsWith', label: 'Ends with'}
                ];
        }
    };

    const selectedField = filterFields.find(f => f.key === filterField);

    return (
        <div className="relative w-full">
            {/* Search Input */}
            <div className="relative flex items-center">
                <div className="relative flex-1">
                    <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"/>
                    <input
                        ref={searchRef}
                        type="text"
                        value={query}
                        onChange={(e) => onQueryChange(e.target.value)}
                        onFocus={() => query.length > 1 && setShowSuggestions(true)}
                        placeholder={placeholder}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                </div>

                <button
                    onClick={() => setShowFilterMenu(!showFilterMenu)}
                    className={`px-4 py-2 border-t border-r border-b border-gray-300 bg-gray-50 hover:bg-gray-100 transition-colors ${showFilterMenu ? 'bg-blue-50 border-blue-300' : ''}`}
                >
                    <Filter size={18} className={showFilterMenu ? 'text-blue-600' : 'text-gray-600'}/>
                </button>

                {(query || filters.length > 0) && (
                    <button
                        onClick={() => {
                            onQueryChange('');
                            onClearFilters();
                        }}
                        className="px-3 py-2 border-t border-r border-b border-gray-300 rounded-r-lg bg-gray-50 hover:bg-gray-100 text-gray-600 hover:text-red-600 transition-colors"
                    >
                        <X size={18}/>
                    </button>
                )}
            </div>

            {/* Active Filters */}
            {filters.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                    {filters.map((filter, index) => {
                        const field = filterFields.find(f => f.key === filter.field);
                        return (
                            <span
                                key={index}
                                className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full"
                            >
                <span className="font-medium">{field?.label || filter.field}</span>
                <span className="text-blue-600">{filter.operator}</span>
                <span>"{filter.value}"</span>
                <button
                    onClick={() => onRemoveFilter(index)}
                    className="ml-1 hover:text-red-600"
                >
                  <X size={12}/>
                </button>
              </span>
                        );
                    })}
                </div>
            )}

            {/* Suggestions Dropdown */}
            {showSuggestions && (
                <div
                    ref={suggestionsRef}
                    className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto"
                >
                    {currentSuggestions.map((suggestion, index) => (
                        <div
                            key={index}
                            onClick={() => {
                                onQueryChange(suggestion.name || suggestion.sku || '');
                                setShowSuggestions(false);
                            }}
                            className="px-4 py-2 hover:bg-gray-100 cursor-pointer border-b last:border-b-0"
                        >
                            <div className="font-medium text-sm">{suggestion.name}</div>
                            {suggestion.sku && (
                                <div className="text-xs text-gray-500">{suggestion.sku}</div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Filter Menu */}
            {showFilterMenu && (
                <div
                    className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-4 w-80">
                    <h3 className="font-medium text-sm mb-3">Add Filter</h3>

                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Field</label>
                            <select
                                value={filterField}
                                onChange={(e) => setFilterField(e.target.value)}
                                className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                            >
                                <option value="">Select field...</option>
                                {filterFields.map(field => (
                                    <option key={field.key} value={field.key}>{field.label}</option>
                                ))}
                            </select>
                        </div>

                        {selectedField && (
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Operator</label>
                                <select
                                    value={filterOperator}
                                    onChange={(e) => setFilterOperator(e.target.value)}
                                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                                >
                                    {getOperatorOptions(selectedField.type).map(op => (
                                        <option key={op.value} value={op.value}>{op.label}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {selectedField && (
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Value</label>
                                {selectedField.type === 'select' ? (
                                    <select
                                        value={filterValue}
                                        onChange={(e) => setFilterValue(e.target.value)}
                                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                                    >
                                        <option value="">Select value...</option>
                                        {selectedField.options?.map(option => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        type={selectedField.type === 'number' ? 'number' : 'text'}
                                        value={filterValue}
                                        onChange={(e) => setFilterValue(e.target.value)}
                                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                                        placeholder={`Enter ${selectedField.label.toLowerCase()}...`}
                                    />
                                )}
                            </div>
                        )}

                        <div className="flex gap-2 pt-2">
                            <button
                                onClick={handleAddFilter}
                                disabled={!filterField || !filterValue}
                                className="flex-1 bg-blue-600 text-white px-3 py-1 rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700"
                            >
                                Add Filter
                            </button>
                            <button
                                onClick={() => setShowFilterMenu(false)}
                                className="px-3 py-1 border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdvancedSearchBar;