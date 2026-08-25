/**
 * offlineRouter.ts — Intent-Based Offline Conversational Router
 * 
 * Replaces rigid string-match fallback with a generic conversational intent parser.
 * Tracks dialogue state so follow-ups like "Hey" → "a side scroller" work naturally.
 */

import type { AssistantPatch, AssistantMessage } from './useStore';

// ─── Types ───────────────────────────────────────────────────────

export type EngineIntent =
  | 'GREETING'
  | 'GENRE_BLUEPRINT'
  | 'ENVIRONMENT_MOD'
  | 'OBJECT_MOD'
  | 'QUESTION'
  | 'AGENTIC_CMD'
  | 'CONVERSATIONAL';

export type FocusScope = 'GLOBAL' | 'OBJECT';

interface ParsedIntent {
  intent: EngineIntent;
  genre?: string;
  keywords: string[];
}

interface RouterContext {
  scope: FocusScope;
  selectedObj: { id: string; name: string; material?: any; physics?: string; physicsMass?: number } | null;
  currentEnv: Record<string, any>;
  gameBible: string;
}

// ─── Generic Genre Blueprint Database ─────────────────────────────

interface GenreBlueprint {
  genre: string;
  cameraStyle: string;
  cameraMode: 'side-scroller' | 'top-down' | 'third-person';
  cameraType: string;
  coreFeatures: string[];
  envPreset?: string;
  fogEnabled?: boolean;
  ambientIntensity?: number;
}

const GENRE_BLUEPRINTS: { keywords: string[]; blueprint: GenreBlueprint }[] = [
  {
    keywords: ['arena brawler', 'moba', 'arena', 'top-down brawler', 'top down brawler', 'arena fighter'],
    blueprint: {
      genre: '3V3 Arena Brawler',
      cameraStyle: 'Overhead Arena View (45-60° Pitch)',
      cameraMode: 'top-down',
      cameraType: 'TOP_DOWN',
      coreFeatures: ['Direct Analog Movement', 'Direct Physics-Body Collisions', 'Dynamic Skill-Shot Aiming'],
      envPreset: 'city',
      ambientIntensity: 0.5,
    },
  },
  {
    keywords: ['side-scroller', 'side scroller', 'beat em up', "beat'em up", 'brawler', 'fighting'],
    blueprint: {
      genre: "3D Side-Scroller Beat 'Em Up",
      cameraStyle: 'Side-Scrolling Follow Track',
      cameraMode: 'side-scroller',
      cameraType: 'SIDE_SCROLLER',
      coreFeatures: ['Melee Combo System', '2.5D Depth Movement', 'Parallel Camera Track'],
      envPreset: 'city',
      ambientIntensity: 0.3,
    },
  },
  {
    keywords: ['fps', 'first person', 'first-person', 'shooter'],
    blueprint: {
      genre: 'First-Person Shooter',
      cameraStyle: 'First-Person Lock',
      cameraMode: 'third-person',
      cameraType: 'THIRD_PERSON',
      coreFeatures: ['FPS Camera Lock', 'Weapon System', 'Reticle HUD'],
      envPreset: 'warehouse',
    },
  },
  {
    keywords: ['top-down', 'top down', 'rpg', 'dungeon', 'isometric'],
    blueprint: {
      genre: 'Top-Down RPG',
      cameraStyle: 'Overhead Isometric View',
      cameraMode: 'top-down',
      cameraType: 'TOP_DOWN',
      coreFeatures: ['Isometric Camera', 'Inventory System', 'Tile-Based Navigation'],
      envPreset: 'forest',
    },
  },
  {
    keywords: ['horror', 'survival horror', 'scary', 'survival'],
    blueprint: {
      genre: 'Survival Horror',
      cameraStyle: 'Third-Person Over-Shoulder',
      cameraMode: 'third-person',
      cameraType: 'THIRD_PERSON',
      coreFeatures: ['Low Visibility', 'Fog System', 'Limited Resources'],
      envPreset: 'night',
      fogEnabled: true,
      ambientIntensity: 0.05,
    },
  },
  {
    keywords: ['platformer', 'platform', 'jump'],
    blueprint: {
      genre: '3D Platformer',
      cameraStyle: 'Side-Scrolling Follow Track',
      cameraMode: 'side-scroller',
      cameraType: 'SIDE_SCROLLER',
      coreFeatures: ['Jump Physics', 'Coin Collection', 'Moving Platforms'],
      envPreset: 'park',
      ambientIntensity: 0.8,
    },
  },
  {
    keywords: ['racing', 'kart', 'vehicle', 'car', 'driving'],
    blueprint: {
      genre: 'Racing Game',
      cameraStyle: 'Third-Person Chase Camera',
      cameraMode: 'third-person',
      cameraType: 'THIRD_PERSON',
      coreFeatures: ['Vehicle Physics', 'Track Bounds', 'Speedometer HUD'],
      envPreset: 'city',
    },
  },
  {
    keywords: ['open world', 'sandbox', 'adventure', 'exploration'],
    blueprint: {
      genre: 'Open World Adventure',
      cameraStyle: 'Third-Person Free Orbit',
      cameraMode: 'third-person',
      cameraType: 'THIRD_PERSON',
      coreFeatures: ['Free Camera Orbit', 'Day/Night Cycle', 'Open Exploration'],
      envPreset: 'sunset',
    },
  },
];

