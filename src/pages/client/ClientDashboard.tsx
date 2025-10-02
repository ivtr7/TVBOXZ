import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import MediaPlayer from '../../components/MediaPlayer';
import api from '../../utils/api';
import { connectWebSocket } from '../../utils/websocket';
import toast from 'react-hot-toast';

interface Playlist {
  id: number;
  name: string;
  content: Array<{
    id: number;
    filename: string;
    original_name: string;
    file_type: string;
    duration?: number;
    file_path: string;
  }>;
}

interface DeviceInfo {
  id: number;
  name: string;
  location: string;
  status: string;
  current_playlist_id?: number;
}

const ClientDashboard: React.FC = () => {
  const { deviceId } = useParams<{ deviceId: string }>();
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [currentPlaylist, setCurrentPlaylist] = useState<Playlist | null>(null);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!deviceId) return;

    const fetchDeviceInfo = async () => {
      try {
        const response = await api.get(`/devices/${deviceId}/info`);
        setDeviceInfo(response.data);
        
        if (response.data.current_playlist_id) {
          const playlistResponse = await api.get(`/playlists/${response.data.current_playlist_id}`);
          setCurrentPlaylist(playlistResponse.data);
        }
      } catch (error) {
        console.error('Erro ao buscar informações do dispositivo:', error);
        toast.error('Erro ao carregar informações do dispositivo');
      } finally {
        setLoading(false);
      }
    };

    fetchDeviceInfo();

    // Conectar WebSocket para atualizações em tempo real
    const socket = connectWebSocket();
    
    socket.on('playlist_updated', (data: { deviceId: string; playlistId: number }) => {
      if (data.deviceId === deviceId) {
        fetchDeviceInfo();
      }
    });

    socket.on('device_command', (data: { deviceId: string; command: string }) => {
      if (data.deviceId === deviceId) {
        switch (data.command) {
          case 'play':
            setIsPlaying(true);
            break;
          case 'pause':
            setIsPlaying(false);
            break;
          case 'next':
            handleNextMedia();
            break;
          case 'previous':
            handlePreviousMedia();
            break;
          case 'restart':
            setCurrentMediaIndex(0);
            break;
        }
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [deviceId]);

  const handleNextMedia = () => {
    if (currentPlaylist && currentPlaylist.content.length > 0) {
      setCurrentMediaIndex((prev) => 
        prev >= currentPlaylist.content.length - 1 ? 0 : prev + 1
      );
    }
  };

  const handlePreviousMedia = () => {
    if (currentPlaylist && currentPlaylist.content.length > 0) {
      setCurrentMediaIndex((prev) => 
        prev <= 0 ? currentPlaylist.content.length - 1 : prev - 1
      );
    }
  };

  const handleMediaEnd = () => {
    handleNextMedia();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Carregando...</div>
      </div>
    );
  }

  if (!deviceInfo) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Dispositivo não encontrado</div>
      </div>
    );
  }

  if (!currentPlaylist || currentPlaylist.content.length === 0) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center text-white">
          <h2 className="text-2xl mb-4">Nenhum conteúdo disponível</h2>
          <p className="text-gray-400">Aguardando playlist ser atribuída...</p>
        </div>
      </div>
    );
  }

  const currentMedia = currentPlaylist.content[currentMediaIndex];

  return (
    <div className="min-h-screen bg-black">
      {/* Informações do dispositivo (ocultas em produção) */}
      <div className="absolute top-4 left-4 text-white text-sm opacity-50 z-10">
        <div>Dispositivo: {deviceInfo.name}</div>
        <div>Local: {deviceInfo.location}</div>
        <div>Playlist: {currentPlaylist.name}</div>
        <div>Mídia: {currentMediaIndex + 1}/{currentPlaylist.content.length}</div>
      </div>

      {/* Player de mídia */}
      <MediaPlayer
        media={currentMedia}
        isPlaying={isPlaying}
        onEnded={handleMediaEnd}
        onNext={handleNextMedia}
        onPrevious={handlePreviousMedia}
      />

      {/* Controles (ocultos em produção) */}
      <div className="absolute bottom-4 right-4 flex gap-2 opacity-50 z-10">
        <button
          onClick={handlePreviousMedia}
          className="bg-gray-800 text-white px-3 py-2 rounded hover:bg-gray-700"
        >
          ⏮️
        </button>
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="bg-gray-800 text-white px-3 py-2 rounded hover:bg-gray-700"
        >
          {isPlaying ? '⏸️' : '▶️'}
        </button>
        <button
          onClick={handleNextMedia}
          className="bg-gray-800 text-white px-3 py-2 rounded hover:bg-gray-700"
        >
          ⏭️
        </button>
      </div>
    </div>
  );
};

export default ClientDashboard;