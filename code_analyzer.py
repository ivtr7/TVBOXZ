#!/usr/bin/env python3
"""
TVBOX3 - Analisador de Código Completo
Analisa todo o código do projeto, detecta erros e gera relatórios detalhados
"""

import os
import json
import re
import ast
import subprocess
import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional
import logging

class CodeAnalyzer:
    def __init__(self, project_root: str):
        self.project_root = Path(project_root)
        self.errors = []
        self.warnings = []
        self.info = []
        self.stats = {
            'total_files': 0,
            'js_files': 0,
            'ts_files': 0,
            'tsx_files': 0,
            'py_files': 0,
            'json_files': 0,
            'css_files': 0,
            'other_files': 0,
            'total_lines': 0,
            'functions_found': 0,
            'classes_found': 0,
            'imports_found': 0
        }
        
        # Configurar logging
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s'
        )
        self.logger = logging.getLogger(__name__)

    def analyze_project(self):
        """Análise completa do projeto"""
        self.logger.info("Iniciando análise completa do projeto TVBOX3...")
        
        # Analisar estrutura do projeto
        self._analyze_project_structure()
        
        # Analisar arquivos de configuração
        self._analyze_config_files()
        
        # Analisar código JavaScript/TypeScript
        self._analyze_js_ts_files()
        
        # Analisar código Python
        self._analyze_python_files()
        
        # Analisar dependências
        self._analyze_dependencies()
        
        # Verificar rotas e APIs
        self._analyze_routes_apis()
        
        # Verificar banco de dados
        self._analyze_database_structure()
        
        # Gerar relatório
        self._generate_report()

    def _analyze_project_structure(self):
        """Analisa a estrutura do projeto"""
        self.logger.info("Analisando estrutura do projeto...")
        
        required_dirs = [
            'src', 'backend', 'backend/routes', 'backend/config',
            'backend/middleware', 'src/components', 'src/services'
        ]
        
        for dir_path in required_dirs:
            full_path = self.project_root / dir_path
            if not full_path.exists():
                self.errors.append(f"Diretório obrigatório não encontrado: {dir_path}")
            else:
                self.info.append(f"Diretório encontrado: {dir_path}")

    def _analyze_config_files(self):
        """Analisa arquivos de configuração"""
        self.logger.info("Analisando arquivos de configuração...")
        
        config_files = [
            'package.json', 'vite.config.ts', 'tsconfig.json',
            'backend/package.json', '.env', 'backend/.env'
        ]
        
        for config_file in config_files:
            file_path = self.project_root / config_file
            if file_path.exists():
                self.info.append(f"Arquivo de configuração encontrado: {config_file}")
                self._analyze_file_content(file_path)
            else:
                self.warnings.append(f"Arquivo de configuração não encontrado: {config_file}")

    def _analyze_js_ts_files(self):
        """Analisa arquivos JavaScript/TypeScript"""
        self.logger.info("Analisando arquivos JS/TS...")
        
        patterns = ['**/*.js', '**/*.ts', '**/*.tsx', '**/*.jsx']
        
        for pattern in patterns:
            for file_path in self.project_root.glob(pattern):
                if 'node_modules' in str(file_path):
                    continue
                    
                self.stats['total_files'] += 1
                
                if file_path.suffix == '.js':
                    self.stats['js_files'] += 1
                elif file_path.suffix == '.ts':
                    self.stats['ts_files'] += 1
                elif file_path.suffix == '.tsx':
                    self.stats['tsx_files'] += 1
                
                self._analyze_js_ts_file(file_path)

    def _analyze_js_ts_file(self, file_path: Path):
        """Analisa um arquivo JS/TS específico"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                lines = content.split('\n')
                self.stats['total_lines'] += len(lines)
                
                # Verificar imports
                imports = re.findall(r'import\s+.*?from\s+[\'"]([^\'"]+)[\'"]', content)
                self.stats['imports_found'] += len(imports)
                
                # Verificar funções
                functions = re.findall(r'(?:function\s+(\w+)|const\s+(\w+)\s*=.*?=>|(\w+)\s*:\s*\([^)]*\)\s*=>)', content)
                self.stats['functions_found'] += len(functions)
                
                # Verificar classes
                classes = re.findall(r'class\s+(\w+)', content)
                self.stats['classes_found'] += len(classes)
                
                # Verificar erros comuns
                self._check_common_js_errors(file_path, content, lines)
                
        except Exception as e:
            self.errors.append(f"Erro ao analisar {file_path}: {str(e)}")

    def _check_common_js_errors(self, file_path: Path, content: str, lines: List[str]):
        """Verifica erros comuns em JS/TS"""
        
        # Verificar console.log em produção
        if 'console.log' in content:
            self.warnings.append(f"{file_path}: console.log encontrado (remover em produção)")
        
        # Verificar TODO/FIXME
        for i, line in enumerate(lines, 1):
            if 'TODO' in line or 'FIXME' in line:
                self.warnings.append(f"{file_path}:{i}: {line.strip()}")
        
        # Verificar imports não utilizados (básico)
        imports = re.findall(r'import\s+\{([^}]+)\}', content)
        for import_match in imports:
            imported_items = [item.strip() for item in import_match.split(',')]
            for item in imported_items:
                if item not in content.replace(f'import {{ {import_match} }}', ''):
                    self.warnings.append(f"{file_path}: Import possivelmente não utilizado: {item}")

    def _analyze_python_files(self):
        """Analisa arquivos Python"""
        self.logger.info("Analisando arquivos Python...")
        
        for file_path in self.project_root.glob('**/*.py'):
            if 'venv' in str(file_path) or '__pycache__' in str(file_path):
                continue
                
            self.stats['py_files'] += 1
            self._analyze_python_file(file_path)

    def _analyze_python_file(self, file_path: Path):
        """Analisa um arquivo Python específico"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                
            # Verificar sintaxe Python
            try:
                ast.parse(content)
                self.info.append(f"Sintaxe Python válida: {file_path}")
            except SyntaxError as e:
                self.errors.append(f"Erro de sintaxe Python em {file_path}: {str(e)}")
                
        except Exception as e:
            self.errors.append(f"Erro ao analisar Python {file_path}: {str(e)}")

    def _analyze_dependencies(self):
        """Analisa dependências do projeto"""
        self.logger.info("Analisando dependências...")
        
        # Frontend dependencies
        frontend_package = self.project_root / 'package.json'
        if frontend_package.exists():
            self._check_package_json(frontend_package, "Frontend")
        
        # Backend dependencies
        backend_package = self.project_root / 'backend' / 'package.json'
        if backend_package.exists():
            self._check_package_json(backend_package, "Backend")

    def _check_package_json(self, package_path: Path, context: str):
        """Verifica package.json"""
        try:
            with open(package_path, 'r', encoding='utf-8') as f:
                package_data = json.load(f)
            
            # Verificar dependências
            deps = package_data.get('dependencies', {})
            dev_deps = package_data.get('devDependencies', {})
            
            self.info.append(f"{context} - Dependências: {len(deps)}")
            self.info.append(f"{context} - Dev Dependencies: {len(dev_deps)}")
            
            # Verificar scripts
            scripts = package_data.get('scripts', {})
            required_scripts = ['start', 'build']
            
            for script in required_scripts:
                if script not in scripts:
                    self.warnings.append(f"{context} - Script obrigatório não encontrado: {script}")
                    
        except Exception as e:
            self.errors.append(f"Erro ao analisar {package_path}: {str(e)}")

    def _analyze_routes_apis(self):
        """Analisa rotas e APIs"""
        self.logger.info("Analisando rotas e APIs...")
        
        routes_dir = self.project_root / 'backend' / 'routes'
        if routes_dir.exists():
            for route_file in routes_dir.glob('*.js'):
                self._analyze_route_file(route_file)

    def _analyze_route_file(self, route_file: Path):
        """Analisa arquivo de rota"""
        try:
            with open(route_file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Verificar rotas definidas
            routes = re.findall(r'router\.(get|post|put|delete|patch)\s*\([\'"]([^\'"]+)[\'"]', content)
            
            if routes:
                self.info.append(f"Rotas encontradas em {route_file.name}: {len(routes)}")
                for method, path in routes:
                    self.info.append(f"  {method.upper()} {path}")
            else:
                self.warnings.append(f"Nenhuma rota encontrada em {route_file.name}")
                
        except Exception as e:
            self.errors.append(f"Erro ao analisar rota {route_file}: {str(e)}")

    def _analyze_database_structure(self):
        """Analisa estrutura do banco de dados"""
        self.logger.info("Analisando estrutura do banco...")
        
        # Verificar arquivos SQL
        sql_files = list(self.project_root.glob('**/*.sql'))
        if sql_files:
            self.info.append(f"Arquivos SQL encontrados: {len(sql_files)}")
            for sql_file in sql_files:
                self.info.append(f"  {sql_file}")
        else:
            self.warnings.append("Nenhum arquivo SQL encontrado")

    def _analyze_file_content(self, file_path: Path):
        """Analisa conteúdo de arquivo genérico"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                lines = len(content.split('\n'))
                self.stats['total_lines'] += lines
                
        except Exception as e:
            self.errors.append(f"Erro ao ler {file_path}: {str(e)}")

    def _generate_report(self):
        """Gera relatório completo"""
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        report_file = self.project_root / f"code_analysis_report_{timestamp}.txt"
        
        with open(report_file, 'w', encoding='utf-8') as f:
            f.write("=" * 80 + "\n")
            f.write("RELATÓRIO DE ANÁLISE DE CÓDIGO - TVBOX3\n")
            f.write("=" * 80 + "\n")
            f.write(f"Data/Hora: {datetime.datetime.now().strftime('%d/%m/%Y %H:%M:%S')}\n")
            f.write(f"Projeto: {self.project_root}\n\n")
            
            # Estatísticas
            f.write("ESTATÍSTICAS DO PROJETO\n")
            f.write("-" * 40 + "\n")
            for key, value in self.stats.items():
                f.write(f"{key.replace('_', ' ').title()}: {value}\n")
            f.write("\n")
            
            # Erros
            f.write("ERROS ENCONTRADOS\n")
            f.write("-" * 40 + "\n")
            if self.errors:
                for i, error in enumerate(self.errors, 1):
                    f.write(f"{i}. {error}\n")
            else:
                f.write("Nenhum erro encontrado!\n")
            f.write("\n")
            
            # Avisos
            f.write("AVISOS E MELHORIAS\n")
            f.write("-" * 40 + "\n")
            if self.warnings:
                for i, warning in enumerate(self.warnings, 1):
                    f.write(f"{i}. {warning}\n")
            else:
                f.write("Nenhum aviso!\n")
            f.write("\n")
            
            # Informações
            f.write("INFORMAÇÕES GERAIS\n")
            f.write("-" * 40 + "\n")
            for info in self.info:
                f.write(f"• {info}\n")
        
        self.logger.info(f"Relatório gerado: {report_file}")
        return report_file

def main():
    """Função principal"""
    project_root = os.path.dirname(os.path.abspath(__file__))
    analyzer = CodeAnalyzer(project_root)
    analyzer.analyze_project()
    
    print("\n" + "=" * 60)
    print("ANÁLISE DE CÓDIGO CONCLUÍDA!")
    print("=" * 60)
    print(f"Erros encontrados: {len(analyzer.errors)}")
    print(f"Avisos: {len(analyzer.warnings)}")
    print(f"Total de arquivos analisados: {analyzer.stats['total_files']}")
    print(f"Total de linhas: {analyzer.stats['total_lines']}")
    print("\nVerifique o arquivo de relatório gerado para detalhes completos.")

if __name__ == "__main__":
    main()