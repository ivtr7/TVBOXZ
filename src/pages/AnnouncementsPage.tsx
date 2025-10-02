import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Eye, EyeOff, GripVertical, Save, X } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { toast } from 'react-hot-toast';

interface Announcement {
  id: string;
  device_id: number;
  title: string;
  content: string;
  background_color?: string;
  text_color?: string;
  font_size?: number;
  display_duration: number;
  is_active: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
}

interface Device {
  id: number;
  name: string;
  location: string;
}

// Componente para item arrastável
const SortableItem: React.FC<{ announcement: Announcement; onEdit: (announcement: Announcement) => void; onDelete: (id: number) => void; onToggleActive: (announcement: Announcement) => void }> = ({ announcement, onEdit, onDelete, onToggleActive }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: announcement.id.toString() });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="p-4 border-b flex items-center gap-4 bg-white"
    >
      <div {...attributes} {...listeners} className="text-gray-400 hover:text-gray-600 cursor-grab">
        <GripVertical size={20} />
      </div>

      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-semibold">{announcement.title}</h3>
          {announcement.is_active ? (
            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
              Ativo
            </span>
          ) : (
            <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">
              Inativo
            </span>
          )}
        </div>
        <p className="text-gray-600 text-sm line-clamp-2">{announcement.content}</p>
        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
          <span>Duração: {announcement.display_duration}s</span>
          <span>Fonte: {announcement.font_size}px</span>
          <div className="flex items-center gap-1">
            <div 
              className="w-3 h-3 rounded-full border"
              style={{ backgroundColor: announcement.background_color }}
            ></div>
            <div 
              className="w-3 h-3 rounded-full border"
              style={{ backgroundColor: announcement.text_color }}
            ></div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onToggleActive(announcement)}
          className={`p-2 rounded-md ${
            announcement.is_active
              ? 'text-green-600 hover:bg-green-50'
              : 'text-gray-400 hover:bg-gray-50'
          }`}
          title={announcement.is_active ? 'Desativar' : 'Ativar'}
        >
          {announcement.is_active ? <Eye size={16} /> : <EyeOff size={16} />}
        </button>
        <button
          onClick={() => onEdit(announcement)}
          className="p-2 text-blue-600 hover:bg-blue-50 rounded-md"
          title="Editar"
        >
          <Edit size={16} />
        </button>
        <button
          onClick={() => onDelete(announcement.id)}
          className="p-2 text-red-600 hover:bg-red-50 rounded-md"
          title="Deletar"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
};

