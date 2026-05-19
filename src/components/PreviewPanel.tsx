import React, { Suspense, useMemo, useRef, useState } from 'react';
import { useStore, JointData } from '../store/useStore';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, TransformControls, useGLTF, useFBX, Line } from '@react-three/drei';
import { Bone, Clapperboard, Plus, X, Trash2, Settings } from 'lucide-react';
import * as THREE from 'three';

// Lightweight GLTF loader for the mini-viewport
function MiniGltfModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const clone = useMemo(() => {
    const cl = scene.clone();
    cl.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return cl;
  }, [scene, url]);
  return <primitive object={clone} />;
}

// Lightweight FBX loader for the mini-viewport
function MiniFbxModel({ url }: { url: string }) {
  const fbx = useFBX(url);
  const clone = useMemo(() => {
    const cl = fbx.clone();
    cl.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return cl;
  }, [fbx, url]);
  return <primitive object={clone} />;
}

// Lightweight solid shapes rendering for the mini-viewport
function MiniMeshModel({ geometry, material }: { geometry?: string; material?: any }) {
  return (
    <mesh castShadow receiveShadow>
      {geometry === 'sphere' && <sphereGeometry args={[0.6, 32, 32]} />}
      {geometry === 'plane' && <planeGeometry args={[1.2, 1.2]} />}
      {geometry === 'cylinder' && <cylinderGeometry args={[0.4, 0.4, 1.2, 32]} />}
      {geometry === 'cone' && <coneGeometry args={[0.5, 1.0, 32]} />}
      {(!geometry || geometry === 'box') && <boxGeometry args={[0.8, 0.8, 0.8]} />}
      <meshStandardMaterial
        color={material?.color || '#3b82f6'}
        roughness={material?.roughness ?? 0.4}
        metalness={material?.metalness ?? 0.2}
      />
    </mesh>
  );
}

// Interactive Joint Component with TransformControls
function RiggingJoint({
  joint,
  objectId,
  updateJoint,
  selectedJointId,
  setSelectedJointId,
}: {
  joint: JointData;
  objectId: string;
  updateJoint: (objectId: string, jointId: string, updates: Partial<JointData>) => void;
  selectedJointId: string | null;
  setSelectedJointId: (id: string | null) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const isSelected = selectedJointId === joint.id;

  return (
    <group>
      <mesh
        ref={meshRef}
        position={joint.position}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedJointId(joint.id);
        }}
      >
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshBasicMaterial
          color={isSelected ? '#f59e0b' : '#38bdf8'}
          depthTest={false}
          transparent
          opacity={0.9}
        />
      </mesh>

      {isSelected && (
        <TransformControls
          mode="translate"
          size={0.65}
          onObjectChange={(e) => {
            if (e?.target?.object) {
              const pos = e.target.object.position;
              // Real-time update of joint coordinates in state!
              updateJoint(objectId, joint.id, {
                position: [pos.x, pos.y, pos.z],
              });
            }
          }}
        >
          {/* Virtual mesh tracker that receives translation controls */}
          <mesh position={joint.position} visible={false}>
            <sphereGeometry args={[0.01]} />
          </mesh>
        </TransformControls>
      )}
    </group>
  );
}

