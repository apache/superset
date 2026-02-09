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
  ChangeEvent,
  FC,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useSelector } from 'react-redux';
import { logging, t } from '@apache-superset/core';
import { isFeatureEnabled, FeatureFlag } from '@superset-ui/core';
import { css } from '@apache-superset/core/ui';
import { Input } from '@superset-ui/core/components';
import { SupersetClient } from '@superset-ui/core/connection';
import {
  LocaleSwitcher,
  DEFAULT_LOCALE_KEY,
} from 'src/components/TranslationEditor';
import type { Translations, LocaleInfo } from 'src/types/Localization';

export interface MetricLabelTranslationsProps {
  currentLabel: string;
  hasCustomLabel: boolean;
  translations: Translations;
  onTranslationsChange: (translations: Translations) => void;
}

/**
 * Self-contained locale switcher + translation input for adhoc metric labels.
 * Fetches available locales, manages active locale state, renders
 * LocaleSwitcher dropdown and a text input for the selected locale.
 * Returns null when localization is disabled or no custom label exists.
 */
const MetricLabelTranslations: FC<MetricLabelTranslationsProps> = ({
  currentLabel,
  hasCustomLabel,
  translations,
  onTranslationsChange,
}) => {
  const localizationEnabled = isFeatureEnabled(
    FeatureFlag.EnableContentLocalization,
  );

  const [allLocales, setAllLocales] = useState<LocaleInfo[]>([]);
  const [defaultLocale, setDefaultLocale] = useState('');
  const userLocale: string = useSelector(
    (state: { common: { locale: string } }) => state.common.locale,
  );
  const [activeLocale, setActiveLocale] = useState(DEFAULT_LOCALE_KEY);
  const [localesLoaded, setLocalesLoaded] = useState(false);

  const translationsRef = useRef(translations);
  translationsRef.current = translations;

  useEffect(() => {
    if (!localizationEnabled) return;
    SupersetClient.get({
      endpoint: '/api/v1/localization/available_locales',
    }).then(
      response => {
        const { locales, default_locale } = response.json.result;
        setAllLocales(locales);
        setDefaultLocale(default_locale);
        setLocalesLoaded(true);
      },
      err => logging.error('Failed to fetch available locales', err),
    );
  }, [localizationEnabled]);

  useEffect(() => {
    if (!localesLoaded || !userLocale) return;
    const labelTranslations = translationsRef.current.label;
    if (labelTranslations?.[userLocale]) {
      setActiveLocale(userLocale);
    } else {
      setActiveLocale(DEFAULT_LOCALE_KEY);
    }
  }, [localesLoaded, userLocale]);

  const isLocaleMode = activeLocale !== DEFAULT_LOCALE_KEY;

  const handleTranslationInput = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (!isLocaleMode) return;
      onTranslationsChange({
        ...translations,
        label: {
          ...(translations.label ?? {}),
          [activeLocale]: e.target.value,
        },
      });
    },
    [isLocaleMode, activeLocale, translations, onTranslationsChange],
  );

  if (!localizationEnabled || !hasCustomLabel || allLocales.length === 0) {
    return null;
  }

  const localeInputValue = isLocaleMode
    ? (translations.label?.[activeLocale] ?? '')
    : '';

  return (
    <div
      css={css`
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 0 4px;
      `}
      data-test="MetricLabelTranslations"
    >
      <LocaleSwitcher
        fieldName="label"
        defaultValue={currentLabel}
        translations={translations}
        allLocales={allLocales}
        defaultLocale={defaultLocale}
        userLocale={userLocale}
        activeLocale={activeLocale}
        onLocaleChange={setActiveLocale}
        fieldLabel={t('Metric Label')}
      />
      {isLocaleMode && (
        <Input
          type="text"
          placeholder={currentLabel}
          value={localeInputValue}
          onChange={handleTranslationInput}
          data-test="MetricLabelTranslation#input"
          css={css`
            flex: 1;
          `}
        />
      )}
    </div>
  );
};

export default MetricLabelTranslations;
