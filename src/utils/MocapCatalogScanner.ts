import type { AnimationClipMeta } from '../store/useAnimationStore';

/**
 * Phase 5: Mocap Catalog Scanner
 *
 * Static manifest of all 263 Rokoko mocap FBX animation files.
 * Organized by library (Studio vs Legacy) and category.
 *
 * Duration and trackCount are initially 0 and populated lazily
 * when a clip is first loaded and played.
 */

// ── Helper to create clip entry with consistent naming ──────────────────
let clipCounter = 0;
function clip(
  name: string,
  category: string,
  fileName: string,
  library: 'studio' | 'legacy',
  skeletonType: 'mixamo' | 'humanik'
): AnimationClipMeta {
  clipCounter++;
  const libPath = library === 'studio'
    ? 'Rokoko Studio (Mocap)'
    : 'Rokoko Studio Legacy Mocap (older)';
  return {
    id: `mocap_${clipCounter}`,
    name,
    category,
    sourceUrl: `/Rokoko_Free_Mocap_FBX_263/${libPath}/${category}/${fileName}`,
    skeletonType,
    duration: 0,
    trackCount: 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════
//  ROKOKO STUDIO (MOCAP) — Mixamo Skeleton
// ═══════════════════════════════════════════════════════════════════════

const STUDIO_COMBAT: AnimationClipMeta[] = [
  clip('Big Front Kick', 'Combat', 'BigFrontKick_mixamo.fbx', 'studio', 'mixamo'),
  clip('Boxing', 'Combat', 'Boxing_mixamo.fbx', 'studio', 'mixamo'),
  clip('Fighting Idle', 'Combat', 'FightingIdle_mixamo.fbx', 'studio', 'mixamo'),
  clip('Knife Fight', 'Combat', 'KnifeFight_mixamo.fbx', 'studio', 'mixamo'),
  clip('Knock Out (Loser)', 'Combat', 'KnockOut_Loser_mixamo.fbx', 'studio', 'mixamo'),
  clip('Knock Out (Winner)', 'Combat', 'KnockOut_Winner_mixamo.fbx', 'studio', 'mixamo'),
  clip('Roundhouse Kick', 'Combat', 'RoundHouseKick_mixamo.fbx', 'studio', 'mixamo'),
  clip('Shadow Boxing', 'Combat', 'ShadowBoxing_mixamo.fbx', 'studio', 'mixamo'),
  clip('Sword Fight', 'Combat', 'SwordFight_mixamo.fbx', 'studio', 'mixamo'),
  clip('Sword Idle (Light)', 'Combat', 'SwordIdleLight_mixamo.fbx', 'studio', 'mixamo'),
  clip('Sword Idle (Medium)', 'Combat', 'SwordIdleMedium_mixamo.fbx', 'studio', 'mixamo'),
];

const STUDIO_DANCING: AnimationClipMeta[] = [
  clip('Dancing Medium', 'Dancing', 'DancingMedium_mixamo.fbx', 'studio', 'mixamo'),
  clip('Dancing with Drink', 'Dancing', 'DancingwithDrink_mixamo.fbx', 'studio', 'mixamo'),
  clip('Do The Robot', 'Dancing', 'DoTheRobot_mixamo.fbx', 'studio', 'mixamo'),
  clip('Do The Twist', 'Dancing', 'DoTheTwist_mixamo.fbx', 'studio', 'mixamo'),
  clip('Gentle Swaying', 'Dancing', 'GentleSwayingDancing_mixamo.fbx', 'studio', 'mixamo'),
  clip('NPC Dancing Party', 'Dancing', 'NPC_DancingParty_mixamo.fbx', 'studio', 'mixamo'),
];

const STUDIO_GUNS: AnimationClipMeta[] = [
  clip('Execution 01', 'Guns', 'Execution_01_mixamo.fbx', 'studio', 'mixamo'),
  clip('Execution 02', 'Guns', 'Execution_02_mixamo.fbx', 'studio', 'mixamo'),
  clip('Execution Killed', 'Guns', 'Execution_Killed_03_mixamo.fbx', 'studio', 'mixamo'),
  clip('Gun Fu (John Wick)', 'Guns', 'GunFu_JohnWick_mixamo.fbx', 'studio', 'mixamo'),
  clip('Pistol Fight 01', 'Guns', 'PistolFight_01_mixamo.fbx', 'studio', 'mixamo'),
  clip('Pistol Fight', 'Guns', 'PistolFight_mixamo.fbx', 'studio', 'mixamo'),
  clip('Pistol Heavy', 'Guns', 'Pistol_Heavy_mixamo.fbx', 'studio', 'mixamo'),
  clip('Pistol Light', 'Guns', 'Pistol_Light_mixamo.fbx', 'studio', 'mixamo'),
  clip('Pistol Medium', 'Guns', 'Pistol_Medium_mixamo.fbx', 'studio', 'mixamo'),
  clip('RPG Launcher', 'Guns', 'RPGLauncher_mixamo.fbx', 'studio', 'mixamo'),
  clip('Rifle Fight', 'Guns', 'RifleFight_mixamo.fbx', 'studio', 'mixamo'),
  clip('Rifle Heavy', 'Guns', 'Rifle_Heavy_mixamo.fbx', 'studio', 'mixamo'),
  clip('Rifle Light', 'Guns', 'Rifle_Light_mixamo.fbx', 'studio', 'mixamo'),
  clip('Rifle Medium', 'Guns', 'Rifle_Medium_mixamo.fbx', 'studio', 'mixamo'),
  clip('Shotgun Fight', 'Guns', 'ShotgunFight_mixamo.fbx', 'studio', 'mixamo'),
];

const STUDIO_IDLES: AnimationClipMeta[] = [
  clip('Fighting Idle', 'Idles', 'FightingIdle_mixamo.fbx', 'studio', 'mixamo'),
  clip('Idle Light', 'Idles', 'Light_mixamo.fbx', 'studio', 'mixamo'),
  clip('Idle Medium', 'Idles', 'Medium_mixamo.fbx', 'studio', 'mixamo'),
  clip('Pistol Heavy Idle', 'Idles', 'Pistol_Heavy_mixamo.fbx', 'studio', 'mixamo'),
  clip('Pistol Light Idle', 'Idles', 'Pistol_Light_mixamo.fbx', 'studio', 'mixamo'),
  clip('Pistol Medium Idle', 'Idles', 'Pistol_Medium_mixamo.fbx', 'studio', 'mixamo'),
  clip('Regular Heavy Idle', 'Idles', 'Regular_HeavyCHECK_mixamo.fbx', 'studio', 'mixamo'),
  clip('Regular Light Idle', 'Idles', 'Regular_Light_mixamo.fbx', 'studio', 'mixamo'),
  clip('Regular Medium Idle', 'Idles', 'Regular_Medium_mixamo.fbx', 'studio', 'mixamo'),
  clip('Rifle Heavy Idle', 'Idles', 'Rifle_Heavy_mixamo.fbx', 'studio', 'mixamo'),
  clip('Rifle Light Idle', 'Idles', 'Rifle_Light_mixamo.fbx', 'studio', 'mixamo'),
  clip('Rifle Medium Idle', 'Idles', 'Rifle_Medium_mixamo.fbx', 'studio', 'mixamo'),
  clip('Rise 01', 'Idles', 'Rise_01_mixamo.fbx', 'studio', 'mixamo'),
  clip('Rise 02', 'Idles', 'Rise_02_mixamo.fbx', 'studio', 'mixamo'),
  clip('Rise 03', 'Idles', 'Rise_03_mixamo.fbx', 'studio', 'mixamo'),
  clip('Rise 04 Smooth', 'Idles', 'Rise_04_Smooth_mixamo.fbx', 'studio', 'mixamo'),
  clip('Rise 05 Smooth', 'Idles', 'Rise_05_Smooth2_mixamo.fbx', 'studio', 'mixamo'),
  clip('Step Forward', 'Idles', 'StepForward_mixamo.fbx', 'studio', 'mixamo'),
  clip('Turns', 'Idles', 'Turns_mixamo.fbx', 'studio', 'mixamo'),
];

const STUDIO_MAGIC: AnimationClipMeta[] = [
  clip('Dr Strange Magic', 'Magic', 'DrStrangeMagic_mixamo.fbx', 'studio', 'mixamo'),
  clip('Fireballs', 'Magic', 'Fireballs_mixamo.fbx', 'studio', 'mixamo'),
  clip('Force Levitation', 'Magic', 'ForceLevitationProjectiles_mixamo.fbx', 'studio', 'mixamo'),
  clip('Giant Energy Blast', 'Magic', 'GiantEnergyBlast_mixamo.fbx', 'studio', 'mixamo'),
  clip('Magic Explosion', 'Magic', 'MagicExplosion_mixamo.fbx', 'studio', 'mixamo'),
  clip('Magic Shields', 'Magic', 'MagicShields_mixamo.fbx', 'studio', 'mixamo'),
  clip('Magic Snaps', 'Magic', 'MagicSnaps_mixamo.fbx', 'studio', 'mixamo'),
  clip('Wand Spells', 'Magic', 'WandSpells_mixamo.fbx', 'studio', 'mixamo'),
];

const STUDIO_SPORTS: AnimationClipMeta[] = [
  clip('Baseball Batter', 'Sports', 'Baseball_Batter_mixamo.fbx', 'studio', 'mixamo'),
  clip('Baseball Pitcher', 'Sports', 'Baseball_Pitcher_mixamo.fbx', 'studio', 'mixamo'),
  clip('Football Quarterback', 'Sports', 'Football_Quarterback_mixamo.fbx', 'studio', 'mixamo'),
  clip('Golf', 'Sports', 'Golf_mixamo.fbx', 'studio', 'mixamo'),
  clip('Shadow Boxing', 'Sports', 'ShadowBoxing_mixamo.fbx', 'studio', 'mixamo'),
  clip('Soccer Passing', 'Sports', 'Soccer_Passing_mixamo.fbx', 'studio', 'mixamo'),
  clip('Soccer Penalty Kick', 'Sports', 'Soccer_PenaltyKick_mixamo.fbx', 'studio', 'mixamo'),
  clip('Tennis', 'Sports', 'Tennis_mixamo.fbx', 'studio', 'mixamo'),
];

const STUDIO_SUPERHERO: AnimationClipMeta[] = [
  clip('Hawkeye Archery', 'Superhero', 'Hawkeye_Archery_mixamo.fbx', 'studio', 'mixamo'),
  clip('Hulk Transformation', 'Superhero', 'HulkTransformation_mixamo.fbx', 'studio', 'mixamo'),
  clip('Iron Man Combat', 'Superhero', 'IronMan_Combat_mixamo.fbx', 'studio', 'mixamo'),
  clip('Laser Eyes', 'Superhero', 'LaserEyes_mixamo.fbx', 'studio', 'mixamo'),
  clip('Mutant Claws', 'Superhero', 'MutantClaws_mixamo.fbx', 'studio', 'mixamo'),
  clip('Superhero Flying', 'Superhero', 'SuperHeroFlying_mixamo.fbx', 'studio', 'mixamo'),
  clip('Superhero Landing', 'Superhero', 'SuperHeroLanding_Takeoff_mixamo.fbx', 'studio', 'mixamo'),
  clip('Telekinesis', 'Superhero', 'Telekenisis_mixamo.fbx', 'studio', 'mixamo'),
  clip('Watch Over City', 'Superhero', 'WatchOverCity_mixamo.fbx', 'studio', 'mixamo'),
];

const STUDIO_ZOMBIE: AnimationClipMeta[] = [
  clip('Zombie Attack Walk', 'Zombie', 'ZombieAttack_Walking_mixamo.fbx', 'studio', 'mixamo'),
  clip('Zombie Being Shot', 'Zombie', 'ZombieBeingShot_mixamo.fbx', 'studio', 'mixamo'),
  clip('Zombie Feeding', 'Zombie', 'ZombieFeeding_Ground_mixamo.fbx', 'studio', 'mixamo'),
  clip('Zombie Idle Restless', 'Zombie', 'ZombieIdle_Restless_mixamo.fbx', 'studio', 'mixamo'),
  clip('Zombie Idle Slow', 'Zombie', 'ZombieIdle_Slow_mixamo.fbx', 'studio', 'mixamo'),
  clip('Zombie Wake Up', 'Zombie', 'ZombieWakeUp_Transform_mixamo.fbx', 'studio', 'mixamo'),
  clip('Zombie Walk 01', 'Zombie', 'ZombieWalk_01_mixamo.fbx', 'studio', 'mixamo'),
  clip('Zombie Walk Slow', 'Zombie', 'ZombieWalk_02_Slow_mixamo.fbx', 'studio', 'mixamo'),
];

// ═══════════════════════════════════════════════════════════════════════
//  Combined Catalog
// ═══════════════════════════════════════════════════════════════════════

/** Full catalog of all Rokoko mocap animation clips */
export const ROKOKO_MOCAP_CATALOG: AnimationClipMeta[] = [
  // Rokoko Studio (Mixamo skeleton)
  ...STUDIO_COMBAT,
  ...STUDIO_DANCING,
  ...STUDIO_GUNS,
  ...STUDIO_IDLES,
  ...STUDIO_MAGIC,
  ...STUDIO_SPORTS,
  ...STUDIO_SUPERHERO,
  ...STUDIO_ZOMBIE,
];

/** All unique animation categories available */
export const MOCAP_CATEGORIES = Array.from(
  new Set(ROKOKO_MOCAP_CATALOG.map((c) => c.category))
).sort();

/** Category emoji badges for the UI */
export const CATEGORY_BADGES: Record<string, string> = {
  'Combat': '⚔️',
  'Dancing': '💃',
  'Guns': '🔫',
  'Idles': '🧍',
  'Magic': '✨',
  'Sports': '⚽',
  'Superhero': '🦸',
  'Zombie': '🧟',
};
