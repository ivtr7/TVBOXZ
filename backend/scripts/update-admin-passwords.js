import bcrypt from 'bcryptjs';
import { db } from '../config/database.js';
import dotenv from 'dotenv';

dotenv.config();

async function updateAdminPasswords() {
  try {
    // Verificar usuários admin existentes
    const [users] = await db.execute(
      'SELECT id, email, password FROM users WHERE role = ?',
      ['admin']
    );

    console.log('Usuários admin encontrados:');
    users.forEach(u => {
      console.log(`- ${u.email}: ${u.password.substring(0, 20)}...`);
    });

    // Hash da nova senha
    const passwordHash = await bcrypt.hash('admin123', 10);
    console.log('\nNova senha hash:', passwordHash.substring(0, 20) + '...');

    // Atualizar senhas
    const [result] = await db.execute(
      'UPDATE users SET password = ? WHERE role = ?',
      [passwordHash, 'admin']
    );

    console.log(`\n✅ ${result.affectedRows} senhas de admin atualizadas!`);
    console.log('🔑 Nova senha para todos os admins: admin123');
    
  } catch (error) {
    console.error('❌ Erro ao atualizar senhas:', error);
  } finally {
    process.exit(0);
  }
}

updateAdminPasswords();