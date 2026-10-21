// The built-in "Wavedeck Midnight" skin is just the default theme recipe.
import { buildSheetsSync, DEFAULT_RECIPE, themeColors, normalizeRecipe } from './themegen.js';

const recipe = normalizeRecipe(DEFAULT_RECIPE);
const colors = themeColors(recipe);
export const DEFAULT_VISCOLORS = colors.vis;
export const DEFAULT_PLEDIT = { ...colors.pledit, font: 'Segoe UI, Tahoma, sans-serif' };
export function buildDefaultSheets() { return buildSheetsSync(recipe, 1); }
