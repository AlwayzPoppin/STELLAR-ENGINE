import React, { useState, useRef, useEffect } from 'react';
import { useStore, AssistantMessage } from '../store/useStore';
import {
  Sparkles,
  Send,
  Trash2,
  X,
  Check,
  ChevronRight,
  Loader2,
  Bot,
  User,
  Wand2,
  SlidersHorizontal,
  KeyRound,
  Gamepad2,
  Pencil,
  Globe,
  Package,
  Settings,
} from 'lucide-react';

// ─── Message Card Renderers ──────────────────────────────────────

const UserMessageCard = ({ msg }: { msg: AssistantMessage }) => (
  <div className="flex justify-end mb-3">
    <div className="max-w-[85%] flex items-start gap-2">
      <div className="bg-accent/20 border border-accent/30 rounded-xl rounded-tr-sm px-3.5 py-2.5 text-[11px] leading-relaxed text-text-primary">
        {msg.content}
      </div>
      <div className="w-6 h-6 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center flex-shrink-0 mt-0.5">
        <User size={12} className="text-accent" />
      </div>
    </div>
  </div>
);

const TextResponseCard = ({ msg }: { msg: AssistantMessage }) => (
  <div className="flex justify-start mb-3">
    <div className="max-w-[85%] flex items-start gap-2">
      <div className="w-6 h-6 rounded-full bg-violet-500/20 border border-violet-500/40 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Bot size={12} className="text-violet-400" />
      </div>
      <div className="bg-bg-panel/80 border border-border/60 rounded-xl rounded-tl-sm px-3.5 py-2.5 text-[11px] leading-relaxed text-text-primary/90 whitespace-pre-wrap">
        {msg.content}
      </div>
    </div>
  </div>
);

// ─── Scene Action Card (the "Make It Happen" card) ───────────────

