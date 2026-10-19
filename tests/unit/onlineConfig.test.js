import { describe, expect, it } from 'vitest';
import { ONLINE } from '../../src/onlineConfig.js';

describe('onlineConfig', () => {
  it('is a boolean and does not require the Firebase SDK', () => {
    expect(typeof ONLINE).toBe('boolean');
  });
});
