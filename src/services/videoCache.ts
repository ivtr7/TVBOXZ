interface CachedVideo {
  id: string;
  url: string;
  cachedAt: number;
  metadata?: {
    quality?: string;
    size?: number;
    format?: string;
    preloaded?: boolean;
  };
}

class VideoCache {
  private cache: Map<string, CachedVideo> = new Map();
  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
  private readonly MAX_CACHE_SIZE = 50; // Maximum number of cached videos

  async cacheVideo(
    id: string, 
    url: string, 
    metadata?: CachedVideo['metadata']
  ): Promise<void> {
    try {
      // Remove oldest entries if cache is full
      if (this.cache.size >= this.MAX_CACHE_SIZE) {
        const oldestKey = this.cache.keys().next().value;
        if (oldestKey) {
          this.cache.delete(oldestKey);
        }
      }

      const cachedVideo: CachedVideo = {
        id,
        url,
        cachedAt: Date.now(),
        metadata
      };

      this.cache.set(id, cachedVideo);
      
      // Store in localStorage for persistence
      try {
        const cacheData = Array.from(this.cache.entries());
        localStorage.setItem('video_cache', JSON.stringify(cacheData));
      } catch (error) {
        console.warn('Failed to persist video cache to localStorage:', error);
      }
    } catch (error) {
      console.error('Error caching video:', error);
    }
  }

  async getCachedVideo(id: string): Promise<CachedVideo | null> {
    try {
      // Load from localStorage if cache is empty
      if (this.cache.size === 0) {
        this.loadFromStorage();
      }

      const cached = this.cache.get(id);
      
      if (!cached) {
        return null;
      }

      // Check if cache is expired
      const isExpired = Date.now() - cached.cachedAt > this.CACHE_DURATION;
      if (isExpired) {
        this.cache.delete(id);
        this.updateStorage();
        return null;
      }

      return cached;
    } catch (error) {
      console.error('Error getting cached video:', error);
      return null;
    }
  }

  clearCache(): void {
    this.cache.clear();
    localStorage.removeItem('video_cache');
  }

  clearExpiredCache(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, video] of this.cache.entries()) {
      if (now - video.cachedAt > this.CACHE_DURATION) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => this.cache.delete(key));
    
    if (expiredKeys.length > 0) {
      this.updateStorage();
    }
  }

  getCacheSize(): number {
    return this.cache.size;
  }

  getCacheInfo(): { size: number; entries: CachedVideo[] } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.values())
    };
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem('video_cache');
      if (stored) {
        const cacheData = JSON.parse(stored) as [string, CachedVideo][];
        this.cache = new Map(cacheData);
        
        // Clean expired entries on load
        this.clearExpiredCache();
      }
    } catch (error) {
      console.error('Error loading video cache from storage:', error);
      this.cache.clear();
    }
  }

  private updateStorage(): void {
    try {
      const cacheData = Array.from(this.cache.entries());
      localStorage.setItem('video_cache', JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to update video cache in localStorage:', error);
    }
  }

  // Preload video for faster access
  async preloadVideo(id: string, url: string): Promise<boolean> {
    try {
      // Create a hidden video element to preload
      const video = document.createElement('video');
      video.src = url;
      video.preload = 'metadata';
      video.muted = true;
      video.style.display = 'none';
      
      return new Promise((resolve) => {
        const cleanup = () => {
          document.body.removeChild(video);
        };

        video.addEventListener('loadedmetadata', () => {
          this.cacheVideo(id, url, { preloaded: true });
          cleanup();
          resolve(true);
        });

        video.addEventListener('error', () => {
          cleanup();
          resolve(false);
        });

        document.body.appendChild(video);
        
        // Timeout after 10 seconds
        setTimeout(() => {
          cleanup();
          resolve(false);
        }, 10000);
      });
    } catch (error) {
      console.error('Error preloading video:', error);
      return false;
    }
  }
}

// Create singleton instance
export const videoCache = new VideoCache();

// Clean expired cache every 5 minutes
setInterval(() => {
  videoCache.clearExpiredCache();
}, 5 * 60 * 1000);

export default videoCache;