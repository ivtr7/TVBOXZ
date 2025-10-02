import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';

import { AppProvider } from './contexts/AuthContext';
import AdminApp from './pages/AdminApp';
import DeviceApp from './pages/DeviceApp';
import ClientApp from './pages/ClientApp';
import DeviceOnboarding from './components/DeviceOnboarding';
import TVBoxSetup from './pages/tvbox/TVBoxSetup';
import TVBoxDisplay from './pages/tvbox/TVBoxDisplay';
import './index.css';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

function App() {
  // Detectar tipo de dispositivo baseado na URL ou parâmetros
  const getAppType = () => {
    const params = new URLSearchParams(window.location.search);
    const path = window.location.pathname;
    
    if (path.includes('/admin') || params.get('type') === 'admin') {
      return 'admin';
    }
    if (path.includes('/device') || params.get('type') === 'device') {
      return 'device';
    }
    if (path.includes('/client') || params.get('type') === 'client') {
      return 'client';
    }
    if (path.includes('/tvbox') || params.get('type') === 'tvbox') {
      return 'tvbox';
    }
    
    // Default para admin se não especificado
    return 'admin';
  };

  const appType = getAppType();

  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <Router>
          <div className="min-h-screen bg-gray-100">
            <Routes>
            {/* Rota principal - redireciona baseado no tipo */}
            <Route 
              path="/" 
              element={
                appType === 'admin' ? <Navigate to="/admin" replace /> :
                appType === 'device' ? <Navigate to="/device" replace /> :
                appType === 'tvbox' ? <Navigate to="/tvbox/setup" replace /> :
                <Navigate to="/client" replace />
              } 
            />
            
            {/* Rotas do Admin - ACESSO LIVRE */}
            <Route path="/admin/*" element={<AdminApp />} />
            
            {/* Rotas do Device */}
            <Route path="/device" element={<DeviceApp />} />
            <Route path="/device/onboarding" element={<DeviceOnboarding />} />
            
            {/* Rotas do Client */}
            <Route path="/client/:deviceId" element={<ClientApp />} />
            
            {/* Rotas do TVBox */}
            <Route path="/tvbox/setup" element={<TVBoxSetup />} />
            <Route path="/tvbox/display" element={<TVBoxDisplay />} />
            
            {/* Rota de fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
        <Toaster position="top-right" />
      </Router>
    </AppProvider>
    </QueryClientProvider>
  );
}

export default App;