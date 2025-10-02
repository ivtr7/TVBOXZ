import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configurações de qualidade para diferentes dispositivos
const QUALITY_PRESETS = {
  mobile: {
    width: 720,
    height: 480,
    bitrate: '800k',
    audioBitrate: '96k'
  },
  tablet: {
    width: 1280,
    height: 720,
    bitrate: '1500k',
    audioBitrate: '128k'
  },
  desktop: {
    width: 1920,
    height: 1080,
    bitrate: '3000k',
    audioBitrate: '192k'
  },
  tvbox: {
    width: 1920,
    height: 1080,
    bitrate: '2500k',
    audioBitrate: '192k'
  }
};

// Formatos de saída suportados
const OUTPUT_FORMATS = {
  mp4: {
    container: 'mp4',
    videoCodec: 'libx264',
    audioCodec: 'aac',
    extension: '.mp4'
  },
  webm: {
    container: 'webm',
    videoCodec: 'libvpx-vp9',
    audioCodec: 'libvorbis',
    extension: '.webm'
  },
  hls: {
    container: 'hls',
    videoCodec: 'libx264',
    audioCodec: 'aac',
    extension: '.m3u8'
  }
};

class VideoProcessor {
  constructor() {
    this.processingQueue = new Map();
    this.outputDir = path.join(__dirname, '../../uploads/processed');
    this.ensureOutputDir();
  }

