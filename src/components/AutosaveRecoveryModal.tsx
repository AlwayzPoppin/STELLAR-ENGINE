import React from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store/useStore';
import { RotateCcw, FolderDown, ShieldAlert, Layers, Sparkles, CheckCircle2 } from 'lucide-react';

export default function AutosaveRecoveryModal() {
  const showRecoveryModal = useStore((s) => s.showRecoveryModal);
  const recoverySessionData = useStore((s) => s.recoverySessionData);
  const restoreSession = useStore((s) => s.restoreSession);
  const startFreshSession = useStore((s) => s.startFreshSession);
  const prefs = useStore((s) => s.enginePreferences);
  const updatePrefs = useStore((s) => s.updateEnginePreferences);

  if (!showRecoveryModal) return null;

  const objectCount = recoverySessionData?.objectCount ?? 0;
  const projectName = recoverySessionData?.projectName || 'Previous Project';

  const modalContent = (
    <div
      data-testid="autosave-recovery-modal"
      className="fixed inset-0 bg-neutral-950/85 backdrop-blur-md z-[99999] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200 select-none"
    >
      <div className="bg-bg-panel/95 backdrop-blur-xl border border-white/10 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto transform scale-100 animate-in zoom-in-95 duration-200">
        {/* Glowing top accent line */}
        <div className="h-1 bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-500" />

        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-border/80 flex items-center justify-between bg-neutral-900/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sky-500/10 border border-sky-500/20 rounded-xl text-sky-400">
              <FolderDown size={20} />
            </div>
            <div>
              <h2 className="text-white text-base font-bold tracking-wide">Restore Previous Session?</h2>
              <p className="text-text-secondary text-xs font-mono mt-0.5">Autosaved workspace data was detected</p>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 flex flex-col gap-5 text-xs font-mono">
          {/* Project Snapshot Card */}
          <div className="bg-neutral-900/70 border border-border/60 rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white font-semibold">
                <Sparkles size={14} className="text-sky-400" />
                <span className="truncate max-w-[260px]">{projectName}</span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/15 border border-sky-500/30 text-sky-400 flex items-center gap-1.5">
                <Layers size={11} />
                {objectCount} {objectCount === 1 ? 'object' : 'objects'}
              </span>
            </div>

            <p className="text-text-secondary text-[11px] leading-relaxed">
              Your previous scene hierarchy, materials, animations, and environmental settings are preserved in local storage.
            </p>
          </div>

          {/* Warning / Troubleshooting Notice */}
          <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 text-amber-300">
            <ShieldAlert size={18} className="shrink-0 mt-0.5 text-amber-400" />
            <div className="flex flex-col gap-1 text-[11px] leading-relaxed">
              <span className="font-semibold text-amber-200">Crash or Infinite Loop Prevention</span>
              <span className="text-amber-300/80">
                If the previous session crashed or had broken scripts, choose <strong className="text-white">Start Fresh</strong> to initialize a clean workspace and clear the autosave cache.
              </span>
            </div>
          </div>

          {/* Don't Ask Again Preference Checkbox */}
          <label className="flex items-center gap-2.5 text-[11px] text-text-secondary hover:text-white cursor-pointer transition-colors select-none">
            <input
              type="checkbox"
              data-testid="recovery-modal-dont-ask-checkbox"
              checked={prefs.promptSessionRecovery === false}
              onChange={(e) => updatePrefs({ promptSessionRecovery: !e.target.checked })}
              className="w-4 h-4 rounded border-border bg-bg-deep text-sky-400 accent-sky-400 cursor-pointer"
            />
            <span>Always auto-restore previous sessions without prompting</span>
          </label>
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 bg-neutral-900/60 border-t border-border flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            data-testid="recovery-modal-start-fresh-btn"
            onClick={startFreshSession}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-all cursor-pointer active:scale-95"
          >
            <RotateCcw size={14} />
            Start Fresh (Clear Cache)
          </button>

          <button
            type="button"
            data-testid="recovery-modal-restore-btn"
            onClick={restoreSession}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-neutral-950 bg-gradient-to-r from-sky-400 to-sky-300 hover:from-sky-300 hover:to-sky-200 transition-all shadow-lg shadow-sky-500/20 active:scale-95 cursor-pointer"
          >
            <CheckCircle2 size={14} />
            Restore Session
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
