import db from './config/database.js';

const sampleFiles = [
  {
    device_id: 1,
    name: 'video1.mp4',
    type: 'video/mp4',
    size: 15728640, // 15MB
    file_path: '/uploads/device_1/video1.mp4',
    order_index: 1
  },
  {
    device_id: 1,
    name: 'image1.jpg',
    type: 'image/jpeg',
    size: 2097152, // 2MB
    file_path: '/uploads/device_1/image1.jpg',
    order_index: 2
  },
  {
    device_id: 1,
    name: 'video2.mp4',
    type: 'video/mp4',
    size: 20971520, // 20MB
    file_path: '/uploads/device_1/video2.mp4',
    order_index: 3
  }
];

try {
  for (const file of sampleFiles) {
    await db.execute(
      'INSERT INTO device_files (device_id, name, type, size, file_path, order_index) VALUES (?, ?, ?, ?, ?, ?)',
      [file.device_id, file.name, file.type, file.size, file.file_path, file.order_index]
    );
  }
  console.log('Sample files inserted successfully');
  process.exit(0);
} catch (error) {
  console.error('Error inserting sample files:', error);
  process.exit(1);
}