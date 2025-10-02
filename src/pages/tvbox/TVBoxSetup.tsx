import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tv, Wifi, Settings, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';
import api from '../../utils/api';

const TVBoxSetup: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [setupData, setSetupData] = useState({
    deviceName: '',
    location: '',
    resolution: '1920x1080',
    orientation: 'landscape'
  });

  const handleNext = async () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      // Finalizar setup - registrar dispositivo no backend
      try {
        // Gerar um UUID v4 válido para o dispositivo
        const deviceId = uuidv4();
        
        const deviceData = {
          device_uuid: deviceId,
          name: setupData.deviceName,
          model: `${setupData.resolution} - ${setupData.orientation}`,
          tenant_id: 1
        };

        const response = await api.post('/devices/register', deviceData);
        
        if (response.data.success) {
          // Extrair id numérico e token do backend
          const deviceNumericId = response.data.device?.id;
          const deviceToken = response.data.token;

          // Persistir identificadores corretos
          localStorage.setItem('tvbox_device_id', String(deviceNumericId));
          localStorage.setItem('device_id', String(deviceNumericId));
          localStorage.setItem('device_uuid', deviceId);
          localStorage.setItem('device_token', deviceToken);
          localStorage.setItem('tvbox_device_name', setupData.deviceName);
          
          toast.success(`Dispositivo ${setupData.deviceName} registrado com sucesso!\nID: ${deviceNumericId}`);
          navigate('/tvbox/display');
        } else {
          throw new Error(response.data.message || 'Erro ao registrar dispositivo');
        }
      } catch (error) {
        console.error('Erro ao registrar dispositivo:', error);
        toast.error('Erro ao registrar dispositivo. Tente novamente.');
      }
    }
  };

  const handlePrevious = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="text-center">
            <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Tv className="h-12 w-12 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Configurar Dispositivo
            </h2>
            <p className="text-gray-600 mb-8">
              Vamos configurar seu dispositivo de sinalização digital
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 text-left">
                  Nome do Dispositivo
                </label>
                <input
                  type="text"
                  value={setupData.deviceName}
                  onChange={(e) => setSetupData({ ...setupData, deviceName: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: TV Recepção"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 text-left">
                  Localização
                </label>
                <input
                  type="text"
                  value={setupData.location}
                  onChange={(e) => setSetupData({ ...setupData, location: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: Recepção Principal"
                />
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="text-center">
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Settings className="h-12 w-12 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Configurações de Exibição
            </h2>
            <p className="text-gray-600 mb-8">
              Configure como o conteúdo será exibido
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 text-left">
                  Resolução
                </label>
                <select
                  value={setupData.resolution}
                  onChange={(e) => setSetupData({ ...setupData, resolution: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="1920x1080">1920x1080 (Full HD)</option>
                  <option value="1366x768">1366x768 (HD)</option>
                  <option value="3840x2160">3840x2160 (4K)</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 text-left">
                  Orientação
                </label>
                <select
                  value={setupData.orientation}
                  onChange={(e) => setSetupData({ ...setupData, orientation: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="landscape">Paisagem</option>
                  <option value="portrait">Retrato</option>
                </select>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="text-center">
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-12 w-12 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Configuração Concluída
            </h2>
            <p className="text-gray-600 mb-8">
              Seu dispositivo está pronto para uso
            </p>
            
            <div className="bg-gray-50 rounded-lg p-6 text-left">
              <h3 className="font-medium text-gray-900 mb-4">Resumo da Configuração:</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Nome:</span>
                  <span className="font-medium">{setupData.deviceName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Localização:</span>
                  <span className="font-medium">{setupData.location}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Resolução:</span>
                  <span className="font-medium">{setupData.resolution}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Orientação:</span>
                  <span className="font-medium">
                    {setupData.orientation === 'landscape' ? 'Paisagem' : 'Retrato'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full">
        {/* Progress Steps */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center space-x-4">
            {[1, 2, 3].map((stepNumber) => (
              <div key={stepNumber} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step >= stepNumber 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {stepNumber}
                </div>
                {stepNumber < 3 && (
                  <div className={`w-12 h-0.5 ${
                    step > stepNumber ? 'bg-blue-600' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Setup Card */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          {renderStep()}
          
          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8">
            <button
              onClick={handlePrevious}
              disabled={step === 1}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            
            <button
              onClick={handleNext}
              disabled={step === 1 && (!setupData.deviceName || !setupData.location)}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {step === 3 ? 'Finalizar' : 'Próximo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TVBoxSetup;