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
import { useMemo } from 'react';
import type { MenuProps } from 'antd';
import { t } from '@apache-superset/core';
import { css, useTheme } from '@apache-superset/core/ui';
import {
  Badge,
  Dropdown,
  Icons,
} from '@superset-ui/core/components';
import type { Translations, LocaleInfo } from 'src/types/Localization';
import { DEFAULT_LOCALE_KEY, countFieldTranslations } from './utils';

export interface LocaleSwitcherProps {
  /** Translation field key (e.g., 'dashboard_title', 'slice_name'). */
  fieldName: string;
  /** Current default (column) value — used for ✓ indicator on DEFAULT. */
  defaultValue: string;
  /** Full translations object for the entity. */
  translations: Translations;
  /** All configured locales from server (including default locale). */
  allLocales: LocaleInfo[];
  /** Server's default locale code (e.g., 'en'). */
  defaultLocale: string;
  /** Current user's UI locale code from session. */
  userLocale: string;
  /** Currently active locale. Controlled by parent. */
  activeLocale: string;
  /** Called when user picks a locale from the dropdown. */
  onLocaleChange: (locale: string) => void;
  /** Human-readable field label for accessibility (e.g., 'Dashboard Title'). */
  fieldLabel: string;
}

/**
 * Inline locale dropdown rendered as an Input suffix.
 *
 * Displays the currently active locale (DEFAULT or a specific language)
 * with a badge showing translation count. Click opens a dropdown to
 * switch between DEFAULT text and per-locale translations.
 *
 * Yellow highlight indicates the user's locale has no translation.
 */
export default function LocaleSwitcher({
  fieldName,
  defaultValue,
  translations,
  allLocales,
  defaultLocale,
  userLocale,
  activeLocale,
  onLocaleChange,
  fieldLabel,
}: LocaleSwitcherProps) {
  const theme = useTheme();

  const fieldTranslations = translations[fieldName] ?? {};
  const translationCount = countFieldTranslations(translations, fieldName);

  const userLocaleHasTranslation =
    userLocale === defaultLocale || Boolean(fieldTranslations[userLocale]);
  const isWarning = !userLocaleHasTranslation;

  const localeMap = useMemo(
    () => new Map(allLocales.map(loc => [loc.code, loc])),
    [allLocales],
  );

  const sortedLocales = useMemo(
    () => [...allLocales].sort((a, b) => a.code.localeCompare(b.code)),
    [allLocales],
  );

  const isDefault = activeLocale === DEFAULT_LOCALE_KEY;
  const activeLocaleInfo = isDefault ? undefined : localeMap.get(activeLocale);
  const triggerFlag = activeLocaleInfo?.flag;

  const menuItems: MenuProps['items'] = useMemo(() => {
    const checkIcon = (
      <Icons.CheckOutlined
        iconSize="s"
        css={css`
          font-size: 12px;
        `}
      />
    );
    const noIcon = (
      <span
        css={css`
          display: inline-block;
          width: 14px;
        `}
      />
    );

    return [
      {
        key: DEFAULT_LOCALE_KEY,
        icon: defaultValue ? checkIcon : noIcon,
        label: (
          <span
            css={css`
              font-weight: ${activeLocale === DEFAULT_LOCALE_KEY ? 600 : 400};
            `}
          >
            {t('DEFAULT')}
          </span>
        ),
      },
      { type: 'divider' as const },
      ...sortedLocales.map(locale => ({
        key: locale.code,
        icon: fieldTranslations[locale.code] ? checkIcon : noIcon,
        label: (
          <span
            css={css`
              font-weight: ${activeLocale === locale.code ? 600 : 400};
            `}
          >
            {locale.flag ? `${locale.flag} ` : ''}
            {locale.name}
          </span>
        ),
      })),
    ];
  }, [
    sortedLocales,
    fieldTranslations,
    defaultValue,
    activeLocale,
  ]);

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    onLocaleChange(key);
  };

  const suffixColor = isWarning ? theme.colorWarning : theme.colorText;

  return (
    <Dropdown
      menu={{ items: menuItems, onClick: handleMenuClick }}
      trigger={['click']}
      getPopupContainer={() => document.body}
    >
      <span
        role="button"
        tabIndex={0}
        aria-label={t(
          'Locale switcher for %s: %s (%s translations)',
          fieldLabel,
          isDefault ? t('DEFAULT') : activeLocale,
          translationCount,
        )}
        onClick={e => e.stopPropagation()}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.stopPropagation();
            e.preventDefault();
          }
        }}
        css={css`
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          line-height: 1;
          color: ${suffixColor};
          white-space: nowrap;
          user-select: none;
        `}
      >
        {triggerFlag ? (
          <span
            css={css`
              font-size: 14px;
            `}
          >
            {triggerFlag}
          </span>
        ) : (
          <Icons.GlobalOutlined
            iconSize="m"
            css={css`
              color: ${suffixColor};
            `}
          />
        )}
        <Badge count={translationCount} size="small" showZero={false} />
        <Icons.CaretDownOutlined
          iconSize="s"
          css={css`
            font-size: 10px;
            color: ${suffixColor};
          `}
        />
      </span>
    </Dropdown>
  );
}
