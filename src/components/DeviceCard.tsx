import React from 'react';
import { Monitor, Wifi, WifiOff, Clock, Settings, Play } from 'lucide-react';

interface Device {
  id: string;
  nome: string;
  localizacao: string;
  status: 'online' | 'offline' | 'erro';
  ultima_atividade: string;
  device_uuid?: string;
  playlist_count?: number;
}

interface DeviceCardProps {
  device: Device;
  onEditPlaylist: (device: Device) => void;
  onViewDetails?: (device: Device) => void;
}

const DeviceCard: React.FC<DeviceCardProps> = ({ 
  device, 
  onEditPlaylist, 
  onViewDetails 
}) => {
  const getStatusIcon = () => {
    switch (device.status) {
      case 'online':
        return <Wifi className="h-5 w-5 text-green-600" />;
      case 'offline':
        return <WifiOff className="h-5 w-5 text-gray-600" />;
      case 'erro':
        return <WifiOff className="h-5 w-5 text-red-600" />;
      default:
        return <Monitor className="h-5 w-5 text-gray-600" />;
    }
  };

  const getStatusColor = () => {
    switch (device.status) {
      case 'online':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'offline':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'erro':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatLastSeen = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      
      if (diffMins < 1) return 'Agora mesmo';
      if (diffMins < 60) return `${diffMins}m atrás`;
      
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h atrás`;
      
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d atrás`;
    } catch {
      return 'Desconhecido';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Monitor className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{device.nome}</h3>
            <p className="text-sm text-gray-600">{device.localizacao}</p>
          </div>
        </div>
        
        {/* Status Badge */}
        <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor()}`}>
          {getStatusIcon()}
          <span className="ml-1 capitalize">{device.status}</span>
        </div>
      </div>

      {/* Device Info */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center text-sm text-gray-600">
          <Clock className="h-4 w-4 mr-2" />
          <span>Última atividade: {formatLastSeen(device.ultima_atividade)}</span>
        </div>
        
        {device.device_uuid && (
          <div className="text-xs text-gray-500">
            UUID: {device.device_uuid.slice(-8)}
          </div>
        )}
        
        <div className="flex items-center text-sm text-gray-600">
          <Play className="h-4 w-4 mr-2" />
          <span>{device.playlist_count || 0} itens na playlist</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex space-x-2">
        <button
          onClick={() => onEditPlaylist(device)}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center"
        >
          <Settings className="h-4 w-4 mr-2" />
          Editar Playlist
        </button>
        
        {onViewDetails && (
          <button
            onClick={() => onViewDetails(device)}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Detalhes
          </button>
        )}
      </div>

      {/* Connection Indicator */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>ID: {device.id}</span>
          <div className={`w-2 h-2 rounded-full ${
            device.status === 'online' ? 'bg-green-400' : 'bg-gray-400'
          }`} />
        </div>
      </div>
    </div>
  );
};

export default DeviceCard;