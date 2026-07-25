import React from 'react';
import { vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IngredientPickerModal } from './IngredientPickerModal';

const INGREDIENTS = [
  { id: 1, name: 'Butter', details: 'unsalted', department_name: 'Dairy', kcal: 717 },
  { id: 2, name: 'Buttermilk', details: null, department_name: 'Dairy', kcal: null },
  { id: 3, name: 'Flour', details: 'all purpose', department_name: 'Baking', kcal: 364 },
];

function renderPicker(props = {}) {
  const onCancel = vi.fn();
  const onConfirm = vi.fn();
  render(
    <IngredientPickerModal
      ingredients={INGREDIENTS}
      onCancel={onCancel}
      onConfirm={onConfirm}
      {...props}
    />
  );
  return { onCancel, onConfirm };
}

describe('IngredientPickerModal', () => {
  it('lists every ingredient and narrows the list as you search', () => {
    renderPicker();

    expect(screen.getByText('3 ingredients found')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Search ingredients'), {
      target: { value: 'butter' },
    });

    expect(screen.getByText('2 ingredients found')).toBeInTheDocument();
    expect(screen.getByText('Butter (unsalted)')).toBeInTheDocument();
    expect(screen.getByText('Buttermilk')).toBeInTheDocument();
    expect(screen.queryByText('Flour (all purpose)')).not.toBeInTheDocument();
  });

  it('matches on the details text too', () => {
    renderPicker();

    fireEvent.change(screen.getByLabelText('Search ingredients'), {
      target: { value: 'all purpose' },
    });

    expect(screen.getByText('Flour (all purpose)')).toBeInTheDocument();
  });

  it('shows an empty state when nothing matches', () => {
    renderPicker();

    fireEvent.change(screen.getByLabelText('Search ingredients'), {
      target: { value: 'zzz' },
    });

    expect(screen.getByText('No matching ingredients.')).toBeInTheDocument();
  });

  it('confirms the highlighted ingredient with OK', () => {
    const { onConfirm } = renderPicker();

    const ok = screen.getByRole('button', { name: 'OK' });
    expect(ok).toBeDisabled();

    fireEvent.click(screen.getByText('Flour (all purpose)'));
    fireEvent.click(ok);

    expect(onConfirm).toHaveBeenCalledWith(3);
  });

  it('confirms on double click', () => {
    const { onConfirm } = renderPicker();

    fireEvent.dblClick(screen.getByText('Butter (unsalted)'));

    expect(onConfirm).toHaveBeenCalledWith(1);
  });

  it('confirms the only match when pressing Enter in the search box', () => {
    const { onConfirm } = renderPicker();

    const search = screen.getByLabelText('Search ingredients');
    fireEvent.change(search, { target: { value: 'flour' } });
    fireEvent.keyDown(search, { key: 'Enter' });

    expect(onConfirm).toHaveBeenCalledWith(3);
  });

  it('preselects the current ingredient', () => {
    renderPicker({ selectedId: '2' });

    expect(screen.getByRole('button', { name: /Buttermilk/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('button', { name: 'OK' })).toBeEnabled();
  });

  it('cancels on Cancel, overlay click, and Escape', () => {
    const { onCancel } = renderPicker();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('dialog'));
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onCancel).toHaveBeenCalledTimes(3);
  });
});