  async ensureOutputDir() {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });
    } catch (error) {
      console.error('Erro ao criar diretório de saída:', error);
    }
  }

  // Detecta informações do vídeo
  async getVideoInfo(inputPath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }

        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        const audioStream = metadata.streams.find(s => s.codec_type === 'audio');

        resolve({
          duration: metadata.format.duration,
          size: metadata.format.size,
          bitrate: metadata.format.bit_rate,
          video: videoStream ? {
            codec: videoStream.codec_name,
            width: videoStream.width,
            height: videoStream.height,
            fps: videoStream.r_frame_rate ? eval(videoStream.r_frame_rate) : null,
            bitrate: videoStream.bit_rate
          } : null,
          audio: audioStream ? {
            codec: audioStream.codec_name,
            bitrate: audioStream.bit_rate,
            sampleRate: audioStream.sample_rate,
            channels: audioStream.channels
          } : null
        });
      });
    });
  }

  // Converte vídeo para múltiplos formatos e qualidades
  async processVideo(inputPath, videoId, options = {}) {
    const processingId = `${videoId}_${Date.now()}`;
    
    try {
      this.processingQueue.set(processingId, {
        status: 'processing',
        progress: 0,
        startTime: Date.now()
      });

      const videoInfo = await this.getVideoInfo(inputPath);
      const outputs = [];

      // Gera versões para diferentes qualidades e formatos
      const qualities = options.qualities || ['mobile', 'tablet', 'desktop', 'tvbox'];
      const formats = options.formats || ['mp4', 'webm'];

      for (const quality of qualities) {
        for (const format of formats) {
          const outputPath = await this.convertVideo(
            inputPath,
            videoId,
            quality,
            format,
            processingId
          );
          
          if (outputPath) {
            outputs.push({
              quality,
              format,
              path: outputPath,
              size: await this.getFileSize(outputPath)
            });
          }
        }
      }

      // Gera versão HLS para streaming adaptativo
      if (options.generateHLS !== false) {
        const hlsPath = await this.generateHLS(inputPath, videoId, processingId);
        if (hlsPath) {
          outputs.push({
            quality: 'adaptive',
            format: 'hls',
            path: hlsPath,
            size: await this.getFolderSize(path.dirname(hlsPath))
          });
        }
      }

      this.processingQueue.set(processingId, {
        status: 'completed',
        progress: 100,
        outputs,
        completedAt: Date.now()
      });

      return {
        processingId,
        outputs,
        originalInfo: videoInfo
      };

    } catch (error) {
      this.processingQueue.set(processingId, {
        status: 'error',
        error: error.message,
        completedAt: Date.now()
      });
      throw error;
    }
  }

  // Converte vídeo para formato e qualidade específicos
  async convertVideo(inputPath, videoId, quality, format, processingId) {
    const preset = QUALITY_PRESETS[quality];
    const formatConfig = OUTPUT_FORMATS[format];
    
    if (!preset || !formatConfig) {
      throw new Error(`Qualidade ou formato não suportado: ${quality}, ${format}`);
    }

    const outputFileName = `${videoId}_${quality}${formatConfig.extension}`;
    const outputPath = path.join(this.outputDir, outputFileName);

    return new Promise((resolve, reject) => {
      const command = ffmpeg(inputPath)
        .videoCodec(formatConfig.videoCodec)
        .audioCodec(formatConfig.audioCodec)
        .videoBitrate(preset.bitrate)
        .audioBitrate(preset.audioBitrate)
        .size(`${preset.width}x${preset.height}`)
        .format(formatConfig.container)
        .output(outputPath);

      // Otimizações específicas
      if (format === 'mp4') {
        command
          .addOption('-preset', 'fast')
          .addOption('-crf', '23')
          .addOption('-movflags', '+faststart'); // Para streaming progressivo
      } else if (format === 'webm') {
        command
          .addOption('-deadline', 'good')
          .addOption('-cpu-used', '2')
          .addOption('-crf', '30');
      }

      command
        .on('progress', (progress) => {
          const currentProgress = this.processingQueue.get(processingId);
          if (currentProgress) {
            currentProgress.progress = Math.round(progress.percent || 0);
          }
        })
        .on('end', () => {
          console.log(`Conversão concluída: ${outputFileName}`);
          resolve(outputPath);
        })
        .on('error', (err) => {
          console.error(`Erro na conversão: ${err.message}`);
          reject(err);
        })
        .run();
    });
  }

  // Gera versão HLS para streaming adaptativo
  async generateHLS(inputPath, videoId, processingId) {
    const hlsDir = path.join(this.outputDir, `${videoId}_hls`);
    const playlistPath = path.join(hlsDir, 'playlist.m3u8');

    try {
      await fs.mkdir(hlsDir, { recursive: true });
    } catch (error) {
      console.error('Erro ao criar diretório HLS:', error);
    }

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .addOption('-preset', 'fast')
        .addOption('-crf', '22')
        .addOption('-sc_threshold', '0')
        .addOption('-g', '48')
        .addOption('-keyint_min', '48')
        .addOption('-hls_time', '4')
        .addOption('-hls_playlist_type', 'vod')
        .addOption('-hls_segment_filename', path.join(hlsDir, 'segment_%03d.ts'))
        .format('hls')
        .output(playlistPath)
        .on('progress', (progress) => {
          const currentProgress = this.processingQueue.get(processingId);
          if (currentProgress) {
            currentProgress.progress = Math.round(progress.percent || 0);
          }
        })
        .on('end', () => {
          console.log(`HLS gerado: ${playlistPath}`);
          resolve(playlistPath);
        })
        .on('error', (err) => {
          console.error(`Erro ao gerar HLS: ${err.message}`);
          reject(err);
        })
        .run();
    });
  }

  // Otimiza vídeo existente (re-encoding inteligente)
  async optimizeVideo(inputPath, outputPath, targetSize) {
    const videoInfo = await this.getVideoInfo(inputPath);
    const currentSize = videoInfo.size;
    
    if (currentSize <= targetSize) {
      // Já está no tamanho adequado
      return inputPath;
    }

    const compressionRatio = targetSize / currentSize;
    const targetBitrate = Math.round(videoInfo.bitrate * compressionRatio * 0.8); // 80% para margem

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .videoBitrate(`${targetBitrate}k`)
        .addOption('-preset', 'medium')
        .addOption('-crf', '28')
        .addOption('-movflags', '+faststart')
        .output(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', reject)
        .run();
    });
  }

  // Gera thumbnail do vídeo
  async generateThumbnail(inputPath, outputPath, timeOffset = '00:00:01') {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .screenshots({
          timestamps: [timeOffset],
          filename: path.basename(outputPath),
          folder: path.dirname(outputPath),
          size: '320x240'
        })
        .on('end', () => resolve(outputPath))
        .on('error', reject);
    });
  }

  // Utilitários
  async getFileSize(filePath) {
    try {
      const stats = await fs.stat(filePath);
      return stats.size;
    } catch (error) {
      return 0;
    }
  }

  async getFolderSize(folderPath) {
    try {
      const files = await fs.readdir(folderPath);
      let totalSize = 0;
      
      for (const file of files) {
        const filePath = path.join(folderPath, file);
        const stats = await fs.stat(filePath);
        totalSize += stats.size;
      }
      
      return totalSize;
    } catch (error) {
      return 0;
    }
  }

  // Obtém status do processamento
  getProcessingStatus(processingId) {
    return this.processingQueue.get(processingId) || null;
  }

  // Remove arquivos de processamento antigos
  async cleanup(maxAge = 24 * 60 * 60 * 1000) { // 24 horas
    const now = Date.now();
    
    for (const [id, info] of this.processingQueue.entries()) {
      if (info.completedAt && (now - info.completedAt) > maxAge) {
        this.processingQueue.delete(id);
      }
    }
  }
}

// Singleton
const videoProcessor = new VideoProcessor();

// Cleanup automático
setInterval(() => {
  videoProcessor.cleanup();
}, 60 * 60 * 1000); // A cada hora

export default videoProcessor;