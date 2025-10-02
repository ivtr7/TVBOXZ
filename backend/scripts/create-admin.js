import bcrypt from 'bcryptjs';
import { db } from '../config/database.js';
import dotenv from 'dotenv';
import readline from 'readline';

dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

function askPassword(question) {
  return new Promise((resolve) => {
    process.stdout.write(question);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    
    let password = '';
    
    process.stdin.on('data', (char) => {
      char = char.toString();
      
      if (char === '\n' || char === '\r' || char === '\u0004') {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdout.write('\n');
        resolve(password);
      } else if (char === '\u0003') {
        process.exit();
      } else if (char === '\u007f') {
        if (password.length > 0) {
          password = password.slice(0, -1);
          process.stdout.write('\b \b');
        }
      } else {
        password += char;
        process.stdout.write('*');
      }
    });
  });
}

async function createAdmin() {
  try {
    console.log('🔐 Criação de Usuário Administrador\n');
    
    // Verificar se já existe um admin
    const [existingAdmins] = await db.execute(
      'SELECT COUNT(*) as count FROM users WHERE role = ?',
      ['admin']
    );
    
    if (existingAdmins[0].count > 0) {
      const overwrite = await askQuestion('⚠️  Já existe um administrador. Deseja criar outro? (s/N): ');
      if (overwrite.toLowerCase() !== 's' && overwrite.toLowerCase() !== 'sim') {
        console.log('❌ Operação cancelada.');
        process.exit(0);
      }
    }
    
    // Coletar dados do usuário
    const name = await askQuestion('👤 Nome completo: ');
    const email = await askQuestion('📧 Email: ');
    
    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log('❌ Email inválido.');
      process.exit(1);
    }
    
    // Verificar se email já existe
    const [existingUsers] = await db.execute(
      'SELECT COUNT(*) as count FROM users WHERE email = ?',
      [email]
    );
    
    if (existingUsers[0].count > 0) {
      console.log('❌ Este email já está em uso.');
      process.exit(1);
    }
    
    // Coletar senha
    const password = await askPassword('🔑 Senha (mínimo 8 caracteres): ');
    
    if (password.length < 8) {
      console.log('\n❌ A senha deve ter pelo menos 8 caracteres.');
      process.exit(1);
    }
    
    const confirmPassword = await askPassword('🔑 Confirme a senha: ');
    
    if (password !== confirmPassword) {
      console.log('\n❌ As senhas não coincidem.');
      process.exit(1);
    }
    
    // Hash da senha
    console.log('\n🔄 Processando...');
    const passwordHash = await bcrypt.hash(password, 12);
    
    // Inserir usuário no banco
    const [result] = await db.execute(
      'INSERT INTO users (name, email, password, role, tenant_id, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
      [name, email, passwordHash, 'admin', 1]
    );
    
    console.log('\n✅ Usuário administrador criado com sucesso!');
    console.log(`📋 ID: ${result.insertId}`);
    console.log(`👤 Nome: ${name}`);
    console.log(`📧 Email: ${email}`);
    console.log(`🔐 Role: admin`);
    console.log('\n🚀 Agora você pode fazer login no painel administrativo.');
    
  } catch (error) {
    console.error('\n❌ Erro ao criar usuário:', error.message);
    
    if (error.code === 'ER_DUP_ENTRY') {
      console.log('💡 Este email já está cadastrado no sistema.');
    } else if (error.code === 'ER_NO_SUCH_TABLE') {
      console.log('💡 Execute as migrations do banco de dados primeiro.');
    }
    
    process.exit(1);
  } finally {
    rl.close();
    process.exit(0);
  }
}

// Verificar conexão com banco
async function checkDatabase() {
  try {
    await db.execute('SELECT 1');
    console.log('✅ Conexão com banco de dados estabelecida.');
  } catch (error) {
    console.error('❌ Erro de conexão com banco de dados:', error.message);
    console.log('💡 Verifique se o MySQL está rodando e as configurações do .env estão corretas.');
    process.exit(1);
  }
}

// Executar
console.log('🔍 Verificando conexão com banco de dados...');
checkDatabase().then(() => {
  createAdmin();
}).catch((error) => {
  console.error('❌ Erro:', error.message);
  process.exit(1);
});