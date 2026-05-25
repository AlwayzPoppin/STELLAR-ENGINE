import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { detectSkeletonType, retargetClip, extractBoneNames } from './MocapRetargeter';

/**
 * Phase 5: FBX & GLB Animation Extractor
 *
 * Loads an FBX or GLB mocap file via THREE.FBXLoader / THREE.GLTFLoader, extracts all AnimationClips,
 * auto-detects the skeleton type, and optionally retargets them to AutoRig_ if necessary.
 */

export interface ExtractedAnimation {
  /** The raw THREE.AnimationClip (with original bone names) */
  rawClip: THREE.AnimationClip;
  /** The retargeted clip (with AutoRig_ bone names) */
  retargetedClip: THREE.AnimationClip;
  /** Duration of the clip in seconds */
  duration: number;
  /** Number of keyframe tracks in the original clip */
  trackCount: number;
  /** All bone names found in the original clip */
  boneNames: string[];
}

export interface ExtractionResult {
  clips: ExtractedAnimation[];
  skeletonType: 'mixamo' | 'humanik' | 'unreal' | 'unknown' | 'native';
}

/** Cache to avoid re-loading the same file multiple times */
const extractionCache = new Map<string, ExtractionResult>();

/**
 * Load an FBX or GLB file and extract all animation clips from it.
 *
 * Results are cached by URL so subsequent calls are instant.
 *
 * @param url The URL to the file (relative to public/ root).
 * @returns The extracted animation clips.
 */
export async function extractAnimationClips(url: string): Promise<ExtractionResult> {
  console.log(`[AnimationExtractor] extractAnimationClips called for url: "${url}"`);
  // Return cached result if available
  const cached = extractionCache.get(url);
  if (cached) {
    console.log(`[AnimationExtractor] Cache hit for url: "${url}"`, cached);
    return cached;
  }

  return new Promise<ExtractionResult>((resolve, reject) => {
    const isGLB = url.toLowerCase().endsWith('.glb') || url.toLowerCase().endsWith('.gltf');
    
    if (isGLB) {
      console.log(`[AnimationExtractor] Treating "${url}" as GLB. Starting GLTFLoader...`);
      const loader = new GLTFLoader();
      loader.load(
        url,
        (gltf) => {
          console.log(`[AnimationExtractor] GLTFLoader success callback for "${url}"`);
          const rawClips = gltf.animations || [];
          console.log(`[AnimationExtractor] Found rawClips count: ${rawClips.length}`);
          
          if (rawClips.length === 0) {
            const result: ExtractionResult = {
              clips: [],
              skeletonType: 'unknown',
            };
            extractionCache.set(url, result);
            resolve(result);
            return;
          }

          // Auto-detect skeleton type from URL and first track names (GLB can also contain non-native conventions like Mixamo/Unreal)
          const firstClipTrackNames = rawClips[0] ? rawClips[0].tracks.map((t) => t.name) : [];
          const skeletonType = detectSkeletonType(url, firstClipTrackNames);

          const clips: ExtractedAnimation[] = rawClips.map((rawClip) => {
            const boneNames = extractBoneNames(rawClip);
            const retargetedClip =
              skeletonType !== 'unknown'
                ? retargetClip(rawClip, skeletonType)
                : rawClip.clone(); // If unknown skeleton, pass through unchanged

            return {
              rawClip,
              retargetedClip,
              duration: rawClip.duration,
              trackCount: rawClip.tracks.length,
              boneNames,
            };
          });

          const result: ExtractionResult = {
            clips,
            skeletonType,
          };

          console.log(`[AnimationExtractor] Successfully extracted ${clips.length} clips for "${url}"`);
          extractionCache.set(url, result);
          resolve(result);
        },
        (progress) => {
          console.log(`[AnimationExtractor] Progress for "${url}":`, progress.loaded, "/", progress.total);
        },
        (error) => {
          console.error(`[AnimationExtractor] Failed to load GLB: ${url}`, error);
          reject(error);
        }
      );
    } else {
      const loader = new FBXLoader();
      loader.load(
        url,
        (fbxGroup) => {
          const rawClips = fbxGroup.animations || [];

          if (rawClips.length === 0) {
            // No animation data — this FBX only has a static mesh
            const result: ExtractionResult = {
              clips: [],
              skeletonType: 'unknown',
            };
            extractionCache.set(url, result);
            resolve(result);
            return;
          }

          // Auto-detect skeleton type from URL and first track names
          const firstClipTrackNames = rawClips[0].tracks.map((t) => t.name);
          const skeletonType = detectSkeletonType(url, firstClipTrackNames);

          const clips: ExtractedAnimation[] = rawClips.map((rawClip) => {
            const boneNames = extractBoneNames(rawClip);
            const retargetedClip =
              skeletonType !== 'unknown'
                ? retargetClip(rawClip, skeletonType)
                : rawClip.clone(); // If unknown skeleton, pass through unchanged

            return {
              rawClip,
              retargetedClip,
              duration: rawClip.duration,
              trackCount: rawClip.tracks.length,
              boneNames,
            };
          });

          const result: ExtractionResult = {
            clips,
            skeletonType,
          };

          extractionCache.set(url, result);

          // Dispose the loaded FBX scene graph to free GPU memory
          // (we only need the animation data, not the meshes)
          fbxGroup.traverse((child: any) => {
            if (child.isMesh) {
              child.geometry?.dispose();
              const materials = Array.isArray(child.material) ? child.material : [child.material];
              for (const mat of materials) {
                if (mat) {
                  mat.map?.dispose();
                  mat.dispose();
                }
              }
            }
          });

          resolve(result);
        },
        undefined,
        (error) => {
          console.error(`[AnimationExtractor] Failed to load FBX: ${url}`, error);
          reject(error);
        }
      );
    }
  });
}

/**
 * Clear the extraction cache (useful when memory-constrained).
 */
export function clearExtractionCache(): void {
  extractionCache.clear();
}
