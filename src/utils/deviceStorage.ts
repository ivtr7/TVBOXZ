import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface DeviceDB extends DBSchema {
  device: {
    key: string;
    value: {
      deviceId: number;
      registeredAt: string;
      lastSync: string;
      name?: string;
    };
  };
  playlist: {
    key: number;
    value: {
      id: number;
      deviceId: number;
      type: 'video' | 'image';
      url: string;
      duration_seconds?: number;
      order: number;
      active: boolean;
      checksum?: string;
      cachedAt?: string;
    };
  };
  media_cache: {
    key: string;
    value: {
      url: string;
      blob: Blob;
      cachedAt: string;
      size: number;
      checksum: string;
    };
  };
}

class DeviceStorage {
  private db: IDBPDatabase<DeviceDB> | null = null;
  private readonly DB_NAME = 'tvbox-device-db';
  private readonly DB_VERSION = 1;

  async init(): Promise<void> {
    this.db = await openDB<DeviceDB>(this.DB_NAME, this.DB_VERSION, {
      upgrade(db) {
        // Device info store
        if (!db.objectStoreNames.contains('device')) {
          db.createObjectStore('device');
        }

        // Playlist store
        if (!db.objectStoreNames.contains('playlist')) {
          const playlistStore = db.createObjectStore('playlist', { keyPath: 'id' });
          playlistStore.createIndex('deviceId', 'deviceId');
          playlistStore.createIndex('order', 'order');
        }

        // Media cache store
        if (!db.objectStoreNames.contains('media_cache')) {
          const cacheStore = db.createObjectStore('media_cache');
          cacheStore.createIndex('cachedAt', 'cachedAt');
        }
      },
    });
  }

  // Device ID management
  async saveDeviceId(deviceId: number, name?: string): Promise<void> {
    if (!this.db) await this.init();
    
    const deviceInfo = {
      deviceId,
      registeredAt: new Date().toISOString(),
      lastSync: new Date().toISOString(),
      name,
    };

    await this.db!.put('device', deviceInfo, 'current');
    
    // Also save to localStorage as fallback
    localStorage.setItem('tvbox-device-id', deviceId.toString());
    if (name) {
      localStorage.setItem('tvbox-device-name', name);
    }
  }

  async getDeviceId(): Promise<number | null> {
    if (!this.db) await this.init();
    
    try {
      const deviceInfo = await this.db!.get('device', 'current');
      if (deviceInfo) {
        return deviceInfo.deviceId;
      }
    } catch (error) {
      console.warn('Error reading from IndexedDB, trying localStorage:', error);
    }

    // Fallback to localStorage
    const deviceId = localStorage.getItem('tvbox-device-id');
    return deviceId ? parseInt(deviceId, 10) : null;
  }

  async clearDeviceId(): Promise<void> {
    if (!this.db) await this.init();
    
    await this.db!.delete('device', 'current');
    localStorage.removeItem('tvbox-device-id');
    localStorage.removeItem('tvbox-device-name');
    
    // Clear all related data
    await this.clearPlaylist();
    await this.clearMediaCache();
  }

  // Playlist management
  async savePlaylist(items: any[]): Promise<void> {
    if (!this.db) await this.init();
    
    const tx = this.db!.transaction('playlist', 'readwrite');
    
    // Clear existing playlist
    await tx.store.clear();
    
    // Save new playlist
    for (const item of items) {
      await tx.store.put(item);
    }
    
    await tx.done;
  }

  async getPlaylist(): Promise<any[]> {
    if (!this.db) await this.init();
    
    const items = await this.db!.getAll('playlist');
    return items.sort((a, b) => a.order - b.order);
  }

  async clearPlaylist(): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.clear('playlist');
  }

  // Media cache management
  async cacheMedia(url: string, blob: Blob, checksum: string): Promise<void> {
    if (!this.db) await this.init();
    
    const cacheEntry = {
      url,
      blob,
      cachedAt: new Date().toISOString(),
      size: blob.size,
      checksum,
    };

    await this.db!.put('media_cache', cacheEntry, url);
  }

  async getCachedMedia(url: string): Promise<Blob | null> {
    if (!this.db) await this.init();
    
    const entry = await this.db!.get('media_cache', url);
    return entry ? entry.blob : null;
  }

  async isCached(url: string, checksum?: string): Promise<boolean> {
    if (!this.db) await this.init();
    
    const entry = await this.db!.get('media_cache', url);
    if (!entry) return false;
    
    if (checksum && entry.checksum !== checksum) {
      // Checksum mismatch, remove old cache
      await this.db!.delete('media_cache', url);
      return false;
    }
    
    return true;
  }

  async clearMediaCache(): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.clear('media_cache');
  }

  async getCacheSize(): Promise<number> {
    if (!this.db) await this.init();
    
    const entries = await this.db!.getAll('media_cache');
    return entries.reduce((total, entry) => total + entry.size, 0);
  }

  async cleanupOldCache(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    if (!this.db) await this.init();
    
    const cutoff = new Date(Date.now() - maxAge).toISOString();
    const tx = this.db!.transaction('media_cache', 'readwrite');
    
    const entries = await tx.store.getAll();
    for (const entry of entries) {
      if (entry.cachedAt < cutoff) {
        await tx.store.delete(entry.url);
      }
    }
    
    await tx.done;
  }

  // Update last sync time
  async updateLastSync(): Promise<void> {
    if (!this.db) await this.init();
    
    const deviceInfo = await this.db!.get('device', 'current');
    if (deviceInfo) {
      deviceInfo.lastSync = new Date().toISOString();
      await this.db!.put('device', deviceInfo, 'current');
    }
  }
}

export const deviceStorage = new DeviceStorage();