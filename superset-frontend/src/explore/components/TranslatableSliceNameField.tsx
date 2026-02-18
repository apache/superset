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
import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { logging } from '@apache-superset/core';
import { isFeatureEnabled, FeatureFlag } from '@superset-ui/core';
import { Input } from '@superset-ui/core/components';
import { SupersetClient } from '@superset-ui/core/connection';
import TranslationInput from 'src/components/TranslationInput';
import {
  LocaleSwitcher,
  DEFAULT_LOCALE_KEY,
} from 'src/components/TranslationEditor';
import type { Translations, LocaleInfo } from 'src/types/Localization';

export interface TranslatableSliceNameFieldProps {
  /** HTML name attribute for the input element. */
  name?: string;
  /** Current value in the default locale. */
  value: string;
  /** Called when the default-locale value changes. */
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  /** Translations for all fields on this entity. */
  translations: Translations;
  /** Called when any translation value changes. */
  onTranslationsChange: (translations: Translations) => void;
  /** Translation field key within translations dict. Default: 'slice_name'. */
  fieldName?: string;
  /** Human-readable field label for accessibility. */
  fieldLabel?: string;
  /** Input placeholder text. */
  placeholder?: string;
  /** data-test attribute for testing. */
  'data-test'?: string;
}

/**
 * Translatable input for entity name fields (e.g., slice_name).
 *
 * Feature flag OFF → plain Input (no hooks, no Redux, no API calls).
 * Feature flag ON  → Input + LocaleSwitcher suffix for locale switching.
 *
 * Renders only the input element. The label is provided by the parent
 * (e.g., FormItem).
 */
export default function TranslatableSliceNameField(
  props: TranslatableSliceNameFieldProps,
) {
  if (!isFeatureEnabled(FeatureFlag.EnableContentLocalization)) {
    return (
      <Input
        name={props.name}
        type="text"
        placeholder={props.placeholder}
        value={props.value}
        onChange={props.onChange}
        data-test={props['data-test']}
      />
    );
  }

  return <TranslatableSliceNameFieldInner {...props} />;
}

function TranslatableSliceNameFieldInner({
  name: inputName,
  value,
  onChange,
  translations,
  onTranslationsChange,
  fieldName = 'slice_name',
  fieldLabel,
  placeholder,
  'data-test': dataTest,
}: TranslatableSliceNameFieldProps) {
  const [allLocales, setAllLocales] = useState<LocaleInfo[]>([]);
  const [defaultLocale, setDefaultLocale] = useState('');
  const userLocale: string = useSelector(
    (state: { common: { locale: string } }) => state.common.locale,
  );
  const [activeLocale, setActiveLocale] = useState(DEFAULT_LOCALE_KEY);
  const [localesLoaded, setLocalesLoaded] = useState(false);

  useEffect(() => {
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
  }, []);

  const fieldTranslations = translations[fieldName] ?? {};
  const fieldTranslationsRef = useRef(fieldTranslations);
  fieldTranslationsRef.current = fieldTranslations;

  useEffect(() => {
    if (!localesLoaded || !userLocale) return;
    if (fieldTranslationsRef.current[userLocale]) {
      setActiveLocale(userLocale);
    } else {
      setActiveLocale(DEFAULT_LOCALE_KEY);
    }
  }, [localesLoaded, userLocale]);

  const isLocaleMode = activeLocale !== DEFAULT_LOCALE_KEY;

  const handleTranslationChange = (val: string) => {
    onTranslationsChange({
      ...translations,
      [fieldName]: {
        ...(translations[fieldName] ?? {}),
        [activeLocale]: val,
      },
    });
  };

  const localeSwitcher =
    allLocales.length > 0 ? (
      <LocaleSwitcher
        fieldName={fieldName}
        defaultValue={value}
        translations={translations}
        allLocales={allLocales}
        defaultLocale={defaultLocale}
        userLocale={userLocale}
        activeLocale={activeLocale}
        onLocaleChange={setActiveLocale}
        fieldLabel={fieldLabel ?? fieldName}
      />
    ) : null;

  if (isLocaleMode) {
    return (
      <TranslationInput
        value={fieldTranslations[activeLocale] ?? ''}
        onChange={handleTranslationChange}
        placeholder={value}
        suffix={localeSwitcher}
        data-test={dataTest}
      />
    );
  }

  return (
    <Input
      name={inputName}
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      suffix={localeSwitcher}
      data-test={dataTest}
    />
  );
}
