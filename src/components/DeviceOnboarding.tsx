import React, { useState } from 'react';
import { Monitor, Wifi, AlertCircle } from 'lucide-react';
import { deviceStorage } from '../utils/deviceStorage';
import api from '../utils/api';
import toast from 'react-hot-toast';

interface DeviceOnboardingProps {
  onComplete: (deviceId: number, token: string) => void;
}

const DeviceOnboarding: React.FC<DeviceOnboardingProps> = ({ onComplete }) => {
  const [deviceName, setDeviceName] = useState('');
  const [deviceUuid, setDeviceUuid] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Generate UUID on component mount
  useEffect(() => {
    // Check if UUID already exists
    const existingUuid = localStorage.getItem('device_uuid');
    if (existingUuid) {
      setDeviceUuid(existingUuid);
    } else {
      // Generate new UUID
      const newUuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
      setDeviceUuid(newUuid);
      localStorage.setItem('device_uuid', newUuid);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!deviceName.trim()) {
      setError('Por favor, insira um nome para o dispositivo');
      return;
    }

    setIsLoading(true);

    try {
      // Register device with server
      const response = await api.post('/devices/register', {
        device_uuid: deviceUuid,
        name: deviceName.trim(),
        model: navigator.userAgent,
        tenant_id: 1 // Default tenant
      });

      if (response.data.success) {
        const { device, token } = response.data;
        
        // Save device info and token locally
        localStorage.setItem('device_token', token);
        localStorage.setItem('device_id', device.id.toString());
        localStorage.setItem('device_name', device.name);
        await deviceStorage.saveDeviceId(device.id, device.name);
        
        toast.success('Dispositivo registrado com sucesso!');
        onComplete(device.id, token);
      } else {
        setError(response.data.message || 'Erro ao registrar dispositivo');
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      
      if (error.response?.status === 403) {
        setError('Este dispositivo foi bloqueado pelo administrador');
      } else {
        setError(error.response?.data?.message || 'Erro ao conectar com o servidor');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    if (confirm('Tem certeza que deseja resetar este dispositivo? Todos os dados locais serão perdidos.')) {
      localStorage.removeItem('device_token');
      localStorage.removeItem('device_id');
      localStorage.removeItem('device_name');
      localStorage.removeItem('device_uuid');
      deviceStorage.clearDeviceId();
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Monitor className="w-10 h-10 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Configuração do Dispositivo
          </h1>
          <p className="text-gray-600">
            Insira o ID do seu dispositivo para começar
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="deviceName" className="block text-sm font-medium text-gray-700 mb-2">
              Nome do Dispositivo *
            </label>
            <input
              type="text"
              id="deviceName"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg text-center"
              placeholder="Ex: TV Recepção"
              required
              disabled={isLoading}
              maxLength={100}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              UUID do Dispositivo
            </label>
            <input
              type="text"
              value={deviceUuid}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 text-sm"
              disabled
              readOnly
            />
            <p className="text-xs text-gray-500 mt-1">
              UUID único gerado automaticamente para este dispositivo
            </p>
          </div>

          {error && (
            <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-lg">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !deviceName.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Registrando...
              </>
            ) : (
              <>
                <Wifi className="w-5 h-5 mr-2" />
                Conectar Dispositivo
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <button
            onClick={handleReset}
            className="w-full text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Resetar dispositivo
          </button>
        </div>

        <div className="mt-4 text-xs text-gray-400 text-center">
          <p>Este ID será salvo localmente e não será solicitado novamente</p>
        </div>
      </div>
    </div>
  );
};

export default DeviceOnboarding;