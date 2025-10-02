# URLs para Acesso aos Vídeos no TVBox

## Estrutura de URLs do Sistema

### Backend API (Porta 3001)
- **Base URL**: `http://localhost:3001`
- **Uploads**: `http://localhost:3001/uploads`

### Frontend Dashboard (Porta 5173)
- **Base URL**: `http://localhost:5173`
- **Login Admin**: `http://localhost:5173/admin/login`
- **Dashboard Admin**: `http://localhost:5173/admin/dashboard`

## Endpoints da API

### Autenticação
- **POST** `/api/auth/login` - Login de usuários
- **POST** `/api/auth/register` - Registro de usuários

### Dispositivos
- **GET** `/api/devices` - Listar todos os dispositivos
- **POST** `/api/devices/register` - Registrar novo dispositivo
- **GET** `/api/devices/:id/status` - Status de um dispositivo
- **GET** `/api/devices/:id/info` - Informações de um dispositivo
- **GET** `/api/devices/:id/playlist` - Playlist de um dispositivo

### Conteúdo
- **GET** `/api/content` - Listar conteúdos (público)
- **POST** `/api/content` - Upload de conteúdo (requer autenticação)
- **DELETE** `/api/content/:id` - Deletar conteúdo (requer autenticação)

### Sistema
- **GET** `/api/system/status` - Status do sistema (requer role admin)
- **GET** `/api/system/logs` - Logs do sistema (requer role admin)

## Acesso aos Arquivos de Vídeo

### Estrutura de Diretórios
```
C:\xampp\htdocs\tvbox2\backend\uploads\
├── videos/          # Vídeos principais
├── images/          # Imagens e thumbnails
├── audio/           # Arquivos de áudio
└── documents/       # Documentos diversos
```

### URLs de Acesso Direto
- **Vídeos**: `http://localhost:3001/uploads/videos/[nome-do-arquivo]`
- **Imagens**: `http://localhost:3001/uploads/images/[nome-do-arquivo]`
- **Áudio**: `http://localhost:3001/uploads/audio/[nome-do-arquivo]`

### Exemplo de URLs
```
http://localhost:3001/uploads/videos/video-promocional.mp4
http://localhost:3001/uploads/images/thumbnail-video.jpg
http://localhost:3001/uploads/audio/background-music.mp3
```

## Configuração para TVBox

### URL Base para Dispositivos
Os dispositivos TVBox devem ser configurados para acessar:
- **API Base**: `http://[IP-DO-SERVIDOR]:3001`
- **Conteúdo**: `http://[IP-DO-SERVIDOR]:3001/uploads`

### Exemplo de Configuração
```json
{
  "server_url": "http://192.168.1.100:3001",
  "api_endpoints": {
    "content": "/api/content",
    "devices": "/api/devices",
    "register": "/api/devices/register"
  },
  "media_base_url": "http://192.168.1.100:3001/uploads"
}
```

## Credenciais de Teste

### Usuário Admin
- **Email**: `test@test.com`
- **Senha**: `test123`

### Banco de Dados
- **Host**: `localhost`
- **Database**: `tvbox_db`
- **User**: `root`
- **Password**: (vazio)

## Notas Importantes

1. **CORS**: O backend está configurado para aceitar requisições de qualquer origem durante o desenvolvimento
2. **Rate Limiting**: Há limitação de taxa ativa para prevenir abuso
3. **WebSocket**: Comunicação em tempo real ativa na porta 3001
4. **Uploads**: Máximo de 100MB por arquivo
5. **Formatos Suportados**: MP4, AVI, MOV, JPG, PNG, MP3, WAV

## Troubleshooting

### Problemas Comuns
1. **Erro 404 em /api/devices**: Verificar se o backend está rodando na porta 3001
2. **Erro de CORS**: Verificar configuração de CORS no backend
3. **Erro de autenticação**: Verificar se o token JWT está sendo enviado corretamente
4. **Arquivos não carregam**: Verificar permissões da pasta uploads

### Logs
- **Backend**: Console do terminal onde `npm run dev` está rodando
- **Frontend**: Console do navegador (F12)
- **Banco**: Logs do MySQL no XAMPP