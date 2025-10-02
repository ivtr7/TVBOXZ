import bcrypt from 'bcryptjs';
import { db } from '../config/database.js';
import dotenv from 'dotenv';

dotenv.config();

async function createAdminUser() {
  try {
    // Verificar se já existe um usuário admin
    const [existingUsers] = await db.execute(
      'SELECT id FROM users WHERE email = ?',
      ['admin@oricontrol.com']
    );

    if (existingUsers.length > 0) {
      console.log('✅ Usuário admin já existe no banco de dados');
      return;
    }

    // Hash da senha
    const passwordHash = await bcrypt.hash('admin123', 10);

    // Inserir usuário admin
    await db.execute(
      `INSERT INTO users (username, email, password, role, tenant_id) 
       VALUES (?, ?, ?, ?, ?)`,
      ['admin', 'admin@oricontrol.com', passwordHash, 'admin', 'default']
    );

    console.log('✅ Usuário admin criado com sucesso!');
    console.log('📧 Email: admin@oricontrol.com');
    console.log('🔑 Senha: admin123');
    
  } catch (error) {
    console.error('❌ Erro ao criar usuário admin:', error);
  } finally {
    process.exit(0);
  }
}

createAdminUser();