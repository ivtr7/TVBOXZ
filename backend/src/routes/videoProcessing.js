import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import videoProcessor from '../utils/videoProcessor.js';
import { broadcastToDevice } from '../../websocket/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configuração do multer para upload de vídeos
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/original');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
    } catch (error) {
      console.error('Erro ao criar diretório de upload:', error);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `video-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /\.(mp4|avi|mov|wmv|flv|webm|mkv)$/i;
    if (allowedTypes.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Formato de vídeo não suportado'));
    }
  }
});

// Upload e processamento de vídeo
router.post('/upload', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    const { title, description, category } = req.body;
    const videoId = `video_${Date.now()}`;
    const inputPath = req.file.path;

    // Opções de processamento
    const processingOptions = {
      qualities: req.body.qualities ? req.body.qualities.split(',') : ['mobile', 'tablet', 'desktop', 'tvbox'],
      formats: req.body.formats ? req.body.formats.split(',') : ['mp4', 'webm'],
      generateHLS: req.body.generateHLS !== 'false'
    };

    // Inicia processamento assíncrono
    const processingResult = await videoProcessor.processVideo(
      inputPath,
      videoId,
      processingOptions
    );

    // Gera thumbnail
    const thumbnailPath = path.join(
      path.dirname(inputPath),
      '../thumbnails',
      `${videoId}_thumb.jpg`
    );
    
    try {
      await fs.mkdir(path.dirname(thumbnailPath), { recursive: true });
      await videoProcessor.generateThumbnail(inputPath, thumbnailPath);
    } catch (thumbError) {
      console.error('Erro ao gerar thumbnail:', thumbError);
    }

    // Salva informações no banco (simulado)
    const videoData = {
      id: videoId,
      title: title || req.file.originalname,
      description: description || '',
      category: category || 'general',
      originalFile: req.file.filename,
      originalSize: req.file.size,
      thumbnail: `${videoId}_thumb.jpg`,
      processingId: processingResult.processingId,
      outputs: processingResult.outputs,
      originalInfo: processingResult.originalInfo,
      uploadedAt: new Date().toISOString(),
      status: 'processed'
    };

    // Notifica dispositivos sobre novo vídeo
    broadcastToDevice('all', {
      type: 'VIDEO_UPLOADED',
      data: {
        videoId,
        title: videoData.title,
        thumbnail: videoData.thumbnail,
        formats: processingResult.outputs.map(o => ({
          quality: o.quality,
          format: o.format,
          size: o.size
        }))
      }
    });

    res.json({
      success: true,
      video: videoData,
      message: 'Vídeo processado com sucesso'
    });

  } catch (error) {
    console.error('Erro no processamento:', error);
    res.status(500).json({
      error: 'Erro no processamento do vídeo',
      details: error.message
    });
  }
});

// Verifica status do processamento
router.get('/processing/:processingId', (req, res) => {
  const { processingId } = req.params;
  const status = videoProcessor.getProcessingStatus(processingId);
  
  if (!status) {
    return res.status(404).json({ error: 'Processamento não encontrado' });
  }
  
  res.json(status);
});

// Lista vídeos processados
router.get('/videos', async (req, res) => {
  try {
    // Em uma implementação real, isso viria do banco de dados
    const processedDir = path.join(__dirname, '../../uploads/processed');
    const files = await fs.readdir(processedDir);
    
    const videos = [];
    const videoGroups = {};
    
    // Agrupa arquivos por videoId
    for (const file of files) {
      const match = file.match(/^(.+?)_(.+?)\.(mp4|webm|m3u8)$/);
      if (match) {
        const [, videoId, quality] = match;
        if (!videoGroups[videoId]) {
          videoGroups[videoId] = {
            id: videoId,
            formats: []
          };
        }
        
        const filePath = path.join(processedDir, file);
        const stats = await fs.stat(filePath);
        
        videoGroups[videoId].formats.push({
          quality,
          format: path.extname(file).substring(1),
          file,
          size: stats.size,
          url: `/api/video-processing/stream/${file}`
        });
      }
    }
    
    res.json(Object.values(videoGroups));
    
  } catch (error) {
    console.error('Erro ao listar vídeos:', error);
    res.status(500).json({ error: 'Erro ao listar vídeos' });
  }
});

// Stream de vídeo otimizado
router.get('/stream/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(__dirname, '../../uploads/processed', filename);
    
    // Verifica se o arquivo existe
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({ error: 'Arquivo não encontrado' });
    }
    
    const stat = await fs.stat(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;
    
    if (range) {
      // Streaming com range (para suporte a seek)
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      
      const readStream = require('fs').createReadStream(filePath, { start, end });
      
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4',
        'Cache-Control': 'public, max-age=31536000'
      });
      
      readStream.pipe(res);
    } else {
      // Streaming completo
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
        'Cache-Control': 'public, max-age=31536000'
      });
      
      require('fs').createReadStream(filePath).pipe(res);
    }
    
  } catch (error) {
    console.error('Erro no streaming:', error);
    res.status(500).json({ error: 'Erro no streaming do vídeo' });
  }
});

// Otimiza vídeo existente
router.post('/optimize/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    const { targetSize, quality } = req.body;
    
    const originalPath = path.join(__dirname, '../../uploads/original', `${videoId}.mp4`);
    const optimizedPath = path.join(__dirname, '../../uploads/processed', `${videoId}_optimized.mp4`);
    
    const result = await videoProcessor.optimizeVideo(
      originalPath,
      optimizedPath,
      targetSize || 50 * 1024 * 1024 // 50MB padrão
    );
    
    res.json({
      success: true,
      optimizedFile: path.basename(result),
      message: 'Vídeo otimizado com sucesso'
    });
    
  } catch (error) {
    console.error('Erro na otimização:', error);
    res.status(500).json({
      error: 'Erro na otimização do vídeo',
      details: error.message
    });
  }
});

// Informações detalhadas do vídeo
router.get('/info/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(__dirname, '../../uploads/processed', filename);
    
    const videoInfo = await videoProcessor.getVideoInfo(filePath);
    
    res.json({
      filename,
      info: videoInfo,
      url: `/api/video-processing/stream/${filename}`
    });
    
  } catch (error) {
    console.error('Erro ao obter informações:', error);
    res.status(500).json({ error: 'Erro ao obter informações do vídeo' });
  }
});

// Recomendações de formato baseadas no user-agent
router.get('/recommend/:videoId', (req, res) => {
  const { videoId } = req.params;
  const userAgent = req.headers['user-agent'] || '';
  
  let recommendations = {
    primary: 'mp4',
    fallbacks: ['webm'],
    quality: 'desktop'
  };
  
  // Detecção básica de dispositivo
  if (/Mobile|Android|iPhone|iPad/i.test(userAgent)) {
    recommendations.quality = 'mobile';
    recommendations.primary = 'mp4';
  } else if (/Chrome/i.test(userAgent)) {
    recommendations.primary = 'webm';
    recommendations.fallbacks = ['mp4'];
  } else if (/Safari/i.test(userAgent) && !/Chrome/i.test(userAgent)) {
    recommendations.primary = 'mp4';
    recommendations.fallbacks = ['webm'];
  }
  
  res.json({
    videoId,
    recommendations,
    userAgent: userAgent.substring(0, 100) // Trunca para segurança
  });
});

export default router;