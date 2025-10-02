import request from 'supertest';
import app from '../server.js';
import { db } from '../config/database.js';

describe('Device Registration', () => {
  beforeEach(async () => {
    // Clean up test data
    await db.execute('DELETE FROM devices WHERE device_uuid LIKE "test-%"');
  });

  afterAll(async () => {
    // Clean up and close connections
    await db.execute('DELETE FROM devices WHERE device_uuid LIKE "test-%"');
    await db.end();
  });

  test('should register new device', async () => {
    const deviceData = {
      device_uuid: 'test-uuid-1',
      name: 'Test Device',
      model: 'Test Model',
      tenant_id: 1
    };

    const response = await request(app)
      .post('/api/devices/register')
      .send(deviceData)
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.device.device_uuid).toBe(deviceData.device_uuid);
    expect(response.body.token).toBeDefined();
  });

  test('should return existing device on duplicate registration', async () => {
    const deviceData = {
      device_uuid: 'test-uuid-2',
      name: 'Test Device 2',
      model: 'Test Model',
      tenant_id: 1
    };

    // First registration
    const firstResponse = await request(app)
      .post('/api/devices/register')
      .send(deviceData)
      .expect(201);

    // Second registration with same UUID
    const secondResponse = await request(app)
      .post('/api/devices/register')
      .send(deviceData)
      .expect(200);

    expect(secondResponse.body.success).toBe(true);
    expect(secondResponse.body.device.id).toBe(firstResponse.body.device.id);
  });

  test('should require device_uuid and tenant_id', async () => {
    const response = await request(app)
      .post('/api/devices/register')
      .send({ name: 'Test Device' })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('device_uuid and tenant_id are required');
  });
});

describe('Player Manifest', () => {
  let deviceToken;
  let deviceId;

  beforeAll(async () => {
    // Create test device
    const deviceData = {
      device_uuid: 'test-manifest-device',
      name: 'Manifest Test Device',
      tenant_id: 1
    };

    const response = await request(app)
      .post('/api/devices/register')
      .send(deviceData);

    deviceToken = response.body.token;
    deviceId = response.body.device.id;
  });

  afterAll(async () => {
    await db.execute('DELETE FROM devices WHERE device_uuid = "test-manifest-device"');
  });

  test('should return device manifest with valid token', async () => {
    const response = await request(app)
      .get(`/api/player/${deviceId}/manifest`)
      .set('Authorization', `Bearer ${deviceToken}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeInstanceOf(Array);
    expect(response.body.device_id).toBe(deviceId);
  });

  test('should reject manifest request without token', async () => {
    const response = await request(app)
      .get(`/api/player/${deviceId}/manifest`)
      .expect(401);

    expect(response.body.success).toBe(false);
  });

  test('should reject manifest request with wrong device ID', async () => {
    const response = await request(app)
      .get(`/api/player/99999/manifest`)
      .set('Authorization', `Bearer ${deviceToken}`)
      .expect(403);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('Device ID mismatch');
  });
});