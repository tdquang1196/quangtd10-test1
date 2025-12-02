/**
 * Equipment Configuration
 * Random equipment items assigned to users during migration
 */

export interface EquipmentConfig {
  HEAD: string[]
  UPPER_BODY: string[]
  LOWER_BODY: string[]
  FOOT: string[]
}

/**
 * Default equipment item GUIDs
 * These items will be randomly selected for each user
 */
export const EQUIPMENT_ITEMS: EquipmentConfig = {
  // Head items (hats, helmets, etc.)
  HEAD: [
    '8d4a5d42-c671-49a7-9895-c51417406af6',
    '9e5b6e53-d782-50b8-0a06-d62528517bf7',
    'a16c7f64-e893-61c9-1b17-e73639628cg8',
    'b27d8g75-f9a4-72d0-2c28-f84740739dh9'
  ],

  // Upper body items (shirts, jackets, etc.)
  UPPER_BODY: [
    'c38e9h86-0ab5-83e1-3d39-g95851840ei0',
    'd49f0i97-1bc6-94f2-4e40-h06962951fj1',
    'e50g1j08-2cd7-a5g3-5f51-i17073a62gk2',
    'f61h2k19-3de8-b6h4-6g62-j28184b73hl3'
  ],

  // Lower body items (pants, shorts, etc.)
  LOWER_BODY: [
    'g72i3l20-4ef9-c7i5-7h73-k39295c84im4',
    'h83j4m31-5fg0-d8j6-8i84-l40306d95jn5',
    'i94k5n42-6gh1-e9k7-9j95-m51417e06ko6',
    'j05l6o53-7hi2-f0l8-0k06-n62528f17lp7'
  ],

  // Foot items (shoes, boots, etc.)
  FOOT: [
    'k16m7p64-8ij3-g1m9-1l17-o73639g28mq8',
    'l27n8q75-9jk4-h2n0-2m28-p84740h39nr9',
    'm38o9r86-0kl5-i3o1-3n39-q95851i40os0',
    'n49p0s97-1lm6-j4p2-4o40-r06962j51pt1'
  ]
}

/**
 * Get random item from a category
 */
export function getRandomItem(category: keyof EquipmentConfig): string {
  const items = EQUIPMENT_ITEMS[category]
  const randomIndex = Math.floor(Math.random() * items.length)
  return items[randomIndex]
}

/**
 * Get random equipment set (one item from each category)
 */
export function getRandomEquipmentSet(): string[] {
  return [
    getRandomItem('HEAD'),
    getRandomItem('UPPER_BODY'),
    getRandomItem('LOWER_BODY'),
    getRandomItem('FOOT')
  ]
}
