import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  SerializationManager,
  sanitizeObjectDirect,
  sanitizeObjectsSync,
  safeSerializeObjectsSync,
} from './SerializationManager';

describe('SerializationManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    SerializationManager.cancelAutosave();
    vi.useRealTimers();
  });

  it('should filter out transient objects like gltf_part and celestial sun/moon', () => {
    const objects = [
      { id: 'cube_1', name: 'Cube', type: 'mesh', position: [0, 0, 0] },
      { id: 'part_sub', name: 'SubMesh', type: 'gltf_part' },
      { id: 'obj_sun', name: 'Sun', type: 'light' },
      { id: 'obj_moon', name: 'Moon', type: 'light' },
      { id: 'sky_sun', name: 'SkySun', type: 'mesh', url: 'https://example.com/_shining_sun_texture.png' },
      { id: 'sphere_1', name: 'Sphere', type: 'mesh', position: [1, 2, 3] },
    ];

    const sanitized = sanitizeObjectsSync(objects);
    expect(sanitized.length).toBe(2);
    expect(sanitized[0].id).toBe('cube_1');
    expect(sanitized[1].id).toBe('sphere_1');
  });

  it('should sanitize material texture objects and properties cleanly', () => {
    const rawObject = {
      id: 'mesh_mat',
      name: 'Textured Box',
      type: 'mesh',
      material: {
        color: '#ff0000',
        presetMap: 'brick',
        customMap: { isTexture: true, image: { src: 'blob:http://localhost/tex.png' } },
        roughness: 0.8,
        metalness: 0.1,
      },
    };

    const sanitized = sanitizeObjectDirect(rawObject);
    expect(sanitized.material.color).toBe('#ff0000');
    expect(sanitized.material.customMap).toBe('blob:http://localhost/tex.png');
    expect(sanitized.material.roughness).toBe(0.8);
    expect(sanitized.material.metalness).toBe(0.1);
  });

  it('should serialize objects to valid JSON string synchronously and asynchronously', async () => {
    const objects = [
      { id: 'obj_1', name: 'Item A', type: 'mesh', position: [10, 20, 30] },
      { id: 'obj_2', name: 'Item B', type: 'mesh', position: [0, 5, 0] },
    ];

    const syncResult = safeSerializeObjectsSync(objects);
    const parsedSync = JSON.parse(syncResult);
    expect(parsedSync.length).toBe(2);
    expect(parsedSync[0].name).toBe('Item A');

    const asyncResult = await SerializationManager.serializeObjectsAsync(objects);
    const parsedAsync = JSON.parse(asyncResult);
    expect(parsedAsync.length).toBe(2);
    expect(parsedAsync[1].name).toBe('Item B');
  });

  it('should debounce rapid autosave requests and invoke save callback once', async () => {
    const saveSpy = vi.fn();

    // Trigger 5 rapid autosave calls
    SerializationManager.scheduleAutosave([{ id: 'obj_1', name: 'Version 1' }], saveSpy);
    SerializationManager.scheduleAutosave([{ id: 'obj_1', name: 'Version 2' }], saveSpy);
    SerializationManager.scheduleAutosave([{ id: 'obj_1', name: 'Version 3' }], saveSpy);
    SerializationManager.scheduleAutosave([{ id: 'obj_1', name: 'Version 4' }], saveSpy);
    SerializationManager.scheduleAutosave([{ id: 'obj_1', name: 'Version 5 - Final' }], saveSpy);

    expect(saveSpy).not.toHaveBeenCalled();

    // Advance past debounce interval (500ms)
    await vi.advanceTimersByTimeAsync(600);

    expect(saveSpy).toHaveBeenCalledTimes(1);
    const savedPayload = JSON.parse(saveSpy.mock.calls[0][0]);
    expect(savedPayload[0].name).toBe('Version 5 - Final');
  });
});
