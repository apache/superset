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
import {
  forwardRef,
  useContext,
  useMemo,
  type ElementType,
  type ReactNode,
} from 'react';
import { ClassNames } from '@emotion/react';
import { ConfigProvider, theme as antdTheme, type ThemeConfig } from 'antd';
import { AntdThemeProvider } from '.';

const KEY_SUFFIX = 'superset-contrast';

type ComponentName = keyof NonNullable<ThemeConfig['components']>;
type ContrastToken = 'colorBorder' | 'colorSplit' | 'colorTextQuaternary';

const CONTRAST_TARGETS: [ComponentName, ContrastToken][] = [
  ['Checkbox', 'colorBorder'],
  ['DatePicker', 'colorBorder'],
  ['Divider', 'colorSplit'],
  ['Input', 'colorBorder'],
  ['InputNumber', 'colorBorder'],
  ['Radio', 'colorBorder'],
  ['Select', 'colorBorder'],
  ['Switch', 'colorTextQuaternary'],
];

/**
 * Whether the theme configuration itself sets `tokenName`, globally or, when
 * given, for `component`. Reads the configured theme (as passed to antd's
 * ConfigProvider), not the algorithm-derived tokens.
 */
const isSetByTheme = (
  themeConfig: ThemeConfig | undefined,
  tokenName: ContrastToken,
  component?: ComponentName,
) =>
  themeConfig?.token?.[tokenName] !== undefined ||
  (component !== undefined &&
    (
      themeConfig?.components?.[component] as
        | Record<string, unknown>
        | undefined
    )?.[tokenName] !== undefined);

/**
 * Color for a boundary drawn outside the wrapped antd controls (chart axes,
 * custom controls): the theme's own `tokenName` when the configured theme sets
 * it, otherwise `colorTextTertiary` for 3:1 non-text contrast (WCAG 2.1
 * SC 1.4.11). Without a configured theme it falls back to the latter.
 */
export function useNonTextContrastColor(
  tokenName: 'colorBorder' | 'colorSplit',
): string {
  const { token } = antdTheme.useToken();
  const { theme: configuredTheme } = useContext(ConfigProvider.ConfigContext);
  return isSetByTheme(configuredTheme, tokenName)
    ? token[tokenName]
    : token.colorTextTertiary;
}

/**
 * Raises the rest-state border of form controls and the divider line to the
 * 3:1 non-text contrast WCAG 2.1 SC 1.4.11 requires, using `colorTextTertiary`
 * in place of `colorBorder` (inputs, selects, pickers, checkboxes, radios),
 * `colorSplit` (dividers) and `colorTextQuaternary` (the unchecked switch
 * track). A value the theme sets itself, globally (`token.colorBorder`) or
 * per component (`components.Input.colorBorder`), takes precedence and is
 * left untouched. Hover, focus and status borders use other tokens and keep
 * antd's colors. Checkbox, radio and switch draw their disabled state from the same
 * tokens; {@link withNonTextContrast} keeps those for disabled controls.
 */
