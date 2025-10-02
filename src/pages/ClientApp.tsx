import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import ClientDashboard from './client/ClientDashboard';
import api from '../utils/api';
import toast from 'react-hot-toast';

const ClientApp: React.FC = () => {
  const { deviceId } = useParams<{ deviceId: string }>();
  const [isValidDevice, setIsValidDevice] = useState<boolean | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<any>(null);

  useEffect(() => {
    const validateDevice = async () => {
      if (!deviceId || deviceId.trim() === '') {
        setIsValidDevice(false);
        return;
      }

      try {
        const response = await api.get(`/devices/${deviceId}/info`);
        setDeviceInfo(response.data);
        setIsValidDevice(true);
      } catch (error: any) {
        console.error('Error validating device:', error);
        setIsValidDevice(false);
        
        if (error.response?.status === 404) {
          toast.error('Dispositivo não encontrado');
        } else {
          toast.error('Erro ao validar dispositivo');
        }
      }
    };

    validateDevice();
  }, [deviceId]);

  if (isValidDevice === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Validando dispositivo...</p>
        </div>
      </div>
    );
  }

  if (!isValidDevice) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Dispositivo Inválido</h1>
          <p className="text-gray-600">O ID do dispositivo fornecido não é válido ou não existe.</p>
        </div>
      </div>
    );
  }

  return <ClientDashboard />;
};

export default ClientApp;