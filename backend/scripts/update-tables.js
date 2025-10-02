import { db } from '../config/database.js';

async function updateTables() {
  try {
    console.log('🔧 Atualizando estrutura das tabelas...');
    
    // Adicionar tenant_id na tabela users se não existir
    try {
      await db.execute('ALTER TABLE users ADD COLUMN tenant_id VARCHAR(255) DEFAULT "default"');
      console.log('✅ Coluna tenant_id adicionada na tabela users');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️  Coluna tenant_id já existe na tabela users');
      } else {
        console.error('❌ Erro ao adicionar tenant_id em users:', error.message);
      }
    }
    
    // Adicionar username na tabela users se não existir
    try {
      await db.execute('ALTER TABLE users ADD COLUMN username VARCHAR(255) UNIQUE');
      console.log('✅ Coluna username adicionada na tabela users');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️  Coluna username já existe na tabela users');
      } else {
        console.error('❌ Erro ao adicionar username em users:', error.message);
      }
    }
    
    // Atualizar tabela devices para incluir campos necessários
    const deviceUpdates = [
      'ALTER TABLE devices ADD COLUMN tenant_id VARCHAR(255) DEFAULT "default"',
      'ALTER TABLE devices ADD COLUMN location VARCHAR(255)',
      'ALTER TABLE devices ADD COLUMN ip_address VARCHAR(45)',
      'ALTER TABLE devices ADD COLUMN mac_address VARCHAR(17)',
      'ALTER TABLE devices ADD COLUMN device_info JSON',
      'ALTER TABLE devices MODIFY COLUMN status ENUM("online", "offline", "maintenance") DEFAULT "offline"',
      'ALTER TABLE devices MODIFY COLUMN id VARCHAR(255) PRIMARY KEY'
    ];
    
    for (const update of deviceUpdates) {
      try {
        await db.execute(update);
        console.log(`✅ Atualização aplicada: ${update.split(' ')[3]} ${update.split(' ')[4]}`);
      } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
          console.log(`ℹ️  Campo já existe: ${update.split(' ')[3]} ${update.split(' ')[4]}`);
        } else {
          console.log(`⚠️  Aviso: ${error.message}`);
        }
      }
    }
    
    // Verificar estrutura final
    console.log('\n📋 Estrutura final das tabelas:');
    
    const [usersColumns] = await db.execute('DESCRIBE users');
    console.log('\n👥 Tabela users:');
    usersColumns.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type})`);
    });
    
    const [devicesColumns] = await db.execute('DESCRIBE devices');
    console.log('\n📱 Tabela devices:');
    devicesColumns.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type})`);
    });
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  } finally {
    process.exit(0);
  }
}

updateTables();