export interface SearchOptions {
    fuzzy?: boolean;
    caseSensitive?: boolean;
    fields?: string[];
    maxResults?: number;
}

export interface FilterCriteria {
    field: string;
    operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'range';
    value: any;
}

export class AdvancedSearch<T> {
    private data: T[] = [];
    private searchIndex: Map<string, Set<number>> = new Map();
    private fieldGetters: Map<string, (item: T) => string> = new Map();

    constructor(data: T[], fieldMappings: Record<string, (item: T) => string>) {
        this.data = data;
        Object.entries(fieldMappings).forEach(([field, getter]) => {
            this.fieldGetters.set(field, getter);
        });
        this.buildSearchIndex();
    }

    search(query: string, options: SearchOptions = {}): T[] {
        if (!query.trim()) return this.data;

        const {
            fuzzy = true,
            caseSensitive = false,
            fields = Array.from(this.fieldGetters.keys()),
            maxResults = 100
        } = options;

        const searchQuery = caseSensitive ? query : query.toLowerCase();
        const results = new Set<number>();

        // Exact matches first
        const exactMatches = this.findExactMatches(searchQuery, fields);
        exactMatches.forEach(idx => results.add(idx));

        // Fuzzy matches if enabled
        if (fuzzy && results.size < maxResults) {
            const fuzzyMatches = this.findFuzzyMatches(searchQuery);
            fuzzyMatches.forEach(idx => {
                if (results.size < maxResults) results.add(idx);
            });
        }

        return Array.from(results).slice(0, maxResults).map(idx => this.data[idx]);
    }

    filter(criteria: FilterCriteria[]): T[] {
        return this.data.filter(item => {
            return criteria.every(criterion => {
                const getter = this.fieldGetters.get(criterion.field);
                if (!getter) return true;

                const value = getter(item);
                return this.applyCriterion(value, criterion);
            });
        });
    }

    searchAndFilter(query: string, criteria: FilterCriteria[], options: SearchOptions = {}): T[] {
        let results = this.data;

        if (criteria.length > 0) {
            results = this.filter(criteria);
        }

        if (query.trim()) {
            // Create temporary search instance with filtered data
            const tempSearch = new AdvancedSearch(results, Object.fromEntries(this.fieldGetters));
            return tempSearch.search(query, options);
        }

        return results.slice(0, options.maxResults || 100);
    }

    updateData(newData: T[]): void {
        this.data = newData;
        this.buildSearchIndex();
    }

    private buildSearchIndex(): void {
        this.searchIndex.clear();

        this.data.forEach((item, index) => {
            this.fieldGetters.forEach((getter) => {
                const value = getter(item).toLowerCase();
                const words = value.split(/\s+/);

                words.forEach(word => {
                    if (!this.searchIndex.has(word)) {
                        this.searchIndex.set(word, new Set());
                    }
                    this.searchIndex.get(word)!.add(index);
                });
            });
        });
    }

    private findExactMatches(query: string, fields: string[]): number[] {
        const results = new Set<number>();

        this.data.forEach((item, index) => {
            fields.forEach(() => {
                const getter = this.fieldGetters.get(fields[0]);
                if (getter) {
                    const value = getter(item).toLowerCase();
                    if (value.includes(query)) {
                        results.add(index);
                    }
                }
            });
        });

        return Array.from(results);
    }

    private findFuzzyMatches(query: string): number[] {
        const results = new Set<number>();
        const queryWords = query.split(/\s+/);

        queryWords.forEach(word => {
            // Find similar words in index
            this.searchIndex.forEach((indices, indexedWord) => {
                if (this.calculateSimilarity(word, indexedWord) > 0.7) {
                    indices.forEach(idx => results.add(idx));
                }
            });
        });

        return Array.from(results);
    }

    private calculateSimilarity(str1: string, str2: string): number {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;

        if (longer.length === 0) return 1.0;

        const distance = this.levenshteinDistance(longer, shorter);
        return (longer.length - distance) / longer.length;
    }

    private levenshteinDistance(str1: string, str2: string): number {
        const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

        for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
        for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

        for (let j = 1; j <= str2.length; j++) {
            for (let i = 1; i <= str1.length; i++) {
                const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[j][i] = Math.min(
                    matrix[j][i - 1] + 1,
                    matrix[j - 1][i] + 1,
                    matrix[j - 1][i - 1] + indicator
                );
            }
        }

        return matrix[str2.length][str1.length];
    }

    private applyCriterion(value: string, criterion: FilterCriteria): boolean {
        const {operator, value: criterionValue} = criterion;

        switch (operator) {
            case 'equals':
                return value.toLowerCase() === criterionValue.toLowerCase();
            case 'contains':
                return value.toLowerCase().includes(criterionValue.toLowerCase());
            case 'startsWith':
                return value.toLowerCase().startsWith(criterionValue.toLowerCase());
            case 'endsWith':
                return value.toLowerCase().endsWith(criterionValue.toLowerCase());
            case 'range':
                const numValue = parseFloat(value);
                return numValue >= criterionValue.min && numValue <= criterionValue.max;
            default:
                return true;
        }
    }
}

// Auto-complete functionality
export class AutoComplete<T> {
    private search: AdvancedSearch<T>;
    private cache: Map<string, T[]> = new Map();

    constructor(data: T[], fieldMappings: Record<string, (item: T) => string>) {
        this.search = new AdvancedSearch(data, fieldMappings);
    }

    getSuggestions(query: string, maxSuggestions: number = 10): T[] {
        if (this.cache.has(query)) {
            return this.cache.get(query)!.slice(0, maxSuggestions);
        }

        const suggestions = this.search.search(query, {maxResults: maxSuggestions});
        this.cache.set(query, suggestions);

        // Limit cache size
        if (this.cache.size > 100) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey) this.cache.delete(firstKey);
        }

        return suggestions;
    }

    updateData(newData: T[]): void {
        this.search.updateData(newData);
        this.cache.clear();
    }
}