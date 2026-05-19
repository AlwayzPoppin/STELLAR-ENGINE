import React, { Suspense, useMemo, useRef, useState, useEffect } from 'react';
import { useStore, JointData } from '../store/useStore';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, TransformControls, useGLTF, useFBX, Line } from '@react-three/drei';
import { Bone, Clapperboard, Plus, X, Trash2, Settings, Eye, Play, Pause } from 'lucide-react';
import * as THREE from 'three';

// Lightweight GLTF loader with dynamic X-Ray material overlay support
function MiniGltfModel({ url, xRay }: { url: string; xRay: boolean }) {
  const { scene } = useGLTF(url);
  const clone = useMemo(() => {
    const cl = scene.clone();
    cl.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = !xRay;
        child.receiveShadow = !xRay;
        if (xRay) {
          child.material = child.material.clone();
          child.material.transparent = true;
          child.material.opacity = 0.25;
          child.material.depthWrite = false;
          child.material.wireframe = true;
        }
      }
    });
    return cl;
  }, [scene, url, xRay]);
  return <primitive object={clone} />;
}

// Lightweight FBX loader with dynamic X-Ray material overlay support
function MiniFbxModel({ url, xRay }: { url: string; xRay: boolean }) {
  const fbx = useFBX(url);
  const clone = useMemo(() => {
    const cl = fbx.clone();
    cl.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = !xRay;
        child.receiveShadow = !xRay;
        if (xRay) {
          child.material = child.material.clone();
          child.material.transparent = true;
          child.material.opacity = 0.25;
          child.material.depthWrite = false;
          child.material.wireframe = true;
        }
      }
    });
    return cl;
  }, [fbx, url, xRay]);
  return <primitive object={clone} />;
}

// Lightweight solid shapes rendering with dynamic X-Ray material overlay support
function MiniMeshModel({ geometry, material, xRay }: { geometry?: string; material?: any; xRay: boolean }) {
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
        transparent={xRay}
        opacity={xRay ? 0.25 : 1.0}
        wireframe={xRay}
        depthWrite={!xRay}
      />
    </mesh>
  );
}

// Blender-style 3D octahedron bone visual chain connecting parent to child
function BoneVisual({ start, end }: { start: [number, number, number]; end: [number, number, number] }) {
  const startVec = useMemo(() => new THREE.Vector3(...start), [start]);
  const endVec = useMemo(() => new THREE.Vector3(...end), [end]);

  const distance = useMemo(() => startVec.distanceTo(endVec), [startVec, endVec]);
  const midpoint = useMemo(() => new THREE.Vector3().addVectors(startVec, endVec).multiplyScalar(0.5), [startVec, endVec]);

  const quaternion = useMemo(() => {
    const dir = new THREE.Vector3().subVectors(endVec, startVec).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    return new THREE.Quaternion().setFromUnitVectors(up, dir);
  }, [startVec, endVec]);

  if (distance < 0.05) return null;

  return (
    <group position={midpoint} quaternion={quaternion}>
      {/* 3D diamond/octahedron bone mesh */}
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[0.002, 0.03, distance * 0.9, 4]} />
        <meshStandardMaterial
          color="#fbbf24"
          roughness={0.1}
          metalness={0.8}
          emissive="#fbbf24"
          emissiveIntensity={0.2}
        />
      </mesh>
    </group>
  );
}

