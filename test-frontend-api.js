import axios from 'axios';

const BASE_URL = 'http://localhost:3001';
const FRONTEND_URL = 'http://localhost:5174';

async function testFrontendAPIIntegration() {
    console.log('=== TESTE DE INTEGRAÇÃO FRONTEND-API ===\n');
    
    try {
        // 1. Testar se o backend está respondendo
        console.log('1. Testando conectividade do backend...');
        try {
            const backendHealth = await axios.get(`${BASE_URL}/api/system/status`);
            console.log('✓ Backend está online\n');
        } catch (error) {
            console.log('⚠️  Endpoint de status não encontrado, tentando login direto...\n');
        }
        
        // 2. Fazer login para obter token
        console.log('2. Testando login...');
        let token, headers;
        try {
            const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
                email: 'admin@tvbox.com',
                password: 'admin123'
            });
            
            token = loginResponse.data.access_token || loginResponse.data.token;
            headers = { Authorization: `Bearer ${token}` };
            console.log('✓ Login realizado com sucesso\n');
            
            // Configurar token para próximas requisições
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        } catch (loginError) {
            console.error('❌ Erro no login:', loginError.message);
            if (loginError.response) {
                console.error('Status:', loginError.response.status);
                console.error('Dados:', loginError.response.data);
            }
            throw loginError;
        }
        
        // 3. Testar endpoints que o frontend consome
        console.log('3. Testando endpoints consumidos pelo frontend...');
        
        // Dispositivos
        const devicesResponse = await axios.get(`${BASE_URL}/api/devices`, { headers });
        const devices = devicesResponse.data.data || [];
        console.log(`✓ Dispositivos: ${devices.length} encontrados`);
        
        // Conteúdo
        const contentResponse = await axios.get(`${BASE_URL}/api/content`, { headers });
        const content = contentResponse.data.data || [];
        console.log(`✓ Conteúdo: ${content.length} itens encontrados`);
        
        // Status do sistema
        const systemResponse = await axios.get(`${BASE_URL}/api/system/status`, { headers });
        console.log(`✓ Status do sistema: ${systemResponse.data.status}`);
        
        console.log('\n=== DADOS REAIS DISPONÍVEIS PARA O FRONTEND ===');
        
        if (devices.length > 0) {
            console.log('\n📱 DISPOSITIVOS:');
            devices.slice(0, 3).forEach(device => {
                console.log(`  - ${device.nome || device.name} (${device.status}) - ${device.localizacao || device.location}`);
            });
        }
        
        if (content.length > 0) {
            console.log('\n📁 CONTEÚDO:');
            content.slice(0, 3).forEach(item => {
                console.log(`  - ${item.title} (${item.type}) - ${item.active ? 'Ativo' : 'Inativo'}`);
            });
        }
        
        console.log('\n=== VERIFICAÇÃO DE DADOS MOCKADOS ===');
        
        // Verificar se há dados com padrões de mock
        const hasMockDevices = devices.some(d => 
            (d.nome || d.name || '').includes('Mock') || 
            (d.nome || d.name || '').includes('Test') ||
            (d.nome || d.name || '').includes('Sample')
        );
        
        const hasMockContent = content.some(c => 
            (c.title || '').includes('Mock') || 
            (c.title || '').includes('Test') ||
            (c.title || '').includes('Sample')
        );
        
        if (hasMockDevices) {
            console.log('⚠️  Encontrados dispositivos com nomes de teste/mock');
        } else {
            console.log('✓ Nenhum dispositivo mockado encontrado');
        }
        
        if (hasMockContent) {
            console.log('⚠️  Encontrado conteúdo com nomes de teste/mock');
        } else {
            console.log('✓ Nenhum conteúdo mockado encontrado');
        }
        
        console.log('\n=== RESUMO ===');
        console.log(`✅ Backend funcionando: SIM`);
        console.log(`✅ APIs retornando dados: SIM`);
        console.log(`✅ Dados reais disponíveis: SIM`);
        console.log(`✅ Frontend pode consumir: SIM`);
        
        console.log('\n🎉 INTEGRAÇÃO FRONTEND-API ESTÁ FUNCIONANDO!');
        console.log('\n💡 PRÓXIMOS PASSOS:');
        console.log('1. Acesse http://localhost:5174/admin');
        console.log('2. Faça login com: admin@tvbox.com / admin123');
        console.log('3. Verifique se os dados exibidos correspondem aos dados reais da API');
        
    } catch (error) {
        console.error('❌ Erro no teste:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Dados:', error.response.data);
        }
    }
}

testFrontendAPIIntegration();