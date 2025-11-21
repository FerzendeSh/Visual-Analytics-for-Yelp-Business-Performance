# Cloudscape Design System Color Integration

## Overview

This project now uses the **AWS Cloudscape Design System** color palette for all data visualizations. Cloudscape provides a professionally designed, accessible color system with proper contrast ratios and consistent theming.

**Official Documentation:** https://cloudscape.design/foundation/visual-foundation/data-vis-colors/

---

## What Changed

### 1. New Color Constants File
**Location:** `frontend/src/theme/cloudscapeColors.ts`

This file exports all Cloudscape design tokens including:
- **Categorical Colors** - 12 colors for different data series
- **Status Colors** - 7 colors for indicating state/severity
- **Color Scales** - 10-value scales for Blue, Teal, Purple, Pink, Orange, Green, Red
- **Use Case Colors** - Predefined mappings for common scenarios
- **Helper Functions** - `withAlpha()` for creating transparent colors

### 2. Updated Components

#### Time Series Charts (`chartConstants.ts`)
- **Business/Primary Line**: `#688ae8` (Cloudscape blue)
- **City Average**: `#2ea597` (Cloudscape teal)
- **Category Average**: `#c33d69` (Cloudscape pink)
- **Improving Trend**: `#67a353` (Cloudscape green)
- **Declining Trend**: `#ba2e0f` (Cloudscape red)
- **Stable Trend**: `#8c8c94` (Cloudscape gray)

#### Scatter Plot (`ScatterPlot.tsx`)
- **Open Businesses**: `#67a353` (Cloudscape green)
- **Closed Businesses**: `#ba2e0f` (Cloudscape red)
- **Grid Lines**: Cloudscape neutral with transparency

#### Competitive Positioning Chart (`CompetitivePositioningChart.tsx`)
- **Market Leaders**: `#67a353` (Cloudscape green)
- **Hidden Gems**: `#4066df` (Cloudscape bright blue)
- **At Risk**: `#ba2e0f` (Cloudscape red)
- **Challengers**: `#8c8c94` (Cloudscape gray)

#### Business Map (`BusinessMap.css`)
- **Open Marker**: `#67a353` (Cloudscape green)
- **Closed Marker**: `#ba2e0f` (Cloudscape red)
- **Hover State**: `#688ae8` (Cloudscape blue)
- **Cluster Markers**: Cloudscape blue gradient

---

## How to Use Cloudscape Colors

### In TypeScript/TSX Files

```typescript
import {
  CATEGORICAL_COLORS,
  STATUS_COLORS,
  USE_CASE_COLORS,
  withAlpha
} from '../theme/cloudscapeColors';

// Use categorical colors for data series
const lineColor = CATEGORICAL_COLORS.categorical1; // #688ae8

// Use status colors for trends/states
const successColor = STATUS_COLORS.positive; // #67a353
const errorColor = STATUS_COLORS.high; // #ba2e0f

// Use predefined use cases
const openColor = USE_CASE_COLORS.businessOpen; // #67a353
const closedColor = USE_CASE_COLORS.businessClosed; // #ba2e0f

// Create transparent colors
const transparentBlue = withAlpha(CATEGORICAL_COLORS.categorical1, 0.3);
// Returns: "rgba(104, 138, 232, 0.3)"
```

### In CSS Files

Since CSS can't import TypeScript, use hex codes directly with comments:

```css
.my-element {
  background: #688ae8; /* Cloudscape categorical-1 (blue) */
  color: #67a353; /* Cloudscape status-positive (green) */
}
```

**Tip:** Always add comments indicating which Cloudscape token you're using for maintainability.

---

## Available Color Categories

### Categorical Palette (for data series)
Use these for different data series in charts (limit to 8 for line/bar, 5 for pie):

```typescript
categorical1: '#688ae8'   // Blue
categorical2: '#c33d69'   // Pink
categorical3: '#2ea597'   // Teal
categorical4: '#8456ce'   // Purple
categorical5: '#e07941'   // Orange
categorical6: '#3759ce'   // Dark blue
categorical7: '#962249'   // Dark pink
categorical8: '#096f64'   // Dark teal
categorical9: '#6237a7'   // Dark purple
categorical10: '#a84401'  // Dark orange
// ... up to categorical12
```

### Status Colors (for states/trends)

```typescript
critical: '#7d2105'   // Critical error / Sev-1
high: '#ba2e0f'       // Error / High severity
medium: '#cc5f21'     // Medium severity
low: '#b2911c'        // Warning / Low severity
positive: '#67a353'   // Success / Positive trend
info: '#3184c2'       // Informational
neutral: '#8c8c94'    // Neutral / Stable
```

### Color Scales (for gradients/intensity)

Each scale has 10 values from light (300) to dark (1200):

