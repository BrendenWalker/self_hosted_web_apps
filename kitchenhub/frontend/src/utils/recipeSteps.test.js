import { describe, expect, it } from 'vitest';
import { parseRecipeSteps } from './recipeSteps';

describe('parseRecipeSteps', () => {
  it('returns empty for null, empty, or whitespace', () => {
    expect(parseRecipeSteps(null)).toEqual([]);
    expect(parseRecipeSteps('')).toEqual([]);
    expect(parseRecipeSteps('  \n  ')).toEqual([]);
  });

  it('returns one step for a single line without newlines', () => {
    expect(parseRecipeSteps('Mix well.')).toEqual(['Mix well.']);
  });

  it('splits on single newlines when there are no blank-line paragraphs', () => {
    expect(parseRecipeSteps('a\nb\nc')).toEqual(['a', 'b', 'c']);
  });

  it('normalizes CRLF and splits paragraphs on blank lines', () => {
    expect(parseRecipeSteps('a\r\n\r\nb')).toEqual(['a', 'b']);
  });

  it('uses paragraph chunks when multiple blank-line-separated blocks exist', () => {
    const text = 'First block\nstill first\n\nSecond block';
    expect(parseRecipeSteps(text)).toEqual(['First block\nstill first', 'Second block']);
  });

  it('trims outer whitespace', () => {
    expect(parseRecipeSteps('  hello  ')).toEqual(['hello']);
  });
});
