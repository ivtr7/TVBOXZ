import db from './config/database.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const updates = [
  {
    id: 1,
    file_path: path.join(__dirname, 'uploads', 'device_1', 'video1.mp4')
  },
  {
    id: 2,
    file_path: path.join(__dirname, 'uploads', 'device_1', 'image1.jpg')
  },
  {
    id: 3,
    file_path: path.join(__dirname, 'uploads', 'device_1', 'video2.mp4')
  }
];

try {
  for (const update of updates) {
    await db.execute(
      'UPDATE device_files SET file_path = ? WHERE id = ?',
      [update.file_path, update.id]
    );
  }
  console.log('File paths updated successfully');
  process.exit(0);
} catch (error) {
  console.error('Error updating file paths:', error);
  process.exit(1);
}