export interface LocomotionMap {
  idle: string | null;
  walk: string | null;
  run: string | null;
  jump: string | null;
  fall: string | null;
}

/**
 * Intelligent locomotion auto-mapping function tailored to Meshy's specific naming conventions.
 * 
 * Rules:
 * 1. Idle: Match Idle or Idle_[number] (e.g., Idle_6) exactly, or generic fallback.
 * 2. Walk: Match Walking exactly. (Strictly ignore variants like Walk_Backward_While_Shooting).
 * 3. Run: Match RunFast or Running.
 * 4. Jump: Match Regular_Jump or Jump_Run.
 * 5. Fall: Match Fall2 or Falling.
 */
export function autoMapLocomotion(clipNames: string[]): LocomotionMap {
  const findMatch = (
    exacts: string[],
    regexes: RegExp[],
    includes: string[],
    excludes: string[]
  ): string | null => {
    // 1. Exact matches first (case-insensitive)
    for (const exact of exacts) {
      const match = clipNames.find(c => c.toLowerCase() === exact.toLowerCase());
      if (match) return match;
    }

    // 2. Regex matches next (tested against exact clip names)
    for (const regex of regexes) {
      const match = clipNames.find(c => regex.test(c));
      if (match) return match;
    }

    // 3. Inclusion check with strict exclusions
    for (const name of clipNames) {
      const lower = name.toLowerCase();
      const hasInclude = includes.some(inc => lower.includes(inc.toLowerCase()));
      const hasExclude = excludes.some(exc => lower.includes(exc.toLowerCase()));
      if (hasInclude && !hasExclude) {
        return name;
      }
    }

    // 4. Loose fallback (just check inclusions if no strict match was found)
    for (const name of clipNames) {
      const lower = name.toLowerCase();
      if (includes.some(inc => lower.includes(inc.toLowerCase()))) {
        return name;
      }
    }

    return null;
  };

  // Idle: Match Idle or Idle_[number] (e.g., Idle_6)
  const idle = findMatch(
    ['idle', 'idle_3', 'stay', 'pose'],
    [/^idle_\d+$/i],
    ['idle'],
    ['walk', 'run', 'turn', 'step', 'jump', 'fall', 'hit', 'die', 'dead']
  );

  // Walk: Match Walking exactly. (Strictly ignore variants like Walk_Backward_While_Shooting)
  const walk = findMatch(
    ['walking', 'walk'],
    [],
    ['walk'],
    ['backward', 'back', 'turn', 'run', 'sprint', 'jump', 'fall', 'hit', 'shooting', 'aim', 'combat', 'style', 'with_weapon']
  );

  // Run: Match RunFast or Running
  const run = findMatch(
    ['runfast', 'running', 'run'],
    [],
    ['run', 'sprint', 'jog'],
    ['backward', 'back', 'turn', 'walk', 'jump', 'fall', 'hit']
  );

  // Jump: Match Regular_Jump or Jump_Run
  const jump = findMatch(
    ['regular_jump', 'jump_run', 'jump'],
    [],
    ['jump', 'leap', 'hop'],
    ['fall', 'land', 'down']
  );

  // Fall: Match Fall2 or Falling
  const fall = findMatch(
    ['fall2', 'falling', 'fall'],
    [/^fall\d*$/i],
    ['fall', 'drop'],
    ['jump', 'land', 'up', 'hit']
  );

  return { idle, walk, run, jump, fall };
}
