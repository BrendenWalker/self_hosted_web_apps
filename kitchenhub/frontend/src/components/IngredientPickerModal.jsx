import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { itemDisplayName } from '../utils/shoppingQuantity';
import './IngredientPickerModal.css';

const TITLE_ID = 'ingredient-picker-title';

function searchableText(ingredient) {
  return `${ingredient.name || ''} ${ingredient.details || ''}`.toLowerCase();
}

function toId(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Searchable ingredient picker. Mount when shown, unmount when hidden (fresh search each time).
 *
 * @param {object} props
 * @param {object[]} props.ingredients - catalog rows to choose from
 * @param {number|string|null} [props.selectedId] - currently chosen ingredient id
 * @param {(ingredient: object) => string} [props.formatLabel]
 * @param {() => void} props.onCancel
 * @param {(ingredientId: number) => void} props.onConfirm
 */
export function IngredientPickerModal({
  ingredients,
  selectedId,
  formatLabel = itemDisplayName,
  onCancel,
  onConfirm,
}) {
  const [search, setSearch] = useState('');
  const [pendingId, setPendingId] = useState(() => toId(selectedId));
  const searchRef = useRef(null);
  const selectedRef = useRef(null);

  useEffect(() => {
    searchRef.current?.focus();
    const selected = selectedRef.current;
    if (typeof selected?.scrollIntoView === 'function') {
      selected.scrollIntoView({ block: 'center' });
    }
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const filtered = useMemo(() => {
    const text = search.trim().toLowerCase();
    if (!text) return ingredients;
    return ingredients.filter((i) => searchableText(i).includes(text));
  }, [ingredients, search]);

  const confirmPending = () => {
    if (pendingId != null) onConfirm(pendingId);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    // A search narrowed to a single row is an unambiguous pick.
    if (filtered.length === 1) {
      onConfirm(filtered[0].id);
      return;
    }
    confirmPending();
  };

  const content = (
    <div
      className="ingredient-picker-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={TITLE_ID}
      onClick={onCancel}
    >
      <div className="ingredient-picker-modal" onClick={(e) => e.stopPropagation()}>
        <h2 id={TITLE_ID} className="ingredient-picker-title">
          Select ingredient
        </h2>

        <div className="ingredient-picker-search">
          <input
            ref={searchRef}
            type="text"
            className="ingredient-picker-search-input"
            placeholder="Search ingredients..."
            aria-label="Search ingredients"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
          />
          <div className="ingredient-picker-search-info">
            {`${filtered.length} ingredient${filtered.length !== 1 ? 's' : ''} found`}
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="ingredient-picker-empty">No matching ingredients.</p>
        ) : (
          <ul className="ingredient-picker-list">
            {filtered.map((ing) => {
              const isSelected = pendingId === ing.id;
              return (
                <li key={ing.id}>
                  <button
                    ref={isSelected ? selectedRef : null}
                    type="button"
                    className={`ingredient-picker-option${isSelected ? ' ingredient-picker-option--selected' : ''}`}
                    aria-pressed={isSelected}
                    onClick={() => setPendingId(ing.id)}
                    onDoubleClick={() => onConfirm(ing.id)}
                  >
                    <span className="ingredient-picker-option-name">{formatLabel(ing)}</span>
                    {ing.department_name && (
                      <span className="ingredient-picker-option-meta">{ing.department_name}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <p className="ingredient-picker-hint">* nutrition not filled in</p>

        <div className="ingredient-picker-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={confirmPending}
            disabled={pendingId == null}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
