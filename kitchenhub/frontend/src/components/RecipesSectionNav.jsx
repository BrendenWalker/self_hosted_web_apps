import React from 'react';
import { NavLink } from 'react-router-dom';

function linkClass({ isActive }) {
  return isActive ? 'recipes-subnav-link active' : 'recipes-subnav-link';
}

function RecipesSectionNav({ className = 'recipes-subnav' }) {
  return (
    <nav className={className} aria-label="Recipes section">
      <NavLink to="/recipes" end className={linkClass}>
        Recipes
      </NavLink>
      <NavLink to="/recipes/ingredients" className={linkClass}>
        Ingredients
      </NavLink>
      <NavLink to="/recipes/upcoming" className={linkClass}>
        Meal planner
      </NavLink>
      <NavLink to="/recipes/meal-slots" className={linkClass}>
        Meal slots
      </NavLink>
    </nav>
  );
}

export default RecipesSectionNav;
