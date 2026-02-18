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
  MouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useSelector } from 'react-redux';
import { InputRef } from 'antd';
import { logging, t } from '@apache-superset/core';
import { isFeatureEnabled, FeatureFlag } from '@superset-ui/core';
import { css, styled, useTheme } from '@apache-superset/core/ui';
import { Input, Tooltip } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { SupersetClient } from '@superset-ui/core/connection';
import TranslationInput from 'src/components/TranslationInput';
import {
  LocaleSwitcher,
  DEFAULT_LOCALE_KEY,
} from 'src/components/TranslationEditor';
import type { Translations, LocaleInfo } from 'src/types/Localization';

export interface DndColumnSelectPopoverTitleProps {
  title: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  isEditDisabled: boolean;
  hasCustomLabel: boolean;
  translations?: Translations;
  onTranslationsChange?: (translations: Translations) => void;
}

const StyledInput = styled(Input)`
  border-radius: ${({ theme }) => theme.borderRadius};
  height: 26px;
  padding-left: ${({ theme }) => theme.sizeUnit * 2.5}px;
  border-color: ${({ theme }) => theme.colorSplit};
`;

const StyledTranslationInput = styled(TranslationInput)`
  border-radius: ${({ theme }) => theme.borderRadius};
  height: 26px;
  padding-left: ${({ theme }) => theme.sizeUnit * 2.5}px;
`;

export const DndColumnSelectPopoverTitle = ({
  title,
  onChange,
  isEditDisabled,
  hasCustomLabel,
  translations,
  onTranslationsChange,
}: DndColumnSelectPopoverTitleProps) => {
  const theme = useTheme();
  const [isHovered, setIsHovered] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  const localizationEnabled = isFeatureEnabled(
    FeatureFlag.EnableContentLocalization,
  );
  const showLocale =
    localizationEnabled &&
    hasCustomLabel &&
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

  const dropdownOpenRef = useRef(false);
  const inputRef = useRef<InputRef>(null);

  const handleDropdownOpenChange = useCallback((open: boolean) => {
    if (open) {
      dropdownOpenRef.current = true;
    } else {
      requestAnimationFrame(() => {
        dropdownOpenRef.current = false;
        inputRef.current?.focus();
      });
    }
  }, []);

  const onMouseOver = useCallback(() => setIsHovered(true), []);
  const onMouseOut = useCallback(() => setIsHovered(false), []);
  const onClick = useCallback(() => setIsEditMode(true), []);

  const onBlur = useCallback(() => {
    if (dropdownOpenRef.current) return;
    setIsEditMode(false);
  }, []);

  const onInputBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      if (dropdownOpenRef.current) return;
      if (e.target.value === '') {
        onChange(e);
      }
      setIsEditMode(false);
    },
    [onChange],
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
    onBlur();
  }, [onBlur]);

  const preventBlur = useCallback((e: MouseEvent) => {
    e.preventDefault();
  }, []);

  const localeSwitcher = localeReady
    ? (interactive: boolean) => (
        <LocaleSwitcher
          fieldName="label"
          defaultValue={title ?? ''}
          translations={translations ?? {}}
          allLocales={allLocales}
          defaultLocale={defaultLocale}
          userLocale={userLocale}
          activeLocale={activeLocale}
          onLocaleChange={setActiveLocale}
          fieldLabel={t('Column Label')}
          interactive={interactive}
          onDropdownOpenChange={
            interactive ? handleDropdownOpenChange : undefined
          }
        />
      )
    : null;

  const defaultLabel = t('My column');

  if (isEditDisabled) {
    return (
      <span
        css={css`
          display: inline-flex;
          align-items: center;
          gap: 4px;
        `}
      >
        {title || defaultLabel}
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
      const localeInputValue = translations?.label?.[activeLocale] ?? '';
      return (
        <StyledTranslationInput
          ref={inputRef}
          type="text"
          placeholder={title}
          value={localeInputValue}
          autoFocus
          onChange={handleTranslationValue}
          onBlur={handleTranslationBlur}
          suffix={suffix}
          aria-label={t('Edit column label translation')}
        />
      );
    }

    return (
      <StyledInput
        ref={inputRef}
        type="text"
        placeholder={title}
        value={hasCustomLabel ? title : ''}
        autoFocus
        onChange={onChange}
        onBlur={onInputBlur}
        suffix={suffix}
        aria-label={t('Edit column label')}
      />
    );
  }

  return (
    <Tooltip placement="top" title={t('Click to edit label')}>
      <span
        className="AdhocMetricEditPopoverTitle inline-editable"
        data-test="AdhocMetricEditTitle#trigger"
        onMouseOver={onMouseOver}
        onMouseOut={onMouseOut}
        onClick={onClick}
        onBlur={onBlur}
        role="button"
        tabIndex={0}
        css={css`
          display: inline-flex;
          align-items: center;
          gap: 4px;
        `}
      >
        {title || defaultLabel}
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
