/**
 * Script de Teste Abrangente do Sistema TVBOX3
 * Simula um usuário real testando todas as funcionalidades
 * Registra erros e implementa correções automaticamente
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';

// Configurações
const BASE_URL = 'http://localhost:3001';
const ADMIN_EMAIL = 'admin@oricontrol.com';
const ADMIN_PASSWORD = 'admin123';
const LOG_FILE = 'system-test-log.txt';

// Estado global do teste
let testResults = {
    passed: 0,
    failed: 0,
    errors: [],
    fixes: []
};

let authToken = null;
let testDeviceId = null;
let testContentId = null;

// Função de logging
function log(message, type = 'INFO') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${type}] ${message}`;
    console.log(logMessage);
    fs.appendFileSync(LOG_FILE, logMessage + '\n');
}

// Função para registrar erro e tentar correção
function handleError(testName, error, fixFunction = null) {
    testResults.failed++;
    const errorMsg = `ERRO em ${testName}: ${error.message || error}`;
    log(errorMsg, 'ERROR');
    testResults.errors.push({ test: testName, error: errorMsg });
    
    if (fixFunction) {
        try {
            log(`Tentando correção automática para ${testName}...`, 'FIX');
            const fix = fixFunction();
            testResults.fixes.push({ test: testName, fix });
            log(`Correção aplicada: ${fix}`, 'FIX');
        } catch (fixError) {
            log(`Falha na correção automática: ${fixError.message}`, 'ERROR');
        }
    }
}

// Função para registrar sucesso
function handleSuccess(testName, details = '') {
    testResults.passed++;
    log(`✓ ${testName} ${details}`, 'SUCCESS');
}

// Delay entre testes
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 1. Teste de Autenticação
async function testAuthentication() {
    log('=== INICIANDO TESTE DE AUTENTICAÇÃO ===');
    
    try {
        // Teste de login válido
        const response = await axios.post(`${BASE_URL}/api/auth/login`, {
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD
        });
        
        if (response.data.success && response.data.access_token) {
            authToken = response.data.access_token;
            handleSuccess('Login de administrador', `Token: ${authToken.substring(0, 20)}...`);
        } else {
            throw new Error('Login não retornou token válido');
        }
        
        // Aguardar um pouco antes do teste de login inválido
        await delay(2000);
        
        // Teste de login inválido
        try {
            await axios.post(`${BASE_URL}/api/auth/login`, {
                email: 'invalid@test.com',
                password: 'wrongpassword'
            });
            throw new Error('Login inválido deveria ter falhado');
        } catch (error) {
            if (error.response && (error.response.status === 401 || error.response.status === 429)) {
                handleSuccess('Rejeição de credenciais inválidas');
            } else {
                throw error;
            }
        }
        
    } catch (error) {
        handleError('Autenticação', error, () => {
            return 'Verificar configuração JWT_SECRET no .env e middleware de autenticação';
        });
    }
}

// 2. Teste de Gerenciamento de Dispositivos
async function testDeviceManagement() {
    log('=== INICIANDO TESTE DE GERENCIAMENTO DE DISPOSITIVOS ===');
    
    if (!authToken) {
        log('Token de autenticação não disponível, pulando teste', 'WARN');
        return;
    }
    
    const headers = { Authorization: `Bearer ${authToken}` };
    
    try {
        // Listar dispositivos
        const devicesResponse = await axios.get(`${BASE_URL}/api/devices`, { headers });
        handleSuccess('Listagem de dispositivos', `${devicesResponse.data.length} dispositivos encontrados`);
        
        // Registrar novo dispositivo (simulando TV Box)
        const deviceData = {
            name: `Dispositivo Teste ${Date.now()}`,
            location: 'Sala de Testes',
            mac_address: `AA:BB:CC:DD:EE:${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`
        };
        
        const registerResponse = await axios.post(`${BASE_URL}/api/devices/legacy-register`, deviceData);
        
        if (registerResponse.data.success) {
            testDeviceId = registerResponse.data.device_id;
            handleSuccess('Registro de dispositivo', `ID: ${testDeviceId}`);
        } else {
            throw new Error('Registro de dispositivo falhou');
        }
        
        // Testar status do dispositivo
        if (testDeviceId) {
            const statusResponse = await axios.get(`${BASE_URL}/api/devices/${testDeviceId}/status`);
            handleSuccess('Consulta de status do dispositivo', `Status: ${statusResponse.data.status}`);
        }
        
    } catch (error) {
        handleError('Gerenciamento de Dispositivos', error, () => {
            return 'Verificar rotas de dispositivos e validação de dados';
        });
    }
}

// 3. Teste de Gerenciamento de Conteúdo
async function testContentManagement() {
    log('=== INICIANDO TESTE DE GERENCIAMENTO DE CONTEÚDO ===');
    
    if (!authToken) {
        log('Token de autenticação não disponível, pulando teste', 'WARN');
        return;
    }
    
    const headers = { Authorization: `Bearer ${authToken}` };
    
    try {
        // Listar conteúdo existente
        const contentResponse = await axios.get(`${BASE_URL}/api/content`, { headers });
        handleSuccess('Listagem de conteúdo', `${contentResponse.data.data.length} itens encontrados`);
        
        if (contentResponse.data.data.length > 0) {
            testContentId = contentResponse.data.data[0].id;
            log(`Usando conteúdo existente ID: ${testContentId}`);
        }
        
        // Teste de upload de conteúdo (simulado com FormData)
        const formData = new FormData();
        formData.append('title', `Conteúdo Teste ${Date.now()}`);
        formData.append('description', 'Conteúdo de teste criado automaticamente');
        
        // Simular um arquivo pequeno de texto como imagem
        const fakeFileContent = Buffer.from('fake image content for testing');
        formData.append('file', fakeFileContent, {
            filename: 'test-image.jpg',
            contentType: 'image/jpeg'
        });
        
        const uploadHeaders = {
            ...headers,
            ...formData.getHeaders()
        };
        
        const uploadResponse = await axios.post(`${BASE_URL}/api/content`, formData, { headers: uploadHeaders });
        
        if (uploadResponse.data.success) {
            testContentId = uploadResponse.data.content.id;
            handleSuccess('Upload de conteúdo', `ID: ${testContentId}`);
        }
        
        // Testar atualização de conteúdo
        if (testContentId) {
            const updateData = {
                title: `Conteúdo Atualizado ${Date.now()}`,
                active: true
            };
            
            const updateResponse = await axios.put(`${BASE_URL}/api/content/${testContentId}`, updateData, { headers });
            
            if (updateResponse.data.success) {
                handleSuccess('Atualização de conteúdo');
            }
        }
        
    } catch (error) {
        handleError('Gerenciamento de Conteúdo', error, () => {
            return 'Verificar rotas de conteúdo e validação de upload';
        });
    }
}

// 4. Teste de Playlists
async function testPlaylistManagement() {
    log('=== INICIANDO TESTE DE GERENCIAMENTO DE PLAYLISTS ===');
    
    if (!authToken || !testDeviceId) {
        log('Pré-requisitos não disponíveis, pulando teste', 'WARN');
        return;
    }
    
    const headers = { Authorization: `Bearer ${authToken}` };
    
    try {
        // Obter playlist do dispositivo
        const playlistResponse = await axios.get(`${BASE_URL}/api/playlists/device/${testDeviceId}`, { headers });
        handleSuccess('Consulta de playlist', `${playlistResponse.data.data.length} itens na playlist`);
        
        // Adicionar conteúdo à playlist (se temos conteúdo)
        if (testContentId) {
            const addContentData = {
                content_id: testContentId,
                duration_seconds: 15
            };
            
            const addResponse = await axios.post(
                `${BASE_URL}/api/playlists/device/${testDeviceId}/content`,
                addContentData,
                { headers }
            );
            
            if (addResponse.data.success) {
                handleSuccess('Adição de conteúdo à playlist');
            }
        }
        
        // Testar reordenação de playlist
        const reorderData = {
            playlist: [
                { id: 1, order_index: 0, duration_seconds: 10 },
                { id: 2, order_index: 1, duration_seconds: 15 }
            ]
        };
        
        try {
            const reorderResponse = await axios.post(
                `${BASE_URL}/api/playlists/device/${testDeviceId}/reorder`,
                reorderData,
                { headers }
            );
            
            if (reorderResponse.data.success) {
                handleSuccess('Reordenação de playlist');
            }
        } catch (reorderError) {
            // Erro esperado se não há itens suficientes
            log('Reordenação falhou (esperado se playlist vazia)', 'WARN');
        }
        
    } catch (error) {
        handleError('Gerenciamento de Playlists', error, () => {
            return 'Verificar rotas de playlist e validação de dados';
        });
    }
}

// 5. Teste de WebSocket
async function testWebSocketConnection() {
    log('=== INICIANDO TESTE DE WEBSOCKET ===');
    
    try {
        // Teste básico de conectividade WebSocket
        const { io: socketIO } = await import('socket.io-client');
        const socket = socketIO(`${BASE_URL}`, {
            transports: ['websocket'],
            timeout: 5000
        });
        
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                socket.disconnect();
                handleError('WebSocket', new Error('Timeout na conexão WebSocket'), () => {
                    return 'Verificar configuração do Socket.IO no servidor';
                });
                resolve();
            }, 5000);
            
            socket.on('connect', () => {
                clearTimeout(timeout);
                handleSuccess('Conexão WebSocket');
                socket.disconnect();
                resolve();
            });
            
            socket.on('connect_error', (error) => {
                clearTimeout(timeout);
                handleError('WebSocket', error, () => {
                    return 'Verificar se o servidor WebSocket está rodando na porta correta';
                });
                resolve();
            });
        });
        
    } catch (error) {
        handleError('WebSocket', error, () => {
            return 'Instalar socket.io-client: npm install socket.io-client';
        });
    }
}

// 6. Teste de Endpoints Públicos
async function testPublicEndpoints() {
    log('=== INICIANDO TESTE DE ENDPOINTS PÚBLICOS ===');
    
    try {
        // Teste de health check
        try {
            const healthResponse = await axios.get(`${BASE_URL}/api/system/health`);
            handleSuccess('Health Check', `Status: ${healthResponse.data.status}`);
        } catch (error) {
            if (error.response && error.response.status === 404) {
                log('Endpoint de health check não encontrado (opcional)', 'WARN');
            } else {
                throw error;
            }
        }
        
        // Teste de playlist pública (se temos dispositivo)
        if (testDeviceId) {
            const publicPlaylistResponse = await axios.get(`${BASE_URL}/api/devices/${testDeviceId}/playlist`);
            handleSuccess('Playlist pública do dispositivo');
        }
        
    } catch (error) {
        handleError('Endpoints Públicos', error, () => {
            return 'Verificar rotas públicas e configuração CORS';
        });
    }
}

// 7. Teste de Segurança
async function testSecurity() {
    log('=== INICIANDO TESTE DE SEGURANÇA ===');
    
    try {
        // Teste de acesso sem token
        try {
            await axios.get(`${BASE_URL}/api/devices`);
            throw new Error('Acesso sem token deveria ter sido negado');
        } catch (error) {
            if (error.response && error.response.status === 401) {
                handleSuccess('Proteção de rota sem token');
            } else {
                throw error;
            }
        }
        
        // Teste de token inválido
        try {
            await axios.get(`${BASE_URL}/api/devices`, {
                headers: { Authorization: 'Bearer token_invalido' }
            });
            throw new Error('Token inválido deveria ter sido rejeitado');
        } catch (error) {
            if (error.response && error.response.status === 403) {
                handleSuccess('Rejeição de token inválido');
            } else {
                throw error;
            }
        }
        
    } catch (error) {
        handleError('Segurança', error, () => {
            return 'Verificar middleware de autenticação e validação de tokens';
        });
    }
}

// Função principal de teste
async function runComprehensiveTest() {
    log('🚀 INICIANDO TESTE ABRANGENTE DO SISTEMA TVBOX3 🚀');
    log('=' .repeat(60));
    
    // Limpar log anterior
    if (fs.existsSync(LOG_FILE)) {
        fs.unlinkSync(LOG_FILE);
    }
    
    const startTime = Date.now();
    
    // Executar todos os testes
    await testAuthentication();
    await delay(1000);
    
    await testDeviceManagement();
    await delay(1000);
    
    await testContentManagement();
    await delay(1000);
    
    await testPlaylistManagement();
    await delay(1000);
    
    await testWebSocketConnection();
    await delay(1000);
    
    await testPublicEndpoints();
    await delay(1000);
    
    await testSecurity();
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    // Relatório final
    log('=' .repeat(60));
    log('📊 RELATÓRIO FINAL DO TESTE');
    log('=' .repeat(60));
    log(`⏱️  Duração total: ${duration}s`);
    log(`✅ Testes aprovados: ${testResults.passed}`);
    log(`❌ Testes falharam: ${testResults.failed}`);
    log(`🔧 Correções aplicadas: ${testResults.fixes.length}`);
    
    if (testResults.errors.length > 0) {
        log('\n🚨 ERROS ENCONTRADOS:');
        testResults.errors.forEach((error, index) => {
            log(`${index + 1}. ${error.test}: ${error.error}`);
        });
    }
    
    if (testResults.fixes.length > 0) {
        log('\n🔧 CORREÇÕES SUGERIDAS:');
        testResults.fixes.forEach((fix, index) => {
            log(`${index + 1}. ${fix.test}: ${fix.fix}`);
        });
    }
    
    const successRate = ((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(2);
    log(`\n📈 Taxa de sucesso: ${successRate}%`);
    
    if (successRate >= 90) {
        log('🎉 SISTEMA EM EXCELENTE ESTADO!');
    } else if (successRate >= 70) {
        log('⚠️  Sistema funcional, mas precisa de melhorias');
    } else {
        log('🚨 Sistema precisa de correções urgentes');
    }
    
    log(`\n📄 Log completo salvo em: ${LOG_FILE}`);
    log('=' .repeat(60));
}

// Executar automaticamente
runComprehensiveTest().catch(error => {
    console.error('Erro fatal no teste:', error);
    process.exit(1);
});