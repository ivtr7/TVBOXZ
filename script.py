import os

# --- Configuração ---
# Define os caminhos absolutos para os arquivos que serão modificados.
# Altere este caminho base se o seu projeto não estiver em c:\xampp\htdocs\TVBOX3
PROJECT_BASE_PATH = r"c:\xampp\htdocs\TVBOX3"

VALIDATION_JS_PATH = os.path.join(PROJECT_BASE_PATH, "backend", "middleware", "validation.js")
DEVICES_JS_PATH = os.path.join(PROJECT_BASE_PATH, "backend", "routes", "devices.js")

def patch_validation_file():
    """
    Altera a regra de validação do device_uuid de .required() para .optional()
    no arquivo validation.js.
    """
    print(f"🔄 Modificando {VALIDATION_JS_PATH}...")
    try:
        with open(VALIDATION_JS_PATH, 'r', encoding='utf-8') as f:
            content = f.read()

        # Define o trecho de código a ser substituído
        old_code = (
            "    device_uuid: Joi.string()\n"
            "      .uuid({ version: 'uuidv4' })\n"
            "      .required()"
        )
        
        new_code = (
            "    device_uuid: Joi.string()\n"
            "      .uuid({ version: 'uuidv4' })\n"
            "      .optional()"
        )

        if old_code not in content:
            print("⚠️  A regra 'device_uuid' já parece ter sido alterada ou não foi encontrada. Pulando.")
            return

        # Substitui o código e salva o arquivo
        new_content = content.replace(old_code, new_code)
        
        with open(VALIDATION_JS_PATH, 'w', encoding='utf-8') as f:
            f.write(new_content)
            
        print("✅  Arquivo de validação ('validation.js') atualizado com sucesso!")

    except FileNotFoundError:
        print(f"❌ ERRO: Arquivo não encontrado em {VALIDATION_JS_PATH}. Verifique o caminho.")
    except Exception as e:
        print(f"❌ ERRO: Ocorreu um problema ao modificar o arquivo de validação: {e}")


def patch_devices_route_file():
    """
    Adiciona a importação da biblioteca uuid e modifica a rota de registro
    para gerar um UUID automaticamente se não for fornecido.
    """
    print(f"🔄 Modificando {DEVICES_JS_PATH}...")
    try:
        with open(DEVICES_JS_PATH, 'r', encoding='utf-8') as f:
            lines = f.readlines()

        # --- 1. Adicionar importação do uuid ---
        import_line_index = -1
        for i, line in enumerate(lines):
            if "import express from 'express';" in line:
                import_line_index = i
                break
        
        if import_line_index != -1 and "import { v4 as uuidv4 } from 'uuid';" not in "".join(lines):
            lines.insert(import_line_index + 1, "import { v4 as uuidv4 } from 'uuid';\n")
            print("   - Importação 'uuid' adicionada.")
        else:
            print("   - Importação 'uuid' já existe ou ponto de inserção não encontrado. Pulando.")

        # --- 2. Modificar a lógica da rota de registro ---
        content = "".join(lines)
        
        old_logic = (
            "const { name, model, tenant_id, device_uuid } = req.body;"
        )
        
        new_logic = (
            "    const { name, model, tenant_id } = req.body;\n"
            "    const device_uuid = req.body.device_uuid || uuidv4();"
        )

        if old_logic in content:
            content = content.replace(old_logic, new_logic)
            print("   - Lógica de geração de UUID na rota de registro aplicada.")
        else:
            print("   - Lógica da rota já parece ter sido alterada ou não foi encontrada. Pulando.")
        
        # Salva o arquivo final
        with open(DEVICES_JS_PATH, 'w', encoding='utf-8') as f:
            f.write(content)
            
        print("✅  Arquivo de rotas ('devices.js') atualizado com sucesso!")

    except FileNotFoundError:
        print(f"❌ ERRO: Arquivo não encontrado em {DEVICES_JS_PATH}. Verifique o caminho.")
    except Exception as e:
        print(f"❌ ERRO: Ocorreu um problema ao modificar o arquivo de rotas: {e}")


if __name__ == "__main__":
    print("--- Iniciando script de correção automática do backend ---")
    patch_validation_file()
    print("-" * 20)
    patch_devices_route_file()
    print("\n--- Script finalizado ---")
    print("Lembre-se de reiniciar o servidor do backend para que as alterações tenham efeito.")