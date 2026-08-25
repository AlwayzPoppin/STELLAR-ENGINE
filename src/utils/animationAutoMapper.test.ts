import { describe, it, expect } from 'vitest';
import { autoMapLocomotion } from './animationAutoMapper';

describe('autoMapLocomotion', () => {
  it('should resolve standard locomotion clips with case-insensitive exact matching', () => {
    const clips = ['Idle', 'Walk', 'Run', 'Jump', 'Fall'];
    const result = autoMapLocomotion(clips);
    expect(result.idle).toBe('Idle');
    expect(result.walk).toBe('Walk');
    expect(result.run).toBe('Run');
    expect(result.jump).toBe('Jump');
    expect(result.fall).toBe('Fall');
  });

  it('should apply strict exclusion rules to prevent incorrect assignments', () => {
    const clips = [
      'Idle_Turn_Left',
      'Idle_3',
      'Walk_Backward',
      'Walking',
      'Run_Fast_2',
      'Jump_Run',
      'Parkour_Vault_2'
    ];
    const result = autoMapLocomotion(clips);
    expect(result.idle).toBe('Idle_3'); // Excluded "Idle_Turn_Left" due to "Turn"
    expect(result.walk).toBe('Walking'); // Excluded "Walk_Backward" due to "Backward"
    expect(result.run).toBe('Run_Fast_2');
    expect(result.jump).toBe('Jump_Run');
  });

  it('should fall back to general inclusion if strict exclusions yield nothing', () => {
    const clips = ['Walk_Backward', 'Idle_Turn_Left'];
    const result = autoMapLocomotion(clips);
    expect(result.idle).toBe('Idle_Turn_Left');
    expect(result.walk).toBe('Walk_Backward');
  });

  it('should return null for states that have no matches at all', () => {
    const clips = ['Dead', 'Shoot', 'Reload'];
    const result = autoMapLocomotion(clips);
    expect(result.idle).toBeNull();
    expect(result.walk).toBeNull();
    expect(result.run).toBeNull();
    expect(result.jump).toBeNull();
    expect(result.fall).toBeNull();
  });
});
