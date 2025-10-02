import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, FileText, Video, Image, Trash2, Download, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import LoadingSpinner from '../../components/LoadingSpinner';

interface MediaFile {
  id: string;
  name: string;
  type: 'video' | 'image';
  size: number;
  device_id: string;
  created_at: string;
  url: string;
}

const MediaPage: React.FC = () => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [dragOver, setDragOver] = useState(false);

  // Fetch devices
  const { data: devices = [] } = useQuery({
    queryKey: ['devices'],
    queryFn: async () => {
      const response = await api.get('/devices');
      return response.data.devices || [];
    }
  });

  // Fetch media files
  const { data: mediaFiles = [], isLoading } = useQuery({
    queryKey: ['media-files', selectedDevice],
    queryFn: async () => {
      if (!selectedDevice) return [];
      const response = await api.get(`/device-files/${selectedDevice}/files`);
      return response.data.files || [];
    },
    enabled: !!selectedDevice
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!selectedDevice) {
        throw new Error('Selecione um dispositivo primeiro');
      }
      
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await api.post(`/device-files/${selectedDevice}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Arquivo enviado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['media-files', selectedDevice] });
    },
    onError: (error: any) => {
      console.error('Upload error:', error);
      toast.error(error.response?.data?.error || 'Erro ao enviar arquivo');
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (fileId: string) => {
      await api.delete(`/device-files/${selectedDevice}/files/${fileId}`);
    },
    onSuccess: () => {
      toast.success('Arquivo removido com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['media-files', selectedDevice] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erro ao remover arquivo');
    }
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleFileUpload = (file: File) => {
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/webm', 'video/avi'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Tipo de arquivo não suportado. Use imagens (JPEG, PNG, GIF) ou vídeos (MP4, WebM, AVI)');
      return;
    }
    
    // Validate file size (100MB max)
    if (file.size > 100 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Tamanho máximo: 100MB');
      return;
    }
    
    uploadMutation.mutate(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (type: string) => {
    return type === 'video' ? Video : Image;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gerenciamento de Mídia</h1>
          <p className="text-gray-600">Faça upload e gerencie arquivos de mídia para seus dispositivos</p>
        </div>
      </div>

      {/* Device Selection */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Selecionar Dispositivo</h2>
        <select
          value={selectedDevice}
          onChange={(e) => setSelectedDevice(e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Selecione um dispositivo...</option>
          {devices.map((device: any) => (
            <option key={device.id} value={device.id}>
              {device.nome} - {device.localizacao}
            </option>
          ))}
        </select>
      </div>

      {selectedDevice && (
        <>
          {/* Upload Area */}
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload de Arquivos</h2>
            
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragOver
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Arraste arquivos aqui ou clique para selecionar
              </h3>
              <p className="text-gray-600 mb-4">
                Suporte para imagens (JPEG, PNG, GIF) e vídeos (MP4, WebM, AVI)
              </p>
              <p className="text-sm text-gray-500 mb-4">
                Tamanho máximo: 100MB
              </p>
              
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
              >
                {uploadMutation.isPending ? 'Enviando...' : 'Selecionar Arquivos'}
              </button>
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Media Files List */}
          <div className="bg-white rounded-lg shadow-md border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Arquivos de Mídia ({mediaFiles.length})
              </h2>
            </div>
            
            <div className="p-6">
              {isLoading ? (
                <div className="text-center py-8">
                  <LoadingSpinner />
                  <p className="text-gray-600 mt-2">Carregando arquivos...</p>
                </div>
              ) : mediaFiles.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">Nenhum arquivo encontrado</p>
                  <p className="text-sm text-gray-500">Faça upload de arquivos para começar</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg-grid-cols-3 gap-4">
                  {mediaFiles.map((file: MediaFile) => {
                    const FileIcon = getFileIcon(file.type);
                    return (
                      <div key={file.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center">
                            <FileIcon className="h-8 w-8 text-blue-600 mr-3" />
                            <div className="flex-1 min-w-0">
                              <h3 className="text-sm font-medium text-gray-900 truncate">
                                {file.name}
                              </h3>
                              <p className="text-xs text-gray-500">
                                {file.type} • {formatFileSize(file.size)}
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex space-x-2">
                          <button
                            onClick={() => {
                              const base = api.defaults.baseURL?.replace(/\/api$/, '') || '';
                              const href = file.url?.startsWith('http') ? file.url : `${base}${file.url}`;
                              window.open(href, '_blank');
                            }}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium py-2 px-3 rounded transition-colors flex items-center justify-center"
                            title="Visualizar"
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Ver
                          </button>
                          
                          <button
                            onClick={() => {
                              const base = api.defaults.baseURL?.replace(/\/api$/, '') || '';
                              const href = file.url?.startsWith('http') ? file.url : `${base}${file.url}`;
                              const link = document.createElement('a');
                              link.href = href;
                              link.download = file.name;
                              link.rel = 'noopener';
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                            }}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs font-medium py-2 px-3 rounded transition-colors flex items-center justify-center"
                            title="Download"
                          >
                            <Download className="h-3 w-3 mr-1" />
                            Baixar
                          </button>
                          
                          <button
                            onClick={() => deleteMutation.mutate(file.id)}
                            disabled={deleteMutation.isPending}
                            className="bg-red-600 hover:bg-red-700 text-white text-xs font-medium py-2 px-3 rounded transition-colors flex items-center justify-center disabled:opacity-50"
                            title="Remover"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default MediaPage;