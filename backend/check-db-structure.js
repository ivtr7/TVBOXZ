import { db } from './config/database.js';

async function checkDatabaseStructure() {
  try {
    console.log('=== VERIFICANDO ESTRUTURA DO BANCO ===');
    
    // Listar todas as tabelas
    const [tables] = await db.execute('SHOW TABLES');
    console.log('\nTabelas encontradas:');
    tables.forEach(table => {
      console.log('-', Object.values(table)[0]);
    });
    
    // Verificar estrutura da tabela playlists
    try {
      const [playlistsStructure] = await db.execute('DESCRIBE playlists');
      console.log('\n=== ESTRUTURA DA TABELA PLAYLISTS ===');
      playlistsStructure.forEach(column => {
        console.log(`${column.Field}: ${column.Type} ${column.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${column.Key ? `(${column.Key})` : ''}`);
      });
    } catch (error) {
      console.log('\nTabela playlists não encontrada:', error.message);
    }
    
    // Verificar dados na tabela playlists
    try {
      const [playlistData] = await db.execute('SELECT * FROM playlists LIMIT 5');
      console.log('\n=== DADOS NA TABELA PLAYLISTS ===');
      console.log('Total de registros:', playlistData.length);
      if (playlistData.length > 0) {
        console.log('Exemplo de registro:', playlistData[0]);
      }
    } catch (error) {
      console.log('\nErro ao consultar playlists:', error.message);
    }
    
    // Verificar conteúdo
    try {
      const [contentData] = await db.execute('SELECT id, title, type, active FROM content LIMIT 5');
      console.log('\n=== CONTEÚDO DISPONÍVEL ===');
      console.log('Total de conteúdos:', contentData.length);
      contentData.forEach(content => {
        console.log(`ID: ${content.id}, Título: ${content.title}, Tipo: ${content.type}, Ativo: ${content.active}`);
      });
    } catch (error) {
      console.log('\nErro ao consultar content:', error.message);
    }
    
    // Verificar dispositivos
    try {
      const [deviceData] = await db.execute('SELECT device_id, name, status FROM devices LIMIT 5');
      console.log('\n=== DISPOSITIVOS DISPONÍVEIS ===');
      console.log('Total de dispositivos:', deviceData.length);
      deviceData.forEach(device => {
        console.log(`ID: ${device.device_id}, Nome: ${device.name}, Status: ${device.status}`);
      });
    } catch (error) {
      console.log('\nErro ao consultar devices:', error.message);
    }
    
  } catch (error) {
    console.error('Erro geral:', error);
  } finally {
    process.exit(0);
  }
}

checkDatabaseStructure();