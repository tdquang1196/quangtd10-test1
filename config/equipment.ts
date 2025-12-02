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
    '7afbf379-ec1f-4437-8669-d655f0872b4a',
    '74a43a22-8934-4e1a-ba2d-531adf9545b6',
    'd10035d1-ec76-4ab3-9a33-90a39e33cc79',
    'c8b68971-5e73-465c-be88-8b70dc04104b',
    'eb4b3628-0bab-4ec9-b9a7-3827e6a4b53c',
    'e01da4d2-fa56-4b89-b6a4-709ea55acac7',
    '1833b01f-bbd7-4202-bebf-03926671f6fa',
    '498db62b-9fbb-4e96-b000-208c803e82fc',
    '5c9ac0f5-4b93-4861-a78e-2f65382dec31',
    '0613dd75-c178-4ea0-9077-8223eeaf6bb6',
    '8e7b2bc9-a4ca-4ea3-8c17-f6482237cdbe',
    '94bc44a2-23fa-49fc-911d-0561ad3c820b',
    'fe77958c-6420-4970-9e88-52470db88588',
    'a2763a56-b8e4-4772-a122-b84712a419fe',
    'f67c1b82-bb6c-4768-8b01-dc9c53062fb5',
    '89a13f21-a7b7-43e7-8f86-3605b1345538'
  ],

  // Upper body items (shirts, jackets, etc.)
  UPPER_BODY: [
    'c8585fcb-361e-4124-9a22-e723901b6905',
    'ddda9070-3caf-44b0-b0b4-eb3986fb0451',
    '0f5ccebc-c101-44a9-bfb8-5f508462bddf',
    '242d19bf-0211-4ef1-9957-ba3e6ecdba5a',
    '4fc60002-8749-439c-9985-b858d887d5e2',
    '6923f41d-e4bc-4033-b933-80f7ed7f5648',
    '696939da-5685-4dd8-8312-26ef6f13954d',
    '75a75dfc-37dd-49d2-8ff6-e3e2db895505',
    '61128eca-bfa2-4959-836b-b6949f56f71c',
    '596b5805-7f77-4ee9-a6e8-92763be5add7',
    '854dff17-3342-4248-b549-a4a7b36c5506',
    'a0847d66-1a28-4dad-92cd-5489e2093a94',
    '7d664234-1d27-4775-88a9-86491abf821c',
    '7cf34c85-1f97-4487-8737-d3354a3b8854',
    'fd3b2091-b24b-4eef-a1cf-e4ea9d3bdea7',
    'a09f7ef3-38dc-4d69-b9fa-a7bf9355a2c1'
  ],

  // Lower body items (pants, shorts, etc.)
  LOWER_BODY: [
    'd537a0c7-4c18-45d6-991f-676e6c4e0dc9',
    'bf72c071-752e-4b27-80ff-5d796c180896',
    'e431e96c-48e3-4628-ba21-57aa278f5709',
    'd67aa04f-8eb1-446e-a99a-69b4a6cf6675',
    '0abdf3e1-68d5-4f26-ae69-ec0313f2271d',
    '0ae2444e-a123-4773-b0c5-9b370f7b1eb3',
    '3ccf674f-cdcd-459d-ba04-a8a4612106ac',
    '36e36f5a-60f7-4d96-afe0-437d447775ee',
    '3f560d81-3890-4528-a6fa-7dee6819e3d5',
    '5fb9e0a4-ce37-4f6b-b946-9623aabc15c6',
    '7b3ac869-ec7c-4bfd-9795-5762d1a6f7d9',
    '869f66ef-bbd0-4ae5-891e-708fd709f33a',
    '03e7000d-a6ea-4d59-be08-9e31f60ec90c',
    'a92bda9a-e139-4dad-a923-45976c3617db',
    'fc6ee9d8-d5f6-4087-8256-ee2fdbda789d',
    'fbee3031-c298-4ba4-8f6c-955cbd4eae82',
  ],

  // Foot items (shoes, boots, etc.)
  FOOT: [
    '6a14f266-cbf2-4bff-98c8-bfe9fdf688e2',
    'cfb9e56d-e1c5-49ac-b3c6-18c255596531',
    'bc319bc8-3fa0-4324-a67f-c37fb2a67a09',
    'c2381ce2-64a3-4313-964d-21cd0f22d6ca',
    'b80d5bcd-9dfe-4213-90e8-0925682b6f07',
    '1c65d90f-f49e-455c-8549-3ae1ef60f381',
    'eda01e2a-d37c-4410-8e23-c65acf60b6c5',
    '0d8c02f3-bce5-40c0-a8a1-bc5f51a81f66',
    '175b4b0f-5dc6-4c2a-940b-c44e18d6965e',
    '566d4354-058a-490f-9e2e-cfa238c62432',
    '52d43f1b-ccbf-4569-ae73-34a00ef61068',
    'a5b64d82-84c8-4aa2-9533-ad689ec8fef8',
    '916ef0fc-7194-4a3d-a875-fd48d1086853',
    'f76504c4-eb06-4858-9941-39ab0287065d',
    '274a2f57-0752-46b2-b232-2f5f1785f728',
    'a092d186-28d8-40eb-8aca-415ddf159761',
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