const AnnouncementsPage: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<number | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [formData, setFormData] = useState<Partial<Announcement>>({
    title: '',
    content: '',
    device_id: 1,
    background_color: '#000000',
    text_color: '#FFFFFF',
    font_size: 24,
    display_duration: 5,
    is_active: true,
    order_index: 0
  });

  // Carregar dispositivos
  useEffect(() => {
    fetchDevices();
  }, []);

  // Carregar anúncios quando dispositivo é selecionado
  useEffect(() => {
    if (selectedDevice) {
      fetchAnnouncements(selectedDevice);
    }
  }, [selectedDevice]);

  const fetchDevices = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/devices', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setDevices(data);
        if (data.length > 0 && !selectedDevice) {
          setSelectedDevice(data[0].id);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar dispositivos:', error);
      toast.error('Erro ao carregar dispositivos');
    }
  };

  const fetchAnnouncements = async (deviceId: number) => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/announcements/${deviceId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setAnnouncements(data);
      }
    } catch (error) {
      console.error('Erro ao carregar anúncios:', error);
      toast.error('Erro ao carregar anúncios');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDevice) return;

    try {
      const token = localStorage.getItem('token');
      const url = editingAnnouncement 
        ? `/api/announcements/${selectedDevice}/${editingAnnouncement.id}`
        : `/api/announcements/${selectedDevice}`;
      
      const method = editingAnnouncement ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        toast.success(editingAnnouncement ? 'Anúncio atualizado!' : 'Anúncio criado!');
        setShowForm(false);
        setEditingAnnouncement(null);
        resetForm();
        fetchAnnouncements(selectedDevice);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erro ao salvar anúncio');
      }
    } catch (error) {
      console.error('Erro ao salvar anúncio:', error);
      toast.error('Erro ao salvar anúncio');
    }
  };

  const handleEdit = (announcement: Announcement) => {
    setEditingAnnouncement(announcement);
    setFormData({
      title: announcement.title,
      content: announcement.content,
      background_color: announcement.background_color,
      text_color: announcement.text_color,
      font_size: announcement.font_size,
      display_duration: announcement.display_duration,
      is_active: announcement.is_active,
      order_index: announcement.order_index
    });
    setShowForm(true);
  };

  const handleDelete = async (announcementId: number) => {
    if (!selectedDevice || !confirm('Tem certeza que deseja deletar este anúncio?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/announcements/${selectedDevice}/${announcementId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        toast.success('Anúncio deletado!');
        fetchAnnouncements(selectedDevice);
      }
    } catch (error) {
      console.error('Erro ao deletar anúncio:', error);
      toast.error('Erro ao deletar anúncio');
    }
  };

  const toggleActive = async (announcement: Announcement) => {
    if (!selectedDevice) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/announcements/${selectedDevice}/${announcement.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ is_active: !announcement.is_active })
      });
      
      if (response.ok) {
        toast.success(announcement.is_active ? 'Anúncio desativado!' : 'Anúncio ativado!');
        fetchAnnouncements(selectedDevice);
      }
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      toast.error('Erro ao alterar status');
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || !selectedDevice || active.id === over.id) return;

    const oldIndex = announcements.findIndex((item) => item.id.toString() === active.id);
    const newIndex = announcements.findIndex((item) => item.id.toString() === over.id);

    const items = arrayMove(announcements, oldIndex, newIndex);

    // Atualizar ordem local imediatamente
    setAnnouncements(items);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/announcements/${selectedDevice}/reorder`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ announcements: items })
      });
      
      if (response.ok) {
        toast.success('Ordem atualizada!');
      }
    } catch (error) {
      console.error('Erro ao reordenar:', error);
      toast.error('Erro ao reordenar anúncios');
      // Reverter mudanças em caso de erro
      fetchAnnouncements(selectedDevice);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      background_color: '#000000',
      text_color: '#FFFFFF',
      font_size: 24,
      display_duration: 10,
      is_active: true,
      order_index: 0
    });
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingAnnouncement(null);
    resetForm();
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Gerenciar Anúncios</h1>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus size={20} />
          Novo Anúncio
        </button>
      </div>

      {/* Seletor de Dispositivo */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Selecionar Dispositivo
        </label>
        <select
          value={selectedDevice || ''}
          onChange={(e) => setSelectedDevice(Number(e.target.value))}
          className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Selecione um dispositivo</option>
          {devices.map((device) => (
            <option key={device.id} value={device.id}>
              {device.name} - {device.location}
            </option>
          ))}
        </select>
      </div>

      {/* Formulário */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">
                {editingAnnouncement ? 'Editar Anúncio' : 'Novo Anúncio'}
              </h2>
              <button onClick={handleCancel} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Título *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                    maxLength={255}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Device ID
                  </label>
                  <input
                    type="number"
                    value={formData.device_id}
                    onChange={(e) => setFormData({ ...formData, device_id: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                    min="1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Conteúdo *
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={4}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cor de Fundo
                  </label>
                  <input
                    type="color"
                    value={formData.background_color}
                    onChange={(e) => setFormData({ ...formData, background_color: e.target.value })}
                    className="w-full h-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cor do Texto
                  </label>
                  <input
                    type="color"
                    value={formData.text_color}
                    onChange={(e) => setFormData({ ...formData, text_color: e.target.value })}
                    className="w-full h-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Duração (segundos)
                  </label>
                  <input
                    type="number"
                    value={formData.display_duration}
                    onChange={(e) => setFormData({ ...formData, display_duration: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min={1}
                    max={60}
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tamanho da Fonte
                  </label>
                  <input
                    type="number"
                    value={formData.font_size}
                    onChange={(e) => setFormData({ ...formData, font_size: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min={12}
                    max={72}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ordem
                  </label>
                  <input
                    type="number"
                    value={formData.order_index}
                    onChange={(e) => setFormData({ ...formData, order_index: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min={0}
                  />
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="mr-2"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                  Anúncio ativo
                </label>
              </div>

              {/* Preview */}
              <div className="border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Preview
                </label>
                <div 
                  className="p-4 rounded-md text-center"
                  style={{
                    backgroundColor: formData.background_color,
                    color: formData.text_color,
                    fontSize: `${formData.font_size}px`
                  }}
                >
                  <h3 className="font-bold mb-2">{formData.title || 'Título do Anúncio'}</h3>
                  <p>{formData.content || 'Conteúdo do anúncio aparecerá aqui...'}</p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
                >
                  <Save size={16} />
                  {editingAnnouncement ? 'Atualizar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lista de Anúncios */}
      {selectedDevice && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold">Anúncios do Dispositivo</h2>
            <p className="text-sm text-gray-600">
              Arraste e solte para reordenar os anúncios
            </p>
          </div>

          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Carregando anúncios...</p>
            </div>
          ) : announcements.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p>Nenhum anúncio encontrado para este dispositivo.</p>
              <p className="text-sm mt-1">Clique em "Novo Anúncio" para criar o primeiro.</p>
            </div>
          ) : (
            <DndContext 
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext 
                items={announcements.map(a => a.id.toString())}
                strategy={verticalListSortingStrategy}
              >
                <div>
                  {announcements.map((announcement) => (
                    <SortableItem
                      key={announcement.id}
                      announcement={announcement}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onToggleActive={toggleActive}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      )}
    </div>
  );
};

export default AnnouncementsPage;