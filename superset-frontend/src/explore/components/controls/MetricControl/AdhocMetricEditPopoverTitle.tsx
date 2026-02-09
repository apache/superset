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
  ChangeEventHandler,
  FocusEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
  FC,
} from 'react';
import { useSelector } from 'react-redux';

import { logging, t } from '@apache-superset/core';
import { isFeatureEnabled, FeatureFlag } from '@superset-ui/core';
import { css, styled, useTheme } from '@apache-superset/core/ui';
import { Input, Tooltip } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { SupersetClient } from '@superset-ui/core/connection';

import { LocaleSwitcher, DEFAULT_LOCALE_KEY } from 'src/components/TranslationEditor';
import type { Translations, LocaleInfo } from 'src/types/Localization';

const TitleLabel = styled.span`
  display: inline-block;
  padding: 2px 0;
`;

const StyledInput = styled(Input)`
  border-radius: ${({ theme }) => theme.borderRadius};
  height: 26px;
  padding-left: ${({ theme }) => theme.sizeUnit * 2.5}px;
`;

export interface AdhocMetricEditPopoverTitleProps {
  title?: {
    label?: string;
    hasCustomLabel?: boolean;
  };
  isEditDisabled?: boolean;
  onChange: ChangeEventHandler<HTMLInputElement>;
  /** Inline translations for the metric label. */
  translations?: Translations;
  /** Callback when translations are modified via locale switcher. */
  onTranslationsChange?: (translations: Translations) => void;
}

const AdhocMetricEditPopoverTitle: FC<AdhocMetricEditPopoverTitleProps> = ({
  title,
  isEditDisabled,
  onChange,
  translations: translationsProp,
  onTranslationsChange,
}) => {
  const theme = useTheme();
  const [isHovered, setIsHovered] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  const localizationEnabled = isFeatureEnabled(
    FeatureFlag.EnableContentLocalization,
  );

  // Locale data for LocaleSwitcher
  const [allLocales, setAllLocales] = useState<LocaleInfo[]>([]);
  const [defaultLocale, setDefaultLocale] = useState('');
  const userLocale: string = useSelector(
    (state: { common: { locale: string } }) => state.common.locale,
  );
  const [activeLocale, setActiveLocale] = useState(DEFAULT_LOCALE_KEY);
  const [localesLoaded, setLocalesLoaded] = useState(false);

  const translations = translationsProp ?? {};
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

  // Initialize activeLocale once when locales load
  useEffect(() => {
    if (!localesLoaded || !userLocale) return;
    const labelTranslations = translationsRef.current.label;
    if (labelTranslations?.[userLocale]) {
      setActiveLocale(userLocale);
    } else {
      setActiveLocale(DEFAULT_LOCALE_KEY);
    }
  }, [localesLoaded, userLocale]);

  const defaultLabel = t('My metric');

  const handleMouseOver = useCallback(() => setIsHovered(true), []);
  const handleMouseOut = useCallback(() => setIsHovered(false), []);
  const handleClick = useCallback(() => setIsEditMode(true), []);
  const handleBlur = useCallback(() => setIsEditMode(false), []);

  const handleKeyPress = useCallback(
    (ev: KeyboardEvent<HTMLInputElement>) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        handleBlur();
      }
    },
    [handleBlur],
  );

  const handleInputBlur = useCallback(
    (e: FocusEvent<HTMLInputElement>) => {
      if (e.target.value === '') {
        onChange(e);
      }

      handleBlur();
    },
    [onChange, handleBlur],
  );

  const isLocaleMode = activeLocale !== DEFAULT_LOCALE_KEY;

  const handleLocaleInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (!isLocaleMode || !onTranslationsChange) return;
      const newValue = e.target.value;
      const updated: Translations = {
        ...translations,
        label: {
          ...(translations.label ?? {}),
          [activeLocale]: newValue,
        },
      };
      onTranslationsChange(updated);
    },
    [isLocaleMode, activeLocale, translations, onTranslationsChange],
  );

  const localeInputValue = isLocaleMode
    ? (translations.label?.[activeLocale] ?? '')
    : '';

  const showLocaleSwitcher =
    localizationEnabled &&
    allLocales.length > 0 &&
    title?.hasCustomLabel;

  if (isEditDisabled) {
    return (
      <span data-test="AdhocMetricTitle">{title?.label || defaultLabel}</span>
    );
  }

  if (isEditMode) {
    return (
      <span
        css={css`
          display: flex;
          align-items: center;
          gap: 4px;
        `}
      >
        <StyledInput
          type="text"
          placeholder={title?.label}
          value={
            isLocaleMode
              ? localeInputValue
              : title?.hasCustomLabel
                ? title.label
                : ''
          }
          autoFocus
          onChange={isLocaleMode ? handleLocaleInputChange : onChange}
          onBlur={handleInputBlur}
          onKeyPress={handleKeyPress}
          data-test="AdhocMetricEditTitle#input"
        />
        {showLocaleSwitcher && (
          <LocaleSwitcher
            fieldName="label"
            defaultValue={title?.label ?? ''}
            translations={translations}
            allLocales={allLocales}
            defaultLocale={defaultLocale}
            userLocale={userLocale}
            activeLocale={activeLocale}
            onLocaleChange={setActiveLocale}
            fieldLabel={t('Metric Label')}
          />
        )}
      </span>
    );
  }

  return (
    <Tooltip placement="top" title={t('Click to edit label')}>
      <span
        className="AdhocMetricEditPopoverTitle inline-editable"
        data-test="AdhocMetricEditTitle#trigger"
        onMouseOver={handleMouseOver}
        onMouseOut={handleMouseOut}
        onClick={handleClick}
        onBlur={handleBlur}
        role="button"
        tabIndex={0}
        css={css`
          display: inline-flex;
          align-items: center;
          gap: 4px;
        `}
      >
        <TitleLabel>{title?.label || defaultLabel}</TitleLabel>
        &nbsp;
        <Icons.EditOutlined
          iconColor={isHovered ? theme.colorPrimary : theme.colorIcon}
          iconSize="m"
        />
        {showLocaleSwitcher && (
          <LocaleSwitcher
            fieldName="label"
            defaultValue={title?.label ?? ''}
            translations={translations}
            allLocales={allLocales}
            defaultLocale={defaultLocale}
            userLocale={userLocale}
            activeLocale={activeLocale}
            onLocaleChange={setActiveLocale}
            fieldLabel={t('Metric Label')}
          />
        )}
      </span>
    </Tooltip>
  );
};

export default AdhocMetricEditPopoverTitle;
