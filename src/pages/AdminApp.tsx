import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AdminLayout from '../components/admin/AdminLayout';
import AdminDashboard from './admin/AdminDashboard';
import DevicesPage from './admin/DevicesPage';
import MediaPage from './admin/MediaPage';
import AnnouncementsPage from './AnnouncementsPage';
import LoginPage from './admin/LoginPage';

// Componente para proteger rotas
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  return <>{children}</>;
};

const AdminApp: React.FC = () => {
  return (
    <Routes>
      {/* Rota de login (pública) */}
      <Route path="login" element={<LoginPage />} />
      
      {/* Rotas protegidas */}
      <Route path="/*" element={
        <ProtectedRoute>
          <AdminLayout>
            <Routes>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="devices" element={<DevicesPage />} />
              <Route path="media" element={<MediaPage />} />
              <Route path="announcements" element={<AnnouncementsPage />} />
            </Routes>
          </AdminLayout>
        </ProtectedRoute>
      } />
    </Routes>
  );
};

export default AdminApp;