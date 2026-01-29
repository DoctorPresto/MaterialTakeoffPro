import {useCallback, useMemo, useState} from 'react';
import {AdvancedSearch, AutoComplete, FilterCriteria, SearchOptions} from '../utils/search';

export function useAdvancedSearch<T>(
    data: T[],
    fieldMappings: Record<string, (item: T) => string>,
    initialFilters: FilterCriteria[] = []
) {
    const [query, setQuery] = useState('');
    const [filters, setFilters] = useState<FilterCriteria[]>(initialFilters);
    const [searchOptions, setSearchOptions] = useState<SearchOptions>({
        fuzzy: true,
        caseSensitive: false,
        maxResults: 100
    });

    const searchEngine = useMemo(() => {
        return new AdvancedSearch(data, fieldMappings);
    }, [data, fieldMappings]);

    const autoComplete = useMemo(() => {
        return new AutoComplete(data, fieldMappings);
    }, [data, fieldMappings]);

    const results = useMemo(() => {
        if (!query && filters.length === 0) {
            return data.slice(0, searchOptions.maxResults || 100);
        }

        return searchEngine.searchAndFilter(query, filters, searchOptions);
    }, [searchEngine, query, filters, searchOptions, data]);

    const suggestions = useCallback((searchQuery: string, maxSuggestions: number = 5) => {
        return autoComplete.getSuggestions(searchQuery, maxSuggestions);
    }, [autoComplete]);

    const addFilter = useCallback((filter: FilterCriteria) => {
        setFilters(prev => [...prev, filter]);
    }, []);

    const removeFilter = useCallback((index: number) => {
        setFilters(prev => prev.filter((_, i) => i !== index));
    }, []);

    const clearFilters = useCallback(() => {
        setFilters([]);
    }, []);

    const updateSearchOptions = useCallback((options: Partial<SearchOptions>) => {
        setSearchOptions(prev => ({...prev, ...options}));
    }, []);

    return {
        query,
        setQuery,
        filters,
        addFilter,
        removeFilter,
        clearFilters,
        results,
        suggestions,
        searchOptions,
        updateSearchOptions,
        totalResults: results.length,
        hasFilters: filters.length > 0,
        hasQuery: query.trim().length > 0
    };
}