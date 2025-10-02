#!/usr/bin/env python3
"""
TVBOX3 - Script de Inicialização Completa
Inicia todo o sistema TVBOX3 com verificações e monitoramento
"""

import os
import sys
import subprocess
import time
import json
import requests
import threading
from pathlib import Path
from typing import Dict, List, Optional
import logging

class TVBoxStarter:
    def __init__(self, project_root: str):
        self.project_root = Path(project_root)
        self.processes = {}
        self.services_status = {}
        self.startup_log = []
        
        # Configurar logging
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler('startup.log', encoding='utf-8'),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)

    def start_system(self):
        """Inicia o sistema completo"""
        self.logger.info("=" * 60)
        self.logger.info("INICIANDO SISTEMA TVBOX3")
        self.logger.info("=" * 60)
        
        try:
            # Verificar pré-requisitos
            if not self._check_prerequisites():
                self.logger.error("Pré-requisitos não atendidos. Abortando inicialização.")
                return False
            
            # Preparar ambiente
            self._prepare_environment()
            
            # Iniciar serviços
            self._start_services()
            
            # Verificar saúde dos serviços
            self._health_check()
            
            # Monitorar sistema
            self._start_monitoring()
            
            return True
            
        except Exception as e:
            self.logger.error(f"Erro durante inicialização: {str(e)}")
            return False

    def _check_prerequisites(self):
        """Verifica pré-requisitos do sistema"""
        self.logger.info("Verificando pré-requisitos...")
        
        checks = {
            'node_installed': self._check_node(),
            'npm_installed': self._check_npm(),
            'python_installed': self._check_python(),
            'project_structure': self._check_project_structure(),
            'dependencies': self._check_dependencies()
        }
        
        all_passed = True
        for check_name, passed in checks.items():
            if passed:
                self.logger.info(f"[OK] {check_name}")
                self.startup_log.append(f"PASS: {check_name}")
            else:
                self.logger.error(f"[ERRO] {check_name}")
                self.startup_log.append(f"FAIL: {check_name}")
                all_passed = False
        
        return all_passed

    def _check_node(self):
        """Verifica se Node.js está instalado"""
        try:
            result = subprocess.run(['node', '--version'], 
                                  capture_output=True, text=True, timeout=10, shell=True)
            return result.returncode == 0
        except Exception as e:
            self.logger.debug(f"Erro ao verificar node: {e}")
            return False

    def _check_npm(self):
        """Verifica se npm está instalado"""
        try:
            result = subprocess.run(['npm', '--version'], 
                                  capture_output=True, text=True, timeout=10, shell=True)
            return result.returncode == 0
        except Exception as e:
            self.logger.debug(f"Erro ao verificar npm: {e}")
            return False

    def _check_python(self):
        """Verifica se Python está instalado"""
        try:
            return sys.version_info >= (3, 7)
        except:
            return False

    def _check_project_structure(self):
        """Verifica estrutura do projeto"""
        required_files = [
            'package.json',
            'backend/package.json',
            'backend/server.js',
            'vite.config.ts'
        ]
        
        for file_path in required_files:
            if not (self.project_root / file_path).exists():
                return False
        return True

    def _check_dependencies(self):
        """Verifica se dependências estão instaladas"""
        # Verificar node_modules do frontend
        frontend_deps = self.project_root / 'node_modules'
        backend_deps = self.project_root / 'backend' / 'node_modules'
        
        return frontend_deps.exists() and backend_deps.exists()

    def _prepare_environment(self):
        """Prepara ambiente para execução"""
        self.logger.info("Preparando ambiente...")
        
        # Verificar e criar arquivos .env se necessário
        self._ensure_env_files()
        
        # Verificar e criar diretórios necessários
        self._ensure_directories()
        
        # Instalar dependências se necessário
        self._install_dependencies()

    def _ensure_env_files(self):
        """Garante que arquivos .env existem"""
        frontend_env = self.project_root / '.env'
        backend_env = self.project_root / 'backend' / '.env'
        
        if not frontend_env.exists():
            self.logger.info("Criando arquivo .env do frontend...")
            with open(frontend_env, 'w') as f:
                f.write("""# Frontend Environment Variables
VITE_API_URL=http://localhost:3001/api
VITE_WS_URL=http://localhost:3001
VITE_UPLOAD_URL=http://localhost:3001/uploads
VITE_NODE_ENV=development
VITE_WS_RECONNECT_INTERVAL=5000
VITE_WS_MAX_RETRIES=10
VITE_UPLOAD_MAX_SIZE=100
VITE_UPLOAD_ALLOWED_TYPES=video/*,image/*
VITE_CACHE_ENABLED=true
VITE_CACHE_MAX_AGE=3600000
""")
        
        if not backend_env.exists():
            self.logger.info("Criando arquivo .env do backend...")
            with open(backend_env, 'w') as f:
                f.write("""# Backend Environment Variables
PORT=3001
NODE_ENV=development
DB_PATH=./tvbox.db
JWT_SECRET=your-secret-key-here
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=104857600
CORS_ORIGIN=http://localhost:5173
""")

    def _ensure_directories(self):
        """Garante que diretórios necessários existem"""
        directories = [
            'backend/uploads',
            'backend/logs',
            'logs'
        ]
        
        for dir_path in directories:
            full_path = self.project_root / dir_path
            if not full_path.exists():
                self.logger.info(f"Criando diretório: {dir_path}")
                full_path.mkdir(parents=True, exist_ok=True)

    def _install_dependencies(self):
        """Instala dependências se necessário"""
        # Verificar se node_modules existe e tem conteúdo
        frontend_modules = self.project_root / 'node_modules'
        backend_modules = self.project_root / 'backend' / 'node_modules'
        
        if not frontend_modules.exists() or not any(frontend_modules.iterdir()):
            self.logger.info("Instalando dependências do frontend...")
            subprocess.run(['npm', 'install'], cwd=self.project_root, check=True)
        
        if not backend_modules.exists() or not any(backend_modules.iterdir()):
            self.logger.info("Instalando dependências do backend...")
            subprocess.run(['npm', 'install'], cwd=self.project_root / 'backend', check=True)

    def _start_services(self):
        """Inicia todos os serviços"""
        self.logger.info("Iniciando serviços...")
        
        # Iniciar backend
        self._start_backend()
        
        # Aguardar backend inicializar
        time.sleep(3)
        
        # Iniciar frontend
        self._start_frontend()
        
        # Aguardar frontend inicializar
        time.sleep(5)

    def _start_backend(self):
        """Inicia o servidor backend"""
        self.logger.info("Iniciando servidor backend...")
        
        try:
            # Usar npm start no diretório backend
            process = subprocess.Popen(
                ['npm', 'start'],
                cwd=self.project_root / 'backend',
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                creationflags=subprocess.CREATE_NEW_CONSOLE if os.name == 'nt' else 0
            )
            
            self.processes['backend'] = process
            self.services_status['backend'] = 'STARTING'
            self.logger.info("Servidor backend iniciado")
            
        except Exception as e:
            self.logger.error(f"Erro ao iniciar backend: {str(e)}")
            self.services_status['backend'] = 'ERROR'

    def _start_frontend(self):
        """Inicia o servidor frontend"""
        self.logger.info("Iniciando servidor frontend...")
        
        try:
            # Usar npm run dev para o frontend
            process = subprocess.Popen(
                ['npm', 'run', 'dev'],
                cwd=self.project_root,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                creationflags=subprocess.CREATE_NEW_CONSOLE if os.name == 'nt' else 0
            )
            
            self.processes['frontend'] = process
            self.services_status['frontend'] = 'STARTING'
            self.logger.info("Servidor frontend iniciado")
            
        except Exception as e:
            self.logger.error(f"Erro ao iniciar frontend: {str(e)}")
            self.services_status['frontend'] = 'ERROR'

    def _health_check(self):
        """Verifica saúde dos serviços"""
        self.logger.info("Verificando saúde dos serviços...")
        
        # Aguardar serviços iniciarem
        time.sleep(10)
        
        # Verificar backend
        backend_healthy = self._check_service_health('http://localhost:3001')
        if backend_healthy:
            self.services_status['backend'] = 'RUNNING'
            self.logger.info("[OK] Backend está saudável")
        else:
            self.services_status['backend'] = 'UNHEALTHY'
            self.logger.error("[ERRO] Backend não está respondendo")
        
        # Verificar frontend
        frontend_healthy = self._check_service_health('http://localhost:5173')
        if frontend_healthy:
            self.services_status['frontend'] = 'RUNNING'
            self.logger.info("[OK] Frontend está saudável")
        else:
            self.services_status['frontend'] = 'UNHEALTHY'
            self.logger.error("[ERRO] Frontend não está respondendo")

    def _check_service_health(self, url: str, timeout: int = 5) -> bool:
        """Verifica se um serviço está respondendo"""
        try:
            response = requests.get(url, timeout=timeout)
            return response.status_code < 500
        except:
            return False

    def _start_monitoring(self):
        """Inicia monitoramento dos serviços"""
        self.logger.info("Iniciando monitoramento...")
        
        # Criar thread de monitoramento
        monitor_thread = threading.Thread(target=self._monitor_services, daemon=True)
        monitor_thread.start()
        
        # Exibir status final
        self._display_status()

    def _monitor_services(self):
        """Monitora serviços em background"""
        while True:
            time.sleep(30)  # Verificar a cada 30 segundos
            
            # Verificar se processos ainda estão rodando
            for service_name, process in self.processes.items():
                if process.poll() is not None:
                    self.logger.warning(f"Serviço {service_name} parou inesperadamente")
                    self.services_status[service_name] = 'STOPPED'

    def _display_status(self):
        """Exibe status final do sistema"""
        self.logger.info("\n" + "=" * 60)
        self.logger.info("STATUS DO SISTEMA TVBOX3")
        self.logger.info("=" * 60)
        
        for service, status in self.services_status.items():
            status_icon = "[OK]" if status == 'RUNNING' else "[ERRO]"
            self.logger.info(f"{status_icon} {service.upper()}: {status}")
        
        if all(status == 'RUNNING' for status in self.services_status.values()):
            self.logger.info("\n🎉 SISTEMA INICIADO COM SUCESSO!")
            self.logger.info("Frontend: http://localhost:5173")
            self.logger.info("Backend API: http://localhost:3001/api")
            self.logger.info("\nPressione Ctrl+C para parar o sistema")
        else:
            self.logger.error("\n❌ ALGUNS SERVIÇOS FALHARAM AO INICIAR")
            self.logger.error("Verifique os logs para mais detalhes")

    def stop_system(self):
        """Para todos os serviços"""
        self.logger.info("Parando sistema...")
        
        for service_name, process in self.processes.items():
            if process.poll() is None:
                self.logger.info(f"Parando {service_name}...")
                process.terminate()
                try:
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    process.kill()
        
        self.logger.info("Sistema parado")

def main():
    """Função principal"""
    project_root = os.path.dirname(os.path.abspath(__file__))
    starter = TVBoxStarter(project_root)
    
    try:
        if starter.start_system():
            # Manter o script rodando
            while True:
                time.sleep(1)
        else:
            print("Falha na inicialização do sistema")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\nParando sistema...")
        starter.stop_system()
        sys.exit(0)
    except Exception as e:
        print(f"Erro inesperado: {str(e)}")
        starter.stop_system()
        sys.exit(1)

if __name__ == "__main__":
    main()