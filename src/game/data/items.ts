// ===========================
// 物品数据库（多格系统）
// ===========================
import type { ItemDef, Rarity } from '../types'

// width = 占列数（横向），height = 占行数（纵向）
// 统一为横向定义（width >= height），竖向物品用 initialRotated: true 标记
// 对应三角洲的尺寸体系：
//   1×1: 小件（宝石/草药/子弹）
//   2×1: 横向条形（显卡/骨头）
//   3×1: 横向长条（卷轴/箭）
//   2×2: 方形中件（电台/蛋）
//   3×2: 横向大件（笔记本/矿石堆）
// 竖向物品（如 1×2, 1×3, 2×3）统一改为横向定义 + initialRotated: true
export const ITEM_DB: Record<string, ItemDef> = {
  // ── 1×1 小件 ──────────────────────────────
  ancient_bone:   { id: 'ancient_bone',   name: '远古骨头',   rarity: 'common',    width: 1, height: 1, description: '一块远古生物的骨头' },
  herb:           { id: 'herb',           name: '草药',       rarity: 'common',    width: 1, height: 1, description: '可以恢复少量HP' },
  amber_gem:      { id: 'amber_gem',      name: '琥珀宝石',   rarity: 'epic',      width: 1, height: 1, description: '封存远古生命的宝石' },
  tooth_fragment: { id: 'tooth_fragment', name: '碎齿',       rarity: 'common',    width: 1, height: 1, description: '恐龙碎裂的牙齿' },
  blood_vial:     { id: 'blood_vial',     name: '血瓶',       rarity: 'uncommon',  width: 1, height: 1, description: '小瓶装的恢复药剂' },

  // ── 2×1 横向条形 ──────────────────────────
  stone_arrow:    { id: 'stone_arrow',    name: '石箭×3',     rarity: 'common',    width: 2, height: 1, description: '石制箭矢，一束三支' },
  iron_ore:       { id: 'iron_ore',       name: '铁矿石',     rarity: 'uncommon',  width: 2, height: 1, description: '可以打造武器' },
  dino_claw:      { id: 'dino_claw',      name: '恐龙爪',     rarity: 'uncommon',  width: 2, height: 1, description: '锋利的恐龙利爪' },

  // ── 1×2 纵向条形 → 统一为横向定义 + initialRotated ──
  dino_fang:      { id: 'dino_fang',      name: '恐龙獠牙',   rarity: 'rare',      width: 2, height: 1, initialRotated: true, description: '锋利的恐龙牙齿' },
  bone_staff:     { id: 'bone_staff',     name: '骨杖',       rarity: 'uncommon',  width: 2, height: 1, initialRotated: true, description: '用骨头制成的法杖' },

  // ── 2×2 方形中件 ──────────────────────────
  magic_scroll:   { id: 'magic_scroll',   name: '魔法卷轴',   rarity: 'rare',      width: 2, height: 2, description: '蕴含神秘力量' },
  pet_egg:        { id: 'pet_egg',        name: '宠物蛋',     rarity: 'epic',      width: 2, height: 2, description: '孵化出强大宠物' },

  // ── 3×1 横向长条 ──────────────────────────
  beast_hide:     { id: 'beast_hide',     name: '兽皮护甲',   rarity: 'uncommon',  width: 3, height: 1, description: '厚实的兽皮制成的护甲' },

  // ── 1×3 纵向长条 → 统一为横向定义 + initialRotated ──
  ancient_spear:  { id: 'ancient_spear',  name: '远古长矛',   rarity: 'rare',      width: 3, height: 1, initialRotated: true, description: '上古战士使用的长矛' },

  // ── 3×2 横向大件 ──────────────────────────
  dragon_crystal: { id: 'dragon_crystal', name: '龙晶',       rarity: 'legendary', width: 3, height: 2, description: '传说中的龙之结晶' },

  // ── 2×3 纵向大件 → 统一为横向定义 + initialRotated ──
  fossil_tablet:  { id: 'fossil_tablet',  name: '化石石板',   rarity: 'epic',      width: 3, height: 2, initialRotated: true, description: '记载远古文明的石板' },

  // ── 1×4 纵向长条 → 统一为横向定义 + initialRotated ──
  dragon_spine:   { id: 'dragon_spine',   name: '龙脊骨',     rarity: 'rare',      width: 4, height: 1, initialRotated: true, description: '巨龙完整的脊柱化石' },
  holy_sword:     { id: 'holy_sword',     name: '圣剑',       rarity: 'legendary', width: 4, height: 1, initialRotated: true, description: '传说中的神圣武器' },

  // ── 2×4 横向大件 ──
  ancient_armor:  { id: 'ancient_armor',  name: '远古铠甲',   rarity: 'epic',      width: 4, height: 2, description: '完整的远古战士铠甲' },
  treasure_chest: { id: 'treasure_chest', name: '宝箱',       rarity: 'legendary', width: 4, height: 2, description: '装满宝藏的箱子' },
}

// 按稀有度的搜索时间（秒）
export const SEARCH_TIME: Record<Rarity, number> = {
  common: 0.5,
  uncommon: 0.5,
  rare: 0.5,
  epic: 0.5,
  legendary: 0.5,
}

// 稀有度颜色
export const RARITY_COLOR: Record<Rarity, string> = {
  common:    '#9d9d9d',
  uncommon:  '#1eff00',
  rare:      '#0070dd',
  epic:      '#a335ee',
  legendary: '#ff8000',
}

export function getItemDef(id: string): ItemDef {
  return ITEM_DB[id] ?? { id, name: id, rarity: 'common', width: 1, height: 1 }
}

export function getRarityColor(rarity: Rarity): string {
  return RARITY_COLOR[rarity] ?? '#9d9d9d'
}

// 从 gridUtils 导出 getItemCellCount
export { getItemCellCount } from '../utils/gridUtils'

// 随机物品池（权重）
const LOOT_POOL: { id: string; weight: number }[] = [
  { id: 'ancient_bone',   weight: 10 },
  { id: 'herb',           weight: 10 },
  { id: 'tooth_fragment', weight: 10 },
  { id: 'blood_vial',     weight: 10 },
  { id: 'stone_arrow',    weight: 50 },  // 2×1
  { id: 'iron_ore',       weight: 50 },  // 2×1
  { id: 'dino_claw',      weight: 50 },  // 2×1
  { id: 'bone_staff',     weight: 40 },  // 1×2
  { id: 'dino_fang',      weight: 40 },  // 1×2
  { id: 'beast_hide',     weight: 35 },  // 3×1
  { id: 'ancient_spear',  weight: 35 },  // 1×3
  { id: 'magic_scroll',   weight: 30 },  // 2×2
  { id: 'pet_egg',        weight: 30 },  // 2×2
  { id: 'amber_gem',      weight: 20 },  // 1×1
  { id: 'fossil_tablet',  weight: 15 },  // 2×3
  { id: 'dragon_crystal', weight: 10 },  // 3×2
  { id: 'dragon_spine',   weight: 12 },  // 1×4
  { id: 'holy_sword',     weight: 8 },   // 1×4
  { id: 'ancient_armor',  weight: 12 },  // 2×4
  { id: 'treasure_chest', weight: 6 },   // 2×4
]

export function randomItemId(): string {
  const totalWeight = LOOT_POOL.reduce((s, x) => s + x.weight, 0)
  let rand = Math.random() * totalWeight
  for (const entry of LOOT_POOL) {
    rand -= entry.weight
    if (rand <= 0) return entry.id
  }
  return 'ancient_bone'
}
