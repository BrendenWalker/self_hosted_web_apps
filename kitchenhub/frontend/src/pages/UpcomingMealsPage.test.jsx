import React from 'react';
import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import UpcomingMealsPage from './UpcomingMealsPage';

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

    const overZone = container.querySelector('.meal-planner-dropzone-over');
    expect(overZone).toBeTruthy();
  });
});
