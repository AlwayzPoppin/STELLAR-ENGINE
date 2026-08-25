/**
 * gltfExportWorker.ts — Dedicated Web Worker for GLTF/GLB Packaging & Serialization
 * 
 * Offloads CPU-intensive JSON stringification, binary GLB chunk layout construction,
 * and memory buffer operations off the main UI thread.
 */

export interface ExportWorkerRequest {
  id: string;
  type: 'export_gltf' | 'export_glb';
  payload: any;
  filename?: string;
  binary?: boolean;
}

export interface ExportWorkerResponse {
  id: string;
  success: boolean;
  data?: ArrayBuffer | string;
  blobType?: string;
  filename?: string;
  sizeBytes?: number;
  error?: string;
}

// In standard Web Worker context
if (typeof self !== 'undefined' && typeof window === 'undefined') {
  self.onmessage = async (e: MessageEvent<ExportWorkerRequest>) => {
    const { id, type, payload, filename, binary } = e.data;

    try {
      if (type === 'export_glb' || binary) {
        let arrayBuffer: ArrayBuffer;

        if (payload instanceof ArrayBuffer) {
          arrayBuffer = payload;
        } else if (typeof payload === 'object' && payload !== null) {
          // Construct binary GLB container from JSON payload
          const jsonString = JSON.stringify(payload);
          const encoder = new TextEncoder();
          const jsonBuffer = encoder.encode(jsonString);

          // 4-byte alignment padding with spaces (0x20)
          const jsonPadding = (4 - (jsonBuffer.byteLength % 4)) % 4;
          const jsonChunkLength = jsonBuffer.byteLength + jsonPadding;

          const totalHeaderLength = 12; // Header: magic(4) + version(4) + length(4)
          const totalJsonChunkHeaderLength = 8; // Chunk header: length(4) + type(4)
          const totalLength = totalHeaderLength + totalJsonChunkHeaderLength + jsonChunkLength;

          const glbBuffer = new ArrayBuffer(totalLength);
          const dataView = new DataView(glbBuffer);
          const uint8View = new Uint8Array(glbBuffer);

          // 1. GLB Header
          dataView.setUint32(0, 0x46546c67, true); // Magic: 'glTF'
          dataView.setUint32(4, 2, true); // Version: 2
          dataView.setUint32(8, totalLength, true); // Total Length

          // 2. JSON Chunk Header
          dataView.setUint32(12, jsonChunkLength, true); // Chunk Length
          dataView.setUint32(16, 0x4e4f534a, true); // Chunk Type: 'JSON'

          // 3. JSON Chunk Data & Padding
          uint8View.set(jsonBuffer, 20);
          for (let i = 0; i < jsonPadding; i++) {
            uint8View[20 + jsonBuffer.byteLength + i] = 0x20;
          }

          arrayBuffer = glbBuffer;
        } else {
          throw new Error('Invalid GLB payload format.');
        }

        const outFilename = filename || 'scene.glb';
        const response: ExportWorkerResponse = {
          id,
          success: true,
          data: arrayBuffer,
          blobType: 'model/gltf-binary',
          filename: outFilename,
          sizeBytes: arrayBuffer.byteLength,
        };

        // Zero-copy transfer of ArrayBuffer to main thread
        (self as any).postMessage(response, [arrayBuffer]);
      } else {
        // Standard JSON GLTF export
        let jsonString: string;
        if (typeof payload === 'string') {
          jsonString = payload;
        } else {
          // Heavy JSON.stringify offloaded to worker thread
          jsonString = JSON.stringify(payload, null, 2);
        }

        const outFilename = filename || 'scene.gltf';
        const encoder = new TextEncoder();
        const byteLength = encoder.encode(jsonString).byteLength;

        const response: ExportWorkerResponse = {
          id,
          success: true,
          data: jsonString,
          blobType: 'model/gltf+json',
          filename: outFilename,
          sizeBytes: byteLength,
        };

        (self as any).postMessage(response);
      }
    } catch (err: any) {
      const response: ExportWorkerResponse = {
        id,
        success: false,
        error: err?.message || 'Unknown error during GLTF worker export.',
      };
      (self as any).postMessage(response);
    }
  };
}
