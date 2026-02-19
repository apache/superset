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
import { type ReactNode, createElement, useCallback, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { t } from '@apache-superset/core';
import { isFeatureEnabled, FeatureFlag } from '@superset-ui/core';
import type { Translations } from 'src/types/Localization';
import LocaleSwitcher from './LocaleSwitcher';
import { DEFAULT_LOCALE_KEY } from './utils';
import useAvailableLocales from './useAvailableLocales';

export interface UseTranslatableTitleParams {
  /** Current default title. */
  title: string;
  /** Full translations object for the entity. */
  translations?: Translations;
  /** Translation field key (e.g., 'sliceNameOverride', 'text', 'slice_name'). */
  fieldName: string;
  /** Save default title callback. */
  onSaveTitle: (value: string) => void;
  /** Save translations callback. */
  onTranslationsChange: (translations: Translations) => void;
  /** Human-readable field label for accessibility (e.g., 'Chart Name'). */
  fieldLabel: string;
}

export interface UseTranslatableTitleResult {
  /** Title to display in EditableTitle — localized value when in locale mode. */
  displayTitle: string;
  /** Routes to onSaveTitle or onTranslationsChange based on activeLocale. */
  handleSave: (value: string) => void;
  /** 'DEFAULT' or a locale code (e.g., 'de'). */
  activeLocale: string;
  /** Switch the active locale. */
  setActiveLocale: (locale: string) => void;
  /** Whether a specific locale (not DEFAULT) is active. */
  isLocaleMode: boolean;
  /** Pre-rendered LocaleSwitcher component, or null when feature is off / no locales. */
  localeSwitcher: ReactNode | null;
  /** Whether locale UI should be shown. */
  showLocale: boolean;
  /** Placeholder for translation input when in locale mode. */
  placeholder: string;
}

/**
 * Hook for inline translatable title editors.
 *
 * Encapsulates locale state, display value resolution, save routing,
 * and LocaleSwitcher rendering for components like SliceHeader, Tab,
 * ExploreChartHeader, and Dashboard Header.
 */
export default function useTranslatableTitle({
  title,
  translations,
  fieldName,
  onSaveTitle,
  onTranslationsChange,
  fieldLabel,
}: UseTranslatableTitleParams): UseTranslatableTitleResult {
  const localizationEnabled = isFeatureEnabled(
    FeatureFlag.EnableContentLocalization,
  );
  const { allLocales, defaultLocale } = useAvailableLocales();
  const userLocale: string = useSelector(
    (state: { common: { locale: string } }) => state.common?.locale ?? 'en',
  );

  const [activeLocale, setActiveLocale] = useState(DEFAULT_LOCALE_KEY);

  const isLocaleMode = activeLocale !== DEFAULT_LOCALE_KEY;
  const showLocale = localizationEnabled && allLocales.length > 0;

  const displayTitle = useMemo(() => {
    if (!isLocaleMode) return title;
    return translations?.[fieldName]?.[activeLocale] ?? '';
  }, [isLocaleMode, title, translations, fieldName, activeLocale]);

  const handleSave = useCallback(
    (value: string) => {
      if (!isLocaleMode) {
        onSaveTitle(value);
        return;
      }
      onTranslationsChange({
        ...(translations ?? {}),
        [fieldName]: {
          ...(translations?.[fieldName] ?? {}),
          [activeLocale]: value,
        },
      });
    },
    [
      isLocaleMode,
      activeLocale,
      fieldName,
      translations,
      onSaveTitle,
      onTranslationsChange,
    ],
  );

  const placeholder = isLocaleMode
    ? t('Translation for %s', activeLocale.toUpperCase())
    : '';

  const localeSwitcher: ReactNode | null = useMemo(() => {
    if (!showLocale) return null;
    return createElement(LocaleSwitcher, {
      fieldName,
      defaultValue: title,
      translations: translations ?? {},
      allLocales,
      defaultLocale,
      userLocale,
      activeLocale,
      onLocaleChange: setActiveLocale,
      fieldLabel,
    });
  }, [
    showLocale,
    fieldName,
    title,
    translations,
    allLocales,
    defaultLocale,
    userLocale,
    activeLocale,
    fieldLabel,
  ]);

  return {
    displayTitle,
    handleSave,
    activeLocale,
    setActiveLocale,
    isLocaleMode,
    localeSwitcher,
    showLocale,
    placeholder,
  };
}
