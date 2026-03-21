/**
 * One-time import: map raw ingredient strings to canonical item names,
 * optional recipe-line comment (text after comma / prep), and a department category.
 */

/** Full-string aliases before comma-split (canonical name). */
const FULL_ALIASES = {
  'Ancho chile powder': 'Ancho chili powder',
  'Chicken broth, low-sodium': 'Chicken broth',
  'Chicken broth, low sodium': 'Chicken broth',
  'Chicken broth, reduced sodium': 'Chicken broth',
  'Soy sauce, low-sodium': 'Soy sauce',
  'Soy sauce, low sodium': 'Soy sauce',
  'Fresh ginger, grated': 'Fresh Ginger',
  'Ginger, fresh minced': 'Fresh Ginger',
  'Ginger, minced': 'Fresh Ginger',
  'Ginger, grated': 'Fresh Ginger',
  'Ginger, 1 inch': 'Fresh Ginger',
  'Ginger, 2 inch piece': 'Fresh Ginger',
  'Ginger, ground': 'Ginger, ground',
  'Ginger, dried': 'Ginger, ground',
  'Caraway seed': 'Caraway seeds',
  'Bay leaf': 'Bay leaves',
  'Egg': 'Eggs',
  'Corn ears': 'Corn',
  'English cucumber': 'Cucumber',
  'Half and half': 'Half and Half',
  'Oil for frying': 'Vegetable oil',
  'Oil, neutral': 'Vegetable oil',
  'Toasted sesame oil': 'Sesame oil',
  'Sesame oil, toasted': 'Sesame oil',
  'Brown sugar (mongolian)': 'Brown sugar',
  'Brown sugar, dark packed': 'Brown sugar',
  'Brown sugar, dark': 'Brown sugar',
  'Brown sugar, light': 'Brown sugar',
  'Brown sugar, packed': 'Brown sugar',
  'Brown sugar, packed light': 'Brown sugar',
  'Dark brown sugar': 'Brown sugar',
  'Sugar, granulated': 'Sugar',
  'Salt, table': 'Salt',
  'Kosher salt, smoked': 'Kosher salt',
  'Sea salt, coarse': 'Kosher salt',
  'Black pepper, fresh ground': 'Black pepper',
  'Flour, all-purpose': 'All-purpose flour',
  'Flour': 'All-purpose flour',
  'Cheddar cheese, 2 percent': 'Cheddar cheese',
  'Cheddar cheese, shredded': 'Cheddar cheese',
  'Jack cheese, shredded': 'Jack cheese',
  'Mozzarella cheese, shredded': 'Mozzarella cheese',
  'Parmesan cheese, grated': 'Parmesan cheese',
  'Parmesan cheese, shredded': 'Parmesan cheese',
  'Ricotta cheese': 'Ricotta',
  'Cream cheese': 'Cream cheese',
  'American cheese': 'American cheese',
  'Cheese, grated': 'Cheddar cheese',
  'Butter, salted': 'Butter',
  'Butter, unsalted': 'Butter',
  'Butter, melted': 'Butter',
  'Milk, fat-free': 'Milk',
  'Peanut butter, smooth': 'Peanut butter',
  'Creamy peanut butter': 'Peanut butter',
  'Almond butter, creamy': 'Almond butter',
  'Coconut milk, lite canned': 'Coconut milk',
  'Tomatoes, crushed 28 ounce': 'Crushed tomatoes',
  'Tomato paste, small': 'Tomato paste',
  'Tomato sauce, 15 ounce': 'Tomato sauce',
  'Water (mongolian)': 'Water',
  'Water (pintos)': 'Water',
  'Water (slurry)': 'Water',
  'Water (stir fry sauce)': 'Water',
  'Water or stock': 'Water',
  'Water, bottled': 'Water',
  'Water, warm': 'Water',
  'Rice vinegar (mongolian)': 'Rice vinegar',
  'Rice vinegar (stir fry)': 'Rice vinegar',
  'Rice vinegar': 'Rice vinegar',
  'Vinegar, apple cider': 'Apple cider vinegar',
  'Vinegar, cider': 'Apple cider vinegar',
  'Lemon juice, fresh': 'Lemon juice',
  'Limes, juiced': 'Lime juice',
  'Orange, juiced': 'Orange juice',
  'Cilantro, chopped': 'Cilantro',
  'Cilantro, fresh': 'Cilantro',
  'Cilantro, minced': 'Cilantro',
  'Parsley, dried': 'Parsley',
  'Thyme, dried': 'Thyme',
  'Thyme, fresh': 'Thyme',
  'Oregano, dried': 'Oregano',
  'Cinnamon, ground': 'Cinnamon',
  'Paprika, smoked': 'Smoked paprika',
  'Garlic, granulated (garlic rub)': 'Garlic powder',
  'Garlic, granulated (ginger rub)': 'Garlic powder',
  'Garlic salt': 'Garlic salt',
  'Onion powder': 'Onion powder',
  'Chicken breast, boneless skinless': 'Chicken breast',
  'Chicken breast, boneless': 'Chicken breast',
  'Chicken breast, cubed': 'Chicken breast',
  'Pork chops, boneless': 'Pork chops',
  'Pork chops, thick': 'Pork chops',
  'Boston butt pork': 'Pork shoulder',
  'Beef short ribs, boneless': 'Beef short ribs',
  'Ground beef, lean': 'Ground beef',
  'Breakfast sausage, Jimmy Dean': 'Breakfast sausage',
  'Turkey kielbasa': 'Kielbasa',
  'Kielbasa sausage, sliced': 'Kielbasa',
  'Kielbasa, diced': 'Kielbasa',
  'Smoked turkey sausage': 'Smoked sausage',
  'Kidney beans dark red, 15 ounce': 'Kidney beans',
  'Kidney beans light red, 15 ounce': 'Kidney beans',
  'Kidney beans red, 15 ounce': 'Kidney beans',
  'Kidney beans, 15 ounce': 'Kidney beans',
  'Kidney beans, 15.5 ounce': 'Kidney beans',
  'Black beans, 14 ounce': 'Black beans',
  'Black beans, 15.5 ounce': 'Black beans',
  'Garbanzo beans, 15.5 ounce': 'Garbanzo beans',
  'Great northern beans, 15 ounce': 'Great northern beans',
  'Butter beans, 15 ounce': 'Butter beans',
  'Hominy, 15.5 ounce': 'Hominy',
  'Hominy, white 28 ounce': 'Hominy',
  'Hominy, white canned': 'Hominy',
  'Chickpeas, 15 ounce': 'Chickpeas',
  'Sauerkraut, 15 ounce': 'Sauerkraut',
  'Sauerkraut, rinsed drained': 'Sauerkraut',
  'Water chestnuts, 8 ounce': 'Water chestnuts',
  'Coleslaw mix, 16 ounce': 'Coleslaw mix',
  'Fettuccine, dry': 'Fettuccine',
  'Ramen noodles, dry': 'Ramen noodles',
  'Manicotti shells': 'Manicotti',
  'Panko breadcrumbs': 'Panko',
  'Breadcrumbs, dry': 'Breadcrumbs',
  'Cornmeal, coarse': 'Cornmeal',
  'Oats, Quaker': 'Rolled oats',
  'Oats, old fashioned': 'Rolled oats',
  'Steel-cut oats': 'Steel-cut oats',
  'Long grain brown rice': 'Brown rice',
  'Rice, long grain white': 'White rice',
  'Rice, white uncooked': 'White rice',
  'Glutinous rice': 'Sushi rice',
  'Lentils, French green': 'Lentils',
  'Lentils, brown': 'Lentils',
  'Lentils, dry': 'Lentils',
  'Split peas, dry': 'Split peas',
  'Dried pinto beans': 'Pinto beans',
  'Pinto beans, dried': 'Pinto beans',
  'Black beans, dry': 'Black beans',
  'Black beans, canned': 'Black beans',
  'Dried beans, mixed': 'Dried beans',
  'Pearl barley (Scots broth)': 'Pearl barley',
  'Pearl barley (leek pottage)': 'Pearl barley',
  'Onions (Scots broth)': 'Yellow onion',
  'Onion (leek pottage)': 'Yellow onion',
  'Onion, yellow diced': 'Yellow onion',
  'Onion, yellow': 'Yellow onion',
  'Onion, large': 'Yellow onion',
  'Onion, large diced': 'Yellow onion',
  'Onion, medium': 'Yellow onion',
  'Onion, medium diced': 'Yellow onion',
  'Onion, medium quartered': 'Yellow onion',
  'Onion, diced': 'Yellow onion',
  'Onion, chopped': 'Yellow onion',
  'Onion, minced': 'Yellow onion',
  'Onion, white chopped': 'Yellow onion',
  'Red onion, small': 'Red onion',
  'Green onions, chopped': 'Green onions',
  'Scallions': 'Green onions',
  'Scallion whites': 'Green onions',
  'Leeks (pottage)': 'Leeks',
  'Carrots, chopped': 'Carrots',
  'Carrots, cubed': 'Carrots',
  'Carrots, sliced': 'Carrots',
  'Carrots, shredded': 'Carrots',
  'Carrots, dried': 'Carrots',
  'Celery stalks, sliced': 'Celery',
  'Celery, chopped': 'Celery',
  'Celery, diced': 'Celery',
  'Celery, sliced': 'Celery',
  'Broccoli florets': 'Broccoli',
  'Potatoes, russet': 'Russet potatoes',
  'Potatoes, small': 'Potatoes',
  'Potatoes, Yukon gold': 'Potatoes',
  'Red potatoes, small': 'Red potatoes',
  'Red potatoes': 'Red potatoes',
  'Baby carrots': 'Carrots',
  'Sweet potato, medium': 'Sweet potato',
  'Apples, Granny Smith': 'Apples',
  'Apples, Honeycrisp': 'Apples',
  'Pears, D Anjou': 'Pears',
  'Tomatillos': 'Tomatillos',
  'Jalapeno peppers': 'Jalapenos',
  'Jalapeno, chopped': 'Jalapenos',
  'Green bell pepper, chopped': 'Green bell pepper',
  'Green bell pepper, diced': 'Green bell pepper',
  'Red bell pepper, chopped': 'Red bell pepper',
  'Bell pepper': 'Bell pepper',
  'Bacon, sliced': 'Bacon',
  'Bacon pieces': 'Bacon bits',
  'Eggs, beaten': 'Eggs',
  'Eggs, hard boiled': 'Eggs',
  'Eggs, hard boiled (large batch)': 'Eggs',
  'Eggs, hard boiled (small batch)': 'Eggs',
  'Egg whites with whole eggs': 'Eggs',
  'Egg yolk': 'Eggs',
  'Mayonnaise (large batch)': 'Mayonnaise',
  'Mayonnaise (small batch)': 'Mayonnaise',
  'Mustard, yellow (large batch)': 'Mustard',
  'Mustard, yellow (small batch)': 'Mustard',
  'Nutmeg (ancho rub)': 'Nutmeg',
  'Nutmeg (coriander rub)': 'Nutmeg',
  'Cumin seeds (coriander rub)': 'Cumin seeds',
  'Cumin seeds (garlic rub)': 'Cumin seeds',
  'Cumin seed, ground': 'Cumin',
  'Cumin, ground': 'Cumin',
  'Cumin seed, whole': 'Cumin seeds',
  'Coriander, whole': 'Coriander seeds',
  'Coriander, ground': 'Coriander',
  'Fennel seed, whole': 'Fennel seeds',
  'Mustard, dry': 'Dry mustard',
  'Mustard, prepared': 'Mustard',
  'Mustard, spicy brown': 'Mustard',
  'Prunes, pitted chopped': 'Prunes',
  'Prunes, dried': 'Prunes',
  'Teriyaki sauce, Aloha': 'Teriyaki sauce',
  'Teriyaki sauce, Kiko': 'Teriyaki sauce',
  'Teriyaki sauce, garlic': 'Teriyaki sauce',
  'Better Than Bouillon, chicken': 'Chicken bouillon',
  'HamPeas split pea mix': 'Split pea soup mix',
  'Ranch dressing, light': 'Ranch dressing',
  'Pie crust, refrigerated': 'Pie crust',
  'Yeast, active dry': 'Yeast',
  'Coffee beans, ground': 'Coffee',
  'Espresso, finely ground': 'Espresso',
  'Espresso, brewed': 'Espresso',
  'Stout beer, reduced': 'Stout beer',
  'Irish cream liqueur': 'Irish cream',
  'Orzo pasta': 'Orzo',
  'Nori sheet': 'Nori',
  'Imitation crab': 'Imitation crab',
  'Chicken, bone-in': 'Chicken',
  'Chicken thighs, boneless': 'Chicken thighs',
  'Chicken tenders': 'Chicken tenders',
  'Beef steak': 'Beef steak',
  'Flap steak': 'Beef steak',
  'Flank steak': 'Flank steak',
  'Espresso rubbed steak': 'Beef steak',
  'Pork tenderloin': 'Pork tenderloin',
  'Pork, diced': 'Pork',
  'Lamb neck': 'Lamb',
  'Lamb, cubed': 'Lamb',
  'Cabbage, medium': 'Cabbage',
  'Leek': 'Leeks',
  'Coconut, sweetened shredded': 'Coconut',
  'Coconut, shredded': 'Coconut',
  'Almonds, slivered': 'Almonds',
  'Almonds, chopped': 'Almonds',
  'Peanuts, chopped': 'Peanuts',
  'Roasted peanuts, chopped': 'Peanuts',
  'Sunflower seeds': 'Sunflower seeds',
  'Sesame seeds': 'Sesame seeds',
  'Chia seeds': 'Chia seeds',
  'Flax seed, ground': 'Flax meal',
  'Dried fruit, mixed': 'Dried fruit',
  'Mixed vegetables, chopped': 'Mixed vegetables',
  'Herbs, fresh mixed': 'Fresh herbs',
  'Pickled jalapenos': 'Pickled jalapenos',
  'Chocolate chips, semisweet': 'Chocolate chips',
  'Dark chocolate, chopped': 'Dark chocolate',
  'Graham cracker crumbs': 'Graham crackers',
  'All-Bran cereal': 'Bran cereal',
  'Italian seasoning': 'Italian seasoning',
  'Poultry seasoning': 'Poultry seasoning',
  'Ranch dressing mix': 'Ranch seasoning',
  'California chili powder': 'Chili powder',
  'Chili sauce, tomato-based': 'Chili sauce',
  'Hot pepper sauce': 'Hot sauce',
  'Chili oil': 'Chili oil',
  'Chinese black vinegar': 'Rice vinegar',
  'Red bean curd': 'Fermented tofu',
  'Shaoxing rice wine': 'Cooking wine',
  'Dry sherry': 'Sherry',
  'Beer': 'Beer',
  'Liquid smoke': 'Liquid smoke',
  'Cola, cane-sweetened': 'Cola',
  'Molasses, mild': 'Molasses',
  'Sweet relish': 'Relish',
  'Celery seed': 'Celery seed',
  'Cocoa powder, unsweetened': 'Cocoa powder',
  'Baking powder': 'Baking powder',
  'Baking soda': 'Baking soda',
  'Cornstarch': 'Cornstarch',
  'Gelatin, powdered': 'Gelatin',
  'Gelatin, unflavored': 'Gelatin',
  'Cumin seed, ground': 'Cumin',
  'Cardamom pods, green': 'Cardamom',
  'Black peppercorns': 'Black peppercorns',
  'Aleppo pepper': 'Aleppo pepper',
  'Cayenne pepper': 'Cayenne',
  'Red pepper flakes': 'Red pepper flakes',
  'Chinese five spice': 'Five spice powder',
  'Dijon mustard': 'Dijon mustard',
  'Worcestershire sauce': 'Worcestershire sauce',
  'Hoisin sauce': 'Hoisin sauce',
  'Oyster sauce': 'Oyster sauce',
  'Fish sauce': 'Fish sauce',
  'Soy sauce': 'Soy sauce',
  'Tamari': 'Soy sauce',
  'Rice wine': 'Cooking wine',
  'Cooking wine': 'Cooking wine',
  'Tomato bouillon cubes': 'Bouillon cubes',
  'Chicken bouillon granules': 'Chicken bouillon',
  'Bouillon cubes': 'Bouillon cubes',
  'Peas, frozen': 'Frozen peas',
  'Ham, diced': 'Ham',
  'Prosciutto': 'Prosciutto',
  'Coconut oil': 'Coconut oil',
  'Olive oil': 'Olive oil',
  'Olive oil, extra virgin': 'Olive oil',
  'Canola oil': 'Canola oil',
  'Vegetable oil': 'Vegetable oil',
  'Lard': 'Lard',
  'Shortening, melted': 'Shortening',
  'Half and Half': 'Half and Half',
  'Avocado': 'Avocado',
  'Cucumber': 'Cucumber',
  'Spinach': 'Spinach',
  'Arugula': 'Arugula',
  'Romaine': 'Romaine',
  'Iceberg lettuce': 'Iceberg lettuce',
  'Cabbage': 'Cabbage',
  'Sauerkraut': 'Sauerkraut',
  'Kimchi': 'Kimchi',
  'Pickles': 'Pickles',
  'Olives': 'Olives',
  'Capers': 'Capers',
  'Anchovies': 'Anchovies',
};

