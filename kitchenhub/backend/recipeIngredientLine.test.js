const { recipeLineGrams, recipeLineKcal } = require('./recipeIngredientLine');

describe('recipeIngredientLine', () => {
  it('recipeLineGrams uses qty × to_grams for standard units', () => {
    const row = {
      qty: 2,
      measurement_id: 1,
      measurement_name: 'tbsp',
      measurement_to_grams: 15,
      ingredient_unit_grams: null,
      shopping_measure_grams: null,
    };
    expect(recipeLineGrams(row)).toBe(30);
  });

  it('recipeLineKcal scales by recipe qty when nutrition uses the same measurement', () => {
    const row = {
      kcal: 89,
      kcal_qty: 100,
      kcal_measurement_id: 1,
      qty: 250,
      measurement_id: 1,
      measurement_name: 'g',
      measurement_to_grams: 1,
      kcal_measurement_name: 'g',
      kcal_measurement_to_grams: 1,
      ingredient_unit_grams: null,
      shopping_measure_grams: null,
    };
    expect(recipeLineKcal(row)).toBe(223);
  });

  it('recipeLineKcal uses gram bridge when recipe unit differs from kcal reference unit', () => {
    const row = {
      kcal: 120,
      kcal_qty: 100,
      kcal_measurement_id: 10,
      qty: 1,
      measurement_id: 20,
      measurement_name: 'cup',
      measurement_to_grams: 240,
      kcal_measurement_name: 'g',
      kcal_measurement_to_grams: 1,
      ingredient_unit_grams: null,
      shopping_measure_grams: null,
    };
    expect(recipeLineKcal(row)).toBe(288);
  });
});
