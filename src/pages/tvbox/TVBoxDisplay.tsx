import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import api, { announcementsAPI } from '../../utils/api';
import { videoCache } from '../../services/videoCache';
import { connectWebSocket } from '../../utils/websocket';
import { Socket } from 'socket.io-client';

interface ContentItem {
  id: string;
  title: string;
  file_path: string;
  categoria: string;
  type: string;
  duration?: number;
  formats?: VideoFormat[];
  thumbnail?: string;
  description?: string;
  tags?: string[];
}

interface Announcement {
  id: string;
  device_id: number;
  title: string;
  content: string;
  background_color?: string;
  text_color?: string;
  font_size?: number;
  display_duration: number;
  is_active: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
}

interface VideoFormat {
  quality: string;
  url: string;
  size?: number;
  extension: string;
}

interface VideoCapabilities {
  supportedFormats: { extension: string; mimeType: string }[];
  maxResolution: { width: number; height: number };
  hardwareAcceleration: boolean;
}

const TVBoxDisplay: React.FC = () => {
  // Get device ID from URL params or localStorage
  const urlParams = new URLSearchParams(window.location.search);
  const deviceIdFromUrl = urlParams.get('device');
  const deviceId = deviceIdFromUrl || localStorage.getItem('tvbox_device_id');
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [showingAnnouncement, setShowingAnnouncement] = useState(false);
  const [currentAnnouncementIndex, setCurrentAnnouncementIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoRef, setVideoRef] = useState<HTMLVideoElement | null>(null);
  const [showPlayButton, setShowPlayButton] = useState(false);
  const [autoplayFailed, setAutoplayFailed] = useState(false);
  const [mediaAspectRatio, setMediaAspectRatio] = useState<'landscape' | 'portrait' | 'square'>('landscape');
  const [videoCapabilities, setVideoCapabilities] = useState<VideoCapabilities | null>(null);
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [cachedVideoUrl, setCachedVideoUrl] = useState<string | null>(null);
  const videoElementRef = useRef<HTMLVideoElement>(null);
  const [preloadedVideos, setPreloadedVideos] = useState<Set<string>>(new Set());
  const [networkQuality, setNetworkQuality] = useState<'high' | 'medium' | 'low'>('medium');
  const [adaptiveQuality, setAdaptiveQuality] = useState<string>('720p');
  const networkMonitorRef = useRef<NodeJS.Timeout | null>(null);

  // Network quality monitoring for adaptive streaming
  const monitorNetworkQuality = useCallback(() => {
    if (!('connection' in navigator)) {
      return;
    }

    const connection = (navigator as any).connection;
    if (connection) {
      const { effectiveType, downlink } = connection;
      
      let quality: 'high' | 'medium' | 'low';
      if (effectiveType === '4g' && downlink > 5) {
        quality = 'high';
        setAdaptiveQuality('1080p');
      } else if (effectiveType === '4g' || (effectiveType === '3g' && downlink > 2)) {
        quality = 'medium';
        setAdaptiveQuality('720p');
      } else {
        quality = 'low';
        setAdaptiveQuality('480p');
      }
      
      setNetworkQuality(quality);
    }
  }, []);

  // Fetch device files from API
  const { data: content = [], isLoading, refetch } = useQuery({
    queryKey: ['device-files', deviceId],
    queryFn: async () => {
      if (!deviceId) {
        throw new Error('Device ID not found');
      }
      
      try {
        console.log('Fetching files for device:', deviceId);
        console.log('Full URL will be:', `${api.defaults.baseURL}/device-files/${deviceId}/files`);
        const filesResponse = await api.get(`/device-files/${deviceId}/files`);
        console.log('Files response:', filesResponse.data);
        
        if (filesResponse.data && filesResponse.data.files && filesResponse.data.files.length > 0) {
          return filesResponse.data.files.map((file: any) => ({
            id: file.id || file.name,
            title: file.name || 'No title',
            file_path: file.url || `${api.defaults.baseURL}/device-files/${deviceId}/files/${file.id}/download`,
            categoria: file.type || 'media',
            type: file.type?.includes('video') ? 'video' : 'image',
            duration: file.duration,
            formats: file.formats,
            thumbnail: file.thumbnail,
            description: file.description,
            tags: file.tags
          }));
        }
        return [];
      } catch (error) {
        console.error('Error fetching content:', error);
        return [];
      }
    },
    enabled: !!deviceId,
    refetchInterval: 30000
  });

  // Fetch active announcements for this device
  const { data: announcements = [] } = useQuery({
    queryKey: ['announcements', deviceId],
    queryFn: async () => {
      if (!deviceId) return [] as Announcement[];
      const response = await announcementsAPI.getActiveByDevice(String(deviceId));
      return (response.data || []).sort((a: Announcement, b: Announcement) => a.order_index - b.order_index);
    },
    enabled: !!deviceId,
    refetchInterval: 60000, // Refetch every minute
    staleTime: 30000, // Consider data stale after 30 seconds
  });

  useEffect(() => {
    const initializeVideoCapabilities = async () => {
      try {
        // Detect video capabilities
        setVideoCapabilities({
          supportedFormats: [{ extension: 'mp4', mimeType: 'video/mp4' }],
          maxResolution: { width: 1920, height: 1080 },
          hardwareAcceleration: true
        });
      } catch (error) {
        console.error('Error initializing video capabilities:', error);
      }
    };

    initializeVideoCapabilities();
    monitorNetworkQuality();
    
    networkMonitorRef.current = setInterval(monitorNetworkQuality, 10000);
    
    return () => {
      if (networkMonitorRef.current) {
        clearInterval(networkMonitorRef.current);
      }
    };
  }, [monitorNetworkQuality]);

  const getOptimalVideoUrl = async (content: ContentItem): Promise<string | null> => {
    try {
      // Check cache first
      const cachedVideo = await videoCache.getCachedVideo(content.id);
      if (cachedVideo) {
        setCachedVideoUrl(cachedVideo.url);
        return cachedVideo.url;
      }

      // Get adaptive URL based on network quality
      const adaptiveUrl = await getAdaptiveVideoUrl(content);
      if (adaptiveUrl) {
        return adaptiveUrl;
      }

      // Find best format based on capabilities
      if (content.formats && videoCapabilities) {
        const bestFormat = content.formats.find(format => 
          videoCapabilities.supportedFormats.some(cap => cap.extension === format.extension)
        );
        
        if (bestFormat) {
          // Cache the video
          await videoCache.cacheVideo(content.id, bestFormat.url, {
            quality: bestFormat.quality,
            size: bestFormat.size,
            format: bestFormat.extension
          });
          return bestFormat.url;
        }
      }

      return content.file_path;
    } catch (error) {
      console.error('Error getting optimal video URL:', error);
      return content.file_path;
    }
  };

  const getVideoFormat = (url: string): string => {
    const extension = url.split('.').pop()?.toLowerCase();
    return extension || 'mp4';
  };

  const getAdaptiveVideoUrl = useCallback(async (contentItem: ContentItem): Promise<string | null> => {
    try {
      // Prefer selecting from provided formats if available
      if (contentItem.formats && Array.isArray(contentItem.formats) && contentItem.formats.length > 0) {
        let preferredQualities: string[];
        if (networkQuality === 'high') {
          preferredQualities = ['1080p', '720p', '480p'];
        } else if (networkQuality === 'medium') {
          preferredQualities = ['720p', '480p', '360p'];
        } else {
          preferredQualities = ['480p', '360p', '240p'];
        }

        for (const quality of preferredQualities) {
          const found = contentItem.formats.find(f => f.quality === quality);
          if (found?.url) return found.url;
        }
        // Fallback to first available format
        return contentItem.formats[0].url || null;
      }
      // If no formats, let caller fallback to original file
      return null;
    } catch (error) {
      console.error('Error getting adaptive video URL:', error);
      return null;
    }
  }, [networkQuality]);

  const loadVideoWithFallbacks = async (content: ContentItem): Promise<void> => {
    setIsLoadingVideo(true);
    setVideoError(null);
    setCachedVideoUrl(null);
    
    try {
      const optimalUrl = await getOptimalVideoUrl(content);
      
      if (!optimalUrl) {
        throw new Error('No suitable video URL found');
      }
      
      if (optimalUrl) {
        setVideoError(null);
        
        if (videoElementRef.current) {
          videoElementRef.current.src = optimalUrl;
          
          const loadStartTime = Date.now();
          videoElementRef.current.addEventListener('canplay', () => {
            const loadTime = Date.now() - loadStartTime;
            
            if (loadTime > 3000 && networkQuality !== 'low') {
              setNetworkQuality('medium');
              setAdaptiveQuality('720p');
            } else {
              setAdaptiveQuality(networkQuality === 'high' ? '1080p' : '720p');
            }
          }, { once: true });
        }
      }
    } catch (error) {
      console.error('Error loading video:', error);
      setVideoError('Error loading video');
    } finally {
      setIsLoadingVideo(false);
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (content && content.length > 0) {
      const preloadNextVideos = async () => {
        // Preload next 2 videos
        for (let i = 1; i <= 2; i++) {
          const nextIndex = (currentIndex + i) % content.length;
          const nextContent = content[nextIndex];
          
          if (nextContent && (nextContent.categoria === 'video' || nextContent.type === 'video') &&
              !preloadedVideos.has(nextContent.id)) {
            try {
              const videoUrl = await getOptimalVideoUrl(nextContent);
              if (videoUrl) {
                // Cache video for faster loading
                await videoCache.cacheVideo(nextContent.id, videoUrl, {
                  quality: adaptiveQuality,
                  preloaded: true
                });
                
                // Create invisible video element for preloading
                const preloadVideo = document.createElement('video');
                preloadVideo.src = videoUrl;
                preloadVideo.preload = 'metadata';
                preloadVideo.muted = true;
                preloadVideo.style.display = 'none';
                document.body.appendChild(preloadVideo);
                
                preloadVideo.addEventListener('loadedmetadata', () => {
                  setPreloadedVideos(prev => new Set([...prev, nextContent.id]));
                  document.body.removeChild(preloadVideo);
                });
                
                preloadVideo.addEventListener('error', () => {
                  document.body.removeChild(preloadVideo);
                });
              }
            } catch (error) {
              console.error('Error preloading video:', error);
            }
          }
        }
      };
      
      preloadNextVideos();
    }
  }, [currentIndex, content, adaptiveQuality]);

  // Auto-advance content and announcements
  useEffect(() => {
    if (content.length === 0 && announcements.length === 0) return;

    const interval = setInterval(() => {
      if (showingAnnouncement) {
        // Currently showing announcement
        if (currentAnnouncementIndex < announcements.length - 1) {
          setCurrentAnnouncementIndex(prev => prev + 1);
        } else {
          // Switch back to content
          setShowingAnnouncement(false);
          setCurrentAnnouncementIndex(0);
          if (content.length > 0) {
            setCurrentIndex((prevIndex) => (prevIndex + 1) % content.length);
          }
        }
      } else {
        // Currently showing content
        if (announcements.length > 0 && Math.random() < 0.3) {
          // 30% chance to show announcement
          setShowingAnnouncement(true);
          setCurrentAnnouncementIndex(0);
        } else if (content.length > 0) {
          setCurrentIndex((prevIndex) => (prevIndex + 1) % content.length);
        }
      }
    }, showingAnnouncement ? (announcements[currentAnnouncementIndex]?.display_duration || 5) * 1000 : 10000);

    return () => clearInterval(interval);
  }, [content.length, announcements.length, showingAnnouncement, currentAnnouncementIndex, announcements]);

  useEffect(() => {
    if (!content || content.length === 0) return;
    
    const currentContent = content[currentIndex];
    if (!currentContent) return;
    
    let timer: NodeJS.Timeout;
    
    if (currentContent.categoria === 'video' || currentContent.type === 'video') {
      loadVideoWithFallbacks(currentContent);
    } else {
      // For images, auto-advance after duration
      timer = setInterval(() => {
        goToNext();
      }, (currentContent.duration || 10) * 1000);
    }
    
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [currentIndex, content]);

  useEffect(() => {
    const token = localStorage.getItem('device_token');
    if (!token || !deviceId) return;

    const ws = connectWebSocket();
    
    // Connect to devices namespace with token
    const deviceSocket = ws.io(`${ws.io.uri}/devices`, {
      auth: { token }
    });

    deviceSocket.on('connect', () => {
      console.log('TVBox Device connected to WebSocket');
      
      // Send heartbeat every 30 seconds
      const heartbeatInterval = setInterval(() => {
        const currentItem = content && content.length > 0 ? content[currentIndex] : null;
        deviceSocket.emit('heartbeat', {
          currentContent: currentItem?.id || null,
          contentVersion: content.length,
          isOnline,
          timestamp: new Date().toISOString()
        });
      }, 30000);

      // Cleanup on disconnect
      deviceSocket.on('disconnect', () => {
        clearInterval(heartbeatInterval);
      });
    });

    // Listen for content updates
    deviceSocket.on('playlist:update', (data) => {
      console.log('Content update received:', data);
      if (data.device_id === deviceId) {
        refetch();
      }
    });

    // Listen for commands
    deviceSocket.on('command', (command) => {
      console.log('Command received:', command);
      handleRemoteCommand(command);
    });

    deviceSocket.on('connect_error', (error) => {
      console.error('TVBox WebSocket connection error:', error);
    });

    return () => {
      deviceSocket.disconnect();
    };
  }, [deviceId, refetch, currentIndex, content.length, isOnline]);

  useEffect(() => {
    const checkConnection = () => {
      setIsOnline(navigator.onLine);
    };
    
    window.addEventListener('online', checkConnection);
    window.addEventListener('offline', checkConnection);
    
    return () => {
      window.removeEventListener('online', checkConnection);
      window.removeEventListener('offline', checkConnection);
    };
  }, []);

  const handlePlayClick = () => {
    if (videoRef) {
      videoRef.play().then(() => {
        setShowPlayButton(false);
        setAutoplayFailed(false);
      }).catch(() => {
        setAutoplayFailed(true);
      });
    }
  };

  const goToNext = useCallback(() => {
    if (!content || content.length === 0) return;
    setCurrentIndex((prev) => (prev + 1) % content.length);
  }, [content]);

  const goToPrevious = useCallback(() => {
    if (!content || content.length === 0) return;
    setCurrentIndex((prev) => (prev - 1 + content.length) % content.length);
  }, [content]);

  const handleRemoteCommand = useCallback((command: any) => {
    console.log('Processing remote command:', command);
    
    switch (command.type) {
      case 'play':
        if (videoElementRef.current) {
          videoElementRef.current.play();
        }
        break;
      case 'pause':
        if (videoElementRef.current) {
          videoElementRef.current.pause();
        }
        break;
      case 'next':
        goToNext();
        break;
      case 'previous':
        goToPrevious();
        break;
      case 'restart':
        setCurrentIndex(0);
        break;
      case 'power_control':
        if (command.action === 'shutdown') {
          // Handle shutdown command
          console.log('Shutdown command received');
        } else if (command.action === 'restart') {
          // Handle restart command
          window.location.reload();
        }
        break;
      default:
        console.log('Unknown command:', command);
    }
  }, [goToNext, goToPrevious]);

  useEffect(() => {
    const handleUserInteraction = () => {
      if (videoRef && videoRef.paused && autoplayFailed) {
        videoRef.play().then(() => {
          setAutoplayFailed(false);
          setShowPlayButton(false);
        }).catch(() => {
          setShowPlayButton(true);
        });
      }
    };

    if (autoplayFailed) {
      document.addEventListener('click', handleUserInteraction);
      document.addEventListener('touchstart', handleUserInteraction);
    }

    return () => {
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
    };
  }, [videoRef, autoplayFailed]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Loading content...</div>
      </div>
    );
  }

  if (!content || content.length === 0) {
    if (announcements.length === 0) {
      return (
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="text-white text-xl">No content available</div>
        </div>
      );
    }
  }

  // Determine what to display
  let displayContent;
  if (showingAnnouncement && announcements.length > 0) {
    displayContent = announcements[currentAnnouncementIndex];
  } else if (content && content.length > 0) {
    displayContent = content[currentIndex];
  } else {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">No content available</div>
      </div>
    );
  }

  if (!displayContent) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Content not found</div>
      </div>
    );
  }

  const currentContent = showingAnnouncement ? null : displayContent;
  const currentAnnouncement = showingAnnouncement ? displayContent : null;

  const isPortraitContent = mediaAspectRatio === 'portrait';
  const containerClass = isPortraitContent 
    ? 'flex flex-col h-screen'
    : 'flex flex-row h-screen';
  const mediaContainerClass = isPortraitContent
    ? 'flex-1 flex items-center justify-center bg-black'
    : 'flex-1 flex items-center justify-center bg-black';

  return (
    <div className={containerClass}>
      <div className={mediaContainerClass}>
        {deviceId && (
          <div className="absolute top-4 left-4 z-10">
            <div className="bg-black/50 backdrop-blur-sm rounded-lg p-2">
              <div className="text-white text-sm font-medium mb-1">
                Device: {deviceId.slice(-8)}
              </div>
              <div className="text-white/80 text-xs">
                {currentTime.toLocaleTimeString()}
              </div>
            </div>
          </div>
        )}

        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
          isOnline 
            ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
            : 'bg-red-500/20 text-red-400 border border-red-500/30'
        } absolute top-4 right-4 z-10`}>
          <div className={`w-2 h-2 rounded-full ${
            isOnline ? 'bg-green-400' : 'bg-red-400'
          }`} />
          {isOnline ? 'Online' : 'Offline'}
        </div>

        {!isPortraitContent && (
          <div className="absolute bottom-4 left-4 z-10">
            <div className="bg-black/50 backdrop-blur-sm rounded-lg p-3">
              <div className="text-white text-sm font-medium mb-2">
                {currentContent.title}
              </div>
              <div className="text-white/60 text-xs mb-2">
                Quality: {adaptiveQuality} | Network: {networkQuality === 'high' ? 'Excellent' : (networkQuality === 'medium' ? 'Good' : 'Limited')}
              </div>
            </div>
          </div>
        )}

        {showingAnnouncement ? (
           // Display announcement
           <div 
             className="w-full h-full flex items-center justify-center p-8"
             style={{
               backgroundColor: currentAnnouncement?.background_color || '#000000',
               color: currentAnnouncement?.text_color || '#FFFFFF'
             }}
           >
             <div className="text-center max-w-4xl">
               <h2 
                 className="font-bold mb-6"
                 style={{
                   fontSize: `${(currentAnnouncement?.font_size || 24) + 16}px`
                 }}
               >
                 {currentAnnouncement?.title}
               </h2>
               <div 
                 className="whitespace-pre-wrap leading-relaxed"
                 style={{
                   fontSize: `${currentAnnouncement?.font_size || 24}px`
                 }}
               >
                 {currentAnnouncement?.content}
               </div>
             </div>
           </div>
        ) : currentContent && (currentContent.categoria === 'video' || currentContent.type === 'video') ? (
          <div className="relative w-full h-full flex items-center justify-center">
            {isLoadingVideo && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20">
                <div className="text-white text-lg">Loading video...</div>
              </div>
            )}

            <div className="absolute top-4 right-20 z-10">
              <div className={`px-2 py-1 rounded text-xs font-medium ${
                networkQuality === 'high' ? 'bg-green-500/20 text-green-400' :
                networkQuality === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                'bg-red-500/20 text-red-400'
              }`}>
                {adaptiveQuality}
              </div>
            </div>

            {videoError && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-30">
                <div className="text-red-400 text-lg text-center">
                  <div>{videoError}</div>
                  <button 
                    onClick={() => loadVideoWithFallbacks(currentContent)}
                    className="mt-2 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                  >
                    Try again
                  </button>
                </div>
              </div>
            )}

            <video
              ref={(el) => {
                videoElementRef.current = el;
                setVideoRef(el);
                if (el) {
                  el.addEventListener('loadedmetadata', () => {
                    const aspectRatio = el.videoWidth / el.videoHeight;
                    if (aspectRatio < 0.8) {
                      setMediaAspectRatio('portrait');
                    } else if (aspectRatio > 1.2) {
                      setMediaAspectRatio('landscape');
                    } else {
                      setMediaAspectRatio('square');
                    }

                    const playPromise = el.play();
                    if (playPromise !== undefined) {
                      playPromise.then(() => {
                        setIsVideoPlaying(true);
                        setShowPlayButton(false);
                        setAutoplayFailed(false);
                      }).catch((error) => {
                        console.log('Autoplay failed:', error);
                        setAutoplayFailed(true);
                        setShowPlayButton(true);
                        setIsVideoPlaying(false);
                      });
                    }
                  });
                }
              }}
              className="max-w-full max-h-full object-contain"
              autoPlay
              muted
              playsInline
              onLoadedMetadata={(e) => {
                const video = e.target as HTMLVideoElement;
                setVideoDuration(video.duration);
                const aspectRatio = video.videoWidth / video.videoHeight;
                if (aspectRatio < 0.8) {
                  setMediaAspectRatio('portrait');
                } else if (aspectRatio > 1.2) {
                  setMediaAspectRatio('landscape');
                } else {
                  setMediaAspectRatio('square');
                }

                const playPromise = video.play();
                if (playPromise !== undefined) {
                  playPromise.then(() => {
                    setIsVideoPlaying(true);
                    setShowPlayButton(false);
                  }).catch((error) => {
                    console.log('Autoplay failed:', error);
                    setAutoplayFailed(true);
                    setShowPlayButton(true);
                  });
                }
              }}
              onEnded={() => {
                setIsVideoPlaying(false);
                goToNext();
              }}
              onError={(e) => {
                console.error('Video error:', e);
                setVideoError('Error playing video');
                setIsVideoPlaying(false);
                setTimeout(() => {
                  goToNext();
                }, 3000);
              }}
              onCanPlay={() => {
                setIsLoadingVideo(false);
              }}
              onWaiting={() => {
                setIsLoadingVideo(true);
              }}
            />

            {showPlayButton && (
              <button
                onClick={handlePlayClick}
                className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center text-2xl z-20"
                aria-label="Play"
              >
                ▶
              </button>
            )}
          </div>
        ) : (
          // Image content
          <div className="w-full h-full flex items-center justify-center bg-black">
            {currentContent && (
              <img 
                src={currentContent.file_path}
                alt={currentContent.title}
                className="max-w-full max-h-full object-contain"
              />
            )}
          </div>
        )}
      </div>

      {/* Side panel for portrait mode */}
      {isPortraitContent && (
        <div className="w-full md:w-96 bg-black/80 text-white p-6 overflow-y-auto">
          {showingAnnouncement ? (
            <div>
              <h2 className="text-2xl font-bold mb-4">{currentAnnouncement?.title}</h2>
              <div className="whitespace-pre-wrap">
                {currentAnnouncement?.content}
              </div>
            </div>
          ) : (
            <div>
              <h2 className="text-xl font-semibold mb-2">{currentContent?.title}</h2>
              <div className="text-white/70 text-sm mb-4">
                Resolution: {mediaAspectRatio === 'portrait' ? '9:16' : mediaAspectRatio === 'landscape' ? '16:9' : '1:1'} | Duration: {Math.round(videoDuration)}s
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded"
                  onClick={goToPrevious}
                >
                  Previous
                </button>
                <button 
                  className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded"
                  onClick={goToNext}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TVBoxDisplay;