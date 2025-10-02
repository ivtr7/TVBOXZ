import axios from 'axios';

// Create axios instance with base configuration
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized access
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Announcements API functions
export const announcementsApi = {
  // Admin: list for a device (requires auth)
  getByDevice: (deviceId: string) => api.get(`/announcements/${deviceId}`),
  // Admin: create for a device
  create: (deviceId: string, data: any) => api.post(`/announcements/${deviceId}`, data),
  // Admin: update specific announcement
  update: (deviceId: string, id: string, data: any) => api.put(`/announcements/${deviceId}/${id}`, data),
  // Admin: delete
  delete: (deviceId: string, id: string) => api.delete(`/announcements/${deviceId}/${id}`),
  // Admin: reorder
  updateOrder: (deviceId: string, announcements: any[]) => api.put(`/announcements/${deviceId}/reorder`, { announcements }),
  // TVBox: public active announcements, no auth
  getActiveByDevice: (deviceId: string) => api.get(`/announcements/${deviceId}/active`),
};

export default api;