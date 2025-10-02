/**
 * Utilitário para detecção de compatibilidade de vídeo e otimização
 * Suporta detecção de formatos, codecs e capacidades do navegador
 */

export interface VideoFormat {
  extension: string;
  mimeType: string;
  codec?: string;
  priority: number; // Menor número = maior prioridade
}

export interface VideoCapabilities {
  supportsH264: boolean;
  supportsWebM: boolean;
  supportsOGV: boolean;
  supportsHEVC: boolean;
  supportsAV1: boolean;
  preferredFormat: VideoFormat;
  supportedFormats: VideoFormat[];
}

// Formatos de vídeo suportados em ordem de prioridade
export const VIDEO_FORMATS: VideoFormat[] = [
  {
    extension: 'mp4',
    mimeType: 'video/mp4',
    codec: 'avc1.42E01E, mp4a.40.2', // H.264 Baseline + AAC
    priority: 1
  },
  {
    extension: 'webm',
    mimeType: 'video/webm',
    codec: 'vp8, vorbis',
    priority: 2
  },
  {
    extension: 'webm',
    mimeType: 'video/webm',
    codec: 'vp9, opus',
    priority: 3
  },
  {
    extension: 'ogv',
    mimeType: 'video/ogg',
    codec: 'theora, vorbis',
    priority: 4
  },
  {
    extension: 'mp4',
    mimeType: 'video/mp4',
    codec: 'hev1.1.6.L93.B0', // HEVC/H.265
    priority: 5
  },
  {
    extension: 'mp4',
    mimeType: 'video/mp4',
    codec: 'av01.0.04M.08', // AV1
    priority: 6
  }
];

/**
 * Detecta as capacidades de vídeo do navegador atual
 */
export function detectVideoCapabilities(): VideoCapabilities {
  const video = document.createElement('video');
  const supportedFormats: VideoFormat[] = [];
  
  // Testa cada formato
  for (const format of VIDEO_FORMATS) {
    const mimeTypeWithCodec = format.codec 
      ? `${format.mimeType}; codecs="${format.codec}"`
      : format.mimeType;
    
    const canPlay = video.canPlayType(mimeTypeWithCodec);
    
    if (canPlay === 'probably' || canPlay === 'maybe') {
      supportedFormats.push(format);
    }
  }
  
  // Ordena por prioridade
  supportedFormats.sort((a, b) => a.priority - b.priority);
  
  const capabilities: VideoCapabilities = {
    supportsH264: supportedFormats.some(f => f.codec?.includes('avc1')),
    supportsWebM: supportedFormats.some(f => f.mimeType === 'video/webm'),
    supportsOGV: supportedFormats.some(f => f.mimeType === 'video/ogg'),
    supportsHEVC: supportedFormats.some(f => f.codec?.includes('hev1')),
    supportsAV1: supportedFormats.some(f => f.codec?.includes('av01')),
    preferredFormat: supportedFormats[0] || VIDEO_FORMATS[0],
    supportedFormats
  };
  
  return capabilities;
}

export interface VideoFallback {
  url: string;
  format: string;
  quality: string;
  compatibility: string;
  codecs?: string[];
}

/**
 * Gera URLs de fallback para um vídeo em diferentes formatos
 */
export function generateVideoFallbacks(baseUrl: string, filename: string): string[] {
  const capabilities = detectVideoCapabilities();
  const fallbacks: string[] = [];
  
  // Remove extensão do filename se existir
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
  
  // Gera URLs para formatos suportados
  for (const format of capabilities.supportedFormats) {
    fallbacks.push(`${baseUrl}/${nameWithoutExt}.${format.extension}`);
  }
  
  // Adiciona URL original como último fallback
  if (!fallbacks.includes(`${baseUrl}/${filename}`)) {
    fallbacks.push(`${baseUrl}/${filename}`);
  }
  
  return fallbacks;
}

