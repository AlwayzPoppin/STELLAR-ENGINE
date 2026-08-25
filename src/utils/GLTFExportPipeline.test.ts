import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import {
  formatByteSize,
  triggerFileDownload,
  performInlineExport,
  exportSceneWithPipeline,
} from './GLTFExportPipeline';

describe('GLTFExportPipeline', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should correctly format byte sizes into readable units', () => {
    expect(formatByteSize(500)).toBe('500 B');
    expect(formatByteSize(1024)).toBe('1.0 KB');
    expect(formatByteSize(1536)).toBe('1.5 KB');
    expect(formatByteSize(1024 * 1024 * 3.5)).toBe('3.50 MB');
  });

  it('should trigger browser file download without throwing', () => {
    const blob = new Blob(['{"asset":{"version":"2.0"}}'], { type: 'model/gltf+json' });

    // Mock URL and DOM
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    expect(() => triggerFileDownload(blob, 'test_scene.gltf')).not.toThrow();
  });

  it('should perform inline export for JSON payloads', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-json');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    const mockGltf = { asset: { version: '2.0' }, scenes: [] };
    await expect(performInlineExport(mockGltf, false, 'scene.gltf')).resolves.not.toThrow();
  });

  it('should perform inline export for binary ArrayBuffer payloads', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-bin');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    const mockBuffer = new ArrayBuffer(64);
    await expect(performInlineExport(mockBuffer, true, 'scene.glb')).resolves.not.toThrow();
  });

  it('should execute exportSceneWithPipeline and resolve successfully', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-scene');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    // Mock GLTFExporter.parse to simulate successful parse callback
    vi.spyOn(GLTFExporter.prototype, 'parse').mockImplementation(
      (_input: any, onDone: any) => {
        onDone({ asset: { version: '2.0' }, scenes: [{ nodes: [0] }] });
      }
    );

    const scene = new THREE.Scene();
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()));

    const res = exportSceneWithPipeline(scene, {
      filename: 'test_scene.gltf',
      binary: false,
    });

    await expect(res).resolves.not.toThrow();
  });
});