const SceneActionCard = ({ msg, onApply }: { msg: AssistantMessage; onApply: () => void }) => {
  const actions = msg.actions;
  if (!actions || actions.length === 0) return <TextResponseCard msg={msg} />;

  const totalChanges = actions.reduce((sum, a) => sum + Object.keys(a.after).length, 0);

  return (
    <div className="flex justify-start mb-3">
      <div className="max-w-[90%] flex items-start gap-2">
        <div className="w-6 h-6 rounded-full bg-violet-500/20 border border-violet-500/40 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Wand2 size={12} className="text-violet-400" />
        </div>
        <div className="flex-1 bg-bg-panel/80 border border-border/60 rounded-xl rounded-tl-sm overflow-hidden">
          {/* Conversational explanation */}
          {msg.content && (
            <div className="px-3.5 py-2.5 text-[11px] leading-relaxed text-text-primary/90 border-b border-border/40">
              {msg.content}
            </div>
          )}

          {/* Action Label Banner */}
          <div className="px-3.5 py-2 bg-violet-500/8 border-b border-border/30 flex items-center gap-2">
            <Sparkles size={12} className="text-violet-400 flex-shrink-0" />
            <span className="text-[11px] font-bold text-violet-300 tracking-wide">
              {msg.actionLabel || 'Scene Update'}
            </span>
          </div>

          {/* Changes summary */}
          <div className="px-3.5 py-2 space-y-1">
            {actions.map((action, idx) => {
              const isCmd = !!action.cmd;
              let badgeColor = 'bg-violet-500/10 text-violet-400 border-violet-500/20';
              let badgeText = 'CHANGE';

              if (action.cmd === 'add_object') {
                badgeColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                badgeText = 'ADD';
              } else if (action.cmd === 'delete_object') {
                badgeColor = 'bg-red-500/10 text-red-400 border-red-500/20';
                badgeText = 'DELETE';
              } else if (action.cmd === 'add_quest') {
                badgeColor = 'bg-teal-500/10 text-teal-400 border-teal-500/20';
                badgeText = 'QUEST';
              } else if (action.cmd === 'add_scripted_event') {
                badgeColor = 'bg-purple-500/10 text-purple-400 border-purple-500/20';
                badgeText = 'EVENT';
              } else if (action.cmd === 'set_game_variable') {
                badgeColor = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
                badgeText = 'VARIABLE';
              } else if (action.cmd === 'paint_foliage') {
                badgeColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                badgeText = 'FOLIAGE';
              }

              return (
                <div key={idx} className="flex items-center gap-2 text-[10px] font-mono">
                  <ChevronRight size={10} className="text-violet-400/60 flex-shrink-0" />
                  <span className={`text-[8px] font-extrabold px-1 py-[1.5px] rounded border ${badgeColor}`}>
                    {badgeText}
                  </span>
                  <span className="text-text-secondary">{action.targetName}:</span>
                  <span className="text-violet-300/80">
                    {isCmd
                      ? (action.cmd === 'add_object' ? `Spawn ${action.params?.type || 'primitive'}`
                        : action.cmd === 'delete_object' ? 'Remove object'
                        : action.cmd === 'add_quest' ? `Quest "${action.params?.title || 'quest'}"`
                        : action.cmd === 'add_scripted_event' ? `Event "${action.params?.name || 'event'}"`
                        : action.cmd === 'paint_foliage' ? `Paint ${action.params?.count || 200}x ${action.params?.preset || 'foliage'}`
                        : `Set variable "${action.params?.key}"`)
                      : `${Object.keys(action.after).length} change${Object.keys(action.after).length > 1 ? 's' : ''}`
                    }
                  </span>
                </div>
              );
            })}
          </div>

          {/* The Big Button */}
          <div className="px-3.5 py-2.5 border-t border-border/40 flex items-center justify-between">
            <span className="text-[9px] text-text-secondary/50 font-mono">
              {totalChanges} propert{totalChanges === 1 ? 'y' : 'ies'} across {actions.length} target{actions.length > 1 ? 's' : ''}
            </span>
            <button
              onClick={onApply}
              disabled={msg.applied}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                msg.applied
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 cursor-default'
                  : 'bg-gradient-to-r from-violet-500/30 to-purple-500/30 text-violet-200 border border-violet-500/40 hover:from-violet-500/40 hover:to-purple-500/40 hover:shadow-lg hover:shadow-violet-500/10 cursor-pointer active:scale-[0.97]'
              }`}
            >
              {msg.applied ? <Check size={12} /> : <Wand2 size={12} />}
              {msg.applied ? 'Applied!' : 'Make It Happen'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Project Engine Blueprint Card ───────────────────────────────

const BlueprintCard = ({ msg, onApply }: { msg: AssistantMessage; onApply: () => void }) => {
  const bp = msg.blueprint;
  if (!bp) return <TextResponseCard msg={msg} />;

  return (
    <div className="flex justify-start mb-3">
      <div className="max-w-[90%] flex items-start gap-2">
        <div className="w-6 h-6 rounded-full bg-violet-500/20 border border-violet-500/40 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Gamepad2 size={12} className="text-violet-400" />
        </div>
        <div className="flex-1 bg-bg-panel/80 border border-border/60 rounded-xl rounded-tl-sm overflow-hidden">
          {msg.content && (
            <div className="px-3.5 py-2.5 text-[11px] leading-relaxed text-text-primary/90 border-b border-border/40">
              {msg.content}
            </div>
          )}

          {/* Action Label Banner */}
          <div className="px-3.5 py-2 bg-violet-500/8 border-b border-border/30 flex items-center gap-2">
            <Gamepad2 size={12} className="text-violet-400 flex-shrink-0" />
            <span className="text-[11px] font-bold text-violet-300 tracking-wide">
              {msg.actionLabel || 'Project Engine Blueprint'}
            </span>
          </div>

          {/* Blueprint Details */}
          <div className="p-3.5 space-y-3 bg-bg-deep/30">
            <div>
              <div className="text-[9px] text-text-secondary uppercase tracking-widest mb-1">Inferred Genre</div>
              <div className="text-[11px] font-bold text-text-primary bg-violet-500/10 border border-violet-500/20 rounded-md px-2.5 py-1 inline-block">
                {bp.genre}
              </div>
            </div>

            <div>
              <div className="text-[9px] text-text-secondary uppercase tracking-widest mb-1">Camera Configuration</div>
              <div className="text-[10px] text-violet-200/90 font-medium font-mono flex items-center gap-1.5">
                <ChevronRight size={10} className="text-violet-400" />
                {bp.cameraStyle}
              </div>
            </div>

            <div>
              <div className="text-[9px] text-text-secondary uppercase tracking-widest mb-1">Core Gameplay Features</div>
              <div className="space-y-1 mt-1">
                {bp.coreFeatures.map((feat, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 text-[10px] text-text-secondary">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400/60" />
                    {feat}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Apply Button */}
          <div className="px-3.5 py-2.5 border-t border-border/40 flex items-center justify-between bg-bg-panel/20">
            <span className="text-[8px] text-text-secondary/40 font-mono">
              Locks camera & bounds
            </span>
            <button
              onClick={onApply}
              disabled={msg.applied}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                msg.applied
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 cursor-default'
                  : 'bg-gradient-to-r from-violet-500/30 to-purple-500/30 text-violet-200 border border-violet-500/40 hover:from-violet-500/40 hover:to-purple-500/40 hover:shadow-lg hover:shadow-violet-500/10 cursor-pointer active:scale-[0.97]'
              }`}
            >
              {msg.applied ? <Check size={12} /> : <Gamepad2 size={12} />}
              {msg.applied ? 'Blueprint Applied!' : 'Kickstart Blueprint'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Legacy Property Patch Card (backward compat) ────────────────

const PropertyPatchCard = ({ msg, onApply }: { msg: AssistantMessage; onApply: () => void }) => {
  const patch = msg.propertyPatch;
  if (!patch) return <TextResponseCard msg={msg} />;

  const keys = [...new Set([...Object.keys(patch.before), ...Object.keys(patch.after)])];

  return (
    <div className="flex justify-start mb-3">
      <div className="max-w-[90%] flex items-start gap-2">
        <div className="w-6 h-6 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center flex-shrink-0 mt-0.5">
          <SlidersHorizontal size={12} className="text-amber-400" />
        </div>
        <div className="flex-1 bg-bg-panel/80 border border-border/60 rounded-xl rounded-tl-sm overflow-hidden">
          {msg.content && (
            <div className="px-3.5 py-2.5 text-[11px] leading-relaxed text-text-primary/90 border-b border-border/40">
              {msg.content}
            </div>
          )}
          <div className="px-3 py-1.5 text-[9px] font-mono text-text-secondary border-b border-border/30 flex items-center gap-1.5">
            <ChevronRight size={10} className="text-amber-400" />
            Target: <span className="text-amber-300">{patch.targetName || patch.targetId}</span>
          </div>
          <div className="divide-y divide-border/20">
            {keys.map((key) => {
              const before = patch.before[key];
              const after = patch.after[key];
              const changed = JSON.stringify(before) !== JSON.stringify(after);
              return (
                <div key={key} className={`px-3.5 py-1.5 flex items-center text-[10px] font-mono ${changed ? 'bg-amber-500/5' : ''}`}>
                  <span className="w-[100px] text-text-secondary truncate">{key}</span>
                  <span className="text-red-400/70 line-through mr-2 truncate max-w-[80px]">
                    {JSON.stringify(before)}
                  </span>
                  <span className="text-text-secondary mx-1">→</span>
                  <span className="text-emerald-400 truncate max-w-[80px]">
                    {JSON.stringify(after)}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="px-3 py-2 border-t border-border/40 flex items-center justify-end">
            <button
              onClick={onApply}
              disabled={msg.applied}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-semibold transition-all ${
                msg.applied
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 cursor-default'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 cursor-pointer'
              }`}
            >
              {msg.applied ? <Check size={10} /> : <SlidersHorizontal size={10} />}
              {msg.applied ? 'Applied to Scene' : 'Apply Changes to Scene'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Loading Indicator ───────────────────────────────────────────

const MeshyHandoffCard = ({ msg }: { msg: AssistantMessage }) => {
  const { generateAiAsset, aiGenerationTasks } = useStore();
  const [started, setStarted] = useState(false);
  const [localTaskId, setLocalTaskId] = useState<string | null>(null);

  const [editedPrompt, setEditedPrompt] = useState(msg.meshyPrompt || '');
  const [editedStyle, setEditedStyle] = useState<'realistic' | 'stylized'>(msg.meshyArtStyle || 'stylized');
  const [seed, setSeed] = useState(msg.refImageSeed || Math.floor(msg.timestamp % 100000));
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const currentTaskId = localTaskId || msg.meshyTaskId;
  const task = aiGenerationTasks.find(t => t.id === currentTaskId);

  const refImageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(
    editedPrompt + (editedStyle === 'stylized' ? ', low poly stylized game asset, high quality' : ', realistic hyper-detailed game prop')
  )}?width=512&height=512&nologo=true&seed=${seed}`;

  const handleGenerate3D = async () => {
    setStarted(true);
    const taskId = await generateAiAsset(editedPrompt, editedStyle);
    setLocalTaskId(taskId);
    
    useStore.setState((state) => ({
      assistantMessages: state.assistantMessages.map((m) =>
        m.id === msg.id ? { 
          ...m, 
          meshyTaskId: taskId,
          meshyPrompt: editedPrompt,
          meshyArtStyle: editedStyle,
          refImageSeed: seed
        } : m
      )
    }));
  };

  const handleRegenerateConcept = () => {
    const newSeed = Math.floor(Math.random() * 1000000);
    setSeed(newSeed);
    setImageLoaded(false);
  };

  const handleSavePrompt = () => {
    setImageLoaded(false);
    setIsEditing(false);
    useStore.setState((state) => ({
      assistantMessages: state.assistantMessages.map((m) =>
        m.id === msg.id ? { ...m, meshyPrompt: editedPrompt, meshyArtStyle: editedStyle } : m
      )
    }));
  };

  const isPending = task?.status === 'PENDING';
  const isProcessing = task?.status === 'IN_PROGRESS';
  const isSucceeded = task?.status === 'SUCCEEDED';
  const isFailed = task?.status === 'FAILED';

  return (
    <div className="flex justify-start mb-3">
      <div className="max-w-[90%] flex items-start gap-2 w-full">
        <div className="w-6 h-6 rounded-full bg-fuchsia-500/20 border border-fuchsia-500/40 flex items-center justify-center flex-shrink-0 mt-0.5 animate-pulse">
          <Bot size={12} className="text-fuchsia-400" />
        </div>
        <div className="flex-1 bg-[#1a1a24]/90 border border-fuchsia-500/20 rounded-xl rounded-tl-sm overflow-hidden shadow-[0_8px_32px_rgba(217,70,239,0.12)]">
          <div className="px-3 py-2 bg-fuchsia-950/15 border-b border-fuchsia-500/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={12} className="text-fuchsia-400 animate-pulse" />
              <span className="text-[10px] font-bold text-fuchsia-300 uppercase tracking-wider">Concept Generation Phase</span>
            </div>
            <span className="text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-extrabold font-mono">CREDITS SAVED</span>
          </div>

          <div className="p-3.5 flex flex-col gap-3">
            <p className="text-[10px] text-text-secondary leading-relaxed">
              Before spending Meshy API credits on 3D generation, review the AI concept reference below. Cycle seeds or edit the prompt to refine.
            </p>

            <div className="relative w-full aspect-square bg-[#0c0c12] rounded-lg overflow-hidden border border-neutral-800/80 flex items-center justify-center group/img">
              {!imageLoaded && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0c0c12] text-center gap-2">
                  <Loader2 size={24} className="text-fuchsia-400 animate-spin" />
                  <span className="text-[9px] text-text-secondary font-mono tracking-widest uppercase">Generating 2D Reference...</span>
                </div>
              )}
              
              <img 
                src={refImageUrl}
                alt="2D Concept Reference"
                onLoad={() => setImageLoaded(true)}
                className={`w-full h-full object-cover transition-all duration-300 ${
                  imageLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                }`}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/60 via-transparent to-transparent pointer-events-none" />
              <span className="absolute bottom-2 left-2 text-[9px] bg-neutral-950/70 px-1.5 py-0.5 rounded text-fuchsia-300 font-bold border border-fuchsia-500/20">
                2D CONCEPT PREVIEW
              </span>
            </div>

            {isEditing ? (
              <div className="bg-[#0f0f15] border border-neutral-800/80 rounded-lg p-3 flex flex-col gap-2.5">
                <div className="flex flex-col gap-1">
                  <span className="text-[8px] text-text-secondary uppercase font-bold tracking-wider">Concept Prompt Description</span>
                  <textarea
                    value={editedPrompt}
                    onChange={e => setEditedPrompt(e.target.value)}
                    className="bg-neutral-950 border border-neutral-800 rounded px-2 py-1.5 text-white text-[10px] outline-none focus:border-fuchsia-500 font-mono resize-none h-16 leading-relaxed"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[8px] text-text-secondary uppercase font-bold tracking-wider">Art Style Mode</span>
                  <select
                    value={editedStyle}
                    onChange={e => setEditedStyle(e.target.value as any)}
                    className="bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-white text-[10px] outline-none focus:border-fuchsia-500"
                  >
                    <option value="stylized">Stylized Game Asset</option>
                    <option value="realistic">Realistic Render</option>
                  </select>
                </div>
                <button
                  onClick={handleSavePrompt}
                  className="bg-fuchsia-500/10 text-fuchsia-300 border border-fuchsia-500/20 py-1.5 rounded font-bold text-[10px] hover:bg-fuchsia-500/20 transition-all cursor-pointer animate-in fade-in"
                >
                  Apply & Reload Preview
                </button>
              </div>
            ) : (
              <div className="bg-[#0f0f15] border border-neutral-800/80 rounded-lg p-2.5 flex flex-col gap-2 relative group/details">
                <div className="flex flex-col gap-0.5 pr-8">
                  <span className="text-[8px] text-text-secondary uppercase font-bold tracking-wider">Reference Prompt</span>
                  <span className="text-[10px] text-white font-semibold italic font-mono">"{editedPrompt}"</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[8px] text-text-secondary uppercase font-bold tracking-wider">Art Style:</span>
                  <span className="px-1.5 py-0.5 rounded bg-fuchsia-500/10 text-fuchsia-300 border border-fuchsia-500/20 text-[8px] font-bold tracking-wider uppercase">{editedStyle}</span>
                </div>
                {!task && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="absolute top-2.5 right-2.5 p-1 text-text-secondary hover:text-white rounded bg-neutral-900 border border-neutral-800 hover:border-neutral-700 cursor-pointer transition-all"
                    title="Edit concept prompt"
                  >
                    <SlidersHorizontal size={10} />
                  </button>
                )}
              </div>
            )}

            {!task && (
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleRegenerateConcept}
                    disabled={!imageLoaded}
                    className="bg-neutral-800 hover:bg-neutral-750 text-white font-bold py-2 px-3 rounded-lg text-[10px] transition-all cursor-pointer flex items-center justify-center gap-1.5 border border-neutral-700 disabled:opacity-40"
                  >
                    <Wand2 size={11} />
                    <span>Regen Concept</span>
                  </button>
                  <button
                    onClick={handleGenerate3D}
                    disabled={started || !imageLoaded}
                    className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-bold py-2 px-3 rounded-lg text-[10px] transition-all cursor-pointer flex items-center justify-center gap-1.5 border-none shadow-md disabled:opacity-40"
                  >
                    {started ? (
                      <>
                        <Loader2 size={11} className="animate-spin text-white" />
                        <span>Creating...</span>
                      </>
                    ) : (
                      <>
                        <Package size={11} className="text-white" />
                        <span>Approve & Generate</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {task && (isPending || isProcessing) && (
              <div className="flex flex-col gap-2 bg-[#0f0f15]/50 border border-neutral-800/60 p-3 rounded-lg">
                <div className="flex justify-between items-center text-[9px] font-mono text-text-secondary">
                  <span className="flex items-center gap-1.5">
                    <Loader2 size={10} className="animate-spin text-fuchsia-400" />
                    {isPending ? 'Queued in Meshy...' : 'Generating Mesh & Textures...'}
                  </span>
                  <span className="font-bold text-white">{task.progress}%</span>
                </div>
                <div className="w-full h-1.5 bg-neutral-900 rounded-full overflow-hidden border border-border/30">
                  <div 
                    className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-300 rounded-full"
                    style={{ width: `${task.progress}%` }}
                  />
                </div>
              </div>
            )}

            {task && isSucceeded && (
              <div className="bg-emerald-950/10 border border-emerald-500/20 px-3 py-2.5 rounded-lg flex flex-col gap-2">
                <div className="flex items-center gap-1.5 text-emerald-400 text-[10px] font-bold">
                  <span>✨</span>
                  <span>Asset successfully generated and imported!</span>
                </div>
                <button
                  onClick={() => {
                    const newObjId = `obj_ai_${task.id}`;
                    useStore.getState().selectObject(newObjId);
                  }}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold py-1.5 px-3 rounded text-[10px] cursor-pointer transition-colors border-none"
                >
                  Select Object in Viewport
                </button>
              </div>
            )}

            {task && isFailed && (
              <div className="text-[10px] text-red-400 bg-red-950/20 border border-red-500/20 px-3 py-2 rounded-lg leading-relaxed">
                ⚠️ <b>Asset Generation Failed:</b> {task.errorMsg || 'Unknown error occurred during Meshy processing'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const ThinkingIndicator = () => (
  <div className="flex justify-start mb-3">
    <div className="flex items-start gap-2">
      <div className="w-6 h-6 rounded-full bg-violet-500/20 border border-violet-500/40 flex items-center justify-center flex-shrink-0">
        <Loader2 size={12} className="text-violet-400 animate-spin" />
      </div>
      <div className="bg-bg-panel/80 border border-border/60 rounded-xl rounded-tl-sm px-3.5 py-2.5">
        <div className="flex gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-violet-400/60 animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-1.5 h-1.5 rounded-full bg-violet-400/60 animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-1.5 h-1.5 rounded-full bg-violet-400/60 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  </div>
);

// ─── AI & Generator Settings View ────────────────────────────────
const AiSettingsView = ({ onClose }: { onClose: () => void }) => {
  const { assistantApiKey, setAssistantApiKey, meshyApiKey, setMeshyApiKey } = useStore();
  const [geminiKey, setGeminiKey] = useState(assistantApiKey);
  const [meshyKey, setMeshyKey] = useState(meshyApiKey);

  const handleSave = () => {
    setAssistantApiKey(geminiKey.trim());
    setMeshyApiKey(meshyKey.trim());
    onClose();
  };

  return (
    <div className="flex-1 flex flex-col p-5 gap-5 bg-[#0f0f15]/50 animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="flex flex-col gap-1">
        <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-2">
          <Settings size={13} className="text-violet-400" />
          AI & Generator Settings
        </h3>
        <p className="text-[9px] text-text-secondary leading-relaxed">
          Configure API connection credentials for generative tools. Keys are stored locally in your browser.
        </p>
      </div>

      <div className="flex flex-col gap-4 flex-1">
        {/* Gemini API Key */}
        <div className="flex flex-col gap-1.5 bg-neutral-900/40 border border-neutral-800/80 p-3 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <KeyRound size={12} className="text-violet-400" />
            <span className="text-[10px] font-bold text-white uppercase tracking-wider">Gemini API Key</span>
          </div>
          <p className="text-[8px] text-text-secondary leading-normal mb-2">
            Required for natural language creative instructions, blueprints, and agentic workflows.
          </p>
          <input
            type="password"
            value={geminiKey}
            onChange={(e) => setGeminiKey(e.target.value)}
            placeholder="AIzaSy..."
            className="w-full px-3 py-1.5 bg-bg-deep/80 border border-border/60 rounded-lg text-[10px] text-text-primary placeholder:text-text-secondary/40 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 font-mono"
          />
        </div>

        {/* Meshy API Key */}
        <div className="flex flex-col gap-1.5 bg-neutral-900/40 border border-neutral-800/80 p-3 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <Package size={12} className="text-fuchsia-400" />
            <span className="text-[10px] font-bold text-white uppercase tracking-wider">Meshy 3D API Key</span>
          </div>
          <p className="text-[8px] text-text-secondary leading-normal mb-2">
            Required for generating 3D models and automated character rigging.
          </p>
          <input
            type="password"
            value={meshyKey}
            onChange={(e) => setMeshyKey(e.target.value)}
            placeholder="msy_..."
            className="w-full px-3 py-1.5 bg-bg-deep/80 border border-border/60 rounded-lg text-[10px] text-text-primary placeholder:text-text-secondary/40 focus:outline-none focus:border-fuchsia-500/50 focus:ring-1 focus:ring-fuchsia-500/20 font-mono"
          />
        </div>
      </div>

      <div className="flex gap-2 mt-auto">
        <button
          onClick={onClose}
          className="flex-1 bg-neutral-850 hover:bg-neutral-800 border border-neutral-750 text-text-secondary hover:text-white font-bold py-1.5 rounded-lg text-[10px] transition-all cursor-pointer"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="flex-1 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-bold py-1.5 rounded-lg text-[10px] transition-all cursor-pointer border-none shadow-md"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
};

// ─── API Key Setup View ──────────────────────────────────────────

const ApiKeySetup = () => {
  const { assistantApiKey, setAssistantApiKey } = useStore();
  const [input, setInput] = useState(assistantApiKey);

  const handleSave = () => {
    setAssistantApiKey(input.trim());
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4">
      <div className="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center">
        <KeyRound size={24} className="text-violet-400" />
      </div>
      <div className="text-center">
        <h3 className="text-xs font-bold text-text-primary mb-1">Connect Gemini API</h3>
        <p className="text-[10px] text-text-secondary leading-relaxed max-w-[240px]">
          Enter your Gemini API key to enable the AI Creative Assistant. Your key is stored locally and never leaves your browser.
        </p>
      </div>
      <div className="w-full max-w-[260px] flex flex-col gap-2">
        <input
          type="password"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          placeholder="AIzaSy..."
          className="w-full px-3 py-2 bg-bg-deep/80 border border-border/60 rounded-lg text-[11px] text-text-primary placeholder:text-text-secondary/40 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 font-mono"
        />
        <button
          onClick={handleSave}
          disabled={!input.trim()}
          className="w-full px-3 py-2 bg-violet-500/20 border border-violet-500/40 rounded-lg text-[11px] font-semibold text-violet-300 hover:bg-violet-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Connect
        </button>
      </div>
    </div>
  );
};

// ─── Game Context Badge ──────────────────────────────────────────

const GameContextBadge = () => {
  const { assistantGameContext, setAssistantGameContext } = useStore();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(assistantGameContext);

  const handleSave = () => {
    setAssistantGameContext(draft.trim());
    setIsEditing(false);
  };

  if (!assistantGameContext && !isEditing) {
    return (
      <button
        onClick={() => setIsEditing(true)}
        className="w-full px-3.5 py-2 border-b border-border/30 bg-violet-500/5 hover:bg-violet-500/10 transition-colors flex items-center gap-2 text-[10px] text-violet-300/70 cursor-pointer group"
      >
        <Gamepad2 size={12} className="text-violet-400/50 group-hover:text-violet-400 transition-colors" />
        <span className="group-hover:text-violet-300 transition-colors">Set your game vision...</span>
      </button>
    );
  }

  if (isEditing) {
    return (
      <div className="px-3 py-2 border-b border-border/30 bg-violet-500/5 space-y-1.5">
        <div className="flex items-center gap-1.5 text-[9px] text-violet-400/70 font-mono uppercase tracking-widest">
          <Gamepad2 size={10} />
          Game Vision
        </div>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="e.g. A gritty street-fighting game called The Outcasts with dark, urban environments..."
          rows={2}
          autoFocus
          className="w-full px-2 py-1.5 bg-bg-deep/80 border border-violet-500/30 rounded-md text-[10px] text-text-primary placeholder:text-text-secondary/30 resize-none outline-none focus:border-violet-500/50"
        />
        <div className="flex gap-1.5 justify-end">
          <button onClick={() => setIsEditing(false)} className="px-2 py-0.5 text-[9px] text-text-secondary hover:text-text-primary rounded transition-colors">Cancel</button>
          <button onClick={handleSave} className="px-2.5 py-0.5 text-[9px] font-semibold text-violet-300 bg-violet-500/20 border border-violet-500/40 rounded hover:bg-violet-500/30 transition-colors">Save</button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-3.5 py-1.5 border-b border-border/30 bg-violet-500/5 flex items-center gap-2 group">
      <Gamepad2 size={10} className="text-violet-400/60 flex-shrink-0" />
      <span className="text-[9px] text-violet-300/70 truncate flex-1 font-mono" title={assistantGameContext}>
        {assistantGameContext}
      </span>
      <button
        onClick={() => { setDraft(assistantGameContext); setIsEditing(true); }}
        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-violet-500/20 transition-all"
      >
        <Pencil size={9} className="text-violet-400/60" />
      </button>
    </div>
  );
};

// ─── Main Panel ──────────────────────────────────────────────────

export default function AiAssistantPanel() {
  const {
    assistantMessages,
    assistantPanelVisible,
    assistantIsLoading,
    assistantApiKey,
    toggleAssistantPanel,
    sendAssistantQuery,
    applyPropertyPatch,
    applySceneAction,
    clearAssistantHistory,
    selectedIds,
    objects,
    aiFocusScope,
    setAiFocusScope,
  } = useStore();

  const [inputText, setInputText] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [assistantMessages, assistantIsLoading]);

  // Focus input when panel opens
  useEffect(() => {
    if (assistantPanelVisible) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [assistantPanelVisible]);

  // Auto-switch scope when user selects/deselects an object
  useEffect(() => {
    if (selectedIds.length > 0) {
      setAiFocusScope('OBJECT');
    } else {
      setAiFocusScope('GLOBAL');
    }
  }, [selectedIds, setAiFocusScope]);

  // Get focus context
  const focusObject = objects.find((o) => o.id === selectedIds[0]);
  const focusLabel = focusObject ? focusObject.name : 'No Selection';

  const handleSend = () => {
    const query = inputText.trim();
    if (!query || assistantIsLoading) return;
    setInputText('');
    sendAssistantQuery(query);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!assistantPanelVisible) return null;

  const hasApiKey = !!assistantApiKey;

  return (
    <div
      className="absolute right-0 top-0 bottom-0 z-50 flex flex-col bg-bg-surface/95 backdrop-blur-xl border-l border-border/60 shadow-2xl"
      style={{
        width: 380,
        animation: 'slideInRight 200ms ease-out'
      }}
    >
      {/* ─── Header ─── */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-border/50 flex items-center justify-between bg-bg-panel/40">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-violet-500/20 border border-violet-500/40 flex items-center justify-center">
            <Sparkles size={11} className="text-violet-400" />
          </div>
          <span className="text-[11px] font-bold text-text-primary tracking-wide uppercase">AI Assistant</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-1.5 rounded-md transition-colors ${
              showSettings
                ? 'text-violet-400 bg-violet-500/10'
                : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
            }`}
            title="AI Settings"
          >
            <Settings size={12} />
          </button>
          {hasApiKey && (
            <button
              onClick={clearAssistantHistory}
              className="p-1.5 rounded-md text-text-secondary hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Clear history"
            >
              <Trash2 size={12} />
            </button>
          )}
          <button
            onClick={toggleAssistantPanel}
            className="p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-white/5 transition-colors"
            title="Close panel"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* ─── Context Badges ─── */}
      {hasApiKey && (
        <>
          <GameContextBadge />
          {/* ─── Scope Toggle Split-Button ─── */}
          <div className="flex-shrink-0 px-3 py-2 border-b border-border/30 bg-bg-deep/40">
            <div className="text-[8px] text-text-secondary/50 uppercase tracking-widest font-mono mb-1.5">AI Targeting Scope</div>
            <div className="flex rounded-lg overflow-hidden border border-border/50">
              <button
                onClick={() => setAiFocusScope('GLOBAL')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold transition-all ${
                  aiFocusScope === 'GLOBAL'
                    ? 'bg-violet-500/20 text-violet-300 border-r border-violet-500/30'
                    : 'bg-bg-panel/30 text-text-secondary/60 border-r border-border/30 hover:bg-white/5 hover:text-text-secondary'
                }`}
              >
                <Globe size={11} className={aiFocusScope === 'GLOBAL' ? 'text-violet-400' : 'text-text-secondary/40'} />
                Global Workspace
              </button>
              <button
                onClick={() => setAiFocusScope('OBJECT')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold transition-all ${
                  aiFocusScope === 'OBJECT'
                    ? 'bg-accent/15 text-accent border-l border-accent/20'
                    : 'bg-bg-panel/30 text-text-secondary/60 hover:bg-white/5 hover:text-text-secondary'
                }`}
              >
                <Package size={11} className={aiFocusScope === 'OBJECT' ? 'text-accent' : 'text-text-secondary/40'} />
                {focusObject ? focusLabel : 'No Object'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ─── Body ─── */}
      {showSettings ? (
        <AiSettingsView onClose={() => setShowSettings(false)} />
      ) : !hasApiKey ? (
        <ApiKeySetup />
      ) : (
        <>
          {/* ─── Messages Stream ─── */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {assistantMessages.length === 0 && !assistantIsLoading && (
              <div className="flex flex-col items-center justify-center h-full gap-3 opacity-50">
                <Wand2 size={32} className="text-text-secondary" />
                <div className="text-center">
                  <p className="text-[11px] text-text-secondary font-medium">Your creative partner</p>
                  <p className="text-[9px] text-text-secondary/60 mt-1 max-w-[220px]">
                    Describe what you want in plain English — no code required. Try: "Make the lighting feel like a spooky alley."
                  </p>
                </div>
              </div>
            )}

            {assistantMessages.map((msg) => {
              if (msg.role === 'user') {
                return <UserMessageCard key={msg.id} msg={msg} />;
              }
              if (msg.actionType === 'kickstart_blueprint' && msg.blueprint) {
                return <BlueprintCard key={msg.id} msg={msg} onApply={() => applySceneAction(msg.id)} />;
              }
              if (msg.actionType === 'scene_action' && msg.actions && msg.actions.length > 0) {
                return <SceneActionCard key={msg.id} msg={msg} onApply={() => applySceneAction(msg.id)} />;
              }
              if (msg.actionType === 'property_patch' && msg.propertyPatch) {
                return <PropertyPatchCard key={msg.id} msg={msg} onApply={() => applyPropertyPatch(msg.id)} />;
              }
              if (msg.actionType === 'meshy_generation') {
                return <MeshyHandoffCard key={msg.id} msg={msg} />;
              }
              return <TextResponseCard key={msg.id} msg={msg} />;
            })}

            {assistantIsLoading && <ThinkingIndicator />}

            <div ref={messagesEndRef} />
          </div>

          {/* ─── Input Area ─── */}
          <div className="flex-shrink-0 px-3 py-3 border-t border-border/50 bg-bg-panel/40">
            <div className="flex items-end gap-2 bg-bg-deep/60 border border-border/50 rounded-xl px-3 py-2 focus-within:border-violet-500/40 focus-within:ring-1 focus-within:ring-violet-500/10 transition-all">
              <textarea
                ref={inputRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe what you want to change..."
                rows={1}
                className="flex-1 bg-transparent text-[11px] text-text-primary placeholder:text-text-secondary/40 resize-none outline-none leading-relaxed max-h-[80px] overflow-y-auto"
                style={{ minHeight: '20px' }}
              />
              <button
                onClick={handleSend}
                disabled={!inputText.trim() || assistantIsLoading}
                className={`p-1.5 rounded-lg transition-all flex-shrink-0 ${
                  !inputText.trim() || assistantIsLoading
                    ? 'text-text-secondary/30 cursor-not-allowed'
                    : 'text-violet-400 hover:bg-violet-500/20 cursor-pointer'
                }`}
              >
                {assistantIsLoading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}
              </button>
            </div>
            <div className="flex items-center justify-between mt-1.5 px-1">
              <span className="text-[8px] text-text-secondary/40 font-mono">Gemini 2.0 Flash</span>
              <span className="text-[8px] text-text-secondary/40">Enter to send · Shift+Enter for newline</span>
            </div>
          </div>
        </>
      )}

      {/* ─── Slide-in Animation ─── */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
