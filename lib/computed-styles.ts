// ---------------------------------------------------------------------------
// Computed Style Extraction
// ---------------------------------------------------------------------------
// Reads CSS properties from DOM elements via getComputedStyle.
// Used by the design editor sidebar for live property inspection.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ComputedStyles {
  // Layout
  display: string;
  flexDirection: string;
  flexWrap: string;
  alignItems: string;
  justifyContent: string;
  gap: string;
  gridTemplateColumns: string;
  gridTemplateRows: string;
  position: string;
  top: string;
  right: string;
  bottom: string;
  left: string;

  // Spacing
  paddingTop: string;
  paddingRight: string;
  paddingBottom: string;
  paddingLeft: string;
  marginTop: string;
  marginRight: string;
  marginBottom: string;
  marginLeft: string;

  // Sizing
  width: string;
  height: string;
  minWidth: string;
  minHeight: string;
  maxWidth: string;
  maxHeight: string;

  // Typography
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  lineHeight: string;
  letterSpacing: string;
  textAlign: string;
  textDecoration: string;
  textTransform: string;
  color: string;

  // Background
  backgroundColor: string;
  backgroundImage: string;

  // Borders
  borderTopWidth: string;
  borderRightWidth: string;
  borderBottomWidth: string;
  borderLeftWidth: string;
  borderTopStyle: string;
  borderRightStyle: string;
  borderBottomStyle: string;
  borderLeftStyle: string;
  borderTopColor: string;
  borderRightColor: string;
  borderBottomColor: string;
  borderLeftColor: string;
  borderTopLeftRadius: string;
  borderTopRightRadius: string;
  borderBottomRightRadius: string;
  borderBottomLeftRadius: string;

  // Effects
  boxShadow: string;
  opacity: string;
  overflow: string;
  overflowX: string;
  overflowY: string;
  zIndex: string;
  transform: string;
  transition: string;
}

// ---------------------------------------------------------------------------
// Property list (camelCase names matching CSSStyleDeclaration)
// ---------------------------------------------------------------------------

const STYLE_PROPERTIES: (keyof ComputedStyles)[] = [
  // Layout
  'display', 'flexDirection', 'flexWrap', 'alignItems', 'justifyContent', 'gap',
  'gridTemplateColumns', 'gridTemplateRows', 'position',
  'top', 'right', 'bottom', 'left',
  // Spacing
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
  // Sizing
  'width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight',
  // Typography
  'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing',
  'textAlign', 'textDecoration', 'textTransform', 'color',
  // Background
  'backgroundColor', 'backgroundImage',
  // Borders
  'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
  'borderTopStyle', 'borderRightStyle', 'borderBottomStyle', 'borderLeftStyle',
  'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor',
  'borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius',
  // Effects
  'boxShadow', 'opacity', 'overflow', 'overflowX', 'overflowY',
  'zIndex', 'transform', 'transition',
];

// ---------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------

/**
 * Extracts all relevant computed CSS properties from a DOM element.
 * Returns resolved values (px for lengths, rgb() for colors, etc.)
 */
export function extractComputedStyles(el: HTMLElement): ComputedStyles {
  const computed = window.getComputedStyle(el);
  const styles = {} as ComputedStyles;

  for (const prop of STYLE_PROPERTIES) {
    styles[prop] = computed.getPropertyValue(
      // Convert camelCase to kebab-case for getPropertyValue
      prop.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
    );
  }

  return styles;
}

/**
 * Returns the list of CSS property keys we extract, useful for iteration.
 */
export function getStylePropertyKeys(): readonly (keyof ComputedStyles)[] {
  return STYLE_PROPERTIES;
}

/**
 * Creates an empty ComputedStyles object with all properties set to empty string.
 */
export function emptyComputedStyles(): ComputedStyles {
  const styles = {} as ComputedStyles;
  for (const prop of STYLE_PROPERTIES) {
    styles[prop] = '';
  }
  return styles;
}