export function NonTextContrastProvider({
  children,
  disabled,
}: {
  children: ReactNode;
  /**
   * Set by wrappers that keep antd's disabled colors: when true the override
   * is skipped and the subtree is marked disabled, so wrapped descendants
   * (e.g. the buttons of a disabled Radio.Group) skip it too. Only the
   * provider's props change with it, never the element tree, so toggling
   * `disabled` does not remount the control.
   */
  disabled?: boolean;
}) {
  const { token } = antdTheme.useToken();
  const { theme: parentTheme } = useContext(ConfigProvider.ConfigContext);
  const parentKey = parentTheme?.cssVar?.key;
  const { colorTextTertiary } = token;

  const themeConfig = useMemo<ThemeConfig>(
    () => ({
      // antd writes a provider's token variables to a single style block per
      // key. Deriving the key from the parent provider's own key lets the
      // controls under one theme share that block, while controls under
      // differently themed parents never share one; without a parent key,
      // antd falls back to a unique key per provider.
      // A disabled subtree carries different tokens, so it gets its own key.
      ...(parentKey
        ? {
            cssVar: {
              key: `${parentKey}-${KEY_SUFFIX}${disabled ? '-disabled' : ''}`,
            },
          }
        : {}),
      components: disabled
        ? {}
        : Object.fromEntries(
            CONTRAST_TARGETS.filter(
              ([component, tokenName]) =>
                !isSetByTheme(parentTheme, tokenName, component),
            ).map(([component, tokenName]) => [
              component,
              { [tokenName]: colorTextTertiary },
            ]),
          ),
    }),
    [parentKey, parentTheme, colorTextTertiary, disabled],
  );

  // Controls nested in an already wrapped control (e.g. a Radio inside a
  // wrapped Radio.Group) inherit its tokens and need no provider of their own.
  if (parentKey?.includes(KEY_SUFFIX)) {
    return <>{children}</>;
  }
  return (
    // antd adds a context provider only when `componentDisabled` is defined,
    // so wrappers that track `disabled` always pass a boolean.
    <AntdThemeProvider
      theme={themeConfig}
      {...(disabled === undefined ? {} : { componentDisabled: disabled })}
    >
      {children}
    </AntdThemeProvider>
  );
}

type WithNonTextContrastOptions = {
  /**
   * Keep antd's disabled colors: a disabled control (by prop or by a disabled
   * Form/ConfigProvider) and the wrapped controls inside it render without the
   * override, and disabled checkboxes and radios nested in an enabled control
   * (e.g. disabled options of a group) get antd's `colorBorder` back.
   */
  keepDisabledColors?: boolean;
};

/**
 * Renders an antd component inside {@link NonTextContrastProvider}. Every prop
 * and the ref are forwarded unchanged, so the result keeps the component's
 * public signature, generics included; statics are attached by the caller.
 */
export function withNonTextContrast<C extends ElementType>(
  Component: C,
  { keepDisabledColors = false }: WithNonTextContrastOptions = {},
): C {
  const Inner: ElementType = Component;
  const Wrapped = forwardRef<unknown, Record<string, unknown>>((props, ref) => {
    // Read outside the provider: these are the theme's own token values.
    const { token } = antdTheme.useToken();
    const { componentDisabled } = ConfigProvider.useConfig();
    const { getPrefixCls, theme: parentTheme } = useContext(
      ConfigProvider.ConfigContext,
    );

    if (!keepDisabledColors) {
      return (
        <NonTextContrastProvider>
          <Inner {...props} ref={ref} />
        </NonTextContrastProvider>
      );
    }
    // The element tree stays the same whether or not the control is
    // disabled; only provider props and the class name change.
    const disabled = Boolean(props.disabled ?? componentDisabled);
    const cls = getPrefixCls();
    const varPrefix = parentTheme?.cssVar?.prefix ?? cls;
    // Only restore what the provider overrides; a theme's own value stays.
    const restoredSelectors = [
      ...(isSetByTheme(parentTheme, 'colorBorder', 'Checkbox')
        ? []
        : [`& .${cls}-checkbox-disabled`]),
      ...(isSetByTheme(parentTheme, 'colorBorder', 'Radio')
        ? []
        : [
            `& .${cls}-radio-disabled`,
            `& .${cls}-radio-button-wrapper.${cls}-radio-button-wrapper-disabled`,
          ]),
    ];
    return (
      <NonTextContrastProvider disabled={disabled}>
        <ClassNames>
          {({ css, cx }) => (
            <Inner
              {...props}
              ref={ref}
              className={cx(
                props.className as string | undefined,
                restoredSelectors.length > 0 &&
                  css`
                    ${restoredSelectors.join(',\n')} {
                      --${varPrefix}-color-border: ${token.colorBorder};
                    }
                  `,
              )}
            />
          )}
        </ClassNames>
      </NonTextContrastProvider>
    );
  });
  const name =
    typeof Component === 'string'
      ? Component
      : (Component as { displayName?: string; name?: string }).displayName ||
        (Component as { name?: string }).name;
  Wrapped.displayName = `NonTextContrast(${name || 'Component'})`;
  return Wrapped as unknown as C;
}
