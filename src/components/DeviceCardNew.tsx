import React, { useState, useRef } from 'react';
import { Monitor, Wifi, WifiOff, AlertTriangle, Upload, Play, RefreshCw, Trash2, GripVertical, Eye } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { useAdminWebSocket } from '../hooks/useAdminWebSocket';

interface Device {
  id: string;
  nome: string;
  localizacao: string;
  status: 'online' | 'offline' | 'erro';
  ultima_atividade: string;
  created_at: string;
  is_playing?: boolean;
}

interface DeviceFile {
  id: string;
  name: string;
  type: 'video' | 'image';
  size: number;
  order: number;
  url: string;
  thumbnail_url?: string;
}

interface DeviceCardNewProps {
  device: Device;
}

const DeviceCardNew: React.FC<DeviceCardNewProps> = ({ device }) => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const [draggedItem, setDraggedItem] = useState<number | null>(null);
  const [dragOverItem, setDragOverItem] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [displayTime, setDisplayTime] = useState(10);
  const [selectedFile, setSelectedFile] = useState<DeviceFile | null>(null);
  const { isConnected, sendCommand } = useAdminWebSocket();

  // Fetch device files
  const { data: files = [], isLoading: filesLoading } = useQuery({
    queryKey: ['device-files', device.id],
    queryFn: async () => {
      const response = await api.get(`/device-files/${device.id}/files`);
      // Sort files by order for playlist sequence
      const sortedFiles = (response.data.files || []).sort((a: DeviceFile, b: DeviceFile) => a.order - b.order);
      return sortedFiles;
    },
    refetchInterval: 60000 // Refetch every minute
  });

  // Fetch device status
  const { data: deviceStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['device-status', device.id],
    queryFn: async () => {
      const response = await api.get(`/devices/${device.id}/status`);
      return response.data;
    },
    refetchInterval: 30000 // Refetch every 30 seconds as backup for WebSocket
  });

  // Upload file mutation
  const uploadFileMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('deviceId', device.id);
      
      const response = await api.post(`/device-files/${device.id}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device-files', device.id] });
      toast.success('Arquivo enviado com sucesso!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erro ao enviar arquivo');
    }
  });

  // Delete file mutation
  const deleteFileMutation = useMutation({
    mutationFn: async (fileId: string) => {
      await api.delete(`/device-files/${device.id}/files/${fileId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device-files', device.id] });
      toast.success('Arquivo removido com sucesso!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erro ao remover arquivo');
    }
  });

  // Reorder files mutation
  const reorderFilesMutation = useMutation({
    mutationFn: async (newOrder: { fileId: string; order: number }[]) => {
      await api.put(`/device-files/${device.id}/files/reorder`, { order: newOrder });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device-files', device.id] });
      toast.success('Ordem atualizada com sucesso!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erro ao atualizar ordem');
    }
  });

  // Force update mutation with WebSocket
  const forceUpdateMutation = useMutation({
    mutationFn: async () => {
      // First try WebSocket command if connected
      if (isConnected) {
        sendCommand(device.id, { type: 'refresh_content' });
      }
      
      // Also call API endpoint as fallback
      await api.post(`/device-files/${device.id}/force-update`);
    },
    onSuccess: () => {
      toast.success('Atualização forçada enviada!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erro ao forçar atualização');
    }
  });

  // Handle file preview
  const handleFilePreview = (file: DeviceFile) => {
    setSelectedFile(file);
  };

  // Handle file upload from input
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/webm'];
      if (!allowedTypes.includes(file.type)) {
        toast.error('Tipo de arquivo não suportado. Use imagens (JPEG, PNG, GIF) ou vídeos (MP4, WebM)');
        return;
      }
      
      // Validate file size (50MB max)
      if (file.size > 50 * 1024 * 1024) {
        toast.error('Arquivo muito grande. Tamanho máximo: 50MB');
        return;
      }
      
      uploadFileMutation.mutate(file);
    }
  };

  // Handle file drop from external sources
  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      
      // Process each file
      files.forEach(file => {
        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/webm'];
        if (!allowedTypes.includes(file.type)) {
          toast.error(`Tipo de arquivo não suportado: ${file.name}`);
          return;
        }
        
        // Validate file size (50MB max)
        if (file.size > 50 * 1024 * 1024) {
          toast.error(`Arquivo muito grande: ${file.name}`);
          return;
        }
        
        uploadFileMutation.mutate(file);
      });
    }
  };

  const handlePlayDevice = () => {
    const url = `/tvbox/display?device=${device.id}`;
    window.open(url, '_blank');
  };

  const handleDragStart = (index: number) => {
    setDraggedItem(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverItem(index);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (draggedItem === null || draggedItem === dropIndex) {
      setDraggedItem(null);
      setDragOverItem(null);
      return;
    }

    const newFiles = [...files];
    const draggedFile = newFiles[draggedItem];
    newFiles.splice(draggedItem, 1);
    newFiles.splice(dropIndex, 0, draggedFile);

    // Update order
    const newOrder = newFiles.map((file, index) => ({
      fileId: file.id,
      order: index + 1
    }));

    reorderFilesMutation.mutate(newOrder);
    setDraggedItem(null);
    setDragOverItem(null);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return <Wifi className="h-4 w-4 text-green-600" />;
      case 'offline':
        return <WifiOff className="h-4 w-4 text-gray-600" />;
      case 'erro':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default:
        return <Monitor className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const classes = {
      online: 'bg-green-100 text-green-800',
      offline: 'bg-gray-100 text-gray-800',
      erro: 'bg-red-100 text-red-800'
    };

    // Use real-time status from WebSocket/API
    const realStatus = deviceStatus?.status || status;
    const isPlaying = deviceStatus?.is_playing;

    return (
      <div className="flex flex-col items-end">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${classes[realStatus as keyof typeof classes]}`}>
          {getStatusIcon(realStatus)}
          <span className="ml-1 capitalize">{realStatus}</span>
        </span>
        {realStatus === 'online' && (
          <span className="text-xs text-gray-500 mt-1">
            {isPlaying ? 'Reproduzindo' : 'Conectado'}
          </span>
        )}
      </div>
    );
  };

  // Setup drag and drop event listeners
  React.useEffect(() => {
    const dropZone = dropZoneRef.current;
    if (!dropZone) return;

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dropZone.classList.add('border-blue-400');
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dropZone.classList.remove('border-blue-400');
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      dropZone.classList.remove('border-blue-400');
      if (e.dataTransfer?.files.length) {
        const files = Array.from(e.dataTransfer.files);
        files.forEach(file => {
          const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/webm'];
          if (!allowedTypes.includes(file.type)) {
            toast.error(`Tipo de arquivo não suportado: ${file.name}`);
            return;
          }
          
          if (file.size > 50 * 1024 * 1024) {
            toast.error(`Arquivo muito grande: ${file.name}`);
            return;
          }
          
          uploadFileMutation.mutate(file);
        });
      }
    };

    dropZone.addEventListener('dragenter', handleDragEnter);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('drop', handleDrop);

    return () => {
      dropZone.removeEventListener('dragenter', handleDragEnter);
      dropZone.removeEventListener('dragleave', handleDragLeave);
      dropZone.removeEventListener('dragover', handleDragOver);
      dropZone.removeEventListener('drop', handleDrop);
    };
  }, [uploadFileMutation]);

  return (
    <>
      <div 
        className="bg-white rounded-lg shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow cursor-pointer"
        onClick={() => setShowModal(true)}
      >
        {/* Device Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Monitor className="h-8 w-8 text-blue-600 mr-3" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{device.nome}</h3>
              <p className="text-sm text-gray-600">{device.localizacao}</p>
            </div>
          </div>
          {getStatusBadge(device.status)}
        </div>

      {/* Action Buttons */}
      <div className="flex space-x-2 mb-4">
        <button
          onClick={(e) => {
            e.stopPropagation();
            fileInputRef.current?.click();
          }}
          disabled={uploadFileMutation.isPending}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-3 rounded-lg transition-colors flex items-center justify-center"
        >
          <Upload className="h-4 w-4 mr-2" />
          {uploadFileMutation.isPending ? 'Enviando...' : 'Upload'}
        </button>
        
        <button
          onClick={(e) => {
            e.stopPropagation();
            handlePlayDevice();
          }}
          className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2 px-3 rounded-lg transition-colors flex items-center justify-center"
          title="Abrir player do dispositivo"
        >
          <Play className="h-4 w-4" />
        </button>
        
        <button
          onClick={(e) => {
            e.stopPropagation();
            forceUpdateMutation.mutate();
          }}
          disabled={forceUpdateMutation.isPending}
          className="bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium py-2 px-3 rounded-lg transition-colors flex items-center justify-center"
          title="Forçar atualização"
        >
          <RefreshCw className={`h-4 w-4 ${forceUpdateMutation.isPending ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* File List */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-gray-700 mb-2">
          Arquivos ({files.length})
        </h4>
        
        {filesLoading ? (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : files.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">
            Nenhum arquivo enviado ainda
          </p>
        ) : (
          <div className="max-h-40 overflow-y-auto space-y-1">
            {files.map((file: DeviceFile, index: number) => (
              <div
                key={file.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                className={`flex items-center justify-between p-2 bg-gray-50 rounded border cursor-move hover:bg-gray-100 transition-colors ${
                  dragOverItem === index ? 'border-blue-400 bg-blue-50' : ''
                }`}
              >
                <div className="flex items-center flex-1 min-w-0">
                  <div className="flex flex-col items-center mr-2">
                    <GripVertical className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <span className="text-xs text-gray-500 font-medium mt-1">{index + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {file.name}
                      </p>
                      {index === 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                          Próximo
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {file.type} • {(file.size / 1024 / 1024).toFixed(1)}MB
                      {file.type === 'image' && ' • 10s duração'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFilePreview(file);
                    }}
                    className="text-blue-600 hover:text-blue-800 p-1 rounded transition-colors flex-shrink-0 mr-1"
                    title="Visualizar arquivo"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteFileMutation.mutate(file.id);
                    }}
                    disabled={deleteFileMutation.isPending}
                    className="text-red-600 hover:text-red-800 p-1 rounded transition-colors flex-shrink-0"
                    title="Remover arquivo"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        onChange={handleFileUpload}
        className="hidden"
      />
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50" onClick={() => setShowModal(false)}>
          <div className="relative top-10 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white" onClick={(e) => e.stopPropagation()}>
            <div className="mt-3">
              {/* Modal Header */}
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">
                    {device.nome}
                  </h3>
                  <p className="text-gray-600">{device.localizacao}</p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                >
                  ×
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column - Upload and Settings */}
                <div className="space-y-6">
                  {/* Upload Section */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Upload de Arquivos</h4>
                    
                    <div 
                      ref={dropZoneRef}
                      className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors"
                    >
                      <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600 mb-3">
                        Arraste arquivos aqui ou clique para selecionar
                      </p>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadFileMutation.isPending}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {uploadFileMutation.isPending ? 'Enviando...' : 'Selecionar Arquivos'}
                      </button>
                    </div>
                  </div>

                  {/* Display Time Configuration */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Configurações de Exibição</h4>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Tempo de exibição para imagens (segundos)
                        </label>
                        <input
                          type="number"
                          min="5"
                          max="300"
                          step="5"
                          value={displayTime}
                          onChange={(e) => setDisplayTime(Number(e.target.value))}
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Entre 5 e 300 segundos (múltiplos de 5)
                        </p>
                      </div>
                      
                      <button
                        onClick={() => forceUpdateMutation.mutate()}
                        disabled={forceUpdateMutation.isPending}
                        className="w-full bg-orange-600 hover:bg-orange-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center"
                      >
                        <RefreshCw className={`h-4 w-4 mr-2 ${forceUpdateMutation.isPending ? 'animate-spin' : ''}`} />
                        {forceUpdateMutation.isPending ? 'Atualizando...' : 'Forçar Atualização'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right Column - File List */}
                <div>
                  <div className="bg-gray-50 rounded-lg p-4 h-full">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-lg font-semibold text-gray-900">
                        Arquivos ({files.length})
                      </h4>
                      <button
                        onClick={handlePlayDevice}
                        className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2 px-3 rounded-lg transition-colors flex items-center"
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Visualizar
                      </button>
                    </div>
                    
                    {filesLoading ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                        <p className="text-gray-600">Carregando...</p>
                      </div>
                    ) : files.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-gray-600">Nenhum arquivo enviado ainda</p>
                        <p className="text-sm text-gray-500">Faça upload de arquivos para começar</p>
                      </div>
                    ) : (
                      <div className="max-h-96 overflow-y-auto space-y-2">
                        {files.map((file: DeviceFile, index: number) => (
                          <div
                            key={file.id}
                            draggable
                            onDragStart={() => handleDragStart(index)}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDrop={(e) => handleDrop(e, index)}
                            className={`flex items-center justify-between p-3 bg-white rounded border cursor-move hover:bg-gray-50 transition-colors ${
                              dragOverItem === index ? 'border-blue-400 bg-blue-50' : ''
                            }`}
                          >
                            <div className="flex items-center flex-1 min-w-0">
                              <GripVertical className="h-4 w-4 text-gray-400 mr-3 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {file.name}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {file.type} • {(file.size / 1024 / 1024).toFixed(1)}MB
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center">
                              <button
                                onClick={() => handleFilePreview(file)}
                                className="text-blue-600 hover:text-blue-800 p-2 rounded transition-colors flex-shrink-0 mr-1"
                                title="Visualizar arquivo"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => deleteFileMutation.mutate(file.id)}
                                disabled={deleteFileMutation.isPending}
                                className="text-red-600 hover:text-red-800 p-2 rounded transition-colors flex-shrink-0"
                                title="Remover arquivo"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* File Preview Modal */}
              {selectedFile && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" onClick={() => setSelectedFile(null)}>
                  <div className="max-w-4xl max-h-screen p-4" onClick={(e) => e.stopPropagation()}>
                    <div className="bg-white p-2 rounded-lg shadow-lg">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="text-lg font-medium">{selectedFile.name}</h3>
                        <button 
                          onClick={() => setSelectedFile(null)}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          ×
                        </button>
                      </div>
                      {selectedFile.type === 'video' ? (
                        <video 
                          src={selectedFile.url} 
                          controls 
                          className="max-h-[70vh] max-w-full"
                        />
                      ) : (
                        <img 
                          src={selectedFile.url} 
                          alt={selectedFile.name}
                          className="max-h-[70vh] max-w-full"
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Modal Footer */}
              <div className="flex justify-end mt-6 pt-4 border-t">
                <button
                  onClick={() => setShowModal(false)}
                  className="bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DeviceCardNew;