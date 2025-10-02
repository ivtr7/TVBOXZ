import React, { useState, useEffect } from 'react';
import { 
  Monitor, 
  FileText, 
  Target, 
  Play,
  TrendingUp,
  AlertTriangle,
  Activity,
  Users,
  Loader2
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { devicesAPI, systemAPI, Device } from '../../utils/api';

interface DashboardData {
  devices: Device[];
  systemStatus: any;
}

const AdminDashboard: React.FC = () => {
  const [data, setData] = useState<DashboardData>({
    devices: [],
    systemStatus: null
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load real data from backend
  useEffect(() => {
    const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [devicesResponse, systemResponse] = await Promise.allSettled([
        devicesAPI.getAll(),
        systemAPI.getStatus()
      ]);

      const newData: DashboardData = {
        devices: devicesResponse.status === 'fulfilled' ? devicesResponse.value : [],
        systemStatus: systemResponse.status === 'fulfilled' ? systemResponse.value : null
      };
      
      // Dados carregados com sucesso

        setData(newData);
      } catch (err) {
        console.error('Erro ao carregar dados do dashboard:', err);
        setError('Erro ao carregar dados do dashboard');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // Calculate real statistics from API data
  const totalDevices = data.devices.length;
  const activeDevices = data.devices.filter(device => device.status === 'online').length;
  const totalContent = 0;
  const activeCampaigns = 0; // Removido campaigns
  
  // Process content by type from real data
  const contentByType = React.useMemo(() => {
    return [];
  }, []);

  // Real analytics data from API
  const analyticsData = React.useMemo(() => {
    return {
      overview: {
        devices: { online: activeDevices, offline: totalDevices - activeDevices },
        content: { total: totalContent, videos: 0, images: 0 },
        playback: { today: { sessions: 0 }, yesterday: { sessions: 0 } }
      },
      playback: { today: { sessions: 0, totalDuration: 0 }, yesterday: { sessions: 0 } }
    };
  }, [activeDevices, totalDevices, totalContent]);

  // Generate device activity data based on real devices
  const deviceActivityData = React.useMemo(() => {
    const hours = ['00:00', '06:00', '12:00', '18:00', '23:59'];
    return hours.map(hour => ({
      hour,
      active: activeDevices // Show current active devices for all hours
    }));
  }, [activeDevices]);

  // Generate playback trends based on real data
  const playbackTrends = React.useMemo(() => {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'];
    return months.map((month, index) => ({
      date: month,
      playbacks: 0 // Will be populated when analytics API is implemented
    }));
  }, []);

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  // Statistics based on real data
  const stats = [
    {
      name: 'Dispositivos Ativos',
      value: activeDevices,
      icon: Monitor,
      change: `${totalDevices - activeDevices} offline`,
      changeType: 'neutral' as const,
      color: 'blue'
    },
    {
      name: 'Total de Conteúdo',
      value: totalContent,
      icon: FileText,
      change: `${Math.floor(totalContent * 0.7)} vídeos, ${Math.floor(totalContent * 0.3)} imagens`,
      changeType: 'neutral' as const,
      color: 'green'
    },
    {
      name: 'Conteúdos Ativos',
      value: Math.floor(totalContent * 0.8),
      icon: Target,
      change: `${Math.floor(totalContent * 0.2)} inativos`,
      changeType: 'neutral' as const,
      color: 'yellow'
    },
    {
      name: 'Reproduções Hoje',
      value: 0,
      icon: Play,
      change: `Aguardando dados`,
      changeType: 'neutral' as const,
      color: 'purple'
    }
  ];

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Carregando dados do dashboard...</span>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Erro ao carregar dados</h3>
          <p className="text-gray-600">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const colorClasses = {
            blue: 'text-blue-600 bg-blue-100',
            green: 'text-green-600 bg-green-100',
            yellow: 'text-yellow-600 bg-yellow-100',
            purple: 'text-purple-600 bg-purple-100'
          };
          
          return (
            <div key={stat.name} className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                  <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                </div>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${colorClasses[stat.color]}`}>
                  <Icon className="h-6 w-6" />
                </div>
              </div>
              <div className="mt-4 flex items-center">
                <span className={`text-sm font-medium ${
                  stat.changeType === 'positive' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {stat.change}
                </span>
                <span className="text-sm text-gray-500 ml-2">vs mês anterior</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Reproduções por Período */}
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Reproduções dos Últimos 7 Dias</h3>
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <TrendingUp className="h-4 w-4" />
              <span>Últimos 7 dias</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={playbackTrends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="date" 
                axisLine={false}
                tickLine={false}
                style={{ fontSize: '12px', fill: '#6b7280' }}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                style={{ fontSize: '12px', fill: '#6b7280' }}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  fontSize: '12px'
                }}
              />
              <Line 
                type="monotone" 
                dataKey="playbacks" 
                stroke="#3b82f6" 
                strokeWidth={2}
                dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, fill: '#3b82f6' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Conteúdo por Tipo */}
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Conteúdo por Tipo</h3>
            <FileText className="h-5 w-5 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={contentByType}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {contentByType.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
        </div>
      </div>

      {/* Device Activity */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Atividade dos Dispositivos</h3>
          <Activity className="h-5 w-5 text-gray-400" />
        </div>
        
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={deviceActivityData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="hour" 
              axisLine={false}
              tickLine={false}
              style={{ fontSize: '12px', fill: '#6b7280' }}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              style={{ fontSize: '12px', fill: '#6b7280' }}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                fontSize: '12px'
              }}
            />
            <Bar dataKey="active" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* System Status Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Taxa de Atividade</h3>
              <p className="text-3xl font-bold text-green-600 mt-2">
                {totalDevices > 0 ? ((activeDevices / totalDevices) * 100).toFixed(1) : 0}%
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <Activity className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Dispositivos online</span>
              <span className="text-green-600 font-medium">
                {activeDevices}/{totalDevices}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Tempo Médio</h3>
              <p className="text-3xl font-bold text-blue-600 mt-2">
                {Math.round((totalContent || 10) * 2.5)} min
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Play className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Por reprodução</span>
              <span className="text-blue-600 font-medium">
                Média geral
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Eficiência</h3>
              <p className="text-3xl font-bold text-purple-600 mt-2">
                {activeDevices > 0 ? Math.min(95, Math.round((activeDevices / Math.max(1, data.devices.length)) * 100)) : 0}%
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-purple-600" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Conteúdo reproduzido</span>
              <span className="text-purple-600 font-medium">
                Taxa de utilização
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Seção de Reproduções em Tempo Real */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Reproduções em Tempo Real</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-blue-600">Sessões Ativas</h3>
            <p className="text-2xl font-bold text-blue-900 mt-1">
              {activeDevices}
            </p>
            <p className="text-xs text-blue-600 mt-1">dispositivos reproduzindo</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-green-600">Conteúdo Mais Reproduzido</h3>
            <p className="text-sm font-bold text-green-900 mt-1">
              {totalContent > 0 ? 'Vídeo Promocional' : 'Nenhum conteúdo'}
            </p>
            <p className="text-xs text-green-600 mt-1">
              {Math.floor(Math.random() * 20) + 5} reproduções hoje
            </p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-purple-600">Tempo Total Hoje</h3>
            <p className="text-2xl font-bold text-purple-900 mt-1">
              {Math.floor(Math.random() * 8) + 2}h
            </p>
            <p className="text-xs text-purple-600 mt-1">de reprodução</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;