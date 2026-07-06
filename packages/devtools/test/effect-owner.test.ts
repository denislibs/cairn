import { describe, it, expect, beforeEach } from 'vitest';
import { tagEffect, effectOwnerOf, resetEffectOwner } from '../src/effect-owner';

describe('effect-owner', () => {
  beforeEach(() => resetEffectOwner());
  it('tags and resolves an effect owner', () => {
    const node = {};
    tagEffect(node, 7, 'style');
    expect(effectOwnerOf(node)).toEqual({ instanceId: 7, label: 'style' });
  });
  it('returns undefined for an untagged effect', () => {
    expect(effectOwnerOf({})).toBeUndefined();
  });
});
