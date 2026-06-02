'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { productsApi } from '@/lib/api/products';
import { Product } from '@/types';

interface CategorySelectorProps {
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
}

export default function CategorySelector({
  selectedCategory,
  onCategoryChange,
}: CategorySelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  // Get ALL unique categories by fetching all products through pagination
  const { data: allCategoriesData, isLoading } = useQuery({
    queryKey: ['all-categories'],
    queryFn: async () => {
      const allCategories = new Set<string>();
      let currentPage = 1;
      let hasMore = true;
      const maxPages = 100; // Safety limit
      
      while (hasMore && currentPage <= maxPages) {
        const response = await productsApi.getAll({ 
          page: currentPage, 
          page_size: 1000 // Maximum page size
        });
        
        // Extract categories from this page
        response.results.forEach((product: Product) => {
          if (product.category && product.category.trim()) {
            allCategories.add(product.category.trim());
          }
        });
        
        // Check if there are more pages
        hasMore = !!response.next;
        currentPage++;
        
        // If no more pages, break
        if (!hasMore || response.results.length === 0) {
          break;
        }
      }
      
      return Array.from(allCategories).sort();
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const categories = allCategoriesData || [];

  // Filter categories based on search
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;
    const query = searchQuery.toLowerCase().trim();
    return categories.filter((cat) => cat.toLowerCase().includes(query));
  }, [categories, searchQuery]);

  const handleCategorySelect = (category: string) => {
    onCategoryChange(category);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div className="relative">
      <label className="form-label">
        Category <span className="text-red-500">*</span>
      </label>
      <div className="relative">
        <input
          type="text"
          placeholder="Select or search category..."
          value={isOpen ? searchQuery : (selectedCategory || '')}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="w-full"
        />
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <svg 
            className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {/* Dropdown */}
        {isOpen && (
          <>
            {/* Invisible overlay to detect outside clicks */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => {
                setIsOpen(false);
                setSearchQuery('');
              }}
              style={{ backgroundColor: 'transparent' }}
            />
            <div className="dropdown-container absolute z-50 w-full mt-1 max-h-60 overflow-hidden">
            {isLoading ? (
              <div className="px-4 py-3 text-sm text-center text-muted-foreground">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-[var(--brand-orange)] border-t-transparent rounded-full animate-spin"></div>
                  <span>Loading categories...</span>
                </div>
              </div>
            ) : filteredCategories.length === 0 ? (
              <div className="px-4 py-3 text-sm text-center text-muted-foreground">
                {searchQuery ? `No categories found for "${searchQuery}"` : 'No categories available'}
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto">
                {filteredCategories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => handleCategorySelect(category)}
                    className={`dropdown-item w-full text-left ${
                      selectedCategory === category ? 'selected' : ''
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            )}
          </div>
          </>
        )}
      </div>
      
    </div>
  );
}

