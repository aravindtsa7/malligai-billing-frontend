import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext.tsx';
import { useAuth } from './auth/useAuth.ts';
import { ProtectedRoute } from './auth/ProtectedRoute.tsx';
import { AppLayout } from './layouts/AppLayout.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { AdminDashboardPage } from './pages/AdminDashboardPage.tsx';
import { SalesmanDashboardPage } from './pages/SalesmanDashboardPage.tsx';
import { ProductListPage } from './pages/ProductListPage.tsx';
import { ProductFormPage } from './pages/ProductFormPage.tsx';
import { CategoryMasterPage } from './pages/CategoryMasterPage.tsx';
import { StockManagementPage } from './pages/StockManagementPage.tsx';
import { BillingPage } from './pages/BillingPage.tsx';
import { BillHistoryPage } from './pages/BillHistoryPage.tsx';
import { BillDetailPage } from './pages/BillDetailPage.tsx';
import { SalesmanManagementPage } from './pages/SalesmanManagementPage.tsx';
import { ReceiptSettingsPage } from './pages/ReceiptSettingsPage.tsx';
import { NotFoundPage } from './pages/NotFoundPage.tsx';

const RootRedirect: React.FC = () => {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="auth-loading-screen">
        <div className="auth-spinner"></div>
        <p>Loading application...</p>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === 'ADMIN') {
    return <Navigate to="/admin" replace />;
  }

  if (user.role === 'SALESMAN') {
    return <Navigate to="/salesman" replace />;
  }

  return <Navigate to="/login" replace />;
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<LoginPage />} />

          {/* Protected ADMIN routes */}
          <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
            <Route element={<AppLayout />}>
              <Route path="/admin" element={<AdminDashboardPage />} />
              <Route path="/admin/categories" element={<CategoryMasterPage />} />
              <Route path="/admin/products" element={<ProductListPage />} />
              <Route path="/admin/products/new" element={<ProductFormPage />} />
              <Route path="/admin/products/:id/edit" element={<ProductFormPage />} />
              <Route path="/admin/stock" element={<StockManagementPage />} />
              <Route path="/admin/salesmen" element={<SalesmanManagementPage />} />
              <Route path="/admin/receipt-settings" element={<ReceiptSettingsPage />} />
            </Route>
          </Route>

          {/* Protected SALESMAN routes */}
          <Route element={<ProtectedRoute allowedRoles={['SALESMAN']} />}>
            <Route element={<AppLayout />}>
              <Route path="/salesman" element={<SalesmanDashboardPage />} />
            </Route>
          </Route>

          {/* Shared protected BILLING & BILL HISTORY routes for ADMIN and SALESMAN */}
          <Route element={<ProtectedRoute allowedRoles={['ADMIN', 'SALESMAN']} />}>
            <Route element={<AppLayout />}>
              <Route path="/billing" element={<BillingPage />} />
              <Route path="/bills" element={<BillHistoryPage />} />
              <Route path="/bills/:id" element={<BillDetailPage />} />
            </Route>
          </Route>

          {/* Catch-all 404 route */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
