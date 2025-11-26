/**
 * Cloudscape Design System Color Palette
 * Based on AWS Cloudscape data visualization colors
 * https://cloudscape.design/foundation/visual-foundation/data-vis-colors/
 *
 * These colors are designed for accessibility with proper contrast ratios
 * and consistent theming across visualizations.
 */

/**
 * CATEGORICAL PALETTE
 * For different data series (50 colors total, showing first 12 most common)
 * Recommended: Limit to 8 data series for line/bar charts, 5 for pie/donut charts
 */
export const CATEGORICAL_COLORS = {
  categorical1: '#688ae8',  // Blue - primary series
  categorical2: '#c33d69',  // Pink - secondary series
  categorical3: '#2ea597',  // Teal - tertiary series
  categorical4: '#8456ce',  // Purple - quaternary series
  categorical5: '#e07941',  // Orange - fifth series
  categorical6: '#3759ce',  // Dark blue
  categorical7: '#962249',  // Dark pink
  categorical8: '#096f64',  // Dark teal
  categorical9: '#6237a7',  // Dark purple
  categorical10: '#a84401', // Dark orange
  categorical11: '#273ea5', // Navy blue
  categorical12: '#780d35', // Burgundy
  categorical13: '#ff0055ff',  // Dark purple
  categorical14: '#00fc26ff', // Dark orange
  categorical15: '#1038ebff', // Navy blue
  categorical16: '#916c80ff', // Burgundy
} as const;

/**
 * STATUS COLORS
 * For indicating state, severity, or trend direction
 */
export const STATUS_COLORS = {
  critical: '#7d2105',   // Critical error / Sev-1
  high: '#ba2e0f',       // Error / High severity / Sev-2
  medium: '#cc5f21',     // Medium severity / Sev-3
  low: '#b2911c',        // Warning / Low severity / Sev-4
  positive: '#67a353',   // Success / Positive trend
  info: '#3184c2',       // Informational / In-progress
  neutral: '#8c8c94',    // Neutral / No impact / Sev-5
} as const;

/**
 * COLOR SCALES
 * Each scale provides 10 values with contrast ratios from 3:1 to 12:1
 * Useful for sequential data or gradients
 */

// Blue Scale (2 variants available - using blue-2 for consistency with categorical-1)
export const BLUE_SCALE = {
  blue300: '#688ae8',   // 3:1 contrast - lightest
  blue400: '#5978e3',   // 4:1 contrast
  blue500: '#4066df',   // 5:1 contrast
  blue600: '#3759ce',   // 6:1 contrast - medium
  blue700: '#314fbf',   // 7:1 contrast
  blue800: '#2c46b1',   // 8:1 contrast
  blue900: '#273ea5',   // 9:1 contrast
  blue1000: '#23379b',  // 10:1 contrast
  blue1100: '#1f3191',  // 11:1 contrast
  blue1200: '#1b2b88',  // 12:1 contrast - darkest
} as const;

// Teal Scale
export const TEAL_SCALE = {
  teal300: '#2ea597',   // 3:1 contrast - lightest
  teal400: '#1c8e81',   // 4:1 contrast
  teal500: '#0d7d70',   // 5:1 contrast
  teal600: '#096f64',   // 6:1 contrast - medium
  teal700: '#06645a',   // 7:1 contrast
  teal800: '#045b52',   // 8:1 contrast
  teal900: '#03524a',   // 9:1 contrast
  teal1000: '#014b44',  // 10:1 contrast
  teal1100: '#01443e',  // 11:1 contrast
  teal1200: '#003e38',  // 12:1 contrast - darkest
} as const;

// Purple Scale
export const PURPLE_SCALE = {
  purple300: '#a783e1',  // 3:1 contrast - lightest
  purple400: '#9469d6',  // 4:1 contrast
  purple500: '#8456ce',  // 5:1 contrast
  purple600: '#7749bf',  // 6:1 contrast - medium
  purple700: '#6b40b2',  // 7:1 contrast
  purple800: '#6237a7',  // 8:1 contrast
  purple900: '#59309d',  // 9:1 contrast
  purple1000: '#512994', // 10:1 contrast
  purple1100: '#4a238b', // 11:1 contrast
  purple1200: '#431d84', // 12:1 contrast - darkest
} as const;

