import React from 'react';
import { createPortal } from 'react-dom';
import {
  Undo2,
  Redo2,
  Download,
  Box,
  Bone,
  Circle,
  Copy,
  FilePlus,
  FolderMinus,
  FolderOpen,
  FolderPlus,
  Lightbulb,
  Magnet,
  Move,
  MousePointer,
  Play,
  Pause,
  RotateCcw,
  Save,
  SaveAll,
  Scaling,
  Square,
  Trash2,
  Combine,
  Settings,
  Scissors,
  Crop,
  ChevronDown,
  Orbit,
  Grid,
  Layers,
  Cylinder,
  Triangle,
  Star,
  Moon,
  Sparkles,
  Flame,
  Wind,
  Droplets,
  Zap,
  Brush,
  Mountain,
  Code2,
  Film,
  DoorOpen,
  Type,
  BoxSelect,
  LayoutTemplate,
  Boxes,
} from 'lucide-react';
import { useStore as useZustandStore } from 'zustand';
import { useStore } from '../store/useStore';

function TopBar() {
  const {
    transformMode,
    setTransformMode,
    addPrimitive,
    deleteObject,
    duplicateObject,
    selectedIds,
    groupSelected,
    ungroupSelected,
    snapGrid,
    toggleSnapGrid,
    clearScene,
    startNewScene,
    saveProject,
    saveProjectAs,
    loadProject,
    setProjectName,
    isPlaying,
    togglePlay,
    stopPlay,
    isPaused,
    togglePause,
    showGrid,
    toggleGrid,
    snapValue,
    setSnapValue,
    rotationSnapAngle,
    setRotationSnapAngle,
    showOverlays,
    toggleOverlays,
    wireframeMode,
    toggleWireframeMode,
    showPhysicsDebug,
    togglePhysicsDebug,
    activeTool,
    setActiveTool,
    undo,
    redo,
    snapSelectedToGround,
    addScript,
    objects,
    workspaceMode,
    setWorkspaceMode,
    animationTargetId,
    setAnimationTargetId,
    assistantPanelVisible,
    toggleAssistantPanel,
  } = useStore();

  const { pastStates, futureStates } = useZustandStore(useStore.temporal);


  const [isProjectMenuOpen, setIsProjectMenuOpen] = React.useState(false);
  const [isInsertMenuOpen, setIsInsertMenuOpen] = React.useState(false);
  const [isEffectsMenuOpen, setIsEffectsMenuOpen] = React.useState(false);
  const [isAnimationMenuOpen, setIsAnimationMenuOpen] = React.useState(false);
  const [isSnapMenuOpen, setIsSnapMenuOpen] = React.useState(false);
  const [isRotSnapMenuOpen, setIsRotSnapMenuOpen] = React.useState(false);

  // Accordion toggle states for Insert menu
  const [isPrimitivesExpanded, setIsPrimitivesExpanded] = React.useState(true);
  const [isAdvancedExpanded, setIsAdvancedExpanded] = React.useState(true);
  const [isUtilitiesExpanded, setIsUtilitiesExpanded] = React.useState(false);

  const handleLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Extract project name from filename (strip extension)
    const fileName = file.name.replace(/\.(stellar|json)$/i, '');
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        loadProject(content);
        setProjectName(fileName);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExport = () => {
    window.dispatchEvent(new CustomEvent('export_gltf'));
  };

  const isSelectionDisabled = selectedIds.length === 0 || selectedIds.includes('world_settings');
  const isMultiSelectionDisabled = selectedIds.length <= 1 || selectedIds.includes('world_settings');
  const selectedId = selectedIds[0] || null;
  const selectedObj = selectedId ? objects.find((o) => o.id === selectedId) : null;
  const isCharacterSelected = !!(selectedObj && (selectedObj.type === 'gltf' || (selectedObj.type as string) === 'fbx'));

  return (
    <div
      role="toolbar"
      aria-label="Top Toolbar"
      className="h-14 bg-neutral-950/95 border-b border-neutral-800/80 flex items-center px-4 justify-between z-50 select-none backdrop-blur-md"
    >
      {/* LEFT SECTION: App Brand & History & File Menu */}
      <div className="flex gap-6 items-center">
        <div className="font-extrabold text-[11px] tracking-widest text-sky-400 flex items-center gap-1.5 hidden md:flex uppercase">
          Stellar Engine <span className="text-neutral-500 font-medium text-[10px]">v4.2</span>
        </div>

        <div className="flex gap-1 items-center bg-neutral-900/60 p-0.5 border border-neutral-800/50 rounded-lg text-neutral-400">
          {/* File Project Menu Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsProjectMenuOpen(!isProjectMenuOpen)}
              className={`px-2.5 py-1.5 hover:bg-neutral-800 hover:text-white rounded-md transition-colors flex items-center gap-1.5 text-xs font-medium cursor-pointer ${isProjectMenuOpen ? 'text-sky-400 bg-neutral-800/80 shadow-sm' : ''}`}
            >
              <Orbit size={14} className={isProjectMenuOpen ? 'text-sky-400 animate-pulse' : 'text-neutral-400'} />
              <span>File</span>
              <ChevronDown size={12} className={`transition-transform duration-200 ${isProjectMenuOpen ? 'rotate-180 text-sky-400' : 'text-neutral-500'}`} />
            </button>

            {isProjectMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsProjectMenuOpen(false)} />
                <div className="absolute top-full left-0 mt-2 w-48 bg-neutral-950 border border-neutral-800 rounded-lg shadow-2xl py-1 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                  <button
                    onClick={() => { startNewScene(); setIsProjectMenuOpen(false); }}
                    className="w-full text-left px-3 py-2 hover:bg-neutral-900 flex items-center gap-2.5 transition-colors text-neutral-300 hover:text-white text-xs font-medium"
                  >
                    <FilePlus size={14} className="text-neutral-500" /> New Scene
                  </button>
                  <button
                    onClick={() => { saveProject(); setIsProjectMenuOpen(false); }}
                    className="w-full text-left px-3 py-2 hover:bg-neutral-900 flex items-center gap-2.5 transition-colors text-neutral-300 hover:text-white text-xs font-medium"
                  >
                    <Save size={14} className="text-neutral-500" /> Save Project
                  </button>
                  <button
                    onClick={() => { saveProjectAs(); setIsProjectMenuOpen(false); }}
                    className="w-full text-left px-3 py-2 hover:bg-neutral-900 flex items-center gap-2.5 transition-colors text-neutral-300 hover:text-white text-xs font-medium"
                  >
                    <SaveAll size={14} className="text-neutral-500" /> Save Project As...
                  </button>
                  <label className="w-full text-left px-3 py-2 hover:bg-neutral-900 flex items-center gap-2.5 transition-colors text-neutral-300 hover:text-white text-xs font-medium cursor-pointer">
                    <FolderOpen size={14} className="text-neutral-500" /> Load Project
                    <input
                      type="file"
                      accept=".stellar,.json"
                      className="hidden"
                      onChange={(e) => { handleLoad(e); setIsProjectMenuOpen(false); }}
                    />
                  </label>
                  <div className="border-t border-neutral-800/60 my-1" />
                  <button
                    onClick={() => { handleExport(); setIsProjectMenuOpen(false); }}
                    className="w-full text-left px-3 py-2 hover:bg-neutral-900 flex items-center gap-2.5 transition-colors text-neutral-300 hover:text-white text-xs font-medium"
                  >
                    <Download size={14} className="text-sky-400" /> Export GLTF
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="h-4 w-px bg-neutral-800/60 mx-1" />

          {/* History Actions */}
          <button
            onClick={() => undo()}
            disabled={pastStates.length === 0}
            className={`p-1.5 rounded-md transition-colors ${pastStates.length === 0 ? 'opacity-20 cursor-not-allowed' : 'hover:bg-neutral-800 hover:text-white cursor-pointer'}`}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 size={14} />
          </button>
          <button
            onClick={() => redo()}
            disabled={futureStates.length === 0}
            className={`p-1.5 rounded-md transition-colors ${futureStates.length === 0 ? 'opacity-20 cursor-not-allowed' : 'hover:bg-neutral-800 hover:text-white cursor-pointer'}`}
            title="Redo (Ctrl+Y)"
          >
            <Redo2 size={14} />
          </button>
        </div>

        {/* Workspace Mode Switcher */}
        <div className="flex bg-[#12121a]/85 border border-neutral-800/60 rounded-lg p-0.5 shadow-inner backdrop-blur-sm ml-2">
          {[
            { id: 'level', label: 'LEVEL DESIGN', icon: Grid, activeColor: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
            { id: 'script', label: 'SCRIPTING', icon: Code2, activeColor: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' },
            { id: 'animation', label: 'ANIMATION', icon: Film, activeColor: 'text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/20' },
            { id: 'logic', label: 'GAMEPLAY & QUESTS', icon: Sparkles, activeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' }
          ].map((mode) => {
            const isActive = workspaceMode === mode.id;
            const Icon = mode.icon;
            
            let isDisabled = isPlaying;
            let title = `Switch to ${mode.label} Workspace`;
            if (isPlaying) {
              title = 'Cannot switch workspace while simulating physics';
            } else if (mode.id === 'animation' && !isCharacterSelected && workspaceMode !== 'animation') {
              title = 'Open Animation Suite (Select a character to load bone tree)';
            }

            return (
              <button
                key={mode.id}
                onClick={() => setWorkspaceMode(mode.id as any)}
                disabled={isDisabled}
                className={`flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold tracking-wide rounded-md transition-all duration-200 cursor-pointer ${
                  isActive
                    ? `${mode.activeColor} border shadow-sm`
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/30 border border-transparent disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-neutral-400'
                }`}
                title={title}
              >
                <Icon size={12} className={isActive ? '' : 'text-neutral-500'} />
                <span className="hidden sm:inline">{mode.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* MIDDLE SECTION: Dynamic Unified Collapsible Insert Menu, Particle Effects Dropdown & Tracks */}
      <div className="flex gap-2 items-center">
        {/* Dropdown Categorized Object Creator */}
        <div className="relative">
          <button
            onClick={() => { setIsInsertMenuOpen(!isInsertMenuOpen); setIsEffectsMenuOpen(false); }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-150 shadow-sm cursor-pointer ${
              isInsertMenuOpen
                ? 'bg-neutral-900 text-white border-neutral-700 ring-1 ring-neutral-700'
                : 'bg-neutral-900/40 text-neutral-200 border-neutral-800 hover:bg-neutral-900/80 hover:border-neutral-700'
            }`}
          >
            <Box size={14} className="text-sky-400" />
            <span>Insert</span>
            <ChevronDown size={12} className={`text-neutral-400 transition-transform duration-200 ${isInsertMenuOpen ? 'rotate-180 text-sky-400' : ''}`} />
          </button>

          {isInsertMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsInsertMenuOpen(false)} />
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-56 rounded-lg bg-neutral-950 border border-neutral-800 shadow-2xl p-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-100 max-h-[85vh] flex flex-col gap-1">
                
                {/* Accordion 1: Standard 3D Primitives */}
                <div>
                  <button
                    onClick={() => setIsPrimitivesExpanded(!isPrimitivesExpanded)}
                    className="w-full flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-neutral-900/60 transition-colors text-left group cursor-pointer"
                  >
                    <span className="text-[9px] font-bold tracking-wider text-neutral-500 uppercase group-hover:text-neutral-400">3D Primitives</span>
                    <ChevronDown size={12} className={`text-neutral-600 transition-transform duration-200 ${isPrimitivesExpanded ? '' : '-rotate-90'}`} />
                  </button>

                  <div className={`space-y-0.5 mt-0.5 transition-all duration-200 pr-1 custom-scrollbar ${isPrimitivesExpanded ? 'max-h-64 opacity-100 overflow-y-auto' : 'max-h-0 opacity-0 overflow-hidden pointer-events-none'}`}>
                    <button
                      onClick={() => { addPrimitive('box'); setIsInsertMenuOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs text-neutral-300 hover:bg-neutral-900 hover:text-white transition-colors group text-left"
                    >
                      <Box size={14} className="text-neutral-400 group-hover:text-sky-400 transition-colors" />
                      <span>Cube</span>
                    </button>
                    <button
                      onClick={() => { addPrimitive('sphere'); setIsInsertMenuOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs text-neutral-300 hover:bg-neutral-900 hover:text-white transition-colors group text-left"
                    >
                      <Circle size={14} className="text-neutral-400 group-hover:text-sky-400 transition-colors" />
                      <span>Sphere</span>
                    </button>
                    <button
                      onClick={() => { addPrimitive('cylinder'); setIsInsertMenuOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs text-neutral-300 hover:bg-neutral-900 hover:text-white transition-colors group text-left"
                    >
                      <Cylinder size={14} className="text-neutral-400 group-hover:text-sky-400 transition-colors" />
                      <span>Cylinder</span>
                    </button>
                    <button
                      onClick={() => { addPrimitive('plane'); setIsInsertMenuOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs text-neutral-300 hover:bg-neutral-900 hover:text-white transition-colors group text-left"
                    >
                      <Square size={14} className="text-neutral-400 group-hover:text-sky-400 transition-colors" />
                      <span>Plane</span>
                    </button>
                    <button
                      onClick={() => { addPrimitive('groundPlane'); setIsInsertMenuOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs text-neutral-300 hover:bg-neutral-900 hover:text-white transition-colors group text-left"
                    >
                      <LayoutTemplate size={14} className="text-neutral-400 group-hover:text-sky-400 transition-colors" />
                      <span>Ground Plane</span>
                    </button>
                    <button
                      onClick={() => { addPrimitive('wall'); setIsInsertMenuOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs text-neutral-300 hover:bg-neutral-900 hover:text-white transition-colors group text-left"
                    >
                      <Grid size={14} className="text-neutral-400 group-hover:text-sky-400 transition-colors" />
                      <span>Wall</span>
                    </button>
                    <button
                      onClick={() => { addPrimitive('floor'); setIsInsertMenuOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs text-neutral-300 hover:bg-neutral-900 hover:text-white transition-colors group text-left"
                    >
                      <Layers size={14} className="text-neutral-400 group-hover:text-sky-400 transition-colors" />
                      <span>Floor</span>
                    </button>
                    <button
                      onClick={() => { addPrimitive('ceiling'); setIsInsertMenuOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs text-neutral-300 hover:bg-neutral-900 hover:text-white transition-colors group text-left"
                    >
                      <Layers size={14} className="text-neutral-400 group-hover:text-sky-400 transition-colors" style={{ transform: 'rotate(180deg)' }} />
                      <span>Ceiling</span>
                    </button>
                    <button
                      onClick={() => { addPrimitive('pyramid'); setIsInsertMenuOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs text-neutral-300 hover:bg-neutral-900 hover:text-white transition-colors group text-left"
                    >
                      <Triangle size={14} className="text-neutral-400 group-hover:text-sky-400 transition-colors" />
                      <span>Pyramid</span>
                    </button>
                    <button
                      onClick={() => { addPrimitive('cone'); setIsInsertMenuOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs text-neutral-300 hover:bg-neutral-900 hover:text-white transition-colors group text-left"
                    >
                      <Triangle size={14} className="text-neutral-400 group-hover:text-sky-400 transition-colors rotate-180" />
                      <span>Cone</span>
                    </button>
                    <button
                      onClick={() => { addPrimitive('roundedCube'); setIsInsertMenuOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs text-neutral-300 hover:bg-neutral-900 hover:text-white transition-colors group text-left"
                    >
                      <Box size={14} className="text-neutral-400 group-hover:text-sky-400 transition-colors" />
                      <span>Rounded Block</span>
                    </button>
                    <button
                      onClick={() => { addPrimitive('torus'); setIsInsertMenuOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs text-neutral-300 hover:bg-neutral-900 hover:text-white transition-colors group text-left"
                    >
                      <div className="w-3.5 h-3.5 border-2 border-neutral-400 rounded-full group-hover:border-sky-400 transition-colors flex items-center justify-center"><div className="w-1 h-1 border border-neutral-400 group-hover:border-sky-400 rounded-full" /></div>
                      <span>Torus</span>
                    </button>
                    <button
                      onClick={() => { addPrimitive('frame'); setIsInsertMenuOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs text-neutral-300 hover:bg-neutral-900 hover:text-white transition-colors group text-left"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-neutral-400 group-hover:text-sky-400 transition-colors">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <rect x="8" y="8" width="8" height="8" rx="1" />
                      </svg>
                      <span>Frame (Vertical)</span>
                    </button>
                    <button
                      onClick={() => { addPrimitive('horizontalFrame'); setIsInsertMenuOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs text-neutral-300 hover:bg-neutral-900 hover:text-white transition-colors group text-left"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-neutral-400 group-hover:text-sky-400 transition-colors rotate-90">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <rect x="8" y="8" width="8" height="8" rx="1" />
                      </svg>
                      <span>Frame (Horizontal)</span>
                    </button>
                  </div>
                </div>

                <div className="border-t border-neutral-900/60 my-0.5" />

                {/* Accordion 2: Advanced Generator Shapes */}
                <div>
                  <button
                    onClick={() => setIsAdvancedExpanded(!isAdvancedExpanded)}
                    className="w-full flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-neutral-900/60 transition-colors text-left group cursor-pointer"
                  >
                    <span className="text-[9px] font-bold tracking-wider text-neutral-500 uppercase group-hover:text-neutral-400">AI Advanced Shapes</span>
                    <ChevronDown size={12} className={`text-neutral-600 transition-transform duration-200 ${isAdvancedExpanded ? '' : '-rotate-90'}`} />
                  </button>

                  <div className={`space-y-0.5 mt-0.5 transition-all duration-200 pr-1 custom-scrollbar ${isAdvancedExpanded ? 'max-h-80 opacity-100 overflow-y-auto' : 'max-h-0 opacity-0 overflow-hidden pointer-events-none'}`}>
                    <button
                      onClick={() => { addPrimitive('teardrop'); setIsInsertMenuOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs text-neutral-300 hover:bg-neutral-900 hover:text-white transition-colors group text-left"
                    >
                      <Droplets size={14} className="text-neutral-400 group-hover:text-sky-400 transition-colors" />
                      <span>Teardrop / Egg</span>
                    </button>
                    <button
                      onClick={() => { addPrimitive('wingBlade'); setIsInsertMenuOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs text-neutral-300 hover:bg-neutral-900 hover:text-white transition-colors group text-left"
                    >
                      <Wind size={14} className="text-neutral-400 group-hover:text-sky-400 transition-colors" />
                      <span>Wing Blade / Fin</span>
                    </button>
                    <button
                      onClick={() => { addPrimitive('curvedHorn'); setIsInsertMenuOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs text-neutral-300 hover:bg-neutral-900 hover:text-white transition-colors group text-left"
                    >
                      <Flame size={14} className="text-neutral-400 group-hover:text-sky-400 transition-colors" />
                      <span>Curved Horn / Claw</span>
                    </button>
                    <button
                      onClick={() => { addPrimitive('taperedTorso'); setIsInsertMenuOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs text-neutral-300 hover:bg-neutral-900 hover:text-white transition-colors group text-left"
                    >
                      <Bone size={14} className="text-neutral-400 group-hover:text-sky-400 transition-colors" />
                      <span>Tapered Torso</span>
                    </button>
                    <button
                      onClick={() => { addPrimitive('forearm'); setIsInsertMenuOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs text-neutral-300 hover:bg-neutral-900 hover:text-white transition-colors group text-left"
                    >
                      <Bone size={14} className="text-neutral-400 group-hover:text-sky-400 transition-colors rotate-90" />
                      <span>Forearm / Leg Limb</span>
                    </button>
                    <button
                      onClick={() => { addPrimitive('halfSphere'); setIsInsertMenuOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs text-neutral-300 hover:bg-neutral-900 hover:text-white transition-colors group text-left"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-neutral-400 group-hover:text-sky-400 transition-colors">
                        <path d="M2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12H2Z" />
                        <ellipse cx="12" cy="12" rx="10" ry="3" />
                      </svg>
                      <span>Half Sphere</span>
                    </button>
                    <button
                      onClick={() => { addPrimitive('star'); setIsInsertMenuOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs text-neutral-300 hover:bg-neutral-900 hover:text-white transition-colors group text-left"
                    >
                      <Star size={14} className="text-neutral-400 group-hover:text-sky-400 transition-colors" />
                      <span>Star</span>
                    </button>
                    <button
                      onClick={() => { addPrimitive('crescentMoon'); setIsInsertMenuOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs text-neutral-300 hover:bg-neutral-900 hover:text-white transition-colors group text-left"
                    >
                      <Moon size={14} className="text-neutral-400 group-hover:text-sky-400 transition-colors" />
                      <span>Crescent Moon</span>
                    </button>
                    <button
                      onClick={() => { addPrimitive('wedge'); setIsInsertMenuOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs text-neutral-300 hover:bg-neutral-900 hover:text-white transition-colors group text-left"
                    >
                      <Triangle size={14} className="text-neutral-400 group-hover:text-sky-400 transition-colors rotate-90" />
                      <span>Wedge</span>
                    </button>
                    <button
                      onClick={() => { addPrimitive('doorway'); setIsInsertMenuOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs text-neutral-300 hover:bg-neutral-900 hover:text-white transition-colors group text-left"
                    >
                      <DoorOpen size={14} className="text-neutral-400 group-hover:text-sky-400 transition-colors" />
                      <span>Doorway Cutout</span>
                    </button>
                  </div>
                </div>

                <div className="border-t border-neutral-900/60 my-0.5" />

                {/* Accordion 3: Utilities & Infrastructure */}
                <div>
                  <button
                    onClick={() => setIsUtilitiesExpanded(!isUtilitiesExpanded)}
                    className="w-full flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-neutral-900/60 transition-colors text-left group cursor-pointer"
                  >
                    <span className="text-[9px] font-bold tracking-wider text-neutral-500 uppercase group-hover:text-neutral-400">Utilities & Lights</span>
                    <ChevronDown size={12} className={`text-neutral-600 transition-transform duration-200 ${isUtilitiesExpanded ? '' : '-rotate-90'}`} />
                  </button>

                  <div className={`space-y-0.5 mt-0.5 transition-all duration-200 pr-1 custom-scrollbar ${isUtilitiesExpanded ? 'max-h-32 opacity-100 overflow-y-auto' : 'max-h-0 opacity-0 overflow-hidden pointer-events-none'}`}>
                    <button
                      onClick={() => { addPrimitive('light'); setIsInsertMenuOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs text-neutral-300 hover:bg-neutral-900 hover:text-white transition-colors group text-left"
                    >
                      <Lightbulb size={14} className="text-neutral-400 group-hover:text-yellow-400 transition-colors" />
                      <span>Light Source</span>
                    </button>
                    <button
                      onClick={() => { addPrimitive('group'); setIsInsertMenuOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs text-neutral-300 hover:bg-neutral-900 hover:text-white transition-colors group text-left"
                    >
                      <FolderPlus size={14} className="text-neutral-400 group-hover:text-amber-400 transition-colors" />
                      <span>Empty Group</span>
                    </button>
                    <button
                      onClick={() => { addPrimitive('motor6d'); setIsInsertMenuOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs text-neutral-300 hover:bg-neutral-900 hover:text-white transition-colors group text-left"
                    >
                      <Bone size={14} className="text-neutral-400 group-hover:text-cyan-400 transition-colors" />
                      <span>Motor6D Rig Joint</span>
                    </button>
                    <button
                      onClick={() => { addScript(); setIsInsertMenuOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs text-neutral-300 hover:bg-neutral-900 hover:text-white transition-colors group text-left"
                    >
                      <Code2 size={14} className="text-neutral-400 group-hover:text-yellow-400 transition-colors" />
                      <span>Script</span>
                    </button>
                  </div>
                </div>

              </div>
            </>
          )}
        </div>

        {/* RECONFIGURED: Effects Tab Dropdown â€” Spawning Particle FX Emitters */}
        <div className="relative">
          <button
            onClick={() => { setIsEffectsMenuOpen(!isEffectsMenuOpen); setIsInsertMenuOpen(false); }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-150 shadow-sm cursor-pointer ${
              isEffectsMenuOpen
                ? 'bg-neutral-900 text-white border-neutral-700 ring-1 ring-neutral-700'
                : 'bg-neutral-900/40 text-neutral-200 border-neutral-800 hover:bg-neutral-900/80 hover:border-neutral-700'
            }`}
          >
            <Sparkles size={14} className="text-fuchsia-400" />
            <span>Effects</span>
            <ChevronDown size={12} className={`text-neutral-400 transition-transform duration-200 ${isEffectsMenuOpen ? 'rotate-180 text-fuchsia-400' : ''}`} />
          </button>

          {isEffectsMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsEffectsMenuOpen(false)} />
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-52 rounded-lg bg-neutral-950 border border-neutral-800 shadow-2xl p-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-100 flex flex-col gap-1">
                
                <div className="px-2 py-1 text-[9px] font-bold tracking-wider text-neutral-500 uppercase">Particle Emitters</div>
                
                <div className="space-y-0.5 mt-0.5">
                  <button
                    onClick={() => { addPrimitive('fire'); setIsEffectsMenuOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs text-neutral-300 hover:bg-neutral-900 hover:text-white transition-colors group text-left"
                  >
                    <Flame size={14} className="text-neutral-400 group-hover:text-orange-500 transition-colors animate-pulse" />
                    <span>Fire Effect</span>
                  </button>

                  <button
                    onClick={() => { addPrimitive('tornado'); setIsEffectsMenuOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs text-neutral-300 hover:bg-neutral-900 hover:text-white transition-colors group text-left"
                  >
                    <Wind size={14} className="text-neutral-400 group-hover:text-sky-400 transition-colors animate-spin" style={{ animationDuration: '3s' }} />
                    <span>Tornado Effect</span>
                  </button>

                  <button
                    onClick={() => { addPrimitive('smoke'); setIsEffectsMenuOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs text-neutral-300 hover:bg-neutral-900 hover:text-white transition-colors group text-left"
                  >
                    <Wind size={14} className="text-neutral-400 group-hover:text-neutral-400 transition-colors" />
                    <span>Smoke / Steam</span>
                  </button>

                  <button
                    onClick={() => { addPrimitive('water'); setIsEffectsMenuOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs text-neutral-300 hover:bg-neutral-900 hover:text-white transition-colors group text-left"
                  >
                    <Droplets size={14} className="text-neutral-400 group-hover:text-sky-400 transition-colors" />
                    <span>Water / Liquid</span>
                  </button>

                  <button
                    onClick={() => { addPrimitive('sparks'); setIsEffectsMenuOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs text-neutral-300 hover:bg-neutral-900 hover:text-white transition-colors group text-left"
                  >
                    <Zap size={14} className="text-neutral-400 group-hover:text-yellow-400 transition-colors" />
                    <span>Electrical Sparks</span>
                  </button>

                  <button
                    onClick={() => {
                      const state = useStore.getState();
                      const existingDebris = state.objects.filter(o => o.type === 'debris_emitter');
                      const newDebrisEmitter = {
                        id: `debris_${Date.now()}`,
                        name: `Debris Emitter ${existingDebris.length + 1}`,
                        type: 'debris_emitter' as const,
                        position: [0, 5, 0] as [number, number, number],
                        rotation: [0, 0, 0] as [number, number, number],
                        scale: [1, 1, 1] as [number, number, number],
                        debrisProps: {
                          bounds: [20, 10, 20] as [number, number, number],
                          assetId: null,
                          count: 120,
                          speed: 1.0,
                          spawnRate: 30,
                          velocity: [0, -0.5, 0] as [number, number, number],
                          particleShape: 'rocks',
                          color: '#808080',
                        },
                      };
                      state.addObject(newDebrisEmitter);
                      state.selectObject(newDebrisEmitter.id);
                      setIsEffectsMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs text-neutral-300 hover:bg-neutral-900 hover:text-white transition-colors group text-left"
                  >
                    <BoxSelect size={14} className="text-neutral-400 group-hover:text-amber-400 transition-colors" />
                    <span>Debris Volume</span>
                  </button>
                </div>

              </div>
            </>
          )}
        </div>


      </div>

      {/* RIGHT SECTION: Transforms, Snapping & Simulation Core */}
      <div className="flex gap-4 items-center">
        {/* Transform Mode Track */}
        <div className="flex bg-neutral-900/60 border border-neutral-800/50 rounded-lg p-0.5 shadow-inner">
          <button
            onClick={() => setTransformMode('select')}
            className={`p-1.5 transition-all duration-150 cursor-pointer rounded-md ${transformMode === 'select' ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20 shadow-sm' : 'text-neutral-400 hover:text-neutral-200 border border-transparent'}`}
            title="Select (Q)"
          >
            <MousePointer size={14} />
          </button>
          <button
            onClick={() => setTransformMode('translate')}
            className={`p-1.5 transition-all duration-150 cursor-pointer rounded-md ${transformMode === 'translate' ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20 shadow-sm' : 'text-neutral-400 hover:text-neutral-200 border border-transparent'}`}
            title="Translate (W)"
          >
            <Move size={14} />
          </button>
          <button
            onClick={() => setTransformMode('rotate')}
            className={`p-1.5 transition-all duration-150 cursor-pointer rounded-md ${transformMode === 'rotate' ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20 shadow-sm' : 'text-neutral-400 hover:text-neutral-200 border border-transparent'}`}
            title="Rotate (E)"
          >
            <RotateCcw size={14} />
          </button>
          <button
            onClick={() => setTransformMode('scale')}
            className={`p-1.5 transition-all duration-150 cursor-pointer rounded-md ${transformMode === 'scale' ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20 shadow-sm' : 'text-neutral-400 hover:text-neutral-200 border border-transparent'}`}
            title="Scale (R)"
          >
            <Scaling size={14} />
          </button>
        </div>



        {/* Environment Toggles & Snapping Menu */}
        <div className="flex bg-neutral-900/60 border border-neutral-800/50 rounded-lg p-0.5 items-center">
          <button
            onClick={toggleWireframeMode}
            className={`p-1.5 transition-colors cursor-pointer rounded-md ${wireframeMode ? 'text-sky-400' : 'text-neutral-400 hover:text-neutral-200'}`}
            title="Toggle Wireframe Mode (Shift+H)"
          >
            <Layers size={14} />
          </button>

          <div className="h-4 w-px bg-neutral-800/60 mx-0.5" />

          <button
            onClick={togglePhysicsDebug}
            className={`p-1.5 transition-all duration-150 cursor-pointer rounded-md border ${
              showPhysicsDebug
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.25)] ring-1 ring-emerald-500/30'
                : 'text-neutral-400 hover:text-neutral-200 border-transparent hover:bg-neutral-800/60'
            }`}
            title={showPhysicsDebug ? 'Hide Physics Colliders & Hitboxes (Rapier)' : 'Show Visual Hitbox / Collider Debugger (Rapier)'}
            aria-pressed={showPhysicsDebug}
          >
            <Boxes size={14} className={showPhysicsDebug ? 'text-emerald-400 animate-pulse' : ''} />
          </button>

          <div className="h-4 w-px bg-neutral-800/60 mx-0.5" />

          <button
            onClick={toggleGrid}
            className={`p-1.5 transition-colors cursor-pointer rounded-md ${showGrid ? 'text-sky-400' : 'text-neutral-400 hover:text-neutral-200'}`}
            title="Toggle Scene Grid View"
          >
            <Grid size={14} />
          </button>

          <div className="h-4 w-px bg-neutral-800/60 mx-0.5" />

          <button
            onClick={toggleSnapGrid}
            className={`p-1.5 transition-colors cursor-pointer rounded-md ${snapGrid ? 'text-sky-400' : 'text-neutral-400 hover:text-neutral-200'}`}
            title="Toggle Snap increment"
          >
            <Magnet size={14} />
          </button>

          {/* Snap increment Dropdown configuration */}
          <div className="relative">
            <button
              onClick={() => setIsSnapMenuOpen(!isSnapMenuOpen)}
              className="flex items-center gap-0.5 pl-1 pr-1.5 py-1 text-[10px] font-mono font-bold text-neutral-300 hover:bg-neutral-800 rounded-md transition-colors cursor-pointer"
              title="Position Snap Grid"
            >
              <span>{snapGrid ? `${snapValue.toFixed(1)}u` : 'Off'}</span>
              <ChevronDown size={10} className="text-neutral-500" />
            </button>

            {isSnapMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsSnapMenuOpen(false)} />
                <div className="absolute top-full right-0 mt-2 w-24 bg-neutral-950 border border-neutral-800 rounded-lg shadow-2xl py-1 p-1 z-50">
                  {[0.1, 0.5, 1.0, 5.0].map((val) => (
                    <button
                      key={val}
                      onClick={() => {
                        setSnapValue(val);
                        if (!snapGrid) toggleSnapGrid();
                        setIsSnapMenuOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 hover:bg-neutral-900 flex items-center justify-between transition-colors rounded-md text-xs font-mono text-neutral-300 hover:text-white ${snapValue === val && snapGrid ? 'text-sky-400 bg-sky-500/5 font-bold' : ''}`}
                    >
                      <span>{val.toFixed(1)}u</span>
                      {snapValue === val && snapGrid && <span className="w-1 h-1 bg-sky-400 rounded-full" />}
                    </button>
                  ))}
                  <div className="border-t border-neutral-800 my-1" />
                  <button
                    onClick={() => { toggleSnapGrid(); setIsSnapMenuOpen(false); }}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-neutral-900 flex items-center transition-colors rounded-md text-neutral-400 hover:text-white text-xs"
                  >
                    {snapGrid ? 'Turn Off' : 'Turn On'}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Rotation Snap Dropdown configuration */}
          <div className="relative">
            <button
              onClick={() => setIsRotSnapMenuOpen(!isRotSnapMenuOpen)}
              className="flex items-center gap-0.5 pl-1 pr-1.5 py-1 text-[10px] font-mono font-bold text-neutral-300 hover:bg-neutral-800 rounded-md transition-colors cursor-pointer"
              title="Rotation Snap Angle"
            >
              <span>{snapGrid ? `${rotationSnapAngle}°` : 'Off'}</span>
              <ChevronDown size={10} className="text-neutral-500" />
            </button>

            {isRotSnapMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsRotSnapMenuOpen(false)} />
                <div className="absolute top-full right-0 mt-2 w-24 bg-neutral-950 border border-neutral-800 rounded-lg shadow-2xl py-1 p-1 z-50">
                  {[15, 30, 45, 90].map((val) => (
                    <button
                      key={val}
                      onClick={() => {
                        setRotationSnapAngle(val);
                        if (!snapGrid) toggleSnapGrid();
                        setIsRotSnapMenuOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 hover:bg-neutral-900 flex items-center justify-between transition-colors rounded-md text-xs font-mono text-neutral-300 hover:text-white ${rotationSnapAngle === val && snapGrid ? 'text-sky-400 bg-sky-500/5 font-bold' : ''}`}
                    >
                      <span>{val}°</span>
                      {rotationSnapAngle === val && snapGrid && <span className="w-1 h-1 bg-sky-400 rounded-full" />}
                    </button>
                  ))}
                  <div className="border-t border-neutral-800 my-1" />
                  <button
                    onClick={() => { toggleSnapGrid(); setIsRotSnapMenuOpen(false); }}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-neutral-900 flex items-center transition-colors rounded-md text-neutral-400 hover:text-white text-xs"
                  >
                    {snapGrid ? 'Turn Off' : 'Turn On'}
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="h-4 w-px bg-neutral-800/60 mx-0.5" />

          <button
            onClick={snapSelectedToGround}
            className="p-1.5 transition-colors cursor-pointer rounded-md text-neutral-400 hover:text-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Snap Selected to Ground Plane"
            disabled={selectedIds.length === 0}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 8V5c0-1.7 1.3-3 3-3h8c1.7 0 3 1.3 3 3v3m-4 0V5c0-.6-.4-1-1-1H10c-.6 0-1 .4-1 1v3" />
              <path d="M12 10v7M9 14.5l3 3 3-3" />
              <line x1="3" y1="21" x2="21" y2="21" />
            </svg>
          </button>
        </div>


        {/* Active Tool Selectors */}
        <div className="flex bg-neutral-900/60 border border-neutral-800/50 rounded-lg p-0.5 shadow-sm">
          <button
            onClick={() => setActiveTool(activeTool === 'foliage' ? 'select' : 'foliage')}
            disabled={isPlaying}
            className={`p-1.5 transition-all duration-150 rounded-md cursor-pointer ${isPlaying ? 'opacity-20 cursor-not-allowed text-neutral-500' : activeTool === 'foliage' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm' : 'text-neutral-400 hover:text-neutral-200 border border-transparent'}`}
            title="Foliage Painter (P)"
          >
            <Brush size={14} />
          </button>
          <div className="h-4 w-px bg-neutral-800/60 mx-0.5 align-middle self-center" />
          <button
            onClick={() => setActiveTool(activeTool === 'TerrainBrush' ? 'select' : 'TerrainBrush')}
            disabled={isPlaying}
            className={`p-1.5 transition-all duration-150 rounded-md cursor-pointer ${isPlaying ? 'opacity-20 cursor-not-allowed text-neutral-500' : activeTool === 'TerrainBrush' ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20 shadow-sm' : 'text-neutral-400 hover:text-neutral-200 border border-transparent'}`}
            title="Terrain Sculpt Brush (T)"
          >
            <Mountain size={14} />
          </button>

        </div>

        {/* AI Assistant Toggle */}
        <button
          onClick={toggleAssistantPanel}
          className={`p-2 transition-all duration-150 rounded-lg cursor-pointer border ${
            assistantPanelVisible
              ? 'bg-violet-500/15 text-violet-400 border-violet-500/30 shadow-[0_0_12px_rgba(139,92,246,0.15)]'
              : 'bg-neutral-900/60 text-neutral-400 border-neutral-800/50 hover:bg-neutral-800 hover:text-violet-400'
          }`}
          title="AI Dev Assistant"
        >
          <Sparkles size={14} />
        </button>

        {/* Engine Preferences & Rendering Quality Settings */}
        <button
          onClick={() => useStore.getState().setPreferencesModalOpen(true)}
          className="p-2 transition-all duration-150 rounded-lg cursor-pointer border bg-neutral-900/60 text-neutral-400 border-neutral-800/50 hover:bg-neutral-800 hover:text-white"
          title="Engine Preferences & Rendering Quality"
        >
          <Settings size={14} />
        </button>

        {/* Engine Physics Engine Simulator Playback Controls */}
        <div className="flex bg-neutral-900/60 border border-neutral-800/50 rounded-lg p-0.5 shadow-sm">
          <button
            onClick={togglePlay}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-md transition-all duration-200 border cursor-pointer ${
              isPlaying
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                : 'bg-neutral-900 text-neutral-200 border-neutral-800 hover:bg-neutral-800 hover:border-neutral-700'
            }`}
          >
            {isPlaying ? (
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
            ) : (
              <Play size={12} className="fill-current text-sky-400" />
            )}
            <span>{isPlaying ? 'LIVE' : 'SIMULATE'}</span>
          </button>

          {isPlaying && (
            <>
              <button
                onClick={togglePause}
                className={`p-1.5 transition-all cursor-pointer rounded-md ml-0.5 ${
                  isPaused
                    ? 'text-amber-400 hover:bg-neutral-800/80 hover:text-amber-300 bg-amber-500/10 border border-amber-500/20'
                    : 'text-neutral-400 hover:bg-neutral-800 hover:text-white border border-transparent'
                }`}
                title={isPaused ? "Resume Simulation (P)" : "Pause Simulation (P)"}
              >
                {isPaused ? <Play size={12} className="fill-current" /> : <Pause size={12} />}
              </button>
              <button
                onClick={stopPlay}
                className="p-1.5 transition-all cursor-pointer rounded-md ml-0.5 text-neutral-400 hover:bg-neutral-800 hover:text-red-400 border border-transparent"
                title="Stop Simulation"
              >
                <Square size={12} className="fill-current" />
              </button>
            </>
          )}
        </div>
      </div>

      <EnginePreferencesModal />
    </div>
  );
}

function EnginePreferencesModal() {
  const isPreferencesModalOpen = useStore((s) => s.isPreferencesModalOpen);
  const setPreferencesModalOpen = useStore((s) => s.setPreferencesModalOpen);
  const prefs = useStore((s) => s.enginePreferences);
  const updatePrefs = useStore((s) => s.updateEnginePreferences);

  if (!isPreferencesModalOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-md z-[99999] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200 select-none">
      <div className="bg-bg-panel/95 backdrop-blur-xl border border-white/10 w-full max-w-md max-h-[85vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto transform scale-100 animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-neutral-900/50 shrink-0">
          <div className="flex items-center gap-2">
            <Settings size={16} className="text-sky-400" />
            <h2 className="text-white text-sm font-bold tracking-wide">Engine Preferences & Graphics Quality</h2>
          </div>
          <button
            onClick={() => setPreferencesModalOpen(false)}
            className="text-neutral-400 hover:text-white text-lg font-mono p-1 rounded-md transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 flex flex-col gap-4 text-xs font-mono overflow-y-auto custom-scrollbar flex-1">
          <div className="text-[11px] text-text-secondary leading-relaxed bg-neutral-900/60 p-3 rounded-lg border border-border/40">
            ⚙️ Hardware and rendering settings are saved locally to your device/GPU. World parameters (time of day, weather, sky) remain saved inside project level files.
          </div>

          {/* Master Quality Tier Dropdown */}
          <div className="flex flex-col gap-1.5">
            <label className="text-neutral-300 font-semibold flex items-center justify-between">
              <span>Rendering Quality Tier</span>
              <span className="text-[10px] text-sky-400 font-bold uppercase">{prefs.graphicsQuality}</span>
            </label>
            <select
              className="bg-bg-deep border border-border text-white px-3 py-2 rounded-lg font-mono text-xs focus:border-accent outline-none cursor-pointer"
              value={prefs.graphicsQuality}
              onChange={(e) => updatePrefs({ graphicsQuality: e.target.value as any })}
            >
              <option value="performance">⚡ Performance Mode (1-Octave Noise, Locked 60+ FPS)</option>
              <option value="balanced">🌤️ Balanced Mode (2-Octave Noise, 64 Plane Segments)</option>
              <option value="cinematic">🎨 Cinematic Mode (4-Octave Noise, 128 Plane Segments)</option>
              <option value="ultra">🎬 Ultra Mode (6-Octave HD Noise, 256 Plane Segments)</option>
            </select>
          </div>

          {/* Viewport Render Scale / Resolution */}
          <div className="flex flex-col gap-1.5">
            <label className="text-neutral-300 font-semibold flex items-center justify-between">
              <span>Viewport Render Scale / Resolution</span>
              <span className="text-[10px] text-sky-400 font-bold uppercase">{prefs.renderScale ?? 1.0}x</span>
            </label>
            <select
              className="bg-bg-deep border border-border text-white px-3 py-2 rounded-lg font-mono text-xs focus:border-accent outline-none cursor-pointer"
              value={prefs.renderScale ?? 1.0}
              onChange={(e) => updatePrefs({ renderScale: parseFloat(e.target.value) as any })}
            >
              <option value="0.75">⚡ Low (0.75x Resolution) - Max Performance</option>
              <option value="1">🌤️ Native (1.0x Resolution) - Standard Viewport</option>
              <option value="1.25">🎨 High (1.25x Resolution) - Crisp View</option>
              <option value="1.5">🎬 Ultra (1.5x Resolution) - Supersampling</option>
            </select>
          </div>

          {/* Sun Shafts Toggle */}
          <div className="flex items-center justify-between bg-neutral-900/40 p-3 rounded-lg border border-border/40">
            <div className="flex flex-col">
              <span className="text-white font-medium">Screen-Space Sun Shafts</span>
              <span className="text-[10px] text-text-secondary">Atmospheric god rays through cloud decks</span>
            </div>
            <input
              type="checkbox"
              checked={prefs.godRaysEnabled}
              onChange={(e) => updatePrefs({ godRaysEnabled: e.target.checked })}
              className="w-4 h-4 rounded border-border bg-bg-deep text-sky-400 accent-sky-400 cursor-pointer"
            />
          </div>

          {/* Top-Left Performance HUD Toggle */}
          <div className="flex items-center justify-between bg-neutral-900/40 p-3 rounded-lg border border-border/40">
            <div className="flex flex-col">
              <span className="text-white font-medium">Top-Left Performance Monitor</span>
              <span className="text-[10px] text-text-secondary">Real-time WebGL frame-delta HUD</span>
            </div>
            <input
              type="checkbox"
              checked={prefs.showFpsCounter}
              onChange={(e) => updatePrefs({ showFpsCounter: e.target.checked })}
              className="w-4 h-4 rounded border-border bg-bg-deep text-sky-400 accent-sky-400 cursor-pointer"
            />
          </div>

          {/* Shadow Quality Tier */}
          <div className="flex flex-col gap-1.5">
            <label className="text-neutral-300 font-semibold">Shadow Map Resolution</label>
            <select
              className="bg-bg-deep border border-border text-white px-3 py-2 rounded-lg font-mono text-xs focus:border-accent outline-none cursor-pointer"
              value={prefs.shadowQuality}
              onChange={(e) => updatePrefs({ shadowQuality: e.target.value as any })}
            >
              <option value="low">Low (1024x1024 Shadow Maps)</option>
              <option value="medium">Medium (2048x2048 Shadow Maps)</option>
              <option value="high">High (4096x4096 Shadow Maps)</option>
              <option value="ultra">Ultra (8192x8192 Cascaded Shadows)</option>
            </select>
          </div>

          {/* Autosave Recovery Prompt on Startup */}
          <div className="flex items-center justify-between bg-neutral-900/40 p-3 rounded-lg border border-border/40">
            <div className="flex flex-col">
              <span className="text-white font-medium">Session Recovery Prompt</span>
              <span className="text-[10px] text-text-secondary">Prompt to restore autosaved session or start fresh on startup</span>
            </div>
            <input
              type="checkbox"
              checked={prefs.promptSessionRecovery ?? true}
              onChange={(e) => updatePrefs({ promptSessionRecovery: e.target.checked })}
              className="w-4 h-4 rounded border-border bg-bg-deep text-sky-400 accent-sky-400 cursor-pointer"
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 bg-neutral-900/60 border-t border-border flex items-center justify-end shrink-0">
          <button
            onClick={() => setPreferencesModalOpen(false)}
            className="bg-sky-500 hover:bg-sky-400 text-neutral-950 font-bold px-5 py-1.5 rounded-lg text-xs transition-all shadow-md active:scale-95 cursor-pointer"
          >
            Apply & Close
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}

export default React.memo(TopBar);
