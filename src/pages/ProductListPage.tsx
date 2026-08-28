import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { productApi } from '../api/product.api.ts';
import { categoryApi } from '../api/category.api.ts';
import { getApiErrorMessage } from '../api/api-client.ts';
import type { Product } from '../types/product.types.ts';
import type { Category } from '../types/category.types.ts';

export const ProductListPage: React.FC = () => {
  const navigate = useNavigate();

  // Categories state
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState<boolean>(true);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);

  // Products state
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Race condition & debounce refs
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRequestIdRef = useRef<number>(0);

  // Load initial categories on mount
  useEffect(() => {
    let isMounted = true;

    const loadInitialCategories = async () => {
      try {
        const data = await categoryApi.listCategories();
        if (isMounted) {
          setCategories(data);
        }
      } catch (err: unknown) {
        console.error('Failed to load categories', err);
      } finally {
        if (isMounted) {
          setCategoriesLoading(false);
        }
      }
    };

    loadInitialCategories();

    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch products with search query and category filter
  const fetchProducts = useCallback(
    async (query: string, categoryId: number | null) => {
      const requestId = ++activeRequestIdRef.current;
      setProductsLoading(true);
      setError(null);

      try {
        let data: Product[];
        const trimmedQuery = query.trim();

        if (trimmedQuery) {
          data = await productApi.searchProducts(trimmedQuery, categoryId ?? undefined);
        } else {
          data = await productApi.listProducts(categoryId ?? undefined);
        }

        // Only update state if this is the latest request
        if (requestId === activeRequestIdRef.current) {
          setProducts(data);
        }
      } catch (err: unknown) {
        if (requestId === activeRequestIdRef.current) {
          setError(getApiErrorMessage(err, 'Failed to load products.'));
        }
      } finally {
        if (requestId === activeRequestIdRef.current) {
          setProductsLoading(false);
        }
      }
    },
    []
  );

  // Trigger initial product load and reload when selected category changes
  useEffect(() => {
    let isMounted = true;
    const requestId = ++activeRequestIdRef.current;

    const loadProductsForCategory = async () => {
      try {
        let data: Product[];
        const trimmedQuery = searchQuery.trim();

        if (trimmedQuery) {
          data = await productApi.searchProducts(trimmedQuery, selectedCategoryId ?? undefined);
        } else {
          data = await productApi.listProducts(selectedCategoryId ?? undefined);
        }

        if (isMounted && requestId === activeRequestIdRef.current) {
          setProducts(data);
        }
      } catch (err: unknown) {
        if (isMounted && requestId === activeRequestIdRef.current) {
          setError(getApiErrorMessage(err, 'Failed to load products.'));
        }
      } finally {
        if (isMounted && requestId === activeRequestIdRef.current) {
          setProductsLoading(false);
        }
      }
    };

    loadProductsForCategory();

    return () => {
      isMounted = false;
    };
  }, [selectedCategoryId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectCategory = (catId: number | null) => {
    if (selectedCategoryId === catId) return;
    setProductsLoading(true);
    setSelectedCategoryId(catId);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      fetchProducts(value, selectedCategoryId);
    }, 300);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    fetchProducts('', selectedCategoryId);
  };

  const handleRefresh = async () => {
    setProductsLoading(true);
    try {
      const [cats, prods] = await Promise.all([
        categoryApi.listCategories(),
        searchQuery.trim()
          ? productApi.searchProducts(searchQuery.trim(), selectedCategoryId ?? undefined)
          : productApi.listProducts(selectedCategoryId ?? undefined),
      ]);
      setCategories(cats);
      setProducts(prods);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to refresh product list.'));
    } finally {
      setProductsLoading(false);
    }
  };

  const selectedCategoryObj = categories.find((c) => c.id === selectedCategoryId);

  return (
    <div className="product-list-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h2 className="page-title">Products Management</h2>
          <span className="page-subtitle">
            {selectedCategoryObj
              ? `Category: ${selectedCategoryObj.categoryName} ${selectedCategoryObj.tamilName ? `(${selectedCategoryObj.tamilName})` : ''}`
              : 'All Categories catalog, retail/function rates, and inventory status'}
          </span>
        </div>
        <div className="page-header-actions">
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => navigate('/admin/categories')}
            title="Manage product categories taxonomy"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
            Manage Categories
          </button>
          <button
            type="button"
            className="btn btn-outline btn-refresh"
            onClick={handleRefresh}
            disabled={productsLoading || categoriesLoading}
            title="Refresh product list"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            Refresh
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/admin/products/new')}
          >
            + Add Product
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error alert-dismissible">
          <span>{error}</span>
          <button type="button" className="btn btn-sm btn-outline" onClick={handleRefresh}>
            Retry
          </button>
        </div>
      )}

      {/* Split Layout: Categories Sidebar + Products Main Area */}
      <div className="product-split-layout">
        {/* Left Category Selector Sidebar */}
        <aside className="category-sidebar" aria-label="Categories Selector">
          <div className="category-sidebar-header">
            <h3 className="category-sidebar-title">Categories</h3>
            <span className="category-sidebar-count">
              {categories.length} total
            </span>
          </div>

          <div className="category-list-nav" role="tablist">
            <button
              type="button"
              className={`category-nav-item ${selectedCategoryId === null ? 'category-nav-item-active' : ''}`}
              onClick={() => handleSelectCategory(null)}
              role="tab"
              aria-selected={selectedCategoryId === null}
            >
              <div className="category-nav-content">
                <span className="category-nav-name">All Products</span>
              </div>
              {selectedCategoryId === null && <span className="category-active-indicator" aria-hidden="true" />}
            </button>

            {categoriesLoading ? (
              <div className="category-sidebar-loading">
                <div className="auth-spinner" style={{ width: '20px', height: '20px' }}></div>
                <span>Loading categories...</span>
              </div>
            ) : categories.length === 0 ? (
              <div className="category-sidebar-empty">
                <p>No categories created yet.</p>
                <button
                  type="button"
                  className="link-button"
                  onClick={() => navigate('/admin/categories')}
                >
                  + Add Category
                </button>
              </div>
            ) : (
              categories.map((cat) => {
                const isSelected = selectedCategoryId === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    className={`category-nav-item ${isSelected ? 'category-nav-item-active' : ''} ${!cat.active ? 'category-nav-item-inactive' : ''}`}
                    onClick={() => handleSelectCategory(cat.id)}
                    role="tab"
                    aria-selected={isSelected}
                    title={!cat.active ? `${cat.categoryName} (Inactive)` : cat.categoryName}
                  >
                    <div className="category-nav-content">
                      <div className="category-nav-names-row">
                        <span className="category-nav-name">{cat.categoryName}</span>
                        {!cat.active && (
                          <span className="category-inactive-tag">Inactive</span>
                        )}
                      </div>
                      {cat.tamilName && (
                        <span className="category-nav-tamil">{cat.tamilName}</span>
                      )}
                    </div>
                    {isSelected && <span className="category-active-indicator" aria-hidden="true" />}
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Right Products Content Area */}
        <section className="product-table-area">
          <div className="table-toolbar">
            <div className="search-box">
              <span className="search-icon" aria-hidden="true">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
              <input
                type="text"
                className="search-input"
                placeholder={
                  selectedCategoryObj
                    ? `Search in ${selectedCategoryObj.categoryName}...`
                    : 'Search by product code, name, Tamil name, or barcode...'
                }
                value={searchQuery}
                onChange={handleSearchChange}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={handleClearSearch}
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
            <div className="toolbar-info">
              {!productsLoading && (
                <span className="count-badge">
                  {products.length} {products.length === 1 ? 'product' : 'products'}
                  {selectedCategoryObj && ` in ${selectedCategoryObj.categoryName}`}
                </span>
              )}
            </div>
          </div>

          <div className="data-table-container">
            {productsLoading ? (
              <div className="table-loading-state">
                <div className="auth-spinner"></div>
                <p>Loading products...</p>
              </div>
            ) : products.length === 0 ? (
              <div className="table-empty-state">
                <div className="empty-icon-box" aria-hidden="true">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                    <line x1="12" y1="22.08" x2="12" y2="12" />
                  </svg>
                </div>
                <h3>No products found</h3>
                {searchQuery ? (
                  <p>
                    No products match &ldquo;<strong>{searchQuery}</strong>&rdquo;
                    {selectedCategoryObj ? ` in category "${selectedCategoryObj.categoryName}"` : ''}. Try another search or{' '}
                    <button type="button" className="link-button" onClick={handleClearSearch}>
                      clear search
                    </button>
                    .
                  </p>
                ) : selectedCategoryObj ? (
                  <p>
                    No products found in category &ldquo;<strong>{selectedCategoryObj.categoryName}</strong>&rdquo;.{' '}
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => navigate('/admin/products/new')}
                    >
                      + Add Product to this category
                    </button>
                  </p>
                ) : (
                  <p>
                    Get started by adding your first product to the inventory.{' '}
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => navigate('/admin/products/new')}
                    >
                      Add Product
                    </button>
                  </p>
                )}
              </div>
            ) : (
              <table className="data-table product-data-table">
                <thead>
                  <tr>
                    <th className="th-code">Code</th>
                    <th className="th-barcode">Barcode</th>
                    <th className="th-name">Product Name</th>
                    <th className="th-tamil">Tamil Name</th>
                    {selectedCategoryId === null && <th className="th-category">Category</th>}
                    <th className="th-unit">Unit</th>
                    <th className="th-rate text-right" title="Maximum Retail Price">MRP</th>
                    <th className="th-rate text-right" title="Cost / Purchase price (Not for billing)">Cost</th>
                    <th className="th-rate text-right" title="Normal Selling Rate">Normal</th>
                    <th className="th-rate text-right" title="Retail Customer Rate">Retail</th>
                    <th className="th-rate text-right" title="Function / Bulk Rate">Function</th>
                    <th className="th-stock text-right">Stock</th>
                    <th className="th-status text-center">Status</th>
                    <th className="th-action th-action-sticky text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id} className={!product.active ? 'row-inactive' : ''}>
                      <td className="td-code font-mono font-semibold">{product.productCode}</td>
                      <td className="td-barcode font-mono text-muted" title={product.barcode || 'No barcode'}>
                        {product.barcode || '—'}
                      </td>
                      <td className="td-name font-medium">{product.productName}</td>
                      <td className="td-tamil tamil-text text-muted">{product.tamilName || '—'}</td>
                      {selectedCategoryId === null && (
                        <td className="td-category">
                          <span className="category-badge">
                            {product.category?.categoryName || '—'}
                            {product.category && !product.category.active && (
                              <span className="badge-inactive-dot" title="Category is inactive"> •</span>
                            )}
                          </span>
                        </td>
                      )}
                      <td className="td-unit">
                        <span className="unit-badge">{product.unit}</span>
                      </td>
                      <td className="td-rate text-right font-mono font-semibold">₹{product.mrpRate}</td>
                      <td className="td-rate text-right font-mono text-cost">₹{product.originalRate}</td>
                      <td className="td-rate text-right font-mono font-semibold">₹{product.normalRate}</td>
                      <td className="td-rate text-right font-mono">₹{product.retailRate}</td>
                      <td className="td-rate text-right font-mono">₹{product.functionRate}</td>
                      <td className="td-stock text-right font-mono font-semibold">
                        {product.currentStock} <span className="stock-unit">{product.unit}</span>
                      </td>
                      <td className="td-status text-center">
                        <span className={`status-badge ${product.active ? 'status-active' : 'status-inactive'}`}>
                          {product.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="td-action td-action-sticky text-center">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline"
                          onClick={() => navigate(`/admin/products/${product.id}/edit`)}
                          title={`Edit ${product.productName}`}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