/** Category for department SQL (see department-sql.mjs). */
export const CATEGORIES = {
  produce: 'produce',
  dairy: 'dairy',
  meat: 'meat',
  seafood: 'seafood',
  bakery: 'bakery',
  pantry: 'pantry',
  spices: 'spices',
  canned: 'canned',
  frozen: 'frozen',
  beverages: 'beverages',
  oils: 'oils',
  misc: 'misc',
};

/**
 * @param {string} raw
 * @returns {{ name: string, comment: string | null, category: string }}
 */
export function normalizeIngredient(raw) {
  let s = String(raw).trim();
  if (!s) {
    return { name: 'Unknown', comment: null, category: CATEGORIES.misc };
  }

  const alias = FULL_ALIASES[s];
  if (alias) {
    s = alias;
  }

  let name = s;
  let comment = null;
  const comma = s.indexOf(',');
  if (comma > 0) {
    name = s.slice(0, comma).trim();
    comment = s.slice(comma + 1).trim() || null;
    const nameAlias = FULL_ALIASES[name];
    if (nameAlias) name = nameAlias;
  }

  const again = FULL_ALIASES[name];
  if (again) name = again;

  if (name === 'Ginger') {
    if (comment && /\b(ground|dried|powder)\b/i.test(comment)) {
      name = 'Ginger, ground';
      comment = null;
    } else {
      name = 'Fresh Ginger';
    }
  }
  if (name === 'Garlic' && comment && /\bpowder\b/i.test(comment)) {
    name = 'Garlic powder';
    comment = null;
  }

  name = name.replace(/\s+/g, ' ').trim();
  if (name.length > 80) name = name.slice(0, 80);

  const category = guessCategory(name, comment);
  return { name, comment, category };
}

