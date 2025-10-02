#!/usr/bin/env python3
"""
TVBOX3 - Auditor de Sistema Completo
Realiza auditoria completa do sistema, testa logins, funcionalidades e gera relatório detalhado
"""

import os
import json
import requests
import subprocess
import datetime
import time
import sqlite3
from pathlib import Path
from typing import Dict, List, Any, Optional
import logging

class SystemAuditor:
    def __init__(self, project_root: str):
        self.project_root = Path(project_root)
        self.audit_results = {
            'timestamp': datetime.datetime.now().isoformat(),
            'system_status': {},
            'login_tests': {},
            'api_tests': {},
            'database_tests': {},
            'file_system_tests': {},
            'service_tests': {},
            'errors': [],
            'warnings': [],
            'success': []
        }
        
        # URLs base para testes
        self.base_urls = {
            'frontend': 'http://localhost:5173',
            'backend': 'http://localhost:3001',
            'api': 'http://localhost:3001/api'
        }
        
        # Configurar logging
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s'
        )
        self.logger = logging.getLogger(__name__)

    def run_full_audit(self):
        """Executa auditoria completa do sistema"""
        self.logger.info("Iniciando auditoria completa do sistema TVBOX3...")
        
        # Verificar estrutura do sistema
        self._audit_system_structure()
        
        # Testar serviços
        self._audit_services()
        
        # Testar banco de dados
        self._audit_database()
        
        # Testar APIs
        self._audit_apis()
        
        # Testar sistema de login
        self._audit_login_system()
        
        # Testar funcionalidades principais
        self._audit_main_features()
        
        # Verificar arquivos e permissões
        self._audit_file_system()
        
        # Gerar relatório final
        self._generate_audit_report()

    def _audit_system_structure(self):
        """Audita estrutura do sistema"""
        self.logger.info("Auditando estrutura do sistema...")
        
        required_files = [
            'package.json',
            'vite.config.ts',
            'backend/package.json',
            'backend/server.js',
            '.env',
            'backend/.env'
        ]
        
        structure_status = {}
        
        for file_path in required_files:
            full_path = self.project_root / file_path
            if full_path.exists():
                structure_status[file_path] = "OK"
                self.audit_results['success'].append(f"Arquivo encontrado: {file_path}")
            else:
                structure_status[file_path] = "MISSING"
                self.audit_results['errors'].append(f"Arquivo obrigatório não encontrado: {file_path}")
        
        self.audit_results['system_status']['file_structure'] = structure_status

    def _audit_services(self):
        """Audita serviços em execução"""
        self.logger.info("Auditando serviços...")
        
        services = {
            'frontend': self.base_urls['frontend'],
            'backend': self.base_urls['backend'],
            'api': self.base_urls['api']
        }
        
        service_status = {}
        
        for service_name, url in services.items():
            try:
                response = requests.get(url, timeout=5)
                if response.status_code == 200:
                    service_status[service_name] = "RUNNING"
                    self.audit_results['success'].append(f"Serviço {service_name} está rodando")
                else:
                    service_status[service_name] = f"ERROR_{response.status_code}"
                    self.audit_results['errors'].append(f"Serviço {service_name} retornou status {response.status_code}")
            except requests.exceptions.RequestException as e:
                service_status[service_name] = "DOWN"
                self.audit_results['errors'].append(f"Serviço {service_name} não está acessível: {str(e)}")
        
        self.audit_results['service_tests'] = service_status

    def _audit_database(self):
        """Audita banco de dados"""
        self.logger.info("Auditando banco de dados...")
        
        db_tests = {}
        
        # Verificar arquivo de banco SQLite
        db_path = self.project_root / 'backend' / 'tvbox.db'
        if db_path.exists():
            db_tests['database_file'] = "EXISTS"
            self.audit_results['success'].append("Arquivo de banco de dados encontrado")
            
            try:
                # Testar conexão
                conn = sqlite3.connect(str(db_path))
                cursor = conn.cursor()
                
                # Verificar tabelas principais
                tables_to_check = ['devices', 'device_files', 'announcements', 'users']
                
                for table in tables_to_check:
                    cursor.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table}'")
                    if cursor.fetchone():
                        db_tests[f'table_{table}'] = "EXISTS"
                        self.audit_results['success'].append(f"Tabela {table} encontrada")
                        
                        # Contar registros
                        cursor.execute(f"SELECT COUNT(*) FROM {table}")
                        count = cursor.fetchone()[0]
                        db_tests[f'table_{table}_count'] = count
                        self.audit_results['success'].append(f"Tabela {table} tem {count} registros")
                    else:
                        db_tests[f'table_{table}'] = "MISSING"
                        self.audit_results['errors'].append(f"Tabela {table} não encontrada")
                
                conn.close()
                
            except Exception as e:
                db_tests['connection'] = "ERROR"
                self.audit_results['errors'].append(f"Erro ao conectar com banco: {str(e)}")
        else:
            db_tests['database_file'] = "MISSING"
            self.audit_results['errors'].append("Arquivo de banco de dados não encontrado")
        
        self.audit_results['database_tests'] = db_tests

    def _audit_apis(self):
        """Audita endpoints da API"""
        self.logger.info("Auditando APIs...")
        
        api_endpoints = [
            ('GET', '/api/devices', 'Listar dispositivos'),
            ('GET', '/api/announcements', 'Listar anúncios'),
            ('POST', '/api/auth/login', 'Login de usuário'),
            ('GET', '/api/system/status', 'Status do sistema')
        ]
        
        api_tests = {}
        
        for method, endpoint, description in api_endpoints:
            test_key = f"{method}_{endpoint.replace('/', '_')}"
            
            try:
                url = f"{self.base_urls['backend']}{endpoint}"
                
                if method == 'GET':
                    response = requests.get(url, timeout=5)
                elif method == 'POST':
                    # Para POST de login, usar dados de teste
                    if 'login' in endpoint:
                        response = requests.post(url, json={
                            'username': 'test',
                            'password': 'test'
                        }, timeout=5)
                    else:
                        response = requests.post(url, timeout=5)
                
                api_tests[test_key] = {
                    'status_code': response.status_code,
                    'description': description,
                    'response_time': response.elapsed.total_seconds()
                }
                
                if response.status_code < 500:
                    self.audit_results['success'].append(f"API {description} respondeu (status: {response.status_code})")
                else:
                    self.audit_results['errors'].append(f"API {description} erro do servidor (status: {response.status_code})")
                    
            except requests.exceptions.RequestException as e:
                api_tests[test_key] = {
                    'status_code': 'ERROR',
                    'description': description,
                    'error': str(e)
                }
                self.audit_results['errors'].append(f"API {description} não acessível: {str(e)}")
        
        self.audit_results['api_tests'] = api_tests

    def _audit_login_system(self):
        """Audita sistema de login"""
        self.logger.info("Auditando sistema de login...")
        
        login_tests = {}
        
        # Testar diferentes cenários de login
        test_cases = [
            ('admin', 'admin123', 'Login admin válido'),
            ('user', 'user123', 'Login usuário válido'),
            ('invalid', 'invalid', 'Login inválido'),
            ('', '', 'Login vazio')
        ]
        
        for username, password, description in test_cases:
            test_key = f"login_{username or 'empty'}"
            
            try:
                url = f"{self.base_urls['backend']}/api/auth/login"
                response = requests.post(url, json={
                    'username': username,
                    'password': password
                }, timeout=5)
                
                login_tests[test_key] = {
                    'status_code': response.status_code,
                    'description': description,
                    'has_token': 'token' in response.text.lower()
                }
                
                if response.status_code == 200:
                    self.audit_results['success'].append(f"Login test: {description} - SUCCESS")
                elif response.status_code == 401:
                    self.audit_results['success'].append(f"Login test: {description} - CORRECTLY REJECTED")
                else:
                    self.audit_results['warnings'].append(f"Login test: {description} - UNEXPECTED STATUS {response.status_code}")
                    
            except requests.exceptions.RequestException as e:
                login_tests[test_key] = {
                    'status_code': 'ERROR',
                    'description': description,
                    'error': str(e)
                }
                self.audit_results['errors'].append(f"Login test {description} falhou: {str(e)}")
        
        self.audit_results['login_tests'] = login_tests

    def _audit_main_features(self):
        """Audita funcionalidades principais"""
        self.logger.info("Auditando funcionalidades principais...")
        
        features = {
            'device_management': self._test_device_management,
            'file_upload': self._test_file_upload,
            'announcements': self._test_announcements,
            'websocket': self._test_websocket
        }
        
        feature_results = {}
        
        for feature_name, test_function in features.items():
            try:
                result = test_function()
                feature_results[feature_name] = result
                if result.get('status') == 'OK':
                    self.audit_results['success'].append(f"Funcionalidade {feature_name} está funcionando")
                else:
                    self.audit_results['errors'].append(f"Funcionalidade {feature_name} com problemas: {result.get('error', 'Unknown')}")
            except Exception as e:
                feature_results[feature_name] = {'status': 'ERROR', 'error': str(e)}
                self.audit_results['errors'].append(f"Erro ao testar {feature_name}: {str(e)}")
        
        self.audit_results['system_status']['features'] = feature_results

    def _test_device_management(self):
        """Testa gerenciamento de dispositivos"""
        try:
            url = f"{self.base_urls['api']}/devices"
            response = requests.get(url, timeout=5)
            
            if response.status_code == 200:
                devices = response.json()
                return {
                    'status': 'OK',
                    'device_count': len(devices) if isinstance(devices, list) else 0
                }
            else:
                return {'status': 'ERROR', 'error': f'HTTP {response.status_code}'}
        except Exception as e:
            return {'status': 'ERROR', 'error': str(e)}

    def _test_file_upload(self):
        """Testa sistema de upload"""
        upload_dir = self.project_root / 'backend' / 'uploads'
        if upload_dir.exists():
            return {'status': 'OK', 'upload_dir_exists': True}
        else:
            return {'status': 'ERROR', 'error': 'Upload directory not found'}

    def _test_announcements(self):
        """Testa sistema de anúncios"""
        try:
            url = f"{self.base_urls['api']}/announcements"
            response = requests.get(url, timeout=5)
            
            if response.status_code == 200:
                return {'status': 'OK'}
            else:
                return {'status': 'ERROR', 'error': f'HTTP {response.status_code}'}
        except Exception as e:
            return {'status': 'ERROR', 'error': str(e)}

    def _test_websocket(self):
        """Testa conexão WebSocket"""
        # Teste básico - verificar se o servidor WebSocket está rodando
        try:
            # Tentar conectar na porta WebSocket (assumindo 3001)
            import socket
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(2)
            result = sock.connect_ex(('localhost', 3001))
            sock.close()
            
            if result == 0:
                return {'status': 'OK', 'websocket_port_open': True}
            else:
                return {'status': 'ERROR', 'error': 'WebSocket port not accessible'}
        except Exception as e:
            return {'status': 'ERROR', 'error': str(e)}

    def _audit_file_system(self):
        """Audita sistema de arquivos"""
        self.logger.info("Auditando sistema de arquivos...")
        
        file_tests = {}
        
        # Verificar diretórios importantes
        important_dirs = [
            'backend/uploads',
            'backend/config',
            'backend/routes',
            'src/components',
            'src/services'
        ]
        
        for dir_path in important_dirs:
            full_path = self.project_root / dir_path
            if full_path.exists():
                file_tests[f'dir_{dir_path}'] = 'EXISTS'
                # Contar arquivos no diretório
                file_count = len(list(full_path.glob('*')))
                file_tests[f'dir_{dir_path}_files'] = file_count
                self.audit_results['success'].append(f"Diretório {dir_path} existe com {file_count} arquivos")
            else:
                file_tests[f'dir_{dir_path}'] = 'MISSING'
                self.audit_results['errors'].append(f"Diretório {dir_path} não encontrado")
        
        self.audit_results['file_system_tests'] = file_tests

    def _generate_audit_report(self):
        """Gera relatório de auditoria"""
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        report_file = self.project_root / f"system_audit_report_{timestamp}.txt"
        
        with open(report_file, 'w', encoding='utf-8') as f:
            f.write("=" * 80 + "\n")
            f.write("RELATÓRIO DE AUDITORIA DO SISTEMA - TVBOX3\n")
            f.write("=" * 80 + "\n")
            f.write(f"Data/Hora: {datetime.datetime.now().strftime('%d/%m/%Y %H:%M:%S')}\n")
            f.write(f"Projeto: {self.project_root}\n\n")
            
            # Resumo executivo
            f.write("RESUMO EXECUTIVO\n")
            f.write("-" * 40 + "\n")
            f.write(f"Total de sucessos: {len(self.audit_results['success'])}\n")
            f.write(f"Total de erros: {len(self.audit_results['errors'])}\n")
            f.write(f"Total de avisos: {len(self.audit_results['warnings'])}\n\n")
            
            # Status dos serviços
            f.write("STATUS DOS SERVIÇOS\n")
            f.write("-" * 40 + "\n")
            for service, status in self.audit_results['service_tests'].items():
                f.write(f"{service}: {status}\n")
            f.write("\n")
            
            # Testes de login
            f.write("TESTES DE LOGIN\n")
            f.write("-" * 40 + "\n")
            for test, result in self.audit_results['login_tests'].items():
                f.write(f"{test}: {result.get('description', 'N/A')} - Status: {result.get('status_code', 'N/A')}\n")
            f.write("\n")
            
            # Testes de API
            f.write("TESTES DE API\n")
            f.write("-" * 40 + "\n")
            for test, result in self.audit_results['api_tests'].items():
                f.write(f"{test}: {result.get('description', 'N/A')} - Status: {result.get('status_code', 'N/A')}\n")
            f.write("\n")
            
            # Banco de dados
            f.write("TESTES DE BANCO DE DADOS\n")
            f.write("-" * 40 + "\n")
            for test, result in self.audit_results['database_tests'].items():
                f.write(f"{test}: {result}\n")
            f.write("\n")
            
            # Erros encontrados
            f.write("ERROS ENCONTRADOS\n")
            f.write("-" * 40 + "\n")
            if self.audit_results['errors']:
                for i, error in enumerate(self.audit_results['errors'], 1):
                    f.write(f"{i}. {error}\n")
            else:
                f.write("Nenhum erro crítico encontrado!\n")
            f.write("\n")
            
            # Avisos
            f.write("AVISOS\n")
            f.write("-" * 40 + "\n")
            if self.audit_results['warnings']:
                for i, warning in enumerate(self.audit_results['warnings'], 1):
                    f.write(f"{i}. {warning}\n")
            else:
                f.write("Nenhum aviso!\n")
            f.write("\n")
            
            # Sucessos
            f.write("TESTES BEM-SUCEDIDOS\n")
            f.write("-" * 40 + "\n")
            for success in self.audit_results['success']:
                f.write(f"✓ {success}\n")
        
        # Salvar também em JSON para processamento posterior
        json_file = self.project_root / f"system_audit_report_{timestamp}.json"
        with open(json_file, 'w', encoding='utf-8') as f:
            json.dump(self.audit_results, f, indent=2, ensure_ascii=False)
        
        self.logger.info(f"Relatório de auditoria gerado: {report_file}")
        self.logger.info(f"Dados JSON salvos em: {json_file}")
        
        return report_file, json_file

def main():
    """Função principal"""
    project_root = os.path.dirname(os.path.abspath(__file__))
    auditor = SystemAuditor(project_root)
    auditor.run_full_audit()
    
    print("\n" + "=" * 60)
    print("AUDITORIA DO SISTEMA CONCLUÍDA!")
    print("=" * 60)
    print(f"Sucessos: {len(auditor.audit_results['success'])}")
    print(f"Erros: {len(auditor.audit_results['errors'])}")
    print(f"Avisos: {len(auditor.audit_results['warnings'])}")
    print("\nVerifique os arquivos de relatório gerados para detalhes completos.")

if __name__ == "__main__":
    main()