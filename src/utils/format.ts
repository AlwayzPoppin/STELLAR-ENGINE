/**
 * Formats a URL/path for display. If it's a base64 data URL, it returns a friendly description
 * of the embedded data type and its size, avoiding rendering huge strings in the DOM.
 */
export function formatDisplayUrl(url?: string): string {
  if (!url) return '';
  if (url.startsWith('data:')) {
    const commaIndex = url.indexOf(',');
    const semiIndex = url.indexOf(';');
    const endMime = Math.min(
      semiIndex !== -1 ? semiIndex : commaIndex,
      commaIndex !== -1 ? commaIndex : url.length
    );
    const mime = url.substring(5, endMime);
    
    // Estimate size in megabytes from base64 length
    // Base64 is ~4/3 of binary size.
    const commaFound = commaIndex !== -1;
    const approxLength = commaFound ? url.length - (commaIndex + 1) : url.length;
    const approxMb = (approxLength * 0.75) / (1024 * 1024);
    
    return `Embedded Asset (${mime || 'unknown'}, ~${approxMb.toFixed(1)} MB)`;
  }
  if (url.length > 2048) {
    return `Large Data Asset (~${(url.length / (1024 * 1024)).toFixed(1)} MB)`;
  }
  return url;
}

/**
 * Resolves a URL to a local proxy route if it belongs to a known CDN that blocks direct CORS
 * browser fetch requests (e.g. assets.meshy.ai).
 */
export function resolveProxiedUrl(url: string | undefined): string {
  if (!url) return '';
  if (url.includes('assets.meshy.ai')) {
    return url.replace('https://assets.meshy.ai', '/meshy-assets');
  }
  return url;
}