// Pink Scale
export const PINK_SCALE = {
  pink300: '#da7596',   // 3:1 contrast - lightest
  pink400: '#ce567c',   // 4:1 contrast
  pink500: '#c33d69',   // 5:1 contrast
  pink600: '#b1325c',   // 6:1 contrast - medium
  pink700: '#a32952',   // 7:1 contrast
  pink800: '#962249',   // 8:1 contrast
  pink900: '#8b1b42',   // 9:1 contrast
  pink1000: '#81143b',  // 10:1 contrast
  pink1100: '#780d35',  // 11:1 contrast
  pink1200: '#6f062f',  // 12:1 contrast - darkest
} as const;

// Orange Scale
export const ORANGE_SCALE = {
  orange300: '#e07941',  // 3:1 contrast - lightest
  orange400: '#cc5f21',  // 4:1 contrast
  orange500: '#bc4d01',  // 5:1 contrast
  orange600: '#a84401',  // 6:1 contrast - medium
  orange700: '#973d01',  // 7:1 contrast
  orange800: '#893701',  // 8:1 contrast
  orange900: '#7e3103',  // 9:1 contrast
  orange1000: '#7e3103', // 10:1 contrast
  orange1100: '#6b2903', // 11:1 contrast
  orange1200: '#632502', // 12:1 contrast - darkest
} as const;

// Green Scale
export const GREEN_SCALE = {
  green300: '#67a353',   // 3:1 contrast - lightest
  green400: '#41902c',   // 4:1 contrast
  green500: '#1f8104',   // 5:1 contrast
  green600: '#1a7302',   // 6:1 contrast - medium
  green700: '#176702',   // 7:1 contrast
  green800: '#145d02',   // 8:1 contrast
  green900: '#125502',   // 9:1 contrast
  green1000: '#104d01',  // 10:1 contrast
  green1100: '#0f4601',  // 11:1 contrast
  green1200: '#0d4000',  // 12:1 contrast - darkest
} as const;

// Red Scale
export const RED_SCALE = {
  red300: '#ea7158',    // 3:1 contrast - lightest
  red400: '#dc5032',    // 4:1 contrast
  red500: '#d13313',    // 5:1 contrast
  red600: '#ba2e0f',    // 6:1 contrast - medium (same as status-high)
  red700: '#a82a0c',    // 7:1 contrast
  red800: '#972709',    // 8:1 contrast
  red900: '#892407',    // 9:1 contrast
  red1000: '#7d2105',   // 10:1 contrast (same as status-critical)
  red1100: '#721e03',   // 11:1 contrast
  red1200: '#671c00',   // 12:1 contrast - darkest
} as const;

/**
 * COMMON USE CASES - Predefined color mappings
 */
export const USE_CASE_COLORS = {
  // Business status
  businessOpen: STATUS_COLORS.positive,      // #67a353
  businessClosed: STATUS_COLORS.high,        // #ba2e0f

  // Trends
  trendImproving: STATUS_COLORS.positive,    // #67a353
  trendDeclining: STATUS_COLORS.high,        // #ba2e0f
  trendStable: STATUS_COLORS.neutral,        // #8c8c94

  // Data series (for multi-line charts)
  primarySeries: CATEGORICAL_COLORS.categorical1,    // #688ae8 (blue)
  secondarySeries: CATEGORICAL_COLORS.categorical3,  // #2ea597 (teal)
  tertiarySeries: CATEGORICAL_COLORS.categorical2,   // #c33d69 (pink)

  // Quadrants (for positioning charts)
  marketLeader: STATUS_COLORS.positive,      // #67a353 (green)
  hiddenGem: BLUE_SCALE.blue500,            // #4066df (bright blue)
  atRisk: STATUS_COLORS.high,               // #ba2e0f (red)
  challenger: STATUS_COLORS.neutral,        // #8c8c94 (gray)
} as const;

/**
 * Helper function to create rgba color with transparency
 */
export const withAlpha = (hexColor: string, alpha: number): string => {
  // Remove # if present
  const hex = hexColor.replace('#', '');

  // Parse hex to RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/**
 * Export all colors as a single object for convenience
 */
export const CLOUDSCAPE_COLORS = {
  categorical: CATEGORICAL_COLORS,
  status: STATUS_COLORS,
  blue: BLUE_SCALE,
  teal: TEAL_SCALE,
  purple: PURPLE_SCALE,
  pink: PINK_SCALE,
  orange: ORANGE_SCALE,
  green: GREEN_SCALE,
  red: RED_SCALE,
  useCase: USE_CASE_COLORS,
} as const;

export default CLOUDSCAPE_COLORS;
