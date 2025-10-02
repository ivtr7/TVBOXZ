import { db } from '../config/database.js';

async function checkTables() {
  try {
    console.log('📋 Verificando estrutura das tabelas...');
    
    // Verificar tabela users
    console.log('\n👥 Tabela users:');
    const [usersColumns] = await db.execute('DESCRIBE users');
    usersColumns.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type}) ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });
    
    // Verificar tabela devices
    console.log('\n📱 Tabela devices:');
    const [devicesColumns] = await db.execute('DESCRIBE devices');
    devicesColumns.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type}) ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });
    
    // Verificar dados existentes
    console.log('\n📊 Dados existentes:');
    const [users] = await db.execute('SELECT id, email, role, tenant_id FROM users');
    console.log(`  - Usuários: ${users.length}`);
    users.forEach(user => {
      console.log(`    * ${user.email} (${user.role}) - Tenant: ${user.tenant_id}`);
    });
    
    const [devices] = await db.execute('SELECT id, name, status, tenant_id FROM devices');
    console.log(`  - Dispositivos: ${devices.length}`);
    devices.forEach(device => {
      console.log(`    * ${device.name} (${device.status}) - Tenant: ${device.tenant_id}`);
    });
    
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    process.exit(0);
  }
}

checkTables();