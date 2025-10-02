import React, { useEffect, useState } from 'react';
import DeviceOnboarding from '../components/DeviceOnboarding';
import MediaPlayer from '../components/MediaPlayer';
import { deviceStorage } from '../utils/deviceStorage';
import api from '../utils/api';

const DeviceApp: React.FC = () => {
  const [deviceId, setDeviceId] = useState<number | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [deviceToken, setDeviceToken] = useState<string | null>(null);

  useEffect(() => {
    const initializeDevice = async () => {
      try {
        // Check if device token exists
        const storedToken = localStorage.getItem('device_token');
        const storedDeviceId = localStorage.getItem('device_id');
        
        if (storedToken && storedDeviceId) {
          // Validate token with server
          try {
            const response = await api.get(`/player/${storedDeviceId}/manifest`, {
              headers: {
                'Authorization': `Bearer ${storedToken}`
              }
            });
            
            if (response.data.success) {
              setDeviceId(parseInt(storedDeviceId));
              setDeviceToken(storedToken);
            }
          } catch (error: any) {
            if (error.response?.status === 404) {
              // Device not found, clear storage
              localStorage.removeItem('device_token');
              localStorage.removeItem('device_id');
              localStorage.removeItem('device_uuid');
            } else if (error.response?.status === 403) {
              // Device blocked
              setIsBlocked(true);
              setDeviceId(parseInt(storedDeviceId));
            } else {
              // Token invalid, clear storage
              localStorage.removeItem('device_token');
              localStorage.removeItem('device_id');
              localStorage.removeItem('device_uuid');
            }
          }
        }
      } catch (error) {
        console.error('Error initializing device:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeDevice();
  }, []);

  const handleOnboardingComplete = async (newDeviceId: number, token: string) => {
    setDeviceId(newDeviceId);
    setDeviceToken(token);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-xl">Inicializando dispositivo...</p>
        </div>
      </div>
    );
  }

  if (!deviceId) {
    return <DeviceOnboarding onComplete={handleOnboardingComplete} />;
  }

  return <MediaPlayer deviceId={deviceId} isBlocked={isBlocked} />;
};

export default DeviceApp;