import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { toast } from '../store/useToastStore';
import type { ExportWorkerRequest, ExportWorkerResponse } from '../workers/gltfExportWorker';

export interface GLTFExportOptions {
  filename?: string;
  binary?: boolean;
  animations?: THREE.AnimationClip[];
  embedImages?: boolean;
  onlyVisible?: boolean;
  truncateDrawRange?: boolean;
  maxTextureSize?: number;
}

/**
 * Triggers a browser file download from a Blob or string content.
 */
export function triggerFileDownload(blob: Blob, filename: string) {
  if (typeof document === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();

  // Clean up Object URL
  setTimeout(() => {
    URL.revokeObjectURL(url);
    if (document.body && document.body.contains(a)) {
      document.body.removeChild(a);
    }
  }, 1000);
}

/**
 * Formats byte length into human-readable string (KB/MB).
 */
export function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Executes scene GLTF export through a dedicated Web Worker pipeline,
 * offloading JSON formatting, buffer encoding, and blob generation to prevent UI freeze.
 */
export async function exportSceneWithPipeline(
  targetObject: THREE.Object3D,
  options: GLTFExportOptions = {}
): Promise<void> {
  const isBinary = options.binary ?? false;
  const defaultFilename = isBinary ? 'scene.glb' : 'scene.gltf';
  const outFilename = options.filename || defaultFilename;

  toast.info('Exporting Scene', `Serializing 3D scene data into ${outFilename}...`);

  return new Promise((resolve, reject) => {
    const exporter = new GLTFExporter();
    const exporterOptions: any = {
      binary: isBinary,
      animations: options.animations || [],
      embedImages: options.embedImages ?? true,
      onlyVisible: options.onlyVisible ?? true,
      truncateDrawRange: options.truncateDrawRange ?? true,
      maxTextureSize: options.maxTextureSize ?? 4096,
    };

    exporter.parse(
      targetObject,
      async (gltfOutput) => {
        try {
          // Attempt offloading to Web Worker (in browser environment)
          if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
            try {
              const worker = new Worker(
                new URL('../workers/gltfExportWorker.ts', import.meta.url),
                { type: 'module' }
              );

              const requestId = `export_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
              const workerRequest: ExportWorkerRequest = {
                id: requestId,
                type: isBinary ? 'export_glb' : 'export_gltf',
                payload: gltfOutput,
                filename: outFilename,
                binary: isBinary,
              };

              const cleanupWorker = () => {
                worker.terminate();
              };

              // 30s timeout guard
              const timeoutId = setTimeout(() => {
                cleanupWorker();
                reject(new Error('GLTF Export worker timed out after 30 seconds.'));
              }, 30000);

              worker.onmessage = (e: MessageEvent<ExportWorkerResponse>) => {
                const res = e.data;
                if (res.id !== requestId) return;

                clearTimeout(timeoutId);
                cleanupWorker();

                if (res.success && res.data) {
                  const blob =
                    typeof res.data === 'string'
                      ? new Blob([res.data], { type: res.blobType || 'model/gltf+json' })
                      : new Blob([res.data], { type: res.blobType || 'model/gltf-binary' });

                  triggerFileDownload(blob, res.filename || outFilename);

                  const sizeStr = res.sizeBytes ? ` (${formatByteSize(res.sizeBytes)})` : '';
                  toast.success('GLTF Export Complete', `Successfully exported ${outFilename}${sizeStr}.`);
                  resolve();
                } else {
                  const err = new Error(res.error || 'GLTF Worker export failed.');
                  toast.error('Export Failed', err.message);
                  reject(err);
                }
              };

              worker.onerror = (errEvent) => {
                clearTimeout(timeoutId);
                cleanupWorker();
                console.warn('[GLTFExportPipeline] Worker error, falling back to inline serialization:', errEvent);
                performInlineExport(gltfOutput, isBinary, outFilename)
                  .then(resolve)
                  .catch(reject);
              };

              // Transfer ArrayBuffer if binary gltfOutput is already an ArrayBuffer
              if (gltfOutput instanceof ArrayBuffer) {
                worker.postMessage(workerRequest, [gltfOutput]);
              } else {
                worker.postMessage(workerRequest);
              }
              return;
            } catch (workerInitErr) {
              console.warn('[GLTFExportPipeline] Web Worker could not be initialized, using inline fallback:', workerInitErr);
            }
          }

          // Fallback to inline export
          await performInlineExport(gltfOutput, isBinary, outFilename);
          resolve();
        } catch (err: any) {
          console.error('[GLTFExportPipeline] Export error:', err);
          toast.error('Export Failed', err?.message || 'Could not export scene.');
          reject(err);
        }
      },
      (error) => {
        console.error('[GLTFExportPipeline] GLTFExporter parse error:', error);
        toast.error('Export Failed', 'An error occurred during Three.js scene parsing.');
        reject(error);
      },
      exporterOptions
    );
  });
}

/**
 * Fallback synchronous export method when Web Workers are unavailable or restricted.
 */
export async function performInlineExport(
  gltfOutput: any,
  isBinary: boolean,
  outFilename: string
): Promise<void> {
  let blob: Blob;
  let byteSize = 0;

  if (isBinary && gltfOutput instanceof ArrayBuffer) {
    blob = new Blob([gltfOutput], { type: 'model/gltf-binary' });
    byteSize = gltfOutput.byteLength;
  } else if (typeof gltfOutput === 'string') {
    blob = new Blob([gltfOutput], { type: 'model/gltf+json' });
    byteSize = gltfOutput.length;
  } else {
    const jsonString = JSON.stringify(gltfOutput, null, 2);
    blob = new Blob([jsonString], { type: 'model/gltf+json' });
    byteSize = jsonString.length;
  }

  triggerFileDownload(blob, outFilename);
  const sizeStr = byteSize > 0 ? ` (${formatByteSize(byteSize)})` : '';
  toast.success('GLTF Export Complete', `Successfully exported ${outFilename}${sizeStr}.`);
}
