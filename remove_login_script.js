#!/usr/bin/env node

/**
 * Script para remover todos os componentes relacionados ao login do sistema TVBOX
 * Este script remove:
 * - AuthContext e AuthProvider
 * - ProtectedRoute
 * - AdminLogin component
 * - Rotas de autenticação
 * - Middleware de autenticação no backend
 * - Referencias de login no código
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Iniciando remoção de componentes de login...');

// Arquivos para deletar completamente
const filesToDelete = [
  'src/contexts/AuthContext.tsx',
  'src/components/ProtectedRoute.tsx', 
  'src/pages/admin/AdminLogin.tsx',
  'backend/routes/auth.js',
  'backend/middleware/auth.js'
];

// Função para deletar arquivos
function deleteFiles() {
  console.log('\n📁 Deletando arquivos de autenticação...');
  
  filesToDelete.forEach(file => {
    const fullPath = path.join(process.cwd(), file);
    try {
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        console.log(`✅ Deletado: ${file}`);
      } else {
        console.log(`⚠️  Arquivo não encontrado: ${file}`);
      }
    } catch (error) {
      console.log(`❌ Erro ao deletar ${file}:`, error.message);
    }
  });
}

// Função para remover imports e referencias de auth
function removeAuthReferences() {
  console.log('\n🔧 Removendo referências de autenticação...');
  
  // App.tsx - remover AuthProvider
  const appPath = 'src/App.tsx';
  if (fs.existsSync(appPath)) {
    let appContent = fs.readFileSync(appPath, 'utf8');
    
    // Remover imports relacionados a auth
    appContent = appContent.replace(/import.*AuthProvider.*from.*[\r\n]+/g, '');
    appContent = appContent.replace(/import.*useAuth.*from.*[\r\n]+/g, '');
    
    // Remover AuthProvider wrapper
    appContent = appContent.replace(/<AuthProvider[^>]*>/g, '');
    appContent = appContent.replace(/<\/AuthProvider>/g, '');
    
    fs.writeFileSync(appPath, appContent);
    console.log('✅ App.tsx atualizado');
  }
  
  // AdminApp.tsx - remover ProtectedRoute
  const adminAppPath = 'src/pages/AdminApp.tsx';
  if (fs.existsSync(adminAppPath)) {
    let adminContent = fs.readFileSync(adminAppPath, 'utf8');
    
    // Remover imports de ProtectedRoute
    adminContent = adminContent.replace(/import.*ProtectedRoute.*from.*[\r\n]+/g, '');
    
    // Remover ProtectedRoute wrapper
    adminContent = adminContent.replace(/<ProtectedRoute[^>]*>/g, '');
    adminContent = adminContent.replace(/<\/ProtectedRoute>/g, '');
    
    fs.writeFileSync(adminAppPath, adminContent);
    console.log('✅ AdminApp.tsx atualizado');
  }
  
  // AdminLayout.tsx - remover referências de usuário
  const adminLayoutPath = 'src/components/admin/AdminLayout.tsx';
  if (fs.existsSync(adminLayoutPath)) {
    let layoutContent = fs.readFileSync(adminLayoutPath, 'utf8');
    
    // Remover imports de useAuth
    layoutContent = layoutContent.replace(/import.*useAuth.*from.*[\r\n]+/g, '');
    
    // Remover uso do useAuth
    layoutContent = layoutContent.replace(/const.*useAuth\(\);[\r\n]+/g, '');
    
    fs.writeFileSync(adminLayoutPath, layoutContent);
    console.log('✅ AdminLayout.tsx atualizado');
  }
  
  // api.ts - remover interceptors de auth
  const apiPath = 'src/utils/api.ts';
  if (fs.existsSync(apiPath)) {
    let apiContent = fs.readFileSync(apiPath, 'utf8');
    
    // Remover interceptor de request (token)
    apiContent = apiContent.replace(/\/\/ Interceptor para adicionar token[\s\S]*?\);[\r\n]+/g, '');
    
    // Remover interceptor de response (401)
    apiContent = apiContent.replace(/\/\/ Interceptor para tratar respostas[\s\S]*?\);[\r\n]+/g, '');
    
    // Remover authAPI
    apiContent = apiContent.replace(/\/\/ Funções de autenticação[\s\S]*?};[\r\n]+/g, '');
    
    fs.writeFileSync(apiPath, apiContent);
    console.log('✅ api.ts atualizado');
  }
}

// Função para atualizar server.js
function updateBackendServer() {
  console.log('\n🖥️  Atualizando servidor backend...');
  
  const serverPath = 'backend/server.js';
  if (fs.existsSync(serverPath)) {
    let serverContent = fs.readFileSync(serverPath, 'utf8');
    
    // Remover import de authRoutes
    serverContent = serverContent.replace(/import authRoutes from.*[\r\n]+/g, '');
    
    // Remover rota de auth
    serverContent = serverContent.replace(/app\.use\('\/api\/auth'.*[\r\n]+/g, '');
    
    fs.writeFileSync(serverPath, serverContent);
    console.log('✅ server.js atualizado');
  }
}

// Função para atualizar páginas que usam useAuth
function updatePagesWithAuth() {
  console.log('\n📄 Atualizando páginas que usam autenticação...');
  
  const pagesWithAuth = [
    'src/pages/admin/SettingsPage.tsx',
    'src/pages/admin/AdminDashboard.tsx'
  ];
  
  pagesWithAuth.forEach(pagePath => {
    if (fs.existsSync(pagePath)) {
      let pageContent = fs.readFileSync(pagePath, 'utf8');
      
      // Remover imports de useAuth
      pageContent = pageContent.replace(/import.*useAuth.*from.*[\r\n]+/g, '');
      
      // Remover uso do useAuth
      pageContent = pageContent.replace(/const.*useAuth\(\);[\r\n]+/g, '');
      
      // Remover referências ao user
      pageContent = pageContent.replace(/user\?\./g, '');
      pageContent = pageContent.replace(/user\./g, '');
      
      // Substituir dados do usuário por valores padrão
      pageContent = pageContent.replace(/user\?\.(nome|email)/g, "'Administrador'");
      
      fs.writeFileSync(pagePath, pageContent);
      console.log(`✅ ${pagePath} atualizado`);
    }
  });
}

// Função para criar um novo App.tsx simplificado
function createSimplifiedApp() {
  console.log('\n🔄 Criando App.tsx simplificado...');
  
  const newAppContent = `import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import AdminApp from './pages/AdminApp';
import DeviceApp from './pages/DeviceApp';
import ClientApp from './pages/ClientApp';
import DeviceOnboarding from './components/DeviceOnboarding';
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
    
    // Default para admin se não especificado
    return 'admin';
  };

  const appType = getAppType();

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="min-h-screen bg-gray-100">
          <Routes>
            {/* Rota principal - redireciona baseado no tipo */}
            <Route 
              path="/" 
              element={
                appType === 'admin' ? <Navigate to="/admin" replace /> :
                appType === 'device' ? <Navigate to="/device" replace /> :
                <Navigate to="/client" replace />
              } 
            />
            
            {/* Rotas do Admin - ACESSO DIRETO SEM LOGIN */}
            <Route 
              path="/admin/*" 
              element={<AdminApp />} 
            />
            
            {/* Rotas do Device */}
            <Route path="/device" element={<DeviceApp />} />
            <Route path="/device/onboarding" element={<DeviceOnboarding />} />
            
            {/* Rotas do Client */}
            <Route path="/client/:deviceId" element={<ClientApp />} />
            
            {/* Rota de fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </Router>
    </QueryClientProvider>
  );
}

export default App;`;
  
  fs.writeFileSync('src/App.tsx', newAppContent);
  console.log('✅ App.tsx simplificado criado');
}

// Função principal
function main() {
  try {
    console.log('🎯 TVBOX - Script de Remoção de Login');
    console.log('=====================================');
    
    deleteFiles();
    removeAuthReferences();
    updateBackendServer();
    updatePagesWithAuth();
    createSimplifiedApp();
    
    console.log('\n🎉 Remoção de login concluída com sucesso!');
    console.log('\n📋 Resumo das alterações:');
    console.log('   ✅ Arquivos de autenticação deletados');
    console.log('   ✅ Referências de auth removidas');
    console.log('   ✅ Servidor backend atualizado');
    console.log('   ✅ Páginas atualizadas');
    console.log('   ✅ App.tsx simplificado');
    console.log('\n🚀 O sistema agora funciona sem login!');
    console.log('   📱 Acesse: http://localhost:5173/admin');
    
  } catch (error) {
    console.error('❌ Erro durante a execução:', error);
    process.exit(1);
  }
}

// Executar script
main();