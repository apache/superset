/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { CSSProperties } from 'react';
import { CdlStyle } from './types';

/**
 * Styling stays inside the no-code invariant: a node's `style` is a data object
 * (never a CSS string), restricted to an allowlist of layout/appearance
 * properties. Values may reference antd theme tokens as `@tokenName`, so
 * AI-authored styling still respects light/dark theming.
 */
export const STYLE_PROPERTIES: ReadonlySet<string> = new Set([
  // spacing
  'padding',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'margin',
  'marginTop',
  'marginRight',
  'marginBottom',
  'marginLeft',
  'gap',
  'rowGap',
  'columnGap',
  // sizing
  'width',
  'minWidth',
  'maxWidth',
  'height',
  'minHeight',
  'maxHeight',
  // surface
  'background',
  'backgroundColor',
  'color',
  'border',
  'borderColor',
  'borderWidth',
  'borderStyle',
  'borderRadius',
  'boxShadow',
  'opacity',
  'overflow',
  // typography
  'fontSize',
  'fontWeight',
  'fontFamily',
  'lineHeight',
  'letterSpacing',
  'textAlign',
  'textTransform',
  // layout
  'display',
  'flex',
  'flexDirection',
  'flexWrap',
  'alignItems',
  'justifyContent',
  'alignSelf',
  'gridTemplateColumns',
  'gridTemplateRows',
  'gridColumn',
  'gridRow',
  // freeform positioning + transforms (overlap, rotation, pinning)
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'inset',
  'zIndex',
  'transform',
  'transformOrigin',
  'rotate',
  'scale',
  'translate',
  'transition',
  'aspectRatio',
  'objectFit',
  'filter',
  'backdropFilter',
  'mixBlendMode',
  'cursor',
  'pointerEvents',
]);

/** Values that could smuggle behaviour or external fetches into CSS. */
const UNSAFE_VALUE = /url\(|expression\(|javascript:|@import|<|\/\*/i;

const TOKEN_REF = /^@([A-Za-z_][\w]*)$/;

export const isTokenRef = (value: unknown): value is string =>
  typeof value === 'string' && TOKEN_REF.test(value);

/**
 * Validate a node's `style`. Returns human-readable errors (empty == valid).
 * Shared shape with the server-side validator in
 * superset/mcp_service/canvas/validation.py.
 */
export function validateStyle(style: unknown, path: string): string[] {
  const errors: string[] = [];
  if (style === undefined) {
    return errors;
  }
  if (typeof style !== 'object' || style === null || Array.isArray(style)) {
    errors.push(`${path}: style must be an object`);
    return errors;
  }
  Object.entries(style as Record<string, unknown>).forEach(([prop, value]) => {
    if (!STYLE_PROPERTIES.has(prop)) {
      errors.push(`${path}.${prop}: unsupported style property`);
      return;
    }
    if (typeof value !== 'string' && typeof value !== 'number') {
      errors.push(`${path}.${prop}: style values must be a string or number`);
      return;
    }
    if (typeof value === 'string' && UNSAFE_VALUE.test(value)) {
      errors.push(`${path}.${prop}: disallowed value`);
    }
  });
  return errors;
}

/**
 * Resolve a validated `style` into React inline styles, substituting
 * `@tokenName` references from the active theme. Unknown properties and unsafe
 * values are dropped rather than thrown, so a bad style never breaks a render.
 */
export function resolveStyle(
  style: CdlStyle | undefined,
  theme: Record<string, unknown>,
): CSSProperties | undefined {
  if (!style) {
    return undefined;
  }
  const out: Record<string, string | number> = {};
  Object.entries(style).forEach(([prop, value]) => {
    if (!STYLE_PROPERTIES.has(prop)) {
      return;
    }
    if (typeof value === 'string' && UNSAFE_VALUE.test(value)) {
      return;
    }
    if (isTokenRef(value)) {
      const token = value.slice(1);
      const resolved = theme[token];
      if (typeof resolved === 'string' || typeof resolved === 'number') {
        out[prop] = resolved;
      }
      return;
    }
    if (typeof value === 'string' || typeof value === 'number') {
      out[prop] = value;
    }
  });
  return Object.keys(out).length ? (out as CSSProperties) : undefined;
}
