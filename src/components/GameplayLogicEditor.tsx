import React, { useState } from 'react';
import { useStore, Quest, QuestObjective, ScriptedEvent, ScriptedEventAction } from '../store/useStore';
import { toast } from '../store/useToastStore';
import {
  Plus,
  Trash2,
  Sparkles,
  BookOpen,
  Target,
  Award,
  Zap,
  Variable,
  Play,
  Bookmark
} from 'lucide-react';

export default function GameplayLogicEditor() {
  const {
    quests,
    addQuest,
    updateQuest,
    deleteQuest,
    scriptedEvents,
    addScriptedEvent,
    updateScriptedEvent,
    deleteScriptedEvent,
    gameVariables,
    setGameVariable,
    deleteGameVariable,
    objects,
    executeScriptedEvent,
    triggerScriptedEvents
  } = useStore();

  const [activeTab, setActiveTab] = useState<'quests' | 'events' | 'variables'>('quests');

  // Local creation states
  const [newQuestTitle, setNewQuestTitle] = useState('');
  const [newQuestDesc, setNewQuestDesc] = useState('');
  const [newQuestXp, setNewQuestXp] = useState(100);

  const [selectedQuestId, setSelectedQuestId] = useState<string | null>(null);
  const selectedQuest = quests.find(q => q.id === selectedQuestId);

  // Objective creation
  const [newObjType, setNewObjType] = useState<QuestObjective['type']>('talk_to');
  const [newObjDesc, setNewObjDesc] = useState('');
  const [newObjTargetName, setNewObjTargetName] = useState('');
  const [newObjTargetCount, setNewObjTargetCount] = useState(1);

  // Scripted Event creation
  const [newEventName, setNewEventName] = useState('');
  const [newEventType, setNewEventType] = useState<ScriptedEvent['triggerType']>('on_level_start');
  const [newEventTargetId, setNewEventTargetId] = useState('');
  const [newEventRequiresUltimate, setNewEventRequiresUltimate] = useState(false);

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const selectedEvent = scriptedEvents.find(e => e.id === selectedEventId);

  // Event Action creation
  const [newActType, setNewActType] = useState<ScriptedEventAction['type']>('dialogue');
  const [newActDialogue, setNewActDialogue] = useState('');
  const [newActSpawnName, setNewActSpawnName] = useState('');
  const [newActSpawnPos, setNewActSpawnPos] = useState('[0, 1, 0]');
  const [newActVarKey, setNewActVarKey] = useState('');
  const [newActVarVal, setNewActVarVal] = useState('true');
  const [newActTargetObj, setNewActTargetObj] = useState('');
  const [newActVisibility, setNewActVisibility] = useState('true');
  const [newActAudioUrl, setNewActAudioUrl] = useState('');
  const [newActDuration, setNewActDuration] = useState(5.0);

  // New Transformation & VFX local states
  const [newActCharId, setNewActCharId] = useState('');
  const [newActTargetForm, setNewActTargetForm] = useState<'ultimate' | 'base'>('ultimate');
  const [newActChangeColor, setNewActChangeColor] = useState(true);
  const [newActCharColor, setNewActCharColor] = useState('#555555');
  const [newActChangeScale, setNewActChangeScale] = useState(true);
  const [newActCharScaleX, setNewActCharScaleX] = useState(1.2);
  const [newActCharScaleY, setNewActCharScaleY] = useState(1.2);
  const [newActCharScaleZ, setNewActCharScaleZ] = useState(1.2);
  const [newActMorphTargets, setNewActMorphTargets] = useState('{"veins": 1.0, "bulk": 1.2}');
  const [newActPlayVFX, setNewActPlayVFX] = useState(true);
  const [newActVfxType, setNewActVfxType] = useState<'none' | 'fire' | 'tornado' | 'smoke' | 'water' | 'sparks'>('fire');
  const [newActVfxColor, setNewActVfxColor] = useState('#ff0055');
  const [newActVfxDuration, setNewActVfxDuration] = useState(2.0);
  const [newActApplyPostEffect, setNewActApplyPostEffect] = useState(true);
  const [newActPostEffectType, setNewActPostEffectType] = useState<'none' | 'electrical'>('electrical');
  const [newActUltimateDuration, setNewActUltimateDuration] = useState(20.0);

  const [newActSpawnEffectType, setNewActSpawnEffectType] = useState<'fire' | 'tornado' | 'smoke' | 'water' | 'sparks'>('fire');
  const [newActSpawnEffectColor, setNewActSpawnEffectColor] = useState('#eab308');
  const [newActSpawnEffectSize, setNewActSpawnEffectSize] = useState(0.35);
  const [newActSpawnEffectSpeed, setNewActSpawnEffectSpeed] = useState(1.5);
  const [newActSpawnEffectCount, setNewActSpawnEffectCount] = useState(800);
  const [newActSpawnEffectLifetime, setNewActSpawnEffectLifetime] = useState(3.0);

  const [newActMatEffectType, setNewActMatEffectType] = useState<'none' | 'electrical'>('electrical');
  const [newActUltAdjustment, setNewActUltAdjustment] = useState(25);

  // Dialogue properties states
  const [newActDialogueSpeakerId, setNewActDialogueSpeakerId] = useState('');
  const [newActDialogueSpeakerName, setNewActDialogueSpeakerName] = useState('NPC');
  const [newActDialoguePosition, setNewActDialoguePosition] = useState<'bottom' | 'overhead'>('bottom');
  const [newActDialogueDuration, setNewActDialogueDuration] = useState(4.0);

  // VFX Attachment and offset overrides
  const [newActVfxAttachPoint, setNewActVfxAttachPoint] = useState<'pivot' | 'center' | 'head' | 'custom'>('center');
  const [newActVfxOffsetX, setNewActVfxOffsetX] = useState(0);
  const [newActVfxOffsetY, setNewActVfxOffsetY] = useState(0);
  const [newActVfxOffsetZ, setNewActVfxOffsetZ] = useState(0);

  const [newActSpawnVfxAttachPoint, setNewActSpawnVfxAttachPoint] = useState<'pivot' | 'center' | 'head' | 'custom'>('pivot');
  const [newActSpawnVfxOffsetX, setNewActSpawnVfxOffsetX] = useState(0);
  const [newActSpawnVfxOffsetY, setNewActSpawnVfxOffsetY] = useState(0);
  const [newActSpawnVfxOffsetZ, setNewActSpawnVfxOffsetZ] = useState(0);

  // Variables creation
  const [newVarKey, setNewVarKey] = useState('');
  const [newVarVal, setNewVarVal] = useState('true');
  const [newVarType, setNewVarType] = useState<'boolean' | 'number' | 'string'>('boolean');

  const handleCreateQuest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestTitle.trim()) return;

    const quest: Quest = {
      id: `quest_${crypto.randomUUID()}`,
      title: newQuestTitle,
      description: newQuestDesc,
      objectives: [],
      rewardXp: newQuestXp,
      status: 'not_started'
    };

    addQuest(quest);
    setNewQuestTitle('');
    setNewQuestDesc('');
    setNewQuestXp(100);
    setSelectedQuestId(quest.id);
  };

  const handleAddObjective = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuestId || !newObjDesc.trim()) return;

    const objective: QuestObjective = {
      id: `obj_${crypto.randomUUID()}`,
      description: newObjDesc,
      type: newObjType,
      targetName: newObjTargetName || 'Target',
      targetCount: newObjTargetCount,
      currentCount: 0,
      completed: false
    };

    const updatedObjectives = [...(selectedQuest?.objectives || []), objective];
    updateQuest(selectedQuestId, { objectives: updatedObjectives });

    setNewObjDesc('');
    setNewObjTargetName('');
    setNewObjTargetCount(1);
  };

  const handleRemoveObjective = (objId: string) => {
    if (!selectedQuestId || !selectedQuest) return;
    const updatedObjectives = selectedQuest.objectives.filter(o => o.id !== objId);
    updateQuest(selectedQuestId, { objectives: updatedObjectives });
  };

  const handleCreateEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventName.trim()) return;

    const event: ScriptedEvent = {
      id: `event_${crypto.randomUUID()}`,
      name: newEventName,
      triggerType: newEventType,
      triggerTargetId: newEventTargetId || undefined,
      actions: [],
      requiresUltimate: newEventRequiresUltimate
    };

    addScriptedEvent(event);
    setNewEventName('');
    setNewEventTargetId('');
    setNewEventRequiresUltimate(false);
    setSelectedEventId(event.id);
  };

  const handleAddAction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventId || !selectedEvent) return;

    let params: Record<string, any> = {};
    if (newActType === 'dialogue') {
      params.text = newActDialogue || 'Hello, Traveler!';
      params.speakerId = newActDialogueSpeakerId;
      params.speakerName = newActDialogueSpeakerName;
      params.position = newActDialoguePosition;
      params.duration = Number(newActDialogueDuration) || 4.0;
    } else if (newActType === 'spawn_prefab') {
      params.prefabName = newActSpawnName || 'Cube';
      try {
        params.position = JSON.parse(newActSpawnPos);
      } catch {
        params.position = [0, 1, 0];
      }
    } else if (newActType === 'set_variable') {
      params.key = newActVarKey || 'flag';
      if (newActVarVal === 'true') params.value = true;
      else if (newActVarVal === 'false') params.value = false;
      else if (!isNaN(Number(newActVarVal))) params.value = Number(newActVarVal);
      else params.value = newActVarVal;
    } else if (newActType === 'toggle_visibility') {
      params.targetId = newActTargetObj || 'object';
      params.visible = newActVisibility === 'true';
    } else if (newActType === 'play_sound') {
      params.audioUrl = newActAudioUrl || 'sound.mp3';
    } else if (newActType === 'wait_delay') {
      params.duration = Number(newActDuration) || 1.0;
    } else if (newActType === 'transform_character') {
      params.characterId = newActCharId || 'starter_player';
      params.targetForm = newActTargetForm;
      params.changeColor = newActChangeColor;
      params.color = newActCharColor;
      params.changeScale = newActChangeScale;
      params.scale = [newActCharScaleX, newActCharScaleY, newActCharScaleZ];
      try {
        params.morphTargets = JSON.parse(newActMorphTargets);
      } catch {
        params.morphTargets = { 'veins': 1.0, 'bulk': 1.2 };
      }
      params.playVFX = newActPlayVFX;
      params.vfxType = newActVfxType;
      params.vfxColor = newActVfxColor;
      params.vfxDuration = Number(newActVfxDuration) || 2.0;
      params.vfxAttachPoint = newActVfxAttachPoint;
      params.vfxOffsetX = Number(newActVfxOffsetX) || 0;
      params.vfxOffsetY = Number(newActVfxOffsetY) || 0;
      params.vfxOffsetZ = Number(newActVfxOffsetZ) || 0;
      params.applyPostEffect = newActApplyPostEffect;
      params.postEffectType = newActPostEffectType;
      params.ultimateDuration = Number(newActUltimateDuration) || 20.0;
    } else if (newActType === 'spawn_effect') {
      params.targetId = newActTargetObj || 'starter_player';
      params.effectType = newActSpawnEffectType;
      params.color = newActSpawnEffectColor;
      params.size = Number(newActSpawnEffectSize) || 0.35;
      params.speed = Number(newActSpawnEffectSpeed) || 1.5;
      params.count = Number(newActSpawnEffectCount) || 800;
      params.lifetime = Number(newActSpawnEffectLifetime) || 3.0;
      params.vfxAttachPoint = newActSpawnVfxAttachPoint;
      params.vfxOffsetX = Number(newActSpawnVfxOffsetX) || 0;
      params.vfxOffsetY = Number(newActSpawnVfxOffsetY) || 0;
      params.vfxOffsetZ = Number(newActSpawnVfxOffsetZ) || 0;
    } else if (newActType === 'apply_material_effect') {
      params.targetId = newActTargetObj || 'starter_player';
      params.effectType = newActMatEffectType;
    } else if (newActType === 'adjust_ultimate') {
      params.amount = Number(newActUltAdjustment) !== undefined ? Number(newActUltAdjustment) : 25;
    }

    const action: ScriptedEventAction = {
      id: `act_${crypto.randomUUID()}`,
      type: newActType,
      params
    };

    const updatedActions = [...selectedEvent.actions, action];
    updateScriptedEvent(selectedEventId, { actions: updatedActions });

    setNewActDialogue('');
    setNewActSpawnName('');
    setNewActVarKey('');
    setNewActTargetObj('');
    setNewActVisibility('true');
    setNewActAudioUrl('');
    setNewActDuration(5.0);
    setNewActCharId('');
    setNewActTargetForm('ultimate');
    setNewActCharColor('#555555');
    setNewActUltAdjustment(25);
    setNewActCharScaleX(1.2);
    setNewActCharScaleY(1.2);
    setNewActCharScaleZ(1.2);
    setNewActPlayVFX(true);
    setNewActVfxType('fire');
    setNewActVfxColor('#ff0055');
    setNewActVfxDuration(2.0);
    setNewActApplyPostEffect(true);
    setNewActPostEffectType('electrical');
    setNewActUltimateDuration(20.0);
    setNewActSpawnEffectType('fire');
    setNewActSpawnEffectColor('#eab308');
    setNewActSpawnEffectSize(0.35);
    setNewActSpawnEffectSpeed(1.5);
    setNewActSpawnEffectCount(800);
    setNewActSpawnEffectLifetime(3.0);
    setNewActMatEffectType('electrical');

    setNewActDialogueSpeakerId('');
    setNewActDialogueSpeakerName('NPC');
    setNewActDialoguePosition('bottom');
    setNewActDialogueDuration(4.0);
    setNewActVfxAttachPoint('center');
    setNewActVfxOffsetX(0);
    setNewActVfxOffsetY(0);
    setNewActVfxOffsetZ(0);
    setNewActSpawnVfxAttachPoint('pivot');
    setNewActSpawnVfxOffsetX(0);
    setNewActSpawnVfxOffsetY(0);
    setNewActSpawnVfxOffsetZ(0);
  };

  const handleRemoveAction = (actionId: string) => {
    if (!selectedEventId || !selectedEvent) return;
    const updatedActions = selectedEvent.actions.filter(a => a.id !== actionId);
    updateScriptedEvent(selectedEventId, { actions: updatedActions });
  };

  const handleAddVariable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVarKey.trim()) return;

    let val: boolean | number | string = newVarVal;
    if (newVarType === 'boolean') {
      val = newVarVal === 'true';
    } else if (newVarType === 'number') {
      val = Number(newVarVal) || 0;
    }

    setGameVariable(newVarKey, val);
    setNewVarKey('');
    if (newVarType === 'boolean') setNewVarVal('true');
    else if (newVarType === 'number') setNewVarVal('0');
    else setNewVarVal('');
  };

  return (
    <div className="h-full w-full flex flex-col bg-[#0b0b0f] text-[11px] font-sans overflow-hidden">
      {/* Workspace Tabs Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 bg-[#12121a] px-4 py-2 shrink-0">
        <div className="flex items-center gap-1">
          <Sparkles className="text-emerald-400 w-4 h-4 mr-1.5" />
          <span className="text-[12px] font-bold text-white tracking-widest uppercase">Gameplay & Logic Configurator</span>
        </div>
        <div className="flex bg-[#0b0b0f] p-0.5 rounded border border-neutral-800">
          {[
            { id: 'quests', label: 'QUESTS & MISSIONS', icon: BookOpen },
            { id: 'events', label: 'SCRIPTED EVENTS', icon: Zap },
            { id: 'variables', label: 'GLOBAL VARIABLES', icon: Variable }
          ].map(tab => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded text-[10px] font-bold tracking-wider transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-inner'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Icon size={12} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* QUESTS VIEW */}
        {activeTab === 'quests' && (
          <>
            {/* Quest Left List */}
            <div className="w-[300px] border-r border-neutral-800 flex flex-col bg-[#0f0f15] shrink-0">
              <div className="p-3 border-b border-neutral-800 shrink-0">
                <form onSubmit={handleCreateQuest} className="flex flex-col gap-2">
                  <span className="font-bold text-neutral-400 uppercase tracking-wider text-[9px]">Add New Quest</span>
                  <input
                    type="text"
                    placeholder="Quest Title..."
                    value={newQuestTitle}
                    onChange={e => setNewQuestTitle(e.target.value)}
                    className="bg-neutral-900 border border-neutral-800 rounded px-2.5 py-1.5 text-white outline-none focus:border-emerald-500"
                  />
                  <textarea
                    placeholder="Quest Description..."
                    value={newQuestDesc}
                    onChange={e => setNewQuestDesc(e.target.value)}
                    className="bg-neutral-900 border border-neutral-800 rounded px-2.5 py-1.5 text-white outline-none focus:border-emerald-500 h-16 resize-none"
                  />
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <div className="flex items-center gap-1">
                      <Award className="text-amber-400 w-3.5 h-3.5" />
                      <span className="text-neutral-400 text-[9px]">XP Reward:</span>
                      <input
                        type="number"
                        value={newQuestXp}
                        onChange={e => setNewQuestXp(Number(e.target.value))}
                        className="bg-neutral-900 border border-neutral-800 rounded px-1.5 py-0.5 text-white outline-none w-14 text-center font-mono"
                      />
                    </div>
                    <button
                      type="submit"
                      className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded font-bold hover:bg-emerald-500/20 transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Plus size={12} /> Create
                    </button>
                  </div>
                </form>
              </div>

              <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
                <span className="font-bold text-neutral-400 uppercase tracking-wider text-[9px] px-2 py-1">Active Quests ({quests.length})</span>
                {quests.map(quest => (
                  <div
                    key={quest.id}
                    onClick={() => setSelectedQuestId(quest.id)}
                    className={`flex items-center justify-between p-2.5 rounded cursor-pointer transition-colors border ${
                      selectedQuestId === quest.id
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : 'bg-neutral-900/40 border-neutral-800/40 hover:bg-neutral-900 text-text-primary'
                    }`}
                  >
                    <div className="flex flex-col gap-0.5 truncate">
                      <span className="font-bold truncate">{quest.title}</span>
                      <span className="text-[9px] text-text-secondary truncate">{quest.description || 'No description'}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteQuest(quest.id);
                        if (selectedQuestId === quest.id) setSelectedQuestId(null);
                      }}
                      className="text-text-secondary hover:text-red-400 p-1 rounded"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Quest Right Panel (Objectives) */}
            <div className="flex-1 flex flex-col overflow-y-auto bg-[#0d0d12] p-4">
              {selectedQuest ? (
                <div className="flex flex-col gap-4 max-w-[650px]">
                  <div className="border-b border-neutral-800 pb-3 flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <span className="text-[14px] font-bold text-white">{selectedQuest.title}</span>
                      <span className="text-text-secondary">{selectedQuest.description || 'No description'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 px-3 py-1.5 rounded">
                      <Award className="text-amber-400 w-4 h-4" />
                      <span className="font-bold font-mono text-white text-[12px]">{selectedQuest.rewardXp} XP</span>
                    </div>
                  </div>

                  {/* Objective Form */}
                  <form onSubmit={handleAddObjective} className="bg-neutral-900/30 border border-neutral-800 rounded p-3 flex flex-col gap-3">
                    <span className="font-bold text-neutral-400 uppercase tracking-wider text-[9px]">Add Objective</span>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-text-secondary text-[9px]">Objective Type</span>
                        <select
                          value={newObjType}
                          onChange={e => setNewObjType(e.target.value as any)}
                          className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1.5 text-white outline-none focus:border-emerald-500"
                        >
                          <option value="talk_to">Talk to NPC</option>
                          <option value="defeat_enemy">Defeat Enemy</option>
                          <option value="collect_item">Collect Item</option>
                          <option value="reach_area">Reach Area/Zone</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-1">
                        <span className="text-text-secondary text-[9px]">Target Name / Key</span>
                        <input
                          type="text"
                          placeholder="e.g. 'Old Man', 'Goblin', 'Key'..."
                          value={newObjTargetName}
                          onChange={e => setNewObjTargetName(e.target.value)}
                          className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1.5 text-white outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 mt-1">
                      <div className="flex-1 flex flex-col gap-1">
                        <span className="text-text-secondary text-[9px]">Objective Prompt</span>
                        <input
                          type="text"
                          placeholder="e.g. 'Collect 3 magical crystals'..."
                          value={newObjDesc}
                          onChange={e => setNewObjDesc(e.target.value)}
                          className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1.5 text-white outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div className="flex flex-col gap-1 w-20 shrink-0">
                        <span className="text-text-secondary text-[9px] text-center">Goal Count</span>
                        <input
                          type="number"
                          value={newObjTargetCount}
                          onChange={e => setNewObjTargetCount(Number(e.target.value))}
                          className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-white outline-none text-center font-mono"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-4 py-2 rounded font-bold hover:bg-emerald-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-1"
                    >
                      <Plus size={12} /> Add Objective
                    </button>
                  </form>

                  {/* Objective List */}
                  <div className="flex flex-col gap-2">
                    <span className="font-bold text-neutral-400 uppercase tracking-wider text-[9px]">Objectives ({selectedQuest.objectives.length})</span>
                    {selectedQuest.objectives.map((obj) => (
                      <div
                        key={obj.id}
                        className="flex items-center justify-between bg-neutral-900/40 border border-neutral-800 rounded p-3"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-4 h-4 rounded-full border border-neutral-700 flex items-center justify-center text-neutral-400 shrink-0 mt-0.5 bg-neutral-900">
                            <Target size={10} />
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <span className="font-bold text-white text-[12px]">{obj.description}</span>
                            <div className="flex items-center gap-2 text-text-secondary">
                              <span className="text-[9px] uppercase tracking-wider bg-neutral-850 px-1 py-[2px] rounded text-emerald-400 border border-neutral-800">{obj.type.replace('_', ' ')}</span>
                              <span>Target: <strong className="text-white font-mono">{obj.targetName}</strong></span>
                              <span>Count: <strong className="text-white font-mono">{obj.targetCount}</strong></span>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveObjective(obj.id)}
                          className="text-text-secondary hover:text-red-400 p-1.5 rounded"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-text-secondary gap-2">
                  <Bookmark size={24} className="opacity-30" />
                  <span>Select or create a quest to edit its objectives.</span>
                </div>
              )}
            </div>
          </>
        )}

        {/* SCRIPTED EVENTS VIEW */}
        {activeTab === 'events' && (
          <>
            {/* Event Left List */}
            <div className="w-[300px] border-r border-neutral-800 flex flex-col bg-[#0f0f15] shrink-0">
              <div className="p-3 border-b border-neutral-800 shrink-0">
                <form onSubmit={handleCreateEvent} className="flex flex-col gap-2">
                  <span className="font-bold text-neutral-400 uppercase tracking-wider text-[9px]">Create Scripted Event</span>
                  <input
                    type="text"
                    placeholder="Event Name..."
                    value={newEventName}
                    onChange={e => setNewEventName(e.target.value)}
                    className="bg-neutral-900 border border-neutral-800 rounded px-2.5 py-1.5 text-white outline-none focus:border-emerald-500"
                  />
                  <div className="flex flex-col gap-1">
                    <span className="text-text-secondary text-[9px]">Trigger Type</span>
                    <select
                      value={newEventType}
                      onChange={e => setNewEventType(e.target.value as any)}
                      className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1.5 text-white outline-none focus:border-emerald-500"
                    >
                      <option value="on_level_start">On Level Start</option>
                      <option value="on_enter_trigger">On Enter Trigger Zone</option>
                      <option value="on_quest_start">On Quest Started</option>
                      <option value="on_quest_complete">On Quest Completed</option>
                      <option value="on_key_pressed">On Key Pressed (Input Control)</option>
                      <option value="on_click">On Object Clicked (Interaction)</option>
                      <option value="on_variable_changed">On Variable Changed</option>
                      <option value="on_time_elapsed">On Time Elapsed (Timer)</option>
                      <option value="on_enemy_defeated">On Enemy Defeated (Combat)</option>
                    </select>
                  </div>

                  {newEventType !== 'on_level_start' && (
                    <div className="flex flex-col gap-1">
                      <span className="text-text-secondary text-[9px]">
                        {newEventType === 'on_key_pressed' && 'Key (e.g. "T", "Space")'}
                        {newEventType === 'on_click' && 'Object Name/ID'}
                        {newEventType === 'on_variable_changed' && 'Variable Key (e.g. "bossDefeated")'}
                        {newEventType === 'on_time_elapsed' && 'Delay in Seconds (e.g. "5")'}
                        {newEventType === 'on_enemy_defeated' && 'Enemy Object ID'}
                        {['on_enter_trigger', 'on_quest_start', 'on_quest_complete'].includes(newEventType) && 'Trigger Source ID / Quest ID'}
                      </span>
                      <input
                        type="text"
                        placeholder={
                          newEventType === 'on_key_pressed' ? 'e.g. T' :
                          newEventType === 'on_click' ? 'e.g. obj_old_man' :
                          newEventType === 'on_variable_changed' ? 'e.g. health' :
                          newEventType === 'on_time_elapsed' ? 'e.g. 5.5' :
                          newEventType === 'on_enemy_defeated' ? 'e.g. boss_goblin' :
                          'e.g. obj_trigger_zone, quest_1...'
                        }
                        value={newEventTargetId}
                        onChange={e => setNewEventTargetId(e.target.value)}
                        className="bg-neutral-900 border border-neutral-800 rounded px-2.5 py-1.5 text-white outline-none focus:border-emerald-500 font-mono"
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-2 mt-1 py-1">
                    <input
                      type="checkbox"
                      id="requiresUltimate"
                      checked={newEventRequiresUltimate}
                      onChange={e => setNewEventRequiresUltimate(e.target.checked)}
                      className="w-3.5 h-3.5 bg-neutral-900 border border-neutral-800 rounded accent-emerald-500 cursor-pointer"
                    />
                    <label htmlFor="requiresUltimate" className="text-text-secondary text-[10px] cursor-pointer select-none">
                      Requires Full Ultimate Bar (100% Charge)
                    </label>
                  </div>

                  <button
                    type="submit"
                    className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded font-bold hover:bg-emerald-500/20 transition-all flex items-center justify-center gap-1 cursor-pointer mt-1"
                  >
                    <Plus size={12} /> Add Event
                  </button>
                </form>
              </div>

              <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
                <span className="font-bold text-neutral-400 uppercase tracking-wider text-[9px] px-2 py-1">Events Registry ({scriptedEvents.length})</span>
                {scriptedEvents.map(event => (
                  <div
                    key={event.id}
                    onClick={() => setSelectedEventId(event.id)}
                    className={`flex items-center justify-between p-2.5 rounded cursor-pointer transition-colors border ${
                      selectedEventId === event.id
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : 'bg-neutral-900/40 border-neutral-800/40 hover:bg-neutral-900 text-text-primary'
                    }`}
                  >
                    <div className="flex flex-col gap-0.5 truncate">
                      <span className="font-bold truncate">{event.name}</span>
                      <span className="text-[9px] text-text-secondary truncate bg-neutral-850 px-1 py-[2px] rounded border border-neutral-800 mt-1 uppercase w-max tracking-wide">
                        {event.triggerType.replace('_', ' ')}
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteScriptedEvent(event.id);
                        if (selectedEventId === event.id) setSelectedEventId(null);
                      }}
                      className="text-text-secondary hover:text-red-400 p-1 rounded"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Event Right Panel (Action Chains) */}
            <div className="flex-1 flex flex-col overflow-y-auto bg-[#0d0d12] p-4">
              {selectedEvent ? (
                <div className="flex flex-col gap-4 max-w-[650px]">
                  <div className="border-b border-neutral-800 pb-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[14px] font-bold text-white">{selectedEvent.name}</span>
                      <button
                        type="button"
                        onClick={() => {
                          executeScriptedEvent(selectedEvent);
                          toast.info('Test Run', `Executing "${selectedEvent.name}" action chain...`);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-semibold transition-all cursor-pointer active:scale-95 shadow-sm"
                      >
                        <Play size={11} className="fill-current" />
                        Test Run Event
                      </button>
                    </div>
                    <div className="flex items-center gap-2 text-text-secondary text-[10px]">
                      <span>Trigger: <strong className="text-emerald-400 font-mono">{selectedEvent.triggerType.toUpperCase()}</strong></span>
                      {selectedEvent.triggerTargetId && <span>Target ID: <strong className="text-white font-mono">{selectedEvent.triggerTargetId}</strong></span>}
                    </div>
                    <div className="flex items-center gap-2 mt-1 bg-neutral-900/40 border border-neutral-800/40 px-3 py-1.5 rounded-lg w-max">
                      <input
                        type="checkbox"
                        id="editRequiresUltimate"
                        checked={selectedEvent.requiresUltimate || false}
                        onChange={e => updateScriptedEvent(selectedEvent.id, { requiresUltimate: e.target.checked })}
                        className="w-3.5 h-3.5 bg-neutral-900 border border-neutral-800 rounded accent-emerald-500 cursor-pointer"
                      />
                      <label htmlFor="editRequiresUltimate" className="text-[10px] text-text-primary font-bold cursor-pointer select-none">
                        Requires 100% Ultimate Charge to Trigger
                      </label>
                    </div>
                  </div>

                  {/* Action Form */}
                  <form onSubmit={handleAddAction} className="bg-neutral-900/30 border border-neutral-800 rounded p-3 flex flex-col gap-3">
                    <span className="font-bold text-neutral-400 uppercase tracking-wider text-[9px]">Add Event Action</span>
                    <div className="flex flex-col gap-1">
                      <span className="text-text-secondary text-[9px]">Action Type</span>
                      <select
                        value={newActType}
                        onChange={e => setNewActType(e.target.value as any)}
                        className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1.5 text-white outline-none focus:border-emerald-500"
                      >
                        <option value="dialogue">Show NPC Dialogue</option>
                        <option value="spawn_prefab">Spawn Object Prefab</option>
                        <option value="set_variable">Set Global Variable</option>
                        <option value="toggle_visibility">Set Object Visibility (Zero-Code Swap)</option>
                        <option value="play_sound">Play Sound Effect</option>
                        <option value="wait_delay">Wait Delay (Duration Timer)</option>
                        <option value="transform_character">Morph/Transform Character (VFX & Scale)</option>
                        <option value="spawn_effect">Spawn Visual/Particle Effect (VFX)</option>
                        <option value="apply_material_effect">Apply Material Overlay Effect</option>
                        <option value="adjust_ultimate">Adjust Ultimate Charge (+/-)</option>
                      </select>
                    </div>

                    {newActType === 'dialogue' && (
                      <div className="flex flex-col gap-2.5">
                        <div className="flex flex-col gap-1">
                          <span className="text-text-secondary text-[9px]">Dialogue Text</span>
                          <textarea
                            placeholder="Dialogue text to display on trigger..."
                            value={newActDialogue}
                            onChange={e => setNewActDialogue(e.target.value)}
                            className="bg-neutral-900 border border-neutral-800 rounded px-2.5 py-1.5 text-white outline-none focus:border-emerald-500 h-14 resize-none"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="flex flex-col gap-1">
                            <span className="text-text-secondary text-[9px]">Speaker Display Name</span>
                            <input
                              type="text"
                              value={newActDialogueSpeakerName}
                              onChange={e => setNewActDialogueSpeakerName(e.target.value)}
                              className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1.5 text-white outline-none focus:border-emerald-500"
                            />
                          </div>

                          <div className="flex flex-col gap-1">
                            <span className="text-text-secondary text-[9px]">Dialogue Screen Location</span>
                            <select
                              value={newActDialoguePosition}
                              onChange={e => setNewActDialoguePosition(e.target.value as any)}
                              className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1.5 text-white outline-none focus:border-emerald-500"
                            >
                              <option value="bottom">Glassmorphic Bottom Overlay</option>
                              <option value="overhead">3D Overhead Speech Bubble</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="flex flex-col gap-1">
                            <span className="text-text-secondary text-[9px]">Speaker Target ID (Overhead Mode)</span>
                            <select
                              value={newActDialogueSpeakerId}
                              onChange={e => setNewActDialogueSpeakerId(e.target.value)}
                              className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1.5 text-white outline-none focus:border-emerald-500"
                            >
                              <option value="">-- Starter Player --</option>
                              {objects.map(o => (
                                <option key={o.id} value={o.id}>{o.name} ({o.id.substring(0, 6)})</option>
                              ))}
                            </select>
                          </div>

                          <div className="flex flex-col gap-1 font-mono">
                            <span className="text-text-secondary text-[9px]">On-Screen Duration (secs)</span>
                            <input
                              type="number"
                              step="0.5"
                              min="0.5"
                              value={newActDialogueDuration}
                              onChange={e => setNewActDialogueDuration(Number(e.target.value))}
                              className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1.5 text-white outline-none focus:border-emerald-500"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {newActType === 'spawn_prefab' && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-text-secondary text-[9px]">Prefab / Asset Name</span>
                          <input
                            type="text"
                            placeholder="e.g. Orc, Chest, Coin..."
                            value={newActSpawnName}
                            onChange={e => setNewActSpawnName(e.target.value)}
                            className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1.5 text-white outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-text-secondary text-[9px]">Coordinates [X, Y, Z]</span>
                          <input
                            type="text"
                            value={newActSpawnPos}
                            onChange={e => setNewActSpawnPos(e.target.value)}
                            className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1.5 text-white outline-none focus:border-emerald-500 font-mono"
                          />
                        </div>
                      </div>
                    )}

                    {newActType === 'set_variable' && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-text-secondary text-[9px]">Variable Key</span>
                          <input
                            type="text"
                            placeholder="e.g. hasKey, crystalsCount..."
                            value={newActVarKey}
                            onChange={e => setNewActVarKey(e.target.value)}
                            className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1.5 text-white outline-none focus:border-emerald-500 font-mono"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-text-secondary text-[9px]">Variable Value</span>
                          <input
                            type="text"
                            placeholder="e.g. true, 5, finished..."
                            value={newActVarVal}
                            onChange={e => setNewActVarVal(e.target.value)}
                            className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1.5 text-white outline-none focus:border-emerald-500 font-mono"
                          />
                        </div>
                      </div>
                    )}

                    {newActType === 'toggle_visibility' && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-text-secondary text-[9px]">Target Object ID / Name</span>
                          <input
                            type="text"
                            placeholder="e.g. BlueFormModel, GreyFormModel..."
                            value={newActTargetObj}
                            onChange={e => setNewActTargetObj(e.target.value)}
                            className="bg-neutral-900 border border-neutral-800 rounded px-2.5 py-1.5 text-white outline-none focus:border-emerald-500 font-mono"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-text-secondary text-[9px]">Visibility State</span>
                          <select
                            value={newActVisibility}
                            onChange={e => setNewActVisibility(e.target.value)}
                            className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1.5 text-white outline-none focus:border-emerald-500"
                          >
                            <option value="true">Visible (Show)</option>
                            <option value="false">Hidden (Hide)</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {newActType === 'play_sound' && (
                      <div className="flex flex-col gap-1">
                        <span className="text-text-secondary text-[9px]">Audio Asset ID / URL</span>
                        <input
                          type="text"
                          placeholder="e.g. sound_explosion.mp3, audio_1..."
                          value={newActAudioUrl}
                          onChange={e => setNewActAudioUrl(e.target.value)}
                          className="bg-neutral-900 border border-neutral-800 rounded px-2.5 py-1.5 text-white outline-none focus:border-emerald-500 font-mono"
                        />
                      </div>
                    )}

                    {newActType === 'wait_delay' && (
                      <div className="flex flex-col gap-1">
                        <span className="text-text-secondary text-[9px]">Duration Delay (in seconds)</span>
                        <input
                          type="number"
                          step="0.5"
                          min="0.1"
                          placeholder="5.0"
                          value={newActDuration}
                          onChange={e => setNewActDuration(Number(e.target.value))}
                          className="bg-neutral-900 border border-neutral-800 rounded px-2.5 py-1.5 text-white outline-none focus:border-emerald-500 font-mono"
                        />
                      </div>
                    )}

                    {newActType === 'transform_character' && (
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-col gap-1">
                          <span className="text-text-secondary text-[9px]">Select Character Object</span>
                          <select
                            value={newActCharId}
                            onChange={e => setNewActCharId(e.target.value)}
                            className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1.5 text-white outline-none focus:border-emerald-500"
                          >
                            <option value="">-- Starter Player --</option>
                            {objects.filter(o => o.type === 'mesh' || o.type === 'gltf').map(o => (
                              <option key={o.id} value={o.id}>{o.name} ({o.id.substring(0, 6)})</option>
                            ))}
                          </select>
                        </div>

                        <div className="flex flex-col gap-1">
                          <span className="text-text-secondary text-[9px]">Target Form</span>
                          <select
                            value={newActTargetForm}
                            onChange={e => setNewActTargetForm(e.target.value as any)}
                            className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1.5 text-white outline-none focus:border-emerald-500"
                          >
                            <option value="ultimate">Ultimate Form (veiny, grey scale, electrical glow)</option>
                            <option value="base">Base Form (original blue, default size)</option>
                          </select>
                        </div>

                        {newActTargetForm === 'ultimate' && (
                          <>
                            <div className="flex items-center gap-2 mt-1">
                              <input
                                type="checkbox"
                                id="changeColorCheck"
                                checked={newActChangeColor}
                                onChange={e => setNewActChangeColor(e.target.checked)}
                                className="accent-emerald-500"
                              />
                              <label htmlFor="changeColorCheck" className="text-neutral-300 text-[10px] cursor-pointer">Modify Character Color</label>
                            </div>
                            {newActChangeColor && (
                              <div className="flex items-center gap-2 pl-4">
                                <span className="text-text-secondary text-[9px]">Color Hex</span>
                                <input
                                  type="color"
                                  value={newActCharColor}
                                  onChange={e => setNewActCharColor(e.target.value)}
                                  className="w-8 h-6 bg-transparent border-0 cursor-pointer"
                                />
                                <input
                                  type="text"
                                  value={newActCharColor}
                                  onChange={e => setNewActCharColor(e.target.value)}
                                  className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-white outline-none w-20 text-center font-mono"
                                />
                              </div>
                            )}

                            <div className="flex items-center gap-2 mt-1">
                              <input
                                type="checkbox"
                                id="changeScaleCheck"
                                checked={newActChangeScale}
                                onChange={e => setNewActChangeScale(e.target.checked)}
                                className="accent-emerald-500"
                              />
                              <label htmlFor="changeScaleCheck" className="text-neutral-300 text-[10px] cursor-pointer">Modify Character Scale</label>
                            </div>
                            {newActChangeScale && (
                              <div className="flex items-center gap-2 pl-4">
                                <span className="text-text-secondary text-[9px]">X/Y/Z</span>
                                <input
                                  type="number"
                                  step="0.1"
                                  value={newActCharScaleX}
                                  onChange={e => setNewActCharScaleX(Number(e.target.value))}
                                  className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-white outline-none w-14 font-mono"
                                />
                                <input
                                  type="number"
                                  step="0.1"
                                  value={newActCharScaleY}
                                  onChange={e => setNewActCharScaleY(Number(e.target.value))}
                                  className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-white outline-none w-14 font-mono"
                                />
                                <input
                                  type="number"
                                  step="0.1"
                                  value={newActCharScaleZ}
                                  onChange={e => setNewActCharScaleZ(Number(e.target.value))}
                                  className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-white outline-none w-14 font-mono"
                                />
                              </div>
                            )}

                            <div className="flex flex-col gap-1 mt-1 font-mono">
                              <span className="text-text-secondary text-[9px]">Morph Target Config (JSON)</span>
                              <input
                                type="text"
                                value={newActMorphTargets}
                                onChange={e => setNewActMorphTargets(e.target.value)}
                                className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-white outline-none text-[10px]"
                              />
                            </div>

                            <div className="flex items-center gap-2 mt-1">
                              <input
                                type="checkbox"
                                id="applyPostEffectCheck"
                                checked={newActApplyPostEffect}
                                onChange={e => setNewActApplyPostEffect(e.target.checked)}
                                className="accent-emerald-500"
                              />
                              <label htmlFor="applyPostEffectCheck" className="text-neutral-300 text-[10px] cursor-pointer">Apply Material Post Effect</label>
                            </div>
                            {newActApplyPostEffect && (
                              <div className="flex flex-col gap-1 pl-4">
                                <select
                                  value={newActPostEffectType}
                                  onChange={e => setNewActPostEffectType(e.target.value as any)}
                                  className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-white outline-none text-[10px]"
                                >
                                  <option value="electrical">⚡ Electrical Aura Effect</option>
                                  <option value="none">None</option>
                                </select>
                              </div>
                            )}

                            <div className="flex flex-col gap-1 mt-2">
                              <span className="text-text-secondary text-[9px] uppercase tracking-wider font-bold">Ultimate Duration (seconds)</span>
                              <input
                                type="number"
                                min="1"
                                max="300"
                                step="1"
                                value={newActUltimateDuration}
                                onChange={e => setNewActUltimateDuration(Number(e.target.value) || 20.0)}
                                className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1.5 text-white outline-none text-[10px] w-24 font-mono focus:border-emerald-500"
                              />
                            </div>
                          </>
                        )}

                        <div className="flex items-center gap-2 mt-1">
                          <input
                            type="checkbox"
                            id="playVfxCheck"
                            checked={newActPlayVFX}
                            onChange={e => setNewActPlayVFX(e.target.checked)}
                            className="accent-emerald-500"
                          />
                          <label htmlFor="playVfxCheck" className="text-neutral-300 text-[10px] cursor-pointer">Play Transition VFX Explosion</label>
                        </div>

                        {newActPlayVFX && (
                          <div className="flex flex-col gap-2 pl-4 border-l border-neutral-800 ml-1">
                            <div className="flex items-center gap-2 justify-between">
                              <span className="text-text-secondary text-[9px]">Effect Type</span>
                              <select
                                value={newActVfxType}
                                onChange={e => setNewActVfxType(e.target.value as any)}
                                className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-white outline-none text-[10px]"
                              >
                                <option value="fire">🔥 Fire Effect</option>
                                <option value="tornado">🌪️ Tornado Effect</option>
                                <option value="smoke">💨 Smoke Effect</option>
                                <option value="water">💧 Water Effect</option>
                                <option value="sparks">✨ Sparks Effect</option>
                              </select>
                            </div>

                            <div className="flex items-center gap-2 justify-between">
                              <span className="text-text-secondary text-[9px]">VFX Attachment Point</span>
                              <select
                                value={newActVfxAttachPoint}
                                onChange={e => setNewActVfxAttachPoint(e.target.value as any)}
                                className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-white outline-none text-[10px]"
                              >
                                <option value="center">Bounding Center</option>
                                <option value="head">Head / Top Level</option>
                                <option value="pivot">Pivot Origin (Feet)</option>
                                <option value="custom">Custom Coordinate Offsets</option>
                              </select>
                            </div>

                            {newActVfxAttachPoint === 'custom' && (
                              <div className="flex items-center gap-2 justify-between pl-4 font-mono">
                                <span className="text-text-secondary text-[9px]">Offsets X/Y/Z</span>
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="number"
                                    step="0.5"
                                    value={newActVfxOffsetX}
                                    onChange={e => setNewActVfxOffsetX(Number(e.target.value))}
                                    className="bg-neutral-900 border border-neutral-800 rounded px-1.5 py-0.5 text-white outline-none w-10 text-center text-[10px]"
                                  />
                                  <input
                                    type="number"
                                    step="0.5"
                                    value={newActVfxOffsetY}
                                    onChange={e => setNewActVfxOffsetY(Number(e.target.value))}
                                    className="bg-neutral-900 border border-neutral-800 rounded px-1.5 py-0.5 text-white outline-none w-10 text-center text-[10px]"
                                  />
                                  <input
                                    type="number"
                                    step="0.5"
                                    value={newActVfxOffsetZ}
                                    onChange={e => setNewActVfxOffsetZ(Number(e.target.value))}
                                    className="bg-neutral-900 border border-neutral-800 rounded px-1.5 py-0.5 text-white outline-none w-10 text-center text-[10px]"
                                  />
                                </div>
                              </div>
                            )}

                            <div className="flex items-center gap-2 justify-between">
                              <span className="text-text-secondary text-[9px]">VFX Color Hex</span>
                              <input
                                type="color"
                                value={newActVfxColor}
                                onChange={e => setNewActVfxColor(e.target.value)}
                                className="w-6 h-5 bg-transparent border-0 cursor-pointer"
                              />
                            </div>

                            <div className="flex items-center gap-2 justify-between">
                              <span className="text-text-secondary text-[9px]">VFX Duration</span>
                              <input
                                type="number"
                                step="0.5"
                                value={newActVfxDuration}
                                onChange={e => setNewActVfxDuration(Number(e.target.value))}
                                className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-white outline-none w-16 text-center font-mono"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {newActType === 'spawn_effect' && (
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-col gap-1">
                          <span className="text-text-secondary text-[9px]">Select Anchor Object Location</span>
                          <select
                            value={newActTargetObj}
                            onChange={e => setNewActTargetObj(e.target.value)}
                            className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1.5 text-white outline-none focus:border-emerald-500"
                          >
                            <option value="">-- Starter Player --</option>
                            {objects.map(o => (
                              <option key={o.id} value={o.id}>{o.name} ({o.id.substring(0, 6)})</option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-center gap-2 justify-between mt-1">
                          <span className="text-text-secondary text-[9px]">VFX Emitter Type</span>
                          <select
                            value={newActSpawnEffectType}
                            onChange={e => setNewActSpawnEffectType(e.target.value as any)}
                            className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-white outline-none text-[10px]"
                          >
                            <option value="fire">🔥 Fire Effect</option>
                            <option value="tornado">🌪️ Tornado Effect</option>
                            <option value="smoke">💨 Smoke Effect</option>
                            <option value="water">💧 Water Effect</option>
                            <option value="sparks">✨ Sparks Effect</option>
                          </select>
                        </div>

                        <div className="flex items-center gap-2 justify-between mt-1">
                          <span className="text-text-secondary text-[9px]">VFX Attachment Point</span>
                          <select
                            value={newActSpawnVfxAttachPoint}
                            onChange={e => setNewActSpawnVfxAttachPoint(e.target.value as any)}
                            className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-white outline-none text-[10px]"
                          >
                            <option value="pivot">Pivot Origin (Feet)</option>
                            <option value="center">Bounding Center</option>
                            <option value="head">Head / Top Level</option>
                            <option value="custom">Custom Coordinate Offsets</option>
                          </select>
                        </div>

                        {newActSpawnVfxAttachPoint === 'custom' && (
                          <div className="flex items-center gap-2 justify-between pl-4 font-mono">
                            <span className="text-text-secondary text-[9px]">Offsets X/Y/Z</span>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                step="0.5"
                                value={newActSpawnVfxOffsetX}
                                onChange={e => setNewActSpawnVfxOffsetX(Number(e.target.value))}
                                className="bg-neutral-900 border border-neutral-800 rounded px-1.5 py-0.5 text-white outline-none w-10 text-center text-[10px]"
                              />
                              <input
                                type="number"
                                step="0.5"
                                value={newActSpawnVfxOffsetY}
                                onChange={e => setNewActSpawnVfxOffsetY(Number(e.target.value))}
                                className="bg-neutral-900 border border-neutral-800 rounded px-1.5 py-0.5 text-white outline-none w-10 text-center text-[10px]"
                              />
                              <input
                                type="number"
                                step="0.5"
                                value={newActSpawnVfxOffsetZ}
                                onChange={e => setNewActSpawnVfxOffsetZ(Number(e.target.value))}
                                className="bg-neutral-900 border border-neutral-800 rounded px-1.5 py-0.5 text-white outline-none w-10 text-center text-[10px]"
                              />
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-2 justify-between">
                          <span className="text-text-secondary text-[9px]">Particle Color</span>
                          <input
                            type="color"
                            value={newActSpawnEffectColor}
                            onChange={e => setNewActSpawnEffectColor(e.target.value)}
                            className="w-6 h-5 bg-transparent border-0 cursor-pointer"
                          />
                        </div>

                        <div className="flex items-center gap-2 justify-between font-mono">
                          <span className="text-text-secondary text-[9px]">Particle Size</span>
                          <input
                            type="number"
                            step="0.05"
                            value={newActSpawnEffectSize}
                            onChange={e => setNewActSpawnEffectSize(Number(e.target.value))}
                            className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-white outline-none w-16 text-center"
                          />
                        </div>

                        <div className="flex items-center gap-2 justify-between font-mono">
                          <span className="text-text-secondary text-[9px]">Particle Speed</span>
                          <input
                            type="number"
                            step="0.1"
                            value={newActSpawnEffectSpeed}
                            onChange={e => setNewActSpawnEffectSpeed(Number(e.target.value))}
                            className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-white outline-none w-16 text-center"
                          />
                        </div>

                        <div className="flex items-center gap-2 justify-between font-mono">
                          <span className="text-text-secondary text-[9px]">Density Count</span>
                          <input
                            type="number"
                            step="100"
                            value={newActSpawnEffectCount}
                            onChange={e => setNewActSpawnEffectCount(Number(e.target.value))}
                            className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-white outline-none w-20 text-center"
                          />
                        </div>

                        <div className="flex items-center gap-2 justify-between font-mono">
                          <span className="text-text-secondary text-[9px]">VFX Lifetime (secs)</span>
                          <input
                            type="number"
                            step="0.5"
                            value={newActSpawnEffectLifetime}
                            onChange={e => setNewActSpawnEffectLifetime(Number(e.target.value))}
                            className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-white outline-none w-16 text-center"
                          />
                        </div>
                      </div>
                    )}

                    {newActType === 'apply_material_effect' && (
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-col gap-1">
                          <span className="text-text-secondary text-[9px]">Select Target Object</span>
                          <select
                            value={newActTargetObj}
                            onChange={e => setNewActTargetObj(e.target.value)}
                            className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1.5 text-white outline-none focus:border-emerald-500"
                          >
                            <option value="">-- Starter Player --</option>
                            {objects.map(o => (
                              <option key={o.id} value={o.id}>{o.name} ({o.id.substring(0, 6)})</option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-center gap-2 justify-between mt-1">
                          <span className="text-text-secondary text-[9px]">Overlay Effect Type</span>
                          <select
                            value={newActMatEffectType}
                            onChange={e => setNewActMatEffectType(e.target.value as any)}
                            className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-white outline-none text-[10px]"
                          >
                            <option value="electrical">⚡ Electrical Aura Effect</option>
                            <option value="none">None (Remove overlay)</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {newActType === 'adjust_ultimate' && (
                      <div className="flex flex-col gap-2 bg-neutral-900/40 p-2.5 rounded-lg border border-neutral-850">
                        <div className="flex items-center gap-2 justify-between">
                          <span className="text-text-secondary text-[9px] font-bold">Charge Adjustment Amount</span>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="-100"
                              max="100"
                              value={newActUltAdjustment}
                              onChange={e => setNewActUltAdjustment(Number(e.target.value))}
                              className="bg-neutral-900 border border-neutral-800 rounded px-2.5 py-1 text-white outline-none w-20 text-center font-mono text-[10px]"
                            />
                            <span className="text-[10px] text-text-secondary">%</span>
                          </div>
                        </div>
                        <div className="text-[9.5px] text-text-secondary/60 font-mono mt-1 font-semibold">
                          Use positive values (e.g. +25) to charge, or negative values (e.g. -50) to drain.
                        </div>
                      </div>
                    )}

                    <button
                      type="submit"
                      className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-4 py-2 rounded font-bold hover:bg-emerald-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-1"
                    >
                      <Plus size={12} /> Add Action to Chain
                    </button>
                  </form>

                  {/* Actions List */}
                  <div className="flex flex-col gap-2">
                    <span className="font-bold text-neutral-400 uppercase tracking-wider text-[9px]">Action Execution Chain ({selectedEvent.actions.length})</span>
                    {selectedEvent.actions.map((act, index) => (
                      <div
                        key={act.id}
                        className="flex items-center justify-between bg-neutral-900/40 border border-neutral-800 rounded p-3"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-5 h-5 rounded bg-neutral-850 border border-neutral-800 flex items-center justify-center text-emerald-400 font-mono font-bold text-[9px] shrink-0 mt-0.5">
                            {index + 1}
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <span className="font-bold text-white text-[12px] uppercase tracking-wide text-emerald-400">{act.type.replace('_', ' ')}</span>
                            <span className="text-text-secondary mt-0.5">
                              {act.type === 'dialogue' && (
                                <span className="italic">Speech: "{act.params.text}"</span>
                              )}
                              {act.type === 'spawn_prefab' && (
                                <span>Spawn <strong className="text-white font-mono">{act.params.prefabName}</strong> at coordinate <strong className="text-white font-mono">{JSON.stringify(act.params.position)}</strong></span>
                              )}
                              {act.type === 'set_variable' && (
                                <span>Set global variable <strong className="text-white font-mono">{act.params.key}</strong> = <strong className="text-emerald-300 font-mono">{String(act.params.value)}</strong></span>
                              )}
                              {act.type === 'toggle_visibility' && (
                                <span>Set visibility of <strong className="text-white font-mono">{act.params.targetId}</strong> to <strong className="text-emerald-300 font-mono">{act.params.visible ? 'VISIBLE' : 'HIDDEN'}</strong></span>
                              )}
                              {act.type === 'play_sound' && (
                                <span>Play sound effect <strong className="text-white font-mono">{act.params.audioUrl}</strong></span>
                              )}
                              {act.type === 'wait_delay' && (
                                <span>Wait for <strong className="text-emerald-300 font-mono">{act.params.duration}</strong> seconds before running next action</span>
                              )}
                              {act.type === 'transform_character' && (
                                <span>
                                  Morph character <strong className="text-white font-mono">{act.params.characterId || 'Player'}</strong> into <strong className="text-emerald-300 font-mono">{act.params.targetForm.toUpperCase()}</strong> form
                                  {act.params.targetForm === 'ultimate' ? (
                                    <> (VFX: <strong className="text-white font-mono">{act.params.vfxType || 'none'}</strong>, Duration: <strong className="text-emerald-300 font-mono">{act.params.ultimateDuration || 20}s</strong>)</>
                                  ) : (
                                    <> (Revert to Base)</>
                                  )}
                                </span>
                              )}
                              {act.type === 'spawn_effect' && (
                                <span>Spawn particle emitter <strong className="text-white font-mono">{act.params.effectType}</strong> at <strong className="text-white font-mono">{act.params.targetId || 'Player'}</strong> (Lifetime: <strong className="text-emerald-300 font-mono">{act.params.lifetime}s</strong>)</span>
                              )}
                              {act.type === 'apply_material_effect' && (
                                <span>Apply material overlay <strong className="text-white font-mono">{act.params.effectType}</strong> on <strong className="text-white font-mono">{act.params.targetId || 'Player'}</strong></span>
                              )}
                              {act.type === 'adjust_ultimate' && (
                                <span>Adjust player ultimate charge by <strong className={`font-mono ${act.params.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{act.params.amount >= 0 ? `+${act.params.amount}` : act.params.amount}%</strong></span>
                              )}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveAction(act.id)}
                          className="text-text-secondary hover:text-red-400 p-1.5 rounded"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-text-secondary gap-2">
                  <Zap size={24} className="opacity-30" />
                  <span>Select or create a scripted event to chain gameplay actions.</span>
                </div>
              )}
            </div>
          </>
        )}

        {/* VARIABLES VIEW */}
        {activeTab === 'variables' && (
          <div className="flex-1 flex flex-col overflow-y-auto bg-[#0d0d12] p-4">
            <div className="flex flex-col gap-4 max-w-[650px]">
              {/* Explainer / Preset Header */}
              <div className="bg-[#12121a] border border-neutral-800/80 rounded-lg p-3.5 flex flex-col gap-2 shadow-sm">
                <div className="flex items-start gap-2.5">
                  <Sparkles className="text-emerald-400 w-4 h-4 shrink-0 mt-0.5" />
                  <div className="flex flex-col gap-0.5">
                    <span className="font-bold text-white tracking-wide">What are Global Variables?</span>
                    <span className="text-text-secondary leading-relaxed text-[10px]">
                      Global Variables store states that govern your game's progress. Use them to gate dialogues, trigger custom scripts, and track quest requirements. You can toggle or edit values inline in the table below to test your game state in real-time!
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-neutral-800/50 flex-wrap">
                  <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Quick Presets:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setGameVariable('hasKey', false);
                      toast.success('Preset Added', 'Created boolean switch "hasKey".');
                    }}
                    className="bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 px-2.5 py-1 rounded text-neutral-300 transition-all cursor-pointer text-[10px]"
                  >
                    + Switch (hasKey)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setGameVariable('coinsCollected', 0);
                      toast.success('Preset Added', 'Created counter "coinsCollected".');
                    }}
                    className="bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 px-2.5 py-1 rounded text-neutral-300 transition-all cursor-pointer text-[10px]"
                  >
                    + Counter (coinsCollected)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setGameVariable('activeStage', 'prologue');
                      toast.success('Preset Added', 'Created text state "activeStage".');
                    }}
                    className="bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 px-2.5 py-1 rounded text-neutral-300 transition-all cursor-pointer text-[10px]"
                  >
                    + State Text (activeStage)
                  </button>
                </div>
              </div>

              {/* Var Form */}
              <form onSubmit={handleAddVariable} className="bg-neutral-900/30 border border-neutral-800 rounded p-3 flex items-end gap-3">
                <div className="flex-1 flex flex-col gap-1">
                  <span className="text-text-secondary text-[9px]">Variable Key</span>
                  <input
                    type="text"
                    placeholder="e.g. bossDefeated, crystalsCollected..."
                    value={newVarKey}
                    onChange={e => setNewVarKey(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                    className="bg-neutral-900 border border-neutral-800 rounded px-2.5 py-1.5 text-white outline-none focus:border-emerald-500 font-mono w-full"
                    required
                  />
                </div>

                <div className="w-28 flex flex-col gap-1">
                  <span className="text-text-secondary text-[9px]">Type</span>
                  <select
                    value={newVarType}
                    onChange={e => {
                      const type = e.target.value as any;
                      setNewVarType(type);
                      if (type === 'boolean') setNewVarVal('true');
                      else if (type === 'number') setNewVarVal('0');
                      else setNewVarVal('');
                    }}
                    className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1.5 text-white outline-none focus:border-emerald-500"
                  >
                    <option value="boolean">Boolean (True/False)</option>
                    <option value="number">Number (Counter)</option>
                    <option value="string">String (Text)</option>
                  </select>
                </div>

                <div className="flex-1 flex flex-col gap-1">
                  <span className="text-text-secondary text-[9px]">Initial Value</span>
                  {newVarType === 'boolean' ? (
                    <select
                      value={newVarVal}
                      onChange={e => setNewVarVal(e.target.value)}
                      className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1.5 text-white outline-none focus:border-emerald-500 w-full"
                    >
                      <option value="true">True (ON)</option>
                      <option value="false">False (OFF)</option>
                    </select>
                  ) : newVarType === 'number' ? (
                    <input
                      type="number"
                      placeholder="0"
                      value={newVarVal}
                      onChange={e => setNewVarVal(e.target.value)}
                      className="bg-neutral-900 border border-neutral-800 rounded px-2.5 py-1.5 text-white outline-none focus:border-emerald-500 font-mono w-full"
                    />
                  ) : (
                    <input
                      type="text"
                      placeholder="e.g. warrior, intro_cutscene..."
                      value={newVarVal}
                      onChange={e => setNewVarVal(e.target.value)}
                      className="bg-neutral-900 border border-neutral-800 rounded px-2.5 py-1.5 text-white outline-none focus:border-emerald-500 font-mono w-full"
                    />
                  )}
                </div>

                <button
                  type="submit"
                  className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-4 py-1.5 rounded font-bold hover:bg-emerald-500/20 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Plus size={12} /> Add Variable
                </button>
              </form>

              {/* Variables Table */}
              <div className="flex flex-col border border-neutral-800 rounded overflow-hidden">
                <div className="grid grid-cols-[1.5fr_1fr_1.5fr_50px] bg-neutral-900 px-3 py-2 border-b border-neutral-800 font-bold uppercase tracking-wider text-[9px] text-neutral-400">
                  <span>Variable Key</span>
                  <span>Data Type</span>
                  <span>Interactive Value (Click/Edit)</span>
                  <span className="text-center">Action</span>
                </div>
                {Object.entries(gameVariables).length > 0 ? (
                  Object.entries(gameVariables).map(([key, val]) => (
                    <div
                      key={key}
                      className="grid grid-cols-[1.5fr_1fr_1.5fr_50px] px-3 py-2.5 border-b border-neutral-850 hover:bg-neutral-900/20 items-center"
                    >
                      <span className="font-mono text-white font-bold">{key}</span>
                      <span className="text-[10px] text-neutral-400 italic">
                        {typeof val === 'boolean' ? 'boolean (switch)' : typeof val === 'number' ? 'number (counter)' : 'string (text)'}
                      </span>
                      <div>
                        {typeof val === 'boolean' ? (
                          <button
                            onClick={() => {
                              setGameVariable(key, !val);
                              toast.success('State Toggled', `"${key}" set to ${!val}`);
                            }}
                            className={`px-3 py-1 rounded font-bold text-[9px] tracking-wide transition-all border cursor-pointer ${
                              val
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/20'
                                : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:bg-neutral-700'
                            }`}
                            title="Click to toggle variable state"
                          >
                            {val ? 'TRUE (ON)' : 'FALSE (OFF)'}
                          </button>
                        ) : typeof val === 'number' ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              value={val}
                              onChange={(e) => setGameVariable(key, Number(e.target.value))}
                              className="bg-neutral-900 border border-neutral-800 rounded px-2 py-0.5 text-white outline-none w-20 text-center font-mono focus:border-emerald-500"
                              title="Modify counter value"
                            />
                          </div>
                        ) : (
                          <input
                            type="text"
                            value={String(val)}
                            onChange={(e) => setGameVariable(key, e.target.value)}
                            className="bg-neutral-900 border border-neutral-800 rounded px-2 py-0.5 text-white outline-none w-full max-w-[200px] font-mono focus:border-emerald-500 text-[10px]"
                            title="Edit text state"
                          />
                        )}
                      </div>
                      <button
                        onClick={() => deleteGameVariable(key)}
                        className="text-text-secondary hover:text-red-400 flex justify-center p-1 rounded"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-text-secondary">
                    No global variables defined. Create variables or click a Quick Preset to manage game state branches.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