// ─── Environment Presets ─────────────────────────────────────────

interface EnvPreset {
  label: string;
  after: Record<string, any>;
}

const ENV_PRESETS: { keywords: string[]; preset: EnvPreset }[] = [
  {
    keywords: ['spooky', 'horror', 'creepy', 'haunted', 'eerie'],
    preset: {
      label: 'Spooky Horror Lighting',
      after: { ambientIntensity: 0.05, skyPreset: 'Night (10:00 PM)', timeOfDay: 22.0, fogEnabled: true, fogColor: '#0b0b0f', fogDensity: 0.08 },
    },
  },
  {
    keywords: ['dark', 'alley', 'underground', 'dungeon', 'gritty'],
    preset: {
      label: 'Dark Gritty Atmosphere',
      after: { ambientIntensity: 0.08, skyPreset: 'Midnight (12:00 AM)', timeOfDay: 0.0, fogEnabled: true, fogColor: '#0a0a12', fogDensity: 0.05, exposure: 0.7 },
    },
  },
  {
    keywords: ['sunset', 'warm', 'golden', 'evening'],
    preset: {
      label: 'Golden Sunset Atmosphere',
      after: { ambientIntensity: 0.4, skyPreset: 'Sunset / Golden Hour (6:30 PM)', fogEnabled: false, exposure: 1.2, timeOfDay: 18.5 },
    },
  },
  {
    keywords: ['night', 'midnight', 'moon', 'lunar'],
    preset: {
      label: 'Midnight Moonlight',
      after: { ambientIntensity: 0.1, skyPreset: 'Midnight (12:00 AM)', fogEnabled: true, fogColor: '#06060e', fogDensity: 0.03, timeOfDay: 0.0 },
    },
  },
  {
    keywords: ['foggy', 'misty', 'fog', 'mist', 'haze'],
    preset: {
      label: 'Dense Fog Environment',
      after: { fogEnabled: true, fogColor: '#c8c8d0', fogDensity: 0.15, fogNear: 2, fogFar: 15 },
    },
  },
  {
    keywords: ['bright', 'sunny', 'daylight', 'clear', 'cheerful'],
    preset: {
      label: 'Bright Daylight',
      after: { ambientIntensity: 0.6, directionalIntensity: 2.0, skyPreset: 'Noon (12:00 PM)', fogEnabled: false, exposure: 1.3, timeOfDay: 12.0 },
    },
  },
  {
    keywords: ['rain', 'rainy', 'storm', 'downpour'],
    preset: {
      label: 'Rainy Storm Atmosphere',
      after: { ambientIntensity: 0.15, skyPreset: 'Dusk (8:00 PM)', timeOfDay: 20.0, fogEnabled: true, fogColor: '#2a2a30', fogDensity: 0.04, rainEnabled: true, rainIntensity: 0.8 },
    },
  },
  {
    keywords: ['snow', 'winter', 'cold', 'blizzard', 'frozen'],
    preset: {
      label: 'Frozen Winter Landscape',
      after: { ambientIntensity: 0.5, skyPreset: 'Dawn (5:00 AM)', timeOfDay: 5.0, fogEnabled: true, fogColor: '#d0d8e8', fogDensity: 0.03, snowEnabled: true, snowIntensity: 0.7 },
    },
  },
];

