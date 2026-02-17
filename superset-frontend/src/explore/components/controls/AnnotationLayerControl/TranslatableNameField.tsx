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
import TextControl from 'src/explore/components/controls/TextControl';
import TranslationInput from 'src/components/TranslationInput';
import {
  LocaleSwitcher,
  DEFAULT_LOCALE_KEY,
} from 'src/components/TranslationEditor';
import ControlHeader from 'src/explore/components/ControlHeader';
import type { Translations, LocaleInfo } from 'src/types/Localization';

export interface TranslatableNameFieldProps {
  value: string;
  onChange: (name: string) => void;
  translations: Translations;
  onTranslationsChange: (translations: Translations) => void;
  label?: string;
  validationErrors?: string[];
}

/**
 * Translatable name field for annotation layers (Pattern 2).
 *
 * Stores translations inside the layer object:
 *   layer.translations.name.{locale}
 *
 * Feature flag OFF → plain TextControl (no hooks, no Redux).
 * Feature flag ON  → Input + LocaleSwitcher suffix.
 */
export default function TranslatableNameField(
  props: TranslatableNameFieldProps,
) {
  if (!isFeatureEnabled(FeatureFlag.EnableContentLocalization)) {
    return (
      <TextControl
        name="annotation-layer-name"
        label={props.label}
        placeholder=""
        value={props.value}
        onChange={props.onChange}
        validationErrors={props.validationErrors}
      />
    );
  }

  return <TranslatableNameFieldInner {...props} />;
}

function TranslatableNameFieldInner({
  value,
  onChange,
  translations,
  onTranslationsChange,
  label,
  validationErrors,
}: TranslatableNameFieldProps) {
  // --- Locale state ---
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

  const fieldTranslations = translations.name ?? {};
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

  // --- Derived state ---
  const isLocaleMode = activeLocale !== DEFAULT_LOCALE_KEY;

  const handleDefaultChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const handleTranslationChange = (val: string) => {
    onTranslationsChange({
      ...translations,
      name: {
        ...(translations.name ?? {}),
        [activeLocale]: val,
      },
    });
  };

  // --- LocaleSwitcher (shared between modes) ---
  const localeSwitcher =
    allLocales.length > 0 ? (
      <LocaleSwitcher
        fieldName="name"
        defaultValue={value}
        translations={translations}
        allLocales={allLocales}
        defaultLocale={defaultLocale}
        userLocale={userLocale}
        activeLocale={activeLocale}
        onLocaleChange={setActiveLocale}
        fieldLabel={String(label ?? 'Name')}
      />
    ) : null;

  // --- Render ---
  if (isLocaleMode) {
    return (
      <div>
        <ControlHeader
          name="annotation-layer-name"
          label={label}
          validationErrors={validationErrors}
        />
        <TranslationInput
          value={fieldTranslations[activeLocale] ?? ''}
          onChange={handleTranslationChange}
          placeholder={value}
          suffix={localeSwitcher}
          aria-label={label}
        />
      </div>
    );
  }

  return (
    <div>
      <ControlHeader
        name="annotation-layer-name"
        label={label}
        validationErrors={validationErrors}
      />
      <Input
        type="text"
        data-test="inline-name"
        placeholder=""
        onChange={handleDefaultChange}
        value={value}
        suffix={localeSwitcher}
        aria-label={label}
      />
    </div>
  );
}
