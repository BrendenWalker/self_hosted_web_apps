import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './RecipeMakeItOverlay.css';

function getFullscreenElement() {
  return (
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    null
  );
}

function requestFullscreenEl(el) {
  if (!el) return Promise.resolve();
  const fn = el.requestFullscreen || el.webkitRequestFullscreen;
  if (typeof fn !== 'function') return Promise.resolve();
  return Promise.resolve(fn.call(el)).catch(() => {});
}

function exitFullscreenDoc() {
  const exit = document.exitFullscreen || document.webkitExitFullscreen;
  if (typeof exit !== 'function') return Promise.resolve();
  return Promise.resolve(exit.call(document)).catch(() => {});
}

/**
 * Cooking-mode overlay. Mount when shown, unmount when hidden (fresh checkbox state each time).
 *
 * @param {object} props
 * @param {string} props.recipeName
 * @param {{ id: number, line: string }[]} props.ingredients
 * @param {string[]} props.steps
 * @param {() => void} props.onClose
 */
export function RecipeMakeItOverlay({ recipeName, ingredients, steps, onClose }) {
  const overlayRef = useRef(null);
  const scrollRef = useRef(null);
  const afterInitialScrollRef = useRef(false);
  const [checkedIngredientIds, setCheckedIngredientIds] = useState(() => new Set());
  const [checkedStepIndexes, setCheckedStepIndexes] = useState(() => new Set());

  const handleClose = useCallback(() => {
    const fsEl = getFullscreenElement();
    const root = overlayRef.current;
    if (fsEl && root && (fsEl === root || root.contains(fsEl))) {
      exitFullscreenDoc();
    }
    onClose();
  }, [onClose]);

  const scrollFirstUncheckedIntoView = useCallback((smooth) => {
    const root = scrollRef.current;
    if (!root) return;
    const first = root.querySelector('.recipe-make-it-row:not(.recipe-make-it-row--done)');
    if (first) {
      first.scrollIntoView({ block: 'start', behavior: smooth ? 'smooth' : 'auto' });
      return;
    }
    const last = root.querySelector('.recipe-make-it-row:last-of-type');
    last?.scrollIntoView({ block: 'end', behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  useLayoutEffect(() => {
    scrollFirstUncheckedIntoView(afterInitialScrollRef.current);
    afterInitialScrollRef.current = true;
  }, [checkedIngredientIds, checkedStepIndexes, scrollFirstUncheckedIntoView]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
      const fsEl = getFullscreenElement();
      const root = overlayRef.current;
      if (fsEl && root && (fsEl === root || root.contains(fsEl))) {
        exitFullscreenDoc();
      }
    };
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleClose]);

  useEffect(() => {
    const el = overlayRef.current;
    requestFullscreenEl(el);
  }, []);

  const toggleIngredient = (id) => {
    setCheckedIngredientIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleStep = (index) => {
    setCheckedStepIndexes((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const titleId = 'recipe-make-it-title';

  const content = (
    <div
      ref={overlayRef}
      className="recipe-make-it-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        className="recipe-make-it-close"
        aria-label="Close cooking mode"
        onClick={handleClose}
      >
        ×
      </button>
      <div ref={scrollRef} className="recipe-make-it-scroll">
        <h2 id={titleId} className="recipe-make-it-title">
          {recipeName}
        </h2>

        <h3 className="recipe-make-it-section-title">Ingredients</h3>
        {ingredients.length === 0 ? (
          <p className="recipe-make-it-empty">No ingredients.</p>
        ) : (
          <ul className="recipe-make-it-list">
            {ingredients.map((row) => {
              const done = checkedIngredientIds.has(row.id);
              return (
                <li
                  key={row.id}
                  className={`recipe-make-it-row${done ? ' recipe-make-it-row--done' : ''}`}
                >
                  <label className="recipe-make-it-label">
                    <input
                      type="checkbox"
                      checked={done}
                      onChange={() => toggleIngredient(row.id)}
                    />
                    <span className="recipe-make-it-text">{row.line}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        {steps.length > 0 && (
          <>
            <h3 className="recipe-make-it-section-title">Steps</h3>
            <ul className="recipe-make-it-list recipe-make-it-steps">
              {steps.map((text, index) => {
                const done = checkedStepIndexes.has(index);
                return (
                  <li
                    key={index}
                    className={`recipe-make-it-row${done ? ' recipe-make-it-row--done' : ''}`}
                  >
                    <label className="recipe-make-it-label">
                      <input
                        type="checkbox"
                        checked={done}
                        onChange={() => toggleStep(index)}
                      />
                      <span className="recipe-make-it-text">{text}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
