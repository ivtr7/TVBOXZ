import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import DevicesPage from '../pages/admin/DevicesPage';
import * as api from '../utils/api';

// Mock API
jest.mock('../utils/api');
const mockedApi = api as jest.Mocked<typeof api>;

// Mock toast
jest.mock('react-hot-toast', () => ({
  success: jest.fn(),
  error: jest.fn(),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('DevicesPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders device cards when API returns devices', async () => {
    const mockDevices = [
      {
        id: '1',
        nome: 'TV Sala 1',
        localizacao: 'Recepção',
        status: 'online',
        ultima_atividade: new Date().toISOString(),
        device_uuid: 'uuid-1',
      },
      {
        id: '2',
        nome: 'TV Sala 2',
        localizacao: 'Corredor',
        status: 'offline',
        ultima_atividade: new Date().toISOString(),
        device_uuid: 'uuid-2',
      },
    ];

    mockedApi.default.get.mockResolvedValue({
      data: { success: true, data: mockDevices },
    });

    render(<DevicesPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('TV Sala 1')).toBeInTheDocument();
      expect(screen.getByText('TV Sala 2')).toBeInTheDocument();
      expect(screen.getByText('Recepção')).toBeInTheDocument();
      expect(screen.getByText('Corredor')).toBeInTheDocument();
    });
  });

  test('shows loading state initially', () => {
    mockedApi.default.get.mockImplementation(() => new Promise(() => {}));

    render(<DevicesPage />, { wrapper: createWrapper() });

    expect(screen.getByText(/carregando/i)).toBeInTheDocument();
  });

  test('displays stats correctly', async () => {
    const mockDevices = [
      {
        id: '1',
        nome: 'TV 1',
        localizacao: 'Local 1',
        status: 'online',
        ultima_atividade: new Date().toISOString(),
      },
      {
        id: '2',
        nome: 'TV 2',
        localizacao: 'Local 2',
        status: 'offline',
        ultima_atividade: new Date().toISOString(),
      },
    ];

    mockedApi.default.get.mockResolvedValue({
      data: { success: true, data: mockDevices },
    });

    render(<DevicesPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument(); // Total devices
      expect(screen.getByText('1')).toBeInTheDocument(); // Online devices
    });
  });
});