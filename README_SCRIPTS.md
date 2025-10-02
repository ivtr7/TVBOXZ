# Scripts de Análise e Inicialização - TVBOX3

Este documento descreve os scripts Python desenvolvidos para análise, auditoria e inicialização do sistema TVBOX3.

## 📋 Scripts Disponíveis

### 1. `code_analyzer.py` - Analisador de Código
**Função**: Analisa todo o código do projeto, detecta erros e gera relatórios detalhados.

**Características**:
- ✅ Análise completa de arquivos JS/TS/TSX/Python
- ✅ Detecção de erros de sintaxe
- ✅ Verificação de imports não utilizados
- ✅ Contagem de funções, classes e linhas
- ✅ Análise de estrutura do projeto
- ✅ Verificação de dependências
- ✅ Relatório detalhado em TXT

**Como usar**:
```bash
python code_analyzer.py
```

**Saída**: Gera arquivo `code_analysis_report_YYYYMMDD_HHMMSS.txt`

---

### 2. `system_auditor.py` - Auditor de Sistema
**Função**: Realiza auditoria completa do sistema, testa logins, funcionalidades e gera relatório.

**Características**:
- ✅ Teste de todos os serviços (Frontend/Backend/API)
- ✅ Auditoria do sistema de login
- ✅ Verificação do banco de dados
- ✅ Teste de endpoints da API
- ✅ Verificação de funcionalidades principais
- ✅ Análise do sistema de arquivos
- ✅ Relatório em TXT e JSON

**Como usar**:
```bash
python system_auditor.py
```

**Saída**: 
- `system_audit_report_YYYYMMDD_HHMMSS.txt`
- `system_audit_report_YYYYMMDD_HHMMSS.json`

---

### 3. `start_tvbox.py` - Inicializador do Sistema
**Função**: Inicia todo o sistema TVBOX3 com verificações automáticas e monitoramento.

**Características**:
- ✅ Verificação de pré-requisitos (Node.js, npm, Python)
- ✅ Criação automática de arquivos .env
- ✅ Instalação automática de dependências
- ✅ Inicialização sequencial dos serviços
- ✅ Monitoramento de saúde dos serviços
- ✅ Log detalhado de inicialização

**Como usar**:
```bash
python start_tvbox.py
```

**Ou no Windows**:
```bash
start_tvbox.bat
```

---

## 🚀 Guia de Uso Rápido

### Primeira Execução
1. **Análise do código**:
   ```bash
   python code_analyzer.py
   ```

2. **Auditoria do sistema**:
   ```bash
   python system_auditor.py
   ```

3. **Iniciar o sistema**:
   ```bash
   python start_tvbox.py
   ```

### Execução Diária
Para uso diário, basta executar:
```bash
start_tvbox.bat  # Windows
# ou
python start_tvbox.py  # Qualquer OS
```

## 📊 Relatórios Gerados

### Analisador de Código
```
code_analysis_report_20240115_143022.txt
├── Estatísticas do projeto
├── Erros encontrados
├── Avisos e melhorias
└── Informações gerais
```

### Auditor de Sistema
```
system_audit_report_20240115_143022.txt
├── Resumo executivo
├── Status dos serviços
├── Testes de login
├── Testes de API
├── Testes de banco de dados
├── Erros encontrados
├── Avisos
└── Testes bem-sucedidos

system_audit_report_20240115_143022.json
└── Dados estruturados para processamento
```

## 🔧 Pré-requisitos

### Software Necessário
- **Python 3.7+**
- **Node.js 16+**
- **npm**

### Bibliotecas Python
```bash
pip install requests
```

## 🎯 Funcionalidades Detalhadas

### Code Analyzer
- **Análise de Sintaxe**: Verifica erros de sintaxe em JS/TS/Python
- **Imports**: Detecta imports não utilizados
- **Estrutura**: Verifica estrutura de diretórios obrigatórios
- **Dependências**: Analisa package.json e dependências
- **Rotas**: Mapeia todas as rotas da API
- **Estatísticas**: Conta arquivos, linhas, funções e classes

### System Auditor
- **Serviços**: Testa se frontend/backend estão rodando
- **Login**: Testa diferentes cenários de autenticação
- **API**: Verifica todos os endpoints principais
- **Banco**: Conecta e verifica estrutura das tabelas
- **Arquivos**: Verifica diretórios e permissões
- **WebSocket**: Testa conectividade WebSocket

### System Starter
- **Pré-requisitos**: Verifica Node.js, npm, Python
- **Ambiente**: Cria arquivos .env automaticamente
- **Dependências**: Instala npm packages se necessário
- **Inicialização**: Inicia backend e frontend em sequência
- **Monitoramento**: Monitora saúde dos serviços
- **Logs**: Registra todo o processo de inicialização

## 🐛 Solução de Problemas

### Erro: "Python não encontrado"
```bash
# Instalar Python 3.7+
# Windows: Baixar de python.org
# Linux: sudo apt install python3
```

### Erro: "Node.js não encontrado"
```bash
# Instalar Node.js 16+
# Windows: Baixar de nodejs.org
# Linux: sudo apt install nodejs npm
```

### Erro: "Módulo requests não encontrado"
```bash
pip install requests
```

### Serviços não iniciam
1. Verificar se as portas 3001 e 5173 estão livres
2. Executar `python system_auditor.py` para diagnóstico
3. Verificar logs em `startup.log`

## 📝 Logs e Monitoramento

### Arquivos de Log
- `startup.log` - Log de inicialização do sistema
- `code_analysis_report_*.txt` - Relatórios de análise
- `system_audit_report_*.txt` - Relatórios de auditoria

### Monitoramento em Tempo Real
O script `start_tvbox.py` monitora continuamente:
- Status dos processos
- Saúde dos serviços
- Conectividade da API
- Logs de erro

## 🔄 Automação

### Execução Automática (Windows)
Criar tarefa agendada para executar `start_tvbox.bat` na inicialização do sistema.

### Execução Automática (Linux)
Adicionar ao crontab:
```bash
@reboot cd /path/to/tvbox3 && python start_tvbox.py
```

## 📞 Suporte

Para problemas ou dúvidas:
1. Execute `python system_auditor.py` para diagnóstico
2. Verifique os logs gerados
3. Consulte a seção de solução de problemas

---

**Desenvolvido para TVBOX3** - Sistema completo de análise, auditoria e inicialização automatizada.