```typescript
// Blue Scale
BLUE_SCALE.blue300   // #688ae8 (lightest)
BLUE_SCALE.blue600   // #3759ce (medium)
BLUE_SCALE.blue1200  // #1b2b88 (darkest)

// Also available: TEAL_SCALE, PURPLE_SCALE, PINK_SCALE,
// ORANGE_SCALE, GREEN_SCALE, RED_SCALE
```

### Pre-mapped Use Cases

```typescript
USE_CASE_COLORS.businessOpen        // #67a353
USE_CASE_COLORS.businessClosed      // #ba2e0f
USE_CASE_COLORS.trendImproving      // #67a353
USE_CASE_COLORS.trendDeclining      // #ba2e0f
USE_CASE_COLORS.trendStable         // #8c8c94
USE_CASE_COLORS.primarySeries       // #688ae8
USE_CASE_COLORS.secondarySeries     // #2ea597
USE_CASE_COLORS.tertiarySeries      // #c33d69
USE_CASE_COLORS.marketLeader        // #67a353
USE_CASE_COLORS.hiddenGem          // #4066df
USE_CASE_COLORS.atRisk             // #ba2e0f
USE_CASE_COLORS.challenger         // #8c8c94
```

---

## Design Tokens Package

The project includes `@cloudscape-design/design-tokens` npm package with all official Cloudscape colors.

**Location:** `node_modules/@cloudscape-design/design-tokens/index-visual-refresh.json`

This JSON file contains all color tokens with both light and dark mode values.

---

## Accessibility

All Cloudscape colors are designed with accessibility in mind:
- ✅ **Minimum 3:1 contrast ratio** against backgrounds
- ✅ **WCAG AA compliant** when used properly
- ✅ **Color scales** numbered by contrast ratio (300 = 3:1, 1200 = 12:1)
- ✅ **Themeable** - supports light and dark modes

---

## Best Practices

### Do ✅
- Use `CATEGORICAL_COLORS` for different data series
- Use `STATUS_COLORS` for trends, states, and severity
- Limit to **8 colors max** for line/bar charts
- Limit to **5 colors max** for pie/donut charts
- Use `withAlpha()` helper for transparency
- Add comments in CSS indicating which Cloudscape token is used
- Maintain consistency across all visualizations

### Don't ❌
- Don't use random hex codes without checking Cloudscape palette first
- Don't mix Cloudscape colors with non-Cloudscape colors
- Don't use more than 8-12 categorical colors in a single chart
- Don't rely on color alone (use labels, patterns, and text too)
- Don't use data visualization colors for UI elements (buttons, etc.)

---

## Migration Checklist

- [x] Installed `@cloudscape-design/design-tokens` package
- [x] Created `cloudscapeColors.ts` constants file
- [x] Updated `chartConstants.ts` to use Cloudscape colors
- [x] Updated `ScatterPlot.tsx` with Cloudscape colors
- [x] Updated `CompetitivePositioningChart.tsx` with Cloudscape colors
- [x] Updated `BusinessMap.css` with Cloudscape colors
- [x] Documented all changes in this file

---

## Quick Reference Chart

| Use Case | Old Color | New Cloudscape Color | Token Name |
|----------|-----------|---------------------|------------|
| Business Line | `#00d4ff` (Cyan) | `#688ae8` (Blue) | categorical1 |
| City Average | `#b819e8` (Purple) | `#2ea597` (Teal) | categorical3 |
| Category Average | `#ff1493` (Pink) | `#c33d69` (Pink) | categorical2 |
| Improving Trend | `#10b981` (Green) | `#67a353` (Green) | status.positive |
| Declining Trend | `#ef4444` (Red) | `#ba2e0f` (Red) | status.high |
| Stable Trend | `#64748b` (Gray) | `#8c8c94` (Gray) | status.neutral |
| Business Open | `#10b981` (Green) | `#67a353` (Green) | status.positive |
| Business Closed | `#ef4444` (Red) | `#ba2e0f` (Red) | status.high |
| Hidden Gem | `#3b82f6` (Blue) | `#4066df` (Blue) | blue.blue500 |

---

## Resources

- **Cloudscape Design System**: https://cloudscape.design/
- **Data Visualization Colors**: https://cloudscape.design/foundation/visual-foundation/data-vis-colors/
- **Design Tokens**: https://cloudscape.design/foundation/visual-foundation/design-tokens/
- **NPM Package**: https://www.npmjs.com/package/@cloudscape-design/design-tokens
- **GitHub Repository**: https://github.com/cloudscape-design

---

## Support

For questions about Cloudscape colors:
1. Check the official documentation: https://cloudscape.design/
2. Review `frontend/src/theme/cloudscapeColors.ts` for available colors
3. Check component implementations for usage examples

---

**Last Updated:** 2025-01-19
**Cloudscape Version:** Latest (via @cloudscape-design/design-tokens)
