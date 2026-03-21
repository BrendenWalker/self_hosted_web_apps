/**
 * One-off helper: print ingredient-ish lines from Recipe/Text/PDF/*.txt for manual curation.
 * node scripts/extract-ingredient-blocks.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PDF_DIR = path.resolve(__dirname, '../Recipe/Text/PDF');
const SKIP = new Set([
  'DUO-Series-Manual-English-January-24-2018-web.txt',
  'IP_for_Beginners.txt',
  'Indian Recipes.txt',
  'Vegetable Recipes.txt',
  'Salads Recipes.txt',
]);

const files = fs
  .readdirSync(PDF_DIR)
  .filter((f) => f.endsWith('.txt') && !SKIP.has(f))
  .sort((a, b) => a.localeCompare(b));

for (const f of files) {
  const raw = fs.readFileSync(path.join(PDF_DIR, f), 'utf8');
  const lines = raw.split(/\r?\n/);
  console.log('\n========', f, '========');
  let i = 0;
  for (; i < lines.length; i++) {
    const L = lines[i].trim();
    if (/^ingredients$/i.test(L) || /^ingredients?:$/i.test(L)) {
      i++;
      break;
    }
  }
  let end = 0;
  for (let j = i; j < Math.min(i + 80, lines.length); j++) {
    const L = lines[j].trim();
    if (
      /^(instructions|directions|method|procedure|equipment|notes|nutrition)$/i.test(
        L
      ) ||
      /^[0-9]+\.\s/.test(L)
    ) {
      end = j;
      break;
    }
  }
  let out = lines.slice(i, end || i + 60).join('\n');
  if (!out.trim()) out = lines.slice(0, 45).join('\n');
  console.log(out.slice(0, 3500));
}