// ─── Object Modification Presets ─────────────────────────────────

interface ObjPreset {
  label: string;
  materialAfter?: Record<string, any>;
  physicsAfter?: Record<string, any>;
}

const OBJ_PRESETS: { keywords: string[]; preset: ObjPreset }[] = [
  {
    keywords: ['ghost', 'transparent', 'invisible', 'fade', 'phantom'],
    preset: {
      label: 'Ghost Material Effect',
      materialAfter: { color: '#44bbff', opacity: 0.4, metalness: 0.1, roughness: 0.3 },
    },
  },
  {
    keywords: ['heavy', 'concrete', 'stone', 'boulder', 'dense', 'mass'],
    preset: {
      label: 'Heavy Concrete Barrier',
      materialAfter: { color: '#88888c', roughness: 0.85, metalness: 0.05 },
      physicsAfter: { physics: 'dynamic', physicsMass: 500 },
    },
  },
  {
    keywords: ['metal', 'chrome', 'steel', 'iron', 'shiny'],
    preset: {
      label: 'Polished Metal Surface',
      materialAfter: { color: '#c0c0c8', roughness: 0.05, metalness: 0.95, envMapIntensity: 2.0 },
    },
  },
  {
    keywords: ['glow', 'neon', 'emissive', 'glowing', 'luminous'],
    preset: {
      label: 'Neon Glow Effect',
      materialAfter: { color: '#ff00ff', roughness: 0.2, metalness: 0.3, envMapIntensity: 1.5 },
    },
  },
  {
    keywords: ['wood', 'wooden', 'oak', 'plank', 'timber'],
    preset: {
      label: 'Natural Wood Material',
      materialAfter: { color: '#8B6914', roughness: 0.7, metalness: 0.0 },
    },
  },
  {
    keywords: ['glass', 'crystal', 'ice', 'clear'],
    preset: {
      label: 'Glass / Crystal Material',
      materialAfter: { color: '#88ccff', roughness: 0.0, metalness: 0.1, opacity: 0.3 },
    },
  },
  {
    keywords: ['rubber', 'bouncy', 'soft', 'squishy'],
    preset: {
      label: 'Soft Rubber Material',
      materialAfter: { color: '#cc3344', roughness: 0.9, metalness: 0.0 },
      physicsAfter: { physics: 'dynamic', physicsMass: 2 },
    },
  },
  {
    keywords: ['lava', 'molten', 'magma', 'hot'],
    preset: {
      label: 'Molten Lava Surface',
      materialAfter: { color: '#ff4400', roughness: 0.6, metalness: 0.4, envMapIntensity: 0.5 },
    },
  },
];

// ─── Conversational State ────────────────────────────────────────

let lastIntent: EngineIntent | null = null;

export function resetConversationState() {
  lastIntent = null;
}

// ─── Intent Parser ───────────────────────────────────────────────

