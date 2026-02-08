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
import type { ChangeEvent, ReactNode } from 'react';
import { t } from '@apache-superset/core';
import { FormItem, Input, FormInstance } from '@superset-ui/core/components';
import { ModalFormField } from 'src/components/Modal';
import { ValidationObject } from 'src/components/Modal/useModalValidation';
import { DEFAULT_LOCALE_KEY } from 'src/components/TranslationEditor';

interface BasicInfoSectionProps {
  form: FormInstance;
  validationStatus: ValidationObject;
  /** LocaleSwitcher component rendered as Input suffix. Undefined when feature disabled. */
  localeSwitcher?: ReactNode;
  /** Currently active locale for the title field. Undefined when feature disabled. */
  activeLocale?: string;
  /** Translation text when activeLocale is not 'default'. Undefined otherwise. */
  translationValue?: string;
  /** Called when translation text changes (activeLocale !== 'default'). */
  onTranslationChange?: (value: string) => void;
}

const BasicInfoSection = ({
  form,
  validationStatus,
  localeSwitcher,
  activeLocale,
  translationValue,
  onTranslationChange,
}: BasicInfoSectionProps) => {
  const titleValue = form.getFieldValue('title') ?? '';
  const hasError =
    validationStatus.basic?.hasErrors &&
    (!titleValue || titleValue.trim().length === 0);

  const isEditingTranslation =
    activeLocale !== undefined && activeLocale !== DEFAULT_LOCALE_KEY;

  return (
    <>
      <ModalFormField
        label={t('Name')}
        required
        testId="dashboard-name-field"
        error={hasError ? t('Dashboard name is required') : undefined}
        helperText={
          activeLocale === DEFAULT_LOCALE_KEY
            ? t('Default text — shown to users without a translation for their language')
            : undefined
        }
      >
        {/* Hidden FormItem preserves form binding for the default title value */}
        <FormItem
          name="title"
          noStyle
          hidden={isEditingTranslation}
          rules={[
            {
              required: true,
              message: t('Dashboard name is required'),
              whitespace: true,
            },
          ]}
        >
          <Input
            placeholder={t('The display name of your dashboard')}
            data-test="dashboard-title-input"
            type="text"
            suffix={!isEditingTranslation ? localeSwitcher : undefined}
          />
        </FormItem>
        {isEditingTranslation && (
          <Input
            value={translationValue}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              onTranslationChange?.(e.target.value)
            }
            placeholder={t('Translation for %s', activeLocale.toUpperCase())}
            data-test="dashboard-title-input"
            type="text"
            suffix={localeSwitcher}
          />
        )}
      </ModalFormField>
      <ModalFormField
        label={t('URL Slug')}
        testId="dashboard-slug-field"
        bottomSpacing={false}
      >
        <FormItem name="slug" noStyle>
          <Input
            placeholder={t('A readable URL for your dashboard')}
            data-test="dashboard-slug-input"
            type="text"
          />
        </FormItem>
      </ModalFormField>
    </>
  );
};

export default BasicInfoSection;
