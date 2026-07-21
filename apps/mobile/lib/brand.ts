/**
 * Official EPHERA logo assets — exact shape from brand masters.
 * Tube / halo assets are the same silhouette with pre-baked neon light.
 */

export const BrandAssets = {
  /** Exact official three-bar symbol (transparent) */
  officialSymbol: require("../assets/brand/official-symbol.png"),
  officialSymbolNeon: require("../assets/brand/official-symbol-neon.png"),
  /** Silhouette-matched neon tube + halo (light up on dark) */
  officialSymbolTube: require("../assets/brand/official-symbol-tube.png"),
  /** Electric blue tube for light backgrounds */
  officialSymbolTubeElectric: require("../assets/brand/official-symbol-tube-electric.png"),

  officialHorizontal: require("../assets/brand/official-horizontal.png"),
  officialHorizontalNeon: require("../assets/brand/official-horizontal-neon.png"),
  officialHorizontalTube: require("../assets/brand/official-horizontal-tube.png"),

  officialStacked: require("../assets/brand/official-stacked.png"),
  officialStackedNeon: require("../assets/brand/official-stacked-neon.png"),
  officialStackedTube: require("../assets/brand/official-stacked-tube.png"),
  officialStackedTubeElectric: require("../assets/brand/official-stacked-tube-electric.png"),

  // Legacy aliases → official shape
  mark: require("../assets/brand/official-symbol.png"),
  markUi: require("../assets/brand/official-symbol-tube.png"),
  markDarkMetal: require("../assets/brand/official-symbol.png"),
  horizontal: require("../assets/brand/official-horizontal-tube.png"),
  horizontalDark: require("../assets/brand/official-horizontal.png"),
  horizontalCompact: require("../assets/brand/official-horizontal-tube.png"),
  horizontalDarkMetal: require("../assets/brand/official-horizontal.png"),
  stacked: require("../assets/brand/official-stacked-tube.png"),
  stackedCompact: require("../assets/brand/official-stacked-tube.png"),
  stackedPrint: require("../assets/brand/official-stacked.png"),
  stackedMetal: require("../assets/brand/official-stacked.png"),
  stackedDarkMetal: require("../assets/brand/official-stacked.png"),
  appIcon: require("../assets/brand/app-icon.png"),
  neonMark: require("../assets/brand/official-symbol-tube.png"),
  neonStacked: require("../assets/brand/official-stacked-tube.png"),
} as const;
