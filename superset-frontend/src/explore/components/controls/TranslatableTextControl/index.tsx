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
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useSelector } from 'react-redux';
import { logging } from '@apache-superset/core';
import { isFeatureEnabled, FeatureFlag } from '@superset-ui/core';
import { Constants, Input } from '@superset-ui/core/components';
import { SupersetClient } from '@superset-ui/core/connection';
import { debounce } from 'lodash';
import ControlHeader from '../../ControlHeader';
import TextControl from '../TextControl';
import TranslationInput from 'src/components/TranslationInput';
import {
  LocaleSwitcher,
  DEFAULT_LOCALE_KEY,
} from 'src/components/TranslationEditor';
import type { Translations, LocaleInfo } from 'src/types/Localization';
import type { ExploreActions } from 'src/explore/actions/exploreActions';
import type { QueryFormData } from '@superset-ui/core';

export interface TranslatableTextControlProps {
  name: string;
  label?: string;
  description?: string;
  placeholder?: string;
  value?: string | null;
  disabled?: boolean;
  onChange?: (value: string, errors: any[]) => void;
  actions?: Partial<ExploreActions> & Pick<ExploreActions, 'setControlValue'>;
  formData?: QueryFormData | null;
  renderTrigger?: boolean;
  [key: string]: unknown;
}

export default function TranslatableTextControl({
  name,
  label,
  value,
  onChange,
  actions,
  formData,
  placeholder,
  disabled,
  ...rest
}: TranslatableTextControlProps) {
  const localizationEnabled = isFeatureEnabled(
    FeatureFlag.EnableContentLocalization,
  );

  // --- Locale state (hooks always called, effects gated by flag) ---
  const [allLocales, setAllLocales] = useState<LocaleInfo[]>([]);
  const [defaultLocale, setDefaultLocale] = useState('');
  const userLocale: string = useSelector(
    (state: { common: { locale: string } }) => state.common.locale,
  );
  const [activeLocale, setActiveLocale] = useState(DEFAULT_LOCALE_KEY);
  const [localesLoaded, setLocalesLoaded] = useState(false);

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

  const translations: Translations = (formData as Record<string, unknown>)
    ?.translations as Translations ?? {};
  const fieldTranslations = translations[name] ?? {};

  const translationsRef = useRef(translations);
  translationsRef.current = translations;
  const fieldTranslationsRef = useRef(fieldTranslations);
  fieldTranslationsRef.current = fieldTranslations;

  useEffect(() => {
    if (!localizationEnabled || !localesLoaded || !userLocale) return;
    if (fieldTranslationsRef.current[userLocale]) {
      setActiveLocale(userLocale);
    } else {
      setActiveLocale(DEFAULT_LOCALE_KEY);
    }
  }, [localizationEnabled, localesLoaded, userLocale]);

  // --- Feature flag off → plain TextControl ---
  if (!localizationEnabled) {
    return (
      <TextControl
        name={name}
        label={label}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        {...rest}
      />
    );
  }

  const isLocaleMode = activeLocale !== DEFAULT_LOCALE_KEY;
  const defaultValue = String(value ?? '');

  const localeSwitcher =
    allLocales.length > 0 ? (
      <LocaleSwitcher
        fieldName={name}
        defaultValue={defaultValue}
        translations={translations}
        allLocales={allLocales}
        defaultLocale={defaultLocale}
        userLocale={userLocale}
        activeLocale={activeLocale}
        onLocaleChange={setActiveLocale}
        fieldLabel={String(label ?? name)}
      />
    ) : null;

  if (isLocaleMode) {
    return (
      <TranslatableTextControlLocaleMode
        name={name}
        label={label}
        translationValue={fieldTranslations[activeLocale] ?? ''}
        placeholder={defaultValue}
        disabled={disabled}
        suffix={localeSwitcher}
        activeLocale={activeLocale}
        translationsRef={translationsRef}
        fieldTranslationsRef={fieldTranslationsRef}
        setControlValue={actions?.setControlValue}
        controlHeaderProps={rest}
      />
    );
  }

  return (
    <TranslatableTextControlDefaultMode
      name={name}
      label={label}
      value={defaultValue}
      placeholder={placeholder}
      disabled={disabled}
      suffix={localeSwitcher}
      onChange={onChange}
      controlHeaderProps={rest}
    />
  );
}

// --- Default locale mode: Input with debounced onChange ---
function TranslatableTextControlDefaultMode({
  name,
  label,
  value,
  placeholder,
  disabled,
  suffix,
  onChange,
  controlHeaderProps,
}: {
  name: string;
  label?: string;
  value: string;
  placeholder?: string;
  disabled?: boolean;
  suffix: React.ReactNode;
  onChange?: (value: string, errors: any[]) => void;
  controlHeaderProps: Record<string, unknown>;
}) {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const debouncedOnChange = useMemo(
    () =>
      debounce((val: string) => {
        onChange?.(val, []);
      }, Constants.FAST_DEBOUNCE),
    [onChange],
  );

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setLocalValue(e.target.value);
      debouncedOnChange(e.target.value);
    },
    [debouncedOnChange],
  );

  return (
    <div>
      <ControlHeader name={name} label={label} {...controlHeaderProps} />
      <Input
        type="text"
        data-test="inline-name"
        placeholder={placeholder}
        onChange={handleChange}
        value={localValue}
        disabled={disabled}
        suffix={suffix}
        aria-label={label}
      />
    </div>
  );
}

// --- Locale mode: TranslationInput writing to formData.translations ---
function TranslatableTextControlLocaleMode({
  name,
  label,
  translationValue,
  placeholder,
  disabled,
  suffix,
  activeLocale,
  translationsRef,
  fieldTranslationsRef,
  setControlValue,
  controlHeaderProps,
}: {
  name: string;
  label?: string;
  translationValue: string;
  placeholder?: string;
  disabled?: boolean;
  suffix: React.ReactNode;
  activeLocale: string;
  translationsRef: React.MutableRefObject<Translations>;
  fieldTranslationsRef: React.MutableRefObject<Record<string, string>>;
  setControlValue?: (name: string, value: unknown) => void;
  controlHeaderProps: Record<string, unknown>;
}) {
  const handleChange = useCallback(
    (val: string) => {
      setControlValue?.('translations', {
        ...translationsRef.current,
        [name]: {
          ...fieldTranslationsRef.current,
          [activeLocale]: val,
        },
      });
    },
    [setControlValue, translationsRef, fieldTranslationsRef, name, activeLocale],
  );

  return (
    <div>
      <ControlHeader name={name} label={label} {...controlHeaderProps} />
      <TranslationInput
        value={translationValue}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        suffix={suffix}
        aria-label={label}
      />
    </div>
  );
}
