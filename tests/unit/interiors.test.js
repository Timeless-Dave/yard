import { describe, expect, it } from 'vitest';
import { interiorType } from '../../src/interiors.js';

describe('interiorType', () => {
  it('opens union, library, and residence halls only', () => {
    expect(interiorType({ special: 'union_cantilever' })).toBe('union');
    expect(interiorType({ special: 'library' })).toBe('library');
    expect(interiorType({ kind: 'dorm', name: 'Harrold Complex' })).toBe('dorm');
    expect(interiorType({ special: 'caldwell', name: 'Caldwell Hall' })).toBeNull();
  });
});
