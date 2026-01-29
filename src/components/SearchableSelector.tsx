import React, {useEffect, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {ChevronDown, ChevronRight, X} from 'lucide-react';

interface SelectableItem {
    id: string;
    name: string;
    category: string;
    secondaryText?: string;
}

interface SearchableSelectorProps {
    items: SelectableItem[];
    value: string;
    onChange: (id: string) => void;
    placeholder?: string;
    className?: string;
}

export const SearchableSelector: React.FC<SearchableSelectorProps> = ({
                                                                          items,
                                                                          value,
                                                                          onChange,
                                                                          placeholder = "Type to search...",
                                                                          className = ""
                                                                      }) => {
    const [inputValue, setInputValue] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
    // Added maxHeight to state
    const [dropdownPosition, setDropdownPosition] = useState({top: 0, left: 0, width: 0, maxHeight: 320});
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const selectedItem = items.find(item => item.id === value);

    useEffect(() => {
        if (!isOpen || !containerRef.current) return;

        const updatePosition = () => {
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                const viewportHeight = window.innerHeight;
                // Calculate space below the input, leaving 10px padding
                const spaceBelow = viewportHeight - rect.bottom - 10;

                setDropdownPosition({
                    top: rect.bottom + 4,
                    left: rect.left,
                    width: rect.width,
                    // Constraint height: Max 320px, Min 100px, or available space
                    maxHeight: Math.min(320, Math.max(100, spaceBelow))
                });
            }
        };

        updatePosition();

        const handleScroll = () => updatePosition();
        const handleResize = () => updatePosition();

        window.addEventListener('scroll', handleScroll, true);
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('scroll', handleScroll, true);
            window.removeEventListener('resize', handleResize);
        };
    }, [isOpen]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(event.target as Node) &&
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
                if (!inputValue && !selectedItem) {
                    setInputValue('');
                } else if (selectedItem && !inputValue) {
                    setInputValue('');
                }
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [inputValue, selectedItem]);

    const filteredItems = useMemo(() => {
        if (!inputValue) return items;
        const term = inputValue.toLowerCase();
        return items.filter(item =>
            item.name.toLowerCase().includes(term) ||
            item.category.toLowerCase().includes(term) ||
            item.secondaryText?.toLowerCase().includes(term)
        );
    }, [items, inputValue]);

    const groupedItems = useMemo(() => {
        const groups: Record<string, SelectableItem[]> = {};
        filteredItems.forEach(item => {
            const cat = item.category || "Uncategorized";
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(item);
        });
        return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
    }, [filteredItems]);

    useEffect(() => {
        if (inputValue && groupedItems.length > 0) {
            const cats = new Set(groupedItems.map(([cat]) => cat));
            setExpandedCategories(cats);
        } else if (!inputValue) {
            setExpandedCategories(new Set());
        }
    }, [inputValue, groupedItems]);

    const toggleCategory = (category: string) => {
        setExpandedCategories(prev => {
            const next = new Set(prev);
            if (next.has(category)) {
                next.delete(category);
            } else {
                next.add(category);
            }
            return next;
        });
    };

    const handleSelect = (item: SelectableItem) => {
        onChange(item.id);
        setInputValue('');
        setIsOpen(false);
    };

    const handleClear = () => {
        onChange('');
        setInputValue('');
        setIsOpen(false);
        inputRef.current?.focus();
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setInputValue(newValue);
        if (selectedItem) {
            onChange('');
        }
        setIsOpen(true);
    };

    const handleInputFocus = () => {
        setIsOpen(true);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && inputValue) {
            const exactMatch = filteredItems.find(item =>
                item.secondaryText?.toLowerCase() === inputValue.toLowerCase() ||
                item.name.toLowerCase() === inputValue.toLowerCase()
            );
            if (exactMatch) {
                handleSelect(exactMatch);
            }
        }
    };

    const displayValue = selectedItem && !inputValue
        ? `${selectedItem.secondaryText ? selectedItem.secondaryText + ' - ' : ''}${selectedItem.name}`
        : inputValue;

    const dropdownContent = isOpen && filteredItems.length > 0 && (
        <div
            ref={dropdownRef}
            style={{
                position: 'fixed',
                top: `${dropdownPosition.top}px`,
                left: `${dropdownPosition.left}px`,
                width: `${dropdownPosition.width}px`,
                maxHeight: `${dropdownPosition.maxHeight}px`, // Applied calculated max-height
                zIndex: 9999
            }}
            className="bg-white border rounded shadow-lg overflow-y-auto" // Removed fixed max-h-80 class
        >
            {groupedItems.length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-400">No items found</div>
            ) : (
                groupedItems.map(([category, categoryItems]) => (
                    <div key={category} className="border-b last:border-b-0">
                        <div
                            className="p-2 bg-gray-50 font-semibold text-xs uppercase text-gray-600 flex items-center cursor-pointer hover:bg-gray-100 sticky top-0 z-10"
                            onClick={() => toggleCategory(category)}
                        >
                            {expandedCategories.has(category) ? (
                                <ChevronDown size={14}/>
                            ) : (
                                <ChevronRight size={14}/>
                            )}
                            <span className="ml-2">{category}</span>
                            <span className="ml-auto text-gray-400 font-normal">({categoryItems.length})</span>
                        </div>

                        {expandedCategories.has(category) && (
                            <div>
                                {categoryItems.map(item => (
                                    <div
                                        key={item.id}
                                        className={`p-2 px-4 cursor-pointer hover:bg-blue-50 text-sm transition-colors ${
                                            item.id === value ? 'bg-blue-100 font-medium' : ''
                                        }`}
                                        onClick={() => handleSelect(item)}
                                    >
                                        {item.secondaryText && (
                                            <span
                                                className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded mr-2 text-gray-600">
                        {item.secondaryText}
                      </span>
                                        )}
                                        <span className={item.id === value ? 'text-blue-700' : 'text-gray-700'}>
                      {item.name}
                    </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))
            )}
        </div>
    );

    return (
        <>
            <div ref={containerRef} className={`relative ${className}`}>
                <div className="relative">
                    <input
                        ref={inputRef}
                        type="text"
                        className="border rounded bg-white p-2 text-sm w-full pr-8 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none"
                        placeholder={placeholder}
                        value={displayValue}
                        onChange={handleInputChange}
                        onFocus={handleInputFocus}
                        onKeyDown={handleKeyDown}
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        {(selectedItem || inputValue) && (
                            <button
                                onClick={handleClear}
                                className="p-0.5 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-600"
                                type="button"
                            >
                                <X size={14}/>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {dropdownContent && createPortal(dropdownContent, document.body)}
        </>
    );
};