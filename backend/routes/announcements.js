import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import db from '../config/database.js';

const router = express.Router();

// Listar anúncios de um dispositivo
router.get('/:deviceId', authenticateToken, async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    const [announcements] = await db.execute(
      'SELECT * FROM announcements WHERE device_id = ? ORDER BY order_index ASC, created_at DESC',
      [deviceId]
    );
    
    res.json(announcements);
  } catch (error) {
    console.error('Erro ao listar anúncios:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Criar novo anúncio
router.post('/:deviceId', authenticateToken, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const {
      title,
      content,
      background_color = '#000000',
      text_color = '#FFFFFF',
      font_size = 24,
      display_duration = 10,
      is_active = 1,
      order_index = 0
    } = req.body;
    
    // Validações básicas
    if (!title || !content) {
      return res.status(400).json({ error: 'Título e conteúdo são obrigatórios' });
    }
    
    if (title.length > 255) {
      return res.status(400).json({ error: 'Título deve ter no máximo 255 caracteres' });
    }
    
    if (font_size < 12 || font_size > 72) {
      return res.status(400).json({ error: 'Tamanho da fonte deve estar entre 12 e 72' });
    }
    
    if (display_duration < 5 || display_duration > 300) {
      return res.status(400).json({ error: 'Duração deve estar entre 5 e 300 segundos' });
    }
    
    // Verificar se o dispositivo existe
    const [device] = await db.execute('SELECT id FROM devices WHERE id = ?', [deviceId]);
    if (device.length === 0) {
      return res.status(404).json({ error: 'Dispositivo não encontrado' });
    }
    
    const [result] = await db.execute(
      `INSERT INTO announcements 
       (device_id, title, content, background_color, text_color, font_size, display_duration, is_active, order_index) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [deviceId, title, content, background_color, text_color, font_size, display_duration, is_active, order_index]
    );
    
    const [newAnnouncement] = await db.execute(
      'SELECT * FROM announcements WHERE id = ?',
      [result.insertId]
    );
    
    res.status(201).json(newAnnouncement[0]);
  } catch (error) {
    console.error('Erro ao criar anúncio:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Atualizar anúncio
router.put('/:deviceId/:announcementId', authenticateToken, async (req, res) => {
  try {
    const { deviceId, announcementId } = req.params;
    const {
      title,
      content,
      background_color,
      text_color,
      font_size,
      display_duration,
      is_active,
      order_index
    } = req.body;
    
    // Verificar se o anúncio existe e pertence ao dispositivo
    const [existing] = await db.execute(
      'SELECT * FROM announcements WHERE id = ? AND device_id = ?',
      [announcementId, deviceId]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Anúncio não encontrado' });
    }
    
    // Validações
    if (title && title.length > 255) {
      return res.status(400).json({ error: 'Título deve ter no máximo 255 caracteres' });
    }
    
    if (font_size && (font_size < 12 || font_size > 72)) {
      return res.status(400).json({ error: 'Tamanho da fonte deve estar entre 12 e 72' });
    }
    
    if (display_duration && (display_duration < 5 || display_duration > 300)) {
      return res.status(400).json({ error: 'Duração deve estar entre 5 e 300 segundos' });
    }
    
    // Construir query de atualização dinamicamente
    const updates = [];
    const values = [];
    
    if (title !== undefined) { updates.push('title = ?'); values.push(title); }
    if (content !== undefined) { updates.push('content = ?'); values.push(content); }
    if (background_color !== undefined) { updates.push('background_color = ?'); values.push(background_color); }
    if (text_color !== undefined) { updates.push('text_color = ?'); values.push(text_color); }
    if (font_size !== undefined) { updates.push('font_size = ?'); values.push(font_size); }
    if (display_duration !== undefined) { updates.push('display_duration = ?'); values.push(display_duration); }
    if (is_active !== undefined) { updates.push('is_active = ?'); values.push(is_active); }
    if (order_index !== undefined) { updates.push('order_index = ?'); values.push(order_index); }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }
    
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(announcementId, deviceId);
    
    await db.execute(
      `UPDATE announcements SET ${updates.join(', ')} WHERE id = ? AND device_id = ?`,
      values
    );
    
    const [updated] = await db.execute(
      'SELECT * FROM announcements WHERE id = ? AND device_id = ?',
      [announcementId, deviceId]
    );
    
    res.json(updated[0]);
  } catch (error) {
    console.error('Erro ao atualizar anúncio:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Deletar anúncio
router.delete('/:deviceId/:announcementId', authenticateToken, async (req, res) => {
  try {
    const { deviceId, announcementId } = req.params;
    
    const [result] = await db.execute(
      'DELETE FROM announcements WHERE id = ? AND device_id = ?',
      [announcementId, deviceId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Anúncio não encontrado' });
    }
    
    res.json({ message: 'Anúncio deletado com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar anúncio:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Reordenar anúncios
router.put('/:deviceId/reorder', authenticateToken, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { announcements } = req.body;
    
    if (!Array.isArray(announcements)) {
      return res.status(400).json({ error: 'Lista de anúncios inválida' });
    }
    
    // Atualizar ordem de cada anúncio
    for (let i = 0; i < announcements.length; i++) {
      const announcementId = announcements[i].id;
      await db.execute(
        'UPDATE announcements SET order_index = ? WHERE id = ? AND device_id = ?',
        [i, announcementId, deviceId]
      );
    }
    
    res.json({ message: 'Ordem dos anúncios atualizada com sucesso' });
  } catch (error) {
    console.error('Erro ao reordenar anúncios:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Obter anúncios ativos para exibição (sem autenticação - usado pelo TVBox)
router.get('/:deviceId/active', async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    const [announcements] = await db.execute(
      'SELECT * FROM announcements WHERE device_id = ? AND is_active = 1 ORDER BY order_index ASC, created_at DESC',
      [deviceId]
    );
    
    res.json(announcements);
  } catch (error) {
    console.error('Erro ao buscar anúncios ativos:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;