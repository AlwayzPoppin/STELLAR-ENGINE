import { describe, it, expect } from 'vitest';
import { formatDisplayUrl } from './format';

describe('formatDisplayUrl', () => {
  it('should return empty string for undefined or empty input', () => {
    expect(formatDisplayUrl()).toBe('');
    expect(formatDisplayUrl('')).toBe('');
  });

  it('should return regular URLs as-is', () => {
    const url = 'https://example.com/assets/model.gltf';
    expect(formatDisplayUrl(url)).toBe(url);
  });

  it('should format base64 data URLs into a user-friendly label', () => {
    const dataUrl = 'data:model/gltf-binary;base64,AAAA...';
    expect(formatDisplayUrl(dataUrl)).toContain('Embedded Asset (model/gltf-binary');
  });

  it('should estimate size from base64 string length', () => {
    // Generate a ~1MB string (approx 1.33 million base64 characters)
    const base64Content = 'A'.repeat(1024 * 1024);
    const dataUrl = `data:application/octet-stream;base64,${base64Content}`;
    
    // approxLength = 1MB base64 characters. approxMb = (1MB * 0.75) / 1MB = 0.75 MB
    const result = formatDisplayUrl(dataUrl);
    expect(result).toContain('~0.8 MB'); // 0.75 rounded to 1 decimal place is 0.8
  });

  it('should handle extremely long non-data URLs by formatting them as large data assets', () => {
    const extremelyLongString = 'B'.repeat(3000);
    const result = formatDisplayUrl(extremelyLongString);
    expect(result).toContain('Large Data Asset');
  });
});