const GREETING_RE = /^(hey|hello|hi|yo|sup|greetings|what's up|howdy|hola|good\s*(morning|afternoon|evening))\b/i;
const QUESTION_RE = /^(what can|help|how do|how does|what do you|tell me about|explain|show me|list|capabilities)/i;

function parseIntent(input: string): ParsedIntent {
  const clean = input.toLowerCase().trim();
  const words = clean.split(/\s+/);

  // 1. Greetings
  if (GREETING_RE.test(clean) && words.length <= 6) {
    return { intent: 'GREETING', keywords: words };
  }

  // 2. Questions / help
  if (QUESTION_RE.test(clean)) {
    return { intent: 'QUESTION', keywords: words };
  }

  // 3. Genre blueprint detection
  for (const entry of GENRE_BLUEPRINTS) {
    if (entry.keywords.some((kw) => clean.includes(kw))) {
      return { intent: 'GENRE_BLUEPRINT', genre: entry.blueprint.genre, keywords: words };
    }
  }
  // Also catch generic "game" mentions — check if previous intent was GREETING (follow-up)
  if (clean.includes('game') || clean.includes('make') || clean.includes('build') || clean.includes('create')) {
    // Try to infer a genre from the text
    for (const entry of GENRE_BLUEPRINTS) {
      if (entry.keywords.some((kw) => clean.includes(kw))) {
        return { intent: 'GENRE_BLUEPRINT', genre: entry.blueprint.genre, keywords: words };
      }
    }
    // If no specific genre matched but it talks about games, still treat as blueprint
    if (clean.includes('game')) {
      return { intent: 'GENRE_BLUEPRINT', keywords: words };
    }
  }

  // 3.5 Agentic commands (add, delete, quest, event, variable, sound, visibility)
  const isAgentic = (
    clean.includes('add') || clean.includes('spawn') || clean.includes('create') || clean.includes('insert') ||
    clean.includes('delete') || clean.includes('remove') || clean.includes('destroy') ||
    clean.includes('quest') || clean.includes('mission') || clean.includes('event') || clean.includes('variable') ||
    clean.includes('sound') || clean.includes('audio') || clean.includes('visibility') || clean.includes('visible')
  ) && (
    clean.includes('cube') || clean.includes('sphere') || clean.includes('light') || clean.includes('plane') ||
    clean.includes('cylinder') || clean.includes('object') || clean.includes('quest') || clean.includes('event') ||
    clean.includes('variable') || clean.includes('timer') || clean.includes('cooldown') || clean.includes('score') ||
    clean.includes('health') || clean.includes('points') || clean.includes('visibility') || clean.includes('visible') ||
    clean.includes('sound') || clean.includes('audio')
  );
  if (isAgentic) {
    return { intent: 'AGENTIC_CMD', keywords: words };
  }

  // 4. Environment modifications (global scope keywords)
  for (const entry of ENV_PRESETS) {
    if (entry.keywords.some((kw) => clean.includes(kw))) {
      return { intent: 'ENVIRONMENT_MOD', keywords: words };
    }
  }

  // 5. Object modifications (material/physics keywords)
  for (const entry of OBJ_PRESETS) {
    if (entry.keywords.some((kw) => clean.includes(kw))) {
      return { intent: 'OBJECT_MOD', keywords: words };
    }
  }

  // 6. Follow-up context: if last intent was GREETING, treat freeform input as a genre attempt
  if (lastIntent === 'GREETING') {
    // Try genre match one more time on the raw follow-up
    for (const entry of GENRE_BLUEPRINTS) {
      if (entry.keywords.some((kw) => clean.includes(kw))) {
        return { intent: 'GENRE_BLUEPRINT', genre: entry.blueprint.genre, keywords: words };
      }
    }
    // Even if no match, assume they're describing a game
    return { intent: 'GENRE_BLUEPRINT', keywords: words };
  }

  // 7. Fallback: conversational
  return { intent: 'CONVERSATIONAL', keywords: words };
}

// ─── Response Generator ──────────────────────────────────────────

export function routeIntent(query: string, ctx: RouterContext): AssistantMessage {
  const parsed = parseIntent(query);
  lastIntent = parsed.intent;

  const baseMsg = {
    id: `msg_${Date.now()}_assistant`,
    role: 'assistant' as const,
    timestamp: Date.now(),
  };

  switch (parsed.intent) {
    // ── Greeting ──
    case 'GREETING': {
      const hasContext = !!ctx.gameBible;
      const content = hasContext
        ? `Hey! 👋 I see we're working on **${ctx.gameBible.split('\n')[0]}**. What would you like to change? I can tweak lighting, materials, physics, or the camera setup — just describe the vibe you're going for.`
        : `Hey! 👋 I'm your creative partner, currently running in **Offline Sandbox Mode**. What kind of game are we building today? Tell me a genre and I'll configure the entire workspace for you.\n\nSome ideas:\n• "Side-scroller beat 'em up"\n• "Top-down dungeon RPG"\n• "First-person shooter"\n• "3D platformer"\n• "Open world adventure"`;
      return { ...baseMsg, content, actionType: 'text' };
    }

    // ── Genre Blueprint ──
    case 'GENRE_BLUEPRINT': {
      const clean = query.toLowerCase().trim();
      let matched: (typeof GENRE_BLUEPRINTS)[0] | undefined;

      for (const entry of GENRE_BLUEPRINTS) {
        if (entry.keywords.some((kw) => clean.includes(kw))) {
          matched = entry;
          break;
        }
      }

      if (!matched) {
        // User described a game but we couldn't match a specific genre
        return {
          ...baseMsg,
          content: `That sounds awesome! I'd love to help set that up. Could you give me a bit more detail on the gameplay style? For example:\n\n• Is it a **side-scroller** or **top-down** view?\n• Is it more of a **fighting/brawler**, **shooter**, **RPG**, or **platformer**?`,
          actionType: 'text',
        };
      }

      const bp = matched.blueprint;
      const envActions: Record<string, any> = {
        cameraMode: bp.cameraMode,
        cameraType: bp.cameraType,
        cameraFollow: true,
      };
      if (bp.envPreset) envActions.preset = bp.envPreset;
      if (bp.fogEnabled !== undefined) envActions.fogEnabled = bp.fogEnabled;
      if (bp.ambientIntensity !== undefined) envActions.ambientIntensity = bp.ambientIntensity;

      return {
        ...baseMsg,
        content: `Let's go! I've built a full engine blueprint for a **${bp.genre}**. This will lock your camera to a **${bp.cameraStyle}** and set up the core systems. Hit the button below to apply everything instantly.`,
        actionType: 'kickstart_blueprint',
        actionLabel: `Kickstart '${bp.genre}' Engine Blueprint`,
        blueprint: {
          genre: bp.genre,
          cameraStyle: bp.cameraStyle,
          coreFeatures: bp.coreFeatures,
        },
        actions: [
          {
            targetId: 'environment',
            targetName: 'Environment',
            before: {
              cameraMode: ctx.currentEnv.cameraMode || 'third-person',
              cameraType: ctx.currentEnv.cameraType || 'THIRD_PERSON',
              cameraFollow: ctx.currentEnv.cameraFollow !== undefined ? ctx.currentEnv.cameraFollow : true,
            },
            after: envActions,
          },
        ],
      };
    }

    // ── Environment Modification ──
    case 'ENVIRONMENT_MOD': {
      const clean = query.toLowerCase().trim();
      let matched: (typeof ENV_PRESETS)[0] | undefined;
      for (const entry of ENV_PRESETS) {
        if (entry.keywords.some((kw) => clean.includes(kw))) {
          matched = entry;
          break;
        }
      }

      if (!matched) {
        return { ...baseMsg, content: `I'd love to change the atmosphere! Could you describe the mood? Try words like "spooky", "sunset", "foggy", "rainy", or "bright".`, actionType: 'text' };
      }

      const before: Record<string, any> = {};
      for (const key of Object.keys(matched.preset.after)) {
        before[key] = ctx.currentEnv[key];
      }

      return {
        ...baseMsg,
        content: `I've prepared the **${matched.preset.label}** preset. This will transform the entire workspace atmosphere.`,
        actionType: 'scene_action',
        actionLabel: matched.preset.label,
        actions: [
          {
            targetId: 'environment',
            targetName: 'Environment',
            before,
            after: matched.preset.after,
          },
        ],
      };
    }

    // ── Object Modification ──
    case 'OBJECT_MOD': {
      if (ctx.scope === 'GLOBAL' && !ctx.selectedObj) {
        return {
          ...baseMsg,
          content: `I can definitely do that! But I need to know which object to modify. Either **select an object** in the viewport first, or switch the AI scope to **📦 Object** mode using the toggle at the top of this panel.`,
          actionType: 'text',
        };
      }

      const clean = query.toLowerCase().trim();
      let matched: (typeof OBJ_PRESETS)[0] | undefined;
      for (const entry of OBJ_PRESETS) {
        if (entry.keywords.some((kw) => clean.includes(kw))) {
          matched = entry;
          break;
        }
      }

      if (!matched) {
        return { ...baseMsg, content: `I'd love to change how this object looks or feels! Try describing it with words like "metal", "glass", "heavy", "glowing", or "ghost".`, actionType: 'text' };
      }

      const targetId = ctx.selectedObj?.id || 'obj_1';
      const targetName = ctx.selectedObj?.name || 'Selected Object';
      const matBefore = ctx.selectedObj?.material || {};
      const afterProps: Record<string, any> = {};
      const beforeProps: Record<string, any> = {};

      if (matched.preset.materialAfter) {
        beforeProps.material = { ...matBefore };
        afterProps.material = { ...matBefore, ...matched.preset.materialAfter };
      }
      if (matched.preset.physicsAfter) {
        beforeProps.physics = ctx.selectedObj?.physics || 'fixed';
        beforeProps.physicsMass = ctx.selectedObj?.physicsMass || 1;
        Object.assign(afterProps, matched.preset.physicsAfter);
      }

      return {
        ...baseMsg,
        content: `I've prepared the **${matched.preset.label}** modification for **${targetName}**. Hit the button to apply!`,
        actionType: 'scene_action',
        actionLabel: matched.preset.label,
        actions: [
          {
            targetId,
            targetName,
            before: beforeProps,
            after: afterProps,
          },
        ],
      };
    }

    // ── Agentic Commands ──
    case 'AGENTIC_CMD': {
      const clean = query.toLowerCase().trim();
      let actions: any[] = [];
      let label = 'Agentic Update';
      let textContent = '';

      if (clean.includes('add') || clean.includes('spawn') || clean.includes('insert')) {
        let type = 'cube';
        if (clean.includes('sphere')) type = 'sphere';
        else if (clean.includes('light')) type = 'light';
        else if (clean.includes('plane')) type = 'plane';
        else if (clean.includes('cylinder')) type = 'cylinder';

        let color = undefined;
        if (clean.includes('red')) color = '#ff0000';
        else if (clean.includes('blue')) color = '#0088ff';
        else if (clean.includes('green')) color = '#00ff66';
        else if (clean.includes('yellow')) color = '#ffcc00';

        textContent = `I will spawn a new **${color ? color + ' ' : ''}${type}** in the scene.`;
        label = `Spawn ${type.toUpperCase()}`;
        actions.push({
          targetId: `new_obj_${Date.now()}`,
          targetName: `${type.toUpperCase()} Primitive`,
          before: {},
          after: {},
          cmd: 'add_object',
          params: { type, customName: `${type.toUpperCase()}_AI`, color }
        });
      } else if (clean.includes('delete') || clean.includes('remove') || clean.includes('destroy')) {
        const targetName = ctx.selectedObj ? ctx.selectedObj.name : 'Selected Object';
        const targetId = ctx.selectedObj ? ctx.selectedObj.id : '';
        if (targetId) {
          textContent = `I will remove the object **"${targetName}"** from the viewport.`;
          label = `Delete Object: ${targetName}`;
          actions.push({
            targetId,
            targetName,
            before: {},
            after: {},
            cmd: 'delete_object'
          });
        } else {
          return {
            ...baseMsg,
            content: `I'd love to delete that object, but please **select an object** in the viewport or Hierarchy Panel first so I know which one to delete!`,
            actionType: 'text'
          };
        }
      } else if (clean.includes('quest') || clean.includes('mission')) {
        let title = 'Collect Crystals';
        if (clean.includes('defeat') || clean.includes('kill')) title = 'Defeat Goblins';
        
        textContent = `I will configure a new Quest: **"${title}"** with reward points and objective settings.`;
        label = `Create Quest: ${title}`;
        actions.push({
          targetId: 'quest_registry',
          targetName: 'Quest System',
          before: {},
          after: {},
          cmd: 'add_quest',
          params: {
            title,
            description: `Complete the quest to progress.`,
            rewardXp: 150,
            objectives: [
              {
                type: clean.includes('defeat') ? 'defeat_enemy' : 'collect_item',
                targetName: clean.includes('defeat') ? 'Goblin' : 'Crystal',
                targetCount: 5,
                description: clean.includes('defeat') ? 'Defeat 5 Goblins' : 'Collect 5 Crystals'
              }
            ]
          }
        });
      } else if (clean.includes('variable') || clean.includes('score') || clean.includes('health') || clean.includes('points')) {
        let key = 'score';
        let val: any = 100;
        if (clean.includes('health')) { key = 'health'; val = 100; }
        else if (clean.includes('coins')) { key = 'coins'; val = 0; }
        else if (clean.includes('unlocked')) { key = 'unlocked'; val = true; }

        // Try to parse number if any
        const numMatch = clean.match(/\d+/);
        if (numMatch) val = Number(numMatch[0]);

        textContent = `I will define a global game variable **"${key}"** set to **${val}**.`;
        label = `Set Variable: ${key}`;
        actions.push({
          targetId: 'variables_registry',
          targetName: 'Game Variables',
          before: {},
          after: {},
          cmd: 'set_game_variable',
          params: { key, value: val }
        });
      } else {
        textContent = `I will create a scripted event block for your level progression.`;
        label = `Create Scripted Event`;
        actions.push({
          targetId: 'events_registry',
          targetName: 'Scripted Events',
          before: {},
          after: {},
          cmd: 'add_scripted_event',
          params: {
            name: 'AI Generated Event',
            triggerType: 'on_level_start',
            actions: [
              { type: 'dialogue', params: { text: 'Welcome to the level!' } }
            ]
          }
        });
      }

      return {
        ...baseMsg,
        content: `${textContent}\n\nHit "Make It Happen" to run this command!`,
        actionType: 'scene_action',
        actionLabel: label,
        actions
      };
    }

    // ── Question / Help ──
    case 'QUESTION': {
      return {
        ...baseMsg,
        content: `Great question! Here's what I can do for you right now in **Offline Sandbox Mode**:\n\n🎮 **Game Blueprints** — Tell me a genre (e.g., "side-scroller brawler", "FPS shooter", "top-down RPG") and I'll configure camera, physics, and workspace settings.\n\n🛠️ **Structural Actions** — Tell me to add or delete objects (e.g., "add a red sphere", "delete selected object", "spawn a light").\n\n📜 **Gameplay Quests & Events** — Create progression rules (e.g., "create a quest to defeat 5 enemies", "create a scripted event").\n\n🌐 **Global Workspace** — Describe a mood or atmosphere (e.g., "make it spooky", "sunset vibes", "rainy storm") and I'll apply lighting & weather presets.\n\n📦 **Object Editing** — Select an object and describe what it should look/feel like (e.g., "make it metal", "turn it into glass", "make it super heavy").\n\nJust type naturally — I'll figure out the rest!`,
        actionType: 'text',
      };
    }

    // ── Conversational Fallback ──
    case 'CONVERSATIONAL':
    default: {
      return {
        ...baseMsg,
        content: `I'm here to help! I can do a few things for you:\n\n• **Set up a game genre** — just tell me the type (e.g., "beat em up", "platformer", "horror")\n• **Change the atmosphere** — try "make it dark", "sunset vibes", or "rainy"\n• **Modify objects** — select something and say "make it metal", "turn it to glass", etc.\n\nWhat are we working on?`,
        actionType: 'text',
      };
    }
  }
}