// Generate comprehensive video fallbacks for maximum compatibility
export const generateAdvancedVideoFallbacks = (originalUrl: string, capabilities: VideoCapabilities): VideoFallback[] => {
  const fallbacks: VideoFallback[] = [];
  const baseUrl = originalUrl.replace(/\.[^/.]+$/, ''); // Remove extension
  
  // Define format priorities based on compatibility and quality
  const formatPriorities = {
    'mp4': { priority: 1, codecs: ['avc1.42E01E', 'mp4a.40.2'] },
    'webm': { priority: 2, codecs: ['vp8', 'vp9', 'vorbis', 'opus'] },
    'ogv': { priority: 3, codecs: ['theora', 'vorbis'] },
    'mov': { priority: 4, codecs: ['avc1.42E01E', 'mp4a.40.2'] },
    'avi': { priority: 5, codecs: ['xvid', 'mp3'] }
  };
  
  // Quality variants for each format
  const qualityVariants = ['1080p', '720p', '480p', '360p', '240p'];
  
  // Generate fallbacks for supported formats
  capabilities.supportedFormats
    .sort((a, b) => a.priority - b.priority)
    .forEach(format => {
      // Add quality variants if available
      qualityVariants.forEach(quality => {
        fallbacks.push({
          url: `${baseUrl}_${quality}.${format.extension}`,
          format: format.extension,
          quality,
          compatibility: 'supported',
          codecs: format.codec ? [format.codec] : []
        });
      });
      
      // Add standard version without quality suffix
      fallbacks.push({
        url: `${baseUrl}.${format.extension}`,
        format: format.extension,
        quality: 'auto',
        compatibility: 'supported',
        codecs: format.codec ? [format.codec] : []
      });
    });
  
  // Add original URL as final fallback
  const originalFormat = originalUrl.split('.').pop()?.toLowerCase() || 'mp4';
  fallbacks.push({
    url: originalUrl,
    format: originalFormat,
    quality: 'original',
    compatibility: 'unknown',
    codecs: []
  });
  
  return fallbacks;
};

// Test video format compatibility
export const testVideoFormat = async (url: string, format: string): Promise<boolean> => {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.muted = true;
    video.preload = 'metadata';
    
    const timeout = setTimeout(() => {
      video.remove();
      resolve(false);
    }, 5000);
    
    video.addEventListener('loadedmetadata', () => {
      clearTimeout(timeout);
      video.remove();
      resolve(true);
    });
    
    video.addEventListener('error', () => {
      clearTimeout(timeout);
      video.remove();
      resolve(false);
    });
    
    video.src = url;
  });
};

// Get best video format based on testing
export const getBestVideoFormat = async (fallbacks: VideoFallback[]): Promise<VideoFallback | null> => {
  for (const fallback of fallbacks) {
    try {
      const isSupported = await testVideoFormat(fallback.url, fallback.format);
      if (isSupported) {
        return fallback;
      }
    } catch (error) {
      console.warn(`Failed to test format ${fallback.format}:`, error);
      continue;
    }
  }
  
  return fallbacks[fallbacks.length - 1] || null; // Return original as last resort
};

/**
 * Verifica se um formato de vídeo é suportado
 */
export function isVideoFormatSupported(mimeType: string, codec?: string): boolean {
  const video = document.createElement('video');
  const fullMimeType = codec ? `${mimeType}; codecs="${codec}"` : mimeType;
  const canPlay = video.canPlayType(fullMimeType);
  return canPlay === 'probably' || canPlay === 'maybe';
}

/**
 * Otimiza configurações de vídeo baseado no dispositivo
 */
export function getOptimalVideoSettings() {
  const isLowEndDevice = navigator.hardwareConcurrency <= 2;
  const isSlowConnection = (navigator as any).connection?.effectiveType === 'slow-2g' || 
                          (navigator as any).connection?.effectiveType === '2g';
  
  return {
    preload: isSlowConnection ? 'metadata' : 'auto',
    quality: isLowEndDevice ? 'low' : 'high',
    bufferSize: isSlowConnection ? 5 : 15, // segundos
    enableHardwareAcceleration: !isLowEndDevice,
    maxConcurrentDownloads: isSlowConnection ? 1 : 3
  };
}

/**
 * Detecta se o dispositivo suporta hardware acceleration
 */
export function supportsHardwareAcceleration(): boolean {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  
  if (!gl) return false;
  
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
  if (!debugInfo) return false;
  
  const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
  
  // Detecta GPUs conhecidas que suportam aceleração de vídeo
  const hardwareAcceleratedGPUs = [
    'nvidia', 'amd', 'intel', 'mali', 'adreno', 'powervr'
  ];
  
  return hardwareAcceleratedGPUs.some(gpu => 
    renderer.toLowerCase().includes(gpu)
  );
}

/**
 * Log de capacidades do dispositivo para debug
 */
export function logVideoCapabilities(): void {
  const capabilities = detectVideoCapabilities();
  const settings = getOptimalVideoSettings();
  const hwAccel = supportsHardwareAcceleration();
  
  console.group('🎥 Video Capabilities');
  console.log('Supported Formats:', capabilities.supportedFormats.map(f => f.extension));
  console.log('Preferred Format:', capabilities.preferredFormat);
  console.log('H.264 Support:', capabilities.supportsH264);
  console.log('WebM Support:', capabilities.supportsWebM);
  console.log('Hardware Acceleration:', hwAccel);
  console.log('Optimal Settings:', settings);
  console.groupEnd();
}