import React from 'react';
import { vi, beforeAll, afterAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import UpcomingMealsPage from './UpcomingMealsPage';

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  // Wednesday 2026-04-29: week starting 2026-04-27 still has future days (after “today”).
  vi.setSystemTime(new Date('2026-04-29T12:00:00Z'));
});

afterAll(() => {
  vi.useRealTimers();
});

vi.mock('../api/api', () => ({
  getRecipes: vi.fn().mockResolvedValue({
    data: [{ id: 11, name: 'Yummy Dish' }],
  }),
  getMealPlanner: vi.fn().mockResolvedValue({
    data: {
      days: [
        {
          date: '2026-04-27',
          slots: [
            {
              id: 2,
              name: 'Lunch',
              seq: 2,
              servings: 2,
              kcal: 500,
              meal: {
                meal_id: 31,
                id: 11,
                name: 'Yummy Dish',
                servings: 2,
                kcal_per_serving: 650,
                ingredients_added_to_shopping_at: '2026-04-27T12:00:00.000Z',
                leftover_from_meal_id: 20,
                leftover_source: {
                  meal_id: 20,
                  meal_date: '2026-04-26',
                  meal_slot_id: 4,
                  meal_slot_name: 'Dinner',
                },
              },
            },
          ],
        },
      ],
    },
  }),
  getRecipeCategories: vi.fn().mockResolvedValue({ data: [] }),
  assignMealPlannerMeal: vi.fn().mockResolvedValue({ data: {} }),
  clearMealPlannerMeal: vi.fn().mockResolvedValue({ data: {} }),
  updateMealPlannerServings: vi.fn().mockResolvedValue({ data: {} }),
  updateMealPlannerSlotKcal: vi.fn().mockResolvedValue({ data: {} }),
  autoLinkMealPlannerLeftovers: vi.fn().mockResolvedValue({ data: { linked: [] } }),
  addMealPlannerWeekToShoppingList: vi.fn().mockResolvedValue({
    data: { added: 0, skipped: 0, meals: [] },
  }),
}));

describe('UpcomingMealsPage', () => {
  it('renders daily kcal total and leftover source details', async () => {
    const { container } = render(
      <MemoryRouter>
        <UpcomingMealsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Total: 650 kcal\/serving/)).toBeInTheDocument();
    expect(screen.getByText('kcal/serving')).toBeInTheDocument();
    expect(screen.getByText('650')).toBeInTheDocument();
    expect(screen.getByText(/Leftover from/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Auto-link leftovers/i })).toBeInTheDocument();
    expect(screen.getByText('On list')).toBeInTheDocument();

    const overZone = container.querySelector('.meal-planner-dropzone-over');
    expect(overZone).toBeTruthy();
  });

  it('add week to shopping list calls API with week start', async () => {
    const api = await import('../api/api');
    render(
      <MemoryRouter>
        <UpcomingMealsPage />
      </MemoryRouter>
    );

    await screen.findByText(/Total: 650 kcal\/serving/);
    fireEvent.click(screen.getByRole('button', { name: /to shopping list$/i }));

    await waitFor(() => {
      expect(api.addMealPlannerWeekToShoppingList).toHaveBeenCalled();
      const [startArg, scaleArg, todayArg] = api.addMealPlannerWeekToShoppingList.mock.calls[0];
      expect(startArg).toBe('2026-04-27');
      expect(scaleArg).toBe(1);
      expect(todayArg).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});
