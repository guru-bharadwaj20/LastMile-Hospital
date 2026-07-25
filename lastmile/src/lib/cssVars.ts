import type { CSSProperties } from 'react';

/**
 * Typed handoff for CSS custom properties.
 *
 * React's CSSProperties has no index signature for `--*` keys, and neither
 * does framer-motion's MotionStyle, so passing custom properties inline is a
 * type error at every call site. Rather than scatter casts through the
 * components, the single unavoidable cast is confined here.
 *
 *   <div style={cssVars({ '--tone': color, '--level': 0.42 })} />
 */
export type CssVarMap = Record<`--${string}`, string | number>;

export function cssVars(vars: CssVarMap): CSSProperties {
  return vars as CSSProperties;
}