export default function PreviewPanel() {
  const { previewedAssetId, setPreviewedAsset, objects, addJoint, updateJoint, deleteJoint } = useStore();
  const [selectedJointId, setSelectedJointId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'visualizer' | 'settings'>('visualizer');

  const asset = useMemo(() => objects.find((o) => o.id === previewedAssetId), [objects, previewedAssetId]);

  if (!asset) return null;

  const joints = asset.joints || [];
  const selectedJoint = joints.find((j) => j.id === selectedJointId);

  const handleAddBone = () => {
    const parentId = selectedJointId; // If a joint was selected, nest the new bone under it!
    const newId = `joint_${crypto.randomUUID()}`;
    const newName = `Joint_${joints.length + 1}`;
    
    // Spawn bone slightly offset from the parent, or at the origin if root
    const parentPos: [number, number, number] = selectedJoint ? selectedJoint.position : [0, 0, 0];
    const position: [number, number, number] = [
      parentPos[0],
      parentPos[1] + 0.3,
      parentPos[2]
    ];

    addJoint(asset.id, {
      id: newId,
      name: newName,
      position,
      rotation: [0, 0, 0],
      parentId,
    });
    
    setSelectedJointId(newId);
  };

  return (
    <div className="absolute right-0 top-0 w-[340px] h-full bg-bg-surface border-l border-border shadow-2xl z-40 flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
      {/* Panel Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-neutral-900/50">
        <div className="flex items-center gap-1.5">
          <Clapperboard size={13} className="text-sky-400" />
          <span className="text-[10px] font-bold tracking-widest uppercase text-neutral-300">Rigging Workspace</span>
        </div>
        <button
          onClick={() => setPreviewedAsset(null)}
          className="text-text-secondary hover:text-text-primary p-0.5 hover:bg-neutral-800 rounded transition-colors cursor-pointer flex items-center justify-center"
        >
          <X size={14} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border bg-bg-panel/40 px-2 shrink-0">
        <button
          onClick={() => setActiveTab('visualizer')}
          className={`px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-1 ${activeTab === 'visualizer' ? 'border-sky-500 text-sky-400' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
        >
          <Bone size={10} /> 3D Viewport
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-1 ${activeTab === 'settings' ? 'border-sky-500 text-sky-400' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
        >
          <Settings size={10} /> Joint Settings
        </button>
      </div>

      {activeTab === 'visualizer' ? (
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          {/* Interactive Isolated Rigging Canvas */}
          <div className="flex-1 bg-neutral-950 relative overflow-hidden min-h-0">
            <Canvas camera={{ position: [2, 2, 2], fov: 50 }}>
              <ambientLight intensity={0.5} />
              <directionalLight position={[5, 10, 5]} intensity={1.5} castShadow />
              <OrbitControls makeDefault />

              {/* Grid indicator */}
              <gridHelper args={[10, 10, '#333', '#1f1f23']} position={[0, -0.01, 0]} />

              <Suspense fallback={null}>
                <group>
                  {/* Asset Geometry */}
                  {asset.type === 'gltf' && asset.url ? (
                    <MiniGltfModel key={asset.url} url={asset.url} />
                  ) : asset.type === 'fbx' && asset.url ? (
                    <MiniFbxModel key={asset.url} url={asset.url} />
                  ) : (
                    <MiniMeshModel key={asset.id} geometry={asset.geometry} material={asset.material} />
                  )}

                  {/* Render bones hierarchy links */}
                  {joints.map((joint) => {
                    if (joint.parentId) {
                      const parent = joints.find((j) => j.id === joint.parentId);
                      if (parent) {
                        return (
                          <Line
                            key={`line-${joint.id}`}
                            points={[joint.position, parent.position]}
                            color="#fbbf24"
                            lineWidth={1.5}
                          />
                        );
                      }
                    }
                    return null;
                  })}

                  {/* Interactive rigging joints */}
                  {joints.map((joint) => (
                    <RiggingJoint
                      key={joint.id}
                      joint={joint}
                      objectId={asset.id}
                      updateJoint={updateJoint}
                      selectedJointId={selectedJointId}
                      setSelectedJointId={setSelectedJointId}
                    />
                  ))}
                </group>
              </Suspense>
            </Canvas>

            {/* Selection HUD overlay */}
            <div className="absolute top-3 left-3 bg-neutral-900/90 border border-border px-2 py-1.5 rounded text-[8px] font-mono text-neutral-400 pointer-events-none space-y-1 shadow-lg">
              <div>Preview Model: <strong className="text-white">{asset.name}</strong></div>
              <div>Joints Count: <strong className="text-sky-400">{joints.length}</strong></div>
              <div>Selected Joint: <strong className="text-amber-400">{selectedJoint ? selectedJoint.name : 'None'}</strong></div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="p-3 border-t border-border bg-bg-panel/60 flex gap-2 shrink-0">
            <button
              onClick={handleAddBone}
              className="flex-1 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-[10px] font-bold tracking-wider rounded transition-all flex items-center justify-center gap-1 shadow-md hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
            >
              <Plus size={11} /> ADD BONE
            </button>
            {selectedJointId && (
              <button
                onClick={() => {
                  deleteJoint(asset.id, selectedJointId);
                  setSelectedJointId(null);
                }}
                className="px-3 py-1.5 bg-red-950/40 border border-red-500/30 hover:bg-red-900/30 hover:border-red-500/60 text-red-400 rounded transition-colors flex items-center justify-center cursor-pointer"
                title="Delete Selected Bone"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 p-4 space-y-4 overflow-y-auto select-none min-h-0">
          {selectedJoint ? (
            <div className="space-y-4">
              <div>
                <h4 className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">Bone Identity</h4>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={selectedJoint.name}
                    onChange={(e) => updateJoint(asset.id, selectedJoint.id, { name: e.target.value })}
                    className="flex-1 bg-neutral-900 border border-border rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <h4 className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">Parent Bone Bind</h4>
                <select
                  value={selectedJoint.parentId || ''}
                  onChange={(e) => updateJoint(asset.id, selectedJoint.id, { parentId: e.target.value || null })}
                  className="w-full bg-neutral-900 border border-border rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                >
                  <option value="">None (Root Bone)</option>
                  {joints
                    .filter((j) => j.id !== selectedJoint.id)
                    .map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <h4 className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">Local Position</h4>
                <div className="grid grid-cols-3 gap-2">
                  {['X', 'Y', 'Z'].map((axis, i) => (
                    <div key={axis} className="flex flex-col gap-1">
                      <span className="text-[8px] font-mono text-neutral-500 text-center">{axis}</span>
                      <input
                        type="number"
                        step="0.05"
                        value={Number(selectedJoint.position[i].toFixed(3))}
                        onChange={(e) => {
                          const nextPos = [...selectedJoint.position] as [number, number, number];
                          nextPos[i] = parseFloat(e.target.value) || 0;
                          updateJoint(asset.id, selectedJoint.id, { position: nextPos });
                        }}
                        className="bg-neutral-900 border border-border rounded py-1 px-1 text-center text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">Local Rotation (Euler)</h4>
                <div className="grid grid-cols-3 gap-2">
                  {['X', 'Y', 'Z'].map((axis, i) => (
                    <div key={axis} className="flex flex-col gap-1">
                      <span className="text-[8px] font-mono text-neutral-500 text-center">{axis}°</span>
                      <input
                        type="number"
                        step="1"
                        value={Number(selectedJoint.rotation[i].toFixed(1))}
                        onChange={(e) => {
                          const nextRot = [...selectedJoint.rotation] as [number, number, number];
                          nextRot[i] = parseFloat(e.target.value) || 0;
                          updateJoint(asset.id, selectedJoint.id, { rotation: nextRot });
                        }}
                        className="bg-neutral-900 border border-border rounded py-1 px-1 text-center text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center p-6 bg-neutral-900/30 border border-border/60 border-dashed rounded-lg space-y-2">
              <Bone size={20} className="mx-auto text-neutral-600 animate-pulse" />
              <p className="text-[10px] text-text-secondary leading-relaxed max-w-[200px] mx-auto font-medium">
                No joint bone selected. Click on a joint sphere inside the 3D viewport tab to customize its name, parent-binding, and translation coords.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
