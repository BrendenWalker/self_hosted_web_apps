import { describe, it, expect } from 'vitest';
import {
  buildRecipeShoppingListNoticeText,
  formatRecipeShoppingListSkippedLine,
  recipeShoppingListNoticeClassName,
} from './recipeShoppingListNotice';

describe('buildRecipeShoppingListNoticeText', () => {
  it('summarizes added and lists skipped with reasons', () => {
    const text = buildRecipeShoppingListNoticeText('Soup', {
      added: [{ item_id: 1 }],
      skipped: [
        {
          ingredient_id: 2,
          ingredient_name: 'Salt',
          reason: 'optional',
        },
        {
          ingredient_id: 3,
          ingredient_name: 'Pepper',
          reason: 'no_to_grams',
          measurement_name: 'pinch',
          to_grams: null,
        },
      ],
    });
    expect(text).toContain('“Soup”: added 1 ingredient line(s)');
    expect(text).toContain('Skipped:');
    expect(text).toContain('Salt — optional');
    expect(text).toContain('Pepper');
    expect(text).toContain('to_grams: none');
  });

  it('warns when nothing added but lines were skipped', () => {
    const text = buildRecipeShoppingListNoticeText('X', {
      added: [],
      skipped: [{ ingredient_id: 1, ingredient_name: 'A', reason: 'no_qty', qty: null }],
    });
    expect(text).toContain('nothing was added');
    expect(recipeShoppingListNoticeClassName({ added: [], skipped: [1] })).toContain('warning');
  });

  it('uses success class when something added', () => {
    expect(recipeShoppingListNoticeClassName({ added: [{}], skipped: [] })).toBe(
      'recipe-shopping-list-notice'
    );
  });
});

describe('formatRecipeShoppingListSkippedLine', () => {
  it('describes missing ingredient_unit_grams', () => {
    expect(
      formatRecipeShoppingListSkippedLine({
        ingredient_name: 'Eggs',
        reason: 'no_ingredient_unit_grams',
        ingredient_unit_grams: null,
      })
    ).toContain('ingredient_unit_grams: none');
  });
});
