import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

const BASE_URL = 'http://localhost:3001';

async function testContentManagement() {
    try {
        console.log('=== TESTE DE GERENCIAMENTO DE CONTEÚDO ===');
        
        // Login para obter token
        const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
            email: 'admin@tvbox.com',
            password: 'admin123'
        });
        
        console.log('Login response:', loginResponse.data);
        
        const token = loginResponse.data.access_token;
        const headers = { Authorization: `Bearer ${token}` };
        
        console.log('✓ Login realizado com sucesso');
        console.log('Token:', token ? token.substring(0, 20) + '...' : 'undefined');
        
        if (!token) {
            throw new Error('Token não foi retornado pelo login');
        }
        
        // Listar conteúdo existente
        const listResponse = await axios.get(`${BASE_URL}/api/content`, { headers });
        console.log(`✓ Listagem de conteúdo: ${listResponse.data.length} itens encontrados`);
        
        let testContentId = null;
        if (listResponse.data.length > 0) {
            testContentId = listResponse.data[0].id;
            console.log(`✓ Usando conteúdo existente ID: ${testContentId}`);
        }
        
        // Testar upload de conteúdo
        const formData = new FormData();
        formData.append('title', `Teste Conteúdo ${Date.now()}`);
        formData.append('description', 'Descrição de teste');
        formData.append('file', Buffer.from('fake image data'), {
            filename: 'test-image.jpg',
            contentType: 'image/jpeg'
        });
        
        const uploadResponse = await axios.post(`${BASE_URL}/api/content`, formData, {
            headers: {
                ...headers,
                ...formData.getHeaders()
            }
        });
        
        if (uploadResponse.data.success) {
            console.log(`✓ Upload de conteúdo ID: ${uploadResponse.data.content.id}`);
            testContentId = uploadResponse.data.content.id;
        }
        
        // Testar atualização de conteúdo
        if (testContentId) {
            const updateData = {
                title: `Conteúdo Atualizado ${Date.now()}`,
                active: true
            };
            
            try {
                const updateResponse = await axios.put(`${BASE_URL}/api/content/${testContentId}`, updateData, { headers });
                
                if (updateResponse.data && updateResponse.data.id) {
                    console.log('✓ Atualização de conteúdo realizada com sucesso');
                    console.log('  - Título:', updateResponse.data.title);
                    console.log('  - Ativo:', updateResponse.data.active ? 'Sim' : 'Não');
                } else {
                    console.log('❌ Falha na atualização de conteúdo:', updateResponse.data);
                }
            } catch (updateError) {
                console.log('❌ Erro na atualização de conteúdo:', updateError.response?.status, updateError.response?.data);
            }
        }
        
        console.log('\n🎉 TESTE DE CONTEÚDO CONCLUÍDO COM SUCESSO!');
        
    } catch (error) {
        console.error('❌ ERRO no teste de conteúdo:');
        console.error('Status:', error.response?.status);
        console.error('Data:', error.response?.data);
        console.error('Message:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

testContentManagement();