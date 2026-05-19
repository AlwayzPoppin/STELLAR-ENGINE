import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { Bone, Clapperboard, Play, Pause, RotateCcw, X } from 'lucide-react';

export default function PreviewPanel() {
  const { previewedAssetId, setPreviewedAsset, objects, selectedIds, updateJoint } = useStore();
  const [isPlayingAnim, setIsPlayingAnim] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const animIntervalRef = useRef<any>(null);

  const selectedId = selectedIds[0] || null;
  const selectedObj = objects.find((o) => o.id === selectedId);

  useEffect(() => {
    if (isPlayingAnim) {
      animIntervalRef.current = setInterval(() => {
        setCurrentFrame((prev) => {
          const next = (prev + 1) % 100;
          
          if (selectedObj && selectedObj.joints && selectedObj.joints.length > 0) {
            const time = (next / 100) * Math.PI * 2;
            const angle = Math.sin(time) * 25;
            
            selectedObj.joints.forEach((joint: any, idx: number) => {
              const direction = idx % 2 === 0 ? 1 : -1;
              updateJoint(selectedObj.id, joint.id, {
                rotation: [0, 0, angle * direction],
              });
            });
          }
          
          return next;
        });
      }, 30);
    } else {
      if (animIntervalRef.current) {
        clearInterval(animIntervalRef.current);
      }
    }
    return () => {
      if (animIntervalRef.current) {
        clearInterval(animIntervalRef.current);
      }
    };
  }, [isPlayingAnim, selectedObj, updateJoint]);

  // The preview panel shows up if there is an active previewedAssetId, or if a rigged object is selected!
  const hasRig = selectedObj && selectedObj.joints && selectedObj.joints.length > 0;
  const isVisible = !!previewedAssetId || hasRig;

  if (!isVisible) return null;

  return (
    <div className="absolute right-0 top-0 w-80 h-full bg-bg-surface border-l border-border shadow-2xl z-40 flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
      {/* Panel Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-neutral-900/50">
        <div className="flex items-center gap-1.5">
          <Clapperboard size={13} className="text-amber-400" />
          <span className="text-[10px] font-bold tracking-widest uppercase text-neutral-300">Rig & Anim Lab</span>
        </div>
        <button
          onClick={() => {
            setPreviewedAsset(null);
            // If they close it, we also stop the animation
            setIsPlayingAnim(false);
          }}
          className="text-text-secondary hover:text-text-primary p-0.5 hover:bg-neutral-800 rounded transition-colors cursor-pointer flex items-center justify-center"
          title="Close Preview Panel"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto select-none">
        {/* Info label */}
        <div className="flex justify-between items-center text-[10px] text-text-secondary font-mono">
          <span>Active Asset</span>
          <span className="text-amber-400 font-semibold">{selectedObj ? selectedObj.name : 'Unassigned'}</span>
        </div>

        {/* Live Bone visualizer container */}
        <div className="flex-1 min-h-[220px] bg-bg-deep/40 border border-border/80 rounded-lg flex flex-col justify-between overflow-hidden relative p-3">
          <div className="absolute inset-0 bg-gradient-to-b from-neutral-900 via-neutral-950 to-black opacity-80" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />

          <div className="relative z-10 flex justify-between items-center mb-2">
            <span className="text-[9px] font-mono text-neutral-400 tracking-wider uppercase">Skeleton Bones</span>
            {hasRig && (
              <span className="text-[8px] text-amber-400 font-mono bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                {selectedObj?.joints?.length} Joints Rigged
              </span>
            )}
          </div>

          <div className="relative z-10 flex-1 flex items-center justify-center overflow-y-auto custom-scrollbar my-2">
            {hasRig ? (
              <div className="flex flex-col gap-5 items-center w-full py-2">
                {selectedObj?.joints?.map((joint: any, idx: number) => (
                  <div key={joint.id} className="flex flex-col items-center relative">
                    {/* Bone link vertical bar */}
                    {idx > 0 && (
                      <div className="absolute -top-5 w-[2px] h-5 bg-gradient-to-b from-amber-500 to-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                    )}
                    <div className="flex items-center gap-2 bg-neutral-950 border border-amber-500/40 rounded-full px-2.5 py-0.5 shadow-[0_0_12px_rgba(245,158,11,0.15)] hover:border-amber-400 transition-all cursor-pointer">
                      <Bone size={8} className="text-amber-400 animate-pulse" />
                      <span className="text-[9px] font-mono font-semibold text-text-primary">{joint.name}</span>
                      <span className="text-[8px] font-mono text-neutral-500">[{joint.rotation[2].toFixed(0)}°]</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center space-y-2 p-2">
                <Bone size={24} className="mx-auto text-amber-500/20 animate-bounce" />
                <p className="text-[9px] text-text-secondary leading-relaxed font-medium max-w-[200px]">
                  {selectedObj
                    ? 'No joint bones rigged yet. Use the Skeleton Rigger on the Inspector panel to add joints!'
                    : 'Select a rigged model from the Outliner or Assets to begin animating.'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Timeline & Scrubber Panel */}
        <div className="bg-bg-panel/40 border border-border/80 rounded-lg p-3 space-y-3 flex flex-col shrink-0">
          <div className="flex justify-between items-center text-[10px] font-mono text-text-secondary">
            <span>Frame: <strong className="text-amber-400">{currentFrame}</strong> / 100</span>
            <span>Time: <strong className="text-amber-400">{(currentFrame * 0.03).toFixed(2)}s</strong></span>
          </div>

          {/* Scrubber slider */}
          <input
            type="range"
            min="0"
            max="99"
            value={currentFrame}
            disabled={!hasRig}
            onChange={(e) => {
              const f = parseInt(e.target.value) || 0;
              setCurrentFrame(f);
              if (selectedObj && selectedObj.joints && selectedObj.joints.length > 0) {
                const time = (f / 100) * Math.PI * 2;
                const angle = Math.sin(time) * 25;
                selectedObj.joints.forEach((joint: any, idx: number) => {
                  const direction = idx % 2 === 0 ? 1 : -1;
                  updateJoint(selectedObj.id, joint.id, {
                    rotation: [0, 0, angle * direction],
                  });
                });
              }
            }}
            className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500 focus:outline-none disabled:opacity-30 disabled:cursor-not-allowed"
          />

          {/* Controls buttons */}
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => {
                setCurrentFrame(0);
                if (selectedObj && selectedObj.joints) {
                  selectedObj.joints.forEach((joint: any) => {
                    updateJoint(selectedObj.id, joint.id, { rotation: [0, 0, 0] });
                  });
                }
              }}
              disabled={!hasRig}
              className="p-1.5 bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-text-primary rounded cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
              title="Reset Frame"
            >
              <RotateCcw size={12} />
            </button>

            <button
              onClick={() => setIsPlayingAnim(!isPlayingAnim)}
              disabled={!hasRig}
              className="px-4 py-1 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-[10px] rounded cursor-pointer transition-colors flex items-center gap-1 shadow disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {isPlayingAnim ? (
                <>
                  <Pause size={10} fill="currentColor" /> Pause
                </>
              ) : (
                <>
                  <Play size={10} fill="currentColor" /> Play
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
