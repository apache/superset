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
import { forwardRef, useMemo, type ElementType, type ReactNode } from 'react';
import { useTheme } from '@apache-superset/core/theme';
import type { ThemeConfig } from 'antd';
import { AntdThemeProvider } from '.';

/**
 * Raises the rest-state border of form controls and the divider line to the
 * 3:1 non-text contrast WCAG 2.1 SC 1.4.11 requires. antd's `colorBorder` and
 * `colorSplit` fall below 3:1 in both the light and dark themes, while
 * `colorTextTertiary` clears it in both. Only rest-state tokens change, so
 * hover, focus, status and disabled borders keep antd's own colors.
 */
export function NonTextContrastProvider({ children }: { children: ReactNode }) {
  const { colorTextTertiary, colorTextSecondary } = useTheme();

  const themeConfig = useMemo<ThemeConfig>(
    () => ({
      // A key derived from the colors lets every wrapped control share one
      // CSS-variable block per theme instead of emitting one per instance.
      cssVar: {
        key: `superset-contrast-${colorTextTertiary}-${colorTextSecondary}`.replace(
          /[^a-zA-Z0-9-]/g,
          '',
        ),
      },
      components: {
        Checkbox: { colorBorder: colorTextTertiary },
        DatePicker: { colorBorder: colorTextTertiary },
        Divider: { colorSplit: colorTextTertiary },
        Input: { colorBorder: colorTextTertiary },
        InputNumber: { colorBorder: colorTextTertiary },
        Radio: { colorBorder: colorTextTertiary },
        Select: { colorBorder: colorTextTertiary },
        // The unchecked track is the switch's boundary; its hover state
        // steps one level darker so hovering stays distinguishable.
        Switch: {
          colorTextQuaternary: colorTextTertiary,
          colorTextTertiary: colorTextSecondary,
        },
      },
    }),
    [colorTextTertiary, colorTextSecondary],
  );

  return <AntdThemeProvider theme={themeConfig}>{children}</AntdThemeProvider>;
}

/**
 * Renders an antd component inside {@link NonTextContrastProvider}. Every prop
 * and the ref are forwarded unchanged, so the result keeps the component's
 * public signature, generics included; statics are attached by the caller.
 */
export function withNonTextContrast<C extends ElementType>(Component: C): C {
  const Inner: ElementType = Component;
  const Wrapped = forwardRef<unknown, Record<string, unknown>>((props, ref) => (
    <NonTextContrastProvider>
      <Inner {...props} ref={ref} />
    </NonTextContrastProvider>
  ));
  return Wrapped as unknown as C;
}