function guessCategory(name, comment) {
  const n = `${name} ${comment || ''}`.toLowerCase();

  if (/\b(broth|stock)\b/.test(n) && !/\b(cube|granules|bouillon)\b/.test(n)) {
    return CATEGORIES.pantry;
  }
  if (/\b(bouillon|better than)\b/.test(n)) {
    return CATEGORIES.spices;
  }
  if (name === 'Water') {
    return CATEGORIES.beverages;
  }

  if (
    /\b(vinegar|soy sauce|fish sauce|oyster sauce|hoisin|worcestershire|hot sauce|ketchup|mayonnaise|sesame oil|dressing|molasses|syrup|honey|maple syrup)\b/.test(
      n
    ) ||
    /\b(oil)\b/.test(n)
  ) {
    return CATEGORIES.oils;
  }

  if (
    /\b(allspice|paprika|cumin|coriander|turmeric|nutmeg|cinnamon|clove\b|cardamom|oregano|thyme|rosemary|basil dried|bay leaves|chili powder|curry|five spice|seasoning|granulated garlic|onion powder|garlic powder|garlic salt|celery seed|aleppo|ancho|smoked paprika)\b/.test(
      n
    ) ||
    /\b(powder|flakes)\b/.test(n) ||
    (/\bpepper\b/.test(n) &&
      !/\b(bell|sweet|jalapeno|chili|peppercorn)\b/.test(n) &&
      !/green|red|yellow/.test(n))
  ) {
    return CATEGORIES.spices;
  }
  if (
    /\b(salt\b|kosher salt|sea salt|pickling salt|black peppercorns)\b/.test(n)
  ) {
    return CATEGORIES.spices;
  }

  if (/\b(chocolate|chips|sugar|baking|cocoa|gelatin|extract|vanilla)\b/.test(n)) {
    return CATEGORIES.spices;
  }

  if (
    /\b(fish|salmon|tuna|cod|shrimp|crab|imitation crab)\b/.test(n) ||
    name === 'Imitation crab'
  ) {
    return CATEGORIES.seafood;
  }
  if (
    /\b(chicken|beef|pork|lamb|sausage|bacon|ham|kielbasa|steak|ribs|ground|turkey|prosciutto)\b/.test(
      n
    ) ||
    /breakfast sausage|ground beef|ground pork|pork chop|chicken breast|chicken thigh/i.test(name)
  ) {
    return CATEGORIES.meat;
  }
  if (
    /\b(milk|cream|butter|cheese|yogurt|sour cream|ricotta|mozzarella|cheddar|parmesan|eggs?|half and half)\b/.test(
      n
    ) ||
    name === 'Half and Half'
  ) {
    return CATEGORIES.dairy;
  }

  if (/\b(flour|oats?|cornmeal|panko|breadcrumbs|bread|tortilla|yeast|cornbread|muffin|pasta|fettuccine|ramen|manicotti|orzo|rice|quinoa|barley|lentils?|split peas|kidney beans|black beans|pinto beans|garbanzo beans|chickpeas|dried beans)\b/.test(n)) {
    return CATEGORIES.pantry;
  }
  if (/\b(canned|can |ounce\)|kidney|garbanzo|chickpeas|hominy|tomato sauce|tomato paste|crushed tomato|diced tomato)\b/.test(n)) {
    return CATEGORIES.canned;
  }
  if (/\b(frozen|ice cream)\b/.test(n) || name === 'Frozen peas') {
    return CATEGORIES.frozen;
  }
  if (/\b(wine|beer|rum|bourbon|whiskey|liqueur|coffee|espresso|vodka|sherry|cola)\b/.test(n)) {
    return CATEGORIES.beverages;
  }

  if (
    /\b(onion|garlic\b|carrot|celery|potato|tomato|lettuce|spinach|broccoli|lemon|lime|orange|herb|cilantro|parsley|basil|mushroom|avocado|cucumber|cabbage|leek|scallion|jalapeno|corn|pear|tomatillo|apples?\b|granny)\b/.test(
      n
    ) ||
    /Fresh Ginger|Yellow onion|Green onions|Russet potatoes|Sweet potato|Baby carrots|Bell pepper|Green bell/i.test(
      name
    )
  ) {
    return CATEGORIES.produce;
  }

  return CATEGORIES.misc;
}
