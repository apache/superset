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
  ChangeEventHandler,
  FocusEvent,
  KeyboardEvent,
  MouseEvent,
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
import DeferredInput from 'src/components/DeferredInput';
import {
  LocaleSwitcher,
  DEFAULT_LOCALE_KEY,
} from 'src/components/TranslationEditor';
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

const StyledDeferredInput = styled(DeferredInput)`
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
  translations?: Translations;
  onTranslationsChange?: (translations: Translations) => void;
}

const AdhocMetricEditPopoverTitle: FC<AdhocMetricEditPopoverTitleProps> = ({
  title,
  isEditDisabled,
  onChange,
  translations,
  onTranslationsChange,
}) => {
  const theme = useTheme();
  const [isHovered, setIsHovered] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  // Locale state
  const localizationEnabled = isFeatureEnabled(
    FeatureFlag.EnableContentLocalization,
  );
  const hasCustomLabel = title?.hasCustomLabel ?? false;
  const showLocale =
    localizationEnabled &&
    hasCustomLabel &&
    translations !== undefined &&
    onTranslationsChange !== undefined;

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
    if (!showLocale) return;
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
  }, [showLocale]);

  useEffect(() => {
    if (!localesLoaded || !userLocale) return;
    const labelTranslations = translationsRef.current?.label;
    if (labelTranslations?.[userLocale]) {
      setActiveLocale(userLocale);
    } else {
      setActiveLocale(DEFAULT_LOCALE_KEY);
    }
  }, [localesLoaded, userLocale]);

  const isLocaleMode = activeLocale !== DEFAULT_LOCALE_KEY;
  const localeReady = showLocale && allLocales.length > 0;

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

  const handleTranslationValue = useCallback(
    (value: string) => {
      onTranslationsChange?.({
        ...translationsRef.current,
        label: {
          ...(translationsRef.current?.label ?? {}),
          [activeLocale]: value,
        },
      });
    },
    [activeLocale, onTranslationsChange],
  );

  const handleTranslationBlur = useCallback(() => {
    handleBlur();
  }, [handleBlur]);

  /** Prevent input blur when clicking suffix (LocaleSwitcher dropdown). */
  const preventBlur = useCallback((e: MouseEvent) => {
    e.preventDefault();
  }, []);

  // LocaleSwitcher element (indicator or interactive)
  const localeSwitcher = localeReady
    ? (interactive: boolean) => (
        <LocaleSwitcher
          fieldName="label"
          defaultValue={title?.label ?? ''}
          translations={translations ?? {}}
          allLocales={allLocales}
          defaultLocale={defaultLocale}
          userLocale={userLocale}
          activeLocale={activeLocale}
          onLocaleChange={setActiveLocale}
          fieldLabel={t('Metric Label')}
          interactive={interactive}
        />
      )
    : null;

  if (isEditDisabled) {
    return (
      <span
        data-test="AdhocMetricTitle"
        css={css`
          display: inline-flex;
          align-items: center;
          gap: 4px;
        `}
      >
        {title?.label || defaultLabel}
        {localeSwitcher?.(false)}
      </span>
    );
  }

  if (isEditMode) {
    const rawSuffix = localeSwitcher?.(true);
    const suffix = rawSuffix ? (
      <span onMouseDown={preventBlur}>{rawSuffix}</span>
    ) : undefined;

    if (isLocaleMode) {
      const localeInputValue =
        translations?.label?.[activeLocale] ?? '';
      return (
        <StyledDeferredInput
          type="text"
          placeholder={title?.label}
          value={localeInputValue}
          autoFocus
          onChange={handleTranslationValue}
          onBlur={handleTranslationBlur}
          suffix={suffix}
          data-test="AdhocMetricEditTitle#input"
        />
      );
    }

    return (
      <StyledInput
        type="text"
        placeholder={title?.label}
        value={title?.hasCustomLabel ? title.label : ''}
        autoFocus
        onChange={onChange}
        onBlur={handleInputBlur}
        onKeyPress={handleKeyPress}
        suffix={suffix}
        data-test="AdhocMetricEditTitle#input"
      />
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
        {localeSwitcher?.(false)}
        &nbsp;
        <Icons.EditOutlined
          iconColor={isHovered ? theme.colorPrimary : theme.colorIcon}
          iconSize="m"
        />
      </span>
    </Tooltip>
  );
};

export default AdhocMetricEditPopoverTitle;
