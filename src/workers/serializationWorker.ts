/**
 * Dedicated Web Worker for asynchronous scene serialization.
 * Executes JSON serialization, material sanitization, and transient mesh filtering off the main thread.
 */

function sanitizeObjectForWorker(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;

  if (obj.type === 'gltf_part' || obj.id === 'obj_sun' || obj.id === 'obj_moon') {
    return null;
  }
  if (obj.url && typeof obj.url === 'string' && (obj.url.includes('_shining_sun') || obj.url.includes('shining_moon_'))) {
    return null;
  }

  const cleanObj: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === 'material' && value && typeof value === 'object') {
      const mat = value as Record<string, any>;
      cleanObj.material = {
        color: mat.color || '#ffffff',
        presetMap: mat.presetMap || 'none',
        customMap: typeof mat.customMap === 'string' ? mat.customMap : (mat.customMap?.image?.src || null),
        normalMap: typeof mat.normalMap === 'string' ? mat.normalMap : (mat.normalMap?.image?.src || null),
        roughness: mat.roughness !== undefined ? mat.roughness : 0.5,
        metalness: mat.metalness !== undefined ? mat.metalness : 0,
        envMapIntensity: mat.envMapIntensity !== undefined ? mat.envMapIntensity : 1,
      };
    } else if (value && typeof value === 'object' && ((value as any).isTexture || (value as any).isThreeTexture)) {
      cleanObj[key] = (value as any).image?.src || (value as any).source?.data?.src || (value as any).texturePath || null;
    } else if (typeof HTMLElement !== 'undefined' && value instanceof HTMLElement) {
      cleanObj[key] = null;
    } else {
      cleanObj[key] = value;
    }
  }

  return cleanObj;
}

self.onmessage = (event: MessageEvent) => {
  const { type, requestId, objects } = event.data;

  if (type === 'SERIALIZE') {
    try {
      if (!Array.isArray(objects)) {
        self.postMessage({ type: 'SERIALIZE_SUCCESS', requestId, jsonString: '[]' });
        return;
      }

      const safeObjects: any[] = [];
      for (const obj of objects) {
        const sanitized = sanitizeObjectForWorker(obj);
        if (sanitized) {
          safeObjects.push(sanitized);
        }
      }

      const jsonString = JSON.stringify(safeObjects);
      self.postMessage({ type: 'SERIALIZE_SUCCESS', requestId, jsonString });
    } catch (err: any) {
      self.postMessage({ type: 'SERIALIZE_ERROR', requestId, error: err.message || 'Serialization failed' });
    }
  }
};
