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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { t } from '@apache-superset/core';
import { css } from '@apache-superset/core/ui';
import {
  Button,
  Divider,
  Modal,
  Select,
} from '@superset-ui/core/components';
import type { Translations, LocaleInfo } from 'src/types/Localization';
import TranslationField from './TranslationField';

/** Describes a translatable field on the entity being edited. */
export interface TranslatableField {
  /** Field key matching the translations dict (e.g., "dashboard_title"). */
  name: string;
  /** Human-readable label (e.g., "Dashboard Title"). */
  label: string;
  /** Original (default-locale) value of the field. */
  value: string;
}

interface TranslationEditorModalProps {
  /** Controls modal visibility. */
  show: boolean;
  /** Translatable fields with their original values. */
  fields: TranslatableField[];
  /** Existing translations keyed by field name and locale. */
  translations: Translations;
  /** Locales available for translation (from server config). */
  availableLocales: LocaleInfo[];
  /** Called with cleaned translations on save. Empty values are stripped. */
  onSave: (translations: Translations) => void;
  /** Called when the modal is dismissed without saving. */
  onClose: () => void;
}

function deepCopyTranslations(src: Translations): Translations {
  const copy: Translations = {};
  Object.keys(src).forEach(field => {
    copy[field] = { ...src[field] };
  });
  return copy;
}

function stripEmptyValues(translations: Translations): Translations {
  const cleaned: Translations = {};
  Object.entries(translations).forEach(([field, locales]) => {
    const filtered: Record<string, string> = {};
    Object.entries(locales).forEach(([locale, value]) => {
      if (value) {
        filtered[locale] = value;
      }
    });
    if (Object.keys(filtered).length > 0) {
      cleaned[field] = filtered;
    }
  });
  return cleaned;
}

/**
 * Modal for editing translations of entity fields.
 * Renders a section per field with locale-specific inputs and
 * a language selector for adding new translations.
 */
export default function TranslationEditorModal({
  show,
  fields,
  translations,
  availableLocales,
  onSave,
  onClose,
}: TranslationEditorModalProps) {
  const [draft, setDraft] = useState<Translations>(() =>
    deepCopyTranslations(translations),
  );

  useEffect(() => {
    if (show) {
      setDraft(deepCopyTranslations(translations));
    }
  }, [show, translations]);

  const handleFieldChange = useCallback(
    (fieldName: string, locale: string, value: string) => {
      setDraft(prev => ({
        ...prev,
        [fieldName]: { ...prev[fieldName], [locale]: value },
      }));
    },
    [],
  );

  const handleRemoveLocale = useCallback(
    (fieldName: string, locale: string) => {
      setDraft(prev => {
        const fieldCopy = { ...prev[fieldName] };
        delete fieldCopy[locale];
        return { ...prev, [fieldName]: fieldCopy };
      });
    },
    [],
  );

  const handleAddLocale = useCallback(
    (fieldName: string, localeCode: string) => {
      setDraft(prev => ({
        ...prev,
        [fieldName]: { ...prev[fieldName], [localeCode]: '' },
      }));
    },
    [],
  );

  const handleSave = useCallback(() => {
    onSave(stripEmptyValues(draft));
  }, [draft, onSave]);

  const localeNameMap = useMemo(
    () =>
      Object.fromEntries(
        availableLocales.map(loc => [loc.code, loc.name]),
      ),
    [availableLocales],
  );

  return (
    <Modal
      show={show}
      onHide={onClose}
      title={t('Edit Translations')}
      footer={
        <div
          css={css`
            display: flex;
            justify-content: flex-end;
            gap: 8px;
          `}
        >
          <Button buttonStyle="secondary" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button buttonStyle="primary" onClick={handleSave}>
            {t('Save translations')}
          </Button>
        </div>
      }
    >
      {fields.map((field, idx) => {
        const fieldTranslations = draft[field.name] ?? {};
        const usedLocales = new Set(Object.keys(fieldTranslations));
        const unusedLocales = availableLocales.filter(
          loc => !usedLocales.has(loc.code),
        );

        return (
          <div key={field.name}>
            {idx > 0 && <Divider />}
            <div
              css={css`
                margin-bottom: 8px;
                font-weight: 600;
              `}
            >
              {field.label}
            </div>
            <div
              css={css`
                margin-bottom: 12px;
                opacity: 0.7;
              `}
            >
              {field.value}
            </div>
            <div
              css={css`
                display: flex;
                flex-direction: column;
                gap: 8px;
              `}
            >
              {Object.entries(fieldTranslations).map(([locale, value]) => (
                <TranslationField
                  key={`${field.name}-${locale}`}
                  locale={locale}
                  localeName={localeNameMap[locale] ?? locale}
                  value={value}
                  onChange={val =>
                    handleFieldChange(field.name, locale, val)
                  }
                  onRemove={() =>
                    handleRemoveLocale(field.name, locale)
                  }
                />
              ))}
            </div>
            {unusedLocales.length > 0 && (
              <Select
                css={css`
                  margin-top: 8px;
                  width: 200px;
                `}
                placeholder={t('Add language')}
                options={unusedLocales.map(loc => ({
                  label: `${loc.name} (${loc.code})`,
                  value: loc.code,
                }))}
                onChange={(value: string) =>
                  handleAddLocale(field.name, value)
                }
                value={undefined}
                ariaLabel={t('Add language for %s', field.label)}
              />
            )}
          </div>
        );
      })}
    </Modal>
  );
}
