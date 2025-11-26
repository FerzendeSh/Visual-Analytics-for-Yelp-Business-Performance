export const CARD_BACKGROUND = '#0f1b2a';
export const CARD_SHADOW = '0 8px 32px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(102, 126, 234, 0.15)';
export const BORDER_RADIUS_LG = '16px';
export const BORDER_RADIUS_MD = '8px';
export const CARD_BORDER_COLOR = 'rgba(102, 126, 234, 0.25)';
export const CARD_BORDER = `1px solid ${CARD_BORDER_COLOR}`;

export const CARD_STYLE = {
  background: CARD_BACKGROUND,
  border: CARD_BORDER,
  borderRadius: BORDER_RADIUS_LG,
  boxShadow: CARD_SHADOW,
} as const;

export const SHARED_CLASSES = {
  card: 'shared-card',
  cardShadow: 'shared-card-shadow',
  borderRadiusLg: 'shared-border-radius-lg',
} as const;