// Interactive Joint Component with TransformControls and Viewport Picking
function RiggingJoint({
  joint,
  objectId,
  updateJoint,
  selectedJointId,
  setSelectedJointId,
  testPose,
}: {
  joint: JointData;
  objectId: string;
  updateJoint: (objectId: string, jointId: string, updates: Partial<JointData>) => void;
  selectedJointId: string | null;
  setSelectedJointId: (id: string | null) => void;
  testPose: boolean;
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
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshBasicMaterial
          color={isSelected ? '#f59e0b' : '#38bdf8'}
          depthTest={false}
          transparent
          opacity={0.9}
        />
      </mesh>

      {/* Transform controls disabled in Test Pose Mode to allow procedural animations */}
      {isSelected && !testPose && (
        <TransformControls
          mode="translate"
          size={0.65}
          onObjectChange={(e) => {
            if (e?.target?.object) {
              const pos = e.target.object.position;
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
  const [xRay, setXRay] = useState<boolean>(true);
  const [testPose, setTestPose] = useState<boolean>(false);
  const [animTime, setAnimTime] = useState<number>(0);

  const asset = useMemo(() => objects.find((o) => o.id === previewedAssetId), [objects, previewedAssetId]);

  // Tick timer loop for procedural skeletal branch waving in test pose mode
  useEffect(() => {
    let frameId: number;
    const tick = () => {
      if (testPose) {
        setAnimTime((t) => t + 0.04);
      }
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [testPose]);

  const joints = useMemo(() => asset?.joints || [], [asset]);

  // Computes real-time cascading forward-kinematic branch waving in Test Pose Mode
  const animatedJoints = useMemo(() => {
    if (!joints || joints.length === 0) return [];
    if (!testPose) return joints;
    
    return joints.map((joint) => {
      if (joint.parentId) {
        const parent = joints.find((j) => j.id === joint.parentId);
        if (parent) {
          // Dynamic offset from parent joint
          const dx = joint.position[0] - parent.position[0];
          const dy = joint.position[1] - parent.position[1];
          const dz = joint.position[2] - parent.position[2];

          // Compute smooth wave rotation angle around parent joint
          const angle = Math.sin(animTime + joint.id.charCodeAt(5) * 0.2) * 0.35;
          const rx = dx * Math.cos(angle) - dz * Math.sin(angle);
          const rz = dx * Math.sin(angle) + dz * Math.cos(angle);

          return {
            ...joint,
            position: [parent.position[0] + rx, parent.position[1] + dy, parent.position[2] + rz] as [number, number, number],
          };
        }
      } else {
        // Root bone gently sways
        const sway = Math.sin(animTime) * 0.15;
        return {
          ...joint,
          position: [joint.position[0] + sway, joint.position[1], joint.position[2]] as [number, number, number],
        };
      }
      return joint;
    });
  }, [joints, testPose, animTime]);

  if (!asset) return null;

  const selectedJoint = joints.find((j) => j.id === selectedJointId);

  const handleAddBone = () => {
    const parentId = selectedJointId; 
    const newId = `joint_${crypto.randomUUID()}`;
    const newName = `Joint_${joints.length + 1}`;
    
    const parentPos: [number, number, number] = selectedJoint ? selectedJoint.position : [0, 0, 0];
    const position: [number, number, number] = [
      parentPos[0],
      parentPos[1] + 0.3,
      parentPos[2],
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
      <div className="flex border-b border-border bg-bg-panel/40 px-2 shrink-0 justify-between items-center pr-3">
        <div className="flex">
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

        {/* Dynamic Controls Toggles */}
        {activeTab === 'visualizer' && (
          <div className="flex gap-2">
            <button
              onClick={() => setXRay(!xRay)}
              className={`p-1 rounded transition-colors cursor-pointer flex items-center justify-center ${xRay ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'text-neutral-500 hover:text-neutral-300 border border-transparent'}`}
              title="Toggle X-Ray Skeleton Mode"
            >
              <Eye size={12} />
            </button>
            <button
              onClick={() => setTestPose(!testPose)}
              className={`p-1 rounded transition-colors cursor-pointer flex items-center justify-center ${testPose ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-neutral-500 hover:text-neutral-300 border border-transparent'}`}
              title="Toggle Test Pose Branch Waving"
            >
              {testPose ? <Pause size={12} /> : <Play size={12} />}
            </button>
          </div>
        )}
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
                    <MiniGltfModel key={asset.url} url={asset.url} xRay={xRay} />
                  ) : asset.type === 'fbx' && asset.url ? (
                    <MiniFbxModel key={asset.url} url={asset.url} xRay={xRay} />
                  ) : (
                    <MiniMeshModel key={asset.id} geometry={asset.geometry} material={asset.material} xRay={xRay} />
                  )}

                  {/* Render 3D blender-style octahedron bones connecting nodes */}
                  {animatedJoints.map((joint) => {
                    if (joint.parentId) {
                      const parent = animatedJoints.find((j) => j.id === joint.parentId);
                      if (parent) {
                        return (
                          <BoneVisual
                            key={`bone-vis-${joint.id}`}
                            start={joint.position}
                            end={parent.position}
                          />
                        );
                      }
                    }
                    return null;
                  })}

                  {/* Render glowing line skeleton tracks */}
                  {animatedJoints.map((joint) => {
                    if (joint.parentId) {
                      const parent = animatedJoints.find((j) => j.id === joint.parentId);
                      if (parent) {
                        return (
                          <Line
                            key={`line-${joint.id}`}
                            points={[joint.position, parent.position]}
                            color="#eab308"
                            lineWidth={1.0}
                          />
                        );
                      }
                    }
                    return null;
                  })}

                  {/* Visual Selected Parent Indicator (glowing cyan line to parent bone) */}
                  {(() => {
                    if (!selectedJointId) return null;
                    const activeJoint = animatedJoints.find((j) => j.id === selectedJointId);
                    if (!activeJoint || !activeJoint.parentId) return null;
                    const parentJoint = animatedJoints.find((j) => j.id === activeJoint.parentId);
                    if (!parentJoint) return null;
                    return (
                      <Line
                        points={[activeJoint.position, parentJoint.position]}
                        color="#22d3ee" // Bright glowing Cyan!
                        lineWidth={3.0}
                      />
                    );
                  })()}

                  {/* Interactive rigging joint spheres */}
                  {animatedJoints.map((joint) => (
                    <RiggingJoint
                      key={joint.id}
                      joint={joint}
                      objectId={asset.id}
                      updateJoint={updateJoint}
                      selectedJointId={selectedJointId}
                      setSelectedJointId={setSelectedJointId}
                      testPose={testPose}
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
              <div>Viewport Mode: <strong className={testPose ? 'text-emerald-400' : 'text-sky-400'}>{testPose ? 'TEST POSE (FK WAVE)' : 'RIGGING EDIT'}</strong></div>
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
