import React from 'react';
import {
  Undo2,
  Redo2,
  Download,
  Box,
  Circle,
  Copy,
  FilePlus,
  FolderMinus,
  FolderOpen,
  FolderPlus,
  Lightbulb,
  Magnet,
  Move,
  Play,
  Pause,
  RotateCcw,
  Save,
  Scaling,
  Square,
  Trash2,
  Combine,
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
    loadProject,
    isPlaying,
    togglePlay,
    stopPlay,
    isPaused,
    togglePause,
    showGrid,
    toggleGrid,
    snapValue,
    setSnapValue,
    showOverlays,
    toggleOverlays,
    activeTool,
    setActiveTool,
  } = useStore();

  const { undo, redo, pastStates, futureStates } = useZustandStore(useStore.temporal);


  const [isProjectMenuOpen, setIsProjectMenuOpen] = React.useState(false);
  const [isInsertMenuOpen, setIsInsertMenuOpen] = React.useState(false);
  const [isEffectsMenuOpen, setIsEffectsMenuOpen] = React.useState(false);
  const [isAnimationMenuOpen, setIsAnimationMenuOpen] = React.useState(false);
  const [isSnapMenuOpen, setIsSnapMenuOpen] = React.useState(false);

  // Accordion toggle states for Insert menu
  const [isPrimitivesExpanded, setIsPrimitivesExpanded] = React.useState(true);
  const [isAdvancedExpanded, setIsAdvancedExpanded] = React.useState(true);
  const [isUtilitiesExpanded, setIsUtilitiesExpanded] = React.useState(false);

  const handleLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) loadProject(content);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExport = () => {
    window.dispatchEvent(new CustomEvent('export_gltf'));
  };

  const isSelectionDisabled = selectedIds.length === 0 || selectedIds.includes('world_settings');
  const isMultiSelectionDisabled = selectedIds.length <= 1 || selectedIds.includes('world_settings');

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

                  <div className={`space-y-0.5 mt-0.5 transition-all duration-200 pr-1 custom-scrollbar ${isPrimitivesExpanded ? 'max-h-40 opacity-100 overflow-y-auto' : 'max-h-0 opacity-0 overflow-hidden pointer-events-none'}`}>
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
                      onClick={() => { addPrimitive('torus'); setIsInsertMenuOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs text-neutral-300 hover:bg-neutral-900 hover:text-white transition-colors group text-left"
                    >
                      <div className="w-3.5 h-3.5 border-2 border-neutral-400 rounded-full group-hover:border-sky-400 transition-colors flex items-center justify-center"><div className="w-1 h-1 border border-neutral-400 group-hover:border-sky-400 rounded-full" /></div>
                      <span>Torus</span>
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

                  <div className={`space-y-0.5 mt-0.5 transition-all duration-200 pr-1 custom-scrollbar ${isAdvancedExpanded ? 'max-h-44 opacity-100 overflow-y-auto' : 'max-h-0 opacity-0 overflow-hidden pointer-events-none'}`}>
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
            onClick={toggleOverlays}
            className={`p-1.5 transition-colors cursor-pointer rounded-md ${showOverlays ? 'text-sky-400' : 'text-neutral-400 hover:text-neutral-200'}`}
            title="Toggle Selection Wireframe (Shift+H)"
          >
            <Layers size={14} />
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
        </div>


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
    </div>
  );
}

export default React.memo(TopBar);
