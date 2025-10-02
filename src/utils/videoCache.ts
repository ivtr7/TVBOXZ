/**
 * Sistema de cache de vídeo usando IndexedDB
 * Permite armazenamento local de vídeos para melhor performance e economia de banda
 */

export interface CachedVideo {
  id: string;
  url: string;
  blob: Blob;
  size: number;
  mimeType: string;
  cachedAt: number;
  lastAccessed: number;
  expiresAt?: number;
  metadata?: {
    duration?: number;
    width?: number;
    height?: number;
    bitrate?: number;
  };
}

export interface CacheStats {
  totalSize: number;
  totalVideos: number;
  availableSpace: number;
  cacheHitRate: number;
}

class VideoCache {
  private dbName = 'TVBoxVideoCache';
  private dbVersion = 1;
  private storeName = 'videos';
  private db: IDBDatabase | null = null;
  private maxCacheSize = 500 * 1024 * 1024; // 500MB padrão
  private maxVideoAge = 7 * 24 * 60 * 60 * 1000; // 7 dias
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(maxCacheSizeMB = 500) {
    this.maxCacheSize = maxCacheSizeMB * 1024 * 1024;
    this.initDB();
  }

  /**
   * Inicializa o banco de dados IndexedDB
   */
  private async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('url', 'url', { unique: true });
          store.createIndex('cachedAt', 'cachedAt');
          store.createIndex('lastAccessed', 'lastAccessed');
          store.createIndex('size', 'size');
        }
      };
    });
  }

  /**
   * Verifica se um vídeo está em cache
   */
  async isVideoCached(videoId: string): Promise<boolean> {
    if (!this.db) await this.initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(videoId);

      request.onsuccess = () => {
        const result = request.result as CachedVideo | undefined;
        if (result && !this.isExpired(result)) {
          resolve(true);
        } else {
          resolve(false);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Obtém um vídeo do cache
   */
  async getVideo(videoId: string): Promise<string | null> {
    if (!this.db) await this.initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(videoId);

      request.onsuccess = () => {
        const result = request.result as CachedVideo | undefined;
        
        if (!result || this.isExpired(result)) {
          this.cacheMisses++;
          resolve(null);
          return;
        }

        // Atualiza último acesso
        result.lastAccessed = Date.now();
        store.put(result);
        
        // Cria URL do blob
        const blobUrl = URL.createObjectURL(result.blob);
        this.cacheHits++;
        resolve(blobUrl);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Armazena um vídeo no cache
   */
  async cacheVideo(videoId: string, url: string, progressCallback?: (progress: number) => void): Promise<string> {
    if (!this.db) await this.initDB();
    
    try {
      // Verifica se já está em cache
      const cachedUrl = await this.getVideo(videoId);
      if (cachedUrl) {
        return cachedUrl;
      }

      // Download do vídeo com progress
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch video: ${response.statusText}`);
      }

      const contentLength = parseInt(response.headers.get('content-length') || '0');
      const reader = response.body?.getReader();
      
      if (!reader) {
        throw new Error('Failed to get response reader');
      }

      const chunks: Uint8Array[] = [];
      let receivedLength = 0;

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        chunks.push(value);
        receivedLength += value.length;
        
        if (progressCallback && contentLength > 0) {
          progressCallback((receivedLength / contentLength) * 100);
        }
      }

      // Combina chunks em um único array
      const allChunks = new Uint8Array(receivedLength);
      let position = 0;
      for (const chunk of chunks) {
        allChunks.set(chunk, position);
        position += chunk.length;
      }

      const mimeType = response.headers.get('content-type') || 'video/mp4';
      const blob = new Blob([allChunks], { type: mimeType });
      
      // Verifica espaço disponível
      await this.ensureSpace(blob.size);

      // Salva no cache
      const cachedVideo: CachedVideo = {
        id: videoId,
        url,
        blob,
        size: blob.size,
        mimeType,
        cachedAt: Date.now(),
        lastAccessed: Date.now(),
        expiresAt: Date.now() + this.maxVideoAge
      };

      await this.saveToCache(cachedVideo);
      
      return URL.createObjectURL(blob);
    } catch (error) {
      console.error('Error caching video:', error);
      throw error;
    }
  }

  /**
   * Salva vídeo no IndexedDB
   */
  private async saveToCache(video: CachedVideo): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(video);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Garante que há espaço suficiente no cache
   */
  private async ensureSpace(requiredSize: number): Promise<void> {
    const stats = await this.getCacheStats();
    
    if (stats.totalSize + requiredSize <= this.maxCacheSize) {
      return; // Espaço suficiente
    }

    // Remove vídeos mais antigos até ter espaço
    const videos = await this.getAllVideos();
    videos.sort((a, b) => a.lastAccessed - b.lastAccessed);

    let freedSpace = 0;
    for (const video of videos) {
      if (stats.totalSize + requiredSize - freedSpace <= this.maxCacheSize) {
        break;
      }
      
      await this.removeVideo(video.id);
      freedSpace += video.size;
    }
  }

  /**
   * Remove um vídeo do cache
   */
  async removeVideo(videoId: string): Promise<void> {
    if (!this.db) await this.initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(videoId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Limpa vídeos expirados
   */
  async cleanExpiredVideos(): Promise<number> {
    const videos = await this.getAllVideos();
    let removedCount = 0;

    for (const video of videos) {
      if (this.isExpired(video)) {
        await this.removeVideo(video.id);
        removedCount++;
      }
    }

    return removedCount;
  }

  /**
   * Obtém todos os vídeos do cache
   */
  private async getAllVideos(): Promise<CachedVideo[]> {
    if (!this.db) await this.initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Verifica se um vídeo está expirado
   */
  private isExpired(video: CachedVideo): boolean {
    if (!video.expiresAt) return false;
    return Date.now() > video.expiresAt;
  }

  /**
   * Obtém estatísticas do cache
   */
  async getCacheStats(): Promise<CacheStats> {
    const videos = await this.getAllVideos();
    const totalSize = videos.reduce((sum, video) => sum + video.size, 0);
    const totalRequests = this.cacheHits + this.cacheMisses;
    const cacheHitRate = totalRequests > 0 ? (this.cacheHits / totalRequests) * 100 : 0;

    return {
      totalSize,
      totalVideos: videos.length,
      availableSpace: this.maxCacheSize - totalSize,
      cacheHitRate
    };
  }

  /**
   * Limpa todo o cache
   */
  async clearCache(): Promise<void> {
    if (!this.db) await this.initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      request.onsuccess = () => {
        this.cacheHits = 0;
        this.cacheMisses = 0;
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Pré-carrega vídeos em background
   */
  async preloadVideos(videoUrls: Array<{id: string, url: string}>, maxConcurrent = 2): Promise<void> {
    const semaphore = new Array(maxConcurrent).fill(null);
    let index = 0;

    const processNext = async (): Promise<void> => {
      if (index >= videoUrls.length) return;
      
      const video = videoUrls[index++];
      
      try {
        const isAlreadyCached = await this.isVideoCached(video.id);
        if (!isAlreadyCached) {
          await this.cacheVideo(video.id, video.url);
          console.log(`✅ Preloaded video: ${video.id}`);
        }
      } catch (error) {
        console.error(`❌ Failed to preload video ${video.id}:`, error);
      }
      
      await processNext();
    };

    // Inicia processamento paralelo
    await Promise.all(semaphore.map(() => processNext()));
  }
}

// Instância singleton
export const videoCache = new VideoCache();

// Limpa vídeos expirados automaticamente
setInterval(() => {
  videoCache.cleanExpiredVideos().then(count => {
    if (count > 0) {
      console.log(`🧹 Cleaned ${count} expired videos from cache`);
    }
  });
}, 60 * 60 * 1000); // A cada hora